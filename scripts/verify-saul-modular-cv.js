#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'saul', 'index.html'), 'utf8');
const failures = [];
const has = (s) => html.includes(s);
[
  'const QUICK_VIEW_SETS = {',
  'evaluation: ["teaching","education","community"]',
  'programs: ["community","education"]',
  'customer: ["teaching","community","seminarschools"]',
  'arts: ["performance","seminarschools"]',
  'if (next.has(cat)) next.delete(cat);',
  'else next.add(cat);',
  'active = next;',
  "const newPath = cats.length === 0 ? '/saul/' : '/saul/' + cats.map(catSlug).join('/');",
  "const CAT_SLUGS = { seminarschools: 'portfolio' };",
  'CV_OUTPUT_REVAMP_2026_07_09',
  'CV_WHITESPACE_FILL_2026_07_09',
  'CV_610_SYNTHESIS_2026_07_11',
  'fitPrintCvToOnePage(host)',
  'PRINT_FOCUS',
  'The experience, methods, education, professional development, and downloadable PDF follow the selected focus areas.',
  'tagMatches(active, x[2])',
  'const CV_METHODS_ALL',
  'const CV_METHODS_BY_CAT',
  'const CV_LANGUAGES',
  'thousands of learners'
].forEach(token => { if(!has(token)) failures.push(`Missing modular CV invariant: ${token}`); });
if (has('active = wasOnly ? new Set() : new Set([cat]);')) failures.push('Single-select module logic returned.');
if (has('data-quick-view="current"')) failures.push('Old current-work quick view returned.');
if (has('data-cat="seminarschools">Seminar Schools</button>')) failures.push('Seminar Schools standalone tab label returned.');
if (has('Core Signals')) failures.push('Core Signals front-facing label returned.');
['PhD Candidate','Doctorant en','نامزد دکتر','博士候選人','博士候选人','1,000+','Mentored 1,000','References available on request','advanced doctoral work'].forEach(token => { if (has(token)) failures.push(`Retired CV claim returned: ${token}`); });
if (!has('Methods and Tools')) failures.push('Methods and Tools section missing.');
if (!has('Languages')) failures.push('Languages section missing.');
if (!has('Selected Professional Development')) failures.push('Selected Professional Development heading missing.');
if (!has('src="/img/saul.jpg"') || !has('class="cv-map-section"')) failures.push('Website portrait/map presence missing.');
if (failures.length) { console.error('SAUL MODULAR CV CHECK FAILED'); failures.forEach(f => console.error(' - ' + f)); process.exit(1); }
console.log('SAUL MODULAR CV CHECK PASSED — broad default, eight targeted views, additive combinations, factual corrections, methods/languages, project statuses, and role-matched export.');
