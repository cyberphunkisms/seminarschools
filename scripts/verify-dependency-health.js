#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const fail = [];
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8'));
const expected = '10.1.0';
const declared = pkg.dependencies && pkg.dependencies['@netlify/blobs'];
if (declared !== expected) fail.push(`package.json must pin @netlify/blobs exactly to ${expected}; found ${declared || 'missing'}`);
const rootDeclared = lock.packages && lock.packages[''] && lock.packages[''].dependencies && lock.packages[''].dependencies['@netlify/blobs'];
if (rootDeclared !== expected) fail.push(`package-lock root declaration must be ${expected}; found ${rootDeclared || 'missing'}`);
const entry = lock.packages && lock.packages['node_modules/@netlify/blobs'];
if (!entry) fail.push('package-lock entry for @netlify/blobs is missing');
else {
  if (entry.version !== expected) fail.push(`locked @netlify/blobs version is ${entry.version}; expected ${expected}`);
  if (!/^https:\/\/registry\.npmjs\.org\//.test(entry.resolved || '')) fail.push('locked package is not resolved from the public npm registry');
  if (!/^sha512-/.test(entry.integrity || '')) fail.push('locked package lacks SHA-512 integrity metadata');
}
const prod = Object.keys(pkg.dependencies || {});
if (prod.length !== 1 || prod[0] !== '@netlify/blobs') fail.push(`expected one production dependency (@netlify/blobs); found ${prod.join(', ') || 'none'}`);
if (fail.length) {
  console.error('DEPENDENCY HEALTH CONTRACT FAILED');
  fail.forEach(x => console.error(' - ' + x));
  process.exit(1);
}
console.log(`DEPENDENCY HEALTH CONTRACT PASSED — @netlify/blobs ${expected} is exact, public-registry resolved, integrity protected, and is the sole production dependency.`);
