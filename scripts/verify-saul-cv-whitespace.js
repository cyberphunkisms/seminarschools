#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const failures = [];
function need(hay, token, label) { if (!hay.includes(token)) failures.push(`Missing ${label}: ${token}`); }
const buildPath = path.join(root, 'scripts', 'build-cv-pdf.js');
const saulPath = path.join(root, 'saul', 'index.html');
const csvPath = path.join(root, 'cv-whitespace-rendered-128-states-2026-07-09.csv');
const samplesZip = path.join(root, 'cv-modular-onepage-samples-final-2026-07-09.zip');
if (!fs.existsSync(buildPath)) failures.push('missing build-cv-pdf.js');
if (!fs.existsSync(saulPath)) failures.push('missing saul/index.html');
const build = fs.existsSync(buildPath) ? fs.readFileSync(buildPath, 'utf8') : '';
const saul = fs.existsSync(saulPath) ? fs.readFileSync(saulPath, 'utf8') : '';
need(build, 'CV_WHITESPACE_FILL_2026_07_09', 'builder whitespace marker');
need(saul, 'CV_WHITESPACE_FILL_2026_07_09', 'browser print whitespace marker');
need(build, 'data-cv-whitespace-fill="2026-07-09"', 'builder whitespace data attribute');
need(saul, 'data-cv-whitespace-fill="2026-07-09"', 'browser print whitespace data attribute');
need(build, 'cv-ultra', 'ultra sparse CV density');
need(build, 'cv-sparse', 'sparse CV density');
need(build, 'cv-airy', 'airy CV density');
need(build, 'cv-dense', 'dense CV density');
need(build, '.cv-ultra .foot,.cv-sparse .foot,.cv-airy .foot{position:absolute;left:0;right:0;bottom:0', 'bottom-anchored footer in sparse builder outputs');
need(saul, '#printCv .cv-ultra .foot,#printCv .cv-sparse .foot,#printCv .cv-airy .foot{position:absolute;left:0;right:0;bottom:0', 'bottom-anchored footer in sparse browser print outputs');
if (build.includes('Core Signals') || saul.includes('Core Signals')) failures.push('Core Signals returned in CV output source.');
need(build, 'Key Skills', 'Key Skills in builder');
need(saul, 'Key Skills', 'Key Skills in browser print');
need(build, 'combo:20', '20-row combo cap in PDF builder');
need(saul, 'combo: 20', '20-row combo cap in browser print builder');
if (!fs.existsSync(csvPath)) failures.push('missing 128-state CV whitespace audit CSV');
else {
  const lines = fs.readFileSync(csvPath, 'utf8').trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 129) failures.push(`expected header + 128 CSV rows; found ${lines.length}`);
  const header = lines[0].split(',');
  if (!header.includes('pages')) failures.push('CSV missing pages column');
  let badPages = 0;
  for (const line of lines.slice(1)) {
    // cats may contain unquoted commas in older audit CSVs; pages is the penultimate column.
    const parts = line.split(',');
    const pages = Number(parts[parts.length - 2]);
    if (pages !== 1) badPages++;
  }
  if (badPages) failures.push(`${badPages} modular CV states are not one page in CSV audit`);
}
if (!fs.existsSync(samplesZip) || fs.statSync(samplesZip).size < 100000) failures.push('missing or tiny modular CV samples zip');
if (failures.length) { console.error('SAUL CV WHITESPACE CHECK FAILED'); failures.forEach(f => console.error(' - ' + f)); process.exit(1); }
console.log('SAUL CV WHITESPACE CHECK PASSED — 128-state CSV audit, one-page budget, density classes, bottom-anchored footer, Key Skills heading, and Core Signals block verified.');
