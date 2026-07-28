#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ARTIFACT_ROOT = 'data/audit42-inherited-browser';
const ADAPTER_CONTRACT = 'audit42-inherited-browser-v1';
const EXPECTED_RELEASE_ID =
  '2026-07-25-site-audit42-ledger-closure-multimode-final';
const ADAPTER_PATH = 'scripts/run-audit42-inherited-browser.py';
const WRAPPER_PATH = 'scripts/run-audit42-inherited-browser-all.py';
const VERIFIER_PATH = 'scripts/verify-audit42-inherited-browser-evidence.js';
const MAX_EVIDENCE_AGE_MS = 2 * 60 * 60 * 1000;
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

const ROUTE_SCREENSHOTS = [
  'aa-desktop.png',
  'aa-forced-colors.png',
  'aa-landscape-short.png',
  'aa-mobile-short.png',
  'about-desktop.png',
  'about-landscape-short.png',
  'about-mobile-short.png',
  'agora-desktop.png',
  'agora-landscape-short.png',
  'agora-mobile-short.png',
  'bb-desktop.png',
  'bb-forced-colors.png',
  'bb-landscape-short.png',
  'bb-mobile-short.png',
  'bookwormcard-desktop.png',
  'bookwormcard-forced-colors.png',
  'bookwormcard-landscape-short.png',
  'bookwormcard-mobile-short.png',
  'cv-desktop.png',
  'cv-landscape-short.png',
  'cv-mobile-short.png',
  'home-desktop.png',
  'home-forced-colors.png',
  'home-landscape-short.png',
  'home-mobile-short.png',
  'leizu-desktop.png',
  'leizu-landscape-short.png',
  'leizu-mobile-short.png',
  'methodology-list-desktop.png',
  'methodology-list-landscape-short.png',
  'methodology-list-mobile-short.png',
  'polymythcal-desktop.png',
  'polymythcal-forced-colors.png',
  'polymythcal-landscape-short.png',
  'polymythcal-mobile-short.png',
  'teacher-resources-desktop.png',
  'teacher-resources-forced-colors.png',
  'teacher-resources-landscape-short.png',
  'teacher-resources-mobile-short.png',
];

const SUITES = [
  {
    suite: 'interaction',
    sourceAudit: 37,
    source: 'scripts/audit-polymythcal-interactivity-design-audit37.py',
    report: `${ARTIFACT_ROOT}/interaction/interaction-design-browser-audit.json`,
    checks: 94,
    release: 'PolymythCAL Audit 42 end-to-end interaction and design verification',
    screenshots: {
      directory: `${ARTIFACT_ROOT}/interaction`,
      names: ['desktop-final.png', 'mobile-final.png', 'small-mobile-final.png'],
    },
  },
  {
    suite: 'entry-pages',
    sourceAudit: 37,
    source: 'scripts/audit-polymythcal-entry-pages-audit37.py',
    report: `${ARTIFACT_ROOT}/entry-pages/entry-pages-browser-audit.json`,
    checks: 209,
    release: 'PolymythCAL Audit 42 dedicated entry-page browser verification',
  },
  {
    suite: 'wcag',
    sourceAudit: 37,
    source: 'scripts/audit-polymythcal-wcag22-audit37.py',
    report: `${ARTIFACT_ROOT}/wcag/wcag22-browser-audit.json`,
    checks: 42,
    release: 'PolymythCAL Audit 42 end-to-end',
    standard: 'WCAG 2.2 AA',
  },
  {
    suite: 'routes',
    sourceAudit: 37,
    source: 'scripts/audit-audit37-route-resilience.py',
    report: `${ARTIFACT_ROOT}/routes/route-resilience-browser-audit.json`,
    checks: 252,
    release: 'Audit42 route resilience and recovery',
    engine: 'Chromium',
    phase: 'all',
    screenshots: {
      directory: `${ARTIFACT_ROOT}/routes`,
      names: ROUTE_SCREENSHOTS,
    },
  },
  {
    suite: 'stress',
    sourceAudit: 37,
    source: 'scripts/audit-project-failure-stress-audit37.py',
    report: `${ARTIFACT_ROOT}/stress/project-failure-stress.json`,
    checks: 27,
    release: 'Audit42 project failure-mode and stress',
  },
  {
    suite: 'runtime',
    sourceAudit: 41,
    source: 'scripts/audit41-browser-runtime.py',
    report: `${ARTIFACT_ROOT}/runtime/runtime-continuity-browser-audit.json`,
    checks: 194,
    runtime: true,
    screenshots: {
      directory: `${ARTIFACT_ROOT}/runtime/screenshots`,
      names: [
        'deep-link-1.png',
        'deep-link-2.png',
        'deep-link-3.png',
        'deep-link-4.png',
        'dm-board-mobile.png',
        'teacher-resources-reset.png',
      ],
    },
  },
  {
    suite: 'depth',
    sourceAudit: 41,
    source: 'scripts/audit41-full-depth-browser.py',
    report: `${ARTIFACT_ROOT}/depth/full-depth-browser-audit.json`,
    checks: 64,
    release: 'Audit 42 full depth and rollover browser verification',
    engine: 'Chromium',
    depth: true,
    screenshots: {
      directory: `${ARTIFACT_ROOT}/depth/screenshots`,
      names: [
        'bookwormcard.png',
        'expired-event.png',
        'teacher-resources.png',
        'upcoming-event.png',
      ],
    },
  },
];

const failures = [];
const now = Date.now();

function fullPath(relative) {
  return path.join(ROOT, relative);
}

function readJson(relative) {
  try {
    return JSON.parse(fs.readFileSync(fullPath(relative), 'utf8'));
  } catch (error) {
    failures.push(`${relative} is missing or invalid JSON: ${error.message}`);
    return null;
  }
}

function sha256(relative) {
  try {
    return crypto.createHash('sha256')
      .update(fs.readFileSync(fullPath(relative)))
      .digest('hex');
  } catch (error) {
    failures.push(`${relative} cannot be hashed: ${error.message}`);
    return '';
  }
}

function validatePng(relative) {
  let payload;
  try {
    payload = fs.readFileSync(fullPath(relative));
  } catch (error) {
    failures.push(`${relative} is missing: ${error.message}`);
    return;
  }
  const signature = '89504e470d0a1a0a';
  const validSignature =
    payload.length >= 24 && payload.subarray(0, 8).toString('hex') === signature;
  const width = validSignature ? payload.readUInt32BE(16) : 0;
  const height = validSignature ? payload.readUInt32BE(20) : 0;
  if (!validSignature || payload.length < 1000 || width < 1 || height < 1) {
    failures.push(
      `${relative} is not a non-empty PNG (${payload.length} bytes, ${width}x${height})`,
    );
  }
}

const release = readJson('RELEASE_MANIFEST.json') || {};
const releaseSha = sha256('RELEASE_MANIFEST.json');
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
let combinedScreenshots = 0;
for (const expected of SUITES) {
  const report = readJson(expected.report);
  if (!report) continue;

  if (report.audit !== 42) failures.push(`${expected.report} is not Audit 42`);
  if (report.suite !== expected.suite) {
    failures.push(`${expected.report} has the wrong suite identity`);
  }
  if (report.inherited_from_audit !== expected.sourceAudit) {
    failures.push(`${expected.report} has the wrong inherited audit`);
  }
  if (report.adapter_contract !== ADAPTER_CONTRACT) {
    failures.push(`${expected.report} has the wrong adapter contract`);
  }
  if (report.release_id !== EXPECTED_RELEASE_ID) {
    failures.push(`${expected.report} belongs to the wrong release`);
  }
  if (report.generated_at !== release.generated_at) {
    failures.push(`${expected.report} does not bind the current release timestamp`);
  }
  if (report.release_manifest_sha256 !== releaseSha) {
    failures.push(`${expected.report} does not bind the current release manifest SHA`);
  }
  if (expected.release && report.release !== expected.release) {
    failures.push(`${expected.report} has the wrong release label`);
  }
  if (expected.standard && report.standard !== expected.standard) {
    failures.push(`${expected.report} has the wrong standard`);
  }
  if (expected.engine && report.engine !== expected.engine) {
    failures.push(`${expected.report} did not execute in ${expected.engine}`);
  }
  if (expected.phase && report.phase !== expected.phase) {
    failures.push(`${expected.report} is a partial ${report.phase || 'unknown'} run`);
  }

  const executedAt = Date.parse(report.executed_at || '');
  const age = now - executedAt;
  if (
    !Number.isFinite(executedAt)
    || age > MAX_EVIDENCE_AGE_MS
    || age < -MAX_CLOCK_SKEW_MS
  ) {
    failures.push(`${expected.report} is not fresh current-run evidence`);
  }
  if (
    Number.isFinite(executedAt)
    && Number.isFinite(releaseGeneratedAt)
    && executedAt + MAX_CLOCK_SKEW_MS < releaseGeneratedAt
  ) {
    failures.push(`${expected.report} predates the current release`);
  }

  const total = report.checks_total;
  if (total !== expected.checks) {
    failures.push(
      `${expected.report} has ${total || 0}/${expected.checks} exact assertions`,
    );
  } else {
    combinedChecks += total;
  }
  if (report.checks_passed !== total || report.checks_failed !== 0) {
    failures.push(`${expected.report} is not completely passing`);
  }
  if (!Array.isArray(report.results) || report.results.length !== total) {
    failures.push(`${expected.report} result rows do not match its check count`);
  } else {
    if (report.results.some(
      row => !row || row.passed !== true || !String(row.name || '').trim(),
    )) {
      failures.push(`${expected.report} contains a failed, ambiguous, or unnamed row`);
    }
    if (new Set(report.results.map(row => row.name)).size !== total) {
      failures.push(`${expected.report} contains duplicate result names`);
    }
  }

  const expectedProgram = `${ARTIFACT_ROOT}/programs/${expected.suite}.py`;
  const provenance = [
    ['source_program_path', expected.source],
    ['source_program_sha256', sha256(expected.source)],
    ['adapted_program_path', expectedProgram],
    ['adapted_program_sha256', sha256(expectedProgram)],
    ['adapter_program_path', ADAPTER_PATH],
    ['adapter_program_sha256', sha256(ADAPTER_PATH)],
  ];
  for (const [field, value] of provenance) {
    if (report[field] !== value) {
      failures.push(`${expected.report} has a stale or incorrect ${field}`);
    }
  }
  try {
    const adapted = fs.readFileSync(fullPath(expectedProgram), 'utf8');
    if (!/["']audit["']\s*:\s*42/.test(adapted)) {
      failures.push(`${expectedProgram} does not emit an Audit 42 report`);
    }
    if (adapted.toLowerCase().includes(`audit${expected.sourceAudit}`)) {
      failures.push(`${expectedProgram} retains a stale audit label`);
    }
  } catch {
    // sha256() already records the stable missing-file failure.
  }

  if (expected.runtime) {
    if (!String(report.browser || '').startsWith('Chromium')) {
      failures.push(`${expected.report} did not execute in Chromium`);
    }
    if (report.route_cases !== 24 || report.metrics?.length !== 24) {
      failures.push(`${expected.report} omits a runtime route/viewport case`);
    } else {
      const cases = new Set(
        report.metrics.map(row => `${row.route || ''}\0${row.viewport || ''}`),
      );
      if (cases.size !== 24) {
        failures.push(`${expected.report} duplicates a runtime route/viewport case`);
      }
    }
  }
  if (expected.depth) {
    if (!String(report.browser || '').startsWith('Chromium')) {
      failures.push(`${expected.report} did not execute in Chromium`);
    }
    if (report.route_cases !== 8 || report.routes?.length !== 8) {
      failures.push(`${expected.report} omits a depth route`);
    } else {
      const labels = new Set(report.routes.map(row => row.label));
      for (const label of [
        'bookwormcard',
        'teacher-resources',
        'polymythcal',
        'upcoming-event',
        'expired-event',
        'bb',
        'methodology',
        'home',
      ]) {
        if (!labels.has(label)) failures.push(`${expected.report} omits ${label}`);
      }
    }
  }

  if (expected.screenshots) {
    let actual = [];
    try {
      actual = fs.readdirSync(fullPath(expected.screenshots.directory))
        .filter(name => /\.png$/i.test(name))
        .sort();
    } catch {
      // Exact file checks below record each missing artifact.
    }
    const wanted = [...expected.screenshots.names].sort();
    if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
      failures.push(
        `${expected.screenshots.directory} screenshot set is `
          + `${actual.length}/${wanted.length} exact files`,
      );
    }
    for (const name of wanted) {
      validatePng(`${expected.screenshots.directory}/${name}`);
    }
    combinedScreenshots += actual.length;
  }
}

if (combinedChecks < 882) {
  failures.push(`combined inherited browser floor backtracked: ${combinedChecks}/882`);
}
if (combinedChecks !== 882) {
  failures.push(`combined inherited browser total is not the exact 882-row ledger`);
}
if (combinedScreenshots !== 52) {
  failures.push(`combined screenshot ledger is ${combinedScreenshots}/52`);
}

const summaryPath = `${ARTIFACT_ROOT}/run-summary.json`;
const summary = readJson(summaryPath);
if (summary) {
  if (
    summary.audit !== 42
    || summary.contract !== ADAPTER_CONTRACT
    || summary.release_id !== EXPECTED_RELEASE_ID
    || summary.generated_at !== release.generated_at
    || summary.release_manifest_sha256 !== releaseSha
    || summary.suite_count !== 7
    || summary.combined_checks !== 882
  ) {
    failures.push(`${summaryPath} does not bind the complete current release`);
  }
  const expectedSuites = SUITES.map(row => `${row.suite}\0${row.checks}`);
  const actualSuites = Array.isArray(summary.suites)
    ? summary.suites.map(row => `${row.suite}\0${row.checks}`)
    : [];
  if (JSON.stringify(actualSuites) !== JSON.stringify(expectedSuites)) {
    failures.push(`${summaryPath} has the wrong suite ledger`);
  }
  const summaryHashes = [
    ['wrapper_program_path', WRAPPER_PATH],
    ['wrapper_program_sha256', sha256(WRAPPER_PATH)],
    ['adapter_program_path', ADAPTER_PATH],
    ['adapter_program_sha256', sha256(ADAPTER_PATH)],
    ['verifier_program_path', VERIFIER_PATH],
    ['verifier_program_sha256', sha256(VERIFIER_PATH)],
  ];
  for (const [field, value] of summaryHashes) {
    if (summary[field] !== value) {
      failures.push(`${summaryPath} has a stale or incorrect ${field}`);
    }
  }
}

if (failures.length) {
  console.error('AUDIT 42 INHERITED BROWSER EVIDENCE FAILED');
  failures.forEach(failure => console.error(` - ${failure}`));
  process.exit(1);
}

console.log(
  `AUDIT 42 INHERITED BROWSER EVIDENCE PASSED — ${SUITES.length} current-release `
    + `Chromium reports contain ${combinedChecks} exact assertions and `
    + `${combinedScreenshots} SHA-bound screenshots.`,
);
