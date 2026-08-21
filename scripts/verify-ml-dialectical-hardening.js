#!/usr/bin/env node
'use strict';

/** Regression gate for the user-directed 2026-08-04 and 2026-08-05 hardening. */

const fs = require('fs');
const path = require('path');
const {parseSeedWithAddenda} = require('./lib/parse-seed-with-addenda');

const ROOT = path.resolve(__dirname, '..');
const failures = [];

function read(relative) {
  const target = path.join(ROOT, relative);
  if (!fs.existsSync(target)) {
    failures.push(`${relative} is missing`);
    return '';
  }
  return fs.readFileSync(target, 'utf8');
}

function requireText(relative, needle, label) {
  const source = read(relative);
  if (!source.includes(needle)) failures.push(`${relative} misses ${label}`);
}

function forbidText(relative, needle, label) {
  const source = read(relative);
  if (source.includes(needle)) failures.push(`${relative} retains ${label}`);
}

const canonicalRelative = 'polymyth/methodologylist/index.html';
const canonical = read(canonicalRelative);
let entries = [];
try {
  entries = parseSeedWithAddenda(canonical);
} catch (error) {
  failures.push(`canonical SEED parse failed: ${error.message}`);
}

function entry(title) {
  const matches = entries.filter(item => item.t === title);
  if (matches.length !== 1) {
    failures.push(`${title} expected once, found ${matches.length}`);
    return {b: '', x: '', tg: ''};
  }
  return matches[0];
}

function requireEntryText(title, field, needle, label) {
  const value = String(entry(title)[field] || '');
  if (!value.includes(needle)) failures.push(`${title} misses ${label}`);
}

function forbidEntryText(title, field, needle, label) {
  const value = String(entry(title)[field] || '');
  if (value.includes(needle)) failures.push(`${title} retains ${label}`);
}

const pm11 = "PM11. DIALECTICAL-PACING — no gun-jumping when structure is the user's to direct";
const mirror = 'PM11 mirror — DIALECTICAL-PACING (no gun-jumping)';
const cl58 = 'CL-58 DIALECTICAL MODE IS ALWAYS ON — one move per turn, establish before acting (Rainbowsol-pleaded 2026-06-14)';
const cl59 = 'CL-59 READ THE SPEECH-ACT — a directive means execute, deliberation or stop means hold (2026-06-14)';
const choice = 'CHOICE-INSIDE-THE-FIX plus ADVOCACY-WEARING-ANALYSIS (Rainbowsol June 11 2026, generalizes bb dm-084 and dm-089 to all work)';
const gunJump = 'Gun-jump rule (anti-premature-action)';
const antiYap = 'CORE slot 22 mirror — ANTI-YAPPING RULES';
const commitAsk = 'Mephistodata commit-or-ask protocol (T114d user-coined dialectic-execution rule, audit-correction)';
const coreMap = 'CORE CURRENT MAP — active slots, load order, and supersession rule (2026-07-11)';

for (const title of [pm11, mirror, cl58, cl59, choice, gunJump, antiYap, commitAsk, coreMap]) entry(title);

requireEntryText(pm11, 'b', 'Analysis or deliberation authorizes read-only work on that object.', 'the object-scoped deliberation hold');
requireEntryText(pm11, 'b', 'A constraint binds later work and does not authorize it.', 'the constraint/authorization boundary');
requireEntryText(pm11, 'b', 'A synthesis candidate remains unbuilt. Then stop for the user\'s ruling.', 'the unbuilt-synthesis stop');
requireEntryText(pm11, 'b', 'WORKED EXAMPLE, 2026-08-04.', 'the homepage failure record');
requireEntryText(pm11, 'b', 'A settled multi-step directive executes fully.', 'settled multi-step execution');
requireEntryText(pm11, 'b', 'Authorization never radiates between objects.', 'the per-object authorization boundary');
requireEntryText(pm11, 'b', 'SEMANTIC AUTHORITY.', 'the action/meaning distinction');
requireEntryText(pm11, 'b', 'Quoting AI wording to question, criticize, compare, or reject it is not adoption.', 'the quotation-is-not-adoption rule');
requireEntryText(pm11, 'b', 'HARDEN WITHOUT REWRITING.', 'the hardening scope boundary');
requireEntryText(pm11, 'b', 'A test may enforce a settled requirement. It cannot create one.', 'the test-cannot-create-doctrine rule');
requireEntryText(pm11, 'b', 'WORKED EXAMPLE, 2026-08-05.', 'the geometry overcorrection record');
requireEntryText(pm11, 'b', 'The geometry policy remains unsettled and unchanged in this correction.', 'the adjacent-object hold');
requireEntryText(pm11, 'x', 'No new subtype was created.', 'the spirit-over-letter boundary');
forbidEntryText(pm11, 'b', 'Then and only then act.', 'the same-turn action loophole');
forbidEntryText(pm11, 'b', 'AI executes one step, surfaces what was found, stops, awaits direction.', 'the one-step permission ritual');

requireEntryText(mirror, 'b', 'BEFORE ANY MUTATION.', 'the scanner-accessible pre-action gate');
requireEntryText(mirror, 'b', 'Post-hoc approval is not dialectical pacing.', 'the post-hoc-ratification ban');
requireEntryText(mirror, 'b', 'It does not create another subtype.', 'the no-subtype-proliferation rule');
requireEntryText(mirror, 'b', 'SEMANTIC AUTHORITY.', 'the mirror semantic-authority gate');
requireEntryText(mirror, 'b', 'A message may diagnose object A and direct a change to object B. Hold A and execute only B.', 'the mirror object boundary');
requireEntryText(mirror, 'b', 'A verification test enforces a settled requirement; it cannot create one.', 'the mirror test boundary');

requireEntryText(cl58, 'b', 'Agreement must precede mutation.', 'pre-action agreement');
requireEntryText(cl58, 'b', 'Stop closes all mutable work immediately', 'stop precedence');
requireEntryText(cl58, 'b', 'Agreement covers both the action and the meaning being committed.', 'semantic agreement');
requireEntryText(cl58, 'b', 'Different objects in one message are classified separately.', 'per-object classification');
requireEntryText(cl58, 'b', 'explicitly delegates both semantic judgment and implementation', 'the explicit delegation exception');

requireEntryText(cl59, 'b', 'Read each speech-act in full and bind it to its named object', 'whole-speech-act classification');
requireEntryText(cl59, 'b', 'Outcome language about an object remains deliberation for that object', 'object-scoped deliberation hold');
requireEntryText(cl59, 'b', 'STOP PRECEDENCE.', 'the explicit stop gate');
requireEntryText(cl59, 'b', 'OBJECT BOUNDARY.', 'the per-object speech-act rule');
requireEntryText(cl59, 'b', 'SEMANTIC STATUS.', 'the semantic-source classifier');
requireEntryText(cl59, 'b', 'A user correction rejects the conflicting claim and does not choose a replacement.', 'correction-without-silent-replacement');
requireEntryText(cl59, 'b', 'A local example does not become universal through inference.', 'the no-silent-universalization rule');
forbidEntryText(cl59, 'b', 'A DIRECTIVE is an imperative to act', 'the broad action-verb shortcut');

requireEntryText(choice, 'b', 'surface the fork before committing and wait for the author’s ruling', 'the pre-commit creative-fork rule');
requireEntryText(choice, 'b', 'does not cure the gun-jump', 'the post-hoc-ratification ban');
requireEntryText(choice, 'b', 'A verification test contains a semantic choice when it changes which artifacts pass.', 'the verification-choice boundary');
requireEntryText(choice, 'b', 'A directive to harden a rule does not authorize rewriting its meaning or scope.', 'the harden-without-rewriting boundary');
forbidEntryText(choice, 'b', 'flagging it for ratification in the same delivery', 'the former post-hoc-ratification allowance');

requireEntryText(gunJump, 'b', 'OUTCOME LANGUAGE DOES NOT SETTLE DESIGN.', 'the desired-outcome/design distinction');
requireEntryText(gunJump, 'b', 'Stop cancels prior and pending mutable scope immediately.', 'the stop rule');

requireEntryText(antiYap, 'b', 'Settled build-request: execute and report briefly.', 'the settled-build qualifier');
requireEntryText(antiYap, 'b', 'synthesis candidate left unbuilt', 'the no-action dialectical audit');
requireEntryText(antiYap, 'b', 'pointing at an error is diagnosis rather than a fix request', 'the diagnosis/fix boundary');
requireEntryText(antiYap, 'b', '2026-08-04 AUTHORIZATION HARDENING.', 'the answer-first authorization gate');
requireEntryText(antiYap, 'b', '2026-08-05 SEMANTIC AUTHORITY HARDENING.', 'the answer-first semantic-authority gate');
requireEntryText(antiYap, 'b', 'A diagnosis of object A does not authorize changing A when the same message explicitly directs only object B.', 'the answer-first object boundary');
requireEntryText(antiYap, 'b', 'Any changed case is a proposed rule change and holds before mutation.', 'the answer-first hardening boundary');
forbidEntryText(antiYap, 'b', 'pointing at an error is a request to fix that error', 'the diagnosis-as-authorization sentence');

requireEntryText(commitAsk, 'b', 'SETTLED-COMMIT branch', 'the settled-commit branch');
requireEntryText(commitAsk, 'b', 'UNDERSTANDING IS NOT SETTLEMENT.', 'the confidence/authority boundary');
requireEntryText(commitAsk, 'b', 'PM11 and CL-59 govern before this protocol', 'the commit-or-ask precedence');
forbidEntryText(commitAsk, 'b', 'UNDERSTAND-COMMIT branch', 'the confidence-based commit branch');
forbidEntryText(commitAsk, 'b', 'commits the substrate to framework files immediately', 'the unconditional commit instruction');

requireEntryText(coreMap, 'b', 'SEMANTIC-AUTHORITY PRECEDENCE.', 'the active precedence map');
requireEntryText(coreMap, 'b', 'They override deduction-first, commit-or-ask, execute-dont-equivocate, ORGANIZE-MINE, and the AI-conduct naming exemption on that semantic axis.', 'the conflicting-rule precedence');
requireEntryText(coreMap, 'b', 'None converts AI understanding into authorial settlement.', 'the semantic-authority ceiling');

requireText('CHARTER.txt', 'Question/deliberation/review/audit/compare/critique/run-through => answer/one analytical move only.', 'the portable CORE questions and analysis-only boundary');
requireText('CHARTER.txt', 'Directive => named scope/target.', 'the portable CORE named-target boundary');
requireText('CHARTER.txt', 'Any file, memory, artifact, publication, deployment, or adjacent-object mutation requires explicit target permission.', 'the portable CORE no-mutation boundary');
requireText('CHARTER.txt', 'No authority radiation.', 'the portable CORE object boundary');
requireText('CHARTER.txt', 'Correction supersedes conflict without choosing replacement; constraint binds later authorized work.', 'the portable CORE correction and constraint boundary');
requireText('CHARTER.txt', 'Stop=hold.', 'the portable CORE stop gate');
for (const [needle, label] of [
  ['Permission to update, fix, harden, implement, enforce, or continue does not ratify assistant wording', 'the expanded CORE action/meaning boundary'],
  ['Explicit adoption of a clearly identified earlier proposal makes it accepted from that point forward.', 'the expanded CORE adoption boundary'],
  ['"Go," "do it," "yes," and similar assent authorize only the concrete, fully specified action in the immediate context.', 'the expanded CORE narrow-assent rule'],
  ['Personal Rules, persistent memory, existing project files, and newly created files are separate mutation targets.', 'the expanded CORE separate-target rule'],
]) requireText('polymyth/methodologylist-coreplus.txt', needle, label);
forbidText('CHARTER.txt', 'Pointing at an error means fix that\nerror.', 'the old bootstrap diagnosis-as-authorization rule');

requireText('scripts/regen-methodologylist-txt.js', "'framework-core', 'coreplus'", 'portable CORE-first section order');
requireText('scripts/regen-methodologylist-txt.js', 'Opening or reading it has no independent activation effect.', 'the inert text-mirror boundary');
requireText('scripts/regen-methodologylist-txt.js', 'syncCorePersonalRules', 'canonical portable CORE synchronization');
requireText('scripts/build-ai-access-pack.js', 'Authorization never radiates between objects.', 'the AI access-pack object boundary');
requireText('scripts/build-ai-access-pack.js', 'Permission to update, fix, harden, implement, or enforce is not semantic settlement.', 'the AI access-pack semantic-authority gate');
requireText('scripts/build-ai-access-pack.js', 'A verification test enforces settled doctrine and cannot create doctrine.', 'the AI access-pack test boundary');
requireText('scripts/apply-ml-dialectical-hardening.js', 'applySemanticAuthorityHardening();', 'the durable semantic-hardening writer');
requireText('scripts/apply-ml-dialectical-hardening.js', 'UNDERSTANDING IS NOT SETTLEMENT.', 'the durable commit-or-ask correction');

for (const relative of [
  'polymyth/methodologylist.txt',
  'polymyth/methodologylist-methodology.txt',
  'polymyth/methodologylist-coreplus.txt',
  'polymyth/methodologylist/methodology/index.html',
  'polymyth/methodologylist/coreplus/index.html',
  'public/polymyth/methodologylist.txt',
  'public/polymyth/methodologylist-methodology.txt',
  'public/polymyth/methodologylist-coreplus.txt',
  'public/polymyth/methodologylist/methodology/index.html',
  'public/polymyth/methodologylist/coreplus/index.html',
]) {
  requireText(relative, 'semantic-authority', 'the generated semantic-authority hardening');
  requireText(relative, 'hardened-2026-08-05', 'the generated hardening provenance');
}

for (const relative of [
  'polymyth/methodologylist.txt',
  'polymyth/methodologylist-methodology.txt',
  'polymyth/methodologylist/methodology/index.html',
  'public/polymyth/methodologylist.txt',
  'public/polymyth/methodologylist-methodology.txt',
  'public/polymyth/methodologylist/methodology/index.html',
]) {
  requireText(relative, 'Authorization never radiates between objects.', 'the generated methodology object boundary');
}

for (const relative of [
  'polymyth/methodologylist-coreplus.txt',
  'polymyth/methodologylist/coreplus/index.html',
  'public/polymyth/methodologylist-coreplus.txt',
  'public/polymyth/methodologylist/coreplus/index.html',
]) {
  requireText(relative, 'Hold A and execute only B.', 'the generated CORE+ object boundary');
}

for (const relative of [
  'hf_export/ai_access_pack/MEPHISTODATA_ACTIVATION.md',
  'polymyth/mephistodata-activation.md',
]) {
  requireText(relative, 'Authorization never radiates between objects.', 'the generated activation object boundary');
  requireText(relative, 'Permission to update, fix, harden, implement, or enforce is not semantic settlement.', 'the generated activation semantic-authority gate');
  requireText(relative, 'A verification test enforces settled doctrine and cannot create doctrine.', 'the generated activation test boundary');
}

// Adversarial fixtures. Each case maps to a canonical boundary that must stay
// present. These guard the exact failure families without inventing a second
// implementation of the natural-language classifier inside this verifier.
for (const [caseId, condition, label] of [
  ['NJG-01', String(entry(cl59).b).includes('Outcome language about an object remains deliberation for that object'), 'unsettled object remains read-only'],
  ['NJG-02', String(entry(cl59).b).includes('Hold A and execute only B.'), 'diagnosed object A is held while settled object B executes'],
  ['NJG-03', String(entry(pm11).b).includes('A settled multi-step directive executes fully.'), 'settled steps do not become permission theatre'],
  ['NJG-04', String(entry(pm11).b).includes('Quoting AI wording to question, criticize, compare, or reject it is not adoption.'), 'quoted AI wording remains unratified'],
  ['NJG-05', String(entry(pm11).b).includes('Any changed case lacking explicit user authority blocks mutation.'), 'hardening cannot change passing cases silently'],
  ['NJG-06', String(entry(commitAsk).b).includes('AI confidence establishes neither source status nor authority.'), 'understanding cannot impersonate settlement'],
  ['NJG-07', String(entry(choice).b).includes('A verification test contains a semantic choice'), 'a gate cannot create doctrine'],
  ['NJG-08', String(entry(pm11).b).includes('The geometry policy remains unsettled and unchanged in this correction.'), 'adjacent tentative geometry diagnosis remains untouched'],
]) {
  if (!condition) failures.push(`${caseId} fixture misses ${label}`);
}

if (failures.length) {
  console.error('ML* DIALECTICAL HARDENING VERIFICATION FAILED');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log('ML* DIALECTICAL HARDENING VERIFIED — bootstrap, canonical entries, mirrors, public copies, and activation surfaces agree');
