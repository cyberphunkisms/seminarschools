#!/usr/bin/env node
'use strict';
/* Guard for Polymythcal source recall + current public-calendar interaction. */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const problems = [];
function read(rel) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) { problems.push(`${rel} is missing`); return ''; }
  return fs.readFileSync(p, 'utf8');
}
function need(rel, needle) { const text = read(rel); if (!text.includes(needle)) problems.push(`${rel} must contain ${needle}`); }
function readJson(rel) { const text = read(rel); if (!text) return null; try { return JSON.parse(text); } catch (e) { problems.push(`${rel} is not valid JSON: ${e.message}`); return null; } }

const sources = read('scripts/sources.json');
for (const needle of ['findaprotest-toronto','https://www.findaprotest.info/canada/toronto']) if (!sources.includes(needle)) problems.push(`scripts/sources.json must keep ${needle}`);
const scraper = read('scripts/scrape_seminars.py');
for (const needle of ['WATCHLIST_PATH','TOPIC_KEYWORDS','TYPE_HINTS','PUBLIC_TYPES','def extract_topics','def classify_event_type','def normalize_record','def provisional_status','def fetch_findaprotest_toronto','needs-time-place','event-watchlist.json','existing leads persist until confirmed or published','timedelta']) if (!scraper.includes(needle)) problems.push(`scripts/scrape_seminars.py must keep ${needle}`);
const merger = read('scripts/merge_and_finalize.py');
for (const needle of ['WATCHLIST_PUBLIC_PATH','polymythseminars','watchlist.json','watchlist only: not published as calendar events until time/place is confirmed','existing leads persist until confirmed or published']) if (!merger.includes(needle)) problems.push(`scripts/merge_and_finalize.py must keep ${needle}`);
const prompt = read('scripts/seminars-prompt.md');
for (const needle of ['Find a Protest source rule','qualification queue','FIFA','football','Palestine','Human Rights','time/place']) if (!prompt.includes(needle)) problems.push(`scripts/seminars-prompt.md must keep ${needle}`);
const schema = read('data/seminars-schema.json');
for (const needle of ['"topics"','"status"','"date_text"','"time_text"','"location_text"']) if (!schema.includes(needle)) problems.push(`data/seminars-schema.json must keep ${needle}`);

// Current main shell: clear facets and no public watchlist clutter.
const main = read('polymythseminars/index.html');
const app = read('js/polymythcal-revamp.js');
for (const needle of ['id="pmSearch"','id="pmQuickStarts"','id="pmFilterDrawer"','id="pmEventList"','id="pmCalendar"','Opportunities to apply for','Calls for papers and proposals','Fellowships, grants, and residencies','Some details pending']) if (!main.includes(needle)) problems.push(`polymythseminars/index.html must keep ${needle}`);
for (const needle of ['function eventMatchesSearch','function matchesFilters','event.raw_excerpt','event.topics','event.source_url','qualification_reasons']) if (!app.includes(needle)) problems.push(`js/polymythcal-revamp.js must keep ${needle}`);
if (main.includes('Leads needing details') || main.includes('watchlistPanel')) problems.push('main Polymythcal should keep qualification leads out of the public results interface');
if (main.includes('data-focus="deadlines"')) problems.push('main Polymythcal must not restore the ambiguous Deadlines shortcut');

// Dedicated entry pages use the same clear multi-select client shell and route-specific corpus restriction.
const dedicated = ['writingclub','writingkids','writingjuniors','writingteens','writinggrads','university','philosophy','humanities','cfps','lectures','fellowships'];
for (const route of dedicated) {
  const rel = `${route}/index.html`;
  const page = read(rel);
  for (const needle of [`data-pm-route="${route}"`,'id="pmSearch"','id="pmFilterDrawer"','id="pmEventList"','/js/polymythcal-revamp.js']) if (!page.includes(needle)) problems.push(`${rel} must keep ${needle}`);
  for (const forbidden of ['quickFocusNav','watchlistPanel','events-fallback','calendarSearch','data-focus="deadlines"']) if (page.includes(forbidden)) problems.push(`${rel} must not restore legacy control ${forbidden}`);
}

const canonical = readJson('polymythseminars/events.json');
if (canonical) {
  const items = Array.isArray(canonical.events) ? canonical.events : [];
  const event = items.find(item => String(item.title || '').toLowerCase().includes('palestinian football exhibit'));
  if (!event) problems.push('polymythseminars/events.json must retain Palestinian Football Exhibit in the main chronology');
  else {
    const joined = JSON.stringify(event);
    for (const needle of ['PYM Toronto','FIFA','football','Palestine','Human Rights','unconfirmed','time-unconfirmed']) if (!joined.includes(needle)) problems.push(`Palestinian Football Exhibit must keep ${needle}`);
  }
}
if (!fs.existsSync(path.join(ROOT, 'polymythseminars/watchlist.json'))) problems.push('public watchlist compatibility file is missing');
if (main.includes('Thank You Ma’am Teaching Activities as a static collection page')) problems.push('polymythseminars/index.html leaked unrelated non-front-facing resource language.');
if (problems.length) { console.error('POLYMYTHCAL SCRAPER/UI GUARD FAILED\n- ' + problems.join('\n- ')); process.exit(1); }
console.log('POLYMYTHCAL SCRAPER/UI OK — source recall, qualified uncertainty, clear shared facets, route-specific entry pages, and private lead separation are guarded.');
