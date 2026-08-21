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
const matches = (relative, pattern, label) => {
  if (!exists(relative) || !pattern.test(read(relative))) fail.push(relative + ': missing ' + label);
};

if (!/^\d{4}-\d{2}-\d{2}-.+/.test(read('RELEASE_ID.txt').trim())) fail.push('release id malformed');
for (const token of [
  'data-homepage-contract="business-card-project-web-v1"',
  'id="projectMap"',
  'aria-hidden="true" focusable="false"',
  'data-preview-layout="stacked-max-content"',
  'id="projectList"',
  'const state={selectedId:null}',
  "previews.set('none',panel.querySelector('[data-preview-id=\"none\"]'))",
  "preview.className='project-preview-card'",
  "button.setAttribute('aria-pressed','false')",
  "button.setAttribute('aria-controls',panel.id)",
  "button.addEventListener('click',()=>setSelectedProject(state.selectedId===project.id?null:project.id))",
  "group.addEventListener('click',()=>setSelectedProject(state.selectedId===project.id?null:project.id))",
  "preview.toggleAttribute('inert',!active)",
  'panel.dataset.selectedId=activePreviewId',
  '@media(max-width:760px)',
  '.project-map{pointer-events:none}',
  '.project-preview-card.is-current{visibility:visible;pointer-events:auto}',
  'min-height:44px',
]) has('index.html', token);
matches(
  'index.html',
  /<aside\b(?=[^>]*\bid="projectPanel")(?=[^>]*\bdata-preview-layout="stacked-max-content")(?=[^>]*\baria-live="polite")(?=[^>]*\baria-atomic="true")[^>]*>/,
  'one order-independent, live shared preview region',
);
matches(
  'index.html',
  /\.project-preview-card\{(?=[^}]*\bgrid-area:1\/1)(?=[^}]*\bvisibility:hidden)(?![^}]*\bposition:absolute)[^}]*\}/,
  'stacked preview cards that reserve the maximum wrapped height',
);
matches(
  'index.html',
  /@media\(max-width:760px\)\{[\s\S]*?\.project-panel\{display:grid;/,
  'the same stable shared preview on narrow layouts',
);
for (const token of [
  'id="audit12-mobile-web-hybrid"',
  'id="audit12-mobile-web-hybrid-script"',
  'id="mapRail"',
  'mobile-project-detail',
  'aria-expanded',
  'detail.hidden',
  "button.setAttribute('aria-controls',detail.id)",
  'function selectProject(',
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
has('scripts/verify-all-runner.js', "'node scripts/verify-home-map.js'");
has('scripts/verify-all-runner.js', "'node scripts/verify-home-map-browser.js'");
if (!exists('scripts/verify-home-map.js')) fail.push('scripts/verify-home-map.js: missing current static homepage proof');
if (!exists('scripts/verify-home-map-browser.js')) fail.push('scripts/verify-home-map-browser.js: missing current browser homepage proof');
if (exists('scripts/verify-home-map-browser.js')) {
  for (const token of [
    'keeps preview height fixed',
    'keeps list height fixed',
    'keeps document height fixed',
    'keeps every list item height fixed',
    "document.querySelectorAll('[aria-expanded],.mobile-project-detail').length",
    'six desktop/mobile/touch/zoom states',
  ]) has('scripts/verify-home-map-browser.js', token);
}
const packageJson = JSON.parse(read('package.json'));
if (packageJson.scripts?.['verify:audit12'] !== 'node scripts/verify-audit12-mobile-web-hybrid.js') {
  fail.push('package.json: verify:audit12 is not wired to the Audit12 gate');
}
if (packageJson.scripts?.['verify:home-map'] !== 'node scripts/verify-home-map.js') {
  fail.push('package.json: verify:home-map is not wired to the static homepage proof');
}
if (packageJson.scripts?.['verify:home-map-browser'] !== 'node scripts/verify-home-map-browser.js') {
  fail.push('package.json: verify:home-map-browser is not wired to the rendered stability proof');
}

if (exists('public/index.html')) {
  if (!fs.readFileSync(path.join(root, 'public', 'index.html')).equals(fs.readFileSync(path.join(root, 'index.html')))) {
    fail.push('public/index.html: deployable homepage differs from the verified source homepage');
  }
}

if (fail.length) {
  console.error('AUDIT12 CURRENT MOBILE WEB CONTRACT FAILED');
  fail.forEach(item => console.error(' - ' + item));
  process.exit(1);
}
console.log('AUDIT12 CURRENT MOBILE WEB CONTRACT PASSED — one synchronized height-stable preview, practical touch targets, preview-before-open behavior, and registered browser stability proof verified.');
