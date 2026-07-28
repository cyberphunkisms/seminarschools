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
  'scraped_at'
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
