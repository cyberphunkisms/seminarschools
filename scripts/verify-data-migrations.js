#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { assertCurrentDatasetVersion, builtInMigrations, loadContracts, migrateWithContract } = require('./lib/versioned-data-migrations');

const ROOT = path.resolve(__dirname, '..');

function verify() {
  const registry = loadContracts();
  if (registry.schemaVersion !== '1.0.0') throw new Error('versioned data registry must use schemaVersion 1.0.0');
  for (const [name, contract] of Object.entries(registry.datasets)) {
    const document = JSON.parse(fs.readFileSync(path.join(ROOT, contract.source), 'utf8'));
    assertCurrentDatasetVersion(name, document, registry);
    for (const step of contract.migrations || []) {
      if (!builtInMigrations[step.id]) throw new Error(`${name}: migration ${step.id} has no implementation`);
    }
  }
  const teacherContract = registry.datasets['teacher-resources'];
  const currentTeacher = JSON.parse(fs.readFileSync(path.join(ROOT, teacherContract.source), 'utf8'));
  const legacyTeacher = { ...currentTeacher };
  delete legacyTeacher[teacherContract.versionField];
  const migrated = migrateWithContract(legacyTeacher, teacherContract);
  assertCurrentDatasetVersion('teacher-resources', migrated, registry);
  return { datasets: Object.keys(registry.datasets).length, productionMigrations: Object.values(registry.datasets).flatMap((dataset) => dataset.migrations || []).length };
}

if (require.main === module) {
  try {
    const result = verify();
    console.log(`VERSIONED DATA MIGRATIONS PASS — ${result.datasets} datasets pinned; ${result.productionMigrations} production migration path exercised.`);
  } catch (error) {
    console.error(`VERSIONED DATA MIGRATIONS FAIL\n${error.message}`);
    process.exit(1);
  }
}

module.exports = { verify };
