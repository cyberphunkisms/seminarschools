#!/usr/bin/env node
'use strict';

/*
 * Independent adversarial tests through the public runtime plan/delivery API.
 * The examples below are synthetic and do not ratify a user's philosophical
 * position. Their provenance is the September 11 correction about repeated
 * strawman residue and the visible assistant's overbroad subsequent retraction.
 *
 * These tests establish source-binding, scope, dependency, and output controls
 * over an honestly supplied frozen record. They do not certify the completeness
 * of that record, natural-language entailment, or an external host's invocation.
 * In particular, relabelling mere permission as semantic adoption dishonestly,
 * or inventing independent reasoning, needs semantic review outside this test.
 */

const assert = require('assert');
const crypto = require('crypto');
const path = require('path');
const legacyConceptFixtureHost = require('./fixtures/ml-execution-gates/legacy-concept-fixture-host');
const {
  DEFAULT_OPENER,
  DRAFT_SCAN_ATTESTATION_SCHEMA,
  MephistodataGateError,
  canonicalOwnerRecords,
  createRuntimeGate,
  localDraftClaimBindings,
  planRequest,
} = require('./lib/mephistodata-runtime-gate');

const ROOT = path.resolve(__dirname, '..');
const SCHEMA = 'ouroboros-claim-fidelity.v1.2026-09-11';
const records = canonicalOwnerRecords(ROOT);
const registry = new Map();
const results = [];
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const copy = value => JSON.parse(JSON.stringify(value));

function source(id, author, text, kind = 'conversation') {
  return {id, kind, author, locator: `fixture/${kind}/${id}`, text, sha256: sha(text)};
}

function ref(item, quote = item.text) {
  const start = item.text.indexOf(quote);
  assert(start >= 0, `fixture reference absent from ${item.id}`);
  return {source_id: item.id, start, end: start + quote.length, quote};
}

function claim(id, item, scope, extra = {}) {
  const authority = item.author === 'user' ? 'user-authored'
    : item.author === 'assistant' ? 'assistant-authored' : 'external';
  return {id, source_ref: ref(item), authority, status: 'current', scope,
    depends_on_claim_ids: [], ...extra};
}

function context(sources, claims, responses = [], target = 'user-argument') {
  return {schema_version: SCHEMA,
    conversation_ids: sources.filter(item => item.kind === 'conversation').map(item => item.id),
    target_scopes: [target], sources, claims, responses};
}

function assessment(response, effect = 'The response answers this part of the issue.') {
  return {response_id: response.id,
    application: 'Apply the located response at the registered claim scope.', remaining_effect: effect};
}

function resolved(target, options = {}) {
  const refs = options.refs || [target.source_ref];
  return {id: options.id || 'issue-1', question: 'Does the proposed objection reach the stated claim?',
    positions: ['The objection reaches the claim.', 'The claim expressly supplies the disputed condition.'],
    target_scope: options.target || 'user-argument', target_claim_id: target.id,
    claim_scope: target.scope, response_assessments: options.assessments || [],
    combined_response: options.combined || 'The stated condition resolves the objection on its own terms.',
    disposition_basis: 'The objection assumes a condition absent from its actual target.',
    answerable: true, answer: 'The stated condition resolves this objection.',
    resolution: {kind: options.kind || 'independent-reasoning',
      response_ids: options.responseIds || [], source_refs: refs,
      explanation: 'The located material supplies the answer at the target scope.'}};
}

function survivor(target, basis, options = {}) {
  const question = options.question || 'Does the stated conclusion follow at this scope?';
  const academic = options.academic || 'The conclusion requires a premise absent from the stated argument.';
  const layman = options.layman || 'The conclusion needs a reason the argument has not supplied.';
  return {id: options.id || 'issue-1', question,
    positions: ['The conclusion follows.', 'A required premise remains unsupported.'],
    target_scope: options.target || 'user-argument', target_claim_id: target.id,
    claim_scope: target.scope, response_assessments: options.assessments || [],
    combined_response: options.combined || 'The located argument supplies no prior answer to this remaining inference.',
    disposition_basis: 'The stated objection concerns the conclusion at its actual scope.',
    answerable: false, resolution_class: options.classification || 'PARTIALLY UNRESOLVED',
    unresolved_basis: 'The located material leaves the stated question open.',
    academic_text: academic, layman_text: layman,
    finding_type: options.type || 'argument-defect',
    residual_inference: 'The stated premises do not yet establish this scoped conclusion.',
    basis_kind: options.basisKind || 'demonstrated', basis_refs: [basis]};
}

function makeCase(frozenContext, issues) {
  const result = {
    request: {ml_active: true, current_message: 'Run Ouroborosanalyses.', ouroboros_context: frozenContext},
    evidence: {evidence_status: 'user-supplied', data_basis: ['synthetic-located-source-records'],
      ouroboros: {conversation_ids: [...frozenContext.conversation_ids],
        reviewed_ids: [...frozenContext.conversation_ids], issues}},
  };
  return render(result);
}

function render(testCase) {
  const issues = testCase.evidence.ouroboros.issues.filter(issue => !issue.answerable);
  let body = 'Zero unresolved residue remains.';
  if (issues.length) {
    const section = field => issues.map(issue => `[${issue.resolution_class}] ${issue.question}\n${issue[field]}`).join('\n\n');
    body = `ACADEMIC RESIDUE\n${section('academic_text')}\n\nTLDRLAYMAN RESIDUE\n${section('layman_text')}`;
  }
  testCase.draft = `${DEFAULT_OPENER} ${body}`;
  testCase.evidence.task_answer = issues.length ? issues[0].academic_text : body;
  if (issues.length) {
    testCase.evidence.mephisto_status = 'warranted-complication';
    testCase.evidence.opposition_basis = issues[0].academic_text;
    testCase.evidence.opposition_supported = true;
    delete testCase.evidence.no_defect_basis;
  } else {
    testCase.evidence.mephisto_status = 'no-defect';
    testCase.evidence.no_defect_basis = body;
    delete testCase.evidence.opposition_basis;
    delete testCase.evidence.opposition_supported;
  }
  return testCase;
}

// This trusted fixture callback concerns work-status claims only. It supplies
// no claim-fidelity verdict and cannot turn a semantic declaration into proof.
const gate = createRuntimeGate({
  ...legacyConceptFixtureHost('legacy-oa-fidelity-fixture'),
  draftVerifierId: 'oa-fidelity-fixture-nonwork-draft.v1',
  verifyDraftWorkStatusAttestation(request) {
    const record = registry.get(`${request.draft_sha256}:${request.evidence_sha256}`);
    if (!record || record.draft !== request.draft_bytes || record.evidence !== request.evidence_bytes) return {ok: false};
    return {schema_version: DRAFT_SCAN_ATTESTATION_SCHEMA,
      verifier_id: 'oa-fidelity-fixture-nonwork-draft.v1',
      plan_integrity_sha256: request.plan_integrity_sha256,
      draft_sha256: request.draft_sha256, evidence_sha256: request.evidence_sha256,
      complete_scan_verified: true, no_unmapped_work_status_claims: true,
      claim_bindings: []};
  },
});

function deliver(testCase, afterPlan = null) {
  const originalPlan = gate.planRequest(testCase.request, {owner_records: records});
  const plan = (afterPlan && afterPlan(originalPlan, testCase)) || originalPlan;
  const bindings = localDraftClaimBindings(plan, testCase.draft);
  assert.strictEqual(bindings.length, 0, 'fixture draft accidentally contains a work-status claim');
  const evidence = JSON.stringify(testCase.evidence);
  registry.set(`${sha(testCase.draft)}:${sha(evidence)}`, {draft: testCase.draft, evidence});
  const result = gate.assertDeliverable(plan, testCase.draft, testCase.evidence);
  assert.strictEqual(result.ok, true);
  return {plan, result};
}

function run(name, factory, mutate = null, rejection = null, renderAfter = true, afterPlan = null) {
  const testCase = copy(factory());
  if (mutate) mutate(testCase);
  if (renderAfter) render(testCase);
  try {
    deliver(testCase, afterPlan);
    assert.strictEqual(rejection, null, `hostile case was permitted: ${name}`);
    results.push({name, result: 'permit'});
  } catch (error) {
    if (!rejection || !(error instanceof MephistodataGateError)) throw error;
    if (typeof rejection === 'string') assert.strictEqual(error.code, rejection, name);
    else if (rejection instanceof RegExp) assert.match(error.code, rejection, name);
    results.push({name, result: 'reject', error: error.code});
  }
}

function connectedAnswers() {
  const statement = source('u1', 'user', 'Participation requires continuing access and a practical right to refuse.');
  const first = source('u2', 'user', 'Access continues after a participant refuses.');
  const second = source('u3', 'user', 'Refusal carries no penalty, so the option is practical.');
  const target = claim('joint-condition', statement, 'The stated conditions for voluntary participation.');
  const responses = [
    {id: 'access-answer', kind: 'answer', source_ref: ref(first), addresses_claim_ids: [target.id],
      depends_on_response_ids: [], status: 'settled'},
    {id: 'refusal-answer', kind: 'answer', source_ref: ref(second), addresses_claim_ids: [target.id],
      depends_on_response_ids: ['access-answer'], status: 'settled'},
  ];
  return makeCase(context([statement, first, second], [target], responses),
    [resolved(target, {kind: 'prior-response', responseIds: responses.map(item => item.id),
      assessments: responses.map(item => assessment(item)), refs: responses.map(item => item.source_ref),
      combined: 'Continuing access and refusal without penalty jointly answer the objection.'})]);
}

function counterevidence() {
  const statement = source('u1', 'user', 'Every admitted case preserves access after refusal.');
  const answer = source('u2', 'user', 'The earlier examples preserve access after refusal.');
  const counter = source('e1', 'external', 'Admitted case B revokes access when a participant refuses.', 'external');
  const target = claim('universal', statement, 'All admitted cases and access after refusal.');
  const response = {id: 'earlier-answer', kind: 'answer', source_ref: ref(answer),
    addresses_claim_ids: [target.id], depends_on_response_ids: [], status: 'settled'};
  const issue = survivor(target, ref(counter), {assessments: [assessment(response,
    'The earlier examples remain supported; case B creates a new contrary instance.')],
    combined: 'The earlier examples and the new contrary instance have different evidential effects.',
    academic: 'Case B contradicts the universal assertion while leaving the earlier examples intact.',
    layman: 'One admitted case breaks the general claim, although the earlier examples still hold.'});
  issue.reopening = [{response_id: response.id, reason: 'contrary-evidence',
    source_refs: [ref(counter)], remaining_defect: 'The universal assertion includes the contrary case B.'}];
  return makeCase(context([statement, answer, counter], [target], [response]), [issue]);
}

function counterargumentFromExistingPremise() {
  const statement = source('u1', 'user', 'All members of A belong to B. Therefore all members of B belong to A.');
  const answer = source('u2', 'user', 'The converse follows from the stated inclusion.');
  const target = claim('converse-inference', statement, 'Whether inclusion of A in B entails inclusion of B in A.');
  const response = {id: 'converse-answer', kind: 'answer', source_ref: ref(answer),
    addresses_claim_ids: [target.id], depends_on_response_ids: [], status: 'settled'};
  const issue = survivor(target, ref(statement), {
    question: 'Do A and B in the intended case have the same members?',
    assessments: [assessment(response, 'The earlier answer asserts the converse, which the original premise does not entail.')],
    combined: 'The original inclusion and the previous answer leave the countermodel A={1}, B={1,2} available.',
    academic: 'Both equal sets and the countermodel A={1}, B={1,2} satisfy the original inclusion. The inference to equality fails while equality in the intended case remains undecided.',
    layman: 'The sets could have exactly the same members, or B could have an extra member. The given condition allows both.'});
  issue.positions = ['The original inclusion entails its converse.', 'The original inclusion permits a larger second set.'];
  issue.residual_inference = 'Equality in the intended case remains undetermined by the stated one-way inclusion.';
  issue.reopening = [{response_id: response.id, reason: 'counterargument',
    source_refs: [ref(statement)],
    remaining_defect: 'The already-stated premise permits A={1}, B={1,2}, so the converse conclusion fails.'}];
  return makeCase(context([statement, answer], [target], [response]), [issue]);
}

function assistantAudit() {
  const instruction = source('u1', 'user', 'Audit the assistant paragraph.');
  const draft = source('a1', 'assistant', 'Access alone guarantees that participation is voluntary.', 'artifact');
  const basis = source('e1', 'external', 'Access can coexist with a penalty for refusal.', 'external');
  const target = claim('draft-claim', draft, 'The assistant paragraph about voluntary participation.');
  return makeCase(context([instruction, draft, basis], [target], [], 'assistant-work'),
    [survivor(target, ref(basis), {target: 'assistant-work', type: 'assistant-defect'})]);
}

function externalArgument() {
  const instruction = source('u1', 'user', 'Assess the external argument on its own terms.');
  const statement = source('e1', 'external', 'Access alone guarantees that participation is voluntary.', 'external');
  const counter = source('e2', 'external', 'Case D permits access while imposing a penalty for refusal.', 'external');
  const target = claim('external-claim', statement, 'The external claim that access guarantees voluntary participation.');
  return makeCase(context([instruction, statement, counter], [target], [], 'external-argument'),
    [survivor(target, ref(counter), {target: 'external-argument'})]);
}

function settledPremiseAndOpenInference() {
  const premise = source('u1', 'user', 'Access is one condition for voluntary participation.');
  const inference = source('u2', 'user', 'Every case with access is voluntary.');
  const answer = source('u3', 'user', 'Access is a necessary condition in this model.');
  const counter = source('e1', 'external', 'Case D permits access while imposing a penalty for refusal.', 'external');
  const base = claim('necessary-condition', premise, 'The necessary condition of access.');
  const target = claim('sufficiency-inference', inference, 'The inference that access alone is sufficient.', {
    depends_on_claim_ids: [base.id]});
  const response = {id: 'premise-answer', kind: 'answer', source_ref: ref(answer),
    addresses_claim_ids: [base.id], depends_on_response_ids: [], status: 'settled'};
  const issue = survivor(target, ref(counter), {
    assessments: [assessment(response, 'The necessary condition stands; the sufficiency inference remains challenged.')],
    combined: 'The settled necessary condition and the contrary case do not jointly establish sufficiency.',
    academic: 'Case D challenges sufficiency while the accepted necessary condition remains intact.',
    layman: 'Access is still required, but access alone does not settle whether participation is voluntary.'});
  return makeCase(context([premise, inference, answer, counter], [base, target], [response]), [issue]);
}

function evidenceGap() {
  const instruction = source('u1', 'user', 'Determine the wording of the missing manuscript.');
  const inventory = source('e1', 'external', 'The only manuscript was destroyed and no transcription is preserved.', 'external');
  const target = claim('missing-wording', inventory, 'The precise wording of the destroyed manuscript.');
  return makeCase(context([instruction, inventory], [target], [], 'source-evidence'),
    [survivor(target, ref(inventory), {target: 'source-evidence', type: 'evidence-limit',
      basisKind: 'evidence-limit', classification: 'UNRESOLVABLE',
      question: 'What was the precise wording of the destroyed manuscript?',
      academic: 'The surviving inventory establishes the loss and supplies no text from which to recover the wording.',
      layman: 'The manuscript is gone and the inventory contains none of its words.'})]);
}

function adoption() {
  const draft = source('a1', 'assistant', 'Entry requires both continuing access and a practical right to refuse.', 'artifact');
  const adoptionTurn = source('u1', 'user', 'I adopt the claim that entry requires both continuing access and a practical right to refuse.');
  const permission = source('u2', 'user', 'Update the document.');
  const target = claim('adopted-claim', draft, 'The explicitly adopted conditions for entry.', {
    authority: 'user-adopted', adoption: {purpose: 'semantic-adoption', source_ref: ref(adoptionTurn)}});
  return makeCase(context([draft, adoptionTurn, permission], [target]), [resolved(target)]);
}

function correctionDependencies() {
  const initial = source('u1', 'user', 'The model requires access alone.');
  const correction = source('u2', 'user', 'The model requires both access and an effective right to refuse.');
  const independent = source('e1', 'external', 'The archive contains no date for independent case C.', 'external');
  const replaced = claim('old-premise', initial, 'The earlier participation condition.', {status: 'superseded'});
  const dependent = claim('dependent', correction, 'The inference about the corrected participation condition.', {
    depends_on_claim_ids: [replaced.id]});
  const separate = claim('independent', independent, 'The date of independent case C.');
  const response = {id: 'correct-condition', kind: 'correction', source_ref: ref(correction),
    addresses_claim_ids: [replaced.id], depends_on_response_ids: [], status: 'settled'};
  const first = resolved(dependent, {kind: 'correction', responseIds: [response.id],
    assessments: [assessment(response)], refs: [ref(correction)]});
  const second = survivor(separate, ref(independent), {id: 'issue-2', target: 'source-evidence',
    type: 'evidence-limit', basisKind: 'evidence-limit',
    question: 'When did independent case C occur?',
    academic: 'The archive does not supply a date for independent case C.',
    layman: 'The date of case C remains unknown.'});
  const frozen = context([initial, correction, independent], [replaced, dependent, separate], [response]);
  frozen.target_scopes.push('source-evidence');
  return makeCase(frozen, [first, second]);
}

// Positive controls stop fidelity safeguards becoming an agreement mechanism.
run('connected prior answers produce the exact zero result', connectedAnswers);
run('new contrary evidence may challenge a settled user claim', counterevidence);
run('a counterargument from existing premises may challenge a current settled claim', counterargumentFromExistingPremise);
run('an explicitly requested assistant-target audit remains admissible', assistantAudit);
run('an external opponent remains open to source-grounded criticism', externalArgument);
run('a downstream objection can preserve its settled upstream premise', settledPremiseAndOpenInference);
run('a genuine source-evidence limitation remains admissible', evidenceGap);
run('explicit semantic adoption has distinct provenance', adoption);
run('correction repairs dependent reasoning and preserves independent residue', correctionDependencies);
run('mutating the request after planning leaves the frozen context intact', connectedAnswers,
  null, null, true, (plan, testCase) => {
    const before = JSON.stringify(plan.ouroboros_context);
    assert(Object.isFrozen(plan.ouroboros_context));
    assert(Object.isFrozen(plan.ouroboros_context.claims[0]));
    testCase.request.ouroboros_context.claims[0].scope = 'A later caller mutation.';
    assert.strictEqual(JSON.stringify(plan.ouroboros_context), before);
    return plan;
  });

// Each mutant changes one material control of an otherwise passing API case.
run('missing frozen context cannot be supplied only at delivery', connectedAnswers, c => {
  delete c.request.ouroboros_context;
}, 'MISSING_OUROBOROS_CONTEXT');
run('a quoted claim must match its literal source bytes', connectedAnswers, c => {
  c.request.ouroboros_context.claims[0].source_ref.quote = 'Participation requires access alone.';
}, 'OUROBOROS_SOURCE_BINDING_FAILURE');
run('a source digest must bind the supplied source text', connectedAnswers, c => {
  c.request.ouroboros_context.sources[0].sha256 = '0'.repeat(64);
}, 'OUROBOROS_SOURCE_BINDING_FAILURE');
run('an assistant claim cannot be relabelled user-authored', assistantAudit, c => {
  c.request.ouroboros_context.claims[0].authority = 'user-authored';
}, 'OUROBOROS_ATTRIBUTION_FAILURE');
run('a disputed draft cannot become an accepted user argument', assistantAudit, c => {
  c.request.ouroboros_context.target_scopes = ['user-argument'];
  c.request.ouroboros_context.claims[0].status = 'disputed';
  const issue = c.evidence.ouroboros.issues[0];
  issue.target_scope = 'user-argument'; issue.finding_type = 'argument-defect';
}, 'OUROBOROS_ATTRIBUTION_FAILURE');
run('mutation authorization is not semantic adoption', adoption, c => {
  const adoptionRecord = c.request.ouroboros_context.claims[0].adoption;
  adoptionRecord.purpose = 'mutation-authorization';
  adoptionRecord.source_ref = ref(c.request.ouroboros_context.sources.find(item => item.id === 'u2'));
}, 'OUROBOROS_ADOPTION_FAILURE');
run('adoption requires located adoption evidence', adoption, c => {
  delete c.request.ouroboros_context.claims[0].adoption.source_ref;
}, 'OUROBOROS_SOURCE_BINDING_FAILURE');
run('the trace cannot silently change the claim scope', connectedAnswers, c => {
  c.evidence.ouroboros.issues[0].claim_scope = 'Whether access always guarantees voluntary participation.';
}, 'OUROBOROS_TARGET_FAILURE');
run('a method label cannot bypass the frozen user-argument target', counterevidence, c => {
  c.evidence.ouroboros.issues[0].target_scope = 'method';
  c.evidence.ouroboros.issues[0].finding_type = 'method-defect';
}, 'OUROBOROS_TARGET_FAILURE');
run('the whole-conversation inventory cannot omit a frozen turn', connectedAnswers, c => {
  c.evidence.ouroboros.reviewed_ids.pop();
}, 'INCOMPLETE_WHOLE_CONVERSATION_REVIEW');
run('connected prior answers cannot be selectively omitted', connectedAnswers, c => {
  c.evidence.ouroboros.issues[0].response_assessments.pop();
}, 'OUROBOROS_PRIOR_RESPONSE_FAILURE');
run('a settled answer cannot be reopened without located justification', counterevidence, c => {
  delete c.evidence.ouroboros.issues[0].reopening;
}, 'OUROBOROS_REOPENING_FAILURE');
run('the original settled answer cannot masquerade as new counterevidence', counterevidence, c => {
  const issue = c.evidence.ouroboros.issues[0];
  issue.reopening[0].source_refs = [c.request.ouroboros_context.responses[0].source_ref];
}, 'OUROBOROS_REOPENING_FAILURE');
run('a hypothetical warning cannot be declared a demonstrated finding', counterevidence, c => {
  c.evidence.ouroboros.issues[0].basis_kind = 'hypothetical';
}, 'OUROBOROS_UNGROUNDED_RESIDUE');
run('missing evidence cannot silently become a demonstrated argument defect', evidenceGap, c => {
  c.evidence.ouroboros.issues[0].finding_type = 'argument-defect';
}, 'OUROBOROS_UNGROUNDED_RESIDUE');
run('dependent corrections must enter the response assessment', correctionDependencies, c => {
  c.evidence.ouroboros.issues[0].response_assessments = [];
}, 'OUROBOROS_PRIOR_RESPONSE_FAILURE');
run('an unrelated correction cannot discharge independent residue', correctionDependencies, c => {
  const frozen = c.request.ouroboros_context;
  const unrelated = frozen.claims.find(item => item.id === 'independent');
  c.evidence.ouroboros.issues[1] = resolved(unrelated, {id: 'issue-2', target: 'source-evidence',
    kind: 'correction', responseIds: ['correct-condition'], refs: [frozen.responses[0].source_ref]});
}, 'OUROBOROS_DEPENDENCY_FAILURE');
run('resolved issues cannot leak into the final survivor output', connectedAnswers, c => {
  c.draft += ' A further question remains.';
}, 'NON_RESIDUE_OUTPUT', false);
run('academic and plain-language sections cannot diverge from the exact survivor set', evidenceGap, c => {
  c.draft = c.draft.replace('TLDRLAYMAN RESIDUE', 'A DIFFERENT QUESTION');
}, 'NON_RESIDUE_OUTPUT', false);
run('changing the planned context without rebinding integrity is rejected', connectedAnswers,
  null, 'PLAN_INTEGRITY_FAILURE', true, plan => {
    const forged = copy(plan);
    forged.ouroboros_context.claims[0].scope = 'A changed planned target.';
    return forged;
  });

const summary = {suite: 'ouroboros-claim-fidelity', cases: results.length,
  permitted: results.filter(item => item.result === 'permit').length,
  rejected: results.filter(item => item.result === 'reject').length,
  scope: 'Public plan/assert structural source-binding, dependency, attribution, and output controls.',
  limitations: 'No certification of natural-language entailment, supplied-context completeness, dishonest semantic-adoption labels, or external chat-host invocation.',
  results};
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
