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
const lifecyclePath = path.join(ROOT, 'data', 'polymythcal-lifecycle-state.json');
const schemaPath = path.join(ROOT, 'data', 'polymythcal-event-schema-v2.json');
const releasePath = path.join(ROOT, 'RELEASE_MANIFEST.json');

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
  const explicitStatus = String(entry.confirmation_status || '').trim();
  const qualificationReasons = Array.isArray(entry.qualification_reasons)
    ? [...entry.qualification_reasons]
    : explicitStatus === 'unconfirmed'
      ? [...(!hasExactTime ? ['time-unconfirmed'] : []), ...(!venueKnown ? ['location-unconfirmed'] : [])]
      : [];
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
    province: entry.province !== undefined ? entry.province : 'Ontario',
    country: entry.country || 'Canada',
    corridor_zone: entry.corridor_zone || 'unknown',
    timezone: entry.timezone || 'America/Toronto',
    confirmation_status: explicitStatus || (qualificationReasons.length ? 'unconfirmed' : 'confirmed'),
    qualification_reasons: qualificationReasons,
    legacy_ids: entry.legacy_ids || [],
    missing_count: Number.isInteger(entry.missing_count) ? entry.missing_count : 0,
  };
  // Manual events are the authored source of truth. Preserve every authored
  // field rather than maintaining a brittle allowlist that silently drops a
  // newly researched set. Only the merge-control switch is not event data.
  for (const [field, value] of Object.entries(entry)) {
    if (field !== 'replace_secondary_types' && value !== undefined) rec[field] = value;
  }
  rec.date = iso;
  rec.end_date = entry.end_date ? stableMinutes(entry.end_date) : null;
  rec.qualification_reasons = qualificationReasons;
  rec.confirmation_status = explicitStatus || (qualificationReasons.length ? 'unconfirmed' : 'confirmed');
  return rec;
}

const sourceFlag = process.argv.indexOf('--src');
const batchFlag = process.argv.indexOf('--batch');
const sourceFilter = sourceFlag >= 0 ? String(process.argv[sourceFlag + 1] || '') : '';
const batchFilter = batchFlag >= 0 ? String(process.argv[batchFlag + 1] || '') : '';
if (sourceFlag >= 0 && !sourceFilter) {
  console.error('MANUAL CALENDAR UPSERT — --src requires an exact _src value.');
  process.exit(2);
}
if (batchFlag >= 0 && !batchFilter) {
  console.error('MANUAL CALENDAR UPSERT — --batch requires an exact _upsert_batches value.');
  process.exit(2);
}
if (sourceFilter && batchFilter) {
  console.error('MANUAL CALENDAR UPSERT — use either --src or --batch, not both.');
  process.exit(2);
}
const manualAll = JSON.parse(fs.readFileSync(manualPath, 'utf8')).events || [];
const manual = sourceFilter
  ? manualAll.filter(entry => String(entry?._src || '') === sourceFilter)
  : batchFilter
    ? manualAll.filter(entry => Array.isArray(entry?._upsert_batches) && entry._upsert_batches.includes(batchFilter))
  : manualAll;
const payload = JSON.parse(fs.readFileSync(publicPath, 'utf8'));
const release = JSON.parse(fs.readFileSync(releasePath, 'utf8'));
const releaseGeneratedAt = String(release.generated_at || '').trim();
if (!releaseGeneratedAt || !Number.isFinite(Date.parse(releaseGeneratedAt))) {
  throw new Error('RELEASE_MANIFEST.json must provide a valid deterministic generated_at timestamp.');
}
// A canonical rebuild cannot stamp previously undated manual records with the
// wall clock. Bind their fallback provenance to the immutable release time so
// the same source always regenerates the same event corpus.
const now = new Date(releaseGeneratedAt).toISOString();
const keyIndex = new Map((payload.events || []).map((e, i) => [key(e), i]));
const idIndex = new Map((payload.events || []).map((e, i) => [String(e.id || ''), i]));
let inserted = 0, refreshed = 0;
for (const entry of manual) {
  if (!entry?.title || !entry?.date || !entry?.source_url) continue;
  const rec = asRecord(entry, now);
  for (const field of ['city', 'province', 'country', 'timezone', 'eligibility_region']) {
    if (entry[field] !== undefined && rec[field] !== entry[field]) {
      throw new Error(`Manual record ${entry.id || entry.title} changed explicit ${field}.`);
    }
  }
  const k = key(rec);
  const explicitId = String(entry.id || '');
  const idMatch = explicitId && idIndex.has(explicitId) ? idIndex.get(explicitId) : undefined;
  const legacyMatchIndices = [...new Set((entry.legacy_ids || []).map(String).filter(id => idIndex.has(id)).map(id => idIndex.get(id)))];
  if (legacyMatchIndices.length > 1) {
    throw new Error(`Manual record ${explicitId || entry.title} resolves to multiple legacy identities.`);
  }
  const legacyMatch = legacyMatchIndices[0];
  // A stable ID controls identity. Title/date is only a fallback for legacy
  // records without an ID; same-titled events can occur in different places.
  const keyMatch = idMatch !== undefined || legacyMatch !== undefined ? undefined : keyIndex.get(k);
  const candidateMatches = [...new Set([idMatch, legacyMatch, keyMatch].filter(value => value !== undefined))];
  if (candidateMatches.length > 1) {
    throw new Error(`Manual record ${explicitId || entry.title} conflicts across ID, legacy ID, or title/date identity.`);
  }
  const i = candidateMatches[0];
  if (i !== undefined) {
    const old = payload.events[i];
    const migratingLegacyIdentity = idMatch === undefined && legacyMatch !== undefined && Boolean(explicitId) && explicitId !== String(old.id || '');
    // Curated fields win, while useful fields from an existing harvested record survive.
    const previousDates = [
      ...(old.previous_dates || []),
      ...(old.date && old.date !== rec.date ? [old.date] : []),
      ...(rec.previous_dates || []),
    ];
    payload.events[i] = {
      ...old,
      ...rec,
      id: migratingLegacyIdentity ? rec.id : (old.id || rec.id),
      identity_key: migratingLegacyIdentity ? rec.identity_key : (old.identity_key || rec.identity_key),
      first_seen_at: old.first_seen_at || rec.first_seen_at,
      legacy_ids: [...new Set([...(old.legacy_ids || []), ...(rec.legacy_ids || []), ...(migratingLegacyIdentity && old.id ? [old.id] : [])])],
      previous_dates: [...new Set(previousDates)].slice(-12),
      secondary_types: entry.replace_secondary_types
        ? [...new Set(rec.secondary_types || [])]
        : [...new Set([...(old.secondary_types || []), ...(rec.secondary_types || [])])],
    };
    keyIndex.delete(key(old));
    keyIndex.set(key(payload.events[i]), i);
    if (migratingLegacyIdentity && old.id) idIndex.delete(String(old.id));
    idIndex.set(String(payload.events[i].id || ''), i);
    refreshed++;
  } else {
    payload.events.push(rec);
    keyIndex.set(k, payload.events.length - 1);
    idIndex.set(String(rec.id || ''), payload.events.length - 1);
    inserted++;
  }
}
const outputById = new Map(payload.events.map(event => [String(event.id || ''), event]));
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
const schemaFields = new Set(Object.keys(schema.properties || {}));
const mergeFields = new Set(['identity_key', 'first_seen_at', 'secondary_types', 'legacy_ids', 'previous_dates']);
for (const entry of manual) {
  const output = outputById.get(String(entry.id || ''));
  if (!output) continue;
  const authored = asRecord(entry, now);
  for (const field of ['city', 'province', 'country', 'timezone', 'eligibility_region']) {
    if (entry[field] !== undefined && output[field] !== entry[field]) {
      throw new Error(`Manual record ${entry.id || entry.title} did not preserve explicit ${field}.`);
    }
  }
  for (const field of Object.keys(entry)) {
    if (!schemaFields.has(field) || mergeFields.has(field) || field === 'replace_secondary_types') continue;
    // Compare against the canonical representation, not the raw authored
    // spelling. Dates deliberately lose seconds so every generator uses one
    // stable minute-level identity; status/reasons receive the same evidence
    // normalization used for the emitted record.
    if (JSON.stringify(output[field]) !== JSON.stringify(authored[field])) {
      throw new Error(`Manual record ${entry.id || entry.title} did not preserve authored ${field}.`);
    }
  }
}
payload.events.sort((a,b) => String(a.date).localeCompare(String(b.date)) || String(a.title).localeCompare(String(b.title)));
payload.count = payload.events.length;
payload._total_events = payload.events.length;
payload._comment = 'Consolidated polymythcalendar events. Auto-written after harvests and verified manual additions. Drives /polymythseminars/ page.';
const out = JSON.stringify(payload, null, 2) + '\n';
fs.writeFileSync(publicPath, out);
fs.writeFileSync(masterPath, out);
const lifecycleGeneratedAt = manual
  .map(entry => entry.last_checked_at || entry.scraped_at || '')
  .filter(Boolean)
  .sort()
  .at(-1) || now;
fs.writeFileSync(
  lifecyclePath,
  JSON.stringify({ generated_at: lifecycleGeneratedAt, events: payload.events }, null, 2) + '\n'
);
console.log(`MANUAL CALENDAR UPSERT — ${inserted} inserted, ${refreshed} refreshed, ${payload.events.length} total${sourceFilter ? `; source ${sourceFilter}` : batchFilter ? `; batch ${batchFilter}` : ''}.`);
