#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ROUTE = 'polymyth/alwaysalready';
const SOURCE = path.join(ROOT, ROUTE);
const PUBLIC = path.join(ROOT, 'public', ROUTE);
const failures = [];

const expectedImages = new Map([
  ['2026-07-09_reddit_mirror-shadow-realm.png', {
    sha256: 'bf54b14a63b9efb4244e0fca5f023baff00245cb41245ff1d3d28e250f8c1a28',
    width: 387,
    height: 876,
  }],
  ['2026-08-14_youtube_star-trek-vs-hunger-games.png', {
    sha256: '3ad43586540e4de1af0925003571c94fe1346239bfe27009e96ed51ee6e7707b',
    width: 499,
    height: 172,
  }],
  ['2026-08-30_youtube_christianity-fandom-discourse.png', {
    sha256: 'd5d55840f7a120f0875fdbd24b41e7792d0f8ddb553dd5607a320ccc8acd441b',
    width: 1318,
    height: 742,
  }],
  ['2026-09-06_youtube_psychedelic-comments_full.png', {
    sha256: 'b01f959f9b9c44c82fe33089a1b3d012f384223acca4665dc54c14d744a6d1a5',
    width: 1177,
    height: 529,
  }],
  ['2026-09-06_youtube_psychedelic-comments_crop.png', {
    sha256: '055c8ded7f2314a0e0cf272eb8db939db88a043cae7dcfc2ace915759bf93e73',
    width: 838,
    height: 361,
  }],
  ['2026-09-06_youtube_matt-leblanc-joey-actor-as-vessel.png', {
    sha256: '7e5dac48e66054e423a07469a7be68e3e4611a6ca0528ebf8269e67dbf48eef6',
    width: 1848,
    height: 820,
  }],
]);

function check(condition, message) {
  if (!condition) failures.push(message);
}

function read(file) {
  if (!fs.existsSync(file)) {
    failures.push(`missing ${path.relative(ROOT, file)}`);
    return null;
  }
  return fs.readFileSync(file);
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function pngDimensions(bytes) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(signature)) return null;
  return {width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20)};
}

const sourcePageBytes = read(path.join(SOURCE, 'index.html'));
const publicPageBytes = read(path.join(PUBLIC, 'index.html'));
const sourceLedgerBytes = read(path.join(SOURCE, 'specimens.json'));
const publicLedgerBytes = read(path.join(PUBLIC, 'specimens.json'));

if (sourcePageBytes && publicPageBytes) {
  check(sourcePageBytes.equals(publicPageBytes), 'source and public page mirrors differ');
}
if (sourceLedgerBytes && publicLedgerBytes) {
  check(sourceLedgerBytes.equals(publicLedgerBytes), 'source and public ledger mirrors differ');
}

const sourcePage = sourcePageBytes?.toString('utf8') || '';
for (const token of [
  '<title>Always Already · Polymyth in the Wild</title>',
  'https://seminarschools.com/polymyth/alwaysalready/',
  'data-front-facing="general-audience"',
  'data-geometry="indra-web"',
  'src="/js/mandala.js?',
  'src="/js/indra.js?',
  '/polymyth/methodologylist/sabachtan/#sabachtan-always-already-true-operating-mode-dadd2846',
  '6</strong><span>captures',
  '5</strong><span>public contexts',
  '6</strong><span>sightings',
  'https://www.youtube.com/watch?v=T_XfSdNYySc',
  '/polymyth/methodologylist/analysis/#analysis-always-already-leblanc-joey-actor-vessel-2026-09-06',
  '/polymyth/methodologylist/methodology/#methodology-actor-as-vessel-involuntary-polymyth-7180aea1',
  '/polymyth/methodologylist/analysis/#analysis-frankenstein-conscription-prestige-asymmetric-vessel-tax-c66ed8bb',
  'Actor-role-arc requires several roles across a career',
  '@media(max-width:760px)',
  '@media(prefers-reduced-motion:reduce)',
  '@media(forced-colors:active)',
]) {
  check(sourcePage.includes(token), `page is missing ${token}`);
}

const mlTargetBytes = read(path.join(ROOT, 'polymyth', 'methodologylist', 'sabachtan', 'index.html'));
if (mlTargetBytes) {
  check(
    mlTargetBytes.toString('utf8').includes('id="sabachtan-always-already-true-operating-mode-dadd2846"'),
    'the linked ML* always-already anchor is missing',
  );
}

const referencedImages = [...sourcePage.matchAll(/<img\s+[^>]*src="img\/([^"]+\.png)"[^>]*>/g)];
check(referencedImages.length === expectedImages.size, `page embeds ${referencedImages.length} screenshots instead of ${expectedImages.size}`);
for (const match of referencedImages) {
  const [tag, filename] = match;
  check(expectedImages.has(filename), `page embeds unexpected screenshot ${filename}`);
  check(/\balt="[^"]+"/.test(tag), `screenshot ${filename} lacks descriptive alt text`);
  check(sourcePage.includes(`href="img/${filename}"`), `screenshot ${filename} lacks a full-size link`);
}
for (const filename of expectedImages.keys()) {
  check(sourcePage.includes(`src="img/${filename}"`), `page does not visibly embed ${filename}`);
}

for (const [rootName, directory] of [['source', SOURCE], ['public', PUBLIC]]) {
  const imageDirectory = path.join(directory, 'img');
  if (!fs.existsSync(imageDirectory)) {
    failures.push(`${rootName} image directory is missing`);
    continue;
  }
  const actual = fs.readdirSync(imageDirectory).filter(name => fs.statSync(path.join(imageDirectory, name)).isFile()).sort();
  check(
    JSON.stringify(actual) === JSON.stringify([...expectedImages.keys()].sort()),
    `${rootName} image inventory differs from the six-file archive`,
  );
  for (const [filename, expected] of expectedImages) {
    const bytes = read(path.join(imageDirectory, filename));
    if (!bytes) continue;
    check(sha256(bytes) === expected.sha256, `${rootName} ${filename} hash differs`);
    const dimensions = pngDimensions(bytes);
    check(
      dimensions?.width === expected.width && dimensions?.height === expected.height,
      `${rootName} ${filename} dimensions differ`,
    );
  }
}

let ledger = null;
if (sourceLedgerBytes) {
  try {
    ledger = JSON.parse(sourceLedgerBytes.toString('utf8'));
  } catch (error) {
    failures.push(`specimens.json is invalid JSON: ${error.message}`);
  }
}
if (ledger) {
  check(ledger.schema === 'polymyth-alwaysalready-specimens-v1', 'ledger schema is wrong');
  check(ledger.counts?.screenshots === 6, 'ledger screenshot count is not six');
  check(ledger.counts?.public_contexts === 5, 'ledger public-context count is not five');
  check(ledger.counts?.sightings === 6, 'ledger sighting count is not six');
  check(ledger.counts?.observed === 5, 'ledger observed count is not five');
  check(ledger.counts?.candidate === 1, 'ledger candidate count is not one');
  check(Array.isArray(ledger.screenshots) && ledger.screenshots.length === 6, 'ledger does not contain six screenshot rows');
  check(Array.isArray(ledger.sightings) && ledger.sightings.length === 6, 'ledger does not contain six sighting rows');
  for (const entry of ledger.screenshots || []) {
    const filename = path.basename(entry.file || '');
    const expected = expectedImages.get(filename);
    check(Boolean(expected), `ledger contains unexpected screenshot ${entry.file}`);
    if (expected) check(entry.sha256 === expected.sha256, `ledger hash differs for ${filename}`);
  }
  const leblanc = (ledger.sightings || []).find(entry => entry.ml_record === 'analysis-always-already-leblanc-joey-actor-vessel-2026-09-06');
  check(Boolean(leblanc), 'ledger omits the LeBlanc / Joey sighting');
  check(leblanc?.source_url === 'https://www.youtube.com/watch?v=T_XfSdNYySc', 'LeBlanc / Joey source URL differs');
  check(leblanc?.framework_status?.always_already === 'observed', 'LeBlanc / Joey Always Already status differs');
  check(leblanc?.framework_status?.actor_as_vessel === 'observed', 'LeBlanc / Joey Actor-as-vessel status differs');
  check(leblanc?.framework_status?.frankenstein_conscription === 'candidate', 'LeBlanc / Joey Frankenstein status differs');
  check(leblanc?.framework_status?.actor_role_arc === 'not-established', 'LeBlanc / Joey actor-role-arc status differs');
}

for (const relative of ['polymyth/index.html', 'public/polymyth/index.html']) {
  const bytes = read(path.join(ROOT, relative));
  if (bytes) check(bytes.toString('utf8').includes('href="alwaysalready/"'), `${relative} does not link to Always Already`);
}
for (const relative of ['sitemap.xml', 'public/sitemap.xml']) {
  const bytes = read(path.join(ROOT, relative));
  if (bytes) check(bytes.toString('utf8').includes('https://seminarschools.com/polymyth/alwaysalready/'), `${relative} omits Always Already`);
}
for (const relative of ['polymyth/sitemap/index.html', 'public/polymyth/sitemap/index.html']) {
  const bytes = read(path.join(ROOT, relative));
  if (bytes) check(bytes.toString('utf8').includes('href="/polymyth/alwaysalready/"'), `${relative} omits Always Already`);
}

if (failures.length) {
  console.error('ALWAYS ALREADY PAGE FAILED');
  failures.forEach(failure => console.error(` - ${failure}`));
  process.exit(1);
}

console.log('ALWAYS ALREADY PAGE PASSED — six captures, five public contexts, six sightings, reciprocal ML* links, connection-specific statuses, and exact source/public mirrors verified.');
