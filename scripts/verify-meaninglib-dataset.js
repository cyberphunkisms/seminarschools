#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'hf_export');
const reportLines = [];
let failures = 0;
let warnings = 0;

function fail(msg) { failures += 1; reportLines.push(`FAIL: ${msg}`); console.error(`FAIL: ${msg}`); }
function warn(msg) { warnings += 1; reportLines.push(`WARN: ${msg}`); console.warn(`WARN: ${msg}`); }
function pass(msg) { reportLines.push(`PASS: ${msg}`); console.log(`PASS: ${msg}`); }
function exists(rel) { return fs.existsSync(path.join(ROOT, rel)); }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function readJsonl(rel) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) { fail(`missing ${rel}`); return []; }
  const rows = [];
  const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/).filter(Boolean);
  lines.forEach((line, idx) => {
    try { rows.push(JSON.parse(line)); }
    catch (e) { fail(`${rel}:${idx + 1} invalid JSON: ${e.message}`); }
  });
  return rows;
}
function listJsonl(dirRel) {
  const dir = path.join(ROOT, dirRel);
  if (!fs.existsSync(dir)) return [];
  const out = [];
  function walk(d) {
    for (const name of fs.readdirSync(d)) {
      const p = path.join(d, name);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (name.endsWith('.jsonl')) out.push(path.relative(ROOT, p).replace(/\\/g, '/'));
    }
  }
  walk(dir);
  return out.sort();
}

function main() {
  const required = [
    'hf_export/README.md',
    'hf_export/data/ml/methodologylist.jsonl',
    'hf_export/data/bb/bookwormburrows.jsonl',
    'hf_export/data/mc/modulecanon.jsonl',
    'hf_export/data/cc/campaigncodex.jsonl',
    'hf_export/data/relations/star_file_map.jsonl',
    'hf_export/data/relations/crossrefs.jsonl',
    'hf_export/reports/latest_export_report.md',
    'hf_export/schemas/meaninglib_entry.schema.json'
  ];
  required.forEach(rel => exists(rel) ? pass(`found ${rel}`) : fail(`missing ${rel}`));

  const all = readJsonl('hf_export/data/all_meaninglib_rows.jsonl');
  if (all.length < 1500) warn(`total rows are ${all.length}; expected a large first-pass export`);
  else pass(`total rows: ${all.length}`);

  const counts = all.reduce((acc, row) => { acc[row.star_file] = (acc[row.star_file] || 0) + 1; return acc; }, {});
  for (const [star, min] of Object.entries({ ml: 900, bb: 150, mc: 150, cc: 200 })) {
    if ((counts[star] || 0) < min) fail(`${star} row count too low: ${counts[star] || 0} < ${min}`);
    else pass(`${star} row count ${counts[star]}`);
  }

  const allowedStatus = new Set(['derived_txt', 'canonical_html', 'generated_view', 'audit_report', 'html_route_view']);
  const ids = new Set();
  for (const [i, row] of all.entries()) {
    const prefix = `row ${i + 1} (${row.id || 'missing-id'})`;
    for (const key of ['id', 'star_file', 'title', 'body', 'section', 'canonical_status', 'source_hash', 'exported_at', 'embedding_text']) {
      if (!row[key]) fail(`${prefix} missing ${key}`);
    }
    if (row.body && row.body.length < 10) warn(`${prefix} has very short body`);
    if (row.canonical_status && !allowedStatus.has(row.canonical_status)) warn(`${prefix} uses unrecognized canonical_status ${row.canonical_status}`);
    const compoundId = `${row.star_file}:${row.id}`;
    if (ids.has(compoundId)) fail(`duplicate id ${compoundId}`);
    ids.add(compoundId);
  }

  const starMap = readJsonl('hf_export/data/relations/star_file_map.jsonl');
  const starNames = new Set(starMap.map(x => x.star_file));
  for (const star of ['ml', 'bb', 'mc', 'cc']) {
    if (!starNames.has(star)) fail(`star_file_map missing ${star}`);
    else pass(`star_file_map includes ${star}`);
  }
  const badHierarchy = JSON.stringify(starMap).match(/governed by ml\*|ml\* governs|ruler over/gi);
  if (badHierarchy) fail('generated star_file_map uses hierarchy/governance language');
  else pass('star_file_map avoids ML* hierarchy language');

  const readme = exists('hf_export/README.md') ? read('hf_export/README.md') : '';
  if (!/Meaninglib/.test(readme)) fail('README does not name Meaninglib');
  else pass('README names Meaninglib');
  if (!/interdependent star-file access routes/i.test(readme)) fail('README does not state interdependent star-file access route ontology');
  else pass('README states interdependence ontology');
  if (/ML\* is the ruler|governed by ML\*/i.test(readme)) fail('README uses rejected ML* hierarchy language');
  else pass('README avoids rejected ML* hierarchy language');

  const jsonlFiles = listJsonl('hf_export/data');
  pass(`jsonl files found: ${jsonlFiles.length}`);

  const reportPath = path.join(ROOT, 'hf_export/reports/verification_report.md');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `# Meaninglib dataset verification report\n\nGenerated: ${new Date().toISOString()}\n\nFailures: ${failures}\nWarnings: ${warnings}\n\n${reportLines.map(line => `- ${line}`).join('\n')}\n`, 'utf8');

  if (failures) {
    console.error(`Meaninglib dataset verification failed with ${failures} failure(s).`);
    process.exit(1);
  }
  console.log(`Meaninglib dataset verification passed with ${warnings} warning(s).`);
}

main();
