#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = process.cwd();
const required = [
  'START_MEANINGLIB_DASHBOARD.bat',
  'dashboard/index.html',
  'dashboard/app.js',
  'dashboard/styles.css',
  'scripts/meaninglib-dashboard-server.js',
  'scripts/query-meaninglib.js',
  'hf_export/search/meaninglib_search_index.json',
  'hf_export/reports/meaninglib_search_verify_report.md',
  'hf_export/reports/search_report.md'
];
let failures = 0;
for (const rel of required) {
  const p = path.join(root, rel);
  if (fs.existsSync(p)) console.log(`PASS: found ${rel}`);
  else { console.error(`FAIL: missing ${rel}`); failures++; }
}
const indexPath = path.join(root, 'hf_export/search/meaninglib_search_index.json');
if (fs.existsSync(indexPath)) {
  const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  if ((index.docs || []).length >= 1900) console.log(`PASS: dashboard index doc count ${(index.docs || []).length}`);
  else { console.error(`FAIL: dashboard index doc count too low ${(index.docs || []).length}`); failures++; }
  const lock = String(index.ontology_lock || '');
  if (lock.includes('Meaninglib') && lock.includes('interdependent')) console.log('PASS: dashboard ontology lock present');
  else { console.error('FAIL: dashboard ontology lock missing'); failures++; }
}
if (failures) process.exit(1);
