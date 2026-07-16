#!/usr/bin/env node
'use strict';
/**
 * Mirrors the deploy-surface structural gate enforced by
 * SeminarSchools-Deploy-FINAL6-StayOpen-DeployOnly-ManualHFSync.
 *
 * The full repository ZIP may retain source/operator folders at its root.
 * Netlify publishes only /public, so these internal folders must never appear
 * inside that publish directory.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const forbidden = [
  'scripts',
  'data',
  'hf_export',
  '.github',
  'node_modules',
  '.git',
  '.netlify'
];
const failures = [];

if (!fs.existsSync(PUBLIC) || !fs.statSync(PUBLIC).isDirectory()) {
  failures.push('public deploy directory is missing');
} else {
  for (const rel of forbidden) {
    const target = path.join(PUBLIC, rel);
    if (fs.existsSync(target)) failures.push(`public/${rel}`);
  }
}

if (failures.length) {
  console.error('FINAL6 DEPLOY CONTRACT CHECK FAILED');
  failures.forEach(item => console.error(' - unsafe internal folder inside public deploy surface: ' + item));
  process.exit(1);
}

console.log('FINAL6 DEPLOY CONTRACT CHECK PASSED — public publish surface contains none of the seven forbidden internal folders.');
