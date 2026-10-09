#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {isGeneratedDependencyDirectory} = require('./repository-walk-policy');
const ROOT = path.resolve(__dirname, '..');
const {ensureLock, writeJsonAtomic} = require('./lib/harvest-publication');
ensureLock(ROOT, __filename);
const PUBLIC = path.join(ROOT, 'public');
const OUT = path.join(ROOT, 'scripts', 'reports', 'asset-weight-report.json');

if (!fs.existsSync(PUBLIC)) {
  console.error('ASSET REPORT FAILED — public/ is missing; run the public build first.');
  process.exit(1);
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && !isGeneratedDependencyDirectory(entry.name)) walk(full, files);
    else if (entry.isFile()) files.push(full);
  }
  return files;
}

const files = walk(PUBLIC);
const assets = files.map(file => ({
  path: path.relative(PUBLIC, file).replace(/\\/g, '/'),
  size: fs.statSync(file).size,
  sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
  extension: path.extname(file).toLowerCase() || '[none]'
})).sort((a, b) => b.size - a.size || a.path.localeCompare(b.path));
const publicTreeSha256 = crypto.createHash('sha256').update(
  [...assets]
    .sort((a, b) => a.path.localeCompare(b.path))
    .map(asset => `${asset.path}\0${asset.size}\0${asset.sha256}\n`)
    .join(''),
).digest('hex');
const byExtension = {};
for (const asset of assets) {
  const row = byExtension[asset.extension] || { files: 0, bytes: 0 };
  row.files += 1;
  row.bytes += asset.size;
  byExtension[asset.extension] = row;
}
const runtimeExtensions = new Set(['.html','.css','.js','.json','.xml','.ics','.png','.jpg','.jpeg','.gif','.webp','.svg','.ico','.woff','.woff2','.ttf']);
const release = JSON.parse(fs.readFileSync(path.join(ROOT, 'RELEASE_MANIFEST.json'), 'utf8'));
const report = {
  generatedAt: release.generated_at || null,
  scope: 'public',
  totalFiles: assets.length,
  totalBytes: assets.reduce((sum, asset) => sum + asset.size, 0),
  publicTreeSha256,
  byExtension,
  largestAssets: assets.slice(0, 40),
  largestRuntimeAssets: assets.filter(asset => runtimeExtensions.has(asset.extension)).slice(0, 40)
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
const text = JSON.stringify(report, null, 2) + '\n';
if (!fs.existsSync(OUT) || fs.readFileSync(OUT, 'utf8') !== text) writeJsonAtomic(OUT, report);
if (process.env.SS_BUILD_OUTPUT_MTIME) {
  const outputMtime = new Date(process.env.SS_BUILD_OUTPUT_MTIME);
  if (Number.isNaN(outputMtime.getTime())) {
    console.error('ASSET REPORT FAILED — SS_BUILD_OUTPUT_MTIME is not a valid timestamp.');
    process.exit(1);
  }
  fs.utimesSync(OUT, outputMtime, outputMtime);
}
// This generator owns the measured asset report, never code or historical
// amendment hashes. Refresh only its current-release binding after measuring
// the real public tree so legitimate new records can pass later release gates.
const maintenance = release.polymythcal_maintenance_20261001;
if (release.ml_star_concept_application_update_2026_10_05) {
  const update=release.ml_star_concept_application_update_2026_10_05;
  const relative='scripts/reports/asset-weight-report.json';
  const digest=crypto.createHash('sha256').update(text).digest('hex');
  if(update.artifact_sha256[relative]!==digest){update.artifact_sha256[relative]=digest;writeJsonAtomic(path.join(ROOT,'RELEASE_MANIFEST.json'),release);}
} else if (maintenance) {
  const relative = 'scripts/reports/asset-weight-report.json';
  if (maintenance.release_id !== '2026-10-01-polymythcal-maintenance-v6'
    || maintenance.predecessor_sha256 !== 'b963e1eed45eab5fe4118e0b6670f0dbc1ecceda2b650fb91c195f9d3537c33a'
    || !/^[0-9a-f]{64}$/.test(maintenance.predecessor_artifact_sha256?.[relative] || '')
    || !/^[0-9a-f]{64}$/.test(maintenance.artifact_sha256?.[relative] || '')) {
    throw new Error('Asset report maintenance binding is incomplete or has the wrong predecessor');
  }
  const digest = crypto.createHash('sha256').update(text).digest('hex');
  if (maintenance.artifact_sha256[relative] !== digest) {
    maintenance.artifact_sha256[relative] = digest;
    writeJsonAtomic(path.join(ROOT, 'RELEASE_MANIFEST.json'), release);
  }
}
console.log(`ASSET REPORT BUILT — ${report.totalFiles} public files, ${report.totalBytes} bytes.`);
