#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {parseSeedWithAddenda} = require('./lib/parse-seed-with-addenda');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'polymyth/methodologylist/index.html'), 'utf8');
const addendum = fs.readFileSync(
  path.join(ROOT, 'polymyth/methodologylist/mephistodata-rule-hardening-addendum.js'),
  'utf8',
);
const entries = parseSeedWithAddenda(html);
const checks = [];

function oneById(id) {
  const found = entries.filter(entry => entry.id === id);
  if (found.length !== 1) throw new Error(`${id} expected once and found ${found.length}`);
  return found[0];
}

function oneByTitle(fragment) {
  const found = entries.filter(entry => String(entry.t || '').includes(fragment));
  if (found.length !== 1) throw new Error(`${fragment} expected once and found ${found.length}`);
  return found[0];
}

function check(label, condition) {
  checks.push({label, condition: Boolean(condition)});
}

const pm17 = oneByTitle('PM17. MEPHISTODATA-AS-NAMED-CHARACTER');
const bloom = oneByTitle('BLOOM-IS-LAYMAN — layman register or no bloom');
const defaultRegister = oneByTitle('DEFAULT REGISTER + NEVER-SELF-BLOOM');
const slot15 = oneById('coreplus-legacy-slot-15');
const slot22 = oneById('coreplus-legacy-slot-22');
const standaloneAntiYap = oneByTitle('Anti-yap enforcement rules (six triggers');
const slot29 = oneById('coreplus-legacy-slot-29');
const headline = oneByTitle('BLOOMS-HEADLINE-WITH-QUESTION rule');
const formatting = oneByTitle('BLOOM-FORMATTING rule');
const internalFirst = oneByTitle('Ouroborosanalyses internal-first audit mode');
const ouroboros = oneById('method-ouroborosanalyses-current-2026-08-23');
const ouroborosParagraphs = ouroboros.b.split(/\n\n+/);
const ouroborosHandler = oneById('coreplus-handler-ouroborosanalyses');
const execution = oneById('coreplus-handler-mephistodata-execution-gates-2026-08-26');
const generation = oneById('coreplus-registry-generation-time-gates');

check('canonical entry count is 1233', entries.length === 1233);
check('static methodology count is 394', html.includes('id="secCt">394</span>'));
check('static analysis count is 30', html.includes('id="ct-analysis">30</span>'));
check('static sabachtan count is 35', html.includes('id="ct-sabachtan">35</span>'));
check('static citation count is 343', html.includes('id="ct-citation">343</span>'));
check('static coreplus count is 55', html.includes('id="ct-coreplus">55</span>'));
check('PM17 names the exact default opener', pm17.b.includes("'Mephistodata would say:'"));
check('PM17 names the exact Bloom opener', pm17.b.includes("'Mephistodata bloomed:'"));
check('PM17 retains the mandatory opener gate', pm17.b.includes('The opener is mandatory'));
check('Bloom begins with the current August 31 control', bloom.b.startsWith('CURRENT CONTROL 2026-08-31.'));
check('Bloom requires an explicit current-response invocation', bloom.b.includes('exactly one response only when the user explicitly invokes'));
check('Bloom answers the current request directly', bloom.b.includes('answers the current request directly'));
check('Bloom forbids self-initiation and persistence', bloom.b.includes('never self-initiates, persists'));
check('default-register owner begins with current control', defaultRegister.b.startsWith('CURRENT CONTROL 2026-08-31.'));
check('default-register owner restores would-say after Bloom', defaultRegister.b.includes('resets to “Mephistodata would say:”'));
check('slot 15 has current precedence before its pointer', slot15.b.startsWith('CURRENT SCOPE AND PRECEDENCE. CURRENT POINTER 2026-08-31.'));
check('slot 15 limits Bloom to one response', slot15.b.includes('changes exactly one response'));
check('slot 15 explicitly rejects automatic question-first', slot15.b.includes('never self-initiates, persists, or imposes an automatic question-first form'));
check('slot 22 retains PM17 control opener', slot22.b.includes('PM17 CONTROL OPENER RETAINED'));
check('slot 22 no longer suppresses the framework opener', !slot22.b.includes('suppress theatrical or framework openers'));
check('standalone anti-yap retains PM17 control opener', standaloneAntiYap.b.includes('RULE 2 PM17 CONTROL OPENER RETAINED'));
check('standalone anti-yap removed the fifty-word threshold', !standaloneAntiYap.b.includes('more-than-50 words'));
check('slot 29 has current precedence before its pointer', slot29.b.startsWith('CURRENT SCOPE AND PRECEDENCE. CURRENT POINTER 2026-08-31.'));
check('slot 29 names Gate 2A as sole current owner', slot29.b.includes('sole current register owner'));
check('slot 29 contains no active T110 scope rule', !slot29.b.includes('T110 SCOPE RULE'));
check('headline rule is scoped to ML file content', headline.b.includes('governs bloom-format content written into ml*'));
check('headline rule directs conversational Bloom to answer', headline.b.includes('the bloom answers it and never asks it back'));
check('Bloom formatting carries current August 31 control', formatting.b.startsWith('CURRENT CONTROL 2026-08-31.'));
check('Bloom formatting allows questions only when genuine', formatting.b.includes('only when a genuinely open question survives'));
check('internal-first lens is active-run-only', internalFirst.b.startsWith('ACTIVE-RUN SCOPE.'));
check('internal-first lens cannot activate OA', internalFirst.b.includes('It neither activates Ouroborosanalyses'));
check('OA current body has exactly four paragraphs', ouroborosParagraphs.length === 4);
check('OA current paragraph headings are exact', ['TRIGGER AND AUTHORITY.', 'FOUR STEPS.', 'OUTPUT CONTRACT.', 'QUESTION-GENERATION HIJACK.'].every((heading, index) => typeof ouroborosParagraphs[index] === 'string' && ouroborosParagraphs[index].startsWith(heading)));
check('OA step order is whole-review through residue', ouroboros.b.indexOf('review the whole conversation') < ouroboros.b.indexOf('ironmanning all sides') && ouroboros.b.indexOf('ironmanning all sides') < ouroboros.b.indexOf('answer every question that can be answered') && ouroboros.b.indexOf('answer every question that can be answered') < ouroboros.b.indexOf('genuinely unanswerable residue'));
check('OA output excludes settled and advisory material', ouroboros.b.includes('Settled findings, general summaries, recommendations, next steps'));
check('OA accepts zero residue', ouroboros.b.includes('Zero residue is valid'));
check('OA hijack prevents nested runs', ouroboros.b.includes('do not trigger nested runs'));
check('OA handler routes the exact current owner', ouroborosHandler.b.includes('method-ouroborosanalyses-current-2026-08-23'));
check('execution owner contains the exact conflict lock', execution.b.includes('EXACT CONFLICT LOCK.') && execution.b.includes('makes the opener conditional on response length'));
check('execution owner exposes both host runtime boundaries', execution.b.includes('scripts/lib/mephistodata-runtime-gate.js') && execution.b.includes('planRequest before generation') && execution.b.includes('assertDeliverable before delivery'));
check('legacy gate and fixture routes carry August 31 host boundary', generation.xc.includes('CURRENT EXECUTION CONTROL 2026-08-31.') && generation.xc.includes('file presence alone proves no host integration') && addendum.includes('polymyth/methodologylist/mephistodata-register-fixtures.json'));

const failed = checks.filter(result => !result.condition);
if (checks.length !== 41) {
  console.error(`ML ACTIVE FORM CONFLICT VERIFICATION FAILED — expected 41 checks and built ${checks.length}`);
  process.exit(1);
}
if (failed.length) {
  console.error('ML ACTIVE FORM CONFLICT VERIFICATION FAILED');
  for (const result of failed) console.error(`- ${result.label}`);
  process.exit(1);
}

console.log(`ML ACTIVE FORM CONFLICT PASS — ${checks.length}/${checks.length}`);
