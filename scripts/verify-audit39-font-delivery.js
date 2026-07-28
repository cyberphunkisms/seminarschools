#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { isGeneratedDependencyDirectory } = require('./repository-walk-policy');

const ROOT = path.resolve(__dirname, '..');
const SKIP = new Set(['.git', '.netlify', 'node_modules', 'public', 'fixtures']);
const CSS2_LINK_RE = /<link\b(?=[^>]*\brel=["']stylesheet["'])(?=[^>]*\bhref=["']https:\/\/fonts\.googleapis\.com\/css2\?[^"']+["'])[^>]*>/gi;
const HREF_RE = /\bhref=["'](https:\/\/fonts\.googleapis\.com\/css2\?[^"']+)["']/i;
const PRECONNECT_RE = /<link\b(?=[^>]*\brel=["']preconnect["'])(?=[^>]*\bhref=["']https:\/\/fonts\.(?:googleapis|gstatic)\.com(?:\/)?["'])[^>]*>/gi;
const PRECONNECT_HREF_RE = /\bhref=["'](https:\/\/fonts\.(?:googleapis|gstatic)\.com)(?:\/)?["']/i;
const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

function walk(directory, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (SKIP.has(entry.name) || isGeneratedDependencyDirectory(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolute, files);
    else if (entry.isFile() && entry.name.endsWith('.html')) files.push(absolute);
  }
  return files;
}

function familyNames(link) {
  const rawUrl = link.match(HREF_RE)?.[1];
  if (!rawUrl) return [];
  return new URL(rawUrl.replaceAll('&amp;', '&')).searchParams
    .getAll('family')
    .map(spec => spec.split(':')[0]);
}

let fontPages = 0;
for (const absolute of walk(ROOT)) {
  const relative = path.relative(ROOT, absolute).replaceAll(path.sep, '/');
  const html = fs.readFileSync(absolute, 'utf8');
  const links = html.match(CSS2_LINK_RE) || [];
  if (links.length) fontPages++;
  check(links.length <= 1, `${relative} issues ${links.length} Google Fonts stylesheets`);

  for (const link of links) {
    const rawUrl = link.match(HREF_RE)?.[1];
    const display = rawUrl
      ? new URL(rawUrl.replaceAll('&amp;', '&')).searchParams.get('display')
      : null;
    check(display === 'swap', `${relative} does not retain display=swap`);
  }

  const origins = (html.match(PRECONNECT_RE) || [])
    .map(link => link.match(PRECONNECT_HREF_RE)?.[1])
    .filter(Boolean);
  check(
    new Set(origins).size === origins.length,
    `${relative} repeats a Google Fonts preconnect`,
  );
}

const identities = new Map([
  ['ohm-dome/index.html', ['Major Mono Display', 'Chakra Petch', 'Geologica', 'Martian Mono']],
  ['nutrition/index.html', ['Frijole', 'Familjen Grotesk', 'Besley']],
  ['marginalia/index.html', ['Italiana', 'Unna', 'Vollkorn']],
  ['agora/index.html', ['Cinzel', 'GFS Didot', 'Andada Pro']],
  ['florilegium/index.html', ['Yeseva One', 'Gilda Display', 'Petrona']],
  ['aa/index.html', ['Cormorant Garamond', 'JetBrains Mono', 'Inter']],
  ['leizu/flyer/index.html', ['Cormorant Garamond', 'Noto Serif TC']],
  ['campaigns/thank-you-mam/index.html', [
    'Playfair Display',
    'Newsreader',
    'Special Elite',
    'DM Sans',
  ]],
]);
for (const [relative, expected] of identities) {
  const html = fs.readFileSync(path.join(ROOT, relative), 'utf8');
  const links = html.match(CSS2_LINK_RE) || [];
  const actual = new Set(links.flatMap(familyNames));
  expected.forEach(family => {
    check(actual.has(family), `${relative} lost its ${family} identity family`);
  });
}

check(fontPages >= 69, `font-delivery scope unexpectedly fell to ${fontPages} pages`);

if (failures.length) {
  console.error('AUDIT39 FONT DELIVERY FAILED');
  failures.forEach(failure => console.error(` - ${failure}`));
  process.exit(1);
}

console.log(
  `AUDIT39 FONT DELIVERY PASSED — ${fontPages} font-bearing source pages use at most `
    + 'one CSS2 stylesheet, retain swap rendering and project identity families, and '
    + 'avoid duplicate font-origin preconnects.',
);
