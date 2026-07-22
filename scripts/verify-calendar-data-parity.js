#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
function read(p){ return fs.readFileSync(path.join(ROOT, p), 'utf8'); }
const publicText = read('polymythseminars/events.json');
const masterText = read('data/polymyth-seminar-events.json');
const pub = JSON.parse(publicText), master = JSON.parse(masterText);
const fail = [];
if (publicText !== masterText) fail.push('Public event file and data master are not byte-identical.');
if (!Array.isArray(pub.events)) fail.push('Public event file lacks events array.');
if (pub.count !== pub.events.length || pub._total_events !== pub.events.length) fail.push(`Event totals disagree: declared ${pub.count}/${pub._total_events}, actual ${pub.events.length}.`);
const html = read('polymythseminars/index.html');
const app = read('js/polymythcal-revamp.js');
const fallbackMatch = html.match(/<script id="events-fallback" type="application\/json">([\s\S]*?)<\/script>/);
if (fallbackMatch) {
  let fallback;
  try { fallback = JSON.parse(fallbackMatch[1]); } catch (e) { fail.push(`Calendar fallback JSON is malformed: ${e.message}`); }
  if (fallback) {
    const ids = a => a.map(x => x.id).sort().join('|');
    if ((fallback.count || 0) !== pub.events.length || (fallback._total_events || 0) !== pub.events.length) fail.push('Fallback totals do not match public event file.');
    if (!Array.isArray(fallback.events) || ids(fallback.events) !== ids(pub.events)) fail.push('Fallback event IDs do not match public event file.');
  }
} else {
  // Audit 16+ deliberately keeps the 839-record corpus out of the HTML shell.
  if (!html.includes('id="pmEventList"')) fail.push('Calendar has neither an embedded fallback nor the lightweight client-shell mount.');
  if (!app.includes('const DATA_URL = "/polymythseminars/events.json"')) fail.push('Client shell does not fetch the canonical public event file.');
  if (!app.includes('/polymythseminars/subscribe/')) fail.push('Client shell lacks a readable failure route when event data cannot load.');
  if (Buffer.byteLength(html, 'utf8') >= 100000) fail.push('Client shell is unexpectedly heavy despite omitting the embedded fallback.');
}
if (fail.length) { console.error('CALENDAR DATA PARITY FAILED\n- ' + fail.join('\n- ')); process.exit(1); }
console.log(`CALENDAR DATA PARITY OK — ${pub.events.length} mirrored entries; lightweight shell contract verified.`);
