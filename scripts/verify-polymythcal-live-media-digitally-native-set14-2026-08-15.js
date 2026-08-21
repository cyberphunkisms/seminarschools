#!/usr/bin/env node
'use strict';

/** Verify Set 14 research, identity-safe import, and public propagation. */
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const sourceOnly = process.argv.includes('--source-only');
const readJson = rel => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
const readText = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = rel => fs.existsSync(path.join(root, rel));
const assert = (ok, message) => { if (!ok) throw new Error(message); };
const list = doc => Array.isArray(doc) ? doc : (doc.events || []);
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const hasValue = value => !(
  value === undefined || value === null || value === '' ||
  (Array.isArray(value) && value.length === 0)
);

const SRC = 'manual-polymythcal-live-media-digitally-native-set14-2026-08-15';
const SET = '14-Live-Media-and-Digitally-Native-Events';
const META = 'polymythcal_live_media_digitally_native_set14_update_2026_08_15';
const SOURCE_META = 'polymythcal_live_media_digitally_native_set14_2026_08_15';
const FORMATS = [
  'live-podcast', 'public-radio-recording', 'media-taping',
  'livestreamed-discussion', 'ama', 'virtual-conference',
  'virtual-exhibition', 'virtual-festival', 'creator-livestream',
  'creator-watch-party', 'game-stream', 'vr-ar-event', 'online-premiere',
  'platform-native-cultural-event'
];
const SYNCHRONOUS = [
  'live', 'live-and-replay', 'scheduled-premiere',
  'asynchronous-bounded', 'hybrid'
];
const LOCKED_FIELDS = [
  'live_digital_formats', 'platform_names', 'synchronous_status',
  'audience_interaction_routes', 'recording_availability', 'digital_evidence',
  'set14_classified_at'
];
const DETAIL_FIELDS = [
  'event_format', 'online_location', 'platform', 'liveness_status',
  'synchronicity', 'audience_interaction', 'interaction_status',
  'interaction_evidence', 'access_status', 'registration_required',
  'registration_url', 'access_route', 'replay_archive_status',
  'recording_evidence', 'creator_participation_status',
  'creator_participation_evidence', 'occurrence_evidence',
  'replay_source_field'
];
const SET_FIELDS = [...LOCKED_FIELDS, ...DETAIL_FIELDS];
const PROTECTED_FIELDS = [
  'id', 'identity_key', 'occurrence_key', 'date', 'end_date', 'title',
  'source_url', 'source_id', 'source_name', 'source_quality',
  'confirmation_status', 'qualification_reasons', 'lifecycle_status'
];

const manualDoc = readJson('data/manual-events.json');
const manual = list(manualDoc);
const manualById = new Map(manual.map(event => [String(event.id || ''), event]));
const batch = manual.filter(event => event._src === SRC);
const tagged = manual.filter(event => Array.isArray(event.live_digital_formats) && event.live_digital_formats.length);
const ledger = readJson('data/polymythcal-research-set-14-live-media-digitally-native-2026-08-15.json');
const exclusions = readJson('data/polymythcal-research-set-14-live-media-digitally-native-exclusions-2026-08-15.json');
const inserted = ledger.records.filter(row => row.record_action === 'insert');
const crossTags = ledger.records.filter(row => row.record_action === 'cross-tag-existing');
const crossById = new Map(crossTags.map(row => [row.id, row]));
const sourcesDoc = readJson('scripts/sources.json');
const sourceRows = sourcesDoc.sources || [];
const sourceIds = new Set(sourceRows.map(source => String(source.id || '')));
const schema = readJson('data/polymythcal-event-schema-v2.json');

assert(ledger.source_batch === SRC && ledger.research_set === SET, 'Set 14 ledger identity drifted');
assert(ledger.record_count === 144 && inserted.length === 54 && crossTags.length === 90, 'Set 14 54/90 action split drifted');
assert(ledger.new_record_count === 54 && ledger.cross_tagged_existing_count === 90, 'Set 14 ledger accounting drifted');
assert(ledger.source_count === 22 && (ledger.sources || []).length === 22, 'Set 14 source ledger count drifted');
assert(ledger.exclusion_count === 11 && exclusions.exclusion_count === 11 && exclusions.exclusions.length === 11, 'Set 14 exclusion ledger drifted');
assert(equal([...ledger.cross_tagged_existing_ids].sort(), crossTags.map(row => row.id).sort()), 'Set 14 cross-tag ID ledger drifted');
assert(new Set(ledger.records.map(row => row.id)).size === 144, 'Set 14 ledger IDs are not unique');
assert(new Set(ledger.sources.map(row => row.id)).size === 22, 'Set 14 source IDs are not unique');

for (const row of ledger.records) {
  assert(Array.isArray(row.live_digital_formats) && row.live_digital_formats.length, `${row.id}: Set 14 format missing`);
  assert(row.live_digital_formats.every(value => FORMATS.includes(value)), `${row.id}: invalid Set 14 format`);
  assert(SYNCHRONOUS.includes(row.synchronous_status), `${row.id}: synchronous status is not normalized`);
  for (const field of LOCKED_FIELDS) assert(hasValue(row[field]), `${row.id}: locked ${field} missing`);
  assert(!Object.hasOwn(row, 'set14_formats'), `${row.id}: deprecated set14_formats survived`);
  assert(!JSON.stringify(row).includes('creator-participating-watch-party'), `${row.id}: deprecated watch-party alias survived`);
  assert(!JSON.stringify(row).includes('game-stream-event'), `${row.id}: deprecated game-stream alias survived`);
  if (row.record_action === 'insert') {
    assert(row._src === SRC && row.entry_family === 'live-media-digital-native', `${row.id}: insert provenance drifted`);
    assert(row.research_set === SET && row.record_kind === 'event', `${row.id}: research/event contract drifted`);
    assert(row.source_quality === 'official-or-institutional', `${row.id}: source quality is not normalized`);
    assert(/^https?:\/\//.test(row.source_url || ''), `${row.id}: official occurrence URL missing`);
    assert(ledger.sources.some(source => source.id === row.source_id), `${row.id}: source absent from authored ledger`);
    assert(!['partial', 'conflicted'].includes(row.time_precision), `${row.id}: unlocked time precision survived`);
    assert(['exact', 'date', 'range', 'month', 'estimated', 'unknown'].includes(row.date_precision), `${row.id}: unlocked date precision survived`);
    if (row.confirmation_status === 'confirmed') assert(!(row.qualification_reasons || []).length, `${row.id}: confirmed with reasons`);
    else assert((row.qualification_reasons || []).length, `${row.id}: unconfirmed without reasons`);
    if (row.time_precision === 'unknown') {
      assert(row.confirmation_status === 'unconfirmed' && row.qualification_reasons.includes('time-unconfirmed'), `${row.id}: unknown time is not qualified`);
    }
  } else {
    assert(Object.keys(row).every(field => ['id', 'record_action', 'preserved_identity', ...SET_FIELDS].includes(field)), `${row.id}: cross-tag contains non-Set 14 fields`);
    assert(['id', 'date', 'title', 'source_url', 'source_id', 'confirmation_status'].every(field => Object.hasOwn(row.preserved_identity || {}, field)), `${row.id}: protected identity snapshot incomplete`);
  }
}
for (const format of FORMATS) assert(ledger.records.some(row => row.live_digital_formats.includes(format)), `Set 14 format absent: ${format}`);
assert(inserted.filter(row => row.series_role === 'parent').length === 9, 'Set 14 parent count drifted');
assert(inserted.filter(row => row.parent_id).length === 21, 'Set 14 child count drifted');
assert(inserted.filter(row => row.confirmation_status === 'confirmed').length === 48, 'Set 14 confirmed count drifted');
assert(inserted.filter(row => row.confirmation_status !== 'confirmed').length === 6, 'Set 14 qualified count drifted');

assert(batch.length === 54, `Expected 54 imported Set 14 records; found ${batch.length}`);
assert(tagged.length === 144, `Expected 144 Set 14-tagged records; found ${tagged.length}`);
const meta = manualDoc[META];
assert(meta && meta.records_in_delta === 54 && meta.net_new_records === 54, 'Set 14 import metadata missing');
assert(meta.initial_records_added === 54, 'Set 14 initial-add accounting drifted');
assert(meta.records_added_latest_run === 0 && meta.records_refreshed_latest_run === 54, 'Set 14 idempotent rerun accounting drifted');
assert(meta.existing_records_cross_tagged === 90, 'Set 14 cross-tag accounting drifted');
assert(meta.parent_records === 9 && meta.child_occurrences === 21, 'Set 14 series accounting drifted');
assert(meta.confirmed_records === 48 && meta.qualified_records === 6, 'Set 14 evidence accounting drifted');
const sourceMeta = sourcesDoc[SOURCE_META];
assert(sourceMeta && sourceMeta.initial_sources_added === 22 && sourceMeta.sources_added_latest_run === 0 && sourceMeta.source_records === 22, 'Set 14 source idempotency accounting drifted');

for (const event of batch) {
  assert(sourceIds.has(String(event.source_id || '')), `${event.id}: unresolved source ${event.source_id}`);
  assert(event.research_set === SET && event.entry_family === 'live-media-digital-native', `${event.id}: imported scope drifted`);
  for (const field of LOCKED_FIELDS) assert(hasValue(event[field]), `${event.id}: imported ${field} missing`);
  if (event.parent_id) assert(manualById.has(event.parent_id), `${event.id}: unresolved parent ${event.parent_id}`);
}
for (const spec of crossTags) {
  const event = manualById.get(spec.id);
  assert(event, `${spec.id}: Set 14 cross-tag target missing after import`);
  assert((event.research_set_cross_tags || []).includes(SET), `${spec.id}: research-set cross-tag missing`);
  assert((event._upsert_batches || []).includes(SRC), `${spec.id}: upsert provenance missing`);
  for (const field of PROTECTED_FIELDS) {
    if (Object.hasOwn(spec.preserved_identity, field)) assert(equal(event[field], spec.preserved_identity[field]), `${spec.id}: protected ${field} changed`);
  }
  for (const field of SET_FIELDS) {
    if (Object.hasOwn(spec, field)) assert(equal(event[field], spec[field]), `${spec.id}: cross-tag ${field} differs from authored ledger`);
  }
}

for (const field of SET_FIELDS) assert(schema.properties?.[field], `Schema missing Set 14 field ${field}`);
assert(equal(schema.properties.live_digital_formats.items.enum, FORMATS), 'Schema Set 14 format enum drifted');
assert(equal(schema.properties.synchronous_status.enum, SYNCHRONOUS), 'Schema Set 14 synchronous enum drifted');

const ui = readText('polymythseminars/index.html');
const uiFr = readText('polymythseminars/fr/index.html');
for (const format of FORMATS) {
  assert(ui.includes(`value="${format}"`), `English UI lacks Set 14 facet ${format}`);
  assert(uiFr.includes(`value="${format}"`), `French UI lacks Set 14 facet ${format}`);
}
const revamp = readText('js/polymythcal-revamp.js');
for (const marker of ['digitalFormats', 'classifyDigitalFormats', 'event._digitalFormats', 'live_digital_formats']) assert(revamp.includes(marker), `Set 14 runtime missing ${marker}`);
const detailBuilder = readText('scripts/build-polymythcal-audit13.py');
for (const marker of ['Live and digital formats', 'Platform detail', 'Liveness detail', 'Interaction evidence', 'Recording evidence', 'Creator participation evidence', 'Digital occurrence evidence']) assert(detailBuilder.includes(marker), `Set 14 detail surface missing ${marker}`);
const browserBuilder = readText('scripts/build-polymythcal-browser-payload.js');
for (const field of SET_FIELDS) assert(browserBuilder.includes(`'${field}'`), `Browser payload contract missing ${field}`);

if (!sourceOnly) {
  const canonical = list(readJson('polymythseminars/events.json'));
  const published = list(readJson('public/polymythseminars/events.json'));
  const browser = list(readJson('polymythseminars/browse.json'));
  const canonicalById = new Map(canonical.map(event => [event.id, event]));
  const publishedById = new Map(published.map(event => [event.id, event]));
  const browserById = new Map(browser.map(event => [event.id, event]));
  assert(canonical.length === published.length && canonical.length === browser.length, 'Set 14 public dataset counts differ');
  assert(exists('public/polymythseminars/browse.json'), 'Public browse.json missing');
  assert(fs.readFileSync(path.join(root, 'polymythseminars/browse.json')).equals(fs.readFileSync(path.join(root, 'public/polymythseminars/browse.json'))), 'Browse mirrors differ');
  for (const authored of tagged) {
    const output = canonicalById.get(authored.id);
    const publicEvent = publishedById.get(authored.id);
    const compact = browserById.get(authored.id);
    assert(output && publicEvent && compact, `${authored.id}: absent from canonical/public/browser outputs`);
    for (const field of SET_FIELDS) {
      if (!Object.hasOwn(authored, field)) continue;
      assert(equal(output[field], authored[field]), `${authored.id}: canonical ${field} differs from manual`);
      assert(equal(publicEvent[field], authored[field]), `${authored.id}: public ${field} differs from manual`);
      if (hasValue(authored[field])) assert(equal(compact[field], authored[field]), `${authored.id}: browse ${field} differs from manual`);
      else assert(!Object.hasOwn(compact, field), `${authored.id}: browse retained empty ${field}`);
    }
    const detailRel = `polymythseminars/events/${authored.id}/index.html`;
    assert(exists(detailRel), `${authored.id}: detail page missing`);
    assert(readText(detailRel).includes('pm-event-context'), `${authored.id}: detail context missing`);
  }
  const pkg = readJson('package.json');
  const build = String(pkg.scripts?.['build:locked'] || '');
  for (const marker of [
    'import-polymythcal-live-media-digitally-native-set14-2026-08-15.py',
    'normalize-polymythcal-manual-identities.py',
    'normalize-polymythcal-evidence-model.py',
    'node scripts/upsert-manual-calendar-events.js',
    'verify-polymythcal-live-media-digitally-native-set14-2026-08-15.js'
  ]) assert(build.includes(marker), `build:locked missing ${marker}`);
  assert(pkg.scripts['import:polymythcal-live-media-digitally-native-set14-2026-08-15'], 'Missing Set 14 import alias');
  assert(pkg.scripts['verify:polymythcal-live-media-digitally-native-set14-2026-08-15'], 'Missing Set 14 verify alias');
}

console.log(JSON.stringify({
  manual_records: manual.length,
  set14_new_records: batch.length,
  set14_cross_tagged_existing: crossTags.length,
  set14_tagged_records: tagged.length,
  parent_records: 9,
  child_occurrences: 21,
  confirmed_records: 48,
  qualified_records: 6,
  source_records: 22,
  source_only: sourceOnly
}, null, 2));
