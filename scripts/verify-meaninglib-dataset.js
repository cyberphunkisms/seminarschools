#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {parseSeedWithAddenda} = require('./lib/parse-seed-with-addenda');
const {generatedAt} = require('./lib/deterministic-timestamp');

const ROOT = process.cwd();
const releaseTimestamp = JSON.parse(fs.readFileSync(path.join(ROOT, 'RELEASE_MANIFEST.json'), 'utf8')).generated_at || '1970-01-01T00:00:00Z';
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
function hash(text) { return crypto.createHash('sha256').update(String(text || ''), 'utf8').digest('hex'); }
function sanitizeForHfExport(text) {
  return String(text || '').replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[REDACTED_EMAIL]');
}
function slugify(input) {
  return String(input || '')
    .toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120) || 'untitled';
}
function canonicalMlId(entry) {
  const section = entry.s || 'unknown';
  const title = String(entry.t || '<untitled>').trim();
  return String(entry.id || '').trim() || `ml:${section}:${slugify(title)}:${hash(`${section}\0${title}`).slice(0, 12)}`;
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
  const canonicalEntries = parseSeedWithAddenda(read('polymyth/methodologylist/index.html'));
  const mlRows = readJsonl('hf_export/data/ml/methodologylist.jsonl');
  const exportedTimestamps = new Set(all.map(row => row.exported_at));
  if (exportedTimestamps.size !== 1) fail(`export rows use ${exportedTimestamps.size} different timestamps`);
  else pass(`all export rows share one timestamp: ${[...exportedTimestamps][0]}`);
  if (process.env.MEPHISTODATA_GENERATED_AT || process.env.SOURCE_DATE_EPOCH) {
    const expectedTimestamp = generatedAt();
    if (exportedTimestamps.size !== 1 || !exportedTimestamps.has(expectedTimestamp)) fail(`export timestamp does not match deterministic build timestamp ${expectedTimestamp}`);
    else pass(`export timestamp matches deterministic build timestamp ${expectedTimestamp}`);
  }
  if (mlRows.length !== canonicalEntries.length) fail(`ML row count ${mlRows.length} differs from canonical ${canonicalEntries.length}`);
  else pass(`ML row count exactly matches canonical: ${mlRows.length}`);
  if ((counts.ml || 0) !== canonicalEntries.length) fail(`all_meaninglib_rows ML count ${counts.ml || 0} differs from canonical ${canonicalEntries.length}`);
  else pass(`all_meaninglib_rows contains exactly ${canonicalEntries.length} canonical ML rows`);
  for (const [star, min] of Object.entries({ bb: 150, mc: 150, cc: 200 })) {
    if ((counts[star] || 0) < min) fail(`${star} row count too low: ${counts[star] || 0} < ${min}`);
    else pass(`${star} row count ${counts[star]}`);
  }

  const canonicalCounts = canonicalEntries.reduce((acc, entry) => {
    const section = entry.s || 'unknown';
    acc[section] = (acc[section] || 0) + 1;
    return acc;
  }, {});
  const exportedCounts = mlRows.reduce((acc, row) => {
    acc[row.section] = (acc[row.section] || 0) + 1;
    return acc;
  }, {});
  if (JSON.stringify(Object.entries(exportedCounts).sort()) !== JSON.stringify(Object.entries(canonicalCounts).sort())) {
    fail(`ML section counts differ from canonical: ${JSON.stringify(exportedCounts)}`);
  } else pass('ML section counts exactly match canonical Methodologylist');

  for (const entry of canonicalEntries) {
    const expectedId = canonicalMlId(entry);
    const matches = mlRows.filter(row => row.id === expectedId);
    const section = entry.s || 'unknown';
    const sectionMirror = `polymyth/methodologylist-${section}.txt`;
    const expectedTxt = exists(sectionMirror) ? sectionMirror : '';
    if (matches.length !== 1) {
      fail(`canonical ML entry expected once by stable id: ${expectedId} (found ${matches.length})`);
      continue;
    }
    const row = matches[0];
    if (
      row.section !== section
      || row.title !== String(entry.t || '<untitled>').trim()
      || row.body !== sanitizeForHfExport(entry.b || '')
      || row.source_hash !== hash(entry.b || '')
      || row.canonical_status !== 'canonical_html'
      || row.source_html !== 'polymyth/methodologylist/index.html'
      || row.source_txt !== expectedTxt
      || row.record_type !== 'entry'
      || row.body_redacted !== (sanitizeForHfExport(entry.b || '') !== String(entry.b || ''))
    ) fail(`canonical ML row differs from source entry: ${expectedId}`);
  }

  const canonicalCore = canonicalEntries.find(entry => entry.id === 'core-personal-rules-current-2026-08-12');
  const coreRows = mlRows.filter(row => row.id === 'core-personal-rules-current-2026-08-12');
  const allCoreRows = all.filter(row => row.star_file === 'ml' && row.id === 'core-personal-rules-current-2026-08-12');
  const sectionCoreRows = readJsonl('hf_export/data/ml/sections/framework-core.jsonl')
    .filter(row => row.id === 'core-personal-rules-current-2026-08-12');
  if (!canonicalCore) fail('canonical portable CORE entry is missing');
  if (coreRows.length !== 1 || allCoreRows.length !== 1 || sectionCoreRows.length !== 1) {
    fail(`portable CORE row must occur once in ML, all-rows, and framework-core exports (${coreRows.length}/${allCoreRows.length}/${sectionCoreRows.length})`);
  } else if (
    coreRows[0].body !== canonicalCore.b
    || coreRows[0].source_hash !== hash(canonicalCore.b)
    || coreRows[0].canonical_status !== 'canonical_html'
    || coreRows[0].source_html !== 'polymyth/methodologylist/index.html'
    || coreRows[0].source_txt !== ''
    || coreRows[0].record_type !== 'entry'
  ) {
    fail('portable CORE HF row does not preserve canonical id, body, hash, status, ownership path, and record type');
  } else pass('portable CORE HF row is exact, canonical, and present on every ML export surface');

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

  for (const row of mlRows) {
    if (row.canonical_status !== 'canonical_html') fail(`ML row is not canonical_html: ${row.id}`);
    if (row.source_html !== 'polymyth/methodologylist/index.html') fail(`ML row has noncanonical source_html: ${row.id}`);
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
  fs.writeFileSync(reportPath, `# Meaninglib dataset verification report\n\nGenerated: ${releaseTimestamp}\n\nFailures: ${failures}\nWarnings: ${warnings}\n\n${reportLines.map(line => `- ${line}`).join('\n')}\n`, 'utf8');

  if (failures) {
    console.error(`Meaninglib dataset verification failed with ${failures} failure(s).`);
    process.exit(1);
  }
  console.log(`Meaninglib dataset verification passed with ${warnings} warning(s).`);
}

main();
