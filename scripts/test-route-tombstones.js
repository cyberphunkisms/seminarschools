#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { assertNoExactCycles, isRedirectFallback, parseRedirects } = require('./lib/route-tombstones');

const FIXTURES = path.join(__dirname, 'fixtures', 'futureproofing', 'route-tombstones');
assert.equal(parseRedirects('/old /new 301\n# comment\n').length, 1);
assert.doesNotThrow(() => assertNoExactCycles([{ from: '/old', to: '/new' }, { from: '/new', to: '/current' }]));
assert.throws(() => assertNoExactCycles([{ from: '/a', to: '/b' }, { from: '/b', to: '/a' }]), /cycle/);
assert.equal(isRedirectFallback(fs.readFileSync(path.join(FIXTURES, 'redirect-fallback.html'), 'utf8')), true);
assert.equal(isRedirectFallback(fs.readFileSync(path.join(FIXTURES, 'live-route-reuse.html'), 'utf8')), false);
console.log('ROUTE TOMBSTONE TESTS PASS — missing redirect semantics, route reuse, and cycles are detectable.');
