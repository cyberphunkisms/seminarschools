#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const rootPage = path.join(ROOT, 'polymyth', 'index.html');
const publicPage = path.join(ROOT, 'public', 'polymyth', 'index.html');
const petAsset = path.join(ROOT, 'polymyth', 'img', 'mephistodata-waving.png');
const publicPetAsset = path.join(ROOT, 'public', 'polymyth', 'img', 'mephistodata-waving.png');
const activation = path.join(ROOT, 'polymyth', 'mephistodata-activation.md');
const hfActivation = path.join(ROOT, 'hf_export', 'ai_access_pack', 'MEPHISTODATA_ACTIVATION.md');
const coherencePage = path.join(ROOT, 'polymyth', 'coherence', 'index.html');
const publicCoherencePage = path.join(ROOT, 'public', 'polymyth', 'coherence', 'index.html');
const coherenceWorkbook = path.join(ROOT, 'polymyth', 'coherence', 'Polymyth_Coherence_V5.1.1.xlsx');
const publicCoherenceWorkbook = path.join(ROOT, 'public', 'polymyth', 'coherence', 'Polymyth_Coherence_V5.1.1.xlsx');
const editableCoherenceWorkbook = path.join(ROOT, '..', 'EDITABLE_MASTERS', '07_POLYMYTH_COHERENCE', 'Polymyth_Coherence.xlsx');
const coherenceAddendum = path.join(ROOT, 'polymyth', 'methodologylist', 'polymyth-coherence-routing-addendum.js');
const coherenceHash = '3fff72a7271a705b4d674165afd4fc52d5e9681a85cd5aa78582890d073ac4c5';
const required = [
  'href="methodologylist/"',
  'id="mlCopy"',
  'href="methodologylist.txt" download',
  'href="coherence/"',
  'href="mephistodata-activation.md" download',
  'https://huggingface.co/datasets/SeminarSchools/meaninglib',
  'aria-label="Mephistodata entry points"'
];
const coherenceRequired = [
  'https://seminarschools.com/polymyth/coherence/',
  'data-route-type="archive"',
  'data-geometry-role="relation movement"',
  'Polymyth_Coherence_V5.1.1.xlsx',
  'Download the workbook',
  'Internal is the absolute gate.',
  'Individual media audits remain separate application files and cannot alter the instrument.',
  'ML* routes here; it does not duplicate the instrument.',
];
const petRequired = [
  'https://chatgpt.com/s/sharepet_6a74bbaba5e08191bfc0950076228f7f',
  'Open Mephistodata in ChatGPT',
  'src="img/mephistodata-waving.png"',
  'Add the animated devil-android to ChatGPT Work.'
];
function fail(msg){ console.error('POLYMYTH ENTRY POINTS FAILED — ' + msg); process.exit(1); }
for (const file of [
  rootPage, publicPage, activation, hfActivation, petAsset, publicPetAsset,
  coherencePage, publicCoherencePage, coherenceWorkbook,
  publicCoherenceWorkbook, editableCoherenceWorkbook, coherenceAddendum,
]) {
  if (!fs.existsSync(file)) fail('missing ' + path.relative(ROOT, file));
}
for (const file of [rootPage, publicPage]) {
  const html = fs.readFileSync(file, 'utf8');
  for (const token of required) if (!html.includes(token)) fail(`${path.relative(ROOT, file)} missing ${token}`);
  for (const token of petRequired) if (!html.includes(token)) fail(`${path.relative(ROOT, file)} missing ${token}`);
}
if (!fs.readFileSync(rootPage).equals(fs.readFileSync(publicPage))) fail('source/public Polymyth pages differ');
for (const file of [coherencePage, publicCoherencePage]) {
  const html = fs.readFileSync(file, 'utf8');
  for (const token of coherenceRequired) {
    if (!html.includes(token)) fail(`${path.relative(ROOT, file)} missing ${token}`);
  }
}
if (!fs.readFileSync(coherencePage).equals(fs.readFileSync(publicCoherencePage))) {
  fail('source/public Polymyth Coherence pages differ');
}
function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
for (const file of [coherenceWorkbook, publicCoherenceWorkbook, editableCoherenceWorkbook]) {
  if (sha256(file) !== coherenceHash) {
    fail(`${path.relative(ROOT, file)} is not the repaired canonical V5.1.1 workbook`);
  }
}
const petBytes = fs.readFileSync(petAsset);
const publicPetBytes = fs.readFileSync(publicPetAsset);
if (!petBytes.length || !petBytes.equals(publicPetBytes)) fail('source/public pet assets are empty or differ');
if (petBytes.length < 24 || petBytes.toString('hex', 1, 4) !== '504e47') fail('pet asset is not a PNG');
const width = petBytes.readUInt32BE(16);
const height = petBytes.readUInt32BE(20);
if (width !== 192 || height !== 208) fail(`pet asset dimensions are ${width}x${height}, expected 192x208`);
if (fs.readFileSync(activation, 'utf8') !== fs.readFileSync(hfActivation, 'utf8')) {
  fail('public activation file is stale');
}
console.log('POLYMYTH ENTRY POINTS PASSED — activation routes, pet share card, Polymyth Coherence page, repaired canonical workbook, synchronized assets, and activation file verified.');
