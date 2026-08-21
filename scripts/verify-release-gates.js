#!/usr/bin/env node
'use strict';

/** The August 15 Sets 1-15 synthesis is current; earlier audit evidence remains immutable. */
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
const completePackager = read('scripts/package-complete-current.py');
const completeArchivePackager = read('scripts/package-front-facing-mephistodata-release.py');
const cleanRoomBuilder = read('scripts/build-clean-room-release.py');
const cleanRoomVerifier = read('scripts/verify-clean-room-release.py');
const auditPythonDependencies = read('scripts/audit_python_dependencies.py');
const predeployWorkflow = read('.github/workflows/predeploy.yml');
const coherenceWorkbookVerifier = read('scripts/verify-polymyth-coherence-workbook.py');
const futureproofContract = read('data/futureproofing/futureproofing-contract.json');
const artifactReceipt = read('scripts/artifact_receipt.py');
const packageSelection = read('scripts/package_selection.py');
const audit49PackagingVerifier = read('scripts/verify-audit49-build-packaging-efficiency.js');
const publicBuilder = read('scripts/build-public-deploy.js');
const releaseAssetIdentityHelper = read('scripts/lib/release-asset-identity.js');
const releaseAssetIdentityUpdater = read('scripts/update-release-asset-identity.js');
const releaseAssetIdentityVerifier = read('scripts/verify-release-asset-identity.js');
let pkg = {};
let manifest = {};
let lock = {};
let futureproof = {};
try {
  pkg = JSON.parse(read('package.json'));
  manifest = JSON.parse(read('RELEASE_MANIFEST.json'));
  lock = JSON.parse(read('package-lock.json'));
  futureproof = JSON.parse(futureproofContract);
} catch (error) {
  failures.push(`release JSON is invalid: ${error.message}`);
}

const expectedRelease = '2026-08-15-polymythcal-sets1-15-sitewide-fixes-synthesized-final';
check(manifest.release_id === expectedRelease, `current release is ${manifest.release_id}`);
check(manifest.generated_at === '2026-08-15T18:00:00-04:00', `current release timestamp is ${manifest.generated_at}`);
check(manifest.polymythcal_asset_version === '20260815-sets1-15-synthesis', `current asset version is ${manifest.polymythcal_asset_version}`);
check(/^sha256-[0-9a-f]{12}$/.test(manifest.geometry_asset_version || ''), 'release manifest lacks a content-derived geometry asset version');
check(
  manifest.teacherresources_asset_versions
    && Object.keys(manifest.teacherresources_asset_versions).sort().join(',') === 'finder_css,finder_js'
    && Object.values(manifest.teacherresources_asset_versions).every(value => /^sha256-[0-9a-f]{12}$/.test(value)),
  'release manifest lacks exact Teacher Resources asset versions',
);
check(
  manifest.asset_digests
    && Object.keys(manifest.asset_digests).length === 15
    && Object.values(manifest.asset_digests).every(value => /^[0-9a-f]{64}$/.test(value)),
  'release manifest lacks the 15 sitewide and Polymythcal SHA-256 asset digests',
);
for (const field of ['geometry_asset_version', 'teacherresources_asset_versions', 'asset_digests']) {
  check(publicBuilder.includes(`'${field}'`), `public release marker does not pass through ${field}`);
}
for (const token of [
  "geometryAssetVersion(root)",
  "teacherresources_asset_versions",
  "RELEASE_ASSET_PATHS",
  "'data/polymyth-seminar-events.json'",
  "'data/polymythcal-event-schema-v2.json'",
  "'js/polymythcal-revamp.js'",
  "'polymythseminars/browse.json'",
  "'polymythseminars/index.html'",
  "'polymythseminars/fr/index.html'",
  "PUBLIC_RELEASE_ASSET_PATHS",
  "'data/polymyth-seminar-events.json': 'polymythseminars/events.json'",
  "'data/polymythcal-event-schema-v2.json': null",
]) check(releaseAssetIdentityHelper.includes(token), `release asset identity helper misses ${token}`);
check(releaseAssetIdentityUpdater.includes('computeReleaseAssetIdentity(ROOT)'), 'release asset updater does not recompute source identity');
for (const token of ['computeReleaseAssetIdentity(ROOT)', 'public/site-release.json', 'public mirror differs from source']) {
  check(releaseAssetIdentityVerifier.includes(token), `release asset verifier misses ${token}`);
}
check(pkg.version === '1.0.6', `package version is ${pkg.version}`);
check(!pkg.scripts?.['package:audit53'], 'obsolete Audit 53 subset packager remains exposed');
check(
  Array.isArray(futureproof.items)
    && futureproof.items.length === 15
    && futureproof.items.every((item, index) => item.id === `FP-${String(index + 1).padStart(2, '0')}` && item.status === 'implemented'),
  'futureproofing registry must ship FP-01 through FP-15 as implemented',
);
check(read('scripts/build-asset-weight-report.js').includes('publicTreeSha256'), 'asset report builder lacks a complete public-tree digest');
check(read('scripts/verify-asset-weights.js').includes('publicTreeSha256'), 'asset-weight gate does not verify the complete public-tree digest');
check(
  packageSelection.includes('def selected_bytes_excluding(')
    && audit49PackagingVerifier.includes('selected_bytes_excluding_generated_reports')
    && audit49PackagingVerifier.includes("audit49-technical-efficiency.json")
    && audit49PackagingVerifier.includes('WEBSITE_AUDIT49_TECHNICAL_EFFICIENCY_RESILIENCE_REPORT_2026-07-26.md')
    && audit49PackagingVerifier.includes("release-gate-report.json")
    && audit49PackagingVerifier.includes("futureproofing-gate-report.json")
    && !audit49PackagingVerifier.includes('selected_bytes_excluding_this_report'),
  'Audit 49 package-byte evidence is not independent of self-updating generated reports',
);
for (const [name, source] of [['deployer', deployer], ['source', sourcePackager]]) {
  check(source.includes('load_current_release_manifest()'), `${name} packager does not reload release metadata after build verification`);
  check(source.includes('Archive metadata does not match the packaged release manifest.'), `${name} packager does not assert packaged release metadata parity`);
}
for (const token of [
  'require_release_build_lock(DELIVERY_ROOT)',
  '[npm, "run", "build"]',
  '[npm, "run", "verify:all:built"]',
  'verify_editable_masters(EDITABLE_ROOT)',
  'package-front-facing-mephistodata-release.py',
  'verify-clean-room-release.py',
  'verify-disaster-recovery.py',
  'create-artifact-audit-receipt.py',
  'verify-artifact-audit-receipt.py',
  'copy_clean_source(DELIVERY_ROOT, source_snapshot)',
]) {
  check(completePackager.includes(token), `complete outer packager misses ${token}`);
}
const verifiedTreeIndex = completePackager.indexOf('[npm, "run", "verify:all:built"]');
const deliverySnapshotIndex = completePackager.indexOf('copy_clean_source(DELIVERY_ROOT, source_snapshot)');
const archiveWriteIndex = completePackager.indexOf('package-front-facing-mephistodata-release.py');
check(
  verifiedTreeIndex >= 0
    && deliverySnapshotIndex > verifiedTreeIndex
    && archiveWriteIndex > deliverySnapshotIndex,
  'complete outer packager must snapshot the verified delivery after full checks and before archive creation',
);
check(
  !completePackager.includes('--command-json')
    && !completePackager.includes('--pipeline-id'),
  'complete outer packager still exposes caller-defined clean-room execution',
);
for (const token of [
  'PIPELINE_ID = "npm-ci-build-full-verify-editable-package-v1"',
  'build-clean-room-release.py',
  'release_metadata(reference)',
  'materialize_and_run(',
  '--command-json is forbidden',
  'source_snapshot',
  'pipeline_helpers',
  'pipeline_steps',
  'install_pinned_python_audit_dependencies',
  'SITE_PACKAGE/scripts/audit_python_dependencies.py',
  'external_inputs',
]) {
  check(cleanRoomVerifier.includes(token), `clean-room verifier misses ${token}`);
}
for (const token of [
  'require_release_build_lock(DELIVERY_ROOT)',
  'prepare_audit_python_dependencies(',
  '[npm, "ci"]',
  '[npm, "run", "build"]',
  '[npm, "run", "verify:all:built"]',
  'verify_editable_masters(DELIVERY_ROOT / "EDITABLE_MASTERS")',
  'package-front-facing-mephistodata-release.py',
]) {
  check(cleanRoomBuilder.includes(token), `clean-room build helper misses ${token}`);
}
for (const token of [
  'pinned_audit_requirements_evidence(site_root)',
  'requirements-audit.lock',
  'installed_distribution_inventory(target)',
  'hashed_lock_evidence_from_bytes',
  '"--disable-pip-version-check"',
  '"--no-input"',
  '"--require-hashes"',
  '"--target"',
  '"-r"',
]) {
  check(auditPythonDependencies.includes(token), `pinned Python audit dependency helper misses ${token}`);
}
check(
  (predeployWorkflow.match(/cache-dependency-path: requirements-audit\.lock/g) || []).length === 2
    && (predeployWorkflow.match(/--require-hashes --requirement requirements-audit\.lock/g) || []).length === 2,
  'predeploy must install the hash-locked Python audit runtime in both jobs',
);
const completeBuildIndex = completePackager.indexOf('run([npm, "run", "build"])');
const completeVerifyIndex = completePackager.indexOf('run([npm, "run", "verify:all:built"])');
const completeEditableIndex = completePackager.lastIndexOf('\n    verify_editable_masters(EDITABLE_ROOT)');
const completeArchiveIndex = completePackager.lastIndexOf('package-front-facing-mephistodata-release.py');
const completeCleanRoomIndex = completePackager.lastIndexOf('verify-clean-room-release.py');
const completeRecoveryIndex = completePackager.lastIndexOf('verify-disaster-recovery.py');
const completeReceiptIndex = completePackager.lastIndexOf('create-artifact-audit-receipt.py');
const completeReceiptVerifyIndex = completePackager.lastIndexOf('verify-artifact-audit-receipt.py');
check(
  completeBuildIndex >= 0
    && completeBuildIndex < completeVerifyIndex
    && completeVerifyIndex < completeEditableIndex
    && completeEditableIndex < completeArchiveIndex
    && completeArchiveIndex < completeCleanRoomIndex
    && completeCleanRoomIndex < completeRecoveryIndex
    && completeRecoveryIndex < completeReceiptIndex
    && completeReceiptIndex < completeReceiptVerifyIndex,
  'complete outer packager must build, verify, archive, reproduce, restore, receipt, then verify the receipt',
);
check(
  completePackager.includes('PACKAGE_RELEASE_ID = "core-coreplus-mephistodata-bb-polymythcal-sets1-15-sitewide-fixes-synthesized-2026-08-15"')
    && completePackager.includes('OUTPUT_BASENAME = (')
    && completePackager.includes('"ss-site-polymythcal-sets1-15-sitewide-fixes-synthesized-"')
    && completePackager.includes('"complete-2026-08-15.zip"')
    && completePackager.includes('Complete release output must use the canonical name')
    && !completePackager.includes('parser.add_argument("--release-id"'),
  'complete outer packager exposes arbitrary package release identity',
);
check(
  completePackager.includes('DERIVED_GENERATED_AT = "2026-08-13T04:00:00Z"')
    && completePackager.includes('RELEASE_GENERATED_AT = "2026-08-15T18:00:00-04:00"')
    && completePackager.includes('generated_at = RELEASE_GENERATED_AT')
    && cleanRoomBuilder.includes('DERIVED_GENERATED_AT = "2026-08-13T04:00:00Z"')
    && completePackager.includes('os.environ["SITE_BUILD_DATE"] = "2026-08-15"')
    && cleanRoomBuilder.includes('os.environ["SITE_BUILD_DATE"] = "2026-08-15"'),
  'primary and clean-room package builds must share the current deterministic release day',
);
for (const token of [
  'README_FIRST.txt',
  'SeminarSchools-Deploy-FINAL7-VerifiedPush-StayOpen-NoLocalNpm-ManualRepoPicker-ManualHFSync.cmd',
  'Polymyth_Coherence_Assessment_Instrument_V5.1.2.xlsx',
  'Polymyth_Coherence_AI_Application_Protocol_V5.1.2.md',
  'Polymyth_Coherence_Assessment_Schema_V5.1.2.json',
  'Polymyth_Coherence_Worked_Applications.xlsx',
  'Polymyth_Coherence_V5.1.1.xlsx',
  'WEBSITE_FUTUREPROOFING_CONTRACTS_AUDIT_2026-08-09.md',
  'FUTUREPROOFING_RELEASE_CONTRACT_2026-08-09.md',
  'data/futureproofing/futureproofing-contract.json',
  'data/browser-test-tiers.json',
  'data/live-evidence-policy.json',
  'data/harvest-source-history.json',
  'verify-futureproofing-contract.py',
  'scripts/build_lock.py',
  'create-artifact-audit-receipt.py',
  'verify-disaster-recovery.py',
  'build-clean-room-release.py',
  'audit_python_dependencies.py',
  'requirements-audit.txt',
  'requirements-audit.lock',
  'scripts/package-front-facing-mephistodata-release.py',
  'scripts/package_integrity.py',
  'scripts/package_selection.py',
  'scripts/reports/release-gate-report.json',
  'scripts/reports/futureproofing-gate-report.json',
  'RELEASE_MANIFEST.json',
  'RELEASE_ID.txt',
  'futureproofing-fp07-fp10-targeted-tests.json',
  'futureproofing-browser-family-report.json',
  'SITE_PACKAGE/polymyth/coherence/index.html',
  'EDITABLE_MASTERS/README_FIRST.md',
]) {
  check(completeArchivePackager.includes(token), `complete archive selection contract misses ${token}`);
}
check(
  completeArchivePackager.includes('require_release_build_lock(DELIVERY_ROOT)'),
  'complete archive writer can bypass the repository-wide release lock',
);
for (const token of [
  'clean_room_report',
  'disaster_recovery_report',
  'reference_archive_sha256',
  'restored_tree_sha256',
  'validate_clean_room_contract',
  'source_snapshot_matches_archive',
  'rebuild_input_evidence_from_manifest',
  'pipeline_steps_sha256',
  'pinned_python_audit_dependencies',
  'ARCHIVE_REQUIREMENTS_PATH',
  'ARCHIVE_LOCK_PATH',
  'receipt_creation_executable_rehash',
  'exact_release_sibling',
  'exact canonical 5/5 checks',
  'external_inputs_sha256',
  'clean-room helper differs from the final archive',
]) {
  check(artifactReceipt.includes(token), `artifact receipt does not bind ${token}`);
}
check(
  packageSelection.includes('GENERATED_RELEASE_EVIDENCE')
    && packageSelection.includes('clean-room-report')
    && packageSelection.includes('disaster-recovery-report'),
  'future package runs can ingest stale external release evidence',
);
check(exists('scripts/repair-polymyth-coherence-validation-ranges.py'), 'Coherence validation-range repair is missing');
for (const token of ['require_complete_validation_ranges', 'N7:N42', 'P7:P292']) {
  check(coherenceWorkbookVerifier.includes(token), `Coherence workbook verifier misses ${token}`);
}
check(lock.version === '1.0.6' && lock.packages?.['']?.version === '1.0.6', 'package-lock version is not 1.0.6');
for (const [name, command] of Object.entries({
  'verify:all': 'node scripts/run-python.js scripts/run-with-build-lock.py -- node scripts/verify-all-runner.js',
  'verify:all:built': 'node scripts/run-python.js scripts/run-with-build-lock.py -- node scripts/verify-all-runner.js --reuse-build',
  'verify:build-idempotence': 'node scripts/verify-build-idempotence.js',
  'verify:all:serial': 'node scripts/run-python.js scripts/run-with-build-lock.py -- node scripts/verify-all-runner.js --concurrency=1',
  'verify:release': 'node scripts/run-python.js scripts/run-with-build-lock.py -- node scripts/verify-all-runner.js',
  'test:futureproofing': 'npm run test:futureproofing:core-fixtures && npm run test:futureproofing:article-body && npm run test:futureproofing:gate-defects && npm run test:futureproofing:browser-tiers && npm run test:futureproofing:live-evidence && npm run test:futureproofing:source-anomalies && npm run test:futureproofing:external-destinations && npm run test:futureproofing:route-tombstones && npm run test:futureproofing:data-migrations',
  'verify:futureproofing': 'node scripts/run-python.js scripts/run-with-build-lock.py -- node scripts/run-python.js scripts/verify-futureproofing-contract.py --run-source --report scripts/reports/futureproofing-gate-report.json',
  'verify:ml-dialectical-hardening': 'node scripts/verify-ml-dialectical-hardening.js',
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
  'verify:audit41-event-rollover': 'node scripts/verify-current-event-rollover.js',
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
  'verify:polymythcal-source-health': 'node scripts/verify-polymythcal-source-health-current.js',
  'apply:audit49-release-stamp': 'node scripts/apply-audit49-release-stamp.js',
  'apply:audit49-metadata-hygiene': 'node scripts/apply-audit49-metadata-hygiene.js',
  'verify:audit49-aa-dialog': 'node scripts/verify-audit49-aa-dialog.mjs',
  'verify:audit49-aitr-resilience': 'node scripts/verify-audit49-aitr-resilience.mjs',
  'verify:audit49-metadata-surface': 'node scripts/verify-audit49-metadata-surface.js',
  'verify:audit49-runtime-efficiency': 'node scripts/verify-audit49-runtime-efficiency.js',
  'verify:audit49-build-packaging-efficiency': 'node scripts/verify-audit49-build-packaging-efficiency.js',
  'verify:audit49-technical-efficiency': 'node scripts/verify-audit49-technical-efficiency.js',
  'verify:meaningful-geometry': 'node scripts/verify-meaningful-geometry.js',
  'verify:front-facing-boundary': 'node scripts/verify-front-facing-boundary.js',
  'update:release-asset-identity': 'node scripts/update-release-asset-identity.js',
  'verify:release-asset-identity': 'node scripts/verify-release-asset-identity.js',
  'package:complete-current': 'node scripts/run-python.js scripts/run-with-build-lock.py -- node scripts/run-python.js scripts/package-complete-current.py',
  'build:asset-report': 'node scripts/build-asset-weight-report.js',
  'verify:asset-weights': 'node scripts/verify-asset-weights.js',
  'verify:visible-geometry-browser': 'node scripts/verify-visible-geometry-browser.mjs',
  'verify:front-facing-overlap-browser': 'node scripts/verify-front-facing-overlap-browser.js',
  'verify:polymyth-coherence': 'node scripts/run-python.js scripts/verify-polymyth-coherence-workbook.py',
  'verify:polymyth-entry-points': 'node scripts/verify-polymyth-entry-points.js',
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

const buildEntrypoint = pkg.scripts?.build || '';
const build = pkg.scripts?.['build:locked'] || '';
const expectedBuildEntrypoint = 'node scripts/assert-canonical-build-delegation.js "node scripts/run-python.js scripts/build-polymythcal-audit13.py" "node scripts/build-search-pages.js" && node scripts/run-python.js scripts/run-with-build-lock.py -- npm run build:locked';
check(
  buildEntrypoint === expectedBuildEntrypoint,
  'canonical build is not routed through the repository-wide single-writer lock',
);
check(
  fs.existsSync(path.join(ROOT, 'scripts/assert-canonical-build-delegation.js')),
  'canonical build delegation assertion is missing',
);
check(
  build.startsWith('node scripts/run-python.js scripts/assert-build-lock.py && '),
  'locked build pipeline does not verify the inherited owner token before writing',
);
const identityNormalization = build.indexOf('normalize-polymythcal-manual-identities.py');
const evidenceNormalization = build.indexOf('normalize-polymythcal-evidence-model.py');
check(
  identityNormalization > build.indexOf('import-polymythcal-civic-political-legal-labour-set12-2026-08-14.py')
    && evidenceNormalization > identityNormalization
    && evidenceNormalization < build.indexOf('import-polymythcal-community-charity-mutual-aid-heritage-place-set13-2026-08-15.py')
    && (build.match(/normalize-polymythcal-manual-identities\.py/g) || []).length === 1
    && (build.match(/normalize-polymythcal-evidence-model\.py/g) || []).length === 1,
  'canonical build must normalize inherited Sets 1-12 once before protected Sets 13-15 cross-tags',
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
  'update-release-asset-identity.js',
  'update-polymythcal-build-manifest.js',
  'build-public-deploy.js',
  'verify-public-deploy-parity.js',
  'verify-release-asset-identity.js',
  'verify-front-facing-boundary.js',
  'verify-polymyth-coherence-workbook.py',
  'verify-polymyth-entry-points.js',
  'verify-visible-geometry.js',
  'verify-meaningful-geometry.js',
  'verify-geometry.js',
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
const finalGeometryApply = build.lastIndexOf('apply-visible-geometry.js');
check((build.match(/apply-visible-geometry\.js/g) || []).length === 2, 'canonical build must apply geometry before and after all page generators');
check(
  finalGeometryApply > build.lastIndexOf('apply-audit49-metadata-hygiene.js')
    && finalGeometryApply < build.indexOf('update-release-asset-identity.js'),
  'final geometry pass is not immediately downstream of page generation',
);
check((build.match(/update-release-asset-identity\.js/g) || []).length === 1, 'canonical build must update repaired-asset identity exactly once');
check((build.match(/verify-release-asset-identity\.js/g) || []).length === 1, 'canonical build must verify repaired-asset identity exactly once');
check(
  (build.match(/node scripts\/verify-polymythcal-sets13-15-browser\.js --dom-only/g) || []).length === 1
    && !build.split(' && ').includes('node scripts/verify-polymythcal-sets13-15-browser.js'),
  'canonical build must run the Sets 13-15 DOM-only contract exactly once without launching Chromium',
);
check(
  build.indexOf('update-release-asset-identity.js') > finalGeometryApply
    && build.indexOf('update-release-asset-identity.js') < build.indexOf('build-public-deploy.js')
    && build.indexOf('verify-release-asset-identity.js') > build.indexOf('verify-public-deploy-parity.js'),
  'repaired-asset identity must be updated after final geometry, published, then verified after public parity',
);
for (const gate of ['verify-geometry.js', 'verify-visible-geometry.js', 'verify-meaningful-geometry.js', 'verify-visible-geometry-browser.mjs', 'verify-front-facing-overlap-browser.js']) {
  check(runner.includes(`node scripts/${gate}`), `full release runner lacks ${gate}`);
}
for (const command of ['npm run test:futureproofing', 'npm run verify:futureproofing']) {
  const escaped = command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  check(
    (runner.match(new RegExp(escaped, 'g')) || []).length === 1,
    `full release runner must execute ${command} exactly once`,
  );
}
check(
  runner.indexOf('npm run test:futureproofing') < runner.indexOf('npm run verify:futureproofing'),
  'deliberate futureproofing failures must be tested before source contracts are accepted',
);
const finalSequentialSection = runner.slice(
  runner.indexOf('const finalSequential = ['),
  runner.indexOf('const checks = ['),
);
check(
  finalSequentialSection.includes("'node scripts/verify-audit49-build-packaging-efficiency.js'")
    && finalSequentialSection.includes("'node scripts/verify-audit49-technical-efficiency.js'")
    && finalSequentialSection.includes("'npm run test:futureproofing'")
    && finalSequentialSection.includes("'npm run verify:futureproofing'")
    && finalSequentialSection.indexOf('verify-audit49-build-packaging-efficiency.js')
      < finalSequentialSection.indexOf('verify-audit49-technical-efficiency.js')
    && finalSequentialSection.indexOf('verify-audit49-technical-efficiency.js')
      < finalSequentialSection.indexOf('npm run test:futureproofing')
    && finalSequentialSection.indexOf('npm run test:futureproofing')
      < finalSequentialSection.indexOf('npm run verify:futureproofing')
    && runner.indexOf('for (const cmd of finalSequential)') > runner.indexOf('await Promise.all'),
  'final package evidence, aggregate, and futureproofing checks must run in fixed-point order after every parallel report writer is quiescent',
);
check(
  runner.includes('function assertLiveReleaseLock()')
    && runner.includes('function writeTextAtomic(file, content)')
    && runner.includes("writeTextAtomic(reportFile, renderedReport)"),
  'release-gate evidence writer is not lock-asserting and atomic',
);
check(runner.includes('node scripts/run-python.js scripts/verify-polymyth-coherence-workbook.py'), 'full release runner lacks Coherence workbook verification');
const reusedPreparationSection = runner.slice(
  runner.indexOf('const reusedBuildPreparation = ['),
  runner.indexOf('const sequential = ['),
);
for (const command of [
  'node scripts/run-python.js scripts/verify-polymyth-coherence-workbook.py',
  'node scripts/verify-polymyth-entry-points.js',
  'node scripts/verify-front-facing-boundary.js',
  'node scripts/verify-release-asset-identity.js',
]) {
  const escaped = command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  check(
    (reusedPreparationSection.match(new RegExp(escaped, 'g')) || []).length === 1,
    `reuse-build preparation must execute ${command} exactly once`,
  );
}
check(
  (runner.match(/node scripts\/verify-ml-dialectical-hardening\.js/g) || []).length === 1,
  'full release runner must execute the no-jump semantic-authority gate exactly once',
);
const browserGeometryCommand = 'node scripts/verify-visible-geometry-browser.mjs';
const browserGeometryIndex = runner.indexOf(browserGeometryCommand);
const browserFrontFacingCommand = 'node scripts/verify-front-facing-overlap-browser.js';
const browserFrontFacingIndex = runner.indexOf(browserFrontFacingCommand);
const setsBrowserCommand = 'node scripts/verify-polymythcal-sets13-15-browser.js';
const setsBrowserIndex = runner.indexOf(setsBrowserCommand);
const teacherBrowserIndex = runner.indexOf('node scripts/verify-teacherresources-state-layout-browser.js');
const homeBrowserIndex = runner.indexOf('node scripts/verify-home-map-browser.js');
const idempotenceCommand = 'node scripts/verify-build-idempotence.js';
const idempotenceIndex = runner.indexOf(idempotenceCommand);
check(
  (runner.match(/node scripts\/verify-visible-geometry-browser\.mjs/g) || []).length === 1
    && browserGeometryIndex > runner.indexOf('const sequential = [')
    && browserGeometryIndex < runner.indexOf('const checks = ['),
  'browser geometry gate must run exactly once in the full runner sequential phase',
);
check(
  (runner.match(/node scripts\/verify-front-facing-overlap-browser\.js/g) || []).length === 1
    && browserFrontFacingIndex > runner.indexOf('const sequential = [')
    && browserFrontFacingIndex < browserGeometryIndex,
  'rendered front-facing/overlap gate must run exactly once after idempotence and before browser geometry',
);
check(
  (runner.match(/node scripts\/verify-polymythcal-sets13-15-browser\.js/g) || []).length === 1
    && !runner.includes('node scripts/verify-polymythcal-sets13-15-browser.js --dom-only')
    && setsBrowserIndex > teacherBrowserIndex
    && setsBrowserIndex > homeBrowserIndex
    && setsBrowserIndex < browserGeometryIndex,
  'full Sets 13-15 Chromium gate must run exactly once after Teacher Resources/home and before browser geometry',
);
check(
  (runner.match(/node scripts\/verify-build-idempotence\.js/g) || []).length === 1
    && idempotenceIndex > runner.indexOf('const sequential = [')
    && idempotenceIndex < browserFrontFacingIndex,
  'build idempotence must run exactly once after preparation and before browser verification',
);
check(!build.includes('verify-visible-geometry-browser.mjs'), 'browser geometry gate must remain outside the production/Netlify build');
check(!build.includes('verify-front-facing-overlap-browser.js'), 'rendered front-facing/overlap gate must remain outside the production/Netlify build');
const wrappingCommand = 'node scripts/apply-sitewide-type-zoom-link.js';
const firstWrappingIndex = build.indexOf(wrappingCommand);
const finalWrappingIndex = build.lastIndexOf(wrappingCommand);
check(
  (build.match(/node scripts\/apply-sitewide-type-zoom-link\.js/g) || []).length === 2,
  'canonical build must apply the all-page wrapping contract exactly twice',
);
check(
  firstWrappingIndex >= 0
    && firstWrappingIndex < build.indexOf('node scripts/apply-type-floor.js')
    && finalWrappingIndex > build.lastIndexOf('node scripts/apply-audit49-metadata-hygiene.js')
    && finalWrappingIndex < build.lastIndexOf('node scripts/apply-visible-geometry.js'),
  'canonical build must apply wrapping initially and again after final generators before final geometry',
);
check((build.match(/build-asset-weight-report\.js/g) || []).length === 1, 'canonical build must regenerate the complete public asset report once');
check((runner.match(/node scripts\/verify-asset-weights\.js/g) || []).length === 1, 'full runner must verify the regenerated public asset report exactly once');
check((build.match(/verify-front-facing-boundary\.js/g) || []).length === 1, 'canonical build must enforce the static front-facing boundary once after deploy parity');
check(
  build.indexOf('verify-front-facing-boundary.js') > build.indexOf('verify-public-deploy-parity.js')
    && build.indexOf('verify-front-facing-boundary.js') < build.indexOf('verify-polymyth-coherence-workbook.py'),
  'canonical build must enforce the front-facing boundary immediately after public parity and before artifact checks',
);
check(
  (runner.match(/node scripts\/verify-front-facing-boundary\.js/g) || []).length === 1
    && runner.indexOf('node scripts/verify-front-facing-boundary.js') > runner.indexOf('const reusedBuildPreparation = [')
    && runner.indexOf('node scripts/verify-front-facing-boundary.js') < runner.indexOf('const sequential = ['),
  'reuse-build runner must enforce the static front-facing boundary exactly once during preparation',
);
check(
  runner.includes('reusedBuildPreparation.filter(command => checks.includes(command))'),
  'reuse-build covered checks must be derived from the commands that actually run',
);
check((build.match(/verify-polymyth-coherence-workbook\.py/g) || []).length === 1, 'canonical build must verify the Coherence workbook once after deploy parity');
check((build.match(/verify-polymyth-entry-points\.js/g) || []).length === 1, 'canonical build must verify Coherence entry points once after deploy parity');
check(!build.includes('build-audit43-continuity-inventory.js'), 'canonical build mutates frozen Audit 43 inventory');

for (const token of [
  'npm run build',
  'verify-public-deploy-parity.js',
  'verify-release-asset-identity.js',
  'verify-polymyth-coherence-workbook.py',
  'verify-front-facing-overlap-browser.js',
  'verify-frozen-audit43.js',
  'verify-audit45-translations.py',
  'verify-audit45-browser-evidence.js',
  'verify-release-gates.js',
  'verify-harvest-pipeline.js',
  'verify-live-content-integrity.js',
  'verify-teacherresources-finder.js',
  'verify-runtime-delivery-resilience.js',
  'verify-current-event-rollover.js',
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
  'scripts/lib/release-asset-identity.js',
  'scripts/update-release-asset-identity.js',
  'scripts/verify-release-asset-identity.js',
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
  'scripts/verify-polymythcal-source-health-current.js',
  'scripts/reports/audit48-live-harvest-endpoints.json',
  'scripts/verify-audit48-external-validation.js',
  'scripts/reports/audit48-external-validation.json',
];
for (const relative of audit48Required) {
  check(exists(relative), `current Audit 48 artifact is missing: ${relative}`);
  check(deployer.includes(relative), `deployer package does not require ${relative}`);
  check(sourcePackager.includes(relative), `source package does not require ${relative}`);
}
check(
  runner.includes('node scripts/verify-polymythcal-source-health-current.js'),
  'full release runner lacks the current Polymythcal source-health gate',
);
const audit48LiveVerifier = read('scripts/verify_audit48_live_harvest.py');
for (const token of [
  'configuration_drift: list[str]',
  'if configuration_drift and args.require_current',
  'AUDIT48 HISTORICAL LIVE HARVEST EVIDENCE PASSED',
  'run the live audit before claiming current endpoint evidence',
]) {
  check(
    audit48LiveVerifier.includes(token),
    `Audit 48 live-evidence historical/current boundary lost ${token}`,
  );
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
