#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  frontFacingDocumentDefects,
  geometryDocumentDefects,
  preservationDefects,
  sourceFirstPairDefects,
  wrappingStylesheetDefects,
} = require('./lib/futureproofing-contract-checks');

const FIXTURES = path.join(__dirname, 'fixtures', 'futureproofing');
const read = name => fs.readFileSync(path.join(FIXTURES, name), 'utf8');

const geometry = geometryDocumentDefects(read('geometry-missing-indra.html'));
assert(geometry.includes('geometry-asset-count:/js/indra.js:0'));
assert(geometry.includes('geometry-asset-version:/js/indra.js'));
assert(geometry.includes('geometry-script-order'));

const frontFacing = frontFacingDocumentDefects(read('front-facing-internal-copy.html'));
assert(frontFacing.some(item => item.startsWith('front-facing-internal-copy:Selected evidence')));
assert(frontFacing.some(item => item.startsWith('front-facing-internal-copy:How the work was done')));

const wrapping = wrappingStylesheetDefects(read('wrapping-break-all.css'));
assert(wrapping.includes('wrapping-natural-word-break'));
assert(wrapping.includes('wrapping-anywhere-without-technical-scope'));

const sourceFixture = JSON.parse(read('source-link-internal-primary.json'));
const sourceLinks = sourceFirstPairDefects(sourceFixture.pairs);
assert(sourceLinks.includes('source-link-primary:0'));
assert(sourceLinks.includes('source-link-not-distinct:0'));

const preservationFixture = JSON.parse(read('preservation-tampered.json'));
const preservation = preservationDefects(
  preservationFixture.files,
  rel => {
    assert.strictEqual(rel, 'accepted.txt');
    return Buffer.from(preservationFixture.fixture_bytes);
  },
);
assert(preservation.includes('preservation-size:accepted.txt'));
assert(preservation.includes('preservation-sha256:accepted.txt'));

const typeFloor = fs.readFileSync(path.join(__dirname, 'apply-type-floor.js'), 'utf8');
assert(
  /const SKIP=new Set\(\[[^\]]*['"]fixtures['"][^\]]*\]\)/.test(typeFloor),
  'production typography postprocessor must not repair deliberate failure fixtures',
);

console.log(
  'FP-07 GATE-THE-GATES PASSED — deliberate geometry, front-facing, wrapping, '
    + 'source-link, and preservation defects were all rejected by shared production checks.',
);
