#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {execFileSync} = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const polymyth = read('js/polymythcal-revamp.js');
const teacher = read('teacherresources/finder.js');
const browse = JSON.parse(read('polymythseminars/browse.json'));
const resources = JSON.parse(read('teacherresources/resources-data.json'));
const buildManifest = JSON.parse(read('data/polymythcal-build-manifest.json'));
const browserStress = read('scripts/audit-project-failure-stress.py');
const failures = [];

function requireText(source, text, label) {
  if (!source.includes(text)) failures.push(`missing ${label || text}`);
}

function forbid(source, pattern, label) {
  if (pattern.test(source)) failures.push(label);
}

const events = Array.isArray(browse) ? browse : browse.events;
const resourceEntries = (resources.groups || []).flatMap(group =>
  (group.categories || []).flatMap(category => category.entries || [])
);
const resourceCollections = (resources.groups || []).reduce(
  (total, group) => total + (group.categories || []).length,
  0
);

if (!Array.isArray(events) || events.length !== 833) {
  failures.push(`Polymythcal inventory changed: expected 833 deduplicated records, found ${events?.length}`);
}
if (new Set(events.map(event => event.id)).size !== 833) {
  failures.push('Polymythcal ids are no longer 833 unique values');
}
if (new Set(events.map(event => event.type)).size !== 32) {
  failures.push(`Polymythcal event type inventory changed: found ${new Set(events.map(event => event.type)).size}`);
}
if (!Number.isInteger(buildManifest.source_count) || buildManifest.source_count < 422) {
  failures.push('Polymythcal source inventory fell below 422');
}
if (resourceEntries.length !== 644) {
  failures.push(`Teacher Resources inventory changed: expected 644, found ${resourceEntries.length}`);
}
if ((resources.groups || []).length !== 7) {
  failures.push(`Teacher Resources group inventory changed: expected 7, found ${(resources.groups || []).length}`);
}
if (resourceCollections !== 25) {
  failures.push(`Teacher Resources collection inventory changed: expected 25, found ${resourceCollections}`);
}

for (const [text, label] of [
  ['window.__ssPolymythcalRevampMounted', 'Polymythcal idempotent mount guard'],
  ['const FETCH_TIMEOUT_MS = 12000', 'bounded calendar request timeout'],
  ['const FETCH_ATTEMPTS = 2', 'bounded two-attempt retry'],
  ['function validateCalendarPayload(payload)', 'calendar payload validation'],
]) {
  requireText(polymyth, text, label);
}
for (const [text, label] of [
  ['ids.has(event.id)', 'duplicate calendar id rejection'],
  ['parsed.getUTCFullYear() === year', 'strict date-only year validation'],
  ['parsed.getUTCMonth() === month - 1', 'strict date-only month validation'],
  ['parsed.getUTCDate() === day', 'strict date-only day validation'],
  ['event.end_date && !parseDate(event.end_date)', 'malformed end-date rejection'],
  ['async function fetchCalendarWithRetry(signal)', 'retry controller'],
  ['async function persistCalendarCache(payload)', 'last-good cache write'],
  ['async function readCalendarCache()', 'validated cache fallback read'],
  ['calendarDataSource === "cache"', 'visible cached-data state'],
  ['activeLoadController?.abort()', 'navigation abort'],
  ['window.addEventListener("pagehide"', 'interrupted-navigation handler'],
  ['window.addEventListener("pageshow"', 'back-forward cache recovery'],
  ['window.addEventListener("online"', 'online recovery'],
  ['Array.isArray(value) ? value.filter', 'corrupt saved-event state guard'],
  ['const persisted = persistSaved()', 'storage quota feedback']
]) requireText(polymyth, text, label);

for (const [text, label] of [
  ['window.__ssTeacherResourcesFinderMounted', 'Teacher finder idempotent mount guard'],
  ["controls.dataset.persistence = storageWritable ? 'device-and-url' : 'url-only'", 'Teacher storage failure mode'],
  ['function buildStateUrl()', 'history-independent share URL'],
  ["var supportedQuery = ['q', 'subject', 'grade', 'format', 'curriculum', 'language']", 'supported-query restoration'],
  ['Array.isArray(saved.formats)', 'corrupt stored format guard'],
  ['Array.isArray(saved.grades)', 'corrupt stored grade guard'],
  ['Array.isArray(saved.subjects)', 'corrupt stored subject guard'],
  ['Array.isArray(saved.curricula)', 'corrupt stored curriculum guard'],
  ['function scheduleExpandLabel()', 'coalesced expand-state updates'],
  ["catalog.addEventListener('toggle', scheduleExpandLabel, true)", 'coalesced toggle listener'],
  ['function flushSearchAndApply(options)', 'pending-search flush'],
  ["window.addEventListener('pagehide'", 'Teacher interrupted-navigation cleanup'],
  ["window.addEventListener('pageshow'", 'Teacher back-forward cache recovery']
]) requireText(teacher, text, label);
requireText(browserStress, "date: '2026-13-99'", 'impossible-date browser regression coverage');

forbid(polymyth, /setInterval\s*\(/, 'Polymythcal introduced an unbounded polling loop');
forbid(teacher, /setInterval\s*\(/, 'Teacher Resources introduced an unbounded polling loop');

for (const relative of ['js/polymythcal-revamp.js', 'teacherresources/finder.js']) {
  try {
    execFileSync(process.execPath, ['--check', path.join(ROOT, relative)], {stdio: 'pipe'});
  } catch (error) {
    failures.push(`${relative} failed node --check`);
  }
}

if (failures.length) {
  console.error('PROJECT FAILURE RESILIENCE CHECK FAILED');
  failures.forEach(failure => console.error(` - ${failure}`));
  process.exit(1);
}

console.log(
  'PROJECT FAILURE RESILIENCE CHECK PASSED — bounded calendar retry/cache/abort, ' +
  'storage and history fallbacks, idempotent mounts, coalesced Teacher interactions, ' +
  '833 deduplicated Polymythcal listings, 32 types, 422+ sources, and 644/25/7 Teacher inventory preserved.'
);
