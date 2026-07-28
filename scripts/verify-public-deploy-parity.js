#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const PUBLIC_DIRS = [
  '.well-known', 'agora', 'aitr', 'aa', 'bb', 'bookwormcard', 'campaigns',
  'cfps', 'css', 'fellowships', 'florilegium', 'humanities', 'img', 'js',
  'lectures', 'leizu', 'about', 'main', 'marginalia', 'nutrition', 'ohm-dome',
  'philosophy', 'polymyth', 'polymythcal', 'polymythseminars', 'reviews',
  'polymythcommons', 'polymythlib', 'saul', 'seminars', 'sitemap', 'teacherresources', 'university',
  'writingclub', 'writinggrads', 'writingjuniors', 'writingkids', 'writingteens',
];
const ROOT_PUBLIC_FILES = [
  '404.html', 'index.html', '_headers', '_redirects', 'robots.txt', 'sitemap.xml',
  'manifest.json', 'llms.txt', 'polymyth-file-map.txt', 'favicon.ico',
  'favicon.svg', 'apple-touch-icon.png', 'og-image.png', 'pwa-192.png',
  'pwa-512.png', 'mobile-slim.css', 'all_entries.json', 'buckets.json',
  'new_groups.json',
];
const ROOT_PUBLIC_PATTERNS = [/^google.*\.html$/i, /^fb[a-f0-9]+\.txt$/i];
const BLOCKED_EXACT = new Set([
  'leizu/LEIZU-PIPELINE-SETUP.md',
  'leizu/STRIPE-SETUP.md',
  'teacherresources/audit-batch-01.json',
  'teacherresources/audit-methodology.md',
  'teacherresources/resources-data.json',
  'teacherresources/submission-strategy.md',
]);
const BLOCKED_DIRS = new Set([
  'node_modules', '.git', '.github', '.netlify', 'data', 'hf_export',
  'netlify', 'scripts', 'public',
]);
const OPERATOR_RE = /(?:AUDIT|REPORT|PATCH|VERIFY|OUTPUT|SETUP|DEPLOY|PRIVATE|SECRET|TOKEN|DASHBOARD|CRITIQUE|SUGGESTION|HANDOFF)/i;
const failures = [];
const expected = new Set();

function posix(value) {
  return value.replace(/\\/g, '/');
}

function digest(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function shouldSkip(rel, name) {
  if (BLOCKED_EXACT.has(rel)) return true;
  if (rel.startsWith('teacherresources/') && /\.md$/i.test(name)) return true;
  if (rel === 'marginalia/posts/example-review.md') return true;
  if (name.startsWith('.DS_Store')) return true;
  if (!rel.startsWith('polymyth/') && !rel.startsWith('aa/') && !rel.startsWith('bb/') && !rel.startsWith('bookwormcard/')) {
    if (OPERATOR_RE.test(name) && /\.(?:md|json|txt|log|csv)$/i.test(name)) return true;
  }
  return false;
}

function collectExpected(dir, relBase = '') {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const allowPolymythlibData = relBase === 'polymythlib' && entry.name === 'data';
    if (BLOCKED_DIRS.has(entry.name) && !allowPolymythlibData) continue;
    const full = path.join(dir, entry.name);
    const rel = posix(path.join(relBase, entry.name));
    if (entry.isDirectory()) collectExpected(full, rel);
    else if (entry.isFile() && !shouldSkip(rel, entry.name)) expected.add(rel);
  }
}

function collectFiles(dir, base, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectFiles(full, base, out);
    else if (entry.isFile()) out.push(posix(path.relative(base, full)));
  }
  return out;
}

if (!fs.existsSync(PUBLIC)) {
  console.error('PUBLIC DEPLOY PARITY FAILED\n - public/ is missing; run npm run build first.');
  process.exit(1);
}

for (const rel of ROOT_PUBLIC_FILES) {
  if (fs.existsSync(path.join(ROOT, rel))) expected.add(rel);
}
for (const name of fs.readdirSync(ROOT)) {
  if (
    ROOT_PUBLIC_PATTERNS.some(pattern => pattern.test(name))
    && fs.statSync(path.join(ROOT, name)).isFile()
  ) {
    expected.add(name);
  }
}
for (const dir of PUBLIC_DIRS) collectExpected(path.join(ROOT, dir), dir);

for (const rel of expected) {
  const source = path.join(ROOT, rel);
  const published = path.join(PUBLIC, rel);
  if (!fs.existsSync(published)) {
    failures.push(`public/${rel} is missing`);
  } else if (
    fs.statSync(source).size !== fs.statSync(published).size
    || digest(source) !== digest(published)
  ) {
    failures.push(`public/${rel} differs from ${rel}`);
  }
}

const actual = collectFiles(PUBLIC, PUBLIC);
for (const rel of actual) {
  if (rel === 'site-release.json') continue;
  if (!expected.has(rel)) failures.push(`public/${rel} is outside the deploy allowlist`);
}

let marker = {};
try {
  marker = JSON.parse(fs.readFileSync(path.join(PUBLIC, 'site-release.json'), 'utf8'));
} catch (error) {
  failures.push(`public/site-release.json is missing or invalid: ${error.message}`);
}
const releaseId = fs.readFileSync(path.join(ROOT, 'RELEASE_ID.txt'), 'utf8').trim();
if (marker.release_id !== releaseId) {
  failures.push('public/site-release.json does not match RELEASE_ID.txt');
}
if (expected.size < 100) failures.push(`deploy surface is unexpectedly small: ${expected.size} source files`);

if (failures.length) {
  console.error('PUBLIC DEPLOY PARITY FAILED');
  for (const failure of failures.slice(0, 50)) console.error(` - ${failure}`);
  if (failures.length > 50) console.error(` - ...and ${failures.length - 50} more`);
  process.exit(1);
}

console.log(
  `PUBLIC DEPLOY PARITY PASSED — ${expected.size} allowlisted files are complete, byte-identical, and free of stale public-only files.`,
);
