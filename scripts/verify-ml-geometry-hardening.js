#!/usr/bin/env node
'use strict';

/** Regression gate for the user-directed 2026-08-05 and 2026-08-27 scroll-geometry corrections. */
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
  ['PERCEPTIBILITY HARDENING, 2026-08-08.', 'CL-49 perceptibility hardening'],
  ['Professional pages use a quiet register that remains plainly perceptible', 'quiet professional perceptibility'],
  ['Browser proof compares the composed page with the layer shown and hidden', 'composed render comparison'],
  ['FRONT-FACING AND PERCEPTIBILITY HARDENING, 2026-08-08.', 'CL-63 front-facing hardening'],
  ['The geometry layer must also produce a register-appropriate visible pixel difference and minimum scroll displacement', 'pixel and displacement proof'],
  ['STAR-ESTATE SCOPE CORRECTION, USER-DIRECTED 2026-08-27.', 'CL-49 non-star scope correction'],
  ['The shared Indra geometry belongs on every real non-star public project page and on its deployment mirror.', 'CL-49 positive non-star scope'],
  ['ml* and its sixteen section views, bb*, mc*, cc*, the four aa* views, aitr*, and Polymyth Coherence', 'CL-49 exact star estate'],
  ['The private source-only dashboard control is excluded with that internal estate.', 'CL-49 private dashboard exclusion'],
  ['#8a4a32, #c47a2e, #a09030, #3d8a5a, #4070a8, #6850a0, #9050a0, and #a84858', 'CL-49 exact canonical spectrum'],
  ['may supply only a bounded opacity and the established light-or-dark blend', 'CL-49 page-owned fade boundary'],
  ['Exported ml* HTML is part of the excluded star-file estate and must not emit the shared geometry scripts, mounts, or body contract.', 'CL-49 exported ML* exclusion'],
  ['CURRENT NON-STAR COVERAGE CONTRACT, USER-DIRECTED 2026-08-27.', 'CL-63 current non-star contract'],
  ['Star and dashboard exclusions are checked negatively for absent shared scripts, mounts, and body geometry contracts', 'CL-63 negative exclusion proof'],
  ['Page-owned opacity must remain inside the shared bounds and may only fade that web into the existing page design', 'CL-63 fade-only proof'],
];
for (const pair of requiredCanonical) {
  if (!canonical.includes(pair[0])) failures.push('canonical misses ' + pair[1]);
}

const exportStart = canonical.indexOf('function exportHTML(){');
const exportEnd = canonical.indexOf('async function importJSON', exportStart);
const exportTemplate = exportStart >= 0 && exportEnd > exportStart ? canonical.slice(exportStart, exportEnd) : '';
if (!exportTemplate) failures.push('canonical misses exportHTML template');
if (!exportTemplate.includes('data-shared-geometry-exempt="star-file"')) failures.push('exportHTML template misses canonical star-file exclusion marker');
for (const forbiddenExportToken of ['data-geometry="indra-web"', 'data-indra-intensity=', "${'man'+'dala'}", "${'in'+'dra'}"]) {
  if (exportTemplate.includes(forbiddenExportToken)) failures.push('exportHTML template emits shared geometry token ' + forbiddenExportToken);
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
]) requireText(relative, 'The shared Indra geometry belongs on every real non-star public project page', 'generated non-star geometry scope wording');

for (const relative of [
  'polymyth/methodologylist-coreplus.txt',
  'polymyth/methodologylist/coreplus/index.html',
  'public/polymyth/methodologylist-coreplus.txt',
  'public/polymyth/methodologylist/coreplus/index.html',
]) requireText(relative, 'all-page scroll-geometry check, not a page-meaning test', 'generated geometry gate boundary wording');

requireText('polymyth/methodologylist-coreplus.txt', 'front-facing vocabulary rules, geometry and build gates', 'CORE+ project-handler routing');
requireText('polymyth/methodologylist-coreplus.txt', 'Keep ML*-specific operations in CORE+ and their canonical project owners.', 'CORE+ project separation');
requireText('polymyth/methodologylist-coreplus.txt', 'Website geometry and front-facing rules route to CL-49, CL-63, and their release gates.', 'CORE+ lossless geometry routing');
requireText('scripts/build-ai-access-pack.js', 'Every non-star public project page must carry the shared Indra scroll geometry', 'AI access pack non-star geometry wording');
requireText('scripts/build-ai-access-pack.js', 'The exact geometry exclusion is ml* and its sixteen section views, bb*, mc*, cc*, aa* and its cloud, views, and editorial views, aitr*, and Polymyth Coherence', 'AI access pack exact star estate wording');
requireText('scripts/build-ai-access-pack.js', 'A page-owned opacity inside the shared bounds and the established light-or-dark blend may fade the field into the existing design', 'AI access pack page-owned fade boundary');
requireText('scripts/build-ai-access-pack.js', 'Write for a cold general reader', 'AI access pack front-facing wording');
requireText('scripts/build-ai-access-pack.js', 'Geometry presence alone does not pass', 'AI access pack perceptibility wording');
requireText('scripts/regen-methodologylist-txt.js', "'framework-core', 'coreplus'", 'portable CORE-first section order');
requireText('scripts/regen-methodologylist-txt.js', 'Opening or reading it has no independent activation effect.', 'inert text-mirror boundary');
requireText('scripts/regen-methodologylist-txt.js', 'Other sections preserve current framework entries for retrieval', 'canonical handler retrieval wording');
requireText('scripts/verify-meaningful-geometry.js', 'Historical filename, current invariant', 'compatibility verifier marker');
requireText('scripts/verify-meaningful-geometry.js', 'PATH-STABLE CANONICAL GEOMETRY CHECK PASSED', 'compatibility verifier pass marker');
requireText('scripts/verify-visible-geometry-browser.mjs', 'lacks three scroll views', 'browser scroll movement assertion');
requireText('scripts/verify-visible-geometry-browser.mjs', 'reduced-motion camera', 'browser reduced-motion assertion');
requireText('scripts/verify-visible-geometry-browser.mjs', 'composed geometry is too faint or sparse', 'all-surface composed-pixel assertion');
requireText('scripts/verify-visible-geometry-browser.mjs', 'static square/bubble coverage returned', 'rejected coverage regression assertion');
requireText('scripts/verify-visible-geometry-browser.mjs', 'rainbow field colour does not advance with scroll', 'rendered rainbow scroll assertion');
requireText('scripts/verify-geometry.js', 'every included page must mount both original field cameras', 'VM included-page geometry camera wording');
requireText('scripts/verify-geometry.js', 'reduced motion: canonical camera moves after scroll', 'mandala reduced-motion assertion');
requireText('scripts/verify-geometry.js', 'the full three-gasket/flower/prismatic-jewel web, exact spectrum, two cameras, and bounded page-fit fading are canonical on every included page', 'VM included-page geometry proof marker');
requireText('scripts/verify-visible-geometry.js', 'Static release gate for the canonical background web', 'static visible geometry proof marker');
requireText('js/indra.js', "data-geometry-kind', 'shared-background-web'", 'runtime shared-background marker');
requireText('js/indra.js', "data-geometry-input', 'normalized-path-scroll'", 'runtime normalized-path marker');
requireText('js/indra.js', "data-geometry-motion-source", 'runtime real input-owner marker');
requireText('js/indra.js', "document.addEventListener('scroll', onElementScroll", 'runtime nested-scroll owner');
requireText('js/indra.js', "document.addEventListener('wheel', onWheel", 'runtime fixed-surface wheel owner');
requireText('js/indra.js', 'fine-line-rainbow-dual', 'runtime restored field marker');
forbidText('js/indra.js', 'canonical-static-wide', 'retired static coverage marker');
forbidText('js/indra.js', 'feMorphology', 'retired morphology dilation');
requireText('js/indra.js', "data-geometry-proof', 'eligible-page-scroll'", 'runtime proof marker');
requireText('data/geometry-route-contracts.json', 'Route-family flavor', 'registry flavor wording');

const registry = JSON.parse(read('data/geometry-route-contracts.json') || '{}');
const routeTypes = Object.keys(registry.route_types || {});
if (routeTypes.length < 40) failures.push('geometry registry covers only ' + routeTypes.length + '/40 route families');
for (const required of ['home', 'calendar-event', 'resource-catalog', 'cv', 'redirect', 'error']) {
  if (!registry.route_types || !registry.route_types[required]) failures.push('geometry registry misses ' + required);
}
if (JSON.stringify(registry.route_types && registry.route_types.redirect) !== '["return"]') failures.push('redirect route must keep the return flavor');
const coverage = registry.coverage || {};
const expectedStarRoutes = [
  'aa/cloud/index.html', 'aa/editorial.html', 'aa/index.html', 'aa/views/index.html', 'aitr/index.html',
  'polymyth/bookwormburrows/index.html', 'polymyth/campaigncodex/index.html', 'polymyth/coherence/index.html',
  'polymyth/methodologylist/analysis/index.html', 'polymyth/methodologylist/citation/index.html',
  'polymyth/methodologylist/corehistory/index.html', 'polymyth/methodologylist/coreplus/index.html',
  'polymyth/methodologylist/degorgonification/index.html', 'polymyth/methodologylist/framework-core/index.html',
  'polymyth/methodologylist/gorgonification/index.html', 'polymyth/methodologylist/idiomary/index.html',
  'polymyth/methodologylist/index.html', 'polymyth/methodologylist/learnings/index.html',
  'polymyth/methodologylist/methodology/index.html', 'polymyth/methodologylist/pending-user-authorship/index.html',
  'polymyth/methodologylist/pending/index.html', 'polymyth/methodologylist/polycognate/index.html',
  'polymyth/methodologylist/rainbowsol/index.html', 'polymyth/methodologylist/sabachtan/index.html',
  'polymyth/methodologylist/studylist/index.html', 'polymyth/modulecanon/index.html',
];
if (JSON.stringify(coverage.star_page_routes || []) !== JSON.stringify(expectedStarRoutes)) failures.push('geometry registry star estate differs from the canonical exact 26 routes');
if (!Array.isArray(coverage.control_page_prefixes) || !coverage.control_page_prefixes.includes('dashboard/')) failures.push('geometry registry misses private dashboard control exclusion');
if (coverage.expected_current_star_pages !== 26) failures.push('geometry registry star-page cardinality differs from 26 source and 26 public');

const pkg = JSON.parse(read('package.json') || '{}');
const build = pkg.scripts && pkg.scripts['build:locked'] || '';
if ((build.match(/apply-visible-geometry\.js/g) || []).length !== 2) failures.push('production build does not apply geometry twice');
if (!(build.lastIndexOf('apply-visible-geometry.js') > build.lastIndexOf('apply-audit49-metadata-hygiene.js'))) failures.push('final geometry repair does not follow every generator');
for (const gate of ['verify-build-idempotence.js', 'verify-geometry.js', 'verify-visible-geometry.js', 'verify-meaningful-geometry.js', 'verify-visible-geometry-browser.mjs', 'verify-ml-geometry-hardening.js']) {
  requireText('scripts/verify-all-runner.js', 'node scripts/' + gate, 'blocking runner gate ' + gate);
}
requireText('scripts/verify-all-runner.js', 'node scripts/verify-front-facing-overlap-browser.js', 'blocking rendered front-facing/overlap gate');
forbidText('scripts/apply-visible-geometry.js', '/^google.*\\.html$/', 'broad Google-file exemption');
requireText('scripts/apply-visible-geometry.js', 'priorMtimeMs + 2_000', 'future-stamped generator reconciliation guard');

if (failures.length) {
  console.error('ML* SCROLL GEOMETRY VERIFICATION FAILED');
  for (const failure of failures) console.error(' - ' + failure);
  process.exit(1);
}
console.log('ML* NON-STAR SCROLL GEOMETRY VERIFIED - CL-49/CL-63, the exact star/control exclusions, canonical spectrum, bounded fading, fixed-point rebuilding, final build repair, and blocking geometry gates agree across ' + routeTypes.length + ' route-family flavors.');
