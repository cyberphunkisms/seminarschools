#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  assertDestination,
  resolvePolymythcalDestination,
} = require('./lib/external-destination-contracts');

const ROOT = path.resolve(__dirname, '..');
const CANONICAL = path.join(ROOT, 'polymythseminars', 'events.json');
const MIRROR = path.join(ROOT, 'data', 'polymyth-seminar-events.json');
const OVERRIDES = path.join(ROOT, 'data', 'polymythcal-destination-overrides.json');
const OUTPUT_MTIME = process.env.SS_BUILD_OUTPUT_MTIME ? new Date(process.env.SS_BUILD_OUTPUT_MTIME) : null;
if (OUTPUT_MTIME && Number.isNaN(OUTPUT_MTIME.getTime())) throw new Error('SS_BUILD_OUTPUT_MTIME must be a valid timestamp');

function canonicalSourceUrl(value) {
  try {
    const parsed = new URL(String(value || ''));
    parsed.hash = '';
    return parsed.href;
  } catch (_) { return String(value || ''); }
}

function loadOverrides(events) {
  const doc = JSON.parse(fs.readFileSync(OVERRIDES, 'utf8'));
  if (!Array.isArray(doc.overrides)) throw new Error('Destination override file must contain an overrides array');
  const eventIds = new Set(events.map((event) => String(event.id || '')));
  const map = new Map();
  for (const override of doc.overrides) {
    const id = String(override.event_id || '');
    if (!id || map.has(id)) throw new Error(`Duplicate or empty destination override id: ${id || '(empty)'}`);
    if (!eventIds.has(id)) throw new Error(`Destination override references missing event: ${id}`);
    map.set(id, override);
  }
  return map;
}

function writeIfChanged(file, text) {
  const changed = !fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== text;
  if (changed) fs.writeFileSync(file, text);
  if (OUTPUT_MTIME) fs.utimesSync(file, OUTPUT_MTIME, OUTPUT_MTIME);
  return changed;
}

function main() {
  const payload = JSON.parse(fs.readFileSync(CANONICAL, 'utf8'));
  if (!Array.isArray(payload.events)) throw new Error('Canonical Polymythcal payload has no events array');
  const overrides = loadOverrides(payload.events);
  const groups = new Map();
  for (const event of payload.events) {
    const key = canonicalSourceUrl(event.source_url);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(event);
  }
  const counts = {};
  payload.events = payload.events.map((event) => {
    const destination = assertDestination(resolvePolymythcalDestination(event, {
      override: overrides.get(String(event.id || '')),
      groupEvents: groups.get(canonicalSourceUrl(event.source_url)) || [],
    }), `Polymythcal event ${event.id}`);
    counts[destination.status] = (counts[destination.status] || 0) + 1;
    const next = { ...event };
    next.destination_url = destination.href;
    next.destination_status = destination.status;
    next.destination_scope = destination.scope;
    next.destination_kind = destination.kind;
    next.destination_evidence = destination.evidence;
    return next;
  });
  const text = `${JSON.stringify(payload)}\n`;
  const canonicalChanged = writeIfChanged(CANONICAL, text);
  const mirrorChanged = writeIfChanged(MIRROR, text);
  const changed = canonicalChanged || mirrorChanged;
  console.log(
    `POLYMYTHCAL DESTINATION SPECIFICITY — ${payload.events.length} records; `
    + `${Object.entries(counts).sort().map(([key, value]) => `${key} ${value}`).join('; ')}; `
    + `${changed ? 'updated' : 'already current'}.`,
  );
}

if (require.main === module) main();

module.exports = { canonicalSourceUrl, loadOverrides };
