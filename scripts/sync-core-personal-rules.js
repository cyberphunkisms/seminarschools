#!/usr/bin/env node
'use strict';

/**
 * Synchronize the two portable CORE mirrors from their canonical
 * Methodologylist entry. The canonical HTML entry is the sole owner; this
 * script never writes back to it.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {parseSeedWithAddenda} = require('./lib/parse-seed-with-addenda');

const ROOT = path.resolve(__dirname, '..');
const DELIVERY_ROOT = path.resolve(ROOT, '..');
const CANONICAL_PATH = path.join(ROOT, 'polymyth', 'methodologylist', 'index.html');
const CORE_ID = 'core-personal-rules-current-2026-08-12';
const CORE_MAX_CHARACTERS = 5000;
const MIRRORS = [
  path.join(ROOT, 'CHARTER.txt'),
  path.join(DELIVERY_ROOT, 'Mephistodata_CORE_Personal_Rules_2026-08-12.md'),
];

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function coreLengthMetrics(document) {
  return {
    utf16Units: document.length,
    unicodeCodePoints: Array.from(document).length,
    utf8Bytes: Buffer.byteLength(document, 'utf8'),
  };
}

function validateCoreLength(document) {
  const metrics = coreLengthMetrics(document);
  if (metrics.utf16Units > CORE_MAX_CHARACTERS) {
    throw new Error(
      `portable CORE exceeds the ${CORE_MAX_CHARACTERS}-UTF-16-unit Personal Rules limit: `
      + `utf16Units=${metrics.utf16Units} `
      + `(informational: unicodeCodePoints=${metrics.unicodeCodePoints}, utf8Bytes=${metrics.utf8Bytes})`,
    );
  }
  return metrics;
}

function runCoreLengthGateSelfTest() {
  const fixtures = [
    {label: '5,000 ASCII UTF-16 units', document: 'x'.repeat(5000), accepted: true},
    {label: '5,001 ASCII UTF-16 units', document: 'x'.repeat(5001), accepted: false},
    // U+00E9 occupies one UTF-16 unit but two UTF-8 bytes. The Personal Rules
    // UI counts the former, so byte length is deliberately informational only.
    {label: '5,000 multibyte BMP UTF-16 units', document: 'é'.repeat(5000), accepted: true},
    {label: '5,001 multibyte BMP UTF-16 units', document: 'é'.repeat(5001), accepted: false},
    // U+1F600 occupies two UTF-16 units. These fixtures guard the boundary
    // against accidentally changing the gate to code-point counting.
    {label: '5,000 UTF-16 units with surrogate pairs', document: '😀'.repeat(2500), accepted: true},
    {label: '5,001 UTF-16 units with surrogate pairs', document: `${'😀'.repeat(2500)}x`, accepted: false},
  ];
  for (const fixture of fixtures) {
    let accepted = true;
    try { validateCoreLength(fixture.document); }
    catch { accepted = false; }
    if (accepted !== fixture.accepted) {
      throw new Error(
        `${fixture.label} fixture was ${accepted ? 'accepted' : 'rejected'}; `
        + `expected ${fixture.accepted ? 'acceptance' : 'rejection'}`,
      );
    }
  }
  return fixtures;
}

function loadCanonicalCore() {
  if (!fs.existsSync(CANONICAL_PATH)) {
    throw new Error(`canonical Methodologylist is missing: ${CANONICAL_PATH}`);
  }
  const entries = parseSeedWithAddenda(fs.readFileSync(CANONICAL_PATH, 'utf8'));
  const matches = entries.filter(entry => entry.id === CORE_ID);
  if (matches.length !== 1) {
    throw new Error(`canonical portable CORE id ${CORE_ID} expected once and found ${matches.length}`);
  }
  const entry = matches[0];
  if (entry.s !== 'framework-core') {
    throw new Error(`canonical portable CORE is in unexpected section: ${entry.s || '<missing>'}`);
  }
  const document = `${entry.b || ''}\n`;
  if (!document.trim()) throw new Error('canonical portable CORE body is empty');
  const lengthMetrics = validateCoreLength(document);
  return {
    id: entry.id,
    title: entry.t || '',
    section: entry.s,
    body: entry.b || '',
    document,
    lengthMetrics,
    sha256: sha256(document),
  };
}

function syncCorePersonalRules({check = false, dryRun = false, quiet = false} = {}) {
  const core = loadCanonicalCore();
  const stale = [];
  for (const target of MIRRORS) {
    const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null;
    if (current === core.document) continue;
    stale.push(target);
    if (!check && !dryRun) {
      fs.mkdirSync(path.dirname(target), {recursive: true});
      fs.writeFileSync(target, core.document, 'utf8');
    }
  }
  if (!quiet) {
    const verb = check ? 'checked' : dryRun ? 'would synchronize' : 'synchronized';
    console.log(
      `Portable CORE ${verb}: ${core.id} (${core.sha256}; `
      + `${core.lengthMetrics.utf16Units}/${CORE_MAX_CHARACTERS} UTF-16 units)`,
    );
    for (const target of MIRRORS) {
      const relative = path.relative(DELIVERY_ROOT, target).replace(/\\/g, '/');
      console.log(` - ${relative}${stale.includes(target) ? (check ? ' [STALE]' : dryRun ? ' [WOULD WRITE]' : ' [WRITTEN]') : ' [CURRENT]'}`);
    }
  }
  if (check && stale.length) {
    const names = stale.map(target => path.relative(DELIVERY_ROOT, target).replace(/\\/g, '/'));
    throw new Error(`portable CORE mirrors differ from canonical entry: ${names.join(', ')}`);
  }
  return {...core, stale};
}

if (require.main === module) {
  const args = new Set(process.argv.slice(2));
  try {
    if (args.has('--self-test-length-gate')) {
      const fixtures = runCoreLengthGateSelfTest();
      console.log(
        `CORE length self-test passed: ${fixtures.length} UTF-16 boundary fixtures; `
        + 'Unicode code points and UTF-8 bytes are informational only',
      );
      process.exit(0);
    }
    syncCorePersonalRules({check: args.has('--check'), dryRun: args.has('--dry-run')});
  } catch (error) {
    console.error(`CORE / Personal Rules sync failed: ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  CORE_MAX_CHARACTERS,
  CORE_ID,
  coreLengthMetrics,
  loadCanonicalCore,
  runCoreLengthGateSelfTest,
  syncCorePersonalRules,
  validateCoreLength,
};
