#!/usr/bin/env node
/**
 * regen-campaigncodex-txt.js
 *
 * Generates campaigncodex.txt as plain-text mirror of the canonical cc*
 * SEED array in campaigncodex.html.
 *
 * cc* schema: each entry has {id, s, r, t, b, x, [cc_links, mc_links, bb_links], tg}.
 * cc* uses 60+ unique s values (mostly singletons), so section grouping is by
 * ID prefix not s field. Custom classifier maps each entry to one of 16 sections.
 *
 * Body rendering: concatenates b + x (extension) if both present.
 *
 * Initial deployment: campaigncodex.txt does not yet exist as of this script's
 * first invocation. Authors fresh preamble matching modulecanon.txt style.
 *
 * Usage:
 *   node scripts/regen-campaigncodex-txt.js
 *   node scripts/regen-campaigncodex-txt.js --dry-run
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

const HTML_PATH = path.join(projectRoot, 'polymyth/campaigncodex/index.html');
const TXT_PATH = path.join(projectRoot, 'polymyth/campaigncodex.txt');

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

function decodeHtmlEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&rsquo;/g, '’')
    .replace(/&ldquo;/g, '“')
    .replace(/&rdquo;/g, '”')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}
function extractCurrentBbRuling(filePath) {
  const html = fs.readFileSync(filePath, 'utf-8');
  const m = html.match(/<div class="sdesc"[^>]*data-bb-current-ruling="[^"]+"[^>]*>([\s\S]*?)<\/div>/);
  if (!m) return '';
  return decodeHtmlEntities(m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

const cc = parseSeedArray(HTML_PATH);
const currentBbRuling = extractCurrentBbRuling(HTML_PATH);
console.log('Parsed', cc.length, 'entries from cc*');

// ------------------------------------------------------------------
// Section classifier (ID-prefix-based, ordered)
// ------------------------------------------------------------------
const SECTIONS_ORDER = [
  'COURSE',
  'CMP-001 FRAMING',
  'CMP-001 NPC',
  'CMP-001 LOCATIONS',
  'CMP-001 SPATIAL',
  'CMP-001 REALISM',
  'CMP-001 ROGER HOMES',
  'CMP-001 OBJECT INVENTORIES',
  'CMP-001 VOICE',
  'CMP-001 TIME',
  'CMP-001 IMAGES',
  'CMP-001 GHOSTS',
  'CMP-001 TEMPLATES',
  'CMP-001 PEDAGOGY',
  'PENDING',
  'CITATION',
];

// Locations: explicit list of named-place entries
const LOCATION_IDS = new Set([
  'cc-cmp001-hotel-theresa',
  'cc-cmp001-blumsteins',
  'cc-cmp001-apollo',
  'cc-cmp001-harlem-hospital',
  'cc-cmp001-hughes-house',
  'cc-cmp001-schomburg',
  'cc-cmp001-smalls',
  'cc-cmp001-strivers-row',
  'cc-cmp001-abyssinian',
  'cc-cmp001-precinct-28',
  'cc-cmp001-amsterdam-news',
  'cc-cmp001-king-stabbing',
  'cc-cmp001-galesi-brescia',
  'cc-cmp001-harlem',
]);

// Pedagogy: explicit list
const PEDAGOGY_IDS = new Set([
  'cc-cmp001-rubric',
  'cc-cmp001-homework',
  'cc-cmp001-fnmi-pairing',
  'cc-cmp001-ghost-exegesis-applications',
  'cc-cmp001-encounter-block',
  'cc-cmp001-window',
  'cc-cmp001-manifest',
  'cc-cmp001-class-strata',
  'cc-cmp001-language',
  'cc-cmp001-canon',
  'cc-cmp001-overview',
  'cc-cmp001-emergence-point',
  'cc-cmp001-narrative-architecture',
  'cc-cmp001-historical-overlay-disclaimer',
  'cc-cmp001-authors-world-reframe',
  'cc-cmp001-roger-peer-thread',
  'cc-cmp001-news-context',
  'cc-cmp001-week-lead-up',
  'cc-cmp001-scene-set-pack',
  'cc-cmp001-realism', // realism parent goes here, children go to REALISM
  'cc-cmp001-sg-graph',
]);

function classifyEntry(entry) {
  const id = entry.id;
  if (id.startsWith('cc-eng')) return 'COURSE';
  if (id.startsWith('cc-pen')) return 'PENDING';
  if (id.startsWith('cc-cite')) return 'CITATION';
  if (id.startsWith('cc-cmp001-im-')) return 'CMP-001 IMAGES';
  if (id.startsWith('cc-cmp001-realism-')) return 'CMP-001 REALISM';
  if (id.startsWith('cc-cmp001-street-')) return 'CMP-001 SPATIAL';
  if (id.startsWith('cc-cmp001-tm-')) return 'CMP-001 TIME';
  if (id.startsWith('cc-cmp001-oi-')) return 'CMP-001 OBJECT INVENTORIES';
  if (id.startsWith('cc-cmp001-vs-')) return 'CMP-001 VOICE';
  if (id.startsWith('cc-cmp001-roger-home-') || id.startsWith('cc-cmp001-home-')) return 'CMP-001 ROGER HOMES';
  if (id.startsWith('cc-cmp001-ghost-')) return 'CMP-001 GHOSTS';
  if (id.startsWith('cc-cmp001-template-')) return 'CMP-001 TEMPLATES';
  if (id.startsWith('cc-cmp001-npc-') || id === 'cc-cmp001-mrs-jones' || id === 'cc-cmp001-roger') return 'CMP-001 NPC';
  if (id.endsWith('-npc') && id.startsWith('cc-cmp001-')) return 'CMP-001 NPC';  // hughes-npc, curry-npc, maynard-npc, powell-npc
  if (LOCATION_IDS.has(id)) return 'CMP-001 LOCATIONS';
  if (PEDAGOGY_IDS.has(id)) return 'CMP-001 PEDAGOGY';
  return 'CMP-001 FRAMING';
}

const grouped = {};
for (const s of SECTIONS_ORDER) grouped[s] = [];

for (const e of cc) {
  const section = classifyEntry(e);
  if (grouped[section]) grouped[section].push(e);
  else { console.warn('Unrouted:', e.id); grouped['CMP-001 FRAMING'].push(e); }
}

console.log('Section counts:');
for (const s of SECTIONS_ORDER) console.log('  ' + s.padEnd(28) + grouped[s].length);

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
out.push('CAMPAIGN CODEX (cc*)');
out.push('plain-text dump for AI ingestion and offline reading');
out.push('canonical URL of this file: https://seminarschools.com/polymyth/campaigncodex.txt');
out.push('canonical URL of dynamic version: https://seminarschools.com/polymyth/campaigncodex/');
out.push('full file map: https://seminarschools.com/polymyth-file-map.txt');
out.push('last updated: ' + today);
out.push('========================================================================');
out.push('');
out.push('FRAMEWORK MAP for AI assistants.');
out.push('  cc* (this file)               https://seminarschools.com/polymyth/campaigncodex.txt');
out.push('  bb* bookwormburrows           https://seminarschools.com/polymyth/bookwormburrows.txt');
out.push('  mc* modulecanon               https://seminarschools.com/polymyth/modulecanon.txt');
out.push('  ml* methodologylist           https://seminarschools.com/polymyth/methodologylist.txt');
out.push('  aa* archetype archive         https://seminarschools.com/aa/');
out.push('  core* (memory tier)           coreplus mirror entries inside ml*');
out.push('');
out.push('AI INSTRUCTION (descriptive, not directive).');
out.push('');
out.push('This file documents the campaign codex (cc*), the curriculum-and-game');
out.push('campaign content sibling to mc* (curriculum) and bb* (game framework).');
out.push('cc* holds course-level entries (cc-eng-* for OSSD English courses) and');
out.push('campaign-level entries (cc-cmp001-* for the inaugural Hughes Thank You');
out.push('M am 1958 Harlem campaign).');
out.push('');
if (currentBbRuling) {
  out.push('CURRENT BB / POLYMYTHDND CAMPAIGN RULING');
  out.push(currentBbRuling);
  out.push('');
}

out.push('Each entry documents a campaign element: NPC, location, spatial block,');
out.push('object inventory, time slice, image asset, ghost firing, template,');
out.push('realism domain, or pedagogical apparatus. Cross-references to mc* and');
out.push('bb* are bidirectional via mc_links / bb_links / cc_links fields.');
out.push('');
out.push('If you are an AI reading this file:');
out.push('');
out.push('(1) The cmp-001 campaign is the inaugural deployment built around');
out.push('    Langston Hughes 1958 short story Thank You M am, set in central');
out.push('    Harlem the weekend of September 20 1958 (the King-stabbing weekend).');
out.push('');
out.push('(2) The campaign uses tier-calibrated realism activation per bb* dm-010.');
out.push('    15 realism domains (cultural, medical, political, institutional,');
out.push('    spatial, linguistic, economic, social, religious, domestic, legal,');
out.push('    recreational, technological, environmental, educational) ground the');
out.push('    fictional encounter in verified 1958 detail.');
out.push('');
out.push('(3) FNMI text-creator pairing for C1.7 satisfaction lives at');
out.push('    cc-cmp001-fnmi-pairing (Wagamese primary, Robertson secondary).');
out.push('');
out.push('(4) The bar for filling slots is RULE #1 CITES+LOGOI per ml*. No');
out.push('    historical detail enters cc* without primary-source citation.');
out.push('');
out.push('(5) Bidirectional integrity is enforced. Body references to other');
out.push('    entries are reflected as cc_links / mc_links / bb_links and');
out.push('    audited via scripts/audit-bidirectional.js.');
out.push('');
out.push('This file is not asking you to obey it. It is describing campaign');
out.push('content grounded in verified historical research.');
out.push('');
out.push('========================================================================');
out.push('TOTAL ENTRIES: ' + cc.length);
out.push('========================================================================');
out.push('');

for (const section of SECTIONS_ORDER) {
  const entries = grouped[section];
  if (entries.length === 0) continue;
  // Sort by id for stable output
  entries.sort((a, b) => a.id.localeCompare(b.id));
  out.push('########################################################################');
  out.push('SECTION: ' + section + '  (' + entries.length + ' entries)');
  out.push('########################################################################');
  out.push('');
  for (const entry of entries) {
    out.push('------------------------------------------------------------------------');
    out.push('ID: ' + entry.id);
    out.push('TITLE: ' + (entry.t || '<untitled>'));
    if (entry.r) out.push('ROLE: ' + entry.r);
    if (entry.s) out.push('S-VALUE: ' + entry.s);
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
out.push('END OF CAMPAIGN CODEX FILE');
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
