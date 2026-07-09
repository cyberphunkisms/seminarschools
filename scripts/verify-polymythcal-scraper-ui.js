#!/usr/bin/env node
'use strict';
/* Guard for Polymythcal source recall + public calendar interaction. */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const problems = [];
function read(rel) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) { problems.push(`${rel} is missing`); return ''; }
  return fs.readFileSync(p, 'utf8');
}
function need(rel, needle) {
  const text = read(rel);
  if (!text.includes(needle)) problems.push(`${rel} must contain ${needle}`);
}
function readJson(rel) {
  const text = read(rel);
  if (!text) return null;
  try { return JSON.parse(text); } catch (e) { problems.push(`${rel} is not valid JSON: ${e.message}`); return null; }
}

const sources = read('scripts/sources.json');
for (const needle of ['findaprotest-toronto', 'https://www.findaprotest.info/canada/toronto', 'Save-the-date/TBD listings go to the watchlist']) {
  if (!sources.includes(needle)) problems.push(`scripts/sources.json must keep ${needle}`);
}

const scraper = read('scripts/scrape_seminars.py');
for (const needle of [
  'WATCHLIST_PATH',
  'TOPIC_KEYWORDS',
  'TYPE_HINTS',
  'PUBLIC_TYPES',
  'def extract_topics',
  'def classify_event_type',
  'def normalize_record',
  'def provisional_status',
  'def fetch_findaprotest_toronto',
  'needs-time-place',
  'event-watchlist.json',
  'existing leads persist until confirmed or published',
  'timedelta',
]) {
  if (!scraper.includes(needle)) problems.push(`scripts/scrape_seminars.py must keep ${needle}`);
}

const merger = read('scripts/merge_and_finalize.py');
for (const needle of ['WATCHLIST_PUBLIC_PATH', 'polymythseminars', 'watchlist.json', 'watchlist only: not published as calendar events until time/place is confirmed', 'existing leads persist until confirmed or published']) {
  if (!merger.includes(needle)) problems.push(`scripts/merge_and_finalize.py must keep ${needle}`);
}

const prompt = read('scripts/seminars-prompt.md');
for (const needle of ['Find a Protest source rule', 'watchlist', 'FIFA', 'football', 'Palestine', 'Human Rights', 'time/place']) {
  if (!prompt.includes(needle)) problems.push(`scripts/seminars-prompt.md must keep ${needle}`);
}

const schema = read('data/seminars-schema.json');
for (const needle of ['"topics"', '"status"', '"date_text"', '"time_text"', '"location_text"']) {
  if (!schema.includes(needle)) problems.push(`data/seminars-schema.json must keep ${needle}`);
}

const POLYMYTHCAL_PAGES = [
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
  'fellowships/index.html',
];
for (const rel of POLYMYTHCAL_PAGES) {
  const page = read(rel);
  for (const needle of [
    'calendarSearch',
    'quickFocusNav',
    'watchlistPanel',
    'Leads needing details',
    'watchlist-fallback',
    'fetchWatchlistWithFallback',
    'getFilteredLeads',
    'matchesSearch',
    'focusMatches',
    'topic-tag',
    'Source-confirmed leads stay here until time and place are confirmed',
    'Pick a filter',
  ]) {
    if (!page.includes(needle)) problems.push(`${rel} must keep ${needle}`);
  }
}
const page = read('polymythseminars/index.html');

const watchlist = readJson('data/event-watchlist.json');
const publicWatchlist = readJson('polymythseminars/watchlist.json');
for (const [rel, obj] of [['data/event-watchlist.json', watchlist], ['polymythseminars/watchlist.json', publicWatchlist]]) {
  if (!obj) continue;
  const items = Array.isArray(obj.items) ? obj.items : [];
  const event = items.find(item => String(item.title || '').toLowerCase().includes('palestinian football exhibit'));
  if (!event) { problems.push(`${rel} must keep Palestinian Football Exhibit as a watchlist lead`); continue; }
  const joined = JSON.stringify(event);
  for (const needle of ['PYM Toronto', 'FIFA', 'football', 'Palestine', 'Human Rights', 'needs-time-place', 'TBD']) {
    if (!joined.includes(needle)) problems.push(`${rel} Palestinian Football Exhibit must keep ${needle}`);
  }
}

if (page.includes('Thank You Ma’am Teaching Activities as a static collection page')) {
  problems.push('polymythseminars/index.html leaked unrelated non-front-facing resource language.');
}

if (problems.length) {
  console.error('POLYMYTHCAL SCRAPER/UI GUARD FAILED\n- ' + problems.join('\n- '));
  process.exit(1);
}
console.log('POLYMYTHCAL SCRAPER/UI OK — source recall, watchlist, topics, search, and lead UI guarded.');
