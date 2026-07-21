#!/usr/bin/env node
'use strict';
/**
 * Build the public Netlify publish directory while keeping the full operator/source
 * repository in the same zip. The repo root stays complete; only allowlisted
 * site files are copied into /public for deployment.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'public');
const PUBLIC_DIRS = [
  '.well-known', 'agora', 'aitr', 'aa', 'bb', 'bookwormcard', 'campaigns',
  'cfps', 'css', 'dashboard', 'fellowships', 'florilegium', 'humanities',
  'img', 'js', 'lectures', 'leizu', 'about', 'main', 'marginalia', 'nutrition',
  'ohm-dome', 'philosophy', 'polymyth', 'polymythcal', 'polymythseminars', 'reviews', 'saul',
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
  'teacherresources/submission-strategy.md'
]);
const BLOCKED_DIRS = new Set(['node_modules', '.git', '.github', '.netlify', 'data', 'hf_export', 'netlify', 'scripts', 'public']);
const OPERATOR_RE = /(?:AUDIT|REPORT|PATCH|VERIFY|OUTPUT|SETUP|DEPLOY|PRIVATE|SECRET|TOKEN|DASHBOARD|CRITIQUE|SUGGESTION|HANDOFF)/i;
function posix(p){ return p.replace(/\\/g, '/'); }
function ensureDir(p){ fs.mkdirSync(p, { recursive: true }); }
function copyFile(src, dst){ ensureDir(path.dirname(dst)); fs.copyFileSync(src, dst); }
function removeDir(p){ fs.rmSync(p, { recursive: true, force: true }); }
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
    if (BLOCKED_DIRS.has(ent.name)) continue;
    const src = path.join(srcDir, ent.name);
    const rel = posix(path.join(relBase, ent.name));
    if (ent.isDirectory()) copyDir(src, rel);
    else if (ent.isFile() && !shouldSkip(rel, ent.name)) copyFile(src, path.join(OUT, rel));
  }
}
removeDir(OUT);
ensureDir(OUT);
for (const file of ROOT_PUBLIC_FILES) {
  const src = path.join(ROOT, file);
  if (fs.existsSync(src)) copyFile(src, path.join(OUT, file));
}
for (const name of fs.readdirSync(ROOT)) {
  if (ROOT_PUBLIC_PATTERNS.some(re => re.test(name))) {
    const src = path.join(ROOT, name);
    if (fs.statSync(src).isFile()) copyFile(src, path.join(OUT, name));
  }
}
for (const dir of PUBLIC_DIRS) {
  copyDir(path.join(ROOT, dir), dir);
}
// Release marker for humans checking a deployed build.
const release = {
  release_id: fs.existsSync(path.join(ROOT, 'RELEASE_ID.txt')) ? fs.readFileSync(path.join(ROOT, 'RELEASE_ID.txt'), 'utf8').trim() : 'local-dev',
  publish_dir: 'public',
  generated_at: new Date().toISOString(),
  note: 'Generated deploy surface. Full source/operator archive remains in the zip root; Netlify publishes only this directory.'
};
fs.writeFileSync(path.join(OUT, 'site-release.json'), JSON.stringify(release, null, 2) + '\n');
// Hygiene check: the deploy dir must not contain tool/operator roots.
const failures = [];
for (const p of ['scripts', 'data', 'hf_export', 'netlify', '.github', 'node_modules', '.git', '.netlify', 'package.json', 'package-lock.json', 'netlify.toml']) {
  if (fs.existsSync(path.join(OUT, p))) failures.push(`public/${p}`);
}
function walkCheck(dir){
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    const rel = posix(path.relative(OUT, full));
    if (ent.isDirectory()) walkCheck(full);
    else if (ent.isFile() && !rel.startsWith('polymyth/') && !rel.startsWith('aa/') && !rel.startsWith('bb/') && !rel.startsWith('bookwormcard/')) {
      if (OPERATOR_RE.test(ent.name) && /\.(?:md|json|txt|log|csv)$/i.test(ent.name)) failures.push(`public/${rel}`);
    }
  }
}
walkCheck(OUT);
if (failures.length) {
  console.error('PUBLIC DEPLOY BUILD FAILED — operator artifacts reached publish dir:');
  failures.forEach(f => console.error(' - ' + f));
  process.exit(1);
}
console.log(`PUBLIC DEPLOY BUILD PASSED — ${PUBLIC_DIRS.length} public directories copied to /public; full source remains in zip root.`);
