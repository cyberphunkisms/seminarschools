#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT = path.join(ROOT, 'data', 'audit41-frozen-sha256.json');
const exact = [
  'POLYMYTHCAL_WCAG22_AA_AUDIT41_2026-07-25.md',
  'WEBSITE_AUDIT41_DEPTH_ROLLOVER_DENSITY_REPORT_2026-07-25.md',
  'scripts/apply-audit41-release-stamp.js',
  'scripts/audit41-browser-runtime.py',
  'scripts/audit41-full-depth-browser.py',
  'scripts/run-audit41-browser.py',
  'scripts/verify-audit41-browser-evidence.js',
  'scripts/verify-audit41-content-structure.js',
  'scripts/verify-audit41-event-rollover.js',
  'scripts/verify-audit41-evolution.js',
  'scripts/verify-audit41-runtime-efficiency.js',
  'scripts/verify-audit41-teacher-density.js',
  'scripts/reports/audit41-project-failure-stress.json',
];
const directories = [
  'data/audit41-browser',
  'data/audit41-depth-browser',
  'data/audit41-route-browser',
  'data/polymythcal-audit41',
];

function walk(relativeDirectory) {
  const found = [];
  const pending = [path.join(ROOT, relativeDirectory)];
  while (pending.length) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(target);
      else if (entry.isFile()) {
        found.push(path.relative(ROOT, target).replace(/\\/g, '/'));
      }
    }
  }
  return found;
}

function row(relative) {
  const buffer = fs.readFileSync(path.join(ROOT, relative));
  return {
    path: relative,
    bytes: buffer.length,
    sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
  };
}

const files = [
  ...exact,
  ...directories.flatMap(walk),
].filter((value, index, array) => array.indexOf(value) === index).sort();
for (const relative of files) {
  if (!fs.existsSync(path.join(ROOT, relative))) {
    throw new Error(`Audit 41 evidence is missing: ${relative}`);
  }
}
const document = {
  schema: 'seminar-schools-frozen-audit-evidence-v1',
  algorithm: 'sha256',
  release_id: '2026-07-25-site-audit41-depth-rollover-density-final',
  asset_version: '20260725-audit41',
  file_count: files.length,
  historical_metrics: {
    polymythcal_events: 838,
    polymythcal_types: 32,
    registered_sources: 422,
    event_aliases: 842,
    teacher_resources: 644,
    teacher_collections: 25,
    teacher_groups: 7,
    methodology_entries: 1139,
    polymythcal_page_size: 24,
    portable_release_checks: 138,
    public_parity_files: 3551,
    package_files: 7982,
    browser_assertions: 882,
    browser_screenshots: 52,
  },
  files: files.map(row),
};
fs.writeFileSync(OUTPUT, `${JSON.stringify(document, null, 2)}\n`);
console.log(
  `AUDIT 41 FROZEN MANIFEST WRITTEN — ${files.length} historical evidence files.`,
);
