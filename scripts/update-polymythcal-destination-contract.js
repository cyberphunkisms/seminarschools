#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { assertDestination, polymythcalDestination } = require('./lib/external-destination-contracts');

const ROOT = path.resolve(__dirname, '..');
const contractPath = path.join(ROOT, 'data', 'external-destination-contracts.json');
const eventsPath = path.join(ROOT, 'polymythseminars', 'events.json');
const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
const events = JSON.parse(fs.readFileSync(eventsPath, 'utf8')).events || [];
const statuses = {
  'official-event-page': 0,
  'official-series-page': 0,
  'source-event-page': 0,
  'source-series-page': 0,
  'unavailable-specific-page': 0,
};

for (const event of events) {
  const result = assertDestination(polymythcalDestination(event), `Polymythcal event ${event.id}`);
  if (!Object.hasOwn(statuses, result.status)) {
    throw new Error(`Unknown Polymythcal destination status: ${result.status}`);
  }
  statuses[result.status] += 1;
}

contract.datasets.polymythcal.recordCount = events.length;
contract.datasets.polymythcal.statuses = statuses;
const output = `${JSON.stringify(contract, null, 2)}\n`;
const changed = fs.readFileSync(contractPath, 'utf8') !== output;
if (changed) fs.writeFileSync(contractPath, output);
console.log(
  `POLYMYTHCAL DESTINATION CONTRACT — ${events.length} records; ` +
  `${Object.entries(statuses).map(([key, value]) => `${key} ${value}`).join('; ')}; ` +
  `${changed ? 'updated' : 'already current'}.`
);
