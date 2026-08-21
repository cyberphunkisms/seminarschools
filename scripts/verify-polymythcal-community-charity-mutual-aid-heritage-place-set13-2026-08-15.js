#!/usr/bin/env node
'use strict';

/** Strict Set 13 research, import, identity, and propagation proof. */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const sourceOnly = process.argv.includes('--source-only');
const read = rel => fs.readFileSync(path.join(ROOT, rel));
const json = rel => JSON.parse(read(rel).toString('utf8'));
const exists = rel => fs.existsSync(path.join(ROOT, rel));
const list = doc => Array.isArray(doc) ? doc : (doc.events || []);
const equal = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const failures = [];
const fail = message => failures.push(message);
const assert = (condition, message) => { if (!condition) fail(message); };

const SRC = 'manual-polymythcal-community-charity-mutual-aid-heritage-place-set13-2026-08-15';
const SET = '13-Community-Charity-Mutual-Aid-Heritage-Place';
const ENTRY = 'community-charity-mutual-aid-heritage-place';
const META = 'polymythcal_community_charity_mutual_aid_heritage_place_set13_update_2026_08_15';
const LEDGER_REL = 'data/polymythcal-research-set-13-community-charity-mutual-aid-heritage-place-2026-08-15.json';
const EXCLUSIONS_REL = 'data/polymythcal-research-set-13-community-charity-mutual-aid-heritage-place-exclusions-2026-08-15.json';
const RESEARCH_DIR = 'data/research/polymythcal-set13-community-charity-mutual-aid-heritage-place-2026-08-15';

const FORMATS = [
  'charity-walk-run-ride', 'fundraiser', 'benefit-performance', 'food-clothing-drive',
  'mutual-aid-action', 'volunteer-day', 'community-cleanup', 'repair-cafe',
  'community-garden', 'neighbourhood-assembly', 'community-meal', 'block-party',
  'bazaar-night-market', 'newcomer-diaspora', 'historical-walk', 'architecture-tour',
  'cemetery-tour', 'public-dig', 'reenactment', 'open-archive', 'doors-open',
  'land-based-learning'
];
const FORMAT_SET = new Set(FORMATS);
const CORE_FIELDS = [
  'community_heritage_formats', 'community_participation_roles', 'contribution_routes',
  'beneficiary_or_cause', 'place_relation', 'community_evidence', 'set13_classified_at'
];
const SET_FIELDS = [
  ...CORE_FIELDS, 'community_heritage_scope', 'community_public_access_status',
  'community_registration_required', 'community_participation_mode', 'community_date_evidence',
  'community_access_evidence', 'community_participation_evidence',
  'community_beneficiary_evidence', 'community_place_evidence', 'community_heritage_evidence'
];
const IDENTITY_FIELDS = [
  'id', 'identity_key', 'occurrence_key', 'date', 'end_date', 'title', 'source_url',
  'source_id', 'source_name', 'source_quality', 'confirmation_status',
  'qualification_reasons', 'lifecycle_status'
];
const INSERT_INTEGRITY_FIELDS = [
  'date', 'end_date', 'title', 'type', 'record_kind', 'source_url', 'source_id',
  'source_name', 'source_quality', 'confirmation_status', 'qualification_reasons',
  'lifecycle_status', 'date_precision', 'time_precision', 'parent_id', 'series_role',
  'entry_family', '_src', 'research_set', ...SET_FIELDS
];
const requiredSetFields = [
  'community_heritage_formats', 'community_participation_roles', 'contribution_routes',
  'beneficiary_or_cause', 'place_relation', 'community_evidence', 'set13_classified_at'
];

const ledger = json(LEDGER_REL);
const researchLedger = json(`${RESEARCH_DIR}/research-ledger.json`);
const exclusions = json(EXCLUSIONS_REL);
const researchExclusions = json(`${RESEARCH_DIR}/exclusions.json`);
assert(equal(ledger, researchLedger), 'Set 13 top-level and research-directory ledgers differ.');
assert(equal(exclusions, researchExclusions), 'Set 13 top-level and research-directory exclusions differ.');
assert(equal(exclusions, ledger.exclusions), 'Set 13 exclusions differ from the canonical ledger.');
assert(ledger.schema === 'polymythcal-community-charity-mutual-aid-heritage-place-set13-research-ledger-v1', 'Set 13 ledger schema drifted.');
assert(ledger.source_batch === SRC && ledger.research_set === SET, 'Set 13 ledger identity drifted.');
assert(ledger.record_count === 170 && ledger.new_record_count === 120 && ledger.cross_tagged_existing_count === 50, 'Set 13 ledger accounting drifted.');
assert((ledger.records || []).length === 170, 'Set 13 ledger record array must contain 170 rows.');
assert((ledger.sources || []).length === 31 && ledger.source_count === 31, 'Set 13 source ledger must contain 31 sources.');
assert((ledger.exclusions || []).length === 9 && ledger.exclusion_count === 9, 'Set 13 exclusion accounting drifted.');
assert(Object.keys(ledger.format_counts || {}).length === 22, 'Set 13 format-count ledger must contain 22 facets.');

const authored = ledger.records || [];
const inserted = authored.filter(row => row.record_action === 'insert');
const crossSpecs = authored.filter(row => row.record_action === 'cross-tag-existing');
assert(inserted.length === 120 && crossSpecs.length === 50, 'Set 13 ledger action split drifted.');
const authoredIds = authored.map(row => String(row.id || ''));
assert(authoredIds.every(Boolean) && new Set(authoredIds).size === 170, 'Set 13 ledger IDs are missing or duplicated.');
assert(new Set(ledger.cross_tagged_existing_ids || []).size === 50, 'Set 13 cross-tag ID ledger drifted.');
assert(equal([...(ledger.cross_tagged_existing_ids || [])].sort(), crossSpecs.map(row => row.id).sort()), 'Set 13 cross-tag ID list differs from cross-tag records.');

const deprecatedVocabulary = JSON.stringify(authored);
for (const marker of ['community_charity_heritage_formats', 'newcomer-diaspora-event', 'open-archives']) {
  assert(!deprecatedVocabulary.includes(marker), `Set 13 ledger retains deprecated vocabulary: ${marker}.`);
}

const represented = new Set();
for (const row of authored) {
  const formats = row.community_heritage_formats || [];
  assert(Array.isArray(formats) && formats.length > 0, `${row.id}: community_heritage_formats missing.`);
  for (const format of formats) {
    assert(FORMAT_SET.has(format), `${row.id}: invalid Set 13 format ${format}.`);
    represented.add(format);
  }
  for (const field of requiredSetFields) {
    const value = row[field];
    assert(!(value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length)), `${row.id}: ${field} missing in canonical research ledger.`);
  }
}
assert(FORMATS.every(format => represented.has(format)), `Set 13 format coverage missing: ${FORMATS.filter(format => !represented.has(format)).join(', ')}.`);
for (const format of FORMATS) {
  assert((ledger.format_counts?.[format]?.total_records || 0) > 0, `Set 13 format ledger has no ${format} record.`);
}

const manualDoc = json('data/manual-events.json');
const manual = list(manualDoc);
const canonical = list(json('data/polymyth-seminar-events.json'));
const published = list(json('polymythseminars/events.json'));
const sourceRows = json('scripts/sources.json').sources || [];
const schema = json('data/polymythcal-event-schema-v2.json');
const byId = rows => new Map(rows.map(row => [String(row.id || ''), row]));
const manualById = byId(manual);
const canonicalById = byId(canonical);
const publishedById = byId(published);
const sourceById = byId(sourceRows);
assert(manualById.size === manual.length, 'Manual event IDs are not unique.');
assert(canonicalById.size === canonical.length, 'Canonical event IDs are not unique.');
assert(publishedById.size === published.length, 'Published event IDs are not unique.');
assert(canonical.length === published.length, 'Canonical and published event counts differ.');

const meta = manualDoc[META];
assert(meta && meta.source === SRC && meta.research_set === SET, 'Set 13 import metadata missing.');
assert(meta?.records_in_delta === 120 && meta?.net_new_records === 120, 'Set 13 new-record metadata drifted.');
assert(meta?.initial_records_added === 120 && meta?.records_added_latest_run === 0 && meta?.records_refreshed_latest_run === 120, 'Set 13 idempotency proof is not the completed second-run state.');
assert(meta?.existing_records_cross_tagged === 50, 'Set 13 cross-tag metadata drifted.');
assert(meta?.parent_records === 8 && meta?.child_occurrences === 33, 'Set 13 parent/child metadata drifted.');

const manualBatch = manual.filter(row => row._src === SRC);
const tagged = manual.filter(row => Array.isArray(row.community_heritage_formats) && row.community_heritage_formats.length);
assert(manualBatch.length === 120, `Expected 120 Set 13 inserted records; found ${manualBatch.length}.`);
assert(tagged.length === 170, `Expected 170 Set 13 tagged records; found ${tagged.length}.`);
const taggedIds = new Set(tagged.map(row => row.id));
assert(authoredIds.every(id => taggedIds.has(id)), 'One or more researched Set 13 IDs lack their manual tag.');

const enumFormats = schema.properties?.community_heritage_formats?.items?.enum || [];
assert(equal(enumFormats, FORMATS), 'Set 13 schema facet vocabulary/order differs from the locked taxonomy.');
const qualityEnum = new Set(schema.properties?.source_quality?.enum || []);
for (const field of CORE_FIELDS) assert(schema.properties?.[field], `Schema missing Set 13 field ${field}.`);

for (const authoredRow of inserted) {
  const row = manualById.get(authoredRow.id);
  assert(Boolean(row), `${authoredRow.id}: inserted record missing from manual events.`);
  if (!row) continue;
  assert(row._src === SRC && row.entry_family === ENTRY && row.research_set === SET, `${row.id}: Set 13 provenance drifted.`);
  assert((row._upsert_batches || []).includes(SRC), `${row.id}: Set 13 upsert provenance missing.`);
  assert(qualityEnum.has(row.source_quality), `${row.id}: source_quality is outside the schema enum.`);
  assert(/^https?:\/\//.test(String(row.source_url || '')), `${row.id}: official occurrence URL missing.`);
  assert(sourceById.has(String(row.source_id || '')), `${row.id}: source ID ${row.source_id} is absent from sources.json.`);
  for (const field of INSERT_INTEGRITY_FIELDS) {
    if (Object.hasOwn(authoredRow, field)) {
      assert(equal(row[field], authoredRow[field]), `${row.id}: manual ${field} differs from the canonical Set 13 ledger.`);
    }
  }
  for (const forbidden of ['community_charity_heritage_formats', 'participation_roles', 'beneficiary_scope', 'place_relationship']) {
    assert(!Object.hasOwn(row, forbidden), `${row.id}: deprecated proposal field ${forbidden} leaked into the manual corpus.`);
  }
}

const identitySnapshot = row => Object.fromEntries(
  IDENTITY_FIELDS.filter(field => Object.hasOwn(row, field)).map(field => [field, row[field]])
);
for (const spec of crossSpecs) {
  const row = manualById.get(spec.id);
  assert(Boolean(row), `${spec.id}: cross-tag target missing from manual events.`);
  if (!row) continue;
  assert(equal(identitySnapshot(row), spec.preserved_identity), `${row.id}: Set 13 cross-tag changed date/title/status/source identity.`);
  assert((row.research_set_cross_tags || []).includes(SET), `${row.id}: Set 13 research cross-tag provenance missing.`);
  assert((row._upsert_batches || []).includes(SRC), `${row.id}: Set 13 upsert cross-tag provenance missing.`);
  for (const field of SET_FIELDS) {
    if (!Object.hasOwn(spec, field)) continue;
    if (Array.isArray(spec[field])) {
      for (const value of spec[field]) assert((row[field] || []).includes(value), `${row.id}: cross-tag ${field} lost ${value}.`);
    } else {
      assert(equal(row[field], spec[field]), `${row.id}: cross-tag ${field} differs from research ledger.`);
    }
  }
}

const newById = new Set(inserted.map(row => row.id));
const parents = inserted.filter(row => row.series_role === 'parent');
const children = inserted.filter(row => row.parent_id);
assert(parents.length === 8 && children.length === 33, `Set 13 series shape drifted: ${parents.length} parents / ${children.length} children.`);
for (const child of children) {
  const parent = manualById.get(child.parent_id);
  assert(Boolean(parent), `${child.id}: unresolved parent ${child.parent_id}.`);
  assert(newById.has(child.parent_id), `${child.id}: parent ${child.parent_id} is not a Set 13 inserted record.`);
  assert(parent?.series_role === 'parent', `${child.id}: linked parent ${child.parent_id} lacks parent role.`);
  if (parent) {
    assert(String(child.date).slice(0, 10) >= String(parent.date).slice(0, 10), `${child.id}: child starts before parent range.`);
    assert(String(child.date).slice(0, 10) <= String(parent.end_date || parent.date).slice(0, 10), `${child.id}: child falls after parent range.`);
  }
}

for (const row of tagged) {
  assert(/^https?:\/\//.test(String(row.source_url || '')), `${row.id}: source URL is not an official HTTP(S) evidence route.`);
  assert(sourceById.has(String(row.source_id || '')), `${row.id}: source ID ${row.source_id} is unresolved.`);
  const reasons = row.qualification_reasons || [];
  if (row.confirmation_status === 'confirmed') assert(reasons.length === 0, `${row.id}: confirmed record has qualification reasons.`);
  else assert(reasons.length > 0, `${row.id}: qualified record lacks qualification reasons.`);
  if (row.time_precision === 'unknown') {
    assert(row.confirmation_status === 'unconfirmed' && reasons.includes('time-unconfirmed'), `${row.id}: unknown clock is not qualified.`);
  }
}

for (const row of tagged) {
  const outputs = [
    ['canonical', canonicalById.get(row.id)],
    ['published', publishedById.get(row.id)]
  ];
  for (const [label, output] of outputs) {
    assert(Boolean(output), `${row.id}: missing from ${label} events.`);
    if (!output) continue;
    for (const field of SET_FIELDS) {
      if (Object.hasOwn(row, field)) assert(equal(output[field], row[field]), `${row.id}: ${label} ${field} differs from manual.`);
    }
  }
}

if (!sourceOnly) {
  const browse = list(json('polymythseminars/browse.json'));
  const browseById = byId(browse);
  assert(browseById.size === browse.length, 'Browser event IDs are not unique.');
  for (const row of tagged) {
    const compact = browseById.get(row.id);
    assert(Boolean(compact), `${row.id}: missing from browser payload.`);
    if (compact) for (const field of CORE_FIELDS) assert(equal(compact[field], row[field]), `${row.id}: browser ${field} differs from manual.`);
    const detailRel = `polymythseminars/events/${row.id}/index.html`;
    assert(exists(detailRel), `${row.id}: generated detail page missing.`);
    if (exists(detailRel) && row.community_evidence) {
      assert(read(detailRel).toString('utf8').includes('pm-event-context'), `${row.id}: detail page omits Set 13 context/evidence.`);
    }
  }
  for (const rel of ['polymythseminars/events.json', 'polymythseminars/browse.json']) {
    const mirror = `public/${rel}`;
    assert(exists(mirror), `${mirror} missing.`);
    if (exists(mirror)) assert(read(rel).equals(read(mirror)), `${rel} differs from ${mirror}.`);
  }
}

if (failures.length) {
  console.error('POLYMYTHCAL SET 13 VERIFICATION FAILED');
  for (const failure of failures.slice(0, 300)) console.error(` - ${failure}`);
  if (failures.length > 300) console.error(` - … ${failures.length - 300} additional failures`);
  process.exit(1);
}

console.log(JSON.stringify({
  status: 'pass',
  mode: sourceOnly ? 'source-only' : 'full-public',
  new_records: inserted.length,
  cross_tagged_existing: crossSpecs.length,
  tagged_records: tagged.length,
  formats: represented.size,
  parent_records: parents.length,
  child_occurrences: children.length,
  sources: ledger.sources.length,
  exclusions: exclusions.length,
  manual_records: manual.length,
  canonical_records: canonical.length
}, null, 2));
