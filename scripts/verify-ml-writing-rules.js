#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  DETECTOR_CODES,
  RULE_FAMILIES,
  lintText,
  normalizeProtectedSpans,
  validateSemanticPlan,
} = require('./lib/ml-writing-lint');

const ROOT = path.resolve(__dirname, '..');
const FIXTURE_PATH = path.join(ROOT, 'scripts', 'fixtures', 'ml-writing-rules', 'fixtures.json');
const OWNER_PATH = path.join(ROOT, 'polymyth', 'methodologylist', 'mephistodata-rule-hardening-addendum.js');
const MANIFEST_PATH = path.join(ROOT, 'RELEASE_MANIFEST.json');
const failures = [];

function fail(message) {
  failures.push(message);
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function countLiteral(text, needle) {
  if (!needle) return 0;
  let count = 0;
  let cursor = 0;
  while (cursor <= text.length - needle.length) {
    const index = text.indexOf(needle, cursor);
    if (index < 0) break;
    count += 1;
    cursor = index + needle.length;
  }
  return count;
}

function setPath(target, dottedPath, value) {
  const parts = String(dottedPath || '').split('.').filter(Boolean);
  if (!parts.length) throw new Error('empty mutation path');
  let cursor = target;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = /^\d+$/.test(parts[index]) ? Number(parts[index]) : parts[index];
    if (cursor === null || cursor === undefined || !(key in cursor)) {
      throw new Error(`mutation path does not exist at ${parts.slice(0, index + 1).join('.')}`);
    }
    cursor = cursor[key];
  }
  const finalKey = /^\d+$/.test(parts.at(-1)) ? Number(parts.at(-1)) : parts.at(-1);
  if (cursor === null || cursor === undefined || !(finalKey in cursor)) {
    throw new Error(`mutation path does not exist at ${dottedPath}`);
  }
  cursor[finalKey] = deepClone(value);
}

function expectedCodes(record) {
  return [...record.expect.codes].sort();
}

function actualCodes(issues) {
  return issues.map(issue => issue.code).sort();
}

function codesEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

const knownCodes = new Set(Object.values(DETECTOR_CODES));
const knownFamilies = new Set(RULE_FAMILIES);

function validateRecord(record, label, {requireFamily = true} = {}) {
  const local = [];
  if (!record || typeof record !== 'object' || Array.isArray(record)) local.push('record must be an object');
  if (!record.id || typeof record.id !== 'string') local.push('id must be a nonempty string');
  if (!['mechanical', 'semantic'].includes(record.kind)) local.push(`unknown kind ${record.kind}`);
  if (requireFamily && !knownFamilies.has(record.family)) local.push(`unknown family ${record.family}`);
  if (typeof record.text !== 'string') local.push('text must be a string');
  if (!record.expect || typeof record.expect.pass !== 'boolean' || !Array.isArray(record.expect.codes)) {
    local.push('expect must contain boolean pass and a codes array');
  } else {
    for (const code of record.expect.codes) {
      if (!knownCodes.has(code)) local.push(`unknown expected code ${code}`);
    }
    if (record.expect.pass !== (record.expect.codes.length === 0)) {
      local.push('expect.pass must agree with whether the exact code list is empty');
    }
  }
  if (record.kind === 'semantic' && (!record.plan || typeof record.plan !== 'object')) {
    local.push('semantic fixture requires a plan object');
  }
  if (local.length) fail(`${label} schema failed with ${local.join(', ')}`);
  return local.length === 0;
}

function evaluateRecord(record) {
  const issues = lintText(record.text, {protectedSpans: record.protectedSpans || []});
  if (record.kind === 'semantic') issues.push(...validateSemanticPlan(record.text, record.plan));
  issues.sort((left, right) => left.start - right.start || left.end - right.end || left.code.localeCompare(right.code));
  return issues;
}

function validateIssueShape(issue, text, label) {
  const requiredStrings = ['ruleId', 'code', 'span', 'suggestion'];
  for (const field of requiredStrings) {
    if (typeof issue[field] !== 'string' || !issue[field].length) {
      fail(`${label} issue ${issue.code || '<unknown>'} has invalid ${field}`);
    }
  }
  for (const field of ['start', 'end', 'sentenceIndex']) {
    if (!Number.isInteger(issue[field])) fail(`${label} issue ${issue.code || '<unknown>'} has noninteger ${field}`);
  }
  if (issue.start < 0 || issue.end < issue.start || issue.end > text.length) {
    fail(`${label} issue ${issue.code || '<unknown>'} has invalid span bounds`);
  }
  if (issue.span !== text.slice(issue.start, issue.end)) {
    fail(`${label} issue ${issue.code || '<unknown>'} does not preserve its exact source span`);
  }
  if (!knownCodes.has(issue.code)) fail(`${label} emitted unknown code ${issue.code}`);
  if (!issue.code.startsWith(`${issue.ruleId}_`)) {
    fail(`${label} issue ${issue.code} does not map to ${issue.ruleId}`);
  }
}

function checkExpected(record, issues, label) {
  for (const issue of issues) validateIssueShape(issue, record.text, label);
  const pass = issues.length === 0;
  if (pass !== record.expect.pass) {
    fail(`${label} returned pass=${pass}; expected ${record.expect.pass}`);
  }
  const actual = actualCodes(issues);
  const expected = expectedCodes(record);
  if (!codesEqual(actual, expected)) {
    fail(`${label} emitted ${JSON.stringify(actual)}; expected exactly ${JSON.stringify(expected)}`);
  }
}

function applyMutation(base, mutation) {
  const candidate = deepClone(base);
  candidate.id = mutation.id;
  if (Object.prototype.hasOwnProperty.call(mutation, 'text')) candidate.text = mutation.text;
  if (mutation.textReplace) {
    const from = String(mutation.textReplace.from);
    const to = String(mutation.textReplace.to);
    if (countLiteral(candidate.text, from) !== 1) {
      throw new Error(`text mutation expected one occurrence of ${JSON.stringify(from)}`);
    }
    candidate.text = candidate.text.replace(from, to);
  }
  if (Object.prototype.hasOwnProperty.call(mutation, 'protectedSpans')) {
    candidate.protectedSpans = deepClone(mutation.protectedSpans);
  }
  for (const patch of mutation.planPatches || []) setPath(candidate.plan, patch.path, patch.value);
  candidate.expect = deepClone(mutation.expect);
  return candidate;
}

let corpus;
try {
  corpus = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
} catch (error) {
  console.error(`ML writing rule verification failed because fixture loading failed with ${error.message}`);
  process.exit(1);
}

if (corpus.schemaVersion !== 1) fail(`fixture schema version must be 1 and is ${corpus.schemaVersion}`);
if (!Array.isArray(corpus.fixtures) || !corpus.fixtures.length) fail('fixture corpus has no fixtures');
if (!Array.isArray(corpus.mutations) || !corpus.mutations.length) fail('fixture corpus has no deliberate mutations');

const fixtureIds = new Set();
const fixturesById = new Map();
const familyCoverage = new Map(RULE_FAMILIES.map(family => [family, {pass: 0, fail: 0}]));
const expectedCodeCoverage = new Set();
let fixturePasses = 0;
let fixtureFailures = 0;

for (const fixture of corpus.fixtures || []) {
  if (fixtureIds.has(fixture.id)) fail(`duplicate fixture id ${fixture.id}`);
  fixtureIds.add(fixture.id);
  fixturesById.set(fixture.id, fixture);
  if (!validateRecord(fixture, `fixture ${fixture.id}`)) continue;
  for (const code of fixture.expect.codes) expectedCodeCoverage.add(code);
  const issues = evaluateRecord(fixture);
  checkExpected(fixture, issues, `fixture ${fixture.id}`);
  if (fixture.expect.pass) fixturePasses += 1;
  else fixtureFailures += 1;
  const coverage = familyCoverage.get(fixture.family);
  coverage[fixture.expect.pass ? 'pass' : 'fail'] += 1;
}

for (const [family, coverage] of familyCoverage) {
  if (!coverage.pass || !coverage.fail) {
    fail(`rule family ${family} requires at least one passing and one failing fixture`);
  }
}
for (const code of knownCodes) {
  if (!expectedCodeCoverage.has(code)) fail(`exported detector ${code} lacks an exact expected-code fixture`);
}

const mutationIds = new Set();
let rejectedMutations = 0;
for (const mutation of corpus.mutations || []) {
  if (!mutation.id || mutationIds.has(mutation.id) || fixtureIds.has(mutation.id)) {
    fail(`duplicate or missing mutation id ${mutation.id || '<missing>'}`);
    continue;
  }
  mutationIds.add(mutation.id);
  const base = fixturesById.get(mutation.baseFixtureId);
  if (!base) {
    fail(`mutation ${mutation.id} has unknown base fixture ${mutation.baseFixtureId}`);
    continue;
  }
  if (!base.expect.pass) {
    fail(`mutation ${mutation.id} must start from a passing fixture`);
    continue;
  }
  let candidate;
  try {
    candidate = applyMutation(base, mutation);
  } catch (error) {
    fail(`mutation ${mutation.id} could not be applied with ${error.message}`);
    continue;
  }
  if (!validateRecord(candidate, `mutation ${mutation.id}`)) continue;
  const issues = evaluateRecord(candidate);
  checkExpected(candidate, issues, `mutation ${mutation.id}`);
  if (issues.length) rejectedMutations += 1;
}
if (rejectedMutations !== (corpus.mutations || []).length) {
  fail(`expected every deliberate mutation to be rejected and rejected ${rejectedMutations} of ${(corpus.mutations || []).length}`);
}

for (const [name, spans, expectedMessage] of [
  ['out-of-bounds', [{start: 0, end: 999}], 'invalid half-open bounds'],
  ['overlap', [{start: 0, end: 4}, {start: 3, end: 6}], 'must not overlap'],
  ['ambiguous-match', [{match: 'word'}], 'ambiguous'],
]) {
  let rejected = false;
  try {
    normalizeProtectedSpans(name === 'ambiguous-match' ? 'word word' : 'sample', spans);
  } catch (error) {
    rejected = String(error.message).includes(expectedMessage);
  }
  if (!rejected) fail(`protected span ${name} mutation was not rejected`);
}

const syntheticDuplicate = [...(corpus.fixtures || []), deepClone((corpus.fixtures || [])[0])];
if (new Set(syntheticDuplicate.map(fixture => fixture.id)).size === syntheticDuplicate.length) {
  fail('duplicate fixture-id mutation was not rejected');
}

const syntheticUnknown = deepClone((corpus.fixtures || [])[0]);
syntheticUnknown.expect = {pass: false, codes: ['W99_UNKNOWN']};
const unknownBefore = failures.length;
validateRecord(syntheticUnknown, 'synthetic unknown-code mutation');
if (failures.length === unknownBefore) fail('unknown expected-code mutation was not rejected');
else failures.splice(unknownBefore, 1);

const syntheticUnexpected = deepClone(fixturesById.get('lexical_single_use_pass'));
syntheticUnexpected.expect = {pass: true, codes: []};
syntheticUnexpected.text = 'The programme includes English and includes Social Science.';
const unexpectedIssues = evaluateRecord(syntheticUnexpected);
if (!unexpectedIssues.some(issue => issue.code === DETECTOR_CODES.LEXICAL_REPETITION)) {
  fail('unexpected-finding mutation was not detected');
}

let owner = '';
try {
  owner = fs.readFileSync(OWNER_PATH, 'utf8');
} catch (error) {
  fail(`current writing owner could not be read with ${error.message}`);
}
for (const needle of [
  'coreplus-handler-writing-composition-delivery-2026-08-29',
  'W25 protects necessary precise terms',
  'W24 blocks needless repetition',
  'W29 blocks empty method labels',
  'W33 requires sentence-topic continuity',
  'W40 blocks appositive constructions',
  'W42 blocks stacked short declaratives and staccato',
  'W51 uses zero colons',
  'W52 uses zero semicolons',
  'W53 uses zero em dashes',
  'W55 blocks the full not-X-but-Y family',
  'W65 removes meta-announcements',
  'W67 keeps process narration outside the artifact',
  'scripts/fixtures/ml-writing-rules',
  'scripts/lib/ml-writing-lint.js',
]) {
  if (!owner.includes(needle)) fail(`current writing owner is missing ${needle}`);
}

let releaseManifest = {};
try {
  releaseManifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
} catch (error) {
  fail(`release manifest could not be read with ${error.message}`);
}
const mlStarUpdate = releaseManifest.ml_star_update || {};
const writingSource = String(mlStarUpdate.writing_source || '');
const writingSourcePath = path.join(ROOT, writingSource);
if (!writingSource || !fs.existsSync(writingSourcePath)) {
  fail('release manifest writing source is missing');
} else {
  const sourceSha = crypto.createHash('sha256').update(fs.readFileSync(writingSourcePath)).digest('hex');
  if (sourceSha !== mlStarUpdate.writing_source_sha256) {
    fail(`release manifest writing source hash is stale with ${sourceSha}`);
  }
  if (!owner.includes(sourceSha)) fail('current writing owner lacks the exact deep-scan source hash');
}
const inventory = mlStarUpdate.writing_rule_inventory || {};
if (inventory.preserved_baseline !== 237
    || inventory.current_additions_and_sharpenings !== 32
    || inventory.total_numbered_rules !== 269
    || inventory.active_runtime_rules !== 84) {
  fail(`release manifest writing inventory is stale with ${JSON.stringify(inventory)}`);
}
const fixtureInventory = mlStarUpdate.writing_behavioral_fixtures || {};
const expectedFixtureInventory = {
  positive: fixturePasses,
  negative: fixtureFailures,
  total: corpus.fixtures.length,
  mutations: corpus.mutations.length,
  rule_families: RULE_FAMILIES.length,
  detectors: Object.values(DETECTOR_CODES).length,
};
if (JSON.stringify(fixtureInventory) !== JSON.stringify(expectedFixtureInventory)) {
  fail(`release manifest writing fixture inventory is stale with ${JSON.stringify(fixtureInventory)}`);
}

if (failures.length) {
  console.error('ML writing rule verification failed');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `ML writing rule verification passed with ${corpus.fixtures.length} fixtures, `
  + `${fixturePasses} passing drafts, ${fixtureFailures} rejected drafts, `
  + `${corpus.mutations.length} rejected mutations, and ${RULE_FAMILIES.length} covered rule families`,
);
