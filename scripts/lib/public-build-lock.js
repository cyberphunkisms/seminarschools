#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const LOCK_DIRECTORY_NAME = '.public-build-lock';
const OWNER_FILE_NAME = 'owner.json';
const STAGE_MARKER_NAME = '.seminar-schools-public-build-owner.json';
const LOCK_SCHEMA = 'seminar-schools-public-build-lock-v2';
const STAGE_SCHEMA = 'seminar-schools-public-build-stage-v1';
const LINUX_IDENTITY_SCHEMA = 'linux-proc-start-v1';
const UNAVAILABLE_IDENTITY_SCHEMA = 'process-identity-unavailable-v1';
const RECOVERY_MIN_AGE_MS = 2_000;
const CLOCK_FUTURE_TOLERANCE_MS = 1_000;
const TOKEN_PATTERN = /^[a-f0-9]{64}$/;
const CLAIM_DIRECTORY_PREFIX = '.ss-public-build-claim-';
const OVERLAY_TOMBSTONE_SCHEMA = 'seminar-schools-public-build-overlay-tombstone-v1';

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function lstatIfPresent(candidate) {
  try {
    return fs.lstatSync(candidate);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function inspectDirectorySkeleton(candidate) {
  const rootStat = lstatIfPresent(candidate);
  if (!rootStat) return {kind: 'absent', rows: []};
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
    return {kind: 'unsafe', rows: []};
  }
  try {
    if (fs.readdirSync(candidate).length !== 0) return {kind: 'unsafe', rows: []};
  } catch (error) {
    return {kind: 'unsafe', rows: [], reason: error.message};
  }
  return {
    kind: 'empty-directory-skeleton',
    rows: [{relative: '.', dev: rootStat.dev, ino: rootStat.ino, mode: rootStat.mode}],
  };
}

function sameDirectorySkeleton(left, right) {
  return left.kind === 'empty-directory-skeleton'
    && right.kind === 'empty-directory-skeleton'
    && JSON.stringify(left.rows) === JSON.stringify(right.rows);
}

function inspectDirectoryOnlySkeleton(candidate) {
  const rows = [];
  function visit(current, relative) {
    const stat = lstatIfPresent(current);
    if (!stat) return {kind: 'unsafe', reason: `${relative} disappeared`};
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      return {kind: 'unsafe', reason: `${relative} is not a non-symlink directory`};
    }
    rows.push({relative, dev: stat.dev, ino: stat.ino, mode: stat.mode});
    let names;
    try { names = fs.readdirSync(current).sort(); }
    catch (error) { return {kind: 'unsafe', reason: `${relative} is unreadable: ${error.message}`}; }
    for (const name of names) {
      const childRelative = relative === '.' ? name : `${relative}/${name}`;
      const result = visit(path.join(current, name), childRelative);
      if (result) return result;
    }
    return null;
  }
  const failure = visit(candidate, '.');
  return failure || {kind: 'directory-only-skeleton', rows};
}

function removeVerifiedDirectoryOnlySkeleton(candidate, expected) {
  const current = inspectDirectoryOnlySkeleton(candidate);
  if (
    current.kind !== 'directory-only-skeleton'
    || JSON.stringify(current.rows) !== JSON.stringify(expected.rows)
  ) {
    throw new Error('directory-only overlay skeleton changed before removal');
  }
  const paths = current.rows
    .map(row => row.relative === '.' ? candidate : path.join(candidate, ...row.relative.split('/')))
    .sort((left, right) => right.split(path.sep).length - left.split(path.sep).length);
  for (const directory of paths) fs.rmdirSync(directory);
}

function overlayTombstoneContent(label) {
  return `${JSON.stringify({schema: OVERLAY_TOMBSTONE_SCHEMA, path: label})}\n`;
}

function isValidOverlayTombstone(candidate, label) {
  const stat = lstatIfPresent(candidate);
  if (!stat || stat.isSymbolicLink() || !stat.isFile()) return false;
  try { return fs.readFileSync(candidate, 'utf8') === overlayTombstoneContent(label); }
  catch (_) { return false; }
}

function writeOverlayTombstone(candidate, label) {
  let descriptor;
  try {
    descriptor = fs.openSync(candidate, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY, 0o600);
    fs.writeFileSync(descriptor, overlayTombstoneContent(label), 'utf8');
    fs.fsyncSync(descriptor);
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
}

function fsyncDirectory(candidate) {
  if (process.platform === 'win32') return;
  const descriptor = fs.openSync(candidate, fs.constants.O_RDONLY);
  try {
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
}

function parseLinuxStat(source) {
  const firstSpace = source.indexOf(' ');
  const closeParen = source.lastIndexOf(')');
  if (firstSpace <= 0 || closeParen <= firstSpace) return null;
  const procPid = Number(source.slice(0, firstSpace));
  const suffix = source.slice(closeParen + 2).trim().split(/\s+/);
  const startTicks = suffix[19];
  if (!Number.isInteger(procPid) || procPid <= 0 || !/^\d+$/.test(String(startTicks || ''))) {
    return null;
  }
  return {proc_pid: procPid, start_ticks: String(startTicks)};
}

function readLinuxProcessIdentity(procReference = 'self') {
  const statPath = `/proc/${procReference}/stat`;
  const namespacePath = `/proc/${procReference}/ns/pid`;
  const parsed = parseLinuxStat(fs.readFileSync(statPath, 'utf8').trim());
  if (!parsed) throw new Error(`cannot parse Linux process identity: ${statPath}`);
  const pidNamespace = fs.readlinkSync(namespacePath);
  if (!/^pid:\[\d+\]$/.test(pidNamespace)) {
    throw new Error(`cannot parse Linux PID namespace: ${namespacePath}`);
  }
  return {
    schema: LINUX_IDENTITY_SCHEMA,
    proc_pid: parsed.proc_pid,
    start_ticks: parsed.start_ticks,
    pid_namespace: pidNamespace,
  };
}

function readCurrentProcessIdentity() {
  if (process.platform !== 'linux') {
    return {schema: UNAVAILABLE_IDENTITY_SCHEMA, platform: process.platform};
  }
  try {
    // /proc/self exposes the host-visible process identity even when
    // process.pid is namespace-local in an artifact runner.
    return readLinuxProcessIdentity('self');
  } catch (error) {
    return {
      schema: UNAVAILABLE_IDENTITY_SCHEMA,
      platform: process.platform,
      reason: String(error.code || error.message || 'unavailable'),
    };
  }
}

function validLinuxIdentity(identity) {
  return isPlainObject(identity)
    && Object.keys(identity).sort().join(',') === 'pid_namespace,proc_pid,schema,start_ticks'
    && identity.schema === LINUX_IDENTITY_SCHEMA
    && Number.isInteger(identity.proc_pid)
    && identity.proc_pid > 0
    && /^\d+$/.test(String(identity.start_ticks || ''))
    && /^pid:\[\d+\]$/.test(String(identity.pid_namespace || ''));
}

function inspectRecordedProcess(identity) {
  if (!validLinuxIdentity(identity) || process.platform !== 'linux') return 'unverifiable';
  let current;
  try {
    current = readLinuxProcessIdentity(String(identity.proc_pid));
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ESRCH') return 'dead';
    return 'unverifiable';
  }
  return current.start_ticks === String(identity.start_ticks)
      && current.pid_namespace === identity.pid_namespace
    ? 'live'
    : 'dead';
}

function readRegularJson(candidate, label) {
  const before = lstatIfPresent(candidate);
  if (!before) throw new Error(`${label} is missing`);
  if (before.isSymbolicLink() || !before.isFile()) {
    throw new Error(`${label} must be a non-symlink regular file`);
  }
  const noFollow = fs.constants.O_NOFOLLOW || 0;
  let descriptor;
  try {
    descriptor = fs.openSync(candidate, fs.constants.O_RDONLY | noFollow);
    const opened = fs.fstatSync(descriptor);
    if (!opened.isFile() || opened.dev !== before.dev || opened.ino !== before.ino) {
      throw new Error(`${label} changed while it was inspected`);
    }
    const source = fs.readFileSync(descriptor, 'utf8');
    const parsed = JSON.parse(source);
    if (!isPlainObject(parsed)) throw new Error(`${label} must contain a JSON object`);
    return {value: parsed, stat: before};
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error(`${label} contains invalid JSON`);
    throw error;
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
}

function validOwner(owner) {
  if (!isPlainObject(owner)) return false;
  if (
    Object.keys(owner).sort().join(',')
      !== 'created_epoch_ms,hostname,pid,process_identity,schema,token'
  ) return false;
  if (owner.schema !== LOCK_SCHEMA || !TOKEN_PATTERN.test(String(owner.token || ''))) return false;
  if (typeof owner.hostname !== 'string' || !owner.hostname) return false;
  if (!Number.isInteger(owner.pid) || owner.pid <= 0) return false;
  if (!Number.isInteger(owner.created_epoch_ms) || owner.created_epoch_ms <= 0) return false;
  if (!isPlainObject(owner.process_identity)) return false;
  return owner.process_identity.schema === UNAVAILABLE_IDENTITY_SCHEMA
    || validLinuxIdentity(owner.process_identity);
}

function sameIdentity(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function markerMatchesOwner(marker, owner) {
  return isPlainObject(marker)
    && Object.keys(marker).sort().join(',')
      === 'created_epoch_ms,hostname,pid,process_identity,schema,token'
    && marker.schema === STAGE_SCHEMA
    && marker.token === owner.token
    && marker.hostname === owner.hostname
    && marker.pid === owner.pid
    && marker.created_epoch_ms === owner.created_epoch_ms
    && sameIdentity(marker.process_identity, owner.process_identity);
}

function pathTimestampIsFuture(stat, now) {
  return stat.mtimeMs > now + CLOCK_FUTURE_TOLERANCE_MS;
}

class PublicBuildLock {
  constructor({
    root,
    buildOut,
    previousOut,
    quarantineRoot,
    authorizeEmptyOverlayRecovery,
  } = {}) {
    if (!root || !buildOut || !previousOut) {
      throw new TypeError('PublicBuildLock requires root, buildOut, and previousOut');
    }
    this.root = path.resolve(root);
    this.buildOut = path.resolve(buildOut);
    this.previousOut = path.resolve(previousOut);
    this.lockDir = path.join(this.root, LOCK_DIRECTORY_NAME);
    this.ownerPath = path.join(this.lockDir, OWNER_FILE_NAME);
    this.stageMarkerPath = path.join(this.buildOut, STAGE_MARKER_NAME);
    this.quarantineRoot = path.resolve(
      quarantineRoot || path.dirname(path.dirname(this.root)),
    );
    this.authorizeEmptyOverlayRecovery = typeof authorizeEmptyOverlayRecovery === 'function'
      ? authorizeEmptyOverlayRecovery
      : null;
    this.emptyOverlayRecoveryAuthorized = false;
    this.hostname = os.hostname();
    this.token = null;
    this.owner = null;
    this.owned = false;
    this.stagingUnboundForCommit = false;
    this.exitHandler = () => this.release({bestEffort: true});
  }

  _prepareClaim() {
    const createdEpochMs = Date.now();
    const processIdentity = readCurrentProcessIdentity();
    const token = crypto.randomBytes(32).toString('hex');
    const owner = {
      schema: LOCK_SCHEMA,
      token,
      hostname: this.hostname,
      pid: process.pid,
      process_identity: processIdentity,
      created_epoch_ms: createdEpochMs,
    };
    fs.mkdirSync(this.quarantineRoot, {recursive: true, mode: 0o700});
    const quarantineStat = lstatIfPresent(this.quarantineRoot);
    const rootStat = lstatIfPresent(this.root);
    if (
      !quarantineStat
      || quarantineStat.isSymbolicLink()
      || !quarantineStat.isDirectory()
      || !rootStat
      || rootStat.isSymbolicLink()
      || !rootStat.isDirectory()
      || quarantineStat.dev !== rootStat.dev
    ) {
      throw new Error('public-build prepared claim requires a same-filesystem non-symlink quarantine root');
    }
    const claimDir = fs.mkdtempSync(path.join(this.quarantineRoot, CLAIM_DIRECTORY_PREFIX));
    const claimOwnerPath = path.join(claimDir, OWNER_FILE_NAME);
    let descriptor;
    try {
      descriptor = fs.openSync(claimOwnerPath, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY, 0o600);
      fs.writeFileSync(descriptor, `${JSON.stringify(owner)}\n`, 'utf8');
      fs.fsyncSync(descriptor);
      fs.closeSync(descriptor);
      descriptor = undefined;
      fsyncDirectory(claimDir);
    } catch (error) {
      if (descriptor !== undefined) fs.closeSync(descriptor);
      try { fs.unlinkSync(claimOwnerPath); } catch (_) {}
      try { fs.rmdirSync(claimDir); } catch (_) {}
      try { fs.rmdirSync(this.quarantineRoot); } catch (_) {}
      throw error;
    }
    return {claimDir, claimOwnerPath, owner, token};
  }

  _publishInstalledClaim(prepared) {
    this.token = prepared.token;
    this.owner = prepared.owner;
    this.owned = true;
    process.once('exit', this.exitHandler);
    return prepared.owner;
  }

  _cleanupPreparedClaim(prepared) {
    if (!prepared || !lstatIfPresent(prepared.claimDir)) return;
    try {
      const entries = fs.readdirSync(prepared.claimDir);
      if (entries.length !== 1 || entries[0] !== OWNER_FILE_NAME) return;
      const record = readRegularJson(prepared.claimOwnerPath, 'prepared public-build owner');
      if (record.value.token !== prepared.token) return;
      fs.unlinkSync(prepared.claimOwnerPath);
      fs.rmdirSync(prepared.claimDir);
      try { fs.rmdirSync(this.quarantineRoot); } catch (_) {}
    } catch (_) {
      // A changed private claim is preserved for inspection.
    }
  }

  _cleanupInstalledClaim(prepared) {
    try {
      const entries = fs.readdirSync(this.lockDir);
      if (entries.length !== 1 || entries[0] !== OWNER_FILE_NAME) return false;
      const record = readRegularJson(this.ownerPath, 'installed public-build owner');
      if (record.value.token !== prepared.token) return false;
      fs.unlinkSync(this.ownerPath);
      fs.rmdirSync(this.lockDir);
      return true;
    } catch (_) {
      return false;
    }
  }

  _requireEmptyOverlayAuthorization() {
    if (this.emptyOverlayRecoveryAuthorized) return;
    if (!this.authorizeEmptyOverlayRecovery || this.authorizeEmptyOverlayRecovery() !== true) {
      throw new Error(
        'PUBLIC DEPLOY BUILD FAILED — empty overlay recovery requires the live release-build lease',
      );
    }
    this.emptyOverlayRecoveryAuthorized = true;
  }

  assertCurrentAcquisitionHasAuthorizedRecovery() {
    if (
      !this.owned
      || !this.owner
      || this.owner.token !== this.token
      || !this.emptyOverlayRecoveryAuthorized
    ) {
      throw new Error(
        'PUBLIC DEPLOY BUILD FAILED — current public-build acquisition lacks authorized overlay recovery',
      );
    }
    return true;
  }

  _quarantineEmptySkeletons(candidates, {retain = false} = {}) {
    const selected = [];
    for (const [label, candidate] of candidates) {
      const inspection = inspectDirectorySkeleton(candidate);
      if (inspection.kind === 'absent') continue;
      if (inspection.kind !== 'empty-directory-skeleton') {
        throw new Error(`public-build ${label} is not an empty directory skeleton`);
      }
      selected.push({label, candidate, inspection});
    }
    if (!selected.length) return null;
    this._requireEmptyOverlayAuthorization();
    fs.mkdirSync(this.quarantineRoot, {recursive: true, mode: 0o700});
    const quarantine = fs.mkdtempSync(
      path.join(this.quarantineRoot, '.ss-public-build-empty-overlay-'),
    );
    const moved = [];
    try {
      for (const item of selected) {
        const destination = path.join(quarantine, item.label);
        fs.renameSync(item.candidate, destination);
        moved.push({...item, destination});
        const after = inspectDirectorySkeleton(destination);
        if (!sameDirectorySkeleton(item.inspection, after)) {
          throw new Error(`public-build ${item.label} changed during empty-overlay quarantine`);
        }
      }
      if (!retain) {
        for (const item of moved) fs.rmdirSync(item.destination);
        fs.rmdirSync(quarantine);
        return null;
      }
      return quarantine;
    } catch (error) {
      const rollbackFailures = [];
      for (const item of moved.reverse()) {
        try {
          if (lstatIfPresent(item.candidate)) {
            throw new Error('original path was recreated');
          }
          fs.renameSync(item.destination, item.candidate);
        } catch (rollbackError) {
          rollbackFailures.push(`${item.label}: ${rollbackError.message}`);
        }
      }
      if (rollbackFailures.length) {
        throw new Error(
          `${error.message}; empty-overlay rollback failed: ${rollbackFailures.join('; ')}`,
        );
      }
      try { fs.rmdirSync(quarantine); } catch (_) {}
      throw error;
    }
  }

  _installPreparedClaim(prepared) {
    fs.renameSync(prepared.claimDir, this.lockDir);
  }

  _discardRetainedEmptyQuarantine(quarantine) {
    try {
      if (!quarantine || !lstatIfPresent(quarantine)) return;
      const entries = fs.readdirSync(quarantine);
      for (const entry of entries) {
        const candidate = path.join(quarantine, entry);
        if (inspectDirectorySkeleton(candidate).kind !== 'empty-directory-skeleton') return;
      }
      for (const entry of entries) fs.rmdirSync(path.join(quarantine, entry));
      fs.rmdirSync(quarantine);
    } catch (_) {
      // A changed quarantine is preserved outside the deliverable tree.
    }
  }

  assertNoRollbackState() {
    if (lstatIfPresent(this.previousOut)) {
      throw new Error(
        `PUBLIC DEPLOY BUILD FAILED — unverifiable rollback tree is present: ${this.previousOut}`,
      );
    }
  }

  assertNoUnownedTransientState() {
    this.assertNoRollbackState();
    if (lstatIfPresent(this.buildOut)) {
      throw new Error(
        `PUBLIC DEPLOY BUILD FAILED — staging tree exists without a verified owner: ${this.buildOut}`,
      );
    }
  }

  captureOwnedRollbackState() {
    const stat = lstatIfPresent(this.previousOut);
    if (!stat || stat.isSymbolicLink() || !stat.isDirectory()) {
      throw new Error('public-build rollback path is not the directory created by this commit');
    }
    return {dev: stat.dev, ino: stat.ino, mode: stat.mode};
  }

  assertOwnedRollbackState(expected) {
    const stat = lstatIfPresent(this.previousOut);
    if (
      !expected
      || !stat
      || stat.isSymbolicLink()
      || !stat.isDirectory()
      || stat.dev !== expected.dev
      || stat.ino !== expected.ino
      || stat.mode !== expected.mode
    ) {
      throw new Error('public-build rollback tree changed after it was created by this commit');
    }
  }

  _inspectExisting() {
    const now = Date.now();
    const tombstoneCandidates = [
      ['lock', this.lockDir],
      ['staging', this.buildOut],
      ['previous', this.previousOut],
    ];
    const validTombstones = tombstoneCandidates.filter(([label, candidate]) => (
      isValidOverlayTombstone(candidate, label)
    ));
    if (validTombstones.length) {
      const nonTombstoneCandidates = tombstoneCandidates.filter(([label, candidate]) => (
        lstatIfPresent(candidate) && !isValidOverlayTombstone(candidate, label)
      ));
      if (nonTombstoneCandidates.length) {
        const verifiedDirectoryOverlays = nonTombstoneCandidates.filter(([, candidate]) => (
          inspectDirectoryOnlySkeleton(candidate).kind === 'directory-only-skeleton'
        ));
        if (verifiedDirectoryOverlays.length === nonTombstoneCandidates.length) {
          return {
            action: 'reclaim-post-build-overlays',
            tombstones: validTombstones.map(([label]) => label),
            directory_overlays: verifiedDirectoryOverlays.map(([label]) => label),
          };
        }
        return {action: 'block', reason: 'overlay tombstone is mixed with unverifiable transient state'};
      }
      return {
        action: 'reclaim-overlay-tombstones',
        tombstones: validTombstones.map(([label]) => label),
      };
    }
    const directoryOverlayCandidates = tombstoneCandidates.filter(([, candidate]) => (
      Boolean(lstatIfPresent(candidate))
    ));
    const directoryOverlayInspections = directoryOverlayCandidates.map(([label, candidate]) => (
      [label, inspectDirectoryOnlySkeleton(candidate)]
    ));
    if (
      directoryOverlayCandidates.length
      && directoryOverlayInspections.some(([, inspection]) => inspection.rows?.length > 1)
      && directoryOverlayInspections.every(([, inspection]) => (
        inspection.kind === 'directory-only-skeleton'
      ))
    ) {
      return {
        action: 'reclaim-directory-overlay',
        directory_overlays: directoryOverlayCandidates.map(([label]) => label),
      };
    }
    const lockStat = lstatIfPresent(this.lockDir);
    if (!lockStat) {
      const stageSkeleton = inspectDirectorySkeleton(this.buildOut);
      const previousSkeleton = inspectDirectorySkeleton(this.previousOut);
      const recoverableSkeleton = value => (
        value.kind === 'absent' || value.kind === 'empty-directory-skeleton'
      );
      if (
        (stageSkeleton.kind === 'empty-directory-skeleton'
          || previousSkeleton.kind === 'empty-directory-skeleton')
        && recoverableSkeleton(stageSkeleton)
        && recoverableSkeleton(previousSkeleton)
      ) {
        return {action: 'reclaim-empty-overlay'};
      }
      return {action: 'retry'};
    }
    if (lockStat.isSymbolicLink() || !lockStat.isDirectory()) {
      return {action: 'block', reason: 'lock path is not a non-symlink directory'};
    }
    let lockEntries;
    try {
      lockEntries = fs.readdirSync(this.lockDir);
    } catch (error) {
      return {action: 'block', reason: `lock directory is unreadable: ${error.message}`};
    }
    if (lockEntries.length !== 1 || lockEntries[0] !== OWNER_FILE_NAME) {
      const lockSkeleton = inspectDirectorySkeleton(this.lockDir);
      const stageSkeleton = inspectDirectorySkeleton(this.buildOut);
      const previousSkeleton = inspectDirectorySkeleton(this.previousOut);
      const recoverableSkeleton = value => (
        value.kind === 'absent' || value.kind === 'empty-directory-skeleton'
      );
      if (
        lockSkeleton.kind === 'empty-directory-skeleton'
        && recoverableSkeleton(stageSkeleton)
        && recoverableSkeleton(previousSkeleton)
      ) {
        return {action: 'reclaim-empty-overlay'};
      }
      return {action: 'block', reason: 'lock directory contains unexpected state'};
    }

    let ownerRecord;
    try {
      ownerRecord = readRegularJson(this.ownerPath, 'public-build lock owner');
    } catch (error) {
      return {action: 'block', reason: error.message};
    }
    const owner = ownerRecord.value;
    if (!validOwner(owner)) return {action: 'block', reason: 'owner record is malformed or legacy'};
    if (owner.hostname !== this.hostname) return {action: 'block', reason: 'owner belongs to another host'};
    if (owner.created_epoch_ms > now + CLOCK_FUTURE_TOLERANCE_MS) {
      return {action: 'block', reason: 'owner timestamp is in a rollback/future state'};
    }

    const previousStat = lstatIfPresent(this.previousOut);
    if (previousStat) return {action: 'block', reason: 'rollback tree is present'};

    const stageStat = lstatIfPresent(this.buildOut);
    if (!stageStat) return {action: 'block', reason: 'staging tree is missing'};
    if (stageStat.isSymbolicLink() || !stageStat.isDirectory()) {
      return {action: 'block', reason: 'staging path is not a non-symlink directory'};
    }

    // An extracted workspace can restore only the directory topology of a
    // committed staging tree after its owner exits. Recover that exact state
    // only when the cryptographic owner is conclusively dead and every staged
    // descendant is a directory; any file, symlink, live owner, or unknown
    // identity remains blocking.
    const stageDirectoryOverlay = inspectDirectoryOnlySkeleton(this.buildOut);
    if (stageDirectoryOverlay.kind === 'directory-only-skeleton') {
      for (const stat of [lockStat, ownerRecord.stat, stageStat]) {
        if (pathTimestampIsFuture(stat, now)) {
          return {action: 'block', reason: 'lock or staging timestamp is in a rollback/future state'};
        }
      }
      const newestTransientMtime = Math.max(
        lockStat.mtimeMs,
        ownerRecord.stat.mtimeMs,
        stageStat.mtimeMs,
      );
      if (now - newestTransientMtime < RECOVERY_MIN_AGE_MS) {
        return {action: 'block', reason: 'dead-owner directory overlay is not yet stale'};
      }
      const processStatus = inspectRecordedProcess(owner.process_identity);
      if (processStatus === 'live') return {action: 'block', reason: 'owner process is live'};
      if (processStatus !== 'dead') {
        return {action: 'block', reason: 'owner process identity is unverifiable'};
      }
      return {action: 'recover-dead-owner-directory-overlay', owner};
    }

    let markerRecord;
    try {
      markerRecord = readRegularJson(this.stageMarkerPath, 'public-build stage marker');
    } catch (error) {
      return {action: 'block', reason: error.message};
    }
    if (!markerMatchesOwner(markerRecord.value, owner)) {
      return {action: 'block', reason: 'stage marker does not match its owner'};
    }

    for (const stat of [lockStat, ownerRecord.stat, stageStat, markerRecord.stat]) {
      if (pathTimestampIsFuture(stat, now)) {
        return {action: 'block', reason: 'lock or staging timestamp is in a rollback/future state'};
      }
    }
    const newestTransientMtime = Math.max(
      lockStat.mtimeMs,
      ownerRecord.stat.mtimeMs,
      stageStat.mtimeMs,
      markerRecord.stat.mtimeMs,
    );
    if (now - newestTransientMtime < RECOVERY_MIN_AGE_MS) {
      return {action: 'block', reason: 'dead-owner staging tree is not yet stale'};
    }

    const processStatus = inspectRecordedProcess(owner.process_identity);
    if (processStatus === 'live') return {action: 'block', reason: 'owner process is live'};
    if (processStatus !== 'dead') {
      return {action: 'block', reason: 'owner process identity is unverifiable'};
    }
    return {action: 'recover', owner};
  }

  inspectExisting() {
    // Read-only public probe for downstream audits.  It deliberately reuses
    // the exact fail-closed recovery decision instead of approximating lock
    // validity from path presence alone.
    return this._inspectExisting();
  }

  inspectTransientState() {
    const candidates = [
      ['lock', this.lockDir],
      ['staging', this.buildOut],
      ['previous', this.previousOut],
    ];
    const present = candidates
      .filter(([, candidate]) => Boolean(lstatIfPresent(candidate)))
      .map(([label]) => label);
    const tombstones = candidates
      .filter(([label, candidate]) => isValidOverlayTombstone(candidate, label))
      .map(([label]) => label);
    const directoryOverlays = candidates
      .filter(([, candidate]) => (
        lstatIfPresent(candidate)
        && inspectDirectoryOnlySkeleton(candidate).kind === 'directory-only-skeleton'
      ))
      .map(([label]) => label);
    const decision = present.length ? this._inspectExisting() : {action: 'retry'};
    return {...decision, present, tombstones, directory_overlays: directoryOverlays};
  }

  reconcilePostBuildOverlayResidue({maxPasses = 4} = {}) {
    if (this.owned) throw new Error('post-build overlay reconciliation requires an unowned lock probe');
    if (!Number.isInteger(maxPasses) || maxPasses < 1 || maxPasses > 16) {
      throw new TypeError('post-build overlay reconciliation maxPasses must be an integer from 1 through 16');
    }
    const candidates = [
      ['lock', this.lockDir],
      ['staging', this.buildOut],
      ['previous', this.previousOut],
    ];
    let reconciledRoots = 0;
    for (let pass = 1; pass <= maxPasses; pass += 1) {
      const present = candidates.filter(([label, candidate]) => (
        lstatIfPresent(candidate) && !isValidOverlayTombstone(candidate, label)
      ));
      const stateBefore = this.inspectTransientState();
      if (!present.length && stateBefore.present.length === stateBefore.tombstones.length) {
        return {reconciled: reconciledRoots > 0, reconciled_roots: reconciledRoots, passes: pass - 1};
      }
      this._requireEmptyOverlayAuthorization();
      fs.mkdirSync(this.quarantineRoot, {recursive: true, mode: 0o700});
      const quarantineStat = lstatIfPresent(this.quarantineRoot);
      const rootStat = lstatIfPresent(this.root);
      if (
        !quarantineStat
        || quarantineStat.isSymbolicLink()
        || !quarantineStat.isDirectory()
        || !rootStat
        || rootStat.isSymbolicLink()
        || !rootStat.isDirectory()
        || quarantineStat.dev !== rootStat.dev
      ) {
        throw new Error('post-build overlay reconciliation requires a same-filesystem non-symlink quarantine root');
      }
      const quarantine = fs.mkdtempSync(
        path.join(this.quarantineRoot, '.ss-public-build-postprocess-'),
      );
      const moved = [];
      try {
        for (const [label, candidate] of present) {
          const before = lstatIfPresent(candidate);
          if (!before || before.isSymbolicLink() || !before.isDirectory()) {
            throw new Error(`post-build ${label} residue is not a non-symlink directory`);
          }
          const destination = path.join(quarantine, label);
          fs.renameSync(candidate, destination);
          const after = lstatIfPresent(destination);
          if (
            !after
            || after.isSymbolicLink()
            || !after.isDirectory()
            || after.dev !== before.dev
            || after.ino !== before.ino
            || after.mode !== before.mode
          ) {
            throw new Error(`post-build ${label} residue changed during quarantine`);
          }
          moved.push({label, candidate, destination, inspection: null});
        }
        for (const item of moved) {
          item.inspection = inspectDirectoryOnlySkeleton(item.destination);
          if (item.inspection.kind !== 'directory-only-skeleton') {
            throw new Error(
              `post-build ${item.label} residue is not directory-only: ${item.inspection.reason}`,
            );
          }
        }
        for (const item of moved) {
          writeOverlayTombstone(item.candidate, item.label);
        }
        fsyncDirectory(this.root);
        for (const item of moved) {
          removeVerifiedDirectoryOnlySkeleton(item.destination, item.inspection);
          reconciledRoots += 1;
        }
        fs.rmdirSync(quarantine);
      } catch (error) {
        const rollbackFailures = [];
        for (const item of moved.reverse()) {
          try {
            if (!lstatIfPresent(item.destination)) continue;
            const current = lstatIfPresent(item.candidate);
            if (current) {
              if (isValidOverlayTombstone(item.candidate, item.label)) fs.unlinkSync(item.candidate);
              else throw new Error('original path was recreated');
            }
            fs.renameSync(item.destination, item.candidate);
          } catch (rollbackError) {
            rollbackFailures.push(`${item.label}: ${rollbackError.message}`);
          }
        }
        try { fs.rmdirSync(quarantine); } catch (_) {}
        if (rollbackFailures.length) {
          throw new Error(
            `${error.message}; post-build overlay rollback failed: ${rollbackFailures.join('; ')}`,
          );
        }
        throw error;
      }
    }
    const residual = this.inspectTransientState();
    throw new Error(
      `post-build overlay residue reappeared after ${maxPasses} passes (${residual.present.join(', ')}; ${residual.action})`,
    );
  }

  _discardOverlayTombstonesForOwnership() {
    const candidates = [
      ['lock', this.lockDir],
      ['staging', this.buildOut],
      ['previous', this.previousOut],
    ];
    const tombstones = candidates.filter(([label, candidate]) => (
      isValidOverlayTombstone(candidate, label)
    ));
    if (!tombstones.length) return false;
    this._requireEmptyOverlayAuthorization();
    fs.mkdirSync(this.quarantineRoot, {recursive: true, mode: 0o700});
    const quarantine = fs.mkdtempSync(
      path.join(this.quarantineRoot, '.ss-public-build-tombstones-'),
    );
    const moved = [];
    try {
      for (const [label, candidate] of tombstones) {
        const destination = path.join(quarantine, label);
        fs.renameSync(candidate, destination);
        if (!isValidOverlayTombstone(destination, label)) {
          throw new Error(`public-build ${label} overlay tombstone changed during quarantine`);
        }
        moved.push({label, candidate, destination});
      }
      for (const item of moved) fs.unlinkSync(item.destination);
      fs.rmdirSync(quarantine);
      return true;
    } catch (error) {
      const rollbackFailures = [];
      for (const item of moved.reverse()) {
        try {
          if (!lstatIfPresent(item.destination)) continue;
          if (lstatIfPresent(item.candidate)) throw new Error('original path was recreated');
          fs.renameSync(item.destination, item.candidate);
        } catch (rollbackError) {
          rollbackFailures.push(`${item.label}: ${rollbackError.message}`);
        }
      }
      try { fs.rmdirSync(quarantine); } catch (_) {}
      if (rollbackFailures.length) {
        throw new Error(`${error.message}; overlay tombstone rollback failed: ${rollbackFailures.join('; ')}`);
      }
      throw error;
    }
  }

  _quarantineRecoverablePair() {
    fs.mkdirSync(this.quarantineRoot, {recursive: true});
    const quarantine = fs.mkdtempSync(
      path.join(this.quarantineRoot, '.ss-public-build-abandoned-'),
    );
    const quarantinedLock = path.join(quarantine, 'lock');
    const quarantinedStage = path.join(quarantine, 'staging');
    fs.renameSync(this.lockDir, quarantinedLock);
    try {
      fs.renameSync(this.buildOut, quarantinedStage);
    } catch (error) {
      try {
        fs.renameSync(quarantinedLock, this.lockDir);
      } catch (rollbackError) {
        throw new Error(
          `public-build lock quarantine failed and rollback failed: ${error.message}; ${rollbackError.message}`,
        );
      }
      throw error;
    }
    return quarantine;
  }

  acquire() {
    if (this.owned) throw new Error('public-build lock is already owned by this instance');
    // Authorization is a per-acquisition fact. A lease proven live for a
    // completed build must never authorize a later ownership installation.
    this.emptyOverlayRecoveryAuthorized = false;
    this.stagingUnboundForCommit = false;
    const prepared = this._prepareClaim();
    let installed = false;
    let reclaimedLockQuarantine = null;
    const contentionCodes = new Set(['EEXIST', 'ENOTEMPTY', 'EPERM', 'EACCES']);
    const restoreReclaimedLock = () => {
      if (!reclaimedLockQuarantine || lstatIfPresent(this.lockDir)) return;
      const quarantinedLock = path.join(reclaimedLockQuarantine, 'lock');
      if (!lstatIfPresent(quarantinedLock)) return;
      try { fs.renameSync(quarantinedLock, this.lockDir); } catch (_) {}
    };
    try {
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const decision = this._inspectExisting();
        if (decision.action === 'reclaim-directory-overlay' || decision.action === 'reclaim-post-build-overlays') {
          this.reconcilePostBuildOverlayResidue();
          continue;
        }
        if (decision.action === 'reclaim-overlay-tombstones') {
          this._discardOverlayTombstonesForOwnership();
          continue;
        }
        if (decision.action === 'recover') {
          this._quarantineRecoverablePair();
          continue;
        }
        if (decision.action === 'recover-dead-owner-directory-overlay') {
          this._requireEmptyOverlayAuthorization();
          this._quarantineRecoverablePair();
          continue;
        }
        if (decision.action === 'reclaim-empty-overlay') {
          this._requireEmptyOverlayAuthorization();
          if (lstatIfPresent(this.lockDir)) {
            reclaimedLockQuarantine = this._quarantineEmptySkeletons([
              ['lock', this.lockDir],
            ], {retain: true});
            continue;
          }
        }
        if (decision.action !== 'retry' && decision.action !== 'reclaim-empty-overlay') {
          throw new Error(
            `PUBLIC DEPLOY BUILD FAILED — another or unverifiable build owns ${this.lockDir}: ${decision.reason}`,
          );
        }

        // Before publishing ownership, reject every static unowned transient
        // except a directory-only overlay skeleton. Repeat the classification
        // after install to close the inspection/install race.
        const stageBefore = inspectDirectorySkeleton(this.buildOut);
        const previousBefore = inspectDirectorySkeleton(this.previousOut);
        if (stageBefore.kind === 'unsafe' || previousBefore.kind === 'unsafe') {
          this.assertNoUnownedTransientState();
        }
        if (
          stageBefore.kind === 'empty-directory-skeleton'
          || previousBefore.kind === 'empty-directory-skeleton'
        ) {
          this._requireEmptyOverlayAuthorization();
        }

        try {
          // POSIX rename can replace an existing empty directory. Requiring
          // the live outer lease immediately before every atomic prepared-dir
          // install closes an empty-overlay inspect/install race without
          // exposing a partially populated ownership directory.
          this._requireEmptyOverlayAuthorization();
          this._installPreparedClaim(prepared);
        } catch (error) {
          if (contentionCodes.has(error.code) && lstatIfPresent(this.lockDir)) continue;
          throw error;
        }
        installed = true;
        try {
          fsyncDirectory(this.root);
        } catch (error) {
          this._cleanupInstalledClaim(prepared);
          installed = false;
          restoreReclaimedLock();
          throw error;
        }

        try {
          const stageAfter = inspectDirectorySkeleton(this.buildOut);
          const previousAfter = inspectDirectorySkeleton(this.previousOut);
          if (stageAfter.kind === 'unsafe' || previousAfter.kind === 'unsafe') {
            this.assertNoUnownedTransientState();
          }
          this._quarantineEmptySkeletons([
            ['staging', this.buildOut],
            ['previous', this.previousOut],
          ]);
          this.assertNoUnownedTransientState();
        } catch (error) {
          this._cleanupInstalledClaim(prepared);
          installed = false;
          restoreReclaimedLock();
          throw error;
        }
        const owner = this._publishInstalledClaim(prepared);
        this._discardRetainedEmptyQuarantine(reclaimedLockQuarantine);
        return owner;
      }
      throw new Error(`PUBLIC DEPLOY BUILD FAILED — could not acquire ${this.lockDir}`);
    } finally {
      if (!installed) this.emptyOverlayRecoveryAuthorized = false;
      if (!installed) this._cleanupPreparedClaim(prepared);
    }
  }

  bindStaging() {
    if (!this.owned || !this.owner || this.owner.token !== this.token) {
      throw new Error('public-build staging requires the current lock owner');
    }
    const stageStat = lstatIfPresent(this.buildOut);
    if (!stageStat || stageStat.isSymbolicLink() || !stageStat.isDirectory()) {
      throw new Error('public-build staging path must be a non-symlink directory');
    }
    const marker = {
      schema: STAGE_SCHEMA,
      token: this.owner.token,
      hostname: this.owner.hostname,
      pid: this.owner.pid,
      process_identity: this.owner.process_identity,
      created_epoch_ms: this.owner.created_epoch_ms,
    };
    fs.writeFileSync(this.stageMarkerPath, `${JSON.stringify(marker)}\n`, {
      flag: 'wx',
      mode: 0o600,
    });
    this.stagingUnboundForCommit = false;
  }

  unbindStaging() {
    if (!this.owned || !this.owner) throw new Error('public-build lock is not owned');
    const markerRecord = readRegularJson(this.stageMarkerPath, 'public-build stage marker');
    if (!markerMatchesOwner(markerRecord.value, this.owner)) {
      throw new Error('public-build stage marker changed before commit');
    }
    fs.unlinkSync(this.stageMarkerPath);
    this.stagingUnboundForCommit = true;
  }

  discardOwnedStaging() {
    const stageStat = lstatIfPresent(this.buildOut);
    if (!stageStat) return false;
    if (stageStat.isSymbolicLink() || !stageStat.isDirectory()) {
      throw new Error('owned staging path changed before cleanup');
    }
    if (!this.owned || !this.owner) throw new Error('public-build lock is not owned');
    if (this.stagingUnboundForCommit) {
      const inspection = inspectDirectoryOnlySkeleton(this.buildOut);
      if (inspection.kind !== 'directory-only-skeleton') {
        throw new Error('committed staging overlay contains non-directory state');
      }
      this._requireEmptyOverlayAuthorization();
      removeVerifiedDirectoryOnlySkeleton(this.buildOut, inspection);
      return true;
    }
    const markerRecord = readRegularJson(this.stageMarkerPath, 'public-build stage marker');
    if (!markerMatchesOwner(markerRecord.value, this.owner)) {
      throw new Error('public-build stage marker changed before cleanup');
    }
    fs.rmSync(this.buildOut, {recursive: true, force: false});
    return true;
  }

  release({bestEffort = false} = {}) {
    if (!this.owned) return;
    let completed = false;
    try {
      // A controlled failure after bindStaging must not leave a now-ownerless
      // tree that the next build is forbidden to guess about. Delete only a
      // staging tree carrying this exact cryptographic owner record.
      this.assertNoRollbackState();
      this.discardOwnedStaging();
      const lockStat = lstatIfPresent(this.lockDir);
      if (!lockStat || lockStat.isSymbolicLink() || !lockStat.isDirectory()) {
        throw new Error('public-build lock disappeared or changed before release');
      }
      const ownerRecord = readRegularJson(this.ownerPath, 'public-build lock owner');
      if (ownerRecord.value.token !== this.token) {
        throw new Error('public-build lock owner changed before release');
      }
      fs.unlinkSync(this.ownerPath);
      fs.rmdirSync(this.lockDir);
      const residual = this.inspectTransientState();
      if (residual.present.length) {
        throw new Error(
          `public-build release left transient state (${residual.present.join(', ')}; ${residual.action})`,
        );
      }
      completed = true;
    } catch (error) {
      // Process-exit cleanup is deliberately best-effort and fail-closed: a
      // changed or unverifiable tree remains for inspection. Explicit release
      // is strict so the builder cannot print PASS after cleanup failed.
      if (!bestEffort) throw error;
    } finally {
      if (completed || bestEffort) {
        process.removeListener('exit', this.exitHandler);
        this.owned = false;
        this.owner = null;
        this.token = null;
        this.stagingUnboundForCommit = false;
        this.emptyOverlayRecoveryAuthorized = false;
      }
    }
  }
}

module.exports = {
  CLOCK_FUTURE_TOLERANCE_MS,
  LINUX_IDENTITY_SCHEMA,
  LOCK_DIRECTORY_NAME,
  LOCK_SCHEMA,
  OWNER_FILE_NAME,
  OVERLAY_TOMBSTONE_SCHEMA,
  PublicBuildLock,
  RECOVERY_MIN_AGE_MS,
  STAGE_MARKER_NAME,
  STAGE_SCHEMA,
  UNAVAILABLE_IDENTITY_SCHEMA,
  inspectRecordedProcess,
  isValidOverlayTombstone,
  readCurrentProcessIdentity,
};
