#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const payload = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'polymyth-seminar-events.json'), 'utf8'));
const events = Array.isArray(payload) ? payload : (payload.events || []);
if (!events.length) throw new Error('Cannot update Polymythcal listing counts from an empty canonical corpus.');

const focusedRoutes = [
  'writingclub', 'writingkids', 'writingjuniors', 'writingteens',
  'writinggrads', 'university', 'philosophy', 'humanities', 'cfps',
  'lectures', 'fellowships',
];
const routes = [
  'polymythseminars/index.html',
  'polymythseminars/fr/index.html',
  ...focusedRoutes.flatMap(slug => [
    `${slug}/index.html`,
    `${slug}/fr/index.html`,
  ]),
];
let changed = 0;
for (const relative of routes) {
  const file = path.join(ROOT, relative);
  if (!fs.existsSync(file)) continue;
  const before = fs.readFileSync(file, 'utf8');
  const after = before.replace(
    /(<dt\b[^>]*\bid=["']pmListingCount["'][^>]*>)[\s\S]*?(<\/dt>)/i,
    `$1${events.length}$2`,
  );
  if (after === before) {
    if (!/\bid=["']pmListingCount["']/.test(before)) {
      throw new Error(`${relative} is missing pmListingCount.`);
    }
    continue;
  }
  fs.writeFileSync(file, after);
  changed += 1;
}
console.log(`POLYMYTHCAL LISTING COUNTS — ${events.length} canonical records; ${changed} route shells updated.`);
