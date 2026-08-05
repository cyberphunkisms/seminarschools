#!/usr/bin/env node
'use strict';

/** Audit 53 is current; earlier audit evidence remains active and immutable. */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const failures = [];

function read(relative) {
  try {
    return fs.readFileSync(path.join(ROOT, relative), 'utf8');
  } catch {
    failures.push(`${relative} is missing`);
    return '';
  }
}
function exists(relative) {
  return fs.existsSync(path.join(ROOT, relative));
}
function check(condition, message) {
  if (!condition) failures.push(message);
}

const runner = read('scripts/verify-all-runner.js');
const deployer = read('scripts/package-deployer-compatible.py');
const sourcePackager = read('scripts/package-netlify-source.py');
let pkg = {};
let manifest = {};
let lock = {};
try {
  pkg = JSON.parse(read('package.json'));
  manifest = JSON.parse(read('RELEASE_MANIFEST.json'));
  lock = JSON.parse(read('package-lock.json'));
} catch (error) {
  failures.push(`release JSON is invalid: ${error.message}`);
}

const expectedRelease = '2026-07-28-site-audit53-shared-discovery-teacherresources-polymythcal-commons-final';
check(manifest.release_id === expectedRelease, `current release is ${manifest.release_id}`);
check(manifest.polymythcal_asset_version === '20260728-audit53', `current asset version is ${manifest.polymythcal_asset_version}`);
check(pkg.version === '1.0.6', `package version is ${pkg.version}`);
check(lock.version === '1.0.6' && lock.packages?.['']?.version === '1.0.6', 'package-lock version is not 1.0.6');
for (const [name, command] of Object.entries({
  'verify:all': 'node scripts/verify-all-runner.js',
  'verify:all:built': 'node scripts/verify-all-runner.js --reuse-build',
  'verify:all:serial': 'node scripts/verify-all-runner.js --concurrency=1',
  'verify:release': 'node scripts/verify-all-runner.js',
  'verify:frozen-audit43': 'node scripts/verify-frozen-audit43.js',
  'build:audit45-language-model': 'node scripts/run-python.js scripts/apply-audit45-language-model.py',
  'build:audit45-leizu-i18n': 'node scripts/build-leizu-i18n-source.js',
  'build:audit45-polymythcal-i18n': 'node scripts/build-polymythcal-i18n-source.js',
  'build:audit45-localized-routes': 'node scripts/run-python.js scripts/build-audit45-localized-routes.py',
  'apply:audit45-translation-ui': 'node scripts/apply-audit45-translation-ui.js',
  'verify:audit45-translations': 'node scripts/run-python.js scripts/verify-audit45-translations.py',
  'audit:audit45-browser': 'node scripts/audit45-translation-browser.js',
  'verify:audit45-browser-evidence': 'node scripts/verify-audit45-browser-evidence.js',
  'verify:audit45-current-browser-evidence': 'node scripts/verify-audit45-browser-evidence.js',
  'apply:audit45-release-stamp': 'node scripts/apply-audit45-release-stamp.js',
  'apply:audit46-asset-normalization': 'node scripts/normalize-shared-asset-references.js',
  'apply:audit48-approved-ui': 'node scripts/apply-audit48-approved-ui.js',
  'apply:audit48-release-stamp': 'node scripts/apply-audit48-release-stamp.js',
  'verify:audit41-event-rollover': 'node scripts/verify-audit41-event-rollover.js',
  'verify:audit46-technical-efficiency': 'node scripts/verify-audit46-technical-efficiency.js',
  'verify:audit47-technical-efficiency': 'node scripts/verify-audit47-technical-efficiency.js',
  'verify:polymythcal-audit47': 'node scripts/verify-polymythcal-audit47.js',
  'test:polymythcal-audit47': 'node scripts/run-python.js -m unittest scripts/test_polymythcal_audit47.py',
  'verify:audit48-assistive-technology': 'node scripts/verify-audit48-assistive-technology.js',
  'verify:audit48-browser-program': 'node scripts/verify-audit48-browser-program.js',
  'test:audit48-calendar-clients': 'node scripts/run-python.js -m unittest scripts/test_polymythcal_calendar_clients.py',
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
  'verify:cloud-input-runtime': 'node scripts/verify-cloud-input-runtime.js',
  'verify:redirect-coherence': 'node scripts/verify-redirect-policy-coherence.js',
})) {
  check(pkg.scripts?.[name] === command, `package ${name} is not the current release contract`);
}

for (const staleWriter of [
  'apply:audit42-release-stamp',
  'apply:audit43-release-stamp',
  'build:audit42-site-inventory',
  'build:audit43-continuity',
  'audit:audit42-inherited-browser',
  'audit:audit42-multimode',
  'audit:audit43-browser',
  'verify:audit43-current-browser-evidence',
]) {
  check(!pkg.scripts?.[staleWriter], `historical writer/current alias ${staleWriter} is exposed`);
}

const build = pkg.scripts?.build || '';
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
let previous = -1;
for (const token of buildOrder) {
  const index = build.indexOf(token);
  check(index > previous, `canonical build order omits or misorders ${token}`);
  previous = index;
}
check(!build.includes('build-audit43-continuity-inventory.js'), 'canonical build mutates frozen Audit 43 inventory');

for (const token of [
  'npm run build',
  'verify-public-deploy-parity.js',
  'verify-frozen-audit43.js',
  'verify-audit45-translations.py',
  'verify-audit45-browser-evidence.js',
  'verify-release-gates.js',
  'verify-harvest-pipeline.js',
  'verify-live-content-integrity.js',
  'verify-teacherresources-finder.js',
  'verify-runtime-delivery-resilience.js',
  'verify-audit41-event-rollover.js',
  'verify-audit46-technical-efficiency.js',
  'verify-audit47-technical-efficiency.js',
  'verify-polymythcal-audit47.js',
  'verify-polymythcal-audit14.js',
  'test_polymythcal_audit47.py',
  'verify-audit48-assistive-technology.js',
  'verify-audit48-browser-program.js',
  'verify-polymythcal-calendar-clients.py',
  'test_audit48_live_harvest.py',
  'verify_audit48_live_harvest.py',
  'verify-audit48-external-validation.js',
  'verify-audit49-aa-dialog.mjs',
  'verify-audit49-aitr-resilience.mjs',
  'verify-audit49-metadata-surface.js',
  'verify-audit49-runtime-efficiency.js',
  'verify-audit49-build-packaging-efficiency.js',
  'verify-audit49-technical-efficiency.js',
  'verify-cloud-input-runtime.js',
  'verify-redirect-policy-coherence.js',
  'verify-core-html-structure.js',
  'verify-project-failure-resilience.js',
  'verify-public-artifact-blocks.js',
  'test_package_integrity.py',
]) {
  check(runner.includes(token), `current release runner omits ${token}`);
}
for (const staleGate of [
  'node scripts/build-audit43-continuity-inventory.js',
  'node scripts/verify-audit43-browser-evidence.js',
  'node scripts/verify-audit42-ledger-closure.js',
  'node scripts/build-audit42-site-inventory.js',
]) {
  check(!runner.includes(staleGate), `current runner executes stale gate ${staleGate}`);
}

const historicalRequired = [
  'WEBSITE_AUDIT42_COMPLETE_LEDGER_CLOSURE_REPORT_2026-07-25.md',
  'WEBSITE_AUDIT43_APPROVED_EVOLUTION_REPORT_2026-07-25.md',
  'WEBSITE_AUDIT44_FULL_TRANSLATION_REPORT_2026-07-25.md',
  'data/audit42-frozen-sha256.json',
  'data/audit43-frozen-sha256.json',
  'scripts/verify-frozen-audit42.js',
  'scripts/verify-frozen-audit43.js',
  'data/audit43-browser/approved-direction-browser-audit.json',
];
for (const relative of historicalRequired) {
  check(exists(relative), `historical evidence is missing: ${relative}`);
}

const currentRequired = [
  'WEBSITE_AUDIT45_FULL_TRANSLATION_IMPLEMENTATION_REPORT_2026-07-25.md',
  'scripts/apply-audit45-language-model.py',
  'scripts/build-leizu-i18n-source.js',
  'scripts/build-polymythcal-i18n-source.js',
  'scripts/build-audit45-localized-routes.py',
  'scripts/apply-audit45-translation-ui.js',
  'scripts/verify-audit45-translations.py',
  'scripts/audit45-translation-browser.js',
  'scripts/verify-audit45-browser-evidence.js',
  'scripts/apply-audit45-release-stamp.js',
  'css/audit45-localization.css',
  'data/audit45-translation-governance.json',
  'data/leizu-i18n-audit45.json',
  'data/polymythcal-static-i18n-audit45.json',
  'data/audit45-browser/translation-browser-audit.json',
  'leizu/fr/index.html',
  'leizu/zh-hant/index.html',
  'leizu/zh-hans/index.html',
  'leizu/fa/index.html',
  'polymythseminars/fr/index.html',
  'saul/fr/index.html',
  'saul/zh-hant/index.html',
  'saul/zh-hans/index.html',
  'saul/fa/index.html',
];
for (const relative of currentRequired) {
  check(exists(relative), `current Audit 45 artifact is missing: ${relative}`);
}

const audit46Required = [
  'WEBSITE_AUDIT46_TECHNICAL_EFFICIENCY_REPORT_2026-07-26.md',
  'scripts/reports/audit46-technical-efficiency.json',
  'scripts/verify-audit46-technical-efficiency.js',
  'scripts/normalize-shared-asset-references.js',
  'scripts/verify-cloud-input-runtime.js',
  'scripts/verify-function-dependency-resolution.mjs',
  'scripts/verify-redirect-policy-coherence.js',
  'scripts/package_integrity.py',
  'scripts/test_package_integrity.py',
  'requirements-harvest-browser.txt',
];
for (const relative of audit46Required) {
  check(exists(relative), `current Audit 46 artifact is missing: ${relative}`);
  check(deployer.includes(relative), `deployer package does not require ${relative}`);
}

const audit47Required = [
  'WEBSITE_AUDIT47_TECHNICAL_EFFICIENCY_REPORT_2026-07-26.md',
  'scripts/reports/audit47-technical-efficiency.json',
  'scripts/verify-audit47-technical-efficiency.js',
  'scripts/verify-polymythcal-audit47.js',
  'scripts/test_polymythcal_audit47.py',
  'scripts/reconcile_polymythcal_lifecycle.py',
  'scripts/build-polymythcal-feeds.py',
];
for (const relative of audit47Required) {
  check(exists(relative), `current Audit 47 artifact is missing: ${relative}`);
  check(deployer.includes(relative), `deployer package does not require ${relative}`);
}

const audit48Required = [
  'WEBSITE_AUDIT48_EXTERNAL_VALIDATION_INTEROPERABILITY_REPORT_2026-07-26.md',
  'WEBSITE_AUDIT48_CALENDAR_CLIENT_INTEROPERABILITY_REPORT_2026-07-26.md',
  'AUDIT48_NATIVE_DEVICE_AT_TEST_PROTOCOL_2026-07-26.md',
  'AUDIT48_CALENDAR_VENDOR_IMPORT_PROTOCOL_2026-07-26.md',
  '.github/ISSUE_TEMPLATE/polymythcal-native-at-signoff.yml',
  'scripts/apply-audit48-approved-ui.js',
  'scripts/apply-audit48-release-stamp.js',
  'scripts/audit48-cross-engine-browser.js',
  'scripts/verify-audit48-browser-program.js',
  'data/audit48-browser/cross-engine-preflight.json',
  'scripts/verify-audit48-assistive-technology.js',
  'scripts/reports/audit48-assistive-technology.json',
  'scripts/test_polymythcal_calendar_clients.py',
  'scripts/verify-polymythcal-calendar-clients.py',
  'scripts/reports/audit48-calendar-client-interoperability.json',
  'scripts/audit_polymythcal_live_endpoints.py',
  'scripts/compose_audit48_live_harvest_evidence.py',
  'scripts/test_audit48_live_harvest.py',
  'scripts/verify_audit48_live_harvest.py',
  'scripts/reports/audit48-live-harvest-endpoints.json',
  'scripts/verify-audit48-external-validation.js',
  'scripts/reports/audit48-external-validation.json',
];
for (const relative of audit48Required) {
  check(exists(relative), `current Audit 48 artifact is missing: ${relative}`);
  check(deployer.includes(relative), `deployer package does not require ${relative}`);
  check(sourcePackager.includes(relative), `source package does not require ${relative}`);
}

const audit49Required = [
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
];
for (const relative of audit49Required) {
  check(exists(relative), `current Audit 49 artifact is missing: ${relative}`);
  check(deployer.includes(relative), `deployer package does not require ${relative}`);
  check(sourcePackager.includes(relative), `source package does not require ${relative}`);
}

check(
  runner.includes('node scripts/verify-audit45-browser-evidence.js')
    && !deployer.includes("'verify:audit45-current-browser-evidence'"),
  'deployer does not inherit exactly one Audit 45 browser-evidence gate from the full runner',
);
for (const relative of [
  'WEBSITE_AUDIT44_FULL_TRANSLATION_REPORT_2026-07-25.md',
  'WEBSITE_AUDIT45_FULL_TRANSLATION_IMPLEMENTATION_REPORT_2026-07-25.md',
  'data/audit43-frozen-sha256.json',
  'data/audit45-translation-governance.json',
  'data/audit45-browser/translation-browser-audit.json',
  'scripts/verify-audit45-translations.py',
  'scripts/verify-audit45-browser-evidence.js',
]) {
  check(deployer.includes(relative), `deployer package does not require ${relative}`);
}
check(runner.includes('release-gate-report.json'), 'release runner does not write its report');

if (failures.length) {
  console.error(`RELEASE GATE CHECK FAILED (${failures.length})`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(
  'RELEASE GATE CHECK PASSED — Audit 49 technical-efficiency gates are current, Audit 48 external-validation evidence remains active, '
  + 'Audit 43 is frozen, and Audit 45 static plus Chromium translation evidence remains shipping-blocking.',
);
