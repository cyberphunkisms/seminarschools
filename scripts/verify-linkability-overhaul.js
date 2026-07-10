#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const vocabPath = path.join(ROOT, 'polymyth/concordance/vocabulary.json');
const publicVocabPath = path.join(ROOT, 'public/polymyth/concordance/vocabulary.json');
const idxPath = path.join(ROOT, 'polymyth/concordance/concordance-index.json');
const publicIdxPath = path.join(ROOT, 'public/polymyth/concordance/concordance-index.json');
const autoPath = path.join(ROOT, 'js/autolink.js');
const mlPath = path.join(ROOT, 'polymyth/methodologylist.txt');
const failures = [];
function fail(m){ failures.push(m); }
function readJSON(p){ try { return JSON.parse(fs.readFileSync(p,'utf8')); } catch(e){ fail('cannot read JSON: '+path.relative(ROOT,p)+' '+e.message); return null; } }
if (!fs.existsSync(vocabPath)) fail('missing root vocabulary.json');
const vocab = readJSON(vocabPath) || { terms: [] };
const terms = vocab.terms || [];
const canon = new Set(terms.map(t => t.canonical));
if (terms.length < 700) fail('vocabulary registry too small: '+terms.length+' terms');
for (const k of ['equifinality','collective-synchronicity','always-already','taboo','persona','devils-dictionary','malefactor','bbt','rainbowmagic','surface-translation-firewall','verbatim-preservation-gate','bookwormburrows','methodologylist']) {
  if (!canon.has(k)) fail('missing key term: '+k);
}
for (const t of terms) {
  if (!t.canonical || !t.pattern) fail('term missing canonical/pattern');
  try { new RegExp(t.pattern, 'gi'); } catch(e) { fail('bad regex for '+t.canonical+': '+e.message); }
}
const auto = fs.existsSync(autoPath) ? fs.readFileSync(autoPath,'utf8') : '';
if (!auto.includes('main h1') || !auto.includes('article li') || !auto.includes('data-no-autolink')) fail('autolink selectors/protection not hardened');
const idx = readJSON(idxPath) || { terms: {} };
if (!idx.totalTerms || idx.totalTerms < 500) fail('concordance index too small: '+(idx.totalTerms || 0));
for (const k of ['equifinality','collective-synchronicity','always-already','taboo','persona','bookwormburrows']) {
  if (!idx.terms || !idx.terms[k] || !idx.terms[k].count) fail('concordance missing references for '+k);
}
if (fs.existsSync(publicVocabPath)) {
  const a = fs.readFileSync(vocabPath,'utf8');
  const b = fs.readFileSync(publicVocabPath,'utf8');
  if (a !== b) fail('public vocabulary differs from root vocabulary');
}
if (fs.existsSync(publicIdxPath)) {
  const a = fs.readFileSync(idxPath,'utf8');
  const b = fs.readFileSync(publicIdxPath,'utf8');
  if (a !== b) fail('public concordance index differs from root concordance index');
}
if (!fs.existsSync(mlPath) || !fs.readFileSync(mlPath,'utf8').includes('Linkability overhaul: generated clickable lexicon')) fail('ML* linkability doctrine not present in text mirror');
for (const raw of ['polymyth/methodologylist.txt','polymyth/bookwormburrows.txt','polymyth/campaigncodex.txt','polymyth/modulecanon.txt']) {
  const p = path.join(ROOT, raw);
  if (fs.existsSync(p)) {
    const rawText = fs.readFileSync(p,'utf8');
    if (/class=[\"']ci-link/.test(rawText) || /href=[\"']\/polymyth\/concordance\/\?term=/.test(rawText)) fail('raw star-file text contains generated concordance links: '+raw);
  }
}
if (failures.length) {
  console.error('LINKABILITY OVERHAUL VERIFY FAILED');
  failures.forEach(f => console.error(' - '+f));
  process.exit(1);
}
console.log('LINKABILITY OVERHAUL VERIFY PASSED — '+terms.length+' vocabulary terms, '+idx.totalTerms+' concordance terms, '+idx.totalReferences+' references.');
