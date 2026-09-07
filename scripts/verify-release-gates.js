#!/usr/bin/env node
'use strict';

/** The September 5 degorgonified-feminism retrieval gate is current; earlier evidence remains immutable. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const {
  PUBLIC_RELEASE_ASSET_PATHS,
  RELEASE_ASSET_PATHS,
} = require('./lib/release-asset-identity');

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
function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}
function canonicalObjectSha(value) {
  return sha256(JSON.stringify(value));
}
function fileSha(relative) {
  try {
    return sha256(fs.readFileSync(path.join(ROOT, relative)));
  } catch {
    return '';
  }
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
const publicBuildLock = read('scripts/lib/public-build-lock.js');
const publicBuildLockVerifier = read('scripts/verify-public-build-lock-recovery.js');
const completeArchiveClassVerifier = read('scripts/verify-complete-archive-classes.py');
const releaseAssetIdentityHelper = read('scripts/lib/release-asset-identity.js');
const releaseAssetIdentityUpdater = read('scripts/update-release-asset-identity.js');
const releaseAssetIdentityVerifier = read('scripts/verify-release-asset-identity.js');
const geometryFinalizer = read('scripts/apply-visible-geometry.js');
const steadyUiVerifier = read('scripts/verify-steady-ui.js');
const expectedReleaseAssetPaths = Object.freeze([
  'css/alive.css',
  'css/calm-ux.css',
  'css/site-wide-type-zoom.css',
  'js/mandala.js',
  'js/indra.js',
  'data/geometry-route-contracts.json',
  'index.html',
  'teacherresources/finder.css',
  'teacherresources/finder.js',
  'teacherresources/index.html',
  'data/polymyth-seminar-events.json',
  'data/polymythcal-event-schema-v2.json',
  'data/polymythcal-publication-surfaces.json',
  'css/polymythcal-discovery.css',
  'js/polymythcal-discovery-core.js',
  'js/polymythcal-discovery.js',
  'js/polymythcal-revamp.js',
  'polymythseminars/browse.json',
  'polymythseminars/watchlist.json',
  'polymythseminars/research.json',
  'polymythseminars/index.html',
  'polymythseminars/fr/index.html',
  'polymythseminars/research/index.html',
  'polymythseminars/fr/research/index.html',
  'polymythseminars/monitoring/index.html',
  'polymythseminars/fr/monitoring/index.html',
]);
const privateReleaseAssets = new Set([
  'data/polymyth-seminar-events.json',
  'data/polymythcal-event-schema-v2.json',
  'data/polymythcal-publication-surfaces.json',
  'data/geometry-route-contracts.json',
  'js/polymythcal-revamp.js',
]);
const destinationContractAssets = [
  'data/external-destination-contracts.json',
  'data/polymythcal-destination-overrides.json',
  'scripts/lib/external-destination-contracts.js',
  'scripts/apply-polymythcal-destination-specificity.js',
  'scripts/update-polymythcal-destination-contract.js',
  'scripts/test-external-destination-contracts.js',
  'scripts/verify-external-destination-contracts.js',
  'scripts/verify-polymythcal-destination-specificity.js',
  'scripts/verify-polymythcal-destination-browser.js',
  'scripts/fixtures/futureproofing/external-destinations/invalid-destinations.json',
];
const currentRequiredDeliveryPaths = Object.freeze([
  'UPDATE_SOURCES/ML_STAR_UPDATE_SOURCE_DEGORGONIFIED_FEMINISM_RETRIEVAL_ENFORCEMENT_2026-09-05.md',
  'SITE_PACKAGE/UPDATE_SOURCES/ML_STAR_UPDATE_SOURCE_DEGORGONIFIED_FEMINISM_RETRIEVAL_ENFORCEMENT_2026-09-05.md',
  'UPDATE_SOURCES/ML_STAR_UPDATE_SOURCE_FEMINISM_ACADEMIC_RESEARCH_GORGONIFICATION_2026-09-05.md',
  'SITE_PACKAGE/UPDATE_SOURCES/ML_STAR_UPDATE_SOURCE_FEMINISM_ACADEMIC_RESEARCH_GORGONIFICATION_2026-09-05.md',
  'UPDATE_SOURCES/ML_STAR_UPDATE_SOURCE_TRUTHFUL_WORK_CLAIMS_2026-09-05.md',
  'SITE_PACKAGE/UPDATE_SOURCES/ML_STAR_UPDATE_SOURCE_TRUTHFUL_WORK_CLAIMS_2026-09-05.md',
  'SITE_PACKAGE/UPDATE_SOURCES/TRUTHFUL_WORK_CLAIM_SCREENSHOTS_2026-09-05/b4f6ab5a-4eb3-44d0-943e-41acd52faec9.png',
  'SITE_PACKAGE/UPDATE_SOURCES/TRUTHFUL_WORK_CLAIM_SCREENSHOTS_2026-09-05/3066e1d8-f6f9-4267-a948-90c076e29f93.png',
  'SITE_PACKAGE/UPDATE_SOURCES/MEPHISTODATA_REGISTER_ACTIVATION_SCREENSHOTS_2026-08-30/04648eb9-885c-43c7-ad53-ca6af390fa0c.png',
  'SITE_PACKAGE/UPDATE_SOURCES/MEPHISTODATA_REGISTER_ACTIVATION_SCREENSHOTS_2026-08-30/13912ef0-3924-4d11-bae9-6bab8d294b93.png',
  'SITE_PACKAGE/UPDATE_SOURCES/MEPHISTODATA_REGISTER_ACTIVATION_SCREENSHOTS_2026-08-30/0fd75220-92bf-4df1-89e9-a90893430fdc.png',
  'SITE_PACKAGE/UPDATE_SOURCES/MEPHISTODATA_REGISTER_ACTIVATION_SCREENSHOTS_2026-08-30/a9c4d9d2-16e6-4995-9064-4db5bc5d484e.png',
  'SITE_PACKAGE/UPDATE_SOURCES/MEPHISTODATA_REGISTER_ACTIVATION_SCREENSHOTS_2026-08-30/097d5008-8e7c-4b24-822f-88a04fd1e7e7.png',
  'SITE_PACKAGE/UPDATE_SOURCES/MEPHISTODATA_REGISTER_ACTIVATION_SCREENSHOTS_2026-08-30/d1557ac1-79e1-4038-8521-edba929b8e29.png',
  'SITE_PACKAGE/UPDATE_SOURCES/MEPHISTODATA_REGISTER_ACTIVATION_SCREENSHOTS_2026-08-30/ca5c05c1-5e8f-4997-9409-0a83f3bbf302.png',
  'SITE_PACKAGE/UPDATE_SOURCES/MEPHISTODATA_REGISTER_ACTIVATION_SCREENSHOTS_2026-08-30/b2726035-3129-4117-99ad-76d4ae8c12de.png',
  'SITE_PACKAGE/scripts/lib/mephistodata-runtime-gate.js',
  'SITE_PACKAGE/scripts/fixtures/ml-execution-gates/mephistodata-runtime-gate-hostile-fixtures.json',
  'SITE_PACKAGE/scripts/verify-mephistodata-runtime-gate.js',
  'SITE_PACKAGE/scripts/verify-ml-active-form-conflicts.js',
  'SITE_PACKAGE/ML_EXECUTION_AND_CONTROLLED_ARCHIVE_SYNTHESIS_2026-08-26.md',
  'SITE_PACKAGE/polymyth/methodologylist/mephistodata-rule-hardening-addendum.js',
  'SITE_PACKAGE/public/polymyth/methodologylist/mephistodata-rule-hardening-addendum.js',
  'SITE_PACKAGE/data/baseline-morality-amendment-scope-contract.json',
  'SITE_PACKAGE/scripts/verify-baseline-morality-amendment-scope.js',
  'SITE_PACKAGE/scripts/test-baseline-morality-amendment-scope.js',
  'SITE_PACKAGE/scripts/build-public-deploy.js',
  'SITE_PACKAGE/scripts/verify-public-deploy-parity.js',
  'SITE_PACKAGE/data/futureproofing/public-private-boundary.json',
  'SITE_PACKAGE/scripts/verify-public-private-boundary.py',
  'SITE_PACKAGE/data/futureproofing/aug30-package-contents-baseline.json',
  'SITE_PACKAGE/data/futureproofing/aug30-aug31-preservation-contract.json',
  'SITE_PACKAGE/data/futureproofing/aug31-package-contents-baseline.json',
  'SITE_PACKAGE/data/futureproofing/aug31-sep3-preservation-contract.json',
  'SITE_PACKAGE/data/futureproofing/sep3-package-contents-baseline.json',
  'SITE_PACKAGE/data/futureproofing/sep3-sep5-preservation-contract.json',
  'SITE_PACKAGE/data/futureproofing/sep5-package-contents-baseline.json',
  'SITE_PACKAGE/data/futureproofing/sep5-truthful-sep5-feminism-preservation-contract.json',
  'SITE_PACKAGE/data/futureproofing/sep5-feminism-package-contents-baseline.json',
  'SITE_PACKAGE/data/futureproofing/sep5-feminism-sep5-degorgonified-feminism-preservation-contract.json',
  'SITE_PACKAGE/scripts/verify-futureproofing-contract.py',
  'SITE_PACKAGE/scripts/verify-futureproofing-base-preservation.py',
  'SITE_PACKAGE/scripts/verify-aug31-base-preservation.py',
  'SITE_PACKAGE/scripts/verify-sep3-base-preservation.py',
  'SITE_PACKAGE/scripts/verify-sep5-base-preservation.py',
  'SITE_PACKAGE/scripts/verify-sep5-feminism-base-preservation.py',
  'SITE_PACKAGE/scripts/verify-sep5-degorgonified-feminism-base-preservation.py',
  'SITE_PACKAGE/scripts/fixtures/futureproofing/aug31-preservation-tampered.json',
  'SITE_PACKAGE/scripts/fixtures/futureproofing/sep3-preservation-tampered.json',
  'SITE_PACKAGE/scripts/fixtures/futureproofing/sep5-preservation-tampered.json',
  'SITE_PACKAGE/scripts/fixtures/futureproofing/sep5-feminism-preservation-tampered.json',
  'SITE_PACKAGE/scripts/fixtures/futureproofing/sep5-degorgonified-feminism-preservation-tampered.json',
  'SITE_PACKAGE/scripts/test_futureproofing_contracts.py',
  'SITE_PACKAGE/scripts/package-complete-current.py',
  'SITE_PACKAGE/scripts/package-front-facing-mephistodata-release.py',
  'SITE_PACKAGE/scripts/artifact_receipt.py',
  'SITE_PACKAGE/scripts/verify-release-gates.js',
]);
let pkg = {};
let manifest = {};
let lock = {};
let futureproof = {};
let sep5DegorgonifiedFeminismPreservation = {};
try {
  pkg = JSON.parse(read('package.json'));
  manifest = JSON.parse(read('RELEASE_MANIFEST.json'));
  lock = JSON.parse(read('package-lock.json'));
  futureproof = JSON.parse(futureproofContract);
  sep5DegorgonifiedFeminismPreservation = JSON.parse(
    read('data/futureproofing/sep5-feminism-sep5-degorgonified-feminism-preservation-contract.json'),
  );
} catch (error) {
  failures.push(`release JSON is invalid: ${error.message}`);
}

const expectedRelease = '2026-08-15-polymythcal-sets1-15-sitewide-fixes-synthesized-final';
check(manifest.release_id === expectedRelease, `current release is ${manifest.release_id}`);
check(manifest.generated_at === '2026-08-15T18:00:00-04:00', `current release timestamp is ${manifest.generated_at}`);
const currentMlStar = manifest.ml_star_update || {};
check(
  currentMlStar.release_id === '2026-08-26-mephistodata-execution-controlled-archive-synthesis'
    && currentMlStar.amended_at === '2026-09-05'
    && currentMlStar.amendment === 'degorgonified-feminism-retrieval-enforcement'
    && currentMlStar.amendment_release_id === 'core-coreplus-mephistodata-degorgonified-feminism-retrieval-enforcement-complete-2026-09-05'
    && currentMlStar.amendment_generated_at === '2026-09-05T20:15:00Z'
    && JSON.stringify(currentMlStar.prior_amendments) === JSON.stringify([
      'internal-material-retrieval-boundary',
      'writing-composition-and-lexical-repetition-hardening',
      'non-strawman-current-position-correction',
      'nonstrawman-writing-and-article-synthesis',
      'deliverable-accounting-anti-waste',
      'mephistodata-activation-register-hardening',
      'mephistodata-activation-enforcement',
      'bottom-up-definition-defect-provenance-internal-retrieval',
      'truthful-work-claims-and-false-completion-correction',
      'feminism-academic-research-gorgonification-gate',
    ])
    && currentMlStar.source_sha256 === '2dde9179d4c4d3f42aef76523fa909310b0f88db27fa879a8730ad6aefa015bb'
    && currentMlStar.canonical_entries === 1226
    && currentMlStar.corehistory_entries === 30
    && currentMlStar.register_recovery_source === 'UPDATE_SOURCES/MEPHISTODATA_REGISTER_ACTIVATION_RECOVERY_2026-08-30.md'
    && currentMlStar.register_recovery_source_sha256 === '663970ac0b0a08ae775039e9e6bfa9cbdfa18905cd72c9098d4f35a38b64e1a2'
    && currentMlStar.current_map === 'coreplus-current-map-amendment-2026-08-26'
    && currentMlStar.execution_owner === 'coreplus-handler-mephistodata-execution-gates-2026-08-26'
    && currentMlStar.writing_owner === 'coreplus-handler-writing-composition-delivery-2026-08-29'
    && currentMlStar.controlled_archive_owner === 'method-controlled-archive-evidence-institutional-metrics-2026-08-26'
    && currentMlStar.deliverable_accounting_source_sha256 === '405065c7c0549743f2bef012243030a7480b6cbd3f6f2d87aba3fc2128a30730'
    && currentMlStar.bottom_up_definition_source === 'UPDATE_SOURCES/ML_STAR_UPDATE_SOURCE_BOTTOM_UP_DEFINITION_DEFECT_PROVENANCE_INTERNAL_RETRIEVAL_2026-09-03.md'
    && currentMlStar.bottom_up_definition_source_sha256 === '9a67797e48eb6344d935be467c4162c20b0a4be469107114359a911e26dba50a'
    && currentMlStar.truthful_work_claim_source === 'UPDATE_SOURCES/ML_STAR_UPDATE_SOURCE_TRUTHFUL_WORK_CLAIMS_2026-09-05.md'
    && currentMlStar.truthful_work_claim_source_sha256 === 'e6a31b2fb8fd258b01b825acb790eb62019b07a3c2831e0780507bf2863f4240'
    && currentMlStar.feminism_academic_research_source
      === 'UPDATE_SOURCES/ML_STAR_UPDATE_SOURCE_FEMINISM_ACADEMIC_RESEARCH_GORGONIFICATION_2026-09-05.md'
    && currentMlStar.feminism_academic_research_source_sha256
      === 'cf53a2a361d42763be44afe6d7094ef2efb79330b841dc5869b1e06c5153074d'
    && currentMlStar.degorgonified_feminism_source
      === 'UPDATE_SOURCES/ML_STAR_UPDATE_SOURCE_DEGORGONIFIED_FEMINISM_RETRIEVAL_ENFORCEMENT_2026-09-05.md'
    && currentMlStar.degorgonified_feminism_source_sha256
      === '2a1c6999efaf472f70d12aedeabf5eaccab130ce2c5b123fa4553921373746a8'
    && JSON.stringify(currentMlStar.later_amendments) === JSON.stringify([
      'paginated-document-continuity',
    ])
    && currentMlStar.document_continuity_source
      === 'UPDATE_SOURCES/ML_STAR_UPDATE_SOURCE_DOCUMENT_CONTINUITY_2026-09-06.md'
    && currentMlStar.document_continuity_source_sha256
      === '5d6f0ddc0a895f99d847497896c9b7ef6d4769a430e0912d3014303a39aa5a87'
    && currentMlStar.document_continuity_owner
      === 'coreplus-handler-paginated-document-continuity-2026-09-06'
    && JSON.stringify(currentMlStar.document_continuity_behavioral_fixtures)
      === JSON.stringify({positive:4,negative:13,total:17})
    && currentMlStar.truthful_work_claim_screenshots
    && currentMlStar.truthful_work_claim_screenshots['UPDATE_SOURCES/TRUTHFUL_WORK_CLAIM_SCREENSHOTS_2026-09-05/b4f6ab5a-4eb3-44d0-943e-41acd52faec9.png'] === 'eb1d871ec1a9c8d65605c2276c00acfd09570269b55e309e72d5848ab07edb8c'
    && currentMlStar.truthful_work_claim_screenshots['UPDATE_SOURCES/TRUTHFUL_WORK_CLAIM_SCREENSHOTS_2026-09-05/3066e1d8-f6f9-4267-a948-90c076e29f93.png'] === 'f5de65fff250497561cabf2d0ee504660fc6f8f4f8ecf86f5fa33fc1637b2632'
    && Object.keys(currentMlStar.truthful_work_claim_screenshots).length === 2
    && JSON.stringify(currentMlStar.behavioral_fixtures) === JSON.stringify({positive:52,negative:87,total:139})
    && JSON.stringify(currentMlStar.project_adjudication_behavioral_fixtures) === JSON.stringify({
      positive:71,negative:144,total:215,adjudication_v2_total:151,inherited_base_total:64,
    })
    && JSON.stringify(currentMlStar.register_behavioral_fixtures) === JSON.stringify({
      positive:7,negative:26,total:33,source_binding:6,register_fusion:16,ouroboros_trace:11,hostile_mutations:17,
    })
    && JSON.stringify(currentMlStar.runtime_gate_behavioral_fixtures) === JSON.stringify({positive:37,negative:104,total:141})
    && JSON.stringify(currentMlStar.active_form_conflict_fixtures) === JSON.stringify({total:38})
    && JSON.stringify(currentMlStar.runtime_gate_host_boundary) === JSON.stringify({
      factory:'createRuntimeGate',
      trust_configuration_scope:'host-bootstrap-only',
      pre_generation_call:'planRequest',
      pre_delivery_call:'configuredGate.assertDeliverable',
      draft_scan_verifier_field:'verifyDraftWorkStatusAttestation',
      draft_scan_verifier_id_field:'draftVerifierId',
      full_draft_scan_required_for_every_delivery:true,
      draft_scan_binds_plan_draft_evidence_and_occurrence_claim_ir:true,
      local_parser_is_natural_language_completeness_boundary:false,
      work_verifier_field:'verifyWorkAttestation',
      correction_verifier_field:'verifyCorrectionAttestation',
      work_verifier_id_field:'workVerifierId',
      correction_verifier_id_field:'correctionVerifierId',
      per_delivery_trust_root_injection_allowed:false,
      default_export_has_trusted_verifier:false,
      self_reported_receipts_are_trusted:false,
      caller_selected_trust_labels_are_trusted:false,
      verifier_ids_are_cryptographically_authenticated:false,
      host_controls_bootstrap_required:true,
      host_must_invoke_gate:true,
      file_presence_alone_is_host_enforcement:false,
    })
    && JSON.stringify(currentMlStar.baseline_morality_amendment_scope) === JSON.stringify({
      inherited_records:11,authorization:'sha256-bound-direct-user-authorization',
    })
    && JSON.stringify(currentMlStar.public_private_repair) === JSON.stringify({
      forbidden_public_research_paths_removed:4,private_source_and_editable_copies_retained:true,
    })
    && JSON.stringify(currentMlStar.source_baseline_archive) === JSON.stringify({
      name:'seminar-schools-mephistodata-articles-synthesized-complete-2026-08-29.zip',
      release_id:'core-coreplus-mephistodata-articles-synthesized-complete-2026-08-29',
      sha256:'0a89e165473e26b365a2f12551997667c0fefaefb1c3f63c99a13e6fed381cbe',
      bytes:243941412,zip_members:21167,
    })
    && JSON.stringify(currentMlStar.prior_package_archive) === JSON.stringify({
      name:'seminar-schools-mephistodata-feminism-academic-research-gate-complete-2026-09-05.zip',
      release_id:'core-coreplus-mephistodata-feminism-academic-research-gate-complete-2026-09-05',
      sha256:'30554bc3ecdc417c0543f6fc181889bdf8d00d40ba6b8c67e091555751fcb285',
      bytes:248013232,zip_members:21210,
    })
    && JSON.stringify(currentMlStar.portable_core) === JSON.stringify({
      id:'core-personal-rules-current-2026-08-12',utf16_units:5000,
      sha256:'f34b4de5dbef3526b1ae54dc31941325322e85c3d720efd50e092e6687360bc0',
    })
    && currentMlStar.deployment === 'No deployment performed.',
  'current ML* synthesis identity, owners, counts, or fixture evidence drifted',
);
const priorSep5MlStar = manifest.ml_star_update_prior_2026_09_05 || {};
const priorSep5MlStarSha256 = '747537a73dd3ea04d5dd28954767187e012be5f6a764b69ffb0ec042da7b43b2';
check(
  canonicalObjectSha(priorSep5MlStar) === priorSep5MlStarSha256,
  'immutable September 5 feminism-research ML* update provenance drifted',
);
const priorMlStar = manifest.ml_star_update_prior_2026_08_30 || {};
check(
  canonicalObjectSha(priorMlStar) === '05fbbbcc411aba795c7e71153dbc3a8c5d1eb90f9fc8f07c75bb9658de9225f8',
  'immutable Aug30 ML* update provenance drifted',
);
check(
  canonicalObjectSha(manifest.non_strawman_current_position_update || {})
    === 'd1ac3e250228688fc614ab560f76ceb99af5756fbce25170c42bc95d88001ba2'
    && canonicalObjectSha(manifest.mephistodata_articles_synthesis || {})
      === 'af5dbf22d720e088b602f0337fa0ea12c213a7189b72d8e885e4a74d94646944',
  'immutable Aug29 non-strawman or article-synthesis provenance drifted',
);
const currentArtifactHashes = currentMlStar.artifact_sha256 || {};
const requiredSep5ArtifactPaths = Object.freeze([
  'ML_EXECUTION_AND_CONTROLLED_ARCHIVE_SYNTHESIS_2026-08-26.md',
  'UPDATE_SOURCES/ML_STAR_UPDATE_SOURCE_DEGORGONIFIED_FEMINISM_RETRIEVAL_ENFORCEMENT_2026-09-05.md',
  'UPDATE_SOURCES/ML_STAR_UPDATE_SOURCE_FEMINISM_ACADEMIC_RESEARCH_GORGONIFICATION_2026-09-05.md',
  'UPDATE_SOURCES/ML_STAR_UPDATE_SOURCE_TRUTHFUL_WORK_CLAIMS_2026-09-05.md',
  'UPDATE_SOURCES/ML_STAR_UPDATE_SOURCE_DOCUMENT_CONTINUITY_2026-09-06.md',
  'polymyth/methodologylist/index.html',
  'polymyth/methodologylist/mephistodata-register-fixtures.json',
  'polymyth/methodologylist/mephistodata-rule-hardening-addendum.js',
  'scripts/build-ai-access-pack.js',
  'scripts/lib/mephistodata-runtime-gate.js',
  'scripts/fixtures/ml-execution-gates/fixtures.json',
  'scripts/fixtures/ml-execution-gates/mephistodata-runtime-gate-hostile-fixtures.json',
  'scripts/verify-ai-access-pack.js',
  'scripts/verify-mephistodata-runtime-gate.js',
  'scripts/fixtures/ml-execution-gates/internal-writing-fixtures.json',
  'scripts/verify-ml-execution-gates.js',
  'scripts/fixtures/ml-document-continuity/fixtures.json',
  'scripts/verify-ml-document-continuity.js',
  'data/futureproofing/sep3-package-contents-baseline.json',
  'data/futureproofing/sep3-sep5-preservation-contract.json',
  'data/futureproofing/sep5-package-contents-baseline.json',
  'data/futureproofing/sep5-truthful-sep5-feminism-preservation-contract.json',
  'data/futureproofing/sep5-feminism-package-contents-baseline.json',
  'data/futureproofing/sep5-feminism-sep5-degorgonified-feminism-preservation-contract.json',
  'data/futureproofing/futureproofing-contract.json',
  'scripts/verify-sep5-base-preservation.py',
  'scripts/verify-sep5-feminism-base-preservation.py',
  'scripts/verify-sep5-degorgonified-feminism-base-preservation.py',
  'scripts/fixtures/futureproofing/sep5-preservation-tampered.json',
  'scripts/fixtures/futureproofing/sep5-feminism-preservation-tampered.json',
  'scripts/fixtures/futureproofing/sep5-degorgonified-feminism-preservation-tampered.json',
  'scripts/test_futureproofing_contracts.py',
  'scripts/package-front-facing-mephistodata-release.py',
  'scripts/package-complete-current.py',
  'scripts/artifact_receipt.py',
  'scripts/verify-complete-archive-classes.py',
  'scripts/build-clean-room-release.py',
  'scripts/verify-release-gates.js',
]);
check(
  Object.keys(currentArtifactHashes).length >= 84
    && Object.entries(currentArtifactHashes).every(([relative, expected]) => (
      /^[0-9a-f]{64}$/.test(expected) && fileSha(relative) === expected
    ))
    && requiredSep5ArtifactPaths.every(relative => (
      currentArtifactHashes[relative] === fileSha(relative)
    )),
  'current ML* artifacts through the September 6 document-continuity amendment are not exactly hash-bound',
);
const documentContinuityUpdate = manifest.document_continuity_update || {};
check(
  documentContinuityUpdate.schema === 'seminar-schools-ml-document-continuity-update-v1'
    && documentContinuityUpdate.updated_on === '2026-09-06'
    && documentContinuityUpdate.release_id
      === 'core-coreplus-mephistodata-document-continuity-complete-2026-09-06'
    && documentContinuityUpdate.source
      === 'UPDATE_SOURCES/ML_STAR_UPDATE_SOURCE_DOCUMENT_CONTINUITY_2026-09-06.md'
    && documentContinuityUpdate.source_sha256
      === '5d6f0ddc0a895f99d847497896c9b7ef6d4769a430e0912d3014303a39aa5a87'
    && documentContinuityUpdate.owner
      === 'coreplus-handler-paginated-document-continuity-2026-09-06'
    && documentContinuityUpdate.canonical_entries === 1226
    && JSON.stringify(documentContinuityUpdate.behavioral_fixtures)
      === JSON.stringify({positive:4,negative:13,total:17})
    && documentContinuityUpdate.example_audit
      === 'EDITABLE_MASTERS/08_IELTS_RUBRIC/DESIGN_CONTINUITY_AUDIT_2026-09-06.md'
    && documentContinuityUpdate.deployment === 'No deployment performed.',
  'September 6 document-continuity release record is missing or stale',
);
const assistantTwistingAlwaysAlreadyUpdate = manifest.assistant_twisting_alwaysalready_update || {};
const assistantTwistingAlwaysAlreadyArtifacts = assistantTwistingAlwaysAlreadyUpdate.artifact_sha256 || {};
check(
  assistantTwistingAlwaysAlreadyUpdate.schema
      === 'seminar-schools-ml-assistant-twisting-alwaysalready-update-v1'
    && assistantTwistingAlwaysAlreadyUpdate.updated_on === '2026-09-06'
    && assistantTwistingAlwaysAlreadyUpdate.release_id
      === 'seminar-schools-alwaysalready-ml-complete-2026-09-06'
    && assistantTwistingAlwaysAlreadyUpdate.predecessor_sha256
      === 'af450e9bb65977514d9d8a04865fdc3d0035414900a0b947876eb58456eb2019'
    && assistantTwistingAlwaysAlreadyUpdate.canonical_entries === 1233
    && assistantTwistingAlwaysAlreadyUpdate.new_records === 7
    && assistantTwistingAlwaysAlreadyUpdate.medusa_correction_status
      === 'ACKNOWLEDGED ERROR; AFFECTED-OUTPUT VERIFICATION PENDING'
    && JSON.stringify(assistantTwistingAlwaysAlreadyUpdate.alwaysalready_counts)
      === JSON.stringify({screenshots:6,public_contexts:5,sightings:6,observed:5,candidate:1})
    && Array.isArray(assistantTwistingAlwaysAlreadyUpdate.preserved_record_identifiers)
    && assistantTwistingAlwaysAlreadyUpdate.preserved_record_identifiers.includes(
      'ml:methodology:anti-twisting-worked-example-psychologism-and-gorgonwars-session:9d1aaf3836d8',
    )
    && assistantTwistingAlwaysAlreadyUpdate.preserved_record_identifiers.includes(
      'ml:gorgonification:platformstrawmanculture:b1e10aeffc03',
    )
    && Object.keys(assistantTwistingAlwaysAlreadyArtifacts).length >= 14
    && Object.entries(assistantTwistingAlwaysAlreadyArtifacts).every(([relative, expected]) => (
      /^[0-9a-f]{64}$/.test(expected) && fileSha(relative) === expected
    )),
  'September 6 assistant-twisting / Always Already release record is missing or stale',
);
check(
  sep5DegorgonifiedFeminismPreservation.schema
      === 'seminar-schools-sep5-degorgonified-feminism-preservation-v1'
    && sep5DegorgonifiedFeminismPreservation.contract_version === '2026-09-05.3'
    && sep5DegorgonifiedFeminismPreservation.status === 'sealed'
    && sep5DegorgonifiedFeminismPreservation.transition_id
      === 'sep5-feminism-to-sep5-degorgonified-feminism-retrieval-enforcement'
    && sep5DegorgonifiedFeminismPreservation.predecessor_release_id
      === 'core-coreplus-mephistodata-feminism-academic-research-gate-complete-2026-09-05'
    && sep5DegorgonifiedFeminismPreservation.expected_transition
    && sep5DegorgonifiedFeminismPreservation.expected_transition.outer_delivery
    && Array.isArray(sep5DegorgonifiedFeminismPreservation.expected_transition.outer_delivery.deleted)
    && sep5DegorgonifiedFeminismPreservation.expected_transition.outer_delivery.deleted.length === 0,
  'September 5 degorgonified-feminism preservation contract is absent, malformed, or unsealed',
);
const archiveStateGateIndex = completeArchivePackager.lastIndexOf(
  '\n    verify_current_release_state()\n',
);
const archiveSelectionIndex = completeArchivePackager.indexOf(
  'core_bytes, core_sha256 = require_portable_core_equality()',
);
check(
  completeArchivePackager.includes('def verify_current_release_state()')
    && completeArchivePackager.includes('verify-sep5-degorgonified-feminism-base-preservation.py')
    && completeArchivePackager.includes('verify-release-gates.js')
    && completeArchivePackager.includes('subprocess.run(command, cwd=SITE_ROOT, check=False)')
    && archiveStateGateIndex >= 0
    && archiveSelectionIndex > archiveStateGateIndex,
  'complete archive preflight and writer do not fail closed through current preservation and release gates',
);
check(
  completeArchivePackager.includes(
    'EXPECTED_PACKAGE_RELEASE_ID = (\n    "core-coreplus-mephistodata-degorgonified-feminism-retrieval-enforcement-complete-2026-09-05"',
  )
    && completeArchivePackager.includes(
      'EXPECTED_PACKAGE_GENERATED_AT = "2026-09-05T20:15:00Z"',
    )
    && completeArchivePackager.includes('if release != {')
    && completeArchivePackager.includes('"release_id": EXPECTED_PACKAGE_RELEASE_ID')
    && completeArchivePackager.includes('"generated_at": EXPECTED_PACKAGE_GENERATED_AT'),
  'complete archive preflight and writer accept caller-selected release identity',
);
check(
  currentMlStar.prior_provenance_sha256
    && currentMlStar.prior_provenance_sha256.ml_star_update_prior_2026_09_05
      === priorSep5MlStarSha256
    && currentMlStar.prior_provenance_sha256.ml_star_update_prior_2026_09_05
      === canonicalObjectSha(priorSep5MlStar)
    && currentMlStar.prior_provenance_sha256.ml_star_update_prior_2026_08_30
      === canonicalObjectSha(priorMlStar)
    && currentMlStar.prior_provenance_sha256.non_strawman_current_position_update
      === canonicalObjectSha(manifest.non_strawman_current_position_update || {})
    && currentMlStar.prior_provenance_sha256.mephistodata_articles_synthesis
      === canonicalObjectSha(manifest.mephistodata_articles_synthesis || {}),
  'current release does not bind all immutable September 5/Aug30/Aug29 provenance objects',
);
for (const token of [
  'core-coreplus-mephistodata-degorgonified-feminism-retrieval-enforcement-complete-2026-09-05',
  'seminar-schools-mephistodata-degorgonified-feminism-retrieval-enforcement-complete-2026-09-05.zip',
  '2026-09-05T20:15:00Z',
  'SITE_BUILD_DATE"] = "2026-09-05"',
  'regen-methodologylist-manifest.js", "2026-09-05"',
  'run-browser-test-tier.mjs',
  'futureproofing-browser-family-report.json',
  'verify-complete-archive-classes.py',
]) check(completePackager.includes(token), `complete September 5 packager misses ${token}`);
for (const token of [
  'SITE_BUILD_DATE"] = "2026-09-05"',
  'regen-methodologylist-manifest.js", "2026-09-05"',
  'DERIVED_GENERATED_AT = "2026-09-05T20:15:00Z"',
  'run-browser-test-tier.mjs',
  'futureproofing-browser-family-report.json',
]) check(cleanRoomBuilder.includes(token), `clean-room September 5 builder misses ${token}`);
for (const relative of [
  'SITE_PACKAGE/UPDATE_SOURCES/MEPHISTODATA_REGISTER_ACTIVATION_RECOVERY_2026-08-30.md',
  'SITE_PACKAGE/polymyth/methodologylist/mephistodata-register-fixtures.json',
  'SITE_PACKAGE/scripts/lib/public-build-lock.js',
  'SITE_PACKAGE/scripts/verify-public-build-lock-recovery.js',
  'SITE_PACKAGE/scripts/verify-complete-archive-classes.py',
  ...currentRequiredDeliveryPaths,
]) {
  check(completeArchivePackager.includes(relative), `complete handoff selector misses ${relative}`);
  check(artifactReceipt.includes(relative), `artifact receipt misses ${relative}`);
}
for (const token of [
  'seminar-schools-public-build-lock-v2',
  'seminar-schools-public-build-stage-v1',
  'const CLAIM_DIRECTORY_PREFIX',
  '_prepareClaim()',
  '_installPreparedClaim(prepared)',
  "return {action: 'reclaim-empty-overlay'}",
  '_requireEmptyOverlayAuthorization()',
  'crypto.randomBytes(32)',
  'owner process identity is unverifiable',
  'staging tree exists without a verified owner',
  'unverifiable rollback tree is present',
  'discardOwnedStaging',
]) check(publicBuildLock.includes(token), `public-build lock owner misses ${token}`);
for (const token of [
  'unowned staging without lock',
  'rollback tree without lock',
  'verifyAuthorizedEmptyOverlayRecovery',
  'verifyAuthorizedLocklessEmptyOverlayRecovery',
  'verifyControlledFailureDoesNotDeadlockNextBuild',
  'verifyRecoverableDeadOwner',
  'symlink',
  'foreign',
  'unverifiable',
]) check(publicBuildLockVerifier.includes(token), `public-build lock regression misses ${token}`);
for (const token of [
  'function authorizeEmptyOverlayRecovery()',
  "path.join(ROOT, 'scripts', 'assert-build-lock.py')",
  'authorizeEmptyOverlayRecovery,',
]) check(publicBuilder.includes(token), `public builder lacks lease-authorized empty-overlay recovery: ${token}`);
for (const token of [
  'seminar-schools-complete-editable-masters-source-and-public',
  'core-coreplus-mephistodata-degorgonified-feminism-retrieval-enforcement-complete-2026-09-05',
  '2026-09-05T20:15:00Z',
  'f34b4de5dbef3526b1ae54dc31941325322e85c3d720efd50e092e6687360bc0',
  'verify_ooxml_payload',
  'verify_portable_core',
  'PACKAGE_CONTENTS_SHA256.json',
]) check(completeArchiveClassVerifier.includes(token), `complete archive-class verifier misses ${token}`);
const nonStrawman = manifest.non_strawman_current_position_update || {};
check(
  nonStrawman.release_id === 'core-coreplus-nonstrawman-current-position-2026-08-29'
    && nonStrawman.generated_at === '2026-08-29T12:00:00Z',
  'Aug29 non-strawman outer package identity or timestamp drifted',
);
const expectedNonStrawmanCounts = {
  canonical_entries: 1221,
  methodology_entries: 390,
  genealogy_controls: 16,
  polycognate_application_controls: 24,
};
check(
  JSON.stringify(nonStrawman.current_counts) === JSON.stringify(expectedNonStrawmanCounts),
  'Aug29 non-strawman canonical, methodology, genealogy, or Polycognate counts drifted',
);
const expectedNonStrawmanFixtures = {
  positive: 58,
  negative: 126,
  total: 184,
  adjudication_v2_positive: 38,
  adjudication_v2_negative: 113,
  adjudication_v2_total: 151,
  inherited_base_positive: 20,
  inherited_base_negative: 13,
  inherited_base_total: 33,
  co_located_hash_disclaimer: 'These hashes and fixtures are regression evidence for internal consistency. They are not cryptographic proof of user adoption, external truth, or project validity.',
};
check(
  JSON.stringify(nonStrawman.behavioral_fixtures) === JSON.stringify(expectedNonStrawmanFixtures),
  'Aug29 non-strawman execution fixture counts or evidence disclaimer drifted',
);
const expectedNonStrawmanHashes = {
  'polymyth/methodologylist/index.html': 'e4497e3be534074fbb2ec3c148e1ae2e384de7775bb079be191e2eb7af17dc29',
  'polymyth/methodologylist/mephistodata-rule-hardening-addendum.js': 'e2778c8b97888524f3c07bccf1965977f9db7bf38a9d028e1a75023fcae6dd59',
  'polymyth/methodologylist/mythology-integration-addendum.js': 'b7562c013d157048f161a2caad29c0a52cc62851bb89d6df976bb0dad72453d0',
  'UPDATE_SOURCES/DETIENNE_COMPARING_THE_INCOMPARABLE_POLYMYTH_MASTER_NOTES_2026-08-28.md': 'e82445f633707df003f6066176482d900028c33d066645d173ea2441196235c9',
  'UPDATE_SOURCES/DETIENNE_CHAPTER_LEDGERS_2026-08-27/README.md': '57499b6c3fe92a58c8cf77dce26f8eb9df39b473fcc6f1b833f7c20c683bff02',
  'UPDATE_SOURCES/NON_STRAWMAN_CURRENT_POSITION_CORRECTION_2026-08-29.md': '157624357213b8c13e104fcd72acc364638b2ca074fdc1be151017c00aac22a9',
  'scripts/verify-ml-execution-gates.js': '361a18166d6afd9116453710de9d29a32964d75a7165fa1b9e2271ffed8acbef',
  'scripts/fixtures/ml-execution-gates/fixtures.json': 'dfbaf96e113eb60f0dd32ee3bf8060a672eb349ef625748b1de03fa2c9eb3444',
  'scripts/fixtures/ml-execution-gates/adjudication-v2-fixtures.json': '30d4b85ba671380dea3b3167963afbdeae85aeb6b434f77afc9a2fa8af4d5b84',
};
check(
  JSON.stringify(nonStrawman.artifact_sha256) === JSON.stringify(expectedNonStrawmanHashes),
  'Aug29 non-strawman artifact hash registry drifted',
);
check(
  Object.values(expectedNonStrawmanHashes).every(value => /^[0-9a-f]{64}$/.test(value)),
  'Aug29 non-strawman historical snapshot contains an invalid artifact digest',
);
check(
  nonStrawman.deployment === 'No deployment performed.',
  'Aug29 non-strawman release must retain the exact no-deployment statement',
);
const articleSynthesis = manifest.mephistodata_articles_synthesis || {};
const expectedSynthesisArchives = [
  {
    name: 'seminar-schools-nonstrawman-current-position-complete-2026-08-29(1).zip',
    sha256: '9da0005479af1e9ded6800cc8550eccf1d74d2ef92f04850259bd78de0f17141',
  },
  {
    name: 'seminar-schools-ml-internal-retrieval-complete-2026-08-29.zip',
    sha256: '203fd449c71e9ef4b5cd645a9fe26d38c2b007b7792311ca7a37fdf310370907',
  },
  {
    name: 'seminar-schools-ml-writing-rules-hardened-complete-2026-08-29.zip',
    sha256: 'fc5ad168b07af8ad1dde780519ec485bfdedba7d3273d843e97c6c83a59fa0ed',
  },
];
check(
  articleSynthesis.release_id === 'core-coreplus-mephistodata-articles-synthesized-complete-2026-08-29'
    && articleSynthesis.generated_at === '2026-08-29T12:00:00Z'
    && JSON.stringify(articleSynthesis.source_archives) === JSON.stringify(expectedSynthesisArchives)
    && JSON.stringify(articleSynthesis.current_counts) === JSON.stringify({
      canonical_entries:1223,coreplus_entries:54,methodology_entries:390,
    })
    && articleSynthesis.distinct_publication_dates === true
    && articleSynthesis.deployment === 'No deployment performed.',
  'Aug29 archive and article synthesis identity, sources, counts, or status drifted',
);
check(manifest.polymythcal_asset_version === '20260815-sets1-15-synthesis', `current asset version is ${manifest.polymythcal_asset_version}`);
check(
  manifest.polymythcal_discovery_release_id === '2026-08-26-polymythcal-discovery-v2',
  `current Discovery release is ${manifest.polymythcal_discovery_release_id}`,
);
check(
  manifest.polymythcal_discovery_built_at === '2026-08-26T12:30:00-04:00',
  `current Discovery build timestamp is ${manifest.polymythcal_discovery_built_at}`,
);
check(
  manifest.polymythcal_discovery_asset_version === '20260826-discovery-v2',
  `current Discovery asset version is ${manifest.polymythcal_discovery_asset_version}`,
);
check(/^sha256-[0-9a-f]{12}$/.test(manifest.geometry_asset_version || ''), 'release manifest lacks a content-derived geometry asset version');
check(
  manifest.teacherresources_asset_versions
    && Object.keys(manifest.teacherresources_asset_versions).sort().join(',') === 'finder_css,finder_js'
    && Object.values(manifest.teacherresources_asset_versions).every(value => /^sha256-[0-9a-f]{12}$/.test(value)),
  'release manifest lacks exact Teacher Resources asset versions',
);
check(
  manifest.asset_digests
    && JSON.stringify(Object.keys(manifest.asset_digests)) === JSON.stringify(expectedReleaseAssetPaths)
    && Object.values(manifest.asset_digests).every(value => /^[0-9a-f]{64}$/.test(value)),
  'release manifest lacks the exact sitewide, geometry-scope, and discovery-v2 SHA-256 asset digests',
);
for (const field of [
  'polymythcal_discovery_release_id',
  'polymythcal_discovery_built_at',
  'polymythcal_discovery_asset_version',
  'geometry_asset_version',
  'teacherresources_asset_versions',
  'asset_digests',
]) {
  check(publicBuilder.includes(`'${field}'`), `public release marker does not pass through ${field}`);
}
check(
  JSON.stringify(RELEASE_ASSET_PATHS) === JSON.stringify(expectedReleaseAssetPaths),
  'release asset identity helper does not bind the exact discovery-v2 and geometry-scope source assets',
);
check(
  Object.keys(PUBLIC_RELEASE_ASSET_PATHS).length === expectedReleaseAssetPaths.length
    && expectedReleaseAssetPaths.every(relative => (
      PUBLIC_RELEASE_ASSET_PATHS[relative] === (privateReleaseAssets.has(relative) ? null : relative)
    )),
  'release asset identity helper violates the discovery-v2 public/private mirror boundary',
);
check(
  !Object.values(PUBLIC_RELEASE_ASSET_PATHS).includes('polymythseminars/events.json')
    && !Object.values(PUBLIC_RELEASE_ASSET_PATHS).includes('js/polymythcal-revamp.js')
    && PUBLIC_RELEASE_ASSET_PATHS['polymythseminars/browse.json'] === 'polymythseminars/browse.json'
    && PUBLIC_RELEASE_ASSET_PATHS['polymythseminars/watchlist.json'] === 'polymythseminars/watchlist.json'
    && PUBLIC_RELEASE_ASSET_PATHS['polymythseminars/research.json'] === 'polymythseminars/research.json',
  'release asset identity helper exposes the canonical corpus instead of the browse/watchlist projections',
);
for (const token of [
  'geometryAssetVersion(root)',
  'teacherresources_asset_versions',
  'RELEASE_ASSET_PATHS',
  'PUBLIC_RELEASE_ASSET_PATHS',
]) check(releaseAssetIdentityHelper.includes(token), `release asset identity helper misses ${token}`);
for (const [relative, source] of [
  ['scripts/apply-visible-geometry.js', geometryFinalizer],
  ['scripts/verify-steady-ui.js', steadyUiVerifier],
]) {
  check(
    source.includes('geometryExemptionForRelativeHtmlPath')
      && source.includes("require('./lib/geometry-asset-version')")
      && source.includes("'geometry-route-contracts.json'")
      && source.includes('data-shared-geometry-exempt'),
    `${relative} does not consume the exact central geometry exemption classifier`,
  );
}
for (const token of [
  'polymythcal_discovery_release_id', 'polymythcal_discovery_built_at',
  'polymythcal_discovery_asset_version', 'watchlist_payload_sha256', 'research_payload_sha256',
]) check(read('scripts/update-polymythcal-build-manifest.js').includes(token), `Polymythcal build manifest updater misses ${token}`);
for (const source of [publicBuilder, read('scripts/verify-public-deploy-parity.js')]) {
  for (const token of [
    "'polymythseminars/events.json'",
    "'polymythcal-publication-surfaces.json'",
    "'polymythcal-publication-surfaces-v2'",
    "'chronology_ids'",
    "'watchlist_ids'",
    "'monitoring-marker'",
  ]) check(source.includes(token), `public publication-boundary contract misses ${token}`);
}
check(releaseAssetIdentityUpdater.includes('computeReleaseAssetIdentity(ROOT)'), 'release asset updater does not recompute source identity');
for (const token of ['computeReleaseAssetIdentity(ROOT)', 'public/site-release.json', 'public mirror differs from source']) {
  check(releaseAssetIdentityVerifier.includes(token), `release asset verifier misses ${token}`);
}
check(
  publicBuilder.includes('const releaseAssetIdentity = computeReleaseAssetIdentity(ROOT)')
    && publicBuilder.includes('pickReleaseAssetIdentity(releaseManifest)')
    && publicBuilder.includes("'asset_digests': releaseAssetIdentity.asset_digests")
    && publicBuilder.includes('function writeCommittedReleaseMarker()')
    && publicBuilder.includes('function writeCommittedReleaseAssets()')
    && publicBuilder.includes('Object.entries(PUBLIC_RELEASE_ASSET_PATHS)')
    && publicBuilder.includes('function snapshotCommittedPublicTree()')
    && publicBuilder.includes('const committedPublicFiles = snapshotCommittedPublicTree();')
    && publicBuilder.includes('writeCommittedPublicTree(committedPublicFiles);')
    && publicBuilder.includes('const durabilityPassAuthorized = publicBuildLock.assertCurrentAcquisitionHasAuthorizedRecovery();')
    && publicBuilder.includes('if (durabilityPassAuthorized !== true)')
    && publicBuilder.indexOf('writeCommittedReleaseMarker();') < publicBuilder.indexOf('const committedPublicFiles = snapshotCommittedPublicTree();')
    && publicBuilder.indexOf('const committedPublicFiles = snapshotCommittedPublicTree();') < publicBuilder.indexOf('const durabilityPassAuthorized = publicBuildLock.assertCurrentAcquisitionHasAuthorizedRecovery();')
    && publicBuilder.indexOf('const durabilityPassAuthorized = publicBuildLock.assertCurrentAcquisitionHasAuthorizedRecovery();') < publicBuilder.indexOf('releaseBuildLock();')
    && publicBuilder.indexOf('releaseBuildLock();') < publicBuilder.indexOf('writeCommittedPublicTree(committedPublicFiles);')
    && !publicBuilder.slice(publicBuilder.indexOf('releaseBuildLock();')).includes('authorizeEmptyOverlayRecovery();')
    && publicBuilder.includes('function capturePriorPublicMtimes()')
    && publicBuilder.includes('function durableOutputTimestamp(sourcePath, publicRelative)')
    && publicBuilder.includes('priorMtime + 1000')
    && publicBuilder.indexOf('capturePriorPublicMtimes();') < publicBuilder.indexOf('commitBuildOutput();')
    && publicBuilder.includes('fs.renameSync(temporary, targetPath)')
    && publicBuilder.includes('fs.readFileSync(targetPath).equals(contents)')
    && publicBuilder.includes("fs.renameSync(temporary, markerPath)")
    && publicBuilder.includes("fs.utimesSync(OUT, markerTimestamp, markerTimestamp)")
    && publicBuilder.includes("fs.readFileSync(markerPath, 'utf8') !== releaseMarkerContents")
    && publicBuilder.indexOf('writeCommittedReleaseMarker();') > publicBuilder.indexOf('commitBuildOutput();')
    && publicBuilder.indexOf('writeCommittedReleaseAssets();') > publicBuilder.indexOf('commitBuildOutput();')
    && publicBuilder.indexOf('writeCommittedReleaseAssets();') < publicBuilder.indexOf('releaseBuildLock();')
    && publicBuilder.indexOf('writeCommittedReleaseMarker();') < publicBuilder.indexOf('releaseBuildLock();'),
  'public builder must bind a freshly computed identity and atomically read back governed live assets and the release marker under its lock',
);
check(pkg.version === '1.0.7', `package version is ${pkg.version}`);
check(pkg.scripts?.['test:polymythcal-discovery-core'] === 'node scripts/test-polymythcal-discovery-core.js', 'Discovery core behavioral test is not exposed by package.json');
check(pkg.scripts?.['test:polymythcal-data-truth'] === 'node scripts/test-polymythcal-data-truth.js', 'Discovery data/truth test is not exposed by package.json');
check(pkg.scripts?.['test:polymythcal-discovery-shell'] === 'node scripts/test-polymythcal-discovery-shell.js', 'Discovery shell test is not exposed by package.json');
check(pkg.scripts?.['test:polymythcal-package-boundary'] === 'node scripts/run-python.js scripts/test-polymythcal-package-boundary.py', 'Discovery package-boundary test is not exposed by package.json');
check(pkg.scripts?.['verify:polymythcal-discovery-v2'] === 'node scripts/verify-polymythcal-discovery-v2.js', 'Discovery v2 gate is not exposed by package.json');
check(read('scripts/verify-polymythcal-discovery-v2.js').includes("require('./test-polymythcal-discovery-core')"), 'Discovery v2 gate does not invoke its pure behavioral test');
check(read('scripts/verify-polymythcal-discovery-v2.js').includes("require('./test-polymythcal-data-truth')"), 'Discovery v2 gate does not invoke its data/truth test');
check(read('scripts/verify-polymythcal-discovery-v2.js').includes("require('./test-polymythcal-discovery-shell')"), 'Discovery v2 gate does not invoke its shell test');
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
check(
  packageSelection.includes('def polymythcal_publication_exclusions(root: Path)')
    && packageSelection.includes('polymythcal-publication-surfaces.json')
    && packageSelection.includes('watchlist_ids')
    && packageSelection.includes('legacy_ids')
    && packageSelection.includes('public/polymythseminars/events.json')
    && packageSelection.includes('public/js/polymythcal-revamp.js')
    && packageSelection.includes('public/css/polymythcal-revamp.css')
    && packageSelection.includes('polymythseminars/ics/')
    && packageSelection.includes('publication_exclusions = polymythcal_publication_exclusions(root)'),
  'canonical package selection does not fail closed over private/retired Polymythcal public artifacts',
);
const packageBoundaryResult = spawnSync(
  process.execPath,
  ['scripts/run-python.js', 'scripts/test-polymythcal-package-boundary.py'],
  { cwd: ROOT, encoding: 'utf8' },
);
check(
  packageBoundaryResult.status === 0,
  `Polymythcal package-boundary behavioral test failed: ${(packageBoundaryResult.stderr || packageBoundaryResult.stdout || '').trim()}`,
);
for (const [name, source] of [['deployer', deployer], ['source', sourcePackager]]) {
  check(source.includes('load_current_release_manifest()'), `${name} packager does not reload release metadata after build verification`);
  check(source.includes('Archive metadata does not match the packaged release manifest.'), `${name} packager does not assert packaged release metadata parity`);
}
for (const [name, source, prefix] of [
  ['deployer', deployer, ''],
  ['Netlify source', sourcePackager, ''],
  ['complete archive', completeArchivePackager, 'SITE_PACKAGE/'],
]) {
  for (const relative of destinationContractAssets) {
    const requiredPath = `${prefix}${relative}`;
    check(
      source.split(requiredPath).length - 1 === 1,
      `${name} packager must require ${requiredPath} exactly once`,
    );
  }
}
for (const token of [
  'require_release_build_lock(DELIVERY_ROOT)',
  '[npm, "run", "build"]',
  'scripts/run-browser-test-tier.mjs',
  'scripts/reports/futureproofing-browser-family-report.json',
  '[npm, "run", "sync:editable-masters:locked"]',
  'verify_netlify_repository_checkout(npm)',
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
const archiveWriteIndex = completePackager.lastIndexOf('package-front-facing-mephistodata-release.py');
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
  'scripts/run-browser-test-tier.mjs',
  'scripts/reports/futureproofing-browser-family-report.json',
  '[npm, "run", "sync:editable-masters:locked"]',
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
  (predeployWorkflow.match(/cache-dependency-path: requirements-audit\.lock/g) || []).length === 3
    && (predeployWorkflow.match(/--require-hashes --requirement requirements-audit\.lock/g) || []).length === 3,
  'predeploy must install the hash-locked Python audit runtime in every build job',
);
const completeBuildIndex = completePackager.indexOf('run([npm, "run", "build"])');
const completeBrowserIndex = completePackager.indexOf('"scripts/run-browser-test-tier.mjs"');
const completeSyncIndex = completePackager.indexOf('run([npm, "run", "sync:editable-masters:locked"])');
const completeRepositoryIndex = completePackager.indexOf('verify_netlify_repository_checkout(npm)');
const completeVerifyIndex = completePackager.indexOf('run([npm, "run", "verify:all:built"])');
const completeEditableIndex = completePackager.lastIndexOf('\n    verify_editable_masters(EDITABLE_ROOT)');
const completeArchiveIndex = completePackager.lastIndexOf('package-front-facing-mephistodata-release.py');
const completeCleanRoomIndex = completePackager.lastIndexOf('verify-clean-room-release.py');
const completeRecoveryIndex = completePackager.lastIndexOf('verify-disaster-recovery.py');
const completeReceiptIndex = completePackager.lastIndexOf('create-artifact-audit-receipt.py');
const completeReceiptVerifyIndex = completePackager.lastIndexOf('verify-artifact-audit-receipt.py');
check(
  completeBuildIndex >= 0
    && completeBuildIndex < completeBrowserIndex
    && completeBrowserIndex < completeSyncIndex
    && completeSyncIndex < completeRepositoryIndex
    && completeRepositoryIndex < completeVerifyIndex
    && completeVerifyIndex < completeEditableIndex
    && completeEditableIndex < completeArchiveIndex
    && completeArchiveIndex < completeCleanRoomIndex
    && completeCleanRoomIndex < completeRecoveryIndex
    && completeRecoveryIndex < completeReceiptIndex
    && completeReceiptIndex < completeReceiptVerifyIndex,
  'complete outer packager must build, refresh browser-family evidence, verify, archive, reproduce, restore, receipt, then verify the receipt',
);
const cleanRoomBuildIndex = cleanRoomBuilder.indexOf('[npm, "run", "build"]');
const cleanRoomBrowserIndex = cleanRoomBuilder.indexOf('"scripts/run-browser-test-tier.mjs"');
const cleanRoomVerifyIndex = cleanRoomBuilder.indexOf('[npm, "run", "verify:all:built"]');
check(
  cleanRoomBuildIndex >= 0
    && cleanRoomBuildIndex < cleanRoomBrowserIndex
    && cleanRoomBrowserIndex < cleanRoomVerifyIndex,
  'clean-room builder must refresh browser-family evidence after build and before aggregate verification',
);
check(
  completePackager.includes('PACKAGE_RELEASE_ID = (\n    "core-coreplus-mephistodata-degorgonified-feminism-retrieval-enforcement-complete-2026-09-05"')
    && completePackager.includes('OUTPUT_BASENAME = (')
    && completePackager.includes('"seminar-schools-mephistodata-degorgonified-feminism-retrieval-enforcement-complete-2026-09-05.zip"')
    && completePackager.includes('Complete release output must use the canonical name')
    && !completePackager.includes('parser.add_argument("--release-id"')
    && completePackager.includes('"--preflight"'),
  'complete outer packager exposes arbitrary package release identity',
);
for (const token of [
  'writing composition',
  'same sentence lexical repetition',
  'topic continuity',
  'protected spans',
  'revision fidelity',
  'no invented bridge',
  'bottom-up definition',
  'defect provenance',
  'no sign-in request',
  'truthful work claims',
  'false completion',
  'claim ledger',
  'operation evidence',
  'feminism women creed flock',
  'standpoint epistemology personal is political',
  'white feminism',
  'slavery patriarchy patriarchal pedestal',
  'academic research gate query ontology premise audit',
  'critic nonauthority',
  'Wikipedia inadmissible',
  'degorgonified feminism exact ML* retrieval handle',
  'complete six-owner bundle nonsemantic',
  'no clean subtype mixed authority',
  'real women Gorgon imagery',
  'counters to counterarguments pentagram screenshot list unresolved',
]) {
  check(completePackager.includes(token), `complete archive CORE access query misses ${token}`);
}
check(
  completePackager.includes('DERIVED_GENERATED_AT = "2026-09-05T20:15:00Z"')
    && completePackager.includes('RELEASE_GENERATED_AT = "2026-09-05T20:15:00Z"')
    && completePackager.includes('generated_at = RELEASE_GENERATED_AT')
    && cleanRoomBuilder.includes('DERIVED_GENERATED_AT = "2026-09-05T20:15:00Z"')
    && completePackager.includes('os.environ["SITE_BUILD_DATE"] = "2026-09-05"')
    && cleanRoomBuilder.includes('os.environ["SITE_BUILD_DATE"] = "2026-09-05"')
    && completePackager.includes('[node, "scripts/regen-methodologylist-manifest.js", "2026-09-05"]')
    && cleanRoomBuilder.includes('[node, "scripts/regen-methodologylist-manifest.js", "2026-09-05"]')
    && completePackager.includes('"current non-strawman project comparison Polycognate genealogy always-already boundaries "')
    && cleanRoomBuilder.includes('"current non-strawman project comparison Polycognate genealogy always-already boundaries "')
    && completePackager.includes('"Be Kind While We Exploit You The Struggle to Control AI "')
    && cleanRoomBuilder.includes('"Be Kind While We Exploit You The Struggle to Control AI "'),
  'primary and clean-room package builds must share the current deterministic release day',
);
for (const token of [
  'README_FIRST.txt',
  'UPDATE_SOURCES/ML_STAR_UPDATE_SOURCE_DEGORGONIFIED_FEMINISM_RETRIEVAL_ENFORCEMENT_2026-09-05.md',
  'UPDATE_SOURCES/ML_STAR_UPDATE_SOURCE_FEMINISM_ACADEMIC_RESEARCH_GORGONIFICATION_2026-09-05.md',
  'UPDATE_SOURCES/ML_STAR_UPDATE_SOURCE_TRUTHFUL_WORK_CLAIMS_2026-09-05.md',
  'SITE_PACKAGE/UPDATE_SOURCES/NON_STRAWMAN_CURRENT_POSITION_CORRECTION_2026-08-29.md',
  'SITE_PACKAGE/UPDATE_SOURCES/ML_STAR_UPDATE_SOURCE_BOTTOM_UP_DEFINITION_DEFECT_PROVENANCE_INTERNAL_RETRIEVAL_2026-09-03.md',
  'SITE_PACKAGE/UPDATE_SOURCES/ML_STAR_UPDATE_SOURCE_TRUTHFUL_WORK_CLAIMS_2026-09-05.md',
  'SITE_PACKAGE/UPDATE_SOURCES/ML_STAR_UPDATE_SOURCE_DEGORGONIFIED_FEMINISM_RETRIEVAL_ENFORCEMENT_2026-09-05.md',
  'SITE_PACKAGE/UPDATE_SOURCES/ML_STAR_UPDATE_SOURCE_FEMINISM_ACADEMIC_RESEARCH_GORGONIFICATION_2026-09-05.md',
  'SITE_PACKAGE/UPDATE_SOURCES/TRUTHFUL_WORK_CLAIM_SCREENSHOTS_2026-09-05/b4f6ab5a-4eb3-44d0-943e-41acd52faec9.png',
  'SITE_PACKAGE/UPDATE_SOURCES/TRUTHFUL_WORK_CLAIM_SCREENSHOTS_2026-09-05/3066e1d8-f6f9-4267-a948-90c076e29f93.png',
  'SITE_PACKAGE/UPDATE_SOURCES/DETIENNE_COMPARING_THE_INCOMPARABLE_POLYMYTH_MASTER_NOTES_2026-08-28.md',
  'SITE_PACKAGE/UPDATE_SOURCES/DETIENNE_CHAPTER_LEDGERS_2026-08-27/README.md',
  'SITE_PACKAGE/UPDATE_SOURCES/DETIENNE_CHAPTER_LEDGERS_2026-08-27/01_FOREWORD_AND_CHAPTER_1.md',
  'SITE_PACKAGE/UPDATE_SOURCES/DETIENNE_CHAPTER_LEDGERS_2026-08-27/02_CONSTRUCTING_COMPARABLES.md',
  'SITE_PACKAGE/UPDATE_SOURCES/DETIENNE_CHAPTER_LEDGERS_2026-08-27/03_REGIMES_OF_HISTORICITY.md',
  'SITE_PACKAGE/UPDATE_SOURCES/DETIENNE_CHAPTER_LEDGERS_2026-08-27/04_POLYTHEISMS.md',
  'SITE_PACKAGE/UPDATE_SOURCES/DETIENNE_CHAPTER_LEDGERS_2026-08-27/05_ASSEMBLY_AND_POLITICS.md',
  'SITE_PACKAGE/UPDATE_SOURCES/DETIENNE_CHAPTER_LEDGERS_2026-08-27/06_ENDNOTES_AND_SOURCE_LINEAGE.md',
  'SITE_PACKAGE/scripts/fixtures/ml-execution-gates/adjudication-v2-fixtures.json',
  'SITE_PACKAGE/scripts/fixtures/ml-execution-gates/internal-writing-fixtures.json',
  'SITE_PACKAGE/ML_EXECUTION_AND_CONTROLLED_ARCHIVE_SYNTHESIS_2026-08-26.md',
  'SITE_PACKAGE/polymyth/methodologylist/mephistodata-rule-hardening-addendum.js',
  'SITE_PACKAGE/scripts/verify-ml-project-adjudication-v2.js',
  'SITE_PACKAGE/scripts/verify-ml-writing-rules.js',
  'SITE_PACKAGE/scripts/verify-mephistodata-articles.js',
  'SITE_PACKAGE/polymyth/articles/be-kind-while-we-exploit-you.md',
  'SITE_PACKAGE/polymyth/articles/the-struggle-to-control-ai.md',
  'SeminarSchools-Deploy-FINAL7-VerifiedPush-StayOpen-NoLocalNpm-ManualRepoPicker-ManualHFSync.cmd',
  'Polymyth_Coherence_Assessment_Instrument_V5.1.2.xlsx',
  'Polymyth_Coherence_AI_Application_Protocol_V5.1.2.md',
  'Polymyth_Coherence_Assessment_Schema_V5.1.2.json',
  'Polymyth_Coherence_Worked_Applications.xlsx',
  'Polymyth_Coherence_V5.1.1.xlsx',
  'WEBSITE_FUTUREPROOFING_CONTRACTS_AUDIT_2026-08-09.md',
  'FUTUREPROOFING_RELEASE_CONTRACT_2026-08-09.md',
  'data/futureproofing/futureproofing-contract.json',
  'SITE_PACKAGE/data/futureproofing/sep5-feminism-package-contents-baseline.json',
  'SITE_PACKAGE/data/futureproofing/sep5-feminism-sep5-degorgonified-feminism-preservation-contract.json',
  'data/browser-test-tiers.json',
  'data/live-evidence-policy.json',
  'data/harvest-source-history.json',
  'verify-futureproofing-contract.py',
  'SITE_PACKAGE/scripts/verify-sep5-degorgonified-feminism-base-preservation.py',
  'SITE_PACKAGE/scripts/fixtures/futureproofing/sep5-degorgonified-feminism-preservation-tampered.json',
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
for (const token of [
  'EXPECTED_PACKAGE_RELEASE_ID = (',
  'core-coreplus-mephistodata-degorgonified-feminism-retrieval-enforcement-complete-2026-09-05',
  'EXPECTED_PACKAGE_GENERATED_AT = "2026-09-05T20:15:00Z"',
  'EXPECTED_CURRENT_RELEASE_PATHS',
  'UPDATE_SOURCES/ML_STAR_UPDATE_SOURCE_DEGORGONIFIED_FEMINISM_RETRIEVAL_ENFORCEMENT_2026-09-05.md',
  'UPDATE_SOURCES/ML_STAR_UPDATE_SOURCE_FEMINISM_ACADEMIC_RESEARCH_GORGONIFICATION_2026-09-05.md',
  'UPDATE_SOURCES/ML_STAR_UPDATE_SOURCE_TRUTHFUL_WORK_CLAIMS_2026-09-05.md',
  'SITE_PACKAGE/UPDATE_SOURCES/ML_STAR_UPDATE_SOURCE_TRUTHFUL_WORK_CLAIMS_2026-09-05.md',
  'SITE_PACKAGE/UPDATE_SOURCES/ML_STAR_UPDATE_SOURCE_DEGORGONIFIED_FEMINISM_RETRIEVAL_ENFORCEMENT_2026-09-05.md',
  'SITE_PACKAGE/data/futureproofing/sep5-feminism-package-contents-baseline.json',
  'SITE_PACKAGE/data/futureproofing/sep5-feminism-sep5-degorgonified-feminism-preservation-contract.json',
  'SITE_PACKAGE/scripts/verify-sep5-degorgonified-feminism-base-preservation.py',
  'SITE_PACKAGE/scripts/fixtures/futureproofing/sep5-degorgonified-feminism-preservation-tampered.json',
  'SITE_PACKAGE/UPDATE_SOURCES/TRUTHFUL_WORK_CLAIM_SCREENSHOTS_2026-09-05/b4f6ab5a-4eb3-44d0-943e-41acd52faec9.png',
  'SITE_PACKAGE/UPDATE_SOURCES/TRUTHFUL_WORK_CLAIM_SCREENSHOTS_2026-09-05/3066e1d8-f6f9-4267-a948-90c076e29f93.png',
  'SITE_PACKAGE/UPDATE_SOURCES/NON_STRAWMAN_CURRENT_POSITION_CORRECTION_2026-08-29.md',
  'SITE_PACKAGE/UPDATE_SOURCES/DETIENNE_COMPARING_THE_INCOMPARABLE_POLYMYTH_MASTER_NOTES_2026-08-28.md',
  'SITE_PACKAGE/UPDATE_SOURCES/DETIENNE_CHAPTER_LEDGERS_2026-08-27/README.md',
  'SITE_PACKAGE/scripts/fixtures/ml-execution-gates/adjudication-v2-fixtures.json',
  'SITE_PACKAGE/scripts/fixtures/ml-execution-gates/internal-writing-fixtures.json',
  'SITE_PACKAGE/polymyth/articles/be-kind-while-we-exploit-you.md',
  'SITE_PACKAGE/polymyth/articles/the-struggle-to-control-ai.md',
  'FORBIDDEN_TRANSIENT_RELEASE_PATHS',
  'Detienne_Evidence_Ledgers_2026-08-27/',
]) {
  check(artifactReceipt.includes(token), `artifact receipt current-release contract misses ${token}`);
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
check(lock.version === '1.0.7' && lock.packages?.['']?.version === '1.0.7', 'package-lock version is not 1.0.7');
for (const [name, command] of Object.entries({
  'verify:all': 'node scripts/run-python.js scripts/run-with-build-lock.py --delivery-root .. -- node scripts/verify-all-runner.js',
  'verify:all:built': 'node scripts/run-python.js scripts/run-with-build-lock.py --delivery-root .. -- node scripts/verify-all-runner.js --reuse-build',
  'verify:repository': 'node scripts/run-python.js scripts/run-with-build-lock.py -- node scripts/verify-all-runner.js --site-only',
  'verify:repository:built': 'node scripts/run-python.js scripts/run-with-build-lock.py -- node scripts/verify-all-runner.js --reuse-build --site-only',
  'verify:build-idempotence': 'node scripts/verify-build-idempotence.js',
  'verify:all:serial': 'node scripts/run-python.js scripts/run-with-build-lock.py --delivery-root .. -- node scripts/verify-all-runner.js --concurrency=1',
  'verify:release': 'node scripts/run-python.js scripts/run-with-build-lock.py --delivery-root .. -- node scripts/verify-all-runner.js',
  'test:futureproofing': 'npm run test:futureproofing:core-fixtures && npm run test:futureproofing:article-body && npm run test:futureproofing:gate-defects && npm run test:futureproofing:browser-tiers && npm run test:futureproofing:live-evidence && npm run test:futureproofing:source-anomalies && npm run test:futureproofing:external-destinations && npm run test:futureproofing:route-tombstones && npm run test:futureproofing:data-migrations',
  'verify:futureproofing': 'node scripts/run-python.js scripts/run-with-build-lock.py --delivery-root .. -- node scripts/run-python.js scripts/verify-futureproofing-contract.py --run-source --report scripts/reports/futureproofing-gate-report.json',
  'verify:futureproofing:site': 'node scripts/run-python.js scripts/run-with-build-lock.py -- node scripts/run-python.js scripts/verify-futureproofing-contract.py --run-source --site-only --report scripts/reports/futureproofing-gate-report.json',
  'verify:futureproofing:base-preservation': 'node scripts/run-python.js scripts/verify-sep5-degorgonified-feminism-base-preservation.py',
  'verify:ml-dialectical-hardening': 'node scripts/verify-ml-dialectical-hardening.js',
  'verify:ml-execution-gates': 'node scripts/verify-ml-execution-gates.js',
  'verify:mephistodata-runtime-gate': 'node scripts/verify-mephistodata-runtime-gate.js',
  'verify:ml-active-form-conflicts': 'node scripts/verify-ml-active-form-conflicts.js',
  'verify:baseline-morality-amendment-scope': 'node scripts/verify-baseline-morality-amendment-scope.js && node scripts/test-baseline-morality-amendment-scope.js',
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
  'package:complete-current': 'node scripts/run-python.js scripts/run-with-build-lock.py --delivery-root .. -- node scripts/run-python.js scripts/package-complete-current.py',
  'sync:editable-masters': 'node scripts/run-python.js scripts/run-with-build-lock.py --delivery-root .. -- npm run sync:editable-masters:locked',
  'sync:editable-masters:locked': 'node scripts/run-python.js scripts/assert-build-lock.py && node scripts/run-python.js scripts/update-polymythcal-editable-master-set9-2026-08-13.py && node scripts/run-python.js scripts/update-polymythcal-editable-master-sets10-11-2026-08-14.py && node scripts/run-python.js scripts/update-polymythcal-editable-master-set12-2026-08-14.py && node scripts/run-python.js scripts/update-polymythcal-editable-master-set14-2026-08-15.py && node scripts/run-python.js scripts/update-polymythcal-editable-master-sets13-15-2026-08-15.py',
  'build:asset-report': 'node scripts/build-asset-weight-report.js',
  'verify:asset-weights': 'node scripts/verify-asset-weights.js',
  'verify:visible-geometry-browser': 'node scripts/verify-visible-geometry-browser.mjs',
  'verify:front-facing-overlap-browser': 'node scripts/verify-front-facing-overlap-browser.js',
  'verify:polymyth-coherence': 'node scripts/run-python.js scripts/verify-polymyth-coherence-workbook.py',
  'verify:polymyth-entry-points': 'node scripts/verify-polymyth-entry-points.js',
  'verify:cloud-input-runtime': 'node scripts/verify-cloud-input-runtime.js',
  'verify:redirect-coherence': 'node scripts/verify-redirect-policy-coherence.js',
  'apply:polymythcal-destination-specificity': 'node scripts/apply-polymythcal-destination-specificity.js',
  'verify:polymythcal-destination-specificity': 'node scripts/verify-polymythcal-destination-specificity.js',
  'verify:polymythcal-destination-browser': 'node scripts/verify-polymythcal-destination-browser.js',
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
  'apply-polymythcal-destination-specificity.js',
  'apply-audit45-language-model.py',
  'build-polymythcal-browser-payload.js',
  'build-polymythcal-audit13.py',
  'update-polymythcal-listing-counts.js',
  'build-search-pages.js',
  'apply-polymythcal-set13-15-facets.js',
  'build-writing-shortcuts.js',
  'build-academic-shortcuts.js',
  'build-polymythcal-feeds.py',
  'apply-visible-geometry.js',
  'apply-sitewide-type-zoom-link.js',
  'apply-type-floor.js',
  'consolidate-google-fonts.js',
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
  'build-audit45-localized-routes.py',
  'apply-audit45-translation-ui.js',
  'apply-audit49-metadata-hygiene.js',
  'update-polymythcal-destination-contract.js',
  'apply-sitewide-type-zoom-link.js',
  'build-polymythcal-discovery-site.js',
  'build-writing-shortcuts.js',
  'build-academic-shortcuts.js',
  'apply-visible-geometry.js',
  'update-release-asset-identity.js',
  'update-polymythcal-build-manifest.js',
  'build-public-deploy.js',
  'verify-public-deploy-parity.js',
  'verify-release-asset-identity.js',
  'verify-front-facing-boundary.js',
  'verify-polymyth-entry-points.js --site-only',
  'verify-visible-geometry.js',
  'verify-meaningful-geometry.js',
  'verify-geometry.js',
  'build-asset-weight-report.js',
  'verify-polymythcal-browser-payload.js',
  'verify-polymythcal-discovery-v2.js',
  'verify-polymythcal-destination-specificity.js',
  'verify-polymythcal-build-efficiency.js',
  'verify-steady-ui.js',
  'verify-audit45-translations.py',
  'verify-audit49-metadata-surface.js',
  'verify-audit49-runtime-efficiency.js',
  'verify-audit49-build-packaging-efficiency.js',
];
let previous = -1;
for (const token of buildOrder) {
  const index = build.indexOf(token, previous + 1);
  check(index > previous, `canonical build order omits or misorders ${token}`);
  if (index > previous) previous = index;
}
check(
  (build.match(/build-polymythcal-browser-payload\.js/g) || []).length === 2,
  'canonical build must generate the discovery-v2 projections before route generation and again after normalizers',
);
check(
  (build.match(/build-polymythcal-discovery-site\.js/g) || []).length === 1
    && (build.match(/verify-polymythcal-discovery-v2\.js/g) || []).length === 1,
  'canonical build must generate and verify the discovery-v2 site exactly once',
);
const finalGeometryApply = build.lastIndexOf('apply-visible-geometry.js');
check((build.match(/apply-visible-geometry\.js/g) || []).length === 2, 'canonical build must apply geometry before and after all page generators');
check(
  finalGeometryApply > build.lastIndexOf('apply-audit49-metadata-hygiene.js')
    && finalGeometryApply > build.lastIndexOf('build-polymythcal-discovery-site.js')
    && finalGeometryApply > build.lastIndexOf('build-writing-shortcuts.js')
    && finalGeometryApply > build.lastIndexOf('build-academic-shortcuts.js')
    && finalGeometryApply < build.indexOf('update-release-asset-identity.js'),
  'final geometry pass is not downstream of every HTML generator and upstream of release identity',
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
  const exactSuffix = command === 'npm run verify:futureproofing' ? '(?!:site)' : '';
  check(
    (runner.match(new RegExp(escaped + exactSuffix, 'g')) || []).length === 1,
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
const reusedPreparationStart = runner.indexOf('const reusedBuildPreparation = [');
const reusedPreparationEnd = runner.indexOf('\n];', reusedPreparationStart) + 3;
const reusedPreparationSection = runner.slice(reusedPreparationStart, reusedPreparationEnd);
for (const command of [
  'node scripts/run-python.js scripts/verify-polymyth-coherence-workbook.py',
  'node scripts/verify-polymyth-entry-points.js',
  'node scripts/verify-front-facing-boundary.js',
  'node scripts/verify-release-asset-identity.js',
  'node scripts/verify-polymythcal-destination-specificity.js',
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
check(
  (runner.match(/node scripts\/verify-ml-execution-gates\.js/g) || []).length === 1,
  'full release runner must execute the Mephistodata execution gate verifier exactly once',
);
check(
  pkg.scripts
    && pkg.scripts['verify:public-build-lock-recovery'] === 'node scripts/verify-public-build-lock-recovery.js'
    && (runner.match(/node scripts\/verify-public-build-lock-recovery\.js/g) || []).length === 1,
  'full release runner must execute the public-build lock recovery verifier exactly once',
);
const concurrentSweepStart = runner.indexOf('const concurrentReadOnlySweeps = [');
const concurrentSweepEnd = runner.indexOf('const finalSequential = [');
const concurrentSweepSection = runner.slice(concurrentSweepStart, concurrentSweepEnd);
const sequentialSweepPrerequisites = runner.slice(
  runner.indexOf('const sequential = ['),
  concurrentSweepStart,
);
const idempotenceSweepCommand = 'node scripts/verify-build-idempotence.js';
const concurrentSweepCommands = [
  'node scripts/verify-front-facing-overlap-browser.js',
  'node scripts/verify-visible-geometry-browser.mjs',
  'node scripts/verify-teacherresources-state-layout-browser.js',
  'node scripts/verify-home-map-browser.js',
  'node scripts/verify-polymythcal-sets13-15-browser.js',
  'node scripts/verify-polymythcal-destination-browser.js',
];
check(
  concurrentSweepStart > runner.indexOf('const sequential = [')
    && concurrentSweepEnd > concurrentSweepStart
    && runner.split(idempotenceSweepCommand).length - 1 === 1
    && sequentialSweepPrerequisites.includes(`'${idempotenceSweepCommand}'`)
    && concurrentSweepCommands.every(command => (
      runner.split(command).length - 1 === 1
      && concurrentSweepSection.includes(`'${command}'`)
    ))
    && !runner.includes('node scripts/verify-polymythcal-sets13-15-browser.js --dom-only')
    && runner.includes('Math.min(concurrency, 3, concurrentReadOnlySweeps.length)')
    && runner.indexOf('await Promise.all(Array.from({ length: sweepConcurrency }, sweepWorker))')
      > runner.indexOf('for (const cmd of sequential)')
    && runner.indexOf('await Promise.all(Array.from({ length: sweepConcurrency }, sweepWorker))')
      < runner.indexOf('let index = 0, passed = 0'),
  'full runner must serialize idempotence before executing each browser sweep once in its bounded post-build pool',
);
check(!build.includes('verify-visible-geometry-browser.mjs'), 'browser geometry gate must remain outside the production/Netlify build');
check(!build.includes('verify-front-facing-overlap-browser.js'), 'rendered front-facing/overlap gate must remain outside the production/Netlify build');
check(!build.includes('verify-polymythcal-destination-browser.js'), 'destination Chromium gate must remain outside the production/Netlify build');
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
    && build.indexOf('verify-front-facing-boundary.js') < build.indexOf('verify-polymyth-entry-points.js --site-only'),
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
check(!build.includes('update-polymythcal-editable-master-'), 'canonical deploy build must not mutate private editable masters');
check((build.match(/verify-polymyth-coherence-workbook\.py/g) || []).length === 0, 'canonical deploy build must delegate workbook checks through the site-only entry-point verifier');
check((build.match(/node scripts\/verify-polymyth-entry-points\.js --site-only/g) || []).length === 1, 'canonical build must verify site-only Coherence entry points once after deploy parity');
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
  'RELEASE GATE CHECK PASSED — 25 discovery-v2 assets are release-bound, the canonical corpus remains private, '
  + 'Audit 49 technical-efficiency gates are current, and Audit 45 static plus Chromium translation evidence remains shipping-blocking.',
);
