#!/usr/bin/env node
'use strict';

/**
 * Audit 46 repair layer.
 *
 * Audit 43 is frozen historical evidence, so its original injector remains
 * byte-identical. Later generators can carry a release-stamped reference to
 * the same shared file before that injector runs. Normalize by URL pathname
 * immediately after the frozen injector and before localized governance
 * hashes are calculated, so browsers receive one stylesheet and one reader
 * controller regardless of query-string version.
 */
const fs = require('fs');
const path = require('path');
const {isGeneratedDependencyDirectory} = require('./repository-walk-policy');

const ROOT = path.resolve(__dirname, '..');
const CHECK = process.argv.includes('--check');
const REQUESTED_OUTPUT_MTIME = process.env.SS_BUILD_OUTPUT_MTIME
  ? new Date(process.env.SS_BUILD_OUTPUT_MTIME)
  : null;
if (REQUESTED_OUTPUT_MTIME && Number.isNaN(REQUESTED_OUTPUT_MTIME.getTime())) {
  throw new Error('SS_BUILD_OUTPUT_MTIME must be a valid timestamp');
}
const FUTURE_OUTPUT_MTIME = REQUESTED_OUTPUT_MTIME
  ? new Date(REQUESTED_OUTPUT_MTIME.getTime() + 2_000)
  : new Date('2035-01-01T00:00:00Z');
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
const STYLE_TAG = '<link rel="stylesheet" href="/css/audit43-approved.css?v=20260725-audit43">';
const READER_TAG = '<script src="/js/audit43-reader.js?v=20260725-audit43"></script>';
const STYLE_RE = /[ \t]*<link\b(?=[^>]*\brel=["'][^"']*\bstylesheet\b[^"']*["'])(?=[^>]*\bhref=["']\/css\/audit43-approved\.css(?:\?[^"']*)?["'])[^>]*>[ \t]*(?:\r?\n)?/gi;
const READER_RE = /[ \t]*<script\b(?=[^>]*\bsrc=["']\/js\/audit43-reader\.js(?:\?[^"']*)?["'])[^>]*>[ \t]*<\/script>[ \t]*(?:\r?\n)?/gi;

function posix(value) {
  return value.replace(/\\/g, '/');
}

function collect(directory, files) {
  if (!fs.existsSync(directory)) return;
  let entries;
  try {
    entries = fs.readdirSync(directory, {withFileTypes: true});
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory() && !isGeneratedDependencyDirectory(entry.name)) collect(target, files);
    else if (entry.isFile() && entry.name.endsWith('.html')) files.push(target);
  }
}

function keepFirst(source, pattern, canonicalTag) {
  let seen = 0;
  const normalized = source.replace(pattern, match => {
    seen += 1;
    if (seen !== 1) return '';
    const leading = match.match(/^[ \t]*/)?.[0] || '';
    const ending = match.match(/\r?\n$/)?.[0] || '';
    return `${leading}${canonicalTag}${ending}`;
  });
  return {normalized, seen};
}

const files = ROOT_HTML
  .map(name => path.join(ROOT, name))
  .filter(file => fs.existsSync(file));
for (const root of PUBLIC_ROOTS) collect(path.join(ROOT, root), files);

const stale = [];
let changed = 0;
let removedStyles = 0;
let removedReaders = 0;
let stylePages = 0;
let readerPages = 0;

for (const file of [...new Set(files)].sort()) {
  const relative = posix(path.relative(ROOT, file));
  let original;
  try {
    original = fs.readFileSync(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') continue;
    throw error;
  }
  const style = keepFirst(original, STYLE_RE, STYLE_TAG);
  const reader = keepFirst(style.normalized, READER_RE, READER_TAG);
  const normalized = reader.normalized;

  if (style.seen) stylePages += 1;
  if (reader.seen) readerPages += 1;
  removedStyles += Math.max(0, style.seen - 1);
  removedReaders += Math.max(0, reader.seen - 1);

  if (style.seen < 1 || (CHECK && style.seen !== 1)) {
    stale.push(`${relative}: expected one Audit 43 stylesheet, found ${style.seen}`);
  }
  const expectedReaders = READER_ALLOWLIST.has(relative) ? 1 : 0;
  if (
    reader.seen < expectedReaders
    || (!READER_ALLOWLIST.has(relative) && reader.seen > 0)
    || (CHECK && reader.seen !== expectedReaders)
  ) {
    stale.push(`${relative}: expected ${expectedReaders} Audit 43 reader script, found ${reader.seen}`);
  }
  if (normalized === original) continue;
  if (CHECK) {
    stale.push(`${relative}: duplicate shared asset reference`);
    continue;
  }
  const priorMtime = fs.statSync(file).mtime;
  const temporary = `${file}.audit46-tmp`;
  fs.writeFileSync(temporary, normalized, {mode: fs.statSync(file).mode});
  fs.renameSync(temporary, file);
  const regeneratedMtime = new Date(Math.max(
    FUTURE_OUTPUT_MTIME.getTime(),
    priorMtime.getTime() > Date.now() + 60_000
      ? priorMtime.getTime() + 2_000
      : 0,
  ));
  fs.utimesSync(file, regeneratedMtime, regeneratedMtime);
  changed += 1;
}

if (stale.length) {
  console.error('SHARED ASSET NORMALIZATION FAILED');
  stale.slice(0, 100).forEach(message => console.error(` - ${message}`));
  if (stale.length > 100) console.error(` - … ${stale.length - 100} more`);
  process.exit(1);
}

console.log(
  `SHARED ASSET NORMALIZATION PASSED — ${files.length} pages, ${stylePages} stylesheet owners, `
    + `${readerPages} reader routes, ${changed} files updated, `
    + `${removedStyles + removedReaders} duplicate references removed.`,
);
