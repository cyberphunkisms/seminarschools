#!/usr/bin/env node
'use strict';

/** Regression gate for the 2026-08-04 user-directed ML* power-scope fix. */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const failures = [];
const files = new Set();

function add(relative) {
  const target = path.join(ROOT, relative);
  if (fs.existsSync(target) && fs.statSync(target).isFile()) files.add(relative);
}

function addTree(relative, extensions) {
  const target = path.join(ROOT, relative);
  if (!fs.existsSync(target)) return;
  for (const entry of fs.readdirSync(target, {withFileTypes: true})) {
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) addTree(child, extensions);
    else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) add(child);
  }
}

for (const relative of [
  'polymyth/methodologylist/index.html',
  'polymyth/methodologylist.txt',
  'polymyth/modulecanon/index.html',
  'polymyth/modulecanon.txt',
  'polymyth/devilsdiary/3/index.html',
  'polymyth/devilsdiary/6/index.html',
  'polymyth/devilsdiary/7/index.html',
  'polymyth/concordance/concordance-index.json',
  'public/polymyth/methodologylist/index.html',
  'public/polymyth/methodologylist.txt',
  'public/polymyth/modulecanon/index.html',
  'public/polymyth/modulecanon.txt',
  'public/polymyth/devilsdiary/3/index.html',
  'public/polymyth/devilsdiary/6/index.html',
  'public/polymyth/devilsdiary/7/index.html',
  'public/polymyth/concordance/concordance-index.json',
]) add(relative);

for (const name of fs.readdirSync(path.join(ROOT, 'polymyth'))) {
  if (/^methodologylist-.*\.txt$/.test(name)) add(`polymyth/${name}`);
}
if (fs.existsSync(path.join(ROOT, 'public', 'polymyth'))) {
  for (const name of fs.readdirSync(path.join(ROOT, 'public', 'polymyth'))) {
    if (/^methodologylist-.*\.txt$/.test(name)) add(`public/polymyth/${name}`);
  }
}
addTree('polymyth/methodologylist', ['.html']);
addTree('public/polymyth/methodologylist', ['.html']);
addTree('hf_export/data', ['.json', '.jsonl']);
addTree('hf_export/search', ['.json', '.jsonl']);
addTree('hf_export/ai_access_pack', ['.md', '.json']);

const banned = /material[\s-]+(?:power|dominance|reproduction)/i;
for (const relative of [...files].sort()) {
  const source = fs.readFileSync(path.join(ROOT, relative), 'utf8');
  const match = banned.exec(source);
  if (match) failures.push(`${relative} retains superseded wording: ${match[0]}`);
}

function requireText(relative, needle, label) {
  const source = fs.readFileSync(path.join(ROOT, relative), 'utf8');
  if (!source.includes(needle)) failures.push(`${relative} misses ${label}`);
}

const canonical = 'polymyth/methodologylist/index.html';
requireText(
  canonical,
  'it serves the reproduction of a specific power-formation, AND (b) it operates as prepackaged not-thinking',
  'the corrected two-condition test',
);
requireText(
  canonical,
  'SCOPE GUARD. This is a phrase-classification test, not a master importance measure and not a rule for deciding which gorgonifications deserve attention.',
  'the classifier/attention boundary',
);
requireText(
  canonical,
  'Attention triage belongs to sequential engagement and the Sabachtan killswitch',
  'the internal-logic attention route',
);
requireText(
  canonical,
  'When an older memory mirror conflicts, this ML* entry wins.',
  'the current CORE slot 4 authority rule',
);
requireText(
  canonical,
  'Material effects may appear inside a case’s gorgonification spiral but are never the required or exclusive power criterion.',
  'the spiral/material-effects boundary',
);
requireText(
  'polymyth/modulecanon/index.html',
  'serves reproduction of a specific power-formation AND operates as prepackaged not-thinking',
  'the corrected curriculum test',
);

if (failures.length) {
  console.error('ML* POWER SCOPE VERIFICATION FAILED');
  failures.forEach(failure => console.error(` - ${failure}`));
  process.exit(1);
}

console.log(`ML* POWER SCOPE VERIFIED — ${files.size} active source/mirror files checked`);
