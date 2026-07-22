#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const json = rel => JSON.parse(read(rel));
const exists = rel => fs.existsSync(path.join(ROOT, rel));
const failures = [];
const check = (ok, msg) => { if (!ok) failures.push(msg); };
const release = '2026-07-22-polymythcal-audit19-final';
const releaseId = read('RELEASE_ID.txt').trim();
const releaseManifest = json('RELEASE_MANIFEST.json');
const buildManifest = json('data/polymythcal-build-manifest.json');
check(releaseId === release, `release ID mismatch: ${releaseId}`);
check(releaseManifest.release_id === release, `release manifest mismatch: ${releaseManifest.release_id}`);
check(buildManifest.build_id === 'audit19-final-predeploy-2026-07-22', `PolymythCAL build manifest is stale: ${buildManifest.build_id}`);
check(buildManifest.record_count === 839, `build manifest event count is ${buildManifest.record_count}`);
check(buildManifest.full_repository_verifier_checks === 91, 'build manifest full verifier count is not 91');
const pkg = json('package.json');
const lock = json('package-lock.json');
check(pkg.engines && pkg.engines.node === '>=24 <25', 'package Node engine is not Node 24');
check(pkg.packageManager === 'npm@11', 'package manager declaration is not npm@11');
check(read('.nvmrc').trim() === '24', '.nvmrc is not 24');
const expectedBuildParts = [
  'node scripts/build-search-pages.js',
  'node scripts/build-writing-shortcuts.js',
  'node scripts/build-academic-shortcuts.js',
  'node scripts/apply-sitewide-type-zoom-link.js',
  'node scripts/apply-type-floor.js',
  'node scripts/build-public-deploy.js',
  'node scripts/verify-polymythcal-build-efficiency.js'
];
check(typeof pkg.scripts?.build === 'string', 'package build script is missing');
for (const part of expectedBuildParts) check(pkg.scripts.build.includes(part), `package build script omits ${part}`);
const netlify = read('netlify.toml');
check(/command\s*=\s*"npm run build"/.test(netlify), 'Netlify does not call npm run build');
check(/NODE_VERSION\s*=\s*"24"/.test(netlify), 'Netlify Node version is not 24');
check(/publish\s*=\s*"public"/.test(netlify), 'Netlify publish directory is not public');
check(pkg.dependencies?.['@netlify/blobs'] === '10.1.0', 'production dependency is not exactly pinned');
check(lock.packages?.['']?.dependencies?.['@netlify/blobs'] === '10.1.0', 'lockfile root dependency is not exact');
const dep = lock.packages?.['node_modules/@netlify/blobs'];
check(dep?.version === '10.1.0' && /^sha512-/.test(dep?.integrity || ''), 'locked dependency version or integrity is invalid');
for (const rel of ['.github/dependabot.yml','.github/workflows/dependency-health.yml','.github/workflows/predeploy.yml','.github/ISSUE_TEMPLATE/polymythcal-native-at-signoff.yml','docs/POLYMYTHCAL_SCREEN_READER_TEST_PROTOCOL.md']) check(exists(rel), `${rel} is missing`);
const predeploy = read('.github/workflows/predeploy.yml');
for (const os of ['ubuntu-latest','windows-latest','macos-latest']) check(predeploy.includes(os), `predeploy matrix omits ${os}`);
for (const cmd of ['npm run build','npm run verify:all','audit-polymythcal-interactivity-design.py','audit-polymythcal-wcag22.py']) check(predeploy.includes(cmd), `predeploy workflow omits ${cmd}`);
const dependencyWorkflow = read('.github/workflows/dependency-health.yml');
check(dependencyWorkflow.includes('npm audit --omit=dev'), 'dependency workflow lacks production npm audit');
check(dependencyWorkflow.includes('verify-dependency-health.js'), 'dependency workflow lacks lockfile contract verification');
const protocol = read('docs/POLYMYTHCAL_SCREEN_READER_TEST_PROTOCOL.md');
check(protocol.includes('polymythcal-native-at-signoff.yml'), 'native AT protocol lacks release sign-off handoff');
const interactionAudit = read('scripts/audit-polymythcal-interactivity-design.py');
check(interactionAudit.includes('polymythcal-audit19'), 'interaction audit output path is stale');
check(interactionAudit.includes('resolve_chromium_path'), 'interaction audit lacks portable Chromium resolution');
const wcagAudit = read('scripts/audit-polymythcal-wcag22.py');
check(wcagAudit.includes('resolve_chromium_path'), 'WCAG audit lacks portable Chromium resolution');
const packager = read('scripts/package-netlify-source.py');
check(packager.includes('FIXED_TIME = (2026, 7, 22'), 'source package timestamp is stale');
check(packager.includes('"polymythcal-audit19"'), 'source package does not exclude Audit 19 screenshots');
if (failures.length) {
  console.error('PRE-DEPLOY AUTOMATION CONTRACT FAILED');
  failures.forEach(x => console.error(' - ' + x));
  process.exit(1);
}
console.log('PRE-DEPLOY AUTOMATION CONTRACT PASSED — release metadata, Node 24, one canonical build command, exact dependency lock, multi-platform CI, advisory checks, portable browser audits, native AT handoff, and source packaging are aligned.');
