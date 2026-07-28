#!/usr/bin/env node
'use strict';

/**
 * Verifies the deployable Audit 49 contract without rewriting generated files.
 * Audit 48 external-validation evidence remains active while Audit 49 owns
 * the current metadata, runtime, build, and packaging efficiency layer.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const EXPECTED_RELEASE =
  '2026-07-26-site-audit49-technical-efficiency-resilience-final';
const failures = [];

function read(relative) {
  try {
    return fs.readFileSync(path.join(ROOT, relative), 'utf8');
  } catch {
    failures.push(`${relative} is missing`);
    return '';
  }
}
function parseJson(relative) {
  try {
    return JSON.parse(read(relative));
  } catch (error) {
    failures.push(`${relative} is invalid JSON: ${error.message}`);
    return {};
  }
}
function exists(relative) {
  return fs.existsSync(path.join(ROOT, relative));
}
function check(condition, message) {
  if (!condition) failures.push(message);
}

const releaseId = read('RELEASE_ID.txt').trim();
const release = parseJson('RELEASE_MANIFEST.json');
const buildManifest = parseJson('data/polymythcal-build-manifest.json');
const eventPayload = parseJson('polymythseminars/events.json');
const teacherPayload = parseJson('teacherresources/resources-data.json');
const pkg = parseJson('package.json');
const lock = parseJson('package-lock.json');
const events = Array.isArray(eventPayload.events) ? eventPayload.events : [];
const teacherResources = (teacherPayload.groups || []).flatMap(group =>
  (group.categories || []).flatMap(category => category.entries || []),
);
const assetVersion = String(release.polymythcal_asset_version || '');

check(releaseId === EXPECTED_RELEASE, `release ID is not ${EXPECTED_RELEASE}`);
check(release.release_id === releaseId, 'release manifest and RELEASE_ID.txt disagree');
check(assetVersion === '20260726-audit49', `asset version is ${assetVersion}`);
check(
  buildManifest.release_id === releaseId
    && buildManifest.interface_release === releaseId
    && buildManifest.polymythcal_asset_version === assetVersion,
  'Polymythcal build manifest is not bound to Audit 49',
);
check(
  events.length === 833
    && buildManifest.record_count === 833
    && eventPayload.count === 833
    && eventPayload._total_events === 833,
  'Polymythcal does not retain the 833-event deduplicated inventory',
);
check(
  teacherResources.length === 644,
  `Teacher Resources does not retain 644 records (${teacherResources.length})`,
);

check(pkg.engines?.node === '24.14.0', 'package Node engine is not pinned to 24.14.0');
check(pkg.engines?.npm === '11.9.0', 'package npm engine is not pinned to 11.9.0');
check(pkg.packageManager === 'npm@11.9.0', 'package manager is not pinned to npm 11.9.0');
check(pkg.version === '1.0.6', `package version is ${pkg.version}`);
check(lock.version === '1.0.6' && lock.packages?.['']?.version === '1.0.6', 'package-lock version is not 1.0.6');
check(read('.nvmrc').trim() === '24.14.0', '.nvmrc is not pinned to Node 24.14.0');
check(pkg.scripts?.dev === 'node scripts/dev-server.js', 'npm run dev is not repository-local');
check(
  !pkg.dependencies?.vite
    && !pkg.devDependencies?.vite
    && !lock.packages?.['node_modules/vite'],
  'Vite remains in the dependency contract',
);
check(
  !fs.readdirSync(ROOT).some(name => /^vite\.config\./i.test(name)),
  'a Vite configuration remains at repository root',
);

const buildOrder = [
  'apply-audit45-language-model.py',
  'build-polymythcal-audit13.py',
  'build-search-pages.js',
  'build-polymythcal-browser-payload.js',
  'build-polymythcal-candidate-surface.py',
  'apply-audit48-approved-ui.js',
  'normalize-shared-asset-references.js',
  'build-leizu-i18n-source.js',
  'build-polymythcal-i18n-source.js',
  'apply-audit49-release-stamp.js',
  'build-audit45-localized-routes.py',
  'apply-audit45-translation-ui.js',
  'apply-audit49-metadata-hygiene.js',
  'update-polymythcal-build-manifest.js',
  'build-public-deploy.js',
  'verify-public-deploy-parity.js',
  'verify-audit45-translations.py',
  'verify-audit49-metadata-surface.js',
  'verify-audit49-runtime-efficiency.js',
  'verify-audit49-build-packaging-efficiency.js',
];
const build = pkg.scripts?.build || '';
let previous = -1;
for (const token of buildOrder) {
  const index = build.indexOf(token);
  check(index > previous, `production build omits or misorders ${token}`);
  previous = index;
}
check(!build.includes('build-audit43-continuity-inventory.js'), 'build rewrites frozen Audit 43 evidence');

for (const [name, command] of Object.entries({
  'build:public-deploy': 'node scripts/build-public-deploy.js',
  'verify:public-parity': 'node scripts/verify-public-deploy-parity.js',
  'verify:all:built': 'node scripts/verify-all-runner.js --reuse-build',
  'verify:frozen-audit43': 'node scripts/verify-frozen-audit43.js',
  'verify:audit45-translations': 'node scripts/run-python.js scripts/verify-audit45-translations.py',
  'audit:audit45-browser': 'node scripts/audit45-translation-browser.js',
  'verify:audit45-current-browser-evidence': 'node scripts/verify-audit45-browser-evidence.js',
  'apply:audit45-release-stamp': 'node scripts/apply-audit45-release-stamp.js',
  'apply:audit48-approved-ui': 'node scripts/apply-audit48-approved-ui.js',
  'verify:function-dependencies': 'node scripts/verify-function-dependency-resolution.mjs',
  'verify:audit47-technical-efficiency': 'node scripts/verify-audit47-technical-efficiency.js',
  'verify:polymythcal-audit47': 'node scripts/verify-polymythcal-audit47.js',
  'test:polymythcal-audit47': 'node scripts/run-python.js -m unittest scripts/test_polymythcal_audit47.py',
  'apply:audit48-release-stamp': 'node scripts/apply-audit48-release-stamp.js',
  'verify:audit48-assistive-technology': 'node scripts/verify-audit48-assistive-technology.js',
  'verify:audit48-browser-program': 'node scripts/verify-audit48-browser-program.js',
  'verify:audit48-calendar-clients': 'node scripts/run-python.js scripts/verify-polymythcal-calendar-clients.py',
  'test:audit48-live-harvest': 'node scripts/run-python.js -m unittest scripts/test_audit48_live_harvest.py',
  'verify:audit48-live-harvest': 'node scripts/run-python.js scripts/verify_audit48_live_harvest.py',
  'verify:audit48-live-harvest:current': 'node scripts/run-python.js scripts/verify_audit48_live_harvest.py --require-current',
  'verify:audit48-external-validation': 'node scripts/verify-audit48-external-validation.js',
  'apply:audit49-release-stamp': 'node scripts/apply-audit49-release-stamp.js',
  'apply:audit49-metadata-hygiene': 'node scripts/apply-audit49-metadata-hygiene.js',
  'verify:audit49-aa-dialog': 'node scripts/verify-audit49-aa-dialog.mjs',
  'verify:audit49-aitr-resilience': 'node scripts/verify-audit49-aitr-resilience.mjs',
  'verify:audit49-metadata-surface': 'node scripts/verify-audit49-metadata-surface.js',
  'verify:audit49-runtime-efficiency': 'node scripts/verify-audit49-runtime-efficiency.js',
  'verify:audit49-build-packaging-efficiency': 'node scripts/verify-audit49-build-packaging-efficiency.js',
  'verify:audit49-technical-efficiency': 'node scripts/verify-audit49-technical-efficiency.js',
})) {
  check(pkg.scripts?.[name] === command, `package script ${name} is not current`);
}
for (const historicalWriter of [
  'apply:audit42-release-stamp',
  'apply:audit43-release-stamp',
  'build:audit42-site-inventory',
  'build:audit43-continuity',
  'audit:audit42-inherited-browser',
  'audit:audit43-browser',
  'verify:audit43-current-browser-evidence',
]) {
  check(!pkg.scripts?.[historicalWriter], `historical writer remains exposed: ${historicalWriter}`);
}

const dependency = pkg.dependencies?.['@netlify/blobs'];
check(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(dependency || ''), '@netlify/blobs is not pinned');
check(lock.packages?.['']?.dependencies?.['@netlify/blobs'] === dependency, 'lock root dependency differs');
check(lock.packages?.['node_modules/@netlify/blobs']?.version === dependency, 'locked blobs version differs');
check(
  /^sha512-/.test(lock.packages?.['node_modules/@netlify/blobs']?.integrity || ''),
  'locked @netlify/blobs lacks SHA-512 integrity',
);
const playwright = pkg.devDependencies?.playwright;
check(playwright === '1.61.1', 'Playwright dev dependency is not pinned to 1.61.1');
check(
  lock.packages?.['']?.devDependencies?.playwright === playwright,
  'lock root Playwright dev dependency differs',
);
check(
  lock.packages?.['node_modules/playwright']?.version === playwright,
  'locked Playwright version differs',
);
check(
  /^sha512-/.test(lock.packages?.['node_modules/playwright']?.integrity || ''),
  'locked Playwright lacks SHA-512 integrity',
);

const netlify = read('netlify.toml');
check(/command\s*=\s*"npm run build"/.test(netlify), 'Netlify does not run canonical build');
check(/NODE_VERSION\s*=\s*"24\.14\.0"/.test(netlify), 'Netlify Node version is not pinned to 24.14.0');
check(/publish\s*=\s*"public"/.test(netlify), 'Netlify publish directory is not public');
check(netlify.includes('node ./scripts/netlify-ignore-build.js'), 'Netlify ignore command changed');

for (const relative of [
  '.github/dependabot.yml',
  '.github/workflows/predeploy.yml',
  '.github/workflows/scrape-polymythcal-protests.yml',
  '.github/workflows/scrape-seminars.yml',
  '.github/workflows/scrape-festivals.yml',
  '.github/workflows/audit-external-links.yml',
  'scripts/verify-frozen-audit43.js',
  'data/audit43-frozen-sha256.json',
  'scripts/apply-audit45-language-model.py',
  'scripts/build-audit45-localized-routes.py',
  'scripts/apply-audit45-translation-ui.js',
  'scripts/verify-audit45-translations.py',
  'scripts/audit45-translation-browser.js',
  'scripts/verify-audit45-browser-evidence.js',
  'data/audit45-translation-governance.json',
  'data/audit45-browser/translation-browser-audit.json',
  'WEBSITE_AUDIT44_FULL_TRANSLATION_REPORT_2026-07-25.md',
  'WEBSITE_AUDIT45_FULL_TRANSLATION_IMPLEMENTATION_REPORT_2026-07-25.md',
  'WEBSITE_AUDIT48_CALENDAR_CLIENT_INTEROPERABILITY_REPORT_2026-07-26.md',
  'AUDIT48_NATIVE_DEVICE_AT_TEST_PROTOCOL_2026-07-26.md',
  'AUDIT48_CALENDAR_VENDOR_IMPORT_PROTOCOL_2026-07-26.md',
  'scripts/apply-audit48-approved-ui.js',
  'data/audit48-browser/cross-engine-preflight.json',
  'scripts/reports/audit48-assistive-technology.json',
  'scripts/reports/audit48-calendar-client-interoperability.json',
  'scripts/compose_audit48_live_harvest_evidence.py',
  'scripts/verify-audit48-external-validation.js',
  'WEBSITE_AUDIT49_TECHNICAL_EFFICIENCY_RESILIENCE_REPORT_2026-07-26.md',
  'scripts/reports/audit49-technical-efficiency.json',
  'scripts/reports/audit49-metadata-surface.json',
  'scripts/reports/audit49-runtime-efficiency.json',
  'scripts/reports/audit49-build-packaging-efficiency.json',
  'scripts/apply-audit49-metadata-hygiene.js',
  'scripts/apply-audit49-release-stamp.js',
  'scripts/verify-audit49-technical-efficiency.js',
  'scripts/verify-audit49-metadata-surface.js',
  'scripts/verify-audit49-runtime-efficiency.js',
  'scripts/verify-audit49-build-packaging-efficiency.js',
  'scripts/verify-audit49-aa-dialog.mjs',
  'scripts/verify-audit49-aitr-resilience.mjs',
  'scripts/package_selection.py',
]) {
  check(exists(relative), `${relative} is missing`);
}

const workflowTexts = fs.readdirSync(path.join(ROOT, '.github/workflows'))
  .filter(name => /\.ya?ml$/.test(name))
  .map(name => read(`.github/workflows/${name}`))
  .join('\n');
check(!workflowTexts.includes('actions/checkout@v5'), 'a workflow still uses checkout v5');
check(!workflowTexts.includes('actions/upload-artifact@v6'), 'a workflow still uses artifact v6');
check(workflowTexts.includes('actions/checkout@v6'), 'workflows omit checkout v6');
check(workflowTexts.includes('actions/upload-artifact@v7'), 'workflows omit artifact v7');

const predeploy = read('.github/workflows/predeploy.yml');
for (const os of ['ubuntu-latest', 'windows-latest', 'macos-latest']) {
  check(predeploy.includes(os), `predeploy matrix omits ${os}`);
}
for (const token of [
  'fail-fast: true',
  'needs: clean-build',
  'npm run build',
  'npm run verify:all:built',
  'npm run verify:frozen-audit43',
  'npm run verify:audit45-translations',
  'npm run test:polymythcal-audit47',
  'npm run verify:audit48-calendar-clients',
  'npm run verify:audit48-live-harvest:current',
  'npx playwright install --with-deps chromium',
  'npm run audit:audit45-browser',
  'npm run verify:audit45-current-browser-evidence',
  'npm run verify:function-dependencies',
  'data/audit43-frozen-sha256.json',
  'data/audit45-browser/**',
  'WEBSITE_AUDIT45_FULL_TRANSLATION_IMPLEMENTATION_REPORT_2026-07-25.md',
  'data/audit48-browser/**',
  'scripts/reports/audit48-*.json',
  'AUDIT48_NATIVE_DEVICE_AT_TEST_PROTOCOL_2026-07-26.md',
  'WEBSITE_AUDIT49_TECHNICAL_EFFICIENCY_RESILIENCE_REPORT_2026-07-26.md',
  'scripts/reports/audit49-*.json',
  'retention-days: 14',
  'tracked-public-regression',
  'full-audit',
]) {
  check(predeploy.includes(token), `predeploy omits ${token}`);
}
const npmInstallCommands = predeploy.match(/\bnpm\s+(?:ci|install)\b/g) || [];
check(
  npmInstallCommands.length === 1 && npmInstallCommands[0] === 'npm ci',
  `predeploy performs ${npmInstallCommands.length} npm dependency installations instead of one npm ci`,
);
for (const staleCurrentCommand of [
  'python scripts/audit43-approved-browser.py',
  'npm run verify:audit43-current-browser-evidence',
  'python scripts/run-audit42-inherited-browser-all.py',
  'npm run verify:audit42-current-browser-evidence',
]) {
  check(!predeploy.includes(staleCurrentCommand), `predeploy still executes ${staleCurrentCommand}`);
}
check(
  predeploy.indexOf('npx playwright install --with-deps chromium')
    > predeploy.indexOf('npm run verify:all:built'),
  'Chromium installation is not deferred until portable gates pass',
);
check(
  predeploy.indexOf('npm run verify:audit45-current-browser-evidence')
    > predeploy.indexOf('npm run audit:audit45-browser'),
  'Audit 45 browser evidence is verified before fresh generation',
);

for (const [relative, cron] of [
  ['.github/workflows/scrape-polymythcal-protests.yml', '18 8 * * 3'],
  ['.github/workflows/scrape-seminars.yml', '47 8 * * 1'],
  ['.github/workflows/scrape-festivals.yml', '42 9 * * 2'],
  ['.github/workflows/audit-external-links.yml', '17 10 * * 0'],
]) {
  const source = read(relative);
  const schedules = [...source.matchAll(/\bcron:\s*["']([^"']+)["']/g)]
    .map(match => match[1]);
  check(
    schedules.length === 1 && schedules[0] === cron,
    `${relative} must run exactly once weekly at ${cron}`,
  );
}

const deployer = read('scripts/package-deployer-compatible.py');
const sourcePackager = read('scripts/package-netlify-source.py');
const packageIntegrity = read('scripts/package_integrity.py');
const runner = read('scripts/verify-all-runner.js');
check(deployer.includes('run_production_build()'), 'deployer skips production build');
check(
  deployer.includes('run_portable_verification()')
    && deployer.includes("'verify:all:built'"),
  'deployer skips portable release gates',
);
check(
  runner.includes('node scripts/verify-audit45-browser-evidence.js')
    && !deployer.includes("'verify:audit45-current-browser-evidence'"),
  'deployer does not inherit exactly one Audit 45 browser-evidence gate from the full runner',
);
check(
  runner.includes('node scripts/verify-public-deploy-parity.js')
    && !deployer.includes('def verify_public_parity'),
  'deployer does not inherit exactly one post-build public-parity gate from the full runner',
);
check(
  sourcePackager.includes('run_release_verification()')
    && sourcePackager.includes("'verify:all:built'"),
  'source packager skips full release gates',
);
for (const [label, source] of [['deployer', deployer], ['source', sourcePackager]]) {
  check(
    source.includes('verify:audit48-live-harvest:current'),
    `${label} package skips current Audit 48 live evidence`,
  );
}
for (const [label, source] of [['deployer', deployer], ['source', sourcePackager]]) {
  check(
    source.includes('write_verified_archive')
      && packageIntegrity.includes('sidecar = Path(str(output) + ".sha256")'),
    `${label} package lacks verified SHA-256 output`,
  );
}
check(!runner.includes('package-deployer-compatible.py'), 'verify:all would recurse into packager');
for (const relative of [
  'WEBSITE_AUDIT48_EXTERNAL_VALIDATION_INTEROPERABILITY_REPORT_2026-07-26.md',
  'scripts/reports/audit48-live-harvest-endpoints.json',
  'scripts/reports/audit48-external-validation.json',
]) {
  check(deployer.includes(relative), `deployer does not require ${relative}`);
  check(sourcePackager.includes(relative), `source packager does not require ${relative}`);
}
for (const relative of [
  'WEBSITE_AUDIT49_TECHNICAL_EFFICIENCY_RESILIENCE_REPORT_2026-07-26.md',
  'scripts/reports/audit49-technical-efficiency.json',
  'scripts/reports/audit49-metadata-surface.json',
  'scripts/reports/audit49-runtime-efficiency.json',
  'scripts/reports/audit49-build-packaging-efficiency.json',
  'scripts/apply-audit49-metadata-hygiene.js',
  'scripts/apply-audit49-release-stamp.js',
  'scripts/verify-audit49-technical-efficiency.js',
  'scripts/verify-audit49-metadata-surface.js',
  'scripts/verify-audit49-runtime-efficiency.js',
  'scripts/verify-audit49-build-packaging-efficiency.js',
  'scripts/verify-audit49-aa-dialog.mjs',
  'scripts/verify-audit49-aitr-resilience.mjs',
  'scripts/package_selection.py',
]) {
  check(deployer.includes(relative), `deployer does not require ${relative}`);
  check(sourcePackager.includes(relative), `source packager does not require ${relative}`);
}
for (const token of [
  'verify-audit49-aa-dialog.mjs',
  'verify-audit49-aitr-resilience.mjs',
  'verify-audit49-metadata-surface.js',
  'verify-audit49-runtime-efficiency.js',
  'verify-audit49-build-packaging-efficiency.js',
  'verify-audit49-technical-efficiency.js',
]) {
  check(runner.includes(token), `full runner omits ${token}`);
}

if (failures.length) {
  console.error(`PRE-DEPLOY AUTOMATION CONTRACT FAILED (${failures.length})`);
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log(
  `PRE-DEPLOY AUTOMATION CONTRACT PASSED — ${events.length} events, `
  + 'Audit 43 frozen, Audit 48 external-validation evidence active, Audit 49 technical-efficiency gates current, exact weekly workflows, portable gates, '
  + 'fresh Chromium evidence, and both deployment formats aligned.',
);
