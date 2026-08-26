#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { ROUTES } = require('./polymythcal-route-shell');

const ROOT = path.resolve(__dirname, '..');
const failures = [];
const browse = JSON.parse(fs.readFileSync(path.join(ROOT, 'polymythseminars', 'browse.json'), 'utf8'));
const watchlist = JSON.parse(fs.readFileSync(path.join(ROOT, 'polymythseminars', 'watchlist.json'), 'utf8'));
const app = fs.readFileSync(path.join(ROOT, 'js', 'polymythcal-discovery.js'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'css', 'polymythcal-discovery.css'), 'utf8');

const statuses = browse.taxonomy?.axes?.statuses;
if (statuses?.label?.en !== 'Listing status' || statuses?.label?.fr !== 'État de la fiche') {
  failures.push('browse taxonomy lacks bilingual listing-status labels');
}
if (statuses?.values?.confirmed?.en !== 'Confirmed details' || statuses?.values?.confirmed?.fr !== 'Renseignements confirmés') {
  failures.push('browse taxonomy lacks bilingual confirmed-details labels');
}
if (statuses?.values?.pending?.en !== 'Some details pending' || statuses?.values?.pending?.fr !== 'Certains renseignements à confirmer') {
  failures.push('browse taxonomy lacks bilingual pending-details labels');
}

for (const event of browse.events || []) {
  const label = event.id || event.title || '(unknown chronology item)';
  if (!event.last_checked_at) failures.push(`${label}: chronology item lacks last_checked_at`);
  if (!['confirmed', 'unconfirmed'].includes(event.confirmation_status)) failures.push(`${label}: invalid confirmation_status`);
  if (!/^\d{4}-\d{2}-\d{2}/.test(String(event.date || ''))) failures.push(`${label}: chronology item lacks a publishable date`);
  const expected = event.confirmation_status === 'confirmed' ? 'confirmed' : 'pending';
  if (!Array.isArray(event.facets?.statuses) || !event.facets.statuses.includes(expected)) {
    failures.push(`${label}: status facet does not agree with confirmation_status`);
  }
}
for (const item of watchlist.items || []) {
  const label = item.id || item.title || '(unknown monitoring item)';
  if (!item.last_checked_at) failures.push(`${label}: monitoring item lacks last_checked_at`);
  if (item.date_status !== 'awaiting-confirmed-date') failures.push(`${label}: monitoring item has a publishable-date status`);
  if (item.confirmation_status !== 'unconfirmed') failures.push(`${label}: monitoring item is not explicitly unconfirmed`);
}

for (const needle of [
  'function trustLine(event)',
  'event.confirmation_status',
  'event.destination_status',
  'event.last_checked_at',
  'COPY.checked',
  'COPY.datePending',
  "surface === 'monitoring'",
  'function eventActions(event)',
]) {
  if (!app.includes(needle)) failures.push(`Discovery controller lacks trust signal ${needle}`);
}
for (const selector of ['.pmd-card-trust', '.pmd-card-date']) {
  if (!css.includes(selector)) failures.push(`Discovery styles lack ${selector}`);
}

const browsePages = [
  'polymythseminars/index.html',
  'polymythseminars/fr/index.html',
  ...Object.keys(ROUTES).flatMap(slug => [`${slug}/index.html`, `${slug}/fr/index.html`]),
];
for (const rel of browsePages) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) {
    failures.push(`${rel}: missing route`);
    continue;
  }
  const html = fs.readFileSync(file, 'utf8');
  if (!html.includes('data-pmd-source="/polymythseminars/browse.json"') || !html.includes('/js/polymythcal-discovery.js')) {
    failures.push(`${rel}: does not render chronology trust data through Discovery`);
  }
}
for (const rel of ['polymythseminars/monitoring/index.html', 'polymythseminars/fr/monitoring/index.html']) {
  const html = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  if (!html.includes('data-pmd-surface="monitoring"') || !html.includes('data-pmd-source="/polymythseminars/watchlist.json"')) {
    failures.push(`${rel}: does not render the date-free monitoring corpus`);
  }
}

if (failures.length) {
  console.error('POLYMYTHCAL FRESHNESS CHECK FAILED');
  failures.slice(0, 80).forEach(failure => console.error(` - ${failure}`));
  if (failures.length > 80) console.error(` - ${failures.length - 80} additional failures omitted`);
  process.exit(1);
}
console.log(`POLYMYTHCAL FRESHNESS CHECK PASSED — ${browse.events.length} dated chronology listings expose confirmation and last-check trust signals; ${watchlist.items.length} date-free monitoring records remain explicitly unconfirmed across EN/FR Discovery surfaces.`);

