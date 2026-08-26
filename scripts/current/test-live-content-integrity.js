#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  evaluateCurrentIntegrity,
  WATCHLIST_REASON,
} = require('./verify-live-content-integrity');

const ROOT = path.resolve(__dirname, '../..');
const readJson = relative =>
  JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));
const clone = value => JSON.parse(JSON.stringify(value));

function evaluate(documents) {
  return evaluateCurrentIntegrity({
    canonicalDocument: documents.canonical,
    privateMirrorDocument: documents.privateMirror,
    browseDocument: documents.browse,
    watchlistDocument: documents.watchlist,
    surfaceDocument: documents.surfaces,
    sourceDocument: documents.sources,
    teacherDocument: documents.teacher,
  });
}

const baseline = {
  canonical: readJson('data/polymyth-seminar-events.json'),
  privateMirror: readJson('polymythseminars/events.json'),
  browse: readJson('polymythseminars/browse.json'),
  watchlist: readJson('polymythseminars/watchlist.json'),
  surfaces: readJson('data/polymythcal-publication-surfaces.json'),
  sources: readJson('scripts/sources.json'),
  teacher: readJson('teacherresources/resources-data.json'),
};

assert.deepStrictEqual(evaluate(baseline).failures, [], 'current live content must pass');

const grown = clone(baseline);
const newEvent = {
  ...grown.canonical.events[0],
  id: 'audit38-valid-added-event-2099-01-01',
  identity_key: 'audit38-valid-added-event-2099-01-01',
  title: 'Audit 38 Valid Added Event',
  date: '2099-01-01T12:00:00-05:00',
};
grown.canonical.events.push(newEvent);
grown.canonical.count = grown.canonical.events.length;
grown.canonical._total_events = grown.canonical.events.length;
grown.privateMirror = clone(grown.canonical);
assert(
  evaluate(grown).failures.some(failure => failure.includes('release count')),
  'unreviewed growth must not silently change this release partition',
);

const duplicate = clone(baseline);
duplicate.canonical.events[1].id = duplicate.canonical.events[0].id;
duplicate.privateMirror = clone(duplicate.canonical);
assert(
  evaluate(duplicate).failures.some(failure => failure.includes('not unique')),
  'duplicate canonical IDs must fail',
);

const partitionMismatch = clone(baseline);
partitionMismatch.browse.events.pop();
partitionMismatch.browse.count = partitionMismatch.browse.events.length;
partitionMismatch.browse._chronology_count = partitionMismatch.browse.events.length;
assert(
  evaluate(partitionMismatch).failures.some(failure => failure.includes('partition')),
  'chronology/watchlist union loss must fail',
);

const collapsed = clone(baseline);
collapsed.canonical.events = collapsed.canonical.events.slice(0, 100);
collapsed.canonical.count = 100;
collapsed.canonical._total_events = 100;
collapsed.privateMirror = clone(collapsed.canonical);
collapsed.browse.events = collapsed.browse.events.slice(0, 100);
collapsed.browse.count = 100;
collapsed.browse._chronology_count = 100;
collapsed.browse._canonical_count = 100;
collapsed.watchlist.items = [];
collapsed.watchlist.count = 0;
collapsed.watchlist._canonical_count = 100;
collapsed.surfaces.canonical_count = 100;
collapsed.surfaces.chronology_count = 100;
collapsed.surfaces.watchlist_count = 0;
collapsed.surfaces.chronology_ids = collapsed.browse.events.map(event => event.id);
collapsed.surfaces.watchlist_ids = [];
collapsed.surfaces.reasons = {};
assert(
  evaluate(collapsed).failures.some(failure => failure.includes('collapsed')),
  'catastrophic live-record loss must fail',
);

const wrongReason = clone(baseline);
wrongReason.surfaces.reasons[wrongReason.surfaces.watchlist_ids[0]] = {
  ...WATCHLIST_REASON,
  detail: 'Monitoring marker.',
};
assert(
  evaluate(wrongReason).failures.some(failure => failure.includes('exact Discovery v2 reason')),
  'monitoring reasons must remain exact',
);

const leakedMonitoring = clone(baseline);
leakedMonitoring.browse.events.push(clone(leakedMonitoring.watchlist.items[0]));
leakedMonitoring.browse.count = leakedMonitoring.browse.events.length;
leakedMonitoring.browse._chronology_count = leakedMonitoring.browse.events.length;
leakedMonitoring.surfaces.chronology_ids.push(leakedMonitoring.watchlist.items[0].id);
assert(
  evaluate(leakedMonitoring).failures.some(failure => failure.includes('overlaps')),
  'monitoring records must never leak into chronology',
);

console.log(
  'LIVE CONTENT INTEGRITY TESTS PASSED — the exact 1954 + 134 partition, private corpus, '
    + 'monitoring reasons, uniqueness, and anti-collapse safeguards remain enforced.',
);

