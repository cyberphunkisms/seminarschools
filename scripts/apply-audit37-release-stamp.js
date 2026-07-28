#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  isGeneratedDependencyDirectory,
} = require('./repository-walk-policy');

const ROOT = path.resolve(__dirname, '..');
const OLD_ASSET = '20260724-audit36';
const NEW_ASSET = '20260724-audit37';
const RELEASE_ID = '2026-07-24-site-audit37-source-health-runtime-polish-final';
const GENERATED_AT = '2026-07-24T13:15:00-04:00';
const FUTURE_MTIME = new Date('2034-01-01T00:00:00Z');
const TEMP_DIR = fs.mkdtempSync(path.join(ROOT, '.audit37-stamp-'));
const TEXT_EXTENSIONS = new Set([
  '.css', '.html', '.js', '.json', '.md', '.py', '.toml', '.txt', '.xml',
  '.xsl', '.yaml', '.yml',
]);
const HISTORICAL_EXACT = new Set([
  'WEBSITE_AUDIT33_POLYMYTHCAL_TEACHERRESOURCES_REPORT_2026-07-23.md',
  'WEBSITE_CL_AUDIT33_2026-07-23.md',
  'WEBSITE_AUDIT34_IMPECCABLE_UI_EFFICIENCY_REPORT_2026-07-23.md',
  'POLYMYTHCAL_WCAG22_AA_AUDIT34_2026-07-23.md',
  'WEBSITE_AUDIT35_BUILD_RUNTIME_RESILIENCE_REPORT_2026-07-23.md',
  'WEBSITE_AUDIT35_RESILIENCE_POLISH_REPORT_2026-07-23.md',
  'POLYMYTHCAL_WCAG22_AA_AUDIT35_2026-07-23.md',
  'WEBSITE_AUDIT36_DISCOVERY_RESILIENCE_REPORT_2026-07-24.md',
  'data/polymythcal-wcag22-browser-audit.json',
  'data/audit35-frozen-sha256.json',
  'data/audit36-frozen-sha256.json',
  'scripts/reports/audit35-project-failure-stress.json',
  'scripts/verify-audit33-evolution.js',
  'scripts/verify-audit34-evolution.js',
  'scripts/verify-audit34-browser-evidence.js',
  'scripts/apply-audit34-release-stamp.js',
  'scripts/verify-audit35-route-ui.mjs',
  'scripts/verify-audit35-evolution.js',
  'scripts/verify-audit35-browser-evidence.js',
  'scripts/audit-audit35-route-resilience.py',
  'scripts/apply-audit35-release-stamp.js',
  'scripts/apply-audit36-release-stamp.js',
  'scripts/audit-audit36-route-resilience.py',
  'scripts/audit-polymythcal-entry-pages-audit36.py',
  'scripts/audit-polymythcal-interactivity-design-audit36.py',
  'scripts/audit-polymythcal-wcag22-audit36.py',
  'scripts/audit-project-failure-stress-audit36.py',
  'scripts/verify-audit36-visual-p0.mjs',
  'scripts/verify-audit36-graph-resilience.mjs',
  'scripts/verify-audit36-animation-lifecycle.mjs',
  'scripts/verify-audit36-artifact-atomicity.js',
  'scripts/verify-audit36-aa-dialog.mjs',
  'scripts/verify-audit36-aitr-resilience.mjs',
  'scripts/verify-audit36-browser-evidence.js',
  'scripts/verify-audit36-evolution.js',
  'scripts/apply-audit37-release-stamp.js',
]);
const HISTORICAL_PREFIXES = [
  'data/polymythcal-audit34/',
  'data/polymythcal-audit35/',
  'data/audit35-route-browser/',
  'data/polymythcal-audit36/',
  'data/audit36-route-browser/',
];
let changed = 0;
let temporaryFileIndex = 0;

function atomicWrite(target, content) {
  const stat = fs.existsSync(target) ? fs.statSync(target) : null;
  const temporary = path.join(
    TEMP_DIR,
    `${String(temporaryFileIndex).padStart(6, '0')}-${path.basename(target)}`,
  );
  temporaryFileIndex += 1;
  fs.writeFileSync(temporary, content, {
    mode: stat ? stat.mode : 0o644,
  });
  if (stat) fs.chmodSync(temporary, stat.mode);
  fs.utimesSync(temporary, FUTURE_MTIME, FUTURE_MTIME);
  fs.renameSync(temporary, target);
}

function posix(value) {
  return value.replace(/\\/g, '/');
}

function isHistorical(rel) {
  return HISTORICAL_EXACT.has(rel)
    || HISTORICAL_PREFIXES.some(prefix => rel.startsWith(prefix))
    || rel.startsWith('scripts/audits/')
    || rel.startsWith('scripts/reports/');
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (
      ['.git', '.netlify', 'node_modules', 'public'].includes(entry.name)
      || isGeneratedDependencyDirectory(entry.name)
    ) {
      continue;
    }
    const full = path.join(dir, entry.name);
    const rel = posix(path.relative(ROOT, full));
    if (entry.isDirectory()) {
      walk(full);
      continue;
    }
    if (
      !entry.isFile()
      || !TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())
      || isHistorical(rel)
    ) {
      continue;
    }
    const before = fs.readFileSync(full, 'utf8');
    if (!before.includes(OLD_ASSET)) continue;
    atomicWrite(full, before.split(OLD_ASSET).join(NEW_ASSET));
    changed += 1;
  }
}

walk(ROOT);
atomicWrite(path.join(ROOT, 'RELEASE_ID.txt'), `${RELEASE_ID}\n`);

const manifestPath = path.join(ROOT, 'RELEASE_MANIFEST.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
manifest.release_id = RELEASE_ID;
manifest.generated_at = GENERATED_AT;
manifest.polymythcal_asset_version = NEW_ASSET;
manifest.release_type = 'Audit 37 structured source-health integrity, cross-project UI semantics, and no-backtracking release';
manifest.notes = [
  'Polymythcal preserves 838 canonical listings, 32 types, 422 registered sources, 595 qualified unconfirmed records, 24-item batches, and the four-hour unsharded protest crawl.',
  'All 41 priority sources remain deterministic every scheduled run; 213 additional compatible sources now complete one stable four-run rotation without increasing the twice-weekly schedule or paid-agent frequency.',
  'The main structured source crawl now shares the proven protest source-health evaluator and fails closed when every selected source is blocked, fetch-failed, parser-regressed, missing, duplicated, or otherwise non-authoritative.',
  'Structured failure diagnostics are written before exit and retained by the workflow; both deterministic publication and the direct fallback merger independently reject missing, failed, incomplete, forged, or diagnostics-inconsistent gates.',
  'A genuinely observed confirmed-empty source remains publishable, so the stricter gate distinguishes empty calendars from discovery collapse without inventing events.',
  'Teacher Resources preserves 644 resources, 25 collections, and seven groups while adding semantic current-page state and an announced search shortcut. Core project routes retain their distinct visual and pedagogical voices.',
  'Sixteen selected Audit 36 reports and gates are SHA-256 frozen as historical evidence. Existing scraper schedules, paid-agent frequency, source rotation, festival sharding, animation lifecycle, atomic builds, and package rollback remain unchanged. Security assessment remains outside this release.',
];
atomicWrite(
  manifestPath,
  JSON.stringify(manifest, null, 2) + '\n',
);

const buildManifestPath = path.join(
  ROOT,
  'data',
  'polymythcal-build-manifest.json',
);
const buildManifest = JSON.parse(
  fs.readFileSync(buildManifestPath, 'utf8'),
);
buildManifest.build_id = RELEASE_ID;
buildManifest.release_id = RELEASE_ID;
buildManifest.generated_at = GENERATED_AT;
buildManifest.interface_release = RELEASE_ID;
buildManifest.polymythcal_asset_version = NEW_ASSET;
atomicWrite(
  buildManifestPath,
  JSON.stringify(buildManifest, null, 2) + '\n',
);
fs.rmdirSync(TEMP_DIR);

console.log(
  `AUDIT 37 RELEASE STAMP APPLIED — ${changed} active files moved from ${OLD_ASSET} to ${NEW_ASSET}; Audit 36 evidence preserved.`,
);
