#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'main', 'index.html'), 'utf8');
const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
let failed = 0;
function check(ok, label) {
  console.log((ok ? 'PASS  ' : 'FAIL  ') + label);
  if (!ok) failed++;
}
check(page.includes('threshold-routes'), 'main page has three practical entry routes');
check(page.includes('href="/leizu/"') && page.includes('href="/agora/"') && page.includes('href="/teacherresources/"'), 'main page routes to tutoring, public reading, and resources');
check(page.includes('id="geometryToggle"') && page.includes('ss-main-geometry'), 'main page has explicit geometry control');
check(page.includes('MAX_D = 6, MIN_R = 0.9'), 'main page uses the lighter geometry depth');
check(page.includes('geo-flower'), 'main page can quiet ornamental geometry independently');
check(!page.includes('// ===== Loop =====') && !page.includes('function tryLoop()'), 'main page does not auto-loop at the footer');
check(!page.includes('Rubber-band pull-up at top'), 'main page does not intercept ordinary top scrolling');
check(page.includes('href="#threshold">Return to the beginning</a>'), 'footer has an explicit return link');
check(home.includes("href:'/main/', tier:0"), 'homepage core jewel links to main page');
check((page.match(/<script\b/gi) || []).length === (page.match(/<\/script>/gi) || []).length, 'main page has balanced script tags');
if (failed) {
  console.error(`\n${failed} main-page guard(s) failed.`);
  process.exit(1);
}
console.log('\nMain-page guard passed.');
