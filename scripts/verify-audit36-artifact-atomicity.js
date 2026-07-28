#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const build = fs.readFileSync(path.join(root, 'scripts', 'build-public-deploy.js'), 'utf8');
const packaging = fs.readFileSync(path.join(root, 'scripts', 'package_integrity.py'), 'utf8');
const packageTests = fs.readFileSync(path.join(root, 'scripts', 'test_package_integrity.py'), 'utf8');
const failures = [];

function requireToken(source, token, message) {
  if (!source.includes(token)) failures.push(message);
}

for (const [token, message] of [
  ["const BUILD_OUT = path.join(ROOT, '.public-build-staging');", 'public build needs a same-filesystem staging tree'],
  ["const PREVIOUS_OUT = path.join(ROOT, '.public-build-previous');", 'public build needs a recoverable prior tree'],
  ['function prepareBuildOutput()', 'public build needs interrupted-commit recovery'],
  ['if (!fs.existsSync(OUT)) fs.renameSync(PREVIOUS_OUT, OUT);', 'public build must restore an interrupted prior tree'],
  ['function commitBuildOutput()', 'public build needs an explicit commit phase'],
  ['fs.renameSync(BUILD_OUT, OUT);', 'public build must commit the checked staging tree by rename'],
  ['if (!fs.existsSync(OUT) && movedCurrent && fs.existsSync(PREVIOUS_OUT))', 'public build must roll back a failed staging rename'],
  ['walkCheck(BUILD_OUT);', 'public build must inspect staging before commit'],
  ['commitBuildOutput();', 'public build must commit only after validation']
]) requireToken(build, token, message);
if (build.includes('removeDir(OUT);')) failures.push('public build still deletes the last good deploy tree before construction');
if (build.indexOf('commitBuildOutput();') < build.indexOf('walkCheck(BUILD_OUT);')) {
  failures.push('public build commits before its hygiene validation');
}

for (const [token, message] of [
  ['temporary_output = output.with_name', 'ZIP writer needs a same-directory temporary artifact'],
  ['with zipfile.ZipFile(temporary_output, "w"', 'ZIP writer must construct the temporary artifact'],
  ['with zipfile.ZipFile(temporary_output, "r"', 'ZIP writer must verify the temporary artifact before commit'],
  ['archive_sha256 = file_sha256(temporary_output)', 'ZIP writer must digest the verified temporary artifact'],
  ['def commit_verified_pair(', 'ZIP writer needs a rollback-backed pair commit'],
  ['recover_interrupted_pair(', 'ZIP writer must recover an interrupted pair commit'],
  ['os.replace(temporary_output, output)', 'ZIP writer must atomically replace the final artifact inside the pair commit'],
  ['os.replace(temporary_sidecar, sidecar)', 'ZIP writer must atomically replace the digest sidecar inside the pair commit'],
  ['committed archive digest differs', 'ZIP writer must recheck the installed archive before deleting backups'],
  ['committed checksum sidecar differs', 'ZIP writer must recheck the installed checksum before deleting backups'],
  ['temporary_output.unlink(missing_ok=True)', 'ZIP writer must clean interrupted temporary output']
]) requireToken(packaging, token, message);
if (/ZipFile\(output,\s*["']w/.test(packaging)) failures.push('ZIP writer still opens the final artifact for in-place truncation');

requireToken(packageTests, 'test_failed_write_preserves_prior_verified_artifact', 'package tests must prove failure preserves the prior artifact');
requireToken(packageTests, 'test_failed_sidecar_commit_restores_prior_verified_pair', 'package tests must prove second-file failure restores the prior pair');
requireToken(packageTests, 'synthetic sidecar commit failure', 'package tests must inject a sidecar replacement failure');
requireToken(packageTests, 'self.assertEqual(list(root.glob(".*.part-*")), [])', 'package tests must prove temporary files are cleaned');

for (const leftover of ['.public-build-staging', '.public-build-previous']) {
  if (fs.existsSync(path.join(root, leftover))) failures.push(`successful build left ${leftover} behind`);
}

if (failures.length) {
  console.error('AUDIT36 ARTIFACT ATOMICITY FAILED');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('AUDIT36 ARTIFACT ATOMICITY PASSED — staged public build, rollback path, verified temporary ZIP, and prior-artifact preservation.');
