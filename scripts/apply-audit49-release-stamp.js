#!/usr/bin/env node
'use strict';

/**
 * Apply the Audit 49 manifest-owned asset token to active source HTML before
 * localized routes bind their English source hashes. Historical audit evidence
 * and browser programs stay outside this intentionally narrow surface.
 */
const fs = require('fs');
const path = require('path');
const {
  isGeneratedDependencyDirectory,
} = require('./repository-walk-policy');

const ROOT = path.resolve(__dirname, '..');
const CHECK = process.argv.includes('--check');
const PREVIOUS_ASSET = '20260726-audit48';
const EXPECTED_RELEASE =
  '2026-07-26-site-audit49-technical-efficiency-resilience-final';
const SOURCE_HTML_ROOTS = [
  '.well-known', 'agora', 'aitr', 'aa', 'bb', 'bookwormcard', 'campaigns',
  'cfps', 'fellowships', 'florilegium', 'humanities', 'lectures', 'leizu',
  'about', 'main', 'marginalia', 'nutrition', 'ohm-dome', 'philosophy',
  'polymyth', 'polymythcal', 'polymythseminars', 'reviews', 'saul', 'seminars',
  'sitemap', 'teacherresources', 'university', 'writingclub', 'writinggrads',
  'writingjuniors', 'writingkids', 'writingteens',
];
const manifest = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'RELEASE_MANIFEST.json'), 'utf8'),
);
const currentAsset = String(manifest.polymythcal_asset_version || '');
if (manifest.release_id !== EXPECTED_RELEASE) {
  throw new Error(`Audit 49 release stamp cannot target ${manifest.release_id}`);
}
if (currentAsset !== '20260726-audit49') {
  throw new Error(`Audit 49 release stamp cannot use ${currentAsset}`);
}

const requestedMtime = process.env.SS_BUILD_OUTPUT_MTIME
  ? new Date(process.env.SS_BUILD_OUTPUT_MTIME)
  : null;
if (requestedMtime && Number.isNaN(requestedMtime.getTime())) {
  throw new Error('SS_BUILD_OUTPUT_MTIME must be a valid timestamp');
}
const outputMtime = requestedMtime || new Date('2035-01-01T00:00:00Z');

function collect(directory, output) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory() && !isGeneratedDependencyDirectory(entry.name)) {
      collect(target, output);
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      output.push(target);
    }
  }
}

const files = ['404.html', 'index.html']
  .map(relative => path.join(ROOT, relative))
  .filter(target => fs.existsSync(target));
for (const relative of SOURCE_HTML_ROOTS) collect(path.join(ROOT, relative), files);

const stale = [];
let changed = 0;
for (const target of [...new Set(files)].sort()) {
  let before;
  try {
    before = fs.readFileSync(target, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') continue;
    throw error;
  }
  if (!before.includes(PREVIOUS_ASSET)) continue;
  const relative = path.relative(ROOT, target).split(path.sep).join('/');
  if (CHECK) {
    stale.push(relative);
    continue;
  }
  const after = before.split(PREVIOUS_ASSET).join(currentAsset);
  const temporary = `${target}.audit49-tmp`;
  fs.writeFileSync(temporary, after, {mode: fs.statSync(target).mode});
  fs.renameSync(temporary, target);
  fs.utimesSync(target, outputMtime, outputMtime);
  changed += 1;
}

if (stale.length) {
  console.error(`AUDIT49 RELEASE STAMP CHECK FAILED — ${stale.length} stale pages`);
  stale.slice(0, 100).forEach(relative => console.error(` - ${relative}`));
  process.exit(1);
}
console.log(
  `AUDIT49 RELEASE STAMP ${CHECK ? 'CHECK ' : ''}PASSED — `
  + `${files.length} active source pages inspected, ${changed} updated, `
  + 'historical audit evidence untouched.',
);
