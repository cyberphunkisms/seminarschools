#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(ROOT, 'data', 'audit40-frozen-sha256.json');
const failures = [];

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
} catch (error) {
  console.error(`AUDIT 40 FROZEN EVIDENCE FAILED — ${error.message}`);
  process.exit(1);
}

if (manifest.release_id !== '2026-07-24-site-audit40-browser-runtime-continuity-final') {
  failures.push('frozen manifest identifies the wrong release');
}
if (manifest.algorithm !== 'sha256') failures.push('manifest algorithm is not SHA-256');
if (!Array.isArray(manifest.files) || manifest.file_count !== manifest.files.length) {
  failures.push('manifest file count is incoherent');
}
if ((manifest.files || []).length < 50) failures.push('frozen inventory is incomplete');

for (const row of manifest.files || []) {
  const target = path.join(ROOT, row.path || '');
  let buffer;
  try {
    buffer = fs.readFileSync(target);
  } catch (error) {
    failures.push(`${row.path || 'unknown file'} is missing: ${error.message}`);
    continue;
  }
  if (buffer.length !== row.bytes) failures.push(`${row.path} byte count changed`);
  if (sha256(buffer) !== row.sha256) failures.push(`${row.path} SHA-256 changed`);
}

const expectedMetrics = {
  polymythcal_events: 838,
  polymythcal_types: 32,
  registered_sources: 422,
  event_aliases: 842,
  teacher_resources: 644,
  teacher_collections: 25,
  teacher_groups: 7,
  methodology_entries: 1139,
  polymythcal_page_size: 24,
  portable_release_checks: 135,
  public_parity_files: 3550,
  package_members: 7910,
  browser_assertions: 818,
  runtime_route_cases: 24,
};
for (const [key, value] of Object.entries(expectedMetrics)) {
  if (manifest.historical_metrics?.[key] !== value) {
    failures.push(`historical metric ${key} changed`);
  }
}

if (failures.length) {
  console.error('AUDIT 40 FROZEN EVIDENCE FAILED');
  failures.forEach(failure => console.error(` - ${failure}`));
  process.exit(1);
}

console.log(
  `AUDIT 40 FROZEN EVIDENCE PASSED — ${manifest.files.length} report, gate, `
    + 'browser-result, and screenshot files remain byte-identical.',
);
