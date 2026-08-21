#!/usr/bin/env node
'use strict';

/** Prove researched set fields survive every public data surface. */
const fs = require('fs');
const path = require('path');
const { hasBrowserValue } = require('./build-polymythcal-browser-payload.js');

const ROOT = path.resolve(__dirname, '..');
const sourceOnly = process.argv.includes('--source-only');
const read = rel => fs.readFileSync(path.join(ROOT, rel));
const json = rel => JSON.parse(read(rel).toString('utf8'));
const exists = rel => fs.existsSync(path.join(ROOT, rel));
const failures = [];
const fail = message => failures.push(message);

const sets = [
  {
    number: 12,
    field: 'civic_legal_labour_formats',
    minimumTagged: 167,
    fields: [
      'civic_legal_labour_formats', 'civic_domain', 'authority_level', 'public_role',
      'participation_route', 'public_input_status', 'legal_access_status',
      'collective_action_type', 'election_stage', 'access_restrictions',
      'webcast_status', 'publication_restriction', 'public_access_status',
      'registration_required', 'event_format', 'alternate_dates', 'civic_evidence',
      'source_inconsistency', 'set12_classified_at'
    ]
  },
  {
    number: 13,
    field: 'community_heritage_formats',
    minimumTagged: 170,
    fields: [
      'community_heritage_formats', 'community_participation_roles',
      'contribution_routes', 'beneficiary_or_cause', 'place_relation',
      'community_evidence', 'community_heritage_scope',
      'community_public_access_status', 'community_registration_required',
      'community_participation_mode', 'community_date_evidence',
      'community_access_evidence', 'community_participation_evidence',
      'community_beneficiary_evidence', 'community_place_evidence',
      'community_heritage_evidence', 'set13_classified_at'
    ]
  },
  {
    number: 14,
    field: 'live_digital_formats',
    minimumTagged: 1,
    fields: [
      'live_digital_formats', 'platform_names', 'synchronous_status',
      'audience_interaction_routes', 'recording_availability', 'digital_evidence',
      'set14_classified_at', 'event_format', 'online_location', 'platform',
      'platform_notes', 'liveness_status', 'synchronicity', 'audience_interaction',
      'interaction_status', 'interaction_evidence', 'access_status',
      'registration_required', 'registration_url', 'access_route',
      'replay_archive_status', 'recording_evidence',
      'creator_participation_status', 'creator_participation_evidence',
      'occurrence_evidence', 'replay_source_field'
    ]
  },
  {
    number: 15,
    field: 'course_program_formats',
    minimumTagged: 1,
    fields: [
      'course_program_formats', 'program_stage', 'schedule_model', 'session_count',
      'program_stage_source_value', 'program_schedule_detail',
      'program_start_date', 'program_end_date', 'eligibility_audience',
      'registration_application_route', 'program_date_precision',
      'application_deadline', 'registration_deadline', 'session_count_status',
      'parent_id', 'child_ids', 'series_role', 'alternate_sections',
      'evidence_facts', 'evidence', 'source_control', 'program_evidence',
      'set15_alternate_date_details', 'set15_child_ids',
      'set15_eligibility_audience', 'set15_evidence_source_id',
      'set15_evidence_source_name', 'set15_evidence_source_url',
      'set15_parent_id', 'set15_program_start_date', 'set15_program_end_date',
      'set15_program_evidence_facts', 'set15_program_stage_source',
      'set15_registration_application_route', 'set15_schedule_model_source',
      'set15_series_role', 'set15_series_role_source',
      'set15_session_count_status', 'set15_source_caveats',
      'set15_source_formats', 'set15_time_precision_source', 'set15_classified_at'
    ]
  }
];

const manual = json('data/manual-events.json').events || [];
const canonical = json('polymythseminars/events.json').events || [];
const browser = json('polymythseminars/browse.json').events || [];
const byId = rows => new Map(rows.map(row => [String(row.id || ''), row]));
const manualById = byId(manual);
const canonicalById = byId(canonical);
const browserById = byId(browser);
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const detailText = new Map();
const escapeHtml = value => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#x27;');

for (const set of sets) {
  const tagged = manual.filter(event => Array.isArray(event[set.field]) && event[set.field].length);
  if (tagged.length < set.minimumTagged) {
    fail(`Set ${set.number} has ${tagged.length} tagged manual records; expected at least ${set.minimumTagged}.`);
  }
  for (const authored of tagged) {
    const id = String(authored.id || '');
    const output = canonicalById.get(id);
    const compact = browserById.get(id);
    if (!output) { fail(`Set ${set.number} manual record ${id} is missing from canonical events.`); continue; }
    if (!compact) { fail(`Set ${set.number} canonical record ${id} is missing from browse.json.`); continue; }
    for (const field of set.fields) {
      if (Object.hasOwn(authored, field) && !equal(output[field], authored[field])) {
        fail(`Set ${set.number} record ${id} changed ${field} between manual and canonical data.`);
      }
      if (hasBrowserValue(output[field])) {
        if (!equal(compact[field], output[field])) {
          fail(`Set ${set.number} record ${id} changed or lost ${field} in browse.json.`);
        }
      } else if (Object.hasOwn(compact, field)) {
        fail(`Set ${set.number} record ${id} retained empty ${field} in browse.json.`);
      }
    }
    if (!sourceOnly) {
      const evidenceField = set.number === 12 ? 'civic_evidence'
        : set.number === 13 ? 'community_evidence'
        : set.number === 14 ? 'digital_evidence' : 'program_evidence';
      const evidence = String(output[evidenceField] || '').trim();
      for (const [locale, rel] of [
        ['EN', `polymythseminars/events/${id}/index.html`],
        ['FR', `polymythseminars/fr/events/${id}/index.html`]
      ]) {
        if (!exists(rel)) {
          fail(`Set ${set.number} ${locale} detail page is missing for ${id}.`);
          continue;
        }
        const page = detailText.get(rel) || read(rel).toString('utf8');
        detailText.set(rel, page);
        if (evidence && !page.includes('pm-event-context')) {
          fail(`Set ${set.number} ${locale} detail page ${id} omits its context/evidence section.`);
        } else if (evidence && !page.includes(escapeHtml(evidence))) {
          fail(`Set ${set.number} ${locale} detail page ${id} omits the exact researched evidence.`);
        }
      }
    }
  }
}

if (manualById.size !== manual.length) fail('Manual event IDs are not unique.');
if (canonicalById.size !== canonical.length) fail('Canonical event IDs are not unique.');
if (browserById.size !== browser.length) fail('Browser event IDs are not unique.');

if (!sourceOnly) {
  for (const rel of ['polymythseminars/events.json', 'polymythseminars/browse.json']) {
    const publicRel = `public/${rel}`;
    if (!exists(publicRel)) fail(`${publicRel} is missing.`);
    else if (!read(rel).equals(read(publicRel))) fail(`${rel} and ${publicRel} differ.`);
  }
}

if (failures.length) {
  console.error('POLYMYTHCAL SET FIELD PROPAGATION FAILED');
  for (const failure of failures.slice(0, 300)) console.error(` - ${failure}`);
  if (failures.length > 300) console.error(` - … ${failures.length - 300} additional failures`);
  process.exit(1);
}

console.log(
  `POLYMYTHCAL SET FIELD PROPAGATION PASSED — ${canonical.length} canonical records; ` +
  sets.map(set => `Set ${set.number}: ${manual.filter(event => Array.isArray(event[set.field]) && event[set.field].length).length}`).join('; ') +
  `${sourceOnly ? '; source-only proof' : '; source/public/detail proof'}.`
);
