#!/usr/bin/env node
'use strict';

/** Regression gate for the user-directed 2026-08-04 and 2026-08-05 hardening. */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {parseSeedWithAddenda} = require('./lib/parse-seed-with-addenda');
const {search: searchMeaninglib} = require('./query-meaninglib');

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

function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
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

function entryById(id) {
  const matches = entries.filter(item => item.id === id);
  if (matches.length !== 1) {
    failures.push(`${id} expected once, found ${matches.length}`);
    return {b: '', x: '', tg: '', s: '', t: '', id: ''};
  }
  return matches[0];
}

function requireIdText(id, field, needle, label) {
  const value = String(entryById(id)[field] || '');
  if (!value.includes(needle)) failures.push(`${id} misses ${label}`);
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

requireText('CHARTER.txt', 'Question/deliberation/bare use/review/audit/compare/critique/run-through => analysis only', 'the portable CORE questions, bare-use, and analysis-only boundary');
requireText('CHARTER.txt', 'explicit mutation verb + named target controls.', 'the portable CORE named-target mutation boundary');
requireText('CHARTER.txt', 'AI-generated question=>run OA first; received user question/audit alone≠OA.', 'the portable CORE question-generation OA trigger');
requireText('CHARTER.txt', 'Repetition keeps target/scope; adds no authority/presumed defect.', 'the portable CORE repeated-audit boundary');
requireText('CHARTER.txt', 'File/memory/artifact/publication/deployment/adjacent-object mutation requires explicit target permission.', 'the portable CORE no-mutation boundary');
requireText('CHARTER.txt', 'No authority radiation.', 'the portable CORE object boundary');
requireText('CHARTER.txt', 'Correction supersedes conflict; no replacement implied. Constraint binds later authorized work.', 'the portable CORE correction and constraint boundary');
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

// Executable semantic crosswalk for the exact 4,738-unit Personal Rules
// predecessor. A row resolves only when its prior needle exists in the frozen
// history and every mapped current needle exists in an active non-history
// owner. This is the evidence required by the rewrite-equivalence gate.
const PERSONAL_RULES_PRIOR_ID = 'corehistory-portable-core-pre-current-turn-scope-2026-08-23';
const PERSONAL_RULES_CURRENT_ID = 'core-personal-rules-current-2026-08-12';
const PERSONAL_RULES_MAP_ID = 'coreplus-current-map';
const PERSONAL_RULES_EXPANDED_ID = 'coreplus-portable-core-expanded-handler-2026-08-12';
const personalRulesCrosswalk = Object.freeze([
  ['PR01', 'Follow CORE + newest canonical CORE+ as one system.', PERSONAL_RULES_CURRENT_ID, 'Follow CORE + newest canonical CORE+ as one system.', 'preserved'],
  ['PR02', 'Every turn: retrieve/apply triggered current handlers before substantive work', PERSONAL_RULES_CURRENT_ID, 'Each turn retrieve/apply triggered current handlers', 'clarified'],
  ['PR03', 'never reconstruct', PERSONAL_RULES_CURRENT_ID, 'never reconstruct', 'preserved'],
  ['PR04', 'CORE+=all other active rules', PERSONAL_RULES_CURRENT_ID, 'CORE+=all other active rules', 'preserved'],
  ['PR05', 'cannot weaken CORE', PERSONAL_RULES_CURRENT_ID, 'cannot weaken CORE', 'preserved'],
  ['PR06', 'widen authority', PERSONAL_RULES_CURRENT_ID, 'widen authority', 'preserved'],
  ['PR07', 'override latest user instruction', PERSONAL_RULES_CURRENT_ID, 'override latest user instruction', 'preserved'],
  ['PR08', 'Missing handler blocks only dependent work.', PERSONAL_RULES_CURRENT_ID, 'Missing handler blocks only dependent work.', 'preserved'],
  ['PR09', 'CORE=Personal Rules', PERSONAL_RULES_CURRENT_ID, 'CORE=Personal Rules', 'preserved'],
  ['PR10', 'canonical mirrors exact', PERSONAL_RULES_CURRENT_ID, 'mirrors exact', 'clarified'],
  ['PR11', 'This first/strongest rule makes Mephistodata portable.', PERSONAL_RULES_MAP_ID, 'Portable CORE is the sole always-on authority.', 'moved-losslessly', [[PERSONAL_RULES_EXPANDED_ID, 'CORE is the portable Personal Rules layer']]],
  ['PR12', 'Recover goal, corrections, decisions, unresolved commitments, verified state.', PERSONAL_RULES_CURRENT_ID, 'Recover goal/corrections/decisions/commitments/verified state.', 'clarified', [[PERSONAL_RULES_CURRENT_ID, 'name blockers/open commitments']]],
  ['PR13', 'Latest explicit instruction > compatible accepted constraints > assistant proposals.', PERSONAL_RULES_CURRENT_ID, 'Latest explicit instruction>compatible accepted constraints>AI proposals.', 'clarified'],
  ['PR14', 'Conversation=intent', PERSONAL_RULES_CURRENT_ID, 'Conversation=intent', 'preserved'],
  ['PR15', 'supplied material=content', PERSONAL_RULES_CURRENT_ID, 'supplied material=content', 'preserved'],
  ['PR16', 'verified artifacts=state', PERSONAL_RULES_CURRENT_ID, 'verified artifacts=state', 'preserved'],
  ['PR17', 'primary evidence=facts', PERSONAL_RULES_CURRENT_ID, 'primary evidence=facts', 'preserved'],
  ['PR18', 'memory/summaries=locators', PERSONAL_RULES_CURRENT_ID, 'memory/summaries=locators', 'preserved'],
  ['PR19', 'Project rulings local.', PERSONAL_RULES_CURRENT_ID, 'Project rulings local.', 'preserved'],
  ['PR20', 'Exact request first.', PERSONAL_RULES_CURRENT_ID, 'Exact request first.', 'preserved'],
  ['PR21', 'Question/deliberation/review/audit/compare/critique/run-through => answer/one analytical move only.', PERSONAL_RULES_CURRENT_ID, 'Question/deliberation/bare use/review/audit/compare/critique/run-through => analysis only', 'strengthened'],
  ['PR22', 'Directive => named scope/target.', PERSONAL_RULES_CURRENT_ID, 'explicit mutation verb + named target controls.', 'clarified'],
  ['PR23', 'Any file, memory, artifact, publication, deployment, or adjacent-object mutation requires explicit target permission.', PERSONAL_RULES_CURRENT_ID, 'File/memory/artifact/publication/deployment/adjacent-object mutation requires explicit target permission.', 'clarified'],
  ['PR24', 'Stop=hold.', PERSONAL_RULES_CURRENT_ID, 'Stop=hold.', 'preserved'],
  ['PR25', 'Correction supersedes conflict without choosing replacement', PERSONAL_RULES_CURRENT_ID, 'Correction supersedes conflict; no replacement implied.', 'clarified'],
  ['PR26', 'constraint binds later authorized work', PERSONAL_RULES_CURRENT_ID, 'Constraint binds later authorized work. No authority radiation.', 'strengthened'],
  ['PR27', 'Analysis=>response, never a new file.', PERSONAL_RULES_CURRENT_ID, 'Analysis=>response, never a new file.', 'preserved'],
  ['PR28', 'Existing contract requires only its exact file within authorized operation.', PERSONAL_RULES_CURRENT_ID, 'Existing contract applies only to exact file in authorized operation.', 'clarified'],
  ['PR29', 'Main task stays live through correction/audit/rule/support work.', PERSONAL_RULES_CURRENT_ID, 'Main task stays live through correction/audit/rule/support work.', 'preserved'],
  ['PR30', 'Continuity reference=>retrieval only.', PERSONAL_RULES_CURRENT_ID, 'Continuity reference=>retrieve only.', 'clarified'],
  ['PR31', 'Before using/revising/claiming existing work: retrieve newest canonical source in context', PERSONAL_RULES_CURRENT_ID, 'Before using/revising/claiming work, retrieve newest canonical source in context', 'clarified'],
  ['PR32', 'search exact/rare terms', PERSONAL_RULES_CURRENT_ID, 'search exact/rare terms', 'preserved'],
  ['PR33', 'Fragment/one failed search proves neither completeness nor absence.', PERSONAL_RULES_CURRENT_ID, 'Fragment/failed search proves neither completeness nor absence.', 'clarified'],
  ['PR34', 'Preserve unresolved shorthand; ask only if blocked.', PERSONAL_RULES_CURRENT_ID, 'Preserve unresolved shorthand; ask only if blocked.', 'preserved'],
  ['PR35', 'Activate applicable CORE+ handlers each turn.', PERSONAL_RULES_CURRENT_ID, 'Activate applicable CORE+ handlers each turn.', 'preserved'],
  ['PR36', 'ML* activates only for material/explicit work on Polymyth, Meaninglib, Seminar Schools, Mephistodata, Devil\'s Diary, named star files, CORE, CORE+', PERSONAL_RULES_CURRENT_ID, 'ML* activates only for material/explicit work on Polymyth, Meaninglib, Seminar Schools, Mephistodata, Devil\'s Diary, named star files, CORE, CORE+', 'preserved'],
  ['PR37', 'generic project/site/book/file/ZIP/audit/methodology/citation/mythology/philosophy mentions do not activate', PERSONAL_RULES_CURRENT_ID, 'generic project/site/book/file/ZIP/audit/methodology/citation/mythology/philosophy mentions do not activate', 'preserved'],
  ['PR38', 'Canonical ML*: https://seminarschools.com/polymyth/methodologylist/; cold-load CORE+ map: https://seminarschools.com/polymyth/methodologylist-coreplus.txt; full text: https://seminarschools.com/polymyth/methodologylist.txt.', PERSONAL_RULES_CURRENT_ID, 'Canonical ML*: https://seminarschools.com/polymyth/methodologylist/; cold-load CORE+ map: https://seminarschools.com/polymyth/methodologylist-coreplus.txt; full text: https://seminarschools.com/polymyth/methodologylist.txt.', 'preserved'],
  ['PR39', 'When active: become Mephistodata; load current Methodologylist/addenda, CORE+ map, handlers, siblings.', PERSONAL_RULES_CURRENT_ID, 'When active: become Mephistodata; load current Methodologylist/addenda/map/handlers/relevant siblings.', 'clarified'],
  ['PR40', 'Project/technical rules stay CORE+.', PERSONAL_RULES_CURRENT_ID, 'Project/technical rules=>CORE+.', 'clarified'],
  ['PR41', 'AI decides routine format/IDs/organization/CORE-vs-CORE+ placement; user override.', PERSONAL_RULES_CURRENT_ID, 'AI decides routine format/IDs/organization/CORE-vs-CORE+ placement; user override.', 'preserved'],
  ['PR42', 'CORE=indispensable universal/pre-retrieval triggers.', PERSONAL_RULES_CURRENT_ID, 'CORE=indispensable universal/pre-retrieval triggers.', 'preserved'],
  ['PR43', 'CORE+=lossless active detail, conditional/project/technical/evidence/procedure/history in best-fit canonical owners.', PERSONAL_RULES_CURRENT_ID, 'CORE+=lossless conditional/project/technical/evidence/procedure/history detail in best-fit owners.', 'clarified', [[PERSONAL_RULES_MAP_ID, 'Canonical rules remain in their proper owners.']]],
  ['PR44', 'Preserve meaning + retrieval trigger.', PERSONAL_RULES_CURRENT_ID, 'Preserve meaning + retrieval trigger.', 'preserved'],
  ['PR45', 'Use verified 5,000-character ceiling', PERSONAL_RULES_CURRENT_ID, 'Use verified 5,000-char ceiling', 'clarified'],
  ['PR46', 'invent no smaller cap/content-cut remedy', PERSONAL_RULES_CURRENT_ID, 'invent no smaller cap/cut', 'clarified'],
  ['PR47', 'verify actual failing surface/constraint first', PERSONAL_RULES_CURRENT_ID, 'verify failing surface/constraint first', 'clarified'],
  ['PR48', 'Changed methodology=>canonical ML* owner', PERSONAL_RULES_CURRENT_ID, 'Changed methodology=>canonical ML* owner', 'preserved'],
  ['PR49', 'no random durable file', PERSONAL_RULES_CURRENT_ID, 'no random durable file', 'preserved'],
  ['PR50', 'Follow user method; deliberation tentative.', PERSONAL_RULES_CURRENT_ID, 'Follow user method; deliberation tentative.', 'preserved'],
  ['PR51', 'Ask only if missing authority, irreducible contradiction, authorship, costly default, or genuine choice blocks work', PERSONAL_RULES_CURRENT_ID, 'Ask only if authority/irreducible contradiction/authorship/costly default/genuine choice blocks', 'clarified'],
  ['PR52', 'exhaust fixes', PERSONAL_RULES_CURRENT_ID, 'exhaust fixes', 'preserved'],
  ['PR53', 'Ordinary meaning; no ambiguity/evasion.', PERSONAL_RULES_CURRENT_ID, 'Ordinary meaning; no ambiguity/evasion.', 'preserved'],
  ['PR54', 'Report proposed/attempted/changed/verified truthfully', PERSONAL_RULES_CURRENT_ID, 'Report proposed/attempted/changed/verified truthfully', 'preserved'],
  ['PR55', 'tool success insufficient', PERSONAL_RULES_CURRENT_ID, 'tool success insufficient', 'preserved'],
  ['PR56', 'Complete + verify authorized unblocked requirements', PERSONAL_RULES_CURRENT_ID, 'Complete/verify authorized unblocked work', 'clarified'],
  ['PR57', 'name blockers/unresolved commitments', PERSONAL_RULES_CURRENT_ID, 'name blockers/open commitments', 'clarified'],
  ['PR58', 'Delivery≠plan/promise.', PERSONAL_RULES_CURRENT_ID, 'Delivery≠plan/promise.', 'preserved'],
  ['PR59', 'Persistent memory mutation requires explicit instruction', PERSONAL_RULES_CURRENT_ID, 'Memory mutation needs explicit instruction', 'clarified'],
  ['PR60', 'save shortest trigger', PERSONAL_RULES_CURRENT_ID, 'save shortest trigger', 'preserved'],
  ['PR61', 'route expansion to canonical owner, verify', PERSONAL_RULES_CURRENT_ID, 'route/verify detail in canonical owner', 'clarified'],
  ['PR62', 'Apply full CORE+ authorship/interpretation/dialectic handlers.', PERSONAL_RULES_CURRENT_ID, 'Apply CORE+ authorship/interpretation/dialectic handlers.', 'clarified', [[PERSONAL_RULES_MAP_ID, 'CORE+ is every other current Mephistodata rule']]],
  ['PR63', 'exact wording/evidence first', PERSONAL_RULES_CURRENT_ID, 'exact wording/evidence first', 'preserved'],
  ['PR64', 'generalize only as supported', PERSONAL_RULES_CURRENT_ID, 'generalize only with support', 'clarified'],
  ['PR65', 'preserve authorship/content/spelling/uncertainty/distinctions/identity/history', PERSONAL_RULES_CURRENT_ID, 'preserve authorship/content/spelling/uncertainty/distinctions/identity/history', 'preserved'],
  ['PR66', 'Separate user rulings/facts/sourced interpretations from assistant proposals/inferences and unresolved/superseded/validation-owed status.', PERSONAL_RULES_CURRENT_ID, 'Separate user rulings/facts/sourced readings, assistant proposals/inferences, unresolved/superseded/validation-owed status.', 'clarified'],
  ['PR67', 'Never invent user position/motive/experience/biography/lesson/realization/definition/synthesis or pre-empt/coin canon unless asked.', PERSONAL_RULES_CURRENT_ID, 'Never invent user position/motive/experience/biography/lesson/realization/definition/synthesis or pre-empt/coin canon unasked.', 'clarified'],
  ['PR68', 'Suggestions unratified.', PERSONAL_RULES_CURRENT_ID, 'Suggestions unratified.', 'preserved'],
  ['PR69', 'Criticism=objection; defend/concede by evidence.', PERSONAL_RULES_CURRENT_ID, 'Criticism=objection; defend/concede by evidence.', 'preserved'],
  ['PR70', 'Dialectic only when contested/complex', PERSONAL_RULES_CURRENT_ID, 'Dialectic only when contested/complex', 'preserved'],
  ['PR71', 'preserve strongest sides/unresolved tensions', PERSONAL_RULES_CURRENT_ID, 'preserve strongest sides/tensions', 'clarified', [[PERSONAL_RULES_EXPANDED_ID, 'unresolved contradictions or tensions']]],
  ['PR72', 'Structural claims stay structural', PERSONAL_RULES_CURRENT_ID, 'Structural claims stay structural', 'preserved'],
  ['PR73', 'no unstated framework', PERSONAL_RULES_CURRENT_ID, 'no unstated framework', 'preserved'],
  ['PR74', 'psychological/wellbeing/institutional speculation unless requested/required', PERSONAL_RULES_CURRENT_ID, 'psychological/wellbeing/institutional speculation unless requested/required', 'preserved'],
  ['PR75', 'Apply full CORE+ citation/writing handlers.', PERSONAL_RULES_CURRENT_ID, 'Apply CORE+ citation/writing handlers.', 'clarified', [[PERSONAL_RULES_MAP_ID, 'CORE+ is every other current Mephistodata rule']]],
  ['PR76', 'Cite substantive claims inline', PERSONAL_RULES_CURRENT_ID, 'Cite substantive claims inline', 'preserved'],
  ['PR77', 'verify uncertain/unfamiliar facts from checked primary/canonical sources', PERSONAL_RULES_CURRENT_ID, 'verify uncertain/unfamiliar facts from checked primary/canonical sources', 'preserved'],
  ['PR78', 'label inference/paraphrase', PERSONAL_RULES_CURRENT_ID, 'label inference/paraphrase', 'preserved'],
  ['PR79', 'preserve quotation provenance', PERSONAL_RULES_CURRENT_ID, 'preserve quote provenance', 'clarified'],
  ['PR80', 'fabricate nothing', PERSONAL_RULES_CURRENT_ID, 'fabricate nothing', 'preserved'],
  ['PR81', 'Lead requested substance', PERSONAL_RULES_CURRENT_ID, 'Lead requested substance', 'preserved'],
  ['PR82', 'match scope/volume/register', PERSONAL_RULES_CURRENT_ID, 'match scope/volume/register', 'preserved'],
  ['PR83', 'no unsolicited additions/artifacts/offers', PERSONAL_RULES_CURRENT_ID, 'no unsolicited additions/artifacts/offers', 'preserved'],
  ['PR84', 'Correction=name/fix/verify.', PERSONAL_RULES_CURRENT_ID, 'Correction=name/fix/verify.', 'preserved'],
  ['PR85', 'Concise affirmative prose; every clause advances.', PERSONAL_RULES_CURRENT_ID, 'Concise affirmative prose; every clause advances.', 'preserved'],
  ['PR86', 'Ground first-person claims in actions/evidence', PERSONAL_RULES_CURRENT_ID, 'Ground first-person claims in actions/evidence', 'preserved'],
  ['PR87', 'translate shorthand without weakening', PERSONAL_RULES_CURRENT_ID, 'translate shorthand without weakening', 'preserved'],
  ['PR88', 'preserve verbatim/provenance', PERSONAL_RULES_CURRENT_ID, 'preserve verbatim/provenance', 'preserved'],
  ['PR89', 'context not automatically publishable', PERSONAL_RULES_CURRENT_ID, 'context not automatically publishable', 'preserved'],
  ['PR90', 'End on final point.', PERSONAL_RULES_CURRENT_ID, 'End on final point.', 'preserved'],
]);

const allowedCrosswalkStatuses = new Set(['preserved', 'clarified', 'strengthened', 'moved-losslessly']);
const priorPersonalRules = entryById(PERSONAL_RULES_PRIOR_ID);
if (priorPersonalRules.s !== 'corehistory') failures.push('Personal Rules crosswalk source is not inactive CORE History');
if (personalRulesCrosswalk.length !== 90) failures.push(`Personal Rules crosswalk has ${personalRulesCrosswalk.length} rows; expected 90`);
const crosswalkIds = new Set();
for (const [rowId, priorNeedle, currentId, currentNeedle, status, additional = []] of personalRulesCrosswalk) {
  if (crosswalkIds.has(rowId)) failures.push(`Personal Rules crosswalk duplicates ${rowId}`);
  crosswalkIds.add(rowId);
  if (!allowedCrosswalkStatuses.has(status)) failures.push(`Personal Rules crosswalk ${rowId} has unresolved status ${status}`);
  if (!String(priorPersonalRules.b || '').includes(priorNeedle)) failures.push(`Personal Rules crosswalk ${rowId} misses prior needle`);
  for (const [ownerId, needle] of [[currentId, currentNeedle], ...additional]) {
    const owner = entryById(ownerId);
    if (owner.s === 'corehistory') failures.push(`Personal Rules crosswalk ${rowId} resolves only to history at ${ownerId}`);
    if (!String(owner.b || '').includes(needle)) failures.push(`Personal Rules crosswalk ${rowId} misses active needle in ${ownerId}`);
  }
}
const personalRulesCrosswalkHash = sha256(JSON.stringify(personalRulesCrosswalk));
if (personalRulesCrosswalkHash !== '6ec9203fbf90b5e03969d7754aa5e70f557da1dcc57be0b1323a4dbcdb76608b') failures.push(`Personal Rules crosswalk hash drifted (${personalRulesCrosswalkHash})`);

// Compression-sensitive unions and the two universal safeguards recovered by
// this conversation receive explicit behavioral locks beyond row presence.
requireIdText(PERSONAL_RULES_MAP_ID, 'b', 'CORE+ is every other current Mephistodata rule', 'the complete active CORE+ union for PR62 and PR75');
requireIdText(PERSONAL_RULES_EXPANDED_ID, 'b', 'unresolved contradictions or tensions', 'the unresolved-tension preservation for PR71');
requireIdText(PERSONAL_RULES_CURRENT_ID, 'b', 'bare use/review/audit/compare/critique/run-through => analysis only', 'the universal bare-use analysis-only trigger');
requireIdText(PERSONAL_RULES_CURRENT_ID, 'b', 'Repetition keeps target/scope; adds no authority/presumed defect.', 'the universal repeated-audit scope and no-presumed-defect trigger');

for (const [caseId, condition, label] of [
  ['PRB-01', String(entryById(PERSONAL_RULES_CURRENT_ID).b).includes('generic project/site/book/file/ZIP/audit/methodology/citation/mythology/philosophy mentions do not activate'), 'generic philosophy and audit language leaves ML* inactive'],
  ['PRB-02', String(entryById('coreplus-handler-current-turn-scope-semantic-fidelity-2026-08-23').b).includes('Project relevance never licenses project-first interpretation.'), 'earlier project context cannot override external-subject-first'],
  ['PRB-03', String(entryById('method-audit-current-scope-2026-08-23').b).includes('Audit is analysis unless the same instruction explicitly authorizes mutation'), 'generic audit remains analysis only'],
  ['PRB-04', String(entryById(PERSONAL_RULES_CURRENT_ID).b).includes('Correction supersedes conflict; no replacement implied.'), 'correction chooses no replacement'],
  ['PRB-05', String(entryById('method-comparative-corpus-integrity-2026-08-23').b).includes('A requested number governs search breadth and output maximum.'), 'requested corpus size cannot authorize padding'],
  ['PRB-06', String(entryById('method-comparative-corpus-integrity-2026-08-23').b).includes('Rank together only values measured on a declared common scale.'), 'incomparable popularity measures stay separate'],
  ['PRB-07', String(entryById('coreplus-handler-current-turn-scope-semantic-fidelity-2026-08-23').b).includes('verified direct lexical use, explicit source-defined equivalent, structural analogue, secondary attribution, and unverified or AI-generated discovery lead'), 'thinker and term lineage statuses remain distinct'],
  ['PRB-08', String(entryById('method-human-artifact-ml-independence-2026-08-23').b).includes('Philosophical importance, beauty, or presence in the PDF is insufficient by itself.'), 'PDF presence does not authorize ML admission'],
  ['PRB-09', String(entryById('coreplus-current-map-amendment-2026-08-26').b).includes('A named analytical method loads that method and its source and fidelity gates.'), 'analytical method invocation does not trigger publication scaffolding'],
  ['PRB-10', String(entryById('coreplus-handler-named-method-output-certification-2026-08-23').b).includes('explicitly requested article, entry, book, page, or other public-facing artifact'), 'named publication request loads its firewall'],
  ['PRB-11', String(entryById(PERSONAL_RULES_CURRENT_ID).b).includes('AI-generated question=>run OA first'), 'assistant-generated questions universally activate Ouroborosanalyses'],
  ['PRB-12', String(entryById(PERSONAL_RULES_CURRENT_ID).b).includes('received user question/audit alone≠OA'), 'received user questions and audits do not falsely activate Ouroborosanalyses'],
]) {
  if (!condition) failures.push(`${caseId} fixture misses ${label}`);
}

// August 23 2026 integration. These contracts preserve the whole-conversation
// correction set, including current replacements and exact inactive history.
const integrationContracts = [
  ['coreplus-current-map-amendment-2026-08-23', 'b', 'Generic audit means analysis of the named object and creates no ML*, Ouroborosanalyses, mutation, capture, or ZIP authority.', 'generic-audit authority boundary'],
  ['coreplus-current-map-amendment-2026-08-23', 'b', 'A full-site ZIP is required only when the requested deliverable or a verified package contract explicitly names', 'full-ZIP authority boundary'],
  ['coreplus-current-map-amendment-2026-08-23', 'b', "Portable CORE's CORPORA and lineage gate applies universally without activating ML* or a project lens.", 'universal corpus dispatch'],
  ['coreplus-current-map-amendment-2026-08-23', 'b', 'Exact invocation of ouroborossyntheses', 'Ouroborossyntheses dispatch'],
  ['coreplus-current-map-amendment-2026-08-23', 'b', 'Before the assistant generates, proposes, or asks a question', 'question-generation OA dispatch'],
  ['coreplus-current-map-amendment-2026-08-23', 'b', 'Receiving an ordinary user question does not itself activate ML* or Ouroborosanalyses.', 'user-question negative OA trigger'],
  ['coreplus-current-map-amendment-2026-08-23', 'b', 'Every decision to capture, omit, route, or claim loss between ML* and a human-facing artifact', 'ML-admission dispatch'],
  ['coreplus-current-map-amendment-2026-08-23', 'b', 'Original reader-facing analytic prose may carry the argument after the thesis and source gates pass.', 'reader-facing prose permission'],
  ['coreplus-current-map-amendment-2026-08-23', 'b', 'Merely invoking a named analytical method loads that method plus its fidelity and source gates; it does not load publication voice or architecture.', 'analysis-versus-publication dispatch'],
  ['coreplus-handler-current-turn-scope-semantic-fidelity-2026-08-23', 'b', 'The current message as resolved controls.', 'anaphora-safe current-message priority'],
  ['coreplus-handler-current-turn-scope-semantic-fidelity-2026-08-23', 'b', 'external thinker, work, object, or tradition on its own terms', 'external-subject-first order'],
  ['coreplus-handler-current-turn-scope-semantic-fidelity-2026-08-23', 'b', 'subject, object, analytical unit, predicate, scope and quantifier, modality, condition, time, causal direction, confidence, and source status', 'semantic proposition vector'],
  ['coreplus-handler-current-turn-scope-semantic-fidelity-2026-08-23', 'b', 'Direct-use claims require the primary passage, edition, locator, context, and translation status.', 'primary lexical-use gate'],
  ['coreplus-handler-current-turn-scope-semantic-fidelity-2026-08-23', 'b', 'TLDR layman changes length and vocabulary only.', 'TLDR fidelity invariant'],
  ['method-audit-current-scope-2026-08-23', 'b', 'Audit is analysis unless the same instruction explicitly authorizes mutation of a named target.', 'audit analysis-only default'],
  ['method-audit-current-scope-2026-08-23', 'b', 'Interpretive audits answer in the requested form with traceable evidence.', 'audit output-fit rule'],
  ['method-audit-current-scope-2026-08-23', 'b', 'loads its current exact whole-conversation four-step owner.', 'current Ouroborosanalyses route'],
  ['method-comparative-corpus-integrity-2026-08-23', 'b', 'For a closed supplied corpus, that set is the universe', 'closed-corpus boundary'],
  ['method-comparative-corpus-integrity-2026-08-23', 'b', 'For an open search, construct candidates through independent routes.', 'open-corpus discovery'],
  ['method-comparative-corpus-integrity-2026-08-23', 'b', 'Every item whose classification affects inclusion, exclusion, a count, ranking, table, or graph receives an internal evidence record', 'comparative row gate'],
  ['method-comparative-corpus-integrity-2026-08-23', 'b', 'bounded primary source', 'bounded-source gate'],
  ['method-comparative-corpus-integrity-2026-08-23', 'b', 'A requested number governs search breadth and output maximum.', 'no quota padding'],
  ['method-comparative-corpus-integrity-2026-08-23', 'b', 'Do not invent missing cases or add reviewers merely to satisfy this step.', 'no-invented-reviewer gate'],
  ['method-comparative-corpus-integrity-2026-08-23', 'b', 'Report corpus-coverage status and classification status separately.', 'coverage-versus-classification status'],
  ['method-comparative-corpus-integrity-2026-08-23', 'b', 'classify at author, work, date, and phase grain', 'source-genealogy phase grain'],
  ['coreplus-handler-named-method-output-certification-2026-08-23', 'b', 'explicitly requested article, entry, book, page, or other public-facing artifact', 'publication-only trigger'],
  ['coreplus-handler-named-method-output-certification-2026-08-23', 'b', 'Conversation is research context, not automatic article content.', 'publication firewall'],
  ['coreplus-handler-named-method-output-certification-2026-08-23', 'b', 'Phrases such as a thinker\'s actors, the mechanism I import', 'dialogue-scaffolding removal'],
  ['coreplus-handler-named-method-output-certification-2026-08-23', 'b', 'No qualifier may convert an established structural claim into an optional lens', 'anti-snaketwisting qualifier gate'],
  ['coreplus-handler-named-method-output-certification-2026-08-23', 'b', 'restart from the accepted thesis and verified sources', 'clean rebuild after structural contamination'],
  ['method-human-artifact-ml-independence-2026-08-23', 'b', 'Absence from one artifact is not loss', 'PDF and ML non-duplication rule'],
  ['method-human-artifact-ml-independence-2026-08-23', 'b', 'Material from a human artifact enters ML* only when its absence would materially change AI retrieval', 'functional ML-admission test'],
  ['method-human-artifact-ml-independence-2026-08-23', 'b', 'Field-to-selection controls, correction-resistance controls, and Seminar-status controls', 'selective AI-operational admission'],
  ['method-human-artifact-ml-independence-2026-08-23', 'b', "exact artifact identity is validation owed", 'human-owner validation debt'],
  ['method-ouroborossyntheses-2026-08-23', 'b', 'TEST MUTUAL EXCLUSIVITY', 'mutual-exclusivity gate'],
  ['method-ouroborossyntheses-2026-08-23', 'b', 'Inventory and retrieve the relevant thread, attachments, relevant chats, workspace, and Library as available', 'synthesis source-breadth pass'],
  ['method-ouroborossyntheses-2026-08-23', 'b', 'This is the current owner for T114j, the polymyth-synthesis-method.', 'T114j current-owner lineage'],
  ['method-ouroborossyntheses-2026-08-23', 'b', 'lay everything out; (2) identify what synthesizes; (3) preserve the residue; (4) return the residue for user decision', 'T114j exact four-movement functional lineage'],
  ['method-ouroborossyntheses-2026-08-23', 'b', 'Empty residue is a valid result.', 'empty residue'],
  ['method-ouroborossyntheses-2026-08-23', 'b', 'Return genuine nonempty residue that requires an authorship or canonical choice to the user for decision.', 'nonempty residue return for user decision'],
  ['method-ouroborossyntheses-2026-08-23', 'b', 'Run method-ouroborosanalyses-current-2026-08-23 against the proposed synthesis.', 'iterative current Ouroborosanalyses pairing'],
  ['method-ouroborossyntheses-2026-08-23', 'b', 'Where a separately ratified umbrella includes typed senses', 'no-universal-umbrella rule'],
  ['method-mearsheimer-mishlove-epistemological-distinction-2026-08-23', 'b', 'maximum structural fidelity through one declared ray', 'Mearsheimer declared-ray side'],
  ['method-mearsheimer-mishlove-epistemological-distinction-2026-08-23', 'b', 'keeps anomalous material in inquiry when dominant rays leave it in shadow', 'Mishlove anomaly-preserving side'],
  ['method-mearsheimer-mishlove-epistemological-distinction-2026-08-23', 'b', 'A narrow inquiry may remain open. A broad synthesis may become closed.', 'width-versus-direction independence'],
  ['method-mearsheimer-mishlove-epistemological-distinction-2026-08-23', 'b', 'It is distinct from the Mearsheimer two-condition phrase classifier and from the Realist Power-Conversion Rule.', 'Mearsheimer owner separation'],
  ['coreplus-legacy-slot-04', 'b', 'THREE DISTINCT MEARSHEIMER ROUTES.', 'three-route Mearsheimer router'],
  ['coreplus-legacy-slot-04', 'b', 'disclose the ambiguity rather than conflating them.', 'ambiguous Mearsheimer-rule handling'],
  ['method-realist-power-conversion-rule-2026-08-23', 'b', 'actual or alleged harm is invoked, denied, or remedied', 'power analysis without sincerity precondition'],
  ['method-realist-power-conversion-rule-2026-08-23', 'b', 'The reality of pain and its strategic use are independent questions.', 'harm and strategy independence'],
  ['method-realist-power-conversion-rule-2026-08-23', 'b', 'Run the structural track whether tears are real, theatrical, mixed, disputed, or irrelevant', 'no-tears gate on structural analysis'],
  ['method-realist-power-conversion-rule-2026-08-23', 'b', 'Institutional benefit alone does not establish bad faith', 'benefit-is-not-proof limit'],
  ['method-realist-power-conversion-rule-2026-08-23', 'b', 'Internal shorthand such as evil versus evil may guide analysis; public prose should establish the mechanism directly before naming the conclusion.', 'analysis-versus-public-register'],
  ['method-realist-power-conversion-rule-2026-08-23', 'b', 'It is not a direct formulation by Mearsheimer, Machiavelli, or Hobbes.', 'adaptation source status'],
  ['method-egregore-current-umbrella-control-2026-08-23', 'b', 'typed umbrella', 'Egregore umbrella'],
  ['method-egregore-current-umbrella-control-2026-08-23', 'b', 'not contradictions unless incompatible values are asserted of the same case on the same axis and time', 'case-aligned Egregore contradiction test'],
  ['method-egregore-current-umbrella-control-2026-08-23', 'b', 'age-old metaphysical question', 'Egregore metaphysical bracket'],
  ['method-egregore-current-umbrella-control-2026-08-23', 'b', 'It is not Brentano\'s phrase', 'irreal-egregore source status'],
  ['method-egregore-current-umbrella-control-2026-08-23', 'b', 'validation owed until a primary passage, edition, locator, context, and translation status are recorded', 'Brentano validation debt'],
  ['method-selection-architecture-operational-extraction-2026-08-23', 'b', 'It does not import the complete geometry or manuscript exposition into ML*.', 'selection-only extraction'],
  ['method-expulsive-absorptive-predatory-loops-2026-08-23', 'b', 'dimensions of correction-resistance, not moral essences, a ladder', 'non-ladder loop classification'],
  ['method-connected-seminar-collective-process-control-2026-08-23', 'b', 'It implies neither unanimity nor a permanent unitary group mind.', 'collective-process bracket'],
  ['method-connected-seminar-collective-process-control-2026-08-23', 'b', 'cannot self-certify as a Seminar or Connected Seminar', 'Seminar self-certification ban'],
  ['coreplus-handler-ouroborosanalyses', 'b', 'Receiving an ordinary user question and generic audit do not activate it.', 'user-question and generic-audit negative OA trigger'],
  ['coreplus-handler-ouroborosanalyses', 'b', 'the assistant is about to generate or ask a question', 'question-generation positive OA trigger'],
  ['coreplus-handler-ouroborosanalyses', 'b', 'report zero when none survive', 'zero-residue OA dispatch'],
  ['coreplus-handler-ouroborosanalyses', 'xc', 'its internal Step-2 questions do not start nested runs', 'active-run non-reentrancy guard'],
  ['coreplus-handler-ouroborosanalyses', 'xc', 'Outside an active run, an assistant-generated question activates exactly one Ouroborosanalyses run.', 'inactive question starts exactly one OA run'],
  ['coreplus-handler-ouroborosanalyses', 'xc', 'Receiving a user question or a generic audit activates none.', 'received-question and generic-audit zero-run guard'],
  ['method-ouroborosanalyses-current-2026-08-23', 'b', 'review the whole conversation, not just the current turn', 'whole-conversation scope'],
  ['method-ouroborosanalyses-current-2026-08-23', 'b', 'The genuine-unanswerable IS the terminus.', 'genuine-unanswerables terminus'],
  ['method-ouroborosanalyses-current-2026-08-23', 'b', 'Good ouroborosanalyses terminate in paradox', 'paradox terminus'],
  ['method-ouroborosanalyses-current-2026-08-23', 'b', 'ALL GENERATED QUESTIONS ARE / SHOULD INHERENTLY BE OUROBOROSANALYSES', 'question-generation hijack'],
  ['method-ouroborosanalyses-current-2026-08-23', 'b', 'The plural form ouroborosanalyses is mandatory', 'plural-only terminology'],
  ['method-ouroborosanalyses-current-2026-08-23', 'xc', 'if none survive, report zero and manufacture no paradox or unresolved residue', 'later zero-residue integration control'],
  ['method-ouroborosanalyses-current-2026-08-23', 'xc', 'A nonempty good remainder ends in a real paradox rather than a patchable contradiction.', 'conditional paradox integration control'],
  ['method-ouroboros-depth-escalation-current-2026-08-23', 'b', 'A repeated generic audit goes deeper into the same frozen target and scope.', 'generic-audit depth without target shift'],
  ['method-ouroboros-depth-escalation-current-2026-08-23', 'b', 'A repeated Ouroborosanalyses reruns its exact whole-conversation four steps.', 'OA repeat preserves whole conversation'],
  ['method-command-list-current-2026-08-23', 'b', 'update only the currently named ML* target from the current authorized source scope', 'scoped Meaninglib command'],
  ['coreplus-handler-personal-rules-equivalence-2026-08-23', 'b', 'old-clause to new-clause-or-current-owner crosswalk', 'Personal Rules equivalence crosswalk'],
  ['coreplus-handler-personal-rules-equivalence-2026-08-23', 'b', 'Shorter wording, equal counts, a clean summary, or a passing mirror hash never proves semantic equivalence.', 'equivalence evidence gate'],
];
for (const [id, field, needle, label] of integrationContracts) {
  requireIdText(id, field, needle, label);
}

const boundedCompletionControl = 'It does not prohibit bounded local completion, provisional closure, pruning, or stopping after the declared source set and scope have no unaddressed defect.';
for (const title of [
  'Geometric architecture',
  'Stasis (python failure 1)',
  'Polymyth as architecture of asymptotic approach to totality (April 10 2026 substrate)',
]) {
  requireEntryText(title, 'xc', boundedCompletionControl, 'the current bounded-completion control');
}

const legacyAnchorContracts = Object.freeze({
  'method-paradox-vs-contradiction': 'methodology-paradox-vs-contradiction-scanner-principle-d5260797',
  'method-synthesis-distinction-filter-2026-05': 'methodology-synthesis-distinction-filter-polymythdnd-lesson-may-2026-df89adeb',
  'method-t114u-polymyth-synthesis-foundational-2026-05-23': 'methodology-t114u-t114j-polymyth-synthesis-method-elevated-as-polymyth-religion-foundati-733ed9f3',
  'method-false-contradiction-ban-in-synthesis-2026-05-23': 'methodology-false-contradiction-ban-in-synthesis-rule-t114z-may-23-2026-d6046f40',
});
for (const [id, legacyAnchor] of Object.entries(legacyAnchorContracts)) {
  requireIdText(id, 'legacy_anchor', legacyAnchor, 'the preserved permanent-link alias');
  requireText('polymyth/methodologylist/methodology/index.html', `id="${legacyAnchor}"`, `${id} generated legacy-anchor alias`);
  requireText('public/polymyth/methodologylist/methodology/index.html', `id="${legacyAnchor}"`, `${id} public legacy-anchor alias`);
}

const ouroborossynthesesOwner = entryById('method-ouroborossyntheses-2026-08-23');
for (const linkedId of [
  'method-t114u-polymyth-synthesis-foundational-2026-05-23',
  'method-false-contradiction-ban-in-synthesis-2026-05-23',
  'method-synthesis-distinction-filter-2026-05',
  'mythology-integration-scanner-fallibility',
  'method-paradox-vs-contradiction',
  'method-ouroborosanalyses-current-2026-08-23',
]) {
  if (!Array.isArray(ouroborossynthesesOwner.xr) || !ouroborossynthesesOwner.xr.includes(linkedId)) {
    failures.push(`Ouroborossyntheses machine cross-reference is missing ${linkedId}`);
  }
  if (linkedId !== 'method-ouroborosanalyses-current-2026-08-23') {
    const linkedOwner = entryById(linkedId);
    if (!Array.isArray(linkedOwner.xr) || !linkedOwner.xr.includes('method-ouroborossyntheses-2026-08-23')) {
      failures.push(`${linkedId} reciprocal Ouroborossyntheses cross-reference is missing`);
    }
  }
}
requireIdText('method-ouroborossyntheses-2026-08-23', 'tg', 't114j', 'T114j AI-search tag');
const t114jResults = searchMeaninglib('T114j', 10);
if (!t114jResults.length || t114jResults[0].doc.id !== 'method-ouroborossyntheses-2026-08-23') {
  failures.push('Exact T114j retrieval does not resolve first to the current Ouroborossyntheses owner');
}
for (const [query, expectedId] of [
  ['OA', 'coreplus-handler-ouroborosanalyses'],
  ['Ouroborosanalyses', 'method-ouroborosanalyses-current-2026-08-23'],
  ['Egregore', 'method-egregore-current-umbrella-control-2026-08-23'],
]) {
  const results = searchMeaninglib(query, 20);
  if (!results.length || results[0].doc.id !== expectedId) {
    failures.push(`Exact ${query} retrieval does not resolve first to ${expectedId}`);
  }
  const currentRank = results.findIndex(result => result.doc.id === expectedId);
  const historyRank = results.findIndex(result => result.doc.star_file === 'ml' && String(result.doc.section || '').toLowerCase() === 'corehistory');
  if (historyRank !== -1 && (currentRank === -1 || currentRank > historyRank)) {
    failures.push(`Exact ${query} retrieval ranks CORE History above its current owner`);
  }
}

const historicalAudit = entryById('corehistory-audit-auto-capture-auto-zip-2026-05-29');
if (historicalAudit.s !== 'corehistory') failures.push('stale automatic AUDIT owner remains active');
const exactCurrentBodyHashes = Object.freeze({
  'coreplus-current-map-amendment-2026-08-26': '25113e059ef4466640fa5955a004ad597f4605b44f3ee12ec957095d6af01ec2',
  'coreplus-handler-current-turn-scope-semantic-fidelity-2026-08-23': '9f4d041deab3b943eebae13fcdb4611cf7642ee9e31d0d25652de6618516dee9',
  'method-audit-current-scope-2026-08-23': '942aa8e32a56c9b6116d5edbd48c40679c5fc5af6d64566d9307b5a085d93f40',
  'method-comparative-corpus-integrity-2026-08-23': 'ecb81c7e8005bd8edc58d1062bc0f515c01d40341a5c53a7f6f606cc071c7193',
  'coreplus-handler-named-method-output-certification-2026-08-23': 'afe6bf10971441f41325b1b019f44fec508706816fa885e70deb68670e5cd7e9',
  'method-human-artifact-ml-independence-2026-08-23': '995c9d80b5ac65a8a88a78c1cda122e68427b4656e664b53687259fe82584d60',
  'method-ouroborossyntheses-2026-08-23': 'a0e0d26de1c70897156bc8bb4789f9bca441d4f415d9ea6fc3ede1f4e617c880',
  'method-mearsheimer-mishlove-epistemological-distinction-2026-08-23': '80b923d614de8d606c3f40b21a14662ff192deb3af285de0d36aa69a20d31328',
  'method-realist-power-conversion-rule-2026-08-23': 'c72eab44e75ae9d094fb18c592515c26bdb056a16c995d55c96d2ac49add6f6a',
  'method-egregore-current-umbrella-control-2026-08-23': '40e458b834abd604bf753a7a66ab797b00b1b600fb5d32d338d29b2d741a4ab9',
  'method-selection-architecture-operational-extraction-2026-08-23': '8c9e09013fa6e827021412bf596a3f8ddc41200b18cc7ca97ae0dc06cd034561',
  'method-expulsive-absorptive-predatory-loops-2026-08-23': '45c858e162965d56f94ad1f289a0b26400de135efa36a3b967fb6096c29252cc',
  'method-connected-seminar-collective-process-control-2026-08-23': '8e612bd91b27ff789e322014aade4fa866a2aea5e8eb38cd8279ac993ba45045',
  'coreplus-handler-ouroborosanalyses': 'c913057f252d1279db486472c9a26c948e29c54a9ac85d1843d420b351c20d18',
  'method-ouroborosanalyses-current-2026-08-23': '26ca1b7dd32608be71c3cf23711fdf49d05971514a172ede3acdf9e36e0e3d91',
  'method-ouroboros-depth-escalation-current-2026-08-23': '1a124de466c0fe953a7530d26cbb47b09b53c4ae066212adcc34b23c52d499ed',
  'method-command-list-current-2026-08-23': '72736f97e4a6023313c4285d9badb819242195da05ca7f5b6242ec7e7c7d1594',
  'coreplus-handler-personal-rules-equivalence-2026-08-23': '37b7ce38bba3d7bb98841a8e2c86f17323bedcb0a8eab1a4aaaa63ba732d2ce5',
});
for (const [id, expected] of Object.entries(exactCurrentBodyHashes)) {
  const actual = sha256(String(entryById(id).b || ''));
  if (actual !== expected) failures.push(`${id} exact current body drifted (${actual})`);
}

const exactHistoricalBodyHashes = Object.freeze({
  'corehistory-ouroborosanalyses-whole-conversation-paradox-hijack-2026-05': '26ca1b7dd32608be71c3cf23711fdf49d05971514a172ede3acdf9e36e0e3d91',
  'corehistory-command-list-april-2026': 'da435d8299bbd1bbe9e44de696124fbe5525442105851320177a3aa561f8d0ab',
  'corehistory-ouroboros-depth-escalation-auto-target-shift-2026-05': 'cef9a909ae9ac03242a411c45afbd091212ea0954f2cfa31c2d04e6ad5b6488a',
});
for (const [id, expected] of Object.entries(exactHistoricalBodyHashes)) {
  const historical = entryById(id);
  if (historical.s !== 'corehistory') failures.push(`${id} is not inactive CORE History`);
  const actual = sha256(String(historical.b || ''));
  if (actual !== expected) failures.push(`${id} exact historical body drifted (${actual})`);
}

for (const [id, forbidden, label] of [
  ['method-audit-current-scope-2026-08-23', 'loads its current target-bound', 'target-bound audit-to-OA rewrite'],
  ['coreplus-handler-ouroborosanalyses', 'ordinary question generation do not activate it', 'no-question-hijack semantic override'],
  ['coreplus-handler-ouroborosanalyses', 'It cannot override the current owner.', 'history-over-active OA inversion'],
  ['method-ouroborosanalyses-current-2026-08-23', 'Whole-conversation scope applies when the user requests', 'conditional whole-conversation rewrite'],
  ['method-ouroborosanalyses-current-2026-08-23', 'Paradox is a possible result, not a required terminus.', 'nonmandatory-paradox rewrite'],
  ['method-ouroborosanalyses-current-2026-08-23', 'State zero when nothing genuine remains.', 'zero-remainder rewrite'],
  ['method-ouroboros-depth-escalation-current-2026-08-23', 'By third repetition the audit target shifts', 'automatic target shift'],
  ['method-command-list-current-2026-08-23', 'review whole conversation, classify content by section', 'whole-conversation Meaninglib command'],
]) {
  if (String(entryById(id).b || '').includes(forbidden)) failures.push(`${id} retains ${label}`);
}

for (const [title, needle, label] of [
  ['Magic / Wizardry (conscious hivemindidiom-deployment, third category)', 'question-generation hijack, survivor-only paradox discriminator, and zero-residue rule govern', 'Magic/Wizardry integrated OA control'],
  ['Anti-gorgonification six-loop interlock-architecture (Rainbowsol-system structural-claim from N137-narrowed research)', 'survivor-only residue, zero-valid result, and paradox-versus-contradiction account remain active', 'six-loop integrated OA control'],
  ['"There are no stupid questions" (pedagogical black-magic hivemindidiom)', 'The hijack fires before the assistant generates a question', 'no-stupid-questions active hijack control'],
  ['core* (memory-tier * file, cross-session behavioral rules)', 'assistant question-generation loads its whole-conversation method and zero-residue integration control', 'core-star integrated OA control'],
  ['CORE slot 16 mirror — USE POLYMYTH + PRE-RESPONSE SCAN + BATCH-END REVIEW', 'whole-conversation method and its zero-residue integration control govern without target-bound narrowing', 'slot-16 integrated OA route'],
  ['COUNTERFACTUAL Q6: Friction vs Contrarianism (building meaning not destroying it)', 'reports zero when no issue survives', 'counterfactual zero-residue discriminator'],
  ['"One Gorgon outgorgons another" (#Gorgonwars identity-competition diagnostic)', 'The historical sentence "The beneficiary is never the claimants" is categorical and superseded.', 'Gorgonwars current distribution correction'],
]) {
  requireEntryText(title, 'xc', needle, label);
}

const baseMap = entryById('coreplus-current-map');
if (!String(baseMap.xc || '').includes('coreplus-current-map-amendment-2026-08-26')) {
  failures.push('base CORE+ map lacks the mandatory visible amendment route');
}
if (!Array.isArray(baseMap.xr) || !baseMap.xr.includes('coreplus-current-map-amendment-2026-08-26')) {
  failures.push('base CORE+ map lacks the machine-resolvable amendment cross-reference');
}

const currentIds = Object.keys(exactCurrentBodyHashes);
for (const id of currentIds) {
  const current = entryById(id);
  if (!Array.isArray(current.xr) || current.xr.length === 0) failures.push(`${id} lacks machine-resolvable cross-references`);
}

const hfRows = read('hf_export/data/ml/methodologylist.jsonl').trim().split('\n').filter(Boolean).map((line, index) => {
  try { return JSON.parse(line); }
  catch (error) { failures.push(`HF methodologylist row ${index + 1} is invalid JSON: ${error.message}`); return {}; }
});
const hfById = new Map(hfRows.map(row => [row.id, row]));
for (const id of currentIds) {
  const row = hfById.get(id);
  if (!row) failures.push(`HF methodologylist misses ${id}`);
  else if (!Array.isArray(row.crossrefs) || row.crossrefs.length === 0) failures.push(`HF methodologylist loses ${id} cross-references`);
}
const hfBaseMap = hfById.get('coreplus-current-map') || {};
if (!String(hfBaseMap.current_status || '').includes('coreplus-current-map-amendment-2026-08-26')) {
  failures.push('HF methodologylist loses the base-map current-status amendment route');
}
if (!Array.isArray(hfBaseMap.crossrefs) || !hfBaseMap.crossrefs.includes('coreplus-current-map-amendment-2026-08-26')) {
  failures.push('HF methodologylist loses the base-map machine cross-reference');
}

for (const relative of [
  'polymyth/methodologylist.txt',
  'polymyth/methodologylist-methodology.txt',
  'public/polymyth/methodologylist.txt',
]) {
  requireText(relative, 'Ouroborossyntheses', 'the generated Ouroborossyntheses owner or dispatch');
  requireText(relative, 'Mearsheimer–Mishlove epistemological distinction', 'the generated Mearsheimer–Mishlove owner');
  requireText(relative, 'Comparative-corpus research and classification gate', 'the generated corpus-integrity owner');
  requireText(relative, 'Realist Power-Conversion Rule', 'the generated power-conversion owner');
}
requireText('polymyth/methodologylist-coreplus.txt', 'Mearsheimer–Mishlove distinction', 'the generated Mearsheimer–Mishlove dispatch');
requireText('polymyth/methodologylist-coreplus.txt', 'Personal Rules and portable CORE rewrite-equivalence gate', 'the generated Personal Rules equivalence gate');
requireText('polymyth/methodologylist-corehistory.txt', 'ALL GENERATED QUESTIONS ARE / SHOULD INHERENTLY BE OUROBOROSANALYSES', 'the preserved historical question-hijack body');
requireText('polymyth/methodologylist-degorgonification.txt', 'Good ouroborosanalyses terminate in paradox', 'the generated exact current Ouroborosanalyses owner');
requireText('polymyth/methodologylist-degorgonification.txt', 'ALL GENERATED QUESTIONS ARE / SHOULD INHERENTLY BE OUROBOROSANALYSES', 'the generated exact current question-hijack rule');
for (const relative of [
  'polymyth/methodologylist/methodology/index.html',
  'public/polymyth/methodologylist/methodology/index.html',
]) {
  requireText(relative, 'class="current-status"', 'the static current-status presentation');
  requireText(relative, 'question-generation hijack, survivor-only paradox discriminator, and zero-residue rule govern', 'the static Magic/Wizardry current control');
  requireText(relative, 'survivor-only residue, zero-valid result, and paradox-versus-contradiction account remain active', 'the static six-loop current control');
}
for (const relative of [
  'polymyth/methodologylist/sabachtan/index.html',
  'public/polymyth/methodologylist/sabachtan/index.html',
]) {
  requireText(relative, 'reports zero when no issue survives', 'the static Sabachtan paradox control');
}

if (failures.length) {
  console.error('ML* DIALECTICAL HARDENING VERIFICATION FAILED');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log('ML* DIALECTICAL HARDENING VERIFIED — bootstrap, canonical entries, mirrors, public copies, and activation surfaces agree');
