#!/usr/bin/env node
/*
 * Adds or refreshes every manual event in the public polymythcalendar dataset
 * without discarding existing harvested records. Manual records receive the
 * same stable ID and provenance shape as merge_and_finalize.py.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const manualPath = path.join(ROOT, 'data', 'manual-events.json');
const publicPath = path.join(ROOT, 'polymythseminars', 'events.json');
const masterPath = path.join(ROOT, 'data', 'polymyth-seminar-events.json');

function stableMinutes(iso) {
  const m = String(iso || '').match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?([+-]\d{2}:\d{2}|Z)?$/);
  return m ? `${m[1]}${m[2] || ''}` : String(iso || '');
}
function makeId(sourceUrl, iso, title) {
  return crypto.createHash('sha1').update(`${sourceUrl}::${stableMinutes(iso)}::${title}`, 'utf8').digest('hex').slice(0, 12);
}
function key(e) { return `${String(e.title || '').trim().toLowerCase()}|${String(e.date || '').slice(0,10)}`; }
function asRecord(entry, now) {
  const sourceUrl = entry.source_url || 'https://seminarschools.com/polymythseminars/';
  const iso = stableMinutes(entry.date);
  const hasExactTime = entry.time_precision === 'exact' || !/T00:00(?:[+-]|Z|$)/.test(iso);
  const venueKnown = Boolean(entry.venue && !/unconfirmed/i.test(entry.venue));
  const qualificationReasons = Array.isArray(entry.qualification_reasons)
    ? entry.qualification_reasons
    : [...(!hasExactTime ? ['time-unconfirmed'] : []), ...(!venueKnown ? ['location-unconfirmed'] : [])];
  const rec = {
    id: entry.id || makeId(sourceUrl, iso, entry.title),
    identity_key: entry.identity_key || crypto.createHash('sha256').update(`${sourceUrl}::${entry.title}::${iso.slice(0,10)}`, 'utf8').digest('hex').slice(0, 20),
    date: iso,
    end_date: entry.end_date ? stableMinutes(entry.end_date) : null,
    title: entry.title,
    venue: entry.venue || 'Location unconfirmed · Lieu non confirmé',
    source_url: sourceUrl,
    source_id: entry.source_id || 'manual-curated',
    type: entry.type || 'lecture',
    speaker_or_director: entry.speaker_or_director || null,
    attendance_confirmed: entry.attendance_confirmed !== false,
    confidence: entry.confidence ?? 100,
    four_condition_test: entry.four_condition_test || { time_place: hasExactTime && venueKnown, prepared_offering: true, substantive_engagement: true, intellectual_stake: true },
    raw_excerpt: String(entry.raw_excerpt || entry.description || '').slice(0, 700),
    scraped_at: entry.scraped_at || now,
    review_status: 'manual',
    marginalia_url: entry.marginalia_url || null,
    secondary_types: entry.secondary_types || [],
    parent_id: entry.parent_id || null,
    is_parent_festival: Boolean(entry.is_parent_festival),
    age_band: entry.age_band || null,
    description: entry.description || undefined,
    _src: entry._src || 'manual',
    record_kind: entry.record_kind || (entry.type === 'festival' ? 'festival' : 'event'),
    date_precision: entry.date_precision || (hasExactTime ? 'exact' : 'date'),
    time_precision: entry.time_precision || (hasExactTime ? 'exact' : 'unknown'),
    source_quality: entry.source_quality || 'official-or-institutional',
    source_language: entry.source_language || 'en-CA',
    platform_adapter: entry.platform_adapter || 'manual',
    first_seen_at: entry.first_seen_at || now,
    last_checked_at: entry.last_checked_at || now,
    lifecycle_status: entry.lifecycle_status || 'active',
    city: entry.city || 'Unknown',
    province: entry.province || 'Ontario',
    country: entry.country || 'Canada',
    corridor_zone: entry.corridor_zone || 'unknown',
    timezone: entry.timezone || 'America/Toronto',
    confirmation_status: entry.confirmation_status || (qualificationReasons.length ? 'unconfirmed' : 'confirmed'),
    qualification_reasons: qualificationReasons,
    legacy_ids: entry.legacy_ids || [],
    missing_count: Number.isInteger(entry.missing_count) ? entry.missing_count : 0,
  };
  const passthrough = [
    'writing_bands', 'academic_bands', 'subjects', 'genres', 'eligibility_region',
    'opportunity_kind', 'application_url', 'registration_url', 'submission_url',
    'rules_url', 'deadline_confidence', 'source_notes', 'topics', 'organizer',
    'series_title', 'research_id', 'research_source_ref', 'research_priority',
    'research_registry_status', 'recurrence_note'
  ];
  for (const field of passthrough) {
    if (entry[field] !== undefined) rec[field] = entry[field];
  }
  return rec;
}

const manual = JSON.parse(fs.readFileSync(manualPath, 'utf8')).events || [];
const payload = JSON.parse(fs.readFileSync(publicPath, 'utf8'));
const now = new Date().toISOString();
const index = new Map((payload.events || []).map((e, i) => [key(e), i]));
let inserted = 0, refreshed = 0;
for (const entry of manual) {
  if (!entry?.title || !entry?.date || !entry?.source_url) continue;
  const rec = asRecord(entry, now);
  const k = key(rec);
  if (index.has(k)) {
    const i = index.get(k);
    const old = payload.events[i];
    // Curated fields win, while useful fields from an existing harvested record survive.
    payload.events[i] = { ...old, ...rec, id: old.id || rec.id, secondary_types: [...new Set([...(old.secondary_types || []), ...(rec.secondary_types || [])])] };
    refreshed++;
  } else {
    payload.events.push(rec);
    index.set(k, payload.events.length - 1);
    inserted++;
  }
}
payload.events.sort((a,b) => String(a.date).localeCompare(String(b.date)) || String(a.title).localeCompare(String(b.title)));
payload.count = payload.events.length;
payload._total_events = payload.events.length;
payload._comment = 'Consolidated polymythcalendar events. Auto-written after harvests and verified manual additions. Drives /polymythseminars/ page.';
const out = JSON.stringify(payload, null, 2) + '\n';
fs.writeFileSync(publicPath, out);
fs.writeFileSync(masterPath, out);
console.log(`MANUAL CALENDAR UPSERT — ${inserted} inserted, ${refreshed} refreshed, ${payload.events.length} total.`);
