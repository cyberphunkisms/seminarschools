#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const RELEASE_ID = '2026-07-24-site-audit37-source-health-runtime-polish-final';
const ASSET_VERSION = '20260724-audit37';
const GENERATED_AT = '2026-07-24T13:15:00-04:00';
const AUDIT36_RELEASE_ID = '2026-07-24-site-audit36-discovery-resilience-final';
const AUDIT36_ASSET_VERSION = '20260724-' + 'audit36';
const AUDIT36_FROZEN_MANIFEST_SHA256 = 'ed19dada95c66c9755e385fa61f9ff165f99dce018613b3ba40037a77e888757';
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
    return crypto.createHash('sha256')
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

// Release and report alignment.
const releaseId = read('RELEASE_ID.txt').trim();
const release = readJson('RELEASE_MANIFEST.json');
const buildManifest = readJson('data/polymythcal-build-manifest.json');
const publicRelease = readJson('public/site-release.json');
const stamp = read('scripts/apply-audit37-release-stamp.js');
const report = read('WEBSITE_AUDIT37_SOURCE_HEALTH_RUNTIME_POLISH_REPORT_2026-07-24.md');

check(releaseId === RELEASE_ID, `release ID is ${releaseId || 'missing'}`);
check(release.release_id === RELEASE_ID, 'RELEASE_MANIFEST.json is not Audit 37');
check(release.generated_at === GENERATED_AT, 'Audit 37 generated_at is not the stamp value');
check(release.polymythcal_asset_version === ASSET_VERSION, 'Audit 37 asset version is missing');
check(/^Audit 37\b/.test(String(release.release_type || '')), 'release type is not stamped Audit 37');
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
includesAll('Audit 37 release stamp', stamp, [
  `const OLD_ASSET = '${AUDIT36_ASSET_VERSION}'`,
  `const NEW_ASSET = '${ASSET_VERSION}'`,
  `const RELEASE_ID = '${RELEASE_ID}'`,
  `const GENERATED_AT = '${GENERATED_AT}'`,
  'WEBSITE_AUDIT36_DISCOVERY_RESILIENCE_REPORT_2026-07-24.md',
  'data/audit36-frozen-sha256.json',
  'scripts/verify-audit36-evolution.js',
]);
includesAll('Audit 37 report', report, [
  '# Website Audit 37 — Source Health and Runtime Polish',
  'all-source non-authoritative run',
  'source-yield rows',
  'aria-current="page"',
  'Fresh Audit 37 Chromium execution is not claimed',
  'Direction-level work held for approval',
  'This was not a security audit',
]);
const releaseNotes = Array.isArray(release.notes) ? release.notes.join('\n') : '';
includesAll('Audit 37 release notes', releaseNotes, [
  '838 canonical listings',
  '32 types',
  '422 registered sources',
  '595 qualified unconfirmed records',
  '24-item batches',
  'All 41 priority sources',
  '213 additional compatible sources',
  'main structured source crawl',
  'confirmed-empty',
  '644 resources',
  '25 collections',
  'seven groups',
  'Sixteen selected Audit 36',
]);
for (const relative of [
  'index.html',
  'polymythseminars/index.html',
  'teacherresources/index.html',
  'scripts/apply-sitewide-type-zoom-link.js',
]) {
  const source = read(relative);
  check(source.includes(ASSET_VERSION), `${relative} is not stamped ${ASSET_VERSION}`);
  check(!source.includes(AUDIT36_ASSET_VERSION), `${relative} retains the active Audit 36 asset token`);
}

// Data, source, and interaction invariants.
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

const activeSources = sources.filter(source => source.enabled !== false);
const disabledSources = sources.filter(source => source.enabled === false);
check(activeSources.length === 407, `active sources changed: ${activeSources.length}/407`);
check(disabledSources.length === 15, `disabled sources changed: ${disabledSources.length}/15`);
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
check(priority.length === 41, `priority source set changed: ${priority.length}/41`);
check(extras.length === 213, `rotating deterministic source set changed: ${extras.length}/213`);
const shardCounts = [0, 0, 0, 0];
for (const source of extras) {
  const digest = crypto.createHash('sha256').update(String(source.id)).digest();
  shardCounts[Number(digest.readBigUInt64BE(0) % 4n)] += 1;
}
check(shardCounts.join(',') === '49,55,55,54', `deterministic source shards changed: ${shardCounts.join(',')}`);

const seminarWorkflow = read('.github/workflows/scrape-seminars.yml');
const festivalWorkflow = read('.github/workflows/scrape-festivals.yml');
const protestWorkflow = read('.github/workflows/scrape-polymythcal-protests.yml');
check(seminarWorkflow.includes('47 8 * * 1,4'), 'seminar cadence changed');
check(festivalWorkflow.includes('42 9 * * 2,5'), 'festival cadence changed');
check(protestWorkflow.includes('18 */4 * * *'), 'protest cadence changed');
check(!protestWorkflow.includes('--shard'), 'protest crawl introduced sharding');
check(!/CLAUDE|ANTHROPIC/.test(protestWorkflow), 'four-hour protest crawl now uses the paid agent');
check(!read('scripts/festivals-prompt-runner.sh').includes('/ 259200'), 'festival runner restored gap-producing epoch sharding');

const teacherHtml = read('teacherresources/index.html');
includesAll('Teacher Resources semantics', teacherHtml, [
  'aria-current="page" class="current" href="/teacherresources/"',
  'aria-keyshortcuts="/"',
  '644 resources across 25 collections',
  'id="filter-toggle"',
  'id="copy-view-link"',
  'id="print-results"',
]);

// New source-health boundary and focused tests.
const sourceHealth = read('scripts/polymythcal_source_health.py');
const structured = read('scripts/harvest_structured_events.py');
const deterministicPublisher = read('scripts/publish_deterministic_polymythcal.py');
const merger = read('scripts/merge_and_finalize.py');
const deterministicTests = read('scripts/test_deterministic_before_agent.py');
includesAll('shared source-health evaluator', sourceHealth, [
  'SOURCE_HEALTH_FAILURE_EXIT = 69',
  'def evaluate_source_health(',
  '"confirmed-empty"',
  '"no-authoritative-primary-source-observation"',
  'def source_health_gate_error(',
  'saved source-yield diagnostics do not pass',
  'unknown_source_ids',
]);
includesAll('structured source-health gate', structured, [
  'source_health_gate = evaluate_source_health(sources, yields)',
  '"source_health_gate": source_health_gate',
  'args.output.write_text(',
  'return SOURCE_HEALTH_FAILURE_EXIT',
  'Publication was blocked.',
]);
includesAll('structured publication refusal', deterministicPublisher, [
  'source_health_gate_error(',
  'PublicationInputError',
]);
includesAll('direct merge refusal', merger, [
  'merge_deterministic_protests',
  'merge_deterministic_structured_events',
  'source_health_gate_error(',
]);
includesAll('structured failure diagnostics workflow', seminarWorkflow, [
  'Preserve structured source-health diagnostics',
  'seminars-deterministic-failed.json',
  'if: failure()',
]);
for (const testName of [
  'test_all_selected_source_failures_fail_closed',
  'test_confirmed_empty_is_an_authoritative_zero_event_run',
  'test_cli_writes_diagnostics_then_returns_source_health_failure',
  'test_missing_structured_gate_refuses_before_placeholder_or_merge',
  'test_forged_passed_gate_disagreeing_with_yields_is_refused',
  'test_direct_merger_rejects_a_gate_less_structured_payload',
  'test_failed_structured_crawl_preserves_gate_diagnostics',
]) {
  check(deterministicTests.includes(testName), `focused behavior test ${testName} is missing`);
}

// Current gate, browser, and packaging contracts.
const pkg = readJson('package.json');
const runner = read('scripts/verify-all-runner.js');
const predeploy = read('.github/workflows/predeploy.yml');
const sourceHealthGate = 'node scripts/verify-audit37-source-health.js';
const evolutionGate = 'node scripts/verify-audit37-evolution.js';
check(pkg.scripts?.['verify:audit37-source-health'] === sourceHealthGate, 'Audit 37 source-health command is missing');
check(pkg.scripts?.['verify:audit37-evolution'] === evolutionGate, 'Audit 37 evolution command is missing');
check(runner.includes(sourceHealthGate), 'complete verifier omits Audit 37 source health');
check(runner.includes(evolutionGate), 'complete verifier omits Audit 37 evolution');
check(!runner.includes('node scripts/verify-audit36-evolution.js'), 'current runner still executes historical Audit 36 evolution');
for (const priorGuard of [
  'verify-audit36-visual-p0.mjs',
  'verify-audit36-graph-resilience.mjs',
  'verify-audit36-animation-lifecycle.mjs',
  'verify-audit36-artifact-atomicity.js',
  'verify-audit36-aa-dialog.mjs',
  'verify-audit36-aitr-resilience.mjs',
]) {
  check(runner.includes(priorGuard), `current runner dropped Audit 36 regression guard ${priorGuard}`);
}
check(pkg.scripts?.['apply:audit37-release-stamp'] === 'node scripts/apply-audit37-release-stamp.js', 'Audit 37 stamp command is missing');
check(!pkg.scripts?.['apply:audit36-release-stamp'], 'historical Audit 36 release stamp remains executable through npm');
check(
  pkg.scripts?.['audit:polymythcal-wcag22'] === 'node scripts/run-python.js scripts/audit-polymythcal-wcag22-audit37.py',
  'WCAG audit alias does not target Audit 37',
);
check(
  pkg.scripts?.['audit:polymythcal-interactivity'] === 'node scripts/run-python.js scripts/audit-polymythcal-interactivity-design-audit37.py',
  'interaction audit alias does not target Audit 37',
);
check(
  pkg.scripts?.['audit:polymythcal-entry-pages:strict'] === 'node scripts/run-python.js scripts/preflight-python-browser-audit.py && node scripts/run-python.js scripts/audit-polymythcal-entry-pages-audit37.py',
  'entry-page audit alias does not target Audit 37',
);
check(
  pkg.scripts?.['verify:audit37-browser-evidence'] === 'node scripts/verify-audit37-browser-evidence.js',
  'Audit 37 fresh-browser evidence command is missing',
);
check(!runner.includes('node scripts/verify-audit37-browser-evidence.js'), 'static verifier incorrectly requires browser evidence before CI creates it');
includesAll('Audit 37 predeploy browser contract', predeploy, [
  'python -m playwright install --with-deps chromium',
  'python scripts/audit-polymythcal-interactivity-design-audit37.py',
  'node scripts/run-python.js scripts/audit-polymythcal-entry-pages-audit37.py',
  'python scripts/audit-polymythcal-wcag22-audit37.py',
  'python scripts/audit-audit37-route-resilience.py',
  'python scripts/audit-project-failure-stress-audit37.py',
  'node scripts/verify-audit37-browser-evidence.js',
  'name: audit37-predeploy-browser-evidence',
  'data/polymythcal-audit37/**',
  'data/audit37-route-browser/**',
  'scripts/reports/audit37-project-failure-stress.json',
  'POLYMYTHCAL_WCAG22_AA_AUDIT37_2026-07-24.md',
  'retention-days: 14',
]);
for (const stale of [
  'data/polymythcal-audit36/**',
  'data/audit36-route-browser/**',
  'scripts/reports/audit36-project-failure-stress.json',
  'verify-audit36-browser-evidence.js',
]) {
  check(!predeploy.includes(stale), `predeploy still targets Audit 36 evidence: ${stale}`);
}
includesAll('deployer package', read('scripts/package-deployer-compatible.py'), [
  'WEBSITE_AUDIT37_SOURCE_HEALTH_RUNTIME_POLISH_REPORT_2026-07-24.md',
  'data/audit36-frozen-sha256.json',
  'scripts/apply-audit37-release-stamp.js',
  'scripts/verify-audit37-source-health.js',
  'scripts/verify-audit37-evolution.js',
]);

// Every selected Audit 36 report/gate remains byte-identical.
check(
  sha256File('data/audit36-frozen-sha256.json') === AUDIT36_FROZEN_MANIFEST_SHA256,
  'Audit 36 frozen manifest changed',
);
const frozen = readJson('data/audit36-frozen-sha256.json');
check(frozen.release_id === AUDIT36_RELEASE_ID, 'Audit 36 frozen manifest has the wrong release');
check(frozen.file_count === 16 && frozen.files?.length === 16, 'Audit 36 frozen manifest does not contain 16 files');
for (const row of frozen.files || []) {
  try {
    const stat = fs.statSync(filePath(row.path));
    check(stat.size === row.bytes, `${row.path} size changed from frozen Audit 36`);
    check(sha256File(row.path) === row.sha256, `${row.path} SHA-256 changed from frozen Audit 36`);
  } catch (error) {
    check(false, `${row.path} is missing from frozen Audit 36 evidence`);
  }
}

if (failures.length) {
  console.error('AUDIT 37 EVOLUTION GATE FAILED');
  failures.forEach(failure => console.error(` - ${failure}`));
  process.exit(1);
}

console.log(
  'AUDIT 37 EVOLUTION GATE PASSED — 838/32/422/595/24 Polymythcal, ' +
  '407 active + 15 disabled sources, 41 every-run + 213 rotating deterministic sources, ' +
  '644/25/7 Teacher Resources, unchanged schedules, shared fail-closed source health, ' +
  'current browser/package contracts, prior UI/runtime guards, and 16 frozen Audit 36 files.'
);
