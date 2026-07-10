#!/usr/bin/env node
'use strict';
/**
 * Rebuilds polymyth/manifest.txt from the canonical ml* SEED array and the
 * current text mirrors. This keeps the AI-discovery table of contents aligned
 * with methodologylist/index.html instead of relying on hand-edited counts.
 */
const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const dateArg = argv.find(a => /^\d{4}-\d{2}-\d{2}$/.test(a));
const BUILD_DATE = dateArg || new Date().toISOString().slice(0, 10);

const ROOT = path.resolve(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'polymyth/methodologylist/index.html');
const FULL_TXT_PATH = path.join(ROOT, 'polymyth/methodologylist.txt');
const OUT_PATH = path.join(ROOT, 'polymyth/manifest.txt');

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
  if (arrEnd === -1) throw new Error('Could not find end of SEED array in ' + filePath);
  return eval(html.slice(arrStart, arrEnd + 1));
}

function bytes(rel) {
  const f = path.join(ROOT, rel);
  return fs.existsSync(f) ? fs.statSync(f).size : null;
}
function groupBySection(entries) {
  const map = new Map();
  for (const e of entries) {
    const section = e.s || 'unknown';
    if (!map.has(section)) map.set(section, []);
    map.get(section).push(e);
  }
  return map;
}

if (!fs.existsSync(HTML_PATH)) throw new Error('Missing ' + HTML_PATH);
if (!fs.existsSync(FULL_TXT_PATH)) throw new Error('Missing ' + FULL_TXT_PATH + '. Run regen-methodologylist-txt.js first.');

const entries = parseSeedArray(HTML_PATH);
const bySection = groupBySection(entries);
const sections = [...bySection.keys()].sort();
const fullBytes = bytes('polymyth/methodologylist.txt');
const concordanceBytes = bytes('polymyth/concordance/concordance-index.json');

const lines = [];
lines.push('Polymyth Methodologylist — AI discovery manifest');
lines.push('Source canon: https://seminarschools.com/polymyth/methodologylist/');
lines.push('Full text mirror: https://seminarschools.com/polymyth/methodologylist.txt');
lines.push('Concordance index: https://seminarschools.com/polymyth/concordance/concordance-index.json');
lines.push('Last build: ' + BUILD_DATE);
lines.push('');
lines.push('Full file: ' + fullBytes.toLocaleString('en-US') + ' bytes, ' + entries.length + ' entries across ' + sections.length + ' sections.');
if (concordanceBytes !== null) lines.push('Concordance index: ' + concordanceBytes.toLocaleString('en-US') + ' bytes.');
lines.push('');
lines.push('Sections');
for (const section of sections) {
  const count = bySection.get(section).length;
  const mirrorRel = 'polymyth/methodologylist-' + section + '.txt';
  const mirrorBytes = bytes(mirrorRel);
  const htmlUrl = 'https://seminarschools.com/polymyth/methodologylist/?section=' + encodeURIComponent(section);
  if (mirrorBytes === null) {
    lines.push('- ' + section + ': ' + count + ' entries; text mirror: full-file only; HTML: ' + htmlUrl);
  } else {
    lines.push('- ' + section + ': ' + count + ' entries; text: https://seminarschools.com/' + mirrorRel + ' (' + mirrorBytes.toLocaleString('en-US') + ' bytes); HTML: ' + htmlUrl);
  }
}
lines.push('');
lines.push('Sibling star files');
const siblings = [
  ['modulecanon', 'polymyth/modulecanon.txt', 'Curriculum and module architecture'],
  ['bookwormburrows', 'polymyth/bookwormburrows.txt', 'Game and classroom operations'],
  ['campaigncodex', 'polymyth/campaigncodex.txt', 'Campaign rulings and continuity'],
];
for (const [name, rel, label] of siblings) {
  const b = bytes(rel);
  lines.push('- ' + name + ': https://seminarschools.com/' + rel + (b === null ? '' : ' (' + b.toLocaleString('en-US') + ' bytes)') + ' — ' + label);
}
lines.push('');
lines.push('Release gate');
lines.push('Run npm run regen:all-txt and npm run verify:all before shipping a zip. Every command inside verify-all-runner.js is a release blocker.');
lines.push('');

const output = lines.join('\n');
if (dryRun) {
  console.log(output);
  console.log('[DRY RUN] Would write ' + OUT_PATH);
} else {
  fs.writeFileSync(OUT_PATH, output, 'utf8');
  console.log('Wrote polymyth/manifest.txt (' + entries.length + ' entries across ' + sections.length + ' sections)');
}
