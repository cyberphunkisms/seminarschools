#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const failures = [];
const must = (label, ok) => { if(!ok) failures.push(label); };

const landing = read('bb/index.html');
const app = read('bookwormcard/index.html');
const about = read('bookwormcard/about/index.html');
const bb = read('polymyth/bookwormburrows/index.html');
const txt = read('polymyth/bookwormburrows.txt');
const rules = read('polymyth/polymythdnd/ruleset.md');
const npcSchedule = read('polymyth/campaigncodex/cmp-001-npc-schedule.md');
const campaignCodex = read('polymyth/campaigncodex/index.html');
const campaignTxt = read('polymyth/campaigncodex.txt');
const studyTxt = read('polymyth/methodologylist-studylist.txt');
const studyFull = read('polymyth/methodologylist.txt');
const studyPage = read('polymyth/methodologylist/studylist/index.html');
const userFacingBundle = [landing, app, about, read('polymyth/dmboard/index.html')].join('\n');

must('BB landing keeps BB / BookwormBurrows / PolymythDND alias together', landing.includes('bookwormburrows') && landing.includes('PolymythDND') && landing.includes('BB'));
must('BB landing names Dimensional Master', landing.includes('Dimensional Master'));
must('BB landing says assignments become quests', landing.includes('Turn assignments into quests'));
must('BB landing says no dice and unified teacher-AI DM', landing.includes('There are no dice') && landing.includes('human Dimensional Master and AI work together') && landing.includes('human Dimensional Master mediates'));
must('BB landing routes the priority AI-assisted workflow with manual fallback', landing.includes('Run a burrow with wormcards') && landing.includes('AI-assisted BB is the priority workflow') && landing.includes('paper or document version remains playable'));
must('BB landing keeps setupnpc/improvnpc jargon out of public copy', !landing.includes('setupnpcs') && !landing.includes('improvnpcs'));
must('BB landing removes future assistant app wording', !landing.includes('Future DM table assistant') && !landing.includes('coming soon: DM assistant mode'));

must('Bookwormcard sends saved card to the Dimensional Master', app.includes('give it to the Dimensional Master'));
must('Bookwormcard keeps burrowing character premise', app.includes('burrowing character') && app.includes('burrow'));
must('Bookwormcard avoids stale AI-helper handoff wording', !app.includes('teacher, DM, or AI helper'));

must('About page routes the AI-assisted workflow and manual fallback', about.includes('teacher manual workflow') && about.includes('AI-assisted BB is the priority workflow') && about.includes('run manually'));
must('About page links BB plain-text manual', about.includes('/polymyth/bookwormburrows.txt'));
must('About page protects sealed exegesis', about.includes('keeps the exegesis sealed'));
must('About page removes public bootstrap block', !about.includes('copy bootstrap') && !about.includes('first ask me for the wormcards') && !about.includes('setupnpcs') && !about.includes('improvnpcs'));
must('About page keeps teacher as human filter', about.includes('The teacher remains the voice at the table') || about.includes('the human filter stays active'));

must('BB operations include clarification and startup synthesis entries', ['dm-108','dm-109','dm-110','ses-006','pen-015','dm-115','dm-116','dm-117','dm-118','dm-119','can-004','char-007','char-008','ses-007','ses-008'].every(id => bb.includes(`id:'${id}'`)));
const seedMatch = bb.match(/const SEED = \[([\s\S]*?)\];\n\nlet entries/);
let seedCount = 0;
if(seedMatch){
  seedCount = vm.runInNewContext('const SEED = [' + seedMatch[1] + ']; SEED.length;', {});
}
must('BB operation library now carries 246 entries', seedCount === 246);
must('BB plain text mirror carries 246 entries', /TOTAL ENTRIES:\s+246/.test(txt));
must('BB plain text mirror includes assignment and NPC rulings', txt.includes('Assignments-as-quests motivation rule') && txt.includes('SetupNPC and ImprovNPC taxonomy'));

must('PolymythDND rules capture current clarification pass', rules.includes('Current BB clarification pass') && rules.includes('same game in different registers'));
must('PolymythDND rules define the teacher-AI Dimensional Master', rules.includes('teacher and AI form the Dimensional Master together') && rules.includes('Rainbowsol names Saul specifically') && rules.includes('AI-assisted play is the priority design surface'));
must('Campaign NPC schedule separates setupnpcs and improvnpcs', npcSchedule.includes('setupnpcs') && npcSchedule.includes('improvnpcs'));
must('Campaign codex pages carry current BB campaign ruling', campaignCodex.includes('Current BB ruling for campaigns') && campaignTxt.includes('CURRENT BB / POLYMYTHDND CAMPAIGN RULING'));
must('Studylist carries the 33rd BB clarification entry', studyTxt.includes('STUDYLIST (33 entries)') && studyTxt.includes('BB* / PolymythDND clarification and next build queue'));
must('Methodologylist mirror carries BB clarification entry', studyFull.includes('BB* / PolymythDND clarification and next build queue'));
must('Studylist page carries BB clarification entry', studyPage.includes('BB* / PolymythDND clarification and next build queue'));

must('User-facing BB pages avoid stale website-first session label', !/Start a session/.test(userFacingBundle));
must('User-facing BB pages avoid stale generic AI-helper handoff', !/teacher, DM, or AI helper/.test(userFacingBundle));
must('User-facing BB pages avoid backend bootstrap language', !/Future DM table assistant|DM assistant mode|setupnpcs|improvnpcs|copy bootstrap|AI chat running the table|AI function|AI reaction layer/.test(userFacingBundle));

if(failures.length){
  console.error('BB clarification verification failed:');
  for(const f of failures) console.error(' - ' + f);
  process.exit(1);
}
console.log('BB clarification verification passed: alias, wormcards, teacher-AI Dimensional Master, assignments-as-quests, AI-assisted workflow, manual fallback, public-copy boundary, adult mode, studylist, and 246-entry mirror checked.');
