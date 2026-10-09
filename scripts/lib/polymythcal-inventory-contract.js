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

function currentInventoryCounts(root, document) {
  const contract = loadInventoryContract(root);
  const payload = document || JSON.parse(fs.readFileSync(path.join(root, 'data/polymyth-seminar-events.json'), 'utf8'));
  const events = payload.events;
  if (!Array.isArray(events)) throw new Error('Canonical events must be an array');
  const ids = new Set(events.map(event => event.id));
  if (ids.has(undefined) || ids.has('') || ids.size !== events.length) throw new Error('Canonical IDs must be present and unique');
  if (events.length < contract.minimum_canonical_events) throw new Error('Canonical inventory fell below its accepted floor');
  const preserved = JSON.parse(fs.readFileSync(path.join(root, 'data/polymythcal-preserved-event-ids.json'), 'utf8')).ids;
  const aliases = new Set(events.flatMap(event => event.legacy_ids || []));
  const missing = preserved.filter(id => !ids.has(id) && !aliases.has(id));
  if (missing.length) throw new Error(`Accepted event identities lost: ${missing.slice(0, 5).join(', ')}`);
  const {isMonitoringMarker} = require('./polymythcal-discovery-model');
  const watchlist = events.filter(isMonitoringMarker).length;
  return Object.freeze({canonical: events.length, chronology: events.length - watchlist, watchlist});
}

module.exports = { loadInventoryContract, currentInventoryCounts };
