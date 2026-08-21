#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const util = require('util');
const {
  RELEASE_ASSET_PATHS,
  PUBLIC_RELEASE_ASSET_PATHS,
  RELEASE_IDENTITY_FIELDS,
  computeReleaseAssetIdentity,
  sha256Hex,
} = require('./lib/release-asset-identity');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC_ROOT = path.join(ROOT, 'public');
const failures = [];

function readJson(file, label) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    failures.push(`${label} cannot be read as JSON: ${error.message}`);
    return null;
  }
}

function rendered(value) {
  return JSON.stringify(value);
}

function compareIdentity(actualContainer, expected, label) {
  for (const field of RELEASE_IDENTITY_FIELDS) {
    const actual = actualContainer && actualContainer[field];
    if (!util.isDeepStrictEqual(actual, expected[field])) {
      failures.push(
        `${label} ${field} mismatch: expected ${rendered(expected[field])}; received ${rendered(actual)}`,
      );
    }
  }
}

let expected = null;
try {
  expected = computeReleaseAssetIdentity(ROOT);
} catch (error) {
  failures.push(`source asset identity cannot be computed: ${error.message}`);
}

const manifest = readJson(path.join(ROOT, 'RELEASE_MANIFEST.json'), 'RELEASE_MANIFEST.json');
if (expected && manifest) compareIdentity(manifest, expected, 'RELEASE_MANIFEST.json');

if (!fs.existsSync(PUBLIC_ROOT)) {
  failures.push('public deploy tree is missing');
} else {
  if (!fs.statSync(PUBLIC_ROOT).isDirectory()) {
    failures.push('public exists but is not a directory');
  } else if (expected) {
    for (const relative of RELEASE_ASSET_PATHS) {
      const publicRelative = PUBLIC_RELEASE_ASSET_PATHS[relative];
      if (publicRelative === null) continue;
      const publicFile = path.join(PUBLIC_ROOT, publicRelative);
      if (!fs.existsSync(publicFile)) {
        failures.push(`public mirror is missing for ${relative}: public/${publicRelative}`);
        continue;
      }
      let digest;
      try {
        digest = sha256Hex(publicFile);
      } catch (error) {
        failures.push(`public mirror cannot be hashed for ${relative}: public/${publicRelative}: ${error.message}`);
        continue;
      }
      if (digest !== expected.asset_digests[relative]) {
        failures.push(
          `public mirror differs from source: ${relative} -> public/${publicRelative} has ${digest}; expected ${expected.asset_digests[relative]}`,
        );
      }
    }

    const publicRelease = readJson(path.join(PUBLIC_ROOT, 'site-release.json'), 'public/site-release.json');
    if (publicRelease) compareIdentity(publicRelease, expected, 'public/site-release.json');
  }
}

if (failures.length) {
  console.error(`RELEASE ASSET IDENTITY FAILED (${failures.length})`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

const publicMirrorCount = Object.values(PUBLIC_RELEASE_ASSET_PATHS).filter(Boolean).length;
console.log(`RELEASE ASSET IDENTITY PASSED — ${RELEASE_ASSET_PATHS.length} bound source assets and ${publicMirrorCount} public runtime mirrors`);
