#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const RELEASE = JSON.parse(fs.readFileSync(path.join(ROOT, 'RELEASE_MANIFEST.json'), 'utf8'));
const REPORTS = [
  'data/polymythcal-audit35/interaction-design-browser-audit.json',
  'data/polymythcal-audit35/entry-pages-browser-audit.json',
  'data/polymythcal-wcag22-browser-audit.json',
  'data/audit35-route-browser/route-resilience-browser-audit.json',
  'scripts/reports/audit35-project-failure-stress.json',
];
const failures = [];
const now = Date.now();

for (const rel of REPORTS) {
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
  if (report.audit !== 35) failures.push(`${rel} is not stamped Audit 35`);
  if (report.release_id !== RELEASE.release_id) failures.push(`${rel} belongs to ${report.release_id || 'an unknown release'}`);
  const executedAt = Date.parse(report.executed_at || '');
  if (!Number.isFinite(executedAt) || Math.abs(now - executedAt) > 2 * 60 * 60 * 1000) failures.push(`${rel} was not executed during this predeploy run`);
  const total = Number(report.checks_total || 0);
  const passed = Number(report.checks_passed || 0);
  if (total < 1 || passed !== total || Number(report.checks_failed || 0) > 0) failures.push(`${rel} reports ${passed}/${total} passing checks`);
  if (Array.isArray(report.results) && report.results.some(result => !result.passed)) failures.push(`${rel} contains a failed browser assertion`);
}

if (failures.length) {
  console.error('AUDIT 35 FRESH BROWSER EVIDENCE FAILED');
  failures.forEach(failure => console.error(` - ${failure}`));
  process.exit(1);
}
console.log(`AUDIT 35 FRESH BROWSER EVIDENCE PASSED — ${REPORTS.length} current-release browser reports are fresh and complete.`);
