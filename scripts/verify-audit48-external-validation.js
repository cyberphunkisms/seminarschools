#!/usr/bin/env node
'use strict';

/** Verify the active Audit 48 programs and schemas under the current Audit 49 release. */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const REPORT = path.join(ROOT, 'scripts', 'reports', 'audit48-external-validation.json');
const EXPECTED_RELEASE =
  '2026-07-26-site-audit49-technical-efficiency-resilience-final';
const EXPECTED_ASSET = '20260726-audit49';
const EXPECTED_PACKAGE = '1.0.6';
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

const manifest = json('RELEASE_MANIFEST.json');
const pkg = json('package.json');
const assistive = json('scripts/reports/audit48-assistive-technology.json');
const calendar = json('scripts/reports/audit48-calendar-client-interoperability.json');
const browser = json('data/audit48-browser/cross-engine-preflight.json');
const live = json('scripts/reports/audit48-live-harvest-endpoints.json');

check(read('RELEASE_ID.txt').trim() === EXPECTED_RELEASE, 'RELEASE_ID.txt is not Audit 49');
check(manifest.release_id === EXPECTED_RELEASE, 'release manifest is not Audit 49');
check(manifest.polymythcal_asset_version === EXPECTED_ASSET, 'Audit 49 asset token is missing');
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
  assistive.metrics?.interactive_documents === 2506
    && assistive.metrics?.redirect_documents === 890
    && assistive.metrics?.source_html_documents === 3396,
  'assistive-technology source inventory changed',
);
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
check(calendar.release_id === EXPECTED_RELEASE, 'calendar evidence is not bound to the current release');
check(
  calendar.metrics?.tests_passed === 9
    && calendar.metrics?.tests_run === 9
    && calendar.metrics?.total_ics_files === 857
    && calendar.metrics?.independently_parsed_vevent_components === 4172
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
check(browser.release_id === EXPECTED_RELEASE, 'cross-engine preflight is not bound to the current release');
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
    interactive_source_pages: assistive.metrics?.interactive_documents || 0,
    redirect_source_pages: assistive.metrics?.redirect_documents || 0,
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
