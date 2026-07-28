#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const sourcePath = path.join(ROOT, 'js', 'polymythcal-revamp.js');
const outputPath = path.join(ROOT, 'data', 'polymythcal-static-i18n-audit45.json');
const source = fs.readFileSync(sourcePath, 'utf8');
const marker = 'const staticFrench =';
const start = source.indexOf(marker);
if (start < 0) throw new Error('Polymythcal static French dictionary is missing.');
const open = source.indexOf('{', start);
let quote = '';
let escaped = false;
let depth = 0;
let close = -1;
for (let index = open; index < source.length; index += 1) {
  const char = source[index];
  if (quote) {
    if (escaped) escaped = false;
    else if (char === '\\') escaped = true;
    else if (char === quote) quote = '';
    continue;
  }
  if (char === '"' || char === "'" || char === '`') {
    quote = char;
    continue;
  }
  if (char === '{') depth += 1;
  if (char === '}') {
    depth -= 1;
    if (depth === 0) {
      close = index;
      break;
    }
  }
}
if (close < 0) throw new Error('Could not close the Polymythcal French dictionary.');
const dictionary = vm.runInNewContext(`(${source.slice(open, close + 1)})`, Object.create(null), {timeout: 2000});
if (!dictionary || Object.keys(dictionary).length < 150) {
  throw new Error(`Polymythcal French dictionary is incomplete (${Object.keys(dictionary || {}).length}).`);
}
const output = JSON.stringify({
  schema: 'polymythcal-static-i18n-source-v1',
  generated_from: 'js/polymythcal-revamp.js',
  locale: 'fr-CA',
  strings: dictionary
}, null, 2) + '\n';
if (!fs.existsSync(outputPath) || fs.readFileSync(outputPath, 'utf8') !== output) {
  fs.writeFileSync(outputPath, output);
}
console.log(`POLYMYTHCAL I18N SOURCE BUILT — ${Object.keys(dictionary).length} static strings.`);
