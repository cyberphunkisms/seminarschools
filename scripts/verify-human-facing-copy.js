#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const POLY = ['polymythseminars','writingclub','writingkids','writingjuniors','writingteens','writinggrads','university','philosophy','humanities','cfps','lectures','fellowships'];
const errors = [];
function read(rel){ return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
for (const route of POLY) {
  const rel = `${route}/index.html`;
  const html = read(rel);
  if (!/<h1>\s*Polymythcal\s*<\/h1>/.test(html)) errors.push(`${rel}: title is not stable Polymythcal`);
  if (!html.includes('Choose a filter') || !html.includes('check dates, rules, and sign-up')) errors.push(`${rel}: guide is not practical enough`);
  if (!html.includes('For students:')) errors.push(`${rel}: missing student safety note`);
  for (const bad of ['All Writing</strong> = all writing contests','CFP</strong> = call for papers','Projected</strong> = check the official source first','Descriptions say what each item is']) {
    if (html.includes(bad)) errors.push(`${rel}: contains self-explaining copy: ${bad}`);
  }
}
const saul = read('saul/index.html');
for (const good of ['Choose CV sections','Select one area or combine several. The PDF follows your selection.','data-cat="all" class="on" id="allBtn">Full CV</button>','if (active.has(cat)) active.delete(cat);','else active.add(cat);']) {
  if (!saul.includes(good)) errors.push(`saul/index.html: missing ${good}`);
}
for (const bad of ['CV module tabs','PDF follows active tabs','Choose one module','one selected tab = one printable CV']) {
  if (saul.includes(bad)) errors.push(`saul/index.html: still contains confusing copy: ${bad}`);
}
const indra = read('js/indra.js');
if (!/var IDLE_AFTER\s*=\s*100000000/.test(indra)) errors.push('js/indra.js: background geometry still goes idle too quickly');
const apply = read('scripts/apply-visible-geometry.js');
if (!/return '0\.245'/.test(apply)) errors.push('scripts/apply-visible-geometry.js: Polymythcal intensity was not raised');
if (errors.length) {
  console.error('HUMAN-FACING COPY / CV SELECTION CHECK FAILED');
  errors.forEach(e => console.error(' - ' + e));
  process.exit(1);
}
console.log('HUMAN-FACING COPY CHECK PASSED — Polymythcal instructions are practical, Saul CV sections are multi-select, and geometry remains animated.');
