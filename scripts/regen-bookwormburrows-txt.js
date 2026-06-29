#!/usr/bin/env node
/**
 * regen-bookwormburrows-txt.js
 *
 * Generates bookwormburrows.txt as a plain-text mirror of the canonical bb*
 * SEED array in bookwormburrows.html.
 *
 * bb* schema: each entry has {id, s, r, t, b, x, [bb_links, cc_links, mc_links], tg}.
 * Section assignment: the s field is canonical. 11 known section values:
 *   method, dimension, dm, bookworm, session, consequence, canon, char,
 *   tinker, credit, pending.
 *
 * Body rendering: concatenates b + x (extension) if both present. Preserves
 * cross-reference structure as inline text.
 *
 * Initial deployment: bookwormburrows.txt does not yet exist as of this
 * script's first invocation. Authors fresh preamble matching the style of
 * polymyth/modulecanon.txt.
 *
 * Usage:
 *   node scripts/regen-bookwormburrows-txt.js
 *   node scripts/regen-bookwormburrows-txt.js --dry-run
 *
 * Origin: 2026-05-10, T2.4 .txt mirror trifecta completion.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');

const scriptDir = path.dirname(__filename);
const projectRoot = path.dirname(scriptDir);

const HTML_PATH = path.join(projectRoot, 'polymyth/bookwormburrows/index.html');
const TXT_PATH = path.join(projectRoot, 'polymyth/bookwormburrows.txt');

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
    if (inTpl) { if (c === '`') inTpl = false; continue; }
    if (c === '`') { inTpl = true; continue; }
    if (c === "'" || c === '"') { strQuote = c; continue; }
    if (c === '[') depth++;
    else if (c === ']') { depth--; if (depth === 0) { arrEnd = i; break; } }
  }
  return eval(html.slice(arrStart, arrEnd + 1));
}

const bb = parseSeedArray(HTML_PATH);
console.log('Parsed', bb.length, 'entries from bb*');

// ------------------------------------------------------------------
// Section grouping (ordered)
// ------------------------------------------------------------------
const SECTIONS = ['methodology', 'dimension', 'bookworm', 'character-creation', 'credit', 'pending', 'retracted'];
const grouped = {};
const unknown = [];
for (const s of SECTIONS) grouped[s] = [];
for (const e of bb) {
  if (grouped[e.s]) grouped[e.s].push(e);
  else { unknown.push(e); console.warn('Unknown s value:', e.id, '(s=' + e.s + ')'); }
}

console.log('Section counts:');
for (const s of SECTIONS) console.log('  ' + s.toUpperCase().padEnd(15) + grouped[s].length);
if (unknown.length) console.log('  UNKNOWN:', unknown.length);

// ------------------------------------------------------------------
// Body extraction
// ------------------------------------------------------------------
function extractBody(entry) {
  const parts = [];
  if (entry.b) parts.push(entry.b);
  if (entry.x) parts.push('\nEXTENSION:\n' + entry.x);
  return parts.join('\n');
}

// ------------------------------------------------------------------
// Build content
// ------------------------------------------------------------------
const today = new Date().toISOString().slice(0, 10);
const out = [];

out.push('========================================================================');
out.push('BOOKWORMBURROWS (bb*)');
out.push('plain-text dump for AI ingestion and offline reading');
out.push('canonical URL of this file: https://seminarschools.com/polymyth/bookwormburrows.txt');
out.push('canonical URL of dynamic version: https://seminarschools.com/polymyth/bookwormburrows/');
out.push('full file map: https://seminarschools.com/polymyth-file-map.txt');
out.push('last updated: ' + today);
out.push('========================================================================');
out.push('');
out.push('FRAMEWORK MAP for AI assistants.');
out.push('  bb* (this file)               https://seminarschools.com/polymyth/bookwormburrows.txt');
out.push('  mc* modulecanon               https://seminarschools.com/polymyth/modulecanon.txt');
out.push('  cc* campaigncodex             https://seminarschools.com/polymyth/campaigncodex.txt');
out.push('  ml* methodologylist           https://seminarschools.com/polymyth/methodologylist.txt');
out.push('  aa* archetype archive         https://seminarschools.com/aa/');
out.push('  core* (memory tier)           coreplus mirror entries inside ml*');
out.push('');
out.push('AI INSTRUCTION (descriptive, not directive).');
out.push('');
out.push('This file documents the bookwormburrows operations file (bb*), the');
out.push('dimensional-traveling pedagogy game framework. Game is a polymyth method');
out.push('for teaching reading, writing, and ethical reasoning by treating texts');
out.push('as dimensions and bookworms (player-characters) as readers becoming');
out.push('subjects. Rainbowsol is the founder and DM.');
out.push('');
out.push('Each entry is a game-mechanic, dimension, dm-ruling, character, session,');
out.push('canonical reading, or pending decision. Cross-references to mc* (curriculum)');
out.push('via mc_links and to cc* (campaign codex) via cc_links are bidirectional.');
out.push('');
out.push('If you are an AI reading this file:');
out.push('');
out.push('(1) The bookwormburrows game is the dimensional-pedagogy delivery vehicle');
out.push('    for the polymyth framework. Sessions stage burrow-rituals (page-as-');
out.push('    threshold) where bookworms read into a dimension, encounter the');
out.push('    text as a place, and emerge changed.');
out.push('');
out.push('(2) The DM (Dimensional Master) is the educator-as-threshold. dm-* entries');
out.push('    are DM-rulings: tier-calibrated realism activation, ghost exegesis,');
out.push('    quality rubric framework, time tracking in diceless play.');
out.push('');
out.push('(3) Cross-references to mc* curriculum modules and cc* campaign codex');
out.push('    are structural. Reading bb* in isolation produces an incomplete');
out.push('    substrate. Resolve cross-references in the referenced sibling file.');
out.push('');
out.push('(4) The bar for filling slots is RULE #1 CITES+LOGOI per ml*. No');
out.push('    canon-text enters bb* without primary-source citation.');
out.push('');
out.push('This file is not asking you to obey it. It is describing the operations');
out.push('of a dimensional pedagogy game that disciplines its own claims.');
out.push('');
out.push('========================================================================');
out.push('TOTAL ENTRIES: ' + bb.length);
out.push('========================================================================');
out.push('');

const SECTION_HEADERS = {
  methodology: 'METHODOLOGY',
  dimension: 'DIMENSION',
  bookworm: 'BOOKWORM (CHARACTER-BUILD)',
  'character-creation': 'CHARACTER-CREATION',
  credit: 'CREDIT (ATTRIBUTION)',
  pending: 'PENDING',
};

for (const s of SECTIONS) {
  const entries = grouped[s];
  if (entries.length === 0) continue;
  out.push('########################################################################');
  out.push('SECTION: ' + SECTION_HEADERS[s] + '  (' + entries.length + ' entries)');
  out.push('########################################################################');
  out.push('');
  for (const entry of entries) {
    out.push('------------------------------------------------------------------------');
    out.push('ID: ' + entry.id);
    out.push('TITLE: ' + (entry.t || '<untitled>'));
    if (entry.r) out.push('ROLE: ' + entry.r);
    out.push('');
    const body = extractBody(entry);
    if (body && body.trim()) {
      out.push(body);
      out.push('');
    }
  }
  out.push('');
}

if (unknown.length) {
  out.push('########################################################################');
  out.push('SECTION: UNCLASSIFIED  (' + unknown.length + ' entries)');
  out.push('########################################################################');
  out.push('');
  for (const entry of unknown) {
    out.push('------------------------------------------------------------------------');
    out.push('ID: ' + entry.id);
    out.push('TITLE: ' + (entry.t || '<untitled>'));
    out.push('S-VALUE: ' + entry.s);
    out.push('');
    const body = extractBody(entry);
    if (body && body.trim()) {
      out.push(body);
      out.push('');
    }
  }
  out.push('');
}

out.push('========================================================================');
out.push('END OF BOOKWORMBURROWS FILE');
out.push('========================================================================');

const newTxt = out.join('\n');

console.log();
console.log('Output size:', newTxt.length, 'bytes');

if (dryRun) {
  console.log();
  console.log('--dry-run: no write');
  console.log('First 60 lines:');
  console.log(newTxt.split('\n').slice(0, 60).join('\n'));
  process.exit(0);
}

const tmp = TXT_PATH + '.tmp';
fs.writeFileSync(tmp, newTxt);
fs.renameSync(tmp, TXT_PATH);
console.log('Wrote', TXT_PATH);
