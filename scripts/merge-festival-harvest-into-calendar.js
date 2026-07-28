#!/usr/bin/env node
/*
 * Publishes a validated festival harvest into the one public polymythcalendar
 * without replacing the seminars stream. Parent IDs are remapped when an
 * existing parent is retained, so programme records keep their hierarchy.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const FESTIVALS = process.env.POLYMYTHCAL_FESTIVALS_PATH
  ? path.resolve(process.env.POLYMYTHCAL_FESTIVALS_PATH)
  : path.join(ROOT, 'festivals', 'events.json');
const PUBLIC = process.env.POLYMYTHCAL_PUBLIC_PATH
  ? path.resolve(process.env.POLYMYTHCAL_PUBLIC_PATH)
  : path.join(ROOT, 'polymythseminars', 'events.json');
const MASTER = process.env.POLYMYTHCAL_MASTER_PATH
  ? path.resolve(process.env.POLYMYTHCAL_MASTER_PATH)
  : path.join(ROOT, 'data', 'polymyth-seminar-events.json');
function read(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function write(p, d) { fs.writeFileSync(p, JSON.stringify(d, null, 2) + '\n'); }
const hash = value => crypto.createHash('sha256').update(value).digest('hex').slice(0, 24);
const words = value => String(value || '').toLowerCase().replace(/[^\p{L}\p{N}_]+/gu, '');

function canonicalUrl(value) {
  try {
    const parsed = new URL(String(value || ''));
    if (!['http:', 'https:'].includes(parsed.protocol)) return '';
    for (const name of [...parsed.searchParams.keys()]) {
      if (/^(?:utm_|fbclid|gclid)/i.test(name)) parsed.searchParams.delete(name);
    }
    parsed.hash = '';
    if (parsed.pathname !== '/') parsed.pathname = parsed.pathname.replace(/\/+$/, '');
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
}

function derivedAliases(event) {
  const source = String(event.source_id || '').trim().toLowerCase();
  const title = words(event.title).slice(0, 180);
  const uid = String(event.external_uid || event.uid || event.event_uid || '').trim();
  const url = canonicalUrl(event.source_url);
  const bases = [];
  if (uid) bases.push(`uid::${source}::${uid}`);
  if (url) bases.push(`url::${source}::${url}::${title}`);
  if (!bases.length) {
    bases.push(`fallback::${source}::${title}::${words(event.organizer).slice(0, 120)}`);
  }
  return bases.map(hash);
}

function storedAliases(event) {
  return [...new Set([...(event.identity_aliases || []), ...derivedAliases(event)].filter(Boolean))];
}

function matchAliases(event) {
  const aliases = storedAliases(event);
  const uid = String(event.external_uid || event.uid || event.event_uid || '').trim();
  const url = canonicalUrl(event.source_url);
  if (uid) aliases.push(`raw-uid:${uid}`);
  if (url) aliases.push(`raw-url:${url}:${words(event.title).slice(0, 180)}`);
  return new Set(aliases);
}

function occurrenceKey(event) {
  if (event.occurrence_key) return String(event.occurrence_key);
  const stable = storedAliases(event)[0];
  const recurrence = String(event.recurrence_id || '').trim();
  const date = String(event.date || '');
  const venue = words(event.venue).slice(0, 180);
  return hash(`${stable}::${recurrence || date}::${venue}`);
}

function prepare(event) {
  const prepared = { ...event };
  prepared.identity_aliases = storedAliases(prepared);
  prepared.occurrence_key = occurrenceKey(prepared);
  if (!prepared.identity_key || prepared.identity_aliases.includes(prepared.identity_key)) {
    prepared.identity_key = prepared.occurrence_key;
  }
  return prepared;
}

function intersects(left, right) {
  const leftAliases = matchAliases(left);
  for (const value of matchAliases(right)) {
    if (leftAliases.has(value)) return true;
  }
  return false;
}

function sameMoment(left, right) {
  if (String(left || '') === String(right || '')) return true;
  const leftTime = Date.parse(String(left || ''));
  const rightTime = Date.parse(String(right || ''));
  return Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime === rightTime;
}

function sameExactEvent(left, right) {
  return words(left.title) === words(right.title)
    && sameMoment(left.date, right.date)
    && Boolean(words(left.venue))
    && words(left.venue) === words(right.venue);
}

function sameOccurrence(left, right) {
  if (occurrenceKey(left) === occurrenceKey(right)) return true;
  if (left.identity_key && left.identity_key === right.identity_key) return true;
  if (
    !intersects(left, right)
    || String(left.date || '').slice(0, 10) !== String(right.date || '').slice(0, 10)
  ) {
    return sameExactEvent(left, right);
  }
  const generic = value =>
    /^(?:|locationtbd|locationtba|tbd|tba|online|virtual|toronto|montreal|montréal|kingston)$/i
      .test(words(value));
  const leftVenue = words(left.venue);
  const rightVenue = words(right.venue);
  const compatible = generic(leftVenue) || generic(rightVenue)
    || leftVenue.includes(rightVenue) || rightVenue.includes(leftVenue);
  const incomplete = left.time_precision !== 'exact' || right.time_precision !== 'exact'
    || generic(leftVenue) || generic(rightVenue);
  return compatible && incomplete;
}

if (!fs.existsSync(FESTIVALS) || !fs.existsSync(PUBLIC)) throw new Error('Festival or public calendar data is missing.');
const harvested = (read(FESTIVALS).events || [])
  .filter(event => event?.title && event?.date && event?.source_url)
  .map(prepare);
const publicData = read(PUBLIC);
const events = publicData.events || [];
const idMap = new Map();
let added = 0, refreshed = 0, preservedManual = 0;
// Parent first, so every child receives the canonical retained or newly added ID.
const ordered = [...harvested].sort((a, b) => Number(Boolean(b.is_parent_festival)) - Number(Boolean(a.is_parent_festival)));
const batchAliasCounts = new Map();
for (const incoming of ordered) {
  for (const alias of matchAliases(incoming)) {
    batchAliasCounts.set(alias, (batchAliasCounts.get(alias) || 0) + 1);
  }
}
for (const incomingRaw of ordered) {
  const incoming = { ...incomingRaw, _src: 'festival-harvest' };
  let existingIndex = events.findIndex(existing => sameOccurrence(existing, incoming));
  let rescheduled = false;
  if (existingIndex < 0) {
    const aliasMatches = events
      .map((existing, index) => intersects(existing, incoming) ? index : -1)
      .filter(index => index >= 0);
    const recurringBatch = Boolean(incoming.recurrence_id)
      || [...matchAliases(incoming)].some(alias => (batchAliasCounts.get(alias) || 0) > 1);
    if (aliasMatches.length === 1 && !recurringBatch) {
      existingIndex = aliasMatches[0];
      rescheduled = true;
    }
  }
  let canonicalId = incoming.id;
  if (existingIndex < 0) {
    events.push(incoming);
    added++;
  } else {
    const old = events[existingIndex];
    canonicalId = old.id || incoming.id;
    if (old.review_status === 'manual' && incoming.review_status !== 'manual') {
      // Human-curated facts remain authoritative; retain richer taxonomy safely.
      old.secondary_types = [...new Set([...(old.secondary_types || []), ...(incoming.secondary_types || []), incoming.type].filter(Boolean))]
        .filter(t => t !== old.type);
      if (!old.parent_id && incoming.parent_id) old.parent_id = incoming.parent_id;
      if (incoming.is_parent_festival) old.is_parent_festival = true;
      preservedManual++;
    } else {
      const previousDates = [...(old.previous_dates || [])];
      if (rescheduled && old.date && old.date !== incoming.date) previousDates.push(old.date);
      events[existingIndex] = {
        ...old,
        ...incoming,
        id: canonicalId,
        identity_key: old.identity_key || incoming.identity_key,
        identity_aliases: [...new Set([...storedAliases(old), ...storedAliases(incoming)])],
        previous_dates: [...new Set(previousDates)].slice(-12),
        lifecycle_status: rescheduled
          ? 'rescheduled'
          : (incoming.lifecycle_status || old.lifecycle_status || 'active'),
        secondary_types: [...new Set([...(old.secondary_types || []), ...(incoming.secondary_types || [])])]
      };
      refreshed++;
    }
  }
  if (incoming.id) idMap.set(incoming.id, canonicalId);
}
for (const e of events) {
  if (e.parent_id && idMap.has(e.parent_id)) e.parent_id = idMap.get(e.parent_id);
}
events.sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.title).localeCompare(String(b.title)));
publicData.events = events;
publicData.count = events.length;
publicData._total_events = events.length;
publicData._comment = 'Consolidated polymythcalendar events. Festival and seminar harvests are merged into this one public calendar.';
write(PUBLIC, publicData);
write(MASTER, publicData);
console.log(`FESTIVAL CALENDAR INTEGRATION — ${added} added, ${refreshed} refreshed, ${preservedManual} manual records retained, ${events.length} total.`);
