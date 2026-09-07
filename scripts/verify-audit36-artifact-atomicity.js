#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {PublicBuildLock} = require('./lib/public-build-lock');

const root = path.resolve(__dirname, '..');
const build = fs.readFileSync(path.join(root, 'scripts', 'build-public-deploy.js'), 'utf8');
const publicBuildLock = fs.readFileSync(path.join(root, 'scripts', 'lib', 'public-build-lock.js'), 'utf8');
const publicBuildLockVerifier = fs.readFileSync(
  path.join(root, 'scripts', 'verify-public-build-lock-recovery.js'),
  'utf8',
);
const publicParity = fs.readFileSync(
  path.join(root, 'scripts', 'verify-public-deploy-parity.js'),
  'utf8',
);
const packaging = fs.readFileSync(path.join(root, 'scripts', 'package_integrity.py'), 'utf8');
const packageTests = fs.readFileSync(path.join(root, 'scripts', 'test_package_integrity.py'), 'utf8');
const failures = [];

function requireToken(source, token, message) {
  if (!source.includes(token)) failures.push(message);
}

function lstatIfPresent(candidate) {
  try { return fs.lstatSync(candidate); }
  catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

for (const [token, message] of [
  ["const BUILD_OUT = path.join(ROOT, '.public-build-staging');", 'public build needs a same-filesystem staging tree'],
  ["const PREVIOUS_OUT = path.join(ROOT, '.public-build-previous');", 'public build needs a recoverable prior tree'],
  ['function prepareBuildOutput()', 'public build needs a fail-closed staging preparation phase'],
  ['publicBuildLock.assertNoUnownedTransientState();', 'public build must reject unowned staging and rollback trees'],
  ['function commitBuildOutput()', 'public build needs an explicit commit phase'],
  ['publicBuildLock.assertNoRollbackState();', 'public build must reject a pre-existing rollback tree'],
  ['fs.renameSync(BUILD_OUT, OUT);', 'public build must commit the checked staging tree by rename'],
  ['if (!fs.existsSync(OUT) && movedCurrent)', 'public build must roll back a failed staging rename'],
  ['publicBuildLock.assertOwnedRollbackState(ownedPrevious);', 'rollback and cleanup must retain the inode created by this commit'],
  ['walkCheck(BUILD_OUT);', 'public build must inspect staging before commit'],
  ['if (fs.existsSync(BUILD_OUT)) publicBuildLock.bindStaging();', 'failed commit must restore the owner-bound cleanup marker'],
  ['commitBuildOutput();', 'public build must commit only after validation']
]) requireToken(build, token, message);
if (build.includes('removeDir(OUT);')) failures.push('public build still deletes the last good deploy tree before construction');
if (build.includes('removeDir(BUILD_OUT);')) failures.push('public build deletes an unowned staging tree');
if (build.includes('if (fs.existsSync(PREVIOUS_OUT)) removeDir(PREVIOUS_OUT);')) {
  failures.push('public build deletes an unowned rollback tree');
}
if (build.indexOf('commitBuildOutput();') < build.indexOf('walkCheck(BUILD_OUT);')) {
  failures.push('public build commits before its hygiene validation');
}

for (const [token, message] of [
  ["crypto.randomBytes(32).toString('hex')", 'public lock owner needs a cryptographic token'],
  ['const CLAIM_DIRECTORY_PREFIX', 'public lock needs an external prepared-claim prefix'],
  ['_prepareClaim()', 'public lock must prepare and fsync a populated claim before installation'],
  ['fs.fsyncSync(descriptor)', 'public lock must durably fsync prepared ownership'],
  ['_installPreparedClaim(prepared)', 'public lock must install its populated claim atomically'],
  ["return {action: 'reclaim-empty-overlay'}", 'public lock must centrally classify exact empty overlays'],
  ['_requireEmptyOverlayAuthorization()', 'empty-overlay recovery must require authorization'],
  ['markerMatchesOwner(markerRecord.value, owner)', 'dead-owner recovery needs an owner-bound stage marker'],
  ["owner.hostname !== this.hostname", 'dead-owner recovery must remain same-host'],
  ["processStatus !== 'dead'", 'unverifiable and live process identities must fail closed'],
  ['this.assertNoUnownedTransientState();', 'lock acquisition must reject lockless stage and rollback state'],
  ['this.discardOwnedStaging();', 'controlled failure must clean only owner-bound staging'],
  ['inspectTransientState()', 'post-build audits must use the centralized transient-state inspection'],
  ['this.exitHandler = () => this.release({bestEffort: true});', 'only process-exit cleanup may be best-effort'],
  ['release({bestEffort = false} = {})', 'explicit public-build release must be strict'],
  ['if (!bestEffort) throw error;', 'explicit release must propagate cleanup failure'],
  ['reconcilePostBuildOverlayResidue({maxPasses = 16} = {})', 'central lock must own bounded post-process overlay reconciliation'],
  ['inspectDirectoryOnlySkeleton(candidate)', 'post-process reconciliation must reject files and symlinks'],
  ["const OVERLAY_TOMBSTONE_SCHEMA = 'seminar-schools-public-build-overlay-tombstone-v1';", 'overlay hiding must use an exact versioned tombstone'],
  ["action: 'reclaim-overlay-tombstones'", 'acquisition must centrally classify exact overlay tombstones'],
  ['_discardOverlayTombstonesForOwnership()', 'acquisition must remove exact tombstones only under authorization'],
  ['stageStat.isSymbolicLink()', 'staging symlinks must fail closed'],
  ['lockStat.isSymbolicLink()', 'lock symlinks must fail closed'],
]) requireToken(publicBuildLock, token, message);
if (publicBuildLock.includes('fs.mkdirSync(this.lockDir)')) {
  failures.push('public lock exposes an empty ownership directory before owner.json exists');
}
for (const [token, message] of [
  ['function authorizeEmptyOverlayRecovery()', 'public builder must define live-lease authorization'],
  ["path.join(ROOT, 'scripts', 'assert-build-lock.py')", 'public builder must verify the live outer release-build lease'],
  ['authorizeEmptyOverlayRecovery,', 'public builder must supply empty-overlay authorization to the lock'],
]) requireToken(build, token, message);
for (const [token, message] of [
  ['authorizePostBuildOverlayReconciliation()', 'public parity must require live-lease post-build authorization'],
  ['reconcilePostBuildOverlayResidue()', 'public parity must centrally reconcile yielded overlay skeletons'],
  ['postReconciliationState.present.length', 'public parity must require exact post-reconciliation absence'],
]) requireToken(publicParity, token, message);
for (const token of [
  "rejectedUnownedState('unowned staging without lock'",
  "rejectedUnownedState('rollback tree without lock'",
  "rejectedCase('live owner'",
  "rejectedCase('foreign owner'",
  "rejectedCase('malformed owner JSON'",
  "rejectedCase('unverifiable process identity'",
  "rejectedCase('rollback tree'",
  "rejectedCase('lock-directory symlink'",
  'verifyControlledFailureDoesNotDeadlockNextBuild();',
  'verifyExplicitReleaseIsStrictAndRetainsExitFallback();',
  'verifyExitCleanupRemainsBestEffort();',
  'verifyExplicitReleaseRejectsRollbackResidue();',
  'verifyAuthorizedPostBuildOverlayReconciliation();',
  'verifyUnsafePostBuildOverlayResidueIsPreserved();',
  'verifyUnauthorizedPostBuildOverlayResidueIsPreserved();',
  'verifyRecoverableDeadOwner();',
  'verifyAuthorizedEmptyOverlayRecovery();',
  'verifyAuthorizedLocklessEmptyOverlayRecovery();',
  'verifyUnauthorizedEmptyOverlayIsUntouched();',
  'verifyInstalledOwnerExcludesSecondClaim();',
  "verifyUnsafeEmptyOverlayCandidateIsUntouched('symlink staging candidate'",
]) requireToken(
  publicBuildLockVerifier,
  token,
  `public-build lock executable regression is missing ${token}`,
);

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

const staging = path.join(root, '.public-build-staging');
const previous = path.join(root, '.public-build-previous');
const lock = path.join(root, '.public-build-lock');
const publicTransientState = new PublicBuildLock({
  root,
  buildOut: staging,
  previousOut: previous,
}).inspectTransientState();
for (const [candidate, label] of [
  [staging, '.public-build-staging'],
  [previous, '.public-build-previous'],
  [lock, '.public-build-lock'],
]) {
  const stateLabel = label === '.public-build-lock'
    ? 'lock'
    : label === '.public-build-staging' ? 'staging' : 'previous';
  if (
    lstatIfPresent(candidate)
    && !publicTransientState.tombstones.includes(stateLabel)
    && !publicTransientState.directory_overlays.includes(stateLabel)
  ) {
    failures.push(`successful build left ${label} behind`);
  }
}
const publicTransientIsClean = publicTransientState.present.length === 0
  ? publicTransientState.action === 'retry'
  : publicTransientState.present.length === publicTransientState.tombstones.length
      && publicTransientState.action === 'reclaim-overlay-tombstones'
    || publicTransientState.present.length === publicTransientState.directory_overlays.length
      && publicTransientState.action === 'reclaim-directory-overlay';
if (!publicTransientIsClean) {
  failures.push('successful build did not reach centralized clean transient state');
}

if (failures.length) {
  console.error('AUDIT36 ARTIFACT ATOMICITY FAILED');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('AUDIT36 ARTIFACT ATOMICITY PASSED — staged public build, fail-closed owner-bound rollback path, verified temporary ZIP, and prior-artifact preservation.');
