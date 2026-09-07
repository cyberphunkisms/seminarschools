#!/usr/bin/env node
'use strict';

/** Verifies polymyth/manifest.txt against the cold canonical ML* inventory. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {parseSeedWithAddenda} = require('./lib/parse-seed-with-addenda');
const {SOURCES, loadSourceEntries, loadVocabulary, SEARCH_FIELDS, sha256} = require('./regen-concordance-index');

const ROOT = path.resolve(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'polymyth/methodologylist/index.html');
const MANIFEST_PATH = path.join(ROOT, 'polymyth/manifest.txt');
const CONCORDANCE_GENERATOR_PATH = path.join(ROOT, 'scripts/regen-concordance-index.js');
const MANIFEST_GENERATOR_PATH = path.join(ROOT, 'scripts/regen-methodologylist-manifest.js');
const SECTION_GENERATOR_PATH = path.join(ROOT, 'scripts/regen-methodologylist-sections-txt.js');
const EXPECTED_TOTAL = 1233;
const EXPECTED_COUNTS = Object.freeze({
  analysis: 30, citation: 343, corehistory: 30, coreplus: 55,
  degorgonification: 54, 'framework-core': 1, gorgonification: 134,
  idiomary: 44, learnings: 28, methodology: 394, pending: 18,
  'pending-user-authorship': 2, polycognate: 24, rainbowsol: 3,
  sabachtan: 35, studylist: 38,
});
let fail = 0;

function check(name, ok, detail = '') {
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (detail ? ' — ' + detail : ''));
  if (!ok) fail = 1;
}
function bytes(relative) { return fs.statSync(path.join(ROOT, relative)).size; }
function comma(number) { return number.toLocaleString('en-US'); }
function escapeRegExp(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function concordanceSlug(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80); }
function regexTest(regex, value) { regex.lastIndex = 0; return regex.test(String(value || '')); }

const sourceHtml = fs.readFileSync(HTML_PATH, 'utf8');
const entries = parseSeedWithAddenda(sourceHtml);
const manifest = fs.existsSync(MANIFEST_PATH) ? fs.readFileSync(MANIFEST_PATH, 'utf8') : '';
const concordanceGenerator = fs.readFileSync(CONCORDANCE_GENERATOR_PATH, 'utf8');
const manifestGenerator = fs.readFileSync(MANIFEST_GENERATOR_PATH, 'utf8');
const sectionGenerator = fs.readFileSync(SECTION_GENERATOR_PATH, 'utf8');
const actualCounts = Object.fromEntries(
  [...entries.reduce((counts, entry) => {
    const section = entry.s || 'unknown';
    counts.set(section, (counts.get(section) || 0) + 1);
    return counts;
  }, new Map())].sort(([left], [right]) => left.localeCompare(right)),
);
const sections = Object.keys(EXPECTED_COUNTS);
const CONTROL_OWNER_ID = 'method-polycognate-current-ruling-and-case-controls-2026-08-28';
const CONTROL_OWNER_BODY_SHA256 = 'b0082520faeef6585facd013debbd1c441d16c375ec59d24ecbc4cae4d4e125c';
const GENEALOGY_CONTROL_IDS = Object.freeze(Array.from({length:16}, (_, index) => `G${String(index + 1).padStart(2, '0')}`));
const POLYCOGNATE_CONTROL_IDS = Object.freeze(Array.from({length:24}, (_, index) => `P${String(index + 1).padStart(2, '0')}`));

check('manifest exists', manifest.length > 1000);
check('canonical cold total', entries.length === EXPECTED_TOTAL, `${entries.length}/${EXPECTED_TOTAL}`);
check(
  'canonical cold section counts',
  JSON.stringify(actualCounts) === JSON.stringify(EXPECTED_COUNTS),
  JSON.stringify(actualCounts),
);
const controlOwner = entries.find(entry => entry.id === CONTROL_OWNER_ID);
check('Polycognate control owner exists exactly once', entries.filter(entry => entry.id === CONTROL_OWNER_ID).length === 1);
if (controlOwner) {
  const body = String(controlOwner.b || '');
  const actualBodyHash = crypto.createHash('sha256').update(body, 'utf8').digest('hex');
  const genealogyIds = [...body.matchAll(/^(G\d{2})\.\s/gm)].map(match => match[1]);
  const polycognateIds = [...body.matchAll(/^(P\d{2})\.\s/gm)].map(match => match[1]);
  check(
    'exact G01..G16 genealogy-control membership',
    JSON.stringify(genealogyIds) === JSON.stringify(GENEALOGY_CONTROL_IDS),
    genealogyIds.join(', '),
  );
  check(
    'exact P01..P24 Polycognate-control membership',
    JSON.stringify(polycognateIds) === JSON.stringify(POLYCOGNATE_CONTROL_IDS),
    polycognateIds.join(', '),
  );
  check('final Polycognate control-owner body hash', actualBodyHash === CONTROL_OWNER_BODY_SHA256, actualBodyHash);
}
for (const section of ['coreplus', 'corehistory', 'framework-core']) {
  check(
    `visible tab counter ${section}`,
    sourceHtml.includes(`id="ct-${section}">${EXPECTED_COUNTS[section]}</span>`),
    `${EXPECTED_COUNTS[section]}`,
  );
}
check(
  'manifest exact total line',
  new RegExp(`^Full file: ${comma(bytes('polymyth/methodologylist.txt'))} bytes, ${EXPECTED_TOTAL} entries across ${sections.length} sections\\.$`, 'm').test(manifest),
);

const manifestSectionNames = [...manifest.matchAll(/^- ([a-z0-9-]+): \d+ entries;/gm)]
  .map(match => match[1]).sort();
check(
  'manifest exact section record set',
  JSON.stringify(manifestSectionNames) === JSON.stringify([...sections].sort()),
  manifestSectionNames.join(', '),
);
for (const section of sections) {
  const count = EXPECTED_COUNTS[section];
  const relative = `polymyth/methodologylist-${section}.txt`;
  if (fs.existsSync(path.join(ROOT, relative))) {
    const expected = `- ${section}: ${count} entries; text: https://seminarschools.com/${relative} (${comma(bytes(relative))} bytes); HTML: https://seminarschools.com/polymyth/methodologylist/?section=${section}`;
    check(`section manifest row ${section}`, new RegExp(`^${escapeRegExp(expected)}$`, 'm').test(manifest));
  } else {
    const expected = `- ${section}: ${count} entries; text mirror: full-file only; HTML: https://seminarschools.com/polymyth/methodologylist/?section=${section}`;
    check(`section manifest row ${section}`, new RegExp(`^${escapeRegExp(expected)}$`, 'm').test(manifest));
  }
}
check('framework CORE is full-file-only', !fs.existsSync(path.join(ROOT, 'polymyth/methodologylist-framework-core.txt')));
check('release gate states verify-all blocks shipping', /Every command inside verify-all-runner\.js is a release blocker/.test(manifest));
check(
  'concordance generation honors the release timestamp contract',
  concordanceGenerator.includes("require('./lib/deterministic-timestamp')")
    && concordanceGenerator.includes('timestamp = generatedAt()')
    && concordanceGenerator.includes('generated:timestamp')
    && !/generated:\s*new Date\(/.test(concordanceGenerator),
);

const concordancePath = path.join(ROOT, 'polymyth/concordance/concordance-index.json');
if (!fs.existsSync(concordancePath)) {
  check('concordance output exists', false);
} else {
  let concordance = null;
  try { concordance = JSON.parse(fs.readFileSync(concordancePath, 'utf8')); }
  catch (error) { check('concordance output is valid JSON', false, error.message); }
  if (concordance) {
    const started = Date.now();
    const sourceRecords = [];
    const expectedStatusHashes = Object.create(null);
    for (const source of SOURCES) {
      for (const entry of loadSourceEntries(source, ROOT)) {
        const id = String(entry.id || `${entry.s || 'unknown'}-${concordanceSlug(entry.t)}`);
        const identity = `${source.id}:${id}`;
        const fields = Object.fromEntries(SEARCH_FIELDS.map(field => [field, String(entry[field] || '')]));
        sourceRecords.push({source, entry, id, identity, fields, searchable:SEARCH_FIELDS.map(field => fields[field]).join('\n')});
        expectedStatusHashes[identity] = sha256(String(entry.xc || ''));
      }
    }
    const vocabulary = loadVocabulary(ROOT);
    const expectedTermNames = [];
    let expectedReferenceCount = 0;
    let membershipFailures = 0;
    let payloadFailures = 0;
    let snippetFailures = 0;
    let currentLeadFailures = 0;
    for (const term of vocabulary) {
      const expected = [];
      for (const record of sourceRecords) {
        if (!regexTest(term.regex, record.searchable)) continue;
        const matchedFields = SEARCH_FIELDS.filter(field => regexTest(term.regex, record.fields[field]));
        if (!matchedFields.length) continue;
        expected.push(record);
      }
      if (!expected.length) continue;
      expectedTermNames.push(term.canonical);
      expectedReferenceCount += expected.length;
      const actualRecord = concordance.terms && concordance.terms[term.canonical];
      const actualEntries = actualRecord && Array.isArray(actualRecord.entries) ? actualRecord.entries : [];
      const expectedIdentities = expected.map(record => record.identity);
      const actualIdentities = actualEntries.map(reference => `${reference.src}:${reference.id}`);
      if (actualRecord?.count !== expected.length || JSON.stringify(actualIdentities) !== JSON.stringify(expectedIdentities)) membershipFailures += 1;
      for (let index = 0; index < Math.min(expected.length, actualEntries.length); index += 1) {
        const record = expected[index];
        const reference = actualEntries[index];
        if (
          reference.t !== String(record.entry.t || '').slice(0, 200)
          || reference.s !== String(record.entry.s || '')
          || reference.url !== `${record.source.url}#${record.id}`
          || JSON.stringify(reference.fields) !== JSON.stringify(SEARCH_FIELDS.filter(field => regexTest(term.regex, record.fields[field])))
        ) payloadFailures += 1;
        if (typeof reference.snip !== 'string' || reference.snip.length > 250 || !regexTest(term.regex, reference.snip)) snippetFailures += 1;
        if (reference.currentStatusHash !== expectedStatusHashes[record.identity]) currentLeadFailures += 1;
        if (/^CURRENT\b/i.test(String(record.entry.xc || '').trim()) && !/^CURRENT\b/i.test(reference.snip)) currentLeadFailures += 1;
      }
    }
    const actualTermNames = Object.keys(concordance.terms || {}).sort();
    if (JSON.stringify(actualTermNames) !== JSON.stringify([...expectedTermNames].sort())) membershipFailures += 1;
    check(
      'concordance exact full term-to-{src,id} membership',
      membershipFailures === 0
        && concordance.totalTerms === expectedTermNames.length
        && concordance.totalReferences === expectedReferenceCount
        && concordance.totalEntries === sourceRecords.length,
      `${expectedTermNames.length} terms; ${expectedReferenceCount} references; ${Date.now() - started} ms; ${membershipFailures} failures`,
    );
    check('concordance exact reference payloads', payloadFailures === 0, `${payloadFailures} failures`);
    check(
      'concordance exact four source fields',
      JSON.stringify(concordance.searchFields) === JSON.stringify(SEARCH_FIELDS),
      JSON.stringify(concordance.searchFields),
    );
    check('every concordance snippet contains its term within 250 characters', snippetFailures === 0, `${snippetFailures} failures`);
    check('every concordance reference binds its current-status hash and preserves CURRENT lead', currentLeadFailures === 0, `${currentLeadFailures} failures`);
    check(
      'concordance per-ID current-status map is exact',
      JSON.stringify(concordance.currentStatusHashes) === JSON.stringify(expectedStatusHashes),
      `${Object.keys(expectedStatusHashes).length} identities`,
    );
  }
}
for (const [label, generator] of [
  ['manifest', manifestGenerator],
  ['section mirror', sectionGenerator],
]) {
  check(
    `${label} generation honors the release timestamp contract`,
    generator.includes("require('./lib/deterministic-timestamp')")
      && generator.includes('generatedAt().slice(0, 10)')
      && !/new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/.test(generator),
  );
}
if (fail) {
  console.error('\nMETHODOLOGYLIST MANIFEST CHECK FAILED');
  process.exit(1);
}
console.log('\nMETHODOLOGYLIST MANIFEST CHECK PASSED');
