#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const PAGES = [
  'polymythseminars/index.html',
  'writingclub/index.html',
  'writingkids/index.html',
  'writingjuniors/index.html',
  'writingteens/index.html',
  'writinggrads/index.html',
  'university/index.html',
  'philosophy/index.html',
  'humanities/index.html',
  'cfps/index.html',
  'lectures/index.html',
  'fellowships/index.html'
];
const REQUIRED = [
  'class="quick-guide"',
  'quick-guide-main',
  'How to use',
  'Pick a filter',
  'The list starts near today',
  'CFP</strong> = call for papers',
  'aria-describedby="quickGuideCopy"'
];
const failures = [];
for (const rel of PAGES) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) { failures.push(`${rel}: missing file`); continue; }
  const html = fs.readFileSync(file, 'utf8');
  for (const needle of REQUIRED) {
    if (!html.includes(needle)) failures.push(`${rel}: missing ${needle}`);
  }
  if (rel === 'polymythseminars/index.html') {
    for (const needle of ['stable Polymythcal page', 'Unconfirmed</strong> listings remain visible']) if (!html.includes(needle)) failures.push(`${rel}: missing ${needle}`);
  } else if (!html.includes('Open a title to reach the official source') && !html.includes('stable Polymythcal page')) {
    failures.push(`${rel}: missing title-link guidance`);
  }
}
if (failures.length) {
  console.error('POLYMYTHCALENDAR KID GUIDE CHECK FAILED');
  for (const f of failures) console.error(` - ${f}`);
  process.exit(1);
}
console.log(`POLYMYTHCALENDAR KID GUIDE CHECK PASSED — ${PAGES.length} pages carry concise student-facing instructions.`);
