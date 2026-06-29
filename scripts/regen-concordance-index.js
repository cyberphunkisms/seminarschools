#!/usr/bin/env node
/**
 * regen-concordance-index.js
 *
 * Parses SEED arrays from all star pages, builds a concordance index
 * mapping each contentinternet vocabulary term to every entry that
 * contains it (title, body, extra, or tags).
 *
 * Output: data/concordance-index.json
 *
 * Usage:
 *   node scripts/regen-concordance-index.js
 *   node scripts/regen-concordance-index.js --dry-run
 */

'use strict';

const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');

const scriptDir = path.dirname(__filename);
const projectRoot = path.dirname(scriptDir);

// ── Star pages with SEED arrays ──
const SOURCES = [
  { id: 'ml', label: 'methodologylist*', file: 'polymyth/methodologylist/index.html', url: '/polymyth/methodologylist/' },
  { id: 'bb', label: 'bookwormburrows*', file: 'polymyth/bookwormburrows/index.html', url: '/polymyth/bookwormburrows/' },
  { id: 'cc', label: 'campaigncodex*',   file: 'polymyth/campaigncodex/index.html',   url: '/polymyth/campaigncodex/' },
  { id: 'mc', label: 'modulecanon*',     file: 'polymyth/modulecanon/index.html',     url: '/polymyth/modulecanon/' },
];

// ── Contentinternet vocabulary (loaded from single source of truth) ──
const VOCAB_PATH = path.join(projectRoot, 'polymyth/concordance/vocabulary.json');
if (!fs.existsSync(VOCAB_PATH)) {
  console.error('Vocabulary file not found:', VOCAB_PATH);
  process.exit(2);
}
const vocabData = JSON.parse(fs.readFileSync(VOCAB_PATH, 'utf-8'));
const VOCAB = vocabData.terms.map(t => [t.canonical, new RegExp(t.pattern, 'i')]);
console.log('Loaded', VOCAB.length, 'terms from vocabulary.json');

// ── SEED parser (bracket-depth walk, same as regen-methodologylist-txt.js) ──
function parseSeedArray(filePath) {
  const html = fs.readFileSync(filePath, 'utf-8');
  const seedIdx = html.indexOf('const SEED');
  if (seedIdx === -1) return [];
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
  if (arrEnd === -1) return [];
  try {
    return eval(html.slice(arrStart, arrEnd + 1));
  } catch (e) {
    console.error('Failed to parse SEED in', filePath, e.message);
    return [];
  }
}

// ── Slug generator (matches star-page convention) ──
function slug(str) {
  return (str || '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

// ── Context snippet extractor ──
// Returns the sentence or clause surrounding the first match, max ~200 chars
function extractSnippet(text, term, regex) {
  regex.lastIndex = 0;
  const m = regex.exec(text);
  if (!m) return null;
  const idx = m.index;
  const start = Math.max(0, text.lastIndexOf('.', idx) + 1, idx - 100);
  const end = Math.min(text.length, text.indexOf('.', idx + m[0].length) + 1 || idx + 150);
  let snip = text.slice(start, end).trim();
  if (start > 0) snip = '\u2026' + snip;
  if (end < text.length) snip = snip + '\u2026';
  return snip;
}

// ── Main ──
const index = {};
let totalEntries = 0;

for (const src of SOURCES) {
  const fullPath = path.join(projectRoot, src.file);
  if (!fs.existsSync(fullPath)) {
    console.log('Skipping', src.id, '- file not found:', fullPath);
    continue;
  }
  const seed = parseSeedArray(fullPath);
  console.log('Parsed', seed.length, 'entries from', src.id + '*');
  totalEntries += seed.length;

  for (const entry of seed) {
    const entryId = entry.id || entry.s + '-' + slug(entry.t);
    const entryTitle = entry.t || '';
    const entrySection = entry.s || '';
    const searchable = [entry.t || '', entry.b || '', entry.x || '', entry.tg || ''].join(' ');

    for (const [canonical, regex] of VOCAB) {
      regex.lastIndex = 0;
      if (!regex.test(searchable)) continue;

      if (!index[canonical]) {
        index[canonical] = { count: 0, entries: [] };
      }

      const snippet = extractSnippet(entry.b || entry.t || '', canonical, regex);

      index[canonical].entries.push({
        id: entryId,
        t: entryTitle.slice(0, 200),
        s: entrySection,
        src: src.id,
        url: src.url + '#' + entryId,
        snip: snippet ? snippet.slice(0, 250) : null,
      });
      index[canonical].count++;
    }
  }
}

// ── Summary ──
const terms = Object.keys(index);
let totalRefs = 0;
for (const t of terms) totalRefs += index[t].count;
console.log('\nConcordance index: ' + terms.length + ' terms, ' + totalRefs + ' references across ' + totalEntries + ' entries');

// ── Output ──
const OUTPUT_PATH = path.join(projectRoot, 'polymyth/concordance/concordance-index.json');

const output = {
  generated: new Date().toISOString(),
  totalTerms: terms.length,
  totalReferences: totalRefs,
  totalEntries: totalEntries,
  sources: SOURCES.map(s => ({ id: s.id, label: s.label, url: s.url })),
  terms: index,
};

if (dryRun) {
  console.log('\n[DRY RUN] Would write', OUTPUT_PATH);
  console.log('Top 10 terms by reference count:');
  terms.sort((a, b) => index[b].count - index[a].count);
  for (let i = 0; i < Math.min(10, terms.length); i++) {
    console.log('  ' + index[terms[i]].count + '  ' + terms[i]);
  }
} else {
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output));
  const size = fs.statSync(OUTPUT_PATH).size;
  console.log('Wrote', OUTPUT_PATH, '(' + (size / 1024).toFixed(0) + ' KB)');
}
