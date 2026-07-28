#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  isGeneratedDependencyDirectory,
} = require('./repository-walk-policy');

const ROOT = path.resolve(__dirname, '..');
const OLD_ASSET = '20260724-' + 'audit40';
const NEW_ASSET = '20260725-audit41';
const OLD_SAUL_ASSET = '20260724-' + 'audit40-saul-runtime';
const NEW_SAUL_ASSET = '20260725-audit41-saul-runtime';
const RELEASE_ID =
  '2026-07-25-site-audit41-depth-rollover-density-final';
function easternTimestamp(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'longOffset',
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const offset = String(value.timeZoneName || 'GMT-04:00').replace(/^GMT/, '');
  return `${value.year}-${value.month}-${value.day}T${value.hour}:`
    + `${value.minute}:${value.second}${offset}`;
}
const GENERATED_AT = process.env.AUDIT41_GENERATED_AT || easternTimestamp();
if (!Number.isFinite(Date.parse(GENERATED_AT))) {
  throw new Error('AUDIT41_GENERATED_AT must be a valid ISO-8601 timestamp');
}
const FUTURE_MTIME = new Date('2034-01-01T00:00:00Z');
const TEMP_DIR = fs.mkdtempSync(path.join(ROOT, '.audit41-stamp-'));
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
  if (relative === 'scripts/apply-audit41-release-stamp.js') return true;
  if (relative === 'PACKAGE_CONTENTS_SHA256.json') return true;
  if (/^(?:WEBSITE|POLYMYTHCAL).*AUDIT(?:33|34|35|36|37|38|39|40)(?:[^0-9]|$)/i.test(relative)) {
    return true;
  }
  if (/^data\/audit(?:33|34|35|36|37|38|39|40)(?:[-/]|$)/i.test(relative)) {
    return true;
  }
  if (/^data\/polymythcal-audit(?:33|34|35|36|37|38|39|40)(?:[-/]|$)/i.test(relative)) {
    return true;
  }
  if (/^scripts\/.*audit(?:33|34|35|36|37|38|39|40)(?:[-_.]|$)/i.test(relative)) {
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
    if (after.includes(OLD_SAUL_ASSET)) {
      after = after.split(OLD_SAUL_ASSET).join(NEW_SAUL_ASSET);
    }
    if (after.includes(OLD_ASSET)) after = after.split(OLD_ASSET).join(NEW_ASSET);
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
  'Audit 41 depth, date-rollover, catalog-density, and no-backtracking release';
manifest.notes = [
  'Audit 40 remains immutable historical evidence across 60 SHA-256-locked report, gate, browser-result, and screenshot files. Its 838-event, 32-type, 422-source, 842-alias, 644/25/7 Teacher Resources, 1,139-methodology-entry, 24-card, 135-gate, 3,550-public-file, 7,910-package-member, and 818-browser-assertion values remain floors or historical facts rather than live ceilings.',
  'The canonical build now regenerates bilingual event detail pages before the static search and sitemap surface. Expired event routes cannot retain stale indexable markup across a release-date rollover.',
  'Teacher Resources keeps Quick starts visible while placing the full facet wall behind one accessible More filters disclosure at every viewport. All 644 server-rendered resources and no-JavaScript discovery remain intact.',
  'Bookwormcard retains one coherent visible page heading after JavaScript enhancement while preserving its crawler-readable static introduction and complete character-card workflow.',
  'A new eight-route, 64-assertion browser depth pass verifies Bookwormcard heading ownership, Teacher Resources density and disclosure behavior, indexable and expired event-page contracts, Polymythcal, BB, Methodology, and the home route.',
  'Fresh Audit 41 Chromium evidence combines the 818 inherited interaction, entry-page, WCAG, route, stress, and runtime assertions with the 64 new depth assertions for an 882-assertion current-release floor.',
  'Native VoiceOver, native NVDA, Firefox, and WebKit remain separately disclosed environment limits. Virtualization, bundling, OCR harvesting, scrape-frequency changes, and other direction-level work remain held. This was not a security audit.',
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
  `AUDIT 41 RELEASE STAMP APPLIED — ${changed} active files moved to ${NEW_ASSET}; `
    + 'Saul runtime assets were cache-busted; Audit 40 evidence remained byte-identical.',
);
