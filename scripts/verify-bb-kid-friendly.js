#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const failures = [];
const must = (label, ok) => { if(!ok) failures.push(label); };

const bb = read('polymyth/bookwormburrows/index.html');
must('BB operation file has kid-friendly reader notice', bb.includes('Kid-friendly reader is on.'));
must('BB operation file renders student title function', bb.includes('function studentTitleFor(entry)'));
must('BB operation file keeps original notes inside details', bb.includes('full teacher / archive note kept'));
must('BB operation file uses fresh storage key so old localStorage does not hide new copy', bb.includes("bb:entries:kid-friendly-v1"));
const seedMatch = bb.match(/const SEED = \[([\s\S]*?)\];\n\nlet entries/);
let seedCount = 0;
if(seedMatch){
  const vm = require('vm');
  seedCount = vm.runInNewContext('const SEED = [' + seedMatch[1] + ']; SEED.length;', {});
}
must('BB operation file keeps all 221 seed entries', seedCount === 221);

const txt = read('polymyth/bookwormburrows.txt');
must('Plain text mirror includes student-friendly versions', txt.includes('STUDENT-FRIENDLY VERSION:'));
must('Plain text mirror keeps original teacher/archive versions', txt.includes('ORIGINAL TEACHER / ARCHIVE VERSION:'));
must('Plain text mirror still has 221 entries', /TOTAL ENTRIES:\s+221/.test(txt));

const bbIndex = read('bb/index.html');
must('BB landing says enter the burrow', bbIndex.includes('enter the burrow'));
must('BB landing explains the Dimensional Master path', bbIndex.includes('give it to the Dimensional Master'));
must('BB landing removes old smash wording', !bbIndex.includes('Smash the figures'));

const why = read('bb/why/index.html');
must('Why page has student version', why.includes('Student version</h2>'));
must('Why page keeps full research essay in details', why.includes('Full research essay for adults and teachers'));

const whyZh = read('bb/why/zh/index.html');
must('Chinese why page has student version', whyZh.includes('学生版</h2>'));
must('Chinese why page keeps full essay details', whyZh.includes('教师和成人完整论文'));

const about = read('bookwormcard/about/index.html');
must('Bookwormcard about uses text-world wording', about.includes('text-world'));
must('Bookwormcard about names Dimensional Master and AI behind curtain', about.includes('Dimensional Master') && about.includes('AI helps behind the curtain'));
must('Bookwormcard about keeps DM assistant bootstrap playable', about.includes('copy bootstrap') && about.includes('DM table assistant') && about.includes('setupnpcs') && about.includes('improvnpcs'));

const glossary = read('bookwormcard/glossary/index.html');
must('Glossary uses character engine wording', glossary.includes('character engine'));
must('Glossary uses simple symbol explanation', glossary.includes('A faint version means the trait is starting to appear.'));

const print = read('bookwormcard/print/index.html');
must('Print card uses simple card tagline', print.includes('A character card &middot; answer, play, grow.'));
must('Print card replaces smashed-up appearance copy', print.includes('mixed-together character looks like'));

if(failures.length){
  console.error('BB kid-friendly verification failed:');
  for(const f of failures) console.error('- ' + f);
  process.exit(1);
}
console.log('BB kid-friendly verification passed: student-facing copy, preserved archive notes, plain-text mirror, landing page, why pages, about/glossary/print copy.');
