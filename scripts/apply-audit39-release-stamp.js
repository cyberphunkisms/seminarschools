#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  isGeneratedDependencyDirectory,
} = require('./repository-walk-policy');

const ROOT = path.resolve(__dirname, '..');
const OLD_ASSET = '20260724-' + 'audit38';
const NEW_ASSET = '20260724-audit39';
const OLD_SAUL_ASSET = '20260724-' + 'audit38-saul-runtime';
const NEW_SAUL_ASSET = '20260724-audit39-saul-runtime';
const RELEASE_ID =
  '2026-07-24-site-audit39-discovery-continuity-route-resilience-final';
const GENERATED_AT = '2026-07-24T22:30:00-04:00';
const FUTURE_MTIME = new Date('2034-01-01T00:00:00Z');
const TEMP_DIR = fs.mkdtempSync(path.join(ROOT, '.audit39-stamp-'));
const TEXT_EXTENSIONS = new Set([
  '.css', '.html', '.js', '.json', '.md', '.py', '.toml', '.txt', '.xml',
  '.xsl', '.yaml', '.yml',
]);
let changed = 0;
let temporaryFileIndex = 0;

function atomicWrite(target, content) {
  const stat = fs.existsSync(target) ? fs.statSync(target) : null;
  const temporary = path.join(
    TEMP_DIR,
    `${String(temporaryFileIndex).padStart(6, '0')}-${path.basename(target)}`,
  );
  temporaryFileIndex += 1;
  fs.writeFileSync(temporary, content, { mode: stat ? stat.mode : 0o644 });
  if (stat) fs.chmodSync(temporary, stat.mode);
  fs.utimesSync(temporary, FUTURE_MTIME, FUTURE_MTIME);
  fs.renameSync(temporary, target);
}

function posix(value) {
  return value.replace(/\\/g, '/');
}

function isHistorical(relative) {
  if (relative === 'scripts/apply-audit39-release-stamp.js') return true;
  if (relative === 'PACKAGE_CONTENTS_SHA256.json') return true;
  if (/^(?:WEBSITE|POLYMYTHCAL).*AUDIT(?:33|34|35|36|37|38)(?:[^0-9]|$)/i.test(relative)) {
    return true;
  }
  if (/^data\/audit(?:33|34|35|36|37|38)(?:[-/]|$)/i.test(relative)) return true;
  if (/^data\/polymythcal-audit(?:33|34|35|36|37|38)(?:[-/]|$)/i.test(relative)) {
    return true;
  }
  if (/^scripts\/.*audit(?:33|34|35|36|37|38)(?:[-_.]|$)/i.test(relative)) {
    return true;
  }
  return relative.startsWith('scripts/audits/')
    || relative.startsWith('scripts/reports/');
}

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (
      ['.git', '.netlify', 'node_modules', 'public'].includes(entry.name)
      || isGeneratedDependencyDirectory(entry.name)
    ) {
      continue;
    }
    const full = path.join(directory, entry.name);
    const relative = posix(path.relative(ROOT, full));
    if (entry.isDirectory()) {
      walk(full);
      continue;
    }
    if (
      !entry.isFile()
      || !TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())
      || isHistorical(relative)
    ) {
      continue;
    }
    const before = fs.readFileSync(full, 'utf8');
    let after = before;
    if (after.includes(OLD_ASSET)) after = after.split(OLD_ASSET).join(NEW_ASSET);
    if (after.includes(OLD_SAUL_ASSET)) {
      after = after.split(OLD_SAUL_ASSET).join(NEW_SAUL_ASSET);
    }
    if (after === before) continue;
    atomicWrite(full, after);
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
manifest.release_type =
  'Audit 39 organizer discovery, generated-route continuity, runtime smoothness, and no-backtracking release';
manifest.notes = [
  'Audit 38 remains immutable historical evidence. Its 838-event, 32-type, 422-source, 41/213 deterministic-source, 644/25/7 Teacher Resources, 1,139-methodology-entry, 24-card, 124-gate, and 3,550-public-file values are floors or historical facts rather than live ceilings.',
  'The unchanged four-hour deterministic protest crawl now prioritizes explicit action and calendar links, parses bounded long-form organizer announcements, preserves canonical detail URLs and partial facts, understands more RSS, iCalendar, JSON-LD, and organizer-page structures, and refuses corrupt state.',
  'Yearless announcement dates are anchored to their publication year so expired organizer posts cannot roll into false future events. Multi-location unstructured campaigns are city-filtered before Toronto publication.',
  'Generated Polymythcal event pages now disambiguate repeated titles, avoid speculative Event schema, provide factual metadata and related listings, and keep alias recovery shells semantic. Teacher Resources routes retain all 644 URLs while adding breadcrumbs and related-resource navigation.',
  'Shared runtime controllers now mount once, restore focus, synchronize responsive overlays, coalesce resize and back-forward restoration, and keep bounded animation work calm and reduced-motion aware. Teacher Resources search results are cached once per update.',
  'Google Fonts requests are consolidated per page without replacing project fonts. Overlapping Netlify cache rules now agree. Methodology images reserve intrinsic space and each register action advances exactly once.',
  'Archive creation excludes inherited package manifests and proves deterministic round trips. Canonical regeneration checks are read-only and must remain idempotent after production postprocessing.',
  'Fresh Audit 39 Chromium evidence is produced separately in predeploy; local packaging does not claim a browser engine or native screen-reader run. This was not a security audit.',
];
atomicWrite(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

const buildManifestPath = path.join(ROOT, 'data', 'polymythcal-build-manifest.json');
const buildManifest = JSON.parse(fs.readFileSync(buildManifestPath, 'utf8'));
buildManifest.build_id = RELEASE_ID;
buildManifest.release_id = RELEASE_ID;
buildManifest.generated_at = GENERATED_AT;
buildManifest.interface_release = RELEASE_ID;
buildManifest.polymythcal_asset_version = NEW_ASSET;
atomicWrite(buildManifestPath, `${JSON.stringify(buildManifest, null, 2)}\n`);
fs.rmdirSync(TEMP_DIR);

console.log(
  `AUDIT 39 RELEASE STAMP APPLIED — ${changed} active files moved to ${NEW_ASSET}; `
    + 'Saul runtime assets were cache-busted; Audit 38 evidence remained byte-identical.',
);
