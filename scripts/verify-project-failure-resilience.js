#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {execFileSync} = require('child_process');
const {loadInventoryContract} = require('./lib/polymythcal-inventory-contract');

const ROOT = path.resolve(__dirname, '..');
const inventory = loadInventoryContract(ROOT);
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const parse = relative => JSON.parse(read(relative));
const discovery = read('js/polymythcal-discovery.js');
const teacher = read('teacherresources/finder.js');
const browse = parse('polymythseminars/browse.json');
const watchlist = parse('polymythseminars/watchlist.json');
const surfaces = parse('data/polymythcal-publication-surfaces.json');
const buildManifest = parse('data/polymythcal-build-manifest.json');
const resources = parse('teacherresources/resources-data.json');
const browserStress = read('scripts/audit-project-failure-stress.py');
const failures = [];

function requireText(source, token, label = token) {
  if (!source.includes(token)) failures.push(`missing ${label}`);
}
function requirePattern(source, expression, label) {
  if (!expression.test(source)) failures.push(`missing ${label}`);
}
function forbid(source, expression, label) {
  if (expression.test(source)) failures.push(label);
}

const chronology = Array.isArray(browse.events) ? browse.events : [];
const monitored = Array.isArray(watchlist.items) ? watchlist.items : [];
const combined = [...chronology, ...monitored];
const ids = combined.map(item => item.id);
if (combined.length < inventory.minimum_canonical_events) failures.push(`Polymythcal inventory fell below ${inventory.minimum_canonical_events}: ${combined.length}`);
if (new Set(ids).size !== ids.length) failures.push('chronology and monitoring IDs are not globally unique');
if (chronology.length !== browse.count || monitored.length !== watchlist.count) failures.push('projection count metadata is inconsistent');
if (surfaces.canonical_count !== combined.length || surfaces.chronology_count !== chronology.length || surfaces.watchlist_count !== monitored.length) failures.push('publication manifest counts are inconsistent');
if (new Set(chronology.map(item => item.type)).size < inventory.minimum_event_types) failures.push(`chronology type inventory fell below ${inventory.minimum_event_types}`);
if (!Number.isInteger(buildManifest.source_count) || buildManifest.source_count < inventory.minimum_sources) failures.push(`source inventory fell below ${inventory.minimum_sources}`);
if (buildManifest.chronology_count !== chronology.length || buildManifest.monitoring_count !== monitored.length || buildManifest.record_count !== combined.length) failures.push('build manifest does not retain the discovery-v2 partition');

for (const item of chronology) {
  if (!item.date) failures.push(`chronology ${item.id} has no date`);
  if (!item.facets || typeof item.facets !== 'object' || Array.isArray(item.facets)) failures.push(`chronology ${item.id} has no safe facets`);
}
for (const item of monitored) {
  if (Object.hasOwn(item, 'date') || Object.hasOwn(item, 'end_date')) failures.push(`monitoring ${item.id} leaks a date`);
  if (item.date_status !== 'awaiting-confirmed-date') failures.push(`monitoring ${item.id} lacks its honest date status`);
}

for (const [token, label] of [
  ['window.__polymythcalDiscoveryMounted', 'discovery idempotent mount guard'],
  ['const FETCH_TIMEOUT_MS = 12000', 'bounded 12-second request timeout'],
  ['const FETCH_ATTEMPTS = 2', 'bounded two-attempt retry'],
  ['function validatePayload(candidate)', 'payload validator'],
  ["const expectedSchema = surface === 'monitoring' ? 'polymythcal-watchlist-v2' : 'polymythcal-discovery-v2'", 'surface-specific schema validation'],
  ["if (!id || seen.has(id)) throw new Error", 'empty/duplicate ID rejection'],
  ['candidate.count', 'declared-count validation'],
  ['collection.length', 'dynamic collection-count validation'],
  ['Array.isArray(values)', 'facet-array validation'],
  ['function validCalendarDay(value)', 'strict calendar-date validation'],
  ["item.end_date", 'end-date validation'],
  ['async function fetchPayload(generation)', 'bounded fetch controller'],
  ['for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt += 1)', 'bounded retry loop'],
  ['const controller = new AbortController()', 'per-attempt abort controller'],
  ['window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)', 'request timeout abort'],
  ["cache: 'default'", 'bounded HTTP cache reuse'],
  ['if (!response.ok) throw new Error', 'HTTP failure rejection'],
  ['activeFetchController?.abort()', 'superseded/navigation abort'],
  ["window.addEventListener('pagehide'", 'interrupted-navigation cleanup'],
  ["window.addEventListener('pageshow'", 'back-forward cache recovery'],
  ['pageIsHiding = false', 'back-forward abort-lock reset'],
  ['let loadFailed = false', 'explicit failed-load state'],
  ['if (loadFailed) return', 'failed-load stale-render lock'],
  ['events = [];', 'failed-load stale-event clearing'],
  ['resultGroups = [];', 'failed-load stale-group clearing'],
  ['id="pmdRetry"', 'visible in-place retry control'],
  ["results?.setAttribute('aria-busy', 'true')", 'accessible loading restart'],
  ["results.setAttribute('aria-busy', 'false')", 'accessible failure completion'],
  ["window.addEventListener('popstate'", 'URL history recovery'],
]) requireText(discovery, token, label);
requirePattern(discovery, /function parseDate\([\s\S]*?^  }/m, 'date parser');
requirePattern(discovery, /function validatePayload\([\s\S]*?candidate\.count[^\n]*collection\.length|function validatePayload\([\s\S]*?collection\.length[^\n]*candidate\.count/s, 'count equality check inside payload validation');
requirePattern(discovery, /function validatePayload\([\s\S]*?Object\.entries\(item\.facets\)[\s\S]*?Array\.isArray\(values\)/s, 'facet arrays checked inside payload validation');
requirePattern(discovery, /function validatePayload\([\s\S]*?validCalendarDay\(item\.date[\s\S]*?validCalendarDay\(item\.end_date/s, 'strict start/end dates checked inside payload validation');

forbid(discovery, /setInterval\s*\(/, 'Polymythcal introduced an unbounded polling loop');
forbid(discovery, /while\s*\(\s*true\s*\)/, 'Polymythcal introduced an unbounded loop');
forbid(teacher, /setInterval\s*\(/, 'Teacher Resources introduced an unbounded polling loop');

for (const [relative, lang, source] of [
  ['polymythseminars/index.html', 'en-CA', '/polymythseminars/browse.json'],
  ['polymythseminars/fr/index.html', 'fr-CA', '/polymythseminars/browse.json'],
  ['polymythseminars/research/index.html', 'en-CA', '/polymythseminars/browse.json'],
  ['polymythseminars/fr/research/index.html', 'fr-CA', '/polymythseminars/browse.json'],
  ['polymythseminars/monitoring/index.html', 'en-CA', '/polymythseminars/watchlist.json'],
  ['polymythseminars/fr/monitoring/index.html', 'fr-CA', '/polymythseminars/watchlist.json'],
]) {
  const html = read(relative);
  requirePattern(html, new RegExp(`<html\\b[^>]*lang=["']${lang}["']`, 'i'), `${relative} language`);
  requireText(html, `data-pmd-source="${source}"`, `${relative} data authority`);
  requireText(html, 'id="pmdResults" aria-busy="true"', `${relative} initial busy state`);
  requireText(html, 'id="pmdLiveStatus" class="pmd-live-status" role="status" aria-live="polite"', `${relative} polite live region`);
  requireText(html, '<noscript>', `${relative} no-script escape`);
}

for (const [token, label] of [
  ['window.__ssTeacherResourcesFinderMounted', 'Teacher finder idempotent mount guard'],
  ["var LEGACY_FILTER_STORAGE_KEYS = ['tr-filters-v4', 'tr-filters-v3', 'tr-filters-v2']", 'Teacher legacy-state migration list'],
  ['localStorage.removeItem(key)', 'Teacher legacy-state cleanup'],
  ["controls.dataset.persistence = 'url-only'", 'Teacher URL-only filter authority'],
  ['function buildStateUrl()', 'Teacher share URL builder'],
  ['function restoreState()', 'Teacher URL restoration'],
  ['applyFilters({ skipSave: true })', 'Teacher read-only navigation restoration'],
  ['function scheduleExpandLabel()', 'Teacher coalesced expand updates'],
  ["catalog.addEventListener('toggle', scheduleExpandLabel, true)", 'Teacher coalesced toggle listener'],
  ['function flushSearchAndApply(options)', 'Teacher pending-search flush'],
  ["window.addEventListener('pagehide'", 'Teacher interrupted-navigation cleanup'],
  ["window.addEventListener('pageshow'", 'Teacher back-forward cache recovery'],
]) requireText(teacher, token, label);
requireText(browserStress, "date: '2026-13-99'", 'impossible-date stress coverage');
requireText(browserStress, 'test_polymyth_timeout_and_retry_button', 'timeout/retry browser stress coverage');

const resourceEntries = (resources.groups || []).flatMap(group => (group.categories || []).flatMap(category => category.entries || []));
const resourceCollections = (resources.groups || []).reduce((total, group) => total + (group.categories || []).length, 0);
if (resourceEntries.length !== 645) failures.push(`Teacher Resources inventory changed: ${resourceEntries.length}/645`);
if ((resources.groups || []).length !== 7) failures.push(`Teacher Resources group inventory changed: ${(resources.groups || []).length}/7`);
if (resourceCollections !== 25) failures.push(`Teacher Resources collection inventory changed: ${resourceCollections}/25`);

for (const relative of ['js/polymythcal-discovery.js', 'teacherresources/finder.js']) {
  try { execFileSync(process.execPath, ['--check', path.join(ROOT, relative)], {stdio: 'pipe'}); }
  catch (_) { failures.push(`${relative} fails node --check`); }
}

if (failures.length) {
  console.error('PROJECT FAILURE RESILIENCE CHECK FAILED');
  failures.slice(0, 200).forEach(failure => console.error(` - ${failure}`));
  if (failures.length > 200) console.error(` - … ${failures.length - 200} more`);
  process.exit(1);
}
console.log(`PROJECT FAILURE RESILIENCE CHECK PASSED — bounded retry/timeout/abort, strict payload/date/facet validation, accessible recovery, ${chronology.length}+${monitored.length} split listings, ${buildManifest.source_count} sources, and 645/25/7 Teacher inventory preserved.`);

