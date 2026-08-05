#!/usr/bin/env node
'use strict';

/**
 * Locks the approved Audit 43 direction:
 * - additive visual identity, reader mode, and View Transitions;
 * - manual approximate nearby ranking without location permission;
 * - richer weekly discovery, never higher scrape cadence;
 * - strict candidate/date separation and non-mutating identity diagnostics;
 * - Teacher Resources speed improvements;
 * - no BB session runner and no translation expansion.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const failures = [];

function read(relative) {
  try {
    return fs.readFileSync(path.join(ROOT, relative), 'utf8');
  } catch {
    failures.push(`${relative} is missing`);
    return '';
  }
}

function need(relative, token, message = '') {
  const source = read(relative);
  if (!source.includes(token)) {
    failures.push(message || `${relative} must contain ${JSON.stringify(token)}`);
  }
}

function reject(relative, token, message = '') {
  const source = read(relative);
  if (source.includes(token)) {
    failures.push(message || `${relative} must not contain ${JSON.stringify(token)}`);
  }
}

function json(relative) {
  try {
    return JSON.parse(read(relative));
  } catch (error) {
    failures.push(`${relative} is not valid JSON: ${error.message}`);
    return {};
  }
}

function weeklyCron(relative, expected) {
  const source = read(relative);
  const schedules = [...source.matchAll(/\bcron:\s*["']([^"']+)["']/g)]
    .map(match => match[1]);
  if (schedules.length !== 1 || schedules[0] !== expected) {
    failures.push(
      `${relative} must have exactly one weekly schedule (${expected}); found `
      + JSON.stringify(schedules),
    );
  }
  const fields = String(schedules[0] || '').trim().split(/\s+/);
  if (fields.length !== 5 || fields[2] !== '*' || fields[3] !== '*' || fields[4] === '*') {
    failures.push(`${relative} schedule is not exactly once per week`);
  }
}

// Audit 42 is immutable historical evidence, not a mutable current-state gate.
const frozen = json('data/audit42-frozen-sha256.json');
if (!Array.isArray(frozen.files) || frozen.files.length < 100) {
  failures.push('Audit 42 frozen manifest must retain at least 100 evidence files');
}

// Six project-specific CSS-native home marks preserve the established paths.
const home = read('index.html');
const homeCards = [
  ['polymythcal', '/polymythseminars/'],
  ['leizu', '/leizu/'],
  ['teacher', '/teacherresources/'],
  ['bb', '/bb/'],
  ['aa', '/aa/'],
  ['cv', '/saul/'],
];
for (const [project, href] of homeCards) {
  if (!home.includes(`data-project="${project}"`)) {
    failures.push(`home is missing the ${project} project mark`);
  }
  if (!home.includes(`href="${href}"`)) {
    failures.push(`home is missing preserved project route ${href}`);
  }
}
if ((home.match(/class="path-mark"/g) || []).length !== 6) {
  failures.push('home must expose exactly six project path marks');
}

// View Transitions stay short and disappear completely for reduced motion.
for (const token of [
  '@view-transition',
  'navigation: auto',
  '::view-transition-old(root)',
  '::view-transition-new(root)',
  '@media (prefers-reduced-motion: reduce)',
  'animation: none !important',
]) need('css/audit43-approved.css', token);
if (!/1(?:10|50)ms/.test(read('css/audit43-approved.css'))) {
  failures.push('Audit 43 transition duration must remain deliberately short');
}

// Reader mode is opt-in and limited to six dense long-form routes.
const injector = read('scripts/apply-audit43-approved-ui.js');
const readerRoutes = [
  'aa/index.html',
  'polymyth/index.html',
  'polymyth/bookwormburrows/index.html',
  'polymyth/campaigncodex/index.html',
  'polymyth/methodologylist/index.html',
  'polymyth/modulecanon/index.html',
];
for (const route of readerRoutes) {
  if (!injector.includes(`'${route}'`)) failures.push(`reader allowlist lost ${route}`);
}
const allowlistBlock = injector.match(/const READER_ALLOWLIST = new Set\(\[([\s\S]*?)\]\);/);
if (!allowlistBlock || (allowlistBlock[1].match(/'[^']+index\.html'/g) || []).length !== 6) {
  failures.push('reader mode must remain an exact six-route allowlist');
}
for (const token of [
  'seminarSchools.readerMode.v1',
  "body.dataset.readerEligible !== 'true'",
  "localStorage.setItem(STORAGE_KEY",
  "aria-pressed",
]) need('js/audit43-reader.js', token);

// Nearby ranking is manual, approximate, URL-shareable, and permission-free.
for (const token of [
  'id="pmNear"',
  'No nearby ranking',
  'Nearest to selected place',
  'Approximate distance; no location permission.',
]) need('polymythseminars/index.html', token);
for (const token of [
  'state.sort === "nearest"',
  'params.get("near")',
  'function distanceKm(origin, point)',
  'location_precision',
]) need('js/polymythcal-revamp.js', token);
reject(
  'js/polymythcal-revamp.js',
  'navigator.geolocation',
  'Polymythcal nearby ranking must never request device location',
);

// Every content workflow remains exactly once weekly.
weeklyCron('.github/workflows/scrape-polymythcal-protests.yml', '18 8 * * 3');
weeklyCron('.github/workflows/scrape-seminars.yml', '47 8 * * 1');
weeklyCron('.github/workflows/scrape-festivals.yml', '42 9 * * 2');
weeklyCron('.github/workflows/audit-external-links.yml', '17 10 * * 0');

const protestWorkflow = read('.github/workflows/scrape-polymythcal-protests.yml');
for (const token of [
  'harvest_protests_browser_ocr.py',
  '--browser-ocr-input',
  'tesseract-ocr-fra',
  'playwright install --with-deps chromium',
  'polymythcal-http-cache.json',
  'build-polymythcal-candidate-surface.py',
]) {
  if (!protestWorkflow.includes(token)) {
    failures.push(`weekly protest workflow lost ${token}`);
  }
}
if (/\b(?:claude|anthropic|openai|paid[-_ ]agent)\b/i.test(protestWorkflow)) {
  failures.push('weekly protest workflow must not spend paid-agent credits');
}

const protestConfig = json('scripts/protest-sources.json');
const sources = Array.isArray(protestConfig.sources) ? protestConfig.sources : [];
const count = key => sources.filter(source => source && source[key]).length;
if (sources.length < 15) failures.push(`protest source expansion backtracked to ${sources.length}/15`);
if (count('browser_harvest') < 10) failures.push('browser-harvest roster backtracked below 10');
if (count('ocr_harvest') < 7) failures.push('flyer-OCR roster backtracked below 7');
if (count('mixed_calendar') < 6) failures.push('mixed-calendar roster backtracked below 6');
if (count('undated_candidates') < 12) failures.push('undated-candidate roster backtracked below 12');
if (
  !protestConfig.crawl_policy
  || protestConfig.crawl_policy.unresolved_recheck_hours !== 168
  || protestConfig.crawl_policy.confirmed_recheck_hours !== 168
) {
  failures.push('protest recheck policy must remain weekly (168 hours)');
}
for (const source of sources.filter(row => row.mixed_calendar)) {
  if (!Array.isArray(source.include_event_patterns) || !source.include_event_patterns.length) {
    failures.push(`mixed calendar ${source.id} lacks explicit include patterns`);
  }
}

for (const [relative, tokens] of Object.entries({
  'scripts/polymythcal_discovery.py': [
    'rrulestr',
    'MAX_RRULE_OCCURRENCES = 26',
    'MAX_RRULE_HORIZON_DAYS = 366',
    'EXDATE',
    'RDATE',
    '_mixed_calendar_filter',
    'mixed calendar',
  ],
  'scripts/polymythcal_http_cache.py': [
    'PARSER_CACHE_VERSION',
    'body_hash',
    'parsed_records',
    'discovered_urls',
    'status", "") != "not-modified"',
  ],
  'scripts/harvest_protests_browser_ocr.py': [
    'max(1, min(8',
    'timeout=25',
    'max(1, min(3',
    'polymythcal-ocr-announcement',
  ],
  'scripts/polymythcal_identity_shadow.py': [
    'diagnostics only',
    'recurring-occurrences-must-remain-distinct',
    'one-high-confidence-candidate',
  ],
})) {
  for (const token of tokens) need(relative, token);
}

// Undated leads are useful but cannot leak into the dated publication surface.
for (const token of [
  'record_kind") != "announcement-candidate"',
  'if raw.get("date")',
  'never enter RSS, ICS, event ',
]) need('scripts/build-polymythcal-candidate-surface.py', token);
for (const token of [
  'Announcements awaiting a date',
  'stay outside the dated calendar',
  'id="pmAnnouncementCandidates"',
]) need('polymythseminars/index.html', token);
const candidatePayload = json('polymythseminars/candidates.json');
for (const row of candidatePayload.announcements || []) {
  if (row.date) failures.push(`undated public candidate ${row.id || row.title} has a date`);
  if (row.record_kind !== 'announcement-candidate') {
    failures.push(`candidate ${row.id || row.title} has the wrong record_kind`);
  }
}

// Teacher Resources remains a complete static library with a faster keyboard path.
for (const token of [
  'id="open-first-result"',
  'Open first match',
  'aria-keyshortcuts="Enter"',
]) need('teacherresources/index.html', token);
for (const token of [
  'function openFirstResult()',
  "event.key !== 'Enter'",
  'window.location.assign(first.element.href)',
]) need('teacherresources/finder.js', token);
if ((read('teacherresources/index.html').match(/class="entry /g) || []).length !== 644) {
  failures.push('Teacher Resources must retain all 644 static entries');
}

// BB remains a teacher-led workflow, not a site-run game.
need('polymyth/bookwormburrows/index.html', 'teacher-led academic TTRPG');
need('bb/index.html', 'human Dimensional Master and AI work together');
for (const relative of [
  'js/bb-session-runner.js',
  'scripts/build-bb-session-runner.js',
  'bb/session-runner/index.html',
]) {
  if (fs.existsSync(path.join(ROOT, relative))) {
    failures.push(`unapproved BB session runner exists: ${relative}`);
  }
}

// Translation remains a later editorial project; no machine-translation runtime
// or new translation build was introduced in Audit 43.
const pkg = json('package.json');
for (const dependency of [
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.devDependencies || {}),
]) {
  if (/(translate|localiz|i18next|lingui)/i.test(dependency)) {
    failures.push(`translation expansion is deferred, but ${dependency} was added`);
  }
}

if (failures.length) {
  console.error(`AUDIT 43 APPROVED-DIRECTION GATE FAILED (${failures.length})`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  'AUDIT 43 APPROVED-DIRECTION GATE PASSED — additive UI, weekly discovery, '
  + 'candidate separation, Teacher Resources speed path, and no-backtracking '
  + 'boundaries are intact.',
);
