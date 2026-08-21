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
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PRUNED_DIRECTORIES = new Set([
  '.git', '.netlify', 'node_modules', '__pycache__', '.pytest_cache',
  '.mypy_cache', '.ruff_cache', '.tox', '.nox', 'htmlcov',
  '.public-build-staging', '.public-build-previous', '.public-build-lock',
]);
// These two reports are intentionally self-referential release evidence. FP-02
// validates their schemas and writers with versioned policy tokens, and the
// final archive receipt binds their exact shipped bytes. All other durable
// generated output remains inside this immediate fixed-point comparison.
const SELF_UPDATING_GENERATED_EVIDENCE = new Set([
  'scripts/reports/audit49-build-packaging-efficiency.json',
  'scripts/reports/release-gate-report.json',
]);

function shouldSkipFile(name) {
  return name.endsWith('.pyc')
    || name.endsWith('.log')
    || /^\.public-build-/.test(name)
    || /\.lock-\d+$/.test(name)
    || /\.part-\d+$/.test(name);
}

function digest(file) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(file));
  return hash.digest('hex');
}

function snapshot(directory = ROOT) {
  const rows = new Map();
  function walk(current) {
    const entries = fs.readdirSync(current, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!PRUNED_DIRECTORIES.has(entry.name)) walk(absolute);
      } else if (entry.isFile() && !shouldSkipFile(entry.name)) {
        const relative = path.relative(ROOT, absolute).replace(/\\/g, '/');
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

const before = snapshot();
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const result = spawnSync(npm, ['run', 'build'], {
  cwd: ROOT,
  env: { ...process.env, SS_IDEMPOTENCE_PROBE: '1' },
  encoding: 'utf8',
  timeout: 10 * 60 * 1000,
  maxBuffer: 16 * 1024 * 1024,
});
if (result.error || result.status !== 0) {
  console.error('BUILD IDEMPOTENCE CHECK FAILED — probe build did not complete.');
  if (result.error) console.error(result.error.message);
  if (result.stdout) console.error(result.stdout.slice(-12000));
  if (result.stderr) console.error(result.stderr.slice(-12000));
  process.exit(1);
}

const after = snapshot();
const changed = compare(before, after);
if (changed.length) {
  console.error('BUILD IDEMPOTENCE CHECK FAILED — ' + changed.length + ' durable paths changed on the immediate rebuild.');
  changed.slice(0, 100).forEach(item => console.error(' - ' + item));
  if (changed.length > 100) console.error(' - … ' + (changed.length - 100) + ' additional paths');
  process.exit(1);
}

console.log(
  'BUILD IDEMPOTENCE CHECK PASSED — immediate canonical rebuild left '
  + before.size + ' durable files byte-identical.'
);
