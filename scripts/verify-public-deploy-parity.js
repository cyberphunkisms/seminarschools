#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  isGeneratedDependencyDirectory,
} = require('./repository-walk-policy');

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
  'polymythseminars/events.json',
  // Source-history only: every public Polymythcal surface uses Discovery v2.
  'js/polymythcal-revamp.js',
  'css/polymythcal-revamp.css',
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
const WATCHLIST_REASON = Object.freeze({
  code: 'monitoring-marker',
  detail: 'Displayed date is a monitoring marker, not a confirmed event or deadline date.',
});

function canonicalEventId(event) {
  if (!event || Array.isArray(event) || typeof event !== 'object') {
    throw new Error('polymythseminars/events.json contains a non-object event record');
  }
  const value = String(event.id || event.identity_key || '').trim();
  if (!value || !/^[A-Za-z0-9._~-]+$/.test(value)) {
    throw new Error(`Canonical event has an unsafe or empty id: ${JSON.stringify(value)}`);
  }
  return value;
}

function loadPublicationSurfaces() {
  const canonicalPath = path.join(ROOT, 'polymythseminars', 'events.json');
  const surfacesPath = path.join(ROOT, 'data', 'polymythcal-publication-surfaces.json');
  let canonical;
  let surface;
  try { canonical = JSON.parse(fs.readFileSync(canonicalPath, 'utf8')); }
  catch (error) { throw new Error(`Cannot read canonical Polymythcal data: ${error.message}`); }
  try { surface = JSON.parse(fs.readFileSync(surfacesPath, 'utf8')); }
  catch (error) { throw new Error(`Cannot read publication surface contract: ${error.message}`); }
  if (!canonical || !Array.isArray(canonical.events)) {
    throw new Error('polymythseminars/events.json events must be an array');
  }
  if (!surface || Array.isArray(surface) || typeof surface !== 'object') {
    throw new Error('Publication surface contract must be a JSON object');
  }
  if (surface._schema !== 'polymythcal-publication-surfaces-v2') {
    throw new Error('Publication surface contract must use polymythcal-publication-surfaces-v2');
  }
  const eventById = new Map();
  for (const event of canonical.events) {
    const id = canonicalEventId(event);
    if (eventById.has(id)) throw new Error(`Duplicate canonical event id: ${id}`);
    eventById.set(id, event);
  }
  const readIds = name => {
    const values = surface[name];
    if (!Array.isArray(values) || values.some(value => typeof value !== 'string' || !value || value.trim() !== value)) {
      throw new Error(`Publication surface ${name} must be an array of non-empty canonical id strings`);
    }
    const ids = new Set(values);
    if (ids.size !== values.length) throw new Error(`Publication surface ${name} contains duplicate ids`);
    return ids;
  };
  const chronologyIds = readIds('chronology_ids');
  const watchlistIds = readIds('watchlist_ids');
  const overlap = [...chronologyIds].filter(id => watchlistIds.has(id));
  if (overlap.length) throw new Error(`Publication surfaces overlap: ${overlap.slice(0, 10).join(', ')}`);
  const union = new Set([...chronologyIds, ...watchlistIds]);
  const missing = [...eventById.keys()].filter(id => !union.has(id));
  const extra = [...union].filter(id => !eventById.has(id));
  if (missing.length || extra.length) {
    throw new Error(`Publication surfaces do not partition canonical ids; missing=${missing.slice(0, 10).join(', ')}, extra=${extra.slice(0, 10).join(', ')}`);
  }
  const reasons = surface.reasons;
  if (!reasons || Array.isArray(reasons) || typeof reasons !== 'object') {
    throw new Error('Publication surface reasons must be an object keyed exactly by every watchlist id');
  }
  const reasonKeys = Object.keys(reasons);
  if (reasonKeys.length !== watchlistIds.size || reasonKeys.some(id => !watchlistIds.has(id))) {
    throw new Error('Publication surface reasons must be an object keyed exactly by every watchlist id');
  }
  for (const id of watchlistIds) {
    const reason = reasons[id];
    if (
      !reason || Array.isArray(reason) || typeof reason !== 'object'
      || Object.keys(reason).sort().join(',') !== 'code,detail'
      || reason.code !== WATCHLIST_REASON.code
      || reason.detail !== WATCHLIST_REASON.detail
    ) throw new Error(`Invalid watchlist monitoring-marker reason for ${id}`);
  }
  return { eventById, chronologyIds, watchlistIds };
}

function publicationBlocklists(boundary) {
  const icsIds = new Set();
  for (const id of boundary.watchlistIds) {
    const event = boundary.eventById.get(id);
    icsIds.add(id);
    for (const raw of event.legacy_ids || []) {
      const alias = String(raw || '');
      if (!alias || alias === id) continue;
      if (!/^[A-Za-z0-9._~-]+$/.test(alias)) {
        throw new Error(`Unsafe legacy event route id: ${JSON.stringify(alias)}`);
      }
      icsIds.add(alias);
    }
  }
  return { icsIds };
}

const PUBLICATION_BOUNDARY = loadPublicationSurfaces();
const PUBLICATION_BLOCKLISTS = publicationBlocklists(PUBLICATION_BOUNDARY);

function publicationPathBlocked(rel) {
  if (rel === 'polymythseminars/events.json') return true;
  const match = rel.match(/^polymythseminars\/ics\/([^/]+)\.ics$/);
  return Boolean(match && PUBLICATION_BLOCKLISTS.icsIds.has(match[1]));
}

function posix(value) {
  return value.replace(/\\/g, '/');
}

function digest(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function shouldSkip(rel, name) {
  rel = posix(rel);
  if (publicationPathBlocked(rel)) return true;
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
    if (
      (BLOCKED_DIRS.has(entry.name) && !allowPolymythlibData)
      || isGeneratedDependencyDirectory(entry.name)
    ) continue;
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
    if (entry.isDirectory() && !isGeneratedDependencyDirectory(entry.name)) {
      collectFiles(full, base, out);
    }
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

if (fs.existsSync(path.join(PUBLIC, 'polymythseminars', 'events.json'))) {
  failures.push('public/polymythseminars/events.json exposes the canonical internal corpus');
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
