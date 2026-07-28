#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(ROOT, 'js/polymythcal-revamp.js'), 'utf8');
const match = source.match(/const ARTS_TOPIC_RE = \/(.+)\/;/);
if (!match) throw new Error('Polymythcal arts topic classifier is missing its audited bounded vocabulary.');

const arts = new RegExp(match[1]);
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

console.log(`AUDIT47 POLYMYTHCAL TOPIC CHECK PASSED — ${falseCases.length} false-positive and ${trueCases.length} positive fixtures.`);
