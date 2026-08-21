'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const CONTRACT_PATH = path.join(ROOT, 'data', 'versioned-data-contracts.json');

function loadContracts() {
  return JSON.parse(fs.readFileSync(CONTRACT_PATH, 'utf8'));
}

function validVersion(value) {
  return value === 'unversioned' || /^\d+\.\d+\.\d+$/.test(String(value));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function recordsFor(document, shape) {
  if (shape === 'events') return document.events || [];
  if (shape === 'projects') return document.projects || [];
  if (shape === 'teacher-entries') return (document.groups || []).flatMap((group) => (group.categories || []).flatMap((category) => category.entries || []));
  throw new Error(`Unsupported recordShape ${shape}`);
}

function stableIds(document, shape) {
  return recordsFor(document, shape).map((record) => String(record.id || '')).sort();
}

function assertStableIdentity(before, after, shape, context) {
  const previous = stableIds(before, shape);
  const next = stableIds(after, shape);
  if (previous.some((id) => !id) || next.some((id) => !id)) throw new Error(`${context}: every migrated record needs a stable id`);
  if (new Set(previous).size !== previous.length || new Set(next).size !== next.length) throw new Error(`${context}: duplicate stable ids detected`);
  if (JSON.stringify(previous) !== JSON.stringify(next)) throw new Error(`${context}: migration changed record identity or count`);
}

const builtInMigrations = {
  'teacher-resources-unversioned-to-1.0.0': (document) => ({ ...document, schemaVersion: '1.0.0' }),
};

function migrateWithContract(document, contract, migrationFunctions = builtInMigrations) {
  if (!document || typeof document !== 'object' || Array.isArray(document)) throw new Error('dataset must be an object');
  if (!validVersion(contract.currentVersion)) throw new Error(`invalid current version ${contract.currentVersion}`);
  let result = clone(document);
  let version = result[contract.versionField] || 'unversioned';
  if (!validVersion(version)) throw new Error(`invalid dataset version ${version}`);
  const visited = new Set();
  while (version !== contract.currentVersion) {
    if (visited.has(version)) throw new Error(`migration cycle at ${version}`);
    visited.add(version);
    const step = (contract.migrations || []).find((candidate) => candidate.from === version);
    if (!step) throw new Error(`no migration path from ${version} to ${contract.currentVersion}`);
    if (!validVersion(step.to) || !migrationFunctions[step.id]) throw new Error(`migration ${step.id} is not implemented`);
    const before = clone(result);
    result = migrationFunctions[step.id](clone(result));
    if (!result || result[contract.versionField] !== step.to) throw new Error(`migration ${step.id} must set ${contract.versionField}=${step.to}`);
    assertStableIdentity(before, result, contract.recordShape, step.id);
    version = step.to;
  }
  return result;
}

function datasetContract(name, registry = loadContracts()) {
  const contract = registry.datasets && registry.datasets[name];
  if (!contract) throw new Error(`unknown versioned dataset ${name}`);
  return contract;
}

function assertCurrentDatasetVersion(name, document, registry = loadContracts()) {
  const contract = datasetContract(name, registry);
  const actual = document && document[contract.versionField];
  if (actual !== contract.currentVersion) throw new Error(`${name}: expected ${contract.versionField} ${contract.currentVersion}, found ${actual || 'unversioned'}; run the registered migration before building`);
  const ids = stableIds(document, contract.recordShape);
  if (ids.some((id) => !id) || new Set(ids).size !== ids.length) throw new Error(`${name}: stable record ids are missing or duplicated`);
  return contract.currentVersion;
}

function currentVersion(name, registry = loadContracts()) {
  return datasetContract(name, registry).currentVersion;
}

module.exports = {
  assertCurrentDatasetVersion,
  assertStableIdentity,
  builtInMigrations,
  currentVersion,
  datasetContract,
  loadContracts,
  migrateWithContract,
  recordsFor,
  stableIds,
  validVersion,
};
