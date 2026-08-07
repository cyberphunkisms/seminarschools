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
  'leizu/LEIZU-PIPELINE-SETUP.md',
  'leizu/STRIPE-SETUP.md',
  'teacherresources/audit-batch-01.json',
  'teacherresources/audit-methodology.md',
  'teacherresources/resources-data.json',
  'teacherresources/submission-strategy.md'
]);
const BLOCKED_DIRS = new Set(['node_modules', '.git', '.github', '.netlify', 'data', 'hf_export', 'netlify', 'scripts', 'public']);
const OPERATOR_RE = /(?:AUDIT|REPORT|PATCH|VERIFY|OUTPUT|SETUP|DEPLOY|PRIVATE|SECRET|TOKEN|DASHBOARD|CRITIQUE|SUGGESTION|HANDOFF)/i;
function posix(p){ return p.replace(/\\/g, '/'); }
function ensureDir(p){ fs.mkdirSync(p, { recursive: true }); }
function copyFile(src, dst){ ensureDir(path.dirname(dst)); fs.copyFileSync(src, dst); }
function removeDir(p){ fs.rmSync(p, { recursive: true, force: true }); }
let buildLockToken = null;
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
      const activeOwner = sameHost && processAlive(Number(owner.pid));
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
      if (activeOwner || ((unknownHost || !sameHost) && ageMs < BUILD_LOCK_STALE_MS)) {
        throw new Error(`PUBLIC DEPLOY BUILD FAILED — another build owns ${BUILD_LOCK}`);
      }
      removeDir(BUILD_LOCK);
      continue;
    }
    buildLockToken = `${hostname}:${process.pid}:${Date.now()}`;
    fs.writeFileSync(BUILD_LOCK_META, JSON.stringify({
      token: buildLockToken,
      hostname,
      pid: process.pid,
      created_epoch_ms: Date.now(),
    }) + '\n');
    process.once('exit', releaseBuildLock);
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
function shouldSkip(rel, name){
  rel = posix(rel);
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
releaseBuildLock();
console.log(`PUBLIC DEPLOY BUILD PASSED — ${PUBLIC_DIRS.length} public directories copied to /public; full source remains in zip root.`);
