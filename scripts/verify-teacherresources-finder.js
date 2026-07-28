#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { resourceAccessibleName } = require('./build-search-pages');
const ROOT = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const html = read('teacherresources/index.html');
const js = read('teacherresources/finder.js');
const css = read('teacherresources/finder.css');
const data = JSON.parse(read('teacherresources/resources-data.json'));
const failures = [];

const entries = (data.groups || []).flatMap(group =>
  (group.categories || []).flatMap(category => category.entries || [])
);
const cards = (html.match(/class="entry(?:\s|")/g) || []).length;
const categories = (html.match(/<details class="category"/g) || []).length;
const groups = (html.match(/<details class="group"/g) || []).length;
const bytes = Buffer.byteLength(html);
const initialGzipBytes = [html, css, js].reduce(
  (total, source) => total + zlib.gzipSync(Buffer.from(source), {level: 9}).length,
  0
);

function requireIn(source, needle, label = needle) {
  if (!source.includes(needle)) failures.push(`missing ${label}`);
}
function escapeAttribute(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}
function slug(value) {
  const core = String(value || 'resource').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 76);
  return core || 'resource';
}

for (const needle of [
  'id="resource-finder"',
  'aria-label="Search resources"',
  'aria-keyshortcuts="/"',
  'aria-describedby="search-help"',
  'aria-live="polite"',
  'aria-atomic="true"',
  'role="status"',
  'id="result-count"',
  'id="filter-toggle"',
  'aria-controls="filter-rows"',
  'id="copy-view-link"',
  'id="print-results"',
  'aria-controls="catalog"',
  'aria-busy="false"',
  'aria-label="Resource filters"',
  'Clear search and filters',
  '/teacherresources/finder.css',
  '/teacherresources/finder.js'
]) requireIn(html, needle);
requireIn(html, 'aria-current="page" class="current" href="/teacherresources/"', 'current project navigation semantics');
requireIn(html, '<div aria-labelledby="quick-starts-label" class="quick-finder" role="group">', 'labelled Quick starts group');
requireIn(html, '<span class="quick-label" id="quick-starts-label">Quick filters</span>', 'Quick filters label target');
for (const needle of [
  'id="teacher-start-title"',
  'What are you trying to prepare?',
  'href="?format=lesson#catalog"',
  'href="?format=anthology,textbook#catalog"',
  'href="?format=assessment#catalog"',
  'href="?format=interactive#catalog"',
  'href="?curriculum=ontario#catalog"',
  'href="?curriculum=ib-dp,ib-myp#catalog"',
  'id="teacher-search-title"',
  'id="teacher-browse-title"',
  'class="teacher-facts"',
  'class="teacher-commons-note"',
  'href="/polymythlib/"',
  '<span class="quick-group-label">Subject</span>',
  '<span class="quick-group-label">Learner</span>',
  '<span class="quick-group-label">Material</span>'
]) requireIn(html, needle);

[
  ['subject-chips', 'subject-filter-label', 'Subject'],
  ['grade-chips', 'grade-filter-label', 'Grade'],
  ['format-chips', 'format-filter-label', 'Format'],
  ['province-chips', 'province-filter-label', 'Province'],
  ['program-chips', 'program-filter-label', 'Program']
].forEach(([groupId, labelId, label]) => {
  requireIn(
    html,
    `<div aria-labelledby="${labelId}" class="chip-group" id="${groupId}" role="group">`,
    `${label.toLowerCase()} filter group semantics`
  );
  requireIn(
    html,
    `<span class="chip-label" id="${labelId}">${label}</span>`,
    `${label.toLowerCase()} filter label target`
  );
});

const filterToggleTag = (html.match(/<button\b[^>]*\bid="filter-toggle"[^>]*>/i) || [])[0] || '';
if (!/\baria-expanded="false"/.test(filterToggleTag)) {
  failures.push('filter disclosure is missing initial aria-expanded state');
}
if (/\baria-pressed=/.test(filterToggleTag)) {
  failures.push('filter disclosure redundantly exposes aria-pressed');
}

for (const needle of [
  'data-preset-subject="ela"',
  'data-preset-subject="math"',
  'data-preset-subject="sciences"',
  'data-preset-subject="history"',
  'data-preset-subject="french"',
  'data-preset-subject="indigenous"',
  'data-preset-grades="K,1,2,3,4,5,6"',
  'data-preset-grades="7,8"',
  'data-preset-grades="9,10,11,12"',
  'data-preset-format="lesson"',
  'data-preset-format="anthology"',
  'data-preset-format="assessment"'
]) requireIn(html, needle);

for (const needle of [
  "document.querySelectorAll('[data-preset-subject],[data-preset-grade],[data-preset-format],[data-preset-grades]')",
  "normalize('NFD')",
  'queryTokens.every',
  "state.curricula.has(entry.curriculum)",
  'editDistanceWithin',
  'searchTokenMatches',
  'updateFacetCounts',
  'entryHasFilterValue',
  "chip.classList.toggle('unavailable'",
  'totalShown <= 24',
  'filtering && totalShown <= 24',
  "localStorage.setItem('tr-filters-v4'",
  "localStorage.getItem('tr-filters-v2')",
  'new URLSearchParams(location.search)',
  "window.addEventListener('popstate'",
  'validFilterValue',
  "restoreState({ allowLocal: false })",
  'allVisibleOpen()',
  "event.key === '/'",
  "event.key === 'Escape'",
  'navigator.clipboard',
  'window.print()',
  'function scheduleExpandLabel()',
  "catalog.addEventListener('toggle', scheduleExpandLabel, true)"
]) requireIn(js, needle);
if (/filterToggle\.setAttribute\(['"]aria-pressed['"]/.test(js)) {
  failures.push('filter disclosure script redundantly maintains aria-pressed');
}

const provinceChipBuilders = (js.match(/appendChip\('province-chips'/g) || []).length;
if (provinceChipBuilders !== 1) failures.push(`expected one province-chip builder, found ${provinceChipBuilders}`);
requireIn(js, "parent.querySelector('[data-filter-type=\"' + type + '\"][data-filter-value=\"' + value + '\"]')", 'duplicate facet-chip guard');

for (const needle of [
  '.finder-intro',
  '.finder-help',
  '.workflow-actions',
  '.chip-count',
  'white-space: normal',
  'content-visibility: auto',
  'details.group[hidden], details.category[hidden], .entry[hidden] { display: none !important; }',
  '@media (max-width: 768px)',
  'min-height: 44px'
]) requireIn(css, needle);

if (cards !== entries.length) failures.push(`expected ${entries.length} server-rendered resource cards, found ${cards}`);
if (entries.length !== 644) failures.push(`resource inventory changed: expected 644, found ${entries.length}`);
if (groups !== 7) failures.push(`group inventory changed: expected 7, found ${groups}`);
if (categories !== 25) failures.push(`collection inventory changed: expected 25, found ${categories}`);
const stableIds = entries.map(entry => entry.id);
const stableRoutes = entries.map(entry => entry.route_key);
if (
  stableIds.some(id => !/^TR-\d{4}$/.test(id || '')) ||
  new Set(stableIds).size !== entries.length
) {
  failures.push('every resource must carry a unique TR-0001 style stable ID');
}
if (
  stableRoutes.some(route => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(route || '')) ||
  new Set(stableRoutes).size !== entries.length
) {
  failures.push('every resource must carry a unique stable route key');
}
if (
  (data.groups || []).some(group =>
    (group.categories || []).some(category => !String(category.blurb || '').trim())
  )
) {
  failures.push('every collection must publish a meaningful orientation description');
}
const feed = read('teacherresources/feed.xml');
const feedItems = feed.match(/<item>[\s\S]*?<\/item>/g) || [];
const feedGuids = feedItems
  .map(item => (item.match(/<guid\b[^>]*>([^<]+)<\/guid>/) || [])[1])
  .filter(Boolean);
if (
  feedItems.length !== 644 ||
  feedGuids.length !== 644 ||
  new Set(feedGuids).size !== 644
) {
  failures.push('Teacher Resources feed must expose all 644 stable records');
}

const rootEntryTags = html.match(/<a\b[^>]*\bclass="entry(?:\s[^"]*)?"[^>]*>/g) || [];
if (rootEntryTags.length !== entries.length) {
  failures.push(`expected ${entries.length} labelled root resource links, found ${rootEntryTags.length}`);
} else {
  entries.forEach((entry, index) => {
    const expected = `aria-label="${escapeAttribute(resourceAccessibleName(entry, data))}"`;
    const requiresOverride = Boolean(entry.notes || entry.grade === 'all');
    if (requiresOverride && !rootEntryTags[index].includes(expected)) {
      failures.push(`root resource link ${index + 1} is missing its concise complete accessible name`);
    }
    if (!requiresOverride && rootEntryTags[index].includes('aria-label=')) {
      failures.push(`root resource link ${index + 1} redundantly overrides its already-concise visible name`);
    }
  });
}
const expectedRootNameOverrides = entries.filter(entry => entry.notes || entry.grade === 'all').length;
const rootNameOverrides = rootEntryTags.filter(tag => tag.includes('aria-label=')).length;
if (rootNameOverrides !== expectedRootNameOverrides) {
  failures.push(`expected ${expectedRootNameOverrides} note-excluding/all-grade root accessible names, found ${rootNameOverrides}`);
}

let collectionRowCount = 0;
for (const group of data.groups || []) {
  for (const category of group.categories || []) {
    const categoryHtml = read(`teacherresources/${slug(group.id)}/${slug(category.id)}/index.html`);
    const rowTags = categoryHtml.match(/<a\b[^>]*\bclass="resource-row"[^>]*>/g) || [];
    if (rowTags.length !== category.entries.length) {
      failures.push(`${group.id}/${category.id} has ${rowTags.length} labelled rows for ${category.entries.length} resources`);
      continue;
    }
    category.entries.forEach((entry, index) => {
      const expected = `aria-label="${escapeAttribute(resourceAccessibleName(entry, data))}"`;
      if (!rowTags[index].includes(expected)) {
        failures.push(`${group.id}/${category.id} resource row ${index + 1} is missing its concise accessible name`);
      }
    });
    collectionRowCount += rowTags.length;
  }
}
if (collectionRowCount !== entries.length) {
  failures.push(`expected ${entries.length} labelled collection-page resource rows, found ${collectionRowCount}`);
}

if (html.includes('1 collections')) failures.push('singular collection count uses plural grammar');
const expectedSingularCollectionCounts = (data.groups || []).filter(group => group.categories.length === 1).length;
const singularCollectionCounts = (html.match(/>1 collection<\/span>/g) || []).length;
if (singularCollectionCounts !== expectedSingularCollectionCounts) {
  failures.push(`expected ${expectedSingularCollectionCounts} singular collection labels, found ${singularCollectionCounts}`);
}
// Audit 53 adds task-first orientation, semantic shelf headings, and Commons
// provenance while retaining the complete 644-card no-script catalog.
if (bytes > 470000) failures.push(`teacherresources/index.html exceeds 470 KB budget: ${bytes} bytes`);
if (initialGzipBytes > 70000) failures.push(`teacher resources route assets exceed 70 KB gzip budget: ${initialGzipBytes} bytes`);
if ((html.match(/<h2 class="grp-title">/g) || []).length !== 7) {
  failures.push('Teacher Resources must expose seven navigable subject headings');
}
if ((html.match(/<h3 class="cat-title">/g) || []).length !== 25) {
  failures.push('Teacher Resources must expose 25 navigable collection headings');
}
if (html.includes('id="resources-data"')) failures.push('duplicate inline resource JSON remains');
if (html.includes('resources-data.json')) failures.push('build-only resource dataset is fetched by the browser');
if (html.includes('data-search="')) failures.push('duplicated data-search strings remain');
if (/<style>[\s\S]*<\/style>/.test(html)) failures.push('route CSS remains inline instead of cacheable');
if (/session runner|automatic sequence|auto-sequence/i.test(html + js)) failures.push('teacher finder introduced pedagogical sequencing');

if (failures.length) {
  console.error('TEACHER RESOURCES INTERACTIVITY CHECK FAILED');
  failures.forEach(failure => console.error(` - ${failure}`));
  process.exit(1);
}

const reduction = Math.round((1 - bytes / 787139) * 1000) / 10;
const gzipReduction = Math.round((1 - initialGzipBytes / 113509) * 1000) / 10;
console.log(
  `TEACHER RESOURCES INTERACTIVITY CHECK PASSED — ${entries.length} resources, ` +
  `${categories} collections, ${bytes} HTML bytes (${reduction}% below prior baseline), ` +
  `${initialGzipBytes} gzip bytes across route HTML/CSS/JS (${gzipReduction}% below prior baseline).`
);
