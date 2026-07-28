#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  isGeneratedDependencyDirectory,
} = require('./repository-walk-policy');

const ROOT = path.resolve(__dirname, '..');
const OLD_ASSET = '20260724-' + 'audit39';
const NEW_ASSET = '20260724-audit40';
const OLD_SAUL_ASSET = '20260724-' + 'audit39-saul-runtime';
const NEW_SAUL_ASSET = '20260724-audit40-saul-runtime';
const RELEASE_ID =
  '2026-07-24-site-audit40-browser-runtime-continuity-final';
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
const GENERATED_AT = process.env.AUDIT40_GENERATED_AT || easternTimestamp();
if (!Number.isFinite(Date.parse(GENERATED_AT))) {
  throw new Error('AUDIT40_GENERATED_AT must be a valid ISO-8601 timestamp');
}
const FUTURE_MTIME = new Date('2034-01-01T00:00:00Z');
const TEMP_DIR = fs.mkdtempSync(path.join(ROOT, '.audit40-stamp-'));
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
  if (relative === 'scripts/apply-audit40-release-stamp.js') return true;
  if (relative === 'PACKAGE_CONTENTS_SHA256.json') return true;
  if (/^(?:WEBSITE|POLYMYTHCAL).*AUDIT(?:33|34|35|36|37|38|39)(?:[^0-9]|$)/i.test(relative)) {
    return true;
  }
  if (/^data\/audit(?:33|34|35|36|37|38|39)(?:[-/]|$)/i.test(relative)) {
    return true;
  }
  if (/^data\/polymythcal-audit(?:33|34|35|36|37|38|39)(?:[-/]|$)/i.test(relative)) {
    return true;
  }
  if (/^scripts\/.*audit(?:33|34|35|36|37|38|39)(?:[-_.]|$)/i.test(relative)) {
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
  'Audit 40 browser/runtime continuity, crawl integrity, and no-backtracking release';
manifest.notes = [
  'Audit 39 remains immutable historical evidence. Its 838-event, 32-type, 422-source, 842-alias, 644/25/7 Teacher Resources, 1,139-methodology-entry, 24-card, 132-gate, 3,550-public-file, and 7,802-package-member values are floors or historical facts rather than live ceilings.',
  'A whole-site content-structure gate checks every public HTML source for unique IDs, resolvable static references, valid same-site fragments, and coherent canonical/noindex ownership.',
  'AITR and Campaigncodex deep links now restore the correct content and keyboard focus. Campaigncodex exposes its curriculum-map section, and Leizu selection summaries retain a resolvable accessible label after dynamic updates.',
  'Methodology List exposes every one of its 16 corpus sections in the interactive tabs, removes its measured startup layout shift, and retains all 1,139 entries plus the established local edit, migration, register, and static-edition contracts.',
  'Route-local CSS and JavaScript now receive bounded one-day caching with stale-while-revalidate. Third-party inline CSS imports are removed, local asset references are cache-audited, and broad transition declarations use explicit properties.',
  'Teacher Resources retains all 644 resource routes, 25 collections, seven groups, and its full interactive finder while receiving the current release asset token and a fully visible wrapped mobile project navigation.',
  'The Thank You M’am DM board now reflows into one mobile column, restores document scrolling, exposes all 51 generated controls as native keyboard controls, and keeps dialog focus, Escape, and return-focus behavior coherent. Leizu landmarks and overview facts are named correctly, and the local Meaninglib dashboard no longer steals focus on load.',
  'Fresh Audit 40 Chromium evidence combines the five inherited no-backtracking browser suites with a new 24-case representative runtime matrix, repaired deep-link interaction checks, and focused mobile DM-board interaction checks. Native VoiceOver, native NVDA, Firefox, and WebKit remain separately disclosed environment limits.',
  'The held Methodology full-payload virtualization/server-rendering redesign applies only to its remaining startup long task. Teacher Resources catalog virtualization, bundler introduction, and other direction-level changes were not silently introduced. This was not a security audit.',
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
  `AUDIT 40 RELEASE STAMP APPLIED — ${changed} active files moved to ${NEW_ASSET}; `
    + 'Saul runtime assets were cache-busted; Audit 39 evidence remained byte-identical.',
);
