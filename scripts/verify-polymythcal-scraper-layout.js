#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const problems = [];
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const need = (relative, token, label = token) => { if (!read(relative).includes(token)) problems.push(`${relative} missing ${label}`); };
const forbid = (relative, expression, label) => { if (expression.test(read(relative))) problems.push(`${relative} still contains ${label}`); };

for (const [relative, token, label] of [
  ['scripts/sources.json', 'findaprotest-toronto', 'Find a Protest source id'],
  ['scripts/sources.json', 'https://www.findaprotest.info/canada/toronto', 'Find a Protest Toronto URL'],
  ['scripts/scrape_seminars.py', 'def fetch_findaprotest_toronto', 'deterministic Find a Protest fetcher'],
  ['scripts/scrape_seminars.py', 'def fetch_generic_event_source', 'generic HTML source fetcher'],
  ['scripts/scrape_seminars.py', 'event-watchlist.json', 'internal review watchlist output'],
  ['scripts/scrape_seminars.py', 'extract_topics', 'topic extraction'],
  ['scripts/merge_and_finalize.py', 'WATCHLIST_PUBLIC_PATH', 'watchlist projection target'],
  ['scripts/sync-calendar-data.js', 'WATCHLIST_PUBLIC', 'watchlist sync'],
  ['scripts/verify-harvest-pipeline.js', 'findaprotest-toronto', 'harvest source guard'],
  ['scripts/build-polymythcal-browser-payload.js', 'polymythcal-publication-surfaces.json', 'publication-boundary input'],
  ['scripts/lib/polymythcal-discovery-model.js', 'polymythcal-discovery-v2', 'chronology schema'],
  ['scripts/lib/polymythcal-discovery-model.js', 'polymythcal-watchlist-v2', 'monitoring schema'],
]) need(relative, token, label);

const shellSpecs = [
  ['polymythseminars/index.html', 'main', '/polymythseminars/browse.json'],
  ['polymythseminars/fr/index.html', 'main', '/polymythseminars/browse.json'],
  ['polymythseminars/research/index.html', 'research', '/polymythseminars/browse.json'],
  ['polymythseminars/fr/research/index.html', 'research', '/polymythseminars/browse.json'],
  ['polymythseminars/monitoring/index.html', 'monitoring', '/polymythseminars/watchlist.json'],
  ['polymythseminars/fr/monitoring/index.html', 'monitoring', '/polymythseminars/watchlist.json'],
];
for (const [relative, surface, source] of shellSpecs) {
  const html = read(relative);
  for (const [token, label] of [
    [`data-pmd-surface="${surface}"`, `${surface} surface`],
    [`data-pmd-source="${source}"`, 'correct projection'],
    ['id="pmdSearch"', 'primary search'],
    ['id="pmdSearchStatus"', 'search live status'],
    ['id="pmdResults"', 'results region'],
    ['id="pmdResultsTitle" tabindex="-1"', 'focusable results heading'],
    ['id="pmdSelected"', 'selected-filter summary'],
    ['id="pmdPagination"', 'pagination mount'],
    ['/js/polymythcal-discovery.js', 'shared discovery controller'],
    ['/css/polymythcal-discovery.css', 'shared discovery layout'],
  ]) if (!html.includes(token)) problems.push(`${relative} missing ${label}`);
  if ((html.match(/id="pmdSearch"/g) || []).length !== 1) problems.push(`${relative} must contain one search field`);
  if (Buffer.byteLength(html, 'utf8') >= 100000) problems.push(`${relative} exceeds 100 KB`);
  if (surface !== 'research') {
    if (!html.includes('id="pmdFilterDrawer"')) problems.push(`${relative} missing collapsed filter drawer`);
    if (/<details[^>]*id="pmdFilterDrawer"[^>]*\sopen(?:\s|=|>)/i.test(html)) problems.push(`${relative} filter drawer starts open`);
  }
  if (surface === 'research' && !html.includes('id="pmdFacetSearch"')) problems.push(`${relative} missing filter finder`);
  if (surface === 'monitoring' && html.includes('id="pmdCalendar"')) problems.push(`${relative} exposes false calendar dates`);
  if (surface !== 'monitoring' && !html.includes('id="pmdCalendar"')) problems.push(`${relative} lacks its calendar/list mount`);
  if (/id="(?:eventSearch|pmQuickStarts|pmJumpResults|eventsContainer|watchlistPanel)"|data-preset=/.test(html)) problems.push(`${relative} restores redundant legacy controls`);
}

const main = read('polymythseminars/index.html');
const order = ['id="pmdSearch"', 'class="pmd-popular"', 'id="pmdFilterDrawer"', 'id="pmdResults"'].map(token => main.indexOf(token));
if (order.some(index => index < 0) || order.some((index, position) => position && index <= order[position - 1])) problems.push('main hierarchy is not search-first and results-oriented');
if (!/<div id="pmdCommonFilters"[^>]*><\/div>/.test(main)) problems.push('main embeds a pre-rendered filter wall');
const research = read('polymythseminars/research/index.html');
if (!/<div id="pmdResearchFilters"[^>]*><\/div>/.test(research)) problems.push('Research embeds every specialist control before interaction');

const app = read('js/polymythcal-discovery.js');
for (const [token, label] of [
  ['const PAGE_SIZE = 24', '24-group pages'],
  ["const COMMON_AXES = Object.freeze(['kind', 'date', 'places', 'topics', 'audiences', 'formats'])", 'bounded common facets'],
  ['const RESEARCH_ORDER', 'separate Research taxonomy'],
  ['function optionCount(key, value)', 'exact facet counts'],
  ["if (count === 0 && !checked) return ''", 'zero-option suppression'],
  ['function buildResultGroups(list)', 'series grouping'],
  ['function renderPagination(totalPages)', 'numbered pagination'],
  ['function routeMatches(event)', 'focused route restriction'],
  ['const defaultContent = document.body.dataset.pmDefaultContent', 'focused-route default kind'],
  ['state.kindExplicitAll', 'focused-route all override'],
  ['routeScope', 'focused-route Research handoff'],
  ['class="pmd-match-reason"', 'match explanation'],
  ['function eventActions(event)', 'destination action policy'],
  ["if (surface !== 'monitoring') actions.push", 'monitoring detail-link quarantine'],
]) if (!app.includes(token)) problems.push(`discovery controller missing ${label}`);
if ((app.match(/function searchMatch\(/g) || []).length !== 1) problems.push('discovery controller must define searchMatch exactly once');
if ((app.match(/function applyFiltersAndSort\(/g) || []).length !== 1) problems.push('discovery controller must define the result pipeline exactly once');

const css = read('css/polymythcal-discovery.css');
for (const [expression, label] of [
  [/\.pmd-shell\s*\{[^}]*width:\s*min\(74rem,\s*calc\(100%\s*-\s*2rem\)\)/s, 'bounded readable shell'],
  [/\.pmd-filter-grid\s*\{[^}]*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s, 'two-column desktop common filters'],
  [/\.pmd-option\s*\{[^}]*min-height:\s*44px/s, '44px filter targets'],
  [/\.pmd-card,\s*\.pmd-series-card\s*\{[^}]*grid-template-columns:\s*7rem\s+minmax\(0,\s*1fr\)/s, 'scannable desktop cards'],
  [/@media \(max-width:\s*47\.5rem\)[\s\S]*?\.pmd-filter-grid\s*\{\s*grid-template-columns:\s*1fr;/s, 'single-column mobile filters'],
  [/@media \(max-width:\s*47\.5rem\)[\s\S]*?\.pmd-card\s*\{\s*grid-template-columns:\s*1fr;/s, 'single-column mobile cards'],
  [/@media \(max-width:\s*47\.5rem\)[\s\S]*?\.pmd-calendar-agenda\s*\{\s*display:\s*block;/s, 'mobile agenda'],
]) if (!expression.test(css)) problems.push(`discovery CSS missing ${label}`);

const browse = JSON.parse(read('polymythseminars/browse.json'));
const watchlist = JSON.parse(read('polymythseminars/watchlist.json'));
const chronology = Array.isArray(browse.events) ? browse.events : [];
const monitored = Array.isArray(watchlist.items) ? watchlist.items : [];
if (!chronology.length || !monitored.length) problems.push('chronology and monitoring projections must both be non-empty');
if (chronology.some(item => Object.hasOwn(item, 'raw_excerpt'))) problems.push('chronology projection leaks raw excerpts');
if (monitored.some(item => Object.hasOwn(item, 'date') || Object.hasOwn(item, 'end_date'))) problems.push('monitoring projection leaks marker dates');
const overlap = new Set(chronology.map(item => item.id));
if (monitored.some(item => overlap.has(item.id))) problems.push('chronology and monitoring projections overlap');

forbid('polymythseminars/index.html', /Thank You Ma’am Teaching Activities as a static collection page/, 'unrelated resource copy');
try { require('child_process').execFileSync(process.execPath, ['--check', path.join(ROOT, 'js/polymythcal-discovery.js')], {stdio: 'pipe'}); }
catch (_) { problems.push('js/polymythcal-discovery.js fails node --check'); }

if (problems.length) {
  console.error('POLYMYTHCAL SCRAPER/LAYOUT CHECK FAILED');
  problems.forEach(problem => console.error(` - ${problem}`));
  process.exit(1);
}
console.log(`POLYMYTHCAL SCRAPER/LAYOUT CHECK PASSED — search-first compact layout, staged Research, separate monitoring, ${chronology.length} chronology records, and ${monitored.length} quarantined markers are guarded.`);

