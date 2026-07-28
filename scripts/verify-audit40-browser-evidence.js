#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const EXPECTED_RELEASE_ID =
  '2026-07-24-site-audit40-browser-runtime-continuity-final';
const REPORTS = [
  {
    path: 'data/polymythcal-audit40/interaction-design-browser-audit.json',
    release: 'PolymythCAL Audit 40 end-to-end interaction and design verification',
    minimumChecks: 94,
  },
  {
    path: 'data/polymythcal-audit40/entry-pages-browser-audit.json',
    release: 'PolymythCAL Audit 40 dedicated entry-page browser verification',
    minimumChecks: 209,
  },
  {
    path: 'data/polymythcal-audit40/wcag22-browser-audit.json',
    release: 'PolymythCAL Audit 40 end-to-end',
    standard: 'WCAG 2.2 AA',
    minimumChecks: 42,
  },
  {
    path: 'data/audit40-route-browser/route-resilience-browser-audit.json',
    release: 'Audit40 route resilience and recovery',
    engine: 'Chromium',
    phase: 'all',
    minimumChecks: 252,
  },
  {
    path: 'scripts/reports/audit40-project-failure-stress.json',
    release: 'Audit40 project failure-mode and stress',
    minimumChecks: 27,
  },
  {
    path: 'data/audit40-browser/runtime-continuity-browser-audit.json',
    runtime: true,
    minimumChecks: 194,
  },
];
const MAX_EVIDENCE_AGE_MS = 2 * 60 * 60 * 1000;
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const failures = [];
const now = Date.now();

function readJson(relative) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));
  } catch (error) {
    failures.push(`${relative} is missing or invalid JSON: ${error.message}`);
    return null;
  }
}

const release = readJson('RELEASE_MANIFEST.json') || {};
if (release.release_id !== EXPECTED_RELEASE_ID) {
  failures.push(
    `RELEASE_MANIFEST.json identifies ${release.release_id || 'an unknown release'}; `
      + `expected ${EXPECTED_RELEASE_ID}`,
  );
}
const releaseGeneratedAt = Date.parse(release.generated_at || '');
if (!Number.isFinite(releaseGeneratedAt)) {
  failures.push('RELEASE_MANIFEST.json has an invalid generated_at timestamp');
}

let combinedChecks = 0;
for (const expected of REPORTS) {
  const report = readJson(expected.path);
  if (!report) continue;

  if (report.audit !== 40) failures.push(`${expected.path} is not stamped Audit 40`);
  if (report.release_id !== EXPECTED_RELEASE_ID) {
    failures.push(`${expected.path} belongs to ${report.release_id || 'an unknown release'}`);
  }
  if (report.generated_at !== release.generated_at) {
    failures.push(`${expected.path} does not reference the current release timestamp`);
  }
  if (expected.release && report.release !== expected.release) {
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
    || total < expected.minimumChecks
  ) {
    failures.push(
      `${expected.path} has ${total || 0} checks; expected at least ${expected.minimumChecks}`,
    );
  } else {
    combinedChecks += total;
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

  if (expected.runtime) {
    if (!String(report.browser || '').startsWith('Chromium')) {
      failures.push(`${expected.path} did not execute in Chromium`);
    }
    if (report.route_cases !== 24 || report.metrics?.length !== 24) {
      failures.push(`${expected.path} does not contain all 24 route/viewport cases`);
    }
    const cases = new Set(
      (report.metrics || []).map(row => `${row.route || ''}\0${row.viewport || ''}`),
    );
    if (cases.size !== 24) {
      failures.push(`${expected.path} contains duplicate or missing route/viewport metrics`);
    }
    const limitations = Array.isArray(report.environment_limits)
      ? report.environment_limits.join('\n')
      : '';
    for (const token of ['VoiceOver', 'NVDA', 'Firefox', 'WebKit']) {
      if (!limitations.includes(token)) {
        failures.push(`${expected.path} does not disclose the ${token} environment limit`);
      }
    }
  }
}

const screenshots = path.join(ROOT, 'data', 'audit40-browser', 'screenshots');
let screenshotCount = 0;
try {
  screenshotCount = fs.readdirSync(screenshots).filter(name => /\.png$/i.test(name)).length;
} catch {
  // The count check below supplies the stable failure.
}
if (screenshotCount < 6) {
  failures.push(`Audit 40 runtime evidence has ${screenshotCount}/6 required screenshots`);
}

if (combinedChecks < 818) {
  failures.push(`combined browser assertion floor backtracked: ${combinedChecks}/818`);
}

if (failures.length) {
  console.error('AUDIT 40 FRESH BROWSER EVIDENCE FAILED');
  failures.forEach(failure => console.error(` - ${failure}`));
  process.exit(1);
}

console.log(
  `AUDIT 40 FRESH BROWSER EVIDENCE PASSED — ${REPORTS.length} current-release `
    + `Chromium reports contain ${combinedChecks} complete assertions and `
    + `${screenshotCount} runtime screenshots.`,
);
