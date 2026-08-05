#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  parseDeclaredArray,
  parseMythologyIntegrationAddendum,
  parseRhetoricTaxonomyAddendum,
  parseSeedWithAddenda,
  parseSnakelogicExampleAddendum,
} = require('./lib/parse-seed-with-addenda');

const root = path.resolve(__dirname, '..');
const htmlPath = path.join(root, 'polymyth/methodologylist/index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

function fail(message) {
  console.error('ML RHETORIC TAXONOMY VERIFY FAILED — ' + message);
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function read(relative) {
  const absolute = path.join(root, relative);
  assert(fs.existsSync(absolute), 'missing ' + relative);
  return fs.readFileSync(absolute, 'utf8');
}

function key(entry) {
  return entry.id || [entry.s || '', entry.t || ''].join('\u0000');
}

const expected = {
  'rhetoric-taxonomy-source-ledger-2026-07-29': 'citation',
  'rhetoric-taxonomy-level-matrix-2026-07-29': 'methodology',
  'rhetoric-taxonomy-settled-figure-routing-2026-07-29': 'methodology',
  'rhetoric-taxonomy-jester-fool-trickster-family-2026-07-29': 'methodology',
  'rhetoric-taxonomy-sophist-actor-move-split-2026-07-29': 'methodology',
  'rhetoric-taxonomy-troll-operator-2026-07-29': 'methodology',
  'rhetoric-taxonomy-kayfabe-performance-contract-2026-07-29': 'methodology',
  'rhetoric-taxonomy-parrhesiast-jester-overlap-2026-07-29': 'methodology',
  'rhetoric-taxonomy-baselinemorality-four-stage-chain-2026-07-29': 'gorgonification',
  'rhetoric-taxonomy-siren-provisional-umbrella-2026-07-29': 'pending',
  'rhetoric-taxonomy-operator-candidate-ledger-2026-07-29': 'pending',
  'rhetoric-taxonomy-fool-monograph-deferred-2026-07-29': 'studylist',
};

const historical = parseDeclaredArray(html, 'const SEED');
const snakelogic = parseSnakelogicExampleAddendum(html);
const mythology = parseMythologyIntegrationAddendum();
const rhetoric = parseRhetoricTaxonomyAddendum();
const raw = [...historical, ...snakelogic, ...mythology, ...rhetoric];
const combined = parseSeedWithAddenda(html);

assert(historical.length === 1141, 'historical SEED changed from 1,141 to ' + historical.length);
assert(snakelogic.length === 6, 'Snakelogic addendum changed from 6 to ' + snakelogic.length);
assert(mythology.length === 23, 'mythology addendum changed from 23 to ' + mythology.length);
assert(rhetoric.length === 12, 'rhetoric addendum must contain 12 entries, found ' + rhetoric.length);
assert(combined.length === 1182, 'combined ML* must contain 1,182 entries, found ' + combined.length);
assert(combined.length === raw.length, 'combined parser silently removed one or more raw entries');

const seen = new Set();
for (const entry of raw) {
  const entryKey = key(entry);
  assert(!seen.has(entryKey), 'duplicate raw entry key ' + entryKey);
  seen.add(entryKey);
}

for (const entry of rhetoric) {
  for (const field of ['id', 's', 'r', 't', 'b', 'tg']) {
    assert(typeof entry[field] === 'string' && entry[field].trim(), entry.id + ' lacks required field ' + field);
  }
  assert(Object.prototype.hasOwnProperty.call(expected, entry.id), 'unexpected rhetoric entry ' + entry.id);
  assert(entry.s === expected[entry.id], entry.id + ' must be in ' + expected[entry.id] + ', found ' + entry.s);
}

for (const [id, section] of Object.entries(expected)) {
  const occurrences = combined.filter(entry => entry.id === id);
  assert(occurrences.length === 1, id + ' must appear exactly once in the combined ML*');
  const title = occurrences[0].t;
  assert(read('polymyth/methodologylist.txt').includes(title), title + ' missing from full text mirror');
  assert(
    read('polymyth/methodologylist-' + section + '.txt').includes(title),
    title + ' missing from ' + section + ' section mirror'
  );
  assert(
    read('polymyth/methodologylist/' + section + '/index.html').includes('id="' + id + '"'),
    id + ' missing from static ' + section + ' page'
  );
}

const rhetoricScript = '/polymyth/methodologylist/rhetoric-taxonomy-addendum.js?v=20260729b';
assert(html.includes('<script src="' + rhetoricScript + '"></script>'), 'rhetoric addendum script tag is missing');
assert(
  html.indexOf(rhetoricScript) < html.indexOf('const LIVE_SEED=Object.freeze(['),
  'rhetoric addendum must load before LIVE_SEED is created'
);
assert(html.includes('...RHETORIC_TAXONOMY_ADDENDUM'), 'LIVE_SEED does not spread the rhetoric addendum');

const forbidden = [
  'Trump is the pop-culture instantiation running the operation',
  'connecting jester-mode to trickster-mode without collapsing them',
  'Baselinemorality (idiomary section, the currency unit',
  '[MISSING] N85. Medusa-Medea-Siren',
];
for (const phrase of forbidden) {
  assert(!html.includes(phrase), 'stale collision remains in canonical HTML: ' + phrase);
  assert(!read('polymyth/methodologylist.txt').includes(phrase), 'stale collision remains in full mirror: ' + phrase);
}

assert(
  html.includes('[RESOLVED/DUPLICATE] N85. Medusa-Medea-Siren'),
  'N85 must be marked resolved and duplicate'
);
assert(
  combined.some(entry => entry.t === 'Gorgonification of goth (subculture-gorgonification worked example)' && entry.b.includes("The word 'nuance' does not mean anything anymore now that it is gorgonified.")),
  'existing nuance gorgonification finding was lost'
);

const manifest = JSON.parse(read('data/author-sources/rhetoric-taxonomy-conversation-manifest-2026-07-29.json'));
assert(manifest.status_counts.addendum_entries === 12, 'conversation manifest addendum count is stale');
assert(
  read('data/author-sources/rhetoric-taxonomy-conversation-ledger-2026-07-29.md').includes('The Fool monograph is deferred'),
  'conversation ledger lost the Fool monograph deferral'
);

const parityFiles = [
  'polymyth/methodologylist/index.html',
  'polymyth/methodologylist/rhetoric-taxonomy-addendum.js',
  'polymyth/methodologylist.txt',
  'polymyth/methodologylist-citation.txt',
  'polymyth/methodologylist-gorgonification.txt',
  'polymyth/methodologylist-methodology.txt',
  'polymyth/methodologylist-pending.txt',
  'polymyth/methodologylist-studylist.txt',
  'polymyth/methodologylist/citation/index.html',
  'polymyth/methodologylist/gorgonification/index.html',
  'polymyth/methodologylist/methodology/index.html',
  'polymyth/methodologylist/pending/index.html',
  'polymyth/methodologylist/studylist/index.html',
  'polymyth/manifest.txt',
  'polymyth/concordance/concordance-index.json',
];
for (const relative of parityFiles) {
  const publicRelative = path.join('public', relative);
  const sourceBytes = fs.readFileSync(path.join(root, relative));
  const publicBytes = fs.readFileSync(path.join(root, publicRelative));
  assert(sourceBytes.equals(publicBytes), relative + ' differs from ' + publicRelative);
}

console.log(
  'ML RHETORIC TAXONOMY VERIFIED — 1,141 historical + 6 Snakelogic + 23 mythology + 12 rhetoric = 1,182 unique entries; mirrors, static pages, source ledgers, collision corrections, and public parity passed.'
);
