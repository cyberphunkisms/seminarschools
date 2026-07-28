#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function requireTokens(relativePath, tokens) {
  const source = read(relativePath);
  for (const token of tokens) {
    if (!source.includes(token)) failures.push(`${relativePath}: missing ${token}`);
  }
  return source;
}

function requireMatch(relativePath, pattern, message) {
  if (!pattern.test(read(relativePath))) failures.push(`${relativePath}: ${message}`);
}

function compileJavaScript(relativePath) {
  try {
    new vm.Script(read(relativePath), { filename: relativePath });
  } catch (error) {
    failures.push(`${relativePath}: JavaScript syntax error: ${error.message}`);
  }
}

function compileInlineScripts(relativePath) {
  const html = read(relativePath);
  const scriptPattern = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match;
  let scriptIndex = 0;
  while ((match = scriptPattern.exec(html))) {
    const attributes = match[1];
    const source = match[2].trim();
    if (!source || /\bsrc\s*=/.test(attributes) ||
        /\btype\s*=\s*["'](?:application\/(?:ld\+)?json|module)["']/i.test(attributes)) {
      continue;
    }
    scriptIndex += 1;
    try {
      new vm.Script(source, { filename: `${relativePath}#inline-${scriptIndex}` });
    } catch (error) {
      failures.push(`${relativePath} inline script ${scriptIndex}: ${error.message}`);
    }
  }
}

const mountContracts = [
  ['js/site.js', '__ssSharedSiteMounted'],
  ['js/theme.js', '__ssThemeToggleMounted'],
  ['js/theme.js', '__ssFontScaleMounted'],
  ['js/site-keyboard-enhancements.js', '__ssKeyboardEnhancementsMounted'],
  ['js/autolink.js', '__ssAutolinkMounted'],
  ['leizu/chrome-controls.js', '__leizuChromeControlsMounted'],
  ['leizu/booking-button.js', '__leizuBookingButtonMounted'],
  ['saul/assets/saul-cv-spectrum-2026.js', 'cvSpectrumMounted']
];
for (const [relativePath, guard] of mountContracts) requireTokens(relativePath, [guard]);

requireTokens('leizu/booking-button.js', [
  'document.readyState',
  "window.addEventListener('pageshow'",
  '{once:true}'
]);

const teacherFinder = requireTokens('teacherresources/finder.js', [
  'buildSearchMatchCache(queryTokens)',
  'entryMatches(entry, queryTokens, type, searchMatchCache)',
  'entryMatches(entry, queryTokens, null, searchMatchCache)',
  'updateFacetCounts(queryTokens, searchMatchCache)'
]);
if ((teacherFinder.match(/buildSearchMatchCache\(queryTokens\)/g) || []).length !== 2) {
  failures.push('teacherresources/finder.js: search cache must be built exactly once per filter update');
}

requireTokens('bookwormcard/aa-bridge.js', [
  'returnFocus',
  'focusWithoutScroll',
  "panel.setAttribute('aria-hidden', 'false')",
  "focusWithoutScroll(grid.querySelector('.aa-tag-btn'))",
  'focusWithoutScroll(back)'
]);

const aaCloud = requireTokens('aa/cloud/index.html', [
  "document.createElement('button')",
  'cloudMotionAllowed',
  'scheduleSimulationFrame',
  'SIM_MAX_ACTIVE_MS',
  'closeTagOverlay',
  'detailReturnFocus',
  'cloudResizeFrame',
  'canvas.inert = mobile',
  'outliner.inert = !mobile',
  'closeSearchOverlay(false)'
]);
if ((aaCloud.match(/requestAnimationFrame\(simLoop\)/g) || []).length !== 1 ||
    /setInterval\s*\(/.test(aaCloud)) {
  failures.push('aa/cloud/index.html: simulation must use one retained RAF scheduler and no interval');
}
requireMatch(
  'aa/cloud/index.html',
  /<button type="button" class="dt-tag-chip"/,
  'detail tags are not native keyboard controls'
);

const leizuCloud = requireTokens('leizu/cloud/index.html', [
  "document.createElement('button')",
  'leizuCloudMotionAllowed',
  'leizuSimulationAllowed',
  'scheduleSimulationFrame',
  'SIM_MAX_ACTIVE_MS',
  'detailReturnFocus',
  'visibilitychange',
  'pagehide',
  'resizeFrame'
]);
if ((leizuCloud.match(/requestAnimationFrame\(simLoop\)/g) || []).length !== 1 ||
    /setInterval\s*\(/.test(leizuCloud)) {
  failures.push('leizu/cloud/index.html: simulation must use one retained RAF scheduler and no interval');
}

requireTokens('polymyth/sitemap/graph/index.html', [
  'const steadyLayout = () =>',
  "document.documentElement.dataset.motion === 'calm'",
  'ResizeObserver',
  'scheduleResize',
  'visibilitychange',
  'pageshow',
  'pagehide',
  'settleGraph(120)'
]);
requireTokens('index.html', [
  'function scheduleRefresh()',
  "window.addEventListener('resize',scheduleRefresh",
  "window.addEventListener('pageshow',scheduleRefresh"
]);

for (const relativePath of [
  'js/site.js',
  'js/theme.js',
  'js/site-keyboard-enhancements.js',
  'js/autolink.js',
  'leizu/chrome-controls.js',
  'leizu/booking-button.js',
  'saul/assets/saul-cv-spectrum-2026.js',
  'teacherresources/finder.js',
  'bookwormcard/aa-bridge.js',
  'scripts/verify-steady-ui.js'
]) {
  compileJavaScript(relativePath);
}

for (const relativePath of [
  'aa/cloud/index.html',
  'leizu/cloud/index.html',
  'polymyth/sitemap/graph/index.html',
  'index.html'
]) {
  compileInlineScripts(relativePath);
}

if (failures.length) {
  console.error('Audit39 runtime/UI verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Audit39 runtime/UI verification passed.');
