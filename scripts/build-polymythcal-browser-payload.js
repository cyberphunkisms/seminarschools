#!/usr/bin/env node
'use strict';

/**
 * Build the compact data projection used by the main and focused Polymythcal
 * calendar shells. The canonical events.json remains the complete public
 * record used by feeds, event-detail pages, research, and downstream tools.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const {
  assertDestination,
  polymythcalDestination,
} = require('./lib/external-destination-contracts');
const { assertCurrentDatasetVersion } = require('./lib/versioned-data-migrations');

const ROOT = path.resolve(__dirname, '..');
const CANONICAL_PATH = path.join(ROOT, 'polymythseminars', 'events.json');
const BROWSER_PATH = path.join(ROOT, 'polymythseminars', 'browse.json');
const REPORT_PATH = path.join(ROOT, 'scripts', 'reports', 'polymythcal-browser-payload-report.json');
const MINIMUM_GZIP_REDUCTION = 0.25;
const BUILD_MTIME = new Date(process.env.SS_BUILD_OUTPUT_MTIME || '2034-01-06T00:00:00Z');
if (Number.isNaN(BUILD_MTIME.getTime())) {
  throw new Error('SS_BUILD_OUTPUT_MTIME must be a valid timestamp');
}

// Fixed order keeps byte output deterministic. These are the source fields
// consumed by hydrate(), search, filters, cards, saved listings, focused-route
// matching, and lifecycle/qualification labels in polymythcal-revamp.js.
const BROWSER_EVENT_FIELDS = Object.freeze([
  'id',
  'title',
  'description',
  'raw_excerpt',
  'speaker_or_director',
  'organizer',
  'venue',
  'city',
  'country',
  'corridor_zone',
  'latitude',
  'longitude',
  'location_precision',
  'date',
  'end_date',
  'date_precision',
  'time_precision',
  'type',
  'secondary_types',
  'record_kind',
  'age_band',
  'writing_bands',
  'academic_bands',
  'topics',
  'tags',
  'source_id',
  'source_name',
  'source_url',
  'destination_url',
  'destination_status',
  'destination_scope',
  'destination_kind',
  'destination_evidence',
  'source_quality',
  'source_language',
  'source_languages',
  'source_language_method',
  'source_language_review',
  'confirmation_status',
  'qualification_reasons',
  'lifecycle_status',
  'lifecycle_notes',
  'first_seen_at',
  'last_checked_at',
  'scraped_at',
  'entry_family',
  'calendar_systems',
  'traditions',
  'ritual_associations',
  'social_functions',
  'socio_note',
  'celestial_system',
  'astronomy_visibility',
  'observer_notes',
  'presence_claims',
  'participant_presence',
  'presence_categories',
  'presence_mode',
  'event_format',
  'talkback_time_precision',
  'director_attendance_status',
  'talkback_status',
  'date_conflict',
  'alternate_date_ranges',
  'source_inconsistency',
  'eligibility_status',
  'grade_levels',
  'exact_grades',
  'education_levels',
  'grade_min',
  'grade_max',
  'age_range',
  'participation_unit',
  'access_route',
  'prize_form',
  'languages',
  'institutional_restriction',
  'ideological_sponsorship',
  'commercial_sponsorship',
  'ai_rule',
  'event_year',
  'deadline_year',
  'interaction_format',
  'talkback_confirmed',
  'tradition_own_account',
  'social_analysis',
  'social_analysis_status',
  'academic_event_forms',
  'academic_disciplines',
  'public_intellectual_academic_formats',
  'arts_event_forms',
  'arts_disciplines',
  'arts_occurrence_role',
  'arts_access_status',
  'participatory_formats',
  'participation_mode',
  'participation_roles',
  'facilitation_status',
  'skill_level',
  'drop_in_status',
  'participation_required',
  'participation_evidence',
  'civic_legal_labour_formats',
  'civic_domain',
  'authority_level',
  'public_role',
  'participation_route',
  'public_input_status',
  'legal_access_status',
  'public_access_status',
  'registration_required',
  'collective_action_type',
  'election_stage',
  'access_restrictions',
  'webcast_status',
  'publication_restriction',
  'alternate_dates',
  'civic_evidence',
  'set12_classified_at',
  'community_heritage_formats',
  'community_participation_roles',
  'contribution_routes',
  'beneficiary_or_cause',
  'place_relation',
  'community_evidence',
  'community_heritage_scope',
  'community_public_access_status',
  'community_registration_required',
  'community_participation_mode',
  'community_date_evidence',
  'community_access_evidence',
  'community_participation_evidence',
  'community_beneficiary_evidence',
  'community_place_evidence',
  'community_heritage_evidence',
  'set13_classified_at',
  'live_digital_formats',
  'platform_names',
  'synchronous_status',
  'audience_interaction_routes',
  'recording_availability',
  'digital_evidence',
  'set14_classified_at',
  'online_location',
  'platform',
  'platform_notes',
  'liveness_status',
  'synchronicity',
  'audience_interaction',
  'interaction_status',
  'interaction_evidence',
  'access_status',
  'registration_url',
  'replay_archive_status',
  'recording_evidence',
  'creator_participation_status',
  'creator_participation_evidence',
  'occurrence_evidence',
  'replay_source_field',
  'course_program_formats',
  'program_stage',
  'schedule_model',
  'program_stage_source_value',
  'program_schedule_detail',
  'program_start_date',
  'program_end_date',
  'eligibility_audience',
  'registration_application_route',
  'program_date_precision',
  'application_deadline',
  'registration_deadline',
  'session_count_status',
  'parent_id',
  'child_ids',
  'series_role',
  'alternate_sections',
  'evidence_facts',
  'evidence',
  'source_control',
  'session_count',
  'program_evidence',
  'set15_alternate_date_details',
  'set15_child_ids',
  'set15_eligibility_audience',
  'set15_evidence_source_id',
  'set15_evidence_source_name',
  'set15_evidence_source_url',
  'set15_parent_id',
  'set15_program_start_date',
  'set15_program_end_date',
  'set15_program_evidence_facts',
  'set15_program_stage_source',
  'set15_registration_application_route',
  'set15_schedule_model_source',
  'set15_series_role',
  'set15_series_role_source',
  'set15_session_count_status',
  'set15_source_caveats',
  'set15_source_formats',
  'set15_time_precision_source',
  'set15_classified_at'
]);

function hasBrowserValue(value) {
  if (value === undefined || value === null || value === '') return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}

function compactEvent(event) {
  const compact = {};
  for (const field of BROWSER_EVENT_FIELDS) {
    if (hasBrowserValue(event[field])) compact[field] = event[field];
  }
  return compact;
}

function buildBrowserPayload(canonical) {
  assertCurrentDatasetVersion('polymythcal-events', canonical);
  if (!canonical || !Array.isArray(canonical.events)) {
    throw new Error('Canonical Polymythcal data must contain an events array.');
  }
  const ids = new Set();
  for (const event of canonical.events) {
    if (!event || typeof event.id !== 'string' || !event.id.trim()) {
      throw new Error('Every canonical Polymythcal record needs a non-empty string id.');
    }
    if (ids.has(event.id)) throw new Error(`Duplicate canonical Polymythcal id: ${event.id}`);
    ids.add(event.id);
    assertDestination(polymythcalDestination(event), `Polymythcal event ${event.id}`);
  }
  const events = canonical.events.map(compactEvent);
  return {
    _schema: 'polymythcal-browser-payload-v1',
    _comment: 'Compact projection for main and focused calendar browsing. Full records: /polymythseminars/events.json.',
    _generated_at: canonical._generated_at || null,
    _canonical_count: events.length,
    count: events.length,
    events
  };
}

function serializeBrowserPayload(payload) {
  return `${JSON.stringify(payload)}\n`;
}

function writeIfChanged(file, text) {
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === text) {
    if (fs.statSync(file).mtime < BUILD_MTIME) fs.utimesSync(file, BUILD_MTIME, BUILD_MTIME);
    return false;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  fs.utimesSync(file, BUILD_MTIME, BUILD_MTIME);
  return true;
}

function main() {
  const canonicalBytes = fs.readFileSync(CANONICAL_PATH);
  const canonical = JSON.parse(canonicalBytes);
  const payload = buildBrowserPayload(canonical);
  const text = serializeBrowserPayload(payload);
  const browserBytes = Buffer.from(text);
  const changed = writeIfChanged(BROWSER_PATH, text);
  const canonicalGzipBytes = zlib.gzipSync(canonicalBytes, { level: 9 }).length;
  const browserGzipBytes = zlib.gzipSync(browserBytes, { level: 9 }).length;
  const report = {
    generated_at: canonical._generated_at || null,
    schema: payload._schema,
    canonical_path: 'polymythseminars/events.json',
    browser_path: 'polymythseminars/browse.json',
    record_count: payload.count,
    canonical_sha256: crypto.createHash('sha256').update(canonicalBytes).digest('hex'),
    browser_sha256: crypto.createHash('sha256').update(browserBytes).digest('hex'),
    canonical_raw_bytes: canonicalBytes.length,
    browser_raw_bytes: browserBytes.length,
    raw_reduction_percent: Number(((1 - browserBytes.length / canonicalBytes.length) * 100).toFixed(2)),
    canonical_gzip_bytes: canonicalGzipBytes,
    browser_gzip_bytes: browserGzipBytes,
    gzip_reduction_percent: Number(((1 - browserGzipBytes / canonicalGzipBytes) * 100).toFixed(2)),
    minimum_gzip_reduction_percent: MINIMUM_GZIP_REDUCTION * 100,
    full_record_contract_preserved: true
  };
  writeIfChanged(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    `POLYMYTHCAL BROWSER PAYLOAD — ${payload.count} records, ${browserBytes.length} raw bytes, ` +
    `${browserGzipBytes} gzip bytes (${report.gzip_reduction_percent}% below canonical), ` +
    `${changed ? 'updated' : 'already current'}.`
  );
}

if (require.main === module) main();

module.exports = {
  BROWSER_EVENT_FIELDS,
  CANONICAL_PATH,
  BROWSER_PATH,
  REPORT_PATH,
  MINIMUM_GZIP_REDUCTION,
  buildBrowserPayload,
  compactEvent,
  hasBrowserValue,
  serializeBrowserPayload
};
