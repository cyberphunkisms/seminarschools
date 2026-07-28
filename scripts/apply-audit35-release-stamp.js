#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  isGeneratedDependencyDirectory,
} = require('./repository-walk-policy');

const ROOT = path.resolve(__dirname, '..');
const OLD_ASSET = '20260723-audit34';
const NEW_ASSET = '20260723-audit35';
const RELEASE_ID = '2026-07-23-site-audit35-resilience-polish-final';
const GENERATED_AT = '2026-07-23T23:35:00-04:00';
const FUTURE_MTIME = new Date('2033-01-01T00:00:00Z');
const TEMP_DIR = fs.mkdtempSync(path.join(ROOT, '.audit35-stamp-'));
const TEXT_EXTENSIONS = new Set([
  '.css', '.html', '.js', '.json', '.md', '.py', '.toml', '.txt', '.xml',
  '.xsl', '.yaml', '.yml',
]);
const HISTORICAL_EXACT = new Set([
  'WEBSITE_AUDIT33_POLYMYTHCAL_TEACHERRESOURCES_REPORT_2026-07-23.md',
  'WEBSITE_CL_AUDIT33_2026-07-23.md',
  'WEBSITE_AUDIT34_IMPECCABLE_UI_EFFICIENCY_REPORT_2026-07-23.md',
  'scripts/verify-audit33-evolution.js',
  'scripts/verify-audit34-evolution.js',
  'scripts/verify-audit34-browser-evidence.js',
  'scripts/apply-audit34-release-stamp.js',
  'scripts/apply-audit35-release-stamp.js',
]);
const HISTORICAL_PREFIXES = [
  'data/polymythcal-audit34/',
];
let changed = 0;
let temporaryFileIndex = 0;

function atomicWrite(target, content) {
  const stat = fs.existsSync(target) ? fs.statSync(target) : null;
  const temporary = path.join(
    TEMP_DIR,
    `${String(temporaryFileIndex).padStart(6, '0')}-${path.basename(target)}`,
  );
  temporaryFileIndex += 1;
  fs.writeFileSync(temporary, content, {
    mode: stat ? stat.mode : 0o644,
  });
  if (stat) fs.chmodSync(temporary, stat.mode);
  fs.utimesSync(temporary, FUTURE_MTIME, FUTURE_MTIME);
  fs.renameSync(temporary, target);
}

function posix(value) {
  return value.replace(/\\/g, '/');
}

function isHistorical(rel) {
  return HISTORICAL_EXACT.has(rel)
    || HISTORICAL_PREFIXES.some(prefix => rel.startsWith(prefix))
    || rel.startsWith('scripts/audits/')
    || rel.startsWith('scripts/reports/');
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
      || isHistorical(rel)
    ) {
      continue;
    }
    const before = fs.readFileSync(full, 'utf8');
    if (!before.includes(OLD_ASSET)) continue;
    atomicWrite(full, before.split(OLD_ASSET).join(NEW_ASSET));
    changed += 1;
  }
}

walk(ROOT);
atomicWrite(path.join(ROOT, 'RELEASE_ID.txt'), `${RELEASE_ID}\n`);

const manifestPath = path.join(ROOT, 'RELEASE_MANIFEST.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
manifest.release_id = RELEASE_ID;
manifest.generated_at = GENERATED_AT;
manifest.polymythcal_asset_version = NEW_ASSET;
manifest.release_type = 'Audit 35 failure recovery, route polish, heavy-page efficiency, build/runtime integrity, and anti-backtracking release';
manifest.notes = [
  'Polymythcal preserves 838 canonical listings, 32 types, 422 sources, 595 qualified unconfirmed records, 24-item batches, and the four-hour no-shard protest crawl while adding strict payload validation, bounded retry, last-good fallback, and navigation recovery.',
  'Teacher Resources preserves 644 resources, 25 collections, and seven groups while adding duplicate-init, corrupt-storage, quota, history, rapid-input, and back-forward-cache resilience.',
  'Eight identity-bearing routes gain bounded short-screen controls, stable Bookwormcard first paint, fallback-safe wrapping, print cleanup, forced-colour support, and recoverable fixed navigation without a global redesign.',
  'Shared vocabulary linking is bounded for very large reference pages without changing source content, linkability policy, route architecture, or framework identity.',
  'Build verification reuses canonical output, enforces tighter page/runtime budgets, and writes deterministic integrity-manifested ZIPs without weakening the three-operating-system or full browser predeploy gates.',
  'Audit 34 reports, browser evidence, and evolution gates remain unchanged as historical evidence. Security assessment remains outside this release.',
];
atomicWrite(
  manifestPath,
  JSON.stringify(manifest, null, 2) + '\n',
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
buildManifest.generated_at = GENERATED_AT;
buildManifest.interface_release = RELEASE_ID;
buildManifest.polymythcal_asset_version = NEW_ASSET;
atomicWrite(
  buildManifestPath,
  JSON.stringify(buildManifest, null, 2) + '\n',
);
fs.rmdirSync(TEMP_DIR);

console.log(
  `AUDIT 35 RELEASE STAMP APPLIED — ${changed} active files moved from ${OLD_ASSET} to ${NEW_ASSET}; Audit 34 evidence preserved.`,
);
