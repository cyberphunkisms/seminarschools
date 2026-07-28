#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  DEFAULT_VISUAL_THRESHOLDS,
  compareVisualSignatures,
  visualSignature,
} = require('./lib/audit42-png-signature');

const ROOT = path.resolve(__dirname, '..');
const SCREENSHOTS = path.join(
  ROOT,
  'data',
  'audit42-multimode-browser',
  'screenshots',
);
const OUTPUT = path.join(ROOT, 'data', 'audit42-visual-baseline.json');
const CHECK = process.argv.includes('--check');

const FAMILIES = [
  ['home', '/'],
  ['polymythcal', '/polymythseminars/'],
  ['teacher-resources', '/teacherresources/'],
  ['bb', '/polymyth/bookwormburrows/'],
  ['bookwormcard', '/bookwormcard/'],
  ['thank-you-mam', '/campaigns/thank-you-mam/'],
  ['thank-you-mam-pregame', '/campaigns/thank-you-mam/pregame/'],
];

const MODES = [
  ['ultrawide', 'ultrawide'],
  ['foldable-landscape', 'foldable_landscape'],
];

function build() {
  const browserReport = JSON.parse(fs.readFileSync(
    path.join(
      ROOT,
      'data',
      'audit42-multimode-browser',
      'multimode-browser-audit.json',
    ),
    'utf8',
  ));
  const images = [];
  for (const [family, route] of FAMILIES) {
    for (const [filePrefix, mode] of MODES) {
      const file = `${filePrefix}-${family}.png`;
      const absolute = path.join(SCREENSHOTS, file);
      if (!fs.existsSync(absolute)) {
        throw new Error(`required Audit 42 screenshot is missing: ${file}`);
      }
      images.push({
        family,
        route,
        mode,
        file: `data/audit42-multimode-browser/screenshots/${file}`,
        signature: visualSignature(absolute),
      });
    }
  }

  return {
    schema: 'seminar-schools-audit42-tolerant-visual-baseline-v1',
    release: browserReport.release,
    captured_at: browserReport.generated_at,
    scope: {
      route_families: FAMILIES.length,
      viewport_modes: MODES.map(([, mode]) => mode),
      image_count: images.length,
    },
    comparison_contract: {
      exact_sha256_is_fast_path_only: true,
      dimensions_must_remain_exact: true,
      thresholds: DEFAULT_VISUAL_THRESHOLDS,
      rationale: [
        'A 32 by 18 block-color signature, luminance histogram, global color mean, and edge density are compared instead of compressed PNG bytes.',
        'The thresholds tolerate tiny antialiasing, font rasterization, and compression noise while rejecting broad palette, layout, density, or contiguous-region drift.',
        'A small isolated icon or a few rasterized glyph pixels may change without failing; this gate is a maintenance regression detector, not a pixel-perfect design approval.',
      ],
    },
    images,
  };
}

const baseline = build();
const serialized = `${JSON.stringify(baseline, null, 2)}\n`;
if (CHECK) {
  let recorded;
  try {
    recorded = JSON.parse(fs.readFileSync(OUTPUT, 'utf8'));
  } catch (error) {
    console.error(`AUDIT 42 VISUAL BASELINE CHECK FAILED — ${error.message}`);
    process.exit(1);
  }
  const recordedByFile = new Map(
    (recorded.images || []).map(row => [row.file, row]),
  );
  const drift = [];
  let exact = 0;
  let tolerant = 0;
  for (const candidate of baseline.images) {
    const prior = recordedByFile.get(candidate.file);
    if (!prior) {
      drift.push(`${candidate.file} is absent from the recorded baseline`);
      continue;
    }
    const result = compareVisualSignatures(
      prior.signature,
      candidate.signature,
      recorded.comparison_contract?.thresholds || DEFAULT_VISUAL_THRESHOLDS,
    );
    if (!result.pass) {
      drift.push(`${candidate.file}: ${result.reasons.join('; ')}`);
    } else if (result.exact) exact += 1;
    else tolerant += 1;
  }
  if (recordedByFile.size !== baseline.images.length) {
    drift.push(
      `recorded image count ${recordedByFile.size} does not match `
        + `expected image count ${baseline.images.length}`,
    );
  }
  if (drift.length) {
    console.error(
      'AUDIT 42 VISUAL BASELINE CHECK FAILED — meaningful visual drift was detected:',
    );
    for (const message of drift) console.error(`- ${message}`);
    process.exit(1);
  }
  console.log(
    `AUDIT 42 VISUAL BASELINE CHECK PASSED — ${baseline.scope.image_count} `
      + `screenshots across ${baseline.scope.route_families} route families `
      + `(${exact} exact, ${tolerant} tolerance-matched).`,
  );
} else {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, serialized);
  console.log(
    `AUDIT 42 VISUAL BASELINE WRITTEN — ${baseline.scope.image_count} `
      + `screenshots across ${baseline.scope.route_families} route families.`,
  );
}
