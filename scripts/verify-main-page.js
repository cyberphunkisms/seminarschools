#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'about', 'index.html'), 'utf8');
const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const footer = fs.readFileSync(path.join(root, 'js', 'footer.js'), 'utf8');
const mandala = fs.readFileSync(path.join(root, 'js', 'mandala.js'), 'utf8');
const indra = fs.readFileSync(path.join(root, 'js', 'indra.js'), 'utf8');
let failed = 0;
function check(ok, label) {
  console.log((ok ? 'PASS  ' : 'FAIL  ') + label);
  if (!ok) failed++;
}
check(page.includes('threshold-routes'), 'about page has three practical entry routes');
check(page.includes('href="/leizu/"') && page.includes('href="/agora/"') && page.includes('href="/teacherresources/"'), 'about page routes to tutoring, public reading, and resources');
check(page.includes('data-geometry-profile="dual-field"'), 'about page requests the universal two-window geometry field');
check(page.includes('/js/mandala.js') && page.includes('/js/indra.js'), 'about page loads the universal canonical geometry runtime');
check(mandala.includes('maxDepth: 6') && mandala.includes('minRadius: 0.9') && mandala.includes('geo-flower'), 'canonical runtime retains the exact full-depth flower geometry');
check(indra.includes("mountCamera('primary', false)") && indra.includes("mountCamera('secondary', true)"), 'universal runtime owns both independent scroll cameras');
check(indra.includes('fine-line-rainbow-dual') && !/canonical-static-wide|feMorphology|indra-coverage/.test(indra), 'universal runtime retains the rainbow field without the square/bubble coverage renderer');
check(!page.includes('// ===== Loop =====') && !page.includes('function tryLoop()'), 'about page does not auto-loop at the footer');
check(!page.includes('Rubber-band pull-up at top'), 'about page does not intercept ordinary top scrolling');
check(page.includes('href="#threshold">Return to the beginning</a>'), 'footer has an explicit return link');
check(home.includes('data-homepage-contract="business-card-project-web-v1"') && footer.includes("'/about/'"), 'homepage contract and shared navigation retain the About route');
check((page.match(/<script\b/gi) || []).length === (page.match(/<\/script>/gi) || []).length, 'about page has balanced script tags');
if (failed) {
  console.error(`\n${failed} about-page guard(s) failed.`);
  process.exit(1);
}
console.log('\nAbout-page guard passed.');
