#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);

function arg(name) {
  const index = args.indexOf(name);
  return index === -1 ? null : args[index + 1];
}

const baselineArg = arg('--baseline');
const archiveArg = arg('--archive');
if (!baselineArg || !archiveArg) {
  console.error('Usage: node scripts/verify-audit54-rhetoric-base-preservation.js --baseline DIR --archive ZIP');
  process.exit(2);
}

const baseline = path.resolve(baselineArg);
const archive = path.resolve(archiveArg);
const reportRelative = 'scripts/reports/audit54-rhetoric-taxonomy-base-preservation.json';
const ignored = new Set(['PACKAGE_CONTENTS_SHA256.json']);
const ignoredPrefixes = ['scripts/__pycache__/'];

const mutableExact = new Set([
  'package.json',
  'polymyth/manifest.txt',
  'polymyth/methodologylist.txt',
  'polymyth/methodologylist-citation.txt',
  'polymyth/methodologylist-gorgonification.txt',
  'polymyth/methodologylist-idiomary.txt',
  'polymyth/methodologylist-methodology.txt',
  'polymyth/methodologylist-pending.txt',
  'polymyth/methodologylist-studylist.txt',
  'polymyth/concordance/concordance-index.json',
  'polymyth/methodologylist/index.html',
  'polymyth/methodologylist/citation/index.html',
  'polymyth/methodologylist/gorgonification/index.html',
  'polymyth/methodologylist/idiomary/index.html',
  'polymyth/methodologylist/methodology/index.html',
  'polymyth/methodologylist/pending/index.html',
  'polymyth/methodologylist/studylist/index.html',
  'public/polymyth/manifest.txt',
  'public/polymyth/methodologylist.txt',
  'public/polymyth/methodologylist-citation.txt',
  'public/polymyth/methodologylist-gorgonification.txt',
  'public/polymyth/methodologylist-idiomary.txt',
  'public/polymyth/methodologylist-methodology.txt',
  'public/polymyth/methodologylist-pending.txt',
  'public/polymyth/methodologylist-studylist.txt',
  'public/polymyth/concordance/concordance-index.json',
  'public/polymyth/methodologylist/index.html',
  'public/polymyth/methodologylist/citation/index.html',
  'public/polymyth/methodologylist/gorgonification/index.html',
  'public/polymyth/methodologylist/idiomary/index.html',
  'public/polymyth/methodologylist/methodology/index.html',
  'public/polymyth/methodologylist/pending/index.html',
  'public/polymyth/methodologylist/studylist/index.html',
  'scripts/lib/parse-seed-with-addenda.js',
  'scripts/search-surface-manifest.json',
]);

const addedExact = new Set([
  'data/author-sources/rhetoric-taxonomy-conversation-ledger-2026-07-29.md',
  'data/author-sources/rhetoric-taxonomy-conversation-manifest-2026-07-29.json',
  'polymyth/methodologylist/rhetoric-taxonomy-addendum.js',
  'public/polymyth/methodologylist/rhetoric-taxonomy-addendum.js',
  'scripts/apply-rhetoric-taxonomy-collision-corrections.js',
  'scripts/verify-audit54-rhetoric-base-preservation.js',
  'scripts/verify-ml-rhetoric-taxonomy.js',
  reportRelative,
]);

function skip(relative) {
  return ignored.has(relative) || ignoredPrefixes.some(prefix => relative.startsWith(prefix));
}

function walk(base, relative = '', rows = new Map()) {
  const directory = path.join(base, relative);
  for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
    const child = relative ? relative + '/' + entry.name : entry.name;
    if (skip(child)) continue;
    if (entry.isDirectory()) walk(base, child, rows);
    else if (entry.isFile()) rows.set(child, path.join(base, child));
  }
  return rows;
}

function digest(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function aggregate(rows) {
  const hash = crypto.createHash('sha256');
  for (const row of rows.slice().sort((a, b) => a.path.localeCompare(b.path))) {
    hash.update(row.path + '\u0000' + row.sha256 + '\n');
  }
  return hash.digest('hex');
}

function mutable(relative) {
  return mutableExact.has(relative) || relative.startsWith('hf_export/');
}

function addedAllowed(relative) {
  return addedExact.has(relative) || relative.startsWith('hf_export/');
}

if (!fs.statSync(baseline).isDirectory()) throw new Error('Baseline is not a directory: ' + baseline);
if (!fs.statSync(archive).isFile()) throw new Error('Archive is not a file: ' + archive);

const baselineFiles = walk(baseline);
const currentFiles = walk(root);
const baselineRows = [];
const currentRows = [];
const missing = [];
const modified = [];
const added = [];

for (const [relative, file] of baselineFiles) {
  const sha256 = digest(file);
  baselineRows.push({path: relative, bytes: fs.statSync(file).size, sha256});
  const current = currentFiles.get(relative);
  if (!current) {
    missing.push(relative);
    continue;
  }
  const currentSha = digest(current);
  currentRows.push({path: relative, bytes: fs.statSync(current).size, sha256: currentSha});
  if (currentSha !== sha256) modified.push(relative);
}

for (const [relative, file] of currentFiles) {
  if (baselineFiles.has(relative)) continue;
  const sha256 = digest(file);
  currentRows.push({path: relative, bytes: fs.statSync(file).size, sha256});
  added.push(relative);
}

const unexpectedModified = modified.filter(relative => !mutable(relative));
const unexpectedAdded = added.filter(relative => !addedAllowed(relative));
const status = missing.length || unexpectedModified.length || unexpectedAdded.length ? 'failed' : 'passed';
const report = {
  schema: 'seminarschools.audit54.rhetoric-base-preservation.v1',
  audit: 54,
  generated_on: '2026-07-29',
  status,
  input_archive: path.basename(archive),
  input_archive_sha256: digest(archive),
  ignored_paths: [...ignored],
  ignored_prefixes: ignoredPrefixes,
  baseline_files_checked: baselineFiles.size,
  baseline_aggregate_sha256: aggregate(baselineRows),
  current_files_checked: currentFiles.size,
  current_aggregate_sha256: aggregate(currentRows),
  missing_baseline_files: missing,
  modified_files: modified,
  added_files: added,
  unexpected_modified_files: unexpectedModified,
  unexpected_added_files: unexpectedAdded,
  mutable_exact_paths: [...mutableExact].sort(),
  mutable_prefixes: ['hf_export/'],
  allowed_added_exact_paths: [...addedExact].sort(),
  interpretation: {
    missing_baseline_files: 'An empty list confirms that every non-generated file supplied in the uploaded ZIP remains present.',
    unexpected_modified_files: 'An empty list confirms that edits stayed inside the ML* integration and its generated mirrors, retrieval export, and public copies.',
    unexpected_added_files: 'An empty list confirms that new files are limited to the rhetoric addendum, provenance, verification, and generated retrieval surfaces.',
  },
};

const reportPath = path.join(root, reportRelative);
fs.mkdirSync(path.dirname(reportPath), {recursive: true});
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');

console.log(
  'AUDIT54 RHETORIC BASE PRESERVATION ' + status.toUpperCase()
  + ' — ' + baselineFiles.size + ' baseline files checked; '
  + missing.length + ' missing; ' + modified.length + ' modified; '
  + added.length + ' added; ' + unexpectedModified.length + ' unexpected modifications; '
  + unexpectedAdded.length + ' unexpected additions.'
);
if (status !== 'passed') process.exit(1);
