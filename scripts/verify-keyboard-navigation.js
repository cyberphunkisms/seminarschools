#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const { isGeneratedDependencyDirectory } = require('./repository-walk-policy');
const { ROUTES } = require('./polymythcal-route-shell');

const ROOT = path.resolve(__dirname, '..');
const failures = [];
const release = JSON.parse(fs.readFileSync(path.join(ROOT, 'RELEASE_MANIFEST.json'), 'utf8'));
const { SITEWIDE_KEYBOARD_VERSION: globalAssetVersion } = require('./lib/sitewide-keyboard-version');
const allowedAssetVersions = new Set([String(release.polymythcal_asset_version || ''), globalAssetVersion].filter(Boolean));
if (!allowedAssetVersions.size) failures.push('no owned keyboard-helper asset version is available');

const helper = path.join(ROOT, 'js', 'site-keyboard-enhancements.js');
if (!fs.existsSync(helper)) failures.push('missing js/site-keyboard-enhancements.js');
else {
  const js = fs.readFileSync(helper, 'utf8');
  for (const needle of ['CL_SELF_KEYBOARD_HELPERS', 'keydown', 'firstSearch', 'ArrowRight', 'ArrowLeft', '?']) {
    if (!js.includes(needle)) failures.push(`keyboard helper missing ${needle}`);
  }
  if (!js.includes('if(ev.defaultPrevented) return;')) failures.push('keyboard helper must yield to route-specific handlers');
  if (!js.includes('!interactive(ev.target)')) failures.push('horizontal keyboard helper must preserve focused interactive controls');
  for (const modifier of ['!ev.altKey', '!ev.ctrlKey', '!ev.metaKey', '!ev.shiftKey']) {
    if (!js.includes(modifier)) failures.push(`horizontal keyboard helper must preserve ${modifier.slice(3)} modifier shortcuts`);
  }
}

const discovery = fs.readFileSync(path.join(ROOT, 'js', 'polymythcal-discovery.js'), 'utf8');
for (const needle of [
  'function focusToken(element = document.activeElement)',
  "function restoreFocus(token, fallback = '#pmdResultsTitle')",
  'target?.focus({ preventScroll: true })',
  "$('#pmdResultsTitle')?.focus()",
  "$('#pmdSearch')?.focus()",
  "drawer.querySelector('input')?.focus()",
  "window.addEventListener('popstate'",
]) {
  if (!discovery.includes(needle)) failures.push(`Discovery controller lacks keyboard/focus behavior ${needle}`);
}
const discoveryCss = fs.readFileSync(path.join(ROOT, 'css', 'polymythcal-discovery.css'), 'utf8');
if (!discoveryCss.includes(':focus-visible') || !discoveryCss.includes('.pmd-option:has(input:focus-visible)')) {
  failures.push('Discovery controls lack a strong focus-visible treatment');
}

const denseRoutes = ['aa/cloud/index.html', 'aa/views/index.html', 'leizu/cloud/index.html', 'polymyth/concordance/index.html', 'polymyth/dmboard/index.html'];
for (const rel of denseRoutes) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) continue;
  const html = fs.readFileSync(full, 'utf8');
  if (!/class=["'][^"']*keyboard-hint/i.test(html)) failures.push(`${rel} lacks visible keyboard hint`);
  if (!/site-keyboard-enhancements\.js/.test(html)) failures.push(`${rel} does not load keyboard helper`);
}

const discoveryPages = [
  'polymythseminars/index.html',
  'polymythseminars/fr/index.html',
  'polymythseminars/research/index.html',
  'polymythseminars/fr/research/index.html',
  'polymythseminars/monitoring/index.html',
  'polymythseminars/fr/monitoring/index.html',
  ...Object.keys(ROUTES).flatMap(slug => [`${slug}/index.html`, `${slug}/fr/index.html`]),
];
for (const rel of discoveryPages) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) {
    failures.push(`${rel}: missing Discovery route`);
    continue;
  }
  const html = fs.readFileSync(full, 'utf8');
  for (const needle of [
    'class="skip-link" href="#pmdResultsTitle"',
    'for="pmdSearch"',
    'aria-describedby="pmdSearchHelp pmdSearchStatus"',
    'id="pmdResultsTitle" tabindex="-1"',
    'site-keyboard-enhancements.js',
  ]) {
    if (!html.includes(needle)) failures.push(`${rel} missing accessible keyboard contract ${needle}`);
  }
}

const allHtml = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (['.git', '.netlify', 'public', 'fixtures'].includes(entry.name) || isGeneratedDependencyDirectory(entry.name)) continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (entry.name.endsWith('.html')) allHtml.push(file);
  }
}
walk(ROOT);
const interactiveHtml = allHtml.filter(file => {
  const html = fs.readFileSync(file, 'utf8');
  if (/<meta[^>]+http-equiv=["']refresh["']/i.test(html)) return false;
  if (/google[0-9a-f]+\.html$/i.test(file)) return false;
  return true;
});
let loaded = 0;
for (const file of interactiveHtml) {
  const html = fs.readFileSync(file, 'utf8');
  if (/site-keyboard-enhancements\.js/.test(html)) {
    loaded++;
    const references = [...html.matchAll(/site-keyboard-enhancements\.js\?v=([^"']+)/g)];
    if (references.length !== 1) failures.push(`${path.relative(ROOT, file)} must load exactly one cache-busted keyboard helper`);
    else if (!allowedAssetVersions.has(references[0][1])) failures.push(`${path.relative(ROOT, file)} uses an unowned keyboard-helper asset token`);
  }
}
if (loaded < Math.max(25, interactiveHtml.length - 5)) failures.push(`keyboard helper loaded on only ${loaded}/${interactiveHtml.length} interactive HTML files`);
if (failures.length) {
  console.error('KEYBOARD NAVIGATION CHECK FAILED');
  failures.forEach(failure => console.error(` - ${failure}`));
  process.exit(1);
}
console.log(`KEYBOARD NAVIGATION CHECK PASSED — ${discoveryPages.length} Discovery routes preserve labelled search/results focus and the shared helper loads on ${loaded} HTML files; dense routes retain visible shortcut hints.`);

