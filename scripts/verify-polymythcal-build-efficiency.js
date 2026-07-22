#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const failures = [];
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = rel => fs.existsSync(path.join(ROOT, rel));
const fail = msg => failures.push(msg);
const byteEqual = (a, b) => fs.readFileSync(path.join(ROOT, a)).compare(fs.readFileSync(path.join(ROOT, b))) === 0;

const calendarRel = 'polymythseminars/index.html';
const calendar = read(calendarRel);
const calendarBytes = fs.statSync(path.join(ROOT, calendarRel)).size;
if (!calendar.includes('id="pmEventList"') || !calendar.includes('/js/polymythcal-revamp.js?v=20260721-audit18')) fail('calendar client-shell mounts or Audit 18 asset version are missing');
if (!calendar.includes('name="ss-build"') || !calendar.includes('20260721-audit18')) fail('calendar build stamp is missing');
if (!calendar.includes('id="academicNav"')) fail('dedicated academic entry points are missing from the calendar');
if (!calendar.includes('aria-describedby="quickGuideCopy"')) fail('results region is not connected to its plain-language filter guidance');
if (calendar.includes('id="eventsContainer"') || calendar.includes('data-ssr-events="true"')) fail('legacy full-event payload returned to the main calendar');
if (calendarBytes >= 100000) fail(`calendar shell exceeds 100 KB: ${calendarBytes}`);

const revampJs = read('js/polymythcal-revamp.js');
if (!/cache:\s*[\"']no-cache[\"']/.test(revampJs)) fail('event JSON fetch does not allow conditional browser caching');
for (const key of ['raw_excerpt', 'qualification_reasons', 'topics', 'tags']) {
  if (!revampJs.includes(key)) fail(`search index omits ${key}`);
}
const revampCss = read('css/polymythcal-revamp.css');
if (!revampCss.includes('content-visibility: auto') || !revampCss.includes('contain-intrinsic-size')) fail('long result lists lack browser rendering containment');

const searchBuilder = read('scripts/build-search-pages.js');
if (!searchBuilder.includes("const clientShell = html.includes('id=\"pmEventList\"')")) fail('search builder lacks the lightweight client-shell branch');
if (searchBuilder.includes("if (!html.includes('id=\"eventsContainer\"')) throw new Error('Calendar event injection point is missing')")) fail('obsolete hard dependency on #eventsContainer remains');

const writingBuilder = read('scripts/build-writing-shortcuts.js');
if (!writingBuilder.includes('let html = read(`${slug}/index.html`);')) fail('writing builder does not preserve each dedicated route template');
const academicBuilder = read('scripts/build-academic-shortcuts.js');
if (!academicBuilder.includes("let html=read(`${route}/index.html`);") && !academicBuilder.includes("let html = read(`${route}/index.html`);")) fail('academic builder does not preserve each dedicated route template');

const dedicatedRoutes = [
  ...['writingclub','writingkids','writingjuniors','writingteens','writinggrads'].map(slug => ({slug, mount:'eventsContainer'})),
  ...['university','philosophy','humanities','cfps','lectures','fellowships'].map(slug => ({slug, mount:'eventsContainer'})),
];
for (const {slug, mount} of dedicatedRoutes) {
  const rel = `${slug}/index.html`;
  const html = read(rel);
  const expected = `https://seminarschools.com/${slug}/`;
  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/i)?.[1];
  if (canonical !== expected) fail(`${slug} canonical mismatch: ${canonical || 'missing'}`);
  if (!html.includes(`id="${mount}"`)) fail(`${slug} lost its dedicated event mount`);
  const publicRel = `public/${rel}`;
  if (!exists(publicRel) || !byteEqual(rel, publicRel)) fail(`${slug} source/public mirror mismatch`);
}

const typeLinker = read('scripts/apply-sitewide-type-zoom-link.js');
if (!typeLinker.includes('if (matches.length === 1 && matches[0] === LINK) continue;')) fail('site-wide type linker still rewrites already-correct pages');
for (const rel of [calendarRel, ...dedicatedRoutes.map(({slug}) => `${slug}/index.html`)]) {
  const html = read(rel);
  const matches = html.match(/<link[^>]+href="\/css\/site-wide-type-zoom\.css(?:\?[^"]*)?"[^>]*>/g) || [];
  if (matches.length !== 1) fail(`${rel} has ${matches.length} site-wide type/zoom links; expected exactly one`);
}

const netlify = read('netlify.toml');
const packageDoc = JSON.parse(read('package.json'));
const expectedBuildParts = [
  'node scripts/build-search-pages.js',
  'node scripts/build-writing-shortcuts.js',
  'node scripts/build-academic-shortcuts.js',
  'node scripts/apply-sitewide-type-zoom-link.js',
  'node scripts/apply-type-floor.js',
  'node scripts/build-public-deploy.js',
  'node scripts/verify-polymythcal-build-efficiency.js',
];
for (const part of expectedBuildParts) if (!(packageDoc.scripts?.build || '').includes(part)) fail(`package build command omits ${part}`);
if (!/command\s*=\s*"npm run build"/.test(netlify)) fail('Netlify build command does not use npm run build');
if (!/NODE_VERSION\s*=\s*"24"/.test(netlify)) fail('Netlify is not pinned to Node 24');
if (!/publish\s*=\s*"public"/.test(netlify)) fail('Netlify publish directory is not public');
if (netlify.includes("':(exclude)scripts/'")) fail('Netlify ignore rule still suppresses deploy-affecting script changes');
if (!netlify.includes("':(exclude)scripts/reports/'")) fail('Netlify ignore rule no longer excludes generated verifier reports');

const gitignore = read('.gitignore');
if (!/^public\/$/m.test(gitignore)) fail('generated public directory is not ignored by Git');

const releaseId = read('RELEASE_ID.txt').trim();
if (releaseId !== '2026-07-22-polymythcal-audit19-final') fail(`unexpected release id: ${releaseId}`);
const scrapeLog = JSON.parse(read('data/scrape-log.json'));
const scrapeCount = Number(scrapeLog.canonical_event_count ?? scrapeLog.public_event_count ?? scrapeLog.event_count ?? scrapeLog.events ?? scrapeLog.total_events ?? NaN);
if (scrapeCount !== 839) fail(`scrape summary is stale: ${scrapeCount}`);

const payload = JSON.parse(read('polymythseminars/events.json'));
if ((payload.events || []).length !== 839) fail(`expected 839 canonical event records, found ${(payload.events || []).length}`);
if (!exists('public/polymythseminars/events.json')) fail('public event data was not generated');
if (!byteEqual('polymythseminars/events.json', 'public/polymythseminars/events.json')) fail('source/public event JSON mirror mismatch');

for (const rel of ['polymythseminars/submit/index.html','polymythseminars/correct/index.html','polymythseminars/subscribe/index.html','polymythseminars/thanks/index.html']) {
  const html = read(rel);
  if (!/property="og:title"/i.test(html) || !/property="og:description"/i.test(html)) fail(`${rel} lacks complete Open Graph metadata`);
}

const forbidden = [/Kira spousal-sponsorship/i, /Kyra.?s 75% commission/i, /Kira UI review/i];
const textRoots = ['polymyth', 'hf_export', 'data', 'js', 'scripts'];
const textExt = new Set(['.html','.txt','.md','.json','.jsonl','.js','.css','.csv','.py','.bat']);
function walk(dir) {
  if (!exists(dir)) return;
  for (const ent of fs.readdirSync(path.join(ROOT, dir), {withFileTypes:true})) {
    const rel = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(rel);
    else if (ent.isFile() && textExt.has(path.extname(ent.name).toLowerCase())) {
      if (rel === 'scripts/verify-polymythcal-build-efficiency.js') continue;
      const text = read(rel);
      for (const re of forbidden) if (re.test(text)) fail(`private reference returned in ${rel}`);
    }
  }
}
textRoots.forEach(walk);

if (failures.length) {
  console.error('POLYMYTHCAL BUILD/EFFICIENCY CHECK FAILED');
  failures.forEach(x => console.error(' - ' + x));
  process.exit(1);
}
console.log(`POLYMYTHCAL BUILD/EFFICIENCY CHECK PASSED — ${calendarBytes} byte client shell, 839 events, 11 dedicated writing/academic entry points, cached JSON, rendering containment, deterministic type-link pass, Audit 19 release metadata, and clean privacy scan.`);
