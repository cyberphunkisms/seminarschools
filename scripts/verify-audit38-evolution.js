#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  DEFAULT_THRESHOLDS,
  evaluateLiveContent,
} = require('./live-content-integrity');

const ROOT = path.resolve(__dirname, '..');
const RELEASE_ID = '2026-07-24-site-audit38-harvest-operational-integrity-final';
const ASSET_VERSION = '20260724-audit38';
const GENERATED_AT = '2026-07-24T13:12:00-04:00';
const AUDIT37_RELEASE_ID = '2026-07-24-site-audit37-source-health-runtime-polish-final';
// Keep the old token split so the Audit 38 stamp cannot rewrite this verifier.
const AUDIT37_ASSET_VERSION = '20260724-' + 'audit37';
const AUDIT37_FROZEN_MANIFEST_SHA256 =
  '334174cb33b125df9d81b33048af063d1f2fabbfb42b67f9f728c582e8ebc8dd';
const REPORT_PATH =
  'WEBSITE_AUDIT38_HARVEST_OPERATIONAL_INTEGRITY_REPORT_2026-07-24.md';
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

function excludesAll(label, source, tokens) {
  for (const token of tokens) {
    check(!source.includes(token), `${label} still contains obsolete active contract ${token}`);
  }
}

// Release identity, release stamp, generated marker, and report must describe
// one release. The public marker intentionally makes this gate fail until the
// canonical production build has run after the release stamp.
const releaseId = read('RELEASE_ID.txt').trim();
const release = readJson('RELEASE_MANIFEST.json');
const buildManifest = readJson('data/polymythcal-build-manifest.json');
const publicRelease = readJson('public/site-release.json');
const stamp = read('scripts/apply-audit38-release-stamp.js');
const report = read(REPORT_PATH);

check(releaseId === RELEASE_ID, `release ID is ${releaseId || 'missing'}; apply the Audit 38 stamp`);
check(release.release_id === RELEASE_ID, 'RELEASE_MANIFEST.json is not Audit 38');
check(release.generated_at === GENERATED_AT, 'Audit 38 generated_at is not the stamp value');
check(release.polymythcal_asset_version === ASSET_VERSION, 'Audit 38 asset version is missing');
check(/^Audit 38\b/.test(String(release.release_type || '')), 'release type is not stamped Audit 38');
check(
  buildManifest.build_id === RELEASE_ID
    && buildManifest.release_id === RELEASE_ID
    && buildManifest.interface_release === RELEASE_ID
    && buildManifest.generated_at === GENERATED_AT
    && buildManifest.polymythcal_asset_version === ASSET_VERSION,
  'Polymythcal build manifest is not aligned to the Audit 38 stamp',
);
check(
  publicRelease.release_id === RELEASE_ID && publicRelease.generated_at === GENERATED_AT,
  'public/site-release.json is stale; run the canonical build after applying the Audit 38 stamp',
);
includesAll('Audit 38 release stamp', stamp, [
  `const OLD_ASSET = '${AUDIT37_ASSET_VERSION}'`,
  `const NEW_ASSET = '${ASSET_VERSION}'`,
  `const RELEASE_ID = '${RELEASE_ID}'`,
  `const GENERATED_AT = '${GENERATED_AT}'`,
  "if (relative === 'scripts/apply-audit38-release-stamp.js') return true;",
  'audit(?:33|34|35|36|37)',
  'Audit 37 evidence remained byte-identical',
]);
includesAll('Audit 38 report', report, [
  '# Website Audit 38 — Harvest Operational Integrity and Smoothness',
  'No direction-level decision was needed',
  'No local fresh-Chromium run',
  'Direction-level work held for approval',
  'This was not a security audit.',
]);
const releaseNotes = Array.isArray(release.notes) ? release.notes.join('\n') : '';
includesAll('Audit 38 release notes', releaseNotes, [
  'Audit 37 remains immutable historical evidence',
  '25 percent authoritative coverage quorum',
  'Every fully successful deterministic source',
  'one 25-minute, 10-dollar bounded attempt',
  '24-card progressive batch',
  '644 resources',
  '25 collections',
  'seven groups',
  'Methodology List state',
  'Eleven Audit 37 files are SHA-256 frozen',
  'This was not a security audit',
]);
for (const relative of [
  'index.html',
  'polymythseminars/index.html',
  'teacherresources/index.html',
  'scripts/apply-sitewide-type-zoom-link.js',
]) {
  const source = read(relative);
  check(source.includes(ASSET_VERSION), `${relative} is not stamped ${ASSET_VERSION}`);
  check(
    !source.includes(AUDIT37_ASSET_VERSION),
    `${relative} retains the active Audit 37 asset token`,
  );
}
for (const relative of ['saul/index.html', 'about/index.html']) {
  const source = read(relative);
  check(
    source.includes('20260724-audit38-saul-runtime'),
    `${relative} does not carry the Audit 38 Saul runtime cache token`,
  );
  check(
    !source.includes('20260718-' + 'map-archive-final8'),
    `${relative} retains the stale Saul runtime cache token`,
  );
}

// Audit 37 is immutable evidence, while current live data is evaluated with
// growth-tolerant integrity floors rather than Audit 37's exact totals.
check(
  sha256File('data/audit37-frozen-sha256.json') === AUDIT37_FROZEN_MANIFEST_SHA256,
  'Audit 37 frozen manifest changed',
);
const frozen = readJson('data/audit37-frozen-sha256.json');
check(frozen.release_id === AUDIT37_RELEASE_ID, 'Audit 37 frozen manifest has the wrong release');
check(frozen.algorithm === 'sha256', 'Audit 37 frozen manifest is not SHA-256');
check(frozen.file_count === 11 && frozen.files?.length === 11, 'Audit 37 frozen inventory is not 11 files');
const historicalMetrics = {
  polymythcal_events: 838,
  polymythcal_types: 32,
  qualified_unconfirmed_events: 595,
  registered_sources: 422,
  teacher_resources: 644,
  teacher_collections: 25,
  teacher_groups: 7,
};
for (const [name, expected] of Object.entries(historicalMetrics)) {
  check(
    frozen.historical_metrics?.[name] === expected,
    `Audit 37 historical metric ${name} changed`,
  );
}
const frozenPaths = new Set();
for (const row of frozen.files || []) {
  if (!row?.path || frozenPaths.has(row.path)) {
    check(false, `Audit 37 frozen manifest has an invalid or duplicate path: ${row?.path || 'missing'}`);
    continue;
  }
  frozenPaths.add(row.path);
  try {
    const stat = fs.statSync(filePath(row.path));
    check(stat.isFile(), `${row.path} is no longer a file`);
    check(stat.size === row.bytes, `${row.path} size changed from frozen Audit 37`);
    check(sha256File(row.path) === row.sha256, `${row.path} SHA-256 changed from frozen Audit 37`);
  } catch (error) {
    check(false, `${row.path} is missing from frozen Audit 37 evidence`);
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
check(DEFAULT_THRESHOLDS.minimumEvents === 800, 'live event anti-collapse floor changed');
check(DEFAULT_THRESHOLDS.minimumEventTypes === 25, 'live type anti-collapse floor changed');
check(DEFAULT_THRESHOLDS.minimumRegisteredSources === 400, 'live source anti-collapse floor changed');
check(DEFAULT_THRESHOLDS.minimumActiveSources === 390, 'live active-source floor changed');
check(
  DEFAULT_THRESHOLDS.minimumEveryRunDeterministicSources === 35,
  'live every-run deterministic floor changed',
);
check(
  DEFAULT_THRESHOLDS.minimumRotatingDeterministicSources === 190,
  'live rotating deterministic floor changed',
);
check(
  live.metrics.teacherResources === 644
    && live.metrics.teacherCollections === 25
    && live.metrics.teacherGroups === 7,
  `Teacher Resources changed: ${live.metrics.teacherResources}/${live.metrics.teacherCollections}/${live.metrics.teacherGroups}`,
);
includesAll('live integrity growth test', read('scripts/test-live-content-integrity.js'), [
  'a valid new event must not be rejected by a frozen historical total',
  'duplicate canonical IDs must fail',
  'browse/canonical loss must fail',
  'catastrophic live-record loss must fail',
]);
check(
  /const PAGE_SIZE = 24;/.test(read('js/polymythcal-revamp.js')),
  'Polymythcal progressive batch changed from 24',
);

// The three discovery schedules and their cost boundaries are release
// invariants. In particular, the four-hour protest crawl stays deterministic,
// unsharded, and paid-agent-free.
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

// Source-health publication must be bound to a useful coverage quorum, an
// independent critical-source floor, and the exact selected stream/scope.
const sourceHealth = read('scripts/polymythcal_source_health.py');
const structured = read('scripts/harvest_structured_events.py');
const protests = read('scripts/harvest_protests.py');
const deterministicPublisher = read('scripts/publish_deterministic_polymythcal.py');
const protestPublisher = read('scripts/publish_protest_harvest.py');
const merger = read('scripts/merge_and_finalize.py');
includesAll('shared source-health evaluator', sourceHealth, [
  'MINIMUM_AUTHORITATIVE_RATIO = 0.25',
  'MINIMUM_CRITICAL_AUTHORITATIVE_RATIO = 0.10',
  'insufficient-authoritative-primary-source-coverage',
  'insufficient-critical-source-coverage',
  'expected_stream: str | None = None',
  'expected_scope: str | None = None',
  'selected_source_ids = payload.get("selected_source_ids")',
  'saved source selection does not match its source-health gate',
]);
const authoritativeStatuses =
  sourceHealth.match(/AUTHORITATIVE_SOURCE_STATUSES\s*=\s*\{([\s\S]*?)\}/)?.[1] || '';
check(
  !authoritativeStatuses.includes('not-modified'),
  'bare HTTP 304 is authoritative without a retained parsed observation',
);
includesAll('structured harvest binding', structured, [
  '"stream": "deterministic-structured-events"',
  '"scope": "priority-plus-rotating-deterministic-non-protest"',
  '"selected_source_ids": [str(source.get("id") or "") for source in sources]',
]);
includesAll('protest harvest binding', protests, [
  '"stream": "deterministic-protests"',
  '"scope": "all-enabled-protest-sources-unsharded"',
  '"selected_source_ids": [str(source.get("id") or "") for source in sources]',
]);
includesAll('deterministic publisher binding', deterministicPublisher, [
  'expected_stream={',
  '"deterministic-protests"',
  '"deterministic-structured-events"',
  'expected_scope={',
  '"all-enabled-protest-sources-unsharded"',
  '"priority-plus-rotating-deterministic-non-protest"',
]);
includesAll('protest publisher binding', protestPublisher, [
  'expected_stream="deterministic-protests"',
  'expected_scope="all-enabled-protest-sources-unsharded"',
]);
includesAll('direct merge binding', merger, [
  'expected_stream="deterministic-protests"',
  'expected_scope="all-enabled-protest-sources-unsharded"',
  'expected_stream="deterministic-structured-events"',
  'expected_scope="priority-plus-rotating-deterministic-non-protest"',
]);

// The agent emits a compact accountable seminar ledger; the validator expands
// it to roster order after checking assignments, statuses, attribution, and a
// five-source urgency reserve. Festival accounting remains full and ordered.
const ledger = read('scripts/validate_harvest_source_ledger.py');
const ledgerTests = read('scripts/test_harvest_source_ledger.py');
const seminarPrompt = read('scripts/seminars-prompt.md');
const seminarRunner = read('scripts/seminars-prompt-runner.sh');
const festivalRunner = read('scripts/festivals-prompt-runner.sh');
const festivalSources = readJson('scripts/festivals-sources.json');
includesAll('source-ledger validator', ledger, [
  'def validate_seminars(',
  'def validate_festivals(',
  '"skipped-deterministic-success"',
  '"skipped-disabled"',
  '"skipped-shard"',
  'SEMINAR_URGENCY_TYPES = frozenset({"cfp", "contest", "screening"})',
  'maximum is 5',
  'result["source_yields"] = expanded',
  'festival source_yields must follow primary_sources roster order',
  '_write_json_atomically',
]);
includesAll('compact-ledger behavior tests', ledgerTests, [
  'test_real_422_source_roster_expands_from_compact_rows',
  'self.assertEqual(len(result["source_yields"]), 422)',
  'self.assertLess(len(rows), len(result["source_yields"]) // 3)',
]);
includesAll('compact seminar prompt', seminarPrompt, [
  'Do not copy the full 422-source roster into the output',
  'one row for every source you were assigned',
  'the runner expands those rows deterministically after validating your output',
]);
includesAll('seminar ledger integration', seminarRunner, [
  'validate_harvest_source_ledger.py seminars',
  '--deterministic-success-ids "${DETERMINISTIC_SKIP_IDS}"',
  'Skip these configured sources whose deterministic stage fully succeeded',
]);
check(
  Array.isArray(festivalSources.primary_sources)
    && festivalSources.primary_sources.length === 74,
  `festival primary-source ledger changed: ${festivalSources.primary_sources?.length || 0}/74`,
);
includesAll('bounded festival workflow', festivalWorkflow, [
  'HARVEST_ATTEMPTS: "1"',
  'HARVEST_TIMEOUT_SECONDS: "1500"',
  'node scripts/summarize-harvest-status.js festivals',
  'bash scripts/summarize-harvest-diagnostics.sh festivals',
  "if: failure() || steps.harvest_summary.outputs.degraded == 'true'",
]);
includesAll('bounded festival runner', festivalRunner, [
  'MAX_BUDGET_USD="${MAX_BUDGET_USD:-10.00}"',
  'HARVEST_TIMEOUT_SECONDS="${HARVEST_TIMEOUT_SECONDS:-1500}"',
  'HARVEST_ATTEMPTS="${HARVEST_ATTEMPTS:-1}"',
  'if [[ "${ATTEMPT}" -lt "${HARVEST_ATTEMPTS}" ]]',
  'validate_harvest_source_ledger.py festivals',
]);
check(!festivalRunner.includes('/ 259200'), 'festival runner restored gap-producing epoch sharding');

// Audit 38 owns current aliases and browser output paths. Frozen Audit 37
// programs are reused only through the in-memory adapter; browser evidence is
// created after the static full gate and is therefore not a local prerequisite.
const pkg = readJson('package.json');
const runner = read('scripts/verify-all-runner.js');
const predeploy = read('.github/workflows/predeploy.yml');
const browserAdapter = read('scripts/run-audit38-browser.py');
const deployerPackage = read('scripts/package-deployer-compatible.py');
const currentAliases = {
  'verify:frozen-audit37': 'node scripts/verify-frozen-audit37.js',
  'verify:live-content-integrity': 'node scripts/verify-live-content-integrity.js',
  'verify:polymythcal-source-health': 'node scripts/verify-polymythcal-source-health.js',
  'verify:audit38-accessibility-p0': 'node scripts/verify-audit38-accessibility-p0.mjs',
  'verify:audit38-evolution': 'node scripts/verify-audit38-evolution.js',
  'verify:audit38-browser-evidence': 'node scripts/verify-audit38-browser-evidence.js',
  'apply:audit38-release-stamp': 'node scripts/apply-audit38-release-stamp.js',
  'audit:polymythcal-wcag22': 'node scripts/run-python.js scripts/run-audit38-browser.py wcag',
  'audit:polymythcal-interactivity': 'node scripts/run-python.js scripts/run-audit38-browser.py interaction',
  'audit:polymythcal-entry-pages:strict':
    'node scripts/run-python.js scripts/preflight-python-browser-audit.py && node scripts/run-python.js scripts/run-audit38-browser.py entry-pages',
};
for (const [name, command] of Object.entries(currentAliases)) {
  check(pkg.scripts?.[name] === command, `package alias ${name} is not current Audit 38`);
}
for (const obsolete of [
  'verify:audit37-source-health',
  'verify:audit37-evolution',
  'verify:audit37-browser-evidence',
  'apply:audit37-release-stamp',
]) {
  check(!pkg.scripts?.[obsolete], `obsolete active package alias remains: ${obsolete}`);
}
for (const command of [
  'node scripts/verify-frozen-audit37.js',
  'node scripts/verify-live-content-integrity.js',
  'node scripts/test-live-content-integrity.js',
  'node scripts/verify-polymythcal-source-health.js',
  'node scripts/verify-audit38-accessibility-p0.mjs',
  'node scripts/verify-audit38-methodology-state.js',
  'node scripts/verify-aa-saul-runtime-smoothness.mjs',
  'node scripts/verify-harvest-pipeline.js',
  'node scripts/test-merge-festival-occurrences.js',
  'node scripts/run-python.js -m unittest scripts/test_harvest_source_ledger.py',
  'node scripts/run-python.js -m unittest scripts/test_festival_pipeline.py',
  'node scripts/verify-audit38-evolution.js',
]) {
  check(runner.includes(command), `complete verifier omits ${command}`);
}
excludesAll('complete verifier', runner, [
  'node scripts/verify-audit37-source-health.js',
  'node scripts/verify-audit37-evolution.js',
  'node scripts/verify-audit37-browser-evidence.js',
  'node scripts/verify-audit38-browser-evidence.js',
]);
includesAll('Audit 38 browser adapter', browserAdapter, [
  '"interaction": ROOT / "scripts" / "audit-polymythcal-interactivity-design-audit37.py"',
  '"entry-pages": ROOT / "scripts" / "audit-polymythcal-entry-pages-audit37.py"',
  '"wcag": ROOT / "scripts" / "audit-polymythcal-wcag22-audit37.py"',
  '"routes": ROOT / "scripts" / "audit-audit37-route-resilience.py"',
  '"stress": ROOT / "scripts" / "audit-project-failure-stress-audit37.py"',
  '("Audit 37", "Audit 38")',
  'exec(compile(source, str(baseline), "exec"), namespace)',
]);
includesAll('Audit 38 predeploy browser contract', predeploy, [
  'python -m playwright install --with-deps chromium',
  'python scripts/run-audit38-browser.py interaction',
  'node scripts/run-python.js scripts/run-audit38-browser.py entry-pages',
  'python scripts/run-audit38-browser.py wcag',
  'python scripts/run-audit38-browser.py routes',
  'python scripts/run-audit38-browser.py stress',
  'node scripts/verify-audit38-browser-evidence.js',
  'name: audit38-predeploy-browser-evidence',
  'data/polymythcal-audit38/**',
  'data/audit38-route-browser/**',
  'scripts/reports/audit38-project-failure-stress.json',
  'POLYMYTHCAL_WCAG22_AA_AUDIT38_2026-07-24.md',
  'retention-days: 14',
]);
excludesAll('Audit 38 predeploy browser contract', predeploy, [
  'data/polymythcal-audit37/**',
  'data/audit37-route-browser/**',
  'scripts/reports/audit37-project-failure-stress.json',
  'verify-audit37-browser-evidence.js',
]);
check(
  predeploy.indexOf('python -m playwright install --with-deps chromium')
    > predeploy.indexOf('npm run verify:all:built'),
  'fresh browser setup is not deferred until the portable full gate passes',
);
includesAll('deployer-compatible Audit 38 inventory', deployerPackage, [
  REPORT_PATH,
  'data/audit37-frozen-sha256.json',
  'scripts/apply-audit38-release-stamp.js',
  'scripts/verify-frozen-audit37.js',
  'scripts/live-content-integrity.js',
  'scripts/verify-live-content-integrity.js',
  'scripts/verify-polymythcal-source-health.js',
  'scripts/run-audit38-browser.py',
  'scripts/verify-audit38-browser-evidence.js',
  'scripts/verify-audit38-evolution.js',
]);

if (failures.length) {
  console.error('AUDIT 38 EVOLUTION GATE FAILED');
  failures.forEach(failure => console.error(` - ${failure}`));
  process.exit(1);
}

console.log(
  'AUDIT 38 EVOLUTION GATE PASSED — release/report/build alignment; 11 frozen Audit 37 '
    + `files; growth-tolerant live integrity (${live.metrics.events} events, `
    + `${live.metrics.eventTypes} types, ${live.metrics.registeredSources} sources); `
    + '644/25/7 Teacher Resources; 24-card batches; unchanged paid schedules; an unsharded '
    + 'paid-agent-free protest crawl; bound 25%/10% source-health floors; compact accountable '
    + 'agent ledgers; a one-attempt/1500-second festival job; and current Audit 38 browser, '
    + 'runner, alias, and packaging contracts.',
);
