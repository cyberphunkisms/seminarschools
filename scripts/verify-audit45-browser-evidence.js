#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const REPORT = path.join(ROOT, 'data', 'audit45-browser', 'translation-browser-audit.json');
const AUDIT45_RELEASE_ID = '2026-07-25-site-audit45-full-translation-localization-final';
const AUDIT45_GENERATED_AT = '2026-07-25T18:45:00-04:00';
const AUDIT45_PROGRAM_SHA256 = '06ad5d4cc4b079e37699554a3e78235a0f12e4a766e7e53222247e61951d3b35';
const AUDIT46_RELEASE_ID = '2026-07-26-site-audit46-technical-efficiency-rollover-final';
const AUDIT47_RELEASE_ID = '2026-07-26-site-audit47-technical-efficiency-continuity-final';
const AUDIT48_RELEASE_ID = '2026-07-26-site-audit48-external-validation-interoperability-final';
const AUDIT49_RELEASE_ID = '2026-07-26-site-audit49-technical-efficiency-resilience-final';
const CURRENT_RELEASE_ID = '2026-07-28-site-audit53-shared-discovery-teacherresources-polymythcal-commons-final';
const CURRENT_ASSET_VERSION = '20260728-audit53';
const failures = [];
let assertions = 0;

function check(condition, message) {
  assertions += 1;
  if (!condition) failures.push(message);
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

if (!fs.existsSync(REPORT)) {
  console.error('AUDIT 45 BROWSER EVIDENCE FAILED — report is missing.');
  process.exit(1);
}

let report;
let manifest;
try {
  report = JSON.parse(fs.readFileSync(REPORT, 'utf8'));
  manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'RELEASE_MANIFEST.json'), 'utf8'));
} catch (error) {
  console.error(`AUDIT 45 BROWSER EVIDENCE FAILED — invalid JSON: ${error.message}`);
  process.exit(1);
}

check(report.schema === 'seminar-schools-audit45-translation-browser-v1', 'unexpected evidence schema');
check(manifest.release_id === CURRENT_RELEASE_ID, `manifest release is ${manifest.release_id}`);
check(
  manifest.polymythcal_asset_version === CURRENT_ASSET_VERSION,
  `translation asset version is ${manifest.polymythcal_asset_version}`,
);
const inheritedEvidence = report.release_id === AUDIT45_RELEASE_ID;
const currentEvidence = report.release_id === manifest.release_id;
check(inheritedEvidence || currentEvidence, `evidence release is ${report.release_id}`);
if (inheritedEvidence) {
  check(report.generated_at === AUDIT45_GENERATED_AT, 'inherited browser evidence timestamp is not the Audit 45 stamp');
  check(report.source_program_sha256 === AUDIT45_PROGRAM_SHA256, 'inherited browser program hash is not the Audit 45 hash');
} else if (currentEvidence) {
  check(report.generated_at === manifest.generated_at, 'current browser evidence timestamp differs from release manifest');
}
check(report.status === 'passed', `browser evidence status is ${report.status}`);
check(/^(?:(?:Headless)?Chrome\/)?149\./.test(report.browser || ''), `unexpected browser version ${report.browser}`);
check(report.external_requests === 'blocked', 'external requests were not blocked');
check(report.source_program === 'scripts/audit45-translation-browser.js', 'wrong browser program path');

const program = path.join(ROOT, report.source_program || '');
check(fs.existsSync(program), 'browser audit program is missing');
if (fs.existsSync(program)) {
  if (currentEvidence) {
    check(sha256(program) === report.source_program_sha256, 'current browser audit program hash is stale');
  } else {
    const source = fs.readFileSync(program, 'utf8');
    check(source.includes(AUDIT49_RELEASE_ID), 'current browser audit program cannot produce Audit 49 evidence');
  }
}

const checks = Array.isArray(report.checks) ? report.checks : [];
check(checks.length >= 110, `only ${checks.length} browser checks were recorded`);
check(report.checks_total === checks.length, 'checks_total does not match evidence array');
check(report.checks_passed === checks.length, 'not every browser check passed');
check(report.checks_failed === 0, 'browser evidence records failed checks');
check(checks.every(item => item && item.passed === true && item.name), 'browser check list contains an invalid or failed record');
check(new Set(checks.map(item => item.name)).size === checks.length, 'browser check names are not unique');

const expectedLabels = [
  'Leizu French home desktop',
  'Leizu Persian home mobile',
  'Leizu Simplified Chinese intake mobile',
  'Polymythcal French home desktop',
  'Polymythcal French focused calendar mobile',
  'Polymythcal French event mobile',
  'Polymythcal French submission form mobile',
  'Saul Persian archive mobile',
  'Saul Traditional Chinese archive desktop',
  'Teacher Resources source-language finder desktop',
  'BB Simplified Chinese Why essay mobile',
];
const evidenceMetrics = Array.isArray(report.metrics) ? report.metrics : [];
check(evidenceMetrics.length === expectedLabels.length, `expected ${expectedLabels.length} metric records`);
for (const label of expectedLabels) {
  const metric = evidenceMetrics.find(item => item.label === label);
  check(Boolean(metric), `missing metric record for ${label}`);
  if (!metric) continue;
  check(Number(metric.cls) <= 0.1, `${label} CLS exceeds 0.1`);
  check(Number(metric.documentOverflow) <= 1, `${label} horizontally overflows`);
  check(Array.isArray(metric.badEdges) && metric.badEdges.length === 0, `${label} has off-viewport elements`);
  check(metric.visibleH1 === 1, `${label} does not have exactly one visible H1`);
}

const screenshots = Array.isArray(report.screenshots) ? report.screenshots : [];
check(screenshots.length === expectedLabels.length, `expected ${expectedLabels.length} screenshots`);
check(new Set(screenshots.map(item => item.file)).size === screenshots.length, 'duplicate screenshot evidence');
for (const item of screenshots) {
  const relative = path.join('data', 'audit45-browser', item.file || '');
  const file = path.join(ROOT, relative);
  check(fs.existsSync(file), `screenshot is missing: ${relative}`);
  if (!fs.existsSync(file)) continue;
  check(fs.statSync(file).size === item.bytes && item.bytes > 10_000, `invalid screenshot size: ${relative}`);
  check(sha256(file) === item.sha256, `stale screenshot hash: ${relative}`);
}

if (failures.length) {
  console.error(`AUDIT 45 BROWSER EVIDENCE FAILED (${failures.length}/${assertions})`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(
  `AUDIT 45 BROWSER EVIDENCE PASSED — ${assertions}/${assertions} assertions, `
  + `${checks.length} ${currentEvidence ? 'current' : 'inherited'} Chromium checks, `
  + `${screenshots.length} hashed screenshots.`,
);
