#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST = path.join(ROOT, 'data', 'audit41-frozen-sha256.json');
const failures = [];
let document;
try {
  document = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
} catch (error) {
  console.error(`AUDIT 41 FROZEN EVIDENCE FAILED — ${error.message}`);
  process.exit(1);
}
if (document.release_id !== '2026-07-25-site-audit41-depth-rollover-density-final') {
  failures.push('release ID changed');
}
if (document.algorithm !== 'sha256') failures.push('algorithm is not SHA-256');
if (!Array.isArray(document.files) || document.file_count !== document.files.length) {
  failures.push('file count is incoherent');
}
if ((document.files || []).length < 65) failures.push('historical inventory is incomplete');
for (const row of document.files || []) {
  const target = path.join(ROOT, row.path || '');
  let buffer;
  try {
    buffer = fs.readFileSync(target);
  } catch (error) {
    failures.push(`${row.path || 'unknown'} is missing: ${error.message}`);
    continue;
  }
  const digest = crypto.createHash('sha256').update(buffer).digest('hex');
  if (buffer.length !== row.bytes) failures.push(`${row.path} byte count changed`);
  if (digest !== row.sha256) failures.push(`${row.path} SHA-256 changed`);
}
for (const [name, expected] of Object.entries({
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
})) {
  if (document.historical_metrics?.[name] !== expected) {
    failures.push(`historical metric ${name} changed`);
  }
}
if (failures.length) {
  console.error('AUDIT 41 FROZEN EVIDENCE FAILED');
  failures.forEach(failure => console.error(` - ${failure}`));
  process.exit(1);
}
console.log(
  `AUDIT 41 FROZEN EVIDENCE PASSED — ${document.files.length} historical files remain byte-identical.`,
);
