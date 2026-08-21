#!/usr/bin/env node
'use strict';

/**
 * Apply the manifest-owned asset token to active source HTML before localized
 * routes bind their English source hashes. This remains the historical Audit 49
 * migration step in the build chain, while the target now comes from the current
 * manifest so later releases remain buildable. Historical audit evidence and
 * browser programs stay outside this intentionally narrow surface.
 */
const fs = require('fs');
const path = require('path');
const {
  isGeneratedDependencyDirectory,
} = require('./repository-walk-policy');

const ROOT = path.resolve(__dirname, '..');
const CHECK = process.argv.includes('--check');
const FALLBACK_PREVIOUS_ASSETS = Object.freeze([
  '20260726-audit48',
  '20260728-audit53',
]);
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
const currentRelease = String(manifest.release_id || '').trim();
const currentAsset = String(manifest.polymythcal_asset_version || '');
if (!currentRelease) {
  throw new Error('Manifest release_id must be a non-empty string');
}
if (!/^\d{8}-[a-z0-9-]+$/.test(currentAsset)) {
  throw new Error(
    `Manifest polymythcal_asset_version has invalid format: ${currentAsset}`,
  );
}
const previousAssets = new Set(FALLBACK_PREVIOUS_ASSETS);
try {
  const previousManifest = JSON.parse(
    fs.readFileSync(
      path.join(ROOT, 'data', 'polymythcal-build-manifest.json'),
      'utf8',
    ),
  );
  const previousAsset = String(
    previousManifest.polymythcal_asset_version || '',
  ).trim();
  if (/^\d{8}-[a-z0-9-]+$/.test(previousAsset)) previousAssets.add(previousAsset);
} catch {
  // A first build may not have a prior generated manifest.
}
previousAssets.delete(currentAsset);

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
  const staleAssets = [...previousAssets].filter(asset => before.includes(asset));
  if (!staleAssets.length) continue;
  const relative = path.relative(ROOT, target).split(path.sep).join('/');
  if (CHECK) {
    stale.push(relative);
    continue;
  }
  const after = staleAssets.reduce(
    (source, asset) => source.split(asset).join(currentAsset),
    before,
  );
  const temporary = `${target}.audit49-tmp`;
  fs.writeFileSync(temporary, after, {mode: fs.statSync(target).mode});
  fs.renameSync(temporary, target);
  fs.utimesSync(target, outputMtime, outputMtime);
  changed += 1;
}

if (stale.length) {
  console.error(
    `MANIFEST RELEASE STAMP CHECK FAILED — ${stale.length} stale pages`,
  );
  stale.slice(0, 100).forEach(relative => console.error(` - ${relative}`));
  process.exit(1);
}
console.log(
  `MANIFEST RELEASE STAMP ${CHECK ? 'CHECK ' : ''}PASSED — `
  + `${files.length} active source pages inspected, ${changed} updated, `
  + `target ${currentRelease} / ${currentAsset}; historical audit evidence untouched.`,
);
