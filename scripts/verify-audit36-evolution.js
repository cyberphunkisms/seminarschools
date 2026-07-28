#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const RELEASE_ID = '2026-07-24-site-audit36-discovery-resilience-final';
const ASSET_VERSION = '20260724-audit36';
const GENERATED_AT = '2026-07-24T11:35:00-04:00';
const AUDIT35_RELEASE_ID = '2026-07-23-site-audit35-resilience-polish-final';
// Keep the prior asset token split so the release stamper cannot rewrite this
// verifier's negative anti-backtracking assertion while it updates active files.
const AUDIT35_ASSET_VERSION = '20260723-' + 'audit35';
const AUDIT35_FROZEN_MANIFEST_SHA256 = 'd269d0620b876e5babbe2678c61ed55429eaac236e57703738543939aab6695d';
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
    return crypto.createHash('sha256').update(fs.readFileSync(filePath(relative))).digest('hex');
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

// Release and report alignment.
const releaseId = read('RELEASE_ID.txt').trim();
const release = readJson('RELEASE_MANIFEST.json');
const buildManifest = readJson('data/polymythcal-build-manifest.json');
const publicRelease = readJson('public/site-release.json');
const stamp = read('scripts/apply-audit36-release-stamp.js');
const report = read('WEBSITE_AUDIT36_DISCOVERY_RESILIENCE_REPORT_2026-07-24.md');

check(releaseId === RELEASE_ID, `release ID is ${releaseId || 'missing'}`);
check(release.release_id === RELEASE_ID, 'RELEASE_MANIFEST.json is not Audit 36');
check(release.generated_at === GENERATED_AT, 'Audit 36 generated_at is not the stamp value');
check(release.polymythcal_asset_version === ASSET_VERSION, 'Audit 36 asset version is missing');
check(/^Audit 36\b/.test(String(release.release_type || '')), 'release type is not stamped Audit 36');
check(
  buildManifest.build_id === RELEASE_ID
    && buildManifest.release_id === RELEASE_ID
    && buildManifest.interface_release === RELEASE_ID
    && buildManifest.generated_at === GENERATED_AT
    && buildManifest.polymythcal_asset_version === ASSET_VERSION,
  'Polymythcal build manifest is not release/stamp aligned',
);
check(
  publicRelease.release_id === RELEASE_ID && publicRelease.generated_at === GENERATED_AT,
  'public/site-release.json is stale; run the canonical build after stamping',
);
includesAll('Audit 36 release stamp', stamp, [
  `const NEW_ASSET = '${ASSET_VERSION}'`,
  `const RELEASE_ID = '${RELEASE_ID}'`,
  `const GENERATED_AT = '${GENERATED_AT}'`,
  'WEBSITE_AUDIT35_RESILIENCE_POLISH_REPORT_2026-07-23.md',
  'data/polymythcal-audit35/',
  'data/audit35-route-browser/',
  'data/audit35-frozen-sha256.json',
]);
includesAll('Audit 36 report', report, [
  '# Website Audit 36 — Discovery and Interaction Resilience',
  'No global redesign',
  '213 active, harvest-enabled',
  'confirmed-empty',
  'Fresh Audit 36 Chromium execution was not claimed',
  'Direction-level work held for approval',
  'This was not a security audit',
]);
const releaseNotes = Array.isArray(release.notes) ? release.notes.join('\n') : '';
includesAll('Audit 36 release notes', releaseNotes, [
  '838 canonical listings',
  '32 types',
  '422 registered sources',
  '595 qualified unconfirmed records',
  '24-item batches',
  'All 41 priority sources',
  '213 additional compatible sources',
  'four-run rotation',
  'confirmed-empty',
  '644 resources',
  '25 collections',
  'seven groups',
  'Fifty-five Audit 35',
]);
for (const relative of [
  'index.html',
  'polymythseminars/index.html',
  'teacherresources/index.html',
  'scripts/apply-sitewide-type-zoom-link.js',
]) {
  const source = read(relative);
  check(source.includes(ASSET_VERSION), `${relative} is not stamped ${ASSET_VERSION}`);
  check(!source.includes(AUDIT35_ASSET_VERSION), `${relative} retains the active Audit 35 asset token`);
}

// Dataset and project invariants.
const eventsDocument = readJson('polymythseminars/events.json');
const browseDocument = readJson('polymythseminars/browse.json');
const sourceDocument = readJson('scripts/sources.json');
const teacher = readJson('teacherresources/resources-data.json');
const events = Array.isArray(eventsDocument) ? eventsDocument : eventsDocument.events || [];
const browse = Array.isArray(browseDocument) ? browseDocument : browseDocument.events || [];
const sources = Array.isArray(sourceDocument) ? sourceDocument : sourceDocument.sources || [];
const groups = Array.isArray(teacher.groups) ? teacher.groups : [];
const teacherEntries = groups.flatMap(group =>
  (group.categories || []).flatMap(category => category.entries || [])
);
const teacherCollections = groups.reduce(
  (total, group) => total + (group.categories || []).length,
  0,
);
check(events.length === 838, `Polymythcal events changed: ${events.length}/838`);
check(browse.length === 838, `Polymythcal browse records changed: ${browse.length}/838`);
check(new Set(events.map(event => event.id)).size === 838, 'Polymythcal IDs are no longer unique');
check(new Set(events.map(event => event.type)).size === 32, 'Polymythcal type count changed');
check(events.filter(event => event.confirmation_status === 'unconfirmed').length === 595, 'Polymythcal unconfirmed count changed');
check(sources.length === 422, `source registry changed: ${sources.length}/422`);
check(teacherEntries.length === 644, `Teacher Resources changed: ${teacherEntries.length}/644`);
check(teacherCollections === 25, `Teacher collections changed: ${teacherCollections}/25`);
check(groups.length === 7, `Teacher groups changed: ${groups.length}/7`);
check(/const PAGE_SIZE = 24;/.test(read('js/polymythcal-revamp.js')), 'Polymythcal batch size changed from 24');

// Active source schema and deterministic coverage.
const activeSources = sources.filter(source => source.enabled !== false);
const disabledSources = sources.filter(source => source.enabled === false);
const requiredActiveFields = ['id', 'name', 'events_url', 'source_mode', 'harvest_enabled', 'tier_priority', 'default_type', 'render_mode'];
check(activeSources.length === 407, `active sources changed: ${activeSources.length}/407`);
check(disabledSources.length === 15, `disabled legacy sources changed: ${disabledSources.length}/15`);
for (const source of activeSources) {
  for (const field of requiredActiveFields) {
    check(source[field] !== undefined && source[field] !== '', `active source ${source.id || '(missing id)'} lacks ${field}`);
  }
}
check(new Set(sources.map(source => source.id)).size === 422, 'source registry has duplicate IDs');
const isActiveHttp = source =>
  source.enabled !== false
  && source.harvest_enabled !== false
  && source.source_mode !== 'manual'
  && String(source.render_mode || '').toLowerCase() !== 'manual'
  && /^https?:\/\//.test(String(source.events_url || ''));
const priority = sources.filter(source =>
  isActiveHttp(source)
  && source.default_type !== 'protest'
  && Number(source.tier_priority || 99) === 1
);
const extraModes = new Set(['static', 'server-rendered', 'wordpress', 'drupal']);
const extras = sources.filter(source =>
  isActiveHttp(source)
  && source.default_type !== 'protest'
  && Number(source.tier_priority || 99) !== 1
  && extraModes.has(String(source.render_mode || '').toLowerCase())
);
check(priority.length === 41, `every-run priority set changed: ${priority.length}/41`);
check(extras.length === 213, `deterministic rotating pool changed: ${extras.length}/213`);
const shardCounts = [0, 0, 0, 0];
for (const source of extras) {
  const digest = crypto.createHash('sha256').update(String(source.id)).digest();
  const shard = Number(digest.readBigUInt64BE(0) % 4n);
  shardCounts[shard] += 1;
}
check(shardCounts.join(',') === '49,55,55,54', `deterministic source shards changed: ${shardCounts.join(',')}`);
const schema = readJson('data/polymythcal-source-schema.json');
check(schema.$schema === 'https://json-schema.org/draft/2020-12/schema', 'source schema is missing Draft 2020-12 identity');
includesAll('source validator', read('scripts/validate_polymythcal_sources.py'), [
  'Draft202012Validator',
  'duplicate id',
  'load_validated_roster',
]);
includesAll('structured harvester', read('scripts/harvest_structured_events.py'), [
  'scheduled_deterministic_sources',
  'priority-plus-rotating-deterministic-non-protest',
  'load_validated_roster',
  '"priority_sources"',
  '"rotating_sources"',
]);
includesAll('source sharding helper', read('scripts/polymythcal_sharding.py'), [
  'DEFAULT_DETERMINISTIC_SHARD_COUNT = 4',
  'hashlib.sha256',
  'priority_deterministic_sources',
  'rotating_deterministic_source_pool',
  'scheduled_deterministic_sources',
]);

// Cadence, source-health, and deterministic date contracts.
const protestWorkflow = read('.github/workflows/scrape-polymythcal-protests.yml');
includesAll('protest workflow', protestWorkflow, [
  '18 */4 * * *',
  'Harvest every protest source without sharding',
  'python3 scripts/harvest_protests.py',
  'python3 scripts/publish_protest_harvest.py',
  'cancel-in-progress: false',
]);
check(!protestWorkflow.includes('--shard'), 'protest crawl introduced sharding');
check(!/CLAUDE|ANTHROPIC/.test(protestWorkflow), 'four-hour protest workflow now consumes the optional paid agent');
check(read('.github/workflows/scrape-seminars.yml').includes('47 8 * * 1,4'), 'seminar cadence changed');
check(read('.github/workflows/scrape-festivals.yml').includes('42 9 * * 2,5'), 'festival cadence changed');
const protestHarvester = read('scripts/harvest_protests.py');
const protestPublisher = read('scripts/publish_protest_harvest.py');
includesAll('protest source-health gate', protestHarvester, [
  'def evaluate_source_health',
  '"confirmed-empty"',
  '"no-authoritative-primary-source-observation"',
  '"source_health_gate"',
  'SOURCE_HEALTH_FAILURE_EXIT = 69',
]);
includesAll('protest publisher gate', protestPublisher, [
  'def source_health_gate_error',
  'gate.get("status") != "passed"',
  'authoritative_primary_sources',
  'Refusing protest publication',
]);
includesAll('protest behavior tests', read('scripts/test_polymythcal_protest_harvest.py'), [
  'test_all_primary_source_failures_block_publication',
  'test_all_parse_regressions_are_a_systemic_failure',
  'test_confirmed_empty_zero_event_run_passes_source_health_gate',
  'test_publisher_refuses_failed_gate_before_writing_calendar',
]);
includesAll('festival runner', read('scripts/festivals-prompt-runner.sh'), [
  'polymythcal_sharding.py shard',
  'FESTIVAL_SHARD_COUNT',
]);
check(!read('scripts/festivals-prompt-runner.sh').includes('/ 259200'), 'festival runner retains the gap-producing three-day bucket');
const buildDate = read('scripts/polymythcal-build-date.js');
includesAll('release-owned build date', buildDate, [
  'RELEASE_MANIFEST.json',
  'America/Toronto',
  'SITE_BUILD_DATE',
  'dateOneYearAfter',
]);
check(!/new Date\s*\(/.test(read('scripts/update-polymythcal-build-manifest.js')), 'manifest updater reintroduced a wall-clock date');
includesAll('search-surface expiry handling', read('scripts/build-search-pages.js'), [
  'function archiveExpiredStableEventPages(events)',
  'archiveExpiredStableEventPages(events);',
  'meta name="robots" content="noindex,follow"',
  'data-event-archive-note',
]);

// Current focused gates and runtime/build/package contracts.
const pkg = readJson('package.json');
const runner = read('scripts/verify-all-runner.js');
const predeploy = read('.github/workflows/predeploy.yml');
const browserEvidenceGate = read('scripts/verify-audit36-browser-evidence.js');
const currentGates = {
  'verify:audit36-visual-p0': 'node scripts/verify-audit36-visual-p0.mjs',
  'verify:audit36-graph-resilience': 'node scripts/verify-audit36-graph-resilience.mjs',
  'verify:audit36-animation-lifecycle': 'node scripts/verify-audit36-animation-lifecycle.mjs',
  'verify:audit36-artifact-atomicity': 'node scripts/verify-audit36-artifact-atomicity.js',
  'verify:audit36-aa-dialog': 'node scripts/verify-audit36-aa-dialog.mjs',
  'verify:audit36-aitr-resilience': 'node scripts/verify-audit36-aitr-resilience.mjs',
  'verify:audit36-evolution': 'node scripts/verify-audit36-evolution.js',
};
for (const [name, command] of Object.entries(currentGates)) {
  check(pkg.scripts?.[name] === command, `package script ${name} is not exact`);
  check(runner.includes(command), `verify:all does not execute ${command}`);
}
check(!runner.includes('node scripts/verify-audit35-evolution.js'), 'current runner still executes historical Audit 35 evolution');
check(pkg.scripts?.['apply:audit36-release-stamp'] === 'node scripts/apply-audit36-release-stamp.js', 'Audit 36 stamp command is missing');
for (const historicalStamp of ['apply:audit34-release-stamp', 'apply:audit35-release-stamp']) {
  check(!pkg.scripts?.[historicalStamp], `historical release stamp remains executable through npm: ${historicalStamp}`);
}
check(
  pkg.scripts?.['audit:polymythcal-wcag22'] === 'node scripts/run-python.js scripts/audit-polymythcal-wcag22-audit36.py',
  'WCAG audit alias does not target Audit 36 evidence',
);
check(
  pkg.scripts?.['audit:polymythcal-interactivity'] === 'node scripts/run-python.js scripts/audit-polymythcal-interactivity-design-audit36.py',
  'interaction audit alias does not target Audit 36 evidence',
);
check(
  pkg.scripts?.['audit:polymythcal-entry-pages:strict'] === 'node scripts/run-python.js scripts/preflight-python-browser-audit.py && node scripts/run-python.js scripts/audit-polymythcal-entry-pages-audit36.py',
  'entry-page audit alias does not target Audit 36 evidence',
);
check(
  pkg.scripts?.['verify:audit36-browser-evidence'] === 'node scripts/verify-audit36-browser-evidence.js',
  'Audit 36 fresh-browser evidence command is missing or inexact',
);
check(pkg.scripts?.['verify:all'] === 'node scripts/verify-all-runner.js', 'verify:all no longer uses the central runner');
check(pkg.scripts?.['verify:all:built'] === 'node scripts/verify-all-runner.js --reuse-build', 'verify:all:built changed');
check(
  pkg.scripts?.build?.includes('node scripts/build-polymythcal-browser-payload.js && node scripts/update-polymythcal-build-manifest.js && node scripts/build-public-deploy.js'),
  'canonical build does not refresh the deterministic Polymythcal manifest before publishing',
);
check(
  pkg.scripts?.build?.indexOf('node scripts/update-polymythcal-build-manifest.js')
    < pkg.scripts?.build?.indexOf('node scripts/verify-polymythcal-build-efficiency.js'),
  'canonical build verifies Polymythcal metrics before regenerating them',
);
check(
  !runner.includes('node scripts/verify-audit36-browser-evidence.js'),
  'static verify:all incorrectly requires browser evidence before the predeploy browser run creates it',
);
includesAll('Audit 36 predeploy browser contract', predeploy, [
  'needs: clean-build',
  'npm run verify:all:built',
  'python -m playwright install --with-deps chromium',
  'python scripts/audit-polymythcal-interactivity-design-audit36.py',
  'node scripts/run-python.js scripts/audit-polymythcal-entry-pages-audit36.py',
  'python scripts/audit-polymythcal-wcag22-audit36.py',
  'python scripts/audit-audit36-route-resilience.py',
  'python scripts/audit-project-failure-stress-audit36.py',
  'node scripts/verify-audit36-browser-evidence.js',
  'name: audit36-predeploy-browser-evidence',
  'data/polymythcal-audit36/**',
  'data/audit36-route-browser/**',
  'scripts/reports/audit36-project-failure-stress.json',
  'POLYMYTHCAL_WCAG22_AA_AUDIT36_2026-07-24.md',
  'retention-days: 14',
]);
for (const stale of [
  'data/polymythcal-audit35/**',
  'data/audit35-route-browser/**',
  'scripts/reports/audit35-project-failure-stress.json',
  'verify-audit35-browser-evidence.js',
]) {
  check(!predeploy.includes(stale), `Audit 36 predeploy still uploads or verifies stale evidence: ${stale}`);
}
check(
  predeploy.indexOf('python -m playwright install --with-deps chromium')
    > predeploy.indexOf('npm run verify:all:built'),
  'predeploy installs Chromium before the cheaper static release gates pass',
);
check(
  predeploy.indexOf('node scripts/verify-audit36-browser-evidence.js')
    > predeploy.indexOf('python scripts/audit-project-failure-stress-audit36.py'),
  'predeploy verifies Audit 36 browser evidence before all five audits finish',
);
includesAll('Audit 36 fresh-browser evidence gate', browserEvidenceGate, [
  `const EXPECTED_RELEASE_ID = '${RELEASE_ID}'`,
  'data/polymythcal-audit36/interaction-design-browser-audit.json',
  'data/polymythcal-audit36/entry-pages-browser-audit.json',
  'data/polymythcal-audit36/wcag22-browser-audit.json',
  'data/audit36-route-browser/route-resilience-browser-audit.json',
  'scripts/reports/audit36-project-failure-stress.json',
  'const MAX_EVIDENCE_AGE_MS = 2 * 60 * 60 * 1000',
  'report.audit !== 36',
  'report.release_id !== EXPECTED_RELEASE_ID',
  'report.generated_at !== RELEASE.generated_at',
  "Date.parse(report.executed_at || '')",
  'passed !== total || failed !== 0',
  'report.results.length !== total',
  'result?.passed !== true',
]);
includesAll('graph page', read('polymyth/sitemap/graph/index.html'), [
  '/js/vendor/d3-7.9.0.min.js',
  'id="graph-fallback"',
  "attr('role', 'button')",
  'height: 100dvh',
]);
check(sha256File('js/vendor/d3-7.9.0.min.js') === 'f2094bbf6141b359722c4fe454eb6c4b0f0e42cc10cc7af921fc158fceb86539', 'vendored D3 checksum changed');
const assetBudget = readJson('scripts/reports/asset-weight-budget.json');
const d3Budget = (assetBudget.knownLargeAssets || []).find(row => row.path === 'js/vendor/d3-7.9.0.min.js');
check(
  d3Budget?.baselineBytes === 279706 && d3Budget?.ceilingBytes === 280000,
  'vendored D3 does not have an exact narrow asset-weight budget',
);
includesAll('animation lifecycle', read('js/bookworm-rain.js'), [
  'requestAnimationFrame(tick)',
  'visibilitychange',
  'pagehide',
  'prefers-reduced-motion: reduce',
]);
check(!/setInterval\s*\(/.test(read('js/bookworm-rain.js')), 'Bookworm rain retains an interval');
check(!/setInterval\s*\(/.test(read('bookwormcard/tamagotchi.js')), 'Tamagotchi retains an interval');
includesAll('AA dialog', read('aa/index.html'), [
  'role="dialog" aria-modal="true"',
  'function activateDetailOverlay()',
  'element.inert = true',
  'detailFocusableElements()',
]);
check(!/overlay\.innerHTML\s*=/.test(read('aa/index.html')), 'AA renderer still destroys its modal panel');
includesAll('AITR resilience', read('aitr/index.html'), [
  'role="status" aria-live="polite"',
  'id="clear-activities"',
  '<noscript>',
  'Monster Battle',
]);
includesAll('staged public build', read('scripts/build-public-deploy.js'), [
  '.public-build-staging',
  '.public-build-previous',
  'function commitBuildOutput',
  'fs.renameSync(BUILD_OUT, OUT)',
]);
check(!read('scripts/build-public-deploy.js').includes('removeDir(OUT);'), 'public build deletes the last good tree before construction');
includesAll('atomic ZIP helper', read('scripts/package_integrity.py'), [
  'temporary_output',
  'def commit_verified_pair(',
  'recover_interrupted_pair(',
  'os.replace(temporary_output, output)',
  'os.replace(temporary_sidecar, sidecar)',
  'committed archive digest differs',
  'committed checksum sidecar differs',
]);
includesAll('atomic package test', read('scripts/test_package_integrity.py'), [
  'test_failed_write_preserves_prior_verified_artifact',
  'test_failed_sidecar_commit_restores_prior_verified_pair',
  'synthetic sidecar commit failure',
  'prior-verified-archive',
]);
includesAll('deployer package', read('scripts/package-deployer-compatible.py'), [
  'WEBSITE_AUDIT36_DISCOVERY_RESILIENCE_REPORT_2026-07-24.md',
  'data/audit35-frozen-sha256.json',
  'scripts/verify-audit36-evolution.js',
  'cv-modular-onepage-samples-final-2026-07-09.zip',
  'Saul_Karim_Nassau_CV_onepage_final_2026-07-09.pdf',
  'write_verified_archive',
]);
includesAll('source package', read('scripts/package-netlify-source.py'), [
  'cv-modular-onepage-samples-final-2026-07-09.zip',
  'Saul_Karim_Nassau_CV_onepage_final_2026-07-09.pdf',
  'write_verified_archive',
]);

// Every selected Audit 35 artifact remains byte-identical.
check(sha256File('data/audit35-frozen-sha256.json') === AUDIT35_FROZEN_MANIFEST_SHA256, 'Audit 35 frozen manifest changed');
const frozen = readJson('data/audit35-frozen-sha256.json');
check(frozen.release_id === AUDIT35_RELEASE_ID, 'Audit 35 frozen manifest has the wrong release');
check(frozen.file_count === 55 && frozen.files?.length === 55, 'Audit 35 frozen manifest does not contain 55 files');
for (const row of frozen.files || []) {
  const absolute = filePath(row.path);
  try {
    const stat = fs.statSync(absolute);
    check(stat.size === row.bytes, `${row.path} size changed from frozen Audit 35`);
    check(sha256File(row.path) === row.sha256, `${row.path} SHA-256 changed from frozen Audit 35`);
  } catch (error) {
    check(false, `${row.path} is missing from frozen Audit 35 evidence`);
  }
}

if (failures.length) {
  console.error('AUDIT 36 EVOLUTION GATE FAILED');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log(
  'AUDIT 36 EVOLUTION GATE PASSED — 838/32/422/595/24 Polymythcal, ' +
  '407 active + 15 disabled sources, 41 every-run + 213 rotating deterministic sources, ' +
  '644/25/7 Teacher Resources, unchanged schedules, source-health/date/UI/animation/' +
  'atomic-artifact contracts, and 55 frozen Audit 35 files preserved.',
);
