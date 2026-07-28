#!/usr/bin/env node
'use strict';

/**
 * Audit 33 anti-backtracking gate.
 *
 * This deliberately checks outcomes inherited from Audit 32 alongside the
 * new Polymythcal and Teacher Resources work. Future harvests may add events
 * and sources, but may not shrink the accepted baseline or split the browser
 * corpus from the canonical calendar.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { isGeneratedDependencyDirectory } = require('./repository-walk-policy');

const ROOT = path.resolve(__dirname, '..');
const failures = [];

function read(rel) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) {
    failures.push(`${rel} is missing`);
    return '';
  }
  return fs.readFileSync(file, 'utf8');
}

function json(rel) {
  const text = read(rel);
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (error) {
    failures.push(`${rel} is not valid JSON: ${error.message}`);
    return {};
  }
}

function requireTrue(condition, message) {
  if (!condition) failures.push(message);
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['.git', 'public'].includes(entry.name) || isGeneratedDependencyDirectory(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

const releaseId = read('RELEASE_ID.txt').trim();
const release = json('RELEASE_MANIFEST.json');
requireTrue(
  releaseId === '2026-07-23-site-audit33-polymythcal-teacherresources-final',
  `unexpected release id: ${releaseId || '(empty)'}`,
);
requireTrue(release.release_id === releaseId, 'release manifest and RELEASE_ID.txt differ');
requireTrue(
  release.polymythcal_asset_version === '20260723-audit33',
  'Polymythcal asset version is not the Audit 33 token',
);

const canonicalText = read('polymythseminars/events.json');
const browseText = read('polymythseminars/browse.json');
const canonical = JSON.parse(canonicalText || '{"events":[]}');
const browse = JSON.parse(browseText || '{"events":[]}');
const events = Array.isArray(canonical.events) ? canonical.events : [];
const browseEvents = Array.isArray(browse.events) ? browse.events : [];
const ids = events.map(event => String(event.id || ''));
const browseIds = browseEvents.map(event => String(event.id || ''));
requireTrue(events.length >= 838, `canonical event baseline regressed: ${events.length}/838`);
requireTrue(new Set(ids).size === ids.length, 'canonical event IDs are not unique');
requireTrue(
  JSON.stringify(browseIds) === JSON.stringify(ids),
  'browse payload does not preserve every canonical ID in canonical order',
);
requireTrue(
  zlib.gzipSync(Buffer.from(browseText)).length
    < zlib.gzipSync(Buffer.from(canonicalText)).length,
  'browse payload is not smaller than the canonical payload after gzip',
);

const sources = json('scripts/sources.json');
const sourceRows = Array.isArray(sources) ? sources : (sources.sources || []);
requireTrue(sourceRows.length >= 422, `registered source baseline regressed: ${sourceRows.length}/422`);

const adapters = read('scripts/polymythcal_adapters.py');
const discovery = read('scripts/polymythcal_discovery.py');
const protestHarvester = read('scripts/harvest_protests.py');
const seminarMerger = read('scripts/merge-seminar-harvest-into-calendar.js');
for (const token of [
  'def event_occurrence_key',
  'def event_identity_aliases',
  'def records_represent_same_occurrence',
  'return event_occurrence_key(record)',
]) requireTrue(adapters.includes(token), `occurrence identity contract is missing ${token}`);
for (const token of [
  'authoritative_empty_evidence',
  'empty_evidence',
  'parse-empty-regression',
  'enqueue_javascript_fallbacks',
  'blank or near-blank response without explicit empty evidence',
]) requireTrue(discovery.includes(token), `discovery failure contract is missing ${token}`);
requireTrue(
  protestHarvester.includes('result_alias_counts')
    && protestHarvester.includes('unique_publisher_reschedule'),
  'protest state no longer distinguishes recurring aliases from unique publisher reschedules',
);
requireTrue(
  seminarMerger.includes('function occurrenceKey')
    && seminarMerger.includes('previous_dates'),
  'seminar merger lost occurrence-unique publication or reschedule history',
);
requireTrue(
  fs.existsSync(path.join(ROOT, 'scripts/test-merge-seminar-occurrences.js')),
  'JavaScript occurrence merge regression test is missing',
);
requireTrue(
  fs.existsSync(path.join(ROOT, 'scripts/test_deterministic_before_agent.py')),
  'deterministic-before-agent workflow regression test is missing',
);

const teacher = read('teacherresources/index.html');
const entryCount = (teacher.match(/<a\b[^>]*class="entry\b/g) || []).length;
const groupCount = (teacher.match(/<details\b[^>]*class="group\b/g) || []).length;
const collectionCount = (teacher.match(/<details\b[^>]*class="category\b/g) || []).length;
requireTrue(entryCount === 644, `Teacher Resources changed from 644 entries to ${entryCount}`);
requireTrue(groupCount === 7, `Teacher Resources changed from 7 groups to ${groupCount}`);
requireTrue(collectionCount === 25, `Teacher Resources changed from 25 collections to ${collectionCount}`);
for (const token of [
  '/teacherresources/finder.css?v=20260723-audit33',
  '/teacherresources/finder.js?v=20260723-audit33',
  'id="resource-finder"',
  'id="copy-view-link"',
  'id="print-results"',
  'Use several words in any order',
]) requireTrue(teacher.includes(token), `Teacher Resources is missing ${token}`);

const finder = read('teacherresources/finder.js');
for (const token of [
  "normalize('NFD')",
  'URLSearchParams',
  'history.replaceState',
  'navigator.clipboard',
  'window.print',
  "event.key === '/'",
  "event.key === 'Escape'",
  "localStorage.getItem('tr-filters-v2')",
  'allVisibleOpen()',
]) requireTrue(finder.includes(token), `Teacher Resources finder is missing ${token}`);
const finderCss = read('teacherresources/finder.css');
requireTrue(
  finderCss.includes('details.group[hidden], details.category[hidden], .entry[hidden] { display: none !important; }'),
  'Teacher Resources print view no longer preserves the active result set',
);

const keyboard = read('js/site-keyboard-enhancements.js');
for (const token of [
  'if(ev.defaultPrevented) return',
  '&& !ev.altKey && !ev.ctrlKey && !ev.metaKey && !ev.shiftKey',
  'function interactive',
]) requireTrue(keyboard.includes(token), `keyboard guard is missing ${token}`);

const mainCss = read('css/main.css');
requireTrue(!/@import\s+url\(/i.test(mainCss), 'main CSS restored a render-blocking font import');
for (const file of walk(ROOT).filter(file => file.endsWith('.html'))) {
  const html = fs.readFileSync(file, 'utf8');
  const where = path.relative(ROOT, file).replace(/\\/g, '/');
  if (html.includes('/js/site-keyboard-enhancements.js')) {
    requireTrue(
      html.includes('/js/site-keyboard-enhancements.js?v=20260723-audit33'),
      `${where} does not cache-bust the changed keyboard helper`,
    );
  }
  if (html.includes('/css/theme.css')) {
    requireTrue(
      html.includes('/css/theme.css?v=20260723-audit33'),
      `${where} does not cache-bust the changed theme controls`,
    );
  }
  if (!html.includes('/css/main.css')) continue;
  requireTrue(
    html.includes('/css/main.css?v=20260723-audit33'),
    `${where} does not cache-bust the changed shared typography`,
  );
  requireTrue(html.includes('family=DM+Sans'), `${where} no longer loads the shared UI sans`);
  requireTrue(html.includes('family=JetBrains+Mono'), `${where} no longer loads the shared UI mono`);
}
const themeCss = read('css/theme.css');
const zoomCss = read('css/site-wide-type-zoom.css');
const polymythcalCss = read('css/polymythcal-revamp.css');
requireTrue(/\.theme-toggle[\s\S]{0,500}width:\s*44px/.test(themeCss), 'theme toggle lost its 44px floor');
requireTrue(/\.ss-fz[\s\S]{0,500}min-width:\s*44px/.test(zoomCss), 'type-size control lost its 44px floor');
requireTrue(
  zoomCss.includes('.ss-fz[data-fz-placement="bottom-left"]{right:auto!important}'),
  'bottom-left type controls are again stretched by the global right offset',
);
requireTrue(
  /@media screen and \(max-width:820px\)\{[\s\S]*?\.ss-fz\{[\s\S]*?left:\.75rem!important/.test(zoomCss),
  'narrow and high-zoom type controls are not moved clear of the masthead',
);
requireTrue(
  /@media screen and \(max-width:820px\)\{[\s\S]*?\.theme-toggle\{[\s\S]*?bottom:max\(\.75rem,env\(safe-area-inset-bottom\)\)!important/.test(zoomCss),
  'narrow and high-zoom theme toggle is not moved clear of the masthead',
);
for (const rel of ['aa/index.html', 'aa/cloud/index.html', 'aa/views/index.html', 'aa/editorial.html']) {
  requireTrue(
    read(rel).includes('data-fz-placement="bottom-left"'),
    `${rel} lost its bottom-left type-control placement`,
  );
}
requireTrue(/\.pm-search-clear[\s\S]{0,500}(?:min-width|width):\s*44px/.test(polymythcalCss), 'Polymythcal search clear control lost its 44px floor');

const protestWorkflow = read('.github/workflows/scrape-polymythcal-protests.yml');
requireTrue(protestWorkflow.includes('18 */4 * * *'), 'four-hour protest workflow cadence regressed');
requireTrue(protestWorkflow.includes('without sharding'), 'protest workflow no longer declares no-shard harvesting');

const seminarWorkflow = read('.github/workflows/scrape-seminars.yml');
const deterministicAt = seminarWorkflow.indexOf('Run deterministic priority structured discovery');
const publishAt = seminarWorkflow.indexOf('Publish deterministic');
const agentAt = seminarWorkflow.indexOf('Install Claude Code CLI');
requireTrue(deterministicAt >= 0, 'seminar workflow lacks deterministic structured discovery');
requireTrue(
  publishAt > deterministicAt && publishAt < agentAt,
  'deterministic discoveries are not published before the optional agent stage',
);
requireTrue(
  seminarWorkflow.includes('branch: automation/polymythcal-seminars'),
  'seminar workflow does not use a valid static PR branch',
);

const ledger = read('WEBSITE_CL_AUDIT33_2026-07-23.md');
requireTrue(!/`(?:in progress|pending)`/.test(ledger), 'Audit 33 component ledger still has unfinished items');
requireTrue(
  fs.existsSync(path.join(ROOT, 'WEBSITE_AUDIT33_POLYMYTHCAL_TEACHERRESOURCES_REPORT_2026-07-23.md')),
  'Audit 33 report is missing',
);

if (failures.length) {
  console.error('AUDIT 33 EVOLUTION GATE FAILED');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log(
  `AUDIT 33 EVOLUTION GATE PASSED — ${events.length} events, `
  + `${sourceRows.length} sources, ${entryCount} teacher resources; Audit 32 decisions preserved.`,
);
