#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const readJson = rel => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
const readText = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const fail = message => { throw new Error(message); };
const assert = (condition, message) => { if (!condition) fail(message); };
const eventList = payload => Array.isArray(payload) ? payload : (payload.events || []);

const manualPayload = readJson('data/manual-events.json');
const consolidatedPayload = readJson('data/polymyth-seminar-events.json');
const publicPayload = readJson('polymythseminars/events.json');
const sourcesPayload = readJson('scripts/sources.json');
const schema = readJson('data/polymythcal-event-schema-v2.json');
const manual = eventList(manualPayload);
const consolidated = eventList(consolidatedPayload);
const publicEvents = eventList(publicPayload);
const sources = Array.isArray(sourcesPayload) ? sourcesPayload : (sourcesPayload.sources || []);
const batch = manual.filter(event => event._src === 'manual-polymythcal-comprehensive-2026-08-13');

assert(batch.length === 292, `Expected 292 comprehensive-import records; found ${batch.length}`);
assert(manualPayload.polymythcal_comprehensive_update_2026_08_13, 'Missing import metadata');
assert(manualPayload.polymythcal_comprehensive_update_2026_08_13.records_in_delta === 292, 'Import metadata count drifted');

const ids = new Set();
for (const event of batch) {
  const id = String(event.id || event.identity_key || '');
  assert(id, 'Imported record lacks a stable ID');
  assert(!ids.has(id), `Duplicate imported stable ID: ${id}`);
  ids.add(id);
}
const sourceIds = new Set(sources.map(source => String(source.id || '')));
for (const event of batch) {
  assert(event.source_url, `${event.id}: missing source_url`);
  assert(event.source_id && sourceIds.has(String(event.source_id)), `${event.id}: unresolved source_id ${event.source_id}`);
  assert(['confirmed', 'unconfirmed'].includes(event.confirmation_status), `${event.id}: invalid confirmation_status`);
  assert(['event', 'opportunity'].includes(event.record_kind), `${event.id}: invalid record_kind`);
}

const familyCount = family => batch.filter(event => event.entry_family === family).length;
assert(familyCount('celestial') >= 60, 'Celestial family is incomplete');
assert(familyCount('astrology') >= 10, 'Astrology family is incomplete');
assert(familyCount('ritual') >= 10, 'Ritual family is incomplete');
assert(familyCount('opportunity') >= 190, 'Sets 1–3 opportunity import is incomplete');

const requireId = id => {
  const event = manual.find(item => item.id === id || item.identity_key === id);
  assert(event, `Missing required record ${id}`);
  return event;
};
const medusa = requireId('soulpepper-medusa-2026');
const medusaTalkback = requireId('soulpepper-medusa-talkback-2026-07-08');
assert(medusa.type === 'performance', 'Medusa parent is not a performance');
assert(String(medusa.date_conflict || '').includes('June 19') && Array.isArray(medusa.alternate_date_ranges), 'Medusa date conflict was not preserved');
assert(medusaTalkback.parent_id === medusa.id, 'Medusa talkback lost its parent link');
assert(medusaTalkback.talkback_status === 'confirmed', 'Medusa talkback is not confirmed');
assert(medusaTalkback.director_attendance_status === 'unconfirmed', 'Medusa director attendance must remain unconfirmed');
assert(Array.isArray(medusaTalkback.presence_claims) && medusaTalkback.presence_claims.some(claim => claim.role === 'artists from production' && claim.status === 'confirmed'), 'Medusa generic artist presence is missing');
assert(medusaTalkback.presence_claims.some(claim => claim.person === 'Mitchell Cushman' && claim.role === 'director' && claim.status === 'attendance-unconfirmed'), 'Medusa director-role/attendance distinction is missing');

requireId('new-moon-2026-08-12');
const annular2026 = requireId('annular-solar-eclipse-2026-02-17');
const totalLunar2026 = requireId('total-lunar-eclipse-2026-03-03');
const totalSolar2026 = requireId('total-solar-eclipse-2026-08-12');
const partialLunar2026 = requireId('partial-lunar-eclipse-2026-08-28');
assert(annular2026.date === '2026-02-17T12:13:06+00:00', 'Annular eclipse instant is stale');
assert(totalLunar2026.date === '2026-03-03T11:34:52+00:00', 'March lunar eclipse instant is stale');
assert(totalSolar2026.date === '2026-08-12T17:47:06+00:00', 'August total solar eclipse instant is stale');
assert(partialLunar2026.date === '2026-08-28T04:14:04+00:00', 'August partial lunar eclipse instant is stale');
requireId('taiwan-mid-autumn-2026');
requireId('dongzhi-winter-solstice-2027');
requireId('acla-2027-virtual-meeting');
requireId('acla-2027-houston-meeting');
requireId('mla-2027-convention');
requireId('berkeley-essay-prize-2027-result');
const dcCanada = requireId('dc-canada-childrens-writing-contest-2026');
assert(Array.isArray(dcCanada.exact_grades) && dcCanada.exact_grades.includes('Grade 4'), 'DC Canada exact Grade 4 eligibility is not indexed');
assert(!manual.some(event => /total lunar eclipse/i.test(event.title || '') && String(event.date || '').startsWith('2026-09-07')), 'The disproven September 7, 2026 total lunar eclipse remains present');

const publicIds = new Set(publicEvents.map(event => event.id || event.identity_key));
const consolidatedIds = new Set(consolidated.map(event => event.id || event.identity_key));
for (const event of batch) {
  assert(consolidatedIds.has(event.id), `${event.id}: absent from consolidated data`);
  assert(publicIds.has(event.id), `${event.id}: absent from public data`);
}
assert(consolidated.length === publicEvents.length, 'Canonical/public Polymythcal count mismatch');

const requiredSchemaFields = [
  'entry_family', 'calendar_systems', 'traditions', 'ritual_associations', 'social_functions',
  'socio_note', 'celestial_system', 'astronomy_visibility', 'presence_claims',
  'director_attendance_status', 'talkback_status', 'date_conflict', 'grade_levels',
  'exact_grades', 'education_levels', 'grade_min', 'grade_max', 'research_batch',
  'interaction_format', 'talkback_confirmed', 'tradition_own_account',
  'social_analysis', 'social_analysis_status'
];
for (const field of requiredSchemaFields) assert(schema.properties && schema.properties[field], `Schema missing ${field}`);

const browseTaxonomy = readJson('polymythseminars/browse.json').taxonomy;
const researchTaxonomy = readJson('polymythseminars/research.json').taxonomy;
const revamp = readText('scripts/lib/polymythcal-discovery-model.js');
for (const [axis, value] of [
  ['what','event:celestial-occurrence'], ['what','event:ritual-observance'],
  ['topics','history'], ['presence','director-filmmaker'], ['grades','g4'], ['grades','undergraduate']
]) {
  const definition = browseTaxonomy?.axes?.[axis] || researchTaxonomy?.axes?.[axis];
  assert(definition?.values?.[value]?.en && definition?.values?.[value]?.fr, `Bilingual Research taxonomy missing ${axis}:${value}`);
}
for (const needle of ['event.entry_family', 'event.presence_claims', 'classifyPresence', 'classifyWhat', 'classifyGrades', "add('history')"]) {
  assert(revamp.includes(needle), `Polymythcal discovery classifier missing ${needle}`);
}

const sitemap = readText('sitemap.xml');
for (const route of [
  '/polymythseminars/events/december-solstice-2027/',
  '/polymythseminars/events/dongzhi-winter-solstice-2027/',
  '/polymythseminars/events/full-moon-2027-12-13/'
]) {
  assert(sitemap.includes(`https://seminarschools.com${route}`), `Late-2027 indexable route is absent from sitemap: ${route}`);
}

const seminarsPrompt = readText('scripts/seminars-prompt.md');
const festivalsPrompt = readText('scripts/festivals-prompt.md');
assert(seminarsPrompt.includes('Medusa regression gate'), 'Seminar prompt lacks the Medusa regression gate');
assert(seminarsPrompt.includes('Uncertainty about whether a named director attended'), 'Seminar prompt does not preserve talkbacks under uncertain attendance');
assert(festivalsPrompt.includes('The 2026 Soulpepper / Outside the March *Medusa* production'), 'Festival prompt lacks the Medusa benchmark');
assert(seminarsPrompt.includes('## Celestial, calendrical, ritual, and holiday records'), 'Seminar prompt lost the celestial/calendrical/ritual source policy');
assert(seminarsPrompt.includes('Never manufacture a ritual association from symbolic resemblance'), 'Seminar prompt lost the ritual anti-fabrication rule');

const summary = {
  manual_records: manual.length,
  consolidated_records: consolidated.length,
  imported_records: batch.length,
  confirmed: batch.filter(event => event.confirmation_status === 'confirmed').length,
  qualified_unconfirmed: batch.filter(event => event.confirmation_status === 'unconfirmed').length,
  families: Object.fromEntries([...new Set(batch.map(event => event.entry_family))].sort().map(family => [family, familyCount(family)])),
  sources: sources.length,
  medusa_regression: 'pass',
  corrected_2026_lunar_eclipse: 'pass',
  ui_discovery: 'pass'
};
console.log(JSON.stringify(summary, null, 2));
