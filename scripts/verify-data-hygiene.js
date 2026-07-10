#!/usr/bin/env node
'use strict';
/** Verifies the calendar data folder has one live master and no empty legacy event file. */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
let fail = 0;
function file(rel) { return path.join(ROOT, rel); }
function readJson(rel) { return JSON.parse(fs.readFileSync(file(rel), 'utf8')); }
function check(name, ok, detail='') { console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (detail ? ' — ' + detail : '')); if (!ok) fail = 1; }
check('legacy empty data/seminars.json is absent', !fs.existsSync(file('data/seminars.json')));
const master = readJson('data/polymyth-seminar-events.json');
const publicEvents = readJson('polymythseminars/events.json');
const masterCount = (master.events || []).length;
const publicCount = (publicEvents.events || []).length;
check('canonical calendar master has 200+ events', masterCount >= 200, String(masterCount));
check('public calendar copy has same count', publicCount === masterCount, publicCount + '/' + masterCount);
check('public calendar copy is byte-identical to master', fs.readFileSync(file('polymythseminars/events.json')).equals(fs.readFileSync(file('data/polymyth-seminar-events.json'))));
const scrapeLog = readJson('data/scrape-log.json');
check('scrape log declares canonical event file', scrapeLog.canonical_event_file === 'data/polymyth-seminar-events.json');
check('scrape log reports current canonical count', scrapeLog.canonical_event_count === masterCount, String(scrapeLog.canonical_event_count));
check('data README names canonical calendar master', fs.readFileSync(file('data/README.md'), 'utf8').includes('data/polymyth-seminar-events.json'));
if (fail) {
  console.error('\nDATA HYGIENE CHECK FAILED');
  process.exit(1);
}
console.log('\nDATA HYGIENE CHECK PASSED');
