#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  DEFAULT_THRESHOLDS,
  evaluateLiveContent,
} = require('./live-content-integrity');
const { ROUTES } = require('./polymythcal-route-shell');

const ROOT = path.resolve(__dirname, '..');
const RELEASE_ID =
  '2026-07-24-site-audit39-discovery-continuity-route-resilience-final';
const ASSET_VERSION = '20260724-audit39';
const SAUL_ASSET_VERSION = '20260724-audit39-saul-runtime';
const GENERATED_AT = '2026-07-24T22:30:00-04:00';
const AUDIT38_RELEASE_ID =
  '2026-07-24-site-audit38-harvest-operational-integrity-final';
// Keep the prior asset token split so the Audit 39 stamp cannot rewrite this
// verifier's negative checks.
const AUDIT38_ASSET_VERSION = '20260724-' + 'audit38';
const AUDIT38_FROZEN_MANIFEST_SHA256 =
  'bc5864a87fd7f209940232365e223c737567f9631e0e24b162f39fe176070bc3';
const REPORT_PATH =
  'WEBSITE_AUDIT39_DISCOVERY_CONTINUITY_ROUTE_RESILIENCE_REPORT_2026-07-24.md';
const failures = [];
const missing = new Set();

function check(condition, message) {
  if (!condition) failures.push(message);
}

function filePath(relative) {
  return path.join(ROOT, relative);
}

function read(relative) {
  try {
    return fs.readFileSync(filePath(relative), 'utf8');
  } catch (error) {
    if (!missing.has(relative)) {
      failures.push(`${relative} is missing or unreadable: ${error.message}`);
      missing.add(relative);
    }
    return '';
  }
}

function readJson(relative) {
  const source = read(relative);
  if (!source) return {};
  try {
    return JSON.parse(source);
  } catch (error) {
    failures.push(`${relative} is invalid JSON: ${error.message}`);
    return {};
  }
}

function sha256File(relative) {
  try {
    return crypto
      .createHash('sha256')
      .update(fs.readFileSync(filePath(relative)))
      .digest('hex');
  } catch (error) {
    if (!missing.has(relative)) {
      failures.push(`${relative} is missing or unreadable: ${error.message}`);
      missing.add(relative);
    }
    return '';
  }
}

function includesAll(label, source, tokens) {
  for (const token of tokens) {
    check(source.includes(token), `${label} is missing ${token}`);
  }
}

function excludesAll(label, source, tokens) {
  for (const token of tokens) {
    check(!source.includes(token), `${label} still contains ${token}`);
  }
}

function countFiles(relative) {
  const start = filePath(relative);
  if (!fs.existsSync(start)) return 0;
  let count = 0;
  const pending = [start];
  while (pending.length) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(target);
      else if (entry.isFile()) count += 1;
    }
  }
  return count;
}

// Release identity, the current build marker, and the narrative report must
// describe one release. public/site-release.json intentionally stays a
// blocker until the canonical post-stamp build has completed.
const releaseId = read('RELEASE_ID.txt').trim();
const release = readJson('RELEASE_MANIFEST.json');
const buildManifest = readJson('data/polymythcal-build-manifest.json');
const publicRelease = readJson('public/site-release.json');
const stamp = read('scripts/apply-audit39-release-stamp.js');
const report = read(REPORT_PATH);

check(
  releaseId === RELEASE_ID,
  `release ID is ${releaseId || 'missing'}; apply the Audit 39 stamp`,
);
check(release.release_id === RELEASE_ID, 'RELEASE_MANIFEST.json is not Audit 39');
check(release.generated_at === GENERATED_AT, 'Audit 39 generated_at is not the stamp value');
check(
  release.polymythcal_asset_version === ASSET_VERSION,
  'Audit 39 asset version is missing',
);
check(
  /^Audit 39\b/.test(String(release.release_type || '')),
  'release type is not stamped Audit 39',
);
check(
  buildManifest.build_id === RELEASE_ID
    && buildManifest.release_id === RELEASE_ID
    && buildManifest.interface_release === RELEASE_ID
    && buildManifest.generated_at === GENERATED_AT
    && buildManifest.polymythcal_asset_version === ASSET_VERSION,
  'Polymythcal build manifest is not aligned to the Audit 39 stamp',
);
check(
  publicRelease.release_id === RELEASE_ID
    && publicRelease.generated_at === GENERATED_AT,
  'public/site-release.json is stale; run the canonical build after applying the Audit 39 stamp',
);
includesAll('Audit 39 release stamp', stamp, [
  "const OLD_ASSET = '20260724-' + 'audit38';",
  `const NEW_ASSET = '${ASSET_VERSION}';`,
  `const RELEASE_ID =\n  '${RELEASE_ID}';`,
  `const GENERATED_AT = '${GENERATED_AT}';`,
  "if (relative === 'scripts/apply-audit39-release-stamp.js') return true;",
  'audit(?:33|34|35|36|37|38)',
  'Audit 38 evidence remained byte-identical',
]);
includesAll('Audit 39 report', report, [
  '# Website Audit 39 — Discovery Continuity, Route Resilience, and Smoothness',
  'No direction-level decision was needed',
  'Direction-level work held for approval',
  'No local fresh-Chromium run',
  'This was not a security audit.',
  'https://acorncanada.org/news/acorn-beat-the-heat-day-of-action-on-july-15th/',
  'https://developers.google.com/fonts/docs/css2',
  'https://docs.netlify.com/manage/routing/headers/',
]);
const releaseNotes = Array.isArray(release.notes) ? release.notes.join('\n') : '';
includesAll('Audit 39 release notes', releaseNotes, [
  'Audit 38 remains immutable historical evidence',
  'unchanged four-hour deterministic protest crawl',
  'Yearless announcement dates are anchored to their publication year',
  'Generated Polymythcal event pages now disambiguate repeated titles',
  'Teacher Resources routes retain all 644 URLs',
  'Shared runtime controllers now mount once',
  'Google Fonts requests are consolidated per page',
  'Archive creation excludes inherited package manifests',
  'Fresh Audit 39 Chromium evidence is produced separately in predeploy',
  'This was not a security audit',
]);
for (const relative of [
  'index.html',
  'polymythseminars/index.html',
  'teacherresources/index.html',
  'scripts/build-search-pages.js',
  'scripts/apply-sitewide-type-zoom-link.js',
]) {
  const source = read(relative);
  check(source.includes(ASSET_VERSION), `${relative} is not stamped ${ASSET_VERSION}`);
  check(
    !source.includes(AUDIT38_ASSET_VERSION),
    `${relative} retains the active Audit 38 asset token`,
  );
}
for (const relative of ['saul/index.html', 'about/index.html']) {
  const source = read(relative);
  check(
    source.includes(SAUL_ASSET_VERSION),
    `${relative} does not carry the Audit 39 Saul runtime cache token`,
  );
}

// Audit 38 is immutable evidence. Its exact values describe that frozen
// release; the corresponding current values below are floors, never ceilings.
check(
  sha256File('data/audit38-frozen-sha256.json')
    === AUDIT38_FROZEN_MANIFEST_SHA256,
  'Audit 38 frozen manifest changed',
);
const frozen = readJson('data/audit38-frozen-sha256.json');
check(
  frozen.release_id === AUDIT38_RELEASE_ID,
  'Audit 38 frozen manifest has the wrong release',
);
check(frozen.algorithm === 'sha256', 'Audit 38 frozen manifest is not SHA-256');
check(
  frozen.file_count === 14 && frozen.files?.length === 14,
  'Audit 38 frozen inventory is not 14 files',
);
const historicalMetrics = {
  polymythcal_events: 838,
  polymythcal_types: 32,
  registered_sources: 422,
  every_run_deterministic_sources: 41,
  rotating_deterministic_sources: 213,
  teacher_resources: 644,
  teacher_collections: 25,
  teacher_groups: 7,
  methodology_entries: 1139,
  polymythcal_page_size: 24,
  portable_release_checks: 124,
  public_parity_files: 3550,
};
for (const [name, expected] of Object.entries(historicalMetrics)) {
  check(
    frozen.historical_metrics?.[name] === expected,
    `Audit 38 historical metric ${name} changed`,
  );
}
const frozenPaths = new Set();
for (const row of frozen.files || []) {
  if (!row?.path || frozenPaths.has(row.path)) {
    check(
      false,
      `Audit 38 frozen manifest has an invalid or duplicate path: ${row?.path || 'missing'}`,
    );
    continue;
  }
  frozenPaths.add(row.path);
  try {
    const stat = fs.statSync(filePath(row.path));
    check(stat.isFile(), `${row.path} is no longer a file`);
    check(stat.size === row.bytes, `${row.path} size changed from frozen Audit 38`);
    check(
      sha256File(row.path) === row.sha256,
      `${row.path} SHA-256 changed from frozen Audit 38`,
    );
  } catch {
    check(false, `${row.path} is missing from frozen Audit 38 evidence`);
  }
}

const liveInputs = {
  eventsDocument: readJson('polymythseminars/events.json'),
  browseDocument: readJson('polymythseminars/browse.json'),
  sourceDocument: readJson('scripts/sources.json'),
  teacherDocument: readJson('teacherresources/resources-data.json'),
};
const live = evaluateLiveContent(liveInputs);
for (const failure of live.failures) check(false, `live content: ${failure}`);
check(
  live.metrics.events >= historicalMetrics.polymythcal_events,
  `live event floor backtracked: ${live.metrics.events}/838`,
);
check(
  live.metrics.eventTypes >= historicalMetrics.polymythcal_types,
  `live type floor backtracked: ${live.metrics.eventTypes}/32`,
);
check(
  live.metrics.registeredSources >= historicalMetrics.registered_sources,
  `live source floor backtracked: ${live.metrics.registeredSources}/422`,
);
check(
  live.metrics.everyRunDeterministicSources
    >= historicalMetrics.every_run_deterministic_sources,
  `every-run deterministic floor backtracked: ${live.metrics.everyRunDeterministicSources}/41`,
);
check(
  live.metrics.rotatingDeterministicSources
    >= historicalMetrics.rotating_deterministic_sources,
  `rotating deterministic floor backtracked: ${live.metrics.rotatingDeterministicSources}/213`,
);
check(DEFAULT_THRESHOLDS.minimumEvents === 800, 'live event anti-collapse floor changed');
check(
  DEFAULT_THRESHOLDS.minimumEventTypes === 25,
  'live type anti-collapse floor changed',
);
check(
  DEFAULT_THRESHOLDS.minimumRegisteredSources === 400,
  'live source anti-collapse floor changed',
);
check(
  live.metrics.teacherResources === 644
    && live.metrics.teacherCollections === 25
    && live.metrics.teacherGroups === 7,
  `Teacher Resources changed: ${live.metrics.teacherResources}/`
    + `${live.metrics.teacherCollections}/${live.metrics.teacherGroups}`,
);
check(
  /const PAGE_SIZE\s*=\s*24;/.test(read('js/polymythcal-revamp.js')),
  'Polymythcal progressive batch changed from 24',
);
includesAll('growth-tolerant live-content regression test', read('scripts/test-live-content-integrity.js'), [
  'a valid new event must not be rejected by a frozen historical total',
  'duplicate canonical IDs must fail',
  'browse/canonical loss must fail',
  'catastrophic live-record loss must fail',
]);
check(
  countFiles('public') >= historicalMetrics.public_parity_files,
  `public deploy surface fell below the Audit 38 floor: ${countFiles('public')}/3550`,
);

// Methodology List remains exactly 1,139 entries by explicit user constraint,
// while the runtime fix reserves image space and advances one register state.
const methodology = read('polymyth/methodologylist/index.html');
const staticSectionCounts = [
  ...methodology.matchAll(/(\d+) indexed framework entries in a static HTML edition/g),
].map(match => Number(match[1]));
check(
  staticSectionCounts.length === 16
    && staticSectionCounts.reduce((sum, count) => sum + count, 0) === 1139,
  'Methodology List static section parity changed from 1,139 entries',
);
includesAll('Methodology List runtime continuity', methodology, [
  '<span class="c" id="total">1139</span>',
  'function renderEntryImage(e)',
  'width="${width}" height="${height}"',
  'loading="lazy" decoding="async"',
  "const cycle=['both','human','ai']",
]);

// The schedules and cost boundaries are fixed release invariants. The protest
// crawl stays frequent only because it is deterministic, unsharded, and
// paid-agent-free.
const seminarWorkflow = read('.github/workflows/scrape-seminars.yml');
const festivalWorkflow = read('.github/workflows/scrape-festivals.yml');
const protestWorkflow = read('.github/workflows/scrape-polymythcal-protests.yml');
check(/cron:\s*["']47 8 \* \* 1,4["']/.test(seminarWorkflow), 'seminar cadence changed');
check(/cron:\s*["']42 9 \* \* 2,5["']/.test(festivalWorkflow), 'festival cadence changed');
check(/cron:\s*["']18 \*\/4 \* \* \*["']/.test(protestWorkflow), 'protest cadence changed');
includesAll('deterministic protest workflow', protestWorkflow, [
  'Harvest every protest source without sharding',
  'python3 scripts/harvest_protests.py',
  'python3 scripts/publish_protest_harvest.py',
]);
check(!protestWorkflow.includes('--shard'), 'four-hour protest crawl introduced sharding');
check(
  !/CLAUDE|ANTHROPIC|MAX_BUDGET|prompt-runner/i.test(protestWorkflow),
  'four-hour protest crawl now invokes or configures a paid agent',
);
includesAll('bounded festival workflow', festivalWorkflow, [
  'HARVEST_ATTEMPTS: "1"',
  'HARVEST_TIMEOUT_SECONDS: "1500"',
]);

// Discovery recall broadens within the existing bounded crawl rather than
// inventing a newsletter side-channel or raising scrape frequency.
const discovery = read('scripts/polymythcal_discovery.py');
const adapters = read('scripts/polymythcal_adapters.py');
const protests = read('scripts/harvest_protests.py');
includesAll('Audit 39 discovery priority', discovery, [
  'EVENT_NAVIGATION_SIGNAL_RE',
  '"priority-detail"',
  'Signal-bearing links run before generic news links',
  'def _ical_organizer',
  'def _publication_datetime',
  'document_source["_document_url"] = final_url',
]);
includesAll('Audit 39 organizer parsing', adapters, [
  'MAX_HTML_EVENT_TEXT = 24000',
  'reference_date: datetime | None = None',
  'def _jsonld_url',
  'def _jsonld_identifier',
  'def _jsonld_lifecycle',
  '[itemprop=\'streetAddress\']',
  '[itemprop=\'organizer\']',
  '".news-post-content"',
  'bounded parsing window instead of discarding the entire article',
]);
includesAll('Audit 39 partial-observation continuity', protests, [
  'duplicate occurrence identities',
  'duplicate source-health rows',
  'duplicate source ids',
  'def retain_prior_details_during_partial_crawl',
  '"observed-partial"',
  '"current_observation_missing_details"',
]);
const protestConfig = readJson('scripts/protest-sources.json');
check(
  protestConfig.crawl_policy?.sharded === false
    && protestConfig.crawl_policy?.unresolved_recheck_hours === 4
    && protestConfig.crawl_policy?.confirmed_recheck_hours === 12,
  'protest crawl/recheck policy changed',
);
const roster = liveInputs.sourceDocument;
const protestIds = new Set(
  [...(roster.sources || []), ...(protestConfig.sources || [])]
    .filter(source =>
      source?.default_type === 'protest' && source.harvest_enabled !== false
    )
    .map(source => String(source.id)),
);
const requiredProtestIds = [
  'acorn-toronto',
  'action-network-public-organizer-links',
  'cupe-ontario',
  'environmental-defence-nojetsto',
  'findaprotest-toronto',
  'free-grassy',
  'kairos',
  'labour-council',
  'mwac',
  'ofl',
  'ontario-health-coalition',
  'opseu',
  'protest-doug-ford-campaigns',
  'spring-magazine-events',
  'toronto350',
  'yfs',
];
for (const sourceId of requiredProtestIds) {
  check(protestIds.has(sourceId), `required protest source disappeared: ${sourceId}`);
}

// Audit 38's false-green source-health and paid-run efficiency fixes remain
// active underneath the wider Audit 39 discovery surface.
const sourceHealth = read('scripts/polymythcal_source_health.py');
includesAll('shared source-health evaluator', sourceHealth, [
  'MINIMUM_AUTHORITATIVE_RATIO = 0.25',
  'MINIMUM_CRITICAL_AUTHORITATIVE_RATIO = 0.10',
  'insufficient-authoritative-primary-source-coverage',
  'insufficient-critical-source-coverage',
  'saved source selection does not match its source-health gate',
]);
const authoritativeStatuses =
  sourceHealth.match(/AUTHORITATIVE_SOURCE_STATUSES\s*=\s*\{([\s\S]*?)\}/)?.[1] || '';
check(
  !authoritativeStatuses.includes('not-modified'),
  'bare HTTP 304 became authoritative without a retained parsed observation',
);
includesAll('bounded festival runner', read('scripts/festivals-prompt-runner.sh'), [
  'MAX_BUDGET_USD="${MAX_BUDGET_USD:-10.00}"',
  'HARVEST_TIMEOUT_SECONDS="${HARVEST_TIMEOUT_SECONDS:-1500}"',
  'HARVEST_ATTEMPTS="${HARVEST_ATTEMPTS:-1}"',
  'validate_harvest_source_ledger.py festivals',
]);
includesAll('compact seminar ledger', read('scripts/seminars-prompt.md'), [
  'Do not copy the full 422-source roster into the output',
  'one row for every source you were assigned',
  'the runner expands those rows deterministically after validating your output',
]);

// Current generated surfaces remain semantic, idempotent, and additive.
const eventIds = new Set(
  (liveInputs.eventsDocument.events || []).map(event => String(event.id)),
);
let canonicalEventDirectories = 0;
let aliasEventDirectories = 0;
try {
  for (const entry of fs.readdirSync(filePath('polymythseminars/events'), {
    withFileTypes: true,
  })) {
    if (!entry.isDirectory()) continue;
    if (eventIds.has(entry.name)) canonicalEventDirectories += 1;
    else aliasEventDirectories += 1;
  }
} catch {
  check(false, 'generated Polymythcal event directory is unreadable');
}
check(
  canonicalEventDirectories === live.metrics.events,
  `canonical event-route parity changed: ${canonicalEventDirectories}/${live.metrics.events}`,
);
check(
  aliasEventDirectories >= 842,
  `legacy event recovery aliases fell below the Audit 39 floor: ${aliasEventDirectories}/842`,
);
check(
  Object.keys(ROUTES).length >= 11,
  `focused Polymythcal route inventory fell below 11: ${Object.keys(ROUTES).length}`,
);
const sitemap = read('sitemap.xml');
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
check(
  sitemapUrls.length >= 841 && new Set(sitemapUrls).size === sitemapUrls.length,
  `sitemap route floor or uniqueness changed: ${sitemapUrls.length} URLs`,
);
includesAll('generated-route verifier', read('scripts/verify-audit39-generated-routes.js'), [
  'events.length < 838',
  'sources.length < 422',
  'entries.length !== 644',
  'noindex,follow',
  'Event schema confidence does not match indexability',
  'generator check modes modified owned output files',
]);

// Runtime fixes guard against duplicate mounts, focus loss, resize storms,
// unbounded simulation, and layout jumps without replacing project identities.
const runtimeGate = read('scripts/verify-audit39-runtime-ui.mjs');
includesAll('Audit 39 runtime verifier', runtimeGate, [
  '__ssSharedSiteMounted',
  '__ssThemeToggleMounted',
  '__ssKeyboardEnhancementsMounted',
  'buildSearchMatchCache(queryTokens)',
  'focusWithoutScroll',
  'SIM_MAX_ACTIVE_MS',
  'ResizeObserver',
  'scheduleRefresh()',
]);
includesAll('font consolidation build', read('package.json'), [
  'node scripts/consolidate-google-fonts.js',
  'node scripts/verify-audit39-font-delivery.js',
]);
includesAll('cache coherence verifier', read('scripts/verify-audit39-cache-coherence.js'), [
  'public, max-age=2592000, stale-while-revalidate=604800',
  'public, max-age=300, must-revalidate',
  'public, max-age=3600, must-revalidate',
  'public, max-age=900, must-revalidate',
]);
includesAll('package round-trip verifier', read('scripts/verify-audit39-package-roundtrip.js'), [
  'PACKAGE_CONTENTS_SHA256.json',
  'test_reserved_manifest_input_is_rejected',
  'exactly one',
]);

// Audit 39 owns the active static gates and browser adapter. Browser evidence
// remains a post-static-gate predeploy concern and is not required locally.
const pkg = readJson('package.json');
const runner = read('scripts/verify-all-runner.js');
const predeploy = read('.github/workflows/predeploy.yml');
const browserAdapter = read('scripts/run-audit39-browser.py');
const deployerPackage = read('scripts/package-deployer-compatible.py');
const focusedAliases = {
  'verify:frozen-audit38': 'node scripts/verify-frozen-audit38.js',
  'verify:audit39-protest-recall': 'node scripts/verify-audit39-protest-recall.js',
  'verify:audit39-generated-routes': 'node scripts/verify-audit39-generated-routes.js',
  'verify:audit39-runtime-ui': 'node scripts/verify-audit39-runtime-ui.mjs',
  'verify:audit39-cache-coherence': 'node scripts/verify-audit39-cache-coherence.js',
  'verify:audit39-font-delivery': 'node scripts/verify-audit39-font-delivery.js',
  'verify:audit39-methodology-runtime': 'node scripts/verify-audit39-methodology-runtime.js',
  'verify:audit39-package-roundtrip': 'node scripts/verify-audit39-package-roundtrip.js',
  'verify:audit39-evolution': 'node scripts/verify-audit39-evolution.js',
  'verify:audit39-browser-evidence': 'node scripts/verify-audit39-browser-evidence.js',
  'apply:audit39-release-stamp': 'node scripts/apply-audit39-release-stamp.js',
  'audit:polymythcal-wcag22':
    'node scripts/run-python.js scripts/run-audit39-browser.py wcag',
  'audit:polymythcal-interactivity':
    'node scripts/run-python.js scripts/run-audit39-browser.py interaction',
  'audit:polymythcal-entry-pages:strict':
    'node scripts/run-python.js scripts/preflight-python-browser-audit.py && node scripts/run-python.js scripts/run-audit39-browser.py entry-pages',
};
for (const [name, command] of Object.entries(focusedAliases)) {
  check(pkg.scripts?.[name] === command, `package alias ${name} is not current Audit 39`);
}
includesAll('Audit 39 focused package chain', String(pkg.scripts?.['verify:audit39-focused'] || ''), [
  'verify:frozen-audit38',
  'verify:audit39-protest-recall',
  'verify:audit39-generated-routes',
  'verify:audit39-runtime-ui',
  'verify:audit39-cache-coherence',
  'verify:audit39-font-delivery',
  'verify:audit39-methodology-runtime',
  'verify:audit39-package-roundtrip',
  'verify:audit39-evolution',
]);
for (const command of [
  'node scripts/verify-frozen-audit38.js',
  'node scripts/verify-audit39-protest-recall.js',
  'node scripts/verify-audit39-generated-routes.js',
  'node scripts/verify-audit39-runtime-ui.mjs',
  'node scripts/verify-audit39-cache-coherence.js',
  'node scripts/verify-audit39-font-delivery.js',
  'node scripts/verify-audit39-methodology-runtime.js',
  'node scripts/verify-audit39-package-roundtrip.js',
  'node scripts/verify-audit39-evolution.js',
  'node scripts/verify-audit38-methodology-state.js',
  'node scripts/test-live-content-integrity.js',
  'node scripts/run-python.js -m unittest scripts/test_package_integrity.py',
]) {
  check(runner.includes(command), `complete verifier omits ${command}`);
}
check(
  !runner.includes('node scripts/verify-audit38-evolution.js'),
  'complete verifier still executes the historical Audit 38 release gate',
);
check(
  !runner.includes('node scripts/verify-audit39-browser-evidence.js'),
  'portable verifier incorrectly requires fresh local browser evidence',
);
includesAll('Audit 39 browser adapter', browserAdapter, [
  '"interaction": ROOT',
  '"entry-pages": ROOT',
  '"wcag": ROOT',
  '"routes": ROOT',
  '"stress": ROOT',
  '("Audit 37", "Audit 39")',
  'exec(compile(source, str(baseline), "exec"), namespace)',
  'validate_fresh_report(',
]);
includesAll('Audit 39 predeploy browser contract', predeploy, [
  'python -m playwright install --with-deps chromium',
  'python scripts/run-audit39-browser.py interaction',
  'node scripts/run-python.js scripts/run-audit39-browser.py entry-pages',
  'python scripts/run-audit39-browser.py wcag',
  'python scripts/run-audit39-browser.py routes',
  'python scripts/run-audit39-browser.py stress',
  'node scripts/verify-audit39-browser-evidence.js',
  'name: audit39-predeploy-browser-evidence',
  'data/polymythcal-audit39/**',
  'data/audit39-route-browser/**',
  'scripts/reports/audit39-project-failure-stress.json',
  'POLYMYTHCAL_WCAG22_AA_AUDIT39_2026-07-24.md',
  'retention-days: 14',
]);
check(
  predeploy.indexOf('python -m playwright install --with-deps chromium')
    > predeploy.indexOf('npm run verify:all:built'),
  'fresh browser setup is not deferred until portable static gates pass',
);
includesAll('deployer-compatible Audit 39 inventory', deployerPackage, [
  REPORT_PATH,
  'data/audit38-frozen-sha256.json',
  'scripts/apply-audit39-release-stamp.js',
  'scripts/verify-frozen-audit38.js',
  'scripts/verify-audit39-protest-recall.js',
  'scripts/verify-audit39-generated-routes.js',
  'scripts/verify-audit39-runtime-ui.mjs',
  'scripts/verify-audit39-cache-coherence.js',
  'scripts/verify-audit39-font-delivery.js',
  'scripts/verify-audit39-methodology-runtime.js',
  'scripts/verify-audit39-package-roundtrip.js',
  'scripts/run-audit39-browser.py',
  'scripts/verify-audit39-browser-evidence.js',
  'scripts/verify-audit39-evolution.js',
]);
excludesAll('deployer package manifest selection', deployerPackage, [
  "if rel.as_posix()==MANIFEST_NAME:return True",
]);

if (failures.length) {
  console.error('AUDIT 39 EVOLUTION GATE FAILED');
  failures.forEach(failure => console.error(` - ${failure}`));
  process.exit(1);
}

console.log(
  'AUDIT 39 EVOLUTION GATE PASSED — release/report/build alignment; 14 frozen '
    + `Audit 38 files; growth-tolerant live floors (${live.metrics.events} events, `
    + `${live.metrics.eventTypes} types, ${live.metrics.registeredSources} sources, `
    + `${live.metrics.everyRunDeterministicSources}/${live.metrics.rotatingDeterministicSources} `
    + 'deterministic sources); exact 644/25/7 Teacher Resources, 1,139 Methodology '
    + 'entries, and 24-card batches; unchanged cadences; unsharded paid-agent-free '
    + 'protest discovery; semantic generated-route recovery; bounded calm runtimes; '
    + 'coherent font/cache delivery; one-manifest package round trips; and current '
    + 'Audit 39 static, browser-adapter, predeploy, and packaging contracts.',
);
