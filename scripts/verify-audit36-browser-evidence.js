#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const EXPECTED_RELEASE_ID = '2026-07-24-site-audit36-discovery-resilience-final';
const RELEASE = JSON.parse(fs.readFileSync(path.join(ROOT, 'RELEASE_MANIFEST.json'), 'utf8'));
const REPORTS = [
  {
    path: 'data/polymythcal-audit36/interaction-design-browser-audit.json',
    release: 'PolymythCAL Audit 36 end-to-end interaction and design verification',
  },
  {
    path: 'data/polymythcal-audit36/entry-pages-browser-audit.json',
    release: 'PolymythCAL Audit 36 dedicated entry-page browser verification',
  },
  {
    path: 'data/polymythcal-audit36/wcag22-browser-audit.json',
    release: 'PolymythCAL Audit 36 end-to-end',
    standard: 'WCAG 2.2 AA',
  },
  {
    path: 'data/audit36-route-browser/route-resilience-browser-audit.json',
    release: 'Audit36 route resilience and recovery',
  },
  {
    path: 'scripts/reports/audit36-project-failure-stress.json',
    release: 'Audit36 project failure-mode and stress',
  },
];
const MAX_EVIDENCE_AGE_MS = 2 * 60 * 60 * 1000;
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const failures = [];
const now = Date.now();

if (RELEASE.release_id !== EXPECTED_RELEASE_ID) {
  failures.push(
    `RELEASE_MANIFEST.json identifies ${RELEASE.release_id || 'an unknown release'}; expected ${EXPECTED_RELEASE_ID}`,
  );
}

for (const expected of REPORTS) {
  const rel = expected.path;
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) {
    failures.push(`${rel} is missing`);
    continue;
  }

  let report;
  try {
    report = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    failures.push(`${rel} is invalid JSON: ${error.message}`);
    continue;
  }

  if (report.audit !== 36) failures.push(`${rel} is not stamped Audit 36`);
  if (report.release_id !== EXPECTED_RELEASE_ID) {
    failures.push(`${rel} belongs to ${report.release_id || 'an unknown release'}`);
  }
  if (report.generated_at !== RELEASE.generated_at) {
    failures.push(`${rel} does not reference the current release timestamp`);
  }
  if (expected.release && report.release !== expected.release) {
    failures.push(`${rel} has the wrong release label`);
  }
  if (expected.standard && report.standard !== expected.standard) {
    failures.push(`${rel} has the wrong audit standard`);
  }

  const executedAt = Date.parse(report.executed_at || '');
  const age = now - executedAt;
  if (
    !Number.isFinite(executedAt)
    || age > MAX_EVIDENCE_AGE_MS
    || age < -MAX_CLOCK_SKEW_MS
  ) {
    failures.push(`${rel} was not executed during this predeploy run`);
  }

  const total = Number(report.checks_total);
  const passed = Number(report.checks_passed);
  const failed = Number(report.checks_failed);
  if (!Number.isInteger(total) || total < 1) {
    failures.push(`${rel} has an invalid total check count`);
  }
  if (passed !== total || failed !== 0) {
    failures.push(`${rel} reports ${passed}/${total} passing checks and ${failed} failures`);
  }
  if (!Array.isArray(report.results) || report.results.length !== total) {
    failures.push(`${rel} results do not match its check count`);
  } else if (report.results.some(result => result?.passed !== true)) {
    failures.push(`${rel} contains a failed or ambiguous browser assertion`);
  }
}

if (failures.length) {
  console.error('AUDIT 36 FRESH BROWSER EVIDENCE FAILED');
  failures.forEach(failure => console.error(` - ${failure}`));
  process.exit(1);
}

console.log(
  `AUDIT 36 FRESH BROWSER EVIDENCE PASSED — ${REPORTS.length} current-release browser reports are fresh and complete.`,
);
