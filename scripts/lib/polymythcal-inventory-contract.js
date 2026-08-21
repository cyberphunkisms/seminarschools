'use strict';
const fs = require('fs');
const path = require('path');

function loadInventoryContract(root) {
  const file = path.join(root, 'data', 'polymythcal-inventory-contract.json');
  const contract = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const field of ['minimum_canonical_events', 'minimum_sources', 'minimum_event_types']) {
    if (!Number.isInteger(contract[field]) || contract[field] < 0) {
      throw new Error(`Invalid Polymythcal inventory contract field: ${field}`);
    }
  }
  return contract;
}

module.exports = { loadInventoryContract };
