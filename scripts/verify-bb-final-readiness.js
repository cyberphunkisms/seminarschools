#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = rel => fs.existsSync(path.join(ROOT, rel));
const failures = [];
const must = (label, ok) => { if(!ok) failures.push(label); };

const pages = [
  'bb/index.html',
  'bookwormcard/index.html',
  'bookwormcard/about/index.html',
  'bookwormcard/glossary/index.html',
  'bookwormcard/print/index.html',
  'bookwormcard/success/index.html',
  'bb/why/index.html',
  'polymyth/bookwormburrows/index.html'
];

function localTarget(from, url){
  const clean = String(url || '').split('#')[0].split('?')[0];
  if(!clean || /^(https?:|mailto:|tel:|data:|#|\/\/)/.test(clean)) return null;
  if(clean.startsWith('/')) return clean.replace(/^\//,'');
  return path.posix.normalize(path.posix.join(path.posix.dirname(from), clean));
}

for(const page of pages){
  const html = read(page);
  const refRe = /<(script|link|img|a)\b[^>]*(?:src|href)=["']([^"']+)["'][^>]*>/gi;
  let m;
  while((m = refRe.exec(html))){
    const target = localTarget(page, m[2]);
    if(!target) continue;
    const targetPath = path.join(ROOT, target);
    const ok = fs.existsSync(targetPath) || fs.existsSync(path.join(targetPath, 'index.html'));
    must(`${page} local asset/link exists: ${m[2]}`, ok);
  }
}

const app = read('bookwormcard/index.html');
const print = read('bookwormcard/print/index.html');
const landing = read('bb/index.html');
const op = read('polymyth/bookwormburrows/index.html');

must('Bookwormcard loads depth-engine.js before reactions.js', app.indexOf('depth-engine.js') > -1 && app.indexOf('depth-engine.js') < app.indexOf('reactions.js'));
must('Bookwormcard no longer references missing character engine.js', !app.includes('character engine.js'));
must('Depth engine file exists', exists('bookwormcard/depth-engine.js'));
must('Student start card is styled', /#student-start-card\{/.test(app) && /Start my wormcard/.test(app));
must('Student start card hides after play begins', /body\.wormcard-started #student-start-card\{display:none\}/.test(app) && /function markWormcardStarted\(\)/.test(app));
must('Desktop/mobile command bar has toolbar semantics', /id="touch-bar" role="toolbar" aria-label="wormcard controls"/.test(app));
must('Command buttons include back skip why finish enter', /data-action="back"/.test(app) && /data-action="skip"/.test(app) && /data-action="why"/.test(app) && /data-action="finish"/.test(app) && /data-action="enter"/.test(app));
must('Phase labels cover the full play arc', /Animal/.test(app) && /Deep Questions/.test(app) && /Review/.test(app) && /STAGE_MAP/.test(app));
must('Save key migration reads current and legacy checkpoints', /bb_wormcard_checkpoint_v2/.test(app) && /bb_wormcard_checkpoint_v1/.test(app) && /LEGACY_SAVE_KEYS/.test(app));
must('Print template reads current and legacy checkpoint keys', /bb_wormcard_checkpoint_v2/.test(print) && /bb_wormcard_checkpoint_v1/.test(print));
must('Print path has popup fallback link', /function openBookwormcardWindow/.test(app) && /Save my wormcard as PDF/.test(app));
must('File resume input is accessible to the picker link', /id="resume-from-file"/.test(app) && /id="resume-file-input"/.test(app) && !/id="resume-file-input"[^>]*aria-hidden="true"/.test(app));
must('Mobile copy frames desktop as the smooth save path', /desktop gives the smooth save-as-PDF flow/.test(app));
must('Landing page separates wormcard, DM table assistant, rule library, and why page', /Make your wormcard/.test(landing) && /Open a burrow with wormcards/.test(landing) && /Teacher rule library/.test(landing) && /Read why it helps learning/.test(landing));
must('Teacher tools are tucked in a details drawer', /<details class="teacher-tools"/.test(op) && /<summary>teacher tools/.test(op));

const seedMatch = op.match(/const SEED = \[([\s\S]*?)\];\n\nlet entries/);
let seedCount = 0;
if(seedMatch){
  seedCount = vm.runInNewContext('const SEED = [' + seedMatch[1] + ']; SEED.length;', {});
}
must('BB operation library preserves all 221 entries', seedCount === 221);

if(failures.length){
  console.error('BB final readiness verification failed:');
  for(const failure of failures) console.error(' - ' + failure);
  process.exit(1);
}
console.log('BB final readiness verification passed: local assets, depth engine load, start flow, command controls, save migration, print fallback, and 221-entry library all checked.');
