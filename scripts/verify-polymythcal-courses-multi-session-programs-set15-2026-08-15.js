#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const readJson = rel => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
const readText = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const assert = (ok, message) => { if (!ok) throw new Error(message); };
const list = value => Array.isArray(value) ? value : (value.events || []);
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const nullable = value => value === undefined ? null : value;

const SRC = 'manual-polymythcal-courses-multi-session-programs-set15-2026-08-15';
const SET = '15-Courses-and-Multi-Session-Programs';
const META = 'polymythcal_courses_multi_session_programs_set15_update_2026_08_15';
const ledger = readJson('data/polymythcal-research-set-15-courses-multi-session-programs-2026-08-15.json');
const researchLedger = readJson('data/research/polymythcal-set15-courses-multi-session-programs-2026-08-15/research-ledger.json');
const exclusions = readJson('data/research/polymythcal-set15-courses-multi-session-programs-2026-08-15/exclusions.json');
const manualDoc = readJson('data/manual-events.json');
const manual = list(manualDoc);
const consolidated = list(readJson('data/polymyth-seminar-events.json'));
const published = list(readJson('polymythseminars/events.json'));
const browseDoc = readJson('polymythseminars/browse.json');
const watchlistDoc = readJson('polymythseminars/watchlist.json');
const browser = [...list(browseDoc), ...(watchlistDoc.items || [])];
const schema = readJson('data/polymythcal-event-schema-v2.json');
const sourcesDoc = readJson('scripts/sources.json');
const sources = Array.isArray(sourcesDoc) ? sourcesDoc : (sourcesDoc.sources || []);

assert(same(ledger, researchLedger), 'Canonical and research Set 15 ledgers differ');
assert(same(ledger.exclusions, exclusions), 'Set 15 exclusion copies differ');
assert(ledger.schema === 'polymythcal-courses-multi-session-programs-set15-canonical-ledger-v1', 'Set 15 ledger schema drifted');
assert(ledger.source_batch === SRC && ledger.research_set === SET, 'Set 15 ledger identity drifted');
assert(ledger.record_count === 81 && ledger.new_record_count === 72 && ledger.cross_tagged_record_count === 9, 'Set 15 record accounting drifted');
assert(ledger.normalized_format_count === 19 && ledger.parent_record_count === 7 && ledger.child_record_count === 18, 'Set 15 format/series accounting drifted');
assert(ledger.records.length === 72 && ledger.cross_tags.length === 9 && ledger.exclusions.length === 12, 'Set 15 ledger row accounting drifted');
assert(Array.isArray(ledger.category_gaps) && ledger.category_gaps.length === 0, 'Set 15 category gaps must be empty');

const expectedFormats = [
  'public-short-course', 'summer-school', 'camp', 'academy', 'institute', 'intensive',
  'masterclass-series', 'cohort-program', 'mentorship-program', 'film-theatre-lab',
  'research-school', 'field-school', 'study-tour', 'teacher-professional-development',
  'admissions-registration', 'open-house', 'orientation', 'convocation', 'academic-showcase',
];
const expectedStages = [
  'program-run', 'session', 'admission-open', 'admission-deadline', 'registration-open',
  'registration-deadline', 'open-house', 'orientation', 'convocation', 'showcase',
];
const expectedSchedules = [
  'bounded-series', 'fixed-cohort', 'rolling-admission-bounded', 'multi-day-intensive', 'single-stage',
];
assert(same(schema.properties?.course_program_formats?.items?.enum, expectedFormats), 'Schema Set 15 format enum drifted');
assert(same(schema.properties?.program_stage?.enum, expectedStages), 'Schema Set 15 stage enum drifted');
assert(same(schema.properties?.schedule_model?.enum, expectedSchedules), 'Schema Set 15 schedule enum drifted');
const preservedDetailFields = [
  'program_stage_source_value', 'program_schedule_detail', 'program_start_date',
  'program_end_date', 'eligibility_audience', 'registration_application_route',
];
const browserBuilder = readText('scripts/lib/polymythcal-discovery-model.js');
const propagationGate = readText('scripts/verify-polymythcal-set-field-propagation.js');
const detailBuilder = readText('scripts/build-polymythcal-audit13.py');
for (const field of preservedDetailFields) {
  assert(schema.properties?.[field], `Schema omits preserved Set 15 detail ${field}`);
  assert(!browserBuilder.includes(`    ${field}: event.${field},`), `Safe discovery payload exposes private Set 15 detail ${field}`);
  assert(detailBuilder.includes(`'${field}'`), `Detail surface omits preserved Set 15 detail ${field}`);
}

const byId = new Map(manual.map(event => [event.id, event]));
const consolidatedById = new Map(consolidated.map(event => [event.id, event]));
const publishedById = new Map(published.map(event => [event.id, event]));
const browserById = new Map(browser.map(event => [event.id, event]));
const idCounts = new Map();
const identityOwners = new Map();
const signatureOwners = new Map();
for (const event of manual) {
  idCounts.set(event.id, (idCounts.get(event.id) || 0) + 1);
  if (event.identity_key) {
    const owners = identityOwners.get(event.identity_key) || [];
    owners.push(event.id); identityOwners.set(event.identity_key, owners);
  }
  const signature = `${String(event.title || '').trim().toLocaleLowerCase()}\u0000${String(event.date || '')}`;
  const owners = signatureOwners.get(signature) || [];
  owners.push(event.id); signatureOwners.set(signature, owners);
}
assert([...idCounts.values()].every(count => count === 1), 'Manual corpus contains duplicate IDs');

const batch = manual.filter(event => event._src === SRC);
const tagged = manual.filter(event => event.set15_classified_at === '2026-08-15T12:00:00-04:00');
assert(batch.length === 72, `Expected 72 new Set 15 records; found ${batch.length}`);
assert(tagged.length === 81, `Expected 81 Set 15 classified records; found ${tagged.length}`);

const meta = manualDoc[META];
assert(meta && meta.source === SRC && meta.research_set === SET, 'Set 15 import metadata missing');
assert(meta.records_in_delta === 81 && meta.net_new_records === 72 && meta.initial_records_added === 72, 'Set 15 import totals drifted');
assert(meta.records_added_latest_run === 0 && meta.existing_records_refreshed_latest_run === 72, 'Set 15 importer did not prove a zero-addition second run');
assert(meta.existing_records_cross_tagged === 9 && meta.parent_records === 7 && meta.child_occurrences === 18 && meta.format_count === 19, 'Set 15 metadata shape drifted');

const ledgerNewById = new Map(ledger.records.map(event => [event.id, event]));
const crossById = new Map(ledger.cross_tags.map(item => [item.id, item]));
const expectedIds = new Set([...ledgerNewById.keys(), ...crossById.keys()]);
assert(expectedIds.size === 81, 'Set 15 ledger IDs are not unique across new records and cross-tags');
const lockedFields = [
  'course_program_formats', 'program_stage', 'schedule_model', 'session_count',
  'program_stage_source_value', 'program_schedule_detail', 'program_start_date',
  'program_end_date', 'eligibility_audience', 'registration_application_route',
  'program_evidence', 'set15_classified_at',
];
const retainedSet15Fields = [
  ...lockedFields,
  'program_date_precision', 'application_deadline', 'registration_deadline',
  'session_count_status', 'parent_id', 'child_ids', 'series_role',
  'alternate_sections', 'evidence_facts', 'evidence', 'source_control',
  'set15_alternate_date_details', 'set15_child_ids', 'set15_eligibility_audience',
  'set15_evidence_source_id', 'set15_evidence_source_name', 'set15_evidence_source_url',
  'set15_parent_id', 'set15_program_start_date', 'set15_program_end_date',
  'set15_program_evidence_facts', 'set15_program_stage_source',
  'set15_registration_application_route', 'set15_schedule_model_source',
  'set15_series_role', 'set15_series_role_source', 'set15_session_count_status',
  'set15_source_caveats', 'set15_source_formats', 'set15_time_precision_source',
];
const set15Fields = new Set(retainedSet15Fields);
for (const field of retainedSet15Fields) {
  assert(schema.properties?.[field], `Schema omits retained Set 15 field ${field}`);
  assert(!browserBuilder.includes(`    ${field}: event.${field},`), `Safe discovery payload exposes retained private Set 15 field ${field}`);
}

for (const record of ledger.records) {
  const event = byId.get(record.id);
  assert(event, `${record.id}: Set 15 new record missing from manual corpus`);
  assert(event._src === SRC && event.entry_family === 'courses-multi-session-programs', `${record.id}: Set 15 source/family drifted`);
  assert(event.research_set === SET && (event.research_set_cross_tags || []).includes(SET), `${record.id}: Set 15 research provenance drifted`);
  assert(event.source_quality === 'official-or-institutional', `${record.id}: source quality is not normalized`);
  assert(event.identity_key === record.identity_key, `${record.id}: stable identity drifted`);
  const owners = identityOwners.get(event.identity_key) || [];
  assert(owners.length === 1 && owners[0] === event.id, `${record.id}: Set 15 identity is not uniquely owned`);
  const signature = `${String(event.title || '').trim().toLocaleLowerCase()}\u0000${String(event.date || '')}`;
  assert((signatureOwners.get(signature) || []).length === 1, `${record.id}: duplicate title/date occurrence signature`);
  for (const field of lockedFields) assert(same(event[field], record[field]), `${record.id}: locked Set 15 field drifted: ${field}`);
}

for (const spec of ledger.cross_tags) {
  const event = byId.get(spec.id);
  assert(event, `${spec.id}: Set 15 cross-tag target missing`);
  for (const [field, expected] of Object.entries(spec.preserved_event)) {
    assert(same(nullable(event[field]), expected), `${spec.id}: cross-tag changed preserved ${field}`);
  }
  for (const [field, expected] of Object.entries(spec.set15_fields)) {
    assert(same(event[field], expected), `${spec.id}: cross-tag Set 15 field drifted: ${field}`);
  }
  assert((event.research_set_cross_tags || []).includes(SET), `${spec.id}: Set 15 cross-tag provenance missing`);
  assert((event._upsert_batches || []).includes(SRC), `${spec.id}: Set 15 upsert provenance missing`);
}

const representedFormats = new Set();
for (const event of tagged) {
  assert(Array.isArray(event.course_program_formats) && event.course_program_formats.length, `${event.id}: Set 15 format missing`);
  for (const format of event.course_program_formats) {
    assert(expectedFormats.includes(format), `${event.id}: unnormalized Set 15 format ${format}`);
    representedFormats.add(format);
  }
  assert(expectedStages.includes(event.program_stage), `${event.id}: invalid Set 15 stage ${event.program_stage}`);
  assert(expectedSchedules.includes(event.schedule_model), `${event.id}: invalid Set 15 schedule model ${event.schedule_model}`);
  assert(event.session_count === null || (Number.isInteger(event.session_count) && event.session_count >= 1), `${event.id}: invalid session count`);
  assert(typeof event.program_evidence === 'string' && event.program_evidence.trim(), `${event.id}: program evidence missing`);
  assert(event.set15_classified_at === '2026-08-15T12:00:00-04:00', `${event.id}: Set 15 classification timestamp drifted`);
}
assert(same([...representedFormats].sort(), [...expectedFormats].sort()), 'Set 15 does not represent all 19 requested formats');

const parents = tagged.filter(event => event.set15_series_role === 'parent');
const children = tagged.filter(event => event.set15_series_role === 'child');
assert(parents.length === 7 && children.length === 18, `Set 15 parent/child shape drifted: ${parents.length}/${children.length}`);
for (const parent of parents) {
  assert(Array.isArray(parent.set15_child_ids) && parent.set15_child_ids.length, `${parent.id}: Set 15 parent has no children`);
  for (const childId of parent.set15_child_ids) {
    const child = byId.get(childId);
    assert(child && child.set15_series_role === 'child', `${parent.id}: unresolved Set 15 child ${childId}`);
    assert(child.set15_parent_id === parent.id, `${childId}: Set 15 parent backlink drifted`);
  }
}
for (const child of children) {
  const parent = byId.get(child.set15_parent_id);
  assert(parent && parent.set15_series_role === 'parent', `${child.id}: unresolved Set 15 parent ${child.set15_parent_id}`);
  assert((parent.set15_child_ids || []).includes(child.id), `${child.id}: missing reciprocal Set 15 parent link`);
}

const sourceIds = new Set(sources.map(row => String(row.id || '')));
for (const event of tagged) {
  assert(event.set15_evidence_source_url?.startsWith('https://'), `${event.id}: Set 15 official evidence URL missing`);
  assert(sourceIds.has(String(event.set15_evidence_source_id || '')), `${event.id}: unresolved Set 15 evidence source ${event.set15_evidence_source_id}`);
}

const historicalExclusionId = 'exclude-historical-thinking-institute-2026-existing-date-mismatch';
const historical = ledger.exclusions.find(item => item.id === historicalExclusionId);
assert(historical && historical.existing_id === 'historical-thinking-institute-2026', 'Historical Thinking conflict exclusion missing');
assert(!crossById.has(historical.existing_id), 'Historical Thinking conflict was incorrectly cross-tagged');
const historicalEvent = byId.get(historical.existing_id);
assert(historicalEvent && !historicalEvent.set15_classified_at && !(historicalEvent._upsert_batches || []).includes(SRC), 'Historical Thinking excluded record received Set 15 fields');

assert(consolidated.length === published.length, `Canonical/public count drifted: ${consolidated.length}/${published.length}`);
for (const id of expectedIds) {
  const event = byId.get(id);
  const canonical = consolidatedById.get(id);
  const publicEvent = publishedById.get(id);
  const compact = browserById.get(id);
  assert(canonical && publicEvent && compact, `${id}: missing from canonical, public, or browser calendar after build`);
  for (const field of set15Fields) {
    if (!Object.hasOwn(event, field)) continue;
    assert(same(canonical[field], event[field]), `${id}: canonical Set 15 field differs: ${field}`);
    assert(same(publicEvent[field], event[field]), `${id}: public Set 15 field differs: ${field}`);
    assert(!Object.hasOwn(compact, field), `${id}: safe discovery data exposes private Set 15 field ${field}`);
  }
  assert(same(compact.facets?.programFormats || [], event.course_program_formats), `${id}: safe programFormats facets differ from the authored Set 15 values`);
}

console.log(JSON.stringify({
  status: 'pass',
  set15_records: 81,
  new_records: batch.length,
  cross_tagged_existing: ledger.cross_tags.length,
  normalized_formats: representedFormats.size,
  parent_records: parents.length,
  child_records: children.length,
  evidence_sources: ledger.source_count,
  exclusions: ledger.exclusions.length,
  canonical_records: consolidated.length,
  public_records: published.length,
  browser_records: browser.length,
  second_run_additions: meta.records_added_latest_run,
}, null, 2));

