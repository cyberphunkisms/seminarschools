#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  BLOOM_OPENER,
  CORRECTION_ATTESTATION_SCHEMA,
  DEGORGONIFIED_FEMINISM_LABEL,
  DEGORGONIFIED_FEMINISM_OWNER_SPECS,
  DEFAULT_OPENER,
  DRAFT_SCAN_ATTESTATION_SCHEMA,
  MephistodataGateError,
  OUROBOROS_OWNER,
  WORK_ATTESTATION_SCHEMA,
  assertDeliverable,
  canonicalEntrySha,
  canonicalOwnerRecords,
  createRuntimeGate,
  definitionOwnerMatches,
  invokesDegorgonifiedFeminism,
  isCategoricalRetraction,
  standaloneAssertedStatementSpan,
  localDraftClaimBindings,
  parseWorkStatusClaims,
  planRequest,
} = require('./lib/mephistodata-runtime-gate');

const ROOT = path.resolve(__dirname, '..');
const FIXTURE_PATH = path.join(
  ROOT,
  'scripts/fixtures/ml-execution-gates/mephistodata-runtime-gate-hostile-fixtures.json',
);
const failures = [];
const TRUSTED_WORK_RECEIPTS = new Set([
  'e6afb7121a521e04f6a75eb3834b1e345c3f90592a0b062c276c5118d9401d66',
  '56ce22044821f0601cc20234c5e005deb2b02daf48fbd4fce84e63bbc526187b',
  '0eaa8b6b5ec901e5efd54a593cb23bce8767230eacd23e503e357e15862b18cc',
  'f055e5524fac46027079983c46e60b2034f8ac31e672bf649aab72d415eac4a0',
  'd4327f31e14837cf02803cab86faf934eb88fecf36673c2d2111d9f96c46b474',
  '392e98963876698be2a24ad97329814ca3306c8ef6da1ecc5941d21e69beb62e',
]);
const TRUSTED_CORRECTION_RECEIPTS = new Map([
  ['3d350c6e8e37709228f82fbfe3e843aae5262787f872748f804d5417845f00a9', '15d1e1cf8a2f93487d9e5517c2f6f7b189d8bb2b8cccea0e6621aaea584a57cd'],
  ['bf42d5a81c13b47177ea3154914b20cddb14e70d6f0731a390d8e606827fb581', '9136184ffb36a234d2ea6f5ef834a4159b858c22d98f61a3c6b5249da2404777'],
]);
const TRUSTED_DRAFT_SCAN_BEHAVIORS = new Map([
  ['421d68483643d47cc6f8d2b205e94e27c65b322697bbaff8292ca39d8f62c373:edc97b5ae3d9ab051338caa36d590be4b0e9fb415cd4dc860bd7e95ac075631f', 'unmapped'],
  ['705f43d62786d687a8bf9df88fc4accc0368b62a73770210f6088ec1a5436224:82b3eae06cfd05a1b5f031191ea76e24a48259bc53d75a2067c26397e9ca778f', 'all-nonclaim'],
  ['582d786eeb637cdccf60c47021d101a085089c39665a41cb6ac1ebda386f34ec:209471de04d9a6a309544fc2036e24b4a99c72ec40fa597db7203db9c7953ae6', 'wrong-verifier-id'],
  ['2d2a9dfd3b5623983f0717370b3fe06de68e0b950d15c98d69cbc0204d062ef9:d99365ec7f086949e5f33c60d1fdbbb3e7b45735036ed318b5c6f3057f519fbf', 'wrong-draft-hash'],
  ['5bce748726bc40c00d9a2d54d71cd65a55d02b276edd76e20e0bffb689a28255:4e79707c8694653b01e865f1a7b15e7ca75345aedd0b368eb40e2e7d8dbc4c81', 'wrong-evidence-hash'],
  ['f676412d3fc6e201abe7a13367913e0822a6dbb9f7b1b7241efb47b97795130c:fb0b75c6d4a8710a0984e3e9c36e74e4fc7fce3a015d6217a6c5183adee10a62', 'wrong-binding'],
  ['727939cdeda6d5b037ae734b2006ee9c440b975bc88b730b6525769ec4dd5254:7fe5627c01cd53e75b00726ed0548d1ed00f714f0177feab1a334a9eed588d5c', 'incomplete-scan'],
  ['416256056333e7a6c87fad962d7d02992f86e7762aa6b795cda43bc3d88c24d2:4c65f280460b8ad00d59814c53907dfad09f03f0c70ce4f1cfffffe31a8ddee8', 'mixed-duplicate'],
]);
let DRAFT_SCAN_REGISTRY = new Map();

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function verifyWorkClaimEvidence(request) {
  if (!TRUSTED_WORK_RECEIPTS.has(request.receipt_sha256)) return {ok: false};
  return {
    schema_version: WORK_ATTESTATION_SCHEMA,
    verifier_id: 'fixture-host-work-verifier.v1',
    ok: true,
    plan_integrity_sha256: request.plan_integrity_sha256,
    draft_sha256: request.draft_sha256,
    claim_text: request.claim_text,
    claim_sha256: request.claim_sha256,
    parsed_claim: JSON.parse(JSON.stringify(request.parsed_claim)),
    receipt_sha256: request.receipt_sha256,
    receipt_origin: request.receipt_origin,
    ledger_manifest_sha256: request.ledger_manifest_sha256,
    resolved_evidence_refs: [...request.evidence_refs],
    population_total: request.population_total,
    completed_total: request.completed_total,
    unresolved_total: request.unresolved_total,
    excluded_total: request.excluded_total,
    operations: [...request.operations],
    operation_counts: {...request.operation_counts},
    completion_condition_sha256: request.completion_condition_sha256,
    elapsed_seconds: request.elapsed_seconds,
    worker_count: request.worker_count,
    modes: [...request.modes],
    reported_duration_seconds: request.reported_duration_seconds,
    receipt_verified: true,
    ledger_manifest_resolved: true,
    unit_records_verified: true,
    depth_verified: true,
    capacity_plausible: true,
  };
}

function verifyCorrectionEvidence(request) {
  const trustedBodySha256 = TRUSTED_CORRECTION_RECEIPTS.get(request.correction_receipt_sha256);
  if (!trustedBodySha256 || request.body_sha256 !== trustedBodySha256
      || sha256(request.body_bytes) !== request.body_sha256
      || sha256(request.draft_bytes) !== request.draft_sha256) return {ok: false};
  return {
    schema_version: CORRECTION_ATTESTATION_SCHEMA,
    verifier_id: 'fixture-host-correction-verifier.v1',
    ok: true,
    plan_integrity_sha256: request.plan_integrity_sha256,
    draft_sha256: request.draft_sha256,
    body_sha256: request.body_sha256,
    prior_claim_sha256: request.prior_claim_sha256,
    retraction_sha256: request.retraction_sha256,
    retraction_span: {...request.retraction_span},
    replacement_status_sha256: request.replacement_status_sha256,
    replacement_status_span: {...request.replacement_status_span},
    impact_statement_sha256: request.impact_statement_sha256,
    impact_statement_span: {...request.impact_statement_span},
    none_supported_statement_span: request.none_supported_statement_span
      ? {...request.none_supported_statement_span}
      : null,
    correction_receipt_sha256: request.correction_receipt_sha256,
    impact_mode: request.impact_mode,
    dependency_action: request.dependency_action,
    affected_artifacts: [...request.affected_artifacts],
    affected_conclusions: [...request.affected_conclusions],
    resolved_repair_refs: [...request.repair_evidence_refs],
    resolved_impact_refs: [...request.impact_evidence_refs],
    prior_claim_located: true,
    categorical_retraction_verified: true,
    replacement_asserted_verified: true,
    impact_asserted_verified: true,
    no_correction_conflicts_verified: true,
    impact_search_verified: true,
    dependency_action_verified: request.impact_mode === 'affected',
  };
}

function verifyDraftWorkStatusAttestation(request) {
  const record = DRAFT_SCAN_REGISTRY.get(`${request.draft_sha256}:${request.evidence_sha256}`);
  if (!record || record.draft !== request.draft_bytes || record.evidence !== request.evidence_bytes) return {ok: false};
  const attestation = {
    schema_version: DRAFT_SCAN_ATTESTATION_SCHEMA,
    verifier_id: 'fixture-host-full-draft-classifier.v1',
    plan_integrity_sha256: request.plan_integrity_sha256,
    draft_sha256: request.draft_sha256,
    evidence_sha256: request.evidence_sha256,
    complete_scan_verified: true,
    no_unmapped_work_status_claims: record.no_unmapped_work_status_claims,
    claim_bindings: record.claim_bindings.map(binding => ({...binding})),
  };
  if (record.mutation === 'wrong-verifier-id') attestation.verifier_id = 'caller-echo.v1';
  if (record.mutation === 'wrong-draft-hash') attestation.draft_sha256 = '0'.repeat(64);
  if (record.mutation === 'wrong-evidence-hash') attestation.evidence_sha256 = '0'.repeat(64);
  if (record.mutation === 'incomplete-scan') attestation.complete_scan_verified = false;
  if (record.mutation === 'wrong-binding') {
    attestation.claim_bindings = attestation.claim_bindings.map((binding, index) => (
      index === 0 ? {...binding, claim_sha256: '0'.repeat(64)} : binding
    ));
  }
  return attestation;
}

function fail(message) {
  failures.push(message);
}

function ownerRecordsFor(fixture, records) {
  const mode = fixture.owner_registry_mode;
  if (!mode) return records;
  if (String(mode).startsWith('definition-')) {
    const spec = DEGORGONIFIED_FEMINISM_OWNER_SPECS.find(entry => entry.key === fixture.definition_owner_key);
    if (!spec) throw new Error(`unknown definition_owner_key: ${fixture.definition_owner_key}`);
    const owner = records.find(entry => definitionOwnerMatches(entry, spec));
    if (!owner) throw new Error(`canonical definition owner missing: ${spec.key}`);
    if (mode === 'definition-missing') return records.filter(entry => !definitionOwnerMatches(entry, spec));
    if (mode === 'definition-duplicate') return [...records, {...owner}];
    if (mode === 'definition-stale-body') {
      return records.map(entry => {
        if (!definitionOwnerMatches(entry, spec)) return entry;
        const stale = {...entry, b: 'An obsolete partial feminism summary without the current recall seam.'};
        stale.semantic_sha256 = canonicalEntrySha(stale);
        return stale;
      });
    }
    throw new Error(`unknown definition owner_registry_mode: ${mode}`);
  }
  const owner = records.find(entry => entry.id === OUROBOROS_OWNER);
  if (!owner) throw new Error(`canonical fixture owner missing: ${OUROBOROS_OWNER}`);
  if (mode === 'missing') return records.filter(entry => entry.id !== OUROBOROS_OWNER);
  if (mode === 'duplicate') return [...records, {...owner}];
  if (mode === 'stale-body') {
    return records.map(entry => {
      if (entry.id !== OUROBOROS_OWNER) return entry;
      const stale = {...entry, b: 'Four plausible stages reconstructed from memory.'};
      stale.semantic_sha256 = canonicalEntrySha(stale);
      return stale;
    });
  }
  throw new Error(`unknown owner_registry_mode: ${mode}`);
}

function requestForFixture(fixture, ownerRecords) {
  const request = JSON.parse(JSON.stringify(fixture.request || {}));
  if (!fixture.definition_bundle_snapshot_mode) return request;
  const probeRequest = {...request};
  delete probeRequest.definition_bundle_snapshots;
  const probe = planRequest(probeRequest, {owner_records: ownerRecords});
  if (!probe.definition_bundle) throw new Error(`snapshot fixture does not activate a definition bundle: ${fixture.id}`);
  request.definition_bundle_snapshots = probe.definition_bundle.owner_snapshots.map(snapshot => ({...snapshot}));
  if (fixture.definition_bundle_snapshot_mode === 'stale-hash') {
    request.definition_bundle_snapshots[0].semantic_sha256 = '0'.repeat(64);
  } else if (fixture.definition_bundle_snapshot_mode !== 'current') {
    throw new Error(`unknown definition_bundle_snapshot_mode: ${fixture.definition_bundle_snapshot_mode}`);
  }
  return request;
}

function assertExpectedPlan(fixture, plan) {
  const expected = fixture.expect || {};
  if (expected.mode && plan.mode !== expected.mode) {
    throw new Error(`expected mode ${expected.mode}, received ${plan.mode}`);
  }
  if (expected.opener && plan.opener !== expected.opener) {
    throw new Error(`expected opener ${expected.opener}, received ${plan.opener}`);
  }
  if (expected.owner_id && (!plan.named_method || plan.named_method.owner_id !== expected.owner_id)) {
    throw new Error(`expected owner ${expected.owner_id}`);
  }
  if (expected.definition_bundle !== undefined
      && Boolean(plan.definition_bundle) !== expected.definition_bundle) {
    throw new Error(`expected definition_bundle=${expected.definition_bundle}`);
  }
  if (expected.definition_owner_count !== undefined
      && (!plan.definition_bundle
        || plan.definition_bundle.owner_snapshots.length !== expected.definition_owner_count)) {
    throw new Error(`expected ${expected.definition_owner_count} definition owners`);
  }
  if (expected.definition_bundle === true
      && (!Object.isFrozen(plan.definition_bundle)
        || !Object.isFrozen(plan.definition_bundle.owner_snapshots)
        || !plan.definition_bundle.owner_snapshots.every(Object.isFrozen))) {
    throw new Error('definition bundle and owner snapshots must be immutable');
  }
}

function assertParserExpectation(fixture) {
  if (!fixture.parser_expect) return;
  const parsed = parseWorkStatusClaims(String(fixture.parser_text || ''));
  const operations = parsed.flatMap(claim => claim.operations.map(operation => operation.operation));
  const counts = parsed.flatMap(claim => claim.operations.map(operation => operation.count));
  const ambiguities = [...new Set(parsed.flatMap(claim => claim.quantity_ambiguities))].sort();
  const durations = parsed.map(claim => claim.reported_duration_seconds).filter(value => value !== null);
  const expected = fixture.parser_expect;
  if (parsed.length !== expected.claim_count
      || (expected.operations && JSON.stringify(operations) !== JSON.stringify(expected.operations))
      || (expected.counts && JSON.stringify(counts) !== JSON.stringify(expected.counts))
      || (expected.ambiguities && JSON.stringify(ambiguities) !== JSON.stringify([...expected.ambiguities].sort()))
      || (expected.durations && JSON.stringify(durations) !== JSON.stringify(expected.durations))
      || (expected.absolute_operation !== undefined
        && parsed.some(claim => claim.absolute_operation) !== expected.absolute_operation)) {
    throw new Error(`parser expectation mismatch for ${fixture.id}: ${JSON.stringify({operations, counts, ambiguities, durations})}`);
  }
}

const fixtureDocument = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
const fixtures = fixtureDocument.fixtures;
if (fixtureDocument.schema_version !== 'mephistodata-runtime-gate-fixtures.v4.2026-09-05') {
  fail(`runtime fixture schema drifted: ${fixtureDocument.schema_version || '<missing>'}`);
}
if (!Array.isArray(fixtures) || fixtures.length !== 141) {
  fail(`expected exactly 141 runtime fixtures and found ${Array.isArray(fixtures) ? fixtures.length : 'non-array'}`);
}
const permittedFixtures = (fixtures || []).filter(fixture => fixture.expected_pass).length;
const rejectedFixtures = (fixtures || []).filter(fixture => !fixture.expected_pass).length;
if (permittedFixtures !== 37 || rejectedFixtures !== 104) {
  fail(`expected runtime fixture polarity 37 permits / 104 rejections and found ${permittedFixtures} / ${rejectedFixtures}`);
}
const ids = new Set();
const phases = new Set(['plan', 'deliver']);
for (const fixture of fixtures || []) {
  if (!fixture.id || ids.has(fixture.id)) fail(`duplicate or missing fixture id: ${fixture.id || '<missing>'}`);
  ids.add(fixture.id);
  if (!phases.has(fixture.phase)) fail(`${fixture.id}: unknown phase ${fixture.phase}`);
  if (typeof fixture.expected_pass !== 'boolean') fail(`${fixture.id}: expected_pass must be boolean`);
  if (!fixture.expected_pass && !fixture.expected_error) fail(`${fixture.id}: hostile fixture lacks expected_error`);
  if (fixture.retraction_reject_matrix) {
    if ((fixture.contextual_retraction_reject_matrix || []).length !== 20
        || (fixture.correction_field_context_reject_matrix || []).length !== 6) {
      fail(`${fixture.id}: correction context matrices must contain 20 retraction and 6 field wrappers`);
    }
    for (const candidate of fixture.retraction_reject_matrix) {
      if (isCategoricalRetraction(candidate, fixture.retraction_claim_text)) {
        fail(`${fixture.id}: non-retraction passed the categorical retraction grammar: ${candidate}`);
      }
    }
    for (const candidate of fixture.retraction_accept_matrix || []) {
      if (!isCategoricalRetraction(candidate, fixture.retraction_claim_text)) {
        fail(`${fixture.id}: explicit retraction failed the categorical retraction grammar: ${candidate}`);
      }
    }
    if (!standaloneAssertedStatementSpan(
      `${fixture.standalone_retraction_text} Replacement status follows.`,
      fixture.standalone_retraction_text,
      true,
    )) {
      fail(`${fixture.id}: exact first-sentence retraction failed standalone occurrence binding`);
    }
    for (const candidate of fixture.contextual_retraction_reject_matrix || []) {
      if (standaloneAssertedStatementSpan(candidate, fixture.standalone_retraction_text, true)) {
        fail(`${fixture.id}: contextual retraction wrapper passed standalone occurrence binding: ${candidate}`);
      }
    }
    for (const candidate of fixture.correction_field_context_reject_matrix || []) {
      if (standaloneAssertedStatementSpan(candidate.body, candidate.text)) {
        fail(`${fixture.id}: contextual correction field passed standalone occurrence binding: ${candidate.body}`);
      }
    }
  }
}

const draftRegistryEntries = (fixtures || [])
  .filter(fixture => fixture.phase === 'deliver')
  .map(fixture => {
    const evidenceBytes = JSON.stringify(fixture.evidence || {});
    const registryBinding = `${sha256(fixture.draft)}:${sha256(evidenceBytes)}`;
    const behavior = TRUSTED_DRAFT_SCAN_BEHAVIORS.get(registryBinding) || 'default';
    const opener = fixture.draft.startsWith(BLOOM_OPENER) ? BLOOM_OPENER : DEFAULT_OPENER;
    const localClaims = localDraftClaimBindings({ml_active: fixture.request.ml_active, opener}, fixture.draft);
    const supportedTexts = new Set(((fixture.evidence && fixture.evidence.completion_claims) || [])
      .filter(claim => claim && claim.execution
        && TRUSTED_WORK_RECEIPTS.has(claim.execution.receipt_sha256))
      .map(claim => claim.claim_text));
    if (behavior === 'mixed-duplicate' && localClaims.length !== 2) {
      fail('mixed duplicate scan fixture must expose exactly two local claim occurrences');
    }
    const claimBindings = localClaims.map((claim, index) => {
      const nonclaim = behavior === 'all-nonclaim' || (behavior === 'mixed-duplicate' && index === 0);
      return {
        ...claim,
        classification: nonclaim ? 'nonclaim' : 'work-status',
        evidence_verdict: nonclaim
          ? 'not-applicable'
          : (behavior === 'mixed-duplicate' || supportedTexts.has(claim.text) ? 'supported' : 'unsupported'),
      };
    });
    return [registryBinding, {
      draft: fixture.draft,
      evidence: evidenceBytes,
      no_unmapped_work_status_claims: behavior !== 'unmapped',
      claim_bindings: claimBindings,
      mutation: ['default', 'unmapped', 'all-nonclaim', 'mixed-duplicate'].includes(behavior)
        ? null
        : behavior,
    }];
  });
for (const [binding, record] of draftRegistryEntries) {
  const prior = DRAFT_SCAN_REGISTRY.get(binding);
  if (prior && JSON.stringify(prior) !== JSON.stringify(record)) {
    fail('deliver fixtures have conflicting draft-and-evidence scan bindings');
  }
  DRAFT_SCAN_REGISTRY.set(binding, record);
}
const correctionContextCases = [];
for (const fixture of (fixtures || []).filter(candidate => candidate.post_correction_conflict_matrix)) {
  for (const conflict of fixture.post_correction_conflict_matrix) {
    const draft = `${fixture.draft} ${conflict}`;
    const evidenceBytes = JSON.stringify(fixture.evidence || {});
    const localClaims = localDraftClaimBindings({ml_active: true, opener: DEFAULT_OPENER}, draft);
    const claimBindings = localClaims.map(claim => ({
      ...claim,
      classification: 'work-status',
      evidence_verdict: 'unsupported',
    }));
    DRAFT_SCAN_REGISTRY.set(`${sha256(draft)}:${sha256(evidenceBytes)}`, {
      draft,
      evidence: evidenceBytes,
      no_unmapped_work_status_claims: true,
      claim_bindings: claimBindings,
      mutation: null,
    });
    correctionContextCases.push({fixture, draft, conflict});
  }
}

const FIXTURE_RUNTIME_GATE = createRuntimeGate({
  draftVerifierId: 'fixture-host-full-draft-classifier.v1',
  workVerifierId: 'fixture-host-work-verifier.v1',
  correctionVerifierId: 'fixture-host-correction-verifier.v1',
  verifyDraftWorkStatusAttestation,
  verifyWorkAttestation: verifyWorkClaimEvidence,
  verifyCorrectionAttestation: verifyCorrectionEvidence,
});
const DRAFT_ONLY_RUNTIME_GATE = createRuntimeGate({
  draftVerifierId: 'fixture-host-full-draft-classifier.v1',
  verifyDraftWorkStatusAttestation,
});
const mutableBootstrapConfiguration = {
  draftVerifierId: 'fixture-host-full-draft-classifier.v1',
  verifyDraftWorkStatusAttestation,
};
const IMMUTABLE_BOOTSTRAP_RUNTIME_GATE = createRuntimeGate(mutableBootstrapConfiguration);
mutableBootstrapConfiguration.draftVerifierId = 'caller-mutated-verifier.v1';
mutableBootstrapConfiguration.verifyDraftWorkStatusAttestation = () => ({complete_scan_verified: true});

const records = canonicalOwnerRecords(ROOT);
const canonicalOwners = records.filter(entry => entry.id === OUROBOROS_OWNER);
if (canonicalOwners.length !== 1) fail(`canonical OA owner count is ${canonicalOwners.length}`);
for (const spec of DEGORGONIFIED_FEMINISM_OWNER_SPECS) {
  const owners = records.filter(entry => definitionOwnerMatches(entry, spec));
  if (owners.length !== 1) fail(`canonical degorgonified-feminism owner ${spec.key} count is ${owners.length}`);
}
if (DEGORGONIFIED_FEMINISM_LABEL !== 'degorgonified feminism') {
  fail('degorgonified-feminism control label drifted');
}
for (const [text, expected] of [
  ['degorgonified feminism', true],
  ['Use degorgonified feminism.', true],
  ['The source says \u201cdegorgonified feminism\u201d.', false],
  ['The source uses degorgonified feminism as wording.', false],
  ['`degorgonified feminism`', false],
  ['```text\ndegorgonified feminism\n```', false],
]) {
  if (invokesDegorgonifiedFeminism(text) !== expected) {
    fail(`degorgonified-feminism invocation parser mismatch for ${JSON.stringify(text)}`);
  }
}

let adjudicated = 0;
for (const fixture of fixtures || []) {
  try {
    assertParserExpectation(fixture);
  } catch (error) {
    fail(error.message);
  }
  let passed = false;
  let error = null;
  try {
    const ownerRecords = ownerRecordsFor(fixture, records);
    const request = requestForFixture(fixture, ownerRecords);
    const plan = planRequest(request, {owner_records: ownerRecords});
    if (fixture.phase === 'plan') {
      assertExpectedPlan(fixture, plan);
    } else {
      if (fixture.caller_supplied_trust_root) {
        assertDeliverable(plan, fixture.draft, fixture.evidence, {
          verifyWorkAttestation: verifyWorkClaimEvidence,
        });
      } else if (fixture.omit_draft_verifier) {
        assertDeliverable(plan, fixture.draft, fixture.evidence);
      } else if (fixture.bootstrap_config_mutation) {
        IMMUTABLE_BOOTSTRAP_RUNTIME_GATE.assertDeliverable(plan, fixture.draft, fixture.evidence);
      } else if (fixture.omit_trusted_verifier) {
        DRAFT_ONLY_RUNTIME_GATE.assertDeliverable(plan, fixture.draft, fixture.evidence);
      } else {
        FIXTURE_RUNTIME_GATE.assertDeliverable(plan, fixture.draft, fixture.evidence);
      }
    }
    passed = true;
  } catch (caught) {
    error = caught;
  }
  if (passed !== fixture.expected_pass) {
    fail(`${fixture.id}: expected pass=${fixture.expected_pass} and observed pass=${passed}${error ? ` (${error.code || error.name}: ${error.message})` : ''}`);
  } else if (!fixture.expected_pass) {
    if (!(error instanceof MephistodataGateError)) {
      fail(`${fixture.id}: hostile fixture failed outside the runtime gate: ${error && error.message}`);
    } else if (error.code !== fixture.expected_error) {
      fail(`${fixture.id}: expected ${fixture.expected_error} and received ${error.code}`);
    }
  }
  adjudicated += 1;
}

if (correctionContextCases.length !== 3) fail(`expected 3 post-correction conflict cases and found ${correctionContextCases.length}`);
for (const {fixture, draft, conflict} of correctionContextCases) {
  try {
    const plan = planRequest(fixture.request, {owner_records: records});
    FIXTURE_RUNTIME_GATE.assertDeliverable(plan, draft, fixture.evidence);
    fail(`post-correction conflict was accepted: ${conflict}`);
  } catch (error) {
    if (!(error instanceof MephistodataGateError) || error.code !== 'UNREPAIRED_FALSE_CLAIM') {
      fail(`post-correction conflict returned ${error && (error.code || error.message)}: ${conflict}`);
    }
  }
}

const source = fs.readFileSync(path.join(ROOT, 'scripts/lib/mephistodata-runtime-gate.js'), 'utf8');
for (const needle of [
  'function planRequest(',
  'function assertDeliverable(',
  'planRequest:before-generation',
  'assertDeliverable:before-delivery',
  'STALE_METHOD_OWNER',
  'MISSING_DEFINITION_OWNER',
  'AMBIGUOUS_DEFINITION_OWNER',
  'STALE_DEFINITION_OWNER',
  'STALE_DEFINITION_OWNER_SNAPSHOT',
  'INCOMPLETE_DEFINITION_BUNDLE',
  'DEFINITION_BUNDLE_CONTRADICTION',
  'function invokesDegorgonifiedFeminism(',
  'function validateDegorgonifiedFeminismBundle(',
  'BLOOM_QUESTION_FIRST',
  'NON_RESIDUE_OUTPUT',
  'function validateCompletionClaims(',
  'function parseWorkStatusClaims(',
  'function validateWorkAttestation(',
  'function validateDraftWorkStatusScan(',
  'UNRESOLVED_DRAFT_WORK_STATUS_SCAN',
  'UNMAPPED_DRAFT_WORK_STATUS',
  'complete_scan_verified',
  'no_unmapped_work_status_claims',
  'CALLER_SUPPLIED_TRUST_ROOT',
  'MISSING_COMPLETION_EVIDENCE',
  'UNRESOLVED_COMPLETION_EVIDENCE',
  'FALSE_COMPLETION_CLAIM',
  'UNREPAIRED_FALSE_CLAIM',
]) {
  if (!source.includes(needle)) fail(`runtime owner missing ${needle}`);
}
for (const fixtureId of [
  'plan_degorgonified_feminism_bundle_pass',
  'plan_degorgonified_feminism_quoted_nontrigger_pass',
  'plan_degorgonified_feminism_inline_code_nontrigger_pass',
  'plan_degorgonified_feminism_fenced_code_nontrigger_pass',
  'plan_degorgonified_feminism_source_occurrence_nontrigger_pass',
  'plan_degorgonified_feminism_current_snapshots_pass',
  'plan_degorgonified_feminism_outside_ml_fail',
  'plan_degorgonified_feminism_missing_owner_fail',
  'plan_degorgonified_feminism_duplicate_owner_fail',
  'plan_degorgonified_feminism_stale_owner_fail',
  'plan_degorgonified_feminism_stale_snapshot_fail',
  'deliver_degorgonified_feminism_bundle_pass',
  'deliver_degorgonified_feminism_partial_bundle_fail',
  'deliver_degorgonified_feminism_clean_subtype_fail',
  'deliver_degorgonified_feminism_wikipedia_authority_fail',
  'deliver_degorgonified_feminism_white_when_fail',
  'deliver_degorgonified_feminism_slavery_equivalence_fail',
  'deliver_degorgonified_feminism_provenance_collapse_fail',
  'deliver_degorgonified_feminism_mixed_authority_upgrade_fail',
]) {
  if (!ids.has(fixtureId)) fail(`required degorgonified-feminism fixture is missing: ${fixtureId}`);
}
for (const fixtureId of [
  'deliver_681_review_claim_without_ledger_fail',
  'deliver_generic_verified_laundering_fail',
  'deliver_batch_classification_as_review_fail',
  'deliver_sample_as_all_review_fail',
  'deliver_completion_count_inflation_fail',
  'deliver_receipt_free_review_fail',
  'deliver_681_batch_truthful_status_pass',
  'deliver_all_three_reviewed_with_receipts_pass',
  'deliver_second_unmapped_completion_claim_fail',
  'deliver_apology_without_false_claim_repair_fail',
  'deliver_false_claim_retraction_and_freeze_pass',
  'deliver_fabricated_681_self_receipt_fail',
  'deliver_fabricated_681_host_receipt_unresolved_fail',
  'deliver_missing_injected_verifier_fail',
  'deliver_duration_count_laundering_fail',
  'deliver_compound_review_verify_missing_lane_fail',
  'deliver_unquantified_review_without_ledger_fail',
  'deliver_equivalent_assessment_without_ledger_fail',
  'deliver_job_done_without_ledger_fail',
  'deliver_negated_review_excluded_pass',
  'deliver_quoted_review_excluded_pass',
  'deliver_uncertain_review_excluded_pass',
  'deliver_hypothetical_review_excluded_pass',
  'deliver_prohibition_review_excluded_pass',
  'deliver_third_party_attributed_review_excluded_pass',
  'deliver_dated_audit_with_trusted_receipt_pass',
  'deliver_empty_correction_impact_fail',
  'deliver_none_supported_correction_with_trusted_scan_pass',
  'deliver_none_supported_correction_without_trusted_scan_fail',
  'deliver_checked_over_equivalent_without_ledger_fail',
  'deliver_covered_equivalent_without_ledger_fail',
  'deliver_gone_through_equivalent_without_ledger_fail',
  'deliver_caller_supplied_trust_root_fail',
  'deliver_checked_corpus_without_ledger_fail',
  'deliver_vetted_every_witness_without_ledger_fail',
  'deliver_finished_going_through_681_without_ledger_fail',
  'deliver_careful_pass_681_without_ledger_fail',
  'deliver_endorsed_681_quote_without_ledger_fail',
  'deliver_answer_681_quote_without_ledger_fail',
  'deliver_generic_completion_equivalents_without_ledger_fail',
  'deliver_passive_checked_every_source_without_ledger_fail',
  'deliver_morphology_equivalents_without_ledger_fail',
  'deliver_broad_fallback_completion_without_ledger_fail',
  'deliver_repeated_review_predicate_smaller_ledger_fail',
  'deliver_unsupported_quantity_forms_fail',
  'deliver_every_one_population_binding_without_ledger_fail',
  'deliver_abbreviated_duration_binding_without_ledger_fail',
  'deliver_markup_mentions_excluded_pass',
  'deliver_negation_denial_variants_excluded_pass',
  'deliver_attributed_third_party_variants_excluded_pass',
  'deliver_modality_directive_variants_excluded_pass',
  'deliver_attributed_endorsement_without_ledger_fail',
  'deliver_worker_count_cannot_replace_681_fail',
  'deliver_batch_count_cannot_replace_681_fail',
  'deliver_compact_duration_must_match_execution_fail',
  'deliver_decimal_duration_must_match_execution_fail',
  'deliver_signed_off_been_through_without_ledger_fail',
  'deliver_negative_residual_completion_without_ledger_fail',
  'deliver_status_fragments_without_ledger_fail',
  'deliver_probable_review_without_ledger_fail',
  'deliver_retract_nothing_fail',
  'deliver_conditional_retraction_fail',
  'deliver_retraction_of_retraction_fail',
  'deliver_retract_accusation_fail',
  'deliver_quoted_retraction_rejected_fail',
  'deliver_affirmative_double_negations_without_ledger_fail',
  'deliver_slash_date_does_not_replace_681_fail',
  'deliver_metadata_numbers_cannot_replace_681_fail',
  'deliver_partial_ratio_counts_bind_numerator_fail_without_evidence',
  'deliver_clock_duration_must_match_execution_fail',
  'deliver_number_word_duration_must_match_execution_fail',
  'deliver_modal_attribution_script_exclusions_pass',
  'deliver_host_scan_unmapped_affirmative_matrix_fail',
  'deliver_host_scan_nonclaim_matrix_pass',
  'deliver_missing_full_draft_scanner_fail',
  'deliver_wrong_draft_scanner_id_fail',
  'deliver_wrong_draft_scan_hash_fail',
  'deliver_wrong_draft_scan_evidence_hash_fail',
  'deliver_wrong_draft_scan_claim_binding_fail',
  'deliver_incomplete_draft_scan_fail',
  'deliver_bootstrap_configuration_mutation_pass',
  'deliver_unsupported_numeric_encoding_matrix_fail',
  'deliver_duration_encoding_matrix_must_match_execution_fail',
  'deliver_duplicate_text_mixed_scan_classification_fail',
]) {
  if (!ids.has(fixtureId)) fail(`required truthful work-claim fixture is missing: ${fixtureId}`);
}
if (DEFAULT_OPENER !== 'Mephistodata would say:') fail('default opener constant drifted');
if (BLOOM_OPENER !== 'Mephistodata bloomed:') fail('Bloom opener constant drifted');

if (failures.length) {
  console.error('MEPHISTODATA RUNTIME GATE FAILED');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`MEPHISTODATA RUNTIME GATE PASS — ${adjudicated}/${fixtures.length} (${permittedFixtures} permits / ${rejectedFixtures} rejections)`);
