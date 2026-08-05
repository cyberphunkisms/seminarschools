#!/usr/bin/env node
'use strict';

/** Regression gate for the user-directed 2026-08-05 scroll-geometry correction. */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const failures = [];

function read(relative) {
  const target = path.join(ROOT, relative);
  if (!fs.existsSync(target)) {
    failures.push(relative + ' is missing');
    return '';
  }
  return fs.readFileSync(target, 'utf8');
}

function requireText(relative, text, label) {
  if (!read(relative).includes(text)) failures.push(relative + ' misses ' + label);
}

function forbidText(relative, text, label) {
  if (read(relative).includes(text)) failures.push(relative + ' retains ' + label);
}

const canonical = read('polymyth/methodologylist/index.html');
const requiredCanonical = [
  ['Every public HTML page carries the shared Indra scroll geometry', 'CL-49 all-page scroll requirement'],
  ['a fixed pointer-safe #indraLayer that responds to scroll', 'CL-49 runtime layer'],
  ['This is the all-page requirement.', 'CL-49 scope boundary'],
  ['It does not authorize a separate deletion test, semantic-role threshold, or universal demand that every page prove its content relations through geometry.', 'CL-49 anti-overcorrection boundary'],
  ['Foreground geometry remains welcome where a page actually uses it', 'foreground allowance'],
  ['every public HTML source and deployment mirror', 'CL-63 source and deploy scope'],
  ['redirect fallbacks, and every noindex page remain inside the scroll-geometry rule', 'CL-63 redirect/noindex scope'],
  ['it is exempt only from the footer or colophon requirement', 'CL-63 redirect exemption'],
  ['Three named geometry gates block every handoff: verify-geometry, verify-visible-geometry, and verify-visible-geometry-browser.', 'CL-63 named browser/static gates'],
  ['verify-meaningful-geometry remains as an all-page scroll-geometry check, not a page-meaning test', 'compatibility gate boundary'],
  ['scrollable samples move on scroll while reduced-motion samples stay still', 'browser scroll proof'],
];
for (const pair of requiredCanonical) {
  if (!canonical.includes(pair[0])) failures.push('canonical misses ' + pair[1]);
}

const forbidden = [
  'Shared Indra assets are the baseline, not proof',
  'Geometry must be visible and make page or page-family structure perceptible',
  'The shared Indra layer is the universal substrate and never sufficient proof',
  'Each public HTML page must make at least one real relation in its content perceptible through geometry.',
  'Apply the deletion test. If the geometry can be removed',
  'Evidence is taken only from visible body markup',
  'RELATION requires at least two unique visible internal destinations',
  'visible-body structural evidence driven by page or page-family data',
  'Passing the shared-engine check cannot ratify wallpaper',
  'interactive structural-geometry role',
  "data-geometry-proof', 'baseline-only'",
  "data-geometry-kind', 'shared-substrate'",
  "data-geometry-source', 'shared-substrate'",
];
const surfaces = [
  'CHARTER.txt',
  'polymyth/methodologylist/index.html',
  'polymyth/methodologylist.txt',
  'polymyth/methodologylist-learnings.txt',
  'polymyth/methodologylist-coreplus.txt',
  'polymyth/mephistodata-activation.md',
  'hf_export/ai_access_pack/MEPHISTODATA_ACTIVATION.md',
  'scripts/build-ai-access-pack.js',
  'scripts/apply-ml-dialectical-hardening.js',
  'scripts/regen-methodologylist-txt.js',
  'scripts/verify-geometry.js',
  'scripts/verify-visible-geometry-browser.mjs',
  'js/indra.js',
  'data/geometry-route-contracts.json',
];
for (const phrase of forbidden) {
  for (const surface of surfaces) forbidText(surface, phrase, 'overbroad geometry phrase: ' + phrase);
}

for (const relative of [
  'polymyth/methodologylist.txt',
  'polymyth/methodologylist-learnings.txt',
  'polymyth/methodologylist/learnings/index.html',
  'public/polymyth/methodologylist.txt',
  'public/polymyth/methodologylist-learnings.txt',
  'public/polymyth/methodologylist/learnings/index.html',
]) requireText(relative, 'all-page scroll-reactive Indra geometry', 'generated geometry correction wording');

for (const relative of [
  'polymyth/methodologylist-coreplus.txt',
  'polymyth/methodologylist/coreplus/index.html',
  'public/polymyth/methodologylist-coreplus.txt',
  'public/polymyth/methodologylist/coreplus/index.html',
]) requireText(relative, 'all-page scroll-geometry check, not a page-meaning test', 'generated geometry gate boundary wording');

requireText('CHARTER.txt', 'Every public HTML page except the exact Google\nverification token must carry the shared Indra scroll geometry', 'bootstrap all-page scroll rule');
requireText('CHARTER.txt', 'semantic-role threshold', 'bootstrap anti-overcorrection boundary');
requireText('CHARTER.txt', 'verify-meaningful-geometry as a compatibility\nall-page-scroll check', 'compatibility check wording');
requireText('scripts/build-ai-access-pack.js', 'Every public HTML page except the exact Google verification token must carry the shared Indra scroll geometry', 'AI access pack generator wording');
requireText('scripts/regen-methodologylist-txt.js', 'Every public HTML page except the exact Google', 'text mirror generator wording');
requireText('scripts/verify-meaningful-geometry.js', 'Historical filename, current contract', 'compatibility verifier marker');
requireText('scripts/verify-meaningful-geometry.js', 'ALL-PAGE SCROLL GEOMETRY CHECK PASSED', 'compatibility verifier pass marker');
requireText('scripts/verify-visible-geometry-browser.mjs', 'scroll-reactive geometry did not move after scrolling', 'browser scroll movement assertion');
requireText('scripts/verify-visible-geometry-browser.mjs', 'reduced-motion geometry does not remain still', 'browser reduced-motion assertion');
requireText('scripts/verify-geometry.js', 'shared scroll layer', 'VM geometry scroll wording');
requireText('scripts/verify-geometry.js', 'all-page-scroll', 'VM geometry proof marker');
requireText('scripts/verify-visible-geometry.js', 'all-page-scroll', 'static visible geometry proof marker');
requireText('js/indra.js', "data-geometry-kind', 'shared-scroll-layer'", 'runtime shared-scroll marker');
requireText('js/indra.js', "data-geometry-input', 'path-route-scroll'", 'runtime input marker');
requireText('js/indra.js', "data-geometry-proof', 'all-page-scroll'", 'runtime proof marker');
requireText('data/geometry-route-contracts.json', 'Route-family flavor', 'registry flavor wording');

const registry = JSON.parse(read('data/geometry-route-contracts.json') || '{}');
const routeTypes = Object.keys(registry.route_types || {});
if (routeTypes.length < 40) failures.push('geometry registry covers only ' + routeTypes.length + '/40 route families');
for (const required of ['home', 'calendar-event', 'resource-catalog', 'cv', 'redirect', 'error']) {
  if (!registry.route_types || !registry.route_types[required]) failures.push('geometry registry misses ' + required);
}
if (JSON.stringify(registry.route_types && registry.route_types.redirect) !== '["return"]') failures.push('redirect route must keep the return flavor');

const pkg = JSON.parse(read('package.json') || '{}');
const build = pkg.scripts && pkg.scripts.build || '';
if ((build.match(/apply-visible-geometry\.js/g) || []).length !== 2) failures.push('production build does not apply geometry twice');
if (!(build.lastIndexOf('apply-visible-geometry.js') > build.lastIndexOf('apply-audit49-metadata-hygiene.js'))) failures.push('final geometry repair does not follow every generator');
for (const gate of ['verify-build-idempotence.js', 'verify-geometry.js', 'verify-visible-geometry.js', 'verify-meaningful-geometry.js', 'verify-visible-geometry-browser.mjs', 'verify-ml-geometry-hardening.js']) {
  requireText('scripts/verify-all-runner.js', 'node scripts/' + gate, 'blocking runner gate ' + gate);
}
forbidText('scripts/apply-visible-geometry.js', '/^google.*\\.html$/', 'broad Google-file exemption');

if (failures.length) {
  console.error('ML* SCROLL GEOMETRY VERIFICATION FAILED');
  for (const failure of failures) console.error(' - ' + failure);
  process.exit(1);
}
console.log('ML* SCROLL GEOMETRY VERIFIED - CL-49/CL-63, charter, activations, ' + routeTypes.length + ' route-family flavors, fixed-point rebuilding, final build repair, and blocking geometry gates agree.');
