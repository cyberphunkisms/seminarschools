#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST = path.join(ROOT, 'data', 'audit42-frozen-sha256.json');

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

if (!fs.existsSync(MANIFEST)) {
  console.error('AUDIT 42 FROZEN EVIDENCE FAILED — manifest is missing.');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const failures = [];
const nonportableBytecode = new Set([
  'scripts/__pycache__/audit42-multimode-browser.cpython-312.pyc',
  'scripts/__pycache__/run-audit42-inherited-browser-all.cpython-312.pyc',
  'scripts/__pycache__/run-audit42-inherited-browser.cpython-312.pyc',
]);
if (manifest.release !== 'Audit 42') failures.push('manifest release label changed');
if (!Array.isArray(manifest.files) || manifest.files.length < 40) {
  failures.push('manifest file set is unexpectedly small');
}
if (manifest.file_count !== manifest.files?.length) {
  failures.push('manifest file count does not match its rows');
}
const recordedBytecode = (manifest.files || []).filter(row => nonportableBytecode.has(row.path));
if (recordedBytecode.length !== nonportableBytecode.size) {
  failures.push('the known nonportable Audit 42 bytecode rows changed');
}
const portableFiles = (manifest.files || []).filter(row => !nonportableBytecode.has(row.path));
for (const row of portableFiles) {
  const file = path.join(ROOT, row.path);
  if (!fs.existsSync(file)) {
    failures.push(`${row.path} is missing`);
    continue;
  }
  if (fs.statSync(file).size !== row.bytes) failures.push(`${row.path} byte size changed`);
  if (sha256(file) !== row.sha256) failures.push(`${row.path} SHA-256 changed`);
}

if (failures.length) {
  console.error('AUDIT 42 FROZEN EVIDENCE FAILED');
  failures.slice(0, 30).forEach(item => console.error(` - ${item}`));
  process.exit(1);
}
console.log(
  `AUDIT 42 FROZEN EVIDENCE PASSED — ${portableFiles.length} portable historical files remain byte-identical; 3 packaged-out Python cache rows were ignored.`,
);
