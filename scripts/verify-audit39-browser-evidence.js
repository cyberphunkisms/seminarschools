#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const EXPECTED_RELEASE_ID =
  '2026-07-24-site-audit39-discovery-continuity-route-resilience-final';
const REPORTS = [
  {
    path: 'data/polymythcal-audit39/interaction-design-browser-audit.json',
    release: 'PolymythCAL Audit 39 end-to-end interaction and design verification',
  },
  {
    path: 'data/polymythcal-audit39/entry-pages-browser-audit.json',
    release: 'PolymythCAL Audit 39 dedicated entry-page browser verification',
  },
  {
    path: 'data/polymythcal-audit39/wcag22-browser-audit.json',
    release: 'PolymythCAL Audit 39 end-to-end',
    standard: 'WCAG 2.2 AA',
  },
  {
    path: 'data/audit39-route-browser/route-resilience-browser-audit.json',
    release: 'Audit39 route resilience and recovery',
    engine: 'Chromium',
    phase: 'all',
  },
  {
    path: 'scripts/reports/audit39-project-failure-stress.json',
    release: 'Audit39 project failure-mode and stress',
  },
];
const MAX_EVIDENCE_AGE_MS = 2 * 60 * 60 * 1000;
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const failures = [];
const now = Date.now();

let release;
try {
  release = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'RELEASE_MANIFEST.json'), 'utf8'),
  );
} catch (error) {
  console.error(
    `AUDIT 39 FRESH BROWSER EVIDENCE FAILED\n - RELEASE_MANIFEST.json is invalid: ${error.message}`,
  );
  process.exit(1);
}

if (release.release_id !== EXPECTED_RELEASE_ID) {
  failures.push(
    `RELEASE_MANIFEST.json identifies ${release.release_id || 'an unknown release'}; expected ${EXPECTED_RELEASE_ID}`,
  );
}
const releaseGeneratedAt = Date.parse(release.generated_at || '');
if (!Number.isFinite(releaseGeneratedAt)) {
  failures.push('RELEASE_MANIFEST.json has an invalid generated_at timestamp');
}

for (const expected of REPORTS) {
  const file = path.join(ROOT, expected.path);
  if (!fs.existsSync(file)) {
    failures.push(`${expected.path} is missing`);
    continue;
  }
  let report;
  try {
    report = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    failures.push(`${expected.path} is invalid JSON: ${error.message}`);
    continue;
  }

  if (report.audit !== 39) {
    failures.push(`${expected.path} is not stamped Audit 39`);
  }
  if (report.release_id !== EXPECTED_RELEASE_ID) {
    failures.push(
      `${expected.path} belongs to ${report.release_id || 'an unknown release'}`,
    );
  }
  if (report.generated_at !== release.generated_at) {
    failures.push(`${expected.path} does not reference the current release timestamp`);
  }
  if (report.release !== expected.release) {
    failures.push(`${expected.path} has the wrong release label`);
  }
  if (expected.standard && report.standard !== expected.standard) {
    failures.push(`${expected.path} has the wrong audit standard`);
  }
  if (expected.engine && report.engine !== expected.engine) {
    failures.push(`${expected.path} did not execute in ${expected.engine}`);
  }
  if (expected.phase && report.phase !== expected.phase) {
    failures.push(`${expected.path} is a partial ${report.phase || 'unknown'} run`);
  }

  const executedAt = Date.parse(report.executed_at || '');
  const age = now - executedAt;
  if (
    !Number.isFinite(executedAt)
    || age > MAX_EVIDENCE_AGE_MS
    || age < -MAX_CLOCK_SKEW_MS
  ) {
    failures.push(`${expected.path} was not executed during this predeploy run`);
  }
  if (
    Number.isFinite(executedAt)
    && Number.isFinite(releaseGeneratedAt)
    && executedAt + MAX_CLOCK_SKEW_MS < releaseGeneratedAt
  ) {
    failures.push(`${expected.path} predates the current release`);
  }

  const total = report.checks_total;
  const passed = report.checks_passed;
  const failed = report.checks_failed;
  if (
    typeof total !== 'number'
    || !Number.isInteger(total)
    || total < 1
  ) {
    failures.push(`${expected.path} has an invalid total check count`);
  }
  if (passed !== total || failed !== 0) {
    failures.push(
      `${expected.path} reports ${passed}/${total} passing checks and ${failed} failures`,
    );
  }
  if (!Array.isArray(report.results) || report.results.length !== total) {
    failures.push(`${expected.path} results do not match its check count`);
  } else if (
    report.results.some(
      result => !result || typeof result !== 'object' || result.passed !== true,
    )
  ) {
    failures.push(`${expected.path} contains a failed or ambiguous browser assertion`);
  }
}

if (failures.length) {
  console.error('AUDIT 39 FRESH BROWSER EVIDENCE FAILED');
  failures.forEach(failure => console.error(` - ${failure}`));
  process.exit(1);
}

console.log(
  `AUDIT 39 FRESH BROWSER EVIDENCE PASSED — ${REPORTS.length} current-release Chromium reports are fresh and complete.`,
);
