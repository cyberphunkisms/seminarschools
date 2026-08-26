#!/usr/bin/env node
'use strict';
/** Verifies canonical ownership and the public chronology/monitoring boundary. */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
let fail = 0;
function file(rel) { return path.join(ROOT, rel); }
function readJson(rel) { return JSON.parse(fs.readFileSync(file(rel), 'utf8')); }
function check(name, ok, detail='') { console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (detail ? ' — ' + detail : '')); if (!ok) fail = 1; }
check('legacy empty data/seminars.json is absent', !fs.existsSync(file('data/seminars.json')));
const master = readJson('data/polymyth-seminar-events.json');
const canonicalMirror = readJson('polymythseminars/events.json');
const browse = readJson('polymythseminars/browse.json');
const watchlist = readJson('polymythseminars/watchlist.json');
const masterCount = (master.events || []).length;
const mirrorCount = (canonicalMirror.events || []).length;
check('canonical calendar master has 200+ events', masterCount >= 200, String(masterCount));
check('private canonical mirror has same count', mirrorCount === masterCount, mirrorCount + '/' + masterCount);
check('private canonical mirror is byte-identical to master', fs.readFileSync(file('polymythseminars/events.json')).equals(fs.readFileSync(file('data/polymyth-seminar-events.json'))));
check('public projections form the canonical inventory', (browse.events || []).length + (watchlist.items || []).length === masterCount, `${(browse.events || []).length}+${(watchlist.items || []).length}/${masterCount}`);
check('monitoring projection is date-free', (watchlist.items || []).every(item => !Object.hasOwn(item, 'date') && !Object.hasOwn(item, 'end_date')));
check('generated public deploy excludes canonical corpus', !fs.existsSync(file('public/polymythseminars/events.json')));
const scrapeLog = readJson('data/scrape-log.json');
check('scrape log declares canonical event file', scrapeLog.canonical_event_file === 'data/polymyth-seminar-events.json');
check('scrape log reports current canonical count', scrapeLog.canonical_event_count === masterCount, String(scrapeLog.canonical_event_count));
check('data README names canonical calendar master', fs.readFileSync(file('data/README.md'), 'utf8').includes('data/polymyth-seminar-events.json'));
if (fail) {
  console.error('\nDATA HYGIENE CHECK FAILED');
  process.exit(1);
}
console.log('\nDATA HYGIENE CHECK PASSED');

