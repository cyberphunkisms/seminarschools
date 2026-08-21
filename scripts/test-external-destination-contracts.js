#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { assertDestination, polymythcalDestination, polymythCommonsDestination, teacherResourceDestination } = require('./lib/external-destination-contracts');

const invalid = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'futureproofing', 'external-destinations', 'invalid-destinations.json'), 'utf8'));

assert.equal(polymythcalDestination({ source_url: 'https://organizer.example/e', source_quality: 'official' }).status, 'official-organizer');
assert.equal(polymythcalDestination({ source_url: 'javascript:alert(1)', source_quality: 'official' }).status, 'unavailable');
assert.equal(polymythCommonsDestination({ verified: 'yes', currentCanonicalUrl: 'https://current.example/', currentStatusGroup: 'ACTIVE', bookPrintedUrls: ['https://old.example/'] }).href, 'https://current.example/');
assert.equal(polymythCommonsDestination({ verified: '', currentCanonicalUrl: '', bookPrintedUrls: ['https://old.example/'] }).status, 'book-listed-site');
assert.equal(teacherResourceDestination({ url: '/unknown/' }, ['/approved/']).status, 'unavailable');
assert.equal(teacherResourceDestination({ url: '/approved/' }, ['/approved/']).status, 'seminar-schools-original');
assert.equal(polymythcalDestination(invalid.polymythcal).status, 'unavailable');
assert.equal(teacherResourceDestination(invalid.teacher, []).status, 'unavailable');
assert.throws(() => assertDestination({ status: 'unavailable', href: 'https://bad.example/' }, 'fixture'), /must not have/);
console.log('EXTERNAL DESTINATION CONTRACT TESTS PASS — precedence, schemes, internal allowlist, and status/href failures covered.');
