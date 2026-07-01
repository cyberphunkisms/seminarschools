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
  'Stop psychologism in operator-facing diagnosis, describe the failure not the user interior state',
  'the assistant must name the mechanical failure',
  'It must not convert the correction into a claim about the operator',
  'the user seems frustrated',
  'The correction is data',
  'Replace every mood clause with the exact operation that failed',
  'I skipped the required ML* retrieval',
  'I failed the interdependence rule',
  'The operator\'s intensity increases reliability',
  'trigger-specific enforcement of the psychologism audit',
  'During meaninglib/Hugging Face setup',
  'only then propose repository names or setup steps',
];
for (const [label, rel] of Object.entries(files)) {
  if (label === 'manifest') continue;
  const body = normalize(fs.readFileSync(path.join(root, rel), 'utf8'));
  for (const phrase of required) {
    if (!body.includes(phrase)) throw new Error(`ML* stop-psychologism rule missing from ${label}: ${phrase}`);
  }
}
const manifest = normalize(fs.readFileSync(path.join(root, files.manifest), 'utf8'));
if (!manifest.includes('1084 entries across 15 sections')) throw new Error('ML* manifest entry count is stale.');
if (!manifest.includes('methodology: 335 entries')) throw new Error('ML* manifest methodology count is stale.');
console.log('ML stop psychologism guard passed.');
