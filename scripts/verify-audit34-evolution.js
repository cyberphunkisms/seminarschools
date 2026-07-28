#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const failures = [];
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const json = rel => JSON.parse(read(rel));
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

const releaseId = read('RELEASE_ID.txt').trim();
const release = json('RELEASE_MANIFEST.json');
const manifest = json('data/polymythcal-build-manifest.json');
check(
  fs.existsSync(path.join(ROOT, 'WEBSITE_AUDIT34_IMPECCABLE_UI_EFFICIENCY_REPORT_2026-07-23.md')),
  'Audit 34 tiered report is missing',
);
check(
  releaseId === '2026-07-23-site-audit34-impeccable-ui-efficiency-final',
  `unexpected Audit 34 release id: ${releaseId}`,
);
check(release.release_id === releaseId, 'release manifest and release ID differ');
check(
  release.polymythcal_asset_version === '20260723-audit34',
  'Audit 34 asset version is missing',
);
check(
  manifest.release_id === releaseId
    && manifest.interface_release === releaseId
    && manifest.polymythcal_asset_version === release.polymythcal_asset_version,
  'Polymythcal build manifest is not Audit 34 release-aligned',
);

const events = json('polymythseminars/events.json').events || [];
const browse = json('polymythseminars/browse.json').events || [];
const sourcesDoc = json('scripts/sources.json');
const sources = Array.isArray(sourcesDoc) ? sourcesDoc : sourcesDoc.sources || [];
const teacher = read('teacherresources/index.html');
check(events.length >= 838, `canonical event baseline regressed: ${events.length}/838`);
check(browse.length === events.length, 'browser and canonical event counts differ');
check(sources.length >= 422, `source baseline regressed: ${sources.length}/422`);
check(
  (teacher.match(/<a\b[^>]*class="entry\b/g) || []).length === 644,
  'Teacher Resources changed from 644 entries',
);
check(
  (teacher.match(/<details\b[^>]*class="category\b/g) || []).length === 25,
  'Teacher Resources changed from 25 collections',
);
check(
  (teacher.match(/<details\b[^>]*class="group\b/g) || []).length === 7,
  'Teacher Resources changed from seven groups',
);

const protest = read('.github/workflows/scrape-polymythcal-protests.yml');
const seminars = read('.github/workflows/scrape-seminars.yml');
const festivals = read('.github/workflows/scrape-festivals.yml');
const predeploy = read('.github/workflows/predeploy.yml');
check(protest.includes('18 */4 * * *'), 'held four-hour protest cadence changed');
check(protest.includes('without sharding'), 'held no-shard protest coverage changed');
check(
  !protest.includes('python3 -m unittest')
    && !protest.includes('verify:polymythcal-audit14'),
  'four-hour protest job still repeats code-change/full-browser gates',
);
check(
  seminars.includes('47 8 * * 1,4')
    && !seminars.includes('18 8 * * 1,4'),
  'seminar schedule still collides with the protest workflow',
);
check(
  !seminars.includes('Run deterministic protest harvest')
    && !seminars.includes('python3 scripts/harvest_protests.py')
    && seminars.includes('publish_deterministic_polymythcal.py --structured-only'),
  'seminar workflow still duplicates the dedicated protest crawl',
);
for (const [name, workflow] of [
  ['protest', protest],
  ['seminar', seminars],
  ['festival', festivals],
]) {
  check(
    workflow.includes('requirements-harvest.txt')
      && workflow.includes('cache: pip')
      && workflow.includes('cache-dependency-path: requirements-harvest.txt'),
    `${name} workflow lacks pinned cached Python dependencies`,
  );
  check(
    !workflow.includes('python3 -m unittest')
      && !workflow.includes('verify:polymythcal-audit14'),
    `${name} scheduled data workflow repeats predeploy verification`,
  );
  check(
    workflow.includes('if: failure()') && workflow.includes('retention-days: 7'),
    `${name} diagnostics are not failure-only with bounded retention`,
  );
}
for (const marker of [
  'npm run test:polymythcal-adapters',
  'npm run test:polymythcal-harvest',
  'npm run test:polymythcal-lifecycle',
  'node scripts/verify-polymythcal-audit14.js',
  'node scripts/verify-audit34-browser-evidence.js',
  'data/polymythcal-audit34/**',
  'retention-days: 14',
]) {
  check(predeploy.includes(marker), `predeploy lacks ${marker}`);
}
check(!predeploy.includes('polymythcal-audit21'), 'predeploy still uploads Audit 21 evidence');

const requirements = read('requirements-harvest.txt').trim().split(/\r?\n/);
check(
  requirements.length === 4 && requirements.every(line => /^[a-z0-9-]+==[^\s]+$/i.test(line)),
  'harvest dependencies are not a four-package exact lock',
);
const pkg = json('package.json');
check(
  pkg.scripts.build.includes('verify-public-deploy-parity.js'),
  'canonical build lacks complete public/source parity',
);
check(
  pkg.scripts['verify:repository-walk-policy']
    === 'node scripts/verify-repository-walk-policy.js',
  'repository walk regression gate is missing',
);
for (const historical of [
  'scripts/verify-audit33-evolution.js',
  'WEBSITE_AUDIT33_POLYMYTHCAL_TEACHERRESOURCES_REPORT_2026-07-23.md',
  'WEBSITE_CL_AUDIT33_2026-07-23.md',
]) {
  check(fs.existsSync(path.join(ROOT, historical)), `${historical} historical evidence is missing`);
}

if (failures.length) {
  console.error('AUDIT 34 EVOLUTION GATE FAILED');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log(
  `AUDIT 34 EVOLUTION GATE PASSED — ${events.length} events, ${sources.length} sources, 644 Teacher Resources, no duplicate protest crawl, bounded scheduled verification, and fresh-browser/full-predeploy gate contracts.`,
);
