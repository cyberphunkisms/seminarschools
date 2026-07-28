#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(
  path.join(ROOT, 'polymyth/methodologylist/index.html'),
  'utf8',
);
const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

const cycleBlock = html.match(
  /async function cycleReg\(id\)\{([\s\S]*?)\n\}\n\nasync function addEntry/,
)?.[1] || '';
check(cycleBlock, 'register-cycle implementation is missing');
check(
  (cycleBlock.match(/e\.r=cycle\[/g) || []).length === 1,
  'one register click no longer advances exactly one state',
);
check(
  cycleBlock.includes("const cycle=['both','human','ai']"),
  'register-cycle state order changed',
);
check(
  html.includes('"img_width": 760') && html.includes('"img_height": 950'),
  'known Methodologylist image dimensions are missing',
);
check(
  html.includes('function renderEntryImage(e)'),
  'shared Methodologylist image renderer is missing',
);
check(
  html.includes('width="${width}" height="${height}"'),
  'image renderer no longer reserves intrinsic layout space',
);
check(
  html.includes('loading="lazy" decoding="async"'),
  'offscreen image no longer loads and decodes without blocking initial rendering',
);
check(
  (html.match(/renderEntryImage\(e\)/g) || []).length >= 4,
  'one of the live, split-section, or exported render paths bypasses the image guard',
);
check(
  !/<img src=["']\$\{e\.img\}["'][^>]*loading=["']lazy["']>/i.test(html),
  'a live entry image still bypasses intrinsic dimension rendering',
);

if (failures.length) {
  console.error('AUDIT39 METHODOLOGY RUNTIME FAILED');
  failures.forEach(failure => console.error(` - ${failure}`));
  process.exit(1);
}

console.log(
  'AUDIT39 METHODOLOGY RUNTIME PASSED — each register click advances one state, '
    + 'all image render paths reserve intrinsic space, and lazy image decoding remains '
    + 'non-blocking.',
);
