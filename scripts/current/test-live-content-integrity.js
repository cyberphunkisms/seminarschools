#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { evaluateLiveContent } = require('../live-content-integrity');

const ROOT = path.resolve(__dirname, '../..');
const CURRENT_THRESHOLDS = Object.freeze({ teacherResources: 645 });
const readJson = relative =>
  JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));
const clone = value => JSON.parse(JSON.stringify(value));

function evaluate(documents) {
  return evaluateLiveContent({
    eventsDocument: documents.events,
    browseDocument: documents.browse,
    sourceDocument: documents.sources,
    teacherDocument: documents.teacher,
    thresholds: CURRENT_THRESHOLDS,
  });
}

const baseline = {
  events: readJson('polymythseminars/events.json'),
  browse: readJson('polymythseminars/browse.json'),
  sources: readJson('scripts/sources.json'),
  teacher: readJson('teacherresources/resources-data.json'),
};

assert.deepStrictEqual(evaluate(baseline).failures, [], 'current live content must pass');

const grown = clone(baseline);
const newEvent = {
  ...grown.events.events[0],
  id: 'audit38-valid-added-event-2099-01-01',
  title: 'Audit 38 Valid Added Event',
  date: '2099-01-01T12:00:00-05:00',
};
grown.events.events.push(newEvent);
grown.events.count = grown.events.events.length;
grown.events._total_events = grown.events.events.length;
grown.browse.events.push({
  ...grown.browse.events[0],
  id: newEvent.id,
  title: newEvent.title,
  date: newEvent.date,
});
grown.browse.count = grown.browse.events.length;
grown.browse._canonical_count = grown.browse.events.length;
assert.deepStrictEqual(
  evaluate(grown).failures,
  [],
  'a valid new event must not be rejected by a frozen historical total',
);

const duplicate = clone(baseline);
duplicate.events.events[1].id = duplicate.events.events[0].id;
assert(
  evaluate(duplicate).failures.some(failure => failure.includes('not unique')),
  'duplicate canonical IDs must fail',
);

const parityMismatch = clone(baseline);
parityMismatch.browse.events.pop();
parityMismatch.browse.count = parityMismatch.browse.events.length;
parityMismatch.browse._canonical_count = parityMismatch.browse.events.length;
assert(
  evaluate(parityMismatch).failures.some(failure => failure.includes('parity')),
  'browse/canonical loss must fail',
);

const collapsed = clone(baseline);
collapsed.events.events = collapsed.events.events.slice(0, 100);
collapsed.events.count = 100;
collapsed.events._total_events = 100;
collapsed.browse.events = collapsed.browse.events.slice(0, 100);
collapsed.browse.count = 100;
collapsed.browse._canonical_count = 100;
assert(
  evaluate(collapsed).failures.some(failure => failure.includes('collapsed')),
  'catastrophic live-record loss must fail',
);

console.log(
  'LIVE CONTENT INTEGRITY TESTS PASSED — valid growth is allowed; duplicates, parity loss, '
    + 'and catastrophic collapse remain blocked.',
);
