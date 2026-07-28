#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  isGeneratedDependencyDirectory,
} = require('./repository-walk-policy');

const ROOT = path.resolve(__dirname, '..');
const OLD_ASSET = '20260725-audit42';
const NEW_ASSET = '20260725-audit43';
const OLD_SAUL_ASSET = '20260725-audit42-saul-runtime';
const NEW_SAUL_ASSET = '20260725-audit43-saul-runtime';
const OLD_FOOTER_ASSET = '20260725-audit42-footer';
const NEW_FOOTER_ASSET = '20260725-audit43-footer';
const RELEASE_ID =
  '2026-07-25-site-audit43-approved-evolution-weekly-final';

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

const GENERATED_AT = process.env.AUDIT43_GENERATED_AT || easternTimestamp();
if (!Number.isFinite(Date.parse(GENERATED_AT))) {
  throw new Error('AUDIT43_GENERATED_AT must be a valid ISO-8601 timestamp');
}
const FUTURE_MTIME = new Date('2034-01-03T00:00:00Z');
const TEMP_DIR = fs.mkdtempSync(path.join(ROOT, '.audit43-stamp-'));
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
  if (relative === 'scripts/apply-audit43-release-stamp.js') return true;
  if (relative === 'PACKAGE_CONTENTS_SHA256.json') return true;
  if (/^(?:WEBSITE|POLYMYTHCAL).*AUDIT(?:33|34|35|36|37|38|39|40|41|42)(?:[^0-9]|$)/i.test(relative)) {
    return true;
  }
  if (/^data\/audit(?:33|34|35|36|37|38|39|40|41|42)(?:[-/]|$)/i.test(relative)) {
    return true;
  }
  if (/^data\/polymythcal-audit(?:33|34|35|36|37|38|39|40|41|42)(?:[-/]|$)/i.test(relative)) {
    return true;
  }
  if (/^scripts\/.*audit(?:33|34|35|36|37|38|39|40|41|42)(?:[-_.]|$)/i.test(relative)) {
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
  'Audit 43 approved evolution, weekly discovery, and no-backtracking release';
manifest.notes = [
  'Audit 42 is frozen across 115 SHA-256-locked evidence files. Its 838 events, 32 types, 422 sources, 842 event aliases, 644/25/7 Teacher Resources catalog, 1,139 methodology entries, and complete prior audit history remain immutable floors.',
  'All scheduled content and link workflows run exactly once weekly. Audit 43 does not increase scraper frequency or add protest-harvest paid-agent spending.',
  'Polymythcal protest discovery now covers 15 configured organizer streams, including 10 bounded browser-rendered sources, seven bounded flyer-OCR sources, six explicitly filtered mixed calendars, and 12 sources eligible to emit undated announcement leads.',
  'Recurring iCalendar rules now expand inside a 26-occurrence and 366-day hard ceiling with COUNT, UNTIL, RDATE, EXDATE, duration, and recurrence identity support. Mixed calendars refuse publication without source-specific include rules.',
  'HTTP ETag and Last-Modified validators are retained only when bound to a parser version, body hash, parsed records, discovered URLs, and explicit-empty evidence. A bare 304 can never erase events or masquerade as a successful empty crawl.',
  'Public organizer announcements that lack a real date remain visibly separate candidate-only records. They cannot enter the calendar, event routes, RSS, ICS, or Event structured data until a date is observed.',
  'A richer identity/reschedule matcher runs in diagnostic shadow mode so recurring occurrences remain distinct and possible reschedules become reviewable without silently rewriting canonical event identity.',
  'Polymythcal adds manual approximate nearby ranking from 13 visitor-selected reference places without requesting device location. Unknown and online locations do not receive invented distances.',
  'The homepage adds six original CSS-native project marks. Six dense long-form routes gain an opt-in persisted reader view, and the public route surface gains short cross-document View Transitions that fully disable under reduced motion.',
  'Teacher Resources retains all 644 static resources and adds an explicit Open first match action plus Enter-to-open for a filtered search. BB remains a teacher-led human-plus-AI workflow; no site-owned session runner was added.',
  'Translation expansion remains deferred until the rest of the site work is complete. Existing language behavior is preserved. No bundler, list virtualization, global navigation rewrite, or security audit was introduced in this additive release.',
  'Native VoiceOver, NVDA, Firefox, Safari/WebKit, physical-device, and real-user validation remain external because this container cannot truthfully execute those environments.',
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
  `AUDIT 43 RELEASE STAMP APPLIED — ${changed} active files moved to ${NEW_ASSET}; `
  + 'all 115 Audit 42 evidence files remained excluded from mutation.',
);
