#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {execFileSync} = require('child_process');
const {loadInventoryContract} = require('./lib/polymythcal-inventory-contract');

const ROOT = path.resolve(__dirname, '..');
const inventory = loadInventoryContract(ROOT);
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

if (!Array.isArray(events) || events.length < inventory.minimum_canonical_events) {
  failures.push(`Polymythcal inventory fell below ${inventory.minimum_canonical_events}: found ${events?.length}`);
}
if (Array.isArray(events) && new Set(events.map(event => event.id)).size !== events.length) {
  failures.push('Polymythcal ids are not unique across the current canonical inventory');
}
if (Array.isArray(events) && new Set(events.map(event => event.type)).size < inventory.minimum_event_types) {
  failures.push(`Polymythcal event type inventory fell below ${inventory.minimum_event_types}: found ${new Set(events.map(event => event.type)).size}`);
}
if (!Number.isInteger(buildManifest.source_count) || buildManifest.source_count < inventory.minimum_sources) {
  failures.push(`Polymythcal source inventory fell below ${inventory.minimum_sources}`);
}
if (resourceEntries.length !== 645) {
  failures.push(`Teacher Resources inventory changed: expected 645, found ${resourceEntries.length}`);
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
  ["var LEGACY_FILTER_STORAGE_KEYS = ['tr-filters-v4', 'tr-filters-v3', 'tr-filters-v2']", 'Teacher legacy-state migration list'],
  ['localStorage.removeItem(key)', 'Teacher legacy-state cleanup'],
  ["controls.dataset.persistence = 'url-only'", 'Teacher URL-only filter authority'],
  ['function buildStateUrl()', 'history-independent share URL'],
  ['function restoreState()', 'URL-authoritative filter restoration'],
  ['applyFilters({ skipSave: true })', 'read-only navigation restoration'],
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
  'URL history restoration, legacy Teacher-state cleanup, idempotent mounts, coalesced Teacher interactions, ' +
  `${events.length} deduplicated Polymythcal listings, ${new Set(events.map(event => event.type)).size} types, ` +
  `${buildManifest.source_count} sources, and 645/25/7 Teacher inventory preserved.`
);
