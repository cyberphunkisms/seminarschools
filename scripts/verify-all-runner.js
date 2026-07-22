#!/usr/bin/env node
'use strict';
/**
 * Fast full verifier. Keeps the full guard set from the old shell chain while
 * avoiding a single slow, hard-to-diagnose command line. The public deploy
 * surface is built first; the remaining read-only guards run with bounded
 * concurrency.
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const sequential = [
  'node scripts/build-public-deploy.js',
  'node scripts/verify-meaninglib-search.js'
];

const checks = [
  'node scripts/verify-critical.js',
  'node scripts/verify-predeploy-automation.js',
  'node scripts/verify-methodologylist-manifest.js',
  'node scripts/verify-regen-safety.js',
  'node scripts/verify-data-hygiene.js',
  'node scripts/verify-csp-enforced.js',
  'node scripts/verify-external-link-workflow.js',
  'node scripts/verify-release-gates.js',
  'node scripts/verify-public-artifact-blocks.js',
  'node scripts/verify-final6-deploy-contract.js',
  'node scripts/verify-npm-public-registry.js',
  'node scripts/verify-search-surface.js',
  'node scripts/verify-calendar-aliases.js',
  'node scripts/verify-calendar-data-parity.js',
  'node scripts/verify-polymythcalendar-today-scroll.js',
  'node scripts/verify-polymythcalendar-kid-guide.js',
  'node scripts/verify-polymythcalendar-ux-efficiency.js',
  'node scripts/verify-polymythcal-scraper-layout.js',
  'node scripts/verify-polymythcal-scraper-ui.js',
  'node scripts/run-python.js scripts/audit-polymythcal-entry-pages.py',
  'node scripts/verify-site-interactivity.js',
  'node scripts/build-writing-shortcuts.js --check',
  'node scripts/verify-writing-shortcuts.js',
  'node scripts/build-academic-shortcuts.js --check',
  'node scripts/verify-academic-shortcuts.js',
  'node scripts/verify-festival-parent-taxonomy.js',
  'node scripts/verify-harvest-pipeline.js',
  'node scripts/verify-polymythcalendar-name.js',
  'node scripts/verify-geometry.js',
  'node scripts/verify-visible-geometry.js',
  'node scripts/verify-zoom-resilience.js',
  'node scripts/verify-reviews-zoom-font-release.js',
  'node scripts/verify-register.js',
  'node scripts/verify-route-doctrine.js',
  'node scripts/verify-page-type-contracts.js',
  'node scripts/verify-pathfinder-nav.js',
  'node scripts/verify-page-size-budget.js',
  'node scripts/verify-heavy-page-resilience.js',
  'node scripts/verify-generated-route-indexing.js',
  'node scripts/verify-sitemap-classification.js',
  'node scripts/verify-keyboard-navigation.js',
  'node scripts/verify-responsive-regression.js',
  'node scripts/verify-saul-print.js',
  'node scripts/verify-saul-modular-cv.js',
  'node scripts/verify-saul-cv-whitespace.js',
  'node scripts/verify-teacherresources-finder.js',
  'node scripts/verify-aa-polymyth-funnel.js',
  'node scripts/verify-polymythcal-freshness-labels.js',
  'node scripts/verify-shortcut-title-uniqueness.js',
  'node scripts/verify-visible-input-labels.js',
  'node scripts/audit-external-links.js',
  'node scripts/verify-dense-anchors.js',
  'node scripts/verify-asset-weights.js',
  'node scripts/verify-payments.js',
  'node scripts/verify-leizu-pipeline.js',
  'node scripts/verify-leizu-experience.js',
  'node scripts/verify-leizu-course-picker.js',
  'node scripts/verify-leizu-simplified-chinese.js',
  'node scripts/verify-leizu-persian.js',
  'node scripts/verify-leizu-localization-funnel.js',
  'node scripts/verify-home-map.js',
  'node scripts/verify-bb-clarification.js',
  'node scripts/verify-bb-final-readiness.js',
  'node scripts/verify-bb-kid-friendly.js',
  'node scripts/verify-bb-why.js',
  'node scripts/verify-bbt-upcoming.js',
  'node scripts/verify-main-page.js',
  'node scripts/verify-main-leizu-funnel.js',
  'node scripts/verify-saul-page.js',
  'node scripts/verify-saul-visual-governance.js',
  'node scripts/verify-saul-performance-synthesis.js',
  'node scripts/verify-final8-website-polish.js',
  'node scripts/verify-final9-mephistodata-website-hardening.js',
  'node scripts/verify-audit10-remaining-website.js',
  'node scripts/verify-audit11-website-decisions.js',
  'node scripts/verify-audit12-mobile-web-hybrid.js',
  'node scripts/verify-front-facing-boundary.js',
  'node scripts/verify-polymyth-entry-points.js',
  'node scripts/verify-meaninglib-dataset.js',
  'node scripts/verify-linkability-overhaul.js',
  'node scripts/verify-meaninglib-dashboard.js',
  'node scripts/verify-ml-stop-psychologism.js',
  'node scripts/verify-ml-ai-prose-tells.js',
  'node scripts/verify-ml-antibacktracking.js',
  'node scripts/verify-ai-access-pack.js',
  'node scripts/verify-site-integrity.js',
  'node scripts/verify-professional-readiness.js',
  'node scripts/verify-seo.js',
  'node scripts/verify-typography-controls.js',
  'node scripts/verify-bookwormcard-gate.js'
];
const concurrency = Number(process.env.VERIFY_ALL_CONCURRENCY || 4);
const releaseManifest = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'RELEASE_MANIFEST.json'), 'utf8'));
const releaseTimestamp = releaseManifest.generated_at || '1970-01-01T00:00:00Z';
function run(cmd, { quiet = true } = {}) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const child = spawn(cmd, { shell: true, stdio: quiet ? ['ignore', 'pipe', 'pipe'] : 'inherit' });
    let out = '', err = '';
    if (quiet) {
      child.stdout.on('data', d => { out += d; if (out.length > 24000) out = out.slice(-24000); });
      child.stderr.on('data', d => { err += d; if (err.length > 24000) err = err.slice(-24000); });
    }
    child.on('close', code => {
      const ms = Date.now() - start;
      if (code === 0) return resolve({ cmd, ms, out });
      const e = new Error(`${cmd} failed with exit ${code}`);
      e.cmd = cmd; e.code = code; e.out = out; e.err = err; e.ms = ms;
      reject(e);
    });
    child.on('error', reject);
  });
}
function writeGateReport(status, started, passedCommands, failures) {
  const reportDir = path.join(process.cwd(), 'scripts', 'reports');
  fs.mkdirSync(reportDir, { recursive: true });
  const total = checks.length + sequential.length;
  const report = {
    generated_at: releaseTimestamp,
    status,
    total_checks: total,
    passed_checks: passedCommands.length,
    failed_checks: failures.map(e => ({ cmd: e.cmd, code: e.code || 1, ms: e.ms || null })),
    duration_ms: null,
    duration_note: 'Runtime duration is printed to the console and intentionally omitted from committed evidence.',
    rule: 'Every command in scripts/verify-all-runner.js is a release blocker.'
  };
  fs.writeFileSync(path.join(reportDir, 'release-gate-report.json'), JSON.stringify(report, null, 2) + '\n');
}
async function main() {
  const started = Date.now();
  const passedCommands = [];
  console.log(`VERIFY ALL FAST — ${checks.length + sequential.length} checks, concurrency ${concurrency}`);
  for (const cmd of sequential) {
    const r = await run(cmd, { quiet: true });
    console.log(`PASS ${String(r.ms).padStart(6)}ms  ${cmd}`);
    passedCommands.push(cmd);
  }
  let index = 0, passed = 0;
  const failures = [];
  async function worker() {
    while (true) {
      const i = index++;
      if (i >= checks.length || failures.length) return;
      const cmd = checks[i];
      try {
        const r = await run(cmd, { quiet: true });
        passed++;
        passedCommands.push(cmd);
        console.log(`PASS ${String(r.ms).padStart(6)}ms  ${cmd}`);
      } catch (e) {
        failures.push(e);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));
  if (failures.length) {
    console.error('VERIFY ALL FAST FAILED');
    for (const e of failures) {
      console.error(`\n--- ${e.cmd} (${e.ms}ms) ---`);
      if (e.out) console.error(e.out.slice(-8000));
      if (e.err) console.error(e.err.slice(-8000));
    }
    writeGateReport('failed', started, passedCommands, failures);
    process.exit(1);
  }
  const elapsed = Date.now() - started;
  writeGateReport('passed', started, passedCommands, []);
  console.log(`VERIFY ALL FAST PASSED — ${passed + sequential.length}/${checks.length + sequential.length} checks in ${(elapsed/1000).toFixed(1)}s.`);
}
main().catch(e => { console.error(e && e.stack || e); process.exit(1); });
