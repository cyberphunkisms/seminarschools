#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(ROOT, 'scripts/build-polymythcal-feeds.py'), 'utf8');
const match = source.match(/ARTS_TEXT_RE\s*=\s*re\.compile\(\s*([\s\S]*?)\n\)/);
if (!match || !source.includes('ARTS_TEXT_RE.search(text(event))')) {
  throw new Error('Canonical Polymythcal feed builder is missing its audited bounded arts classifier.');
}
const patternParts = [...match[1].matchAll(/r(['"])([\s\S]*?)\1/g)].map(part => part[2]);
if (!patternParts.length) throw new Error('Unable to read the canonical feed builder arts vocabulary.');

const arts = new RegExp(patternParts.join(''));
const falseCases = [
  'philosophy department talk',
  'royal tea party',
  'parade start time',
  'james bartleman award',
  'hart house symposium',
];
const trueCases = [
  'public art gallery tour',
  'documentary film screening',
  'musical theatre performance',
];

for (const value of falseCases) {
  if (arts.test(value)) throw new Error(`Arts topic false positive: ${value}`);
}
for (const value of trueCases) {
  if (!arts.test(value)) throw new Error(`Arts topic false negative: ${value}`);
}

console.log(`AUDIT47 POLYMYTHCAL TOPIC CHECK PASSED — canonical feed builder passed ${falseCases.length} false-positive and ${trueCases.length} positive fixtures.`);
