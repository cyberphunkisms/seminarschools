#!/usr/bin/env node
'use strict';

/** Prove the locked public build delegates the historically governed steps. */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const expected = [
  'node scripts/run-python.js scripts/build-polymythcal-audit13.py',
  'node scripts/build-search-pages.js',
];
const supplied = process.argv.slice(2);
const locked = String(pkg.scripts?.['build:locked'] || '');
const steps = locked.split(' && ').filter(Boolean);
const siteCoherenceStep = 'node scripts/verify-polymyth-entry-points.js --site-only';
const privateWriterNames = [
  'update-polymythcal-editable-master-set9-2026-08-13.py',
  'update-polymythcal-editable-master-sets10-11-2026-08-14.py',
  'update-polymythcal-editable-master-set12-2026-08-14.py',
  'update-polymythcal-editable-master-set14-2026-08-15.py',
  'update-polymythcal-editable-master-sets13-15-2026-08-15.py',
];

function referencedScripts(command) {
  return command.split(/\s+/).filter(token => /^scripts\/.+\.(?:js|mjs|py)$/.test(token));
}

const productionScripts = new Set([
  'scripts/run-with-build-lock.py',
  ...steps.flatMap(referencedScripts),
]);
const forbiddenBoundaryPatterns = [
  /\bSITE_ROOT\s*\.parent\b/,
  /\bROOT\s*\.parent\b/,
  /path\.(?:resolve|join)\(\s*ROOT\s*,\s*['"]\.\.['"]/,
  /\.\.\/EDITABLE_MASTERS/,
  /\bEDITABLE_MASTERS\b/,
];
const boundaryFailures = [];
for (const relative of productionScripts) {
  if (relative === 'scripts/verify-polymyth-entry-points.js') continue;
  const target = path.join(root, relative);
  if (!fs.existsSync(target)) {
    boundaryFailures.push(`missing production script ${relative}`);
    continue;
  }
  const source = fs.readFileSync(target, 'utf8');
  if (forbiddenBoundaryPatterns.some(pattern => pattern.test(source))) {
    boundaryFailures.push(`${relative} crosses the repository boundary`);
  }
}
const coherenceSource = fs.readFileSync(
  path.join(root, 'scripts/verify-polymyth-entry-points.js'),
  'utf8',
);
if (
  !coherenceSource.includes("const siteOnly = process.argv.includes('--site-only')")
  || !coherenceSource.includes("if (siteOnly) workbookArguments.push('--site-only')")
  || !coherenceSource.includes('...(siteOnly')
) {
  boundaryFailures.push('site-only Coherence verifier no longer guards private handoff inputs');
}

if (
  supplied.length !== expected.length
  || supplied.some((value, index) => value !== expected[index])
  || expected.some(value => !locked.includes(value))
  || locked.indexOf(expected[0]) > locked.indexOf(expected[1])
  || privateWriterNames.some(value => locked.includes(value))
  || steps.filter(value => value === siteCoherenceStep).length !== 1
  || locked.includes('verify-polymyth-coherence-workbook.py')
  || boundaryFailures.length
) {
  console.error('CANONICAL BUILD DELEGATION FAILED — locked build ownership, order, or repository boundary drifted.');
  for (const failure of boundaryFailures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log('CANONICAL BUILD DELEGATION PASSED — repository-only writers, site-only artifact checks, and canonical order are locked.');
