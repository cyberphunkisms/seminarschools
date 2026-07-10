#!/usr/bin/env node
'use strict';
/**
 * Guards the 2026-06-11 BB campaign ruling across canonical HTML, generated
 * text mirrors, and the regen orchestrator. This keeps routine regen from
 * silently erasing campaign content.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
let fail = 0;
function read(rel) { try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch { return ''; } }
function check(name, ok) { console.log((ok ? 'PASS' : 'FAIL') + '  ' + name); if (!ok) fail = 1; }
const canonical = read('polymyth/campaigncodex/index.html');
const mirror = read('polymyth/campaigncodex.txt');
const regen = read('scripts/regen-all-txt.js');
const pkg = JSON.parse(read('package.json') || '{}');
check('canonical campaigncodex carries current BB ruling', canonical.includes('Current BB ruling for campaigns') && canonical.includes('cc-cmp001-landing-after'));
check('campaigncodex text mirror carries current BB ruling', mirror.includes('CURRENT BB / POLYMYTHDND CAMPAIGN RULING') && mirror.includes('cc-cmp001-landing-after'));
check('regen-all rebuilds campaigncodex text mirror', regen.includes('regen-campaigncodex-txt.js'));
check('regen-all rebuilds methodologylist section mirrors', regen.includes('regen-methodologylist-sections-txt.js'));
check('regen-all rebuilds methodologylist manifest', regen.includes('regen-methodologylist-manifest.js'));
check('regen-all rebuilds concordance index', regen.includes('regen-concordance-index.js'));
check('bb clarification gate is inside full release verification', read('scripts/verify-all-runner.js').includes('verify-bb-clarification.js'));
check('package exposes regen:all-txt', pkg.scripts && pkg.scripts['regen:all-txt'] === 'node scripts/regen-all-txt.js');
if (fail) {
  console.error('\nREGEN SAFETY CHECK FAILED');
  process.exit(1);
}
console.log('\nREGEN SAFETY CHECK PASSED');
