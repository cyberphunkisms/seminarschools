#!/usr/bin/env node
'use strict';
/** Makes the release rule explicit: every command in verify-all-runner.js blocks shipping. */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
let fail = 0;
function read(rel) { try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch { return ''; } }
function check(name, ok) { console.log((ok ? 'PASS' : 'FAIL') + '  ' + name); if (!ok) fail = 1; }
const runner = read('scripts/verify-all-runner.js');
const pkg = JSON.parse(read('package.json') || '{}');
const mustInclude = [
  'verify-critical.js',
  'verify-methodologylist-manifest.js',
  'verify-regen-safety.js',
  'verify-data-hygiene.js',
  'verify-csp-enforced.js',
  'verify-external-link-workflow.js',
  'verify-bb-clarification.js',
  'audit-external-links.js',
  'verify-meaninglib-dataset.js',
  'verify-meaninglib-search.js',
  'verify-ai-access-pack.js',
  'build-public-deploy.js'
];
check('package verify:all points to central runner', pkg.scripts && pkg.scripts['verify:all'] === 'node scripts/verify-all-runner.js');
check('package verify:release points to central runner', pkg.scripts && pkg.scripts['verify:release'] === 'node scripts/verify-all-runner.js');
check('package verify:all:serial points to central runner', pkg.scripts && pkg.scripts['verify:all:serial'] === 'node scripts/verify-all-runner.js');
for (const token of mustInclude) check('release runner includes ' + token, runner.includes(token));
check('release runner writes gate report', runner.includes('release-gate-report.json'));
if (fail) {
  console.error('\nRELEASE GATE CHECK FAILED');
  process.exit(1);
}
console.log('\nRELEASE GATE CHECK PASSED');
