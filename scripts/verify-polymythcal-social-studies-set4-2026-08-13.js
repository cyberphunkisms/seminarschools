#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const readJson = rel => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
const readText = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const eventList = payload => Array.isArray(payload) ? payload : (payload.events || []);
const SRC = 'manual-polymythcal-social-studies-set4-2026-08-13';
const RESEARCH_SET = '4-Social-Studies';

const manualPayload = readJson('data/manual-events.json');
const consolidatedPayload = readJson('data/polymyth-seminar-events.json');
const publicPayload = readJson('polymythseminars/events.json');
const sourcesPayload = readJson('scripts/sources.json');
const schema = readJson('data/polymythcal-event-schema-v2.json');
const ledger = readJson('data/polymythcal-research-set-4-social-studies-2026-08-13.json');
const packageJson = readJson('package.json');
const manual = eventList(manualPayload);
const consolidated = eventList(consolidatedPayload);
const publicEvents = eventList(publicPayload);
const sources = Array.isArray(sourcesPayload) ? sourcesPayload : (sourcesPayload.sources || []);
const batch = manual.filter(event => event._src === SRC);

assert(batch.length === 68, `Expected 68 Set 4 records; found ${batch.length}`);
assert(manualPayload.polymythcal_social_studies_set4_update_2026_08_13, 'Missing Set 4 import metadata');
assert(manualPayload.polymythcal_social_studies_set4_update_2026_08_13.records_in_delta === 68, 'Set 4 metadata count drifted');
assert(manualPayload.polymythcal_social_studies_set4_update_2026_08_13.existing_records_cross_tagged === 3, 'Existing CFA cross-tag count drifted');
assert(ledger.record_count === 68 && ledger.research_set === RESEARCH_SET, 'Set 4 research ledger drifted');

const ids = new Set();
const sourceIds = new Set(sources.map(source => String(source.id || '')));
for (const event of batch) {
  assert(event.id, 'Set 4 record lacks a stable ID');
  assert(!ids.has(event.id), `Duplicate Set 4 ID: ${event.id}`);
  ids.add(event.id);
  assert(event.source_url, `${event.id}: missing source_url`);
  assert(event.source_id && sourceIds.has(String(event.source_id)), `${event.id}: unresolved source_id ${event.source_id}`);
  assert(event.record_kind === 'event' || event.record_kind === 'opportunity', `${event.id}: invalid record_kind ${event.record_kind}`);
  assert(['confirmed', 'unconfirmed'].includes(event.confirmation_status), `${event.id}: invalid confirmation_status`);
  assert(event.research_set === RESEARCH_SET, `${event.id}: missing research_set`);
  assert(Array.isArray(event.social_studies_subfields) && event.social_studies_subfields.length, `${event.id}: missing social_studies_subfields`);
  assert(Array.isArray(event.subjects) && event.subjects.includes('Social Studies'), `${event.id}: missing Social Studies subject`);
  assert(Array.isArray(event.topics) && event.topics.includes('social studies'), `${event.id}: missing social studies topic`);
  assert(event.entry_family === 'social-studies', `${event.id}: wrong entry_family`);
  if (event.confirmation_status === 'unconfirmed') {
    const reasons = Array.isArray(event.qualification_reasons) ? event.qualification_reasons : [];
    assert(reasons.length, `${event.id}: unconfirmed record lacks qualification reasons`);
    if (reasons.includes('date-unconfirmed')) {
      assert(/monitoring marker, not a confirmed/i.test(event.description || ''), `${event.id}: annual watch does not disclose marker semantics`);
      assert(event.date_precision === 'estimated', `${event.id}: annual watch must use estimated date precision`);
    } else {
      assert(reasons.includes('time-unconfirmed'), `${event.id}: unconfirmed record lacks date- or time-specific evidence status`);
      assert(event.date_precision === 'date', `${event.id}: time-only uncertainty must preserve the official date`);
      assert(event.time_precision === 'unknown', `${event.id}: time-only uncertainty must remain explicitly unknown`);
    }
  }
}

const byId = new Map(manual.map(event => [event.id, event]));
const requireId = id => {
  const event = byId.get(id);
  assert(event, `Missing required Set 4 record ${id}`);
  return event;
};
const requireParent = childId => {
  const child = requireId(childId);
  assert(child.parent_id, `${childId}: missing parent_id`);
  assert(byId.has(child.parent_id), `${childId}: unresolved parent ${child.parent_id}`);
  assert(child.series_role === 'child', `${childId}: child record lacks series_role=child`);
  return child;
};

for (const id of [
  'ontario-model-parliament-2027-series',
  'ontario-model-parliament-2027-application-deadline',
  'ontario-page-program-spring-2027-deadline',
  'quebec-parlement-ecolier-2027',
  'quebec-parlement-des-jeunes-2027',
  'house-of-commons-page-program-2027-28-opening-watch',
  'olip-2027-28-application-deadline',
  'canadian-geographic-challenge-level-1-2027-watch',
  'canadian-geographic-challenge-level-2-2027-watch',
  'cpsa-2027-conference',
  'canadian-sociological-association-2027-conference',
  'isa-world-congress-sociology-2027',
  'ssuns-2026-conference',
  'namun-2027-conference',
  'ccsr-doctoral-fellowship-2027',
  'indspire-bbf-2027-february-deadline',
  'sshrc-partnership-engage-grants-2026-december'
]) requireId(id);

for (const id of [
  'ontario-model-parliament-2027-application-deadline',
  'ontario-model-parliament-2027-virtual-start',
  'ontario-model-parliament-2027-onsite',
  'quebec-parlement-des-jeunes-2027-registration-watch',
  'quebec-forum-etudiant-2027-registration-watch',
  'canadian-economics-association-2027-cfp-watch',
  'canadian-geographic-challenge-level-1-2027-watch',
  'canadian-geographic-challenge-level-2-2027-watch',
  'canadian-geographic-challenge-level-3-2027-watch',
  'cpsa-2027-cfp-watch',
  'isa-world-congress-2027-abstract-deadline',
  'sfaa-2027-abstract-deadline',
  'ssuns-2026-registration-deadline',
  'namun-2027-registration-watch',
  'cahsmun-2027-registration-watch'
]) requireParent(id);

const grade6 = requireId('quebec-parlement-ecolier-2027');
assert(Array.isArray(grade6.exact_grades) && grade6.exact_grades.length === 1 && grade6.exact_grades[0] === 'Grade 6', 'Parlement écolier exact Grade 6 indexing failed');
const pages = requireId('ontario-page-program-spring-2027-deadline');
assert(JSON.stringify(pages.exact_grades) === JSON.stringify(['Grade 7','Grade 8']), 'Ontario Page Program exact Grades 7–8 indexing failed');
assert(!pages.exact_grades.includes('Grade 6'), 'Ontario Page Program incorrectly includes Grade 6');
const modelParliament = requireId('ontario-model-parliament-2027-series');
assert(JSON.stringify(modelParliament.exact_grades) === JSON.stringify(['Grade 10','Grade 11','Grade 12']), 'Ontario Model Parliament Grades 10–12 indexing failed');
const geo1 = requireId('canadian-geographic-challenge-level-1-2027-watch');
const geo2 = requireId('canadian-geographic-challenge-level-2-2027-watch');
assert(geo1.exact_grades.includes('Grade 4') && geo1.exact_grades.includes('Grade 6'), 'Geographic Challenge Level 1 indexing failed');
assert(geo2.exact_grades.includes('Grade 7') && geo2.exact_grades.includes('Grade 10'), 'Geographic Challenge Level 2 indexing failed');
const quebecYouth = requireId('quebec-parlement-des-jeunes-2027');
assert(!Array.isArray(quebecYouth.exact_grades) || quebecYouth.exact_grades.length === 0, 'Québec Secondary 3–4 was incorrectly converted to Canadian grades');
assert(quebecYouth.local_grade_system && quebecYouth.local_grade_system.system === 'Québec secondary', 'Québec local grade system was not preserved');

assert(/stale eligibility line/i.test(requireId('house-of-commons-page-program-2027-28-opening-watch').source_inconsistency || ''), 'House Page source inconsistency missing');
assert(/URL slug remains/i.test(requireId('cpsa-2027-conference').source_inconsistency || ''), 'CPSA URL/title inconsistency missing');
assert(/current official abstract page states October 15/i.test(requireId('sfaa-2027-abstract-deadline').source_inconsistency || ''), 'SfAA deadline reconciliation missing');

const oldBatch = manual.filter(event => event._src === 'manual-polymythcal-comprehensive-2026-08-13');
assert(oldBatch.length === 292, `Sets 1–3 batch changed from 292 to ${oldBatch.length}`);
for (const id of [
  'cfa-canada-ethics-challenge-institution-2026',
  'cfa-canada-ethics-challenge-registration-2026',
  'cfa-canada-ethics-challenge-national-2027'
]) {
  const event = requireId(id);
  assert(event._src === 'manual-polymythcal-comprehensive-2026-08-13', `${id}: original source identity was overwritten`);
  assert((event.social_studies_subfields || []).includes('Economics'), `${id}: Set 4 cross-tag missing`);
}

const consolidatedIds = new Set(consolidated.map(event => event.id));
const publicIds = new Set(publicEvents.map(event => event.id));
for (const event of batch) {
  assert(consolidatedIds.has(event.id), `${event.id}: absent from consolidated dataset`);
  assert(publicIds.has(event.id), `${event.id}: absent from public dataset`);
}
assert(consolidated.length === publicEvents.length, 'Canonical/public Polymythcal count mismatch');

for (const field of [
  'subjects','topics','opportunity_kind','research_set','research_set_cross_tags',
  'social_studies_subfields','calendar_stage','series_role','local_grade_system'
]) assert(schema.properties && schema.properties[field], `Schema missing ${field}`);

const ui = readText('polymythseminars/index.html');
const revamp = readText('js/polymythcal-revamp.js');
assert(ui.includes('topics:social-studies') && ui.includes('value="social-studies"'), 'Polymythcal UI lacks Social Studies filter');
for (const needle of ['topics.push("social-studies")','event.social_studies_subfields','event.research_set','event.subjects']) {
  assert(revamp.includes(needle), `Polymythcal search/classifier missing ${needle}`);
}

const clRows = readText('data/website-cl.jsonl').trim().split(/\n+/).map(JSON.parse);
const clById = new Map(clRows.map(row => [row.id, row]));
for (let n = 204; n <= 211; n++) {
  const id = `CL-WEB-${n}`;
  assert(clById.has(id), `Component List missing ${id}`);
  assert(clById.get(id).status === 'complete', `${id} is not complete`);
}
for (const rel of ['WEBSITE_CL_2026-07-19.md','docs/WEBSITE_CL_2026-07-19.md']) {
  const text = readText(rel);
  assert(text.includes('Completed in Polymythcal Set 4 — Social Studies'), `${rel}: missing Set 4 CL section`);
  assert(text.includes('CL-WEB-211'), `${rel}: missing final Set 4 component`);
}

const build = packageJson.scripts && packageJson.scripts['build:locked'];
for (const needle of [
  'import-polymythcal-social-studies-set4-2026-08-13.py',
  'node scripts/upsert-manual-calendar-events.js',
  'verify-polymythcal-social-studies-set4-2026-08-13.js'
]) assert(String(build).includes(needle), `build:locked missing ${needle}`);
assert((String(build).match(/(?:^| && )node scripts\/upsert-manual-calendar-events\.js(?= && |$)/g)||[]).length===1,'build:locked must contain exactly one unfiltered manual-event upsert');
assert(!/node scripts\/upsert-manual-calendar-events\.js\s+--/.test(String(build)),'build:locked must not restore a filtered manual-event upsert');
assert(packageJson.scripts['import:polymythcal-social-studies-set4-2026-08-13'], 'Missing Set 4 import script alias');
assert(packageJson.scripts['verify:polymythcal-social-studies-set4-2026-08-13'], 'Missing Set 4 verifier alias');

const summary = {
  manual_records: manual.length,
  consolidated_records: consolidated.length,
  set4_records: batch.length,
  confirmed: batch.filter(event => event.confirmation_status === 'confirmed').length,
  qualified_watches: batch.filter(event => event.confirmation_status === 'unconfirmed').length,
  sources: sources.length,
  exact_grade_checks: 'pass',
  parent_child_checks: 'pass',
  social_studies_filter: 'pass',
  change_list: 'CL-WEB-204 through CL-WEB-211 complete'
};
console.log(JSON.stringify(summary, null, 2));
