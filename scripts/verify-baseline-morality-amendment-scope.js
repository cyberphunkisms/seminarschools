#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {parseSeedWithAddenda} = require('./lib/parse-seed-with-addenda');

const ROOT = path.resolve(__dirname, '..');
const CONTRACT_RELATIVE = 'data/baseline-morality-amendment-scope-contract.json';
const CONTRACT_PATH = path.join(ROOT, CONTRACT_RELATIVE);
const HEX_SHA256 = /^[0-9a-f]{64}$/;

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function countOccurrences(text, needle) {
  if (!needle) return 0;
  let count = 0;
  let cursor = 0;
  while (cursor <= text.length - needle.length) {
    const found = text.indexOf(needle, cursor);
    if (found < 0) break;
    count += 1;
    cursor = found + needle.length;
  }
  return count;
}

function legacyRecordId(section, title) {
  const identityHash = sha256(`${section}\u0000${title}`).slice(0, 24);
  return `legacy:${section}:${identityHash}`;
}

function recordId(entry) {
  const explicit = typeof entry.id === 'string' && entry.id.trim() ? entry.id : null;
  return explicit || legacyRecordId(String(entry.s || ''), String(entry.t || ''));
}

function recordState(entry) {
  return {
    record_id: recordId(entry),
    canonical_id: typeof entry.id === 'string' && entry.id.trim() ? entry.id : null,
    section: String(entry.s || ''),
    title: String(entry.t || ''),
    body_sha256: sha256(String(entry.b || '')),
  };
}

function isBaselineMoralityRecord(entry) {
  return /baseline[\s_-]*morality/i.test(JSON.stringify(entry));
}

function validateContract(contract) {
  const errors = [];
  if (!contract || typeof contract !== 'object') return ['contract is not an object'];
  if (contract.schema_version !== 1) errors.push('contract schema_version must be 1');
  if (contract.status !== 'active_fail_closed') errors.push('contract status must be active_fail_closed');
  if (contract.canonical_source !== 'polymyth/methodologylist/index.html') {
    errors.push('canonical source is not the ML* HTML owner');
  }
  const records = contract.frozen_records;
  const expectedCount = contract.scope?.expected_inherited_record_count;
  if (expectedCount !== 11) errors.push(`contract expected count is ${expectedCount}; expected 11`);
  if (!Array.isArray(records) || records.length !== 11) {
    errors.push(`contract freezes ${Array.isArray(records) ? records.length : 0}/11 records`);
    return errors;
  }
  const seen = new Set();
  for (const record of records) {
    for (const field of ['record_id', 'section', 'title', 'body_sha256']) {
      if (typeof record[field] !== 'string' || !record[field]) {
        errors.push(`frozen record lacks ${field}`);
      }
    }
    if (!HEX_SHA256.test(String(record.body_sha256 || ''))) {
      errors.push(`${record.record_id || '<unknown>'} has an invalid body SHA-256`);
    }
    if (seen.has(record.record_id)) errors.push(`duplicate frozen record id ${record.record_id}`);
    seen.add(record.record_id);
    const expectedId = record.canonical_id || legacyRecordId(record.section, record.title);
    if (record.record_id !== expectedId) {
      errors.push(`${record.record_id} violates the record-id rule; expected ${expectedId}`);
    }
    if (record.canonical_id !== null && record.canonical_id !== record.record_id) {
      errors.push(`${record.record_id} has a mismatched canonical_id`);
    }
  }
  const policy = contract.authorization_policy || {};
  if (stableJson(policy.allowed_actions) !== stableJson(['add', 'change', 'delete'])) {
    errors.push('authorization policy must enumerate add, change, and delete');
  }
  if (policy.required_source_type !== 'direct_user_message') {
    errors.push('authorization policy must require a direct_user_message');
  }
  if (contract.recovery_source?.baseline_morality_authority !== 'exclusion_and_provenance_only') {
    errors.push('recovery source is not constrained to exclusion_and_provenance_only');
  }
  return errors;
}

function classifyMutations(contract, entries) {
  const errors = [];
  const expected = new Map(contract.frozen_records.map(record => [record.record_id, record]));
  const current = new Map();
  for (const entry of entries.filter(isBaselineMoralityRecord)) {
    const state = recordState(entry);
    if (current.has(state.record_id)) {
      errors.push(`duplicate current record id ${state.record_id}`);
    } else {
      current.set(state.record_id, state);
    }
  }

  const mutations = [];
  for (const [id, before] of expected) {
    const after = current.get(id);
    if (!after) {
      mutations.push({action: 'delete', record_id: id, before, after: null});
      continue;
    }
    const comparableBefore = {
      record_id: before.record_id,
      canonical_id: before.canonical_id,
      section: before.section,
      title: before.title,
      body_sha256: before.body_sha256,
    };
    if (stableJson(comparableBefore) !== stableJson(after)) {
      mutations.push({action: 'change', record_id: id, before: comparableBefore, after});
    }
  }
  for (const [id, after] of current) {
    if (!expected.has(id)) mutations.push({action: 'add', record_id: id, before: null, after});
  }
  mutations.sort((left, right) => {
    const byId = left.record_id.localeCompare(right.record_id);
    return byId || left.action.localeCompare(right.action);
  });
  return {errors, mutations, currentCount: current.size};
}

function mutationBindingPayload(mutation) {
  return {
    action: mutation.action,
    record_id: mutation.record_id,
    before: mutation.before,
    after: mutation.after,
  };
}

function mutationBindingSha256(mutation) {
  return sha256(stableJson(mutationBindingPayload(mutation)));
}

function authorizeMutations(contract, mutations, authorization) {
  if (!mutations.length) {
    return authorization ? ['authorization envelope supplied when no mutation exists'] : [];
  }
  if (!authorization) {
    return mutations.map(mutation => `${mutation.action} ${mutation.record_id} lacks SHA-bound direct user authorization`);
  }
  const errors = [];
  const {raw, expectedSha256} = authorization;
  if (typeof raw !== 'string' || !raw) return ['authorization envelope is empty'];
  if (!HEX_SHA256.test(String(expectedSha256 || '')) || sha256(raw) !== expectedSha256) {
    errors.push('authorization envelope does not match the caller-supplied SHA-256');
  }
  let envelope;
  try {
    envelope = JSON.parse(raw);
  } catch {
    return [...errors, 'authorization envelope is not valid JSON'];
  }
  if (envelope.schema_version !== 1) errors.push('authorization envelope schema_version must be 1');
  const source = envelope.source || {};
  const directive = typeof source.directive === 'string' ? source.directive : '';
  if (source.type !== contract.authorization_policy.required_source_type) {
    errors.push('authorization source is not a direct_user_message');
  }
  if (!source.reference || typeof source.reference !== 'string') {
    errors.push('authorization source lacks a direct user message reference');
  }
  if (!directive) errors.push('authorization source lacks a verbatim user directive');
  if (!HEX_SHA256.test(String(source.directive_sha256 || '')) || sha256(directive) !== source.directive_sha256) {
    errors.push('verbatim user directive SHA-256 is absent or wrong');
  }
  const bindings = Array.isArray(envelope.mutations) ? envelope.mutations : [];
  if (bindings.length !== mutations.length) {
    errors.push(`authorization binds ${bindings.length}/${mutations.length} detected mutations`);
  }
  const used = new Set();
  for (const mutation of mutations) {
    const key = `${mutation.action}\u0000${mutation.record_id}`;
    const candidates = bindings.filter(binding => (
      binding.action === mutation.action && binding.record_id === mutation.record_id
    ));
    if (candidates.length !== 1) {
      errors.push(`${mutation.action} ${mutation.record_id} lacks one exact authorization binding`);
      continue;
    }
    const binding = candidates[0];
    if (used.has(binding)) errors.push(`authorization binding reused for ${key}`);
    used.add(binding);
    const actionPattern = new RegExp(`\\b${mutation.action}\\b`, 'i');
    if (!actionPattern.test(directive)) {
      errors.push(`direct user directive does not literally name action ${mutation.action}`);
    }
    const suppliedPayload = mutationBindingPayload(binding);
    const actualPayload = mutationBindingPayload(mutation);
    if (stableJson(suppliedPayload) !== stableJson(actualPayload)) {
      errors.push(`${mutation.action} ${mutation.record_id} does not bind the exact before/after state`);
    }
    const expectedBindingSha = mutationBindingSha256(mutation);
    if (!HEX_SHA256.test(String(binding.binding_sha256 || '')) || binding.binding_sha256 !== expectedBindingSha) {
      errors.push(`${mutation.action} ${mutation.record_id} has a stale or invalid mutation SHA-256`);
    }
  }
  return errors;
}

function verifyRecoverySource(contract, recoveryText) {
  const errors = [];
  const recovery = contract.recovery_source || {};
  if (!HEX_SHA256.test(String(recovery.sha256 || '')) || sha256(recoveryText) !== recovery.sha256) {
    errors.push('recovery source does not match its exact contract SHA-256');
  }
  const exclusion = String(recovery.required_exclusion_paragraph || '');
  if (!exclusion || countOccurrences(recoveryText, exclusion) !== 1) {
    errors.push('recovery source must contain the exact Baseline Morality exclusion once');
  }
  if (!recoveryText.includes('## Explicit exclusion')) {
    errors.push('recovery source lacks the explicit-exclusion heading');
  }
  if (!recoveryText.includes(String(recovery.required_provenance_heading || ''))) {
    errors.push('recovery source lacks screenshot provenance');
  }
  const withoutExclusion = exclusion ? recoveryText.replace(exclusion, '') : recoveryText;
  if (/baseline[\s_-]*morality/i.test(withoutExclusion)) {
    errors.push('recovery source uses Baseline Morality outside the exact exclusion paragraph');
  }
  const screenshotEvidence = recoveryText.match(/`[0-9a-f-]+\.png`\s+—\s+SHA-256\s+`[0-9a-f]{64}`/g) || [];
  if (!screenshotEvidence.length) errors.push('recovery source lacks SHA-256-bound screenshot provenance');
  return errors;
}

function verifySnapshot({contract, entries, recoveryText, authorization = null}) {
  const errors = validateContract(contract);
  if (errors.length) return {ok: false, errors, mutations: [], currentCount: 0};
  const classified = classifyMutations(contract, entries);
  errors.push(...classified.errors);
  errors.push(...verifyRecoverySource(contract, recoveryText));
  errors.push(...authorizeMutations(contract, classified.mutations, authorization));
  return {
    ok: errors.length === 0,
    errors,
    mutations: classified.mutations,
    currentCount: classified.currentCount,
  };
}

function parseAuthorizationArgs(argv) {
  let relativePath = process.env.BASELINE_MORALITY_AUTHORIZATION || '';
  let expectedSha256 = process.env.BASELINE_MORALITY_AUTHORIZATION_SHA256 || '';
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--authorization') relativePath = argv[++index] || '';
    else if (argv[index] === '--authorization-sha256') expectedSha256 = argv[++index] || '';
    else throw new Error(`unknown argument ${argv[index]}`);
  }
  if (!relativePath && !expectedSha256) return null;
  if (!relativePath || !expectedSha256) {
    throw new Error('authorization path and caller-supplied SHA-256 must be provided together');
  }
  if (path.isAbsolute(relativePath) || relativePath.includes('\u0000')) {
    throw new Error('authorization path must be a repository-relative regular file');
  }
  const absolute = path.resolve(ROOT, relativePath);
  const relative = path.relative(ROOT, absolute);
  if (!relative || relative.startsWith(`..${path.sep}`) || relative === '..') {
    throw new Error('authorization path escapes the repository');
  }
  const stat = fs.lstatSync(absolute);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error('authorization path is not a regular non-symlink file');
  }
  return {raw: fs.readFileSync(absolute, 'utf8'), expectedSha256};
}

function main() {
  let authorization;
  try {
    authorization = parseAuthorizationArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`BASELINE MORALITY AMENDMENT-SCOPE FAILED — ${error.message}`);
    process.exit(1);
  }
  const contract = JSON.parse(fs.readFileSync(CONTRACT_PATH, 'utf8'));
  const canonicalHtml = fs.readFileSync(path.join(ROOT, contract.canonical_source), 'utf8');
  const entries = parseSeedWithAddenda(canonicalHtml);
  const recoveryText = fs.readFileSync(path.join(ROOT, contract.recovery_source.path), 'utf8');
  const result = verifySnapshot({contract, entries, recoveryText, authorization});
  if (!result.ok) {
    console.error('BASELINE MORALITY AMENDMENT-SCOPE FAILED');
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(
    `BASELINE MORALITY AMENDMENT-SCOPE VERIFIED — ${result.currentCount}/11 inherited records `
    + 'frozen by record ID, section, title, and body SHA-256; add/change/delete fail closed',
  );
}

module.exports = {
  authorizeMutations,
  classifyMutations,
  isBaselineMoralityRecord,
  legacyRecordId,
  mutationBindingSha256,
  recordState,
  sha256,
  stableJson,
  validateContract,
  verifyRecoverySource,
  verifySnapshot,
};

if (require.main === module) main();
