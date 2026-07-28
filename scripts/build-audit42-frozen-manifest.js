#!/usr/bin/env node
'use strict';

/**
 * One-time Audit 43 migration helper.
 *
 * Audit 42's reports, source gates, browser evidence, screenshots, and
 * maintenance inventories become immutable historical evidence before the
 * active release contracts move forward. The generated manifest deliberately
 * excludes this helper, its verifier, and the manifest itself.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT = path.join(ROOT, 'data', 'audit42-frozen-sha256.json');
const EXCLUDED = new Set([
  'data/audit42-frozen-sha256.json',
  'scripts/build-audit42-frozen-manifest.js',
  'scripts/verify-frozen-audit42.js',
]);

function posix(value) {
  return value.replace(/\\/g, '/');
}

function isAudit42Evidence(relative) {
  if (EXCLUDED.has(relative)) return false;
  return /^(?:WEBSITE|POLYMYTHCAL).*AUDIT42(?:[^0-9]|$)/i.test(relative)
    || /^data\/(?:polymythcal-)?audit42(?:[-/]|$)/i.test(relative)
    || /^scripts\/.*audit42(?:[-_.]|$)/i.test(relative);
}

function walk(directory, rows = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (['.git', '.netlify', '__pycache__', 'node_modules', 'public'].includes(entry.name)) continue;
    const full = path.join(directory, entry.name);
    const relative = posix(path.relative(ROOT, full));
    if (entry.isDirectory()) {
      walk(full, rows);
    } else if (entry.isFile() && isAudit42Evidence(relative)) {
      rows.push(relative);
    }
  }
  return rows;
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

if (fs.existsSync(OUTPUT) && !process.argv.includes('--force')) {
  throw new Error(
    'Audit 42 is already frozen. Refusing to regenerate historical hashes without --force.',
  );
}

const files = walk(ROOT)
  .sort()
  .map(relative => ({
    path: relative,
    bytes: fs.statSync(path.join(ROOT, relative)).size,
    sha256: sha256(path.join(ROOT, relative)),
  }));

if (files.length < 40) {
  throw new Error(`Audit 42 evidence set is unexpectedly small (${files.length} files).`);
}

const manifest = {
  schema: 'seminar-schools-frozen-release-evidence-v1',
  release: 'Audit 42',
  release_id: fs.readFileSync(path.join(ROOT, 'RELEASE_ID.txt'), 'utf8').trim(),
  generated_at: JSON.parse(
    fs.readFileSync(path.join(ROOT, 'RELEASE_MANIFEST.json'), 'utf8'),
  ).generated_at,
  rule: 'Every listed byte is historical evidence and must remain unchanged in Audit 43 and later releases.',
  file_count: files.length,
  files,
};

fs.writeFileSync(OUTPUT, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`AUDIT 42 FROZEN MANIFEST WRITTEN — ${files.length} evidence files locked.`);
