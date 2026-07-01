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
const manifest = normalize(fs.readFileSync(path.join(root, files.manifest), 'utf8'));
if (!manifest.includes('1084 entries across 15 sections')) throw new Error('ML* manifest entry count is stale.');
if (!manifest.includes('methodology: 335 entries')) throw new Error('ML* manifest methodology count is stale.');
console.log('ML AI prose tells guard passed.');
