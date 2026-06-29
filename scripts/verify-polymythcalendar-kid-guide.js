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
  'Find something useful',
  'Choose a filter',
  'check dates, rules, and sign-up',
  'For students:',
  'parent or teacher',
  'aria-describedby="quickGuideCopy"'
];
const FORBIDDEN = [
  'All Writing</strong> = all writing contests',
  'CFP</strong> = call for papers',
  'Projected</strong> = check the official source first'
];
const failures = [];
for (const rel of PAGES) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) { failures.push(`${rel}: missing file`); continue; }
  const html = fs.readFileSync(file, 'utf8');
  for (const needle of REQUIRED) {
    if (!html.includes(needle)) failures.push(`${rel}: missing ${needle}`);
  }
  for (const bad of FORBIDDEN) {
    if (html.includes(bad)) failures.push(`${rel}: still has self-explaining copy: ${bad}`);
  }
}
if (failures.length) {
  console.error('POLYMYTHCALENDAR KID GUIDE CHECK FAILED');
  for (const f of failures) console.error(` - ${f}`);
  process.exit(1);
}
console.log(`POLYMYTHCALENDAR KID GUIDE CHECK PASSED — ${PAGES.length} pages carry concise student-facing instructions.`);
