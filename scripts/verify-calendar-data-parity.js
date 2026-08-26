#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const exists = relative => fs.existsSync(path.join(ROOT, relative));
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

const canonicalText = read('polymythseminars/events.json');
const masterText = read('data/polymyth-seminar-events.json');
const canonical = JSON.parse(canonicalText);
const browse = JSON.parse(read('polymythseminars/browse.json'));
const watchlist = JSON.parse(read('polymythseminars/watchlist.json'));
const surfaces = JSON.parse(read('data/polymythcal-publication-surfaces.json'));
const html = read('polymythseminars/index.html');
const app = read('js/polymythcal-discovery.js');

check(canonicalText === masterText, 'The two private canonical mirrors are not byte-identical.');
check(Array.isArray(canonical.events), 'Canonical calendar data lacks an events array.');
check(canonical.count === canonical.events.length && canonical._total_events === canonical.events.length, 'Canonical event totals disagree.');
check(browse._schema === 'polymythcal-discovery-v2' && Array.isArray(browse.events), 'Chronology projection has the wrong schema.');
check(watchlist._schema === 'polymythcal-watchlist-v2' && Array.isArray(watchlist.items), 'Monitoring projection has the wrong schema.');
check(browse.count === browse.events.length && watchlist.count === watchlist.items.length, 'Public projection counts disagree.');
check(browse.events.length + watchlist.items.length === canonical.events.length, 'Chronology and monitoring do not cover the canonical corpus.');
const chronologyIds = new Set(browse.events.map(event => event.id));
const watchlistIds = new Set(watchlist.items.map(event => event.id));
check([...chronologyIds].every(id => !watchlistIds.has(id)), 'Chronology and monitoring overlap.');
check(JSON.stringify([...chronologyIds]) === JSON.stringify(surfaces.chronology_ids), 'Chronology order differs from the publication manifest.');
check(JSON.stringify([...watchlistIds]) === JSON.stringify(surfaces.watchlist_ids), 'Monitoring order differs from the publication manifest.');
check(watchlist.items.every(item => !('date' in item) && !('end_date' in item)), 'Monitoring projection exposes invented chronology dates.');

check(html.includes('id="pmdList"'), 'Calendar lacks the Discovery v2 result mount.');
check(html.includes('/js/polymythcal-discovery.js'), 'Calendar lacks the Discovery v2 controller.');
check(!html.includes('id="eventsContainer"') && !html.includes('id="events-fallback"'), 'Calendar embeds a legacy event corpus.');
check(/<noscript>[\s\S]*calendar feeds[\s\S]*site map/i.test(html), 'Calendar lacks useful non-JavaScript routes.');
check(app.includes('/polymythseminars/browse.json'), 'Discovery controller does not use the safe chronology projection.');
check(app.includes('/polymythseminars/watchlist.json'), 'Discovery controller does not support the date-free monitoring projection.');
check(!app.includes('/polymythseminars/events.json'), 'Discovery controller fetches the private canonical corpus.');
check(Buffer.byteLength(html, 'utf8') < 100000, 'Calendar shell exceeds 100 KB.');
check(!exists('public/polymythseminars/events.json'), 'Generated public deploy exposes the private canonical corpus.');

if (failures.length) {
  console.error('CALENDAR DATA PARITY FAILED');
  failures.forEach(failure => console.error(` - ${failure}`));
  process.exit(1);
}
console.log(`CALENDAR DATA PARITY OK — ${canonical.events.length} canonical = ${browse.events.length} chronology + ${watchlist.items.length} monitoring; lightweight safe shell verified.`);

