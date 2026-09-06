#!/usr/bin/env node
'use strict';

// Historical compatibility entry point. The Python feed builder is the sole
// owner of RSS, ICS, subscription, and featured-feed publication. Delegating
// without a shell prevents this older command from bypassing the chronology /
// watchlist partition or restoring raw source URLs as visitor-facing links.
const path = require('path');
const {spawnSync} = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const runner = path.join(__dirname, 'run-python.js');
const builder = path.join(__dirname, 'build-polymythcal-feeds.py');
const result = spawnSync(process.execPath, [runner, builder], {
  cwd: ROOT,
  env: process.env,
  stdio: 'inherit',
});

if (result.error) {
  console.error(`Unable to run the canonical Polymythcal feed builder: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
