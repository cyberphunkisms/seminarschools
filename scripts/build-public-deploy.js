#!/usr/bin/env node
'use strict';
/**
 * Build the public Netlify publish directory while keeping the full operator/source
 * repository in the same zip. The repo root stays complete; only allowlisted
 * site files are copied into /public for deployment.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  isGeneratedDependencyDirectory,
} = require('./repository-walk-policy');
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'public');
const BUILD_OUT = path.join(ROOT, '.public-build-staging');
const PREVIOUS_OUT = path.join(ROOT, '.public-build-previous');
const BUILD_LOCK = path.join(ROOT, '.public-build-lock');
const BUILD_LOCK_META = path.join(BUILD_LOCK, 'owner.json');
const BUILD_LOCK_STALE_MS = 6 * 60 * 60 * 1000;
const LEGACY_LOCK_PID_GRACE_MS = 30 * 60 * 1000;
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
  'teacherresources/submission-strategy.md'
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
let buildLockToken = null;
function readProcessIdentity(procId = 'self'){
  try {
    const stat = fs.readFileSync(`/proc/${procId}/stat`, 'utf8').trim();
    const firstSpace = stat.indexOf(' ');
    const closeParen = stat.lastIndexOf(')');
    if (firstSpace <= 0 || closeParen <= firstSpace) return null;
    const procPid = Number(stat.slice(0, firstSpace));
    // Fields after the command name begin at Linux proc-stat field 3;
    // process start time is field 22, hence index 19 in this suffix.
    const suffix = stat.slice(closeParen + 2).trim().split(/\s+/);
    const startTicks = suffix[19];
    if (!Number.isInteger(procPid) || procPid <= 0 || !/^\d+$/.test(String(startTicks || ''))) return null;
    return { proc_pid: procPid, start_ticks: String(startTicks) };
  } catch (_) { return null; }
}
function processIdentityAlive(identity){
  if (!identity || !Number.isInteger(Number(identity.proc_pid)) || !/^\d+$/.test(String(identity.start_ticks || ''))) return false;
  const current = readProcessIdentity(String(identity.proc_pid));
  return Boolean(current && current.start_ticks === String(identity.start_ticks));
}
function claimBuildLock(hostname){
  buildLockToken = `${hostname}:${process.pid}:${Date.now()}`;
  try {
    fs.writeFileSync(BUILD_LOCK_META, JSON.stringify({
      token: buildLockToken,
      hostname,
      pid: process.pid,
      process_identity: readProcessIdentity(),
      created_epoch_ms: Date.now(),
    }) + '\n', { flag: 'wx' });
  } catch (error) {
    buildLockToken = null;
    throw error;
  }
  process.once('exit', releaseBuildLock);
}
function processAlive(pid){
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; }
  catch (error) { return error.code === 'EPERM'; }
}
function acquireBuildLock(){
  const hostname = os.hostname();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      fs.mkdirSync(BUILD_LOCK);
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      let owner = {};
      try { owner = JSON.parse(fs.readFileSync(BUILD_LOCK_META, 'utf8')); }
      catch (_) { owner = {}; }
      let ageMs = 0;
      try {
        const created = Number(owner.created_epoch_ms || fs.statSync(BUILD_LOCK).mtimeMs);
        ageMs = Math.max(0, Date.now() - created);
      } catch (statError) {
        if (statError.code === 'ENOENT') continue;
        throw statError;
      }
      const sameHost = owner.hostname === hostname;
      const unknownHost = !owner.hostname;
      // Namespace-local PIDs are routinely reused across isolated Netlify and
      // Work-mode subprocesses. New locks bind the host-visible proc PID to
      // its start tick so a recycled namespace PID cannot impersonate the
      // previous owner. Legacy locks without that identity receive only a
      // bounded compatibility grace period before safe reclamation.
      const hasProcessIdentity = Boolean(owner.process_identity);
      const activeOwner = sameHost && (
        hasProcessIdentity
          ? processIdentityAlive(owner.process_identity)
          : ageMs < LEGACY_LOCK_PID_GRACE_MS && processAlive(Number(owner.pid))
      );
      // Artifact workspaces can reconcile an abandoned, metadata-free lock
      // and staging tree from an interrupted build. Quarantine that exact
      // recoverable pair; never weaken a lock with live owner metadata.
      if (
        !owner.token
        && fs.existsSync(BUILD_OUT)
      ) {
        const workspaceRoot = path.dirname(path.dirname(ROOT));
        const quarantine = fs.mkdtempSync(path.join(workspaceRoot, '.ss-public-build-abandoned-'));
        fs.renameSync(BUILD_LOCK, path.join(quarantine, 'lock'));
        fs.renameSync(BUILD_OUT, path.join(quarantine, 'staging'));
        continue;
      }
      // Some extracted artifact workspaces recreate an old empty lock
      // directory between subprocesses. Once it is safely beyond the brief
      // mkdir-to-owner-file window, claim that empty directory atomically
      // instead of treating it as a live build or deleting broad state.
      if (!owner.token && fs.readdirSync(BUILD_LOCK).length === 0 && ageMs > 2_000) {
        try {
          claimBuildLock(hostname);
          return;
        } catch (claimError) {
          if (claimError.code === 'EEXIST') continue;
          throw claimError;
        }
      }
      if (activeOwner || ((unknownHost || !sameHost) && ageMs < BUILD_LOCK_STALE_MS)) {
        throw new Error(`PUBLIC DEPLOY BUILD FAILED — another build owns ${BUILD_LOCK}`);
      }
      removeDir(BUILD_LOCK);
      continue;
    }
    claimBuildLock(hostname);
    return;
  }
  throw new Error(`PUBLIC DEPLOY BUILD FAILED — could not acquire ${BUILD_LOCK}`);
}
function releaseBuildLock(){
  if (!buildLockToken) return;
  let owner = {};
  try { owner = JSON.parse(fs.readFileSync(BUILD_LOCK_META, 'utf8')); }
  catch (_) { owner = {}; }
  if (owner.token === buildLockToken) removeDir(BUILD_LOCK);
  buildLockToken = null;
}
function prepareBuildOutput(){
  // Recover a complete prior public tree if a process was interrupted during
  // the two-rename commit, then construct this build away from the live path.
  if (fs.existsSync(PREVIOUS_OUT)) {
    if (!fs.existsSync(OUT)) fs.renameSync(PREVIOUS_OUT, OUT);
    else removeDir(PREVIOUS_OUT);
  }
  removeDir(BUILD_OUT);
  ensureDir(BUILD_OUT);
}
function commitBuildOutput(){
  let movedCurrent = false;
  if (fs.existsSync(OUT)) {
    // Reconciled artifact workspaces can recreate an empty directory skeleton
    // after prepareBuildOutput() removes it. This is the fixed transient
    // destination owned by the current build lease, so clear it again at the
    // atomic commit boundary before renaming the live tree.
    if (fs.existsSync(PREVIOUS_OUT)) removeDir(PREVIOUS_OUT);
    fs.renameSync(OUT, PREVIOUS_OUT);
    movedCurrent = true;
  }
  try {
    fs.renameSync(BUILD_OUT, OUT);
  } catch (error) {
    if (!fs.existsSync(OUT) && movedCurrent && fs.existsSync(PREVIOUS_OUT)) {
      fs.renameSync(PREVIOUS_OUT, OUT);
    }
    throw error;
  }
  if (movedCurrent) removeDir(PREVIOUS_OUT);
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
  'geometry_asset_version',
  'teacherresources_asset_versions',
  'asset_digests',
]) {
  if (Object.prototype.hasOwnProperty.call(releaseManifest, field)) {
    release[field] = releaseManifest[field];
  }
}
fs.writeFileSync(path.join(BUILD_OUT, 'site-release.json'), JSON.stringify(release, null, 2) + '\n');
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
if (preservedOutputMtime) {
  const timestamp = new Date(preservedOutputMtime);
  if (Number.isNaN(timestamp.getTime())) {
    console.error('PUBLIC DEPLOY BUILD FAILED — SS_PUBLIC_OUTPUT_MTIME is not a valid timestamp.');
    process.exit(1);
  }
  const preserve = dir => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) preserve(full);
      else if (ent.isFile()) fs.utimesSync(full, timestamp, timestamp);
    }
    fs.utimesSync(dir, timestamp, timestamp);
  };
  preserve(BUILD_OUT);
}
commitBuildOutput();
pruneBlockedArtifactsAfterCommit();
releaseBuildLock();
console.log(`PUBLIC DEPLOY BUILD PASSED — ${PUBLIC_DIRS.length} public directories copied to /public; full source remains in zip root.`);
