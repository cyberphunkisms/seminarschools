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

for (const id of ['dm-017','dm-018','dm-032','dm-112','dm-117','dm-118','dm-119','bw-007','dim-001','ses-008','char-008']) {
  must(`${id} exists in BB HTML`, html.includes(`id:'${id}'`));
  must(`${id} exists in BB text mirror`, txt.includes(`ID: ${id}`));
}
must('Narrative Priority is active', rules.includes('Narrative Priority Protocol') && rules.includes('contextual tools'));
must('Old universal Hope/Fear engine is superseded', html.includes("id:'dm-100'") && html.includes('[SUPERSEDED 2026-07-10]'));
must('PVP and compulsion are possible', rules.includes('Persuasion, intimidation, deception, compulsion, theft, restraint, and harm'));
must('Affective modifiers exceed Hope/Fear', rules.includes('Affective and personality modifiers') && rules.includes('anxiety, pride, anger, grief'));
must('Teacher can override AI', rules.includes('teacher may inspect, revise, or replace the proposal') || rules.includes('teacher may refine or override'));
must('CC is active, not pending', rules.includes('CC* already operates as the canonical record') && !rules.includes('Pending mc* Pass B completion before cc* operates'));
must('Exegesis governs story and pedagogy', html.includes('PEDAGOGY AND STORY operate inside that boundary') && html.includes('Mechanical uniformity cannot displace'));
must('Manual play can execute the current engine', html.includes('the AI, or the teacher in manual play') && rules.includes('teacher performing comparison, narration, adjudication, and ledger updates directly'));
must('Player intention precedes consequential rendering', html.includes('the player states an intention and an approach') && html.includes('optional renderer may depict the accepted consequence'));
must('Safety signals pause without adjudicative acceptance', html.includes('rainbow-note safety signal or narrative exit pauses presentation immediately'));
must('World-model rendering is optional and non-authoritative', html.includes('it owns only the temporary depiction') && html.includes('media artifacts rather than evidence or save files'));
must('Provider handling is declared and has manual fallback', html.includes('model-training or reuse') && html.includes('BB sends no student data to that provider'));
must('Provider use of student data for model training is prohibited', html.includes('A provider may not use student data, student work, or campaign records for model training') && html.includes('Disclosure of training use does not make that lifecycle acceptable'));
must('Dimension build is medium-native and keeps sealed figures sealed', html.includes('full eight-stage arena standard applies to inhabited narrative') && html.includes('does not perform a sealed canonical figure or event'));
must('Dimension entry preserves source medium and does not universalize the mirror', html.includes("id:'dim-001'") && html.includes("t:'Source or medium as dimension'") && html.includes('No mirror is universal'));
must('Legacy Inception rule does not license synthetic canonical performance', html.includes("t:'Inception arena rule — DM builds the documented surround") && html.includes('neither may voice or respond as a sealed canonical figure') && !html.includes('voice the canonical NPCs from their verbatim primary-source lines'));
must('Legacy canon-play permissions are reconciled', html.includes('never synthetically witnessed from a generated new position') && html.includes('The canonical climax remains in the anchor source') && html.includes('never synthetically replayed, voiced, or witnessed from a generated angle') && !html.includes('witness events from new positions') && !html.includes('witnesses the canon events from an angle') && !html.includes('encounter at hour seven'));
must('Narration law excludes sealed figures', html.includes('PERMITTED CAMPAIGN NPC DIALOGUE') && html.includes('A sealed source figure remains in the anchor source') && !html.includes('characters speak from inside their own day in their canonical voices'));
must('Legacy many-variable rule obeys minimization and manual parity', html.includes('CAUSALLY RICH, MINIMUM-SUFFICIENT FICTIONAL STATE') && html.includes('Manual play may keep a simpler necessary subset') && !html.includes('AI tracks all invisibly') && !html.includes('real-life-equivalent variable-density'));
must('Legacy safety rule pauses immediately', html.includes('IMMEDIATE SAFETY PAUSE, OPTIONAL NARRATIVE EXIT') && html.includes('requires no explanation, permission, adjudication, or assessment') && !html.includes('through deliberation and storytelling, not external-protocol'));
must('Legacy AI-final engine is superseded', html.includes('AI MAY PROPOSE; THE TEACHER ADJUDICATES') && html.includes('AI-led final authority is not an option') && !html.includes('Resolution is delegated to AI co-DM') && !html.includes('AI-led-with-teacher-veto'));
must('CC requirements minimize data and preserve attribution', html.includes('Everything needed means sufficient campaign memory, not raw surveillance') && html.includes('Student wording and work remain attributable and separate from AI elaboration'));
must('CC requirements preserve wormcard authority and semantic recovery', html.includes('wormcard remains authoritative for cross-world identity') && html.includes('exact semantic re-entry into accepted campaign state'));
must('Local inventory uses Rainbow-item exceptions', html.includes('only explicitly adjudicated CONVERT or REMAIN Rainbow items persist across the burrow'));
must('Generated surfaces remove random-roll statement', ![html,txt,regen].some(s => s.includes('Rolls or random choices appear when the stakes matter.')));
must('Generated surfaces remove generic Rainbowsol DM title', ![html,txt,regen].some(s => s.includes('Rainbowsol is the main DM')));
must('CL closes mechanics synthesis', cl.includes('[CLOSED] TTRPG resolution synthesis and contradiction analysis'));
must('CL preserves categorical provider no-training requirement', cl.includes('categorically barred from using student data, student work, or campaign records for model training') && cl.includes('the categorical no-training requirement'));
must('CL keeps implementation and pilot work', cl.includes('[OPEN] Adjudication example suite') && cl.includes('[OPEN] CC* schema implementation, serializer, and migration') && cl.includes('[OPEN] Teacher review budget pilot') && cl.includes('[OPEN] World-model provider and classroom acceptance tests'));
must('CL tracks remaining sealed-source and universal-mirror legacy cleanup', cl.includes('sealed-source rendering or voicing') && cl.includes('alternate-perspective canonical-event replay') && cl.includes('mirror-as-universal-portal'));

if (failures.length) {
  console.error('BB mechanics synthesis verification failed:');
  for (const f of failures) console.error(' - ' + f);
  process.exit(1);
}
console.log('BB mechanics synthesis verification passed: current engine, exegesis authority, manual parity, renderer boundary, provider handling, medium-native dimensions, CC requirements, inventory continuity, and remaining CL checked.');
