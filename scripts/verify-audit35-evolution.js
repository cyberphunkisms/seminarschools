#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const EXPECTED_RELEASE_ID = '2026-07-23-site-audit35-resilience-polish-final';
const EXPECTED_ASSET_VERSION = '20260723-audit35';
const EXPECTED_GENERATED_AT = '2026-07-23T23:35:00-04:00';
const AUDIT34_RELEASE_ID = '2026-07-23-site-audit34-impeccable-ui-efficiency-final';
const AUDIT34_ASSET_VERSION = ['20260723', 'audit34'].join('-');
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

function hash(relative) {
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

// Release, stamp, active asset, and report alignment.
const releaseId = read('RELEASE_ID.txt').trim();
const release = readJson('RELEASE_MANIFEST.json');
const buildManifest = readJson('data/polymythcal-build-manifest.json');
const publicRelease = readJson('public/site-release.json');
const stamp = read('scripts/apply-audit35-release-stamp.js');
const report = read('WEBSITE_AUDIT35_BUILD_RUNTIME_RESILIENCE_REPORT_2026-07-23.md');

check(releaseId === EXPECTED_RELEASE_ID, `Audit 35 release ID is ${releaseId || 'missing'}`);
check(release.release_id === EXPECTED_RELEASE_ID, 'RELEASE_MANIFEST.json is not Audit 35');
check(release.generated_at === EXPECTED_GENERATED_AT, 'Audit 35 generated_at is not the release-stamp value');
check(release.polymythcal_asset_version === EXPECTED_ASSET_VERSION, 'Audit 35 asset version is missing');
check(/^Audit 35\b/.test(String(release.release_type || '')), 'release type is not stamped Audit 35');
check(
  buildManifest.build_id === EXPECTED_RELEASE_ID
    && buildManifest.release_id === EXPECTED_RELEASE_ID
    && buildManifest.interface_release === EXPECTED_RELEASE_ID
    && buildManifest.generated_at === EXPECTED_GENERATED_AT
    && buildManifest.polymythcal_asset_version === EXPECTED_ASSET_VERSION,
  'Polymythcal build manifest is not release/stamp aligned',
);
check(
  publicRelease.release_id === EXPECTED_RELEASE_ID
    && publicRelease.generated_at === EXPECTED_GENERATED_AT,
  'public/site-release.json is not aligned; run the canonical build after stamping',
);
includesAll('Audit 35 release stamp', stamp, [
  `const NEW_ASSET = '${EXPECTED_ASSET_VERSION}'`,
  `const RELEASE_ID = '${EXPECTED_RELEASE_ID}'`,
  `const GENERATED_AT = '${EXPECTED_GENERATED_AT}'`,
  'WEBSITE_AUDIT34_IMPECCABLE_UI_EFFICIENCY_REPORT_2026-07-23.md',
  'scripts/verify-audit34-evolution.js',
  'scripts/verify-audit34-browser-evidence.js',
  'data/polymythcal-audit34/',
]);
includesAll('Audit 35 build/runtime report', report, [
  '# Website Audit 35 — Build and Runtime Resilience',
  'No architecture, schedule, content, route, or visual-direction decision changed.',
  'four-hour no-shard protest crawl',
  '`npm run verify:all:built`',
  '`PACKAGE_CONTENTS_SHA256.json`',
  'emit a `.sha256` sidecar',
  'Audit 34 evidence remains untouched',
]);
const releaseNotes = Array.isArray(release.notes) ? release.notes.join('\n') : '';
includesAll('Audit 35 release notes', releaseNotes, [
  '838 canonical listings',
  '32 types',
  '422 sources',
  '595 qualified unconfirmed records',
  '24-item batches',
  'four-hour no-shard protest crawl',
  '644 resources',
  '25 collections',
  'seven groups',
  'Audit 34 reports, browser evidence, and evolution gates remain unchanged',
]);
for (const relative of [
  'index.html',
  'polymythseminars/index.html',
  'teacherresources/index.html',
  'scripts/apply-sitewide-type-zoom-link.js',
]) {
  const source = read(relative);
  check(source.includes(EXPECTED_ASSET_VERSION), `${relative} is not stamped ${EXPECTED_ASSET_VERSION}`);
  check(!source.includes(AUDIT34_ASSET_VERSION), `${relative} still uses the active Audit 34 asset stamp`);
}

// Frozen release invariants.
const eventsDocument = readJson('polymythseminars/events.json');
const browseDocument = readJson('polymythseminars/browse.json');
const sourcesDocument = readJson('scripts/sources.json');
const teacher = readJson('teacherresources/resources-data.json');
const events = Array.isArray(eventsDocument) ? eventsDocument : eventsDocument.events || [];
const browse = Array.isArray(browseDocument) ? browseDocument : browseDocument.events || [];
const sources = Array.isArray(sourcesDocument) ? sourcesDocument : sourcesDocument.sources || [];
const groups = Array.isArray(teacher.groups) ? teacher.groups : [];
const teacherEntries = groups.flatMap(group =>
  (group.categories || []).flatMap(category => category.entries || [])
);
const teacherCollections = groups.reduce(
  (total, group) => total + (group.categories || []).length,
  0,
);
const eventTypes = new Set(events.map(event => event.type));
const eventIds = new Set(events.map(event => event.id));
const unconfirmed = events.filter(event => event.confirmation_status === 'unconfirmed').length;

check(events.length === 838, `Polymythcal event invariant changed: ${events.length}/838`);
check(browse.length === 838, `Polymythcal browser invariant changed: ${browse.length}/838`);
check(eventIds.size === 838, `Polymythcal unique-ID invariant changed: ${eventIds.size}/838`);
check(eventTypes.size === 32, `Polymythcal type invariant changed: ${eventTypes.size}/32`);
check(sources.length === 422, `Polymythcal source invariant changed: ${sources.length}/422`);
check(unconfirmed === 595, `Polymythcal unconfirmed invariant changed: ${unconfirmed}/595`);
check(
  buildManifest.record_count === 838
    && buildManifest.source_count === 422
    && buildManifest.unconfirmed_count === 595,
  'Polymythcal build manifest inventory differs from the frozen Audit 35 dataset',
);
check(
  /const PAGE_SIZE = 24;/.test(read('js/polymythcal-revamp.js')),
  'Polymythcal initial/load-more batch changed from 24',
);
check(teacherEntries.length === 644, `Teacher Resources invariant changed: ${teacherEntries.length}/644`);
check(teacherCollections === 25, `Teacher collection invariant changed: ${teacherCollections}/25`);
check(groups.length === 7, `Teacher group invariant changed: ${groups.length}/7`);

// Current UI, failure recovery, and bounded autolink contracts.
const pkg = readJson('package.json');
const runner = read('scripts/verify-all-runner.js');
const routeUi = read('scripts/verify-audit35-route-ui.mjs');
const failureResilience = read('scripts/verify-project-failure-resilience.js');
const autolinkPerformance = read('scripts/verify-autolink-performance.js');
const currentGates = {
  'verify:audit35-route-ui': 'node scripts/verify-audit35-route-ui.mjs',
  'verify:project-failure-resilience': 'node scripts/verify-project-failure-resilience.js',
  'verify:autolink-performance': 'node scripts/verify-autolink-performance.js',
  'verify:audit35-evolution': 'node scripts/verify-audit35-evolution.js',
};
for (const [name, command] of Object.entries(currentGates)) {
  check(pkg.scripts?.[name] === command, `package script ${name} is not exact`);
  check(runner.includes(command), `verify:all does not execute ${command}`);
}
check(
  !runner.includes('node scripts/verify-audit34-evolution.js'),
  'verify:all still executes the historical Audit 34 evolution gate',
);
for (const marker of [
  'audit35-home-ui',
  'audit35-about-ui',
  'audit35-bb-ui',
  'audit35-bookwormcard-ui',
  'audit35-aa-ui',
  'audit35-leizu-ui',
  'audit35-cv-ui',
  'audit35-agora-ui',
  "setAttribute\\('inert'",
  'Bookwormcard pre-paint class',
]) {
  check(routeUi.includes(marker), `Audit 35 route UI contract lost ${marker}`);
}
for (const marker of [
  'window.__ssPolymythcalRevampMounted',
  'const FETCH_TIMEOUT_MS = 12000',
  'async function readCalendarCache()',
  'window.__ssTeacherResourcesFinderMounted',
  'function scheduleExpandLabel()',
  'setInterval',
]) {
  check(failureResilience.includes(marker), `failure-resilience contract lost ${marker}`);
}
for (const marker of [
  'function compactRoots(nodes)',
  'function collectAutolinkTextNodes(selector)',
  'requestIdleCallback',
  'canonicalCache[cacheKey]',
  'rerunRequested = true',
  '[data-no-autolink]',
  '.site-footer',
]) {
  check(autolinkPerformance.includes(marker), `autolink performance contract lost ${marker}`);
}

// Build, runtime, package, and workflow contracts.
check(pkg.scripts?.['verify:all'] === 'node scripts/verify-all-runner.js', 'verify:all no longer uses the central runner');
check(
  pkg.scripts?.['verify:all:built'] === 'node scripts/verify-all-runner.js --reuse-build',
  'verify:all:built no longer reuses the canonical build',
);
check(
  pkg.scripts?.['verify:all:serial'] === 'node scripts/verify-all-runner.js --concurrency=1',
  'verify:all:serial is no longer actually serial',
);
for (const marker of [
  'build-public-deploy.js',
  'verify-public-deploy-parity.js',
  'build-asset-weight-report.js',
  'verify-page-size-budget.js',
  'verify-asset-weights.js',
  'verify-runtime-delivery-resilience.js',
  'test_package_integrity.py',
]) {
  check(runner.includes(marker), `verify:all lost build/runtime contract ${marker}`);
}
const canonicalBuild = String(pkg.scripts?.build || '');
for (const marker of [
  'build-polymythcal-browser-payload.js',
  'build-public-deploy.js',
  'verify-public-deploy-parity.js',
  'build-asset-weight-report.js',
  'verify-polymythcal-build-efficiency.js',
  'verify-steady-ui.js',
]) {
  check(canonicalBuild.includes(marker), `canonical build lost ${marker}`);
}

const packageHelper = read('scripts/package_integrity.py');
const packageTest = read('scripts/test_package_integrity.py');
const deployerPackage = read('scripts/package-deployer-compatible.py');
const sourcePackage = read('scripts/package-netlify-source.py');
includesAll('deterministic package helper', packageHelper, [
  'PACKAGE_CONTENTS_SHA256.json',
  'archive_sha256',
  'sidecar',
]);
includesAll('deterministic package test', packageTest, [
  'test_archive_is_repeatable_and_self_verifying',
  'MANIFEST_NAME',
]);
includesAll('deployer package', deployerPackage, [
  'write_verified_archive',
  "Path(str(OUTPUT)+'.sha256')",
  'run_production_build()',
  "'verify:all:built'",
  'verify_public_parity()',
  'WEBSITE_AUDIT34_IMPECCABLE_UI_EFFICIENCY_REPORT_2026-07-23.md',
  'data/polymythcal-audit34/interaction-design-browser-audit.json',
  'data/polymythcal-audit34/entry-pages-browser-audit.json',
  'WEBSITE_AUDIT35_BUILD_RUNTIME_RESILIENCE_REPORT_2026-07-23.md',
  'WEBSITE_AUDIT35_RESILIENCE_POLISH_REPORT_2026-07-23.md',
  'data/polymythcal-audit35/interaction-design-browser-audit.json',
  'data/polymythcal-audit35/entry-pages-browser-audit.json',
  'data/audit35-route-browser/route-resilience-browser-audit.json',
  'scripts/reports/audit35-project-failure-stress.json',
]);
includesAll('source package', sourcePackage, [
  'write_verified_archive',
  "Path(str(OUTPUT)+'.sha256')",
  'generated_dependency_dir',
  'generated_work_dir(rel.parts[0])',
]);

const protestWorkflow = read('.github/workflows/scrape-polymythcal-protests.yml');
includesAll('protest workflow', protestWorkflow, [
  '18 */4 * * *',
  'Harvest every protest source without sharding',
  'python3 scripts/harvest_protests.py',
  'cancel-in-progress: false',
  'requirements-harvest.txt',
]);
check(!protestWorkflow.includes('--shard'), 'four-hour protest harvest introduced a shard flag');
check(!protestWorkflow.includes('python3 -m unittest'), 'four-hour protest harvest repeats code-change tests');
const predeploy = read('.github/workflows/predeploy.yml');
for (const marker of [
  'fail-fast: true',
  'ubuntu-latest',
  'windows-latest',
  'macos-latest',
  'needs: clean-build',
  'npm run build',
  'npm run verify:all:built',
  'python -m playwright install --with-deps chromium',
  'python scripts/audit-audit35-route-resilience.py',
  'node scripts/verify-audit35-browser-evidence.js',
  'data/polymythcal-audit35/**',
  'data/audit35-route-browser/**',
  'scripts/reports/audit35-project-failure-stress.json',
  'retention-days: 14',
]) {
  check(predeploy.includes(marker), `predeploy contract lost ${marker}`);
}
check(
  predeploy.indexOf('python -m playwright install --with-deps chromium')
    > predeploy.indexOf('npm run verify:all:built'),
  'Playwright installation is no longer deferred until static/build gates pass',
);

// Audit 34 is immutable evidence, not a current-release executable gate.
const historicalHashes = {
  'scripts/verify-audit34-evolution.js': '20f5a4c917c22fc83d11ef51f5aae009c44140b3f3260563b7c6b6cb2ff1a6db',
  'scripts/verify-audit34-browser-evidence.js': '0a5e53dec0a832cb6b46aa3d30703940c24d244c064470fce3326a57f7f34e3a',
  'scripts/apply-audit34-release-stamp.js': 'eb2d06cff87ae9ec06f0fba401bc2935581e8a1926853c7deea41c0a20ab7301',
  'WEBSITE_AUDIT34_IMPECCABLE_UI_EFFICIENCY_REPORT_2026-07-23.md': '4d6f2a90af556fa924c55621c9e096dc40b9f28ae2392ce34b689bf12abed4ed',
  'POLYMYTHCAL_WCAG22_AA_AUDIT34_2026-07-23.md': '4d16db18e37ec56ad63725e7d148ddf414426be190aa3a7b9c22ae2a3af1b0c4',
  'data/polymythcal-audit34/interaction-design-browser-audit.json': '006c454db5fd6dff7e9ce43eb43436468fd6d0776b96cb5988bcf783d7db0086',
  'data/polymythcal-audit34/entry-pages-browser-audit.json': '5bd1572886fb516cd6c8ba6714fe9b0a8fb455dac081e5e7b22aca0e5f3ab5ca',
  'data/polymythcal-audit34/desktop-final.png': 'd202502301311c51a21c96856de33a2db9a51583ea25f4dc435719fd80302dc6',
  'data/polymythcal-audit34/mobile-final.png': 'e4cd9fe150c18ae0ca044fdecac01f0c0d5ea4d82e3e6543525a46693682dada',
  'data/polymythcal-audit34/small-mobile-final.png': '2ab2f3300ebffc0ec64d27945b43a337fa7475e0b5ea2b144f24c6191115e2d0',
};
for (const [relative, expected] of Object.entries(historicalHashes)) {
  check(hash(relative) === expected, `${relative} no longer matches the frozen Audit 34 SHA-256`);
}
const audit34Evolution = read('scripts/verify-audit34-evolution.js');
const audit34Report = read('WEBSITE_AUDIT34_IMPECCABLE_UI_EFFICIENCY_REPORT_2026-07-23.md');
const audit34BrowserVerifier = read('scripts/verify-audit34-browser-evidence.js');
includesAll('historical Audit 34 evolution gate', audit34Evolution, [
  AUDIT34_RELEASE_ID,
  AUDIT34_ASSET_VERSION,
  'node scripts/verify-audit34-browser-evidence.js',
  'data/polymythcal-audit34/**',
]);
includesAll('historical Audit 34 report', audit34Report, [
  '# Website Audit 34 — Impeccable UI and Efficiency',
  AUDIT34_RELEASE_ID,
  'Audit 34 evolution gate: passed.',
]);
includesAll('historical Audit 34 browser verifier', audit34BrowserVerifier, [
  'data/polymythcal-audit34/interaction-design-browser-audit.json',
  'data/polymythcal-audit34/entry-pages-browser-audit.json',
]);
for (const relative of [
  'data/polymythcal-audit34/interaction-design-browser-audit.json',
  'data/polymythcal-audit34/entry-pages-browser-audit.json',
]) {
  const evidence = readJson(relative);
  check(
    evidence.audit === 34
      && evidence.release_id === AUDIT34_RELEASE_ID
      && evidence.checks_total === evidence.checks_passed
      && Number(evidence.checks_failed || 0) === 0,
    `${relative} no longer preserves the passing Audit 34 evidence contract`,
  );
}

if (failures.length) {
  console.error('AUDIT 35 EVOLUTION GATE FAILED');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log(
  'AUDIT 35 EVOLUTION GATE PASSED — release/stamp/report aligned; ' +
  '838 events, 32 types, 422 sources, 595 unconfirmed, 24-item batches, ' +
  '644/25/7 Teacher Resources, four-hour no-shard harvest, current UI/failure/' +
  'autolink/build/package/workflow contracts, and frozen Audit 34 evidence preserved.',
);
