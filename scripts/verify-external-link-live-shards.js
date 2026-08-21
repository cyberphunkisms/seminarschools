#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  boundedPositiveInteger,
  buildShardPlan,
  buildBoundedCache,
  discoverExternalUrls,
  failureClassification,
  isReusableCachedSuccess,
  mapWithHostLimits,
  positiveInteger,
  selectLiveUrls,
  utcWeekOrdinal,
} = require('./audit-external-links-live');

const ROOT = path.resolve(__dirname, '..');
const LIMIT = 350;
let passed = 0;
const failures = [];

function check(name, condition, detail='') {
  if (condition) {
    passed++;
    console.log(`PASS  ${name}`);
  } else {
    failures.push(detail ? `${name}: ${detail}` : name);
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function syntheticUrls(count) {
  return Array.from(
    { length: count },
    (_, index) => `https://example.test/resource-${String(index).padStart(4, '0')}`
  );
}

function verifyFullCycle(urls, limit, label) {
  const base = buildShardPlan(urls, limit, 0);
  const visits = new Map(base.urls.map(url => [url, 0]));
  const sizes = [];
  for (let week = 0; week < base.shardCount; week++) {
    const plan = buildShardPlan(urls, limit, week);
    sizes.push(plan.selectedUrls.length);
    for (const url of plan.selectedUrls) visits.set(url, (visits.get(url) || 0) + 1);
  }
  const counts = [...visits.values()];
  check(
    `${label}: every URL appears exactly once per full cycle`,
    counts.length === base.urls.length && counts.every(count => count === 1),
    `${counts.filter(count => count !== 1).length} URLs had a non-unit visit count`
  );
  check(
    `${label}: every shard stays within the URL budget`,
    sizes.every(size => size <= limit),
    `largest shard ${Math.max(0, ...sizes)} exceeds ${limit}`
  );
  check(
    `${label}: shards are balanced`,
    Math.max(0, ...sizes) - Math.min(...sizes) <= 1,
    `sizes ${sizes.join(', ')}`
  );
  check(
    `${label}: shard count is the minimum complete-cycle count`,
    base.shardCount === Math.max(1, Math.ceil(base.urls.length / limit)),
    `${base.shardCount} shards for ${base.urls.length} URLs`
  );
}

async function main() {
check('invalid URL budgets fall back safely', positiveInteger('nope', 250) === 250);
check('valid URL budgets remain exact', positiveInteger('350', 250) === LIMIT);
check('oversized concurrency is capped safely', boundedPositiveInteger('999', 16, 32) === 32);

const monday = Date.UTC(2026, 6, 20, 0, 0, 0);
const sunday = Date.UTC(2026, 6, 26, 23, 59, 59);
const nextMonday = Date.UTC(2026, 6, 27, 0, 0, 0);
check('UTC week identity is stable from Monday through Sunday', utcWeekOrdinal(monday) === utcWeekOrdinal(sunday));
check('UTC week identity advances exactly once on Monday', utcWeekOrdinal(nextMonday) === utcWeekOrdinal(monday) + 1);

for (const count of [0, 1, 350, 351, 701, 1299]) {
  verifyFullCycle(syntheticUrls(count), LIMIT, `synthetic ${count}`);
}

const actualUrls = discoverExternalUrls(ROOT);
const actualPlan = buildShardPlan(actualUrls, LIMIT, utcWeekOrdinal());
verifyFullCycle(actualUrls, LIMIT, 'current repository');
check('repository discovery is deterministic and sorted', actualUrls.every((url, index) => index === 0 || actualUrls[index - 1] <= url));
check('current weekly selection is deterministic', JSON.stringify(actualPlan.selectedUrls) === JSON.stringify(buildShardPlan(actualUrls, LIMIT, actualPlan.weekOrdinal).selectedUrls));
check('the following week selects the following shard', actualPlan.shardCount === 1 || buildShardPlan(actualUrls, LIMIT, actualPlan.weekOrdinal + 1).shardIndex === (actualPlan.shardIndex + 1) % actualPlan.shardCount);
check('the current selected shard respects the 350-URL budget', actualPlan.selectedUrls.length <= LIMIT, `${actualPlan.selectedUrls.length} selected`);

const checkerSource = fs.readFileSync(path.join(ROOT, 'scripts/audit-external-links-live.js'), 'utf8');
for (const field of [
  'total_discovered',
  'selected_this_run',
  'never_checked_in_available_cache',
  'not_yet_scheduled_this_cycle',
  'full_cycle_covers_every_discovered_url_once_if_inventory_is_stable',
]) {
  check(`live report exposes ${field}`, checkerSource.includes(field));
}
check(
  'strict failures are limited to confirmed 404 and 410 responses',
  failureClassification(404) === 'confirmed-broken'
  && failureClassification(410) === 'confirmed-broken'
  && failureClassification(400) !== 'confirmed-broken'
);
check(
  'publisher access denials are classified separately from dead links',
  [401, 403, 407, 451].every(status => failureClassification(status) === 'access-blocked')
);
check(
  'timeouts, throttling, and server errors remain transient or unverifiable',
  failureClassification('timeout') === 'transient-or-unverifiable'
  && failureClassification(429) === 'transient-or-unverifiable'
  && failureClassification(503) === 'transient-or-unverifiable'
);
check(
  'live report separates non-successes, strict failures, classes, and exact rows',
  ['non_successful_selected_urls', 'strict_confirmed_broken_urls', 'failure_classifications', 'strict_failures', 'final_url', 'method'].every(field => checkerSource.includes(field))
);
for (const field of [
  'global_concurrency',
  'per_host_concurrency',
  'request_timeout_ms',
  'bounded_to_current_inventory',
]) {
  check(`live report exposes ${field}`, checkerSource.includes(field));
}

const concurrencyUrls = [
  ...syntheticUrls(8).map(url => url.replace('example.test', 'same-host.test')),
  ...syntheticUrls(4).map(url => url.replace('example.test', 'other-host.test')),
];
let active = 0;
let maxActive = 0;
const activeByHost = new Map();
const maxActiveByHost = new Map();
const concurrencyResults = await mapWithHostLimits(
  concurrencyUrls,
  async url => {
    const host = new URL(url).host;
    active++;
    maxActive = Math.max(maxActive, active);
    activeByHost.set(host, (activeByHost.get(host) || 0) + 1);
    maxActiveByHost.set(host, Math.max(maxActiveByHost.get(host) || 0, activeByHost.get(host)));
    await new Promise(resolve => setTimeout(resolve, 5));
    active--;
    activeByHost.set(host, activeByHost.get(host) - 1);
    return `checked:${url}`;
  },
  3,
  2
);
check('bounded scheduler preserves deterministic result order', concurrencyResults.every((value, index) => value === `checked:${concurrencyUrls[index]}`));
check('bounded scheduler respects global concurrency', maxActive <= 3 && maxActive > 1, `observed ${maxActive}`);
check('bounded scheduler respects per-host concurrency', [...maxActiveByHost.values()].every(value => value <= 2), JSON.stringify(Object.fromEntries(maxActiveByHost)));

const cacheInventory = syntheticUrls(3);
const oldCache = {
  [cacheInventory[0]]: { ok: true, checked_at_ms: 1 },
  'https://removed.example.test/old': { ok: true, checked_at_ms: 1 },
};
const updatedResults = {
  [cacheInventory[1]]: { ok: true, checked_at_ms: 2 },
};
const boundedCache = buildBoundedCache(cacheInventory, oldCache, updatedResults);
check('cache is bounded to the current discovered inventory', Object.keys(boundedCache).length === 2 && !('https://removed.example.test/old' in boundedCache));
check('cache retains prior checks and current-run updates truthfully', boundedCache[cacheInventory[0]].checked_at_ms === 1 && boundedCache[cacheInventory[1]].checked_at_ms === 2);

const cacheNow = 10_000;
const cacheTtl = 1_000;
const freshSuccessUrl = 'https://cache.test/fresh-success';
const freshFailureUrl = 'https://cache.test/fresh-failure';
const staleSuccessUrl = 'https://cache.test/stale-success';
const missingUrl = 'https://cache.test/missing';
const retryCache = {
  [freshSuccessUrl]: { ok: true, status: 200, checked_at_ms: 9_500 },
  [freshFailureUrl]: { ok: false, status: 'timeout', checked_at_ms: 9_500 },
  [staleSuccessUrl]: { ok: true, status: 200, checked_at_ms: 8_000 },
};
check(
  'only fresh successful cache entries are reusable',
  isReusableCachedSuccess(retryCache[freshSuccessUrl], cacheNow, cacheTtl)
  && !isReusableCachedSuccess(retryCache[freshFailureUrl], cacheNow, cacheTtl)
  && !isReusableCachedSuccess(retryCache[staleSuccessUrl], cacheNow, cacheTtl)
);
const cacheRetrySelection = selectLiveUrls(
  [freshSuccessUrl, freshFailureUrl, staleSuccessUrl, missingUrl],
  retryCache,
  cacheNow,
  cacheTtl
);
check(
  'fresh successful checks stay cached while failed, stale, and missing checks run live',
  JSON.stringify(cacheRetrySelection) === JSON.stringify([
    freshFailureUrl,
    staleSuccessUrl,
    missingUrl,
  ]),
  JSON.stringify(cacheRetrySelection)
);
check(
  'transient cached failures are selected for a live rerun',
  cacheRetrySelection.includes(freshFailureUrl) && !cacheRetrySelection.includes(freshSuccessUrl)
);

const workflow = fs.readFileSync(path.join(ROOT, '.github/workflows/audit-external-links.yml'), 'utf8');
check('workflow remains once weekly on Sunday', /cron:\s*["']17 10 \* \* 0["']/.test(workflow));
check('workflow preserves the 350-URL budget', /EXTERNAL_LINK_CHECK_LIMIT:\s*["']350["']/.test(workflow));
check('workflow runs the rotating-shard verifier', workflow.includes('scripts/verify-external-link-live-shards.js'));
check('workflow configures 16-wide bounded concurrency', /EXTERNAL_LINK_CONCURRENCY:\s*["']16["']/.test(workflow));
check('workflow limits each host to four simultaneous requests', /EXTERNAL_LINK_PER_HOST_CONCURRENCY:\s*["']4["']/.test(workflow));
check('workflow keeps the 9-second request timeout explicit', /EXTERNAL_LINK_TIMEOUT_MS:\s*["']9000["']/.test(workflow));
check(
  'single-host timeout-heavy 350-URL shard fits the 20-minute job budget',
  Math.ceil(LIMIT / 4) * 9000 < 20 * 60 * 1000,
  `${Math.ceil(LIMIT / 4) * 9000}ms timeout envelope`
);
check('workflow restores the live cache before checking', workflow.indexOf('actions/cache/restore@v5') < workflow.indexOf('scripts/audit-external-links-live.js'));
check('workflow saves the live cache after checking', workflow.indexOf('actions/cache/save@v5') > workflow.indexOf('scripts/audit-external-links-live.js'));
check('workflow cache path is exact and stable', (workflow.match(/scripts\/reports\/external-link-live-cache\.json/g) || []).length >= 3);
check('workflow cache primary key changes for every run attempt', workflow.includes('external-link-live-v1-${{ runner.os }}-${{ github.run_id }}-${{ github.run_attempt }}'));
check('workflow cache restore prefix remains compatible across weekly runs', workflow.includes('external-link-live-v1-${{ runner.os }}-'));

if (failures.length) {
  console.error(`\nEXTERNAL LINK ROTATING SHARD VERIFICATION FAILED — ${passed} passed, ${failures.length} failed`);
  failures.forEach(failure => console.error(` - ${failure}`));
  process.exit(1);
}

console.log(
  `\nEXTERNAL LINK ROTATING SHARD VERIFICATION PASSED — ${passed}/${passed} checks; `
  + `${actualUrls.length} URLs partition into ${actualPlan.shardCount} weekly shards `
  + `with at most ${LIMIT} URLs each.`
);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
