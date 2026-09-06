#!/usr/bin/env node
'use strict';

/* Guard source recall, discovery-v2 projections, and the dated/monitoring UI boundary. */
const fs = require('fs');
const path = require('path');
const {loadInventoryContract} = require('./lib/polymythcal-inventory-contract');
const {
  PUBLIC_EVENT_KEYS,
  PUBLIC_WATCHLIST_KEYS,
  PERSISTED_SEARCH_GROUPS,
  TEMPORAL_TYPES,
} = require('./lib/polymythcal-discovery-model');

const ROOT = path.resolve(__dirname, '..');
const inventory = loadInventoryContract(ROOT);
const problems = [];
function read(relative) {
  const absolute = path.join(ROOT, relative);
  if (!fs.existsSync(absolute)) { problems.push(`${relative} is missing`); return ''; }
  return fs.readFileSync(absolute, 'utf8');
}
function json(relative) {
  const text = read(relative);
  try { return JSON.parse(text); }
  catch (error) { problems.push(`${relative} is not valid JSON: ${error.message}`); return {}; }
}
function need(relative, token, label = token) {
  if (!read(relative).includes(token)) problems.push(`${relative} must retain ${label}`);
}

for (const token of ['findaprotest-toronto', 'https://www.findaprotest.info/canada/toronto']) need('scripts/sources.json', token);
for (const token of [
  'WATCHLIST_PATH', 'TOPIC_KEYWORDS', 'TYPE_HINTS', 'PUBLIC_TYPES', 'def extract_topics',
  'def classify_event_type', 'def normalize_record', 'def provisional_status',
  'def fetch_findaprotest_toronto', 'needs-time-place', 'event-watchlist.json',
  'confirmation_status', 'qualification_reasons', 'timedelta',
]) need('scripts/scrape_seminars.py', token);
for (const token of ['WATCHLIST_PATH', 'data', 'event-watchlist.json', 'DETERMINISTIC_PROTEST_PATH', 'DETERMINISTIC_STRUCTURED_PATH']) need('scripts/merge_and_finalize.py', token);
if (/WATCHLIST_PUBLIC_PATH|polymythseminars["']?\s*\/\s*["']watchlist\.json/.test(read('scripts/merge_and_finalize.py'))) problems.push('merge_and_finalize.py must not write the public Discovery watchlist projection');
for (const token of ['WATCHLIST_PATH', 'buildDiscoveryPayloads']) need('scripts/build-polymythcal-browser-payload.js', token, 'exclusive public watchlist projection owner');
for (const token of ['Find a Protest source rule', 'qualification_reasons', 'FIFA', 'football', 'Palestine', 'Human Rights', 'time-unconfirmed', 'location-unconfirmed', 'aggregator-only']) need('scripts/seminars-prompt.md', token);
for (const token of ['"topics"', '"status"', '"date_text"', '"time_text"', '"location_text"']) need('data/seminars-schema.json', token);

const canonical = json('polymythseminars/events.json');
const browse = json('polymythseminars/browse.json');
const watchlist = json('polymythseminars/watchlist.json');
const surfaces = json('data/polymythcal-publication-surfaces.json');
const canonicalItems = Array.isArray(canonical.events) ? canonical.events : [];
const chronologyItems = Array.isArray(browse.events) ? browse.events : [];
const monitoredItems = Array.isArray(watchlist.items) ? watchlist.items : [];

if (canonicalItems.length < inventory.minimum_canonical_events) problems.push(`canonical inventory fell below ${inventory.minimum_canonical_events}: ${canonicalItems.length}`);
if ((browse._schema || browse.schema) !== 'polymythcal-discovery-v2') problems.push('browse.json must use polymythcal-discovery-v2');
if ((watchlist._schema || watchlist.schema) !== 'polymythcal-watchlist-v2') problems.push('watchlist.json must use polymythcal-watchlist-v2');
if (browse.count !== chronologyItems.length) problems.push('browse chronology count is inconsistent');
if (watchlist.count !== monitoredItems.length) problems.push('monitoring count is inconsistent');
if (chronologyItems.length + monitoredItems.length !== canonicalItems.length) problems.push('chronology and monitoring projections do not account for the canonical inventory');

const chronologyIds = new Set(chronologyItems.map(item => item.id));
const monitoredIds = new Set(monitoredItems.map(item => item.id));
if (chronologyIds.size !== chronologyItems.length) problems.push('chronology projection contains duplicate IDs');
if (monitoredIds.size !== monitoredItems.length) problems.push('monitoring projection contains duplicate IDs');
const overlap = [...chronologyIds].filter(id => monitoredIds.has(id));
if (overlap.length) problems.push(`chronology and monitoring projections overlap: ${overlap.slice(0, 8).join(', ')}`);
const canonicalIds = new Set(canonicalItems.map(item => item.id));
if ([...canonicalIds].some(id => !chronologyIds.has(id) && !monitoredIds.has(id))) problems.push('at least one canonical ID is missing from both public projections');
if (surfaces.chronology_count !== chronologyItems.length || surfaces.watchlist_count !== monitoredItems.length || surfaces.canonical_count !== canonicalItems.length) problems.push('publication-surface counts do not match their payloads');
const exactReason = 'Displayed date is a monitoring marker, not a confirmed event or deadline date.';
for (const id of monitoredIds) {
  const reason = surfaces.reasons?.[id];
  if (reason?.code !== 'monitoring-marker' || reason?.detail !== exactReason) problems.push(`${id} lacks the exact monitoring-marker reason`);
}

const allowedChronology = new Set(PUBLIC_EVENT_KEYS);
const allowedMonitoring = new Set(PUBLIC_WATCHLIST_KEYS);
const canonicalById = new Map(canonicalItems.map(item => [String(item.id || ''), item]));
const privateRawFields = new Set([
  'raw_excerpt', 'qualification_reasons', 'presence_claims', 'eligibility_rules',
  'community_heritage_formats', 'live_digital_formats', 'course_program_formats',
  'source_url', 'source_name', 'destination_url', 'destination_status',
  'destination_scope', 'destination_kind', 'registration_url', 'application_url',
  'submission_url', 'rules_url', 'ticket_url', 'tickets_url', 'stream_url',
  'livestream_url', 'watch_url',
]);
for (const [name, items, allowed] of [['chronology', chronologyItems, allowedChronology], ['monitoring', monitoredItems, allowedMonitoring]]) {
  for (const item of items) {
    const extra = Object.keys(item).filter(key => !allowed.has(key));
    if (extra.length) problems.push(`${name} ${item.id} exposes non-allowlisted fields: ${extra.join(', ')}`);
    for (const key of privateRawFields) if (Object.hasOwn(item, key)) problems.push(`${name} ${item.id} exposes private raw field ${key}`);
    if (item.route !== `/polymythseminars/events/${encodeURIComponent(String(item.id || ''))}/`) problems.push(`${name} ${item.id} has no exact stable internal route`);
    const actions = Array.isArray(item.actions) ? item.actions : [];
    const detailActions = actions.filter(action => action?.kind === 'details');
    const externalActions = actions.filter(action => /^https:\/\//.test(String(action?.url || '')));
    if (detailActions.length !== 1 || detailActions[0].url !== item.route || detailActions[0].scope !== 'listing') problems.push(`${name} ${item.id} lacks exactly one stable internal details action`);
    if (externalActions.length > 1) problems.push(`${name} ${item.id} exposes more than one external action`);
    const canonical = canonicalById.get(String(item.id || ''));
    const expectedExternal = canonical?.destination_url && canonical.destination_status !== 'unavailable-specific-page'
      ? String(canonical.destination_url) : '';
    if ((externalActions[0]?.url || '') !== expectedExternal) problems.push(`${name} ${item.id} external action bypasses the materialized exact destination`);
    if (!item.facets || typeof item.facets !== 'object' || Array.isArray(item.facets)) problems.push(`${name} ${item.id} lacks its safe facet projection`);
    const searchKeys = Object.keys(item.search || {}).sort();
    if (searchKeys.join(',') !== [...PERSISTED_SEARCH_GROUPS].sort().join(',')) problems.push(`${name} ${item.id} persists search fields outside the controlled bilingual groups: ${searchKeys.join(',')}`);
    if (!TEMPORAL_TYPES.includes(item.temporal?.type)) problems.push(`${name} ${item.id} has no controlled temporal projection`);
  }
}
for (const item of monitoredItems) {
  if (Object.hasOwn(item, 'date') || Object.hasOwn(item, 'end_date') || Object.hasOwn(item, 'date_precision') || Object.hasOwn(item, 'time_precision')) problems.push(`monitoring ${item.id} exposes a calendar date or clock`);
  if (item.date_status !== 'awaiting-confirmed-date') problems.push(`monitoring ${item.id} lacks awaiting-confirmed-date status`);
}

let missingChronologyDetails = 0;
let missingMonitoringDetails = 0;
let invalidMonitoringDetails = 0;
for (const id of chronologyIds) {
  if (!fs.existsSync(path.join(ROOT, 'polymythseminars', 'events', id, 'index.html'))) missingChronologyDetails += 1;
  if (!fs.existsSync(path.join(ROOT, 'polymythseminars', 'fr', 'events', id, 'index.html'))) missingChronologyDetails += 1;
}
for (const id of monitoredIds) {
  const en = path.join(ROOT, 'polymythseminars', 'events', id, 'index.html');
  const fr = path.join(ROOT, 'polymythseminars', 'fr', 'events', id, 'index.html');
  if (!fs.existsSync(en)) missingMonitoringDetails += 1;
  if (!fs.existsSync(fr)) missingMonitoringDetails += 1;
  if (fs.existsSync(en)) {
    const detail = fs.readFileSync(en, 'utf8');
    if (!detail.includes('data-publication-surface="watchlist"') || /<time\s+datetime=/i.test(detail) || /"@type"\s*:\s*"Event"/.test(detail)) invalidMonitoringDetails += 1;
  }
}
if (missingChronologyDetails) problems.push(`${missingChronologyDetails} chronology detail-language routes are missing`);
if (missingMonitoringDetails) problems.push(`${missingMonitoringDetails} stable monitoring detail-language routes are missing`);
if (invalidMonitoringDetails) problems.push(`${invalidMonitoringDetails} monitoring detail routes expose dated-event semantics`);

const main = read('polymythseminars/index.html');
const monitoring = read('polymythseminars/monitoring/index.html');
const app = read('js/polymythcal-discovery.js');
for (const [token, label] of [
  ['data-pmd-source="/polymythseminars/browse.json"', 'chronology-only source'],
  ['id="pmdSearch"', 'single front-facing search'],
  ['id="pmdFilterDrawer"', 'collapsed common filters'],
  ['id="pmdList"', 'paginated result list'],
  ['/polymythseminars/research/', 'Research escape path'],
  ['/polymythseminars/monitoring/', 'monitoring escape path'],
]) if (!main.includes(token)) problems.push(`main discovery shell lacks ${label}`);
for (const [token, label] of [
  ['data-pmd-surface="monitoring"', 'monitoring identity'],
  ['data-pmd-source="/polymythseminars/watchlist.json"', 'monitoring-only source'],
  ['awaiting a confirmed event date', 'honest date boundary copy'],
]) if (!monitoring.includes(token)) problems.push(`monitoring shell lacks ${label}`);
if (main.includes('Leads needing details') || main.includes('watchlistPanel') || main.includes('event-watchlist.json')) problems.push('main calendar leaks monitoring workflow UI');
if (monitoring.includes('id="pmdCalendar"')) problems.push('monitoring UI presents markers in a calendar view');

for (const [token, label] of [
  ['const FIELD_LABELS', 'public search-field registry'],
  ['title:', 'title field search'], ['people:', 'people field search'], ['organizer:', 'organizer field search'],
  ['place:', 'place field search'], ['topics:', 'topic field search'], ['format:', 'format field search'],
  ['function searchMatch(event, terms)', 'exact fielded matching'],
  ['function correctionSuggestions(query)', 'separate correction suggestions'],
  ['const suggestions = activeQueryMatchCount ? [] : correctionSuggestions(state.q)', 'query-only suggestions'],
  ["event.target.closest('[data-correction]')", 'click-to-apply correction'],
  ['class="pmd-match-reason"', 'visible match explanations'],
  ['function safeUrl(rawUrl)', 'safe destination URL validation'],
  ["addAction(detailHref(event), COPY.details, 'primary-link')", 'universal stable internal Details action'],
  ['pm-source-action', 'separate exact destination action'],
  ["kind === 'details' ? detailHref(event) : action.url", 'payload/internal Details de-duplication'],
]) if (!app.includes(token)) problems.push(`discovery controller lacks ${label}`);
const derivedSearch = app.match(/const derivedSearch = \{[\s\S]*?\n    \};/)?.[0] || '';
for (const forbidden of ['raw_excerpt', 'qualification_reasons', 'source_url', 'destination_url']) if (derivedSearch.includes(forbidden)) problems.push(`search index includes unsafe/private ${forbidden}`);

const football = canonicalItems.find(item => /Palestinian Football Exhibit/i.test(item.title || ''));
if (!football) problems.push('canonical data lost Palestinian Football Exhibit');
else {
  const joined = JSON.stringify(football);
  for (const token of ['PYM Toronto', 'FIFA', 'football', 'Palestine', 'Human Rights', 'unconfirmed', 'time-unconfirmed']) if (!joined.includes(token)) problems.push(`Palestinian Football Exhibit lost ${token}`);
}

if (problems.length) {
  console.error('POLYMYTHCAL SCRAPER/UI GUARD FAILED');
  problems.slice(0, 250).forEach(problem => console.error(` - ${problem}`));
  if (problems.length > 250) console.error(` - … ${problems.length - 250} more`);
  process.exit(1);
}
console.log(`POLYMYTHCAL SCRAPER/UI OK — source recall, ${chronologyItems.length} dated listings, ${monitoredItems.length} undated monitoring records, safe public search/facets, universal stable details, and exact destination actions are guarded.`);
