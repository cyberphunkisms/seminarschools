#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { resourceAccessibleName } = require('./build-search-pages');
const { sourceFirstPairDefects } = require('./lib/futureproofing-contract-checks');
const ROOT = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const html = read('teacherresources/index.html');
const js = read('teacherresources/finder.js');
const css = read('teacherresources/finder.css');
const data = JSON.parse(read('teacherresources/resources-data.json'));
const packageJson = JSON.parse(read('package.json'));
const verifyRunner = read('scripts/verify-all-runner.js');
const browserRegression = read('scripts/verify-teacherresources-state-layout-browser.js');
const failures = [];

const entries = (data.groups || []).flatMap(group =>
  (group.categories || []).flatMap(category => category.entries || [])
);
const cards = (html.match(/class="entry(?:\s|")/g) || []).length;
const shells = (html.match(/class="entry-shell"/g) || []).length;
const sourceCtas = (html.match(/class="entry-source-cta"/g) || []).length;
const detailLinks = (html.match(/class="entry-detail"/g) || []).length;
const areaCards = (html.match(/class="teacher-area-card"/g) || []).length;
const categories = (html.match(/<details class="category"/g) || []).length;
const groups = (html.match(/<details class="group"/g) || []).length;
const bytes = Buffer.byteLength(html);
const initialGzipBytes = [html, css, js].reduce(
  (total, source) => total + zlib.gzipSync(Buffer.from(source), {level: 9}).length,
  0
);
const contentVersion = source => `sha256-${crypto.createHash('sha256').update(source).digest('hex').slice(0, 12)}`;
const cssVersion = contentVersion(css);
const jsVersion = contentVersion(js);

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
  `/teacherresources/finder.css?v=${cssVersion}`,
  `/teacherresources/finder.js?v=${jsVersion}`
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
  'id="teacher-areas"',
  'id="teacher-areas-title"',
  'Browse by teaching area',
  'Choose a subject',
  'go directly to the original publisher, archive, or organization',
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
  "var LEGACY_FILTER_STORAGE_KEYS = ['tr-filters-v4', 'tr-filters-v3', 'tr-filters-v2']",
  'function clearLegacyLocalState()',
  'localStorage.removeItem(key)',
  "controls.dataset.persistence = 'url-only'",
  'new URLSearchParams(location.search)',
  "window.addEventListener('popstate'",
  'validFilterValue',
  'restoreState();',
  'applyFilters({ skipSave: true });',
  'allVisibleOpen()',
  "event.key === '/'",
  "event.key === 'Escape'",
  'navigator.clipboard',
  'window.print()',
  'function scheduleExpandLabel()',
  "catalog.addEventListener('toggle', scheduleExpandLabel, true)",
  "shell: entryElement.closest('.entry-shell')",
  'if (entry.shell) entry.shell.hidden = !matches'
]) requireIn(js, needle);
if (/localStorage\.(?:getItem|setItem)\(\s*['"]tr-filters-v[234]['"]/.test(js)) {
  failures.push('legacy device filters can still be restored or persisted');
}
if (/restoreState\([^)]*allowLocal/.test(js)) {
  failures.push('filter restoration still permits local state to override the URL');
}
if (!/clearLegacyLocalState\(\);\s*restoreState\(\);[\s\S]{0,240}?applyFilters\(\{ skipSave: true \}\);/.test(js)) {
  failures.push('initial finder mount does not clear legacy storage and apply URL state without rewriting history');
}
for (const needle of [
  "const REPORTED_QUERY = '?format=indigenous&curriculum=alberta%2Cbc%2Ccommon-core'",
  "const LEGACY_KEYS = ['tr-filters-v4', 'tr-filters-v3', 'tr-filters-v2']",
  'const WIDTHS = [320, 375, 600, 768, 820, 880, 1280]',
  'clean URL remains clean with legacy storage',
  'explicit shared URL is preserved',
  'title does not collapse to one glyph per line',
  'has no orphan detail actions'
]) requireIn(browserRegression, needle, `browser regression: ${needle}`);
if (
  packageJson.scripts?.['verify:teacherresources-state-layout-browser']
  !== 'node scripts/verify-teacherresources-state-layout-browser.js'
) {
  failures.push('package scripts omit the focused Teacher Resources state/layout browser gate');
}
if (!verifyRunner.includes('node scripts/verify-teacherresources-state-layout-browser.js')) {
  failures.push('full verification runner omits the focused Teacher Resources state/layout browser gate');
}
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
  'details.group[hidden], details.category[hidden], .entry-shell[hidden], .entry[hidden] { display: none !important; }',
  '.teacher-area-grid',
  '.entry-shell',
  '.entry-source-cta',
  '.entry-detail',
  'container: resource-entries / inline-size',
  '@container resource-entries (max-width: 38rem)',
  'grid-template-columns: minmax(0, 1fr) 7.2rem',
  'grid-auto-rows: max-content',
  '@media (max-width: 768px)',
  'min-height: 44px'
]) requireIn(css, needle);

const baseEntryRule = (css.match(/(?:^|\n)\.entry\s*\{([^}]*)\}/) || [])[1] || '';
if (!/grid-template-columns\s*:\s*minmax\(0\s*,\s*1fr\)/.test(baseEntryRule)) {
  failures.push('resource card does not keep its title, metadata, and source action in one resilient column');
}
if (/grid-template-columns\s*:[^;]*\bauto\b/.test(baseEntryRule)) {
  failures.push('resource card restored the auto metadata track that collapsed titles to one glyph');
}
const baseMetaRule = (css.match(/(?:^|\n)\.entry-meta\s*\{([^}]*)\}/) || [])[1] || '';
if (!/flex-wrap\s*:\s*wrap/.test(baseMetaRule) || !/min-width\s*:\s*0/.test(baseMetaRule)) {
  failures.push('resource metadata cannot wrap safely inside the card column');
}

if (cards !== entries.length) failures.push(`expected ${entries.length} server-rendered resource cards, found ${cards}`);
if (shells !== entries.length) failures.push(`expected ${entries.length} source/detail wrappers, found ${shells}`);
if (sourceCtas !== entries.length) failures.push(`expected ${entries.length} visible original-resource actions, found ${sourceCtas}`);
if (detailLinks !== entries.length) failures.push(`expected ${entries.length} secondary detail actions, found ${detailLinks}`);
if (areaCards !== 7) failures.push(`expected 7 plain-language teaching-area cards, found ${areaCards}`);
if (entries.length !== 645) failures.push(`resource inventory changed: expected 645, found ${entries.length}`);
if (groups !== 7) failures.push(`group inventory changed: expected 7, found ${groups}`);
if (categories !== 25) failures.push(`collection inventory changed: expected 25, found ${categories}`);
const reportedCurricula = new Set(['alberta', 'bc', 'common-core']);
const reportedFilterMatches = entries.filter(entry =>
  entry.format === 'indigenous-pdf' && reportedCurricula.has(entry.curriculum)
);
if (reportedFilterMatches.length !== 9) {
  failures.push(`reported Indigenous/curriculum filter changed: expected 9 resources, found ${reportedFilterMatches.length}`);
}
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
  feedItems.length !== 645 ||
  feedGuids.length !== 645 ||
  new Set(feedGuids).size !== 645
) {
  failures.push('Teacher Resources feed must expose all 645 stable records');
}

const rootEntryTags = html.match(/<a\b[^>]*\bclass="entry(?:\s[^"]*)?"[^>]*>/g) || [];
const rootSourcePairs = rootEntryTags.map((tag, index) => ({
  primaryHref: ((tag.match(/\bhref="([^"]+)"/) || [])[1] || ''),
  detailHref: ((tag.match(/\bdata-detail-route="([^"]+)"/) || [])[1] || ''),
  allowInternalPrimary: String(entries[index] && entries[index].url || '').startsWith('/'),
}));
for (const defect of sourceFirstPairDefects(rootSourcePairs)) {
  failures.push(`shared source-first contract: ${defect}`);
}
if (rootEntryTags.length !== entries.length) {
  failures.push(`expected ${entries.length} labelled root resource links, found ${rootEntryTags.length}`);
} else {
  entries.forEach((entry, index) => {
    const expected = `aria-label="${escapeAttribute(`${resourceAccessibleName(entry, data)}; opens original resource${entry.host ? ` on ${entry.host}` : ''}`)}"`;
    const requiresOverride = Boolean(entry.notes || entry.grade === 'all');
    if (requiresOverride && !rootEntryTags[index].includes(expected)) {
      failures.push(`root resource link ${index + 1} is missing its concise complete accessible name`);
    }
    if (!requiresOverride && rootEntryTags[index].includes('aria-label=')) {
      failures.push(`root resource link ${index + 1} redundantly overrides its already-concise visible name`);
    }
    if (!rootEntryTags[index].includes(`href="${escapeAttribute(entry.url)}"`)) {
      failures.push(`root resource link ${index + 1} does not open its original source`);
    }
    if (!/\btarget="_blank"/.test(rootEntryTags[index]) || !/\brel="noopener noreferrer"/.test(rootEntryTags[index])) {
      failures.push(`root resource link ${index + 1} is missing safe external-link semantics`);
    }
    if (!/\bdata-detail-route="\/teacherresources\/.+\/"/.test(rootEntryTags[index])) {
      failures.push(`root resource link ${index + 1} is missing its stable secondary detail route`);
    }
  });
}
const expectedRootNameOverrides = entries.filter(entry => entry.notes || entry.grade === 'all').length;
const rootNameOverrides = rootEntryTags.filter(tag => tag.includes('aria-label=')).length;
if (rootNameOverrides !== expectedRootNameOverrides) {
  failures.push(`expected ${expectedRootNameOverrides} note-excluding/all-grade root accessible names, found ${rootNameOverrides}`);
}

let detailSourceCount = 0;
rootEntryTags.forEach((tag, index) => {
  const route = (tag.match(/\bdata-detail-route="([^"]+)"/) || [])[1] || '';
  if (!/^\/teacherresources\/.+\/$/.test(route)) return;
  const detailHtml = read(`${route.slice(1)}index.html`);
  const entry = entries[index];
  if (
    detailHtml.includes('class="source-banner"') &&
    detailHtml.includes(`href="${escapeAttribute(entry.url)}" target="_blank" rel="noopener noreferrer"`) &&
    detailHtml.includes('Open original resource')
  ) detailSourceCount += 1;
  else failures.push(`detail page ${route} does not lead with its safe original-resource action`);
  if (detailHtml.includes('data-allow-word-break="true"')) {
    failures.push(`Teacher Resources detail page ${route} incorrectly opts into technical-token word breaks`);
  }
});
if (detailSourceCount !== entries.length) {
  failures.push(`expected ${entries.length} source-first detail pages, found ${detailSourceCount}`);
}

let collectionRowCount = 0;
for (const group of data.groups || []) {
  for (const category of group.categories || []) {
    const categoryHtml = read(`teacherresources/${slug(group.id)}/${slug(category.id)}/index.html`);
    const rows = categoryHtml.match(/<article\b[^>]*\bclass="resource-row"[^>]*>[\s\S]*?<\/article>/g) || [];
    if (rows.length !== category.entries.length) {
      failures.push(`${group.id}/${category.id} has ${rows.length} source-first rows for ${category.entries.length} resources`);
      continue;
    }
    category.entries.forEach((entry, index) => {
      const expected = `aria-label="${escapeAttribute(`${resourceAccessibleName(entry, data)}; opens original resource${entry.host ? ` on ${entry.host}` : ''}`)}"`;
      const row = rows[index];
      if (!row.includes(expected)) {
        failures.push(`${group.id}/${category.id} resource row ${index + 1} is missing its source-first accessible name`);
      }
      const sourceHref = `href="${escapeAttribute(entry.url)}"`;
      if ((row.match(new RegExp(sourceHref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length !== 2) {
        failures.push(`${group.id}/${category.id} resource row ${index + 1} must expose its original source in both title and primary button`);
      }
      if (!row.includes('class="resource-source-link"') || !row.includes('target="_blank" rel="noopener noreferrer"')) {
        failures.push(`${group.id}/${category.id} resource row ${index + 1} lacks safe source-link semantics`);
      }
      if (!/class="button secondary" href="\/teacherresources\/.+\/">Details &amp; source notes<\/a>/.test(row)) {
        failures.push(`${group.id}/${category.id} resource row ${index + 1} lacks a secondary catalog-detail action`);
      }
    });
    collectionRowCount += rows.length;
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
// provenance while retaining the complete 645-card no-script catalog.
// The source-first model adds one explicit original-resource action and one
// stable catalog-detail action per record. These caps retain headroom without
// pretending the necessary 1,288 visible actions are free.
if (bytes > 730000) failures.push(`teacherresources/index.html exceeds 730 KB source-first budget: ${bytes} bytes`);
if (initialGzipBytes > 90000) failures.push(`teacher resources route assets exceed 90 KB source-first gzip budget: ${initialGzipBytes} bytes`);
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
