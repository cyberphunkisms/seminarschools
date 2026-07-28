#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const sourcePath = path.join(ROOT, 'leizu', 'index.html');
const outputPath = path.join(ROOT, 'data', 'leizu-i18n-audit45.json');
const html = fs.readFileSync(sourcePath, 'utf8');
const start = html.indexOf('const I18N =');
const finishMarker = 'Object.assign(I18N.fa, LEIZU_PERSIAN_REVAMP_COPY);';
const finish = html.indexOf(finishMarker, start);
if (start < 0 || finish < 0) {
  throw new Error('Could not isolate the canonical Leizu translation dictionaries.');
}
const program = html.slice(start, finish + finishMarker.length)
  + '\nglobalThis.__leizuI18n = I18N;';
const context = Object.create(null);
vm.runInNewContext(program, context, {timeout: 3000, filename: 'leizu-i18n-source.js'});
const dictionaries = context.__leizuI18n;
for (const locale of ['en', 'fr', 'zh', 'zhs', 'fa']) {
  if (!dictionaries || !dictionaries[locale] || Object.keys(dictionaries[locale]).length < 200) {
    throw new Error(`Leizu ${locale} dictionary is incomplete.`);
  }
}
const output = JSON.stringify({
  schema: 'leizu-static-i18n-source-v1',
  generated_from: 'leizu/index.html',
  locales: dictionaries
}, null, 2) + '\n';
if (!fs.existsSync(outputPath) || fs.readFileSync(outputPath, 'utf8') !== output) {
  fs.writeFileSync(outputPath, output);
}
console.log(
  'LEIZU I18N SOURCE BUILT — '
  + Object.entries(dictionaries).map(([key, value]) => `${key}=${Object.keys(value).length}`).join(', ')
);
