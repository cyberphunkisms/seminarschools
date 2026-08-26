#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  COMMON_FACET_AXES,
  EXPECTED_MONITORING_MARKER_COUNT,
  PUBLIC_EVENT_KEYS,
  PUBLIC_RESEARCH_KEYS,
  PUBLIC_WATCHLIST_KEYS,
  RESEARCH_FACET_AXES,
  TAXONOMY,
  TEMPORAL_TYPES,
  buildDiscoveryPayloads,
  classifyTopics,
  matchSearch,
  normalizeSearchText,
  temporalType,
} = require('./lib/polymythcal-discovery-model');

const ROOT = path.resolve(__dirname, '..');
const readJson = relative => JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));
const canonical = readJson('data/polymyth-seminar-events.json');
const browse = readJson('polymythseminars/browse.json');
const watchlist = readJson('polymythseminars/watchlist.json');
const research = readJson('polymythseminars/research.json');
const surfaces = readJson('data/polymythcal-publication-surfaces.json');
const payloadReport = readJson('scripts/reports/polymythcal-browser-payload-report.json');

function ids(records) {
  return new Set(records.map(record => record.id));
}

function assertSameSet(actual, expected, message) {
  assert.deepStrictEqual([...actual].sort(), [...expected].sort(), message);
}

function assertAllowedKeys(record, allowlist, label) {
  const extra = Object.keys(record).filter(key => !allowlist.includes(key));
  assert.deepStrictEqual(extra, [], `${label} exposes non-allowlisted keys: ${extra.join(', ')}`);
}

function publicMatchIds(records, query) {
  return new Set(records.filter(record => matchSearch(record, query).matched).map(record => record.id));
}

function facetIds(records, axis, value) {
  return new Set(records.filter(record => (record.facets?.[axis] || []).includes(value)).map(record => record.id));
}

function assertExactFacetLabels(records, axes) {
  const labels = new Map();
  for (const axis of axes) {
    for (const [value, definition] of Object.entries(TAXONOMY.axes[axis].values)) {
      const members = facetIds(records, axis, value);
      if (!members.size) continue;
      for (const label of [definition.en, definition.fr]) {
        const normalized = normalizeSearchText(label);
        if (!labels.has(normalized)) labels.set(normalized, { label, expected: new Set() });
        for (const id of members) labels.get(normalized).expected.add(id);
      }
    }
  }
  for (const { label, expected } of labels.values()) {
    assertSameSet(publicMatchIds(records, label), expected, `Facet label mismatch: ${label}`);
  }
}

function detail(id) {
  return fs.readFileSync(path.join(ROOT, 'polymythseminars', 'events', id, 'index.html'), 'utf8');
}

function ics(id) {
  return fs.readFileSync(path.join(ROOT, 'polymythseminars', 'ics', `${id}.ics`), 'utf8');
}

assert.strictEqual(canonical.events.length, 2088);
assert.strictEqual(browse.count, 1954);
assert.strictEqual(watchlist.count, EXPECTED_MONITORING_MARKER_COUNT);
assert.strictEqual(research.count, browse.count);
assert.strictEqual(browse.count + watchlist.count, canonical.events.length);

const canonicalIds = ids(canonical.events);
const chronologyIds = ids(browse.events);
const watchIds = ids(watchlist.items);
assert.strictEqual([...chronologyIds].some(id => watchIds.has(id)), false, 'Chronology and watchlist overlap');
assertSameSet(new Set([...chronologyIds, ...watchIds]), canonicalIds, 'Public surfaces do not partition canonical ids');
assertSameSet(new Set(surfaces.chronology_ids), chronologyIds, 'Chronology manifest mismatch');
assertSameSet(new Set(surfaces.watchlist_ids), watchIds, 'Watchlist manifest mismatch');
assertSameSet(ids(research.records), chronologyIds, 'Research projection must augment chronology records only');

assert.deepStrictEqual(Object.keys(browse.taxonomy.axes), COMMON_FACET_AXES);
assert.deepStrictEqual(Object.keys(research.taxonomy.axes), RESEARCH_FACET_AXES);
for (const event of browse.events) {
  assertAllowedKeys(event, PUBLIC_EVENT_KEYS, event.id);
  assert(Object.keys(event.facets || {}).every(axis => COMMON_FACET_AXES.includes(axis)), `${event.id} leaks specialist facets`);
  assert(TEMPORAL_TYPES.includes(event.temporal?.type), `${event.id} has invalid temporal type`);
  assert(/^\d{4}-\d{2}-\d{2}$/.test(event.checked_on), `${event.id} needs compact checked_on`);
}
for (const item of watchlist.items) {
  assertAllowedKeys(item, PUBLIC_WATCHLIST_KEYS, item.id);
  for (const key of ['date', 'end_date', 'date_precision', 'time_precision']) {
    assert(!(key in item), `${item.id} watch record exposes ${key}`);
  }
  assert.deepStrictEqual(item.temporal, { type: 'undated' });
  assert.strictEqual(item.date_status, 'awaiting-confirmed-date');
}
for (const record of research.records) {
  assertAllowedKeys(record, PUBLIC_RESEARCH_KEYS, record.id);
  assert(Object.keys(record.facets || {}).every(axis => RESEARCH_FACET_AXES.includes(axis)), `${record.id} leaks common facets into Research`);
}

const forbiddenKeys = new Set([
  'raw_excerpt', 'source_language', 'source_languages', 'research_id',
  'research_batch', 'research_set', 'review_status', 'qualification_reasons',
  'ai_rule', 'socio_note', 'source_notes', 'evidence', 'identity_key',
]);
function rejectPrivateKeys(value, trail = '') {
  if (Array.isArray(value)) return value.forEach((item, index) => rejectPrivateKeys(item, `${trail}[${index}]`));
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    assert(!forbiddenKeys.has(key), `Private key ${trail}.${key} reached a public projection`);
    rejectPrivateKeys(child, `${trail}.${key}`);
  }
}
rejectPrivateKeys(browse);
rejectPrivateKeys(watchlist);
rejectPrivateKeys(research);

for (const record of [...browse.events, ...watchlist.items]) {
  if ('content_language' in record) {
    assert.notStrictEqual(record.content_language, 'und');
    assert(/^(?:mul|[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*)$/.test(record.content_language));
  }
  for (const action of record.actions || []) {
    assert(action.url.startsWith('/') || action.url.startsWith('https://'), `${record.id} has unsafe public action`);
  }
}
for (const record of research.records) {
  for (const source of record.sources || []) assert(source.url.startsWith('https://'), `${record.id} has unsafe source`);
}

const visitorNarration = /Projected source watch|Polymythcal separates|socio-structural analysis|\bthe entry treats\b|corrects the earlier|earlier mistaken|analytically distinct/i;
for (const record of [...browse.events, ...watchlist.items]) {
  assert(!visitorNarration.test(record.description || ''), `${record.id} exposes builder-facing narration`);
}

assertExactFacetLabels(browse.events, COMMON_FACET_AXES);
assertExactFacetLabels(research.records, RESEARCH_FACET_AXES);
assertSameSet(publicMatchIds(browse.events, 'Toronto and GTA'), facetIds(browse.events, 'places', 'toronto-gta'));
assertSameSet(publicMatchIds(browse.events, 'Toronto et le Grand Toronto'), facetIds(browse.events, 'places', 'toronto-gta'));
assertSameSet(publicMatchIds(browse.events, 'céleste'), facetIds(browse.events, 'what', 'event:celestial-occurrence'));
for (const query of ['celestial event', 'celestial events', 'événement céleste', 'événements célestes']) {
  assertSameSet(publicMatchIds(browse.events, query), facetIds(browse.events, 'what', 'event:celestial-occurrence'));
}
assertSameSet(publicMatchIds(browse.events, 'bourse'), facetIds(browse.events, 'what', 'opportunity:funding'));
assert([...publicMatchIds(browse.events, 'pleine lune')].every(id => browse.events.find(event => event.id === id).title.startsWith('Full Moon')));
assert([...publicMatchIds(browse.events, 'nouvelle lune')].every(id => browse.events.find(event => event.id === id).title.startsWith('New Moon')));
assert(publicMatchIds(browse.events, 'éclipse').size > 0);
assert(publicMatchIds(browse.events, '冬至').has('dongzhi-winter-solstice-2026'));
assert.strictEqual(matchSearch({ search: { title: ['marshall lecture'] } }, 'mars').matched, false);
assert(!classifyTopics({ topics: ['public authority'] }).includes('writing'));
assert(classifyTopics({ topics: ['author talk'] }).includes('writing'));

const canonicalById = new Map(canonical.events.map(event => [event.id, event]));
const browseById = new Map(browse.events.map(event => [event.id, event]));
const fixtureTypes = {
  'full-moon-2026-08-28': 'global-instant',
  'new-moon-2026-09-11': 'global-instant',
  'taiwan-zhongyuan-2026': 'all-day-local-date',
  'dongzhi-winter-solstice-2026': 'local-date-time',
  'scms-2027-cfp-deadline': 'deadline',
  'epiphanies-of-repair-memory-art-and-practice-2026-04-22': 'local-date-time',
  'river-run-grassy-narrows-2026': 'local-date-time',
};
for (const [id, expectedType] of Object.entries(fixtureTypes)) {
  assert.strictEqual(temporalType(canonicalById.get(id)), expectedType, `${id} temporal derivation`);
  assert.strictEqual(browseById.get(id).temporal.type, expectedType, `${id} projected temporal type`);
}
assert.strictEqual(canonicalById.get('scms-2027-cfp-deadline').time_precision, 'exact');
assert.strictEqual(canonicalById.get('scms-2027-cfp-deadline').date_precision, 'exact');

assert(detail('full-moon-2026-08-28').includes('<time datetime="2026-08-28T00:18-04:00">2026-08-28 00:18 EDT</time>'));
assert(detail('new-moon-2026-09-11').includes('<time datetime="2026-09-10T23:27-04:00">2026-09-10 23:27 EDT</time>'));
assert(detail('taiwan-zhongyuan-2026').includes('<time datetime="2026-08-27">2026-08-27</time>'));
assert(detail('dongzhi-winter-solstice-2026').includes('<time datetime="2026-12-21T15:50-05:00">2026-12-21 15:50 EST</time>'));
assert(detail('scms-2027-cfp-deadline').includes('<time datetime="2026-08-28T17:00-05:00">2026-08-28 17:00 CDT</time>'));
assert(detail('epiphanies-of-repair-memory-art-and-practice-2026-04-22').includes('<time datetime="2026-04-22T22:00-04:00">2026-04-22 22:00 EDT – 2026-04-23 23:59 EDT</time>'));
assert(detail('river-run-grassy-narrows-2026').includes('<time datetime="2026-09-23T12:00-04:00">2026-09-23 12:00 EDT</time>'));
assert(ics('full-moon-2026-08-28').includes('DTSTART:20260828T041800Z'));
assert(ics('new-moon-2026-09-11').includes('DTSTART:20260911T032700Z'));
assert(ics('taiwan-zhongyuan-2026').includes('DTSTART;VALUE=DATE:20260827'));
assert(ics('dongzhi-winter-solstice-2026').includes('DTSTART:20261221T205000Z'));
assert(ics('scms-2027-cfp-deadline').includes('DTSTART:20260828T220000Z'));
assert(ics('epiphanies-of-repair-memory-art-and-practice-2026-04-22').includes('DTSTART:20260423T020000Z'));
assert(ics('epiphanies-of-repair-memory-art-and-practice-2026-04-22').includes('DTEND:20260424T035900Z'));
assert(ics('river-run-grassy-narrows-2026').includes('DTSTART:20260923T160000Z'));

const watchId = watchlist.items[0].id;
const watchDetail = detail(watchId);
assert(watchDetail.includes('Date awaiting confirmation · Date à confirmer'));
assert(!watchDetail.includes('application/ld+json'));
assert(!watchDetail.includes('type="text/calendar"'));
const deployedWatchIcs = path.join(ROOT, 'public', 'polymythseminars', 'ics', `${watchId}.ics`);
if (process.env.VERIFY_PUBLIC_DEPLOY === '1') assert(!fs.existsSync(deployedWatchIcs));

assert.strictEqual(payloadReport.unavailable_with_safe_candidate_count, 108);
assert.strictEqual(payloadReport.typed_action_recovered_unavailable_record_count, 108);
assert.strictEqual(payloadReport.typed_action_recovery_complete, true);
const actionFixtures = {
  'hot-docs-2027-submissions-open': ['submission', 'series'],
  'mccall-macbain-2027-international-deadline': ['application', 'series'],
  'igf-2027-submission-deadline': ['submission', 'series'],
  'ncur-2027-decisions-and-registration': ['registration', 'series'],
};
for (const [id, [kind, scope]] of Object.entries(actionFixtures)) {
  const action = browseById.get(id).actions.find(candidate => candidate.kind === kind);
  assert(action, `${id} is missing recovered ${kind} action`);
  assert.strictEqual(action.scope, scope, `${id} candidate scope`);
}

for (const freshness of [browse.freshness, watchlist.freshness, research.freshness, surfaces.freshness]) {
  assert(Date.parse(freshness.built_at) >= Date.parse(freshness.newest_source_check_at));
  assert(!freshness.built_at.startsWith('2026-07-21'));
  assert(/^[a-f0-9]{64}$/.test(freshness.content_hash));
}

console.log('POLYMYTHCAL DATA/TRUTH TEST PASSED — canonical/public partition, temporal fixtures, exact facet aliases, language, freshness, and private-field boundary verified.');
