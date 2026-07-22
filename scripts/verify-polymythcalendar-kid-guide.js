#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const LEGACY_PAGES = [
  'writingclub/index.html','writingkids/index.html','writingjuniors/index.html',
  'writingteens/index.html','writinggrads/index.html','university/index.html',
  'philosophy/index.html','humanities/index.html','cfps/index.html','lectures/index.html','fellowships/index.html'
];
const failures = [];
const mainRel = 'polymythseminars/index.html';
const main = fs.readFileSync(path.join(ROOT, mainRel), 'utf8');
for (const needle of [
  'Search the calendar',
  'Choose events, opportunities, or both.',
  'The listed date is the deadline.',
  'Choose any number of areas.',
  'Open a title for the stable Polymythcal page.',
  'Missing times and locations stay visible as pending details.',
  'aria-describedby="quickGuideCopy"'
]) if (!main.includes(needle)) failures.push(`${mainRel}: missing ${needle}`);
if (!main.includes('id="quickGuideCopy"')) failures.push(`${mainRel}: missing quickGuideCopy guidance target`);
for (const rel of LEGACY_PAGES) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) { failures.push(`${rel}: missing file`); continue; }
  const html = fs.readFileSync(file, 'utf8');
  for (const needle of ['class="quick-guide"','quick-guide-main','How to use','Pick a filter','The list starts near today','CFP</strong> = call for papers','aria-describedby="quickGuideCopy"']) {
    if (!html.includes(needle)) failures.push(`${rel}: missing ${needle}`);
  }
  if (!html.includes('Open a title to reach the official source') && !html.includes('stable Polymythcal page')) failures.push(`${rel}: missing title-link guidance`);
}
if (failures.length) {
  console.error('POLYMYTHCALENDAR KID GUIDE CHECK FAILED');
  failures.forEach(f => console.error(` - ${f}`));
  process.exit(1);
}
console.log(`POLYMYTHCALENDAR KID GUIDE CHECK PASSED — clear current guidance plus ${LEGACY_PAGES.length} dedicated route guides.`);
