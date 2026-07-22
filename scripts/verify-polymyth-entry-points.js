#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const rootPage = path.join(ROOT, 'polymyth', 'index.html');
const publicPage = path.join(ROOT, 'public', 'polymyth', 'index.html');
const activation = path.join(ROOT, 'polymyth', 'mephistodata-activation.md');
const hfActivation = path.join(ROOT, 'hf_export', 'ai_access_pack', 'MEPHISTODATA_ACTIVATION.md');
const required = [
  'href="methodologylist/"',
  'id="mlCopy"',
  'href="methodologylist.txt" download',
  'href="mephistodata-activation.md" download',
  'https://huggingface.co/datasets/SeminarSchools/meaninglib',
  'aria-label="Mephistodata entry points"'
];
function fail(msg){ console.error('POLYMYTH ENTRY POINTS FAILED — ' + msg); process.exit(1); }
for (const file of [rootPage, publicPage, activation, hfActivation]) {
  if (!fs.existsSync(file)) fail('missing ' + path.relative(ROOT, file));
}
for (const file of [rootPage, publicPage]) {
  const html = fs.readFileSync(file, 'utf8');
  for (const token of required) if (!html.includes(token)) fail(`${path.relative(ROOT, file)} missing ${token}`);
}
if (fs.readFileSync(activation, 'utf8') !== fs.readFileSync(hfActivation, 'utf8')) {
  fail('public activation file is stale');
}
console.log('POLYMYTH ENTRY POINTS PASSED — five public activation routes and synchronized activation file verified.');
