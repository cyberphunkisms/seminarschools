#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const pages = [
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
const failures = [];
for (const rel of pages) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) { failures.push(`${rel}: missing`); continue; }
  const html = fs.readFileSync(file, 'utf8');
  const checks = [
    ['scroll shell', 'id="eventsScroll"'],
    ['today anchor CSS', '.today-anchor'],
    ['today marker helper', 'function todayMarkerHtml'],
    ['today scheduling helper', 'function scheduleScrollToToday'],
    ['today marker insertion', 'todayMarkerInserted'],
    ['scroll target anchor', "document.getElementById('todayAnchor')"],
    ['local-day calculation', 'function startOfLocalDay'],
    ['initial auto scroll', "scheduleScrollToToday('auto')"]
  ];
  for (const [label, needle] of checks) {
    if (!html.includes(needle)) failures.push(`${rel}: missing ${label}`);
  }
  if (html.includes('new Date().toISOString().slice(0, 10)')) {
    failures.push(`${rel}: uses UTC toISOString date for today scroll`);
  }
}
if (failures.length) {
  console.error('POLYMYTHCALENDAR TODAY SCROLL CHECK FAILED');
  failures.forEach(f => console.error(' - ' + f));
  process.exit(1);
}
console.log(`POLYMYTHCALENDAR TODAY SCROLL CHECK PASSED — ${pages.length} scrollbox pages auto-anchor to the viewer's local today.`);
