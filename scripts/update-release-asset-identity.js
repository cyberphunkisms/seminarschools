#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const util = require('util');
const {
  computeReleaseAssetIdentity,
  pickReleaseAssetIdentity,
} = require('./lib/release-asset-identity');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(ROOT, 'RELEASE_MANIFEST.json');
const args = new Set(process.argv.slice(2));

for (const arg of args) {
  if (arg !== '--check' && arg !== '--print') {
    console.error(`UPDATE RELEASE ASSET IDENTITY FAILED — unknown argument: ${arg}`);
    process.exit(2);
  }
}

function loadManifest() {
  try {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  } catch (error) {
    throw new Error(`cannot read ${path.relative(ROOT, MANIFEST_PATH)}: ${error.message}`);
  }
}

function writeAtomic(file, content) {
  const temporary = `${file}.tmp-${process.pid}`;
  const priorMtime = fs.existsSync(file) ? fs.statSync(file).mtimeMs : 0;
  const requestedMtime = process.env.SS_BUILD_OUTPUT_MTIME
    ? Date.parse(process.env.SS_BUILD_OUTPUT_MTIME) : 0;
  if (!Number.isFinite(requestedMtime)) throw new Error('SS_BUILD_OUTPUT_MTIME must be a valid timestamp');
  try {
    fs.writeFileSync(temporary, content, 'utf8');
    const stamp = Math.max(requestedMtime, priorMtime > Date.now() + 60000 ? priorMtime + 2000 : 0);
    if (stamp) fs.utimesSync(temporary, stamp / 1000, stamp / 1000);
    fs.renameSync(temporary, file);
  } finally {
    try { fs.rmSync(temporary, { force: true }); } catch (_) { /* best effort */ }
  }
}

try {
  const manifest = loadManifest();
  const expected = computeReleaseAssetIdentity(ROOT);

  if (args.has('--print')) {
    process.stdout.write(`${JSON.stringify(expected, null, 2)}\n`);
    process.exit(0);
  }

  const current = pickReleaseAssetIdentity(manifest);
  if (args.has('--check')) {
    if (!util.isDeepStrictEqual(current, expected)) {
      console.error('RELEASE ASSET IDENTITY CHECK FAILED — RELEASE_MANIFEST.json is stale; run node scripts/update-release-asset-identity.js');
      process.exit(1);
    }
    console.log('RELEASE ASSET IDENTITY CHECK PASSED');
    process.exit(0);
  }

  const updated = {
    ...manifest,
    ...expected,
  };
  const rendered = `${JSON.stringify(updated, null, 2)}\n`;
  const existing = fs.readFileSync(MANIFEST_PATH, 'utf8');
  if (existing !== rendered) writeAtomic(MANIFEST_PATH, rendered);
  console.log('RELEASE ASSET IDENTITY UPDATED');
} catch (error) {
  console.error(`UPDATE RELEASE ASSET IDENTITY FAILED — ${error.message}`);
  process.exit(1);
}
