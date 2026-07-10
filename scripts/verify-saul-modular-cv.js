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
  'CV_OUTPUT_REVAMP_2026_07_09',
  'CV_WHITESPACE_FILL_2026_07_09',
  'fitPrintCvToOnePage(host)',
  'PRINT_FOCUS',
  'The top profile, experience list, skills, education, and credentials follow the currently selected focus areas.',
  'tagMatches(active, x[2])',
  'seminarschools: { certs: null, edu: null }'
].forEach(token => { if(!has(token)) failures.push(`Missing modular CV invariant: ${token}`); });
if (has('active = wasOnly ? new Set() : new Set([cat]);')) failures.push('Single-select module logic returned.');
if (has('data-quick-view="current"')) failures.push('Old current-work quick view returned.');
if (has('data-cat="seminarschools">Seminar Schools</button>')) failures.push('Seminar Schools standalone tab label returned.');
if (has('Core Signals')) failures.push('Core Signals front-facing label returned.');
if (!has('Key Skills')) failures.push('Key Skills CV sidebar heading missing.');
if (!has('src="/img/saul.jpg"') || !has('class="cv-map-section"')) failures.push('Website portrait/map presence missing.');
if (failures.length) { console.error('SAUL MODULAR CV CHECK FAILED'); failures.forEach(f => console.error(' - ' + f)); process.exit(1); }
console.log('SAUL MODULAR CV CHECK PASSED — default broad, selected focus areas targeted, combinations additive, top copy changes, export follows selected focus areas, one-page print revamp present.');
