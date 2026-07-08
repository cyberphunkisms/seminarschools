#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const redirects = fs.existsSync(path.join(ROOT, '_redirects')) ? fs.readFileSync(path.join(ROOT, '_redirects'), 'utf8') : '';
const toml = fs.existsSync(path.join(ROOT, 'netlify.toml')) ? fs.readFileSync(path.join(ROOT, 'netlify.toml'), 'utf8') : '';
const failures = [];
function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
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
const rootFiles = fs.readdirSync(ROOT, { withFileTypes: true })
  .filter(d => d.isFile())
  .map(d => d.name);
const rootArtifactRe = /(?:AUDIT|REPORT|PATCH|VERIFY|VERIFY_ALL|OUTPUT|SETUP|DEPLOY|V10|MEANINGLIB|CL_SUGGESTION|PRIVATE|SECRET|TOKEN)/i;
for (const name of rootFiles) {
  const publicPath = '/' + name;
  if (/\.(?:bat|ps1|py)$/i.test(name)) requireBlock(publicPath, 'root executable/operator file');
  if (rootArtifactRe.test(name) && /\.(?:md|json|txt|log)$/i.test(name)) {
    requireBlock(publicPath, 'root audit/report/operator artifact');
  }
}
for (const pattern of [
  '/data', '/data/', '/data/*',
  '/scripts', '/scripts/', '/scripts/*',
  '/.github', '/.github/', '/.github/*',
  '/hf_export', '/hf_export/', '/hf_export/*',
  '/node_modules', '/node_modules/', '/node_modules/*',
  '/netlify', '/netlify/', '/netlify/*',
  '/.env', '/.env.local', '/.npmrc', '/.gitignore',
  '/.env.example', '/netlify.env.example',
  '/package.json', '/package-lock.json',
  '/netlify.toml', '/_redirects', '/_headers',
  '/CHARTER.txt'
]) requireBlock(pattern, 'tooling/private path');
if (failures.length) {
  console.error('PUBLIC ARTIFACT BLOCK CHECK FAILED');
  failures.forEach(f => console.error(' - ' + f));
  process.exit(1);
}
console.log('PUBLIC ARTIFACT BLOCK CHECK PASSED — root operator artifacts, bare tooling dirs, and wildcard tooling paths are forced to 404.');
