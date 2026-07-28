#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const {
  BROWSER_EVENT_FIELDS,
  MINIMUM_GZIP_REDUCTION,
  buildBrowserPayload,
  hasBrowserValue,
  serializeBrowserPayload
} = require('./build-polymythcal-browser-payload.js');

const ROOT = path.resolve(__dirname, '..');
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const readBytes = rel => fs.readFileSync(path.join(ROOT, rel));
const readText = rel => readBytes(rel).toString('utf8');
const readJson = rel => JSON.parse(readText(rel));
const sameBytes = (a, b) => readBytes(a).equals(readBytes(b));

const canonicalBytes = readBytes('polymythseminars/events.json');
const masterBytes = readBytes('data/polymyth-seminar-events.json');
const browserBytes = readBytes('polymythseminars/browse.json');
const publicBrowserBytes = readBytes('public/polymythseminars/browse.json');
const canonical = JSON.parse(canonicalBytes);
const browser = JSON.parse(browserBytes);
const expectedText = serializeBrowserPayload(buildBrowserPayload(canonical));
const expectedBytes = Buffer.from(expectedText);
const app = readText('js/polymythcal-revamp.js');
const headers = readText('_headers');
const report = readJson('scripts/reports/polymythcal-browser-payload-report.json');
const manifest = readJson('data/polymythcal-build-manifest.json');

check(canonicalBytes.equals(masterBytes), 'Complete public events.json no longer matches the canonical data master.');
check(browserBytes.equals(expectedBytes), 'browse.json is stale or is not the deterministic canonical projection.');
check(browserBytes.equals(publicBrowserBytes), 'Source and generated-public browse.json files differ.');
check(browser._schema === 'polymythcal-browser-payload-v1', 'Browser payload schema marker is missing or wrong.');
check(Array.isArray(canonical.events) && Array.isArray(browser.events), 'Canonical or browser events array is missing.');
check(
  canonical.events.length === 833,
  `Canonical corpus differs from the Audit 47 deduplicated inventory (${canonical.events.length}/833).`
);
check(browser.count === browser.events.length, 'Browser payload count does not match its events array.');
check(browser._canonical_count === canonical.events.length, 'Browser payload canonical count is stale.');
check(browser.events.length === canonical.events.length, 'Browser payload dropped or added event records.');

const canonicalIds = canonical.events.map(event => event.id);
const browserIds = browser.events.map(event => event.id);
check(new Set(canonicalIds).size === canonicalIds.length, 'Canonical event IDs are not unique.');
check(new Set(browserIds).size === browserIds.length, 'Browser event IDs are not unique.');
check(JSON.stringify(browserIds) === JSON.stringify(canonicalIds), 'Browser event IDs or source order differ from the canonical corpus.');

const browserFields = new Set(BROWSER_EVENT_FIELDS);
const requiredFields = [
  'id', 'title', 'description', 'raw_excerpt', 'speaker_or_director', 'organizer',
  'venue', 'city', 'country', 'corridor_zone', 'date', 'end_date', 'time_precision',
  'type', 'secondary_types', 'record_kind', 'age_band', 'writing_bands',
  'academic_bands', 'topics', 'tags', 'source_id', 'source_name', 'source_url',
  'source_quality', 'confirmation_status', 'qualification_reasons',
  'lifecycle_status', 'lifecycle_notes', 'first_seen_at', 'last_checked_at', 'scraped_at'
];
for (const field of requiredFields) {
  check(browserFields.has(field), `Generator field list omits browser-required field: ${field}.`);
}

for (let index = 0; index < canonical.events.length; index += 1) {
  const source = canonical.events[index];
  const compact = browser.events[index];
  check(compact.id === source.id, `Event ${index} has a mismatched id.`);
  check(typeof compact.title === 'string' && compact.title.length > 0, `Event ${source.id} lacks its title.`);
  check(typeof compact.date === 'string' && compact.date.length >= 10, `Event ${source.id} lacks its date.`);
  check(typeof compact.type === 'string' && compact.type.length > 0, `Event ${source.id} lacks its accepted type.`);
  check(/^https?:\/\//.test(String(compact.source_url || '')), `Event ${source.id} lacks its source link.`);
  check(
    !hasBrowserValue(source.qualification_reasons) || Array.isArray(compact.qualification_reasons),
    `Event ${source.id} lacks its non-empty qualification labels.`
  );
  check(typeof compact.confirmation_status === 'string', `Event ${source.id} lacks its confirmation label.`);
  check(typeof compact.lifecycle_status === 'string', `Event ${source.id} lacks its lifecycle label.`);
  for (const field of BROWSER_EVENT_FIELDS) {
    if (hasBrowserValue(source[field])) {
      check(
        JSON.stringify(compact[field]) === JSON.stringify(source[field]),
        `Event ${source.id} changed or truncated ${field}.`
      );
    } else {
      check(!Object.hasOwn(compact, field), `Event ${source.id} retained an empty ${field} value.`);
    }
  }
  for (const field of Object.keys(compact)) {
    check(browserFields.has(field), `Event ${source.id} contains unapproved browser field: ${field}.`);
  }
}

const canonicalTypes = [...new Set(canonical.events.map(event => event.type))].sort();
const browserTypes = [...new Set(browser.events.map(event => event.type))].sort();
check(JSON.stringify(browserTypes) === JSON.stringify(canonicalTypes), 'Browser payload does not preserve every accepted canonical event type.');
check(canonical.events.some(event => hasBrowserValue(event.description)), 'Canonical corpus has no descriptions to exercise full-description search.');
check(canonical.events.some(event => hasBrowserValue(event.raw_excerpt)), 'Canonical corpus has no raw excerpts to exercise raw-source search.');
const searchFields = [
  'title', 'description', 'speaker_or_director', 'venue', 'city', 'country',
  'type', 'secondary_types', 'age_band', 'source_id', 'source_name', 'organizer',
  'raw_excerpt', 'topics', 'tags', 'qualification_reasons'
];
const searchText = event => searchFields.map(field => {
  const value = event[field];
  return Array.isArray(value) ? value.join(',') : String(value || '');
}).join(' ');
for (let index = 0; index < canonical.events.length; index += 1) {
  check(
    searchText(browser.events[index]) === searchText(canonical.events[index]),
    `Event ${canonical.events[index].id} changed its full-text search corpus.`
  );
}
check(app.includes('const DATA_URL = "/polymythseminars/browse.json"'), 'Main/focused calendar application does not fetch browse.json.');
check(!app.includes('const DATA_URL = "/polymythseminars/events.json"'), 'Calendar application still fetches the full canonical transfer.');
check(app.includes('const PAGE_SIZE = 24;'), 'Initial 24-card render contract changed.');
check(
  /\/polymythseminars\/browse\.json\s+Cache-Control:\s*public,\s*max-age=300,\s*must-revalidate/m.test(headers),
  'browse.json lacks the audited five-minute revalidation policy.'
);
const routeSlugs = ['polymythseminars', 'writingclub', 'writingkids', 'writingjuniors', 'writingteens', 'writinggrads', 'university', 'philosophy', 'humanities', 'cfps', 'lectures', 'fellowships'];
function routeMatches(event, slug) {
  if (slug === 'polymythseminars') return true;
  const writing = Array.isArray(event.writing_bands) ? event.writing_bands.map(String) : [];
  const academic = Array.isArray(event.academic_bands) ? event.academic_bands.map(String) : [];
  if (slug === 'writingclub') return event.type === 'contest' && writing.length > 0;
  if (slug === 'writingkids') return event.type === 'contest' && writing.includes('kids');
  if (slug === 'writingjuniors') return event.type === 'contest' && writing.includes('juniors');
  if (slug === 'writingteens') return event.type === 'contest' && writing.includes('teens');
  if (slug === 'writinggrads') return event.type === 'contest' && writing.includes('grads');
  return academic.includes(slug);
}
for (const slug of routeSlugs) {
  const html = readText(`${slug}/index.html`);
  check(html.includes('id="pmEventList"'), `${slug} lost the shared calendar result mount.`);
  check(html.includes('/js/polymythcal-revamp.js'), `${slug} lost the shared compact-data calendar application.`);
  const canonicalRouteIds = canonical.events.filter(event => routeMatches(event, slug)).map(event => event.id);
  const browserRouteIds = browser.events.filter(event => routeMatches(event, slug)).map(event => event.id);
  check(
    JSON.stringify(browserRouteIds) === JSON.stringify(canonicalRouteIds),
    `${slug} focused-route membership changed in the compact projection.`
  );
}

const canonicalGzipBytes = zlib.gzipSync(canonicalBytes, { level: 9 }).length;
const browserGzipBytes = zlib.gzipSync(browserBytes, { level: 9 }).length;
const gzipReduction = 1 - browserGzipBytes / canonicalGzipBytes;
check(gzipReduction >= MINIMUM_GZIP_REDUCTION, `Browser gzip reduction ${(gzipReduction * 100).toFixed(2)}% is below 25%.`);
check(browserBytes.length < canonicalBytes.length, 'Browser payload is not smaller than the complete canonical record.');
check(report.record_count === browser.events.length, 'Browser payload report record count is stale.');
check(report.canonical_raw_bytes === canonicalBytes.length, 'Browser payload report canonical raw size is stale.');
check(report.browser_raw_bytes === browserBytes.length, 'Browser payload report raw size is stale.');
check(report.canonical_gzip_bytes === canonicalGzipBytes, 'Browser payload report canonical gzip size is stale.');
check(report.browser_gzip_bytes === browserGzipBytes, 'Browser payload report gzip size is stale.');
check(report.minimum_gzip_reduction_percent === MINIMUM_GZIP_REDUCTION * 100, 'Browser payload report reduction gate is stale.');
check(manifest.browser_payload_path === 'polymythseminars/browse.json', 'Build manifest browser payload path is missing or stale.');
check(manifest.browser_payload_sha256 === report.browser_sha256, 'Build manifest browser payload hash is stale.');
check(manifest.browser_payload_raw_bytes === browserBytes.length, 'Build manifest browser raw size is stale.');
check(manifest.browser_payload_gzip_bytes === browserGzipBytes, 'Build manifest browser gzip size is stale.');
check(manifest.browser_payload_minimum_gzip_reduction_percent === MINIMUM_GZIP_REDUCTION * 100, 'Build manifest browser reduction gate is stale.');
check(sameBytes('polymythseminars/events.json', 'public/polymythseminars/events.json'), 'Complete events.json public mirror changed while compacting browser transfer.');
check(sameBytes('_headers', 'public/_headers'), 'Generated public cache headers do not match the source contract.');

if (failures.length) {
  console.error('POLYMYTHCAL BROWSER PAYLOAD CHECK FAILED');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log(
  `POLYMYTHCAL BROWSER PAYLOAD PASSED — ${browser.events.length} IDs and ${browserTypes.length} types preserved; ` +
  `${canonicalBytes.length} → ${browserBytes.length} raw bytes; ${canonicalGzipBytes} → ${browserGzipBytes} gzip bytes ` +
  `(${(gzipReduction * 100).toFixed(2)}% reduction).`
);
