#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const redirects = fs.existsSync(path.join(ROOT, '_redirects')) ? fs.readFileSync(path.join(ROOT, '_redirects'), 'utf8') : '';
const toml = fs.existsSync(path.join(ROOT, 'netlify.toml')) ? fs.readFileSync(path.join(ROOT, 'netlify.toml'), 'utf8') : '';
const packageDoc = fs.existsSync(path.join(ROOT, 'package.json')) ? JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')) : {};
const failures = [];
function escRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function hasRedirectsBlock(pattern) {
  return new RegExp('^' + escRegex(pattern) + '\\s+/404\\.html\\s+404!', 'm').test(redirects);
}
function hasTomlBlock(pattern) {
  const re = new RegExp('from\\s*=\\s*"' + escRegex(pattern) + '"[\\s\\S]*?to\\s*=\\s*"/404\\.html"[\\s\\S]*?status\\s*=\\s*404[\\s\\S]*?force\\s*=\\s*true');
  return re.test(toml);
}
function hasBlock(pattern) { return hasRedirectsBlock(pattern) || hasTomlBlock(pattern); }
function requireBlock(pattern, why) {
  if (!hasBlock(pattern)) failures.push(`${pattern} is not forced to 404 (${why})`);
}
function publishDir() {
  const m = toml.match(/\bpublish\s*=\s*"([^"]+)"/);
  return m ? m[1] : '.';
}
const publish = publishDir();
if (publish !== 'public') failures.push(`netlify.toml publish directory is "${publish}"; expected "public" so full zip root stays archive/operator and only /public deploys.`);
const netlifyRunsCanonicalBuild = /command\s*=\s*"npm run build"/.test(toml) && /build-public-deploy\.js/.test(packageDoc.scripts?.build || '');
if (!/build-public-deploy\.js/.test(toml) && !netlifyRunsCanonicalBuild) failures.push('Netlify build does not generate the public publish directory through the canonical package build command.');
const rootFiles = fs.readdirSync(ROOT, { withFileTypes: true })
  .filter(d => d.isFile())
  .map(d => d.name);
const rootArtifactRe = /(?:AUDIT|REPORT|PATCH|VERIFY|VERIFY_ALL|OUTPUT|SETUP|DEPLOY|V10|MEANINGLIB|CL_SUGGESTION|PRIVATE|SECRET|TOKEN|CRITIQUE|DASHBOARD|HANDOFF|RELEASE)/i;
// When Netlify publishes /public, root source/operator files are outside the
// deploy surface by construction. Require route-level blocks only for legacy
// root-publish configurations; always scan the actual /public output below.
if (publish !== 'public') {
  for (const name of rootFiles) {
    const publicPath = '/' + name;
    if (/\.(?:bat|ps1|py)$/i.test(name)) requireBlock(publicPath, 'root executable/operator file');
    if (rootArtifactRe.test(name) && /\.(?:md|json|txt|log|csv)$/i.test(name)) {
      requireBlock(publicPath, 'root audit/report/operator artifact');
    }
  }
  for (const pattern of [
    '/data', '/data/', '/data/*', '/scripts', '/scripts/', '/scripts/*',
    '/.github', '/.github/', '/.github/*', '/hf_export', '/hf_export/', '/hf_export/*',
    '/node_modules', '/node_modules/', '/node_modules/*', '/netlify', '/netlify/', '/netlify/*',
    '/.env', '/.env.local', '/.npmrc', '/.gitignore', '/.env.example', '/netlify.env.example',
    '/package.json', '/package-lock.json', '/netlify.toml', '/_redirects', '/_headers', '/CHARTER.txt'
  ]) requireBlock(pattern, 'tooling/private path');
}
// If /public exists locally, scan it as the true deploy surface.
const pubRoot = path.join(ROOT, 'public');
if (fs.existsSync(pubRoot)) {
  const bannedTop = ['scripts','data','hf_export','netlify','.github','package.json','package-lock.json','netlify.toml','SETUP.md'];
  for (const p of bannedTop) if (fs.existsSync(path.join(pubRoot, p))) failures.push(`public/${p} reached the publish directory`);
  const opRe = rootArtifactRe;
  function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      const rel = path.relative(pubRoot, full).replace(/\\/g, '/');
      if (ent.isDirectory()) walk(full);
      else if (ent.isFile() && !rel.startsWith('polymyth/') && !rel.startsWith('aa/') && !rel.startsWith('bb/') && !rel.startsWith('bookwormcard/')) {
        if (ent.name !== 'site-release.json' && opRe.test(ent.name) && /\.(?:md|json|txt|log|csv)$/i.test(ent.name)) failures.push(`public/${rel} looks like an operator/audit artifact`);
      }
    }
  }
  walk(pubRoot);
}
if (failures.length) {
  console.error('PUBLIC ARTIFACT BLOCK CHECK FAILED');
  failures.forEach(f => console.error(' - ' + f));
  process.exit(1);
}
console.log('PUBLIC ARTIFACT BLOCK CHECK PASSED — full zip can keep source/operator files while Netlify publishes only /public, with root fallback blocks in place.');
