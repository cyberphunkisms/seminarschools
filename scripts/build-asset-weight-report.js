#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const OUT = path.join(ROOT, 'scripts', 'reports', 'asset-weight-report.json');

if (!fs.existsSync(PUBLIC)) {
  console.error('ASSET REPORT FAILED — public/ is missing; run the public build first.');
  process.exit(1);
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (entry.isFile()) files.push(full);
  }
  return files;
}

const files = walk(PUBLIC);
const assets = files.map(file => ({
  path: path.relative(PUBLIC, file).replace(/\\/g, '/'),
  size: fs.statSync(file).size,
  extension: path.extname(file).toLowerCase() || '[none]'
})).sort((a, b) => b.size - a.size || a.path.localeCompare(b.path));
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
  byExtension,
  largestAssets: assets.slice(0, 40),
  largestRuntimeAssets: assets.filter(asset => runtimeExtensions.has(asset.extension)).slice(0, 40)
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
const text = JSON.stringify(report, null, 2) + '\n';
if (!fs.existsSync(OUT) || fs.readFileSync(OUT, 'utf8') !== text) fs.writeFileSync(OUT, text);
if (process.env.SS_BUILD_OUTPUT_MTIME) {
  const outputMtime = new Date(process.env.SS_BUILD_OUTPUT_MTIME);
  if (Number.isNaN(outputMtime.getTime())) {
    console.error('ASSET REPORT FAILED — SS_BUILD_OUTPUT_MTIME is not a valid timestamp.');
    process.exit(1);
  }
  fs.utimesSync(OUT, outputMtime, outputMtime);
}
console.log(`ASSET REPORT BUILT — ${report.totalFiles} public files, ${report.totalBytes} bytes.`);
