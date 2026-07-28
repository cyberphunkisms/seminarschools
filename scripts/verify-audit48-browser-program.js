#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PROGRAM = path.join(ROOT, 'scripts', 'audit48-cross-engine-browser.js');
const PREFLIGHT = path.join(ROOT, 'data', 'audit48-browser', 'cross-engine-preflight.json');
const EXECUTION = path.join(ROOT, 'data', 'audit48-browser', 'cross-engine-browser-audit.json');
const PACKAGE = path.join(ROOT, 'package.json');
const LOCK = path.join(ROOT, 'package-lock.json');
const MANIFEST = path.join(ROOT, 'RELEASE_MANIFEST.json');
const checks = [];

function check(name, passed, detail = '') {
  checks.push({ name, passed: Boolean(passed), detail: String(detail ?? '') });
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

check('cross-engine audit program exists', fs.existsSync(PROGRAM), PROGRAM);
check('cross-engine preflight evidence exists', fs.existsSync(PREFLIGHT), PREFLIGHT);

if (fs.existsSync(PROGRAM) && fs.existsSync(PREFLIGHT)) {
  const source = fs.readFileSync(PROGRAM, 'utf8');
  const preflight = JSON.parse(fs.readFileSync(PREFLIGHT, 'utf8'));
  const packageJson = JSON.parse(fs.readFileSync(PACKAGE, 'utf8'));
  const lock = JSON.parse(fs.readFileSync(LOCK, 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const lockVersion = lock.packages
    && lock.packages['node_modules/playwright']
    && lock.packages['node_modules/playwright'].version;
  const names = (preflight.engines || []).map(item => item.name).sort();
  const scenarioIds = (preflight.scenarios || []).map(item => item.id);

  check('preflight schema is current',
    preflight.schema === 'seminar-schools-audit48-cross-engine-preflight-v1',
    preflight.schema);
  check('preflight is bound to the current release',
    preflight.release_id === manifest.release_id
      && preflight.generated_at === manifest.generated_at,
    `${preflight.release_id}/${preflight.generated_at}`);
  check('preflight is bound to the exact audit program',
    preflight.source_program_sha256 === sha256(PROGRAM),
    `${preflight.source_program_sha256} / ${sha256(PROGRAM)}`);
  check('preflight distinguishes readiness from execution',
    ['ready', 'incomplete'].includes(preflight.status)
      && ['pending', 'blocked'].includes(preflight.execution_status),
    `${preflight.status}/${preflight.execution_status}`);
  check('preflight makes no runtime pass claim',
    preflight.claims
      && preflight.claims.runtime_checks_executed === 0
      && preflight.claims.runtime_pass_claimed === false,
    JSON.stringify(preflight.claims));
  const serializedPreflight = JSON.stringify(preflight);
  check('preflight browser locators are portable cache tokens',
    /^\$PLAYWRIGHT_(?:BROWSERS_PATH|DEFAULT_CACHE)$/.test(preflight.browser_storage || '')
      && (preflight.engines || []).every(item =>
        !item.executable_path
          || /^\$PLAYWRIGHT_(?:BROWSERS_PATH|DEFAULT_CACHE|BROWSER_CACHE)\//.test(
            item.executable_path,
          )),
    JSON.stringify({
      browser_storage: preflight.browser_storage,
      executable_paths: (preflight.engines || []).map(item => item.executable_path),
    }));
  check('preflight contains no workspace-specific absolute paths',
    !serializedPreflight.includes('/workspace/')
      && !serializedPreflight.includes('/tmp/')
      && !serializedPreflight.includes('c4e7f14d426b'),
    'portable evidence contains no scratch-workspace path');
  check('program targets Firefox and WebKit exactly',
    names.length === 2 && names[0] === 'firefox' && names[1] === 'webkit',
    names.join(','));
  check('program covers both desktop and mobile viewports',
    (preflight.scenarios || []).some(item => item.viewport === 'desktop')
      && (preflight.scenarios || []).some(item => item.viewport === 'mobile'));
  check('program covers at least twelve route/viewport scenarios',
    preflight.scenario_count >= 12
      && preflight.intended_engine_scenario_count === preflight.scenario_count * 2,
    `${preflight.scenario_count}/${preflight.intended_engine_scenario_count}`);
  check('program covers high-value cross-engine surfaces',
    [
      'leizu-fa-mobile',
      'leizu-zh-hans-intake-mobile',
      'polymythcal-fr-desktop',
      'teacherresources-language-filter-desktop',
      'bb-why-zh-mobile',
      'methodologylist-search-desktop',
      'campaigncodex-search-mobile',
    ].every(id => scenarioIds.includes(id)),
    scenarioIds.join(','));
  check('program blocks external requests during execution',
    preflight.external_requests === 'blocked-during-execution'
      && source.includes("return route.abort('blockedbyclient')"),
    preflight.external_requests);
  check('program records per-engine runtime results',
    source.includes('engine_results: engineResults')
      && source.includes("status: engineChecks.every(item => item.passed) ? 'passed' : 'failed'"));
  check('program enforces overflow, landmark, keyboard, local-response and exception checks',
    [
      'Document has no horizontal overflow',
      'Exactly one main landmark remains',
      'Keyboard focus enters the document',
      'Local requests avoid failed responses',
      'Page emits no uncaught exceptions',
    ].every(marker => source.includes(marker)));
  check('program preserves translation-governance checks',
    source.includes('High-stakes translation review state remains declared')
      && source.includes('Organizer title declares its source language')
      && source.includes('English references retain source-language boundaries'));
  check('program preserves the BB teacher-led boundary',
    source.includes('Campaign codex remains an archive rather than a session runner'));
  check('Playwright package and lock versions match exactly',
    packageJson.devDependencies
      && packageJson.devDependencies.playwright === lockVersion,
    `${packageJson.devDependencies && packageJson.devDependencies.playwright}/${lockVersion}`);
  check('preflight records the installed Playwright version',
    preflight.playwright_version === lockVersion,
    `${preflight.playwright_version}/${lockVersion}`);
  check('preflight cites official Playwright browser documentation',
    Array.isArray(preflight.references)
      && preflight.references.includes('https://playwright.dev/docs/browsers'));
  check('preflight records Firefox/WebKit/Safari limitations',
    Array.isArray(preflight.limitations)
      && preflight.limitations.some(item => /branded Firefox/.test(item))
      && preflight.limitations.some(item => /not branded Safari/.test(item))
      && preflight.limitations.some(item => /native macOS Safari/.test(item)));

  if (fs.existsSync(EXECUTION)) {
    const execution = JSON.parse(fs.readFileSync(EXECUTION, 'utf8'));
    const engineResults = execution.engine_results || [];
    check('runtime report never passes with a missing or failed engine',
      execution.status !== 'passed'
        || (
          engineResults.length === 2
          && engineResults.every(item => item.status === 'passed')
          && execution.checks_failed === 0
          && execution.checks_passed === execution.checks_total
        ),
      `${execution.status}/${JSON.stringify(engineResults)}`);
    check('runtime report is bound to the exact audit program',
      execution.source_program_sha256 === sha256(PROGRAM),
      `${execution.source_program_sha256}/${sha256(PROGRAM)}`);
  } else {
    check('absent runtime report remains classified as unexecuted',
      preflight.execution_status !== 'passed',
      preflight.execution_status);
  }
}

const failed = checks.filter(item => !item.passed);
if (failed.length) {
  console.error(`AUDIT 48 BROWSER PROGRAM GATE FAILED — ${failed.length}/${checks.length} checks failed.`);
  for (const item of failed) console.error(`- ${item.name}: ${item.detail}`);
  process.exit(1);
}

const preflight = JSON.parse(fs.readFileSync(PREFLIGHT, 'utf8'));
const available = preflight.engines
  .filter(item => item.installed && item.executable)
  .map(item => item.name)
  .join(', ') || 'none';
console.log(
  `AUDIT 48 BROWSER PROGRAM GATE PASSED — ${checks.length}/${checks.length} checks; `
  + `runtime evidence ${preflight.execution_status}; browser executable files present: ${available}.`,
);
