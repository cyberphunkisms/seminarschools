#!/usr/bin/env node
'use strict';
/** Verifies Netlify headers enforce CSP and include the live external script hosts used by the site. */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
let fail = 0;
function read(rel) { try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch { return ''; } }
function check(name, ok, detail='') { console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (detail ? ' — ' + detail : '')); if (!ok) fail = 1; }
function policyFrom(headers) {
  const m = headers.match(/Content-Security-Policy:\s*([^\n]+)/);
  return m ? m[1].trim() : '';
}
const headerFiles = ['_headers', 'public/_headers'];
for (const rel of headerFiles) {
  const text = read(rel);
  const policy = policyFrom(text);
  check(rel + ' has enforced Content-Security-Policy', policy.length > 0);
  check(rel + ' has no report-only CSP', !text.includes('Content-Security-Policy-Report-Only'));
  check(rel + ' allows cdnjs scripts used by d3/pdf.js pages', /script-src[^;]*https:\/\/cdnjs\.cloudflare\.com/.test(policy));
  check(rel + ' has worker-src for pdf.js worker', /worker-src[^;]*https:\/\/cdnjs\.cloudflare\.com/.test(policy));
  check(rel + ' allows Google and YouTube frames', /frame-src[^;]*https:\/\/www\.google\.com/.test(policy) && /frame-src[^;]*https:\/\/www\.youtube(?:-nocookie)?\.com/.test(policy));
  check(rel + ' locks object-src', /object-src\s+'none'/.test(policy));
}
const externalScriptHosts = new Set();
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['.git','node_modules','.netlify','public'].includes(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else if (e.isFile() && e.name.endsWith('.html')) {
      const rel = path.relative(ROOT, full).replace(/\\/g, '/');
      const html = fs.readFileSync(full, 'utf8');
      for (const m of html.matchAll(/<script\b[^>]*\bsrc=["'](https?:\/\/[^"']+)["']/gi)) {
        externalScriptHosts.add(new URL(m[1]).origin + ' from ' + rel);
      }
    }
  }
}
walk(ROOT);
const sourcePolicy = policyFrom(read('_headers'));
for (const item of [...externalScriptHosts].sort()) {
  const [origin, rel] = item.split(' from ');
  check('CSP script-src covers ' + origin, sourcePolicy.includes(origin), rel);
}
if (fail) {
  console.error('\nCSP ENFORCEMENT CHECK FAILED');
  process.exit(1);
}
console.log('\nCSP ENFORCEMENT CHECK PASSED');
