#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {parseSeedWithAddenda} = require('./lib/parse-seed-with-addenda');

const ROOT = path.resolve(__dirname, '..');
const OWNER_ID = 'coreplus-handler-paginated-document-continuity-2026-09-06';
const SOURCE_ID = 'citation-ml-star-document-continuity-source-2026-09-06';
const SOURCE_PATH = 'UPDATE_SOURCES/ML_STAR_UPDATE_SOURCE_DOCUMENT_CONTINUITY_2026-09-06.md';
const SOURCE_SHA256 = '5d6f0ddc0a895f99d847497896c9b7ef6d4769a430e0912d3014303a39aa5a87';

function read(relative) {
  return fs.readFileSync(path.join(ROOT, relative), 'utf8');
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function one(entries, id) {
  const matches = entries.filter(entry => entry.id === id);
  if (matches.length !== 1) throw new Error(`${id} expected once and found ${matches.length}`);
  return matches[0];
}

function requireNeedles(value, needles, label) {
  for (const needle of needles) {
    if (!String(value || '').includes(needle)) throw new Error(`${label} missing ${needle}`);
  }
}

function passes(artifact) {
  if (!artifact || !Number.isInteger(artifact.page_count) || artifact.page_count < 1) return false;
  if (!artifact.actual_final_render) return false;
  if (artifact.rendered_page_count !== artifact.page_count) return false;
  if (artifact.inspected_page_count !== artifact.page_count) return false;
  if (Array.isArray(artifact.defects) && artifact.defects.length) return false;
  if (artifact.content_cut && (!artifact.content_cut_authorised || !artifact.layout_controls_exhausted)) return false;
  for (const block of artifact.blocks || []) {
    if (!block.heading_kept) return false;
    if (block.fits_fresh_page && block.split) return false;
    if (block.kind === 'table' && block.split) {
      if (!block.repeated_header || !block.rows_intact) return false;
      if (!Array.isArray(block.segment_data_rows) || block.segment_data_rows.some(count => count < 2)) return false;
    }
  }
  if (artifact.links) {
    const links = artifact.links;
    for (const field of [
      'total_annotations',
      'external_annotations',
      'internal_annotations',
      'standard_uri_actions',
      'tested_uri_actions',
      'resolved_internal_destinations',
      'empty_hitboxes',
      'displaced_hitboxes',
      'source_list_urls',
      'visible_copyable_source_urls',
    ]) {
      if (!Number.isInteger(links[field]) || links[field] < 0) return false;
    }
    if (links.total_annotations !== links.external_annotations + links.internal_annotations) return false;
    if (links.standard_uri_actions !== links.external_annotations) return false;
    if (links.tested_uri_actions !== links.external_annotations) return false;
    if (links.resolved_internal_destinations !== links.internal_annotations) return false;
    if (links.empty_hitboxes !== 0 || links.displaced_hitboxes !== 0) return false;
    if (links.visible_copyable_source_urls !== links.source_list_urls) return false;
    if (!Array.isArray(links.independent_parsers)
        || new Set(links.independent_parsers).size < 2) return false;
    if (links.delivery_reader_available && !links.delivery_reader_clickthrough_passed) return false;
  }
  return true;
}

const canonical = read('polymyth/methodologylist/index.html');
const entries = parseSeedWithAddenda(canonical);
const owner = one(entries, OWNER_ID);
const source = one(entries, SOURCE_ID);
const map = one(entries, 'coreplus-current-map-amendment-2026-08-26');
const execution = one(entries, 'coreplus-handler-mephistodata-execution-gates-2026-08-26');
const regression = one(entries, 'coreplus-regression-fixture-contract-2026-08-26');

requireNeedles(owner.b, [
  'ACTIVE UNIVERSAL DOCUMENT-CONTINUITY OWNER',
  'Keep the heading, header, and first two data rows together.',
  'Keep the final two data rows together.',
  'Inspect every page or slide at readable scale.',
  'Annotation presence alone is not proof that a link works.',
  'standard URI action',
  'complete copyable URL or DOI',
  'at least two independent PDF link parsers',
  'empty or displaced',
  'delivery reader',
  'Zero avoidable continuity or link-function defects remain',
  'Never delete user-approved substance',
], OWNER_ID);
requireNeedles(map.b, ['DOCUMENT CONTINUITY DISPATCH.', OWNER_ID], 'current CORE+ map');
requireNeedles(execution.b, ['GATE 8A, PAGINATED DOCUMENT CONTINUITY.', OWNER_ID], 'execution owner');
requireNeedles(regression.b, ['DOCUMENT-CONTINUITY FIXTURE FAMILY.', 'document-continuity'], 'regression owner');
requireNeedles(regression.x, ['scripts/verify-ml-document-continuity.js'], 'regression owner provenance');
requireNeedles(source.b, [SOURCE_PATH, SOURCE_SHA256], SOURCE_ID);

const sourceBytes = fs.readFileSync(path.join(ROOT, SOURCE_PATH));
if (sha256(sourceBytes) !== SOURCE_SHA256) throw new Error('document-continuity source SHA-256 drifted');

const releaseManifest = JSON.parse(read('RELEASE_MANIFEST.json'));
const mlStarUpdate = releaseManifest.ml_star_update || {};
const releaseUpdate = releaseManifest.document_continuity_update || {};
if (!Array.isArray(mlStarUpdate.later_amendments)
    || !mlStarUpdate.later_amendments.includes('paginated-document-continuity')
    || mlStarUpdate.canonical_entries !== 1226
    || mlStarUpdate.document_continuity_source !== SOURCE_PATH
    || mlStarUpdate.document_continuity_source_sha256 !== SOURCE_SHA256
    || mlStarUpdate.document_continuity_owner !== OWNER_ID
    || JSON.stringify(mlStarUpdate.document_continuity_behavioral_fixtures)
      !== JSON.stringify({positive: 4, negative: 13, total: 17})) {
  throw new Error('current ML* release record does not bind the document-continuity amendment');
}
if (releaseUpdate.schema !== 'seminar-schools-ml-document-continuity-update-v1'
    || releaseUpdate.updated_on !== '2026-09-06'
    || releaseUpdate.source !== SOURCE_PATH
    || releaseUpdate.source_sha256 !== SOURCE_SHA256
    || releaseUpdate.owner !== OWNER_ID
    || releaseUpdate.canonical_entries !== 1226
    || JSON.stringify(releaseUpdate.behavioral_fixtures)
      !== JSON.stringify({positive: 4, negative: 13, total: 17})) {
  throw new Error('standalone document-continuity release record is missing or stale');
}

for (const mirror of [
  'polymyth/methodologylist.txt',
  'polymyth/methodologylist-coreplus.txt',
  'polymyth/methodologylist/coreplus/index.html',
]) {
  requireNeedles(read(mirror), [OWNER_ID, 'Paginated document continuity'], mirror);
}

const fixtures = JSON.parse(read('scripts/fixtures/ml-document-continuity/fixtures.json'));
if (fixtures.schema !== 'ml-document-continuity-fixtures-v2'
    || fixtures.owner_id !== OWNER_ID
    || !Array.isArray(fixtures.cases)
    || fixtures.cases.length !== 17) {
  throw new Error('document-continuity fixture contract is incomplete');
}
let permits = 0;
let rejections = 0;
for (const fixture of fixtures.cases) {
  const actual = passes(fixture.artifact);
  if (actual !== fixture.expected) throw new Error(`${fixture.id} expected ${fixture.expected} and received ${actual}`);
  if (actual) permits += 1;
  else rejections += 1;
}

const weakened = {...owner, b: owner.b.replace('Inspect every page or slide at readable scale.', 'Inspect selected pages.')};
let hostileRejected = false;
try {
  requireNeedles(weakened.b, ['Inspect every page or slide at readable scale.'], 'mutated continuity owner');
} catch {
  hostileRejected = true;
}
if (!hostileRejected) throw new Error('mutated document-continuity owner was accepted');

const annotationOnly = {...owner, b: owner.b.replace(
  'Annotation presence alone is not proof that a link works.',
  'Link annotations are sufficient proof.',
)};
let annotationOnlyRejected = false;
try {
  requireNeedles(
    annotationOnly.b,
    ['Annotation presence alone is not proof that a link works.'],
    'annotation-only continuity owner',
  );
} catch {
  annotationOnlyRejected = true;
}
if (!annotationOnlyRejected) throw new Error('annotation-only document-continuity mutation was accepted');

const artifactHashes = mlStarUpdate.artifact_sha256 || {};
for (const relative of [
  SOURCE_PATH,
  'polymyth/methodologylist/mephistodata-rule-hardening-addendum.js',
  'scripts/fixtures/ml-document-continuity/fixtures.json',
  'scripts/verify-ml-document-continuity.js',
]) {
  if (artifactHashes[relative] !== sha256(fs.readFileSync(path.join(ROOT, relative)))) {
    throw new Error(`release artifact hash is missing or stale: ${relative}`);
  }
}

console.log(`ML* DOCUMENT CONTINUITY VERIFIED — ${fixtures.cases.length} fixtures, ${permits} permits, ${rejections} required rejections, source and current owners bound.`);
