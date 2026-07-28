#!/usr/bin/env node
'use strict';

const assert = require('assert');
const {
  DEFAULT_VISUAL_THRESHOLDS,
  compareVisualSignatures,
} = require('./lib/audit42-png-signature');

function signature() {
  const columns = 32;
  const rows = 18;
  return {
    width: 2560,
    height: 1080,
    sha256: 'baseline',
    sampling: {
      grid_columns: columns,
      grid_rows: rows,
    },
    mean_rgb: [120, 122, 124],
    luma_histogram: [
      0.03, 0.03, 0.04, 0.04, 0.05, 0.06, 0.08, 0.12,
      0.12, 0.11, 0.09, 0.08, 0.06, 0.04, 0.03, 0.02,
    ],
    edge_density: 0.13,
    grid_rgb: Array.from({ length: columns * rows }, () => [120, 122, 124]),
  };
}

const baseline = signature();
const tinyNoise = structuredClone(baseline);
tinyNoise.sha256 = 'tiny-noise';
tinyNoise.mean_rgb = [120.8, 121.4, 124.6];
tinyNoise.edge_density += 0.002;
tinyNoise.grid_rgb = tinyNoise.grid_rgb.map((cell, index) => (
  cell.map((channel, channelIndex) => (
    channel + ((index + channelIndex) % 3) - 1
  ))
));
assert(
  compareVisualSignatures(
    baseline,
    tinyNoise,
    DEFAULT_VISUAL_THRESHOLDS,
  ).pass,
  'tiny distributed rendering noise should be tolerated',
);

const paletteDrift = structuredClone(baseline);
paletteDrift.sha256 = 'palette-drift';
paletteDrift.mean_rgb = [134, 136, 138];
paletteDrift.grid_rgb = paletteDrift.grid_rgb.map(cell => cell.map(value => value + 14));
assert(
  !compareVisualSignatures(
    baseline,
    paletteDrift,
    DEFAULT_VISUAL_THRESHOLDS,
  ).pass,
  'broad palette drift should fail',
);

const localDrift = structuredClone(baseline);
localDrift.sha256 = 'local-drift';
for (let y = 0; y < 3; y += 1) {
  for (let x = 0; x < 8; x += 1) {
    const index = y * 32 + x;
    localDrift.grid_rgb[index] = [220, 40, 40];
  }
}
assert(
  !compareVisualSignatures(
    baseline,
    localDrift,
    DEFAULT_VISUAL_THRESHOLDS,
  ).pass,
  'a contiguous changed component should fail even below five percent',
);

const resized = structuredClone(baseline);
resized.width = 2559;
assert(
  !compareVisualSignatures(
    baseline,
    resized,
    DEFAULT_VISUAL_THRESHOLDS,
  ).pass,
  'viewport dimension drift should fail',
);

console.log(
  'AUDIT 42 VISUAL BASELINE SELF-TEST PASSED — tiny noise is tolerated; '
    + 'palette, contiguous-region, and dimension drift fail.',
);
