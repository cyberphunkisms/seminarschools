#!/usr/bin/env node
'use strict';
/**
 * Build the public Netlify publish directory while keeping the full operator/source
 * repository in the same zip. The repo root stays complete; only allowlisted
 * site files are copied into /public for deployment.
 */
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const util = require('util');
const {spawnSync} = require('child_process');
const {
  isGeneratedDependencyDirectory,
} = require('./repository-walk-policy');
const {
  PublicBuildLock,
  STAGE_MARKER_NAME,
} = require('./lib/public-build-lock');
const {
  PUBLIC_RELEASE_ASSET_PATHS,
  computeReleaseAssetIdentity,
  pickReleaseAssetIdentity,
} = require('./lib/release-asset-identity');
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'public');
const BUILD_OUT = path.join(ROOT, '.public-build-staging');
const PREVIOUS_OUT = path.join(ROOT, '.public-build-previous');
const RELEASE_LOCK_TOKEN_ENV = 'SS_RELEASE_BUILD_LOCK_TOKEN';
const RELEASE_LOCK_ROOT_ENV = 'SS_RELEASE_BUILD_LOCK_ROOT';

function delegateToReleaseBuildLockWhenNeeded(){
  const inheritedToken = process.env[RELEASE_LOCK_TOKEN_ENV];
  const inheritedRoot = process.env[RELEASE_LOCK_ROOT_ENV];
  if (inheritedToken !== undefined && inheritedRoot !== undefined) return;
  if ((inheritedToken === undefined) !== (inheritedRoot === undefined)) {
    throw new Error('PUBLIC DEPLOY BUILD FAILED — inherited release-build lock environment is incomplete');
  }
  const delegated = spawnSync(
    process.execPath,
    [
      path.join(ROOT, 'scripts', 'run-python.js'),
      path.join(ROOT, 'scripts', 'run-with-build-lock.py'),
      '--',
      process.execPath,
      __filename,
      ...process.argv.slice(2),
    ],
    {
      cwd: ROOT,
      env: process.env,
      stdio: 'inherit',
      windowsHide: true,
    },
  );
  if (delegated.error) {
    throw new Error(`PUBLIC DEPLOY BUILD FAILED — release-build lock delegation failed: ${delegated.error.message}`);
  }
  if (!Number.isInteger(delegated.status)) {
    throw new Error('PUBLIC DEPLOY BUILD FAILED — release-build lock delegation returned no exit status');
  }
  process.exit(delegated.status);
}

delegateToReleaseBuildLockWhenNeeded();
const PUBLIC_DIRS = [
  '.well-known', 'agora', 'aitr', 'aa', 'bb', 'bookwormcard', 'campaigns',
  'cfps', 'css', 'fellowships', 'florilegium', 'humanities',
  'img', 'js', 'lectures', 'leizu', 'about', 'main', 'marginalia', 'nutrition',
  'ohm-dome', 'philosophy', 'polymyth', 'polymythcal', 'polymythseminars', 'reviews', 'saul',
  'polymythcommons', 'polymythlib',
  'seminars', 'sitemap', 'teacherresources', 'university', 'writingclub',
  'writinggrads', 'writingjuniors', 'writingkids', 'writingteens'
];
const ROOT_PUBLIC_FILES = [
  '404.html', 'index.html', '_headers', '_redirects', 'robots.txt', 'sitemap.xml',
  'manifest.json', 'llms.txt', 'polymyth-file-map.txt', 'favicon.ico',
  'favicon.svg', 'apple-touch-icon.png', 'og-image.png', 'pwa-192.png',
  'pwa-512.png', 'mobile-slim.css', 'all_entries.json', 'buckets.json',
  'new_groups.json'
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
  'polymyth/research/metoo-foundational-dissent-full-archive-2026-07-28.xlsx',
  'polymyth/research/metoo-foundational-dissent-full-archive-2026-07-28.xlsx.sha256',
  'polymyth/research/metoo-foundational-dissent-research-audit-2026-07-27.xlsx',
  'polymyth/research/metoo-foundational-dissent-research-audit-2026-07-27.xlsx.sha256'
]);
const BLOCKED_DIRS = new Set(['node_modules', '.git', '.github', '.netlify', 'data', 'hf_export', 'netlify', 'scripts', 'public']);
const OPERATOR_RE = /(?:AUDIT|REPORT|PATCH|VERIFY|OUTPUT|SETUP|DEPLOY|PRIVATE|SECRET|TOKEN|DASHBOARD|CRITIQUE|SUGGESTION|HANDOFF)/i;
const WATCHLIST_REASON = Object.freeze({
  code: 'monitoring-marker',
  detail: 'Displayed date is a monitoring marker, not a confirmed event or deadline date.',
});
function canonicalEventId(event){
  if (!event || Array.isArray(event) || typeof event !== 'object') {
    throw new Error('polymythseminars/events.json contains a non-object event record');
  }
  const value = String(event.id || event.identity_key || '').trim();
  if (!value || !/^[A-Za-z0-9._~-]+$/.test(value)) {
    throw new Error(`Canonical event has an unsafe or empty id: ${JSON.stringify(value)}`);
  }
  return value;
}
function loadPublicationSurfaces(){
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
function publicationBlocklists(boundary){
  const icsIds = new Set();
  for (const id of boundary.watchlistIds) {
    const event = boundary.eventById.get(id);
    icsIds.add(id);
    for (const raw of event.legacy_ids || []) {
      const alias = String(raw || '');
      if (!alias || alias === id) continue;
      if (!/^[A-Za-z0-9._~-]+$/.test(alias)) throw new Error(`Unsafe legacy event route id: ${JSON.stringify(alias)}`);
      icsIds.add(alias);
    }
  }
  return { icsIds };
}
const PUBLICATION_BOUNDARY = loadPublicationSurfaces();
const PUBLICATION_BLOCKLISTS = publicationBlocklists(PUBLICATION_BOUNDARY);
function publicationPathBlocked(rel){
  if (rel === 'polymythseminars/events.json') return true;
  const match = rel.match(/^polymythseminars\/ics\/([^/]+)\.ics$/);
  return Boolean(match && PUBLICATION_BLOCKLISTS.icsIds.has(match[1]));
}
function posix(p){ return p.replace(/\\/g, '/'); }
function ensureDir(p){ fs.mkdirSync(p, { recursive: true }); }
function copyFile(src, dst){ ensureDir(path.dirname(dst)); fs.copyFileSync(src, dst); }
function removeDir(p){
  fs.rmSync(p, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 100,
  });
}
function authorizeEmptyOverlayRecovery(){
  const assertion = spawnSync(
    process.execPath,
    [
      path.join(ROOT, 'scripts', 'run-python.js'),
      path.join(ROOT, 'scripts', 'assert-build-lock.py'),
    ],
    {
      cwd: ROOT,
      env: process.env,
      encoding: 'utf8',
      windowsHide: true,
    },
  );
  if (assertion.error || assertion.status !== 0) {
    const detail = String(assertion.stderr || assertion.stdout || assertion.error?.message || '').trim();
    throw new Error(
      `PUBLIC DEPLOY BUILD FAILED — empty overlay recovery lacks the live release-build lease${detail ? `: ${detail}` : ''}`,
    );
  }
  return true;
}
const publicBuildLock = new PublicBuildLock({
  root: ROOT,
  buildOut: BUILD_OUT,
  previousOut: PREVIOUS_OUT,
  authorizeEmptyOverlayRecovery,
});
let activeOwner = null;
function acquireBuildLock(){
  activeOwner = publicBuildLock.acquire();
  return activeOwner;
}
function releaseBuildLock(){
  publicBuildLock.release();
  activeOwner = null;
}
function prepareBuildOutput(){
  // Unowned staging and rollback paths are ambiguous and fail closed. The
  // lock module has already quarantined the one recoverable dead-owner pair.
  publicBuildLock.assertNoUnownedTransientState();
  ensureDir(BUILD_OUT);
  publicBuildLock.bindStaging();
}
function commitBuildOutput(){
  let movedCurrent = false;
  let ownedPrevious = null;
  publicBuildLock.assertNoRollbackState();
  if (fs.existsSync(OUT)) {
    fs.renameSync(OUT, PREVIOUS_OUT);
    movedCurrent = true;
    ownedPrevious = publicBuildLock.captureOwnedRollbackState();
  }
  try {
    fs.renameSync(BUILD_OUT, OUT);
  } catch (error) {
    if (!fs.existsSync(OUT) && movedCurrent) {
      publicBuildLock.assertOwnedRollbackState(ownedPrevious);
      fs.renameSync(PREVIOUS_OUT, OUT);
    }
    throw error;
  }
  if (movedCurrent) {
    publicBuildLock.assertOwnedRollbackState(ownedPrevious);
    removeDir(PREVIOUS_OUT);
  }
}
function pruneBlockedArtifactsAfterCommit(){
  // Extracted artifact workspaces may expose an older lower-layer file again
  // when a complete directory is replaced atomically. Unlink each managed
  // blocked file from the committed tree as well so the overlay records an
  // explicit deletion instead of reviving private/stale public artifacts.
  const removeBlockedFile = rel => {
    const target = path.join(OUT, rel);
    const resolved = path.resolve(target);
    if (!resolved.startsWith(`${path.resolve(OUT)}${path.sep}`)) {
      throw new Error(`PUBLIC DEPLOY BUILD FAILED — unsafe blocked path ${rel}`);
    }
    if (!fs.existsSync(target)) return;
    const stat = fs.lstatSync(target);
    if (!stat.isFile() && !stat.isSymbolicLink()) {
      throw new Error(`PUBLIC DEPLOY BUILD FAILED — blocked path is not a file: public/${rel}`);
    }
    fs.unlinkSync(target);
  };
  for (const rel of BLOCKED_EXACT) removeBlockedFile(rel);
  const icsDir = path.join(OUT, 'polymythseminars', 'ics');
  if (!fs.existsSync(icsDir)) return;
  for (const entry of fs.readdirSync(icsDir, { withFileTypes: true })) {
    if (!entry.isFile() && !entry.isSymbolicLink()) continue;
    const rel = posix(path.join('polymythseminars', 'ics', entry.name));
    if (publicationPathBlocked(rel)) removeBlockedFile(rel);
  }
}
function shouldSkip(rel, name){
  rel = posix(rel);
  if (publicationPathBlocked(rel)) return true;
  if (BLOCKED_EXACT.has(rel)) return true;
  if (rel.startsWith('teacherresources/') && /\.md$/i.test(name)) return true;
  if (rel === 'marginalia/posts/example-review.md') return true;
  if (name.startsWith('.DS_Store')) return true;
  // Keep public polymyth/star sources intact; block generic operator files elsewhere.
  if (!rel.startsWith('polymyth/') && !rel.startsWith('aa/') && !rel.startsWith('bb/') && !rel.startsWith('bookwormcard/')) {
    if (OPERATOR_RE.test(name) && /\.(?:md|json|txt|log|csv)$/i.test(name)) return true;
  }
  return false;
}
function copyDir(srcDir, relBase=''){
  if (!fs.existsSync(srcDir)) return;
  for (const ent of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const allowPolymythlibData = relBase === 'polymythlib' && ent.name === 'data';
    if ((BLOCKED_DIRS.has(ent.name) && !allowPolymythlibData) || isGeneratedDependencyDirectory(ent.name)) continue;
    const src = path.join(srcDir, ent.name);
    const rel = posix(path.join(relBase, ent.name));
    if (ent.isDirectory()) copyDir(src, rel);
    else if (ent.isFile() && !shouldSkip(rel, ent.name)) copyFile(src, path.join(BUILD_OUT, rel));
  }
}
acquireBuildLock();
prepareBuildOutput();
for (const file of ROOT_PUBLIC_FILES) {
  const src = path.join(ROOT, file);
  if (fs.existsSync(src)) copyFile(src, path.join(BUILD_OUT, file));
}
for (const name of fs.readdirSync(ROOT)) {
  if (ROOT_PUBLIC_PATTERNS.some(re => re.test(name))) {
    const src = path.join(ROOT, name);
    if (fs.statSync(src).isFile()) copyFile(src, path.join(BUILD_OUT, name));
  }
}
for (const dir of PUBLIC_DIRS) {
  copyDir(path.join(ROOT, dir), dir);
}
// Release marker for humans checking a deployed build.
const releaseManifestPath = path.join(ROOT, 'RELEASE_MANIFEST.json');
const releaseManifest = fs.existsSync(releaseManifestPath) ? JSON.parse(fs.readFileSync(releaseManifestPath, 'utf8')) : {};
const releaseAssetIdentity = computeReleaseAssetIdentity(ROOT);
if (!util.isDeepStrictEqual(pickReleaseAssetIdentity(releaseManifest), releaseAssetIdentity)) {
  throw new Error(
    'PUBLIC DEPLOY BUILD FAILED — RELEASE_MANIFEST.json asset identity is stale; '
      + 'run node scripts/update-release-asset-identity.js after the final source generator',
  );
}
const release = {
  release_id: fs.existsSync(path.join(ROOT, 'RELEASE_ID.txt')) ? fs.readFileSync(path.join(ROOT, 'RELEASE_ID.txt'), 'utf8').trim() : 'local-dev',
  publish_dir: 'public',
  generated_at: releaseManifest.generated_at || null,
  note: 'Generated deploy surface. Full source/operator archive remains in the zip root; Netlify publishes only this directory.'
};
for (const field of [
  'base_release_id',
  'polymythcal_discovery_release_id',
  'polymythcal_discovery_built_at',
  'polymythcal_discovery_asset_version',
]) {
  if (Object.prototype.hasOwnProperty.call(releaseManifest, field)) {
    release[field] = releaseManifest[field];
  }
}
Object.assign(release, {
  'geometry_asset_version': releaseAssetIdentity.geometry_asset_version,
  'teacherresources_asset_versions': releaseAssetIdentity.teacherresources_asset_versions,
  'asset_digests': releaseAssetIdentity.asset_digests,
});
const releaseMarkerContents = JSON.stringify(release, null, 2) + '\n';
fs.writeFileSync(path.join(BUILD_OUT, 'site-release.json'), releaseMarkerContents);
// Hygiene check: the deploy dir must not contain tool/operator roots.
const failures = [];
for (const p of ['scripts', 'data', 'dashboard', 'hf_export', 'netlify', '.github', 'node_modules', '.git', '.netlify', 'package.json', 'package-lock.json', 'netlify.toml']) {
  if (fs.existsSync(path.join(BUILD_OUT, p))) failures.push(`public/${p}`);
}
const publicSitemap = path.join(BUILD_OUT, 'sitemap.xml');
if (fs.existsSync(publicSitemap) && /https:\/\/seminarschools\.com\/dashboard(?:\/|<)/.test(fs.readFileSync(publicSitemap, 'utf8'))) {
  failures.push('public/sitemap.xml advertises the local-only /dashboard/ route');
}
function walkCheck(dir){
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    const rel = posix(path.relative(BUILD_OUT, full));
    if (rel === STAGE_MARKER_NAME) continue;
    if (ent.isDirectory()) walkCheck(full);
    else if (ent.isFile() && !rel.startsWith('polymyth/') && !rel.startsWith('aa/') && !rel.startsWith('bb/') && !rel.startsWith('bookwormcard/')) {
      if (OPERATOR_RE.test(ent.name) && /\.(?:md|json|txt|log|csv)$/i.test(ent.name)) failures.push(`public/${rel}`);
    }
  }
}
walkCheck(BUILD_OUT);
if (failures.length) {
  console.error('PUBLIC DEPLOY BUILD FAILED — operator artifacts reached publish dir:');
  failures.forEach(f => console.error(' - ' + f));
  process.exit(1);
}
// Some artifact workspaces reconcile extracted files by mtime after each tool
// boundary. Let release tooling preserve a just-built public tree until it is
// verified and packaged, without changing normal local or Netlify builds.
const preservedOutputMtime = process.env.SS_PUBLIC_OUTPUT_MTIME;
let preservedOutputTimestamp = null;
if (preservedOutputMtime) {
  preservedOutputTimestamp = new Date(preservedOutputMtime);
  if (Number.isNaN(preservedOutputTimestamp.getTime())) {
    console.error('PUBLIC DEPLOY BUILD FAILED — SS_PUBLIC_OUTPUT_MTIME is not a valid timestamp.');
    process.exit(1);
  }
  const preserve = dir => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) preserve(full);
      else if (ent.isFile()) fs.utimesSync(full, preservedOutputTimestamp, preservedOutputTimestamp);
    }
    fs.utimesSync(dir, preservedOutputTimestamp, preservedOutputTimestamp);
  };
  preserve(BUILD_OUT);
}
const priorPublicMtimeByRelative = new Map();
function capturePriorPublicMtimes(){
  if (!fs.existsSync(OUT)) return;
  const visit = (directory, prefix = '') => {
    for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
      const target = path.join(directory, entry.name);
      const relative = posix(path.join(prefix, entry.name));
      if (entry.isDirectory()) visit(target, relative);
      else if (entry.isFile()) {
        priorPublicMtimeByRelative.set(relative, fs.statSync(target).mtimeMs);
      }
    }
  };
  visit(OUT);
}
function durableOutputTimestamp(sourcePath, publicRelative){
  if (!preservedOutputTimestamp) return null;
  // Never make a newly committed mirror older than its canonical source.
  // Otherwise an extracted workspace can resurrect an older lower-layer file
  // whose mtime is newer than the fixed release timestamp.
  const priorMtime = priorPublicMtimeByRelative.get(publicRelative) || 0;
  return new Date(Math.max(
    preservedOutputTimestamp.getTime(),
    fs.statSync(sourcePath).mtimeMs,
    priorMtime + 1000,
  ));
}
function writeCommittedReleaseMarker(){
  // public/ is committed by an atomic directory rename. Some extracted
  // artifact workspaces can expose the older lower-layer marker again at the
  // next process boundary unless the generated file is also replaced at its
  // final live path. The source manifest remains owned by the identity
  // updater; this post-commit write owns only the derived public marker.
  const markerPath = path.join(OUT, 'site-release.json');
  const temporary = `${markerPath}.tmp-${process.pid}`;
  const markerTimestamp = durableOutputTimestamp(releaseManifestPath, 'site-release.json');
  try {
    fs.writeFileSync(temporary, releaseMarkerContents, {encoding: 'utf8', flag: 'wx'});
    if (markerTimestamp) {
      fs.utimesSync(temporary, markerTimestamp, markerTimestamp);
    }
    fs.renameSync(temporary, markerPath);
    if (markerTimestamp) {
      fs.utimesSync(OUT, markerTimestamp, markerTimestamp);
    }
  } finally {
    try { fs.rmSync(temporary, {force: true}); } catch (_) { /* best effort */ }
  }
  if (fs.readFileSync(markerPath, 'utf8') !== releaseMarkerContents) {
    throw new Error('PUBLIC DEPLOY BUILD FAILED — committed public/site-release.json failed exact readback');
  }
}
function writeCommittedReleaseAssets(){
  // The atomic public/ directory swap is not, by itself, durable in extracted
  // overlay workspaces: an older lower-layer file can reappear at a later
  // process boundary. Replace every governed runtime mirror at its final live
  // path while the public-build and release-build locks are still held.
  for (const [sourceRelative, publicRelative] of Object.entries(PUBLIC_RELEASE_ASSET_PATHS)) {
    if (!publicRelative) continue;
    const sourcePath = path.join(ROOT, sourceRelative);
    const targetPath = path.join(OUT, publicRelative);
    const temporary = `${targetPath}.tmp-${process.pid}`;
    const contents = fs.readFileSync(sourcePath);
    const assetTimestamp = durableOutputTimestamp(sourcePath, publicRelative);
    try {
      fs.writeFileSync(temporary, contents, {flag: 'wx'});
      if (assetTimestamp) {
        fs.utimesSync(temporary, assetTimestamp, assetTimestamp);
      }
      fs.renameSync(temporary, targetPath);
    } finally {
      try { fs.rmSync(temporary, {force: true}); } catch (_) { /* best effort */ }
    }
    if (!fs.readFileSync(targetPath).equals(contents)) {
      throw new Error(`PUBLIC DEPLOY BUILD FAILED — committed public/${publicRelative} failed exact readback`);
    }
  }
}
function fileSha256(file){
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
function snapshotCommittedPublicTree(){
  // Freeze the intended file set while the short public-build lock is still
  // held. The later durability pass must not enumerate the live tree:
  // overlay-backed atomic replacements can briefly expose hidden sibling
  // files after that lock is released.
  const files = [];
  const visit = (directory, prefix = '') => {
    for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
      const target = path.join(directory, entry.name);
      const relative = posix(path.join(prefix, entry.name));
      if (entry.isDirectory()) {
        visit(target, relative);
        continue;
      }
      if (!entry.isFile()) {
        throw new Error(`PUBLIC DEPLOY BUILD FAILED — committed public path is not a regular file: ${relative}`);
      }
      files.push({relative, sha256: fileSha256(target)});
    }
  };
  visit(OUT);
  return files.sort((left, right) => left.relative.localeCompare(right.relative));
}
function writeCommittedPublicTree(committedFiles){
  // An atomic directory replacement is sufficient on ordinary filesystems,
  // but extracted artifact workspaces can restore the lower-layer directory
  // after a child verifier exits. Materialize each committed file at its final
  // path so the complete deploy tree survives subsequent process boundaries.
  // Iterate only the file set captured under the public-build lock so a
  // post-release atomic shadow cannot enter this pass.
  let sequence = 0;
  for (const expected of committedFiles) {
    const {relative} = expected;
    const target = path.join(OUT, ...relative.split('/'));
    const resolved = path.resolve(target);
    if (!resolved.startsWith(`${path.resolve(OUT)}${path.sep}`)) {
      throw new Error(`PUBLIC DEPLOY BUILD FAILED — unsafe committed public path: ${relative}`);
    }
    const stat = fs.lstatSync(target);
    if (!stat.isFile()) {
      throw new Error(`PUBLIC DEPLOY BUILD FAILED — committed public path is no longer a regular file: ${relative}`);
    }
    const contents = fs.readFileSync(target);
    const actualSha256 = crypto.createHash('sha256').update(contents).digest('hex');
    if (actualSha256 !== expected.sha256) {
      throw new Error(`PUBLIC DEPLOY BUILD FAILED — committed public/${relative} changed after the locked snapshot`);
    }
    const temporary = `${target}.tmp-durable-${process.pid}-${sequence++}`;
    const timestamp = durableOutputTimestamp(target, relative);
    try {
      fs.writeFileSync(temporary, contents, {flag: 'wx'});
      if (timestamp) fs.utimesSync(temporary, timestamp, timestamp);
      fs.renameSync(temporary, target);
    } finally {
      try { fs.rmSync(temporary, {force: true}); } catch (_) { /* best effort */ }
    }
    if (!fs.readFileSync(target).equals(contents)) {
      throw new Error(`PUBLIC DEPLOY BUILD FAILED — committed public/${relative} failed durable readback`);
    }
  }
}
capturePriorPublicMtimes();
publicBuildLock.unbindStaging();
try {
  commitBuildOutput();
} catch (error) {
  // If the atomic rename fails before staging becomes public, restore the
  // exact owner marker so exit cleanup can remove only this build's tree.
  if (fs.existsSync(BUILD_OUT)) publicBuildLock.bindStaging();
  throw error;
}
pruneBlockedArtifactsAfterCommit();
writeCommittedReleaseAssets();
writeCommittedReleaseMarker();
const committedPublicFiles = snapshotCommittedPublicTree();
// Acquisition already proved the live outer release-build lease. Capture that
// fact while this exact short-lock owner still exists. A fresh child-process
// probe after release can replay an extracted lower-layer public tree before
// the durability pass has replaced its files at their final paths.
const durabilityPassAuthorized = publicBuildLock.assertCurrentAcquisitionHasAuthorizedRecovery();
releaseBuildLock();
// The repository-wide release lock still excludes every competing writer.
// Release the short-lived public swap lock before the full durability pass so
// an extracted workspace cannot revive an empty staging skeleton mid-cleanup.
if (durabilityPassAuthorized !== true) {
  throw new Error('PUBLIC DEPLOY BUILD FAILED — durability pass lacks captured release-build authorization');
}
writeCommittedPublicTree(committedPublicFiles);
console.log(`PUBLIC DEPLOY BUILD PASSED — ${PUBLIC_DIRS.length} public directories copied to /public; full source remains in zip root.`);
