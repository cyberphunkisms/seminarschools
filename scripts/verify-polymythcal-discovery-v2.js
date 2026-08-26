#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const {
  CLOCK_PRECISIONS,
  COMMON_FACET_AXES,
  EXPECTED_MONITORING_MARKER_COUNT,
  PERSISTED_SEARCH_GROUPS,
  PUBLIC_ACTION_CANDIDATE_FIELDS,
  PUBLIC_EVENT_KEYS,
  PUBLIC_RESEARCH_KEYS,
  PUBLIC_WATCHLIST_KEYS,
  RESEARCH_FACET_AXES,
  SEARCH_GROUPS,
  TEMPORAL_TYPES,
  buildDiscoveryPayloads,
  deriveSearchGroups,
  isMonitoringMarker,
  matchSearch,
  normalizeSearchText,
  parentId,
  projectTemporal,
  temporalType
} = require('./lib/polymythcal-discovery-model');
const core = require('../js/polymythcal-discovery-core');
require('./test-polymythcal-discovery-core');
require('./test-polymythcal-data-truth');
require('./test-polymythcal-discovery-shell');

const ROOT = path.resolve(__dirname, '..');
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const exists = relative => fs.existsSync(path.join(ROOT, relative));
const read = relative => fs.readFileSync(path.join(ROOT, relative));
const textFile = relative => read(relative).toString('utf8');
const json = relative => JSON.parse(read(relative));
const canonical = json('data/polymyth-seminar-events.json');
const browse = json('polymythseminars/browse.json');
const watchlist = json('polymythseminars/watchlist.json');
const research = json('polymythseminars/research.json');
const surfaces = json('data/polymythcal-publication-surfaces.json');
const report = json('scripts/reports/polymythcal-browser-payload-report.json');
const buildManifest = json('data/polymythcal-build-manifest.json');
const release = json('RELEASE_MANIFEST.json');
const publicRelease = json('public/site-release.json');
const expected = buildDiscoveryPayloads(canonical, { builtAt: browse._generated_at });
const controllerSource = textFile('js/polymythcal-discovery.js');
const coreSource = textFile('js/polymythcal-discovery-core.js');
const discoveryCss = textFile('css/polymythcal-discovery.css');
const themeCss = textFile('css/theme.css');
const headersSource = textFile('_headers');
const siteBuilderSource = textFile('scripts/build-polymythcal-discovery-site.js');
const detailBuilderSource = textFile('scripts/build-polymythcal-audit13.py');
const feedBuilderSource = textFile('scripts/build-polymythcal-feeds.py');

const chronology = browse.events || [];
const watched = watchlist.items || [];
const researchRecords = research.records || [];
const chronologyIds = chronology.map(event => event.id);
const watchlistIds = watched.map(event => event.id);
const canonicalIds = canonical.events.map(event => event.id);
const chronologyIdSet = new Set(chronologyIds);
const watchlistIdSet = new Set(watchlistIds);
const canonicalById = new Map(canonical.events.map(event => [event.id, event]));
const publicById = new Map([...chronology, ...watched].map(event => [event.id, event]));
const researchById = new Map(researchRecords.map(event => [event.id, event]));
const mergedResearchPayload = core.mergeResearchProjection(browse, research);
const mergedResearchRecords = mergedResearchPayload.events || [];
const mergedResearchById = new Map(mergedResearchRecords.map(event => [event.id, event]));

check(browse._schema === 'polymythcal-discovery-v2', 'browse.json has the wrong discovery schema.');
check(watchlist._schema === 'polymythcal-watchlist-v2', 'watchlist.json has the wrong schema.');
check(research._schema === 'polymythcal-research-v1', 'research.json has the wrong schema.');
check(surfaces._schema === 'polymythcal-publication-surfaces-v2', 'publication surface _schema is missing or stale.');
check(surfaces.schema === 'polymythcal-publication-surfaces-v2', 'publication surface schema is missing or stale.');
check(canonical.events.length === 2088, `Canonical release inventory changed (${canonical.events.length}/2088).`);
check(chronology.length === 1954, `Chronology release inventory changed (${chronology.length}/1954).`);
check(watched.length === EXPECTED_MONITORING_MARKER_COUNT, `Watchlist release inventory changed (${watched.length}/${EXPECTED_MONITORING_MARKER_COUNT}).`);
check(researchRecords.length === chronology.length, `Research projection inventory changed (${researchRecords.length}/${chronology.length}).`);
check(browse.count === chronology.length && browse._chronology_count === chronology.length, 'Browse chronology counts are inconsistent.');
check(browse._canonical_count === canonical.events.length, 'Browse canonical count is inconsistent.');
check(watchlist.count === watched.length && watchlist._canonical_count === canonical.events.length, 'Watchlist counts are inconsistent.');
check(research.count === researchRecords.length && research._chronology_count === chronology.length, 'Research counts are inconsistent.');
check(research._canonical_count === canonical.events.length, 'Research canonical count is inconsistent.');
check(new Set(canonicalIds).size === canonicalIds.length, 'Canonical IDs are not unique.');
check(new Set(chronologyIds).size === chronologyIds.length, 'Chronology IDs are not unique.');
check(new Set(watchlistIds).size === watchlistIds.length, 'Watchlist IDs are not unique.');
check(new Set(researchRecords.map(event => event.id)).size === researchRecords.length, 'Research IDs are not unique.');
check(chronologyIds.every(id => !watchlistIdSet.has(id)), 'Chronology and watchlist overlap.');
check(
  JSON.stringify([...chronologyIds, ...watchlistIds].sort()) === JSON.stringify([...canonicalIds].sort()),
  'Chronology and watchlist do not form a complete canonical partition.'
);
check(
  JSON.stringify(researchRecords.map(event => event.id)) === JSON.stringify(chronologyIds),
  'Research projection does not merge one-to-one with chronology by stable id and order.'
);

const exactKeys = (value, expectedKeys) => (
  JSON.stringify(Object.keys(value || {}).sort()) === JSON.stringify([...expectedKeys].sort())
);
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const freshnessKeys = ['built_at', 'content_hash', 'content_updated_at', 'newest_source_check_at', 'schema_version'];
for (const [name, payload] of [['browse', browse], ['watchlist', watchlist], ['research', research], ['surfaces', surfaces]]) {
  check(exactKeys(payload.freshness, freshnessKeys), `${name} freshness metadata is incomplete or exposes an unknown field.`);
  check(payload._generated_at === payload.freshness?.built_at, `${name} _generated_at does not equal freshness.built_at.`);
  check(/^\d{4}-\d{2}-\d{2}T/.test(String(payload.freshness?.built_at || '')), `${name} freshness built_at is not an ISO timestamp.`);
  check(/^[a-f0-9]{64}$/.test(String(payload.freshness?.content_hash || '')), `${name} freshness content_hash is not SHA-256.`);
  check(Date.parse(payload.freshness?.built_at) >= Date.parse(payload.freshness?.content_updated_at), `${name} claims a build older than included content.`);
  check(Date.parse(payload.freshness?.built_at) >= Date.parse(payload.freshness?.newest_source_check_at), `${name} claims a build older than its newest source check.`);
  check(
    Date.parse(payload.freshness?.built_at) === Date.parse(release.polymythcal_discovery_built_at),
    `${name} build timestamp is not the manifest-owned Discovery release instant.`
  );
}
check(release.polymythcal_discovery_release_id === '2026-08-26-polymythcal-discovery-v2', 'Discovery release id is missing or incoherent.');
check(release.polymythcal_discovery_asset_version === '20260826-discovery-v2', 'Discovery asset version is missing or incoherent.');
for (const field of ['polymythcal_discovery_release_id', 'polymythcal_discovery_built_at', 'polymythcal_discovery_asset_version']) {
  check(publicRelease[field] === release[field], `public/site-release.json does not preserve ${field}.`);
  check(buildManifest[field] === release[field], `Polymythcal build manifest does not preserve ${field}.`);
}
check(buildManifest.browser_payload_path === 'polymythseminars/browse.json', 'Build manifest browse projection path is stale.');
check(buildManifest.watchlist_payload_path === 'polymythseminars/watchlist.json', 'Build manifest watchlist projection path is stale.');
check(buildManifest.research_payload_path === 'polymythseminars/research.json', 'Build manifest Research projection path is stale.');
check(buildManifest.browser_payload_sha256 === sha256(read('polymythseminars/browse.json')), 'Build manifest browse hash is stale.');
check(buildManifest.watchlist_payload_sha256 === sha256(read('polymythseminars/watchlist.json')), 'Build manifest watchlist hash is stale.');
check(buildManifest.research_payload_sha256 === sha256(read('polymythseminars/research.json')), 'Build manifest Research hash is stale.');
check(buildManifest.chronology_count === chronology.length && buildManifest.watchlist_count === watched.length && buildManifest.research_count === researchRecords.length, 'Build manifest discovery surface counts are stale.');
check(['polymythseminars/research', 'polymythseminars/monitoring'].every(route => buildManifest.route_shells?.includes(route)), 'Build manifest omits connected Research/monitoring route shells.');

check(
  JSON.stringify(Object.keys(browse.taxonomy?.axes || {})) === JSON.stringify(COMMON_FACET_AXES),
  'Browse taxonomy does not expose exactly the approved common axes.'
);
check(
  JSON.stringify(Object.keys(research.taxonomy?.axes || {})) === JSON.stringify(RESEARCH_FACET_AXES),
  'Research taxonomy does not expose exactly the specialist axes.'
);
check(
  Object.keys(browse.taxonomy?.axes || {}).every(axis => !RESEARCH_FACET_AXES.includes(axis)),
  'A specialist Research axis leaked into the main browse taxonomy.'
);
check(!COMMON_FACET_AXES.includes('celestialKinds'), 'Celestial occurrence kinds remain a common/main facet.');
check(RESEARCH_FACET_AXES.includes('celestialKinds'), 'Celestial occurrence kinds are missing from lazy Research.');
check(!Object.hasOwn(browse.taxonomy?.axes || {}, 'celestialKinds'), 'Browse taxonomy exposes celestialKinds.');
check(Object.hasOwn(research.taxonomy?.axes || {}, 'celestialKinds'), 'Research taxonomy does not expose celestialKinds.');
check(mergedResearchRecords.length === chronology.length, 'Lazy Research merge changes the chronology inventory.');

const markerIds = canonical.events.filter(isMonitoringMarker).map(event => event.id);
check(markerIds.length === EXPECTED_MONITORING_MARKER_COUNT, `Explicit monitoring-marker predicate returned ${markerIds.length}, expected ${EXPECTED_MONITORING_MARKER_COUNT}.`);
check(JSON.stringify([...markerIds].sort()) === JSON.stringify([...watchlistIds].sort()), 'Watchlist does not contain exactly the explicit monitoring-marker records.');
check(JSON.stringify(surfaces.chronology_ids) === JSON.stringify(chronologyIds), 'Surface chronology IDs differ from browse order.');
check(JSON.stringify(surfaces.watchlist_ids) === JSON.stringify(watchlistIds), 'Surface watchlist IDs differ from watchlist order.');
check(surfaces.chronology_count === chronology.length, 'Surface chronology count is stale.');
check(surfaces.watchlist_count === watched.length, 'Surface watchlist count is stale.');
check(Object.keys(surfaces.reasons || {}).length === watched.length, 'Surface reasons must be keyed only by watchlist IDs.');
for (const id of watchlistIds) {
  check(
    JSON.stringify(surfaces.reasons?.[id]) === JSON.stringify({
      code: 'monitoring-marker',
      detail: 'Displayed date is a monitoring marker, not a confirmed event or deadline date.'
    }),
    `Surface reason for ${id} is missing or wrong.`
  );
}
for (const id of chronologyIds) check(!Object.hasOwn(surfaces.reasons || {}, id), `Chronology ID ${id} leaked into watchlist reasons.`);

check(JSON.stringify(browse) === JSON.stringify(expected.browse), 'browse.json is not the deterministic canonical projection.');
check(JSON.stringify(watchlist) === JSON.stringify(expected.watchlist), 'watchlist.json is not the deterministic canonical projection.');
check(JSON.stringify(research) === JSON.stringify(expected.research), 'research.json is not the deterministic specialist projection.');
check(JSON.stringify(surfaces) === JSON.stringify(expected.manifest), 'Publication surface manifest is not deterministic.');

const forbiddenKey = /^(?:raw_excerpt|qualification_reasons|ai_rule|source_id|identity_key|research_id|research_batch|research_priority|research_registry_status|research_source_ref|source_notes|lifecycle_notes|observer_notes|platform_notes|evidence|evidence_facts|source_control|source_language|source_languages|language_review|language_confidence|editorial_notes|editorial_status|scraped_at|first_seen_at|_src|_upsert_batches)$/i;
function scanForbiddenKeys(value, context) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanForbiddenKeys(item, `${context}[${index}]`));
    return;
  }
  for (const [key, nested] of Object.entries(value)) {
    check(!forbiddenKey.test(key), `${context} exposes forbidden key ${key}.`);
    scanForbiddenKeys(nested, `${context}.${key}`);
  }
}

const allowedEventKeys = new Set(PUBLIC_EVENT_KEYS);
const allowedWatchKeys = new Set(PUBLIC_WATCHLIST_KEYS);
const allowedResearchKeys = new Set(PUBLIC_RESEARCH_KEYS);
for (const event of chronology) {
  for (const key of Object.keys(event)) check(allowedEventKeys.has(key), `Chronology event ${event.id} exposes unapproved key ${key}.`);
  scanForbiddenKeys(event, `chronology:${event.id}`);
  for (const axis of Object.keys(event.facets || {})) {
    check(COMMON_FACET_AXES.includes(axis), `Chronology event ${event.id} exposes specialist facet ${axis}.`);
  }
}
for (const event of watched) {
  for (const key of Object.keys(event)) check(allowedWatchKeys.has(key), `Watchlist event ${event.id} exposes unapproved key ${key}.`);
  scanForbiddenKeys(event, `watchlist:${event.id}`);
  for (const key of ['date', 'end_date', 'date_precision', 'time_precision']) {
    check(!Object.hasOwn(event, key), `Watchlist event ${event.id} exposes fake chronology field ${key}.`);
  }
  check(event.date_status === 'awaiting-confirmed-date', `Watchlist event ${event.id} has the wrong date status.`);
  check(event.temporal?.type === 'undated', `Watchlist event ${event.id} is not explicitly undated.`);
  check(exactKeys(event.temporal, ['type']), `Watchlist event ${event.id} temporal projection exposes a dated field.`);
  for (const axis of Object.keys(event.facets || {})) {
    check(COMMON_FACET_AXES.includes(axis), `Watchlist event ${event.id} exposes specialist facet ${axis}.`);
  }
}
for (const event of researchRecords) {
  for (const key of Object.keys(event)) check(allowedResearchKeys.has(key), `Research event ${event.id} exposes unapproved key ${key}.`);
  scanForbiddenKeys(event, `research:${event.id}`);
  for (const axis of Object.keys(event.facets || {})) {
    check(RESEARCH_FACET_AXES.includes(axis), `Research event ${event.id} exposes non-specialist facet ${axis}.`);
  }
  check(chronologyIdSet.has(event.id), `Research event ${event.id} has no dated chronology record to merge with.`);
}
for (const event of [...chronology, ...watched]) {
  if (Object.hasOwn(event, 'content_language')) {
    check(/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(event.content_language), `Public event ${event.id} has an invalid content_language tag.`);
    check(event.content_language.toLowerCase() !== 'und', `Public event ${event.id} exposes the meaningless und content_language tag.`);
  }
}
for (const forbiddenRuntimeToken of [
  'raw_excerpt', 'qualification_reasons', 'ai_rule', 'research_id',
  'source_language', 'source_languages', 'identity_key', 'legacyWhat', 'legacyPlace', 'entry_family'
]) {
  check(!controllerSource.includes(forbiddenRuntimeToken), `Browser runtime still reads private or runtime-classification token ${forbiddenRuntimeToken}.`);
  check(!coreSource.includes(forbiddenRuntimeToken), `Browser core still reads private token ${forbiddenRuntimeToken}.`);
}

for (const event of [...chronology, ...watched]) {
  check(event.search && typeof event.search === 'object', `Public event ${event.id} has no fielded search index.`);
  check(
    JSON.stringify(Object.keys(event.search || {})) === JSON.stringify(PERSISTED_SEARCH_GROUPS),
    `Public event ${event.id} does not persist exactly the derived multilingual search groups.`
  );
  const derivedSearch = deriveSearchGroups(event);
  for (const group of SEARCH_GROUPS) {
    check(Array.isArray(derivedSearch[group]), `Public event ${event.id} derived search group ${group} is not an array.`);
    for (const value of derivedSearch[group] || []) {
      check(value === normalizeSearchText(value), `Public event ${event.id} search group ${group} is not normalized.`);
    }
  }
  for (const group of Object.keys(event.search || {})) check(PERSISTED_SEARCH_GROUPS.includes(group), `Public event ${event.id} has unknown persisted search group ${group}.`);
  for (const [axis, values] of Object.entries(event.facets || {})) {
    check(Array.isArray(values) && values.length > 0, `Public event ${event.id} facet ${axis} is empty or malformed.`);
    for (const value of values) {
      const label = browse.taxonomy?.axes?.[axis]?.values?.[value];
      check(Boolean(label), `Public event ${event.id} facet ${axis}:${value} has no taxonomy label.`);
      check(Boolean(label?.en && label?.fr), `Public event ${event.id} facet ${axis}:${value} lacks EN/FR labels.`);
    }
  }
}

check(normalizeSearchText('冬至') === '冬至', 'Unicode normalization deletes CJK text.');
check(normalizeSearchText('Montréal') === 'montreal', 'Unicode normalization does not fold Montréal predictably.');
check(normalizeSearchText('Québec') === 'quebec', 'Unicode normalization does not fold Québec predictably.');
const dongzhi = publicById.get('dongzhi-winter-solstice-2026');
check(Boolean(dongzhi), 'Dongzhi fixture is missing from public discovery data.');
check(matchSearch(dongzhi, '冬至').matched, 'Unicode fielded search cannot find Dongzhi by 冬至.');
const collisionFixture = {
  search: {
    title: ['come venues june course'],
    description: [],
    people: [],
    organizer: [],
    place: [],
    topics: [],
    format: []
  }
};
for (const query of ['comet', 'venus', 'lune', 'bourse']) {
  check(!matchSearch(collisionFixture, query).matched, `Exact/prefix search silently fuzzed ${query}.`);
}
check(matchSearch(collisionFixture, 'course').matched, 'Exact fielded search rejected a present token.');
check(!matchSearch(collisionFixture, '!!!').matched, 'Punctuation-only search matches the corpus.');

check(
  JSON.stringify([...core.SEARCH_FIELDS].sort()) === JSON.stringify([...SEARCH_GROUPS].sort()),
  'Browser search fields differ from the approved public-field allowlist.'
);
check(core.normalizeText('冬至') === '冬至', 'Browser search normalization deletes CJK text.');
check(core.normalizeText('Montréal') === 'montreal', 'Browser search does not fold accents predictably.');
check(!core.queryIsInvalid('冬至'), 'Browser treats a valid non-Latin query as empty.');
check(core.queryIsInvalid('!!!'), 'Browser does not reject a punctuation-only normalized-empty query.');
check(!core.searchMatch(dongzhi, '!!!').matched, 'Browser punctuation-only search shows the corpus.');

const cjkMatches = chronology.filter(event => core.searchMatch(event, '冬至').matched);
check(cjkMatches.length > 0, 'Browser Unicode search cannot find Dongzhi by 冬至.');
check(cjkMatches.length < chronology.length, 'Browser Unicode search silently falls back to show-all.');
const absentCjkMatches = chronology.filter(event => core.searchMatch(event, '不存在的检索词').matched);
check(absentCjkMatches.length === 0, `Absent non-Latin query returned ${absentCjkMatches.length} records instead of zero.`);

const internalOnlyFixture = {
  id: 'internal-only-fixture',
  title: 'Public title',
  description: 'Public summary',
  raw_excerpt: 'releasegatehiddentoken',
  qualification_reasons: ['releasegatehiddentoken'],
  ai_rule: 'releasegatehiddentoken',
  research_id: 'releasegatehiddentoken',
  evidence: { note: 'releasegatehiddentoken' },
  facets: {},
  search: {}
};
check(!core.searchMatch(internalOnlyFixture, 'releasegatehiddentoken').matched, 'A hidden/internal-only field is searchable.');

const browserCollisionFixture = {
  title: 'Come From Away',
  description: 'Venues open in June for this course.',
  facets: {},
  search: {}
};
for (const query of ['comet', 'Venus', 'lune', 'bourse']) {
  check(!core.searchMatch(browserCollisionFixture, query).matched, `Browser search silently collides ${query} with unrelated wording.`);
}
const exactAllowedFixture = { title: 'Venus and a comet', description: 'Bourse de la pleine lune', facets: {}, search: {} };
for (const query of ['comet', 'Venus', 'lune', 'bourse']) {
  check(core.searchMatch(exactAllowedFixture, query).matched, `Browser search rejects an exact intended ${query} match.`);
}

for (const query of ['comet', 'Venus', 'lune', 'bourse']) {
  const terms = core.queryTerms(query);
  const matches = chronology.filter(event => core.searchMatch(event, terms).matched);
  check(matches.length < chronology.length, `Collision query ${query} falls back to show-all.`);
  for (const event of matches) {
    const result = core.searchMatch(event, terms);
    check(core.SEARCH_FIELDS.includes(result.reason?.field), `Collision query ${query} matched ${event.id} through a non-public field.`);
  }
}

const multiTokenFixture = { title: 'Meteor shower', description: 'Tonight', facets: {}, search: {} };
check(core.searchMatch(multiTokenFixture, 'meteor shower').matched, 'Browser search does not combine present query tokens with AND.');
check(!core.searchMatch(multiTokenFixture, 'meteor venus').matched, 'Browser search does not require every query token.');
check(core.searchMatch(multiTokenFixture, 'meteo').matched, 'Browser search rejects an approved five-character forward prefix.');
check(!core.searchMatch({ title: 'Marshall' }, 'mars').matched, 'Four-character prefix reintroduced the Mars-to-Marshall collision.');

function matchesAxes(event, state) {
  return Object.entries(state).every(([axis, selected]) => {
    if (!selected.size) return true;
    const values = event.facets?.[axis] || [];
    return values.some(value => selected.has(value));
  });
}
const celestialSelection = { what: new Set(['event:celestial-occurrence']) };
const competitionSelection = { what: new Set(['opportunity:competitions']) };
const eitherSelection = { what: new Set(['event:celestial-occurrence', 'opportunity:competitions']) };
const celestialResults = chronology.filter(event => matchesAxes(event, celestialSelection));
const competitionResults = chronology.filter(event => matchesAxes(event, competitionSelection));
const eitherResults = chronology.filter(event => matchesAxes(event, eitherSelection));
check(celestialResults.length > 0 && celestialResults.every(event => event.facets.kind.includes('attend')), 'Celestial What filter leaks opportunities.');
check(competitionResults.length > 0 && competitionResults.every(event => event.facets.kind.includes('apply')), 'Competition What filter leaks events.');
check(eitherResults.length === celestialResults.length + competitionResults.length, 'OR-within-What does not form the exact union.');
const astrologyCelestial = chronology.filter(event => matchesAxes(event, {
  what: new Set(['event:celestial-occurrence']),
  topics: new Set(['astrology'])
}));
check(astrologyCelestial.length > 0 && astrologyCelestial.every(event => event.facets.what.includes('event:celestial-occurrence') && event.facets.topics.includes('astrology')), 'AND-across-axes is not exact.');
for (const event of [...chronology, ...watched]) {
  const kind = event.facets.kind?.[0];
  const what = event.facets.what?.[0] || '';
  check(kind === 'attend' ? what.startsWith('event:') : what.startsWith('opportunity:'), `Hierarchical What/kind mismatch on ${event.id}.`);
}

function countMembership(records, selections) {
  return records.filter(event => core.matchesFacets(event, selections)).length;
}

for (const [axis, definition] of Object.entries(browse.taxonomy?.axes || {})) {
  const counts = core.facetCounts(chronology, {}, axis);
  for (const [value, labels] of Object.entries(definition.values || {})) {
    const expectedCount = countMembership(chronology, { [axis]: new Set([value]) });
    check((counts.get(value) || 0) === expectedCount, `Facet count differs from selected results for ${axis}:${value} (${counts.get(value) || 0}/${expectedCount}).`);
    if (expectedCount > 0) {
      check(Boolean(labels?.en && labels?.fr), `Populated facet ${axis}:${value} lacks exact EN/FR labels.`);
      for (const localeLabel of [labels.en, labels.fr]) {
        check(core.normalizeText(localeLabel).length > 0, `Populated facet ${axis}:${value} has a normalized-empty label.`);
      }
    }
  }
}

for (const [axis, definition] of Object.entries(research.taxonomy?.axes || {})) {
  const counts = core.facetCounts(mergedResearchRecords, {}, axis);
  for (const [value, labels] of Object.entries(definition.values || {})) {
    const expectedCount = countMembership(mergedResearchRecords, { [axis]: new Set([value]) });
    check((counts.get(value) || 0) === expectedCount, `Research facet count differs from selected results for ${axis}:${value} (${counts.get(value) || 0}/${expectedCount}).`);
    if (expectedCount > 0) {
      check(Boolean(labels?.en && labels?.fr), `Populated Research facet ${axis}:${value} lacks exact EN/FR labels.`);
      check(core.normalizeText(labels.en).length > 0 && core.normalizeText(labels.fr).length > 0, `Populated Research facet ${axis}:${value} has a normalized-empty label.`);
    }
  }
}
for (const token of [
  "rawOption?.en", "rawOption?.fr", 'function exactFacetIntents(query)',
  'normalizeText(alias) === normalized', 'data-intent-axis=', 'data-intent-value='
]) {
  check(controllerSource.includes(token), `Exact bilingual facet-action contract misses ${token}.`);
}

const torontoMembership = countMembership(chronology, { places: new Set(['toronto-gta']) });
check(torontoMembership > 0, 'Toronto and GTA facet unexpectedly has no results.');
check(browse.taxonomy?.axes?.places?.values?.['toronto-gta']?.en === 'Toronto and GTA', 'Toronto and GTA exact public facet label is missing.');
check(
  (core.facetCounts(chronology, {}, 'places').get('toronto-gta') || 0) === torontoMembership,
  'Toronto and GTA displayed count differs from its exact facet membership.'
);

const attendContext = { kind: new Set(['attend']) };
for (const axis of ['what', 'places', 'topics', 'celestialKinds', 'formats', 'audiences', 'statuses']) {
  const counts = core.facetCounts(chronology, attendContext, axis);
  for (const value of Object.keys(browse.taxonomy?.axes?.[axis]?.values || {})) {
    const expectedCount = countMembership(chronology, { ...attendContext, [axis]: new Set([value]) });
    check((counts.get(value) || 0) === expectedCount, `Contextual facet count differs for attend + ${axis}:${value}.`);
  }
}

const exactCelestialCount = countMembership(chronology, { what: new Set(['event:celestial-occurrence']) });
const exactCompetitionCount = countMembership(chronology, { what: new Set(['opportunity:competitions']) });
check(exactCelestialCount === celestialResults.length, 'Celestial facet behavior differs between controller core and projection contract.');
check(exactCompetitionCount === competitionResults.length, 'Competition facet behavior differs between controller core and projection contract.');
check(
  chronology.filter(event => core.matchesFacets(event, { what: new Set(['event:celestial-occurrence']) })).every(event => event.facets.kind.includes('attend')),
  'Selecting a celestial event subtype leaks opportunities through the browser core.'
);
check(
  chronology.filter(event => core.matchesFacets(event, { what: new Set(['opportunity:competitions']) })).every(event => event.facets.kind.includes('apply')),
  'Selecting an opportunity subtype leaks events through the browser core.'
);

function checkFacet(id, axis, value) {
  const event = mergedResearchById.get(id) || publicById.get(id);
  check(Boolean(event), `Celestial fixture ${id} is missing.`);
  check(event?.facets?.[axis]?.includes(value), `Celestial fixture ${id} lacks ${axis}:${value}.`);
}
checkFacet('full-moon-2026-08-28', 'what', 'event:celestial-occurrence');
checkFacet('full-moon-2026-08-28', 'celestialKinds', 'moon-phase');
checkFacet('full-moon-2026-08-28', 'topics', 'astronomy');
checkFacet('mercury-retrograde-2026-oct', 'celestialKinds', 'planetary-event');
checkFacet('mercury-retrograde-2026-oct', 'topics', 'astrology');
checkFacet('september-equinox-2026', 'celestialKinds', 'solstice-equinox');
checkFacet('dongzhi-winter-solstice-2026', 'what', 'event:seasonal-observance');
checkFacet('taiwan-mid-autumn-2026', 'what', 'event:ritual-observance');
check(!(mergedResearchById.get('dongzhi-winter-solstice-2026')?.facets?.celestialKinds || []).length, 'Seasonal observance is mislabelled as a physical celestial occurrence.');

const publicCelestialBranches = [
  ['what', 'event:celestial-occurrence'],
  ['topics', 'astronomy'],
  ['topics', 'astrology'],
  ['what', 'event:seasonal-observance'],
  ['what', 'event:ritual-observance']
];
for (const [axis, value] of publicCelestialBranches) {
  const definition = browse.taxonomy?.axes?.[axis]?.values?.[value];
  check(Boolean(definition?.en && definition?.fr), `Celestial branch ${axis}:${value} lacks an EN/FR public label.`);
}
for (const event of mergedResearchRecords) {
  const what = event.facets?.what || [];
  const physical = what.includes('event:celestial-occurrence');
  const observance = what.includes('event:seasonal-observance') || what.includes('event:ritual-observance');
  check(!(physical && observance), `Celestial occurrence and observance meanings collapse on ${event.id}.`);
  check(!event.facets?.celestialKinds?.length || physical, `Non-celestial record ${event.id} has a physical celestial-kind facet.`);
}
check(chronology.every(event => !Object.hasOwn(event.facets || {}, 'celestialKinds')), 'A celestialKinds array leaked into compact browse records.');
check(
  researchRecords.some(event => event.facets?.celestialKinds?.length)
    && researchRecords.every(event => !event.facets?.celestialKinds?.length || publicById.get(event.id)?.facets?.what?.includes('event:celestial-occurrence')),
  'Lazy Research celestialKinds do not refine only physical celestial occurrences.'
);

const canonicalChildren = canonical.events.filter(event => parentId(event));
const canonicalParentIds = new Set(canonicalChildren.map(parentId));
check(canonicalChildren.length === 560, `Series occurrence inventory changed (${canonicalChildren.length}/560).`);
check(canonicalParentIds.size === 137, `Series parent inventory changed (${canonicalParentIds.size}/137).`);
for (const child of canonicalChildren) {
  const projected = publicById.get(child.id);
  const expectedParent = parentId(child);
  check(canonicalById.has(expectedParent), `Series child ${child.id} references missing canonical parent ${expectedParent}.`);
  check(projected?.relations?.series_id === expectedParent && projected?.relations?.parent_id === expectedParent && projected?.relations?.role === 'occurrence', `Series child ${child.id} lost its projected parent link.`);
  check(projected?.relations?.occurrence_count > 0, `Series child ${child.id} has no occurrence count.`);
}
for (const id of canonicalParentIds) {
  const projected = publicById.get(id);
  check(projected?.relations?.series_id === id && projected?.relations?.role === 'parent', `Series parent ${id} is not projected as a parent.`);
}

const sortFixture = [
  { id: 'bravo', title: 'Bravo', date: '2026-08-20', temporal: { start: '2026-08-20' }, _matchScore: 2, last_checked_at: '2026-08-10' },
  { id: 'alpha', title: 'Alpha', date: '2026-08-22', temporal: { start: '2026-08-22' }, _matchScore: 9, last_checked_at: '2026-08-12' },
  { id: 'charlie', title: 'Charlie', date: '2026-08-21', temporal: { start: '2026-08-21' }, _matchScore: 4, last_checked_at: '2026-08-11' }
];
const idsForSort = sort => core.sortRecords(sortFixture, sort).map(event => event.id).join(',');
check(idsForSort('soonest') === 'bravo,charlie,alpha', 'Explicit Soonest sort is not honored.');
check(idsForSort('latest') === 'alpha,charlie,bravo', 'Explicit Farthest/latest sort is not honored.');
check(idsForSort('title') === 'alpha,bravo,charlie', 'Explicit Title sort is not honored.');
check(idsForSort('relevance') === 'alpha,charlie,bravo', 'Explicit Relevance sort is not honored.');
check(idsForSort('checked') === 'alpha,charlie,bravo', 'Explicit Recently checked sort is not honored.');
for (const sort of ['soonest', 'latest', 'title']) {
  const sorted = core.sortRecords(chronology, sort);
  check(sorted.every((event, index) => index === 0 || core.compareRecords(sorted[index - 1], event, sort) <= 0), `Production ${sort} sort has an inversion.`);
}
check(sortFixture.map(event => event.id).join(',') === 'bravo,alpha,charlie', 'Sorting mutates its input records.');

const grouped = core.groupSeries(chronology, 'soonest');
const groupedSeries = grouped.filter(group => group.type === 'series');
const standalone = chronology.filter(event => !core.normalizedRelation(event).id).length;
const projectedSeriesIds = new Set(chronology.map(core.normalizedRelation).map(relation => relation.id).filter(Boolean));
check(grouped.length === standalone + projectedSeriesIds.size, 'List grouping does not produce exactly one result per series plus each standalone record.');
check(groupedSeries.length === projectedSeriesIds.size, 'A series appears more or less than once in grouped list results.');
check(groupedSeries.every(group => group.events.length === (group.parent ? 1 : 0) + group.occurrences.length), 'A grouped series drops or duplicates records.');
check(grouped.reduce((sum, group) => sum + group.events.length, 0) === chronology.length, 'Grouped list results do not account for every raw chronology record exactly once.');
check(chronology.filter(event => core.normalizedRelation(event).role === 'occurrence').length === canonicalChildren.filter(event => chronologyIdSet.has(event.id)).length, 'Calendar occurrence inventory differs from the raw chronology contract.');
check(core.groupSeries(sortFixture).length === sortFixture.length, 'Standalone list records are incorrectly collapsed.');

const pageFixture = Array.from({ length: 61 }, (_, index) => ({ id: String(index + 1) }));
const pageThree = core.paginate(pageFixture, 3, 24);
check(pageThree.page === 3 && pageThree.pages === 3 && pageThree.total === 61 && pageThree.items.length === 13 && pageThree.items[0].id === '49', 'URL-backed pagination boundaries are wrong.');
check(core.paginate(pageFixture, 99, 24).page === 3, 'Pagination does not clamp an out-of-range URL page.');

function jsonLdBlocks(html, label) {
  const blocks = [];
  const pattern = /<script\b[^>]*\btype=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(pattern)) {
    try {
      blocks.push(JSON.parse(match[1]));
    } catch (error) {
      check(false, `${label} contains invalid JSON-LD: ${error.message}.`);
    }
  }
  return blocks;
}

const shellSpecs = [
  ['polymythseminars/index.html', 'main', 'en-CA', 'https://seminarschools.com/polymythseminars/'],
  ['polymythseminars/fr/index.html', 'main', 'fr-CA', 'https://seminarschools.com/polymythseminars/fr/'],
  ['polymythseminars/research/index.html', 'research', 'en-CA', 'https://seminarschools.com/polymythseminars/research/'],
  ['polymythseminars/fr/research/index.html', 'research', 'fr-CA', 'https://seminarschools.com/polymythseminars/fr/research/'],
  ['polymythseminars/monitoring/index.html', 'monitoring', 'en-CA', 'https://seminarschools.com/polymythseminars/monitoring/'],
  ['polymythseminars/fr/monitoring/index.html', 'monitoring', 'fr-CA', 'https://seminarschools.com/polymythseminars/fr/monitoring/'],
];
const shellHtml = new Map();
for (const [relative, shellSurface, language, canonicalUrl] of shellSpecs) {
  check(exists(relative), `${relative} is missing.`);
  const html = exists(relative) ? textFile(relative) : '';
  const publicRelative = `public/${relative}`;
  shellHtml.set(relative, html);
  check(exists(publicRelative), `${publicRelative} is missing.`);
  if (exists(publicRelative)) check(read(relative).equals(read(publicRelative)), `${publicRelative} is not a byte-identical deploy mirror.`);
  check(html.includes(`<html lang="${language}">`), `${relative} has the wrong document language.`);
  check(html.includes(`data-pmd-surface="${shellSurface}"`), `${relative} has the wrong discovery surface.`);
  check(html.includes(`<link rel="canonical" href="${canonicalUrl}">`), `${relative} has the wrong canonical URL.`);
  check(html.includes(`name="ss-build" content="${release.polymythcal_discovery_asset_version}"`), `${relative} is not bound to the Discovery asset version.`);
  const coreAsset = `/js/polymythcal-discovery-core.js?v=${release.polymythcal_discovery_asset_version}`;
  const runtimeAsset = `/js/polymythcal-discovery.js?v=${release.polymythcal_discovery_asset_version}`;
  check(html.indexOf(coreAsset) >= 0 && html.indexOf(coreAsset) < html.indexOf(runtimeAsset), `${relative} does not load the tested core before the runtime.`);
  const schemas = jsonLdBlocks(html, relative);
  const pageSchema = schemas.find(item => item?.['@type'] === 'CollectionPage');
  check(Boolean(pageSchema), `${relative} has no CollectionPage JSON-LD.`);
  check(pageSchema?.url === canonicalUrl && pageSchema?.['@id'] === `${canonicalUrl}#webpage`, `${relative} JSON-LD URL identity is stale.`);
  check(pageSchema?.inLanguage === language, `${relative} JSON-LD language is stale.`);
  check(Boolean(pageSchema?.name && pageSchema?.description), `${relative} JSON-LD lacks localized name or description.`);
  check(!schemas.some(item => item?.['@type'] === 'Event'), `${relative} shell incorrectly emits Event JSON-LD.`);
}

const mainEn = shellHtml.get('polymythseminars/index.html') || '';
const mainFr = shellHtml.get('polymythseminars/fr/index.html') || '';
const researchEn = shellHtml.get('polymythseminars/research/index.html') || '';
const researchFr = shellHtml.get('polymythseminars/fr/research/index.html') || '';
for (const [relative, html] of [['EN main', mainEn], ['FR main', mainFr]]) {
  check(html.includes('id="pmdCommonFilters"'), `${relative} has no common-filter mount.`);
  check(!html.includes('id="pmdResearchFilters"') && !html.includes('id="pmdFacetSearch"'), `${relative} exposes specialist controls in its DOM/tab order.`);
}
for (const [relative, html] of [['EN Research', researchEn], ['FR Research', researchFr]]) {
  check(html.includes('id="pmdResearchFilters"') && html.includes('id="pmdFacetSearch"'), `${relative} has no staged specialist workbench.`);
  check(html.includes('data-pmd-research-source="/polymythseminars/research.json"'), `${relative} does not lazy-bind the specialist projection.`);
}
check(mainEn.includes('href="/polymythseminars/research/" data-state-link="research"'), 'EN Calendar has no connected Research route.');
check(mainFr.includes('href="/polymythseminars/fr/research/" data-state-link="research"'), 'FR Calendar has no connected Research route.');
check(researchEn.includes('href="/polymythseminars/" data-state-link="main"'), 'EN Research has no connected Calendar route.');
check(researchFr.includes('href="/polymythseminars/fr/" data-state-link="main"'), 'FR Research has no connected Calendar route.');

for (const token of [
  "const COMMON_AXES = Object.freeze(['kind', 'date', 'places', 'topics', 'audiences', 'formats'])",
  "const RESEARCH_ONLY_AXES = Object.freeze([",
  'function urlNeedsResearchProjection()',
  "if (surface === 'research') return true",
  "if (surface !== 'main') return false",
  'RESEARCH_ONLY_AXES.some(',
  'if (urlNeedsResearchProjection())',
  'CORE.mergeResearchProjection(candidate, researchCandidate)',
  "window.addEventListener('popstate'",
  'function targetUrl(',
  'function updateStateLinks()',
  "link.href = targetUrl(target",
]) check(controllerSource.includes(token), `Connected Calendar/Research state contract misses ${token}.`);
check(
  controllerSource.includes("if (targetSurface === 'monitoring' && RESEARCH_ONLY_AXES.includes(key)) continue")
    && controllerSource.includes("for (const key of [...axes.keys()].sort())"),
  'Specialist URL state is not preserved across Calendar/Research while being excluded from monitoring.'
);

for (const token of [
  'data-intent-axis="what" data-intent-value="event:celestial-occurrence"',
  'data-intent-axis="topics" data-intent-values=',
  'data-intent-axis="what" data-intent-value="event:seasonal-observance"',
  'data-intent-axis="what" data-intent-value="event:ritual-observance"',
  "normalized === 'celestial' || normalized === 'celeste'",
]) check(controllerSource.includes(token), `Celestial three-way search assistance misses ${token}.`);
check(mainEn.includes('?what=event%3Acelestial-occurrence'), 'Main Calendar lacks a direct broad celestial-occurrence entry point.');

for (const token of [
  'CORE.searchMatch(', 'CORE.matchesFacets(', 'CORE.facetCounts(', 'CORE.sortRecords(',
  'CORE.compareRecords(', 'CORE.groupSeries(', 'CORE.paginate(',
]) check(controllerSource.includes(token), `Production runtime is not wired to tested core behavior ${token}.`);

for (const [relative, html] of shellHtml) {
  check(html.includes('id="pmdSearch"') && html.includes('aria-describedby="pmdSearchHelp pmdSearchStatus"'), `${relative} search help is not programmatically connected.`);
  check(html.includes('id="pmdSearchStatus"') && html.includes('role="status" aria-live="polite"'), `${relative} lacks a polite search status.`);
  check(html.includes('id="pmdResults" aria-busy="true" aria-labelledby="pmdResultsTitle"'), `${relative} results have no accessible name/busy state.`);
  check(html.includes('id="pmdResultsTitle" tabindex="-1"'), `${relative} results heading cannot receive restored focus.`);
  check(html.includes('id="pmdLiveStatus" class="pmd-live-status" role="status" aria-live="polite"'), `${relative} lacks a live result announcement.`);
  check(html.includes('id="pmdMobileBar" hidden') && html.includes('id="pmdMobileResults" href="#pmdResults"'), `${relative} lacks the mobile View Results escape route.`);
}
for (const token of [
  'aria-label="${escapeHtml(COPY.remove(item.label))}"',
  'function focusToken(', 'function restoreFocus(',
  '<table class="pmd-calendar-table">', '<caption>', '<th scope="col">',
  'class="pmd-calendar-agenda"',
]) check(controllerSource.includes(token), `Accessibility/focus/calendar source contract misses ${token}.`);
check(!controllerSource.includes("event.key === 'ArrowLeft'") && !controllerSource.includes("event.key === 'ArrowRight'"), 'Global arrow keys can still change calendar months.');
check(controllerSource.includes('event.key !== \'/\'') && controllerSource.includes('event.target instanceof HTMLInputElement'), 'Search shortcut does not avoid editable controls.');

for (const token of [
  'font-size: 1rem', 'min-height: 44px', 'min-height: 58px',
  '@media (max-width: 47.5rem)', '.pmd-filter-grid { grid-template-columns: 1fr; }',
  '.pmd-calendar-table-wrap { display: none; }', '.pmd-calendar-agenda { display: block; }',
  '.pmd-mobile-bar:not([hidden])', '.pmd-mobile-bar > * { min-height: 48px',
  '@media (max-width: 23rem)', '@media (prefers-reduced-motion: reduce)',
  '@media (forced-colors: active)',
]) check(discoveryCss.includes(token), `Responsive/accessibility CSS contract misses ${token}.`);

function colorOccurrences(css, variable) {
  return [...css.matchAll(new RegExp(`${variable.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*(#[0-9a-f]{6})`, 'gi'))].map(match => match[1]);
}
function relativeLuminance(hex) {
  const channels = hex.slice(1).match(/.{2}/g).map(value => Number.parseInt(value, 16) / 255).map(value => (
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  ));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}
function contrastRatio(left, right) {
  const a = relativeLuminance(left);
  const b = relativeLuminance(right);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
const themeBackgrounds = colorOccurrences(themeCss, '--bg');
const themeSurfaces = colorOccurrences(themeCss, '--bg-soft');
const themeInks = colorOccurrences(themeCss, '--fg');
const pmdMuted = colorOccurrences(discoveryCss, '--pmd-muted');
const pmdAccent = colorOccurrences(discoveryCss, '--pmd-accent');
const pmdControl = colorOccurrences(discoveryCss, '--pmd-control-rule');
const contrastThemes = [
  ['light', themeBackgrounds[0], themeSurfaces[0], themeInks[0], pmdMuted[0], pmdAccent[0], pmdControl[0]],
  ['dark', themeBackgrounds[1], themeSurfaces[1], themeInks[1], pmdMuted[1], pmdAccent[1], pmdControl[1]],
];
for (const [name, background, surfaceColor, ink, muted, accent, control] of contrastThemes) {
  check([background, surfaceColor, ink, muted, accent, control].every(Boolean), `${name} contrast tokens cannot be resolved.`);
  if (![background, surfaceColor, ink, muted, accent, control].every(Boolean)) continue;
  for (const [label, foreground] of [['ink', ink], ['muted', muted], ['accent/focus', accent]]) {
    check(Math.min(contrastRatio(foreground, background), contrastRatio(foreground, surfaceColor)) >= 4.5, `${name} ${label} text/focus contrast is below 4.5:1.`);
  }
  check(Math.min(contrastRatio(control, background), contrastRatio(control, surfaceColor)) >= 3, `${name} control boundary contrast is below 3:1.`);
}

check(exists('polymythseminars/events.json'), 'Build-only canonical events mirror is missing.');
check(read('polymythseminars/events.json').equals(read('data/polymyth-seminar-events.json')), 'Build-only events mirror differs from the canonical corpus.');
check(!exists('public/polymythseminars/events.json'), 'Full internal events.json leaked into public/.');
for (const relative of [
  'polymythseminars/browse.json', 'polymythseminars/watchlist.json', 'polymythseminars/research.json',
  'js/polymythcal-discovery-core.js', 'js/polymythcal-discovery.js', 'css/polymythcal-discovery.css',
]) {
  check(exists(`public/${relative}`), `public/${relative} is missing.`);
  if (exists(`public/${relative}`)) check(read(relative).equals(read(`public/${relative}`)), `public/${relative} differs from its source projection/runtime.`);
}
check(
  ['/polymythseminars/browse.json', '/polymythseminars/watchlist.json', '/polymythseminars/research.json']
    .every(route => headersSource.includes(`${route}\n  Cache-Control: public, max-age=300, must-revalidate`)),
  'Safe discovery projections do not share the bounded 300-second cache policy.'
);
check(headersSource.includes('/polymythseminars/events.json\n  Cache-Control: no-store, max-age=0'), 'Blocked full events.json route is not marked no-store.');
for (const token of [
  "'polymythseminars/events.json'", "'polymythcal-publication-surfaces-v2'",
  "'chronology_ids'", "'watchlist_ids'", "'monitoring-marker'",
]) {
  check(textFile('scripts/build-public-deploy.js').includes(token), `Public builder boundary misses ${token}.`);
  check(textFile('scripts/verify-public-deploy-parity.js').includes(token), `Public parity boundary misses ${token}.`);
}

for (const event of chronology) {
  const source = canonicalById.get(event.id);
  const clockBearing = CLOCK_PRECISIONS.has(source.time_precision);
  if (clockBearing) {
    check(event.date === source.date, `Verified clock changed on ${event.id}.`);
    if (source.end_date) check(event.end_date === source.end_date, `Verified end clock changed on ${event.id}.`);
  } else {
    check(/^\d{4}-\d{2}-\d{2}$/.test(event.date), `Unverified clock leaked from ${event.id}.`);
    check(event.date === String(source.date).slice(0, 10), `Date-only projection changed calendar day on ${event.id}.`);
    if (source.end_date) {
      check(/^\d{4}-\d{2}-\d{2}$/.test(event.end_date), `Unverified end clock leaked from ${event.id}.`);
      check(event.end_date === String(source.end_date).slice(0, 10), `Date-only end projection changed calendar day on ${event.id}.`);
    }
  }
}

function utcIcsStamp(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}
function dateIcsStamp(value) {
  return String(value || '').slice(0, 10).replaceAll('-', '');
}
function nextDateIcsStamp(value) {
  const day = String(value || '').slice(0, 10);
  const parsed = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return '';
  parsed.setUTCDate(parsed.getUTCDate() + 1);
  return parsed.toISOString().slice(0, 10).replaceAll('-', '');
}

for (const event of chronology) {
  const source = canonicalById.get(event.id);
  const projectedTemporal = projectTemporal(source, false);
  check(TEMPORAL_TYPES.includes(event.temporal?.type), `Chronology event ${event.id} has an unknown temporal type.`);
  check(event.temporal?.type === temporalType(source, false), `Chronology event ${event.id} temporal type differs from the canonical policy.`);
  check(JSON.stringify(event.temporal) === JSON.stringify(projectedTemporal), `Chronology event ${event.id} temporal projection is not canonical.`);
  if (['global-instant', 'local-date-time', 'deadline'].includes(event.temporal?.type)) {
    check(core.validTimeZone(event.temporal?.timezone), `Chronology event ${event.id} has no valid IANA timezone.`);
  } else {
    check(!Object.hasOwn(event.temporal || {}, 'timezone'), `Chronology event ${event.id} exposes an inapplicable timezone.`);
  }

  const detailRelative = `polymythseminars/events/${event.id}/index.html`;
  const icsRelative = `polymythseminars/ics/${event.id}.ics`;
  check(exists(detailRelative), `Dated detail route is missing for ${event.id}.`);
  check(exists(icsRelative), `Dated ICS file is missing for ${event.id}.`);
  if (!exists(detailRelative) || !exists(icsRelative)) continue;
  const detail = textFile(detailRelative);
  const ics = textFile(icsRelative);
  check(detail.includes('data-publication-surface="chronology"'), `Dated detail ${event.id} has the wrong publication surface.`);
  check(detail.includes(`href="/polymythseminars/ics/${event.id}.ics"`), `Dated detail ${event.id} has no matching calendar action.`);
  const timeMatch = detail.match(/<time\s+datetime="([^"]+)"/i);
  check(Boolean(timeMatch), `Dated detail ${event.id} has no machine-readable time.`);
  const publicStart = timeMatch?.[1] || '';
  if (source.time_precision === 'exact') {
    check(Date.parse(publicStart) === Date.parse(source.date), `Dated detail ${event.id} changes the verified instant.`);
    check(core.zonedCalendarDay(source.date, event.temporal) === publicStart.slice(0, 10), `Dated detail ${event.id} disagrees with the card calendar day policy.`);
    check(Boolean(core.temporalClock(source.date, event.temporal, 'en-CA')), `Dated card clock cannot be formatted for ${event.id}.`);
    check(ics.includes(`DTSTART:${utcIcsStamp(source.date)}`), `ICS ${event.id} disagrees with the verified start instant.`);
  } else {
    check(publicStart === String(event.date).slice(0, 10), `Dated detail ${event.id} changes the all-day/estimated calendar day.`);
    check(ics.includes(`DTSTART;VALUE=DATE:${dateIcsStamp(event.date)}`), `ICS ${event.id} disagrees with the date-only start policy.`);
  }
  if (event.end_date) {
    if (source.time_precision === 'exact') {
      check(ics.includes(`DTEND:${utcIcsStamp(source.end_date)}`), `ICS ${event.id} disagrees with the verified end instant.`);
    } else {
      check(ics.includes(`DTEND;VALUE=DATE:${nextDateIcsStamp(event.end_date)}`), `ICS ${event.id} disagrees with the inclusive date-range policy.`);
    }
  }
  const eventSchemas = jsonLdBlocks(detail, detailRelative).filter(item => item?.['@type'] === 'Event');
  for (const schema of eventSchemas) {
    check(schema.startDate === publicStart, `Event JSON-LD and visible detail time disagree for ${event.id}.`);
    check(schema.url === `https://seminarschools.com/polymythseminars/events/${encodeURIComponent(event.id)}/`, `Event JSON-LD route is stale for ${event.id}.`);
    if (event.content_language) check(schema.inLanguage === event.content_language, `Event JSON-LD language differs from content_language for ${event.id}.`);
  }
  if (event.content_language) {
    check(detail.includes(`<h1 lang="${event.content_language}">`), `Dated detail ${event.id} does not mark its title language.`);
    if (event.description) check(detail.includes(`<p lang="${event.content_language}">`), `Dated detail ${event.id} does not mark its description language.`);
  }
}

for (const event of watched) {
  const source = canonicalById.get(event.id);
  check(JSON.stringify(event.temporal) === JSON.stringify(projectTemporal(source, true)), `Watch detail ${event.id} does not use the canonical undated temporal policy.`);
  const detailRelative = `polymythseminars/events/${event.id}/index.html`;
  const icsRelative = `polymythseminars/ics/${event.id}.ics`;
  check(exists(detailRelative), `Stable monitoring detail route is missing for ${event.id}.`);
  check(!exists(icsRelative), `Monitoring record ${event.id} leaked into an individual ICS file.`);
  if (!exists(detailRelative)) continue;
  const detail = textFile(detailRelative);
  check(detail.includes('data-publication-surface="watchlist"'), `Monitoring detail ${event.id} has the wrong publication surface.`);
  check(!/<time\s+datetime=/i.test(detail), `Monitoring detail ${event.id} exposes its operational marker as a public date.`);
  check(!detail.includes(`/polymythseminars/ics/${event.id}.ics`), `Monitoring detail ${event.id} offers an ICS action.`);
  check(!jsonLdBlocks(detail, detailRelative).some(item => item?.['@type'] === 'Event'), `Monitoring detail ${event.id} emits Event JSON-LD.`);
  if (event.content_language) {
    check(detail.includes(`<h1 lang="${event.content_language}">`), `Monitoring detail ${event.id} does not mark its title language.`);
    if (event.description) check(detail.includes(`<p lang="${event.content_language}">`), `Monitoring detail ${event.id} does not mark its description language.`);
  }
}

function filesUnder(relative, predicate = () => true) {
  const root = path.join(ROOT, relative);
  if (!fs.existsSync(root)) return [];
  const files = [];
  const visit = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile() && predicate(full)) files.push(full);
    }
  };
  visit(root);
  return files;
}
const markerPattern = new RegExp(markerIds.map(id => id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'));
const datedAggregateFiles = [
  path.join(ROOT, 'polymythseminars/feed.xml'),
  ...filesUnder('polymythseminars/feeds', file => /\.(?:xml|ics)$/i.test(file)),
  ...filesUnder('polymythseminars/ics', file => /\.ics$/i.test(file)),
].filter(file => fs.existsSync(file));
check(datedAggregateFiles.length > 1, 'Dated RSS/ICS aggregate surfaces are missing.');
for (const file of datedAggregateFiles) {
  check(!markerPattern.test(fs.readFileSync(file, 'utf8')), `Monitoring identifier leaked into dated surface ${path.relative(ROOT, file)}.`);
}
for (const token of [
  "sid not in chronology_public:continue", "calendar_action='' if is_watch",
  "schema_markup=f'<script type=\"application/ld+json\">", 'set(chronology_public)',
]) check(detailBuilderSource.includes(token), `Detail/ICS publication boundary misses ${token}.`);
for (const token of ['chronology_ids, watchlist_ids', 'excluded {len(watchlist_ids)} watchlist records']) {
  check(feedBuilderSource.includes(token), `Feed publication boundary misses ${token}.`);
}
check(controllerSource.includes("String(event.content_language || 'und').trim()") && !controllerSource.includes('source_language'), 'Card language-of-parts does not use only safe content_language.');
check(controllerSource.includes('lang="${escapeHtml(lang)}"') && controllerSource.includes('lang="${escapeHtml(eventLanguage(representative))}"'), 'Cards/series do not mark source-language content.');
check(detailBuilderSource.includes("content_language=str(public_record.get('content_language') or '')") && !detailBuilderSource.includes("public_record.get('source_language')"), 'Detail language-of-parts reads an unsafe raw language field.');

const typedActionKinds = new Set(PUBLIC_ACTION_CANDIDATE_FIELDS.map(([, kind]) => kind));
const unavailableWithSafeCandidates = [];
const recoveredUnavailable = [];
const recoveredUnavailableByKind = Object.fromEntries([...typedActionKinds].map(kind => [kind, 0]));
let typedActionRecordCount = 0;
let typedActionCount = 0;
for (const source of canonical.events) {
  const projected = publicById.get(source.id);
  const actions = projected?.actions || [];
  check(Array.isArray(actions) && actions.length > 0, `Public record ${source.id} has no action model.`);
  const urls = actions.map(action => action?.url);
  check(new Set(urls).size === urls.length, `Public record ${source.id} contains duplicate action URLs.`);
  check(actions.every(action => ['listing', 'event', 'occurrence', 'series', 'organizer', 'source'].includes(action?.scope)), `Public record ${source.id} has a dishonest/unknown action scope.`);
  check(actions.every(action => core.safeHttpUrl(action?.url)), `Public record ${source.id} has an unsafe action URL.`);
  check(
    actions.filter(action => action.kind === 'details').length === 1
      && actions.some(action => action.kind === 'details' && action.scope === 'listing' && action.url === projected.route),
    `Public record ${source.id} lacks one exact stable detail action.`
  );
  check(actions.filter(action => action.kind === 'source').every(action => action.scope === 'source'), `Public record ${source.id} promotes a general source as an exact listing action.`);

  const expectedScope = parentId(source) || source.series_role === 'parent' || source.destination_scope === 'series'
    ? 'series'
    : 'listing';
  const typedCandidates = [];
  const candidateUrls = new Set();
  for (const [field, kind] of PUBLIC_ACTION_CANDIDATE_FIELDS) {
    const url = String(source[field] || '');
    if (!url.startsWith('https://') || candidateUrls.has(url)) continue;
    candidateUrls.add(url);
    typedCandidates.push({ field, kind, url });
    check(actions.some(action => action.kind === kind && action.url === url && action.scope === expectedScope), `Public record ${source.id} suppresses or mis-scopes safe ${field}.`);
  }
  const typed = actions.filter(action => typedActionKinds.has(action.kind));
  if (typed.length) typedActionRecordCount += 1;
  typedActionCount += typed.length;
  if (source.destination_status === 'unavailable-specific-page' && typedCandidates.length) {
    unavailableWithSafeCandidates.push(source.id);
    if (typedCandidates.every(candidate => actions.some(action => action.kind === candidate.kind && action.url === candidate.url))) {
      recoveredUnavailable.push(source.id);
      for (const kind of new Set(typedCandidates.map(candidate => candidate.kind))) recoveredUnavailableByKind[kind] += 1;
    }
  }

  const destinationAvailable = String(source.destination_url || '').startsWith('https://')
    && source.destination_status !== 'unavailable-specific-page';
  const sourceUrl = String(source.source_url || '');
  const sourceClaimedElsewhere = destinationAvailable && source.destination_url === sourceUrl
    || candidateUrls.has(sourceUrl);
  if (sourceUrl.startsWith('https://') && !sourceClaimedElsewhere) {
    check(actions.some(action => action.kind === 'source' && action.scope === 'source' && action.url === sourceUrl), `Source-only URL for ${source.id} was suppressed or promoted.`);
  }
}
check(unavailableWithSafeCandidates.length === 108, `Safe unavailable-destination candidate inventory changed (${unavailableWithSafeCandidates.length}/108).`);
check(recoveredUnavailable.length === unavailableWithSafeCandidates.length, `Only ${recoveredUnavailable.length}/${unavailableWithSafeCandidates.length} safe unavailable-destination candidates were recovered.`);
check(
  JSON.stringify(recoveredUnavailableByKind) === JSON.stringify({ registration: 62, application: 16, submission: 30, rules: 0, tickets: 0, stream: 0 }),
  `Recovered typed-action kinds changed: ${JSON.stringify(recoveredUnavailableByKind)}.`
);
for (const label of ['registration: \'Register\'', 'application: \'Apply\'', 'submission: \'Submit\'', 'rules: \'Rules\'', 'source: \'Source record\'']) {
  check(controllerSource.includes(label), `English typed-action label is missing: ${label}.`);
}
for (const label of ["registration: 'S’inscrire'", "application: 'Postuler'", "submission: 'Soumettre'", "rules: 'Règlement'", "source: 'Fiche source'"]) {
  check(controllerSource.includes(label), `French typed-action label is missing: ${label}.`);
}

const browserBytes = read('polymythseminars/browse.json');
const browserGzipBytes = zlib.gzipSync(browserBytes, { level: 9 }).length;
const watchlistBytes = read('polymythseminars/watchlist.json');
const researchBytes = read('polymythseminars/research.json');
const watchlistGzipBytes = zlib.gzipSync(watchlistBytes, { level: 9 }).length;
const researchGzipBytes = zlib.gzipSync(researchBytes, { level: 9 }).length;
check(browserGzipBytes <= 360000, `Main discovery payload gzip budget exceeded (${browserGzipBytes}/360000).`);
check(watchlistGzipBytes <= 40000, `Monitoring payload gzip budget exceeded (${watchlistGzipBytes}/40000).`);
check(researchGzipBytes <= 280000, `Lazy Research payload gzip budget exceeded (${researchGzipBytes}/280000).`);
check(report.schema === browse._schema, 'Discovery report schema is stale.');
check(report.canonical_count === canonical.events.length, 'Discovery report canonical count is stale.');
check(report.chronology_count === chronology.length, 'Discovery report chronology count is stale.');
check(report.watchlist_count === watched.length, 'Discovery report watchlist count is stale.');
check(report.series_parent_count === canonicalParentIds.size, 'Discovery report series parent count is stale.');
check(report.series_occurrence_count === canonicalChildren.length, 'Discovery report series occurrence count is stale.');
check(report.browser_raw_bytes === browserBytes.length, 'Discovery report browser size is stale.');
check(report.browser_gzip_bytes === browserGzipBytes, 'Discovery report browser gzip size is stale.');
check(report.watchlist_raw_bytes === watchlistBytes.length, 'Discovery report watchlist size is stale.');
check(report.watchlist_gzip_bytes === watchlistGzipBytes, 'Discovery report watchlist gzip size is stale.');
check(report.research_raw_bytes === researchBytes.length, 'Discovery report Research size is stale.');
check(report.research_gzip_bytes === researchGzipBytes, 'Discovery report Research gzip size is stale.');
check(JSON.stringify(report.persisted_search_groups) === JSON.stringify(PERSISTED_SEARCH_GROUPS), 'Discovery report persisted search groups are stale.');
check(JSON.stringify(report.derived_search_groups) === JSON.stringify(SEARCH_GROUPS), 'Discovery report derived search groups are stale.');
check(
  JSON.stringify(report.typed_action_candidate_fields) === JSON.stringify(PUBLIC_ACTION_CANDIDATE_FIELDS.map(([field, kind]) => ({ field, kind }))),
  'Discovery report typed-action candidate allowlist is stale.'
);
check(report.unavailable_with_safe_candidate_count === unavailableWithSafeCandidates.length, 'Discovery report unavailable candidate count is stale.');
check(report.typed_action_recovered_unavailable_record_count === recoveredUnavailable.length, 'Discovery report recovered candidate count is stale.');
check(JSON.stringify(report.typed_action_recovered_unavailable_by_kind) === JSON.stringify(recoveredUnavailableByKind), 'Discovery report recovered candidate kinds are stale.');
check(report.typed_action_total_record_count === typedActionRecordCount, 'Discovery report typed-action record count is stale.');
check(report.typed_action_total_action_count === typedActionCount, 'Discovery report typed-action total is stale.');
check(report.typed_action_recovery_complete === true, 'Discovery report does not certify complete typed-action recovery.');

if (failures.length) {
  console.error('POLYMYTHCAL DISCOVERY V2 CHECK FAILED');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log(
  `POLYMYTHCAL DISCOVERY V2 PASSED — ${chronology.length} chronology + ${watched.length} watchlist; ` +
  `${canonicalChildren.length} occurrences in ${canonicalParentIds.size} series; ${browserGzipBytes} main gzip bytes; ` +
  'Unicode, collision, facet, celestial, series, temporal, accessibility, SEO, and public-boundary gates passed.'
);
