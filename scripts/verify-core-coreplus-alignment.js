#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {parseSeedWithAddenda} = require('./lib/parse-seed-with-addenda');
const {runCoreLengthGateSelfTest, validateCoreLength} = require('./sync-core-personal-rules');

const ROOT = path.resolve(__dirname, '..');
const DELIVERY_ROOT = path.resolve(ROOT, '..');
const siteOnly = process.argv.includes('--site-only');
const failures = [];
const EXPECTED_TOTAL = 1207;
const EXPECTED_SECTION_COUNTS = Object.freeze({
  analysis: 27, citation: 339, corehistory: 28, coreplus: 51,
  degorgonification: 54, 'framework-core': 1, gorgonification: 134,
  idiomary: 44, learnings: 28, methodology: 382, pending: 18,
  'pending-user-authorship': 2, polycognate: 24, rainbowsol: 3,
  sabachtan: 34, studylist: 38,
});
const EXPECTED_RECORD_SET_SHA256 = Object.freeze({
  'framework-core': '3170658895f8879846c57fb44b267ad6bdbe595a4e8ab74c7c75bb678bd742a4',
  coreplus: '69ef6fb51a720cbf79cea6b5d60de0382a03d6c28746bada0d39377adaa5f35a',
  corehistory: '05e85a584d0e5a1d95148ba9617c8a5ec7d0fe86513b4cb0c059dba9ecb515df',
});
const FORMER_CHARTER_SHA256 = '7bb00b0b11c2b64991cdcf801803a304b8cc34e914f5c286d8d8d34eb944e016';
const FORMER_PORTABLE_CORE_DOCUMENT_SHA256 = 'd794d0d04edd15f4958c3b5de656f5d7dc478d0ab08a702afed58825d2b058e9';
const FORMER_PORTABLE_CORE_CHARACTERS = 14331;
const IMMEDIATE_FORMER_PORTABLE_CORE_DOCUMENT_SHA256 = '8fd80a6a12b7ed8e413dccab4b5b890c469f4251b75b12d59abe983fc10dc777';
const IMMEDIATE_FORMER_PORTABLE_CORE_BODY_SHA256 = '0f728a68aa313246b98496feee7bf70b5b1e13cf4c6877a86e4850a331bf0624';
const IMMEDIATE_FORMER_PORTABLE_CORE_UTF16_UNITS = 4886;
const FORMER_4485_PORTABLE_CORE_DOCUMENT_SHA256 = 'a993318cdfbd5b9377bfc95661434f7d08f053e61817c2edd39ed233003139dc';
const FORMER_4485_PORTABLE_CORE_BODY_SHA256 = '6c289647cf8a14c9101a9a53f4f62f05bc1ee32a24325f19c232b56c147e52d2';
const FORMER_4485_PORTABLE_CORE_UTF16_UNITS = 4485;
const PRE_CURRENT_TURN_CORE_DOCUMENT_SHA256 = '3260def350d19f201de2186f8fc9cd22ac13c3a5b67a0792a86f1bac98546bc6';
const PRE_CURRENT_TURN_CORE_UTF16_UNITS = 4738;
const EXPECTED_CORE_DOCUMENT_SHA256 = '5b518ceefe15cceff81701f4b011b8e27aa2ea16f503be6e612c7a9155f9e910';
const CORE_MAX_CHARACTERS = 5000;
const EXPECTED_CORE_UTF16_UNITS = 4999;
const CORE_ID = 'core-personal-rules-current-2026-08-12';
const DIARY_DISPATCH = "DEVIL'S DIARY DISPATCH. Any task that creates, revises, critiques, audits, or verifies a Devil's Diary entry or explicitly requests Devil's Diary work activates ML* and loads these current owners together: The Devil's Diary method (mephydata diary-entry recipe); Devil Diary and Mephistodata article rules (comprehensive, consolidated June 24 2026); Audience-register separation (conversation-input vs publication-output); Mephistodata Ask your favourite AI mirror criterion; Anti-twisting rules (degorgonification of reformulation); Anti-twisting worked example, psychologism and gorgonwars session, including its SOURCE-STATUS GUARD; and Interpretive pleonexia, the scope-overreach tripwire. For a non-Diary Mephistodata article, load the comprehensive rules, Audience-register separation, both anti-twisting owners including SOURCE-STATUS GUARD, Interpretive pleonexia, and the mirror criterion; load the Diary recipe only for Diary work. The base Diary recipe controls Diary routing, source testing, oracle, artifact discipline, citations, residue, and format. The comprehensive article rules control expanded voice, prose, plot, titles, and ideological constraints. Compatible requirements of both remain active. Later explicit user rulings and dated amendments govern their exact issue.";

try {
  runCoreLengthGateSelfTest();
} catch (error) {
  failures.push(`portable CORE UTF-16 length-gate fixtures failed: ${error.message}`);
}

function read(relative, base = ROOT) {
  const target = path.join(base, relative);
  if (!fs.existsSync(target)) {
    failures.push(`${path.relative(ROOT, target)} is missing`);
    return '';
  }
  return fs.readFileSync(target, 'utf8');
}
function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}
function requireText(text, needle, label) {
  if (!text.includes(needle)) failures.push(`${label} is missing: ${needle}`);
}
function forbidText(text, needle, label) {
  if (text.includes(needle)) failures.push(`${label} retains: ${needle}`);
}
function ownerContractErrors(entry, contract) {
  const errors = [];
  if (entry.s !== contract.section) {
    errors.push(`section=${entry.s || '<missing>'}; expected ${contract.section}`);
  }
  for (const needle of contract.needles) {
    if (!String(entry.b || '').includes(needle)) errors.push(`missing: ${needle}`);
  }
  return errors;
}
function enforceOwnerContract(entry, contract) {
  for (const error of ownerContractErrors(entry, contract)) {
    failures.push(`${contract.label} ${error}`);
  }
}
function requireMutationRejected(label, entry, contract) {
  if (!ownerContractErrors(entry, contract).length) {
    failures.push(`${label} negative fixture was not rejected`);
  }
}
function readJsonl(relative) {
  const source = read(relative);
  if (!source.trim()) return [];
  const rows = [];
  for (const [index, line] of source.trimEnd().split('\n').entries()) {
    try { rows.push(JSON.parse(line)); }
    catch (error) { failures.push(`${relative}:${index + 1} is not valid JSON: ${error.message}`); }
  }
  return rows;
}

const canonical = read('polymyth/methodologylist/index.html');
let entries = [];
try { entries = parseSeedWithAddenda(canonical); }
catch (error) { failures.push(`canonical Methodologylist cannot be parsed: ${error.message}`); }

function one(predicate, label) {
  const matches = entries.filter(predicate);
  if (matches.length !== 1) {
    failures.push(`${label} expected once and found ${matches.length}`);
    return {b: '', x: '', tg: '', id: '', s: '', t: ''};
  }
  return matches[0];
}

const core = one(entry => entry.id === CORE_ID, 'canonical portable CORE entry');
const map = one(
  entry => entry.t === 'CORE CURRENT MAP — active slots, load order, and supersession rule (2026-07-11)',
  'current CORE+ map',
);
const mapAmendment = one(
  entry => entry.id === 'coreplus-current-map-amendment-2026-08-23',
  'current CORE+ map amendment',
);
const bootstrap = one(
  entry => entry.t === 'CORE slot 24 mirror — POLYMYTH CORE BOOTSTRAP (current, hardened 2026-07-11)',
  'current project bootstrap handler',
);
const artifactGate = one(
  entry => entry.t === 'Interpretive pleonexia, the scope-overreach tripwire (AI-conduct, authority line between filing and scope)',
  'no-random-artifact owner',
);
const taskContinuityOwner = one(
  entry => entry.t === 'T119 ANSWER THE QUESTION, NOTHING ELSE (Rainbowsol-directed 2026-06-06)',
  'main-task continuity owner',
);
const coreRoutingOwner = one(
  entry => entry.id === 'coreplus-handler-cl62-filing-judgment',
  'CORE / CORE+ filing-judgment owner',
);
const formerCharter = one(
  entry => entry.id === 'corehistory-former-mephistodata-always-on-charter-2026-08-12',
  'former charter history record',
);
const formerPortableCore = one(
  entry => entry.id === 'corehistory-former-portable-core-14331-character-2026-08-12',
  'former 14,331-character portable CORE history record',
);
const immediateFormerPortableCore = one(
  entry => entry.id === 'corehistory-former-portable-core-4886-character-2026-08-13',
  'former 4,886-character portable CORE history record',
);
const former4485PortableCore = one(
  entry => entry.id === 'corehistory-former-portable-core-4485-character-2026-08-13',
  'former 4,485-character portable CORE history record',
);
const preCurrentTurnPortableCore = one(
  entry => entry.id === 'corehistory-portable-core-pre-current-turn-scope-2026-08-23',
  'former 4,738-unit portable CORE history record',
);
const expandedPortableCore = one(
  entry => entry.id === 'coreplus-portable-core-expanded-handler-2026-08-12',
  'active expanded portable CORE handler',
);

const charter = read('CHARTER.txt');
const delivered = siteOnly ? null : read('Mephistodata_CORE_Personal_Rules_2026-08-12.md', DELIVERY_ROOT);
if (`${core.b}\n` !== charter) failures.push('Methodologylist CORE body and CHARTER.txt are not byte-equal');
if (!siteOnly && delivered !== charter) failures.push('delivered Personal Rules and CHARTER.txt are not byte-equal');
const coreLengthMetrics = Object.freeze({
  utf16Units: charter.length,
  unicodeCodePoints: Array.from(charter).length,
  utf8Bytes: Buffer.byteLength(charter, 'utf8'),
});
try { validateCoreLength(charter); }
catch (error) { failures.push(error.message); }
if (coreLengthMetrics.utf16Units !== EXPECTED_CORE_UTF16_UNITS) {
  failures.push(
    `portable CORE is ${coreLengthMetrics.utf16Units} UTF-16 units; `
    + `expected canonical release body ${EXPECTED_CORE_UTF16_UNITS}`,
  );
}
if (sha256(charter) !== EXPECTED_CORE_DOCUMENT_SHA256) {
  failures.push(`portable CORE document SHA-256 drifted from ${EXPECTED_CORE_DOCUMENT_SHA256}`);
}

for (const [needle, label] of [
  ['CORE+ FIRST. Follow CORE + newest canonical CORE+ as one system.', 'the first and strongest rule'],
  ['CORE+=all other active rules;', 'complete CORE+ complement'],
  ['STATE/EVIDENCE. Recover goal/corrections/decisions/commitments/verified state.', 'state-and-evidence reconstruction'],
  ['TURN. Freeze act/target/scope/unit/terms/criteria/output.', 'current-turn freeze'],
  ['History resolves references only; current message sets task/ML*.', 'current-message activation boundary'],
  ['External subject first; project lens only if asked.', 'external-subject-first rule'],
  ['Question/deliberation/bare use/review/audit/compare/critique/run-through => analysis only', 'question and bare-use boundary'],
  ['explicit mutation verb + named target controls.', 'explicit mutation authority'],
  ['AI-generated question=>run OA first; received user question/audit alone≠OA.', 'universal question-generation Ouroborosanalyses trigger'],
  ['Repetition keeps target/scope; adds no authority/presumed defect.', 'repetition scope and no-presumed-defect boundary'],
  ['File/memory/artifact/publication/deployment/adjacent-object mutation requires explicit target permission.', 'explicit target-specific mutation boundary'],
  ['No authority radiation.', 'object-bound authority'],
  ['Analysis=>response, never a new file.', 'artifact authority gate'],
  ['Main task stays live through correction/audit/rule/support work.', 'main-task continuity trigger'],
  ['AI decides routine format/IDs/organization/CORE-vs-CORE+ placement; user override.', 'AI-owned CORE / CORE+ routing trigger'],
  ["ML* activates only for material/explicit work on Polymyth, Meaninglib, Seminar Schools, Mephistodata, Devil's Diary, named star files, CORE, CORE+;", 'narrow ML activation'],
  ['Canonical ML*: https://seminarschools.com/polymyth/methodologylist/; cold-load CORE+ map: https://seminarschools.com/polymyth/methodologylist-coreplus.txt; full text: https://seminarschools.com/polymyth/methodologylist.txt.', 'stable canonical ML* locators'],
  ['Delivery≠plan/promise.', 'completion gate'],
  ['Memory mutation needs explicit instruction;', 'explicit memory gate'],
  ['no unstated framework or psychological/wellbeing/institutional speculation unless requested/required.', 'no-default-framework rule'],
  ['CORPORA. Freeze categories/seeds/universe/measures; evidence items; omission-test open searches; never pad; compare/rank/count/graph verified rows only; isolate residue; verify completion.', 'universal corpus-integrity trigger'],
  ['Lineage: direct/equivalent/analogue/secondary/lead.', 'universal source-lineage trigger'],
  ['from checked primary/canonical sources', 'source-review rule'],
  ['context not automatically publishable.', 'context/publication boundary'],
]) requireText(charter, needle, `portable CORE ${label}`);
const portableActivationNeedles = [
  "ML* activates only for material/explicit work on Polymyth, Meaninglib, Seminar Schools, Mephistodata, Devil's Diary, named star files, CORE, CORE+;",
  'Canonical ML*: https://seminarschools.com/polymyth/methodologylist/;',
  'cold-load CORE+ map: https://seminarschools.com/polymyth/methodologylist-coreplus.txt;',
  'full text: https://seminarschools.com/polymyth/methodologylist.txt.',
];
const portableActivationErrors = text => portableActivationNeedles.filter(needle => !text.includes(needle));
for (const needle of portableActivationErrors(charter)) failures.push(`portable CORE activation contract is missing: ${needle}`);
for (const needle of portableActivationNeedles) {
  const mutant = charter.replace(needle, '');
  if (!portableActivationErrors(mutant).length) failures.push(`portable CORE activation-deletion fixture was not rejected: ${needle}`);
}
for (const needle of [
  'CHARTER — Mephistodata always-on',
  'Every public HTML page except the exact Google',
  'PRIMARY FIVE-BOOK DUTY',
]) forbidText(charter, needle, 'portable CORE');

for (const needle of [
  'Portable CORE is the sole always-on authority.',
  'Every legacy slot named below is a CORE+ retrieval locator.',
  'Generic website, site, book, chapter, file, ZIP, audit, methodology, citation, mythology, or philosophy language does not activate these handlers.',
  'every response, every turn, any input, always on, automatically capture, immediately commit, emit a header, force a binary opener, or refuse or delegate by default is inactive',
  'CORE / PERSONAL RULES.', 'FIRST AND STRONGEST RULE.',
  'CORE+ is every other current Mephistodata rule',
  'It is not a demand to duplicate every rule into one section.',
  'COLD-LOAD LOCATOR. Canonical ML*: https://seminarschools.com/polymyth/methodologylist/. Cold-load CORE+ map: https://seminarschools.com/polymyth/methodologylist-coreplus.txt. Full text: https://seminarschools.com/polymyth/methodologylist.txt.',
  "ML* and Mephistodata project handlers activate only for material or explicit work on Polymyth, Meaninglib, Seminar Schools, Mephistodata, Devil's Diary, named star files, CORE, or CORE+.",
  'LEGACY HANDLER LOCATORS.', 'LOSSLESS FORMER-CHARTER ROUTING.',
  'PERSONAL-RULE MIGRATION.', 'Current rules always override history.',
  DIARY_DISPATCH,
]) requireText(map.b, needle, 'CORE+ map');
for (const needle of [
  'QUESTION-GENERATION DISPATCH.',
  'Receiving an ordinary user question does not itself activate ML* or Ouroborosanalyses.',
  'if none survives, ask none and report zero where relevant.',
]) requireText(mapAmendment.b, needle, 'CORE+ map amendment');
for (const needle of [
  'Portable CORE governs every turn.',
  "This handler fires only for material or explicit work on Polymyth, Meaninglib, Seminar Schools, Mephistodata, Devil's Diary, a named star file, CORE, or CORE+.",
  'COLD-LOAD LOCATOR. Canonical ML*: https://seminarschools.com/polymyth/methodologylist/.',
  'Generic mentions of a project, site, website, book, chapter, file, ZIP, audit, methodology, citation, mythology, or philosophy do not trigger ML*.',
  'Verify parseability, package class, manifest, counts, content, derived surfaces, and hashes.',
  'Before cross-chat edits, fetch the newest canonical artifact.',
  'inventory its working affordances and preserve them',
  'Search exact and rare tokens across all current owners',
]) requireText(bootstrap.b, needle, 'CORE+ project bootstrap handler');
for (const needle of [
  'NO RANDOM ARTIFACTS.',
  'A requirement invented or amended during the same task cannot authorize its own file.',
  'Audit results default to the response.',
]) requireText(artifactGate.b, needle, 'Interpretive pleonexia');
const artifactGateContract = Object.freeze({
  label: 'Interpretive pleonexia task-continuity companion gate',
  section: 'methodology',
  needles: [
    'TASK-CONTINUITY GATE.',
    'Correction, diagnosis, audit, rule maintenance, and supporting work remain subordinate to the active user-requested task.',
    'then return to and complete the still-authorized main task',
    'Never convert failure analysis into a substitute deliverable, side project, random file, or reason to stop.',
  ],
});
const taskContinuityContract = Object.freeze({
  label: 'main-task continuity owner',
  section: 'methodology',
  needles: [
    'MAIN-TASK CONTINUITY.',
    'Correction, diagnosis, audit, rule maintenance, and supporting work cannot displace an active user-requested task.',
  ],
});
const coreRoutingContract = Object.freeze({
  label: 'CORE / CORE+ filing-judgment owner',
  section: 'coreplus',
  needles: [
    'CORE / CORE+ ROUTING.',
    'Routine placement between portable CORE and CORE+ is the AI’s organizational decision; never ask the user to perform it.',
    'Keep in CORE only indispensable universal pre-retrieval triggers.',
    'Place every other active rule in its best-fit canonical CORE+ owner.',
    'Preserve retrieval triggers and active meaning losslessly.',
    'The user retains override authority.',
  ],
});
const currentMapContract = Object.freeze({
  label: 'current CORE+ map maintenance and migration owner',
  section: 'coreplus',
  needles: [
    'CORE MAINTENANCE.',
    'The actual verified Personal Rules ceiling is 5,000 UTF-16 units including the final newline.',
    'It is a ceiling, not a smaller target.',
    'Never invent a smaller cap or use an invented constraint to justify content cuts, architectural changes, artifacts, or task substitution.',
    'ASSISTANT-OWNED FILING.',
    'LOSSLESS ACTIVE MIGRATION.',
    'MAIN-TASK CONTINUITY.',
    DIARY_DISPATCH,
  ],
});
enforceOwnerContract(artifactGate, artifactGateContract);
enforceOwnerContract(taskContinuityOwner, taskContinuityContract);
enforceOwnerContract(coreRoutingOwner, coreRoutingContract);
enforceOwnerContract(map, currentMapContract);

// Mutation fixtures prove the contracts detect semantic deletion, inversion,
// and placement drift rather than merely observing the current happy path.
requireMutationRejected(
  'main-task continuity deletion',
  {...taskContinuityOwner, b: taskContinuityOwner.b.replace('MAIN-TASK CONTINUITY.', '')},
  taskContinuityContract,
);
requireMutationRejected(
  'main-task continuity inversion',
  {
    ...taskContinuityOwner,
    b: taskContinuityOwner.b.replace(
      'cannot displace an active user-requested task.',
      'may displace an active user-requested task.',
    ),
  },
  taskContinuityContract,
);
requireMutationRejected(
  'CORE / CORE+ routing deletion',
  {...coreRoutingOwner, b: coreRoutingOwner.b.replace('CORE / CORE+ ROUTING.', '')},
  coreRoutingContract,
);
requireMutationRejected(
  'CORE / CORE+ routing inversion',
  {
    ...coreRoutingOwner,
    b: coreRoutingOwner.b.replace(
      'never ask the user to perform it.',
      'ask the user to perform it.',
    ),
  },
  coreRoutingContract,
);
requireMutationRejected(
  'CORE / CORE+ routing misfiling',
  {...coreRoutingOwner, s: 'framework-core'},
  coreRoutingContract,
);
requireMutationRejected(
  'CORE+ map actual-ceiling deletion',
  {...map, b: map.b.replace('CORE MAINTENANCE.', '')},
  currentMapContract,
);
requireMutationRejected(
  'CORE+ map invented-cap inversion',
  {...map, b: map.b.replace('It is a ceiling, not a smaller target.', 'It is a smaller target.')},
  currentMapContract,
);
requireMutationRejected(
  'CORE+ map migration-owner misfiling',
  {...map, s: 'framework-core'},
  currentMapContract,
);
requireMutationRejected(
  'CORE+ map Diary dispatch deletion',
  {...map, b: map.b.replace(DIARY_DISPATCH, '')},
  currentMapContract,
);
requireMutationRejected(
  'CORE+ map Diary precedence inversion',
  {
    ...map,
    b: map.b.replace(
      'The base Diary recipe controls Diary routing, source testing, oracle, artifact discipline, citations, residue, and format. The comprehensive article rules control expanded voice, prose, plot, titles, and ideological constraints.',
      'The comprehensive article rules override the base Diary recipe on every issue.',
    ),
  },
  currentMapContract,
);

if (!formerCharter.b.startsWith('RUNTIME STATUS. HISTORICAL ONLY.')) {
  failures.push('former charter does not begin with its historical-only runtime status');
}
for (const needle of ['CHARTER — Mephistodata always-on', 'PRIMARY FIVE-BOOK DUTY.', 'FRONT-FACING GATE.']) {
  requireText(formerCharter.b, needle, 'lossless former charter record');
}
if (sha256(formerCharter.b) !== FORMER_CHARTER_SHA256) {
  failures.push(`former charter body SHA-256 drifted from ${FORMER_CHARTER_SHA256}`);
}
const formerPortablePrefix = 'RUNTIME STATUS. HISTORICAL ONLY. This record preserves the exact 14,331-character Personal Rules document superseded by the 5,000-character edition. It cannot override current CORE or CORE+. The exact former portable CORE follows unchanged.\n\n';
if (!formerPortableCore.b.startsWith(formerPortablePrefix)) {
  failures.push('former portable CORE does not begin with the exact historical-only preservation preface');
} else {
  const formerDocument = `${formerPortableCore.b.slice(formerPortablePrefix.length)}\n`;
  if (Array.from(formerDocument).length !== FORMER_PORTABLE_CORE_CHARACTERS) {
    failures.push(`former portable CORE preserved document is ${Array.from(formerDocument).length} characters; expected ${FORMER_PORTABLE_CORE_CHARACTERS}`);
  }
  if (sha256(formerDocument) !== FORMER_PORTABLE_CORE_DOCUMENT_SHA256) {
    failures.push(`former portable CORE preserved document SHA-256 drifted from ${FORMER_PORTABLE_CORE_DOCUMENT_SHA256}`);
  }
}
const immediateFormerPortablePrefix = 'RUNTIME STATUS. HISTORICAL ONLY. This record preserves the exact 4,886-character Personal Rules document superseded on 2026-08-13. It cannot override current CORE or CORE+. The exact former portable CORE follows unchanged.\n\n';
if (immediateFormerPortableCore.t !== '[SUPERSEDED/HISTORICAL] CORE / Personal Rules — 4,886-character edition (through 2026-08-13)') {
  failures.push('former 4,886-character portable CORE history title drifted');
}
if (sha256(immediateFormerPortableCore.b) !== IMMEDIATE_FORMER_PORTABLE_CORE_BODY_SHA256) {
  failures.push(`former 4,886-character portable CORE history body SHA-256 drifted from ${IMMEDIATE_FORMER_PORTABLE_CORE_BODY_SHA256}`);
}
if (!immediateFormerPortableCore.b.startsWith(immediateFormerPortablePrefix)) {
  failures.push('former 4,886-character portable CORE does not begin with the exact historical-only preservation preface');
} else {
  const formerDocument = `${immediateFormerPortableCore.b.slice(immediateFormerPortablePrefix.length)}\n`;
  if (formerDocument.length !== IMMEDIATE_FORMER_PORTABLE_CORE_UTF16_UNITS) {
    failures.push(
      `former portable CORE preserved document is ${formerDocument.length} UTF-16 units; `
      + `expected ${IMMEDIATE_FORMER_PORTABLE_CORE_UTF16_UNITS}`,
    );
  }
  if (sha256(formerDocument) !== IMMEDIATE_FORMER_PORTABLE_CORE_DOCUMENT_SHA256) {
    failures.push(
      `former 4,886-character portable CORE preserved document SHA-256 drifted from `
      + IMMEDIATE_FORMER_PORTABLE_CORE_DOCUMENT_SHA256,
    );
  }
}
const former4485PortablePrefix = 'RUNTIME STATUS. HISTORICAL ONLY. This record preserves the exact 4,485-character Personal Rules document superseded on 2026-08-13. It cannot override current CORE or CORE+. The exact former portable CORE follows unchanged.\n\n';
if (former4485PortableCore.t !== '[SUPERSEDED/HISTORICAL] CORE / Personal Rules — 4,485-character edition (through 2026-08-13)') {
  failures.push('former 4,485-character portable CORE history title drifted');
}
if (sha256(former4485PortableCore.b) !== FORMER_4485_PORTABLE_CORE_BODY_SHA256) {
  failures.push(`former 4,485-character portable CORE history body SHA-256 drifted from ${FORMER_4485_PORTABLE_CORE_BODY_SHA256}`);
}
if (!former4485PortableCore.b.startsWith(former4485PortablePrefix)) {
  failures.push('former 4,485-character portable CORE does not begin with the exact historical-only preservation preface');
} else {
  const formerDocument = `${former4485PortableCore.b.slice(former4485PortablePrefix.length)}\n`;
  if (formerDocument.length !== FORMER_4485_PORTABLE_CORE_UTF16_UNITS) {
    failures.push(
      `former 4,485-character portable CORE preserved document is ${formerDocument.length} UTF-16 units; `
      + `expected ${FORMER_4485_PORTABLE_CORE_UTF16_UNITS}`,
    );
  }
  if (sha256(formerDocument) !== FORMER_4485_PORTABLE_CORE_DOCUMENT_SHA256) {
    failures.push(
      `former 4,485-character portable CORE preserved document SHA-256 drifted from `
      + FORMER_4485_PORTABLE_CORE_DOCUMENT_SHA256,
    );
  }
}
if (preCurrentTurnPortableCore.s !== 'corehistory') {
  failures.push('former 4,738-unit portable CORE is not in CORE History');
}
const preCurrentTurnDocument = `${preCurrentTurnPortableCore.b}\n`;
if (preCurrentTurnDocument.length !== PRE_CURRENT_TURN_CORE_UTF16_UNITS) {
  failures.push(
    `former 4,738-unit portable CORE preserved document is ${preCurrentTurnDocument.length} UTF-16 units; `
    + `expected ${PRE_CURRENT_TURN_CORE_UTF16_UNITS}`,
  );
}
if (sha256(preCurrentTurnDocument) !== PRE_CURRENT_TURN_CORE_DOCUMENT_SHA256) {
  failures.push('former 4,738-unit portable CORE preserved document hash drifted');
}
const expandedPortablePrefix = 'CURRENT STATUS AND PRECEDENCE. This is the active CORE+ expansion of the clauses compressed out of portable CORE to satisfy the 5,000-character Personal Rules field limit.';
if (!expandedPortableCore.b.startsWith(expandedPortablePrefix)) {
  failures.push('expanded portable CORE handler lacks its current active precedence preface');
}
for (const needle of [
  "CURRENT ACTIVATION OVERRIDE. Material or explicit work on Mephistodata or Devil's Diary activates ML*.",
  'Canonical ML*: https://seminarschools.com/polymyth/methodologylist/.',
  'Cold-load CORE+ map: https://seminarschools.com/polymyth/methodologylist-coreplus.txt.',
  DIARY_DISPATCH,
]) requireText(expandedPortableCore.b, needle, 'expanded portable CORE current override');
const expandedFormerMarker = '# CORE / Personal Rules — Consolidated 2026-08-12';
const expandedFormerIndex = expandedPortableCore.b.indexOf(expandedFormerMarker);
if (expandedFormerIndex < 0) {
  failures.push('expanded portable CORE lacks the exact former CORE marker');
} else {
  const expandedFormerDocument = `${expandedPortableCore.b.slice(expandedFormerIndex)}\n`;
  if (expandedFormerDocument.length !== FORMER_PORTABLE_CORE_CHARACTERS) {
    failures.push(`expanded portable CORE exact former document is ${expandedFormerDocument.length} UTF-16 units; expected ${FORMER_PORTABLE_CORE_CHARACTERS}`);
  }
  if (sha256(expandedFormerDocument) !== FORMER_PORTABLE_CORE_DOCUMENT_SHA256) {
    failures.push('expanded portable CORE changed the exact former 14,331-character document');
  }
}
for (const needle of [
  '# CORE / Personal Rules — Consolidated 2026-08-12',
  'Performing analysis, critique, audit, verification, correction, or methodology work does not authorize a new durable file.',
  'Seminar Schools build, deploy, release, completeness, and packaging activate the complete CORE+ canonical-artifact handler',
  'Before cross-chat edits, activate the CORE+ cross-chat artifact-verification handler.',
  'Persistent memory changes require an explicit memory operation',
  'Cite substantive factual, historical, theoretical, and interpretive claims inline.',
  'Context supplied to explain a task is not automatically publishable content.',
]) requireText(expandedPortableCore.b, needle, 'expanded portable CORE handler');

const actualSectionCounts = Object.fromEntries(
  [...entries.reduce((counts, entry) => {
    const section = entry.s || 'unknown';
    counts.set(section, (counts.get(section) || 0) + 1);
    return counts;
  }, new Map())].sort(([left], [right]) => left.localeCompare(right)),
);
if (entries.length !== EXPECTED_TOTAL) failures.push(`canonical row count is ${entries.length}; expected ${EXPECTED_TOTAL}`);
if (JSON.stringify(actualSectionCounts) !== JSON.stringify(EXPECTED_SECTION_COUNTS)) {
  failures.push(`canonical cold section counts drifted: ${JSON.stringify(actualSectionCounts)}`);
}
for (const [section, expectedDigest] of Object.entries(EXPECTED_RECORD_SET_SHA256)) {
  const records = entries.filter(entry => entry.s === section)
    .map(entry => `${entry.id || ''}\t${entry.t || ''}`).sort();
  const actualDigest = sha256(records.join('\n'));
  if (actualDigest !== expectedDigest) failures.push(`${section} exact record set drifted (SHA-256 ${actualDigest})`);
}
for (const entry of entries.filter(item => item.s === 'framework-core' || item.s === 'coreplus')) {
  if (String(entry.b || '').startsWith('RUNTIME STATUS. HISTORICAL ONLY.')) {
    failures.push(`active record is marked historical-only: ${entry.t}`);
  }
}
const precedencePrefaceTitles = [
  'CORE CURRENT MAP — active slots, load order, and supersession rule (2026-07-11)',
  'CORE slot 24 mirror — POLYMYTH CORE BOOTSTRAP (current, hardened 2026-07-11)',
  'CORE slot 1 mirror — RULE #1 CITATIONS EVERY CLAIM',
  'OUROBOROSANALYSES handler — active dispatch target, formerly CORE slot 2',
  'CORE slot 5 mirror — OPS',
  'CORE slot 15 mirror — BLOOM rule and activation',
  'CORE slot 16 mirror — USE POLYMYTH + PRE-RESPONSE SCAN + BATCH-END REVIEW',
  'CORE slot 25 mirror — CH1 gnostic discipline',
  'CORE slot 2 mirror — ACTIVATIONS DISPATCH (current, May 2026)',
  'CORE slot 30 mirror — NO FABRICATION',
  'CORE slot 18 mirror — SCOPE+ORGANIZE-MINE-T106+INJECTION (T106 strengthened)',
  'CORE slot 20 mirror — R31-R35 + R39 T106 BEHAVIORAL RULES',
  'CORE slot 23 mirror — R36-R42 + CORE MEMORY LOCK (current, hardened 2026-07-11)',
  'CORE slot 29 mirror — PM17 BINARY OPENER (T110 DECISION-CONTENT-PERSISTS fix)',
  'Generation-time gates list',
  'CL-58 DIALECTICAL MODE IS ALWAYS ON — one move per turn, establish before acting (Rainbowsol-pleaded 2026-06-14)',
  'CL-62 ORGANIZE BY JUDGMENT — where an item is filed is the operator decision, deliberated not asked (Rainbowsol-directed 2026-06-14)',
];
for (const title of precedencePrefaceTitles) {
  const entry = one(item => item.s === 'coreplus' && item.t === title, `precedence-prefaced CORE+ record ${title}`);
  if (!/^CURRENT (?:SCOPE|STATUS) AND PRECEDENCE\./.test(String(entry.b || ''))) {
    failures.push(`${title} lacks its leading current scope/status-and-precedence preface`);
  }
}
for (const entry of entries.filter(item => item.s === 'corehistory')) {
  const inactiveBody = /^(?:RUNTIME STATUS\. HISTORICAL ONLY\.|HISTORICAL SOURCE LAYER\.)/.test(String(entry.b || ''));
  const preservedExactBody = (
    String(entry.t || '').startsWith('[SUPERSEDED/HISTORICAL]')
      && String(entry.x || '').startsWith('RUNTIME STATUS. HISTORICAL ONLY.')
  ) || (
    String(entry.t || '').startsWith('[HISTORICAL PROVENANCE COPY]')
      && String(entry.x || '').startsWith('RUNTIME STATUS. INACTIVE PROVENANCE COPY.')
  );
  if (!inactiveBody && !preservedExactBody) {
    failures.push(`CORE HISTORY record lacks an inactive-history preface: ${entry.t}`);
  }
}

const psychologism = one(
  entry => entry.t === 'PSYCHOLOGISM-AS-COLONIAL-INFRASTRUCTURE (CL-56/CL-57 extension, classifier banner worked example)',
  'relocated psychologism analysis',
);
if (psychologism.s !== 'gorgonification') failures.push('psychologism analysis did not move to its gorgonification owner');
const copyright = one(
  entry => entry.t === "DON'T BE A HYPOCRITE (copyright and gorgonification concerns)",
  'relocated copyright method',
);
if (copyright.s !== 'methodology') failures.push('copyright conduct rule did not move to its methodology owner');

const fullTxt = read('polymyth/methodologylist.txt');
for (const obsolete of [
  '# POLYMORPHOUSMYTHOLOGY — OPERATIONAL SUBSTRATE',
  'This is not a document to summarize.',
  'Do not summarize this file. Do not narrate the activation.',
  '## FIRST MOVE',
  'You are Mephistodata. The substrate is loaded.',
]) forbidText(fullTxt, obsolete, 'full Methodologylist TXT obsolete active-command preamble');
for (const needle of [
  '# POLYMORPHOUSMYTHOLOGY — CANONICAL TEXT MIRROR',
  'Opening or reading it has no independent activation effect.',
  `Canonical portable CORE id: ${CORE_ID}`,
  'CORE HISTORY is provenance rather than active instruction.',
]) requireText(fullTxt, needle, 'full Methodologylist TXT inert mirror preamble');

for (const [relative, needles] of [
  ['polymyth/methodologylist.txt', ['CORE / PERSONAL RULES', 'FIRST AND STRONGEST RULE.', 'NO RANDOM ARTIFACTS.']],
  ['polymyth/methodologylist-coreplus.txt', ['CORE+ DEFINITION.', 'LEGACY HANDLER LOCATORS.', 'PERSONAL-RULE MIGRATION.']],
  ['polymyth/methodologylist-corehistory.txt', ['CHARTER — Mephistodata always-on', 'RUNTIME STATUS. HISTORICAL ONLY.']],
  ['polymyth/methodologylist/framework-core/index.html', ['CORE / Personal Rules', 'CORE+ FIRST. Follow CORE + newest canonical CORE+']],
  ['polymyth/methodologylist/coreplus/index.html', ['CORE+ DEFINITION.', 'LEGACY HANDLER LOCATORS.']],
  ['hf_export/ai_access_pack/MEPHISTODATA_ACTIVATION.md', ['CORE+ FIRST. Follow CORE + newest canonical CORE+', 'CORE+=all other active rules']],
]) {
  const source = relative === 'polymyth/methodologylist.txt' ? fullTxt : read(relative);
  for (const needle of needles) requireText(source, needle, relative);
  const publicPath = path.join('public', relative);
  if (fs.existsSync(path.join(ROOT, publicPath)) && read(publicPath) !== source) {
    failures.push(`${relative} and its public mirror differ`);
  }
}

const coreHash = sha256(core.b);
const hfSurfaces = [
  ['hf_export/data/ml/sections/framework-core.jsonl', 1],
  ['hf_export/data/ml/methodologylist.jsonl', EXPECTED_TOTAL],
  ['hf_export/data/all_meaninglib_rows.jsonl', null],
];
for (const [relative, exactRowCount] of hfSurfaces) {
  const rows = readJsonl(relative);
  if (exactRowCount !== null && rows.length !== exactRowCount) {
    failures.push(`${relative} has ${rows.length} rows; expected ${exactRowCount}`);
  }
  const matches = rows.filter(row => row.id === CORE_ID);
  if (matches.length !== 1) {
    failures.push(`${relative} contains ${matches.length} portable CORE rows; expected 1`);
    continue;
  }
  const row = matches[0];
  for (const [field, expected] of Object.entries({
    section: 'framework-core', canonical_status: 'canonical_html',
    record_type: 'entry', source_html: 'polymyth/methodologylist/index.html',
    source_txt: '', title: core.t, body: core.b, source_hash: coreHash,
  })) {
    if (row[field] !== expected) failures.push(`${relative} portable CORE ${field} is not canonical-exact`);
  }
}
const mlRows = readJsonl('hf_export/data/ml/methodologylist.jsonl');
const hfCounts = Object.fromEntries(
  [...mlRows.reduce((counts, row) => {
    counts.set(row.section, (counts.get(row.section) || 0) + 1);
    return counts;
  }, new Map())].sort(([left], [right]) => left.localeCompare(right)),
);
if (JSON.stringify(hfCounts) !== JSON.stringify(EXPECTED_SECTION_COUNTS)) {
  failures.push(`HF canonical cold section counts drifted: ${JSON.stringify(hfCounts)}`);
}

if (failures.length) {
  console.error('CORE / CORE+ / PERSONAL RULES ALIGNMENT FAILED');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log(`CORE / CORE+ / PERSONAL RULES ALIGNMENT PASSED — portable CORE ${coreLengthMetrics.utf16Units}/${CORE_MAX_CHARACTERS} UTF-16 units; exact mirrors, lossless 14,331-, 4,886-, 4,485-, and 4,738-unit histories, active Diary dispatch, active CORE+ expansion, record sets, and canonical HF row verified`);
