#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { evaluateLiveContent } = require('../live-content-integrity');

const ROOT = path.resolve(__dirname, '../..');
const CURRENT_THRESHOLDS = Object.freeze({ teacherResources: 645 });

function readJson(relative) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));
}

const result = evaluateLiveContent({
  eventsDocument: readJson('polymythseminars/events.json'),
  browseDocument: readJson('polymythseminars/browse.json'),
  sourceDocument: readJson('scripts/sources.json'),
  teacherDocument: readJson('teacherresources/resources-data.json'),
  thresholds: CURRENT_THRESHOLDS,
});

if (result.failures.length) {
  console.error('LIVE CONTENT INTEGRITY FAILED');
  result.failures.forEach(failure => console.error(` - ${failure}`));
  process.exit(1);
}

const metrics = result.metrics;
console.log(
  'LIVE CONTENT INTEGRITY PASSED — '
    + `${metrics.events} canonical/browse events, ${metrics.eventTypes} types, `
    + `${metrics.registeredSources} registered sources, `
    + `${metrics.everyRunDeterministicSources} every-run + `
    + `${metrics.rotatingDeterministicSources} rotating deterministic sources, `
    + `${metrics.teacherResources}/${metrics.teacherCollections}/${metrics.teacherGroups} `
    + 'Teacher Resources. Totals may evolve; parity, uniqueness, completeness, and '
    + 'anti-collapse floors remain enforced.',
);
