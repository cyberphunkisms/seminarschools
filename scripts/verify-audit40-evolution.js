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
  '2026-07-24-site-audit40-browser-runtime-continuity-final';
const ASSET_VERSION = '20260724-audit40';
const SAUL_ASSET_VERSION = '20260724-audit40-saul-runtime';
const AUDIT39_RELEASE_ID =
  '2026-07-24-site-audit39-discovery-continuity-route-resilience-final';
const AUDIT39_ASSET_VERSION = '20260724-' + 'audit39';
const AUDIT39_FROZEN_MANIFEST_SHA256 =
  '0f58e9d08c5b31133b38f612618239d3ad0b7a566b292bdf3e4fcfae4458c964';
const REPORT_PATH =
  'WEBSITE_AUDIT40_BROWSER_RUNTIME_CONTINUITY_REPORT_2026-07-24.md';
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
const stamp = read('scripts/apply-audit40-release-stamp.js');
const report = read(REPORT_PATH);

check(releaseId === RELEASE_ID, `release ID is ${releaseId || 'missing'}; apply the Audit 40 stamp`);
check(release.release_id === RELEASE_ID, 'RELEASE_MANIFEST.json is not Audit 40');
check(
  Number.isFinite(Date.parse(release.generated_at || '')),
  'Audit 40 generated_at is not a valid timestamp',
);
check(release.polymythcal_asset_version === ASSET_VERSION, 'Audit 40 asset version is missing');
check(/^Audit 40\b/.test(String(release.release_type || '')), 'release type is not stamped Audit 40');
check(
  buildManifest.build_id === RELEASE_ID
    && buildManifest.release_id === RELEASE_ID
    && buildManifest.interface_release === RELEASE_ID
    && buildManifest.generated_at === release.generated_at
    && buildManifest.polymythcal_asset_version === ASSET_VERSION,
  'Polymythcal build manifest is not aligned to the Audit 40 stamp',
);
check(
  publicRelease.release_id === RELEASE_ID
    && publicRelease.generated_at === release.generated_at,
  'public/site-release.json is stale; run the canonical build after applying the Audit 40 stamp',
);
includesAll('Audit 40 release stamp', stamp, [
  "const OLD_ASSET = '20260724-' + 'audit39';",
  `const NEW_ASSET = '${ASSET_VERSION}';`,
  `const RELEASE_ID =\n  '${RELEASE_ID}';`,
  'process.env.AUDIT40_GENERATED_AT || easternTimestamp()',
  "if (relative === 'scripts/apply-audit40-release-stamp.js') return true;",
  'audit(?:33|34|35|36|37|38|39)',
  'Audit 39 evidence remained byte-identical',
]);
includesAll('Audit 40 report', report, [
  '# Website Audit 40 — Browser and Runtime Continuity',
  'No direction-level site change was implemented',
  'Direction-level work held for approval',
  'Native VoiceOver and NVDA were not executed',
  'Thank You M’am DM board',
  'at least 818',
  'This was not a security audit.',
  'https://www.w3.org/TR/WCAG22/',
  'https://web.dev/articles/cls',
  'https://docs.netlify.com/manage/routing/headers/',
]);
const releaseNotes = Array.isArray(release.notes) ? release.notes.join('\n') : '';
includesAll('Audit 40 release notes', releaseNotes, [
  'Audit 39 remains immutable historical evidence',
  'whole-site content-structure gate',
  'AITR and Campaigncodex deep links',
  '16 corpus sections',
  'Route-local CSS and JavaScript',
  'Teacher Resources retains all 644 resource routes',
  'Thank You M’am DM board',
  'new 24-case representative runtime matrix',
  'Fresh Audit 40 Chromium evidence',
  'direction-level changes were not silently introduced',
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
    !source.includes(AUDIT39_ASSET_VERSION),
    `${relative} retains the active Audit 39 asset token`,
  );
}
for (const relative of ['saul/index.html', 'about/index.html']) {
  check(
    read(relative).includes(SAUL_ASSET_VERSION),
    `${relative} does not carry the Audit 40 Saul runtime cache token`,
  );
}

check(
  sha256File('data/audit39-frozen-sha256.json') === AUDIT39_FROZEN_MANIFEST_SHA256,
  'Audit 39 frozen manifest changed',
);
const frozen = readJson('data/audit39-frozen-sha256.json');
check(frozen.release_id === AUDIT39_RELEASE_ID, 'Audit 39 frozen manifest has the wrong release');
check(frozen.algorithm === 'sha256', 'Audit 39 frozen manifest is not SHA-256');
check(frozen.file_count === 14 && frozen.files?.length === 14, 'Audit 39 frozen inventory is not 14 files');
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
  portable_release_checks: 132,
  public_parity_files: 3550,
  package_members: 7802,
};
for (const [name, expected] of Object.entries(historicalMetrics)) {
  check(frozen.historical_metrics?.[name] === expected, `Audit 39 metric ${name} changed`);
}
for (const row of frozen.files || []) {
  check(
    row?.path
      && fs.existsSync(filePath(row.path))
      && fs.statSync(filePath(row.path)).size === row.bytes
      && sha256File(row.path) === row.sha256,
    `${row?.path || 'unknown Audit 39 file'} changed from frozen evidence`,
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
  `public deploy surface fell below the Audit 39 floor: ${countFiles('public')}/3550`,
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
  'npm run verify:frozen-audit39 && npm run verify:audit39-protest-recall '
  + '&& npm run verify:audit39-generated-routes && npm run verify:audit39-runtime-ui '
  + '&& npm run verify:audit39-cache-coherence && npm run verify:audit39-font-delivery '
  + '&& npm run verify:audit39-methodology-runtime && npm run verify:audit39-package-roundtrip '
  + '&& npm run verify:audit40-content-structure && npm run verify:audit40-runtime-efficiency '
  + '&& npm run verify:audit40-evolution';
check(pkg.scripts?.['verify:audit40-focused'] === focused, 'Audit 40 focused gate is incomplete');
check(
  pkg.scripts?.['apply:audit40-release-stamp']
    === 'node scripts/apply-audit40-release-stamp.js',
  'Audit 40 release stamp is not exposed',
);
check(!pkg.scripts?.['apply:audit39-release-stamp'], 'historical Audit 39 stamp remains exposed');

const runner = read('scripts/verify-all-runner.js');
for (const gate of [
  'verify-frozen-audit39.js',
  'verify-audit40-content-structure.js',
  'verify-audit40-runtime-efficiency.js',
  'verify-audit40-evolution.js',
]) {
  check(runner.includes(gate), `portable release runner omits ${gate}`);
}

const browserEvidence = read('scripts/verify-audit40-browser-evidence.js');
includesAll('Audit 40 browser evidence floor', browserEvidence, [
  'minimumChecks: 194',
  'report.route_cases !== 24',
  'screenshotCount < 6',
  'combinedChecks < 818',
]);
check(
  !runner.includes('node scripts/verify-audit39-evolution.js'),
  'portable release runner executes the historical Audit 39 release-identity gate',
);

const predeploy = read('.github/workflows/predeploy.yml');
for (const token of [
  'npm run verify:audit40-focused',
  'python scripts/run-audit40-browser.py interaction',
  'python scripts/run-audit40-browser.py entry-pages',
  'python scripts/run-audit40-browser.py wcag',
  'python scripts/run-audit40-browser.py routes',
  'python scripts/run-audit40-browser.py stress',
  'python scripts/audit40-browser-runtime.py',
  'node scripts/verify-audit40-browser-evidence.js',
  'data/polymythcal-audit40/**',
  'data/audit40-route-browser/**',
  'data/audit40-browser/**',
]) {
  check(predeploy.includes(token), `predeploy omits ${token}`);
}

const deployerPackage = read('scripts/package-deployer-compatible.py');
for (const relative of [
  REPORT_PATH,
  'data/audit39-frozen-sha256.json',
  'scripts/verify-frozen-audit39.js',
  'scripts/apply-audit40-release-stamp.js',
  'scripts/verify-audit40-content-structure.js',
  'scripts/verify-audit40-runtime-efficiency.js',
  'scripts/verify-audit40-evolution.js',
  'scripts/run-audit40-browser.py',
  'scripts/audit40-browser-runtime.py',
  'scripts/verify-audit40-browser-evidence.js',
]) {
  check(deployerPackage.includes(relative), `deployer package does not require ${relative}`);
}

if (failures.length) {
  console.error('AUDIT 40 EVOLUTION FAILED');
  failures.forEach(failure => console.error(` - ${failure}`));
  process.exit(1);
}

console.log(
  `AUDIT 40 EVOLUTION PASSED — ${live.metrics.events}/${live.metrics.eventTypes}/`
    + `${live.metrics.registeredSources}, ${live.metrics.teacherResources}/`
    + `${live.metrics.teacherCollections}/${live.metrics.teacherGroups}, 1,139 Methodology `
    + `entries, 24-card batches, ${countFiles('public')} public files, frozen Audit 39 `
    + 'evidence, current browser/runtime gates, unchanged crawl cadence, and explicit '
    + 'direction holds remain aligned.',
);
