#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST = path.join(ROOT, 'data', 'audit43-frozen-sha256.json');
const failures = [];

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

if (!fs.existsSync(MANIFEST)) {
  console.error('AUDIT 43 FROZEN EVIDENCE FAILED — manifest is missing.');
  process.exit(1);
}
const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
if (manifest.release !== 'Audit 43') failures.push('manifest release label changed');
if (manifest.release_id !== '2026-07-25-site-audit43-approved-evolution-weekly-final') {
  failures.push('manifest release ID changed');
}
if (!Array.isArray(manifest.files) || manifest.files.length < 16) {
  failures.push('manifest file set is unexpectedly small');
}
if (manifest.file_count !== manifest.files?.length) {
  failures.push('manifest file count does not match its rows');
}
for (const row of manifest.files || []) {
  const file = path.join(ROOT, row.path);
  if (!fs.existsSync(file)) {
    failures.push(`${row.path} is missing`);
    continue;
  }
  if (fs.statSync(file).size !== row.bytes) failures.push(`${row.path} byte size changed`);
  if (sha256(file) !== row.sha256) failures.push(`${row.path} SHA-256 changed`);
}
if (failures.length) {
  console.error('AUDIT 43 FROZEN EVIDENCE FAILED');
  failures.slice(0, 30).forEach(item => console.error(` - ${item}`));
  process.exit(1);
}
console.log(
  `AUDIT 43 FROZEN EVIDENCE PASSED — ${manifest.files.length} historical files remain byte-identical.`,
);
