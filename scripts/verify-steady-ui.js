#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const { isGeneratedDependencyDirectory } = require('./repository-walk-policy');
const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const SOURCE_SKIP = new Set([
  '.git', 'node_modules', '.netlify', 'public', 'fixtures',
  '.public-build-staging', '.public-build-previous',
]);
const PUBLIC_SKIP = new Set(['.git', 'node_modules', '.netlify']);
const errors = [];
const warnings = [];

function walk(dir, skip, exts, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(ent.name) || isGeneratedDependencyDirectory(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, skip, exts, out);
    else if (ent.isFile() && exts.some(ext => ent.name.endsWith(ext))) out.push(full);
  }
  return out;
}
function rel(base, file) { return path.relative(base, file).replace(/\\/g, '/'); }
function read(file) { return fs.readFileSync(file, 'utf8'); }
function inspectHtml(files, base, label) {
  for (const file of files) {
    const r = rel(base, file);
    if (/^google.*\.html$/i.test(path.basename(file))) continue;
    const html = read(file);
    if (!/<body\b/i.test(html)) continue;
    const redirect = /http-equiv=["']refresh["']/i.test(html) && /location\.replace\(/.test(html);
    if (redirect) continue;
    for (const required of ['/js/theme-init.js', '/css/alive.css', '/css/calm-ux.css', '/js/mandala.js', '/js/indra.js']) {
      if (!html.includes(required)) errors.push(`${label}:${r}: missing ${required}`);
    }
    if (!/<body\b[^>]*data-geometry=["']indra-web["']/i.test(html)) errors.push(`${label}:${r}: missing geometry marker`);
    const initPos = html.indexOf('/js/theme-init.js');
    const firstStyle = html.search(/<link\b[^>]*rel=["']stylesheet["']/i);
    if (initPos >= 0 && firstStyle >= 0 && initPos > firstStyle) errors.push(`${label}:${r}: theme-init runs after styles`);
    const head = html.slice(0, html.search(/<\/head>/i) + 7);
    const calmPos = head.lastIndexOf('/css/calm-ux.css');
    const styles = [...head.matchAll(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/ig)]
      .map(match => ({ index: match.index, tag: match[0] }));
    const laterStyles = styles.filter(style => style.index > calmPos);
    if (
      calmPos >= 0
      && laterStyles.some(style => !style.tag.includes('/css/audit45-localization.css'))
    ) {
      errors.push(`${label}:${r}: only Audit 45 language/font overrides may follow calm-ux.css`);
    }
  }
}

const sourceHtml = walk(ROOT, SOURCE_SKIP, ['.html']);
const publicHtml = walk(PUBLIC, PUBLIC_SKIP, ['.html']);
inspectHtml(sourceHtml, ROOT, 'source');
inspectHtml(publicHtml, PUBLIC, 'public');

const activeRoots = ['index.html', '404.html', 'aa', 'about', 'agora', 'aitr', 'bb', 'bookwormcard', 'campaigns', 'cfps', 'css', 'dashboard', 'fellowships', 'florilegium', 'humanities', 'js', 'lectures', 'leizu', 'main', 'marginalia', 'nutrition', 'ohm-dome', 'philosophy', 'polymyth', 'polymythcal', 'polymythseminars', 'reviews', 'saul', 'seminars', 'sitemap', 'teacherresources', 'university', 'writingclub', 'writinggrads', 'writingjuniors', 'writingkids', 'writingteens'];
const runtimeFiles = [];
for (const item of activeRoots) {
  const full = path.join(ROOT, item);
  if (!fs.existsSync(full)) continue;
  const stat = fs.statSync(full);
  if (stat.isFile()) runtimeFiles.push(full);
  else walk(full, new Set(['node_modules', 'public']), ['.html', '.css', '.js'], runtimeFiles);
}
for (const file of runtimeFiles) {
  const r = rel(ROOT, file);
  const text = read(file);
  if (/scroll-behavior\s*:\s*smooth/i.test(text)) errors.push(`${r}: CSS smooth scrolling remains`);
  if (/behavior\s*:\s*["']smooth["']/i.test(text)) errors.push(`${r}: JavaScript smooth scrolling remains`);
}

const indra = read(path.join(ROOT, 'js', 'indra.js'));
if (/setInterval\s*\(/.test(indra)) errors.push('js/indra.js contains an interval');
if (/pointer(move|down|up|enter|leave)/i.test(indra)) errors.push('js/indra.js follows or reacts to the pointer');
if (!/addEventListener\(['"]scroll['"],\s*schedule/.test(indra)) errors.push('js/indra.js lacks scroll-triggered scheduling');
if (!/if \(!raf\) raf = window\.requestAnimationFrame\(paint\)/.test(indra)) errors.push('js/indra.js lacks one-frame throttling');
if (/requestAnimationFrame\([^)]*\)[\s\S]{0,120}requestAnimationFrame\(/.test(indra)) warnings.push('js/indra.js contains multiple rAF calls; manually confirm they are event-triggered');

const calm = read(path.join(ROOT, 'css', 'calm-ux.css'));
for (const token of ['html[data-motion="calm"]', '.pm-search-clear', '#rain-canvas', '#geo, #geo2', 'content-visibility: visible']) {
  if (!calm.includes(token)) errors.push(`css/calm-ux.css missing ${token}`);
}
const themeInit = read(path.join(ROOT, 'js', 'theme-init.js'));
if (!/data-motion['"], ['"]calm/.test(themeInit)) errors.push('js/theme-init.js does not set calm mode before paint');
const mandala = read(path.join(ROOT, 'js', 'mandala.js'));
if (!/reduced \|\| calm/.test(mandala)) errors.push('js/mandala.js does not gate motion in calm and reduced-motion modes');
if (!/visibilitychange/.test(mandala) || !/cancelAnimationFrame\(raf\)/.test(mandala)) errors.push('js/mandala.js does not pause its settle loop while hidden');
if (/NEVER sleeps|requestAnimationFrame\(frame\);\s*\n\s*}\s*\n\s*\n\s*window\.addEventListener\(['"]scroll['"], setTargets/.test(mandala)) errors.push('js/mandala.js retains a permanent animation loop');

const poly = read(path.join(ROOT, 'js', 'polymythcal-revamp.js'));
if (!/const PAGE_SIZE = 24;/.test(poly)) errors.push('Polymythcal initial render is not capped at 24 cards');
if (/scrollIntoView\(\{\s*behavior:\s*["']smooth/.test(poly)) errors.push('Polymythcal still smooth-scrolls after interaction');
if (!/setTimeout\(\(\) => \{\s*render\(\)/.test(poly)) warnings.push('Polymythcal search debounce was not detected');

const bookworm = read(path.join(ROOT, 'bookwormcard', 'index.html'));
const bookwormRain = read(path.join(ROOT, 'js', 'bookworm-rain.js'));
if (!bookworm.includes('/js/bookworm-rain.js?v=20260724-rain-lifecycle')) errors.push('Bookwormcard does not use the shared bounded rain lifecycle');
if (/setInterval\s*\(/.test(bookwormRain)) errors.push('Bookwormcard rain lifecycle retains a permanent interval');
for (const token of ['requestAnimationFrame(tick)', 'visibilitychange', 'pagehide', "dataset.motion !== 'calm'", 'prefers-reduced-motion: reduce']) {
  if (!bookwormRain.includes(token)) errors.push(`Bookwormcard rain lifecycle missing ${token}`);
}
if (/setInterval\(syncAnimalButtons/.test(bookworm)) errors.push('Bookwormcard touch-bar polling remains');
if (!/Keep focus behaviour local to the response area/.test(bookworm)) errors.push('Bookwormcard still lacks local-only focus behaviour');

const success = read(path.join(ROOT, 'bookwormcard', 'success', 'index.html'));
if (!success.includes('/js/bookworm-rain.js?v=20260724-rain-lifecycle')) errors.push('Bookwormcard success page does not use the shared bounded rain lifecycle');
const tamagotchi = read(path.join(ROOT, 'bookwormcard', 'tamagotchi.js'));
if (/setInterval\s*\(/.test(tamagotchi) || !/visibilitychange/.test(tamagotchi)) errors.push('Bookwormcard Tamagotchi idle work is not visibility-bounded');
const cloud = read(path.join(ROOT, 'leizu', 'cloud', 'index.html'));
for (const token of ['leizuSimulationAllowed', 'SIM_MAX_ACTIVE_MS', 'simFrameCount >= 240', 'visibilitychange', 'pagehide', "dataset.motion !== 'calm'", 'prefers-reduced-motion: reduce']) {
  if (!cloud.includes(token)) errors.push(`Leizu cloud bounded lifecycle missing ${token}`);
}
if (/setInterval\s*\(/.test(cloud) || (cloud.match(/requestAnimationFrame\(simLoop\)/g) || []).length !== 1) errors.push('Leizu cloud bypasses its single-frame scheduler');
const leizuLeafRoutes = [
  'leizu/index.html', 'leizu/teach/index.html',
  ...['fr', 'zh-hant', 'zh-hans', 'fa'].flatMap(locale => [
    `leizu/${locale}/index.html`, `leizu/${locale}/teach/index.html`,
  ]),
];
for (const relative of leizuLeafRoutes) {
  const html = read(path.join(ROOT, relative));
  const teach = relative.endsWith('/teach/index.html');
  const start = teach ? 'startAmbientLeaves' : 'startAmbient';
  const stop = teach ? 'stopAmbientLeaves(true)' : 'stopAmbient(true)';
  const enabled = teach ? 'leizuTeachMotionEnabled()' : 'leizuMotionEnabled()';
  for (const token of [
    'const initialLeafTimers = new Set()',
    'clearInitialLeafTimers()',
    'clearFlutterLeaves()',
    "window.addEventListener('pagehide'",
    "window.addEventListener('pageshow'",
    stop,
    start,
    `!document.hidden && ${enabled}`,
  ]) {
    if (!html.includes(token)) errors.push(`${relative}: leaf lifecycle missing ${token}`);
  }
}
const about = read(path.join(ROOT, 'about', 'index.html'));
const release = JSON.parse(read(path.join(ROOT, 'RELEASE_MANIFEST.json')));
const polymythcalAssetVersion = String(release.polymythcal_asset_version || '');
if (!/^[0-9]{8}-[a-z0-9-]+$/.test(polymythcalAssetVersion)) errors.push('Release manifest lacks a valid Polymythcal asset version');
if (/lenis\.min\.js|new Lenis\s*\(/.test(about)) errors.push('About page still runs Lenis');
if (!about.includes(`/polymythseminars/featured.json?v=${polymythcalAssetVersion}`)) errors.push('About page does not use the manifest-versioned compact featured-event feed');
if (/fetch\(['"]\/polymythseminars\/events\.json/.test(about) || /cache:\s*['"]no-store['"]/.test(about)) errors.push('About page still downloads or force-refreshes the full event archive');

const home = read(path.join(ROOT, 'index.html'));
for (const phrase of ['A student needs', 'A teacher wants', 'A class or reading group wants', 'An employer, school, collaborator']) {
  if (home.includes(phrase)) errors.push(`Homepage retains internal persona copy: ${phrase}`);
}
const mainCal = read(path.join(ROOT, 'polymythseminars', 'index.html'));
for (const phrase of ['Each shortcut starts a fresh view', 'Dedicated pages', 'Choose a filter to narrow the list. Multiple choices inside one group are combined.']) {
  if (mainCal.includes(phrase)) errors.push(`Polymythcal retains verbose/internal copy: ${phrase}`);
}
const generator = read(path.join(ROOT, 'scripts', 'build-polymythcal-audit13.py'));
for (const token of ['pm-event-page', 'pm-event-facts', 'pm-event-action']) {
  if (!generator.includes(token)) errors.push(`event-page generator missing ${token}`);
}

if (errors.length) {
  console.error('STEADY UI CHECK FAILED');
  errors.slice(0, 200).forEach(e => console.error(' - ' + e));
  if (errors.length > 200) console.error(` ... ${errors.length - 200} more`);
  process.exit(1);
}
console.log(`STEADY UI CHECK PASSED — ${sourceHtml.length} source pages, ${publicHtml.length} public pages, and ${runtimeFiles.length} active HTML/CSS/JS files satisfy the pre-paint, calm-interaction, scroll-geometry, anti-yap, bounded-render, and background-loop contracts.`);
warnings.forEach(w => console.warn('WARN ' + w));
