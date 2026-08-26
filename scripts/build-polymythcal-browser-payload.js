#!/usr/bin/env node
'use strict';

/**
 * Build Polymythcal's public discovery payloads from the complete editorial
 * master. The browser receives an allowlisted chronology projection and an
 * independently labelled date-pending watchlist. It never receives the
 * complete editorial record.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const {
  assertDestination,
  polymythcalDestination
} = require('./lib/external-destination-contracts');
const { assertCurrentDatasetVersion } = require('./lib/versioned-data-migrations');
const {
  EXPECTED_MONITORING_MARKER_COUNT,
  PERSISTED_SEARCH_GROUPS,
  PUBLIC_ACTION_CANDIDATE_FIELDS,
  PUBLIC_EVENT_KEYS,
  SEARCH_GROUPS,
  buildDiscoveryPayloads,
  hasPublicValue,
  parentId
} = require('./lib/polymythcal-discovery-model');

const ROOT = path.resolve(__dirname, '..');
const CANONICAL_PATH = path.join(ROOT, 'data', 'polymyth-seminar-events.json');
const RELEASE_MANIFEST_PATH = path.join(ROOT, 'RELEASE_MANIFEST.json');
const BROWSER_PATH = path.join(ROOT, 'polymythseminars', 'browse.json');
const WATCHLIST_PATH = path.join(ROOT, 'polymythseminars', 'watchlist.json');
const RESEARCH_PATH = path.join(ROOT, 'polymythseminars', 'research.json');
const SURFACE_MANIFEST_PATH = path.join(ROOT, 'data', 'polymythcal-publication-surfaces.json');
const REPORT_PATH = path.join(ROOT, 'scripts', 'reports', 'polymythcal-browser-payload-report.json');
const EXPECTED_CANONICAL_COUNT = 2088;
const EXPECTED_CHRONOLOGY_COUNT = 1954;
const MINIMUM_GZIP_REDUCTION = 0.25;
const BUILD_MTIME = new Date(process.env.SS_BUILD_OUTPUT_MTIME || '2034-01-11T00:00:00Z');

if (Number.isNaN(BUILD_MTIME.getTime())) {
  throw new Error('SS_BUILD_OUTPUT_MTIME must be a valid timestamp.');
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function gzipSize(value) {
  return zlib.gzipSync(value, { level: 9 }).length;
}

function serializeBrowserPayload(payload) {
  return `${JSON.stringify(payload)}\n`;
}

function serializeWatchlistPayload(payload) {
  return `${JSON.stringify(payload)}\n`;
}

function serializeResearchPayload(payload) {
  return `${JSON.stringify(payload)}\n`;
}

function serializeSurfaceManifest(payload) {
  return `${JSON.stringify(payload, null, 2)}\n`;
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

function assertReleaseInventory(canonical, payloads) {
  const canonicalCount = canonical.events.length;
  const chronologyCount = payloads.browse.events.length;
  const watchlistCount = payloads.watchlist.items.length;
  if (canonicalCount !== EXPECTED_CANONICAL_COUNT) {
    throw new Error(`Polymythcal discovery v2 expected ${EXPECTED_CANONICAL_COUNT} canonical records; found ${canonicalCount}.`);
  }
  if (watchlistCount !== EXPECTED_MONITORING_MARKER_COUNT) {
    throw new Error(`Polymythcal discovery v2 expected ${EXPECTED_MONITORING_MARKER_COUNT} explicit monitoring markers; found ${watchlistCount}.`);
  }
  if (chronologyCount !== EXPECTED_CHRONOLOGY_COUNT) {
    throw new Error(`Polymythcal discovery v2 expected ${EXPECTED_CHRONOLOGY_COUNT} chronology records; found ${chronologyCount}.`);
  }
  if (chronologyCount + watchlistCount !== canonicalCount) {
    throw new Error('Polymythcal public surfaces do not partition the canonical inventory.');
  }
}

function validateDestinations(canonical) {
  for (const event of canonical.events) {
    assertDestination(polymythcalDestination(event), `Polymythcal event ${event.id}`);
  }
}

function buildBrowserPayload(canonical) {
  return buildDiscoveryPayloads(canonical).browse;
}

function buildReport(canonicalBytes, payloads, outputBytes) {
  const canonicalGzipBytes = gzipSize(canonicalBytes);
  const browserGzipBytes = gzipSize(outputBytes.browser);
  const watchlistGzipBytes = gzipSize(outputBytes.watchlist);
  const researchGzipBytes = gzipSize(outputBytes.research);
  const canonical = JSON.parse(canonicalBytes);
  const seriesParents = new Set();
  let seriesOccurrences = 0;
  for (const event of canonical.events) {
    const id = parentId(event);
    if (!id) continue;
    seriesParents.add(id);
    seriesOccurrences += 1;
  }
  const projectedById = new Map([
    ...payloads.browse.events,
    ...payloads.watchlist.items
  ].map(event => [event.id, event]));
  const typedKinds = new Set(PUBLIC_ACTION_CANDIDATE_FIELDS.map(([, kind]) => kind));
  const unavailableWithCandidate = canonical.events.filter(event =>
    event.destination_status === 'unavailable-specific-page'
    && PUBLIC_ACTION_CANDIDATE_FIELDS.some(([field]) => String(event[field] || '').startsWith('https://'))
  );
  const recoveredUnavailable = unavailableWithCandidate.filter(event =>
    (projectedById.get(event.id)?.actions || []).some(action => typedKinds.has(action.kind))
  );
  const typedActions = [...projectedById.values()].flatMap(event =>
    (event.actions || []).filter(action => typedKinds.has(action.kind))
  );
  const typedActionRecords = [...projectedById.values()].filter(event =>
    (event.actions || []).some(action => typedKinds.has(action.kind))
  );
  const recoveredByKind = Object.fromEntries([...typedKinds].map(kind => [
    kind,
    recoveredUnavailable.filter(event =>
      (projectedById.get(event.id)?.actions || []).some(action => action.kind === kind)
    ).length
  ]));
  return {
    generated_at: payloads.browse._generated_at,
    schema: payloads.browse._schema,
    canonical_path: 'data/polymyth-seminar-events.json',
    browser_path: 'polymythseminars/browse.json',
    watchlist_path: 'polymythseminars/watchlist.json',
    research_path: 'polymythseminars/research.json',
    publication_surfaces_path: 'data/polymythcal-publication-surfaces.json',
    canonical_count: payloads.browse._canonical_count,
    chronology_count: payloads.browse.count,
    watchlist_count: payloads.watchlist.count,
    explicit_monitoring_marker_count: payloads.watchlist.count,
    series_parent_count: seriesParents.size,
    series_occurrence_count: seriesOccurrences,
    canonical_sha256: sha256(canonicalBytes),
    browser_sha256: sha256(outputBytes.browser),
    watchlist_sha256: sha256(outputBytes.watchlist),
    research_sha256: sha256(outputBytes.research),
    publication_surfaces_sha256: sha256(outputBytes.manifest),
    canonical_raw_bytes: canonicalBytes.length,
    browser_raw_bytes: outputBytes.browser.length,
    watchlist_raw_bytes: outputBytes.watchlist.length,
    research_raw_bytes: outputBytes.research.length,
    canonical_gzip_bytes: canonicalGzipBytes,
    browser_gzip_bytes: browserGzipBytes,
    watchlist_gzip_bytes: watchlistGzipBytes,
    research_gzip_bytes: researchGzipBytes,
    freshness: payloads.browse.freshness,
    raw_reduction_percent: Number(((1 - outputBytes.browser.length / canonicalBytes.length) * 100).toFixed(2)),
    gzip_reduction_percent: Number(((1 - browserGzipBytes / canonicalGzipBytes) * 100).toFixed(2)),
    minimum_gzip_reduction_percent: MINIMUM_GZIP_REDUCTION * 100,
    public_projection_allowlisted: true,
    complete_editorial_record_public: false,
    fielded_unicode_search: true,
    persisted_search_groups: PERSISTED_SEARCH_GROUPS,
    derived_search_groups: SEARCH_GROUPS,
    publication_partition_complete: true,
    typed_action_candidate_fields: PUBLIC_ACTION_CANDIDATE_FIELDS.map(([field, kind]) => ({ field, kind })),
    unavailable_with_safe_candidate_count: unavailableWithCandidate.length,
    typed_action_recovered_unavailable_record_count: recoveredUnavailable.length,
    typed_action_recovered_unavailable_by_kind: recoveredByKind,
    typed_action_total_record_count: typedActionRecords.length,
    typed_action_total_action_count: typedActions.length,
    typed_action_recovery_complete: recoveredUnavailable.length === unavailableWithCandidate.length
  };
}

function main() {
  const canonicalBytes = fs.readFileSync(CANONICAL_PATH);
  const canonical = JSON.parse(canonicalBytes);
  const releaseManifest = JSON.parse(fs.readFileSync(RELEASE_MANIFEST_PATH));
  assertCurrentDatasetVersion('polymythcal-events', canonical);
  validateDestinations(canonical);

  const discoveryBuildTimestamp = String(
    process.env.POLYMYTHCAL_BUILD_AT
    || process.env.MEPHISTODATA_GENERATED_AT
    || releaseManifest.polymythcal_discovery_built_at
    || releaseManifest.generated_at
    || ''
  ).trim();
  if (!Number.isFinite(Date.parse(discoveryBuildTimestamp))) {
    throw new Error('Polymythcal build timestamp must be a valid ISO-8601 value.');
  }
  const payloads = buildDiscoveryPayloads(canonical, { builtAt: discoveryBuildTimestamp });
  assertReleaseInventory(canonical, payloads);

  const browserText = serializeBrowserPayload(payloads.browse);
  const watchlistText = serializeWatchlistPayload(payloads.watchlist);
  const researchText = serializeResearchPayload(payloads.research);
  const manifestText = serializeSurfaceManifest(payloads.manifest);
  const outputBytes = {
    browser: Buffer.from(browserText),
    watchlist: Buffer.from(watchlistText),
    research: Buffer.from(researchText),
    manifest: Buffer.from(manifestText)
  };
  const report = buildReport(canonicalBytes, payloads, outputBytes);
  if (!report.typed_action_recovery_complete) {
    throw new Error(
      `Typed action recovery projected ${report.typed_action_recovered_unavailable_record_count} of ` +
      `${report.unavailable_with_safe_candidate_count} unavailable records with safe candidate routes.`
    );
  }
  if (report.gzip_reduction_percent < MINIMUM_GZIP_REDUCTION * 100) {
    throw new Error(
      `Polymythcal discovery payload gzip reduction ${report.gzip_reduction_percent}% ` +
      `is below the ${MINIMUM_GZIP_REDUCTION * 100}% release floor.`
    );
  }

  const changes = {
    browse: writeIfChanged(BROWSER_PATH, browserText),
    watchlist: writeIfChanged(WATCHLIST_PATH, watchlistText),
    research: writeIfChanged(RESEARCH_PATH, researchText),
    surfaces: writeIfChanged(SURFACE_MANIFEST_PATH, manifestText)
  };
  writeIfChanged(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);

  console.log(
    `POLYMYTHCAL DISCOVERY V2 — ${report.chronology_count} chronology + ` +
    `${report.watchlist_count} watchlist = ${report.canonical_count}; ` +
    `${report.browser_raw_bytes} raw / ${report.browser_gzip_bytes} gzip bytes; ` +
    `${Object.values(changes).some(Boolean) ? 'updated' : 'already current'}.`
  );
}

if (require.main === module) main();

module.exports = {
  BROWSER_EVENT_FIELDS: PUBLIC_EVENT_KEYS,
  BROWSER_PATH,
  CANONICAL_PATH,
  EXPECTED_CANONICAL_COUNT,
  EXPECTED_CHRONOLOGY_COUNT,
  MINIMUM_GZIP_REDUCTION,
  PUBLIC_EVENT_KEYS,
  REPORT_PATH,
  RESEARCH_PATH,
  SURFACE_MANIFEST_PATH,
  WATCHLIST_PATH,
  assertReleaseInventory,
  buildBrowserPayload,
  buildReport,
  hasBrowserValue: hasPublicValue,
  serializeBrowserPayload,
  serializeResearchPayload,
  serializeSurfaceManifest,
  serializeWatchlistPayload,
  writeIfChanged
};
