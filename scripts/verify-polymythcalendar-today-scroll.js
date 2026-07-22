#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const failures = [];
// The current PolymythCAL shell starts with an upcoming, soonest-first result set;
// it should never need to auto-scroll through a giant embedded archive.
const main = fs.readFileSync(path.join(ROOT, 'polymythseminars/index.html'), 'utf8');
const app = fs.readFileSync(path.join(ROOT, 'js/polymythcal-revamp.js'), 'utf8');
if (!main.includes('name="pm-time"') || !main.includes('value="upcoming"')) failures.push('main calendar lacks the explicit Upcoming default');
if (!main.includes('<option value="soonest">Soonest first</option>')) failures.push('main calendar lacks soonest-first sorting');
if (!app.includes('CALENDAR_TIME_ZONE = "America/Toronto"')) failures.push('main calendar lacks the Toronto/corridor timezone contract');
if (!app.includes('state.time === "upcoming"')) failures.push('main calendar does not implement the upcoming time window');
if (main.includes('id="eventsScroll"')) failures.push('main calendar regressed to the giant legacy scrollbox');
// Dedicated shortcut pages still use the compact scrollbox/today-anchor model.
const legacy = ['writingclub','writingkids','writingjuniors','writingteens','writinggrads','university','philosophy','humanities','cfps','lectures','fellowships'];
for (const route of legacy) {
  const rel = `${route}/index.html`;
  const html = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  for (const [label, needle] of [
    ['scroll shell','id="eventsScroll"'],['today anchor CSS','.today-anchor'],['today marker helper','function todayMarkerHtml'],
    ['today scheduling helper','function scheduleScrollToToday'],['today marker insertion','todayMarkerInserted'],
    ['scroll target anchor',"document.getElementById('todayAnchor')"],['local-day calculation','function startOfLocalDay'],
    ['initial auto scroll',"scheduleScrollToToday('auto')"]
  ]) if (!html.includes(needle)) failures.push(`${rel}: missing ${label}`);
  if (html.includes('new Date().toISOString().slice(0, 10)')) failures.push(`${rel}: uses UTC toISOString date for today scroll`);
}
if (failures.length) {
  console.error('POLYMYTHCALENDAR TODAY/UPCOMING CHECK FAILED');
  failures.forEach(f => console.error(' - ' + f));
  process.exit(1);
}
console.log(`POLYMYTHCALENDAR TODAY/UPCOMING CHECK PASSED — main shell starts soonest-first; ${legacy.length} legacy shortcut pages retain local today anchors.`);
