#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const fixed = [
  'WEBSITE_AUDIT43_APPROVED_EVOLUTION_REPORT_2026-07-25.md',
  'data/audit43-continuity-inventory.json',
  'scripts/apply-audit43-release-stamp.js',
  'scripts/apply-audit43-approved-ui.js',
  'scripts/build-audit43-continuity-inventory.js',
  'scripts/verify-audit43-approved-direction.js',
  'scripts/test_polymythcal_audit43.py',
  'scripts/audit43-approved-browser.py',
  'scripts/verify-audit43-browser-evidence.js',
];

function walk(relative) {
  const full = path.join(ROOT, relative);
  const results = [];
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    const child = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) results.push(...walk(child));
    else if (entry.isFile()) results.push(child);
  }
  return results;
}

const files = [...fixed, ...walk('data/audit43-browser')]
  .sort()
  .map(relative => {
    const full = path.join(ROOT, relative);
    if (!fs.existsSync(full)) throw new Error(`Cannot freeze missing file: ${relative}`);
    return {
      path: relative,
      bytes: fs.statSync(full).size,
      sha256: crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex'),
    };
  });
const manifest = {
  schema: 'seminar-schools-frozen-release-evidence-v1',
  release: 'Audit 43',
  release_id: '2026-07-25-site-audit43-approved-evolution-weekly-final',
  generated_at: '2026-07-25T14:18:38-04:00',
  rule: 'Every listed byte is historical evidence and must remain unchanged in Audit 45 and later releases.',
  file_count: files.length,
  files,
};
fs.writeFileSync(
  path.join(ROOT, 'data', 'audit43-frozen-sha256.json'),
  JSON.stringify(manifest, null, 2) + '\n',
);
console.log(`AUDIT 43 FREEZE MANIFEST BUILT — ${files.length} files SHA-256 locked.`);
