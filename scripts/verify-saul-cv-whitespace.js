#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const failures = [];
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

function parseCsv(source, label) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field.replace(/\r$/, ''));
      if (row.some(value => value !== '')) rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (quoted) failures.push(`${label}: unterminated quoted field`);
  if (field || row.length) {
    row.push(field.replace(/\r$/, ''));
    if (row.some(value => value !== '')) rows.push(row);
  }
  return rows;
}

function asObjects(source, expectedHeader, label) {
  const rows = parseCsv(source, label);
  const header = rows.shift() || [];
  if (header.join(',') !== expectedHeader.join(',')) {
    failures.push(`${label}: expected header ${expectedHeader.join(',')}; found ${header.join(',')}`);
  }
  return rows.map((values, index) => {
    if (values.length !== expectedHeader.length) {
      failures.push(`${label}: row ${index + 2} has ${values.length} fields`);
    }
    return Object.fromEntries(expectedHeader.map((key, column) => [key, values[column] ?? '']));
  });
}

function duplicateValues(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

/*
 * Preserve the 2026-07-09 seven-module evidence as a real state-space
 * contract. The July 16 CV redesign superseded that builder, so these ledgers
 * are historical evidence rather than pretend inputs to the current renderer.
 */
const historicalCategories = [
  'kitchen',
  'teaching',
  'community',
  'education',
  'volunteer',
  'performance',
  'seminarschools',
];
const expectedHistoricalSelections = ['all'];
for (let mask = 1; mask < (1 << historicalCategories.length); mask += 1) {
  expectedHistoricalSelections.push(
    historicalCategories.filter((_, bit) => mask & (1 << bit)).join('+'),
  );
}
const expectedHistoricalSet = new Set(expectedHistoricalSelections);

const builderRows = asObjects(
  read('cv-whitespace-builder-states-2026-07-09.csv'),
  ['selection', 'rows', 'density_class'],
  'historical builder-state ledger',
);
const renderedRows = asObjects(
  read('cv-whitespace-rendered-128-states-2026-07-09.csv'),
  ['selection', 'cats', 'pages', 'bytes'],
  'historical rendered-state ledger',
);

for (const [label, rows] of [
  ['historical builder-state ledger', builderRows],
  ['historical rendered-state ledger', renderedRows],
]) {
  if (rows.length !== 128) failures.push(`${label}: expected 128 states; found ${rows.length}`);
  const selections = rows.map(row => row.selection);
  const duplicates = duplicateValues(selections);
  if (duplicates.length) failures.push(`${label}: duplicate selections ${duplicates.join(', ')}`);
  const actual = new Set(selections);
  for (const selection of expectedHistoricalSet) {
    if (!actual.has(selection)) failures.push(`${label}: missing state ${selection}`);
  }
  for (const selection of actual) {
    if (!expectedHistoricalSet.has(selection)) failures.push(`${label}: unexpected state ${selection}`);
  }
}

const densityClasses = new Set();
for (const row of builderRows) {
  const jobs = Number(row.rows);
  if (!Number.isInteger(jobs) || jobs < 1) {
    failures.push(`historical builder-state ledger: ${row.selection} has invalid row count ${row.rows}`);
    continue;
  }
  const expectedDensity = jobs <= 8
    ? 'cv-ultra'
    : jobs <= 11
      ? 'cv-sparse'
      : jobs <= 16
        ? 'cv-airy'
        : 'cv-dense';
  if (row.density_class !== expectedDensity) {
    failures.push(
      `historical builder-state ledger: ${row.selection} has ${row.density_class}; expected ${expectedDensity} for ${jobs} rows`,
    );
  }
  if (row.selection !== 'all' && row.selection.includes('+') && jobs > 24) {
    failures.push(`historical builder-state ledger: ${row.selection} exceeds its evidenced 24-row combination ceiling`);
  }
  densityClasses.add(row.density_class);
}
for (const density of ['cv-ultra', 'cv-sparse', 'cv-airy', 'cv-dense']) {
  if (!densityClasses.has(density)) failures.push(`historical builder-state ledger: ${density} coverage is missing`);
}

for (const row of renderedRows) {
  const expectedCats = row.selection === 'all' ? '' : row.selection.replaceAll('+', ',');
  if (row.cats !== expectedCats) {
    failures.push(`historical rendered-state ledger: ${row.selection} category list drifted`);
  }
  if (Number(row.pages) !== 1) {
    failures.push(`historical rendered-state ledger: ${row.selection} exceeds one page`);
  }
  if (!Number.isInteger(Number(row.bytes)) || Number(row.bytes) < 10_000) {
    failures.push(`historical rendered-state ledger: ${row.selection} has an implausible PDF byte count`);
  }
}

/*
 * Guard the current successor instead of requiring obsolete density classes
 * in its different visual system. Eleven selectable focus modules yield 2,048
 * possible combined states; every state must have enough canonical material,
 * while the runtime retains explicit five-row screen and seven-row print caps.
 */
const canonicalText = read('data/saul-cv-canonical-2026.json');
const canonicalPublicText = read('saul/assets/saul-cv-canonical-2026.json');
if (canonicalText !== canonicalPublicText) {
  failures.push('current CV canonical data differs between data/ and the browser asset');
}
const canonical = JSON.parse(canonicalText);
const modules = canonical.modules || {};
const slugs = Object.keys(modules);
const selectable = slugs.filter(slug => slug !== 'general');
if (slugs.length !== 12 || !modules.general || selectable.length !== 11) {
  failures.push(`current CV: expected general plus 11 selectable modules; found ${slugs.length} modules`);
}

let currentStates = 0;
for (let mask = 0; mask < (1 << selectable.length); mask += 1) {
  const selected = selectable.filter((_, bit) => mask & (1 << bit));
  const chosen = selected.length ? selected.map(slug => modules[slug]) : [modules.general];
  const records = new Map();
  const skills = new Set();
  for (const module of chosen) {
    for (const record of module?.records || []) {
      const key = [record.title, record.organization, record.dates].join('|');
      records.set(key, record);
    }
    for (const skill of module?.skills || []) skills.add(skill);
  }
  const state = selected.length ? selected.join('+') : 'general';
  if (records.size < 5) failures.push(`current CV state ${state}: fewer than five canonical experience records`);
  if (skills.size < 5) failures.push(`current CV state ${state}: fewer than five canonical skills`);
  currentStates += 1;
}
if (currentStates !== 2048) failures.push(`current CV: expected 2,048 combined states; checked ${currentStates}`);

const main = read('saul/index.html');
const css = read('saul/assets/saul-cv-spectrum-2026.css');
const runtime = read('saul/assets/saul-cv-spectrum-2026.js');
if (!css.includes('grid-template-columns:minmax(0,1.52fr) minmax(225px,.68fr)')) {
  failures.push('current CV: visual preview grid is missing');
}
for (const marker of ['@media print', '.cv-spectrum__print-jobs', 'break-inside:avoid']) {
  if (!css.includes(marker)) failures.push(`current CV: print layout marker ${marker} is missing`);
}
if (!/sortRecords\(module\.records\)\.slice\(0,\s*5\)/.test(runtime)) {
  failures.push('current CV: five-row screen cap is missing');
}
if (!/sortRecords\(module\.records\)\.slice\(0,\s*7\)/.test(runtime)) {
  failures.push('current CV: seven-row print cap is missing');
}
if (!main.includes('data-cv-print-template')) failures.push('current CV: inert print template is missing');

for (const relativePath of [
  'saul/index.html',
  ...slugs.map(slug => `saul/cv/${slug}/index.html`),
]) {
  const html = read(relativePath);
  if (!/>\s*Key skills\s*</i.test(html)) failures.push(`${relativePath}: Key skills heading is missing`);
  if (/Core Signals/i.test(html)) failures.push(`${relativePath}: obsolete Core Signals heading returned`);
}

const manifest = JSON.parse(read('data/saul-cv-pdf-manifest.json'));
if (manifest.design_system !== 'professional-monochrome') {
  failures.push('current CV: PDF design separation is missing');
}
if (!Array.isArray(manifest.outputs) || manifest.outputs.length !== slugs.length * 2) {
  failures.push(`current CV: expected ${slugs.length * 2} static PDF outputs; found ${manifest.outputs?.length ?? 0}`);
}
for (const slug of slugs) {
  for (const type of ['designed', 'ats']) {
    const output = manifest.outputs?.find(item => item.slug === slug && item.type === type);
    if (!output) {
      failures.push(`current CV: missing ${slug} ${type} output`);
      continue;
    }
    if (output.pages !== 1) failures.push(`current CV: ${output.path} exceeds one page`);
    if (output.extractable_characters < 700) failures.push(`current CV: ${output.path} has weak text extraction`);
    if (output.rainbow || output.geometry) failures.push(`current CV: ${output.path} regained decorative PDF flags`);
    if (!fs.existsSync(path.join(root, output.path))) failures.push(`current CV: ${output.path} is missing`);
  }
}

if (failures.length) {
  console.error('SAUL CV WHITESPACE CHECK FAILED');
  failures.forEach(failure => console.error(` - ${failure}`));
  process.exit(1);
}

console.log(
  'SAUL CV WHITESPACE CHECK PASSED - 128 historical density/render states remain complete and one page; 2,048 current modular states retain nonempty content, bounded screen/print density, Key skills, and 24 one-page PDFs.',
);
