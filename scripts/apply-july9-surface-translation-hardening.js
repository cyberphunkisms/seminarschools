#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');

function findSeedArrayBounds(text) {
  const seedIdx = text.indexOf('const SEED');
  if (seedIdx < 0) throw new Error('const SEED not found');
  const start = text.indexOf('[', seedIdx);
  let depth = 0, quote = null, template = false, esc = false, end = -1;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (esc) { esc = false; continue; }
    if (c === '\\') { esc = true; continue; }
    if (quote) { if (c === quote) quote = null; continue; }
    if (template) { if (c === '`') template = false; continue; }
    if (c === '`') { template = true; continue; }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === '[') depth++;
    if (c === ']') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end < 0) throw new Error('SEED array end not found');
  return {start, end};
}

function insertEntries(rel, entries) {
  const file = path.join(root, rel);
  let text = fs.readFileSync(file, 'utf8');
  const missing = entries.filter(e => !text.includes(`t:${JSON.stringify(e.t)}`) && !text.includes(`"t":${JSON.stringify(e.t)}`) && !text.includes(`id:${JSON.stringify(e.id || '')}`));
  if (!missing.length) {
    console.log(rel + ': entries already present');
    return;
  }
  const {end} = findSeedArrayBounds(text);
  const block = missing.map(e => '  ' + JSON.stringify(e, null, 2).replace(/\n/g, '\n  ')).join(',\n') + ',\n';
  text = text.slice(0, end) + block + text.slice(end);
  fs.writeFileSync(file, text, 'utf8');
  console.log(rel + ': inserted ' + missing.length + ' entries');
}

function replaceOnce(rel, from, to) {
  const file = path.join(root, rel);
  let text = fs.readFileSync(file, 'utf8');
  if (text.includes(to)) {
    console.log(rel + ': replacement already present');
    return;
  }
  if (!text.includes(from)) throw new Error(rel + ': expected text not found');
  text = text.replace(from, to);
  fs.writeFileSync(file, text, 'utf8');
  console.log(rel + ': hardened existing rule text');
}

const pm5From = `Mixing the two registers without intent is a silent failure mode that produces both bloated internal docs and impenetrable front-facing pages.`;
const pm5To = `Mixing the two registers without intent is a silent failure mode that produces both bloated internal docs and impenetrable front-facing pages. VERBATIM FIREWALL. The user's blunt, compressed, angry, profane, or framework-heavy wording is treated as payload, not as public copy. Preserve the meaning, stakes, target, and force; translate the surface for the actual audience. Do not paste operator phrases into front-facing pages unless the user explicitly requests verbatim quotation for that public surface and the phrase passes the audience parse test. Example: internal note: BB is for teachers who give a shit. Public surface: BB is for committed teachers who want reading, writing, time, choice, and consequence to matter. Teacher manual: BB is built for teachers who want student work to shape what happens next. ML*/BB* may preserve the blunt wording as doctrine or diagnostic shorthand; public pages polish it without neutering it.`;
if (fs.readFileSync(path.join(root, 'polymyth/methodologylist/index.html'), 'utf8').includes('VERBATIM FIREWALL')) { console.log('polymyth/methodologylist/index.html: PM5 hardening already present'); } else { replaceOnce('polymyth/methodologylist/index.html', pm5From, pm5To.replace(/user\'s/g, 'user\\\'s')); }

const mlEntries = [
  {
    s:'methodology',
    r:'ai',
    t:'PM5-HARDENING. Surface translation firewall: preserve operator payload, translate public wording',
    b:`LAYMAN. Do not paste the user's raw build-language into public copy. The user's wording often contains internal shorthand, anger, profanity, framework terms, and diagnostic force. That wording tells Mephistodata what the payload is. It is not automatically the sentence that belongs on the website, CV, teacher handout, student page, parent page, or school-facing page.

THE RULE. Every phrase from the operator receives a surface classification before publication: internal note, star-file doctrine, teacher manual, student-facing copy, public marketing copy, CV/resume copy, build/report copy, or direct quotation. Preserve meaning; translate surface. Do not over-soften the payload. Do not ship the raw operator phrase unless the user explicitly requests verbatim public wording and the phrase passes the audience parse test.

TRANSLATION GATE. For every candidate sentence, ask five questions. One: who is the reader. Two: is the sentence instruction to the AI, doctrine for a star file, or public copy. Three: what must be preserved: anger, boundary, technical rule, pedagogical force, warning, joke, or slogan. Four: what wording would a cold reader understand without private context. Five: what wording keeps the force without leaking backend machinery.

CANONICAL EXAMPLE. Operator phrase: BB is for teachers who give a shit. Internal ML*/BB* payload: low-commitment teaching, workload refusal, and mood-protection can become gorgonification when they block consequential pedagogy. Teacher manual translation: BB is built for teachers who want reading, writing, time, choice, and consequence to matter in the classroom. Public translation: BB helps committed teachers turn class reading into a living world where student work shapes what happens next. The blunt phrase may remain in star-file doctrine as diagnostic shorthand. It does not go verbatim on the public page.

ANTI-TWIST. Polishing is not dilution. The point is to preserve force at the correct surface. A front-facing sentence can be clean, warm, or professional while still carrying the full rule. If polishing removes the core stakes, it has become gorgon smoothing. If rawness leaks onto the wrong surface, it has become register failure. The correct move is force-preserving translation.

HARD BLOCK. Public pages must not accidentally expose operator-only phrases such as give a shit, shitty teachers, fucking motivation, AI explaining to AI, bootstrap this file, setupnpc/improvnpc machinery, or verification doctrine unless the page is explicitly an internal rule library, audit, or star-file route. Internal pages can preserve them with context.

WORKFLOW. Before final zip delivery, run the front-facing boundary verifier and a human audience pass. Technical tests catch forbidden phrases; the human pass catches wrong register, ugly tone, and public confusion.`,
    x:'Origin 2026-07-09 user correction after the assistant repeated the internal phrase "BB is for teachers who give a shit" as if it might be patch text. The user asked whether the system has a rule to distinguish and polish private instructions before front-facing use, then requested this rule be hardened permanently. Extends PM5 audience-routing, front-facing versus operator-to-AI instruction separation, PM28 terminology earns-place rule, and the BB front-facing audit.',
    tg:'methodology, ai-root, front-facing, operator-payload, surface-translation, verbatim-firewall, anti-twist, audience-routing, public-copy, star-file-doctrine, bb, 2026-07-09'
  },
  {
    s:'learnings',
    r:'both',
    t:'July 9 2026 TLDR layman versus BLOOM distinction and surface translation learning',
    b:`LAYMAN. TLDR layman and BLOOM are different response modes. TLDR layman compresses: short, ordinary-language, quickly readable, no sprawling explanation. BLOOM unfolds: it takes a seed, lets implications open, shows examples, tensions, hidden operations, consequences, and future routes. If the user asks for both, give TLDR layman first and BLOOM after.

SURFACE TRANSLATION LEARNING. User-to-AI language is not automatically public language. A sentence like BB is for teachers who give a shit carries a real doctrine: BB is for committed teachers who want consequential pedagogy and who will not hide behind workload refusal as an excuse for dead teaching. Public pages should translate that force into reader-facing language. Star files can preserve the internal phrase with context.

APPLICATION. When producing site copy, CV copy, teacher-manual copy, or student copy, separate payload from surface. Keep the payload. Rewrite the surface. Do not let AI ethics smoothing turn the sentence into harmless mush. Do not let raw operator language leak into public pages where it sounds careless, hostile, or private-context dependent.`,
    x:'Filed after the user clarified that BLOOM and TLDR layman are distinct and then caught the assistant on front-facing polish. This entry makes the response-mode distinction and the surface-translation rule part of the learning ledger.',
    tg:'learnings, tldr-layman, bloom, response-mode, surface-translation, front-facing, operator-payload, bb, 2026-07-09'
  }
];

insertEntries('polymyth/methodologylist/index.html', mlEntries);

const bbEntries = [
  {
    id:'dm-114',
    bb_links:['dm-112','dm-113','dm-111','dim-034'],
    s:'methodology',
    r:'dm',
    t:'Teacher-commitment copy rule: keep the force, translate the surface',
    b:`LAYMAN. BB is for committed teachers. Internal notes can say the blunt version because the blunt version names the stakes. Public pages and teacher-facing pages translate it into language a cold reader can trust.

INTERNAL PAYLOAD. BB is for teachers who care enough to let student work matter. Workload refusal, fake softness, and low-commitment teaching can become gorgonification when they protect dead classrooms from consequential pedagogy. The table works because the teacher gives the world memory, consequence, and attention.

PUBLIC TRANSLATION. Say: BB helps committed teachers turn class reading into a living world where student work shapes what happens next. Or: BB is built for teachers who want reading, writing, time, choice, and consequence to matter in the classroom.

TEACHER MANUAL TRANSLATION. Say: choose light, medium, or full mode according to the teacher's capacity, but keep consequences real. A light version is still alive when the quest has a window, a consequence, and a repair path. A full version can carry Kingdom Come style memory across sessions.

RULE. Keep the force. Translate the surface. Do not put private operator bluntness on the public BB page unless it is intentionally quoted and contextualized. Do not soften consequential pedagogy into bland encouragement. The public reader should feel commitment, clarity, and possibility, not private rant or AI machinery.`,
    x:'Origin 2026-07-09 user challenge after the assistant wrote BB is for teachers who give a shit in a patch summary. This entry keeps the doctrine while routing the phrase correctly by surface.',
    tg:'method, dm-root, front-facing, teacher-commitment, surface-translation, consequence-pedagogy, anti-gorgonification, no-private-rant-leak, 2026-07-09'
  }
];

insertEntries('polymyth/bookwormburrows/index.html', bbEntries);

// Harden the automated public-page scan against raw operator wording leaks.
const verifierRel = 'scripts/verify-front-facing-boundary.js';
const verifierPath = path.join(root, verifierRel);
let verifier = fs.readFileSync(verifierPath, 'utf8');
if (!verifier.includes("'give a shit'")) {
  verifier = verifier.replace(
`  'AI-side of the DM'\n];`,
`  'AI-side of the DM',
  'give a shit',
  'shitty teachers',
  'fucking motivation',
  'shit work',
  'AI explaining to AI',
  'bootstrap this file'\n];`
  );
  verifier = verifier.replace(
`  'memory clerk'\n]);`,
`  'memory clerk',
  'give a shit',
  'shitty teachers',
  'fucking motivation',
  'shit work',
  'AI explaining to AI',
  'bootstrap this file'\n]);`
  );
  if (!verifier.includes('surface translation firewall')) {
    verifier = verifier.replace(
`if(!ml.includes('Treating operator command language as front-facing copy')) {
  errors.push('ml*: worked-example anti-twist text missing.');
}`,
`if(!ml.includes('Treating operator command language as front-facing copy')) {
  errors.push('ml*: worked-example anti-twist text missing.');
}
if(!ml.includes('Surface translation firewall')) {
  errors.push('ml*: hardened surface translation firewall missing.');
}
if(!ml.includes('BB helps committed teachers turn class reading into a living world')) {
  errors.push('ml*: canonical BB public translation example missing.');
}`
    );
  }
  fs.writeFileSync(verifierPath, verifier, 'utf8');
  console.log(verifierRel + ': hardened public-surface forbidden phrase scan');
} else {
  console.log(verifierRel + ': hardening already present');
}
