#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = relativePath => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
const html = read('teacherresources/index.html');
const css = read('teacherresources/finder.css');
const js = read('teacherresources/finder.js');
const data = JSON.parse(read('teacherresources/resources-data.json'));
const failures = [];

const entries = (data.groups || []).flatMap(group =>
  (group.categories || []).flatMap(category => category.entries || [])
);
const renderedEntries = (html.match(/class="entry(?:\s|")/g) || []).length;

function requireIn(source, needle, label) {
  if (!source.includes(needle)) failures.push(`missing ${label}`);
}

requireIn(
  html,
  'aria-controls="filter-rows" aria-expanded="false" class="ctrl-btn filter-toggle" id="filter-toggle"',
  'viewport-independent advanced-filter disclosure'
);
requireIn(css, '.filter-rows { display: none; }', 'collapsed default facet panel');
requireIn(css, 'body.filters-open .filter-rows { display: block; }', 'explicit expanded facet panel');
requireIn(css, '.filter-toggle { display: inline-flex; align-items: center; }', 'visible disclosure at every viewport');
requireIn(js, "document.body.classList.toggle('filters-open')", 'facet disclosure interaction');
requireIn(js, "filterToggle.setAttribute('aria-expanded', open ? 'true' : 'false')", 'synchronized disclosure semantics');
requireIn(js, "filterToggle.textContent = open ? 'Hide filters' : 'More filters'", 'plain disclosure label');

if (/class="ctrl-btn mobile-only"\s+id="filter-toggle"/.test(html)) {
  failures.push('advanced-filter disclosure remains restricted to mobile');
}
if (/\.mobile-only\s*\{\s*display:\s*none/.test(css)) {
  failures.push('legacy desktop suppression can hide the advanced-filter disclosure');
}
if (entries.length !== 644) {
  failures.push(`resource inventory changed: expected 644, found ${entries.length}`);
}
if (renderedEntries !== entries.length) {
  failures.push(`static no-JS catalog changed: expected ${entries.length} entries, found ${renderedEntries}`);
}
if (!html.includes('data-ssr-catalog="true"')) {
  failures.push('static no-JS catalog marker is missing');
}
if (/IntersectionObserver|virtuali[sz]|renderWindow|loadMore/i.test(js) ||
    /id="load-more"|class="load-more"|data-pagination=/i.test(html)) {
  failures.push('density repair introduced virtualization, pagination, or load-more behavior');
}

if (failures.length) {
  console.error('AUDIT 41 TEACHER RESOURCES DENSITY CHECK FAILED');
  failures.forEach(failure => console.error(` - ${failure}`));
  process.exit(1);
}

console.log(
  'AUDIT 41 TEACHER RESOURCES DENSITY CHECK PASSED — ' +
  '644 static resources preserved; full facets collapse behind one operable disclosure at every viewport.'
);
