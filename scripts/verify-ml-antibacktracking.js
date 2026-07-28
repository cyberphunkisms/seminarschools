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
  'front of /saul/ must stay an any-job modular CV builder',
  'PACKAGE CLASS PRECEDES SIZE — AUDIT49 52,901,995-BYTE DISCREPANCY',
  'Completeness is semantic and class-relative, not monotonic with byte count',
  'Read the internal integrity manifest and package_kind',
  'A deployer-compatible package must select public/',
  'A source package must exclude public/',
  'Never copy stale derived output or an old manifest merely to recover archive size',
  'Hash protected files before and after synthesis',
  'The exact difference was 52,901,995 bytes',
  '4,477 generated public/ files',
  '4,476 were byte-identical generated copies',
  'The unfinished #MeToo research layer remained byte-identical',
  'A materially smaller archive is a warning only after package classes are normalized; it is never proof by itself',
  'DEFAULT IS FULL/DEPLOYER-COMPATIBLE',
  'THREE PACKAGE LAYERS',
  'A published surface is not the same artifact as a source handoff or a full/deployer-compatible handoff',
  'public output strips tooling; source and full handoffs preserve the tooling their declared affordances require'
];
for (const phrase of required) {
  if (!html.includes(phrase)) throw new Error(`ML* anti-backtracking entry missing from HTML canonical: ${phrase}`);
  if (!txt.includes(phrase)) throw new Error(`ML* anti-backtracking entry missing from TXT mirror: ${phrase}`);
}
for (const staleRule of [
  'if current zip is materially smaller, it is wrong',
  'Strip the second class from every deploy zip',
  'tooling files never appear in deploy zips',
]) {
  if (html.includes(staleRule)) throw new Error(`ML* retains stale package rule in HTML: ${staleRule}`);
  if (txt.includes(staleRule)) throw new Error(`ML* retains stale package rule in TXT: ${staleRule}`);
}
if (!saul.includes('Modular CV tabs are additive')) throw new Error('Saul CV modularity comment missing.');
if (!saul.includes('active = next;')) throw new Error('Saul CV module selection does not preserve additive selection.');
if (saul.includes('active = wasOnly ? new Set() : new Set([cat])')) throw new Error('Backtracked single-select CV module logic returned.');
console.log('ML anti-backtracking guard passed.');
