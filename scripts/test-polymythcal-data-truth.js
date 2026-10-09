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
  isMonitoringMarker,
  classifyWhat,
  classifyTopics,
  matchSearch,
  normalizeSearchText,
  temporalType,
} = require('./lib/polymythcal-discovery-model');

const ROOT = path.resolve(__dirname, '..');
const readJson = relative => JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));
const canonical = readJson('data/polymyth-seminar-events.json');
const legacyWatch = {
  date: '2026-10-15T23:59-04:00', date_precision: 'exact', time_precision: 'exact',
  confirmation_status: 'unconfirmed', description: 'Projected source watch for a fellowship.',
};
assert.strictEqual(isMonitoringMarker(legacyWatch), true, 'Exact inherited dates must not publish a source watch as an occurrence');
assert.strictEqual(isMonitoringMarker({...legacyWatch, description: 'Announced lecture; time awaiting confirmation.'}), false,
  'Unconfirmed real events must remain eligible for chronology');
assert.strictEqual(isMonitoringMarker({...legacyWatch, confirmation_status: 'confirmed'}), false,
  'A subsequently source-confirmed date must not remain a source watch');
assert.strictEqual(isMonitoringMarker({...legacyWatch, description: '', raw_excerpt: legacyWatch.description}), true,
  'Original explicit watch evidence must survive description cleanup');
for (const description of [
  'Submission deadline projected from the annual January window.',
  'Opening date placeholder for the next spring cycle.',
  'Local branch deadlines vary, so this placeholder marks the annual contest window.',
  'Section calls vary, projected; confirm with the organizer.',
]) {
  assert(isMonitoringMarker({...legacyWatch, description}), description);
  assert(!isMonitoringMarker({...legacyWatch, description, confirmation_status: 'confirmed'}),
    'A subsequent source-confirmed date must supersede an earlier projection');
}
for (const description of ['An outdoor film projected on a screen.', 'Lecture about projected economic growth.']) {
  assert(!isMonitoringMarker({...legacyWatch, description}), 'Non-date projection language must retain a real event');
}
assert(isMonitoringMarker({...legacyWatch, date_precision: 'unknown', description: 'Regional deadlines vary.'}));
assert.strictEqual(classifyWhat({record_kind: 'opportunity', type: 'cfp', academic_bands: ['fellowships']}), 'opportunity:funding');
assert.strictEqual(classifyWhat({record_kind: 'opportunity', type: 'cfp', academic_bands: ['fellowships'], opportunity_kind: 'call for papers'}), 'opportunity:cfp',
  'A specific opportunity kind must outrank a broad academic band');
const browse = readJson('polymythseminars/browse.json');
const watchlist = readJson('polymythseminars/watchlist.json');
const research = readJson('polymythseminars/research.json');
const surfaces = readJson('data/polymythcal-publication-surfaces.json');
const payloadReport = readJson('scripts/reports/polymythcal-browser-payload-report.json');
for (const event of canonical.events) {
  if (event.date_change_reason === 'projection-correction') {
    assert(!(event.previous_dates || []).includes(event.date),
      `${event.id}: the current corrected date is incorrectly recorded as previous`);
  }
}

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

const expectedInventory = require('./lib/polymythcal-inventory-contract').currentInventoryCounts(ROOT, canonical);
assert.strictEqual(browse.count, expectedInventory.chronology);
assert.strictEqual(watchlist.count, expectedInventory.watchlist);
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
  assert(!fs.existsSync(path.join(ROOT, 'polymythseminars', 'ics', `${item.id}.ics`)),
    `${item.id}: undated source watches must not have calendar downloads`);
  if (process.env.VERIFY_PUBLIC_DEPLOY === '1') {
    assert(!fs.existsSync(path.join(ROOT, 'public', 'polymythseminars', 'ics', `${item.id}.ics`)),
      `${item.id}: an obsolete calendar download survived in the public build`);
  }
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
  'dongzhi-winter-solstice-2026': 'all-day-local-date',
  'dongzhi-winter-solstice-2027': 'all-day-local-date',
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
assert(detail('dongzhi-winter-solstice-2026').includes('<time datetime="2026-12-22">2026-12-22</time>'));
assert(detail('dongzhi-winter-solstice-2027').includes('<time datetime="2027-12-22">2027-12-22</time>'));
assert.strictEqual(canonicalById.get('dongzhi-winter-solstice-2026').timezone, 'Asia/Taipei');
assert.strictEqual(temporalType(canonicalById.get('december-solstice-2026')), 'global-instant');
assert(detail('scms-2027-cfp-deadline').includes('<time datetime="2026-08-28T17:00-05:00">2026-08-28 17:00 CDT</time>'));
assert(detail('epiphanies-of-repair-memory-art-and-practice-2026-04-22').includes('<time datetime="2026-04-22T22:00-04:00">2026-04-22 22:00 EDT – 2026-04-23 23:59 EDT</time>'));
assert(detail('river-run-grassy-narrows-2026').includes('<time datetime="2026-09-23T12:00-04:00">2026-09-23 12:00 EDT</time>'));
assert(ics('full-moon-2026-08-28').includes('DTSTART:20260828T041800Z'));
assert(ics('new-moon-2026-09-11').includes('DTSTART:20260911T032700Z'));
assert(ics('taiwan-zhongyuan-2026').includes('DTSTART;VALUE=DATE:20260827'));
assert(ics('dongzhi-winter-solstice-2026').includes('DTSTART;VALUE=DATE:20261222'));
assert(ics('dongzhi-winter-solstice-2027').includes('DTSTART;VALUE=DATE:20271222'));
assert(!ics('dongzhi-winter-solstice-2026').includes('DTSTART:20261221T205000Z'));
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

const publicById = new Map(
  [...browse.events, ...watchlist.items].map(record => [record.id, record]),
);
for (const id of ['national-humanities-center-fellowship-deadline-projected-2026-10-02-5980fd79', 'getty-scholar-grants-projected-2026-10-01-409d574a']) {
  assert(publicById.get(id).facets.what.includes('opportunity:funding'), `${id}: fellowship must be discoverable under funding`);
}
assert(watchIds.has('scholastic-art-and-writing-awards-2026'), 'Regional deadlines must not inherit a single invented date');
for (const id of ['scholastic-art-and-writing-awards-2026', 'scholastic-art-writing-awards-2027-open']) {
  assert(publicById.get(id).description.includes('$15') && publicById.get(id).description.includes('$40'), `${id}: current fees must propagate to related records`);
}
for (const review of readJson('data/polymythcal-reviewed-corrections-2026-10-02.json').followup_reviews || []) {
  for (const id of review.audited_projected_date_ids || []) {
    const canonicalRecord = canonicalById.get(id);
    if (canonicalRecord.confirmation_status !== 'confirmed') {
      assert(watchIds.has(id), `${id}: audited projected date leaked back into chronology`);
    }
  }
}
let exactExternalCount = 0;
let unresolvedCount = 0;
for (const event of canonical.events) {
  const record = publicById.get(event.id);
  assert(record, `${event.id} is missing its public projection`);
  const internalActions = (record.actions || []).filter(action => action.url.startsWith('/'));
  const externalActions = (record.actions || []).filter(action => action.url.startsWith('https://'));
  assert.deepStrictEqual(
    internalActions,
    [{ kind: 'details', url: `/polymythseminars/events/${event.id}/`, scope: 'listing' }],
    `${event.id} must expose exactly one stable internal details action`,
  );
  assert(externalActions.length <= 1, `${event.id} exposes multiple external destinations`);
  const exactDestination = (
    typeof event.destination_url === 'string'
    && event.destination_url.startsWith('https://')
    && event.destination_status !== 'unavailable-specific-page'
  );
  if (exactDestination) {
    exactExternalCount += 1;
    assert.strictEqual(externalActions.length, 1, `${event.id} suppresses a materialized exact destination`);
    assert.strictEqual(externalActions[0].url, event.destination_url, `${event.id} destination drift`);
    assert.strictEqual(externalActions[0].kind, event.destination_kind, `${event.id} destination kind drift`);
    assert.strictEqual(externalActions[0].scope, event.destination_scope, `${event.id} destination scope drift`);
  } else {
    unresolvedCount += 1;
    assert.strictEqual(externalActions.length, 0, `${event.id} leaks a broad or unverified destination`);
  }
}
assert.strictEqual(payloadReport.destination_policy, 'materialized-exact-destination-only');
assert.strictEqual(payloadReport.exact_external_destination_count, exactExternalCount);
assert.strictEqual(payloadReport.public_external_action_count, exactExternalCount);
assert.strictEqual(payloadReport.unresolved_destination_count, unresolvedCount);
assert.strictEqual(payloadReport.unresolved_specific_destination_count, unresolvedCount);
assert.strictEqual(payloadReport.missing_exact_external_action_count, 0);
assert.strictEqual(payloadReport.mismatched_external_action_count, 0);
assert.strictEqual(payloadReport.broad_source_projection_count, 0);
assert.strictEqual(payloadReport.suppressed_unverified_candidate_action_count, payloadReport.suppressed_unverified_candidate_record_count);

for (const freshness of [browse.freshness, watchlist.freshness, research.freshness, surfaces.freshness]) {
  assert(Date.parse(freshness.built_at) >= Date.parse(freshness.newest_source_check_at));
  assert(!freshness.built_at.startsWith('2026-07-21'));
  assert(/^[a-f0-9]{64}$/.test(freshness.content_hash));
}

console.log('POLYMYTHCAL DATA/TRUTH TEST PASSED — canonical/public partition, temporal fixtures, exact facet aliases, language, freshness, and private-field boundary verified.');
