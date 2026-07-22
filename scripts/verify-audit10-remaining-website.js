#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const fail = [];

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}
function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}
function has(rel, token) {
  if (!read(rel).includes(token)) fail.push(`${rel}: missing ${token}`);
}
function lacks(rel, token) {
  if (read(rel).includes(token)) fail.push(`${rel}: contains ${token}`);
}
function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', '.netlify', 'public'].includes(entry.name)) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(abs, out);
    else if (entry.isFile() && entry.name.endsWith('.html')) out.push(abs);
  }
  return out;
}

if (!/^\d{4}-\d{2}-\d{2}-.+/.test(read('RELEASE_ID.txt').trim())) fail.push('release id malformed');

for (const token of [
  'minmax(min(100%,190px),1fr)',
  '@media(max-width:460px){.ss-foot',
  'overflow-wrap:normal;word-break:normal;hyphens:none',
  '<nav class="ss-col" aria-label="'
]) has('js/footer.js', token);

const footerPages = walk(root).filter(abs => fs.readFileSync(abs, 'utf8').includes('/js/footer.js'));
for (const abs of footerPages) {
  const html = fs.readFileSync(abs, 'utf8');
  if (!html.includes('/js/footer.js?v=20260719-audit11-decisions')) {
    fail.push(`${path.relative(root, abs)}: stale footer cache key`);
  }
}
if (footerPages.length < 70) fail.push(`footer cache coverage unexpectedly low: ${footerPages.length}`);

for (const token of ['white-space: nowrap', 'grid-template-columns: 24px minmax(86px, auto) minmax(0, 1fr)']) has('about/index.html', token);
has('index.html', "sabachtan:{dx:20,dy:10,a:'start'}");

for (const rel of ['saul/index.html', 'saul/cv/general/index.html', 'saul/cv/teaching/index.html', 'saul/hospitality/index.html']) {
  has(rel, '<h2 class="cv-spectrum__section-label">Selected experience</h2>');
  has(rel, '<h3>');
  lacks(rel, '<h4>');
}
for (const token of ['data-cv-map-rescue', 'Map blank? Open full map', 'cv-map-rescue']) has('saul/index.html', token);
for (const token of ['.cv-map-rescue{']) has('saul/assets/saul-cv-spectrum-2026.css', token);
for (const token of ['is-unavailable']) has('saul/assets/saul-cv-spectrum-2026.js', token);
const saul = read('saul/index.html');
if (!/\[\s*8,\s*"2026",[\s\S]{0,500}?"AODA Training"/.test(saul)) fail.push('AODA remains outside current professional-development section');

for (const rel of ['teacherresources/ela/index.html', 'teacherresources/math/index.html', 'teacherresources/sci/index.html']) {
  has(rel, 'class="resource-card"');
  has(rel, '<h2>');
}
for (const token of ['<h2>Categories</h2>', '<h2 id="d-title">Page</h2>', '.legend h2 {', '.detail-panel h2 {']) has('polymyth/sitemap/graph/index.html', token);
for (const token of ['#toggles button,#toggles a{min-width:44px', 'legend-toggle{width:44px']) has('bookwormcard/index.html', token);
for (const rel of ['polymyth/campaigncodex/index.html', 'polymyth/devilsdiary/1/index.html', 'campaigns/studio-qibla/index.html', 'bb/why/index.html']) has(rel, 'role="main"');

const archivedEvents = [
  'polymythseminars/events/083b2f76f382-8a98f3ce/index.html',
  'polymythseminars/events/2fe410f5efc7-029630c0/index.html',
  'polymythseminars/events/74f79ea5ff35-183cba57/index.html',
  'polymythseminars/events/ad7b80663935-693e62e7/index.html',
  'polymythseminars/events/aristotle-contest-high-school-philosophy-2026-dd91982b/index.html',
  'polymythseminars/events/c9b230134d30-b88bc9c6/index.html',
  'polymythseminars/events/dae6c0d27ea4-b4778229/index.html',
  'polymythseminars/events/pamla-2026-conference-2026-3c67ca43/index.html',
  'polymythseminars/events/td-festival-of-south-asia-2026-24th-edition-2026-07-11-a89589bb/index.html',
  'polymythseminars/events/td-salsa-on-st-clair-2026-2026-07-11-a1be1dbb/index.html'
];
for (const rel of archivedEvents) {
  if (!exists(rel)) {
    fail.push(`${rel}: expired permalink deleted`);
    continue;
  }
  const html = read(rel);
  has(rel, 'noindex,follow');
  if (/http-equiv=["']refresh["']/i.test(html)) {
    has(rel, '<link rel="canonical"');
  } else {
    has(rel, 'data-event-archive-note="true"');
    lacks(rel, '"@type":"Event"');
  }
}
has('scripts/build-search-pages.js', 'function archiveGeneratedEventPage(ix)');
has('scripts/build-search-pages.js', 'if (!keep.has(ix)) archiveGeneratedEventPage(ix);');

for (const rel of ['docs/WEBSITE_REMAINING_ISSUES_AUDIT10_2026-07-19.md', 'docs/WEBSITE_DECISIONS_FOR_SAUL_2026-07-19.md']) {
  if (!exists(rel)) fail.push(`${rel}: missing`);
}
has('scripts/build-saul-cv-professional.py', 'apply-audit10-remaining-website-fixes.py');
has('scripts/verify-all-runner.js', 'verify-audit10-remaining-website.js');

if (exists('public/index.html')) {
  has('public/js/footer.js', 'minmax(min(100%,190px),1fr)');
  has('public/js/footer.js', '<nav class="ss-col" aria-label="');
  has('public/about/index.html', 'minmax(86px, auto)');
  has('public/saul/index.html', 'Map blank? Open full map');
  const representative = 'public/polymythseminars/events/083b2f76f382-8a98f3ce/index.html';
  if (!exists(representative)) fail.push(`${representative}: public expired permalink deleted`);
  else {
    has(representative, 'noindex,follow');
    const html = read(representative);
    if (/http-equiv=["']refresh["']/i.test(html)) has(representative, '<link rel="canonical"');
    else has(representative, 'data-event-archive-note="true"');
  }
}

if (fail.length) {
  console.error('AUDIT10 REMAINING WEBSITE FAILED');
  fail.forEach(item => console.error(' - ' + item));
  process.exit(1);
}
console.log(`AUDIT10 REMAINING WEBSITE PASSED — ${footerPages.length} footer-bearing source pages use the final cache key; implementation repairs, expired-event permalink retention, preserved invariants, and decision boundaries verified.`);
