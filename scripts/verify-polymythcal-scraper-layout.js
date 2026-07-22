#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
function read(rel){ return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function exists(rel){ return fs.existsSync(path.join(ROOT, rel)); }
const problems = [];
function need(rel, needle, label){ const s = read(rel); if (!s.includes(needle)) problems.push(`${rel} missing ${label || needle}`); }
function forbid(rel, needle, label){ const s = read(rel); if (s.includes(needle)) problems.push(`${rel} still contains ${label || needle}`); }

// Harvest and qualified-uncertainty pipeline.
for (const [rel, needle, label] of [
  ['scripts/sources.json','findaprotest-toronto','Find a Protest source id'],
  ['scripts/sources.json','https://www.findaprotest.info/canada/toronto','Find a Protest Toronto URL'],
  ['scripts/scrape_seminars.py','def fetch_findaprotest_toronto','deterministic Find a Protest fetcher'],
  ['scripts/scrape_seminars.py','def fetch_generic_event_source','generic HTML source fetcher'],
  ['scripts/scrape_seminars.py','event-watchlist.json','event watchlist output'],
  ['scripts/scrape_seminars.py','extract_topics','topic extraction'],
  ['scripts/merge_and_finalize.py','event-watchlist.json','watchlist merge output'],
  ['scripts/sync-calendar-data.js','watchlist-fallback','watchlist fallback sync'],
  ['scripts/sync-calendar-data.js','WATCHLIST_PUBLIC','public watchlist sync'],
  ['scripts/verify-harvest-pipeline.js','findaprotest-toronto','pipeline guard for Find a Protest']
]) need(rel, needle, label);

// Current front-facing clarity architecture.
for (const [rel, needle, label] of [
  ['polymythseminars/index.html','id="pmSearch"','front-facing search input'],
  ['polymythseminars/index.html','id="pmQuickStarts"','popular starting points'],
  ['polymythseminars/index.html','data-preset="philosophy"','philosophy starting point'],
  ['polymythseminars/index.html','data-preset="humanities"','humanities starting point'],
  ['polymythseminars/index.html','data-preset="lectures"','talks starting point'],
  ['polymythseminars/index.html','data-preset="festivals"','festival starting point'],
  ['polymythseminars/index.html','data-preset="writing"','writing starting point'],
  ['polymythseminars/index.html','data-preset="fellowships"','fellowship starting point'],
  ['polymythseminars/index.html','data-preset="toronto"','Toronto starting point'],
  ['polymythseminars/index.html','data-preset="corridor"','corridor starting point'],
  ['polymythseminars/index.html','data-state-set="opportunityTypes"','separate opportunity filters'],
  ['js/polymythcal-revamp.js','function eventMatchesSearch','single current search function'],
  ['js/polymythcal-revamp.js','function matchesFilters','single current filter function'],
  ['js/polymythcal-revamp.js','event.raw_excerpt','raw excerpt search'],
  ['js/polymythcal-revamp.js','event.topics','source topic search'],
  ['js/polymythcal-revamp.js','event.source_url','official source actions']
]) need(rel, needle, label);
forbid('polymythseminars/index.html','id="eventSearch"','duplicate internal search input');
forbid('polymythseminars/index.html','data-focus="deadlines"','ambiguous Deadlines quick filter');
forbid('polymythseminars/index.html','polymythcal-tools','duplicate tool panel');
const app = read('js/polymythcal-revamp.js');
if ((app.match(/function eventMatchesSearch\(/g) || []).length !== 1) problems.push('polymythcal app must define eventMatchesSearch exactly once');
if ((app.match(/function matchesFilters\(/g) || []).length !== 1) problems.push('polymythcal app must define matchesFilters exactly once');
const canonical = JSON.parse(read('polymythseminars/events.json'));
const football = canonical.events.find(x => /Palestinian Football Exhibit/i.test(x.title || ''));
if (!football) problems.push('PYM/FIFA lead must remain in the canonical chronology');
else if (football.confirmation_status !== 'unconfirmed' || !(football.qualification_reasons || []).includes('time-unconfirmed')) problems.push('PYM/FIFA lead must carry exact unconfirmed qualification');
if (!exists('polymythseminars/watchlist.json')) problems.push('polymythseminars/watchlist.json compatibility file is missing');
if (problems.length) {
  console.error('POLYMYTHCAL SCRAPER/LAYOUT CHECK FAILED');
  problems.forEach(p => console.error(' - ' + p));
  process.exit(1);
}
console.log('POLYMYTHCAL SCRAPER/LAYOUT CHECK PASSED — harvest pipeline, qualified uncertainty, raw excerpt/topic search, and clear starting points are guarded.');
