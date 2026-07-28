#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  isGeneratedDependencyDirectory,
} = require('./repository-walk-policy');

const ROOT = path.resolve(__dirname, '..');
const failures = [];
const shouldSkip = [
  'node_modules',
  '__pycache__',
  '.venv',
  '.venv-audit',
  'venv-ci',
  '.pytest_cache',
  '.mypy_cache',
  '.ruff_cache',
  '.tox',
  '.nox',
  'htmlcov',
  '.rsync-tmp',
  '.rsync-partial',
  '.public-build-lock',
];
const shouldKeep = ['events', 'environment', 'vendor-notes', 'teacherresources'];
for (const name of shouldSkip) {
  if (!isGeneratedDependencyDirectory(name)) failures.push(`${name} is not excluded`);
}
for (const name of shouldKeep) {
  if (isGeneratedDependencyDirectory(name)) failures.push(`${name} is excluded incorrectly`);
}

const guardedScanners = [
  'scripts/build-public-deploy.js',
  'scripts/apply-sitewide-type-zoom-link.js',
  'scripts/apply-type-floor.js',
  'scripts/apply-visible-geometry.js',
  'scripts/audit-comprehensive.js',
  'scripts/audit-external-links.js',
  'scripts/audit-external-links-live.js',
  'scripts/verify-asset-weights.js',
  'scripts/verify-audit10-remaining-website.js',
  'scripts/verify-audit11-website-decisions.js',
  'scripts/verify-audit33-evolution.js',
  'scripts/verify-csp-enforced.js',
  'scripts/verify-final8-website-polish.js',
  'scripts/verify-front-facing-boundary.js',
  'scripts/verify-keyboard-navigation.js',
  'scripts/verify-page-size-budget.js',
  'scripts/verify-reviews-zoom-font-release.js',
  'scripts/verify-site-interactivity.js',
  'scripts/verify-sitemap-classification.js',
  'scripts/verify-steady-ui.js',
  'scripts/verify-typography-controls.js',
  'scripts/verify-visible-geometry.js',
  'scripts/verify-visible-input-labels.js',
  'scripts/verify-zoom-resilience.js',
  'scripts/normalize-shared-asset-references.js',
  'scripts/apply-audit48-release-stamp.js',
  'scripts/apply-audit48-approved-ui.js',
];
for (const rel of guardedScanners) {
  const text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  if (
    !text.includes("require('./repository-walk-policy')")
    || !text.includes('isGeneratedDependencyDirectory(')
  ) {
    failures.push(`${rel} does not use the repository walk policy`);
  }
}

const typographyReport = JSON.parse(
  fs.readFileSync(
    path.join(ROOT, 'scripts/audits/typography-controls-audit.json'),
    'utf8',
  ),
);
for (const row of typographyReport.examples || []) {
  const parts = String(row.file || '').split('/');
  if (parts.some(isGeneratedDependencyDirectory)) {
    failures.push(`typography report contains generated dependency path ${row.file}`);
  }
}

for (const rel of [
  'scripts/package-netlify-source.py',
  'scripts/package-deployer-compatible.py',
]) {
  const text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  if (!text.includes('from package_selection import collect_package_files')) {
    failures.push(`${rel} does not use shared pruned package selection`);
  }
  if (text.includes("ROOT.rglob('*')")) {
    failures.push(`${rel} descends excluded trees before filtering`);
  }
}
const packageSelection = fs.readFileSync(
  path.join(ROOT, 'scripts/package_selection.py'),
  'utf8',
);
for (const marker of [
  'os.walk(root, topdown=True, followlinks=False)',
  'directory_names[:] = kept_directories',
  'generated_dependency_dir(name)',
  'at_root and (name in excluded_roots or generated_work_dir(name))',
  'is_output_transaction_artifact(candidate, output)',
]) {
  if (!packageSelection.includes(marker)) {
    failures.push(`shared package selector lacks ${marker}`);
  }
}
const deployerPackager = fs.readFileSync(
  path.join(ROOT, 'scripts/package-deployer-compatible.py'),
  'utf8',
);
for (const evidence of [
  'WEBSITE_AUDIT34_IMPECCABLE_UI_EFFICIENCY_REPORT_2026-07-23.md',
  'data/polymythcal-audit34/interaction-design-browser-audit.json',
  'data/polymythcal-audit34/entry-pages-browser-audit.json',
  'data/polymythcal-wcag22-browser-audit.json',
]) {
  if (!deployerPackager.includes(evidence)) {
    failures.push(`deployer package contract does not require ${evidence}`);
  }
}

if (failures.length) {
  console.error('REPOSITORY WALK POLICY FAILED');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log(
  `REPOSITORY WALK POLICY PASSED — ${guardedScanners.length} source scanners and both packagers prune virtual environments, dependency trees, generated caches, and package transactions.`,
);
