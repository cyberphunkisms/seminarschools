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
for (const [rel, needle, label] of [
  ['scripts/sources.json', 'findaprotest-toronto', 'Find a Protest source id'],
  ['scripts/sources.json', 'https://www.findaprotest.info/canada/toronto', 'Find a Protest Toronto URL'],
  ['scripts/scrape_seminars.py', 'def fetch_findaprotest_toronto', 'deterministic Find a Protest fetcher'],
  ['scripts/scrape_seminars.py', 'def fetch_generic_event_source', 'generic HTML source fetcher'],
  ['scripts/scrape_seminars.py', 'event-watchlist.json', 'event watchlist output'],
  ['scripts/scrape_seminars.py', 'extract_topics', 'topic extraction'],
  ['scripts/merge_and_finalize.py', 'event-watchlist.json', 'watchlist merge output'],
  ['scripts/sync-calendar-data.js', 'watchlist-fallback', 'watchlist fallback sync'],
  ['scripts/sync-calendar-data.js', 'WATCHLIST_PUBLIC', 'public watchlist sync'],
  ['scripts/verify-harvest-pipeline.js', 'findaprotest-toronto', 'pipeline guard for Find a Protest'],
  ['polymythseminars/index.html', 'id="calendarSearch"', 'front-facing search input'],
  ['polymythseminars/index.html', 'id="quickFocusNav"', 'quick focus nav'],
  ['polymythseminars/index.html', 'data-focus="learning"', 'learning quick filter'],
  ['polymythseminars/index.html', 'data-focus="arts"', 'arts quick filter'],
  ['polymythseminars/index.html', 'data-focus="deadlines"', 'deadlines quick filter'],
  ['polymythseminars/index.html', 'data-focus="toronto"', 'Toronto quick filter'],
  ['polymythseminars/index.html', 'data-focus="online"', 'online quick filter'],
  ['polymythseminars/index.html', 'watchlistPanel', 'source-confirmed leads panel'],
  ['polymythseminars/index.html', 'function getFilteredLeads', 'watchlist filtering'],
  ['polymythseminars/index.html', 'function searchHaystack', 'raw excerpt/topic search'],
  ['polymythseminars/index.html', 'watchlist.json?v=', 'watchlist network source'],
]) need(rel, needle, label);
forbid('polymythseminars/index.html', 'id="eventSearch"', 'duplicate internal search input');
forbid('polymythseminars/index.html', 'id="quickFocus"', 'duplicate quick focus nav');
forbid('polymythseminars/index.html', 'polymythcal-tools', 'duplicate tool panel');
forbid('polymythseminars/index.html', 'function eventSearchText', 'duplicate search function');
const html = read('polymythseminars/index.html');
if ((html.match(/function matchesSearch\(/g) || []).length !== 1) problems.push('polymythseminars/index.html must define matchesSearch exactly once');
if ((html.match(/function getFilteredEvents\(/g) || []).length !== 1) problems.push('polymythseminars/index.html must define getFilteredEvents exactly once');
if (!/activeFocus === 'learning'/.test(html) || !/activeFocus === 'arts'/.test(html)) problems.push('polymythseminars/index.html quick filters are not implemented in focusMatches');
const canonical = JSON.parse(read('polymythseminars/events.json'));
const football = canonical.events.find(x => /Palestinian Football Exhibit/i.test(x.title || ''));
if (!football) problems.push('PYM/FIFA lead must remain in the canonical chronology');
else if (football.confirmation_status !== 'unconfirmed' || !(football.qualification_reasons || []).includes('time-unconfirmed')) problems.push('PYM/FIFA lead must carry exact unconfirmed qualification');
if (!exists('polymythseminars/watchlist.json')) problems.push('polymythseminars/watchlist.json compatibility file is missing');
if (problems.length) {
  console.error('POLYMYTHCAL SCRAPER/LAYOUT CHECK FAILED');
  for (const p of problems) console.error(' - ' + p);
  process.exit(1);
}
console.log('POLYMYTHCAL SCRAPER/LAYOUT CHECK PASSED — Find a Protest, qualified uncertainty, topic search, and front-facing quick filters are guarded.');
