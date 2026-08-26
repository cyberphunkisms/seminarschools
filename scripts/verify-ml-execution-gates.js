#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {parseSeedWithAddenda} = require('./lib/parse-seed-with-addenda');

const ROOT = path.resolve(__dirname, '..');
const failures = [];

function fail(message) { failures.push(message); }
function read(relative) { return fs.readFileSync(path.join(ROOT, relative), 'utf8'); }
function one(entries, id) {
  const matches = entries.filter(entry => entry.id === id);
  if (matches.length !== 1) {
    fail(`${id} expected once and found ${matches.length}`);
    return {id, s: '', t: '', b: '', xc: '', xr: []};
  }
  return matches[0];
}
function requireNeedles(value, needles, label) {
  const text = String(value || '');
  for (const needle of needles) {
    if (!text.includes(needle)) fail(`${label} is missing: ${needle}`);
  }
}

function evaluateFixture(fixture) {
  const draft = String(fixture.draft || '');
  if (fixture.kind === 'quick') {
    const words = draft.trim().split(/\s+/).filter(Boolean).length;
    return draft.startsWith(fixture.expected_prefix)
      && words <= fixture.max_words
      && !/I will first|my methodology|before answering/i.test(draft);
  }
  if (fixture.kind === 'exact_line') {
    return Boolean(fixture.rule_id && fixture.quote && String(fixture.actual || '').includes(fixture.quote));
  }
  if (fixture.kind === 'semantic') {
    const required = fixture.must_include || [];
    const forbidden = fixture.must_exclude || [];
    return required.every(needle => draft.includes(needle))
      && forbidden.every(needle => !draft.includes(needle));
  }
  if (fixture.kind === 'controlled_absence') {
    const conclusion = String(fixture.conclusion || '').toLowerCase();
    const forbiddenInference = /missing claim was true|nothing happened|must be true/.test(conclusion);
    if (forbiddenInference) return false;
    if (!fixture.control_supported) return conclusion.includes('unsupported in the present record');
    if (!fixture.exact_content_available) {
      return conclusion.includes('control is supported') && conclusion.includes('irrecoverable');
    }
    return true;
  }
  if (fixture.kind === 'prose') {
    if (fixture.literal_quote) return true;
    return !/\bnot\s+only\b[\s\S]{0,120}\bbut\s+also\b/i.test(draft)
      && !/\bnot\s+[^.]{1,80}\s+but\s+[^.]{1,80}/i.test(draft);
  }
  if (fixture.kind === 'authority') {
    return fixture.speech_act !== 'analysis' || (fixture.mutations || []).length === 0;
  }
  if (fixture.kind === 'coverage') {
    if (!fixture.claims_completeness) return true;
    return ['source_inventory', 'claim_inventory', 'coverage_map', 'exclusions', 'conflicts', 'omission_scan']
      .every(key => fixture[key] === true);
  }
  fail(`unknown fixture kind ${fixture.kind} for ${fixture.id}`);
  return false;
}

const html = read('polymyth/methodologylist/index.html');
let entries = [];
try {
  entries = parseSeedWithAddenda(html);
} catch (error) {
  fail(`canonical Methodologylist parse failed: ${error.message}`);
}

const expectedCounts = {
  analysis: 29,
  citation: 340,
  corehistory: 29,
  coreplus: 53,
  degorgonification: 54,
  'framework-core': 1,
  gorgonification: 134,
  idiomary: 44,
  learnings: 28,
  methodology: 387,
  pending: 18,
  'pending-user-authorship': 2,
  polycognate: 24,
  rainbowsol: 3,
  sabachtan: 34,
  studylist: 38,
};
const actualCounts = Object.fromEntries(
  [...entries.reduce((map, entry) => map.set(entry.s, (map.get(entry.s) || 0) + 1), new Map())]
    .sort(([left], [right]) => left.localeCompare(right)),
);
if (entries.length !== 1218) fail(`expected 1218 canonical entries and found ${entries.length}`);
if (JSON.stringify(actualCounts) !== JSON.stringify(expectedCounts)) {
  fail(`section counts drifted: ${JSON.stringify(actualCounts)}`);
}

const baseMap = one(entries, 'coreplus-current-map');
const currentMap = one(entries, 'coreplus-current-map-amendment-2026-08-26');
const oldMap = one(entries, 'coreplus-current-map-amendment-2026-08-23');
const execution = one(entries, 'coreplus-handler-mephistodata-execution-gates-2026-08-26');
const archive = one(entries, 'method-controlled-archive-evidence-institutional-metrics-2026-08-26');
const synthesis = one(entries, 'analysis-gorgon-culture-emotional-labor-privilege-cutoff-controlled-absence-2026-08-26');
const regression = one(entries, 'coreplus-regression-fixture-contract-2026-08-26');
const sourceRecord = one(entries, 'citation-ml-star-gorgon-free-speech-update-source-2026-08-24');
const legacyGates = one(entries, 'coreplus-registry-generation-time-gates');

if (oldMap.s !== 'corehistory') fail('August 23 map amendment is not inactive CORE History');
requireNeedles(baseMap.xc, ['coreplus-current-map-amendment-2026-08-26', 'fail-closed execution', 'controlled-archive'], 'base current map route');
requireNeedles(currentMap.b, [
  'single current companion',
  'UNIVERSAL ML* EXECUTION DISPATCH.',
  'CURRENT-TURN DISPATCH.',
  'CORPUS, CONTROLLED-ARCHIVE, AND METRIC DISPATCH.',
  'CONFLICT RESOLUTION.',
  'PM17\'s mandatory opener is inactive',
  'single-connective-thread rule applies to long-form article and chapter movement',
], 'August 26 current map');
requireNeedles(legacyGates.xc, [
  'coreplus-handler-mephistodata-execution-gates-2026-08-26',
  'no mandatory binary opener',
  'single fail-closed current execution owner',
], 'legacy generation-gates override');

const executionNeedles = [
  'STATUS. ACTIVE CURRENT EXECUTION OWNER.',
  'GATE 0, AUTHORITY AND VERSION LOCK.',
  'GATE 1, RESET AND TASK FREEZE.',
  'discard every unsent ordinary-assistant draft',
  'GATE 2, QUICK TASK AND ANSWER FIRST.',
  'GATE 4, SEMANTIC FIDELITY.',
  'Fidelity preserves the user\'s claim and remains separate from automatic assent.',
  'GATE 5, SOURCE AND EVIDENCE STATUS.',
  'GATE 6, CONTROLLED ARCHIVE.',
  'unsupported in the present record',
  'GATE 7, OUROBOROS AND COMPLETENESS.',
  'GATE 8, PROSE AND FORM LINT.',
  'not-only-X-but-also-Y construction',
  'GATE 9, EXACT-LINE AUDIT.',
  'Without a matching quoted line, no violation is established',
  'GATE 10, FAIL-CLOSED DELIVERY.',
  'SUPERSESSION.',
];
requireNeedles(execution.b, executionNeedles, 'execution owner');
requireNeedles(archive.b, [
  'OBSERVABILITY GATE.',
  'THREE SITES OF CONTROL.',
  'EVIDENCE-CONDITION FLAGS.',
  'MISSINGNESS AUDIT.',
  'INSTITUTIONAL-METRIC RULE.',
  'SYMMETRIC ABSENCE RULE.',
  'SELECTED-POPULATION CORRECTION.',
  'POWER LEDGER.',
  'HARM AND INTERVENTION SEPARATION.',
], 'controlled-archive method');
requireNeedles(synthesis.b, [
  'user-authored framework position',
  'Hivemindidioms help create the culture',
  'juggle partners, pump and dump',
  'Friends who challenge the relationship can be priced out',
  'DSM-5 is one part of the puzzle',
  'Affirmative action is argued to enforce conformity',
  'Screenshots illustrate public language and case structure',
  'Molyneux is a chronology and paradigm marker',
], 'status-partitioned synthesis');
requireNeedles(regression.b, ['expected-pass and expected-fail fixtures', 'Mythic and historical categories remain distinct'], 'regression contract');
requireNeedles(sourceRecord.b, ['2dde9179d4c4d3f42aef76523fa909310b0f88db27fa879a8730ad6aefa015bb', 'do not establish direct transmission'], 'source record');

for (const [id, needles] of Object.entries({
  'mythology-integration-mephistodata-recovery': ['post-suppression absence supplies no clean proof'],
  'mythology-integration-scanner-fallibility': ['unsupported in the present record', 'Null results remain valid'],
  'mythology-integration-anti-twist-negative-controls': ['falsity or nonexistence inferred from post-suppression absence'],
  'mythology-integration-archive-status-taxonomy': ['Keep all three axes separate'],
  'method-comparative-corpus-integrity-2026-08-23': ['controlled-archive-evidence-institutional-metrics'],
  'method-realist-power-conversion-rule-2026-08-23': ['control of admission, classification, visibility'],
  'method-ouroborosanalyses-current-2026-08-23': ['If the user asks about the method, audit the method before its product'],
})) {
  requireNeedles(one(entries, id).xc, needles, `${id} current integration`);
}

if (!html.includes('/polymyth/methodologylist/mephistodata-rule-hardening-addendum.js?v=20260826')) {
  fail('canonical HTML does not load the rule-hardening addendum');
}
if (!html.includes('...MEPHISTODATA_RULE_HARDENING_ADDENDUM')) {
  fail('browser LIVE_SEED does not include the rule-hardening addendum');
}

let fixtures = [];
try {
  fixtures = JSON.parse(read('scripts/fixtures/ml-execution-gates/fixtures.json'));
} catch (error) {
  fail(`fixture JSON failed: ${error.message}`);
}
if (fixtures.length < 30) fail(`expected at least 30 fixtures and found ${fixtures.length}`);
const seenFixtureIds = new Set();
let positive = 0;
let negative = 0;
for (const fixture of fixtures) {
  if (!fixture.id || seenFixtureIds.has(fixture.id)) fail(`duplicate or missing fixture id ${fixture.id || '<missing>'}`);
  seenFixtureIds.add(fixture.id);
  const actual = evaluateFixture(fixture);
  if (actual !== fixture.expected_pass) fail(`${fixture.id} returned ${actual}; expected ${fixture.expected_pass}`);
  if (fixture.expected_pass) positive += 1;
  else negative += 1;
}
if (!positive || !negative) fail('fixtures lack positive or negative cases');

const mutatedExecution = {...execution, b: execution.b.replace('GATE 9, EXACT-LINE AUDIT.', '')};
const mutationRejected = executionNeedles.some(needle => !mutatedExecution.b.includes(needle));
if (!mutationRejected) fail('deliberate execution-owner mutation was not rejected');

if (failures.length) {
  console.error('ML execution gate verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`ML execution gate verification passed: ${entries.length} entries, ${positive} positive fixtures, ${negative} negative fixtures`);
