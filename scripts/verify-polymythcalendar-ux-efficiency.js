#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const ROUTES = ['polymythseminars','writingclub','writingkids','writingjuniors','writingteens','writinggrads','university','philosophy','humanities','cfps','lectures','fellowships'];
let errors = [];
function read(route){ return fs.readFileSync(path.join(ROOT, route, 'index.html'), 'utf8'); }
for (const route of ROUTES) {
  const html = read(route);
  const label = `${route}/index.html`;
  const required = [
    ['compact guide', 'quick-guide-main'],
    ['active contextual guide', 'id="activeGuide"'],
    ['dynamic event descriptions', 'function eventDescriptionHtml(e)'],
    ['smooth-scroll throttle', 'var todayScrollFrame = 0'],
    ['event virtualization hint', 'content-visibility: auto'],
    ['calendar day navigator', 'cal-grid-clean'],
    ['calendar agenda panel', 'cal-agenda'],
    ['calendar day selector', 'data-cal-date'],
    ['geometry mandala', '/js/mandala.js'],
    ['geometry indra', '/js/indra.js'],
    ['alive surface', '/css/alive.css']
  ];
  for (const [name, needle] of required) if (!html.includes(needle)) errors.push(`${label} missing ${name}`);
  if (html.includes("window.scrollTo({ top: 0")) errors.push(`${label} still jumps whole page on event-tag click`);
  if (html.includes("setTimeout(run, 320)")) errors.push(`${label} still has multi-timer today anchoring`);
  if (!html.includes('academicOk = !activeAcademicFocus')) errors.push(`${label} calendar mode ignores academic shortcut focus`);
  if (!html.includes('All Writing</a>')) errors.push(`${label} missing clear All Writing link`);
  if (html.includes('All Writing</strong> = all writing contests')) errors.push(`${label} still contains pointless All Writing glossary copy`);
  if (!html.includes('For students:')) errors.push(`${label} missing student safety copy`);
}
const pkg = fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8');
if (!pkg.includes('verify-polymythcalendar-ux-efficiency.js')) errors.push('package verify:all does not include UX efficiency guard');
if (errors.length) {
  console.error('POLYMYTHCALENDAR UX/EFFICIENCY CHECK FAILED');
  for (const e of errors) console.error(' - ' + e);
  process.exit(1);
}
console.log(`POLYMYTHCALENDAR UX/EFFICIENCY CHECK PASSED — ${ROUTES.length} pages have compact guide, descriptions, agenda calendar, smoother anchoring, and geometry.`);
