#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  isGeneratedDependencyDirectory,
} = require('./repository-walk-policy');

const ROOT = path.resolve(__dirname, '..');
const OLD_ASSET = ['20260723', 'audit33'].join('-');
const NEW_ASSET = '20260723-audit34';
const RELEASE_ID = '2026-07-23-site-audit34-impeccable-ui-efficiency-final';
const TEXT_EXTENSIONS = new Set([
  '.css', '.html', '.js', '.json', '.md', '.py', '.toml', '.txt', '.xml',
  '.xsl', '.yaml', '.yml',
]);
const HISTORICAL_EXACT = new Set([
  'WEBSITE_AUDIT33_POLYMYTHCAL_TEACHERRESOURCES_REPORT_2026-07-23.md',
  'WEBSITE_CL_AUDIT33_2026-07-23.md',
  'scripts/verify-audit33-evolution.js',
  'scripts/apply-audit34-release-stamp.js',
]);
let changed = 0;

function posix(value) {
  return value.replace(/\\/g, '/');
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (
      ['.git', '.netlify', 'node_modules', 'public'].includes(entry.name)
      || isGeneratedDependencyDirectory(entry.name)
    ) {
      continue;
    }
    const full = path.join(dir, entry.name);
    const rel = posix(path.relative(ROOT, full));
    if (entry.isDirectory()) {
      walk(full);
      continue;
    }
    if (
      !entry.isFile()
      || !TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())
      || HISTORICAL_EXACT.has(rel)
      || rel.startsWith('scripts/audits/')
      || rel.startsWith('scripts/reports/')
    ) {
      continue;
    }
    const before = fs.readFileSync(full, 'utf8');
    if (!before.includes(OLD_ASSET)) continue;
    fs.writeFileSync(full, before.split(OLD_ASSET).join(NEW_ASSET), 'utf8');
    changed += 1;
  }
}

walk(ROOT);
fs.writeFileSync(path.join(ROOT, 'RELEASE_ID.txt'), `${RELEASE_ID}\n`, 'utf8');
const manifestPath = path.join(ROOT, 'RELEASE_MANIFEST.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
manifest.release_id = RELEASE_ID;
manifest.generated_at = '2026-07-23T20:00:00-04:00';
manifest.polymythcal_asset_version = NEW_ASSET;
manifest.release_type = 'Audit 34 Tier 0 interaction, accessibility, workflow efficiency, build integrity, and anti-backtracking release';
manifest.notes = [
  'Polymythcal preserves 838 canonical events and the four-hour no-shard protest policy while removing the duplicate protest crawl from the seminar workflow.',
  'Scheduled harvests use pinned cached dependencies and fast semantic data gates; full adapter, lifecycle, Audit 14, WCAG, interaction, and entry-page browser gates remain mandatory in predeployment.',
  'The canonical build now verifies complete byte-level source/public parity, and repository scanners plus both ZIP packagers exclude virtual environments, dependency trees, and generated caches.',
  'Polymythcal and Teacher Resources add recoverable loading, URL and history restoration, precise live counts, clearer freshness and source details, and stronger keyboard and assistive-technology state handling.',
  'Audit 33 reports and its evolution gate remain in the source archive as historical evidence.',
];
fs.writeFileSync(
  manifestPath,
  JSON.stringify(manifest, null, 2) + '\n',
  'utf8',
);
const buildManifestPath = path.join(
  ROOT,
  'data',
  'polymythcal-build-manifest.json',
);
const buildManifest = JSON.parse(
  fs.readFileSync(buildManifestPath, 'utf8'),
);
buildManifest.build_id = RELEASE_ID;
buildManifest.release_id = RELEASE_ID;
buildManifest.generated_at = manifest.generated_at;
buildManifest.interface_release = RELEASE_ID;
buildManifest.polymythcal_asset_version = NEW_ASSET;
fs.writeFileSync(
  buildManifestPath,
  JSON.stringify(buildManifest, null, 2) + '\n',
  'utf8',
);
console.log(
  `AUDIT 34 RELEASE STAMP APPLIED — ${changed} active files moved from ${OLD_ASSET} to ${NEW_ASSET}; Audit 33 evidence preserved.`,
);
