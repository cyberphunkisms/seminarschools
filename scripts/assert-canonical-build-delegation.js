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

if (
  supplied.length !== expected.length
  || supplied.some((value, index) => value !== expected[index])
  || expected.some(value => !locked.includes(value))
  || locked.indexOf(expected[0]) > locked.indexOf(expected[1])
) {
  console.error('CANONICAL BUILD DELEGATION FAILED — locked build ownership or order drifted.');
  process.exit(1);
}

console.log('CANONICAL BUILD DELEGATION PASSED — event pages precede search and sitemap generation under the release lease.');
