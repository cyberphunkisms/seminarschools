#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { parseSeedWithAddenda } = require('./lib/parse-seed-with-addenda');

const ROOT = path.resolve(__dirname, '..');
const HTML = path.join(ROOT, 'polymyth/methodologylist/index.html');
const ADDENDUM = path.join(ROOT, 'polymyth/methodologylist/mephistodata-rule-hardening-addendum.js');
const SOURCE = path.join(ROOT, '../UPDATE_SOURCES/ML_STAR_UPDATE_SOURCE_DELIVERABLE_ACCOUNTING_ANTI_WASTE_2026-08-29.md');

function replaceOnce(text, before, after, label) {
  const count = text.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  return text.replace(before, after);
}

function writeChanged(file, text) {
  if (fs.readFileSync(file, 'utf8') !== text) fs.writeFileSync(file, text, 'utf8');
}

let html = fs.readFileSync(HTML, 'utf8');
const parsed = parseSeedWithAddenda(html);
const core = parsed.find(entry => entry.id === 'core-personal-rules-current-2026-08-12');
if (!core) throw new Error('portable CORE missing');
let coreBody = core.b;
for (const heading of [
  'AUTHORITY. ', 'RETRIEVAL/ML*. ', 'FILING. ', 'EXECUTION. ',
  'AUTHORSHIP/REASONING. ', 'SOURCES/WRITING. ',
]) coreBody = coreBody.replace(heading, '');
coreBody = replaceOnce(
  coreBody,
  'Ordinary meaning; no ambiguity/evasion. Report proposed/attempted/changed/verified truthfully;',
  'Ordinary meaning; no ambiguity/evasion. Ledger result; continue=unit; support≠result; disclose shortfall; partial≠final. Report proposed/attempted/changed/verified truthfully;',
  'portable CORE execution rule',
);
if (coreBody.length > 5000) throw new Error(`portable CORE exceeds 5000 UTF-16 units: ${coreBody.length}`);
html = replaceOnce(html, core.b, coreBody, 'portable CORE body');
html = replaceOnce(
  html,
  'Preserve mixed cases and genuine residue instead of forcing clean classes.',
  'Preserve mixed cases and genuine residue instead of forcing clean classes. When every frozen item must be treated and provisional judgment is permitted, assign each item its best-supported current verdict; record confidence, evidence limits, and certification separately. Missing ideal evidence lowers confidence and never silently converts an item into unprocessed residue.',
  'comparative classification rule',
);
html = replaceOnce(
  html,
  'RESIDUE AND COMPLETION. Isolate disputed rows and deliver stable results. One unresolved row cannot withhold those results. Report corpus-coverage status and classification status separately. Coverage may be complete while genuine classification residue remains; the classifications are not fully adjudicated until every required dispute is resolved. Distinguish discovery complete, first-pass coded, calibration passed, cross-audited, omission-tested, and final verified. Tool activity, search totals, promises, and progress narration prove nothing.',
  'RESIDUE AND COMPLETION. Isolate disputed rows and deliver stable results. One unresolved row cannot withhold those results. Maintain a ledger in the requested unit. Sources checked, objects inventoried, searches run, candidates audited, files packaged, and validation are supporting counts; none substitutes for the requested classification, ranking, comparison, or other substantive result. Repeated continuation advances the frozen deliverable and cannot silently switch units. Report corpus-coverage status and classification status separately; also report substantive-treatment and evidence status separately. Disclose any material remainder or method-driven abstention when it arises and before further costly work. Coverage may be complete while genuine classification residue remains; the classifications are not fully adjudicated until every required dispute is resolved. Distinguish discovery complete, first-pass coded, calibration passed, cross-audited, omission-tested, and final verified. Final requires exact reconciliation to the frozen population, requested unit, and completion condition. Tool activity, search totals, promises, and progress narration prove nothing.',
  'comparative completion rule',
);
writeChanged(HTML, html);

let addendum = fs.readFileSync(ADDENDUM, 'utf8');
const sourceHash = crypto.createHash('sha256').update(fs.readFileSync(SOURCE)).digest('hex');
const sourceEntry = `  Object.freeze({
    id: 'citation-ml-star-deliverable-accounting-anti-waste-source-2026-08-29',
    s: 'citation',
    r: 'both',
    t: 'ML* deliverable accounting and anti-waste rule source, 2026-08-29',
    b: \`SOURCE IDENTITY. ML_STAR_UPDATE_SOURCE_DELIVERABLE_ACCOUNTING_ANTI_WASTE_2026-08-29.md. SHA-256 ${sourceHash}.

SOURCE STATUS. Direct user-authorized rule source. It records the failure in which a requested 265-item ranking was reported final after only 17 placements while 248 items remained unranked.

ADOPTED RULE. Freeze and ledger the exact requested deliverable. Continuation advances the same unit. Supporting activity never substitutes for the substantive result. Separate judgment from confidence, evidence, and certification. Disclose material shortfall before further cost. Never call a partial or substituted output final.\`,
    x: 'Primary source for the 2026-08-29 universal deliverable-accounting and anti-waste amendment.',
    tg: 'citation, deliverable-accounting, anti-waste, continuation, exact-ledger, substantive-completion, shortfall-disclosure, no-false-final, 265-17-248, 2026-08-29',
    xr: ['core-personal-rules-current-2026-08-12', 'coreplus-handler-mephistodata-execution-gates-2026-08-26', 'method-comparative-corpus-integrity-2026-08-23']
  }),
`;
addendum = replaceOnce(
  addendum,
  'const MEPHISTODATA_RULE_HARDENING_ADDENDUM = Object.freeze([\n',
  'const MEPHISTODATA_RULE_HARDENING_ADDENDUM = Object.freeze([\n' + sourceEntry,
  'citation insertion',
);
addendum = replaceOnce(
  addendum,
  'UNIVERSAL ML* EXECUTION DISPATCH. Every ML*-active task loads coreplus-handler-mephistodata-execution-gates-2026-08-26 after portable CORE and this map. The gate runs silently and fail-closed. Explicit Mephistodata reactivation resets any unsent stale draft before the current task is rebuilt.\n\nWRITING DISPATCH.',
  'UNIVERSAL ML* EXECUTION DISPATCH. Every ML*-active task loads coreplus-handler-mephistodata-execution-gates-2026-08-26 after portable CORE and this map. The gate runs silently and fail-closed. Explicit Mephistodata reactivation resets any unsent stale draft before the current task is rebuilt.\n\nDELIVERABLE-ACCOUNTING DISPATCH. Multi-item, repeated-continuation, or costly work loads the execution owner’s exact deliverable ledger. Continuation advances the frozen requested unit. Audit, coverage, bookkeeping, packaging, validation, and other support remain separate from substantive completion. Disclose material shortfall or method-driven reduction when it arises. Final and complete claims require exact reconciliation to the frozen completion condition.\n\nWRITING DISPATCH.',
  'current map dispatch',
);
addendum = replaceOnce(
  addendum,
  'GATE 7, OUROBOROS AND COMPLETENESS. An explicit Ouroborosanalyses request runs the settled whole-conversation four-step method, answers every answerable objection, and returns only genuine residue. Zero residue is valid. Claims of all, everything, fully comprehensive, or only unresolved require a source inventory, claim inventory, source-to-output coverage map, explicit exclusions, conflict ledger, and final omission scan. Do not certify completeness from intuition.',
  'GATE 7, DELIVERABLE ACCOUNTING, OUROBOROS, AND COMPLETENESS. Freeze the requested deliverable, population, unit, criteria, output, and completion condition. Maintain the ledger in that unit throughout multi-item, repeated-continuation, or costly work. Next, continue, and keep going advance the same deliverable unless the user explicitly changes it. Research, source checks, audits, coverage, bookkeeping, packaging, validation, tool calls, and progress narration are support and never count as the requested substantive result. Separate judgment from confidence, evidence quality, and certification. When provisional judgment is permitted, missing ideal evidence lowers confidence and does not create unprocessed residue. Disclose material shortfall, method-driven reduction, or inability to advance as soon as it arises and before further cost. Stop additional expenditure when work no longer advances the exact deliverable. Never call partial, substituted, or support-only output final or complete. An explicit Ouroborosanalyses request runs the settled whole-conversation four-step method, answers every answerable objection, and returns only genuine residue. Zero residue is valid. Claims of all, everything, fully comprehensive, or only unresolved require a source inventory, claim inventory, source-to-output coverage map, explicit exclusions, conflict ledger, and final omission scan. Final requires requested population = substantively treated + explicitly disclosed unresolved remainder and the frozen completion condition. Do not certify completeness from intuition.',
  'execution gate 7',
);
addendum = addendum.replace(
  'amended 2026-08-29 for non-strawman adjudication, internal retrieval, and writing composition.',
  'amended 2026-08-29 for non-strawman adjudication, internal retrieval, writing composition, and deliverable accounting.',
);
writeChanged(ADDENDUM, addendum);

for (const relative of [
  'scripts/fixtures/ml-execution-gates/fixtures.json',
  'scripts/fixtures/ml-execution-gates/internal-writing-fixtures.json',
]) {
  const file = path.join(ROOT, relative);
  const fixtures = JSON.parse(fs.readFileSync(file, 'utf8'));
  const additions = [
    { id: 'deliverable_full_265_ranked_pass', kind: 'deliverable', requested: 265, substantive_completed: 265, unresolved: 0, support_count: 111, continuation_kept_unit: true, shortfall_disclosed_before_cost: true, labelled_final: true, provisional_allowed: false, confidence_separate: true, expected_pass: true },
    { id: 'deliverable_17_ranked_248_unranked_final_fail', kind: 'deliverable', requested: 265, substantive_completed: 17, unresolved: 248, support_count: 111, continuation_kept_unit: true, shortfall_disclosed_before_cost: false, labelled_final: true, provisional_allowed: false, confidence_separate: false, expected_pass: false },
    { id: 'deliverable_undisclosed_continuation_shortfall_fail', kind: 'deliverable', requested: 265, substantive_completed: 17, unresolved: 248, support_count: 248, continuation_kept_unit: false, shortfall_disclosed_before_cost: false, labelled_final: false, provisional_allowed: false, confidence_separate: true, expected_pass: false },
    { id: 'deliverable_provisional_confidence_separation_pass', kind: 'deliverable', requested: 265, substantive_completed: 265, unresolved: 0, support_count: 17, continuation_kept_unit: true, shortfall_disclosed_before_cost: true, labelled_final: true, provisional_allowed: true, confidence_separate: true, expected_pass: true },
  ];
  const ids = new Set(fixtures.map(item => item.id));
  for (const item of additions) if (!ids.has(item.id)) fixtures.push(item);
  fs.writeFileSync(file, JSON.stringify(fixtures, null, 2) + '\n');
}

console.log(JSON.stringify({ status: 'applied', core_utf16_units: coreBody.length, source_sha256: sourceHash }, null, 2));
