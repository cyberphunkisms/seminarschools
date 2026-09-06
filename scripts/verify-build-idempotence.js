#!/usr/bin/env node
'use strict';

/**
 * Release gate: a canonical build must be a content fixed point.
 *
 * The normal full runner has already completed one canonical build before this
 * gate runs. We hash the complete durable tree, build once more, and require
 * the second build to leave every durable byte and file path unchanged.
 */
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const {PublicBuildLock} = require('./lib/public-build-lock');

const ROOT = path.resolve(__dirname, '..');
const PRUNED_DIRECTORIES = new Set([
  '.git', '.netlify', 'node_modules', '__pycache__', '.pytest_cache',
  '.mypy_cache', '.ruff_cache', '.tox', '.nox', 'htmlcov',
  '.seminar-schools-build.lock',
]);
const PUBLIC_BUILD_TRANSIENT_LABELS = new Map([
  ['.public-build-staging', 'staging'],
  ['.public-build-previous', 'previous'],
  ['.public-build-lock', 'lock'],
]);
const PUBLIC_BUILD_TRANSIENT_NAMES = new Map(
  [...PUBLIC_BUILD_TRANSIENT_LABELS].map(([name, label]) => [label, name]),
);
// These two reports are intentionally self-referential release evidence. FP-02
// validates their schemas and writers with versioned policy tokens, and the
// final archive receipt binds their exact shipped bytes. All other durable
// generated output remains inside this immediate fixed-point comparison.
const SELF_UPDATING_GENERATED_EVIDENCE = new Set([
  'scripts/reports/audit49-build-packaging-efficiency.json',
  'scripts/reports/release-gate-report.json',
]);

function shouldSkipFile(name) {
  return name === '.seminar-schools-build.lease'
    || name.endsWith('.pyc')
    || name.endsWith('.log')
    || /\.lock-\d+$/.test(name)
    || /\.part-\d+$/.test(name);
}

function assertNoPublicBuildTransients(root, context) {
  const state = new PublicBuildLock({
    root,
    buildOut: path.join(root, '.public-build-staging'),
    previousOut: path.join(root, '.public-build-previous'),
  }).inspectTransientState();
  const recognized = new Set([...state.tombstones, ...state.directory_overlays]);
  const acceptable = state.present.length === 0
    ? state.action === 'retry'
    : state.present.length === recognized.size
      && state.present.every(label => recognized.has(label))
      && [
        'reclaim-overlay-tombstones',
        'reclaim-directory-overlay',
        'reclaim-post-build-overlays',
      ].includes(state.action);
  if (!acceptable) {
    throw new Error(
      `BUILD IDEMPOTENCE CHECK FAILED — ${context} contains unverifiable public-build transient state: ${state.present.join(', ')} (${state.action})`,
    );
  }
  return new Set([...recognized].map(label => PUBLIC_BUILD_TRANSIENT_NAMES.get(label)));
}

function digest(file) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(file));
  return hash.digest('hex');
}

function snapshot(directory = ROOT, ignoredTopLevel = new Set()) {
  const rows = new Map();
  function walk(current) {
    const entries = fs.readdirSync(current, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const absolute = path.join(current, entry.name);
      if (current === directory && ignoredTopLevel.has(entry.name)) continue;
      const relative = path.relative(directory, absolute).replace(/\\/g, '/');
      if (entry.isDirectory()) {
        if (!PRUNED_DIRECTORIES.has(entry.name)) walk(absolute);
      } else if (entry.isFile() && !shouldSkipFile(entry.name)) {
        if (SELF_UPDATING_GENERATED_EVIDENCE.has(relative)) continue;
        rows.set(relative, String(fs.statSync(absolute).size) + ':' + digest(absolute));
      }
    }
  }
  walk(directory);
  return rows;
}

function compare(before, after) {
  const changed = [];
  const names = [...new Set([...before.keys(), ...after.keys()])].sort();
  for (const name of names) {
    if (!before.has(name)) changed.push('ADDED ' + name);
    else if (!after.has(name)) changed.push('REMOVED ' + name);
    else if (before.get(name) !== after.get(name)) changed.push('CHANGED ' + name);
  }
  return changed;
}

function copyProbeSource(destination, ignoredTopLevel) {
  fs.cpSync(ROOT, destination, {
    recursive: true,
    dereference: false,
    preserveTimestamps: true,
    mode: fs.constants.COPYFILE_FICLONE,
    filter(source) {
      const relative = path.relative(ROOT, source);
      if (!relative) return true;
      const parts = relative.split(path.sep);
      if (parts.length === 1 && ignoredTopLevel.has(parts[0])) return false;
      if (parts.some(part => PRUNED_DIRECTORIES.has(part))) return false;
      const stat = fs.lstatSync(source);
      if (stat.isSymbolicLink()) return false;
      if (stat.isDirectory()) return true;
      if (!stat.isFile() || shouldSkipFile(path.basename(source))) return false;
      const name = path.basename(source);
      return name !== '.env'
        && (!name.startsWith('.env.') || name.endsWith('.example'));
    },
  });

  // The fixed-point probe is about generated repository bytes, not dependency
  // installation. Reflink/copy the already pinned dependency tree separately:
  // a directory link would let a faulty lifecycle hook mutate the canonical
  // dependencies while both durable snapshots deliberately exclude them.
  const dependencyRoot = path.join(ROOT, 'node_modules');
  const dependencyStat = fs.lstatSync(dependencyRoot);
  if (dependencyStat.isSymbolicLink() || !dependencyStat.isDirectory()) {
    throw new Error('BUILD IDEMPOTENCE CHECK FAILED — audited node_modules is unavailable.');
  }
  fs.cpSync(
    dependencyRoot,
    path.join(destination, 'node_modules'),
    {
      recursive: true,
      dereference: false,
      preserveTimestamps: true,
      verbatimSymlinks: true,
      mode: fs.constants.COPYFILE_FICLONE,
    },
  );
}

function formatChanges(prefix, changed) {
  const lines = [`${prefix}${changed.length} durable paths changed.`];
  changed.slice(0, 100).forEach(item => lines.push(' - ' + item));
  if (changed.length > 100) lines.push(' - … ' + (changed.length - 100) + ' additional paths');
  return lines.join('\n');
}

function main() {
  const canonicalBeforeTransients = assertNoPublicBuildTransients(
    ROOT,
    'canonical source before probe',
  );
  const canonicalBefore = snapshot(ROOT, canonicalBeforeTransients);
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ss-build-idempotence-'));
  const probeRoot = path.join(temporaryRoot, 'repo');
  try {
    copyProbeSource(probeRoot, canonicalBeforeTransients);
    const probeBeforeTransients = assertNoPublicBuildTransients(
      probeRoot,
      'isolated probe before build',
    );
    const before = snapshot(probeRoot, probeBeforeTransients);
    const copyDrift = compare(canonicalBefore, before);
    if (copyDrift.length) {
      throw new Error(formatChanges(
        'BUILD IDEMPOTENCE CHECK FAILED — isolated probe copy drifted: ',
        copyDrift,
      ));
    }

    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const result = spawnSync(npm, ['run', 'build'], {
      cwd: probeRoot,
      env: { ...process.env, SS_IDEMPOTENCE_PROBE: '1' },
      encoding: 'utf8',
      timeout: 10 * 60 * 1000,
      maxBuffer: 16 * 1024 * 1024,
    });
    if (result.error || result.status !== 0) {
      const details = ['BUILD IDEMPOTENCE CHECK FAILED — isolated probe build did not complete.'];
      if (result.error) details.push(result.error.message);
      if (result.stdout) details.push(result.stdout.slice(-12000));
      if (result.stderr) details.push(result.stderr.slice(-12000));
      throw new Error(details.join('\n'));
    }

    const probeAfterTransients = assertNoPublicBuildTransients(
      probeRoot,
      'isolated probe after build',
    );
    const after = snapshot(probeRoot, probeAfterTransients);
    const changed = compare(before, after);
    if (changed.length) {
      throw new Error(formatChanges(
        'BUILD IDEMPOTENCE CHECK FAILED — isolated immediate rebuild changed ',
        changed,
      ));
    }

    const canonicalAfterTransients = assertNoPublicBuildTransients(
      ROOT,
      'canonical source after probe',
    );
    const canonicalAfter = snapshot(ROOT, canonicalAfterTransients);
    const rootDrift = compare(canonicalBefore, canonicalAfter);
    if (rootDrift.length) {
      throw new Error(formatChanges(
        'BUILD IDEMPOTENCE CHECK FAILED — probe mutated the canonical root: ',
        rootDrift,
      ));
    }

    console.log(
      'BUILD IDEMPOTENCE CHECK PASSED — isolated immediate canonical rebuild left '
      + before.size + ' durable files byte-identical and the canonical root untouched.'
    );
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

try {
  main();
} catch (error) {
  console.error(error && error.message ? error.message : error);
  process.exitCode = 1;
}
