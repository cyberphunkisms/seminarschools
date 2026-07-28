#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  isGeneratedDependencyDirectory,
} = require('./repository-walk-policy');

const ROOT = path.resolve(__dirname, '..');
const OLD_ASSET = '20260725-audit43';
const NEW_ASSET = '20260725-audit45';
const OLD_SAUL_ASSET = '20260725-audit43-saul-runtime';
const NEW_SAUL_ASSET = '20260725-audit45-saul-runtime';
const OLD_FOOTER_ASSET = '20260725-audit43-footer';
const NEW_FOOTER_ASSET = '20260725-audit45-footer';
const RELEASE_ID =
  '2026-07-25-site-audit45-full-translation-localization-final';

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

const GENERATED_AT = process.env.AUDIT45_GENERATED_AT || easternTimestamp();
if (!Number.isFinite(Date.parse(GENERATED_AT))) {
  throw new Error('AUDIT45_GENERATED_AT must be a valid ISO-8601 timestamp');
}
const FUTURE_MTIME = new Date('2034-01-05T00:00:00Z');
const TEMP_DIR = fs.mkdtempSync(path.join(ROOT, '.audit45-stamp-'));
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
  if (relative === 'scripts/apply-audit45-release-stamp.js') return true;
  if (relative === 'PACKAGE_CONTENTS_SHA256.json') return true;
  if (/^(?:WEBSITE|POLYMYTHCAL).*AUDIT(?:33|34|35|36|37|38|39|40|41|42|43|44)(?:[^0-9]|$)/i.test(relative)) {
    return true;
  }
  if (/^data\/audit(?:33|34|35|36|37|38|39|40|41|42|43|44)(?:[-/]|$)/i.test(relative)) {
    return true;
  }
  if (/^data\/polymythcal-audit(?:33|34|35|36|37|38|39|40|41|42|43|44)(?:[-/]|$)/i.test(relative)) {
    return true;
  }
  if (/^scripts\/.*audit(?:33|34|35|36|37|38|39|40|41|42|43|44)(?:[-_.]|$)/i.test(relative)) {
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
    for (const [oldToken, newToken] of [
      [OLD_SAUL_ASSET, NEW_SAUL_ASSET],
      [OLD_FOOTER_ASSET, NEW_FOOTER_ASSET],
      [OLD_ASSET, NEW_ASSET],
    ]) {
      if (after.includes(oldToken)) after = after.split(oldToken).join(newToken);
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
  'Audit 45 full translation, source-language semantics, and localized-route release';
manifest.notes = [
  'Audit 43 is frozen across 16 SHA-256-locked report, inventory, browser, screenshot, and program files. All prior frozen audit evidence remains unchanged.',
  'Polymythcal retains exactly 838 events, 32 types, and 422 sources. Every scheduled content and link workflow remains exactly once weekly; Audit 45 does not increase scraper frequency or paid-agent spending.',
  'All 838 Polymythcal event records now declare source language. Each English event page has a reciprocal French utility page, while organizer titles and descriptions remain verbatim and visibly retain their source-language boundary.',
  'Polymythcal has dedicated French routes for the main browser, 11 focused calendars, all event detail pages, submission, correction, subscription, and confirmation. One path-aware language preference replaces split or competing language state.',
  'Leizu has dedicated French, Traditional Chinese, Simplified Chinese, and Persian routes across its homepage and nine-step local funnel. High-stakes policy, intake, teaching, donation, and booking confirmation translations remain noindex until bilingual review, with the English contractual source explicitly bounded and preserved.',
  'Saul has dedicated French, Traditional Chinese, Simplified Chinese, and Persian archive routes. Persian direction and centering geometry are corrected; stale claims and dates are normalized; English application CVs remain explicitly identified as English.',
  'Teacher Resources retains all 644 resources and adds source-language metadata, schema, visible labels, search, filtering, URL state, and persistence. Its catalog remains intentionally English rather than presenting an incomplete translated shell.',
  'BB retains its teacher-led workflow and does not add a site-owned session runner. Its existing Simplified Chinese Why essay now has corrected skip, navigation, reference, language-boundary, footer, font, and canonical metadata.',
  'English remains the source of truth. Translation records bind each localized route to a source SHA-256 and review status, and release gates reject source drift, silent organizer-text translation, false language tags, route loss, count loss, or once-weekly cadence changes.',
  'Native VoiceOver, NVDA, Firefox, Safari/WebKit, physical-device, and real-user validation remain external because this container cannot truthfully execute those environments.',
  'No security audit was performed.',
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
  `AUDIT 45 RELEASE STAMP APPLIED — ${changed} active files moved to ${NEW_ASSET}; `
  + 'all Audit 43 frozen evidence remained excluded from mutation.',
);
