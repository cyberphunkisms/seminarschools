#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const failures = [];
const must = (label, ok) => { if (!ok) failures.push(label); };

const html = read('polymyth/bookwormburrows/index.html');
const txt = read('polymyth/bookwormburrows.txt');
const rules = read('polymyth/polymythdnd/ruleset.md');
const cl = read('BB_CL_2026-07-10.md');
const regen = read('scripts/regen-bookwormburrows-txt.js');

for (const id of ['dm-117','dm-118','dm-119','ses-008','char-008']) {
  must(`${id} exists in BB HTML`, html.includes(`id:'${id}'`));
  must(`${id} exists in BB text mirror`, txt.includes(`ID: ${id}`));
}
must('Narrative Priority is active', rules.includes('Narrative Priority Protocol') && rules.includes('contextual tools'));
must('Old universal Hope/Fear engine is superseded', html.includes("id:'dm-100'") && html.includes('[SUPERSEDED 2026-07-10]'));
must('PVP and compulsion are possible', rules.includes('Persuasion, intimidation, deception, compulsion, theft, restraint, and harm'));
must('Affective modifiers exceed Hope/Fear', rules.includes('Affective and personality modifiers') && rules.includes('anxiety, pride, anger, grief'));
must('Teacher can override AI', rules.includes('teacher may inspect, revise, or replace the proposal') || rules.includes('teacher may refine or override'));
must('CC is active, not pending', rules.includes('CC* already operates as the canonical record') && !rules.includes('Pending mc* Pass B completion before cc* operates'));
must('Generated surfaces remove random-roll statement', ![html,txt,regen].some(s => s.includes('Rolls or random choices appear when the stakes matter.')));
must('Generated surfaces remove generic Rainbowsol DM title', ![html,txt,regen].some(s => s.includes('Rainbowsol is the main DM')));
must('CL closes mechanics synthesis', cl.includes('[CLOSED] TTRPG resolution synthesis and contradiction analysis'));
must('CL keeps construction work', cl.includes('[OPEN] Adjudication example suite') && cl.includes('[OPEN] CC* complete-session schema and serializer'));

if (failures.length) {
  console.error('BB mechanics synthesis verification failed:');
  for (const f of failures) console.error(' - ' + f);
  process.exit(1);
}
console.log('BB mechanics synthesis verification passed: current engine, PVP, affective modifiers, teacher override, active CC memory, generated surfaces, and remaining CL checked.');
