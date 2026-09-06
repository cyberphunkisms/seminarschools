#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {parseSeedWithAddenda} = require('./lib/parse-seed-with-addenda');
const {
  classifyMutations,
  mutationBindingSha256,
  recordState,
  sha256,
  verifySnapshot,
} = require('./verify-baseline-morality-amendment-scope');

const ROOT = path.resolve(__dirname, '..');
const contract = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'data/baseline-morality-amendment-scope-contract.json'),
  'utf8',
));
const canonicalHtml = fs.readFileSync(path.join(ROOT, contract.canonical_source), 'utf8');
const canonicalEntries = parseSeedWithAddenda(canonicalHtml);
const canonicalRecovery = fs.readFileSync(path.join(ROOT, contract.recovery_source.path), 'utf8');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assert(condition, message) {
  if (!condition) {
    console.error(`BASELINE MORALITY HOSTILE-MUTATION TEST FAILED — ${message}`);
    process.exit(1);
  }
}

function evaluate(entries = canonicalEntries, recoveryText = canonicalRecovery, authorization = null, customContract = contract) {
  return verifySnapshot({contract: customContract, entries, recoveryText, authorization});
}

function expectRejected(name, entries, recoveryText = canonicalRecovery, authorization = null, customContract = contract) {
  const result = evaluate(entries, recoveryText, authorization, customContract);
  assert(!result.ok, `${name} was accepted`);
  return result;
}

function findEntry(entries, frozenId) {
  const found = entries.find(entry => recordState(entry).record_id === frozenId);
  assert(found, `fixture cannot find ${frozenId}`);
  return found;
}

function authorizationFor(mutations, directive) {
  const envelope = {
    schema_version: 1,
    source: {
      type: 'direct_user_message',
      reference: 'fixture-user-turn',
      directive,
      directive_sha256: sha256(directive),
    },
    mutations: mutations.map(mutation => ({
      action: mutation.action,
      record_id: mutation.record_id,
      before: mutation.before,
      after: mutation.after,
      binding_sha256: mutationBindingSha256(mutation),
    })),
  };
  const raw = `${JSON.stringify(envelope, null, 2)}\n`;
  return {raw, expectedSha256: sha256(raw)};
}

const clean = evaluate();
assert(clean.ok, `canonical fixture failed: ${clean.errors.join('; ')}`);
assert(clean.currentCount === 11, `canonical fixture found ${clean.currentCount}/11 records`);
assert(clean.mutations.length === 0, 'canonical fixture reports a mutation');

const bodyChanged = clone(canonicalEntries);
findEntry(bodyChanged, 'rhetoric-taxonomy-baselinemorality-four-stage-chain-2026-07-29').b += '\nUnauthorized amendment.';
let result = expectRejected('body change without authorization', bodyChanged);
assert(result.mutations.some(item => item.action === 'change'), 'body change was not classified as change');

const bodyRemovedFromScope = clone(canonicalEntries);
const removedScopeEntry = findEntry(bodyRemovedFromScope, 'legacy:sabachtan:574cf8060b5e51c28b897902');
removedScopeEntry.t = 'Withdrawn inherited record';
removedScopeEntry.b = 'The protected term was removed.';
result = expectRejected('term removal without authorization', bodyRemovedFromScope);
assert(result.mutations.some(item => item.action === 'delete'), 'term removal was not classified as delete');

const sectionMoved = clone(canonicalEntries);
findEntry(sectionMoved, 'legacy:idiomary:1bc3c1ce46c9a293eada9fa1').s = 'pending';
expectRejected('section move without authorization', sectionMoved);

const titleChanged = clone(canonicalEntries);
findEntry(titleChanged, 'legacy:gorgonification:7709a599fd6ff1a340bdc4b5').t += ' amended';
expectRejected('title change without authorization', titleChanged);

const idChanged = clone(canonicalEntries);
findEntry(idChanged, 'coreplus-legacy-slot-17').id = 'coreplus-legacy-slot-17-renamed';
expectRejected('canonical id change without authorization', idChanged);

const deleted = clone(canonicalEntries);
const deleteIndex = deleted.findIndex(entry => (
  recordState(entry).record_id === 'legacy:degorgonification:f0d7bcae28a3156ebfcb7f51'
));
assert(deleteIndex >= 0, 'delete fixture target is missing');
deleted.splice(deleteIndex, 1);
result = expectRejected('record deletion without authorization', deleted);
assert(result.mutations.some(item => item.action === 'delete'), 'deletion was not classified as delete');

const added = clone(canonicalEntries);
added.push({
  id: 'hostile-baseline-morality-addition',
  s: 'pending',
  r: 'AI',
  t: 'Baseline Morality hostile addition',
  b: 'Substantive Baselinemorality content smuggled through a packaging repair.',
  tg: 'hostile-fixture',
});
result = expectRejected('record addition without authorization', added);
assert(result.mutations.some(item => item.action === 'add'), 'addition was not classified as add');

const changedMutations = classifyMutations(contract, bodyChanged).mutations;
const exactChangeAuthorization = authorizationFor(changedMutations, 'change the named Baseline Morality record exactly as SHA-bound here');
assert(evaluate(bodyChanged, canonicalRecovery, exactChangeAuthorization).ok, 'exact authorized change was rejected');

const deletedMutations = classifyMutations(contract, deleted).mutations;
const exactDeleteAuthorization = authorizationFor(deletedMutations, 'delete the named Baseline Morality record exactly as SHA-bound here');
assert(evaluate(deleted, canonicalRecovery, exactDeleteAuthorization).ok, 'exact authorized deletion was rejected');

const addedMutations = classifyMutations(contract, added).mutations;
const exactAddAuthorization = authorizationFor(addedMutations, 'add the named Baseline Morality record exactly as SHA-bound here');
assert(evaluate(added, canonicalRecovery, exactAddAuthorization).ok, 'exact authorized addition was rejected');

const actionOmitted = authorizationFor(changedMutations, 'revise the named record exactly as SHA-bound here');
expectRejected('directive without literal action name', bodyChanged, canonicalRecovery, actionOmitted);

const wrongAction = authorizationFor(changedMutations, 'delete the named Baseline Morality record exactly as SHA-bound here');
expectRejected('wrong action named by directive', bodyChanged, canonicalRecovery, wrongAction);

const staleBinding = authorizationFor(changedMutations, 'change the named Baseline Morality record exactly as SHA-bound here');
const staleEnvelope = JSON.parse(staleBinding.raw);
staleEnvelope.mutations[0].binding_sha256 = '0'.repeat(64);
staleBinding.raw = `${JSON.stringify(staleEnvelope, null, 2)}\n`;
staleBinding.expectedSha256 = sha256(staleBinding.raw);
expectRejected('stale mutation binding', bodyChanged, canonicalRecovery, staleBinding);

const falseDirectiveHash = authorizationFor(changedMutations, 'change the named Baseline Morality record exactly as SHA-bound here');
const falseDirectiveEnvelope = JSON.parse(falseDirectiveHash.raw);
falseDirectiveEnvelope.source.directive_sha256 = '0'.repeat(64);
falseDirectiveHash.raw = `${JSON.stringify(falseDirectiveEnvelope, null, 2)}\n`;
falseDirectiveHash.expectedSha256 = sha256(falseDirectiveHash.raw);
expectRejected('false user-directive hash', bodyChanged, canonicalRecovery, falseDirectiveHash);

const falseEnvelopeHash = authorizationFor(changedMutations, 'change the named Baseline Morality record exactly as SHA-bound here');
falseEnvelopeHash.expectedSha256 = 'f'.repeat(64);
expectRejected('false caller-supplied envelope hash', bodyChanged, canonicalRecovery, falseEnvelopeHash);

const assistantAuthorization = authorizationFor(changedMutations, 'change the named Baseline Morality record exactly as SHA-bound here');
const assistantEnvelope = JSON.parse(assistantAuthorization.raw);
assistantEnvelope.source.type = 'assistant_recovery_summary';
assistantAuthorization.raw = `${JSON.stringify(assistantEnvelope, null, 2)}\n`;
assistantAuthorization.expectedSha256 = sha256(assistantAuthorization.raw);
expectRejected('assistant-origin authorization', bodyChanged, canonicalRecovery, assistantAuthorization);

expectRejected(
  'recovery-source substantive smuggling',
  canonicalEntries,
  `${canonicalRecovery}\nBaseline Morality now also means an added substantive doctrine.\n`,
);

expectRejected(
  'recovery-source exclusion weakening',
  canonicalEntries,
  canonicalRecovery.replace('is withdrawn from this correction', 'may be introduced by this correction'),
);

const reducedContract = clone(contract);
reducedContract.frozen_records.pop();
expectRejected('contract record deletion', canonicalEntries, canonicalRecovery, null, reducedContract);

console.log(
  'BASELINE MORALITY HOSTILE MUTATIONS REJECTED — add, change, delete, move, rename, ID drift, '
  + 'stale authorization, non-user authorization, and recovery-source smuggling all fail closed',
);
