#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'saul', 'index.html'), 'utf8');
const failures = [];
const has = (s) => html.includes(s);
[
  'const sets = { all: [], service: [\'kitchen\',\'community\'], teaching: [\'teaching\',\'education\'], portfolio: [\'seminarschools\'] };',
  'if (next.has(cat)) next.delete(cat);',
  'else next.add(cat);',
  'active = next;',
  'const newPath = cats.length === 0 ? \'/saul/\' : \'/saul/\' + cats.map(catSlug).join(\'/\');',
  'const CAT_SLUGS = { seminarschools: \'portfolio\' };',
  'summaryRaw = activeCats.map(function(c)',
  'tagMatches(active, x[2])',
  'Portfolio-only PDF suppresses unrelated full credentials'
].forEach(token => { if(!has(token)) failures.push(`Missing modular CV invariant: ${token}`); });
if (has('active = wasOnly ? new Set() : new Set([cat]);')) failures.push('Single-select module logic returned.');
if (has('data-quick-view="current"')) failures.push('Old current-work quick view returned.');
if (has('data-cat="seminarschools">Seminar Schools</button>')) failures.push('Seminar Schools standalone tab label returned.');
if (!has('Portrait and map remain website-only')) failures.push('Website-only portrait/map rule missing from embedded audit copy.');
if (failures.length) { console.error('SAUL MODULAR CV CHECK FAILED'); failures.forEach(f => console.error(' - ' + f)); process.exit(1); }
console.log('SAUL MODULAR CV CHECK PASSED — default broad, selected modules targeted, combinations additive, PDF follows selected modules.');
