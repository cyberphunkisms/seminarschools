#!/usr/bin/env node
/**
 * regen-methodologylist-sections-txt.js
 *
 * Regenerates every per-section mirror polymyth/methodologylist-<section>.txt
 * from the canonical ml* SEED array in polymyth/methodologylist/index.html.
 *
 * WHY THIS EXISTS (2026-06-07): regen-methodologylist-txt.js only rebuilds the
 * single full mirror methodologylist.txt. The per-section mirrors were
 * hand-maintained and silently rotted, drifting to the May 2026 builds while
 * the canon moved on. The gorgonification section mirror kept the pre-scrub
 * stone-lead and was reproduced by an AI that read the mirror instead of the
 * HTML. This script regenerates all section mirrors so no stale text survives
 * in the mirror layer. Run it whenever the SEED changes.
 *
 * Only sections that already have a mirror file are written. No new files.
 *
 * Usage:
 *   node scripts/regen-methodologylist-sections-txt.js [build-date]
 *   node scripts/regen-methodologylist-sections-txt.js --dry-run
 */

'use strict';

const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const dateArg = argv.find(a => /^\d{4}-\d{2}-\d{2}$/.test(a));
const BUILD_DATE = dateArg || new Date().toISOString().slice(0, 10);

const scriptDir = path.dirname(__filename);
const projectRoot = path.dirname(scriptDir);
const HTML_PATH = path.join(projectRoot, 'polymyth/methodologylist/index.html');

if (!fs.existsSync(HTML_PATH)) {
  console.error('Source HTML not found:', HTML_PATH);
  process.exit(2);
}

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
    if (inTpl) { if (c === '`') inTpl = false; continue; }
    if (c === '`') { inTpl = true; continue; }
    if (c === "'" || c === '"') { strQuote = c; continue; }
    if (c === '[') depth++;
    else if (c === ']') { depth--; if (depth === 0) { arrEnd = i; break; } }
  }
  return eval(html.slice(arrStart, arrEnd + 1));
}

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

function renderEntry(e) {
  const role  = e.r || 'both';
  const title = (e.t || '<untitled>').trim();
  const body  = (e.b || '').trim();
  const ext   = (e.x || '').trim();
  const tags  = (e.tg || '').trim();
  const lines = [];
  lines.push('[' + role + '] ' + title);
  if (body) lines.push(body);
  if (ext && !body.includes(ext)) { lines.push(''); lines.push(ext); }
  if (tags) lines.push('  tags: ' + tags);
  return lines.join('\n');
}

const ml = parseSeedArray(HTML_PATH);
console.log('Parsed ' + ml.length + ' entries; build date ' + BUILD_DATE);

const bySection = {};
for (const e of ml) {
  const s = e.s || 'unknown';
  if (!bySection[s]) bySection[s] = [];
  bySection[s].push(e);
}

let written = 0, skipped = 0;
for (const sec of Object.keys(bySection).sort()) {
  const fname = path.join(projectRoot, 'polymyth/methodologylist-' + sec + '.txt');
  if (!fs.existsSync(fname)) { console.log('skip (no existing mirror): ' + sec); skipped++; continue; }
  const entries = bySection[sec];
  const label = SECTION_LABELS[sec] || sec.toUpperCase();
  const lines = [];
  lines.push('Polymyth Methodologylist — ' + sec + ' section');
  lines.push('Source: https://seminarschools.com/polymyth/methodologylist.txt (full file)');
  lines.push('Section index: https://seminarschools.com/polymyth/manifest.txt');
  lines.push('AI-discovery index: https://seminarschools.com/llms.txt');
  lines.push('Last build: ' + BUILD_DATE);
  lines.push('');
  lines.push('=== ' + label + ' (' + entries.length + ' entries) ===');
  lines.push('');
  for (const e of entries) { lines.push(renderEntry(e)); lines.push(''); }
  const content = lines.join('\n');
  if (dryRun) {
    console.log('section ' + sec + ': ' + entries.length + ' entries, ' + content.length + ' bytes (dry-run)');
  } else {
    fs.writeFileSync(fname, content, 'utf-8');
    console.log('Wrote methodologylist-' + sec + '.txt (' + entries.length + ' entries)');
    written++;
  }
}
console.log('Done. written=' + written + ' skipped=' + skipped);
