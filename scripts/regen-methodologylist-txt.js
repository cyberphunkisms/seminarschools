#!/usr/bin/env node
/**
 * regen-methodologylist-txt.js
 *
 * Regenerates polymyth/methodologylist.txt as a plain-text mirror of the
 * canonical ml* SEED array in polymyth/methodologylist/index.html.
 *
 * ml*.txt format (preserved from the May 2026 hand-maintained version):
 *   Polymyth Methodologylist — text mirror
 *   Sections: a(n), b(m), ... (alphabetical)
 *   Total entries: N
 *
 *   === SECTION ($COUNT entries) ===
 *
 *   [role] Title
 *   Body...
 *   (optional ext block)
 *     tags: tag1, tag2, ...
 *
 * Section order: methodology, gorgonification, degorgonification, analysis,
 * sabachtan, idiomary, citation, studylist, rainbowsol, polycognate,
 * learnings, coreplus, pending. Any new section appears at the end.
 *
 * 2026-05-12: format-reconciliation pass. Script lifted from DEFERRED.
 *
 * Usage:
 *   node scripts/regen-methodologylist-txt.js
 *   node scripts/regen-methodologylist-txt.js --dry-run
 */

'use strict';

const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');

const scriptDir = path.dirname(__filename);
const projectRoot = path.dirname(scriptDir);

const HTML_PATH = path.join(projectRoot, 'polymyth/methodologylist/index.html');
const TXT_PATH  = path.join(projectRoot, 'polymyth/methodologylist.txt');

if (!fs.existsSync(HTML_PATH)) {
  console.error('Source HTML not found:', HTML_PATH);
  process.exit(2);
}

// ------------------------------------------------------------------
// Parse SEED array
// ------------------------------------------------------------------
function parseSeedArray(filePath) {
  const html = fs.readFileSync(filePath, 'utf-8');
  const seedIdx = html.indexOf('const SEED');
  if (seedIdx === -1) throw new Error('No const SEED in ' + filePath);
  const arrStart = html.indexOf('[', seedIdx);
  let depth = 0, inTpl = false, strQuote = null, escape = false, arrEnd = -1;
  for (let i = arrStart; i < html.length; i++) {
    const c = html[i];
    if (escape) { escape = false; continue; }
    if (c === '\\') { escape = true; continue; }
    if (strQuote) { if (c === strQuote) strQuote = null; continue; }
    if (inTpl)    { if (c === '`')     inTpl    = false; continue; }
    if (c === '`')                       { inTpl    = true;  continue; }
    if (c === "'" || c === '"')          { strQuote = c;     continue; }
    if (c === '[') depth++;
    else if (c === ']') { depth--; if (depth === 0) { arrEnd = i; break; } }
  }
  return eval(html.slice(arrStart, arrEnd + 1));
}

const ml = parseSeedArray(HTML_PATH);
console.log('Parsed', ml.length, 'entries from ml*');

// ------------------------------------------------------------------
// Section ordering
// ------------------------------------------------------------------
const SECTION_ORDER = [
  'methodology', 'gorgonification', 'degorgonification', 'analysis', 'sabachtan',
  'idiomary', 'citation', 'studylist', 'rainbowsol', 'polycognate', 'learnings',
  'coreplus', 'pending',
];

const SECTION_LABELS = {
  methodology: 'METHODOLOGY',
  gorgonification: 'GORGONIFICATION',
  degorgonification: 'DEGORGONIFICATION',
  analysis: 'ANALYSIS',
  sabachtan: 'SABACHTAN',
  idiomary: 'IDIOMARY',
  citation: 'CITATION',
  studylist: 'STUDYLIST',
  rainbowsol: 'RAINBOWSOL',
  polycognate: 'POLYCOGNATE',
  learnings: 'LEARNINGS',
  coreplus: 'COREPLUS',
  pending: 'PENDING',
};

const bySection = {};
for (const e of ml) {
  const s = e.s || 'unknown';
  if (!bySection[s]) bySection[s] = [];
  bySection[s].push(e);
}

// ------------------------------------------------------------------
// Render
// ------------------------------------------------------------------
function renderEntry(e) {
  const role  = e.r || 'both';
  const title = (e.t || '<untitled>').trim();
  const body  = (e.b || '').trim();
  const ext   = (e.x || '').trim();
  const tags  = (e.tg || '').trim();
  const lines = [];
  lines.push('[' + role + '] ' + title);
  if (body) lines.push(body);
  if (ext && !body.includes(ext)) {
    lines.push('');
    lines.push(ext);
  }
  if (tags) lines.push('  tags: ' + tags);
  return lines.join('\n');
}

const alpha = Object.keys(bySection).sort();
const sectionsLine = alpha.map(s => `${s}(${bySection[s].length})`).join(', ');
const total = ml.length;

const out = [];
out.push('Polymyth Methodologylist — text mirror');
out.push('Sections: ' + sectionsLine);
out.push('Total entries: ' + total);
out.push('');

const emitted = new Set();
for (const s of SECTION_ORDER) {
  const entries = bySection[s];
  if (!entries || entries.length === 0) continue;
  out.push(`=== ${SECTION_LABELS[s]} (${entries.length} entries) ===`);
  out.push('');
  for (const e of entries) {
    out.push(renderEntry(e));
    out.push('');
  }
  emitted.add(s);
}
// Catch sections not in canonical order
for (const s of alpha) {
  if (emitted.has(s)) continue;
  const entries = bySection[s];
  out.push(`=== ${(SECTION_LABELS[s] || s.toUpperCase())} (${entries.length} entries) ===`);
  out.push('');
  for (const e of entries) {
    out.push(renderEntry(e));
    out.push('');
  }
}

const content = out.join('\n');

if (dryRun) {
  console.log('--- dry run; first 600 bytes ---');
  console.log(content.slice(0, 600));
  console.log('Output size: ' + content.length + ' bytes');
} else {
  const before = fs.existsSync(TXT_PATH) ? fs.statSync(TXT_PATH).size : 0;
  fs.writeFileSync(TXT_PATH, content, 'utf-8');
  const after = fs.statSync(TXT_PATH).size;
  console.log('Original size: ' + before + ' bytes');
  console.log('New size:      ' + after + ' bytes');
  console.log('Delta:         ' + (after - before >= 0 ? '+' : '') + (after - before));
  console.log('Wrote ' + TXT_PATH);
}
