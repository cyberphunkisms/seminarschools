#!/usr/bin/env node
'use strict';

/**
 * Apply the small Audit 43 shared layer after route generators run.
 *
 * Every public HTML source gets reduced-motion-safe cross-document
 * transitions. Reader mode is explicitly allowlisted and therefore cannot
 * flatten the visual identities of interactive, game, catalog, or sales
 * routes.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const VERSION = '20260725-audit43';
const STYLE_LINK = `<link rel="stylesheet" href="/css/audit43-approved.css?v=${VERSION}">`;
const READER_SCRIPT = `<script src="/js/audit43-reader.js?v=${VERSION}"></script>`;
const PUBLIC_ROOTS = [
  '.well-known', 'agora', 'aitr', 'aa', 'bb', 'bookwormcard', 'campaigns',
  'cfps', 'fellowships', 'florilegium', 'humanities', 'lectures', 'leizu',
  'about', 'main', 'marginalia', 'nutrition', 'ohm-dome', 'philosophy',
  'polymyth', 'polymythcal', 'polymythseminars', 'reviews', 'saul', 'seminars',
  'sitemap', 'teacherresources', 'university', 'writingclub', 'writinggrads',
  'writingjuniors', 'writingkids', 'writingteens',
];
const ROOT_HTML = ['404.html', 'index.html'];
const READER_ALLOWLIST = new Set([
  'aa/index.html',
  'polymyth/index.html',
  'polymyth/bookwormburrows/index.html',
  'polymyth/campaigncodex/index.html',
  'polymyth/methodologylist/index.html',
  'polymyth/modulecanon/index.html',
]);

function posix(value) {
  return value.replace(/\\/g, '/');
}

function collect(directory, files) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) collect(target, files);
    else if (entry.isFile() && entry.name.endsWith('.html')) files.push(target);
  }
}

function writeIfChanged(file, content) {
  const before = fs.readFileSync(file, 'utf8');
  if (before === content) return false;
  const temporary = `${file}.audit43-tmp`;
  fs.writeFileSync(temporary, content, { mode: fs.statSync(file).mode });
  fs.renameSync(temporary, file);
  return true;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function removeInjectedLine(source, token) {
  return source.replace(
    new RegExp(`[\\t ]*${escapeRegExp(token)}[\\t ]*(?:\\r?\\n)?`, 'g'),
    '',
  );
}

function normalizeInsertionPrefix(prefix) {
  return prefix.replace(/[ \t]*(?:\r?\n[ \t]*){2,}$/, '\n');
}

const files = ROOT_HTML
  .map(name => path.join(ROOT, name))
  .filter(file => fs.existsSync(file));
for (const root of PUBLIC_ROOTS) collect(path.join(ROOT, root), files);

let changed = 0;
let readerRoutes = 0;
for (const file of [...new Set(files)].sort()) {
  const relative = posix(path.relative(ROOT, file));
  const isReaderRoute = READER_ALLOWLIST.has(relative);
  const injection = isReaderRoute
    ? `${STYLE_LINK}\n${READER_SCRIPT}`
    : STYLE_LINK;
  let source = fs.readFileSync(file, 'utf8');
  // Generators may preserve an earlier injected copy. Reinsert it in one
  // deterministic place before calm-ux.css, whose reduced-motion and
  // accessibility rules intentionally retain final-cascade authority.
  source = removeInjectedLine(source, STYLE_LINK);
  source = removeInjectedLine(source, READER_SCRIPT);
  const calmLink = source.match(
    /<link\b[^>]*href=["'][^"']*\/css\/calm-ux\.css[^"']*["'][^>]*>/i,
  );
  if (calmLink) {
    const index = source.indexOf(calmLink[0]);
    source = `${normalizeInsertionPrefix(source.slice(0, index))}`
      + `${injection}\n${calmLink[0]}`
      + source.slice(index + calmLink[0].length);
  } else {
    const headClose = source.match(/<\/head>/i);
    if (!headClose) {
      throw new Error(`Cannot apply Audit 43 stylesheet: ${relative} has no </head>.`);
    }
    const index = source.indexOf(headClose[0]);
    source = `${normalizeInsertionPrefix(source.slice(0, index))}`
      + `${injection}\n${headClose[0]}`
      + source.slice(index + headClose[0].length);
  }
  if (isReaderRoute) {
    readerRoutes += 1;
    if (!/<body\b[^>]*\bdata-reader-eligible=/i.test(source)) {
      source = source.replace(/<body\b/i, '<body data-reader-eligible="true"');
    }
  }
  if (writeIfChanged(file, source)) changed += 1;
}

if (readerRoutes !== READER_ALLOWLIST.size) {
  throw new Error(
    `Reader allowlist resolved ${readerRoutes}/${READER_ALLOWLIST.size} routes.`,
  );
}
console.log(
  `AUDIT 43 APPROVED UI APPLIED — ${changed} HTML files updated; `
    + `${files.length} route files carry the transition layer; `
    + `${readerRoutes} dense routes expose opt-in reader mode.`,
);
