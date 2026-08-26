#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { isGeneratedDependencyDirectory } = require('./repository-walk-policy');
const { ROUTES } = require('./polymythcal-route-shell');

const ROOT = path.resolve(__dirname, '..');
const errors = [];
const warnings = [];
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = rel => fs.existsSync(path.join(ROOT, rel));

function allFiles(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (['.git', '.netlify', 'public'].includes(name) || isGeneratedDependencyDirectory(name)) continue;
    const file = path.join(dir, name);
    const stat = fs.statSync(file);
    if (stat.isDirectory()) allFiles(file, out);
    else out.push(file);
  }
  return out;
}

const appPath = path.join(ROOT, 'js', 'polymythcal-discovery.js');
const app = fs.existsSync(appPath) ? fs.readFileSync(appPath, 'utf8') : '';
for (const needle of [
  'function renderAll(',
  'function readStateFromUrl()',
  'function writeUrl(',
  'function updateStateLinks()',
  'function routeMatches(event)',
  'state.kindExplicitAll',
  "params.get('kind') === 'all'",
  "params.set('kind', 'all')",
  "params.set('route', routeScope)",
  "window.addEventListener('popstate'",
]) {
  if (!app.includes(needle)) errors.push(`shared Discovery controller lacks ${needle}`);
}
if (/behavior:\s*["']smooth["']|scheduleScrollToToday|eventsScroll/.test(app)) {
  errors.push('shared Discovery controller retains legacy smooth scrolling or re-anchoring');
}

const basePages = [
  { rel: 'polymythseminars/index.html', locale: 'en', surface: 'main', source: '/polymythseminars/browse.json' },
  { rel: 'polymythseminars/fr/index.html', locale: 'fr', surface: 'main', source: '/polymythseminars/browse.json' },
  { rel: 'polymythseminars/research/index.html', locale: 'en', surface: 'research', source: '/polymythseminars/browse.json' },
  { rel: 'polymythseminars/fr/research/index.html', locale: 'fr', surface: 'research', source: '/polymythseminars/browse.json' },
  { rel: 'polymythseminars/monitoring/index.html', locale: 'en', surface: 'monitoring', source: '/polymythseminars/watchlist.json' },
  { rel: 'polymythseminars/fr/monitoring/index.html', locale: 'fr', surface: 'monitoring', source: '/polymythseminars/watchlist.json' },
];
for (const page of basePages) {
  if (!exists(page.rel)) {
    errors.push(`missing ${page.rel}`);
    continue;
  }
  const html = read(page.rel);
  if (!html.includes(`lang="${page.locale === 'fr' ? 'fr-CA' : 'en-CA'}"`)) errors.push(`${page.rel} has the wrong document language`);
  if (!html.includes(`data-pmd-surface="${page.surface}"`) || !html.includes(`data-pmd-source="${page.source}"`)) {
    errors.push(`${page.rel} has the wrong Discovery surface/source contract`);
  }
  for (const needle of ['id="pmdSearch"', 'id="pmdResults"', 'id="pmdResultsTitle" tabindex="-1"', '/js/polymythcal-discovery.js']) {
    if (!html.includes(needle)) errors.push(`${page.rel} missing ${needle}`);
  }
  if (page.surface === 'research') {
    for (const needle of ['id="pmdFacetSearch"', 'id="pmdResearchFilters"']) if (!html.includes(needle)) errors.push(`${page.rel} missing ${needle}`);
  } else if (page.surface !== 'monitoring' && !html.includes('id="pmdCommonFilters"')) {
    errors.push(`${page.rel} missing compact common filters`);
  }
  if (/onclick=|document\.title|polymythcal-revamp\.js|function dispatchRender/.test(html)) errors.push(`${page.rel} retains legacy or inline interaction code`);
}

const focusedPages = [];
for (const [slug, cfg] of Object.entries(ROUTES)) {
  for (const locale of ['en', 'fr']) focusedPages.push({ slug, cfg, locale, rel: `${slug}/${locale === 'fr' ? 'fr/' : ''}index.html` });
}
for (const { slug, cfg, locale, rel } of focusedPages) {
  if (!exists(rel)) {
    errors.push(`missing ${rel}`);
    continue;
  }
  const html = read(rel);
  const h1 = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || '';
  if (!h1.replace(/<[^>]+>/g, '').trim()) errors.push(`${rel} visible h1 is empty`);
  for (const needle of [
    'data-pmd-surface="main"',
    'data-pmd-source="/polymythseminars/browse.json"',
    `data-pm-route="${slug}"`,
    `data-pm-default-content="${cfg.defaultContent}"`,
    'id="pmdSearch"',
    'id="pmdCommonFilters"',
    'id="pmdResults"',
    '/js/polymythcal-discovery.js',
  ]) {
    if (!html.includes(needle)) errors.push(`${rel} missing ${needle}`);
  }
  if (locale === 'en') {
    if (!html.includes('class="pmd-route-context"') || !html.includes('Browse all Polymythcal listings')) errors.push(`${rel} lacks focused context/escape path`);
    if (!html.includes(`/polymythseminars/research/?route=${slug}`)) errors.push(`${rel} drops route scope on Research handoff`);
  }
  if (/onclick=|document\.title|polymythcal-revamp\.js|function dispatchRender|scheduleScrollToToday|eventsScroll/.test(html)) {
    errors.push(`${rel} retains legacy or inline interaction code`);
  }
}

for (const junk of fs.readdirSync(ROOT)) {
  if (junk === ']]"' || junk === ' ]]' || junk.startsWith('= git status') || junk.startsWith('ersuserDocumentsGitHub') || junk.startsWith('till failed')) {
    errors.push(`junk paste artifact remains at repo root: ${junk}`);
  }
}
const files = allFiles(ROOT).filter(file => /\.(html|js)$/i.test(file));
let hrefHash = 0;
let preventDefault = 0;
let scrollCalls = 0;
let javascriptHref = 0;
for (const file of files) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  const source = fs.readFileSync(file, 'utf8');
  if (/href=["']javascript:/i.test(source)) {
    javascriptHref++;
    errors.push(`${rel} has javascript: href`);
  }
  if (/href=["']#["']/i.test(source)) hrefHash++;
  if (/preventDefault\(/.test(source)) preventDefault++;
  if (/\bscroll(?:To|IntoView)\s*\(/.test(source)) scrollCalls++;
}
if (hrefHash > 12) warnings.push(`${hrefHash} bare hash links found; current allowance is 12 for legacy interactive shells.`);
if (scrollCalls > 30) warnings.push(`${scrollCalls} scroll calls found; current allowance is 30 after Polymythcal de-jank.`);

if (errors.length) {
  console.error('SITE INTERACTIVITY CHECK FAILED');
  errors.forEach(error => console.error(` - ${error}`));
  warnings.forEach(warning => console.warn(`WARN ${warning}`));
  process.exit(1);
}
console.log(`SITE INTERACTIVITY CHECK PASSED — ${basePages.length} core and ${focusedPages.length} focused EN/FR Discovery routes use one URL-backed route/kind-aware controller with compact filters and no legacy re-anchoring. Site scan: ${files.length} HTML/JS files, ${preventDefault} intentional preventDefault handlers, ${scrollCalls} scroll helpers, ${hrefHash} bare hash links, ${javascriptHref} javascript hrefs.`);
warnings.forEach(warning => console.warn(`WARN ${warning}`));

