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
const userFacingBundle = [landing, app, about, bb].join('\n');

must('BB landing keeps BB / BookwormBurrows / PolymythDND alias together', landing.includes('bookwormburrows') && landing.includes('PolymythDND') && landing.includes('BB'));
must('BB landing names Dimensional Master', landing.includes('Dimensional Master'));
must('BB landing says assignments become quests', landing.includes('assignments become quests'));
must('BB landing says no dice and teacher filter', landing.includes('no dice') && landing.includes('teacher remains the voice at the table'));
must('BB landing separates setupnpcs and improvnpcs', landing.includes('setupnpcs') && landing.includes('improvnpcs'));
must('BB landing starts future assistant with wormcards', landing.includes('Open a burrow with wormcards'));

must('Bookwormcard sends saved card to the Dimensional Master', app.includes('give it to the Dimensional Master'));
must('Bookwormcard keeps burrowing character premise', app.includes('burrowing character') && app.includes('burrow'));
must('Bookwormcard avoids stale AI-helper handoff wording', !app.includes('teacher, DM, or AI helper'));

must('About page names DM table assistant', about.includes('DM table assistant'));
must('About bootstrap asks first for wormcards', about.includes('first ask me for the wormcards') || about.includes('begin by asking for the wormcards'));
must('About bootstrap protects sealed exegesis', about.includes('sealed exegesis'));
must('About bootstrap includes setupnpcs and improvnpcs', about.includes('setupnpcs') && about.includes('improvnpcs'));
must('About page keeps human filter above AI', about.includes('AI helps behind the curtain') || about.includes('teacher runs the table'));

must('BB operations include 2026-06-30 clarification entries', ['dm-108','dm-109','dm-110','ses-006','pen-015'].every(id => bb.includes(`id:'${id}'`)));
const seedMatch = bb.match(/const SEED = \[([\s\S]*?)\];\n\nlet entries/);
let seedCount = 0;
if(seedMatch){
  seedCount = vm.runInNewContext('const SEED = [' + seedMatch[1] + ']; SEED.length;', {});
}
must('BB operation library now carries 221 entries', seedCount === 221);
must('BB plain text mirror carries 221 entries', /TOTAL ENTRIES:\s+221/.test(txt));
must('BB plain text mirror includes assignment and NPC rulings', txt.includes('Assignments-as-quests motivation rule') && txt.includes('SetupNPC and ImprovNPC taxonomy'));

must('PolymythDND rules capture current clarification pass', rules.includes('Current BB clarification pass') && rules.includes('same game in different registers'));
must('PolymythDND rules keep AI behind the Dimensional Master', rules.includes('AI assists the Dimensional Master') && rules.includes('does not replace the teacher') && rules.includes('teacher-facing'));
must('Campaign NPC schedule separates setupnpcs and improvnpcs', npcSchedule.includes('setupnpcs') && npcSchedule.includes('improvnpcs'));
must('Campaign codex pages carry current BB campaign ruling', campaignCodex.includes('Current BB ruling for campaigns') && campaignTxt.includes('CURRENT BB / POLYMYTHDND CAMPAIGN RULING'));
must('Studylist carries the 33rd BB clarification entry', studyTxt.includes('STUDYLIST (33 entries)') && studyTxt.includes('BB* / PolymythDND clarification and next build queue'));
must('Methodologylist mirror carries BB clarification entry', studyFull.includes('BB* / PolymythDND clarification and next build queue'));
must('Studylist page carries BB clarification entry', studyPage.includes('BB* / PolymythDND clarification and next build queue'));

must('User-facing BB pages avoid stale website-first session label', !/Start a session/.test(userFacingBundle));
must('User-facing BB pages avoid stale generic AI-helper handoff', !/teacher, DM, or AI helper/.test(userFacingBundle));

if(failures.length){
  console.error('BB clarification verification failed:');
  for(const f of failures) console.error(' - ' + f);
  process.exit(1);
}
console.log('BB clarification verification passed: alias, wormcards, Dimensional Master, assignments-as-quests, setupnpcs/improvnpcs, adult mode, studylist, and 221-entry mirror checked.');
