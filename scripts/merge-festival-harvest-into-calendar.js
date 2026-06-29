#!/usr/bin/env node
/*
 * Publishes a validated festival harvest into the one public polymythcalendar
 * without replacing the seminars stream. Parent IDs are remapped when an
 * existing parent is retained, so programme records keep their hierarchy.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const FESTIVALS = path.join(ROOT, 'festivals', 'events.json');
const PUBLIC = path.join(ROOT, 'polymythseminars', 'events.json');
const MASTER = path.join(ROOT, 'data', 'polymyth-seminar-events.json');
const key = e => `${String(e.title || '').trim().toLowerCase()}|${String(e.date || '').slice(0, 10)}`;
function read(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function write(p, d) { fs.writeFileSync(p, JSON.stringify(d, null, 2) + '\n'); }
if (!fs.existsSync(FESTIVALS) || !fs.existsSync(PUBLIC)) throw new Error('Festival or public calendar data is missing.');
const harvested = read(FESTIVALS).events || [];
const publicData = read(PUBLIC);
const events = publicData.events || [];
const idx = new Map(events.map((e, i) => [key(e), i]));
const idMap = new Map();
let added = 0, refreshed = 0, preservedManual = 0;
// Parent first, so every child receives the canonical retained or newly added ID.
const ordered = [...harvested].sort((a, b) => Number(Boolean(b.is_parent_festival)) - Number(Boolean(a.is_parent_festival)));
for (const incomingRaw of ordered) {
  if (!incomingRaw?.title || !incomingRaw?.date || !incomingRaw?.source_url) continue;
  const incoming = { ...incomingRaw, _src: 'festival-harvest' };
  const k = key(incoming);
  const existingIndex = idx.get(k);
  let canonicalId = incoming.id;
  if (existingIndex === undefined) {
    events.push(incoming);
    idx.set(k, events.length - 1);
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
      events[existingIndex] = {
        ...old, ...incoming, id: canonicalId,
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
