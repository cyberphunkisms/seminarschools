#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  DEFAULT_VISUAL_THRESHOLDS,
  compareVisualSignatures,
  visualSignature,
} = require('./lib/audit42-png-signature');

const ROOT = path.resolve(__dirname, '..');
const BASELINE = path.join(ROOT, 'data', 'audit42-visual-baseline.json');
const failures = [];

function fail(message) {
  failures.push(message);
}

let baseline;
try {
  baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
} catch (error) {
  console.error(`AUDIT 42 VISUAL BASELINE FAILED — ${error.message}`);
  process.exit(1);
}

if (baseline.schema !== 'seminar-schools-audit42-tolerant-visual-baseline-v1') {
  fail(`unexpected visual baseline schema: ${baseline.schema || 'missing'}`);
}
const thresholds = baseline.comparison_contract?.thresholds;
if (JSON.stringify(thresholds) !== JSON.stringify(DEFAULT_VISUAL_THRESHOLDS)) {
  fail('the recorded tolerant comparison thresholds changed without a schema revision');
}
if (baseline.scope?.route_families !== 7
  || baseline.scope?.image_count !== 14
  || baseline.images?.length !== 14) {
  fail('the visual baseline must contain two modes for all seven route families');
}

const expectedFamilies = new Set([
  'home',
  'polymythcal',
  'teacher-resources',
  'bb',
  'bookwormcard',
  'thank-you-mam',
  'thank-you-mam-pregame',
]);
const seenModes = new Map();
let exact = 0;
let tolerant = 0;
for (const row of baseline.images || []) {
  if (!expectedFamilies.has(row.family)) {
    fail(`unexpected route family in baseline: ${row.family}`);
    continue;
  }
  if (!seenModes.has(row.family)) seenModes.set(row.family, new Set());
  seenModes.get(row.family).add(row.mode);
  const absolute = path.join(ROOT, row.file || '');
  if (!absolute.startsWith(ROOT + path.sep) || !fs.existsSync(absolute)) {
    fail(`${row.family}/${row.mode} screenshot is missing: ${row.file}`);
    continue;
  }
  let candidate;
  try {
    candidate = visualSignature(absolute);
  } catch (error) {
    fail(`${row.family}/${row.mode} could not be decoded: ${error.message}`);
    continue;
  }
  const result = compareVisualSignatures(row.signature, candidate, thresholds);
  if (!result.pass) {
    fail(
      `${row.family}/${row.mode} has meaningful visual drift: `
        + result.reasons.join('; '),
    );
  } else if (result.exact) {
    exact += 1;
  } else {
    tolerant += 1;
  }
}
for (const family of expectedFamilies) {
  const modes = seenModes.get(family) || new Set();
  if (modes.size !== 2
    || !modes.has('ultrawide')
    || !modes.has('foldable_landscape')) {
    fail(`${family} does not have both ultrawide and foldable-landscape baselines`);
  }
}

if (failures.length) {
  console.error('AUDIT 42 VISUAL BASELINE FAILED');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `AUDIT 42 VISUAL BASELINE PASSED — ${exact} exact and ${tolerant} `
    + 'tolerance-matched screenshots across seven route families.',
);
