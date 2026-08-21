#!/usr/bin/env node
'use strict';
/** Optional live rot-checker. It makes network calls, so it is intentionally
 * separate from the normal offline deploy guards. Results are cached in
 * scripts/reports/external-link-live-cache.json.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const crypto = require('crypto');
const { isGeneratedDependencyDirectory } = require('./repository-walk-policy');
const ROOT = path.resolve(__dirname, '..');
const REPORT_DIR = path.join(ROOT, 'scripts', 'reports');
const CACHE = path.join(REPORT_DIR, 'external-link-live-cache.json');
const DEFAULT_MAX = 250;
const DEFAULT_CONCURRENCY = 16;
const DEFAULT_PER_HOST_CONCURRENCY = 4;
const MAX_CONCURRENCY = 32;
const MAX_PER_HOST_CONCURRENCY = 8;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MONDAY_EPOCH_MS = Date.UTC(1970, 0, 5);
const MAX = positiveInteger(process.env.EXTERNAL_LINK_CHECK_LIMIT, DEFAULT_MAX);
const TTL_MS = Number(process.env.EXTERNAL_LINK_CACHE_HOURS || 168) * 3600_000;
const TIMEOUT_MS = Number(process.env.EXTERNAL_LINK_TIMEOUT_MS || 9000);
const CONCURRENCY = boundedPositiveInteger(
  process.env.EXTERNAL_LINK_CONCURRENCY,
  DEFAULT_CONCURRENCY,
  MAX_CONCURRENCY
);
const PER_HOST_CONCURRENCY = Math.min(
  CONCURRENCY,
  boundedPositiveInteger(
    process.env.EXTERNAL_LINK_PER_HOST_CONCURRENCY,
    DEFAULT_PER_HOST_CONCURRENCY,
    MAX_PER_HOST_CONCURRENCY
  )
);
const EXCLUDE = new Set(['.git','node_modules','.netlify','public']);
function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}
function boundedPositiveInteger(value, fallback, maximum) {
  return Math.min(positiveInteger(value, fallback), maximum);
}
function walk(d, out=[]) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (EXCLUDE.has(e.name) || isGeneratedDependencyDirectory(e.name)) continue;
    const f = path.join(d, e.name);
    if (e.isDirectory()) walk(f, out);
    else if (e.isFile() && e.name.endsWith('.html')) out.push(f);
  }
  return out;
}
function linksFrom(file) {
  const text = fs.readFileSync(file, 'utf8').replace(/<script[\s\S]*?<\/script>/gi, ' ');
  const out = [];
  for (const m of text.matchAll(/\b(?:href|src)\s*=\s*(["'])(.*?)\1/gi)) {
    const v = m[2];
    if (/^https?:\/\//i.test(v) && !/^https?:\/\/seminarschools\.com/i.test(v)) out.push(v.split('#')[0]);
  }
  return out;
}
function discoverExternalUrls(root=ROOT) {
  return [...new Set(walk(root).flatMap(linksFrom))].sort();
}
function utcWeekOrdinal(nowMs=Date.now()) {
  const date = new Date(nowMs);
  if (!Number.isFinite(date.getTime())) throw new TypeError('nowMs must identify a valid date');
  const day = date.getUTCDay() || 7;
  const monday = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() - day + 1
  );
  return Math.floor((monday - MONDAY_EPOCH_MS) / WEEK_MS);
}
function positiveModulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}
function buildShardPlan(inputUrls, limit=MAX, weekOrdinal=utcWeekOrdinal()) {
  const safeLimit = positiveInteger(limit, DEFAULT_MAX);
  const urls = [...new Set(inputUrls)].sort();
  const shardCount = Math.max(1, Math.ceil(urls.length / safeLimit));
  const shards = Array.from({ length: shardCount }, () => []);
  urls.forEach((url, index) => shards[index % shardCount].push(url));
  const shardIndex = positiveModulo(weekOrdinal, shardCount);
  const cycleOrdinal = Math.floor(weekOrdinal / shardCount);
  const cycleStartWeekOrdinal = cycleOrdinal * shardCount;
  const cycleStartMs = MONDAY_EPOCH_MS + cycleStartWeekOrdinal * WEEK_MS;
  const cycleEndMs = cycleStartMs + shardCount * WEEK_MS;
  return {
    urls,
    shards,
    shardCount,
    shardIndex,
    selectedUrls: shards[shardIndex],
    weekOrdinal,
    cycleOrdinal,
    cycleStartUtc: new Date(cycleStartMs).toISOString(),
    cycleEndUtcExclusive: new Date(cycleEndMs).toISOString(),
    inventorySha256: crypto.createHash('sha256').update(urls.join('\n')).digest('hex'),
  };
}
function hasCachedCheck(entry) {
  return Boolean(entry && Number.isFinite(Number(entry.checked_at_ms)));
}
function isReusableCachedSuccess(entry, nowMs, ttlMs) {
  if (!entry || entry.ok !== true) return false;
  const checkedAtMs = Number(entry.checked_at_ms);
  const ageMs = Number(nowMs) - checkedAtMs;
  return (
    Number.isFinite(checkedAtMs)
    && Number.isFinite(ageMs)
    && Number.isFinite(Number(ttlMs))
    && ageMs >= 0
    && ageMs < Number(ttlMs)
  );
}
function selectLiveUrls(urls, cache, nowMs, ttlMs) {
  return urls.filter(url => !isReusableCachedSuccess(cache[url], nowMs, ttlMs));
}
function hostKey(url) {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return '__invalid_url__';
  }
}
function mapWithHostLimits(
  urls,
  worker,
  concurrency=CONCURRENCY,
  perHostConcurrency=PER_HOST_CONCURRENCY
) {
  const globalLimit = boundedPositiveInteger(concurrency, DEFAULT_CONCURRENCY, MAX_CONCURRENCY);
  const hostLimit = Math.min(
    globalLimit,
    boundedPositiveInteger(
      perHostConcurrency,
      DEFAULT_PER_HOST_CONCURRENCY,
      MAX_PER_HOST_CONCURRENCY
    )
  );
  if (urls.length === 0) return Promise.resolve([]);
  const pending = urls.map((url, index) => ({ url, index, host: hostKey(url) }));
  const results = new Array(urls.length);
  const activeByHost = new Map();
  let active = 0;
  let completed = 0;
  let stopped = false;

  return new Promise((resolve, reject) => {
    const pump = () => {
      if (stopped) return;
      while (active < globalLimit && pending.length) {
        const nextIndex = pending.findIndex(
          item => (activeByHost.get(item.host) || 0) < hostLimit
        );
        if (nextIndex < 0) break;
        const item = pending.splice(nextIndex, 1)[0];
        active++;
        activeByHost.set(item.host, (activeByHost.get(item.host) || 0) + 1);
        Promise.resolve()
          .then(() => worker(item.url))
          .then(result => {
            results[item.index] = result;
          })
          .catch(error => {
            stopped = true;
            reject(error);
          })
          .finally(() => {
            active--;
            completed++;
            const remainingForHost = (activeByHost.get(item.host) || 1) - 1;
            if (remainingForHost > 0) activeByHost.set(item.host, remainingForHost);
            else activeByHost.delete(item.host);
            if (stopped) return;
            if (completed === urls.length) resolve(results);
            else pump();
          });
      }
    };
    pump();
  });
}
function buildBoundedCache(inventoryUrls, cache, results) {
  const retained = {};
  for (const url of inventoryUrls) {
    const entry = results[url] || cache[url];
    if (hasCachedCheck(entry)) retained[url] = entry;
  }
  return retained;
}
function requestOnce(url, method='HEAD', redirects=0) {
  return new Promise((resolve) => {
    const lib = url.startsWith('https:') ? https : http;
    const req = lib.request(url, { method, timeout: TIMEOUT_MS, headers: { 'User-Agent': 'SeminarSchoolsLinkAudit/1.0' } }, res => {
      const code = res.statusCode || 0;
      const loc = res.headers.location;
      res.resume();
      if ([301,302,303,307,308].includes(code) && loc && redirects < 3) {
        try {
          return resolve(
            requestOnce(new URL(loc, url).toString(), method, redirects + 1)
          );
        } catch { }
      }
      resolve({
        ok: code >= 200 && code < 400,
        status: code,
        method,
        final_url: url,
      });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, status: 'timeout', method, final_url: url });
    });
    req.on('error', err => resolve({
      ok: false,
      status: err.code || err.message,
      method,
      final_url: url,
    }));
    req.end();
  });
}

async function request(url) {
  const head = await requestOnce(url, 'HEAD');
  if (head.ok) return head;
  // HEAD support is inconsistent in the wild. A URL is not classified from a
  // failed HEAD response alone: retry with GET so 403/405/5xx HEAD behaviour,
  // redirects, and transport failures do not create false dead-link failures.
  return requestOnce(url, 'GET');
}

function failureClassification(status) {
  const numericStatus = Number(status);
  if (numericStatus === 404 || numericStatus === 410) return 'confirmed-broken';
  if ([401, 403, 407, 451].includes(numericStatus)) return 'access-blocked';
  if (
    !Number.isInteger(numericStatus)
    || [408, 425, 429].includes(numericStatus)
    || numericStatus >= 500
  ) return 'transient-or-unverifiable';
  if (numericStatus >= 400 && numericStatus < 500) return 'other-client-error';
  return 'transient-or-unverifiable';
}

function countFailureClassifications(failures) {
  return failures.reduce((counts, failure) => {
    counts[failure.classification] = (counts[failure.classification] || 0) + 1;
    return counts;
  }, {});
}

function escapeWorkflowMessage(value) {
  return String(value).replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
}

function writeGithubDiagnostics(failures, strictFailures) {
  for (const failure of failures) {
    const annotation = failure.classification === 'confirmed-broken' ? 'error' : 'warning';
    console.log(
      `::${annotation} title=External link ${failure.classification}::`
      + escapeWorkflowMessage(
        `${failure.url} returned ${failure.status} after ${failure.method || 'GET'}`
      )
    );
  }
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;
  const lines = [
    '## External-link audit',
    '',
    `- Non-successful selected URLs: **${failures.length}**`,
    `- Confirmed broken URLs that fail strict mode: **${strictFailures.length}**`,
    '',
  ];
  if (failures.length) {
    lines.push('| Classification | Status | Method | URL |', '|---|---:|---|---|');
    for (const failure of failures) {
      const safeUrl = String(failure.url).replaceAll('|', '%7C');
      lines.push(
        `| ${failure.classification} | ${failure.status} | ${failure.method || ''} | ${safeUrl} |`
      );
    }
    lines.push('');
  } else {
    lines.push('No selected URLs returned a non-success response.', '');
  }
  fs.appendFileSync(summaryPath, `${lines.join('\n')}\n`);
}
async function main() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {};
  const now = Date.now();
  const plan = buildShardPlan(discoverExternalUrls(), MAX, utcWeekOrdinal(now));
  const urls = plan.selectedUrls;
  const liveUrls = selectLiveUrls(urls, cache, now, TTL_MS);
  const cachedFailuresRetried = liveUrls.filter(
    url => hasCachedCheck(cache[url]) && cache[url].ok !== true
  ).length;
  const liveChecks = await mapWithHostLimits(liveUrls, request);
  const liveResults = new Map(liveUrls.map((url, index) => [url, liveChecks[index]]));
  const results = {};
  for (const url of urls) {
    if (!liveResults.has(url)) {
      results[url] = cache[url];
      continue;
    }
    results[url] = {
      ...liveResults.get(url),
      checked_at: new Date().toISOString(),
      checked_at_ms: now,
    };
  }
  const checked = liveUrls.length;
  const mergedCache = buildBoundedCache(plan.urls, cache, results);
  const inventorySet = new Set(plan.urls);
  const prunedCacheEntries = Object.keys(cache).filter(url => !inventorySet.has(url)).length;
  fs.writeFileSync(CACHE, JSON.stringify(mergedCache, null, 2));
  const bad = Object.entries(results).filter(([, r]) => !r.ok);
  const failures = bad.map(([url, result]) => ({
    url,
    status: result.status,
    classification: failureClassification(result.status),
    method: result.method || null,
    final_url: result.final_url || url,
  }));
  const strictFailures = failures.filter(
    failure => failure.classification === 'confirmed-broken'
  );
  const neverCheckedUrls = plan.urls.filter(url => !hasCachedCheck(mergedCache[url]));
  const notYetScheduledUrls = plan.shards.slice(plan.shardIndex + 1).flat();
  const previouslyScheduledUrls = plan.shards.slice(0, plan.shardIndex).flat();
  const report = {
    generated_at: new Date(now).toISOString(),
    cadence: 'once weekly',
    url_budget: MAX,
    total_discovered: plan.urls.length,
    inventory_sha256: plan.inventorySha256,
    selected_this_run: urls.length,
    selected_urls: urls,
    checked_live_this_run: checked,
    reused_fresh_cache_this_run: urls.length - checked,
    reused_fresh_success_cache_this_run: urls.length - checked,
    cached_failures_retried_this_run: cachedFailuresRetried,
    execution: {
      global_concurrency: CONCURRENCY,
      per_host_concurrency: PER_HOST_CONCURRENCY,
      request_timeout_ms: TIMEOUT_MS,
    },
    cache: {
      loaded_entries: Object.keys(cache).length,
      persisted_entries: Object.keys(mergedCache).length,
      pruned_entries: prunedCacheEntries,
      maximum_entries: plan.urls.length,
      bounded_to_current_inventory: true,
    },
    not_selected_this_run: plan.urls.length - urls.length,
    never_checked_in_available_cache: neverCheckedUrls.length,
    never_checked_urls: neverCheckedUrls,
    rotation: {
      basis: 'UTC Monday week',
      week_ordinal: plan.weekOrdinal,
      cycle_ordinal: plan.cycleOrdinal,
      cycle_start_utc: plan.cycleStartUtc,
      cycle_end_utc_exclusive: plan.cycleEndUtcExclusive,
      shard_index_zero_based: plan.shardIndex,
      shard_number: plan.shardIndex + 1,
      shard_count: plan.shardCount,
      weeks_per_full_cycle: plan.shardCount,
      selected_shard_size: urls.length,
      previously_scheduled_this_cycle: previouslyScheduledUrls.length,
      not_yet_scheduled_this_cycle: notYetScheduledUrls.length,
      not_yet_scheduled_urls: notYetScheduledUrls,
      full_cycle_covers_every_discovered_url_once_if_inventory_is_stable: true,
    },
    non_successful_selected_urls: failures.length,
    strict_confirmed_broken_urls: strictFailures.length,
    failure_classifications: countFailureClassifications(failures),
    failures,
    strict_failures: strictFailures,
  };
  fs.writeFileSync(path.join(REPORT_DIR, 'external-link-live-report.json'), JSON.stringify(report, null, 2));
  writeGithubDiagnostics(failures, strictFailures);
  console.log(
    `LIVE EXTERNAL LINK AUDIT COMPLETE — shard ${plan.shardIndex + 1}/${plan.shardCount}, `
    + `${urls.length}/${plan.urls.length} URLs selected, ${checked} live checks, `
    + `${failures.length} non-successes, ${strictFailures.length} confirmed broken. `
    + 'See scripts/reports/external-link-live-report.json'
  );
  if (process.env.EXTERNAL_LINK_STRICT === '1' && strictFailures.length) process.exit(1);
}

if (require.main === module) {
  main().catch(error => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  boundedPositiveInteger,
  buildShardPlan,
  buildBoundedCache,
  failureClassification,
  discoverExternalUrls,
  mapWithHostLimits,
  positiveInteger,
  isReusableCachedSuccess,
  selectLiveUrls,
  utcWeekOrdinal,
};
