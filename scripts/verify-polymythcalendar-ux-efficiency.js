#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const errors = [];
const main = fs.readFileSync(path.join(ROOT, 'polymythseminars/index.html'), 'utf8');
const app = fs.readFileSync(path.join(ROOT, 'js/polymythcal-revamp.js'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'css/polymythcal-revamp.css'), 'utf8');
for (const [name, needle, where] of [
  ['plain-language search guidance','Search accepts English, French, accents, and close spellings',main],
  ['active filter panel','id="pmActivePanel"',main],
  ['paginated list control','id="pmLoadMore"',main],
  ['calendar view mount','id="pmCalendar"',main],
  ['mobile filter controls','id="pmMobileBar"',main],
  ['geometry mandala','/js/mandala.js',main],
  ['geometry indra','/js/indra.js',main],
  ['alive surface','/css/alive.css',main],
  ['dynamic event descriptions','event.description',app],
  ['50-item initial pagination','const PAGE_SIZE = 50',app],
  ['calendar month navigation','data-calendar-nav',app],
  ['mobile agenda rendering','pm-agenda-day',app],
  ['URL-backed state','history.replaceState',app],
  ['conditional event-data revalidation','cache: "no-cache"',app],
  ['content visibility for event cards','content-visibility: auto',css]
]) if (!where.includes(needle)) errors.push(`polymythseminars missing ${name}`);
if (Buffer.byteLength(main, 'utf8') >= 100000) errors.push('polymythseminars client shell exceeds 100 KB');
if (main.includes('id="eventsContainer"') || main.includes('id="events-fallback"')) errors.push('polymythseminars regressed to embedded full-corpus markup');

const legacy = ['writingclub','writingkids','writingjuniors','writingteens','writinggrads','university','philosophy','humanities','cfps','lectures','fellowships'];
for (const route of legacy) {
  const html = fs.readFileSync(path.join(ROOT, route, 'index.html'), 'utf8');
  const label = `${route}/index.html`;
  for (const [name, needle] of [
    ['compact guide','quick-guide-main'],['active contextual guide','id="activeGuide"'],
    ['dynamic event descriptions','function eventDescriptionHtml(e)'],['smooth-scroll throttle','var todayScrollFrame = 0'],
    ['event virtualization hint','content-visibility: auto'],['calendar day navigator','cal-grid-clean'],
    ['calendar agenda panel','cal-agenda'],['calendar day selector','data-cal-date'],
    ['geometry mandala','/js/mandala.js'],['geometry indra','/js/indra.js'],['alive surface','/css/alive.css']
  ]) if (!html.includes(needle)) errors.push(`${label} missing ${name}`);
  if (html.includes('window.scrollTo({ top: 0')) errors.push(`${label} still jumps whole page on event-tag click`);
  if (html.includes('setTimeout(run, 320)')) errors.push(`${label} still has multi-timer today anchoring`);
  if (!html.includes('academicOk = !activeAcademicFocus')) errors.push(`${label} calendar mode ignores academic shortcut focus`);
  if (!html.includes('All Writing</a>')) errors.push(`${label} still labels /writingclub/ as only Club`);
}
const pkg = fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8');
if (!pkg.includes('verify-polymythcalendar-ux-efficiency.js')) errors.push('package verify:all does not include UX efficiency guard');
if (errors.length) {
  console.error('POLYMYTHCALENDAR UX/EFFICIENCY CHECK FAILED');
  errors.forEach(e => console.error(' - ' + e));
  process.exit(1);
}
console.log(`POLYMYTHCALENDAR UX/EFFICIENCY CHECK PASSED — lightweight current shell plus ${legacy.length} dedicated shortcut pages.`);
