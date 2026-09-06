#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { evaluateLiveContent } = require('../live-content-integrity');
const { isMonitoringMarker } = require('../lib/polymythcal-discovery-model');
const { expectedPolymythcalEventRoutes } = require('../lib/source-html-inventory');

const ROOT = path.resolve(__dirname, '../..');
const CURRENT_THRESHOLDS = Object.freeze({ teacherResources: 645 });
const EXPECTED_COUNTS = Object.freeze({ canonical: 2088, chronology: 1954, watchlist: 134 });
const WATCHLIST_REASON = Object.freeze({
  code: 'monitoring-marker',
  detail: 'Displayed date is a monitoring marker, not a confirmed event or deadline date.',
});

function readJson(relative) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));
}

function ids(records) {
  return records.map(record => String(record?.id || '').trim());
}

function sameArray(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sameReason(value) {
  return value
    && Object.keys(value).length === 2
    && value.code === WATCHLIST_REASON.code
    && value.detail === WATCHLIST_REASON.detail;
}

function evaluateCurrentIntegrity({
  canonicalDocument,
  privateMirrorDocument,
  browseDocument,
  watchlistDocument,
  surfaceDocument,
  sourceDocument,
  teacherDocument,
  root,
}) {
  const canonical = Array.isArray(canonicalDocument?.events) ? canonicalDocument.events : [];
  const browse = Array.isArray(browseDocument?.events) ? browseDocument.events : [];
  const watchlist = Array.isArray(watchlistDocument?.items) ? watchlistDocument.items : [];
  const canonicalIds = ids(canonical);
  const browseIds = ids(browse);
  const watchlistIds = ids(watchlist);
  const canonicalSet = new Set(canonicalIds);
  const browseSet = new Set(browseIds);
  const watchlistSet = new Set(watchlistIds);
  const failures = [];

  // Reuse the longstanding anti-collapse, taxonomy, source, and Teacher
  // Resource checks against the private canonical corpus. Discovery v2 has a
  // deliberate public split, so a compatibility projection is used only for
  // the old parity check; the real split is validated independently below.
  const legacy = evaluateLiveContent({
    eventsDocument: canonicalDocument,
    browseDocument: {
      count: canonical.length,
      _canonical_count: canonical.length,
      events: canonical,
    },
    sourceDocument,
    teacherDocument,
    thresholds: CURRENT_THRESHOLDS,
  });
  failures.push(...legacy.failures);

  if (canonical.length !== EXPECTED_COUNTS.canonical) {
    failures.push(`canonical release count is ${canonical.length}; expected ${EXPECTED_COUNTS.canonical}`);
  }
  if (browse.length !== EXPECTED_COUNTS.chronology) {
    failures.push(`chronology release count is ${browse.length}; expected ${EXPECTED_COUNTS.chronology}`);
  }
  if (watchlist.length !== EXPECTED_COUNTS.watchlist) {
    failures.push(`watchlist release count is ${watchlist.length}; expected ${EXPECTED_COUNTS.watchlist}`);
  }
  if (browseDocument?._schema !== 'polymythcal-discovery-v2') {
    failures.push('browse schema is not polymythcal-discovery-v2');
  }
  if (watchlistDocument?._schema !== 'polymythcal-watchlist-v2') {
    failures.push('watchlist schema is not polymythcal-watchlist-v2');
  }
  if (
    surfaceDocument?.schema !== 'polymythcal-publication-surfaces-v2'
    || surfaceDocument?._schema !== 'polymythcal-publication-surfaces-v2'
  ) {
    failures.push('publication surface schema is not polymythcal-publication-surfaces-v2');
  }
  for (const [label, actual, expected] of [
    ['canonical.count', canonicalDocument?.count, canonical.length],
    ['canonical._total_events', canonicalDocument?._total_events, canonical.length],
    ['browse.count', browseDocument?.count, browse.length],
    ['browse._chronology_count', browseDocument?._chronology_count, browse.length],
    ['browse._canonical_count', browseDocument?._canonical_count, canonical.length],
    ['watchlist.count', watchlistDocument?.count, watchlist.length],
    ['watchlist._canonical_count', watchlistDocument?._canonical_count, canonical.length],
    ['surfaces.canonical_count', surfaceDocument?.canonical_count, canonical.length],
    ['surfaces.chronology_count', surfaceDocument?.chronology_count, browse.length],
    ['surfaces.watchlist_count', surfaceDocument?.watchlist_count, watchlist.length],
  ]) {
    if (actual !== expected) failures.push(`${label} is ${actual}; expected ${expected}`);
  }

  if (canonicalIds.some(id => !id) || new Set(canonicalIds).size !== canonicalIds.length) {
    failures.push('canonical event IDs are missing or not unique');
  }
  if (browseIds.some(id => !id) || browseSet.size !== browseIds.length) {
    failures.push('chronology event IDs are missing or not unique');
  }
  if (watchlistIds.some(id => !id) || watchlistSet.size !== watchlistIds.length) {
    failures.push('watchlist event IDs are missing or not unique');
  }
  const overlap = browseIds.filter(id => watchlistSet.has(id));
  const union = new Set([...browseIds, ...watchlistIds]);
  const missing = canonicalIds.filter(id => !union.has(id));
  const unknown = [...union].filter(id => !canonicalSet.has(id));
  if (overlap.length) failures.push(`chronology/watchlist partition overlaps on ${overlap.length} ID(s)`);
  if (missing.length || unknown.length || union.size !== canonicalSet.size) {
    failures.push(`public partition differs from the private canonical corpus: ${missing.length} missing, ${unknown.length} unknown`);
  }

  const manifestChronology = Array.isArray(surfaceDocument?.chronology_ids)
    ? surfaceDocument.chronology_ids.map(String) : [];
  const manifestWatchlist = Array.isArray(surfaceDocument?.watchlist_ids)
    ? surfaceDocument.watchlist_ids.map(String) : [];
  if (!sameArray(manifestChronology, browseIds)) {
    failures.push('publication chronology_ids do not exactly match browse order');
  }
  if (!sameArray(manifestWatchlist, watchlistIds)) {
    failures.push('publication watchlist_ids do not exactly match watchlist order');
  }
  const reasonIds = Object.keys(surfaceDocument?.reasons || {});
  if (!sameArray(reasonIds, watchlistIds)) {
    failures.push('publication reasons are not keyed exactly by ordered watchlist IDs');
  }
  for (const id of watchlistIds) {
    if (!sameReason(surfaceDocument?.reasons?.[id])) {
      failures.push(`${id}: monitoring reason is not the exact Discovery v2 reason object`);
    }
  }

  const canonicalById = new Map(canonical.map(event => [String(event.id), event]));
  const markerIds = canonical.filter(isMonitoringMarker).map(event => String(event.id));
  if (!sameArray(markerIds, watchlistIds)) {
    failures.push('watchlist does not exactly quarantine the explicit canonical monitoring markers');
  }
  if (watchlist.some(item => 'date' in item || 'end_date' in item || item.date_status !== 'awaiting-confirmed-date')) {
    failures.push('watchlist exposes a monitoring date or lacks awaiting-confirmed-date status');
  }
  if (browse.some(item => !canonicalById.has(String(item.id)))) {
    failures.push('chronology includes a record outside the private canonical corpus');
  }

  if (
    privateMirrorDocument
    && JSON.stringify(privateMirrorDocument) !== JSON.stringify(canonicalDocument)
  ) {
    failures.push('private canonical event mirrors differ');
  }

  if (root) {
    const routeContract = expectedPolymythcalEventRoutes(canonical);
    const monitoringEvents = canonical.filter(event => watchlistSet.has(String(event.id)));
    const monitoringContract = expectedPolymythcalEventRoutes(monitoringEvents);
    for (const [localePath, routeIds] of [
      ['events', routeContract.englishRouteIds],
      ['fr/events', routeContract.frenchRouteIds],
    ]) {
      for (const id of routeIds) {
        const sourceRelative = `polymythseminars/${localePath}/${id}/index.html`;
        const publicRelative = `public/${sourceRelative}`;
        if (!fs.existsSync(path.join(root, sourceRelative))) {
          failures.push(`${sourceRelative}: stable event detail or alias route is missing`);
        }
        if (!fs.existsSync(path.join(root, publicRelative))) {
          failures.push(`${publicRelative}: stable event detail or alias route is missing`);
        }
      }
    }
    for (const event of monitoringEvents) {
      const id = String(event.id);
      for (const localePath of ['events', 'fr/events']) {
        const sourceRelative = `polymythseminars/${localePath}/${id}/index.html`;
        const publicRelative = `public/${sourceRelative}`;
        if (!fs.existsSync(path.join(root, sourceRelative))) continue;
        const html = fs.readFileSync(path.join(root, sourceRelative), 'utf8');
        if (!/<meta\b(?=[^>]*\bname=["']robots["'])(?=[^>]*\bcontent=["']noindex,follow["'])[^>]*>/i.test(html)) {
          failures.push(`${sourceRelative}: watchlist detail route is not noindex,follow`);
        }
        if (/<time\b[^>]*\bdatetime\s*=/i.test(html)) {
          failures.push(`${sourceRelative}: watchlist detail route exposes a date`);
        }
        if (/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?["']@type["']\s*:\s*["']Event["']/i.test(html)) {
          failures.push(`${sourceRelative}: watchlist detail route exposes Event JSON-LD`);
        }
        if (
          fs.existsSync(path.join(root, publicRelative))
          && !fs.readFileSync(path.join(root, sourceRelative)).equals(fs.readFileSync(path.join(root, publicRelative)))
        ) {
          failures.push(`${publicRelative}: published watchlist detail differs from source`);
        }
      }
    }
    for (const id of new Set([
      ...monitoringContract.canonicalIds,
      ...monitoringContract.frenchAliases.keys(),
    ])) {
      for (const relative of [
        `polymythseminars/ics/${id}.ics`,
        `public/polymythseminars/ics/${id}.ics`,
      ]) {
        if (fs.existsSync(path.join(root, relative))) {
          failures.push(`${relative}: watchlist record has an ICS chronology route`);
        }
      }
    }
    if (fs.existsSync(path.join(root, 'public/polymythseminars/events.json'))) {
      failures.push('public/polymythseminars/events.json exposes the private canonical corpus');
    }
  }

  return {
    failures,
    metrics: {
      ...legacy.metrics,
      canonical: canonical.length,
      chronology: browse.length,
      watchlist: watchlist.length,
    },
  };
}

function main() {
  const result = evaluateCurrentIntegrity({
    canonicalDocument: readJson('data/polymyth-seminar-events.json'),
    privateMirrorDocument: readJson('polymythseminars/events.json'),
    browseDocument: readJson('polymythseminars/browse.json'),
    watchlistDocument: readJson('polymythseminars/watchlist.json'),
    surfaceDocument: readJson('data/polymythcal-publication-surfaces.json'),
    sourceDocument: readJson('scripts/sources.json'),
    teacherDocument: readJson('teacherresources/resources-data.json'),
    root: ROOT,
  });

  if (result.failures.length) {
    console.error('LIVE CONTENT INTEGRITY FAILED');
    result.failures.forEach(failure => console.error(` - ${failure}`));
    process.exit(1);
  }

  const metrics = result.metrics;
  console.log(
    'LIVE CONTENT INTEGRITY PASSED — '
      + `${metrics.canonical} private canonical records split into ${metrics.chronology} chronology + `
      + `${metrics.watchlist} quarantined monitoring records; ${metrics.eventTypes} types, `
      + `${metrics.registeredSources} registered sources, `
      + `${metrics.everyRunDeterministicSources} every-run + `
      + `${metrics.rotatingDeterministicSources} rotating deterministic sources, `
      + `${metrics.teacherResources}/${metrics.teacherCollections}/${metrics.teacherGroups} `
      + 'Teacher Resources. Exact partition, uniqueness, complete stable details, watchlist calendar quarantine, and '
      + 'anti-collapse floors remain enforced.',
  );
}

if (require.main === module) main();

module.exports = {
  EXPECTED_COUNTS,
  WATCHLIST_REASON,
  evaluateCurrentIntegrity,
};
