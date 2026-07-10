const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const files = {
  canonical: 'polymyth/methodologylist/index.html',
  fullText: 'polymyth/methodologylist.txt',
  sectionText: 'polymyth/methodologylist-methodology.txt',
  staticSection: 'polymyth/methodologylist/methodology/index.html',
  manifest: 'polymyth/manifest.txt',
};
function normalize(body) {
  return body
    .replace(/\\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}
const required = [
  'AI prose tells as smoothness failure, law review convergence rule',
  'smoothness as failure signal',
  'performs reasoning instead of executing it',
  'Not merely X, but Y',
  'Bar clarity colon verdicts',
  'Delete mic drop closure such as "That matters"',
  'abstract noun chains',
  'vague institutional dread',
  'angled apostrophes',
  'Keep the dash ban active',
  'Preserve sustained paragraphs',
  'Any sentence whose main work is sounding scholarly',
];
for (const [label, rel] of Object.entries(files)) {
  if (label === 'manifest') continue;
  const body = normalize(fs.readFileSync(path.join(root, rel), 'utf8'));
  for (const phrase of required) {
    if (!body.includes(phrase)) throw new Error(`ML* AI prose tell rule missing from ${label}: ${phrase}`);
  }
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
const ml = parseSeedArray(path.join(root, files.canonical));
const bySection = new Map();
for (const e of ml) bySection.set(e.s || 'unknown', (bySection.get(e.s || 'unknown') || 0) + 1);
const sectionCount = bySection.size;
const methodologyCount = bySection.get('methodology') || 0;
const manifest = normalize(fs.readFileSync(path.join(root, files.manifest), 'utf8'));
if (!manifest.includes(`${ml.length} entries across ${sectionCount} sections`)) throw new Error('ML* manifest entry count is stale.');
if (!manifest.includes(`methodology: ${methodologyCount} entries`)) throw new Error('ML* manifest methodology count is stale.');
console.log('ML AI prose tells guard passed.');
