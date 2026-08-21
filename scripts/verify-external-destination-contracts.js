#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  assertDestination,
  polymythcalDestination,
  polymythCommonsDestination,
  teacherResourceDestination,
} = require('./lib/external-destination-contracts');

const ROOT = path.resolve(__dirname, '..');
const contract = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'external-destination-contracts.json'), 'utf8'));

function count(values) {
  return values.reduce((map, value) => ({ ...map, [value]: (map[value] || 0) + 1 }), {});
}
function sameCounts(actual, expected, name) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${name}: status counts changed: ${JSON.stringify(actual)}`);
}
function verify() {
  const cal = JSON.parse(fs.readFileSync(path.join(ROOT, contract.datasets.polymythcal.source), 'utf8')).events;
  const commons = JSON.parse(fs.readFileSync(path.join(ROOT, contract.datasets['polymyth-commons'].source), 'utf8')).projects;
  const teacherDoc = JSON.parse(fs.readFileSync(path.join(ROOT, contract.datasets['teacher-resources'].source), 'utf8'));
  const teacher = teacherDoc.groups.flatMap((group) => group.categories.flatMap((category) => category.entries));
  const teacherAllowed = contract.datasets['teacher-resources'].allowedInternalOriginals;
  const sets = [
    ['polymythcal', cal, (record) => polymythcalDestination(record)],
    ['polymyth-commons', commons, (record) => polymythCommonsDestination(record)],
    ['teacher-resources', teacher, (record) => teacherResourceDestination(record, teacherAllowed)],
  ];
  const report = {};
  for (const [name, records, resolver] of sets) {
    const expected = contract.datasets[name];
    if (records.length !== expected.recordCount) throw new Error(`${name}: expected ${expected.recordCount} records, found ${records.length}`);
    const statuses = records.map((record, index) => assertDestination(resolver(record), `${name}[${record.id || index}]`).status);
    const actual = Object.fromEntries(Object.keys(expected.statuses).map((status) => [status, statuses.filter((value) => value === status).length]));
    sameCounts(actual, expected.statuses, name);
    report[name] = actual;
  }
  return report;
}

if (require.main === module) {
  try {
    const report = verify();
    console.log(`EXTERNAL DESTINATION CONTRACTS PASS — ${Object.entries(report).map(([name, counts]) => `${name}: ${Object.values(counts).reduce((a, b) => a + b, 0)}`).join('; ')} records classified.`);
  } catch (error) {
    console.error(`EXTERNAL DESTINATION CONTRACTS FAIL\n${error.message}`);
    process.exit(1);
  }
}

module.exports = { verify };
