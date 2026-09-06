#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {resolveSiteBuildDate} = require('./polymythcal-build-date');

const ROOT = path.resolve(__dirname, '..');
const EVENT_PATH = path.join(ROOT, 'polymythseminars', 'events.json');
const BROWSE_PATH = path.join(ROOT, 'polymythseminars', 'browse.json');
const SURFACES_PATH = path.join(ROOT, 'data', 'polymythcal-publication-surfaces.json');
const FEATURED_PATH = path.join(ROOT, 'polymythseminars', 'featured.json');
const PUBLIC_FEATURED_PATH = path.join(ROOT, 'public', 'polymythseminars', 'featured.json');
const ABOUT_PATH = path.join(ROOT, 'about', 'index.html');
const FIELDS = [
  'id', 'date', 'title', 'speaker_or_director', 'venue',
  'destination_url', 'destination_status', 'destination_scope',
  'destination_kind', 'destination_evidence',
];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function torontoDay(value) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

const failures = [];
let eventsDoc;
let browse;
let surfaces;
let featured;
try {
  eventsDoc = readJson(EVENT_PATH);
  browse = readJson(BROWSE_PATH);
  surfaces = readJson(SURFACES_PATH);
  featured = readJson(FEATURED_PATH);
} catch (error) {
  console.error(`POLYMYTHCAL FEATURED FEED CHECK FAILED\n - ${error.message}`);
  process.exit(1);
}

const buildDay = resolveSiteBuildDate({root: ROOT});
const codepointCompare = (a, b) => {
  const left = String(a || '');
  const right = String(b || '');
  return left < right ? -1 : left > right ? 1 : 0;
};
const canonicalEvents = Array.isArray(eventsDoc.events) ? eventsDoc.events : [];
const canonicalIds = canonicalEvents.map(event => String(event.id || ''));
const chronologyIds = Array.isArray(surfaces.chronology_ids) ? surfaces.chronology_ids.map(String) : [];
const watchlistIds = Array.isArray(surfaces.watchlist_ids) ? surfaces.watchlist_ids.map(String) : [];
const browseIds = Array.isArray(browse.events) ? browse.events.map(event => String(event.id || '')) : [];
const chronologyIdSet = new Set(chronologyIds);
const watchlistIdSet = new Set(watchlistIds);

if (surfaces._schema !== 'polymythcal-publication-surfaces-v2') {
  failures.push('publication surfaces do not use the current chronology/watchlist contract');
}
if (browse._schema !== 'polymythcal-discovery-v2') {
  failures.push('browse.json is not the current chronology projection');
}
if (chronologyIdSet.size !== chronologyIds.length || watchlistIdSet.size !== watchlistIds.length) {
  failures.push('publication surfaces contain duplicate IDs');
}
if (chronologyIds.some(id => watchlistIdSet.has(id))) {
  failures.push('chronology and watchlist publication surfaces overlap');
}
if (
  canonicalIds.length !== chronologyIds.length + watchlistIds.length
  || canonicalIds.some(id => !chronologyIdSet.has(id) && !watchlistIdSet.has(id))
) {
  failures.push('chronology and watchlist do not form the complete canonical partition');
}
if (JSON.stringify(browseIds) !== JSON.stringify(chronologyIds)) {
  failures.push('browse chronology IDs differ from the publication surface contract');
}

const expected = canonicalEvents
  .filter(event => chronologyIdSet.has(String(event.id || '')))
  .sort((a, b) => codepointCompare(a.date, b.date) || codepointCompare(a.title, b.title))
  .filter(event => /^\d{4}-\d{2}-\d{2}/.test(String(event.date || '')) && String(event.date).slice(0, 10) >= buildDay)
  .slice(0, 64)
  .map(event => Object.fromEntries(FIELDS.filter(key => event[key] !== null && event[key] !== undefined && event[key] !== '').map(key => [key, event[key]])));

if (featured.count !== expected.length || !Array.isArray(featured.events) || featured.events.length !== expected.length) {
  failures.push(`declared/actual count does not match expected ${expected.length}`);
}
if (JSON.stringify(featured.events || []) !== JSON.stringify(expected)) {
  failures.push('featured events are not the exact next chronology subset');
}
if ((featured.events || []).some(event => watchlistIdSet.has(String(event.id || '')))) {
  failures.push('featured feed contains a watchlist monitoring marker');
}
const featuredMoment = new Date(featured.generated_at);
const featuredHour = Number.isNaN(featuredMoment.getTime())
  ? ''
  : new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Toronto',
      hour: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(featuredMoment).find(part => part.type === 'hour')?.value;
if (
  Number.isNaN(featuredMoment.getTime())
  || torontoDay(featuredMoment) !== buildDay
  || featuredHour !== '12'
) {
  failures.push('generated_at is not the deterministic noon marker for the site build date');
}
if (!fs.existsSync(PUBLIC_FEATURED_PATH) || !fs.readFileSync(FEATURED_PATH).equals(fs.readFileSync(PUBLIC_FEATURED_PATH))) {
  failures.push('public featured feed is missing or differs from its source');
}
if (fs.statSync(FEATURED_PATH).size >= fs.statSync(EVENT_PATH).size) {
  failures.push('featured feed is not compact relative to the full event corpus');
}
if ((featured.events || []).some(event => Object.prototype.hasOwnProperty.call(event, 'source_url'))) {
  failures.push('featured feed exposes raw source_url instead of the destination contract');
}
const aboutSource = fs.readFileSync(ABOUT_PATH, 'utf8');
if (aboutSource.includes('e.source_url')) {
  failures.push('About teaser still uses raw source_url in visitor-facing rendering');
}
if (!aboutSource.includes("var detailsUrl = '/polymythseminars/events/' + encodeURIComponent(String(e.id)) + '/';")) {
  failures.push('About teaser title links are not built from internal event Details routes');
}
if (!aboutSource.includes("'<div class=\"title\"><a href=\"' + escapeHtml(detailsUrl) + '\">'")) {
  failures.push('About teaser title CTA is not the internal Details link');
}

if (failures.length) {
  console.error('POLYMYTHCAL FEATURED FEED CHECK FAILED');
  failures.forEach(failure => console.error(` - ${failure}`));
  process.exit(1);
}
console.log(`POLYMYTHCAL FEATURED FEED CHECK PASSED — ${expected.length} chronology-only upcoming records from ${buildDay}, build-date-aligned, watchlist-free, and public-identical.`);
