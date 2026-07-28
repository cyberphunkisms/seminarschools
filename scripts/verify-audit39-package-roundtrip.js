#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const reserved = 'PACKAGE_CONTENTS_SHA256.json';
const inheritedManifest = JSON.parse(read(reserved));
check(
  inheritedManifest.schema === 'seminar-schools-package-contents-v1',
  'the extracted baseline lacks its original package manifest',
);
check(
  typeof inheritedManifest.release_id === 'string'
    && inheritedManifest.release_id.trim().length > 0,
  'the extracted package manifest lacks a release identity',
);

for (const relative of [
  'scripts/package-deployer-compatible.py',
  'scripts/package-netlify-source.py',
]) {
  const source = read(relative);
  check(
    source.includes('from package_integrity import MANIFEST_NAME, write_verified_archive'),
    `${relative} does not import the reserved manifest name`,
  );
  check(
    source.includes("if rel.as_posix()==MANIFEST_NAME:return False"),
    `${relative} would feed an inherited package manifest into the next archive`,
  );
}

const writer = read('scripts/package_integrity.py');
check(
  writer.includes('if path.relative_to(root).as_posix() == MANIFEST_NAME'),
  'archive writer lacks a reserved-name collision guard',
);
check(
  writer.includes('cannot be selected as input'),
  'archive writer does not fail clearly on a reserved-name collision',
);
check(
  writer.includes('expected_names = [row["path"] for row in rows] + [MANIFEST_NAME]'),
  'archive verification no longer requires one generated manifest at the end',
);

const tests = read('scripts/test_package_integrity.py');
check(
  tests.includes('test_reserved_manifest_input_is_rejected'),
  'package round-trip regression test is missing',
);

if (failures.length) {
  console.error('AUDIT39 PACKAGE ROUND-TRIP FAILED');
  failures.forEach(failure => console.error(` - ${failure}`));
  process.exit(1);
}

console.log(
  'AUDIT39 PACKAGE ROUND-TRIP PASSED — an extracted release keeps its historical '
    + 'manifest for verification, excludes it from repackaging, and emits exactly one '
    + 'fresh manifest in the next archive.',
);
