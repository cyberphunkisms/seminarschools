#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  isGeneratedDependencyDirectory,
} = require('./repository-walk-policy');

const ROOT = path.resolve(__dirname, '..');
const OLD_ASSET = '20260725-audit41';
const NEW_ASSET = '20260725-audit42';
const OLD_SAUL_ASSET = '20260725-audit41-saul-runtime';
const NEW_SAUL_ASSET = '20260725-audit42-saul-runtime';
const OLD_FOOTER_ASSET = '20260719-audit11-decisions';
const NEW_FOOTER_ASSET = '20260725-audit42-footer';
const RELEASE_ID =
  '2026-07-25-site-audit42-ledger-closure-multimode-final';

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

const GENERATED_AT = process.env.AUDIT42_GENERATED_AT || easternTimestamp();
if (!Number.isFinite(Date.parse(GENERATED_AT))) {
  throw new Error('AUDIT42_GENERATED_AT must be a valid ISO-8601 timestamp');
}
const FUTURE_MTIME = new Date('2034-01-02T00:00:00Z');
const TEMP_DIR = fs.mkdtempSync(path.join(ROOT, '.audit42-stamp-'));
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
  if (relative === 'scripts/apply-audit42-release-stamp.js') return true;
  if (relative === 'PACKAGE_CONTENTS_SHA256.json') return true;
  if (/^(?:WEBSITE|POLYMYTHCAL).*AUDIT(?:33|34|35|36|37|38|39|40|41)(?:[^0-9]|$)/i.test(relative)) {
    return true;
  }
  if (/^data\/audit(?:33|34|35|36|37|38|39|40|41)(?:[-/]|$)/i.test(relative)) {
    return true;
  }
  if (/^data\/polymythcal-audit(?:33|34|35|36|37|38|39|40|41)(?:[-/]|$)/i.test(relative)) {
    return true;
  }
  if (/^scripts\/.*audit(?:33|34|35|36|37|38|39|40|41)(?:[-_.]|$)/i.test(relative)) {
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
      [OLD_ASSET, NEW_ASSET],
      [OLD_FOOTER_ASSET, NEW_FOOTER_ASSET],
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
  'Audit 42 ledger-closure, multimode, and no-backtracking release';
manifest.notes = [
  'Audit 41 is frozen across 71 SHA-256-locked report, gate, browser-result, and screenshot files. Its 838 events, 32 types, 422 sources, 842 aliases, 644/25/7 Teacher Resources catalog, 1,139 methodology entries, 138 portable gates, and 882 browser assertions remain historical evidence or release floors.',
  'The original tiered audit ledger is now explicit. Maintenance-level findings are fixed or release-gated; native-browser, native-assistive-technology, physical-device, real-user, and direction-changing items remain separately disclosed.',
  'The once-weekly external-link job keeps its 350-URL credit boundary and rotates through the complete 1,298-URL inventory in four deterministic weekly shards. Bounded concurrency, per-host throttling, reusable successful checks, and retry of cached failures improve efficiency without increasing cadence.',
  'Bookworm Burrows now renders its existing BB and Campaign Codex relationships and offers Curated, Title, and Record ID sorting while preserving curated order by default. Bookwormcard now exposes a complete combobox/listbox state model.',
  'Polymythcal saved-item and saved-search removal has one-action undo. Printing renders every filtered listing and exposes source URLs. Shared controls now honor reduced transparency, RTL script spacing, rotation, visited reading links, and the 44-pixel Polymythcal target floor.',
  'Teacher Resources retains all 644 static resources and its concise filter disclosure. Audit 42 adds sitewide route-language and PDF structure inventories without pretending that editorial translation or native PDF reading order has been completed.',
  'QR controls no longer collide with top-right controls. The CV gate now protects all 128 historical whitespace states and all 2,048 current modular states, and the CV builder can no longer overwrite that verifier.',
  'All seven inherited browser suites rerun against Audit 42 in isolated evidence: 882 current-release assertions and 52 screenshots cover interaction, entry pages, WCAG, route resilience, failure stress, runtime continuity, and depth without mutating frozen Audit 41 evidence.',
  'Fresh Audit 42 multimode Chromium evidence adds ultrawide, foldable-like, text-spacing, reduced-transparency, print, preference, keyboard-collision, no-JavaScript, injected-interference, grayscale, visible-H1, QR-collision, 4x CPU, long-session heap/DOM, and long-task-budget coverage.',
  'A tolerant 14-image baseline, scoped design-token inventory, route-level editorial-density inventory, and symbol-vocabulary inventory are permanent release gates. They preserve project-specific visual and editorial identities rather than imposing a redesign.',
  'Native VoiceOver, NVDA, Firefox, Safari/WebKit, physical foldables, real extensions, voice control, and low-end battery or thermal tests remain external. New illustration systems, global navigation redesign, full-site translation, true geospatial proximity, BB session runner, AA virtualization, About creative mode, persisted parsed-response validators, undated candidate publication, event-identity/reschedule changes, bundling, OCR harvesting, and scrape-frequency changes remain direction decisions. This was not a security audit.',
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
  `AUDIT 42 RELEASE STAMP APPLIED — ${changed} active files moved to ${NEW_ASSET}; `
    + 'the shared footer and Saul runtime were cache-busted; Audit 41 evidence remained byte-identical.',
);
