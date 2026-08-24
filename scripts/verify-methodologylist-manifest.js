#!/usr/bin/env node
'use strict';

/** Verifies polymyth/manifest.txt against the cold canonical ML* inventory. */
const fs = require('fs');
const path = require('path');
const {parseSeedWithAddenda} = require('./lib/parse-seed-with-addenda');

const ROOT = path.resolve(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'polymyth/methodologylist/index.html');
const MANIFEST_PATH = path.join(ROOT, 'polymyth/manifest.txt');
const CONCORDANCE_GENERATOR_PATH = path.join(ROOT, 'scripts/regen-concordance-index.js');
const MANIFEST_GENERATOR_PATH = path.join(ROOT, 'scripts/regen-methodologylist-manifest.js');
const SECTION_GENERATOR_PATH = path.join(ROOT, 'scripts/regen-methodologylist-sections-txt.js');
const EXPECTED_TOTAL = 1207;
const EXPECTED_COUNTS = Object.freeze({
  analysis: 27, citation: 339, corehistory: 28, coreplus: 51,
  degorgonification: 54, 'framework-core': 1, gorgonification: 134,
  idiomary: 44, learnings: 28, methodology: 382, pending: 18,
  'pending-user-authorship': 2, polycognate: 24, rainbowsol: 3,
  sabachtan: 34, studylist: 38,
});
let fail = 0;

function check(name, ok, detail = '') {
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (detail ? ' — ' + detail : ''));
  if (!ok) fail = 1;
}
function bytes(relative) { return fs.statSync(path.join(ROOT, relative)).size; }
function comma(number) { return number.toLocaleString('en-US'); }
function escapeRegExp(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

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

check('manifest exists', manifest.length > 1000);
check('canonical cold total', entries.length === EXPECTED_TOTAL, `${entries.length}/${EXPECTED_TOTAL}`);
check(
  'canonical cold section counts',
  JSON.stringify(actualCounts) === JSON.stringify(EXPECTED_COUNTS),
  JSON.stringify(actualCounts),
);
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
    && concordanceGenerator.includes('generated: generatedAt()')
    && !/generated:\s*new Date\(/.test(concordanceGenerator),
);
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
