#!/usr/bin/env node
'use strict';
/** Verifies polymyth/manifest.txt against canonical ml* and current mirrors. */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'polymyth/methodologylist/index.html');
const MANIFEST_PATH = path.join(ROOT, 'polymyth/manifest.txt');
let fail = 0;
function check(name, ok, detail='') {
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (detail ? ' — ' + detail : ''));
  if (!ok) fail = 1;
}
function parseSeedArray(filePath) {
  const html = fs.readFileSync(filePath, 'utf8');
  const seedIdx = html.indexOf('const SEED');
  if (seedIdx === -1) throw new Error('No const SEED in ' + filePath);
  const arrStart = html.indexOf('[', seedIdx);
  let depth = 0, inTpl = false, strQuote = null, escape = false, arrEnd = -1;
  for (let i = arrStart; i < html.length; i++) {
    const c = html[i];
    if (escape) { escape = false; continue; }
    if (c === '\\') { escape = true; continue; }
    if (strQuote) { if (c === strQuote) strQuote = null; continue; }
    if (inTpl) { if (c === '`') inTpl = false; continue; }
    if (c === '`') { inTpl = true; continue; }
    if (c === "'" || c === '"') { strQuote = c; continue; }
    if (c === '[') depth++;
    else if (c === ']') { depth--; if (depth === 0) { arrEnd = i; break; } }
  }
  if (arrEnd === -1) throw new Error('Could not find end of SEED array.');
  return eval(html.slice(arrStart, arrEnd + 1));
}
function bytes(rel) { return fs.statSync(path.join(ROOT, rel)).size; }
function comma(n) { return n.toLocaleString('en-US'); }
const entries = parseSeedArray(HTML_PATH);
const manifest = fs.existsSync(MANIFEST_PATH) ? fs.readFileSync(MANIFEST_PATH, 'utf8') : '';
const bySection = new Map();
for (const e of entries) {
  const section = e.s || 'unknown';
  bySection.set(section, (bySection.get(section) || 0) + 1);
}
const sections = [...bySection.keys()].sort();
check('manifest exists', manifest.length > 1000);
check('manifest total entry count matches ml* canon', manifest.includes(entries.length + ' entries across ' + sections.length + ' sections'), entries.length + '/' + sections.length);
check('manifest full mirror byte count matches file', manifest.includes(comma(bytes('polymyth/methodologylist.txt')) + ' bytes'), comma(bytes('polymyth/methodologylist.txt')));
for (const section of sections) {
  const count = bySection.get(section);
  check('section count ' + section, manifest.includes('- ' + section + ': ' + count + ' entries'));
  const rel = 'polymyth/methodologylist-' + section + '.txt';
  if (fs.existsSync(path.join(ROOT, rel))) {
    check('section mirror bytes ' + section, manifest.includes(rel) && manifest.includes(comma(bytes(rel)) + ' bytes'));
  } else {
    check('section mirror omission explicit ' + section, manifest.includes('- ' + section + ': ' + count + ' entries; text mirror: full-file only'));
  }
}
check('release gate states verify-all blocks shipping', /Every command inside verify-all-runner\.js is a release blocker/.test(manifest));
if (fail) {
  console.error('\nMETHODOLOGYLIST MANIFEST CHECK FAILED');
  process.exit(1);
}
console.log('\nMETHODOLOGYLIST MANIFEST CHECK PASSED');
