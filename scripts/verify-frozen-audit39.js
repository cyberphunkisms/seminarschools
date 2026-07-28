#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(ROOT, 'data', 'audit39-frozen-sha256.json');
const EXPECTED_RELEASE =
  '2026-07-24-site-audit39-discovery-continuity-route-resilience-final';
const EXPECTED_METRICS = Object.freeze({
  polymythcal_events: 838,
  polymythcal_types: 32,
  registered_sources: 422,
  event_aliases: 842,
  teacher_resources: 644,
  teacher_collections: 25,
  teacher_groups: 7,
  methodology_entries: 1139,
  polymythcal_page_size: 24,
  portable_release_checks: 132,
  public_parity_files: 3550,
  package_members: 7802,
});
const failures = [];

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
} catch (error) {
  console.error(`AUDIT 39 FROZEN EVIDENCE FAILED — ${error.message}`);
  process.exit(1);
}

if (manifest.release_id !== EXPECTED_RELEASE) {
  failures.push(`frozen release is ${manifest.release_id || 'missing'}`);
}
if (manifest.algorithm !== 'sha256') failures.push('frozen algorithm is not SHA-256');
if (manifest.file_count !== 14 || manifest.files?.length !== 14) {
  failures.push('frozen file inventory is not 14 entries');
}
for (const [name, expected] of Object.entries(EXPECTED_METRICS)) {
  if (manifest.historical_metrics?.[name] !== expected) {
    failures.push(`historical metric ${name} changed`);
  }
}

const seen = new Set();
for (const row of manifest.files || []) {
  if (!row?.path || seen.has(row.path)) {
    failures.push(`invalid or duplicate frozen path: ${row?.path || 'missing'}`);
    continue;
  }
  seen.add(row.path);
  const target = path.join(ROOT, row.path);
  try {
    const stat = fs.statSync(target);
    if (!stat.isFile()) failures.push(`${row.path} is no longer a file`);
    if (stat.size !== row.bytes) failures.push(`${row.path} size changed`);
    if (sha256(target) !== row.sha256) failures.push(`${row.path} SHA-256 changed`);
  } catch {
    failures.push(`${row.path} is missing or unreadable`);
  }
}

if (failures.length) {
  console.error('AUDIT 39 FROZEN EVIDENCE FAILED');
  failures.forEach(failure => console.error(` - ${failure}`));
  process.exit(1);
}

console.log(
  'AUDIT 39 FROZEN EVIDENCE PASSED — 14 report/gate files remain byte-identical; '
    + '838/32/422, 842 aliases, 644/25/7, 1,139, 24, 132, 3,550, and 7,802 '
    + 'remain historical baselines rather than live ceilings.',
);
