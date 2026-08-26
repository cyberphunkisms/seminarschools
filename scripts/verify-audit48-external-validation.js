#!/usr/bin/env node
'use strict';

/** Verify the active Audit 48 programs and preserved evidence under the current release. */
const fs = require('fs');
const path = require('path');
const {
  classifySourceHtml,
  difference,
  expectedPolymythcalEventRoutes,
  inspectEventRouteDirectory,
  summarizeValues,
} = require('./lib/source-html-inventory');

const ROOT = path.resolve(__dirname, '..');
const REPORT = path.join(ROOT, 'scripts', 'reports', 'audit48-external-validation.json');
const EXPECTED_RELEASE =
  '2026-08-15-polymythcal-sets1-15-sitewide-fixes-synthesized-final';
const EXPECTED_ASSET = '20260815-sets1-15-synthesis';
const PRESERVED_EVIDENCE_RELEASE =
  '2026-07-26-site-audit49-technical-efficiency-resilience-final';
const EXPECTED_PACKAGE = '1.0.6';
const EXPECTED_DISCOVERY_COUNTS = Object.freeze({canonical: 2088, chronology: 1954, watchlist: 134});
const WATCHLIST_REASON = Object.freeze({
  code: 'monitoring-marker',
  detail: 'Displayed date is a monitoring marker, not a confirmed event or deadline date.',
});
const failures = [];

function file(relative) {
  return path.join(ROOT, relative);
}
function exists(relative) {
  return fs.existsSync(file(relative));
}
function read(relative) {
  try {
    return fs.readFileSync(file(relative), 'utf8');
  } catch {
    failures.push(`${relative} is missing`);
    return '';
  }
}
function json(relative) {
  try {
    return JSON.parse(read(relative));
  } catch (error) {
    failures.push(`${relative} is invalid JSON: ${error.message}`);
    return {};
  }
}
function check(condition, message) {
  if (!condition) failures.push(message);
}
function sameArray(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
function exactWatchlistReason(value) {
  return value
    && Object.keys(value).length === 2
    && value.code === WATCHLIST_REASON.code
    && value.detail === WATCHLIST_REASON.detail;
}

const manifest = json('RELEASE_MANIFEST.json');
const pkg = json('package.json');
const assistive = json('scripts/reports/audit48-assistive-technology.json');
const calendar = json('scripts/reports/audit48-calendar-client-interoperability.json');
const browser = json('data/audit48-browser/cross-engine-preflight.json');
const live = json('scripts/reports/audit48-live-harvest-endpoints.json');
const canonicalPayload = json('data/polymyth-seminar-events.json');
const privateMirrorPayload = json('polymythseminars/events.json');
const browsePayload = json('polymythseminars/browse.json');
const watchlistPayload = json('polymythseminars/watchlist.json');
const publicationSurfaces = json('data/polymythcal-publication-surfaces.json');
const canonicalEvents = canonicalPayload.events || [];
const browseEvents = browsePayload.events || [];
const watchlistItems = watchlistPayload.items || [];
const canonicalIds = canonicalEvents.map(event => String(event.id));
const chronologyIds = browseEvents.map(event => String(event.id));
const monitoringIds = watchlistItems.map(event => String(event.id));
const canonicalSet = new Set(canonicalIds);
const chronologySet = new Set(chronologyIds);
const monitoringSet = new Set(monitoringIds);
const publicPartition = new Set([...chronologyIds, ...monitoringIds]);
const currentEvents = canonicalEvents.filter(event => chronologySet.has(String(event.id)));
const monitoringEvents = canonicalEvents.filter(event => monitoringSet.has(String(event.id)));
const currentFeeds = json('polymythseminars/feeds/index.json').feeds || [];
const explicitAliases = currentEvents.reduce(
  (count, event) => count + (event.legacy_ids || []).length,
  0,
);
const expectedSingleEventFiles = currentEvents.length + explicitAliases;
const expectedTotalIcsFiles = expectedSingleEventFiles + 12;
const expectedParsedComponents = expectedSingleEventFiles
  + currentFeeds.reduce((sum, feed) => sum + Number(feed.count || 0), 0)
  + Number(currentFeeds.find(feed => feed.id === 'opportunities')?.count || 0);
let sourceInventory = {documents: [], interactive: [], redirects: []};
let expectedEventRoutes = null;
let englishEventRoutes = null;
let frenchEventRoutes = null;
let expectedMonitoringRoutes = null;
try {
  sourceInventory = classifySourceHtml(ROOT);
  expectedEventRoutes = expectedPolymythcalEventRoutes(currentEvents);
  expectedMonitoringRoutes = expectedPolymythcalEventRoutes(monitoringEvents);
  englishEventRoutes = inspectEventRouteDirectory(ROOT, 'polymythseminars/events');
  frenchEventRoutes = inspectEventRouteDirectory(ROOT, 'polymythseminars/fr/events');
} catch (error) {
  failures.push(`current source inventory cannot be derived: ${error.message}`);
}

check(
  canonicalEvents.length === EXPECTED_DISCOVERY_COUNTS.canonical
    && currentEvents.length === EXPECTED_DISCOVERY_COUNTS.chronology
    && monitoringEvents.length === EXPECTED_DISCOVERY_COUNTS.watchlist,
  `Discovery v2 split differs: ${canonicalEvents.length} canonical, ${currentEvents.length} chronology, ${monitoringEvents.length} monitoring`,
);
check(
  canonicalSet.size === canonicalIds.length
    && chronologySet.size === chronologyIds.length
    && monitoringSet.size === monitoringIds.length
    && !chronologyIds.some(id => monitoringSet.has(id))
    && publicPartition.size === canonicalSet.size
    && [...publicPartition].every(id => canonicalSet.has(id)),
  'chronology and monitoring records are not a unique, disjoint exact canonical partition',
);
check(
  publicationSurfaces.schema === 'polymythcal-publication-surfaces-v2'
    && publicationSurfaces._schema === 'polymythcal-publication-surfaces-v2'
    && browsePayload._schema === 'polymythcal-discovery-v2'
    && watchlistPayload._schema === 'polymythcal-watchlist-v2'
    && publicationSurfaces.canonical_count === canonicalEvents.length
    && publicationSurfaces.chronology_count === currentEvents.length
    && publicationSurfaces.watchlist_count === monitoringEvents.length
    && browsePayload.count === currentEvents.length
    && browsePayload._canonical_count === canonicalEvents.length
    && watchlistPayload.count === monitoringEvents.length
    && watchlistPayload._canonical_count === canonicalEvents.length
    && sameArray(publicationSurfaces.chronology_ids || [], chronologyIds)
    && sameArray(publicationSurfaces.watchlist_ids || [], monitoringIds)
    && sameArray(Object.keys(publicationSurfaces.reasons || {}), monitoringIds)
    && monitoringIds.every(id => exactWatchlistReason(publicationSurfaces.reasons?.[id])),
  'Discovery v2 publication IDs, schemas, or monitoring reasons differ from the exact contract',
);
check(
  watchlistItems.every(item => !('date' in item)
    && !('end_date' in item)
    && item.date_status === 'awaiting-confirmed-date'),
  'monitoring records expose dates or lack awaiting-confirmed-date status',
);
check(
  JSON.stringify(privateMirrorPayload) === JSON.stringify(canonicalPayload)
    && !exists('public/polymythseminars/events.json'),
  'the full canonical corpus is not confined to private build inputs',
);

check(read('RELEASE_ID.txt').trim() === EXPECTED_RELEASE, 'RELEASE_ID.txt is not the current release');
check(manifest.release_id === EXPECTED_RELEASE, 'release manifest is not the current release');
check(manifest.polymythcal_asset_version === EXPECTED_ASSET, 'current asset token is missing');
check(pkg.version === EXPECTED_PACKAGE, `package version is ${pkg.version}`);
check(exists('scripts/apply-audit48-approved-ui.js'), 'current safe UI applicator is missing');
check(
  (manifest.notes || []).includes('No security audit was performed.'),
  'no-security-audit boundary is missing',
);

check(
  assistive.schema === 'seminar-schools-audit48-assistive-technology-v1'
    && assistive.status === 'passed',
  'assistive-technology prerequisite evidence did not pass',
);
check(
  assistive.release_id === EXPECTED_RELEASE,
  'assistive-technology evidence is not bound to the current release',
);
check(
  assistive.metrics?.interactive_documents === sourceInventory.interactive.length
    && assistive.metrics?.redirect_documents === sourceInventory.redirects.length
    && assistive.metrics?.source_html_documents === sourceInventory.documents.length
    && assistive.metrics?.source_html_documents
      === assistive.metrics?.interactive_documents + assistive.metrics?.redirect_documents,
  'assistive-technology source inventory is not an exact current-source partition',
);
if (expectedEventRoutes && expectedMonitoringRoutes && englishEventRoutes && frenchEventRoutes) {
  const missingEnglish = difference(
    expectedEventRoutes.englishRouteIds,
    englishEventRoutes.routeIds,
  );
  const extraEnglish = difference(
    englishEventRoutes.routeIds,
    expectedEventRoutes.englishRouteIds,
  );
  const missingFrench = difference(
    expectedEventRoutes.frenchRouteIds,
    frenchEventRoutes.routeIds,
  );
  const extraFrench = difference(
    frenchEventRoutes.routeIds,
    expectedEventRoutes.frenchRouteIds,
  );
  check(
    missingEnglish.length === 0 && extraEnglish.length === 0,
    `current English event route inventory differs from the event ledger; missing `
      + `${summarizeValues(missingEnglish)}; extra ${summarizeValues(extraEnglish)}`,
  );
  const leakedEnglishMonitoringRoutes = [...expectedMonitoringRoutes.englishRouteIds]
    .filter(id => englishEventRoutes.routeIds.has(id));
  const leakedFrenchMonitoringRoutes = [...expectedMonitoringRoutes.frenchRouteIds]
    .filter(id => frenchEventRoutes.routeIds.has(id));
  check(
    leakedEnglishMonitoringRoutes.length === 0
      && leakedFrenchMonitoringRoutes.length === 0,
    `monitoring records have published detail or alias routes; English `
      + `${summarizeValues(leakedEnglishMonitoringRoutes)}; French `
      + `${summarizeValues(leakedFrenchMonitoringRoutes)}`,
  );
  check(
    missingFrench.length === 0 && extraFrench.length === 0,
    `current French event route inventory differs from the event ledger; missing `
      + `${summarizeValues(missingFrench)}; extra ${summarizeValues(extraFrench)}`,
  );
  check(
    englishEventRoutes.missingIndexIds.length === 0
      && frenchEventRoutes.missingIndexIds.length === 0,
    'one or more event route directories lack index.html',
  );
  check(
    assistive.metrics?.canonical_events === canonicalEvents.length
      && assistive.metrics?.chronology_events === expectedEventRoutes.canonicalIds.size
      && assistive.metrics?.quarantined_monitoring_records === monitoringEvents.length
      && assistive.metrics?.explicit_legacy_event_ids
        === expectedEventRoutes.explicitLegacyEntries
      && assistive.metrics?.expected_english_event_routes
        === expectedEventRoutes.englishRouteIds.size
      && assistive.metrics?.expected_french_event_routes
        === expectedEventRoutes.frenchRouteIds.size
      && assistive.metrics?.expected_english_event_aliases
        === expectedEventRoutes.englishAliases.size
      && assistive.metrics?.expected_french_event_aliases
        === expectedEventRoutes.frenchAliases.size
      && assistive.metrics?.english_event_routes === englishEventRoutes.htmlRouteIds.size
      && assistive.metrics?.french_event_routes === frenchEventRoutes.htmlRouteIds.size
      && assistive.metrics?.canonical_event_documents
        === expectedEventRoutes.canonicalIds.size * 2
      && assistive.metrics?.event_redirect_documents
        === expectedEventRoutes.englishAliases.size + expectedEventRoutes.frenchAliases.size
      && assistive.metrics?.non_event_documents
        === sourceInventory.documents.length
          - englishEventRoutes.htmlRouteIds.size - frenchEventRoutes.htmlRouteIds.size,
    'assistive-technology event route accounting is not derived from the current ledger',
  );
}
check(
  assistive.native_execution_status
    === 'requires-native-operating-systems-physical-devices-and-human-observation',
  'native assistive-technology work was overclaimed',
);
check(
  exists('AUDIT48_NATIVE_DEVICE_AT_TEST_PROTOCOL_2026-07-26.md'),
  'native device protocol is missing',
);

check(
  calendar.schema === 'seminar-schools-audit48-calendar-client-interoperability-v1'
    && calendar.status === 'pass',
  'calendar-client interoperability evidence did not pass',
);
check(
  calendar.release_id === EXPECTED_RELEASE
    && calendar.generated_at === manifest.generated_at,
  'calendar evidence is not bound to the current rerun',
);
check(
  calendar.metrics?.tests_passed === 10
    && calendar.metrics?.tests_run === 10
    && calendar.metrics?.canonical_events === canonicalEvents.length
    && calendar.metrics?.chronology_events === currentEvents.length
    && calendar.metrics?.quarantined_monitoring_records === monitoringEvents.length
    && calendar.metrics?.browse_records === currentEvents.length
    && calendar.metrics?.watchlist_records === monitoringEvents.length
    && calendar.metrics?.monitoring_ics_leaks === 0
    && calendar.metrics?.monitoring_detail_or_alias_route_leaks === 0
    && calendar.metrics?.monitoring_feed_uid_leaks === 0
    && calendar.metrics?.explicit_legacy_ics_aliases === explicitAliases
    && calendar.metrics?.single_event_ics_files === expectedSingleEventFiles
    && calendar.metrics?.total_ics_files === expectedTotalIcsFiles
    && calendar.metrics?.independently_parsed_vevent_components === expectedParsedComponents
    && calendar.metrics?.maximum_physical_line_octets === 75,
  'calendar-client evidence metrics changed',
);
check(
  Array.isArray(calendar.actual_account_imports_remaining)
    && calendar.actual_account_imports_remaining.length >= 4,
  'calendar evidence does not preserve the vendor-account boundary',
);
check(
  exists('AUDIT48_CALENDAR_VENDOR_IMPORT_PROTOCOL_2026-07-26.md'),
  'calendar vendor-import protocol is missing',
);

check(
  browser.schema === 'seminar-schools-audit48-cross-engine-preflight-v1',
  'cross-engine preflight schema changed',
);
check(browser.release_id === PRESERVED_EVIDENCE_RELEASE, 'preserved cross-engine preflight has unexpected lineage');
check(
  browser.scenario_count === 12 && browser.intended_engine_scenario_count === 24,
  'cross-engine program coverage changed',
);
check(
  browser.claims?.runtime_checks_executed === 0
    && browser.claims?.runtime_pass_claimed === false
    && ['blocked', 'pending'].includes(browser.execution_status),
  'blocked cross-engine runtime was overclaimed',
);
check(
  Array.isArray(browser.references)
    && browser.references.includes('https://playwright.dev/docs/browsers'),
  'cross-engine evidence lacks its official engine reference',
);
if (exists('data/audit48-browser/cross-engine-browser-audit.json')) {
  const runtime = json('data/audit48-browser/cross-engine-browser-audit.json');
  check(
    runtime.status === 'passed'
      && runtime.checks_failed === 0
      && runtime.engine_results?.length === 2
      && runtime.engine_results.every(result => result.status === 'passed'),
    'present cross-engine runtime evidence is not a complete pass',
  );
} else {
  check(
    (
      browser.execution_status === 'blocked'
      && Boolean(String(browser.execution_blocker || '').trim())
    ) || (
      browser.execution_status === 'pending'
      && Array.isArray(browser.engines)
      && browser.engines.length === 2
      && browser.engines.every(engine => !engine.installed || !engine.executable)
    ),
    'absent cross-engine runtime evidence lacks a blocked or unavailable-engine explanation',
  );
}

check(
  live.schema === 'audit48-polymythcal-live-endpoints-v1'
    && live.summary?.status === 'complete',
  'live endpoint evidence is incomplete',
);
check(
  live.publication_attempted === false
    && live.external_mutation_attempted === false
    && live.paid_agent_invoked === false
    && live.cadence_changed === false,
  'live endpoint evidence crossed a read-only or cadence boundary',
);
check(
  Number(live.summary?.source_bindings_checked) >= 190
    && Number(live.summary?.endpoint_bindings_checked) >= 200
    && Number(live.summary?.unique_live_requests) >= 190,
  'live endpoint coverage is unexpectedly small',
);
for (const stream of ['seminars', 'protests']) {
  check(
    live.scheduled_dry_runs?.[stream]?.source_health_gate?.status === 'passed',
    `${stream} scheduled dry-run source-health gate did not pass`,
  );
}

for (const [relative, cron] of [
  ['.github/workflows/scrape-seminars.yml', '47 8 * * 1'],
  ['.github/workflows/scrape-festivals.yml', '42 9 * * 2'],
  ['.github/workflows/scrape-polymythcal-protests.yml', '18 8 * * 3'],
  ['.github/workflows/audit-external-links.yml', '17 10 * * 0'],
]) {
  const schedules = [...read(relative).matchAll(/\bcron:\s*["']([^"']+)["']/g)]
    .map(match => match[1]);
  check(
    schedules.length === 1 && schedules[0] === cron,
    `${relative} does not remain exactly once weekly`,
  );
}

for (const [name, command] of Object.entries({
  'apply:audit48-approved-ui': 'node scripts/apply-audit48-approved-ui.js',
  'verify:audit48-assistive-technology': 'node scripts/verify-audit48-assistive-technology.js',
  'verify:audit48-browser-program': 'node scripts/verify-audit48-browser-program.js',
  'audit:audit48-cross-engine-browser': 'node scripts/audit48-cross-engine-browser.js --execute',
  'verify:audit48-calendar-clients': 'node scripts/run-python.js scripts/verify-polymythcal-calendar-clients.py',
  'test:audit48-live-harvest': 'node scripts/run-python.js -m unittest scripts/test_audit48_live_harvest.py',
  'verify:audit48-live-harvest': 'node scripts/run-python.js scripts/verify_audit48_live_harvest.py',
  'verify:audit48-live-harvest:current': 'node scripts/run-python.js scripts/verify_audit48_live_harvest.py --require-current',
  'verify:audit48-external-validation': 'node scripts/verify-audit48-external-validation.js',
})) {
  check(pkg.scripts?.[name] === command, `package command ${name} changed`);
}

const report = {
  schema: 'seminar-schools-audit48-external-validation-v1',
  release_id: manifest.release_id || null,
  generated_at: manifest.generated_at || null,
  status: failures.length ? 'failed' : 'passed',
  machine_validation_status: failures.length ? 'failed' : 'passed',
  metrics: {
    source_html_pages: assistive.metrics?.source_html_documents || 0,
    interactive_source_pages: assistive.metrics?.interactive_documents || 0,
    redirect_source_pages: assistive.metrics?.redirect_documents || 0,
    canonical_events: assistive.metrics?.canonical_events || 0,
    chronology_events: assistive.metrics?.chronology_events || 0,
    quarantined_monitoring_records:
      assistive.metrics?.quarantined_monitoring_records || 0,
    english_event_routes: assistive.metrics?.english_event_routes || 0,
    french_event_routes: assistive.metrics?.french_event_routes || 0,
    calendar_tests: calendar.metrics?.tests_passed || 0,
    calendar_files: calendar.metrics?.total_ics_files || 0,
    parsed_calendar_events: calendar.metrics?.independently_parsed_vevent_components || 0,
    intended_cross_engine_scenarios: browser.intended_engine_scenario_count || 0,
    cross_engine_runtime_checks: browser.claims?.runtime_checks_executed || 0,
    live_source_bindings: live.summary?.source_bindings_checked || 0,
    live_endpoint_bindings: live.summary?.endpoint_bindings_checked || 0,
    unique_live_requests: live.summary?.unique_live_requests || 0,
  },
  completed: [
    'strict-rfc5545-calendar-corpus-and-independent-parser-roundtrip',
    'calendar-http-and-link-media-contract',
    'repository-wide-assistive-technology-dom-prerequisites',
    'portable-firefox-webkit-program-and-honest-blocked-preflight',
    'bounded-read-only-current-endpoint-probe',
    'seminar-and-protest-scheduled-selection-dry-runs',
    'exact-once-weekly-cadence-continuity',
  ],
  external_execution_required: [
    'branded Firefox validation',
    'native macOS Safari and VoiceOver validation',
    'Windows NVDA with Firefox and Chrome',
    'physical iPhone and Android validation',
    'real-user task completion and comprehension session',
    'Google Calendar, Apple Calendar, and Outlook account imports',
    'post-deploy calendar subscription refresh',
  ],
  references: [
    'https://playwright.dev/docs/browsers',
    'https://support.apple.com/guide/voiceover/welcome-voic010/mac',
    'https://download.nvaccess.org/documentation/en/userGuide.html',
    'https://www.rfc-editor.org/rfc/rfc5545',
    'https://support.google.com/calendar/answer/37118?hl=en',
    'https://support.apple.com/guide/calendar/import-or-export-calendars-icl1023/mac',
    'https://support.microsoft.com/en-us/office/import-or-subscribe-to-a-calendar-in-outlook-com-or-outlook-on-the-web-cff1429c-5af6-41ec-a5b4-74f2c278e98c',
  ],
  failures,
  policy: 'Audit 48 preserves English source truth, verbatim organizer text, noindex high-stakes Leizu translations pending bilingual review, BB teacher-led delivery without a session runner, frozen historical evidence, exactly-once-weekly workflows, and the no-security-audit boundary.',
};
fs.mkdirSync(path.dirname(REPORT), {recursive: true});
const rendered = JSON.stringify(report, null, 2) + '\n';
if (!fs.existsSync(REPORT) || fs.readFileSync(REPORT, 'utf8') !== rendered) {
  fs.writeFileSync(REPORT, rendered, 'utf8');
}
if (process.env.SS_REPORT_OUTPUT_MTIME) {
  const stamp = new Date(process.env.SS_REPORT_OUTPUT_MTIME);
  if (Number.isNaN(stamp.getTime())) {
    throw new Error('SS_REPORT_OUTPUT_MTIME must be a valid timestamp');
  }
  fs.utimesSync(REPORT, stamp, stamp);
}

if (failures.length) {
  console.error(`AUDIT48 EXTERNAL VALIDATION FAILED (${failures.length})`);
  failures.forEach(message => console.error(` - ${message}`));
  process.exit(1);
}
console.log(
  `AUDIT48 EXTERNAL VALIDATION PASSED — ${report.metrics.calendar_files} calendar files, `
  + `${report.metrics.interactive_source_pages} interactive pages, `
  + `${report.metrics.live_source_bindings} live source bindings, and `
  + `${report.metrics.intended_cross_engine_scenarios} prepared engine scenarios; `
  + 'native and vendor-account rows remain explicitly external.',
);

