#!/usr/bin/env node
/**
 * regen-modulecanon-txt.js
 *
 * Regenerates polymyth/modulecanon.txt as a plain-text mirror of the canonical
 * mc* SEED array in polymyth/modulecanon/index.html.
 *
 * Preserves the hand-authored preamble (header through TOTAL ENTRIES line) but
 * regenerates all section content (FRAMEWORK / MODULE / PENDING / CMAP / CITATION)
 * from current mc* state. Fixes header date and TOTAL ENTRIES count.
 *
 * Schema by section:
 *   - framework (s='framework'): body text in `b` field
 *   - module    (s='module'):    body text in `desc` field
 *   - pending   (s='pending'):   body text in `b` field
 *   - cmap      (s='cmap'):      synthesized from structured fields (jurisdiction,
 *                                 governing_body, structure, modules, note)
 *   - citation  (s='citation'):  body text in `b` field
 *
 * Usage:
 *   node scripts/regen-modulecanon-txt.js
 *   node scripts/regen-modulecanon-txt.js --dry-run
 *
 * Origin: 2026-05-10, T4.1 modulecanon.txt staleness fix.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');

const scriptDir = path.dirname(__filename);
const projectRoot = path.dirname(scriptDir);

const HTML_PATH = path.join(projectRoot, 'polymyth', 'modulecanon', 'index.html');
const TXT_PATH = path.join(projectRoot, 'polymyth', 'modulecanon.txt');

if (!fs.existsSync(HTML_PATH)) {
  console.error('Source HTML not found:', HTML_PATH);
  process.exit(2);
}
if (!fs.existsSync(TXT_PATH)) {
  console.error('Target TXT not found:', TXT_PATH);
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
    if (inTpl) { if (c === '`') inTpl = false; continue; }
    if (c === '`') { inTpl = true; continue; }
    if (c === "'" || c === '"') { strQuote = c; continue; }
    if (c === '[') depth++;
    else if (c === ']') { depth--; if (depth === 0) { arrEnd = i; break; } }
  }
  return eval(html.slice(arrStart, arrEnd + 1));
}

const mc = parseSeedArray(HTML_PATH);
console.log('Parsed', mc.length, 'entries from mc*');

// ------------------------------------------------------------------
// Section grouping
// ------------------------------------------------------------------
const SECTIONS = ['framework', 'module', 'pending', 'cmap', 'citation', 'resolved', 'retracted'];
const grouped = {};
for (const s of SECTIONS) grouped[s] = [];
for (const e of mc) {
  const s = e.s || 'unknown';
  if (grouped[s]) grouped[s].push(e);
  else {
    console.warn('Entry with unknown s value:', e.id, '(s=' + e.s + ')');
  }
}

console.log('Section counts:');
for (const s of SECTIONS) console.log('  ' + s.toUpperCase() + ':', grouped[s].length);

// ------------------------------------------------------------------
// Body extractors per section
// ------------------------------------------------------------------
function extractBody(entry) {
  const s = entry.s;
  if (s === 'module') {
    return entry.desc || '';
  }
  if (s === 'cmap') {
    // Synthesize from structured fields
    const lines = [];
    if (entry.name) lines.push('Name: ' + entry.name);
    if (entry.jurisdiction) lines.push('Jurisdiction: ' + entry.jurisdiction);
    if (entry.governing_body) lines.push('Governing body: ' + entry.governing_body);
    if (entry.structure) lines.push('Structure: ' + entry.structure);
    if (entry.modules && entry.modules.length) lines.push('Modules: ' + entry.modules.join(', '));
    if (entry.citations && entry.citations.length) lines.push('Citations: ' + entry.citations.join(', '));
    if (entry.pending_for_coverage && entry.pending_for_coverage.length) {
      lines.push('Pending for coverage: ' + entry.pending_for_coverage.join(', '));
    }
    if (entry.note) lines.push('');
    if (entry.note) lines.push(entry.note);
    return lines.join('\n');
  }
  // framework, pending, citation use b
  return entry.b || '';
}

function extractTitle(entry) {
  return entry.t || entry.id || '<untitled>';
}

function extractRole(entry) {
  // Original .txt format used "ROLE: both" for everything. Preserve.
  return 'both';
}

function extractLinks(entry) {
  // May 15 2026: surface bb_links / mc_links / cc_links / ml_crossref into the txt mirror.
  // Per CL pending item "mc* regen-script surface bb_links in txt mirror," extended to
  // also cover mc_links/cc_links/ml_crossref so cross-references are visible to any
  // AI reading the txt file alone. Returns a LINKS: line if any links are present,
  // or empty string if all link fields are absent or empty.
  const parts = [];
  if (entry.bb_links && entry.bb_links.length) {
    parts.push('bb_links=[' + entry.bb_links.join(', ') + ']');
  }
  if (entry.mc_links && entry.mc_links.length) {
    parts.push('mc_links=[' + entry.mc_links.join(', ') + ']');
  }
  if (entry.cc_links && entry.cc_links.length) {
    parts.push('cc_links=[' + entry.cc_links.join(', ') + ']');
  }
  // ml_crossref is descriptive prose, not an ID list; surface only as ML-CROSSREF if string non-empty
  if (entry.ml_crossref && typeof entry.ml_crossref === 'string' && entry.ml_crossref.trim()) {
    parts.push('ml_crossref="' + entry.ml_crossref + '"');
  } else if (Array.isArray(entry.ml_crossref) && entry.ml_crossref.length) {
    parts.push('ml_crossref=[' + entry.ml_crossref.join(', ') + ']');
  }
  return parts.length ? parts.join('; ') : '';
}

// ------------------------------------------------------------------
// Read existing .txt and preserve preamble
// ------------------------------------------------------------------
const existingTxt = fs.readFileSync(TXT_PATH, 'utf-8');
const lines = existingTxt.split('\n');

// Find the line "TOTAL ENTRIES: <number>"
let totalEntriesLineIdx = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].startsWith('TOTAL ENTRIES:')) { totalEntriesLineIdx = i; break; }
}
if (totalEntriesLineIdx === -1) {
  console.error('Could not find TOTAL ENTRIES marker in existing .txt');
  process.exit(2);
}

// Preamble = lines 0 through totalEntriesLineIdx-1 (NOT including the TOTAL ENTRIES line)
// We rewrite the TOTAL ENTRIES line ourselves to update count
const preambleLines = lines.slice(0, totalEntriesLineIdx);

// Update the "last updated" line within preamble to today
const today = new Date().toISOString().slice(0, 10);
for (let i = 0; i < preambleLines.length; i++) {
  if (preambleLines[i].startsWith('last updated:')) {
    preambleLines[i] = 'last updated: ' + today;
    break;
  }
}

// ------------------------------------------------------------------
// Build regenerated content
// ------------------------------------------------------------------
const out = [];
out.push(preambleLines.join('\n'));
out.push('TOTAL ENTRIES: ' + mc.length);
out.push('========================================================================');
out.push('');

const SECTION_HEADERS = {
  framework: 'FRAMEWORK',
  module: 'MODULE',
  pending: 'PENDING',
  cmap: 'CMAP',
  citation: 'CITATION',
};

for (const s of SECTIONS) {
  const entries = grouped[s];
  if (entries.length === 0) continue;
  const header = SECTION_HEADERS[s];
  out.push('########################################################################');
  out.push('SECTION: ' + header + '  (' + entries.length + ' entries)');
  out.push('########################################################################');
  out.push('');

  for (const entry of entries) {
    out.push('------------------------------------------------------------------------');
    out.push('TITLE: ' + extractTitle(entry));
    out.push('ROLE: ' + extractRole(entry));
    const links = extractLinks(entry);
    if (links) out.push('LINKS: ' + links);
    out.push('');
    const body = extractBody(entry);
    if (body && body.trim()) {
      out.push(body);
      out.push('');
    } else {
      out.push('');
    }
  }
  out.push('');
}

// Trailer
out.push('========================================================================');
out.push('END OF MODULECANON FILE');
out.push('========================================================================');

const newTxt = out.join('\n');

// ------------------------------------------------------------------
// Write
// ------------------------------------------------------------------
console.log();
console.log('Original size:', existingTxt.length, 'bytes');
console.log('New size:     ', newTxt.length, 'bytes');
console.log('Delta:        ', (newTxt.length - existingTxt.length >= 0 ? '+' : '') + (newTxt.length - existingTxt.length));

if (dryRun) {
  console.log();
  console.log('--dry-run: no write performed');
  console.log('First 50 lines of regenerated content:');
  console.log(newTxt.split('\n').slice(0, 50).join('\n'));
  process.exit(0);
}

const tmp = TXT_PATH + '.tmp';
fs.writeFileSync(tmp, newTxt);
fs.renameSync(tmp, TXT_PATH);
console.log();
console.log('Wrote', TXT_PATH);
