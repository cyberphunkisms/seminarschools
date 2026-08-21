#!/usr/bin/env node
'use strict';

/**
 * Audit 49 aggregate technical-efficiency and resilience gate.
 *
 * This verifier deliberately consumes the three Audit 49 component reports
 * instead of reproducing their repository walks. It then binds that evidence
 * to the current release, inherited Audit 48 external-validation boundary,
 * translation governance, weekly cadence, frozen-history, and shipping
 * wiring. The result is a single release decision without adding another
 * expensive scan to the canonical build.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const REPORT = path.join(
  ROOT,
  'scripts',
  'reports',
  'audit49-technical-efficiency.json',
);
const MARKDOWN = path.join(
  ROOT,
  'WEBSITE_AUDIT49_TECHNICAL_EFFICIENCY_RESILIENCE_REPORT_2026-07-26.md',
);
const EXPECTED_RELEASE =
  '2026-08-15-polymythcal-sets1-15-sitewide-fixes-synthesized-final';
const EXPECTED_ASSET = '20260815-sets1-15-synthesis';
const EXPECTED_PACKAGE = '1.0.6';

const COMPONENTS = {
  metadata: {
    path: 'scripts/reports/audit49-metadata-surface.json',
    schema: 'seminar-schools-audit49-metadata-surface-v1',
  },
  runtime: {
    path: 'scripts/reports/audit49-runtime-efficiency.json',
    schema: 'seminar-schools-audit49-runtime-efficiency-v1',
  },
  build_packaging: {
    path: 'scripts/reports/audit49-build-packaging-efficiency.json',
    schema: 'seminar-schools-audit49-build-packaging-efficiency-v1',
  },
  audit48_external_validation: {
    path: 'scripts/reports/audit48-external-validation.json',
    schema: 'seminar-schools-audit48-external-validation-v1',
  },
};

const EXPECTED_EXTERNAL_ROWS = [
  'branded Firefox validation',
  'native macOS Safari and VoiceOver validation',
  'Windows NVDA with Firefox and Chrome',
  'physical iPhone and Android validation',
  'real-user task completion and comprehension session',
  'Google Calendar, Apple Calendar, and Outlook account imports',
  'post-deploy calendar subscription refresh',
];
const AUDIT49_ADDITIONAL_EXTERNAL_ROWS = [
  'reachable protest-source browser/OCR validation',
  'authorized festival paid-agent execution',
];

const EXPECTED_WEEKLY_WORKFLOWS = {
  '.github/workflows/audit-external-links.yml': '17 10 * * 0',
  '.github/workflows/browser-assurance.yml': '23 7 * * 0',
  '.github/workflows/dependency-health.yml': '37 13 * * 1',
  '.github/workflows/scrape-festivals.yml': '42 9 * * 2',
  '.github/workflows/scrape-polymythcal-protests.yml': '18 8 * * 3',
  '.github/workflows/scrape-seminars.yml': '47 8 * * 1',
};

const REFERENCES = [
  {
    topic: 'robots meta directives',
    url: 'https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag',
  },
  {
    topic: 'canonical URL signals',
    url: 'https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls',
  },
  {
    topic: 'localized versions and hreflang',
    url: 'https://developers.google.com/search/docs/specialty/international/localized-versions',
  },
  {
    topic: 'sitemap construction',
    url: 'https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap',
  },
  {
    topic: 'structured-data fundamentals',
    url: 'https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data',
  },
  {
    topic: 'HTTP caching semantics',
    url: 'https://www.rfc-editor.org/rfc/rfc9111',
  },
  {
    topic: 'page visibility lifecycle',
    url: 'https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API',
  },
  {
    topic: 'animation-frame scheduling',
    url: 'https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame',
  },
  {
    topic: 'bounded child-process execution',
    url: 'https://nodejs.org/api/child_process.html',
  },
  {
    topic: 'ZIP archive implementation reference',
    url: 'https://docs.python.org/3/library/zipfile.html',
  },
  {
    topic: 'iCalendar interoperability',
    url: 'https://www.rfc-editor.org/rfc/rfc5545',
  },
  {
    topic: 'Playwright browser coverage',
    url: 'https://playwright.dev/docs/browsers',
  },
  {
    topic: 'native VoiceOver reference',
    url: 'https://support.apple.com/guide/voiceover/welcome-voic010/mac',
  },
  {
    topic: 'native NVDA reference',
    url: 'https://download.nvaccess.org/documentation/en/userGuide.html',
  },
  {
    topic: 'Google Calendar import reference',
    url: 'https://support.google.com/calendar/answer/37118?hl=en',
  },
  {
    topic: 'Apple Calendar import reference',
    url: 'https://support.apple.com/guide/calendar/import-or-export-calendars-icl1023/mac',
  },
  {
    topic: 'Outlook import and subscription reference',
    url: 'https://support.microsoft.com/en-us/office/import-or-subscribe-to-a-calendar-in-outlook-com-or-outlook-on-the-web-cff1429c-5af6-41ec-a5b4-74f2c278e98c',
  },
];

const failures = [];

function absolute(relative) {
  return path.join(ROOT, relative);
}

function read(relative) {
  try {
    return fs.readFileSync(absolute(relative), 'utf8');
  } catch (error) {
    failures.push(`${relative} is unavailable: ${error.message}`);
    return '';
  }
}

function parseJson(relative) {
  const source = read(relative);
  if (!source) return {};
  try {
    return JSON.parse(source);
  } catch (error) {
    failures.push(`${relative} is invalid JSON: ${error.message}`);
    return {};
  }
}

function check(condition, message) {
  if (!condition) failures.push(message);
}

function count(source, token) {
  if (!token) return 0;
  let total = 0;
  let cursor = 0;
  while ((cursor = source.indexOf(token, cursor)) !== -1) {
    total += 1;
    cursor += token.length;
  }
  return total;
}

function section(source, startToken, endToken) {
  const start = source.indexOf(startToken);
  if (start < 0) return '';
  const end = source.indexOf(endToken, start + startToken.length);
  return end < 0 ? source.slice(start) : source.slice(start, end);
}

function equalArrays(left, right) {
  return Array.isArray(left)
    && left.length === right.length
    && left.every((value, index) => value === right[index]);
}

function isEmptyFailureList(value) {
  return value === undefined || (Array.isArray(value) && value.length === 0);
}

function assertBoolean(source, key, expected, label) {
  check(
    source && source[key] === expected,
    `${label}.${key} must be ${expected}`,
  );
}

function extractCrons(source) {
  return [...source.matchAll(/\bcron:\s*["']([^"']+)["']/g)]
    .map(match => match[1]);
}

function reportStatus(report) {
  return report && typeof report.status === 'string' ? report.status : 'missing';
}

const releaseId = read('RELEASE_ID.txt').trim();
const manifest = parseJson('RELEASE_MANIFEST.json');
const pkg = parseJson('package.json');
const publicRelease = parseJson('public/site-release.json');
const buildManifest = parseJson('data/polymythcal-build-manifest.json');
const metadata = parseJson(COMPONENTS.metadata.path);
const runtime = parseJson(COMPONENTS.runtime.path);
const buildPackaging = parseJson(COMPONENTS.build_packaging.path);
const external = parseJson(COMPONENTS.audit48_external_validation.path);
const liveHarvest = parseJson('scripts/reports/audit48-live-harvest-endpoints.json');
const governance = parseJson('data/audit45-translation-governance.json');
const translation = parseJson('scripts/reports/audit45-translation-static.json');

const runner = read('scripts/verify-all-runner.js');
const releaseGates = read('scripts/verify-release-gates.js');
const predeployVerifier = read('scripts/verify-predeploy-automation.js');
const predeployWorkflow = read('.github/workflows/predeploy.yml');
const deployer = read('scripts/package-deployer-compatible.py');
const sourcePackager = read('scripts/package-netlify-source.py');

check(releaseId === EXPECTED_RELEASE, `RELEASE_ID.txt is ${releaseId || 'empty'}`);
check(
  manifest.release_id === EXPECTED_RELEASE,
  `RELEASE_MANIFEST.json release is ${manifest.release_id || 'missing'}`,
);
check(
  manifest.polymythcal_asset_version === EXPECTED_ASSET,
  `release asset version is ${manifest.polymythcal_asset_version || 'missing'}`,
);
check(pkg.version === EXPECTED_PACKAGE, `package version is ${pkg.version || 'missing'}`);
check(
  Array.isArray(manifest.notes)
    && manifest.notes.includes('No security audit was performed.'),
  'release manifest does not preserve the explicit no-security-audit boundary',
);
check(
  publicRelease.release_id === EXPECTED_RELEASE,
  `public/site-release.json is not rebound to ${EXPECTED_RELEASE}`,
);
check(
  publicRelease.generated_at === manifest.generated_at,
  'public/site-release.json timestamp is not current',
);
check(
  buildManifest.release_id === EXPECTED_RELEASE
    && buildManifest.interface_release === EXPECTED_RELEASE
    && buildManifest.polymythcal_asset_version === EXPECTED_ASSET,
  'Polymythcal build manifest is not rebound to the current release and asset',
);
check(
  buildManifest.generated_at === manifest.generated_at,
  'Polymythcal build manifest timestamp is not current',
);

for (const [label, contract] of Object.entries(COMPONENTS)) {
  const component = label === 'metadata'
    ? metadata
    : label === 'runtime'
      ? runtime
      : label === 'build_packaging'
        ? buildPackaging
        : external;
  check(component.schema === contract.schema, `${label} schema is not ${contract.schema}`);
  check(component.status === 'passed', `${label} report status is ${reportStatus(component)}`);
  check(isEmptyFailureList(component.failures), `${label} report retains failures`);
}

for (const [label, component] of [
  ['metadata', metadata],
  ['runtime', runtime],
  ['build_packaging', buildPackaging],
]) {
  check(
    component.release_id === EXPECTED_RELEASE,
    `${label} report is bound to ${component.release_id || 'no release'}`,
  );
  check(
    component.generated_at === manifest.generated_at,
    `${label} report timestamp is not the current release timestamp`,
  );
}

check(
  external.release_id === EXPECTED_RELEASE,
  'active Audit 48 external evidence is not rebound to the Audit 49 release',
);
check(
  external.generated_at === manifest.generated_at,
  'active Audit 48 external evidence timestamp is not current',
);
check(
  external.machine_validation_status === 'passed',
  `Audit 48 machine-validation status is ${external.machine_validation_status || 'missing'}`,
);

const metadataMetrics = metadata.metrics || {};
check(
  metadataMetrics.source_html_documents > 0,
  'metadata inventory did not count active source documents',
);
check(
  metadataMetrics.source_html_documents === metadataMetrics.public_html_documents
    && metadataMetrics.source_html_documents
      === metadataMetrics.source_public_byte_identical,
  'metadata inventory is not fully byte-identical across source and public',
);
check(
  metadataMetrics.interactive_documents + metadataMetrics.redirect_documents
    === metadataMetrics.source_html_documents,
  'metadata document classification does not cover the full source inventory',
);
check(
  metadataMetrics.indexable_documents + metadataMetrics.noindex_documents
    === metadataMetrics.source_html_documents,
  'metadata indexing classification does not cover the full source inventory',
);
check(
  metadataMetrics.documents_with_one_title === metadataMetrics.source_html_documents
    && metadataMetrics.documents_with_one_viewport
      === metadataMetrics.source_html_documents,
  'title or viewport uniqueness is not repository-wide',
);
check(
  metadataMetrics.documents_with_one_canonical
    === metadataMetrics.source_html_documents - 1,
  'canonical coverage changed from the active 404 exemption contract',
);
check(
  metadataMetrics.indexable_documents_without_schema
    === metadataMetrics.intentional_schema_exemptions,
  'indexable schema gaps exceed the declared exemption inventory',
);
check(
  metadataMetrics.sitemap_urls
    === metadataMetrics.indexable_documents
      + metadataMetrics.sitemap_non_html_resources,
  'sitemap coverage no longer equals indexable HTML plus declared non-HTML resources',
);
check(
  metadataMetrics.schema_documents
    >= metadataMetrics.indexable_documents
      - metadataMetrics.intentional_schema_exemptions,
  'structured-data coverage fell below the indexable route contract',
);
check(
  metadataMetrics.hreflang_links > 0
    && metadataMetrics.hreflang_documents > 0,
  'localized alternates disappeared from the metadata inventory',
);
for (const group of [
  'duplicate_tags',
  'missing_metadata',
  'invalid_metadata',
  'schema',
  'duplicate_indexable_titles',
  'duplicate_indexable_descriptions',
  'duplicate_indexable_canonicals',
  'hreflang',
  'crawl',
  'source_public',
  'generator_ownership',
]) {
  check(metadata.issue_counts?.[group] === 0, `metadata issue group ${group} is not zero`);
  check(
    Array.isArray(metadata.issues?.[group]) && metadata.issues[group].length === 0,
    `metadata issue details for ${group} are not empty`,
  );
}
check(
  metadata.page_size_distribution?.largest_bytes <= 4 * 1024 * 1024,
  'raw active-HTML ceiling exceeds 4 MiB',
);
check(
  metadata.page_size_distribution?.largest_gzip_bytes <= 1280 * 1024,
  'gzip active-HTML ceiling exceeds 1,280 KiB',
);
for (const [key, expected] of [
  ['english_source_of_truth', true],
  ['localized_noindex_governance_preserved', true],
  ['organizer_authored_text_verbatim', true],
  ['weekly_cadence_unchanged', true],
  ['security_audit_performed', false],
  ['native_browser_execution_claimed', false],
  ['deployment_performed', false],
]) {
  assertBoolean(metadata.invariants, key, expected, 'metadata.invariants');
}

const runtimeMetrics = runtime.metrics || {};
const expectedIntervalFiles = [];
for (const locale of ['', 'fr/', 'zh-hant/', 'zh-hans/', 'fa/']) {
  expectedIntervalFiles.push(`leizu/${locale}index.html`);
  expectedIntervalFiles.push(`leizu/${locale}teach/index.html`);
}
check(
  runtimeMetrics.files_with_intervals === expectedIntervalFiles.length
    && runtimeMetrics.interval_calls === expectedIntervalFiles.length
    && runtimeMetrics.bounded_leaf_routes === expectedIntervalFiles.length
    && runtimeMetrics.public_runtime_mirrors_identical === expectedIntervalFiles.length,
  'the ten intentional Leizu interval routes are not fully bounded and mirrored',
);
check(
  runtimeMetrics.startup_timer_slots_bounded === 45,
  'Leizu startup timer-slot inventory changed from 45',
);
check(
  Object.keys(runtime.interval_files || {}).sort().join('\n')
    === expectedIntervalFiles.sort().join('\n'),
  'active interval file inventory contains an unbudgeted or missing route',
);
check(
  Object.values(runtime.interval_files || {}).every(value => value === 1),
  'an active interval route owns more than one repeating interval',
);
check(
  runtimeMetrics.forced_public_data_revalidation_fetches === 0,
  'a large public-data fetch still forces browser revalidation',
);
check(
  runtimeMetrics.bounded_public_data_assets >= 24
    && runtimeMetrics.bounded_public_data_bytes >= 9_500_000,
  'bounded cache coverage fell below 24 assets or 9.5 MB',
);
for (const [key, value] of Object.entries({
  polymyth_text_mirrors: 'public, max-age=86400, stale-while-revalidate=604800',
  florilegium_posts: 'public, max-age=3600, must-revalidate',
  polymythcal_candidates: 'public, max-age=300, must-revalidate',
  saul_public_data: 'public, max-age=86400, stale-while-revalidate=604800',
})) {
  check(runtime.cache_policies?.[key] === value, `${key} cache policy changed`);
}
for (const [key, expected] of [
  ['english_source_of_truth', true],
  ['organizer_authored_text_verbatim', true],
  ['high_stakes_leizu_noindex_preserved', true],
  ['bb_teacher_led', true],
  ['cadence_changed', false],
  ['security_audit_performed', false],
  ['deployment_performed', false],
]) {
  assertBoolean(runtime.invariants, key, expected, 'runtime.invariants');
}

const packagingMetrics = buildPackaging.metrics || {};
check(
  packagingMetrics.command_timeout_ms === 600000,
  'release commands do not retain the ten-minute upper bound',
);
check(
  packagingMetrics.timeout_regression_target_ms === 1000
    && packagingMetrics.timeout_regression_within_tolerance === true,
  'bounded-runner timeout regression did not pass its deterministic 1000ms contract',
);
check(
  packagingMetrics.selection?.deployer?.disposable_directory_pruning_enforced === true
    && packagingMetrics.selection?.source?.disposable_directory_pruning_enforced === true,
  'package selection does not retain its environment-independent pruning contract',
);
check(
  packagingMetrics.selection?.deployer?.broad_post_descent_filtering_avoided === true
    && packagingMetrics.selection?.source?.broad_post_descent_filtering_avoided === true
    && packagingMetrics.selection?.deployer?.files_considered === undefined
    && packagingMetrics.selection?.source?.files_considered === undefined,
  'package selection serializes an environment-sensitive considered-file count',
);
check(
  packagingMetrics.sequential_failure_report_regression_passed === true,
  'sequential prerequisite failures can retain stale passing evidence',
);
check(
  packagingMetrics.package_regression_tests >= 10,
  'package regression inventory fell below ten tests',
);
check(
  packagingMetrics.archive_source_read_passes_before === 2
    && packagingMetrics.archive_source_read_passes_after === 1,
  'archive writing no longer proves a two-pass to one-pass source-read reduction',
);
check(
  typeof packagingMetrics.archive_compatible_sha256 === 'string'
    && /^[0-9a-f]{64}$/.test(packagingMetrics.archive_compatible_sha256),
  'archive compatibility SHA-256 is missing or malformed',
);
check(
  packagingMetrics.ci_canonical_linux_builds_before === 2
    && packagingMetrics.ci_canonical_linux_builds_after === 1,
  'CI no longer retains the two-to-one canonical Linux build reduction',
);
for (const dimension of ['parity_scans', 'browser_gates']) {
  check(
    packagingMetrics[`deployer_explicit_duplicate_${dimension}_before`] === 1
      && packagingMetrics[`deployer_explicit_duplicate_${dimension}_after`] === 0,
    `deployer duplicate ${dimension.replace('_', ' ')} returned`,
  );
}
check(
  packagingMetrics.selection?.deployer?.files_selected >= 10020
    && packagingMetrics.selection?.deployer?.public_files_selected > 0,
  'deployer selection evidence is incomplete or below its release floor',
);
check(
  packagingMetrics.selection?.source?.files_selected >= 5500
    && packagingMetrics.selection?.source?.public_files_selected === 0,
  'source-package selection evidence is incomplete or below its release floor',
);
for (const fix of [
  'sequential-failure-reporting',
  'bounded-command-runtime',
  'pruned-shared-package-selection',
  'single-source-pass-archive-hashing',
  'source-mutation-detection',
  'exclusive-package-output-lock',
  'exclusive-public-build-lock',
  'archive-input-and-transaction-validation',
  'deduplicated-deployer-gates',
  'deduplicated-linux-ci-build',
  'metadata-aware-frozen-gate-successors',
]) {
  check(buildPackaging.fixes?.includes(fix), `build/package fix is absent: ${fix}`);
}
for (const [key, expected] of [
  ['weekly_workflows_changed', false],
  ['frozen_audit_evidence_changed', false],
  ['security_audit_performed', false],
  ['deployment_performed', false],
]) {
  assertBoolean(buildPackaging.invariants, key, expected, 'build_packaging.invariants');
}

const externalMetrics = external.metrics || {};
check(
  externalMetrics.interactive_source_pages === metadataMetrics.interactive_documents
    && externalMetrics.redirect_source_pages === metadataMetrics.redirect_documents,
  'Audit 48 AT inventory no longer matches the Audit 49 active-page classification',
);
check(
  externalMetrics.calendar_files > 0
    && externalMetrics.parsed_calendar_events > externalMetrics.calendar_files,
  'Audit 48 calendar corpus or parser evidence is missing',
);
check(
  externalMetrics.intended_cross_engine_scenarios === 24
    && externalMetrics.cross_engine_runtime_checks === 0,
  'cross-engine evidence no longer preserves the honest blocked-runtime boundary',
);
check(
  externalMetrics.live_source_bindings >= 200
    && externalMetrics.live_endpoint_bindings >= externalMetrics.live_source_bindings,
  'Audit 48 bounded live-source evidence fell below its release floor',
);
check(
  equalArrays(external.external_execution_required, EXPECTED_EXTERNAL_ROWS),
  'Audit 48 external-only rows changed, disappeared, or were relabelled',
);
check(
  [...EXPECTED_EXTERNAL_ROWS, ...AUDIT49_ADDITIONAL_EXTERNAL_ROWS]
    .every(row => !(external.completed || []).includes(row)),
  'an external-only validation row is represented as completed',
);
check(
  liveHarvest.scheduled_dry_runs?.protest_browser_ocr?.summary?.documents === 0
    && Number(liveHarvest.scheduled_dry_runs?.protest_browser_ocr?.summary?.failures) > 0,
  'reachable protest browser/OCR work is no longer honestly represented as unresolved',
);
check(
  liveHarvest.scheduled_dry_runs?.festivals?.paid_agent_invoked === false,
  'festival paid-agent execution was invoked or is not explicitly bounded',
);
for (const reference of external.references || []) {
  check(
    REFERENCES.some(item => item.url === reference),
    `inherited Audit 48 reference is absent from Audit 49 citations: ${reference}`,
  );
}
check(
  typeof external.policy === 'string'
    && external.policy.includes('no-security-audit boundary'),
  'Audit 48 policy lost the no-security-audit boundary',
);

check(
  governance.schema === 'seminar-schools-translation-governance-v1',
  'translation governance schema changed',
);
check(governance.english_source_of_truth === true, 'English is no longer the translation source of truth');
check(
  governance.organizer_text_policy
    === 'preserve verbatim; mark source language; never silently translate',
  'organizer-authored text policy changed',
);
check(
  governance.high_stakes_policy
    === 'localized summaries remain visibly distinct from complete English detail and noindex until fully translated',
  'high-stakes translation policy changed',
);
const summaryDetailRoutes = (governance.routes || [])
  .filter(route => route.status === 'localized-summary-english-detail');
const expectedSummaryDetailRoutes = [];
for (const segment of [
  'intake',
  'booking-success',
  'policies',
  'scholarship',
  'donate',
  'teach',
  'toronto-tutoring',
  'cloud',
  'flyer',
]) {
  for (const locale of ['fr', 'zh-hant', 'zh-hans', 'fa']) {
    expectedSummaryDetailRoutes.push(`/leizu/${locale}/${segment}/`);
  }
}
check(
  summaryDetailRoutes.map(route => route.route).sort().join('\n')
    === expectedSummaryDetailRoutes.sort().join('\n'),
  'the 36 governed Leizu summary-plus-English-detail routes changed',
);
for (const route of summaryDetailRoutes) {
  const relative = `${route.route.replace(/^\/|\/$/g, '')}/index.html`;
  const html = read(relative);
  const robots = html.match(
    /<meta\b[^>]*\bname\s*=\s*["']robots["'][^>]*\bcontent\s*=\s*["']([^"']+)["'][^>]*>/i,
  )?.[1].toLowerCase().split(/[,\s]+/).filter(Boolean) || [];
  check(
    robots.includes('noindex') && robots.includes('follow'),
    `${relative} is not noindex,follow`,
  );
  check(
    html.includes(
      '<meta name="translation-status" content="localized-summary-english-detail">',
    ),
    `${relative} lost its summary-plus-English-detail status marker`,
  );
  check(
    html.includes(
      `<meta name="translation-source-sha256" content="${route.source_sha256}">`,
    ),
    `${relative} no longer binds the governed English source hash`,
  );
  check(
    /^[0-9a-f]{64}$/.test(route.source_sha256 || ''),
    `${route.route} has an invalid governed source SHA-256`,
  );
}
check(
  Array.isArray(translation.failures) && translation.failures.length === 0,
  'Audit 45 static translation report retains failures',
);
check(
  translation.metrics?.french_event_routes === translation.metrics?.events
    && translation.metrics?.events > 0,
  'French event-route parity no longer matches the source event inventory',
);
check(
  translation.metrics?.governed_route_records === (governance.routes || []).length,
  'translation report and governance record counts disagree',
);
check(
  translation.metrics?.scrape_cadence === 'exactly once weekly',
  'translation evidence no longer records exact weekly cadence',
);
const bbIndex = read('bb/index.html');
check(
  /<title>[^<]*Teacher-Led[^<]*<\/title>/i.test(bbIndex),
  'BB no longer exposes its teacher-led delivery boundary in the page title',
);
check(
  Array.isArray(manifest.notes)
    && manifest.notes.some(note => (
      note.includes('BB retains its teacher-led workflow')
      && note.includes('does not add a site-owned session runner')
    )),
  'release manifest lost the BB teacher-led/no-session-runner boundary',
);

const observedWeeklyWorkflows = {};
for (const [relative, expectedCron] of Object.entries(EXPECTED_WEEKLY_WORKFLOWS)) {
  const crons = extractCrons(read(relative));
  observedWeeklyWorkflows[relative] = crons;
  check(
    crons.length === 1 && crons[0] === expectedCron,
    `${relative} is not exactly once weekly at ${expectedCron}`,
  );
  check(
    expectedCron.trim().split(/\s+/).length === 5,
    `${relative} expected cron is malformed`,
  );
}
const scheduledWorkflowFiles = fs.existsSync(absolute('.github/workflows'))
  ? fs.readdirSync(absolute('.github/workflows'))
    .filter(name => /\.ya?ml$/i.test(name))
    .map(name => `.github/workflows/${name}`)
    .filter(relative => extractCrons(read(relative)).length > 0)
    .sort()
  : [];
check(
  scheduledWorkflowFiles.join('\n')
    === Object.keys(EXPECTED_WEEKLY_WORKFLOWS).sort().join('\n'),
  'scheduled workflow inventory changed without an Audit 49 cadence decision',
);

const frozenAudits = [37, 38, 39, 40, 41, 42, 43];
for (const audit of frozenAudits) {
  const script = `scripts/verify-frozen-audit${audit}.js`;
  check(fs.existsSync(absolute(script)), `frozen Audit ${audit} verifier is missing`);
  check(
    runner.includes(`node ${script}`),
    `full runner no longer enforces frozen Audit ${audit}`,
  );
}
for (const ledger of [
  'data/audit42-frozen-sha256.json',
  'data/audit43-frozen-sha256.json',
]) {
  check(fs.existsSync(absolute(ledger)), `${ledger} is missing`);
}

const expectedPackageCommands = {
  'apply:audit49-release-stamp': 'node scripts/apply-audit49-release-stamp.js',
  'apply:audit49-metadata-hygiene': 'node scripts/apply-audit49-metadata-hygiene.js',
  'verify:audit49-aa-dialog': 'node scripts/verify-audit49-aa-dialog.mjs',
  'verify:audit49-aitr-resilience': 'node scripts/verify-audit49-aitr-resilience.mjs',
  'verify:audit49-metadata-surface': 'node scripts/verify-audit49-metadata-surface.js',
  'verify:audit49-runtime-efficiency': 'node scripts/verify-audit49-runtime-efficiency.js',
  'verify:audit49-build-packaging-efficiency': 'node scripts/verify-audit49-build-packaging-efficiency.js',
  'verify:audit49-technical-efficiency': 'node scripts/verify-audit49-technical-efficiency.js',
};
for (const [name, command] of Object.entries(expectedPackageCommands)) {
  check(pkg.scripts?.[name] === command, `package command ${name} is not ${command}`);
}

const build = pkg.scripts?.['build:locked'] || '';
const buildOrder = [
  'apply-audit49-release-stamp.js',
  'build-audit45-localized-routes.py',
  'apply-audit45-translation-ui.js',
  'apply-audit49-metadata-hygiene.js',
  'update-polymythcal-build-manifest.js',
  'build-public-deploy.js',
  'verify-public-deploy-parity.js',
  'verify-visible-geometry.js',
  'verify-meaningful-geometry.js',
  'verify-geometry.js',
  'verify-audit49-metadata-surface.js',
  'verify-audit49-runtime-efficiency.js',
  'verify-audit49-build-packaging-efficiency.js',
];
let previousBuildIndex = -1;
for (const token of buildOrder) {
  const index = build.indexOf(token);
  check(index > previousBuildIndex, `canonical build omits or misorders ${token}`);
  const expectedExecutions = [
    'build-audit45-localized-routes.py',
    'apply-audit45-translation-ui.js',
    'apply-audit49-metadata-hygiene.js',
    'apply-visible-geometry.js',
  ].includes(token) ? 2 : 1;
  check(
    count(build, token) === expectedExecutions,
    `canonical build executes ${token} ${count(build, token)}/${expectedExecutions} times`,
  );
  previousBuildIndex = index;
}
const finalGeometryApply = build.lastIndexOf('apply-visible-geometry.js');
check(
  count(build, 'apply-visible-geometry.js') === 2
    && finalGeometryApply > build.lastIndexOf('apply-audit49-metadata-hygiene.js')
    && finalGeometryApply < build.indexOf('update-polymythcal-build-manifest.js'),
  'canonical build does not reapply geometry after the last page generator',
);
check(
  !build.includes('verify-audit49-technical-efficiency.js'),
  'canonical build executes the aggregate before Audit 48 external evidence is refreshed',
);
check(
  !build.includes('apply-audit48-release-stamp.js'),
  'canonical build still applies the superseded Audit 48 release stamp',
);
check(
  !build.includes('verify-visible-geometry-browser.mjs'),
  'canonical Netlify build includes the browser-only geometry gate',
);
check(
  build.split(' && ').filter(step => step === 'node scripts/verify-polymythcal-sets13-15-browser.js --dom-only').length === 1
    && !build.split(' && ').includes('node scripts/verify-polymythcal-sets13-15-browser.js'),
  'canonical Netlify build must run the Sets 13-15 DOM-only gate without Chromium',
);

const reusedPreparation = section(
  runner,
  'const reusedBuildPreparation = [',
  'const sequential = [',
);
const sequentialSection = section(runner, 'const sequential = [', 'const checks = [');
const checksSection = section(
  runner,
  'const checks = [',
  '// The canonical build already executes these release blockers.',
);
const canonicalCoverage = section(
  runner,
  'const canonicalBuildCoveredChecks = new Set([',
  'const reusedBuildPreparationChecks = new Set(',
);
const reuseCoverage = section(
  runner,
  'const reusedBuildPreparationChecks = new Set(',
  'const preparationCoveredChecks = reuseBuild',
);
const reuseCoverageIsDerived = reuseCoverage.includes(
  'reusedBuildPreparation.filter(command => checks.includes(command))',
);
for (const token of [
  'verify-audit49-metadata-surface.js',
  'verify-audit49-runtime-efficiency.js',
  'verify-audit49-build-packaging-efficiency.js',
]) {
  check(
    reusedPreparation.includes(token),
    `reuse-build preparation does not refresh ${token}`,
  );
  check(
    checksSection.includes(token)
      && canonicalCoverage.includes(token)
      && reuseCoverageIsDerived,
    `runner does not safely suppress duplicate or parallel execution of ${token}`,
  );
}
check(
  sequentialSection.includes('verify-build-idempotence.js')
    && sequentialSection.indexOf('verify-build-idempotence.js')
      < sequentialSection.indexOf('verify-visible-geometry-browser.mjs'),
  'sequential runner does not enforce a fixed-point build before browser verification',
);
check(
  count(runner, 'node scripts/verify-polymythcal-sets13-15-browser.js') === 1
    && !runner.includes('node scripts/verify-polymythcal-sets13-15-browser.js --dom-only')
    && sequentialSection.indexOf('verify-polymythcal-sets13-15-browser.js')
      > sequentialSection.indexOf('verify-home-map-browser.js')
    && sequentialSection.indexOf('verify-polymythcal-sets13-15-browser.js')
      < sequentialSection.indexOf('verify-visible-geometry-browser.mjs'),
  'sequential release runner does not enforce the full Sets 13-15 browser gate after home and before geometry',
);
check(
  sequentialSection.includes('verify-audit48-external-validation.js'),
  'sequential runner does not refresh Audit 48 external evidence',
);
check(
  sequentialSection.includes('verify-audit49-technical-efficiency.js'),
  'sequential runner does not execute the Audit 49 aggregate',
);
check(
  sequentialSection.indexOf('verify-audit49-technical-efficiency.js')
    > sequentialSection.indexOf('verify-audit48-external-validation.js'),
  'Audit 49 aggregate executes before Audit 48 external evidence',
);
check(
  count(runner, 'verify-audit49-technical-efficiency.js') === 1,
  'runner does not reference the Audit 49 aggregate exactly once',
);

const requiredAudit49Artifacts = [
  'WEBSITE_AUDIT49_TECHNICAL_EFFICIENCY_RESILIENCE_REPORT_2026-07-26.md',
  'scripts/apply-audit49-release-stamp.js',
  'scripts/apply-audit49-metadata-hygiene.js',
  'scripts/verify-audit49-aa-dialog.mjs',
  'scripts/verify-audit49-aitr-resilience.mjs',
  'scripts/verify-audit49-metadata-surface.js',
  'scripts/verify-audit49-runtime-efficiency.js',
  'scripts/verify-audit49-build-packaging-efficiency.js',
  'scripts/verify-audit49-technical-efficiency.js',
  'scripts/reports/audit49-metadata-surface.json',
  'scripts/reports/audit49-runtime-efficiency.json',
  'scripts/reports/audit49-build-packaging-efficiency.json',
  'scripts/reports/audit49-technical-efficiency.json',
];
for (const relative of requiredAudit49Artifacts) {
  check(fs.existsSync(absolute(relative)), `Audit 49 artifact is missing: ${relative}`);
  check(deployer.includes(relative), `deployer package does not require ${relative}`);
  check(sourcePackager.includes(relative), `source package does not require ${relative}`);
}
for (const source of [releaseGates, predeployVerifier]) {
  check(source.includes(EXPECTED_RELEASE), 'release/predeploy gate omits the Audit 49 release ID');
  check(source.includes(EXPECTED_ASSET), 'release/predeploy gate omits the Audit 49 asset version');
  check(source.includes(EXPECTED_PACKAGE), 'release/predeploy gate omits package version 1.0.6');
  check(
    source.includes('verify:audit49-technical-efficiency'),
    'release/predeploy gate omits the Audit 49 aggregate command',
  );
  check(
    source.includes('scripts/reports/audit49-technical-efficiency.json'),
    'release/predeploy gate omits the Audit 49 aggregate report',
  );
}
check(
  predeployWorkflow.includes(
    'WEBSITE_AUDIT49_TECHNICAL_EFFICIENCY_RESILIENCE_REPORT_2026-07-26.md',
  ),
  'predeploy artifact upload omits the Audit 49 Markdown report',
);
check(
  predeployWorkflow.includes('scripts/reports/audit49-*.json'),
  'predeploy artifact upload omits Audit 49 JSON evidence',
);

const uniqueFailures = [...new Set(failures)];
function stableBuildPackagingMetrics(source) {
  if (!source || typeof source !== 'object') return null;
  const metrics = JSON.parse(JSON.stringify(source));
  // The component report measures selected bytes after excluding exactly the
  // five self-updating evidence files in this dependency cycle: its own JSON,
  // this aggregate JSON and Markdown companion, and the release/futureproofing
  // reports. Every file remains selected, hashed, and packaged, while this
  // diagnostic total stays independent of a prior run's evidence size.
  for (const selection of Object.values(metrics.selection || {})) {
    if (!selection || typeof selection !== 'object') continue;
    if (!Number.isInteger(selection.selected_bytes_excluding_generated_reports)) {
      failures.push('Audit 49 package-byte metric lost its generated-report exclusion');
    }
    if (
      selection.files_considered !== undefined
      || selection.broad_post_descent_filtering_avoided !== true
    ) {
      failures.push('Audit 49 package-selection evidence retained an environment-sensitive considered-file count');
    }
  }
  return metrics;
}
const aggregateBuildPackagingMetrics = stableBuildPackagingMetrics(
  buildPackaging.metrics,
);
const componentSummary = {
  metadata: {
    path: COMPONENTS.metadata.path,
    schema: metadata.schema || null,
    release_id: metadata.release_id || null,
    generated_at: metadata.generated_at || null,
    status: reportStatus(metadata),
  },
  runtime: {
    path: COMPONENTS.runtime.path,
    schema: runtime.schema || null,
    release_id: runtime.release_id || null,
    generated_at: runtime.generated_at || null,
    status: reportStatus(runtime),
  },
  build_packaging: {
    path: COMPONENTS.build_packaging.path,
    schema: buildPackaging.schema || null,
    release_id: buildPackaging.release_id || null,
    generated_at: buildPackaging.generated_at || null,
    status: reportStatus(buildPackaging),
  },
  audit48_external_validation: {
    path: COMPONENTS.audit48_external_validation.path,
    schema: external.schema || null,
    release_id: external.release_id || null,
    generated_at: external.generated_at || null,
    status: reportStatus(external),
    machine_validation_status: external.machine_validation_status || null,
  },
};

const aggregate = {
  schema: 'seminar-schools-audit49-technical-efficiency-v1',
  release_id: manifest.release_id || null,
  asset_version: manifest.polymythcal_asset_version || null,
  package_version: pkg.version || null,
  generated_at: manifest.generated_at || null,
  status: uniqueFailures.length ? 'failed' : 'passed',
  scope: {
    decision: 'aggregate current component evidence without repeating full repository walks',
    active_html: metadata.scope || null,
    inherited_external_evidence_program:
      COMPONENTS.audit48_external_validation.path,
    preserved_historical_evidence: 'Audit 37 through Audit 43 frozen gates',
  },
  component_reports: componentSummary,
  metrics: {
    metadata: metadata.metrics || null,
    page_size_distribution: metadata.page_size_distribution || null,
    runtime: runtime.metrics || null,
    cache_policies: runtime.cache_policies || null,
    build_packaging: aggregateBuildPackagingMetrics,
    audit48_external_validation: external.metrics || null,
    translation_governance: {
      governed_route_records: (governance.routes || []).length,
      summary_english_detail_routes: summaryDetailRoutes.length,
      static_translation_metrics: translation.metrics || null,
    },
  },
  issue_counts: metadata.issue_counts || null,
  completed_local_evidence: [
    'repository-wide active HTML metadata and source/public parity gate',
    'runtime interval lifecycle and bounded static-data cache gate',
    'runner, build, CI, and package resilience regressions',
    ...(external.completed || []),
  ],
  external_execution_status: 'required-outside-this-workspace',
  external_execution_required: [
    ...(Array.isArray(external.external_execution_required)
      ? external.external_execution_required
      : []),
    ...AUDIT49_ADDITIONAL_EXTERNAL_ROWS,
  ],
  weekly_workflow_schedules: Object.fromEntries(
    Object.entries(observedWeeklyWorkflows)
      .map(([relative, values]) => [relative, values[0] || null]),
  ),
  preserved_audit_freezes: frozenAudits.map(audit => `audit${audit}`),
  invariants: {
    english_source_of_truth: governance.english_source_of_truth === true,
    organizer_authored_text_verbatim:
      governance.organizer_text_policy
        === 'preserve verbatim; mark source language; never silently translate',
    high_stakes_leizu_noindex_preserved:
      summaryDetailRoutes.length === expectedSummaryDetailRoutes.length
      && summaryDetailRoutes.every(route => {
        const relative = `${route.route.replace(/^\/|\/$/g, '')}/index.html`;
        const html = fs.existsSync(absolute(relative))
          ? fs.readFileSync(absolute(relative), 'utf8')
          : '';
        return /<meta\b[^>]*name=["']robots["'][^>]*content=["'][^"']*\bnoindex\b[^"']*["']/i
          .test(html);
      }),
    bb_teacher_led_without_site_owned_runner: runtime.invariants?.bb_teacher_led === true,
    exact_weekly_workflows_preserved: Object.entries(EXPECTED_WEEKLY_WORKFLOWS)
      .every(([relative, cron]) => (
        equalArrays(observedWeeklyWorkflows[relative], [cron])
      )),
    frozen_audit_evidence_changed: false,
    external_only_rows_relabelled: !equalArrays(
      external.external_execution_required,
      EXPECTED_EXTERNAL_ROWS,
    ),
    native_browser_execution_claimed: false,
    security_audit_performed: false,
    deployment_performed: false,
  },
  fixes: [
    'repository-wide-metadata-and-crawl-contract',
    'localized-generator-metadata-ownership',
    'bounded-runtime-lifecycle',
    'bounded-static-data-caching',
    'failure-safe-bounded-verification',
    'single-pass-locked-archive-writing',
    'pruned-shared-package-selection',
    'deduplicated-ci-and-deployer-work',
    'metadata-aware-frozen-gate-successors',
    'current-release-and-package-wiring',
  ],
  references: REFERENCES,
  failures: uniqueFailures,
};

function formatNumber(value) {
  return Number.isFinite(value) ? value.toLocaleString('en-US') : 'not available';
}

function formatMiB(value) {
  return Number.isFinite(value) ? (value / (1024 * 1024)).toFixed(2) : 'not available';
}

function code(value) {
  return `\`${String(value)}\``;
}

function tableEscape(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function renderMarkdown() {
  const m = aggregate.metrics.metadata || {};
  const sizes = aggregate.metrics.page_size_distribution || {};
  const r = aggregate.metrics.runtime || {};
  const b = aggregate.metrics.build_packaging || {};
  const e = aggregate.metrics.audit48_external_validation || {};
  const selection = b.selection || {};
  const outliers = Array.isArray(metadata.top_page_size_outliers)
    ? metadata.top_page_size_outliers.slice(0, 10)
    : [];
  const lines = [
    '# Website Audit 49 — Technical Efficiency and Resilience',
    '',
    `Release: ${code(aggregate.release_id || 'missing')}`,
    `Asset version: ${code(aggregate.asset_version || 'missing')}`,
    `Package version: ${code(aggregate.package_version || 'missing')}`,
    `Status: ${aggregate.status === 'passed' ? 'PASS' : `FAIL (${aggregate.failures.length} release blockers)`}`,
    '',
    '## Outcome',
    '',
    aggregate.status === 'passed'
      ? 'All locally executable Audit 49 work is complete and release-blocking evidence is current. The active metadata, crawl, runtime, build, CI, packaging, translation-governance, cadence, and inherited machine-validation contracts pass together.'
      : 'The aggregate is intentionally red because one or more current-release inputs or wiring contracts are unfinished. The JSON report lists every blocker; the checks are not weakened during release rebinding.',
    '',
    'This is a code, evidence, and release-orchestration audit. It does not represent a deployment. No security audit was performed.',
    '',
    '## Aggregate evidence',
    '',
    '| Surface | Result | Current evidence |',
    '| --- | ---: | --- |',
    `| Active HTML | ${formatNumber(m.source_html_documents)} documents | ${formatNumber(m.source_public_byte_identical)} byte-identical public mirrors; ${formatNumber(m.interactive_documents)} interactive; ${formatNumber(m.redirect_documents)} redirects |`,
    `| Crawl/indexing | ${formatNumber(m.indexable_documents)} indexable / ${formatNumber(m.noindex_documents)} noindex | ${formatNumber(m.sitemap_urls)} sitemap URLs; ${formatNumber(m.hreflang_links)} hreflang links |`,
    `| Structured data | ${formatNumber(m.schema_blocks)} JSON-LD blocks | ${formatNumber(m.schema_documents)} documents; ${formatNumber(m.intentional_schema_exemptions)} declared indexable exemption |`,
    `| Runtime lifecycle | ${formatNumber(r.files_with_intervals)} interval files | ${formatNumber(r.bounded_leaf_routes)} bounded routes; ${formatNumber(r.startup_timer_slots_bounded)} bounded startup timer slots |`,
    `| Static-data delivery | ${formatNumber(r.bounded_public_data_assets)} assets | ${formatMiB(r.bounded_public_data_bytes)} MiB under explicit bounded cache policies; ${formatNumber(r.forced_public_data_revalidation_fetches)} forced revalidations |`,
    `| Package resilience | ${formatNumber(b.package_regression_tests)} regressions | ${formatNumber(b.archive_source_read_passes_before)}→${formatNumber(b.archive_source_read_passes_after)} archive source-read passes; compatible SHA-256 retained |`,
    `| CI/deployer work | ${formatNumber(b.ci_canonical_linux_builds_before)}→${formatNumber(b.ci_canonical_linux_builds_after)} canonical Linux builds | duplicate deployer parity scans and browser gates reduced to zero |`,
    `| Audit 48 machine evidence | ${formatNumber(e.calendar_files)} calendars / ${formatNumber(e.parsed_calendar_events)} parsed VEVENT representations | ${formatNumber(e.intended_cross_engine_scenarios)} intended engine scenarios; ${formatNumber(e.cross_engine_runtime_checks)} runtime engine checks honestly recorded |`,
    '',
    'The aggregate reads the component metrics directly from the JSON reports. It does not repeat their expensive repository walks.',
    '',
    '## What Audit 49 changed',
    '',
    '### Metadata, crawl surface, and generated-page ownership',
    '',
    '- Added one repository-wide classifier for interactive versus redirect HTML, index/noindex state, title, description, viewport, canonical, robots, JSON-LD, hreflang, sitemap membership, source/public parity, and page-size distribution.',
    '- Corrected metadata ownership at generators so rebuilds preserve the fix: localized Leizu funnel summaries, French event date titles, French calendar shells, teacher-resource category pages, the BB landing title, calendar legacy aliases, and intentional WebPage schema coverage.',
    `- Closed every recorded metadata issue group at zero across ${formatNumber(m.source_html_documents)} active source documents and the same number of public mirrors.`,
    `- Retained ${formatNumber(m.indexable_documents_without_schema)} indexable schema gap because it is exactly matched by ${formatNumber(m.intentional_schema_exemptions)} declared historical-archive exemption.`,
    '',
    'Google documents robots directives, canonical signals, localized alternates, sitemaps, and structured data at the official references listed below. Audit 49 treats those signals as one coherent contract rather than five unrelated spot checks.',
    '',
    '### Runtime lifecycle and caching',
    '',
    `- Inventoried every active repeating browser timer. The only remaining intervals are the ${formatNumber(r.interval_calls)} intentional Leizu ambient-leaf intervals across English, French, Traditional Chinese, Simplified Chinese, and Persian landing/teaching routes.`,
    '- Those intervals stop on hidden pages, navigation, reduced-motion, and calm states; clear pending startup timers and animated nodes; and restart only after an eligible back-forward-cache restoration.',
    `- Bound ${formatNumber(r.bounded_public_data_assets)} large public data assets (${formatMiB(r.bounded_public_data_bytes)} MiB) to explicit browser and edge cache policies, while removing redundant forced revalidation from Florilegium and Polymythcal candidate fetches.`,
    '',
    'The runtime decisions follow HTTP cache semantics, the Page Visibility lifecycle, and animation-frame scheduling references cited below.',
    '',
    '### Verification, build, CI, and packaging',
    '',
    `- Every release-runner command has a ${formatNumber(b.command_timeout_ms)} ms upper bound, and a prerequisite failure writes a fresh failed report instead of leaving stale passing evidence.`,
    '- The public builder and package writer use recoverable exclusive locks. Package inputs reject duplicates, symlinks, escaping paths, output-transaction artifacts, and files that mutate during archive creation.',
    `- Archive creation moved from ${formatNumber(b.archive_source_read_passes_before)} source reads per member to ${formatNumber(b.archive_source_read_passes_after)} while retaining the compatibility SHA-256 ${code(b.archive_compatible_sha256 || 'missing')}.`,
    '- Shared top-down selection enforces dependency and generated-directory pruning before descent; the committed report is independent of whether those disposable directories happen to exist locally.',
    `- The deployer selection retained ${formatNumber(selection.deployer?.files_selected)} files; the source package retained ${formatNumber(selection.source?.files_selected)} files.`,
    '- Linux performs the canonical full audit once. Windows and macOS retain portable coverage, and the deployer inherits runner-owned parity/browser gates instead of repeating them.',
    '- Metadata-aware Audit 49 successors preserve the frozen Audit 36 assertions while excluding inert non-JavaScript script payloads from inline-code analysis.',
    '',
    '## Page-size distribution',
    '',
    `The permanent ceilings are 4 MiB raw and 1,280 KiB gzip. Current maxima are ${formatMiB(sizes.largest_bytes)} MiB raw and ${formatMiB(sizes.largest_gzip_bytes)} MiB gzip.`,
    '',
    '| Route | Raw bytes | Gzip bytes | Indexable |',
    '| --- | ---: | ---: | :---: |',
    ...outliers.map(item => (
      `| ${code(tableEscape(item.route))} | ${formatNumber(item.bytes)} | ${formatNumber(item.gzip_bytes)} | ${item.indexable ? 'yes' : 'no'} |`
    )),
    '',
    'These are governed outliers, not unexamined omissions. The two Methodology pages remain the strongest future candidates for structural payload splitting, but both remain under the release ceilings.',
    '',
    '## Preserved product and governance boundaries',
    '',
    '- English remains the translation source of truth.',
    '- Organizer-authored titles and descriptions remain verbatim, visibly source-language bounded, and are never silently translated.',
    `- All ${formatNumber(aggregate.metrics.translation_governance.summary_english_detail_routes)} Leizu summary-plus-English-detail routes remain ${code('noindex,follow')} until fully translated. Each route names the English detail and retains its governed English-source SHA-256.`,
    '- BB remains teacher-led and does not add a site-owned session runner.',
    '- Content harvesting, protest harvesting, festival harvesting, link auditing, and dependency health each remain exactly once weekly at their approved cron.',
    '- Frozen Audit 37 through Audit 43 gates remain active. Audit 49 does not rewrite historical evidence.',
    '',
    '## Audit 48 external-validation continuity',
    '',
    `Audit 48 machine evidence remains passing: ${formatNumber(e.calendar_files)} calendar files, ${formatNumber(e.parsed_calendar_events)} parsed event representations, ${formatNumber(e.live_source_bindings)} live-source bindings, and ${formatNumber(e.unique_live_requests)} bounded unique requests.`,
    '',
    'The following rows remain external-only and are not represented as completed:',
    '',
    ...aggregate.external_execution_required.map(row => `- ${row}`),
    '',
    'The zero cross-engine runtime count is intentional and honest: the portable program exists, but this workspace did not execute branded Firefox, native Safari, VoiceOver, NVDA, or physical-device validation.',
    '',
    '## Release wiring',
    '',
    '- The canonical build stamps Audit 49 before localized routes bind English-source hashes, applies translation UI before metadata hygiene, builds the public mirror, and runs the three component gates in dependency order.',
    '- Reuse-build mode refreshes the three component reports without repeating the canonical build.',
    '- The sequential runner refreshes Audit 48 external evidence and only then evaluates this aggregate.',
    '- Release gates, predeploy checks, deployer packaging, source packaging, and predeploy artifact upload require the exact Audit 49 verifier, JSON reports, and this Markdown report.',
    '',
    '## Verification artifacts',
    '',
    `- ${code('scripts/reports/audit49-metadata-surface.json')}`,
    `- ${code('scripts/reports/audit49-runtime-efficiency.json')}`,
    `- ${code('scripts/reports/audit49-build-packaging-efficiency.json')}`,
    `- ${code('scripts/reports/audit49-technical-efficiency.json')}`,
    `- ${code('scripts/reports/audit48-external-validation.json')} (Audit 48 schema/program rebound to Audit 49; external-only rows preserved)`,
    '',
    'Run the aggregate with:',
    '',
    '```sh',
    'npm run verify:audit49-technical-efficiency',
    '```',
    '',
    '## Explicit limits',
    '',
    '- No security audit was performed.',
    '- No deployment was performed or claimed.',
    '- Passing local automation does not substitute for the external-only native-browser, assistive-technology, physical-device, vendor-account, real-user, reachable protest browser/OCR, authorized festival paid-agent, or post-deployment work listed above.',
    '',
    '## References',
    '',
    ...REFERENCES.map(reference => `- ${reference.topic}: ${reference.url}`),
    '',
  ];
  if (aggregate.failures.length) {
    lines.push('## Current release blockers', '');
    for (const failure of aggregate.failures) lines.push(`- ${failure}`);
    lines.push('');
  }
  return lines.join('\n');
}

function writeIfChanged(target, content) {
  fs.mkdirSync(path.dirname(target), {recursive: true});
  if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== content) {
    fs.writeFileSync(target, content, 'utf8');
  }
}

const renderedJson = `${JSON.stringify(aggregate, null, 2)}\n`;
const renderedMarkdown = renderMarkdown();
writeIfChanged(REPORT, renderedJson);
writeIfChanged(MARKDOWN, renderedMarkdown);

if (process.env.SS_REPORT_OUTPUT_MTIME) {
  const stamp = new Date(process.env.SS_REPORT_OUTPUT_MTIME);
  if (Number.isNaN(stamp.getTime())) {
    throw new Error('SS_REPORT_OUTPUT_MTIME must be a valid timestamp');
  }
  fs.utimesSync(REPORT, stamp, stamp);
  fs.utimesSync(MARKDOWN, stamp, stamp);
}

if (aggregate.failures.length) {
  console.error(
    `AUDIT49 TECHNICAL EFFICIENCY / RESILIENCE FAILED (${aggregate.failures.length})`,
  );
  for (const failure of aggregate.failures) console.error(` - ${failure}`);
  console.error(`See ${path.relative(ROOT, REPORT)} for the aggregate decision.`);
  process.exit(1);
}

console.log(
  'AUDIT49 TECHNICAL EFFICIENCY / RESILIENCE PASSED — '
  + `${formatNumber(metadataMetrics.source_html_documents)} active HTML documents, `
  + `${formatNumber(runtimeMetrics.bounded_leaf_routes)} bounded interval routes, `
  + `${formatNumber(packagingMetrics.package_regression_tests)} package regressions, `
  + 'current Audit 48 machine evidence, exact weekly cadence, frozen history, '
  + 'and external-only validation boundaries are release-blocking.',
);
