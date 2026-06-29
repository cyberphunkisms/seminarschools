#!/usr/bin/env node
/*
 * Publishes a validated seminar harvest into the one public polymythcalendar
 * without replacing the festival, contest, CFP, and manual streams already in
 * the public calendar. New/changed seminar records are upserted by title+day;
 * non-overlapping public records are preserved.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const SEMINARS = path.join(ROOT, 'seminars', 'events.json');
const PUBLIC = path.join(ROOT, 'polymythseminars', 'events.json');
const MASTER = path.join(ROOT, 'data', 'polymyth-seminar-events.json');
const key = e => `${String(e.title || '').trim().toLowerCase()}|${String(e.date || '').slice(0, 10)}`;
function read(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function write(p, d) { fs.writeFileSync(p, JSON.stringify(d, null, 2) + '\n'); }

function normalizeFestivalParentTypes(records) {
  for (const e of records) {
    if (e && e.is_parent_festival && e.type !== 'festival') {
      const oldType = e.type;
      e.type = 'festival';
      const secondary = Array.isArray(e.secondary_types) ? e.secondary_types : [];
      e.secondary_types = [...new Set([...secondary, oldType].filter(Boolean).filter(t => t !== 'festival'))];
    }
  }
}
if (!fs.existsSync(SEMINARS) || !fs.existsSync(PUBLIC)) throw new Error('Seminar or public calendar data is missing.');
const harvested = read(SEMINARS).events || [];
const publicData = read(PUBLIC);
const events = publicData.events || [];
const idx = new Map(events.map((e, i) => [key(e), i]));
let added = 0, refreshed = 0, preservedManual = 0;
for (const incomingRaw of harvested) {
  if (!incomingRaw?.title || !incomingRaw?.date || !incomingRaw?.source_url) continue;
  const incoming = { ...incomingRaw, _src: incomingRaw._src || 'seminar-harvest' };
  const k = key(incoming);
  const existingIndex = idx.get(k);
  if (existingIndex === undefined) {
    events.push(incoming);
    idx.set(k, events.length - 1);
    added++;
  } else {
    const old = events[existingIndex];
    const canonicalId = old.id || incoming.id;
    if (old.review_status === 'manual' && incoming.review_status !== 'manual') {
      old.secondary_types = [...new Set([...(old.secondary_types || []), ...(incoming.secondary_types || []), incoming.type].filter(Boolean))]
        .filter(t => t !== old.type);
      if (!old.parent_id && incoming.parent_id) old.parent_id = incoming.parent_id;
      if (incoming.is_parent_festival) old.is_parent_festival = true;
      preservedManual++;
    } else {
      events[existingIndex] = {
        ...old,
        ...incoming,
        id: canonicalId,
        secondary_types: [...new Set([...(old.secondary_types || []), ...(incoming.secondary_types || [])])]
      };
      refreshed++;
    }
  }
}
normalizeFestivalParentTypes(events);
events.sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.title).localeCompare(String(b.title)));
publicData.events = events;
publicData.count = events.length;
publicData._total_events = events.length;
publicData._comment = 'Consolidated polymythcalendar events. Seminar, festival, contest, CFP, and manual streams are merged into this one public calendar.';
write(PUBLIC, publicData);
write(MASTER, publicData);
console.log(`SEMINAR CALENDAR INTEGRATION — ${added} added, ${refreshed} refreshed, ${preservedManual} manual records retained, ${events.length} total.`);
