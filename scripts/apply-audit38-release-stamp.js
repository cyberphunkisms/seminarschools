#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  isGeneratedDependencyDirectory,
} = require('./repository-walk-policy');

const ROOT = path.resolve(__dirname, '..');
const OLD_ASSET = '20260724-audit37';
const NEW_ASSET = '20260724-audit38';
const OLD_SAUL_ASSET = '20260718-map-archive-final8';
const NEW_SAUL_ASSET = '20260724-audit38-saul-runtime';
const RELEASE_ID = '2026-07-24-site-audit38-harvest-operational-integrity-final';
const GENERATED_AT = '2026-07-24T13:12:00-04:00';
const FUTURE_MTIME = new Date('2034-01-01T00:00:00Z');
const TEMP_DIR = fs.mkdtempSync(path.join(ROOT, '.audit38-stamp-'));
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
  if (relative === 'scripts/apply-audit38-release-stamp.js') return true;
  if (/^(?:WEBSITE|POLYMYTHCAL).*AUDIT(?:33|34|35|36|37)(?:[^0-9]|$)/i.test(relative)) return true;
  if (/^data\/audit(?:33|34|35|36|37)(?:[-/]|$)/i.test(relative)) return true;
  if (/^data\/polymythcal-audit(?:33|34|35|36|37)(?:[-/]|$)/i.test(relative)) return true;
  if (/^data\/audit(?:35|36|37)-frozen-sha256\.json$/i.test(relative)) return true;
  if (/^scripts\/.*audit(?:33|34|35|36|37)(?:[-_.]|$)/i.test(relative)) return true;
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
manifest.release_type = 'Audit 38 operational integrity, smooth runtime, accessible resource interaction, and no-backtracking release';
manifest.notes = [
  'Audit 37 remains immutable historical evidence, including its 838-event, 32-type, 422-source, 595-unconfirmed and 644/25/7 Teacher Resources snapshot. Live gates now allow valid growth while still blocking duplicate IDs, browse drift, malformed counts, and catastrophic collapse.',
  'Polymythcal source health now requires a 25 percent authoritative coverage quorum and an independent critical-source floor. Bare HTTP 304 responses are non-authoritative until retained parsed caching is approved and implemented; stream, scope, and selected-source identities are bound before publication.',
  'Every fully successful deterministic source now leaves the paid-agent shard, including rotating extras; partial, blocked, failed, confirmed-empty, parser-regressed, and unretained-304 sources remain retryable. Scraper schedules and paid-agent frequency are unchanged.',
  'Festival harvesting now uses one 25-minute, 10-dollar bounded attempt that fits its job, keeps degraded diagnostics, validates accounting, preserves same-title same-day occurrences, respects ongoing end dates, emits RFC 822 RSS dates, and publishes source-yield evidence.',
  'Polymythcal responsive filters recover correctly across resize, orientation, and back-forward cache restoration while search performs one URL-state write. The 24-card progressive batch remains unchanged.',
  'Teacher Resources preserves exactly 644 resources, 25 collections, seven groups, and every URL while adding labelled filter groups, concise accessible resource names, singular grammar, and a smaller generated HTML payload.',
  'AA Cloud now uses one bounded cancellable animation lifecycle and a scrollable inclusive-600px mobile outline. Saul hydration preserves heading geometry and reports map failure truthfully. Shared autolinking scans only added subtrees after mutations.',
  'Methodology List state keeps its embedded corpus canonical, stores only user deltas/tombstones, and deduplicates seeded history without erasing user notes. No virtualization, server rendering, full Saul localization, or other held direction change was introduced.',
  'Eleven Audit 37 files are SHA-256 frozen. Fresh Audit 38 browser evidence is produced separately in predeploy; local packaging does not claim a Chromium run. This was not a security audit.',
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
  `AUDIT 38 RELEASE STAMP APPLIED — ${changed} active files moved to ${NEW_ASSET}; `
    + 'Saul runtime assets were cache-busted; Audit 37 evidence remained byte-identical.',
);
