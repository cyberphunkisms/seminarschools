const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'polymyth/methodologylist/index.html'), 'utf8');
const txt = fs.readFileSync(path.join(root, 'polymyth/methodologylist.txt'), 'utf8');
const saul = fs.readFileSync(path.join(root, 'saul/index.html'), 'utf8');
const required = [
  'Anti-backtracking affordance ledger, preserve the working thing before polishing it',
  'working affordance cannot be erased by a polish pass',
  'Before changing a live page, game surface, route, generator, or PDF/export behavior',
  'the old website allowed a modular CV selection such as Culinary Hospitality + Community',
  'restore it when lost, and add a verification guard',
  'front of /saul/ must stay an any-job modular CV builder'
];
for (const phrase of required) {
  if (!html.includes(phrase)) throw new Error(`ML* anti-backtracking entry missing from HTML canonical: ${phrase}`);
  if (!txt.includes(phrase)) throw new Error(`ML* anti-backtracking entry missing from TXT mirror: ${phrase}`);
}
if (!saul.includes('Modular CV tabs are additive')) throw new Error('Saul CV modularity comment missing.');
if (!saul.includes('active = next;')) throw new Error('Saul CV module selection does not preserve additive selection.');
if (saul.includes('active = wasOnly ? new Set() : new Set([cat])')) throw new Error('Backtracked single-select CV module logic returned.');
console.log('ML anti-backtracking guard passed.');
