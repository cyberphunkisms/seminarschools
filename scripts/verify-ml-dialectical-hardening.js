#!/usr/bin/env node
'use strict';

/** Regression gate for the user-directed 2026-08-04 dialectical hardening. */

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

for (const title of [pm11, mirror, cl58, cl59, choice, gunJump, antiYap]) entry(title);

requireEntryText(pm11, 'b', 'A mixed message that combines outcome language', 'the mixed-speech-act hold');
requireEntryText(pm11, 'b', 'A constraint such as use this picture binds later work. It does not authorize the work.', 'the constraint/authorization boundary');
requireEntryText(pm11, 'b', 'A synthesis candidate remains unbuilt. Then stop for the user\'s ruling.', 'the unbuilt-synthesis stop');
requireEntryText(pm11, 'b', 'WORKED EXAMPLE, 2026-08-04.', 'the homepage failure record');
requireEntryText(pm11, 'x', 'No new subtype was created.', 'the spirit-over-letter boundary');
forbidEntryText(pm11, 'b', 'Then and only then act.', 'the same-turn action loophole');

requireEntryText(mirror, 'b', 'BEFORE ANY MUTATION.', 'the scanner-accessible pre-action gate');
requireEntryText(mirror, 'b', 'Post-hoc approval is not dialectical pacing.', 'the post-hoc-ratification ban');
requireEntryText(mirror, 'b', 'It does not create another subtype.', 'the no-subtype-proliferation rule');

requireEntryText(cl58, 'b', 'Agreement must precede mutation.', 'pre-action agreement');
requireEntryText(cl58, 'b', 'Stop closes all mutable work immediately', 'stop precedence');

requireEntryText(cl59, 'b', 'Read the whole speech-act, not one action verb in isolation.', 'whole-speech-act classification');
requireEntryText(cl59, 'b', 'That mixed speech-act resolves to deliberation for mutable work.', 'mixed-speech-act hold');
requireEntryText(cl59, 'b', 'STOP PRECEDENCE.', 'the explicit stop gate');
forbidEntryText(cl59, 'b', 'A DIRECTIVE is an imperative to act', 'the broad action-verb shortcut');

requireEntryText(choice, 'b', 'surface the fork before committing and wait for the author’s ruling', 'the pre-commit creative-fork rule');
requireEntryText(choice, 'b', 'does not cure the gun-jump', 'the post-hoc-ratification ban');
forbidEntryText(choice, 'b', 'flagging it for ratification in the same delivery', 'the former post-hoc-ratification allowance');

requireEntryText(gunJump, 'b', 'OUTCOME LANGUAGE DOES NOT SETTLE DESIGN.', 'the desired-outcome/design distinction');
requireEntryText(gunJump, 'b', 'Stop cancels prior and pending mutable scope immediately.', 'the stop rule');

requireEntryText(antiYap, 'b', 'Settled build-request: execute and report briefly.', 'the settled-build qualifier');
requireEntryText(antiYap, 'b', 'synthesis candidate left unbuilt', 'the no-action dialectical audit');
requireEntryText(antiYap, 'b', 'pointing at an error is diagnosis rather than a fix request', 'the diagnosis/fix boundary');
requireEntryText(antiYap, 'b', '2026-08-04 AUTHORIZATION HARDENING.', 'the answer-first authorization gate');
forbidEntryText(antiYap, 'b', 'pointing at an error is a request to fix that error', 'the diagnosis-as-authorization sentence');

requireText('CHARTER.txt', 'A diagnosis, critique, audit,\nquestion, or request to think is analysis.', 'the bootstrap analysis boundary');
requireText('CHARTER.txt', 'constraint binds later work. It does not authorize the work.', 'the bootstrap constraint boundary');
requireText('CHARTER.txt', 'Stop closes the\naction gate immediately', 'the bootstrap stop gate');
forbidText('CHARTER.txt', 'Pointing at an error means fix that\nerror.', 'the old bootstrap diagnosis-as-authorization rule');

requireText('scripts/regen-methodologylist-txt.js', 'Agreement precedes mutation. Stop cancels prior scope.', 'the text-mirror activation gate');
requireText('scripts/build-ai-access-pack.js', 'A mixed message combining an outcome verb', 'the AI access-pack activation gate');

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
  requireText(relative, 'mixed-speech-act', 'the generated mixed-speech-act hardening');
  requireText(relative, 'hardened-2026-08-04', 'the generated hardening provenance');
}

for (const relative of [
  'hf_export/ai_access_pack/MEPHISTODATA_ACTIVATION.md',
  'polymyth/mephistodata-activation.md',
]) {
  requireText(relative, 'A mixed message combining an outcome verb', 'the generated activation gate');
}

if (failures.length) {
  console.error('ML* DIALECTICAL HARDENING VERIFICATION FAILED');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log('ML* DIALECTICAL HARDENING VERIFIED — bootstrap, canonical entries, mirrors, public copies, and activation surfaces agree');
