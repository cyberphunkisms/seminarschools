#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const tiers = require('./lib/browser-test-tiers.js');
const ROOT = path.resolve(__dirname, '..');
const contract = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/browser-test-tiers.json'), 'utf8'));
const invalidContract = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/fixtures/futureproofing/browser-tiers/invalid-contract.json'), 'utf8'));
const pages = tiers.inventory(path.join(ROOT, contract.public_root), contract.exact_exceptions);
const families = tiers.familyRepresentatives(pages);

assert(pages.length > 3700, 'full tier inventory unexpectedly small');
assert(families.length >= 45, 'family tier inventory unexpectedly small');
assert.strictEqual(new Set(families.map(page => page.routeType)).size, families.length, 'family representatives are not unique by route type');
assert(!pages.some(page => contract.exact_exceptions.includes(page.relative)), 'exact token exception entered browser inventory');

const home = tiers.selectPages({ tier: 'changed', pages, changedFiles: ['public/index.html'] });
assert.deepStrictEqual(home.map(page => page.route), ['/'], 'changed page did not map directly');
const shared = tiers.selectPages({ tier: 'changed', pages, changedFiles: ['css/site-wide-type-zoom.css'] });
assert.strictEqual(shared.length, families.length, 'shared CSS change did not expand to family matrix');
const shards = Array.from({ length: 7 }, (_, shardIndex) => tiers.selectPages({ tier: 'full', pages, shardIndex, shardCount: 7 }));
assert.strictEqual(shards.flat().length, pages.length, 'full shards do not cover inventory');
assert.strictEqual(new Set(shards.flat().map(page => page.relative)).size, pages.length, 'full shards overlap');
assert.notStrictEqual(invalidContract.tiers.changed.selection, 'changed-pages-with-family-expansion', 'invalid fixture unexpectedly preserves changed-page expansion');
assert.notStrictEqual(invalidContract.tiers.family.selection, 'every-route-type', 'invalid fixture unexpectedly preserves family coverage');
assert.notStrictEqual(invalidContract.tiers.full.selection, 'every-renderable-page', 'invalid fixture unexpectedly preserves full inventory');
assert.notStrictEqual(invalidContract.tiers.full.full_page, true, 'invalid fixture unexpectedly preserves full-page rendering');

console.log(`FP-08 BROWSER TIER SELECTION PASSED — ${pages.length} pages, ${families.length} route families, direct/shared change routing, complete non-overlapping shards.`);
