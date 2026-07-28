#!/usr/bin/env node
'use strict';

/**
 * Add a generic WebPage schema only where an active, indexable source page
 * has no more-specific JSON-LD. Existing structured data is left untouched.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://seminarschools.com';
const HTML_ROOTS = [
  '.well-known', 'agora', 'aitr', 'aa', 'bb', 'bookwormcard', 'campaigns',
  'cfps', 'fellowships', 'florilegium', 'humanities', 'lectures', 'leizu',
  'about', 'main', 'marginalia', 'nutrition', 'ohm-dome', 'philosophy',
  'polymyth', 'polymythcal', 'polymythseminars', 'reviews', 'saul', 'seminars',
  'sitemap', 'teacherresources', 'university', 'writingclub', 'writinggrads',
  'writingjuniors', 'writingkids', 'writingteens',
];
const EXEMPT = new Set([
  // Historical source pages remain byte-for-byte frozen.
  'polymyth/archive/pre-meaninglib/index.html',
]);
const checkOnly = process.argv.includes('--check');
const failures = [];
let updated = 0;
let covered = 0;

function posix(value) {
  return value.split(path.sep).join('/');
}
function attribute(tag, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return tag.match(new RegExp(`\\b${escaped}\\s*=\\s*(["'])(.*?)\\1`, 'i'))?.[2] ?? '';
}
function stripMarkup(value) {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(?:nbsp|#160);/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&(?:apos|#39);/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
function meta(head, key, value) {
  return [...head.matchAll(/<meta\b[^>]*>/gi)]
    .find(match => attribute(match[0], key).toLowerCase() === value.toLowerCase())?.[0] || '';
}
function canonical(head) {
  return [...head.matchAll(/<link\b[^>]*>/gi)]
    .find(match => attribute(match[0], 'rel').toLowerCase().split(/\s+/).includes('canonical'))?.[0] || '';
}
function walkHtml(relative) {
  const start = path.join(ROOT, relative);
  if (!fs.existsSync(start)) return [];
  const out = [];
  const stack = [start];
  while (stack.length) {
    const active = stack.pop();
    for (const entry of fs.readdirSync(active, {withFileTypes: true})) {
      const target = path.join(active, entry.name);
      if (entry.isDirectory()) stack.push(target);
      else if (entry.isFile() && entry.name.endsWith('.html')) {
        out.push(posix(path.relative(ROOT, target)));
      }
    }
  }
  return out;
}
function routeUrl(relative) {
  if (relative === 'index.html') return `${SITE}/`;
  if (relative.endsWith('/index.html')) {
    return `${SITE}/${relative.slice(0, -'index.html'.length)}`;
  }
  return `${SITE}/${relative}`;
}
function write(relative, content, previousMtime) {
  const target = path.join(ROOT, relative);
  fs.writeFileSync(target, content, 'utf8');
  const configured = process.env.SS_BUILD_OUTPUT_MTIME;
  const configuredMs = configured ? new Date(configured).getTime() : Number.NaN;
  const preserveMs = previousMtime > Date.now() + 60_000
    ? previousMtime + 2_000
    : configuredMs;
  if (Number.isFinite(preserveMs)) {
    const date = new Date(preserveMs);
    fs.utimesSync(target, date, date);
  }
}

const rootHtml = fs.readdirSync(ROOT, {withFileTypes: true})
  .filter(entry => entry.isFile() && entry.name.endsWith('.html'))
  .map(entry => entry.name)
  .filter(name => !/^google.*\.html$/i.test(name));
const documents = [...new Set([
  ...rootHtml,
  ...HTML_ROOTS.flatMap(walkHtml),
])].sort();

for (const relative of documents) {
  if (EXEMPT.has(relative)) continue;
  const target = path.join(ROOT, relative);
  const previousMtime = fs.statSync(target).mtimeMs;
  const html = fs.readFileSync(target, 'utf8');
  const headMatch = html.match(/<head\b[^>]*>([\s\S]*?)<\/head\s*>/i);
  if (!headMatch) {
    failures.push(`${relative}: missing head`);
    continue;
  }
  const head = headMatch[1];
  const robotsTag = meta(head, 'name', 'robots');
  const robots = attribute(robotsTag, 'content').toLowerCase().split(/[,\s]+/);
  const redirect = Boolean(meta(head, 'http-equiv', 'refresh'));
  if (redirect || robots.includes('noindex')) continue;
  if (/application\/ld\+json/i.test(head)) {
    covered += 1;
    continue;
  }

  const title = stripMarkup(
    head.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)?.[1] || '',
  );
  const description = attribute(meta(head, 'name', 'description'), 'content').trim();
  const canonicalUrl = attribute(canonical(head), 'href').trim();
  const lang = attribute(html.match(/<html\b[^>]*>/i)?.[0] || '', 'lang').trim();
  if (!title || !description || !canonicalUrl || !lang) {
    failures.push(`${relative}: cannot generate WebPage schema from incomplete metadata`);
    continue;
  }
  if (canonicalUrl !== routeUrl(relative)) {
    failures.push(`${relative}: indexable canonical is not self-referential`);
    continue;
  }

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${canonicalUrl}#webpage`,
    url: canonicalUrl,
    name: title,
    description,
    inLanguage: lang,
    isPartOf: {'@id': `${SITE}/#website`},
  };
  const block = '<!-- Audit49 generic WebPage schema -->\n'
    + `<script type="application/ld+json">${
      JSON.stringify(schema).replace(/<\//g, '<\\/')
    }</script>\n`;
  const next = html.replace(/<\/head\s*>/i, `${block}</head>`);
  if (next === html) {
    failures.push(`${relative}: schema insertion point is missing`);
    continue;
  }
  if (checkOnly) {
    failures.push(`${relative}: generic WebPage schema has not been generated`);
    continue;
  }
  write(relative, next, previousMtime);
  updated += 1;
  covered += 1;
}

if (failures.length) {
  console.error('AUDIT49 METADATA HYGIENE FAILED');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log(
  `AUDIT49 METADATA HYGIENE PASSED — ${covered} indexable pages carry JSON-LD; `
    + `${updated} generic WebPage schemas generated; ${EXEMPT.size} frozen archive exempted.`,
);
