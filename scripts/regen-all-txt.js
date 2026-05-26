#!/usr/bin/env node
/**
 * regen-all-txt.js
 *
 * Convenience wrapper that regenerates all four star-file .txt mirrors:
 *   - polymyth/methodologylist.txt (from polymyth/methodologylist/index.html)
 *   - polymyth/modulecanon.txt     (from polymyth/modulecanon/index.html)
 *   - polymyth/bookwormburrows.txt (from polymyth/bookwormburrows/index.html)
 *   - polymyth/campaigncodex.txt   (from polymyth/campaigncodex/index.html)
 *
 * Runs the four sibling regen scripts in sequence, reports consolidated
 * per-file delta, returns aggregate exit code (0 if all succeeded; non-zero
 * count of failures otherwise).
 *
 * Usage:
 *   node scripts/regen-all-txt.js
 *   node scripts/regen-all-txt.js --dry-run
 *
 * Origin: 2026-05-10, .txt mirror trifecta convenience wrapper.
 * 2026-05-12: lifted ml* DEFERRED status; orchestrator now covers all four star files.
 */

'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');

const scriptDir = path.dirname(__filename);
const projectRoot = path.dirname(scriptDir);

const STEPS = [
  { name: 'methodologylist', script: 'regen-methodologylist-txt.js', txtPath: 'polymyth/methodologylist.txt' },
  { name: 'modulecanon',     script: 'regen-modulecanon-txt.js',     txtPath: 'polymyth/modulecanon.txt' },
  { name: 'bookwormburrows', script: 'regen-bookwormburrows-txt.js', txtPath: 'polymyth/bookwormburrows.txt' },
  { name: 'campaigncodex',   script: 'regen-campaigncodex-txt.js',   txtPath: 'polymyth/campaigncodex.txt' },
];

let failures = 0;
const results = [];

for (const step of STEPS) {
  const scriptPath = path.join(scriptDir, step.script);
  const txtFullPath = path.join(projectRoot, step.txtPath);
  const before = fs.existsSync(txtFullPath) ? fs.statSync(txtFullPath).size : 0;
  try {
    const cmd = 'node ' + JSON.stringify(scriptPath) + (dryRun ? ' --dry-run' : '');
    const stdout = execSync(cmd, { cwd: projectRoot, encoding: 'utf-8' });
    const after = fs.existsSync(txtFullPath) ? fs.statSync(txtFullPath).size : 0;
    const delta = after - before;
    results.push({ name: step.name, ok: true, before, after, delta, stdout });
    console.log('[' + step.name + '] OK (' + before + ' -> ' + after + ', delta ' + (delta >= 0 ? '+' : '') + delta + ')');
  } catch (err) {
    failures++;
    results.push({ name: step.name, ok: false, error: err.message });
    console.error('[' + step.name + '] FAIL:', err.message);
  }
}

console.log();
console.log('========================================================================');
console.log('Quartet regen ' + (failures === 0 ? 'COMPLETE' : 'FAILED'));
console.log(failures === 0 ? '0 failures' : (failures + ' / ' + STEPS.length + ' failures'));
console.log('========================================================================');

process.exit(failures);
