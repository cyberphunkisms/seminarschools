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
const RELEASE_ID =
  '2026-07-25-site-audit41-depth-rollover-density-final';
const ASSET_VERSION = '20260725-audit41';
const SAUL_ASSET_VERSION = '20260725-audit41-saul-runtime';
const AUDIT40_RELEASE_ID =
  '2026-07-24-site-audit40-browser-runtime-continuity-final';
const AUDIT40_ASSET_VERSION = '20260724-' + 'audit40';
const AUDIT40_FROZEN_MANIFEST_SHA256 =
  'e709b62d1cd4e7b7e422f231006b328b8d2bcaeba2f37a77a0ade1d92161cad3';
const REPORT_PATH =
  'WEBSITE_AUDIT41_DEPTH_ROLLOVER_DENSITY_REPORT_2026-07-25.md';
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

const releaseId = read('RELEASE_ID.txt').trim();
const release = readJson('RELEASE_MANIFEST.json');
const buildManifest = readJson('data/polymythcal-build-manifest.json');
const publicRelease = readJson('public/site-release.json');
const stamp = read('scripts/apply-audit41-release-stamp.js');
const report = read(REPORT_PATH);

check(releaseId === RELEASE_ID, `release ID is ${releaseId || 'missing'}; apply the Audit 41 stamp`);
check(release.release_id === RELEASE_ID, 'RELEASE_MANIFEST.json is not Audit 41');
check(
  Number.isFinite(Date.parse(release.generated_at || '')),
  'Audit 41 generated_at is not a valid timestamp',
);
check(release.polymythcal_asset_version === ASSET_VERSION, 'Audit 41 asset version is missing');
check(/^Audit 41\b/.test(String(release.release_type || '')), 'release type is not stamped Audit 41');
check(
  buildManifest.build_id === RELEASE_ID
    && buildManifest.release_id === RELEASE_ID
    && buildManifest.interface_release === RELEASE_ID
    && buildManifest.generated_at === release.generated_at
    && buildManifest.polymythcal_asset_version === ASSET_VERSION,
  'Polymythcal build manifest is not aligned to the Audit 41 stamp',
);
check(
  publicRelease.release_id === RELEASE_ID
    && publicRelease.generated_at === release.generated_at,
  'public/site-release.json is stale; run the canonical build after applying the Audit 41 stamp',
);
includesAll('Audit 41 release stamp', stamp, [
  "const OLD_ASSET = '20260724-' + 'audit40';",
  `const NEW_ASSET = '${ASSET_VERSION}';`,
  `const RELEASE_ID =\n  '${RELEASE_ID}';`,
  'process.env.AUDIT41_GENERATED_AT || easternTimestamp()',
  "if (relative === 'scripts/apply-audit41-release-stamp.js') return true;",
  'audit(?:33|34|35|36|37|38|39|40)',
  'Audit 40 evidence remained byte-identical',
]);
includesAll('Audit 41 report', report, [
  '# Website Audit 41 — Depth, Rollover, and Density',
  'No direction-level site change was implemented',
  'Direction-level work held for approval',
  'Native VoiceOver and NVDA were not executed',
  'Bookwormcard',
  'Teacher Resources',
  '882',
  'midnight',
  'This was not a security audit.',
  'https://www.w3.org/TR/WCAG22/',
  'https://web.dev/articles/cls',
  'https://docs.netlify.com/manage/routing/headers/',
]);
const releaseNotes = Array.isArray(release.notes) ? release.notes.join('\n') : '';
includesAll('Audit 41 release notes', releaseNotes, [
  'Audit 40 remains immutable historical evidence',
  'bilingual event detail pages',
  'Teacher Resources keeps Quick starts visible',
  'Bookwormcard retains one coherent visible page heading',
  '64-assertion browser depth pass',
  'Fresh Audit 41 Chromium evidence',
  'direction-level work remain held',
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
    !source.includes(AUDIT40_ASSET_VERSION),
    `${relative} retains the active Audit 40 asset token`,
  );
}
for (const relative of ['saul/index.html', 'about/index.html']) {
  check(
    read(relative).includes(SAUL_ASSET_VERSION),
    `${relative} does not carry the Audit 41 Saul runtime cache token`,
  );
}

check(
  sha256File('data/audit40-frozen-sha256.json') === AUDIT40_FROZEN_MANIFEST_SHA256,
  'Audit 40 frozen manifest changed',
);
const frozen = readJson('data/audit40-frozen-sha256.json');
check(frozen.release_id === AUDIT40_RELEASE_ID, 'Audit 40 frozen manifest has the wrong release');
check(frozen.algorithm === 'sha256', 'Audit 40 frozen manifest is not SHA-256');
check(frozen.file_count === 60 && frozen.files?.length === 60, 'Audit 40 frozen inventory is not 60 files');
const historicalMetrics = {
  polymythcal_events: 838,
  polymythcal_types: 32,
  registered_sources: 422,
  event_aliases: 842,
  teacher_resources: 644,
  teacher_collections: 25,
  teacher_groups: 7,
  methodology_entries: 1139,
  polymythcal_page_size: 24,
  portable_release_checks: 135,
  public_parity_files: 3550,
  package_members: 7910,
  browser_assertions: 818,
  runtime_route_cases: 24,
};
for (const [name, expected] of Object.entries(historicalMetrics)) {
  check(frozen.historical_metrics?.[name] === expected, `Audit 40 metric ${name} changed`);
}
for (const row of frozen.files || []) {
  check(
    row?.path
      && fs.existsSync(filePath(row.path))
      && fs.statSync(filePath(row.path)).size === row.bytes
      && sha256File(row.path) === row.sha256,
    `${row?.path || 'unknown Audit 40 file'} changed from frozen evidence`,
  );
}

const liveInputs = {
  eventsDocument: readJson('polymythseminars/events.json'),
  browseDocument: readJson('polymythseminars/browse.json'),
  sourceDocument: readJson('scripts/sources.json'),
  teacherDocument: readJson('teacherresources/resources-data.json'),
};
const live = evaluateLiveContent(liveInputs);
for (const failure of live.failures) check(false, `live content: ${failure}`);
check(live.metrics.events >= 838, `live event floor backtracked: ${live.metrics.events}/838`);
check(live.metrics.eventTypes >= 32, `live type floor backtracked: ${live.metrics.eventTypes}/32`);
check(live.metrics.registeredSources >= 422, `live source floor backtracked: ${live.metrics.registeredSources}/422`);
check(DEFAULT_THRESHOLDS.minimumEvents === 800, 'live event anti-collapse floor changed');
check(DEFAULT_THRESHOLDS.minimumEventTypes === 25, 'live type anti-collapse floor changed');
check(DEFAULT_THRESHOLDS.minimumRegisteredSources === 400, 'live source anti-collapse floor changed');
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
check(
  countFiles('public') >= historicalMetrics.public_parity_files,
  `public deploy surface fell below the Audit 40 floor: ${countFiles('public')}/3550`,
);

const methodology = read('polymyth/methodologylist/index.html');
const staticSectionCounts = [
  ...methodology.matchAll(/(\d+) indexed framework entries in a static HTML edition/g),
].map(match => Number(match[1]));
check(
  staticSectionCounts.length === 16
    && staticSectionCounts.reduce((sum, count) => sum + count, 0) === 1139,
  'Methodology List static section parity changed from 1,139 entries',
);
for (const section of ['corehistory', 'framework-core', 'pending-user-authorship']) {
  check(
    methodology.includes(`data-s="${section}"`) && methodology.includes(`{id:'${section}'`),
    `Methodology section ${section} is not both pre-rendered and interactive`,
  );
}

const seminarWorkflow = read('.github/workflows/scrape-seminars.yml');
const festivalWorkflow = read('.github/workflows/scrape-festivals.yml');
const protestWorkflow = read('.github/workflows/scrape-polymythcal-protests.yml');
check(/cron:\s*["']47 8 \* \* 1,4["']/.test(seminarWorkflow), 'seminar cadence changed');
check(/cron:\s*["']42 9 \* \* 2,5["']/.test(festivalWorkflow), 'festival cadence changed');
check(/cron:\s*["']18 \*\/4 \* \* \*["']/.test(protestWorkflow), 'protest cadence changed');
check(!protestWorkflow.includes('--shard'), 'four-hour protest crawl introduced sharding');
check(
  !/CLAUDE|ANTHROPIC|MAX_BUDGET|prompt-runner/i.test(protestWorkflow),
  'four-hour protest crawl now invokes or configures a paid agent',
);

const pkg = readJson('package.json');
const focused =
  'npm run verify:frozen-audit40 && npm run verify:audit39-protest-recall '
  + '&& npm run verify:audit39-generated-routes && npm run verify:audit39-runtime-ui '
  + '&& npm run verify:audit39-cache-coherence && npm run verify:audit39-font-delivery '
  + '&& npm run verify:audit39-methodology-runtime && npm run verify:audit39-package-roundtrip '
  + '&& npm run verify:audit41-content-structure && npm run verify:audit41-runtime-efficiency '
  + '&& npm run verify:audit41-teacher-density && npm run verify:audit41-event-rollover '
  + '&& npm run verify:bookwormcard && npm run verify:audit41-evolution';
check(pkg.scripts?.['verify:audit41-focused'] === focused, 'Audit 41 focused gate is incomplete');
check(
  pkg.scripts?.['apply:audit41-release-stamp']
    === 'node scripts/apply-audit41-release-stamp.js',
  'Audit 41 release stamp is not exposed',
);
check(!pkg.scripts?.['apply:audit40-release-stamp'], 'historical Audit 40 stamp remains exposed');

const runner = read('scripts/verify-all-runner.js');
for (const gate of [
  'verify-frozen-audit40.js',
  'verify-audit41-content-structure.js',
  'verify-audit41-runtime-efficiency.js',
  'verify-audit41-teacher-density.js',
  'verify-audit41-event-rollover.js',
  'verify-audit41-evolution.js',
]) {
  check(runner.includes(gate), `portable release runner omits ${gate}`);
}

const browserEvidence = read('scripts/verify-audit41-browser-evidence.js');
includesAll('Audit 41 browser evidence floor', browserEvidence, [
  'minimumChecks: 194',
  'report.route_cases !== 24',
  'minimumChecks: 64',
  'report.route_cases !== 8',
  'combinedChecks < 882',
]);
check(
  !runner.includes('node scripts/verify-audit40-evolution.js'),
  'portable release runner executes the historical Audit 40 release-identity gate',
);

const predeploy = read('.github/workflows/predeploy.yml');
for (const token of [
  'npm run verify:audit41-focused',
  'python scripts/run-audit41-browser.py interaction',
  'python scripts/run-audit41-browser.py entry-pages',
  'python scripts/run-audit41-browser.py wcag',
  'python scripts/run-audit41-browser.py routes',
  'python scripts/run-audit41-browser.py stress',
  'python scripts/audit41-browser-runtime.py',
  'python scripts/audit41-full-depth-browser.py',
  'node scripts/verify-audit41-browser-evidence.js',
  'data/polymythcal-audit41/**',
  'data/audit41-route-browser/**',
  'data/audit41-browser/**',
  'data/audit41-depth-browser/**',
]) {
  check(predeploy.includes(token), `predeploy omits ${token}`);
}

const deployerPackage = read('scripts/package-deployer-compatible.py');
for (const relative of [
  REPORT_PATH,
  'data/audit40-frozen-sha256.json',
  'scripts/verify-frozen-audit40.js',
  'scripts/apply-audit41-release-stamp.js',
  'scripts/verify-audit41-content-structure.js',
  'scripts/verify-audit41-runtime-efficiency.js',
  'scripts/verify-audit41-teacher-density.js',
  'scripts/verify-audit41-event-rollover.js',
  'scripts/verify-audit41-evolution.js',
  'scripts/run-audit41-browser.py',
  'scripts/audit41-browser-runtime.py',
  'scripts/audit41-full-depth-browser.py',
  'scripts/verify-audit41-browser-evidence.js',
]) {
  check(deployerPackage.includes(relative), `deployer package does not require ${relative}`);
}

if (failures.length) {
  console.error('AUDIT 41 EVOLUTION FAILED');
  failures.forEach(failure => console.error(` - ${failure}`));
  process.exit(1);
}

console.log(
  `AUDIT 41 EVOLUTION PASSED — ${live.metrics.events}/${live.metrics.eventTypes}/`
    + `${live.metrics.registeredSources}, ${live.metrics.teacherResources}/`
    + `${live.metrics.teacherCollections}/${live.metrics.teacherGroups}, 1,139 Methodology `
    + `entries, 24-card batches, ${countFiles('public')} public files, frozen Audit 40 `
    + 'evidence, current browser/runtime gates, unchanged crawl cadence, and explicit '
    + 'direction holds remain aligned.',
);
