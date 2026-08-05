#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const fail = [];
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const exists = relative => fs.existsSync(path.join(root, relative));
const has = (relative, token) => {
  if (!exists(relative) || !read(relative).includes(token)) fail.push(relative + ': missing ' + token);
};
const lacks = (relative, token) => {
  if (exists(relative) && read(relative).includes(token)) fail.push(relative + ': contains ' + token);
};

if (!/^\d{4}-\d{2}-\d{2}-.+/.test(read('RELEASE_ID.txt').trim())) fail.push('release id malformed');
for (const token of [
  'data-homepage-contract="business-card-project-web-v1"',
  'id="projectMap"',
  'aria-hidden="true" focusable="false"',
  'id="projectPanel" aria-live="polite" aria-atomic="true"',
  'id="projectList"',
  "detail.className='mobile-project-detail'",
  "button.setAttribute('aria-expanded','false')",
  "button.setAttribute('aria-controls',detail.id)",
  "button.addEventListener('click',()=>selectProject(selectedId===project.id?null:project.id))",
  '@media(max-width:760px)',
  '.project-map{pointer-events:none}',
  '.mobile-project-detail[hidden]{display:none}',
  'min-height:44px',
]) has('index.html', token);
for (const token of [
  'id="audit12-mobile-web-hybrid"',
  'id="audit12-mobile-web-hybrid-script"',
  'id="mapRail"',
  "g.addEventListener('click',()=>window.location.assign(n.href))",
  "window.location.assign(n.href)",
  'button.tabIndex=on?0:-1',
]) lacks('index.html', token);

for (const token of ['CL-WEB-112', 'CL-WEB-113', 'CL-WEB-114', 'CL-WEB-115', 'CL-WEB-301 — Resolved']) {
  has('WEBSITE_CL_2026-07-19.md', token);
}
for (const relative of [
  'scripts/apply-audit12-mobile-web-hybrid.py',
  'scripts/verify-audit12-mobile-web-hybrid.js',
  'docs/WEBSITE_MOBILE_WEB_HYBRID_AUDIT12_2026-07-19.md',
]) {
  if (!exists(relative)) fail.push(relative + ': missing historical record');
}
lacks('scripts/build-saul-cv-professional.py', 'apply-audit12-mobile-web-hybrid.py');
has('scripts/verify-all-runner.js', 'verify-audit12-mobile-web-hybrid.js');
has('package.json', 'verify:audit12');

if (exists('public/index.html')) {
  for (const token of [
    'data-homepage-contract="business-card-project-web-v1"',
    'id="projectMap"',
    "detail.className='mobile-project-detail'",
  ]) has('public/index.html', token);
}

if (fail.length) {
  console.error('AUDIT12 CURRENT MOBILE WEB CONTRACT FAILED');
  fail.forEach(item => console.error(' - ' + item));
  process.exit(1);
}
console.log('AUDIT12 CURRENT MOBILE WEB CONTRACT PASSED — overview map, inline mobile descriptions, practical touch targets, and preview-before-open behavior verified.');
