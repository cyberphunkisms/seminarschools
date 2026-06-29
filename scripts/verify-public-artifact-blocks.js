#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const redirects = fs.readFileSync(path.join(ROOT, '_redirects'), 'utf8');
const toml = fs.readFileSync(path.join(ROOT, 'netlify.toml'), 'utf8');
const failures = [];
const rootFiles = fs.readdirSync(ROOT, { withFileTypes: true })
  .filter(d => d.isFile())
  .map(d => d.name)
  .filter(name => /(?:AUDIT|SETUP|VERIFY_ALL_OUTPUT)/i.test(name) && /\.(?:md|json|txt)$/i.test(name));
function hasForcedRedirect(name) {
  const from = '/' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const redirectLine = new RegExp('^/' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s+/404\\.html\\s+404!', 'm').test(redirects);
  const tomlBlock = new RegExp('from\\s*=\\s*"' + from + '"[\\s\\S]*?status\\s*=\\s*404[\\s\\S]*?force\\s*=\\s*true').test(toml);
  return redirectLine && tomlBlock;
}
for (const name of rootFiles) {
  if (!hasForcedRedirect(name)) failures.push(`${name} is a root operator/audit artifact without forced public block rules`);
}
for (const required of ['/data/*','/scripts/*','/.github/*']) {
  if (!toml.includes(`from = "${required}"`) && !redirects.includes(required)) failures.push(`${required} is not explicitly blocked`);
}
if (failures.length) {
  console.error('PUBLIC ARTIFACT BLOCK CHECK FAILED');
  failures.forEach(f => console.error(' - ' + f));
  process.exit(1);
}
console.log(`PUBLIC ARTIFACT BLOCK CHECK PASSED — ${rootFiles.length} root audit/setup artifacts are forced to 404.`);
