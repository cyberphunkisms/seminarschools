#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {spawnSync} = require('child_process');

const {
  LOCK_DIRECTORY_NAME,
  LOCK_SCHEMA,
  OWNER_FILE_NAME,
  PublicBuildLock,
  RECOVERY_MIN_AGE_MS,
  STAGE_MARKER_NAME,
  STAGE_SCHEMA,
  UNAVAILABLE_IDENTITY_SCHEMA,
  inspectRecordedProcess,
  isValidOverlayTombstone,
  readCurrentProcessIdentity,
} = require('./lib/public-build-lock');

const MODULE_PATH = require.resolve('./lib/public-build-lock');
const BUILDER_PATH = path.join(__dirname, 'build-public-deploy.js');
const TOKEN_PATTERN = /^[a-f0-9]{64}$/;

function sha256(source) {
  return crypto.createHash('sha256').update(source).digest('hex');
}

function snapshotTree(root) {
  const rows = [];
  function visit(candidate, relative) {
    const stat = fs.lstatSync(candidate);
    const type = stat.isSymbolicLink()
      ? 'symlink'
      : stat.isDirectory()
        ? 'directory'
        : stat.isFile()
          ? 'file'
          : 'special';
    const row = {path: relative, type, mode: stat.mode & 0o777};
    if (type === 'symlink') row.target = fs.readlinkSync(candidate);
    if (type === 'file') row.sha256 = sha256(fs.readFileSync(candidate));
    rows.push(row);
    if (type === 'directory') {
      for (const name of fs.readdirSync(candidate).sort()) {
        visit(path.join(candidate, name), relative ? `${relative}/${name}` : name);
      }
    }
  }
  visit(root, '.');
  return rows;
}

function writeJson(candidate, value) {
  fs.writeFileSync(candidate, `${JSON.stringify(value)}\n`, {mode: 0o600});
}

function ageTransient(paths) {
  const old = new Date(Date.now() - RECOVERY_MIN_AGE_MS - 5_000);
  for (const candidate of [paths.ownerPath, paths.markerPath, paths.buildOut, paths.lockDir]) {
    fs.utimesSync(candidate, old, old);
  }
}

function deadProcessIdentity() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const program = `const m=require(${JSON.stringify(MODULE_PATH)});process.stdout.write(JSON.stringify(m.readCurrentProcessIdentity()))`;
    const child = spawnSync(process.execPath, ['-e', program], {encoding: 'utf8'});
    assert.strictEqual(child.status, 0, child.stderr);
    const identity = JSON.parse(child.stdout);
    if (inspectRecordedProcess(identity) === 'dead') return identity;
  }
  throw new Error('could not obtain a conclusively dead Linux process identity');
}

function fixture(tempRoot, options = {}) {
  const root = path.join(tempRoot, 'site');
  const buildOut = path.join(root, '.public-build-staging');
  const previousOut = path.join(root, '.public-build-previous');
  const lockDir = path.join(root, LOCK_DIRECTORY_NAME);
  const ownerPath = path.join(lockDir, OWNER_FILE_NAME);
  const markerPath = path.join(buildOut, STAGE_MARKER_NAME);
  const quarantineRoot = path.join(tempRoot, 'quarantine');
  fs.mkdirSync(lockDir, {recursive: true});
  fs.mkdirSync(buildOut, {recursive: true});
  const owner = {
    schema: LOCK_SCHEMA,
    token: crypto.randomBytes(32).toString('hex'),
    hostname: os.hostname(),
    pid: 987654321,
    process_identity: options.identity || deadProcessIdentity(),
    created_epoch_ms: options.createdEpochMs || Date.now() - 60_000,
  };
  const marker = {
    schema: STAGE_SCHEMA,
    token: owner.token,
    hostname: owner.hostname,
    pid: owner.pid,
    process_identity: owner.process_identity,
    created_epoch_ms: owner.created_epoch_ms,
  };
  writeJson(ownerPath, owner);
  writeJson(markerPath, marker);
  fs.writeFileSync(path.join(buildOut, 'partial.html'), 'stale-stage\n');
  const paths = {
    root,
    buildOut,
    previousOut,
    lockDir,
    ownerPath,
    markerPath,
    quarantineRoot,
    owner,
    marker,
  };
  if (!options.fresh) ageTransient(paths);
  return paths;
}

function lockFor(paths) {
  return new PublicBuildLock({
    root: paths.root,
    buildOut: paths.buildOut,
    previousOut: paths.previousOut,
    quarantineRoot: paths.quarantineRoot,
    authorizeEmptyOverlayRecovery: () => true,
  });
}

function assertNoPreparedClaims(directory) {
  const claims = fs.readdirSync(directory).filter(name => name.startsWith('.ss-public-build-claim-'));
  assert.deepStrictEqual(claims, [], `prepared claim residue survived: ${claims.join(', ')}`);
}

function lstatIfPresent(candidate) {
  try { return fs.lstatSync(candidate); }
  catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function assertNoPublicTransients(root, label) {
  const present = [
    '.public-build-staging', '.public-build-previous', LOCK_DIRECTORY_NAME,
  ].filter(name => Boolean(lstatIfPresent(path.join(root, name))));
  assert.deepStrictEqual(present, [], `${label} left public-build transients: ${present.join(', ')}`);
}

function verifyDefaultQuarantineIsRepositoryLocal() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ss-public-lock-netlify-default-'));
  try {
    const root = path.join(tempRoot, 'opt', 'build', 'repo');
    const buildOut = path.join(root, '.public-build-staging');
    const previousOut = path.join(root, '.public-build-previous');
    fs.mkdirSync(root, {recursive: true});
    const lock = new PublicBuildLock({
      root,
      buildOut,
      previousOut,
      authorizeEmptyOverlayRecovery: () => true,
    });
    assert.strictEqual(
      lock.quarantineRoot,
      path.resolve(root),
      'default quarantine root must stay inside the writable repository checkout',
    );
    lock.acquire();
    assertNoPreparedClaims(root);
    lock.release();
    assertNoPreparedClaims(root);
    assertNoPublicTransients(root, 'repository-local default quarantine lifecycle');
  } finally {
    fs.rmSync(tempRoot, {recursive: true, force: true});
  }
}

function rejectedCase(name, mutate, expected) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ss-public-lock-reject-'));
  try {
    const paths = fixture(tempRoot);
    mutate(paths);
    ageTransient(paths);
    const before = snapshotTree(paths.root);
    const lock = lockFor(paths);
    assert.throws(() => lock.acquire(), expected, name);
    assert.deepStrictEqual(snapshotTree(paths.root), before, `${name} mutated rejected state`);
    assert.strictEqual(fs.existsSync(paths.quarantineRoot), false, `${name} created quarantine state`);
  } finally {
    fs.rmSync(tempRoot, {recursive: true, force: true});
  }
}

function rejectedUnownedState(name, setup, expected) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ss-public-lock-unowned-'));
  try {
    const root = path.join(tempRoot, 'site');
    const buildOut = path.join(root, '.public-build-staging');
    const previousOut = path.join(root, '.public-build-previous');
    const quarantineRoot = path.join(tempRoot, 'quarantine');
    fs.mkdirSync(root, {recursive: true});
    setup({root, buildOut, previousOut});
    const before = snapshotTree(root);
    const lock = new PublicBuildLock({root, buildOut, previousOut, quarantineRoot});
    assert.throws(() => lock.acquire(), expected, name);
    assert.deepStrictEqual(snapshotTree(root), before, `${name} mutated rejected state`);
    assert.strictEqual(fs.existsSync(quarantineRoot), false, `${name} created quarantine state`);
  } finally {
    fs.rmSync(tempRoot, {recursive: true, force: true});
  }
}

function rejectedEmptyOverlayState(name, setup, expected) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ss-public-lock-empty-reject-'));
  try {
    const root = path.join(tempRoot, 'site');
    const buildOut = path.join(root, '.public-build-staging');
    const previousOut = path.join(root, '.public-build-previous');
    const quarantineRoot = path.join(tempRoot, 'quarantine');
    fs.mkdirSync(path.join(root, LOCK_DIRECTORY_NAME), {recursive: true});
    setup({root, buildOut, previousOut});
    const before = snapshotTree(root);
    const lock = new PublicBuildLock({
      root,
      buildOut,
      previousOut,
      quarantineRoot,
      authorizeEmptyOverlayRecovery: () => true,
    });
    assert.throws(() => lock.acquire(), expected, name);
    assert.deepStrictEqual(snapshotTree(root), before, `${name} mutated rejected state`);
    assert.strictEqual(fs.existsSync(quarantineRoot), false, `${name} created quarantine state`);
  } finally {
    fs.rmSync(tempRoot, {recursive: true, force: true});
  }
}

function verifyFreshLifecycle() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ss-public-lock-fresh-'));
  try {
    const root = path.join(tempRoot, 'site');
    const buildOut = path.join(root, '.public-build-staging');
    const previousOut = path.join(root, '.public-build-previous');
    fs.mkdirSync(root, {recursive: true});
    const lock = new PublicBuildLock({
      root,
      buildOut,
      previousOut,
      quarantineRoot: tempRoot,
      authorizeEmptyOverlayRecovery: () => true,
    });
    const owner = lock.acquire();
    assert.match(owner.token, TOKEN_PATTERN);
    assert.strictEqual(owner.schema, LOCK_SCHEMA);
    fs.mkdirSync(buildOut);
    lock.bindStaging();
    const marker = JSON.parse(fs.readFileSync(path.join(buildOut, STAGE_MARKER_NAME), 'utf8'));
    assert.strictEqual(marker.token, owner.token);
    assert.strictEqual(marker.schema, STAGE_SCHEMA);
    lock.unbindStaging();
    assert.strictEqual(fs.existsSync(path.join(buildOut, STAGE_MARKER_NAME)), false);
    fs.renameSync(buildOut, path.join(root, 'public'));
    lock.release();
    assertNoPublicTransients(root, 'fresh release');
  } finally {
    fs.rmSync(tempRoot, {recursive: true, force: true});
  }
}

function verifyRecoverableDeadOwner() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ss-public-lock-recover-'));
  try {
    const paths = fixture(tempRoot);
    const staleToken = paths.owner.token;
    const lock = lockFor(paths);
    assert.strictEqual(lock.inspectExisting().action, 'recover');
    const replacement = lock.acquire();
    assert.match(replacement.token, TOKEN_PATTERN);
    assert.notStrictEqual(replacement.token, staleToken);
    assert.strictEqual(fs.existsSync(paths.buildOut), false);
    const quarantines = fs.readdirSync(paths.quarantineRoot);
    assert.strictEqual(quarantines.length, 1);
    const quarantine = path.join(paths.quarantineRoot, quarantines[0]);
    assert.strictEqual(fs.existsSync(path.join(quarantine, 'lock', OWNER_FILE_NAME)), true);
    assert.strictEqual(fs.existsSync(path.join(quarantine, 'staging', STAGE_MARKER_NAME)), true);
    lock.release();
    assertNoPublicTransients(paths.root, 'dead-owner replacement release');
  } finally {
    fs.rmSync(tempRoot, {recursive: true, force: true});
  }
}

function verifyRecoverableDeadOwnerDirectoryOverlay() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ss-public-lock-dead-overlay-'));
  try {
    const paths = fixture(tempRoot);
    fs.unlinkSync(paths.markerPath);
    fs.unlinkSync(path.join(paths.buildOut, 'partial.html'));
    fs.mkdirSync(path.join(paths.buildOut, 'nested', 'directory', 'skeleton'), {recursive: true});
    const old = new Date(Date.now() - RECOVERY_MIN_AGE_MS - 5_000);
    for (const candidate of [paths.ownerPath, paths.buildOut, paths.lockDir]) {
      fs.utimesSync(candidate, old, old);
    }
    const staleToken = paths.owner.token;
    const lock = lockFor(paths);
    assert.strictEqual(lock.inspectExisting().action, 'recover-dead-owner-directory-overlay');
    const replacement = lock.acquire();
    assert.match(replacement.token, TOKEN_PATTERN);
    assert.notStrictEqual(replacement.token, staleToken);
    assert.strictEqual(fs.existsSync(paths.buildOut), false);
    const quarantines = fs.readdirSync(paths.quarantineRoot);
    assert.strictEqual(quarantines.length, 1);
    const quarantine = path.join(paths.quarantineRoot, quarantines[0]);
    assert.strictEqual(fs.existsSync(path.join(quarantine, 'lock', OWNER_FILE_NAME)), true);
    assert.strictEqual(fs.existsSync(path.join(quarantine, 'staging', 'nested', 'directory', 'skeleton')), true);
    lock.release();
    assertNoPublicTransients(paths.root, 'dead-owner directory-overlay replacement release');
  } finally {
    fs.rmSync(tempRoot, {recursive: true, force: true});
  }
}

function verifyUnauthorizedDeadOwnerDirectoryOverlayIsPreserved() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ss-public-lock-dead-overlay-unauthorized-'));
  try {
    const paths = fixture(tempRoot);
    fs.unlinkSync(paths.markerPath);
    fs.unlinkSync(path.join(paths.buildOut, 'partial.html'));
    fs.mkdirSync(path.join(paths.buildOut, 'nested'), {recursive: true});
    const old = new Date(Date.now() - RECOVERY_MIN_AGE_MS - 5_000);
    for (const candidate of [paths.ownerPath, paths.buildOut, paths.lockDir]) {
      fs.utimesSync(candidate, old, old);
    }
    const before = snapshotTree(paths.root);
    const lock = new PublicBuildLock({
      root: paths.root,
      buildOut: paths.buildOut,
      previousOut: paths.previousOut,
      quarantineRoot: paths.quarantineRoot,
      authorizeEmptyOverlayRecovery: () => false,
    });
    assert.throws(() => lock.acquire(), /live release-build lease/);
    assert.deepStrictEqual(snapshotTree(paths.root), before);
  } finally {
    fs.rmSync(tempRoot, {recursive: true, force: true});
  }
}

function verifyControlledFailureDoesNotDeadlockNextBuild() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ss-public-lock-failure-'));
  try {
    const root = path.join(tempRoot, 'site');
    const buildOut = path.join(root, '.public-build-staging');
    const previousOut = path.join(root, '.public-build-previous');
    fs.mkdirSync(root, {recursive: true});
    const authorized = {authorizeEmptyOverlayRecovery: () => true};
    const failed = new PublicBuildLock({
      root,
      buildOut,
      previousOut,
      quarantineRoot: tempRoot,
      ...authorized,
    });
    failed.acquire();
    fs.mkdirSync(buildOut);
    failed.bindStaging();
    fs.writeFileSync(path.join(buildOut, 'controlled-failure.html'), 'partial\n');
    // Model a commit failure after the marker was removed but before the
    // staging rename: the builder rebinds the exact owner before exit cleanup.
    failed.unbindStaging();
    failed.bindStaging();
    failed.release();
    assertNoPublicTransients(root, 'controlled-failure release');
    const next = new PublicBuildLock({
      root,
      buildOut,
      previousOut,
      quarantineRoot: tempRoot,
      ...authorized,
    });
    next.acquire();
    next.release();
    assertNoPublicTransients(root, 'post-failure successor release');
  } finally {
    fs.rmSync(tempRoot, {recursive: true, force: true});
  }
}

function verifyCommittedDirectoryOverlayDoesNotDeadlockRelease() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ss-public-lock-committed-overlay-'));
  try {
    const root = path.join(tempRoot, 'site');
    const buildOut = path.join(root, '.public-build-staging');
    const previousOut = path.join(root, '.public-build-previous');
    fs.mkdirSync(root, {recursive: true});
    const lock = new PublicBuildLock({
      root,
      buildOut,
      previousOut,
      quarantineRoot: tempRoot,
      authorizeEmptyOverlayRecovery: () => true,
    });
    lock.acquire();
    fs.mkdirSync(buildOut);
    lock.bindStaging();
    lock.unbindStaging();
    fs.renameSync(buildOut, path.join(root, 'public'));
    fs.mkdirSync(path.join(buildOut, 'restored', 'directory', 'skeleton'), {recursive: true});
    lock.release();
    assertNoPublicTransients(root, 'committed directory-overlay release');
  } finally {
    fs.rmSync(tempRoot, {recursive: true, force: true});
  }
}

function verifyExplicitReleaseIsStrictAndRetainsExitFallback() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ss-public-lock-strict-release-'));
  try {
    const root = path.join(tempRoot, 'site');
    const buildOut = path.join(root, '.public-build-staging');
    const previousOut = path.join(root, '.public-build-previous');
    fs.mkdirSync(root, {recursive: true});
    const lock = new PublicBuildLock({
      root,
      buildOut,
      previousOut,
      quarantineRoot: tempRoot,
      authorizeEmptyOverlayRecovery: () => true,
    });
    lock.acquire();
    fs.mkdirSync(buildOut);
    lock.bindStaging();
    const markerPath = path.join(buildOut, STAGE_MARKER_NAME);
    const validMarker = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
    writeJson(markerPath, {...validMarker, token: crypto.randomBytes(32).toString('hex')});
    assert.throws(() => lock.release(), /stage marker changed before cleanup/);
    assert.strictEqual(lock.owned, true, 'failed explicit release discarded ownership state');
    writeJson(markerPath, validMarker);
    assert.doesNotThrow(() => lock.exitHandler());
    assertNoPublicTransients(root, 'exit fallback after strict release failure');
  } finally {
    fs.rmSync(tempRoot, {recursive: true, force: true});
  }
}

function verifyExitCleanupRemainsBestEffort() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ss-public-lock-exit-release-'));
  try {
    const root = path.join(tempRoot, 'site');
    const buildOut = path.join(root, '.public-build-staging');
    const previousOut = path.join(root, '.public-build-previous');
    fs.mkdirSync(root, {recursive: true});
    const lock = new PublicBuildLock({
      root,
      buildOut,
      previousOut,
      quarantineRoot: tempRoot,
      authorizeEmptyOverlayRecovery: () => true,
    });
    lock.acquire();
    fs.mkdirSync(buildOut);
    lock.bindStaging();
    const markerPath = path.join(buildOut, STAGE_MARKER_NAME);
    const marker = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
    writeJson(markerPath, {...marker, token: crypto.randomBytes(32).toString('hex')});
    const before = snapshotTree(root);
    assert.doesNotThrow(() => lock.exitHandler());
    assert.deepStrictEqual(snapshotTree(root), before, 'best-effort exit guessed at unverifiable state');
    assert.strictEqual(lock.owned, false, 'best-effort exit did not detach completed process state');
  } finally {
    fs.rmSync(tempRoot, {recursive: true, force: true});
  }
}

function verifyExplicitReleaseRejectsRollbackResidue() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ss-public-lock-release-rollback-'));
  try {
    const root = path.join(tempRoot, 'site');
    const buildOut = path.join(root, '.public-build-staging');
    const previousOut = path.join(root, '.public-build-previous');
    fs.mkdirSync(root, {recursive: true});
    const lock = new PublicBuildLock({
      root,
      buildOut,
      previousOut,
      quarantineRoot: tempRoot,
      authorizeEmptyOverlayRecovery: () => true,
    });
    lock.acquire();
    fs.mkdirSync(previousOut);
    fs.writeFileSync(path.join(previousOut, 'index.html'), 'prior-good-tree\n');
    const before = snapshotTree(previousOut);
    assert.throws(() => lock.release(), /unverifiable rollback tree is present/);
    assert.deepStrictEqual(snapshotTree(previousOut), before, 'strict release mutated rollback evidence');
    assert.strictEqual(lock.owned, true, 'rollback rejection discarded ownership state');
    fs.rmSync(previousOut, {recursive: true, force: false});
    lock.release();
    assertNoPublicTransients(root, 'release after preserved rollback was resolved');
  } finally {
    fs.rmSync(tempRoot, {recursive: true, force: true});
  }
}

function verifyAuthorizedPostBuildOverlayReconciliation() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ss-public-lock-postprocess-'));
  try {
    const root = path.join(tempRoot, 'site');
    const buildOut = path.join(root, '.public-build-staging');
    const previousOut = path.join(root, '.public-build-previous');
    const lockDir = path.join(root, LOCK_DIRECTORY_NAME);
    fs.mkdirSync(lockDir, {recursive: true});
    fs.mkdirSync(path.join(buildOut, 'nested', 'directory', 'skeleton'), {recursive: true});
    const lock = new PublicBuildLock({
      root,
      buildOut,
      previousOut,
      quarantineRoot: tempRoot,
      authorizeEmptyOverlayRecovery: () => true,
    });
    const result = lock.reconcilePostBuildOverlayResidue();
    assert.strictEqual(result.reconciled, true);
    assert.strictEqual(result.reconciled_roots, 2);
    assert.strictEqual(isValidOverlayTombstone(lockDir, 'lock'), true);
    assert.strictEqual(isValidOverlayTombstone(buildOut, 'staging'), true);
    assert.strictEqual(lstatIfPresent(previousOut), null);
    assert.strictEqual(
      fs.readdirSync(tempRoot).some(name => name.startsWith('.ss-public-build-postprocess-')),
      false,
      'post-build reconciliation left its quarantine behind',
    );
    const successor = new PublicBuildLock({
      root,
      buildOut,
      previousOut,
      quarantineRoot: tempRoot,
      authorizeEmptyOverlayRecovery: () => true,
    });
    successor.acquire();
    successor.release();
    assertNoPublicTransients(root, 'successor after overlay tombstones');
  } finally {
    fs.rmSync(tempRoot, {recursive: true, force: true});
  }
}

function verifyUnsafePostBuildOverlayResidueIsPreserved() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ss-public-lock-postprocess-unsafe-'));
  try {
    const root = path.join(tempRoot, 'site');
    const buildOut = path.join(root, '.public-build-staging');
    const previousOut = path.join(root, '.public-build-previous');
    fs.mkdirSync(path.join(buildOut, 'nested'), {recursive: true});
    fs.writeFileSync(path.join(buildOut, 'nested', 'unexpected.txt'), 'preserve\n');
    const before = snapshotTree(root);
    const lock = new PublicBuildLock({
      root,
      buildOut,
      previousOut,
      quarantineRoot: tempRoot,
      authorizeEmptyOverlayRecovery: () => true,
    });
    assert.throws(
      () => lock.reconcilePostBuildOverlayResidue(),
      /residue is not directory-only/,
    );
    assert.deepStrictEqual(snapshotTree(root), before, 'unsafe post-build residue was not restored exactly');
  } finally {
    fs.rmSync(tempRoot, {recursive: true, force: true});
  }
}

function verifyUnauthorizedPostBuildOverlayResidueIsPreserved() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ss-public-lock-postprocess-unauthorized-'));
  try {
    const root = path.join(tempRoot, 'site');
    const buildOut = path.join(root, '.public-build-staging');
    const previousOut = path.join(root, '.public-build-previous');
    fs.mkdirSync(path.join(buildOut, 'nested'), {recursive: true});
    const before = snapshotTree(root);
    const lock = new PublicBuildLock({
      root,
      buildOut,
      previousOut,
      quarantineRoot: tempRoot,
      authorizeEmptyOverlayRecovery: () => false,
    });
    assert.throws(
      () => lock.reconcilePostBuildOverlayResidue(),
      /live release-build lease/,
    );
    assert.deepStrictEqual(snapshotTree(root), before, 'unauthorized post-build residue was mutated');
  } finally {
    fs.rmSync(tempRoot, {recursive: true, force: true});
  }
}

function verifyAuthorizedEmptyOverlayRecovery() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ss-public-lock-empty-overlay-'));
  try {
    const root = path.join(tempRoot, 'site');
    const buildOut = path.join(root, '.public-build-staging');
    const previousOut = path.join(root, '.public-build-previous');
    const lockDir = path.join(root, LOCK_DIRECTORY_NAME);
    fs.mkdirSync(lockDir, {recursive: true});
    fs.mkdirSync(buildOut, {recursive: true});
    fs.mkdirSync(previousOut, {recursive: true});
    const lock = new PublicBuildLock({
      root,
      buildOut,
      previousOut,
      quarantineRoot: tempRoot,
      authorizeEmptyOverlayRecovery: () => true,
    });
    assert.strictEqual(lock.inspectExisting().action, 'reclaim-empty-overlay');
    const owner = lock.acquire();
    assert.match(owner.token, TOKEN_PATTERN);
    assert.deepStrictEqual(fs.readdirSync(lockDir), [OWNER_FILE_NAME]);
    assert.strictEqual(fs.existsSync(buildOut), false);
    assert.strictEqual(fs.existsSync(previousOut), false);
    assert.strictEqual(
      fs.readdirSync(tempRoot).some(name => name.startsWith('.ss-public-build-empty-overlay-')),
      false,
      'verified empty-overlay quarantine was not cleaned',
    );
    assertNoPreparedClaims(tempRoot);
    lock.release();
    assert.strictEqual(fs.existsSync(lockDir), false);
  } finally {
    fs.rmSync(tempRoot, {recursive: true, force: true});
  }
}

function verifyAuthorizedLocklessEmptyOverlayRecovery() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ss-public-lock-lockless-empty-overlay-'));
  try {
    const root = path.join(tempRoot, 'site');
    const buildOut = path.join(root, '.public-build-staging');
    const previousOut = path.join(root, '.public-build-previous');
    const lockDir = path.join(root, LOCK_DIRECTORY_NAME);
    fs.mkdirSync(buildOut, {recursive: true});
    fs.mkdirSync(previousOut, {recursive: true});
    const lock = new PublicBuildLock({
      root,
      buildOut,
      previousOut,
      quarantineRoot: tempRoot,
      authorizeEmptyOverlayRecovery: () => true,
    });
    assert.strictEqual(lock.inspectExisting().action, 'reclaim-empty-overlay');
    const owner = lock.acquire();
    assert.match(owner.token, TOKEN_PATTERN);
    assert.deepStrictEqual(fs.readdirSync(lockDir), [OWNER_FILE_NAME]);
    assert.strictEqual(fs.existsSync(buildOut), false);
    assert.strictEqual(fs.existsSync(previousOut), false);
    assertNoPreparedClaims(tempRoot);
    lock.release();
    assert.strictEqual(fs.existsSync(lockDir), false);
  } finally {
    fs.rmSync(tempRoot, {recursive: true, force: true});
  }
}

function verifyUnauthorizedEmptyOverlayIsUntouched() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ss-public-lock-empty-unauthorized-'));
  try {
    const root = path.join(tempRoot, 'site');
    const buildOut = path.join(root, '.public-build-staging');
    const previousOut = path.join(root, '.public-build-previous');
    fs.mkdirSync(path.join(root, LOCK_DIRECTORY_NAME), {recursive: true});
    fs.mkdirSync(previousOut, {recursive: true});
    const before = snapshotTree(root);
    const lock = new PublicBuildLock({root, buildOut, previousOut, quarantineRoot: tempRoot});
    assert.throws(() => lock.acquire(), /live release-build lease/);
    assert.deepStrictEqual(snapshotTree(root), before);
    assertNoPreparedClaims(tempRoot);
  } finally {
    fs.rmSync(tempRoot, {recursive: true, force: true});
  }
}

function verifyInstalledOwnerExcludesSecondClaim() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ss-public-lock-contention-'));
  try {
    const root = path.join(tempRoot, 'site');
    const buildOut = path.join(root, '.public-build-staging');
    const previousOut = path.join(root, '.public-build-previous');
    fs.mkdirSync(root, {recursive: true});
    const authorized = {authorizeEmptyOverlayRecovery: () => true};
    const first = new PublicBuildLock({
      root,
      buildOut,
      previousOut,
      quarantineRoot: tempRoot,
      ...authorized,
    });
    const second = new PublicBuildLock({
      root,
      buildOut,
      previousOut,
      quarantineRoot: tempRoot,
      ...authorized,
    });
    first.acquire();
    const before = snapshotTree(path.join(root, LOCK_DIRECTORY_NAME));
    assert.throws(() => second.acquire(), /another or unverifiable build owns/);
    assert.deepStrictEqual(snapshotTree(path.join(root, LOCK_DIRECTORY_NAME)), before);
    assertNoPreparedClaims(tempRoot);
    first.release();
    second.acquire();
    second.release();
    assertNoPreparedClaims(tempRoot);
  } finally {
    fs.rmSync(tempRoot, {recursive: true, force: true});
  }
}

function verifyUnsafeEmptyOverlayCandidateIsUntouched(name, setup) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ss-public-lock-empty-unsafe-'));
  try {
    const root = path.join(tempRoot, 'site');
    const buildOut = path.join(root, '.public-build-staging');
    const previousOut = path.join(root, '.public-build-previous');
    const lockDir = path.join(root, LOCK_DIRECTORY_NAME);
    fs.mkdirSync(lockDir, {recursive: true});
    setup({root, buildOut, previousOut});
    const before = snapshotTree(root);
    const lock = new PublicBuildLock({
      root,
      buildOut,
      previousOut,
      quarantineRoot: tempRoot,
      authorizeEmptyOverlayRecovery: () => true,
    });
    assert.throws(() => lock.acquire(), /unexpected state/, name);
    assert.deepStrictEqual(snapshotTree(root), before, `${name} mutated rejected state`);
    assertNoPreparedClaims(tempRoot);
  } finally {
    fs.rmSync(tempRoot, {recursive: true, force: true});
  }
}

function verifyInspectInstallRaceRequiresAuthorization() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ss-public-lock-install-race-'));
  try {
    const root = path.join(tempRoot, 'site');
    const buildOut = path.join(root, '.public-build-staging');
    const previousOut = path.join(root, '.public-build-previous');
    const lockDir = path.join(root, LOCK_DIRECTORY_NAME);
    fs.mkdirSync(root, {recursive: true});
    class InjectEmptyLockBeforeInstall extends PublicBuildLock {
      _installPreparedClaim(prepared) {
        fs.mkdirSync(lockDir);
        super._installPreparedClaim(prepared);
      }
    }
    const lock = new InjectEmptyLockBeforeInstall({
      root,
      buildOut,
      previousOut,
      quarantineRoot: tempRoot,
      authorizeEmptyOverlayRecovery: () => false,
    });
    assert.throws(() => lock.acquire(), /live release-build lease/);
    assert.strictEqual(fs.existsSync(lockDir), false, 'rejected install race created a lock path');
    assertNoPreparedClaims(tempRoot);
  } finally {
    fs.rmSync(tempRoot, {recursive: true, force: true});
  }
}

function verifyAuthorizationDoesNotSurviveRelease() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ss-public-lock-auth-lifecycle-'));
  try {
    const root = path.join(tempRoot, 'site');
    const buildOut = path.join(root, '.public-build-staging');
    const previousOut = path.join(root, '.public-build-previous');
    const lockDir = path.join(root, LOCK_DIRECTORY_NAME);
    fs.mkdirSync(root, {recursive: true});
    let leaseIsLive = true;
    const lock = new PublicBuildLock({
      root,
      buildOut,
      previousOut,
      quarantineRoot: tempRoot,
      authorizeEmptyOverlayRecovery: () => leaseIsLive,
    });
    fs.mkdirSync(lockDir);
    lock.acquire();
    lock.release();
    leaseIsLive = false;
    fs.mkdirSync(lockDir);
    const before = snapshotTree(root);
    assert.throws(() => lock.acquire(), /live release-build lease/);
    assert.deepStrictEqual(snapshotTree(root), before, 'expired authorization mutated empty overlay state');
    assertNoPreparedClaims(tempRoot);
  } finally {
    fs.rmSync(tempRoot, {recursive: true, force: true});
  }
}

const currentIdentity = readCurrentProcessIdentity();
assert.notStrictEqual(
  currentIdentity.schema,
  UNAVAILABLE_IDENTITY_SCHEMA,
  'Linux /proc identity is required for the executable lock recovery matrix',
);

const builderSource = fs.readFileSync(BUILDER_PATH, 'utf8');
const lockSource = fs.readFileSync(MODULE_PATH, 'utf8');
for (const marker of [
  "require('./lib/public-build-lock')",
  'function delegateToReleaseBuildLockWhenNeeded()',
  "const RELEASE_LOCK_TOKEN_ENV = 'SS_RELEASE_BUILD_LOCK_TOKEN';",
  "const RELEASE_LOCK_ROOT_ENV = 'SS_RELEASE_BUILD_LOCK_ROOT';",
  "path.join(ROOT, 'scripts', 'run-with-build-lock.py')",
  'if (inheritedToken !== undefined && inheritedRoot !== undefined) return;',
  'delegateToReleaseBuildLockWhenNeeded();',
  'publicBuildLock.bindStaging();',
  'if (rel === STAGE_MARKER_NAME) continue;',
  'publicBuildLock.unbindStaging();',
  'if (fs.existsSync(BUILD_OUT)) publicBuildLock.bindStaging();',
  'commitBuildOutput();',
  'publicBuildLock.release();',
]) {
  assert(builderSource.includes(marker), `public builder is not wired to the lock contract: ${marker}`);
}
assert(
  builderSource.indexOf('delegateToReleaseBuildLockWhenNeeded();')
    < builderSource.indexOf('acquireBuildLock();'),
  'direct public builder does not delegate before attempting ownership',
);
assert(
  builderSource.indexOf('publicBuildLock.unbindStaging();')
    < builderSource.lastIndexOf('commitBuildOutput();'),
  'stage binding is not removed immediately before the public commit',
);
for (const marker of [
  'const CLAIM_DIRECTORY_PREFIX',
  '_prepareClaim()',
  'fs.fsyncSync(descriptor)',
  '_installPreparedClaim(prepared)',
  "return {action: 'reclaim-empty-overlay'}",
  '_quarantineEmptySkeletons(candidates,',
  '_cleanupInstalledClaim(prepared)',
  'this.emptyOverlayRecoveryAuthorized = false',
  'assertCurrentAcquisitionHasAuthorizedRecovery()',
  'this._requireEmptyOverlayAuthorization();\n          this._installPreparedClaim(prepared);',
  'inspectTransientState()',
  'this.exitHandler = () => this.release({bestEffort: true});',
  'release({bestEffort = false} = {})',
  'if (!bestEffort) throw error;',
  'reconcilePostBuildOverlayResidue({maxPasses = 4} = {})',
  'inspectDirectoryOnlySkeleton(candidate)',
  'removeVerifiedDirectoryOnlySkeleton(item.destination, item.inspection)',
  "const OVERLAY_TOMBSTONE_SCHEMA = 'seminar-schools-public-build-overlay-tombstone-v1';",
  "action: 'reclaim-overlay-tombstones'",
  'writeOverlayTombstone(item.candidate, item.label)',
  '_discardOverlayTombstonesForOwnership()',
]) {
  assert(lockSource.includes(marker), `public lock lost atomic empty-overlay protocol: ${marker}`);
}
assert(
  !lockSource.includes('fs.mkdirSync(this.lockDir)'),
  'public lock exposes an empty ownership directory before owner.json exists',
);
for (const forbidden of [
  'LEGACY_LOCK_PID_GRACE_MS',
  'BUILD_LOCK_STALE_MS',
  '!owner.token',
  'removeDir(BUILD_LOCK)',
  'removeDir(BUILD_OUT);',
  'if (fs.existsSync(PREVIOUS_OUT)) removeDir(PREVIOUS_OUT);',
]) {
  assert(!builderSource.includes(forbidden), `public builder retains unsafe lock recovery: ${forbidden}`);
}

verifyDefaultQuarantineIsRepositoryLocal();
verifyFreshLifecycle();
verifyRecoverableDeadOwner();
verifyRecoverableDeadOwnerDirectoryOverlay();
verifyUnauthorizedDeadOwnerDirectoryOverlayIsPreserved();
verifyControlledFailureDoesNotDeadlockNextBuild();
verifyCommittedDirectoryOverlayDoesNotDeadlockRelease();
verifyExplicitReleaseIsStrictAndRetainsExitFallback();
verifyExitCleanupRemainsBestEffort();
verifyExplicitReleaseRejectsRollbackResidue();
verifyAuthorizedPostBuildOverlayReconciliation();
verifyUnsafePostBuildOverlayResidueIsPreserved();
verifyUnauthorizedPostBuildOverlayResidueIsPreserved();
verifyAuthorizedEmptyOverlayRecovery();
verifyAuthorizedLocklessEmptyOverlayRecovery();
verifyUnauthorizedEmptyOverlayIsUntouched();
verifyInstalledOwnerExcludesSecondClaim();
verifyInspectInstallRaceRequiresAuthorization();
verifyAuthorizationDoesNotSurviveRelease();
verifyUnsafeEmptyOverlayCandidateIsUntouched('symlink staging candidate', paths => {
  const target = path.join(paths.root, 'external-empty-staging');
  fs.mkdirSync(target, {recursive: true});
  fs.symlinkSync(target, paths.buildOut, 'dir');
});

rejectedUnownedState('unowned staging without lock', paths => {
  fs.mkdirSync(paths.buildOut);
  fs.writeFileSync(path.join(paths.buildOut, 'partial.html'), 'unowned\n');
}, /staging tree exists without a verified owner/);

rejectedUnownedState('rollback tree without lock', paths => {
  fs.mkdirSync(paths.previousOut);
  fs.writeFileSync(path.join(paths.previousOut, 'index.html'), 'prior-good-tree\n');
}, /unverifiable rollback tree is present/);

rejectedEmptyOverlayState('empty lock with staging symlink', paths => {
  const target = path.join(path.dirname(paths.root), 'external-empty-staging');
  fs.mkdirSync(target);
  fs.symlinkSync(target, paths.buildOut, 'dir');
}, /unexpected state/);

rejectedEmptyOverlayState('empty lock with nonempty rollback', paths => {
  fs.mkdirSync(paths.previousOut);
  fs.writeFileSync(path.join(paths.previousOut, 'index.html'), 'prior-good-tree\n');
}, /unexpected state/);

rejectedCase('live owner', paths => {
  paths.owner.process_identity = currentIdentity;
  paths.marker.process_identity = currentIdentity;
  writeJson(paths.ownerPath, paths.owner);
  writeJson(paths.markerPath, paths.marker);
}, /owner process is live/);

rejectedCase('foreign owner', paths => {
  paths.owner.hostname = `${os.hostname()}.foreign`;
  paths.marker.hostname = paths.owner.hostname;
  writeJson(paths.ownerPath, paths.owner);
  writeJson(paths.markerPath, paths.marker);
}, /another host/);

rejectedCase('malformed owner JSON', paths => {
  fs.writeFileSync(paths.ownerPath, '{not-json\n');
}, /invalid JSON/);

rejectedCase('legacy owner', paths => {
  paths.owner.schema = 'seminar-schools-public-build-lock-v1';
  writeJson(paths.ownerPath, paths.owner);
}, /malformed or legacy/);

rejectedCase('non-cryptographic token', paths => {
  paths.owner.token = 'hostname:pid:timestamp';
  paths.marker.token = paths.owner.token;
  writeJson(paths.ownerPath, paths.owner);
  writeJson(paths.markerPath, paths.marker);
}, /malformed or legacy/);

rejectedCase('unverifiable process identity', paths => {
  const identity = {schema: UNAVAILABLE_IDENTITY_SCHEMA, platform: 'fixture'};
  paths.owner.process_identity = identity;
  paths.marker.process_identity = identity;
  writeJson(paths.ownerPath, paths.owner);
  writeJson(paths.markerPath, paths.marker);
}, /identity is unverifiable/);

rejectedCase('mismatched stage token', paths => {
  paths.marker.token = crypto.randomBytes(32).toString('hex');
  writeJson(paths.markerPath, paths.marker);
}, /does not match/);

rejectedCase('rollback tree', paths => {
  fs.mkdirSync(paths.previousOut);
  fs.writeFileSync(path.join(paths.previousOut, 'index.html'), 'prior-good-tree\n');
}, /rollback tree is present/);

rejectedCase('future owner timestamp', paths => {
  const future = Date.now() + 60_000;
  paths.owner.created_epoch_ms = future;
  paths.marker.created_epoch_ms = future;
  writeJson(paths.ownerPath, paths.owner);
  writeJson(paths.markerPath, paths.marker);
}, /rollback\/future state/);

{
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ss-public-lock-fresh-dead-'));
  try {
    const paths = fixture(tempRoot, {fresh: true});
    const before = snapshotTree(paths.root);
    assert.throws(() => lockFor(paths).acquire(), /not yet stale/);
    assert.deepStrictEqual(snapshotTree(paths.root), before);
  } finally {
    fs.rmSync(tempRoot, {recursive: true, force: true});
  }
}

rejectedCase('lock-directory symlink', paths => {
  const target = path.join(path.dirname(paths.root), 'external-lock');
  fs.renameSync(paths.lockDir, target);
  fs.symlinkSync(target, paths.lockDir, 'dir');
}, /lock path is not a non-symlink directory/);

rejectedCase('owner-file symlink', paths => {
  const target = path.join(path.dirname(paths.root), 'external-owner.json');
  fs.renameSync(paths.ownerPath, target);
  fs.symlinkSync(target, paths.ownerPath, 'file');
}, /owner must be a non-symlink regular file/);

rejectedCase('staging-directory symlink', paths => {
  const target = path.join(path.dirname(paths.root), 'external-staging');
  fs.renameSync(paths.buildOut, target);
  fs.symlinkSync(target, paths.buildOut, 'dir');
}, /staging path is not a non-symlink directory/);

rejectedCase('stage-marker symlink', paths => {
  const target = path.join(path.dirname(paths.root), 'external-marker.json');
  fs.renameSync(paths.markerPath, target);
  fs.symlinkSync(target, paths.markerPath, 'file');
}, /stage marker must be a non-symlink regular file/);

console.log(
  'PUBLIC BUILD LOCK RECOVERY PASSED — repository-local Netlify-safe claims, atomic prepared ownership, authorized exact-empty overlay recovery, '
  + 'fresh lifecycle, contention exclusion, and same-host cryptographically bound dead-owner recovery; '
  + 'unauthorized, non-directory, live, foreign, malformed, legacy, non-cryptographic, unverifiable, mismatched, rollback, future, fresh, and symlink states fail closed.',
);
