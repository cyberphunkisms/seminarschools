#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { assertStableIdentity, migrateWithContract } = require('./lib/versioned-data-migrations');

const FIXTURES = path.join(__dirname, 'fixtures', 'futureproofing', 'data-migrations');
const contract = { versionField: 'schemaVersion', currentVersion: '2.0.0', recordShape: 'projects', migrations: [{ id: 'fixture-1-to-2', from: '1.0.0', to: '2.0.0' }] };
const source = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'identity-loss.json'), 'utf8'));
const migrated = migrateWithContract(source, contract, { 'fixture-1-to-2': (document) => ({ ...document, schemaVersion: '2.0.0' }) });
assert.equal(migrated.schemaVersion, '2.0.0');
assert.equal(source.schemaVersion, '1.0.0', 'migrations must not mutate their input');
assert.throws(() => migrateWithContract(source, contract, { 'fixture-1-to-2': (document) => ({ ...document, schemaVersion: '2.0.0', projects: document.projects.slice(1) }) }), /identity or count/);
const future = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'future-version.json'), 'utf8'));
assert.throws(() => migrateWithContract(future, contract, {}), /no migration path/);
assert.throws(() => assertStableIdentity(source, { ...source, projects: [{ id: 'FIX-1' }] }, 'projects', 'fixture'), /identity or count/);
console.log('VERSIONED DATA MIGRATION TESTS PASS — immutability, missing/future paths, and identity loss are rejected.');
