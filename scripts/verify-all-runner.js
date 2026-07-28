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

const argv = new Set(process.argv.slice(2));
const reuseBuild = argv.has('--reuse-build');
const concurrencyArg = process.argv.slice(2).find(arg => arg.startsWith('--concurrency='));
const requestedConcurrency = concurrencyArg
  ? Number(concurrencyArg.split('=')[1])
  : Number(process.env.VERIFY_ALL_CONCURRENCY || 4);
if (!Number.isInteger(requestedConcurrency) || requestedConcurrency < 1 || requestedConcurrency > 8) {
  console.error('VERIFY ALL FAST FAILED — concurrency must be an integer from 1 through 8.');
  process.exit(2);
}
const timeoutArg = process.argv.slice(2).find(arg => arg.startsWith('--timeout-ms='));
const commandTimeoutMs = timeoutArg
  ? Number(timeoutArg.split('=')[1])
  : Number(process.env.VERIFY_ALL_COMMAND_TIMEOUT_MS || 600000);
if (
  !Number.isInteger(commandTimeoutMs)
  || commandTimeoutMs < 1000
  || commandTimeoutMs > 3600000
) {
  console.error('VERIFY ALL FAST FAILED — command timeout must be an integer from 1000 through 3600000 milliseconds.');
  process.exit(2);
}

const fullBuildPreparation = [
  'npm run build'
];
const reusedBuildPreparation = [
  'node scripts/verify-public-deploy-parity.js',
  'node scripts/run-python.js scripts/verify-audit45-translations.py',
  'node scripts/verify-audit49-metadata-surface.js',
  'node scripts/verify-audit49-runtime-efficiency.js',
  'node scripts/verify-audit49-build-packaging-efficiency.js'
];
const sequential = [
  ...(reuseBuild ? reusedBuildPreparation : fullBuildPreparation),
  'node scripts/verify-meaninglib-search.js',
  'node scripts/verify-audit48-assistive-technology.js',
  'node scripts/verify-audit48-browser-program.js',
  'node scripts/run-python.js scripts/verify-polymythcal-calendar-clients.py',
  'node scripts/run-python.js -m unittest scripts/test_audit48_live_harvest.py',
  'node scripts/run-python.js scripts/verify_audit48_live_harvest.py',
  'node scripts/verify-audit48-external-validation.js',
  'node scripts/verify-audit49-technical-efficiency.js',
];

const checks = [
  'node scripts/verify-critical.js',
  'node scripts/verify-predeploy-automation.js',
  'node scripts/verify-repository-walk-policy.js',
  'node scripts/verify-methodologylist-manifest.js',
  'node scripts/verify-regen-safety.js',
  'node scripts/verify-data-hygiene.js',
  'node scripts/verify-csp-enforced.js',
  'node scripts/verify-external-link-workflow.js',
  'node scripts/verify-external-link-live-shards.js',
  'node scripts/verify-release-gates.js',
  'node scripts/verify-audit35-route-ui.mjs',
  'node scripts/verify-audit36-visual-p0.mjs',
  'node scripts/verify-audit36-graph-resilience.mjs',
  'node scripts/verify-audit36-animation-lifecycle.mjs',
  'node scripts/verify-audit36-artifact-atomicity.js',
  'node scripts/verify-audit49-aa-dialog.mjs',
  'node scripts/verify-audit49-aitr-resilience.mjs',
  'node scripts/verify-aa-saul-runtime-smoothness.mjs',
  'node scripts/verify-audit38-accessibility-p0.mjs',
  'node scripts/verify-audit38-methodology-state.js',
  'node scripts/verify-frozen-audit38.js',
  'node scripts/verify-audit39-runtime-ui.mjs',
  'node scripts/verify-audit39-cache-coherence.js',
  'node scripts/verify-audit39-font-delivery.js',
  'node scripts/verify-audit39-methodology-runtime.js',
  'node scripts/verify-audit39-package-roundtrip.js',
  'node scripts/verify-frozen-audit39.js',
  'node scripts/verify-frozen-audit40.js',
  'node scripts/verify-frozen-audit41.js',
  'node scripts/verify-audit41-event-rollover.js',
  'node scripts/verify-frozen-audit42.js',
  'node scripts/verify-frozen-audit43.js',
  'node scripts/verify-audit46-technical-efficiency.js',
  'node scripts/verify-audit47-technical-efficiency.js',
  'node scripts/verify-audit49-metadata-surface.js',
  'node scripts/verify-audit49-runtime-efficiency.js',
  'node scripts/verify-audit49-build-packaging-efficiency.js',
  'node scripts/verify-polymythcal-audit47.js',
  'node scripts/verify-polymythcal-audit14.js',
  'node scripts/verify-cloud-input-runtime.js',
  'node scripts/verify-redirect-policy-coherence.js',
  'node scripts/verify-bb-qr-placement.js',
  'node scripts/run-python.js -m unittest scripts/test_polymythcal_audit43.py',
  'node scripts/run-python.js -m unittest scripts/test_polymythcal_audit47.py',
  'node scripts/run-python.js scripts/build-polymythcal-audit13.py --check',
  'node scripts/verify-audit43-approved-direction.js',
  'node scripts/verify-audit45-browser-evidence.js',
  'node scripts/run-python.js scripts/verify-audit45-translations.py',
  'node scripts/verify-project-failure-resilience.js',
  'node scripts/verify-autolink-performance.js',
  'node scripts/verify-frozen-audit37.js',
  'node scripts/verify-live-content-integrity.js',
  'node scripts/test-live-content-integrity.js',
  'node scripts/test-harvest-status-summary.js',
  'node scripts/test-merge-seminar-occurrences.js',
  'node scripts/test-merge-festival-occurrences.js',
  'node scripts/run-python.js -m unittest scripts/test_polymythcal_adapters.py',
  'node scripts/run-python.js -m unittest scripts/test_polymythcal_protest_harvest.py',
  'node scripts/run-python.js -m unittest scripts/test_polymythcal_lifecycle.py',
  'node scripts/run-python.js -m unittest scripts/test_polymythcal_sharding.py',
  'node scripts/run-python.js -m unittest scripts/test_harvest_source_ledger.py',
  'node scripts/run-python.js -m unittest scripts/test_festival_pipeline.py',
  'node scripts/run-python.js -m unittest scripts/test_deterministic_before_agent.py',
  'node scripts/run-python.js -m unittest scripts/test_package_integrity.py',
  'node scripts/verify-public-artifact-blocks.js',
  'node scripts/verify-final6-deploy-contract.js',
  'node scripts/verify-npm-public-registry.js',
  'node scripts/verify-search-surface.js',
  'node scripts/verify-content-flow-regressions.js',
  'node scripts/verify-calendar-aliases.js',
  'node scripts/verify-calendar-data-parity.js',
  'node scripts/verify-polymythcal-browser-payload.js',
  'node scripts/verify-polymythcalendar-today-scroll.js',
  'node scripts/verify-polymythcalendar-kid-guide.js',
  'node scripts/verify-polymythcalendar-ux-efficiency.js',
  'node scripts/verify-polymythcal-scraper-layout.js',
  'node scripts/verify-polymythcal-scraper-ui.js',
  'node scripts/verify-python-audit-contract.js',
  'node scripts/verify-core-html-structure.js',
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
  'node scripts/verify-saul-ultimate-web-cv.js',
  'node scripts/verify-teacherresources-finder.js',
  'node scripts/verify-aa-polymyth-funnel.js',
  'node scripts/verify-polymythcal-freshness-labels.js',
  'node scripts/verify-polymythcal-featured.js',
  'node scripts/verify-polymythcal-build-efficiency.js',
  'node scripts/verify-steady-ui.js',
  'node scripts/verify-shortcut-title-uniqueness.js',
  'node scripts/verify-visible-input-labels.js',
  'node scripts/audit-external-links.js',
  'node scripts/verify-dense-anchors.js',
  'node scripts/verify-asset-weights.js',
  'node scripts/verify-runtime-delivery-resilience.js',
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
  'node scripts/verify-ml-gorgonwars-premise-split.js',
  'node scripts/verify-ai-access-pack.js',
  'node scripts/verify-site-integrity.js',
  'node scripts/verify-professional-readiness.js',
  'node scripts/verify-seo.js',
  'node scripts/verify-typography-controls.js',
  'node scripts/verify-bookwormcard-gate.js'
];
// The canonical build already executes these release blockers. Do not repeat
// them in the full runner. Reuse mode refreshes the same blockers in its own
// preparation before the current external and aggregate release checks.
const canonicalBuildCoveredChecks = new Set([
  'node scripts/verify-polymythcal-featured.js',
  'node scripts/verify-polymythcal-browser-payload.js',
  'node scripts/verify-polymythcal-build-efficiency.js',
  'node scripts/verify-steady-ui.js',
  'node scripts/run-python.js scripts/verify-audit45-translations.py',
  'node scripts/verify-audit49-metadata-surface.js',
  'node scripts/verify-audit49-runtime-efficiency.js',
  'node scripts/verify-audit49-build-packaging-efficiency.js'
]);
const reusedBuildPreparationChecks = new Set([
  'node scripts/run-python.js scripts/verify-audit45-translations.py',
  'node scripts/verify-audit49-metadata-surface.js',
  'node scripts/verify-audit49-runtime-efficiency.js',
  'node scripts/verify-audit49-build-packaging-efficiency.js'
]);
const preparationCoveredChecks = reuseBuild
  ? reusedBuildPreparationChecks
  : canonicalBuildCoveredChecks;
const activeChecks = checks.filter(command => !preparationCoveredChecks.has(command));
const concurrency = requestedConcurrency;
const releaseManifest = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'RELEASE_MANIFEST.json'), 'utf8'));
const releaseTimestamp = releaseManifest.generated_at || '1970-01-01T00:00:00Z';
function run(cmd, { quiet = true } = {}) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const detached = process.platform !== 'win32';
    const child = spawn(cmd, {
      shell: true,
      detached,
      windowsHide: true,
      stdio: quiet ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    });
    let out = '', err = '';
    let timedOut = false;
    let forceTimer = null;
    let settled = false;
    if (quiet) {
      child.stdout.on('data', d => { out += d; if (out.length > 24000) out = out.slice(-24000); });
      child.stderr.on('data', d => { err += d; if (err.length > 24000) err = err.slice(-24000); });
    }
    function terminate(signal) {
      try {
        if (detached && child.pid) process.kill(-child.pid, signal);
        else child.kill(signal);
      } catch (error) {
        if (error.code !== 'ESRCH') {
          err += `\nCould not send ${signal} to timed-out command: ${error.message}`;
        }
      }
    }
    const timeout = setTimeout(() => {
      timedOut = true;
      terminate('SIGTERM');
      forceTimer = setTimeout(() => terminate('SIGKILL'), 5000);
    }, commandTimeoutMs);
    child.on('close', code => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (forceTimer) clearTimeout(forceTimer);
      const ms = Date.now() - start;
      if (code === 0 && !timedOut) return resolve({ cmd, ms, out });
      const codeLabel = timedOut ? 'TIMEOUT' : code;
      const e = new Error(`${cmd} failed with ${timedOut ? `timeout after ${commandTimeoutMs}ms` : `exit ${code}`}`);
      e.cmd = cmd; e.code = codeLabel; e.out = out; e.err = err; e.ms = ms;
      reject(e);
    });
    child.on('error', error => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (forceTimer) clearTimeout(forceTimer);
      error.cmd = cmd;
      error.ms = Date.now() - start;
      reject(error);
    });
  });
}
function writeGateReport(status, started, passedCommands, failures) {
  const reportDir = path.join(process.cwd(), 'scripts', 'reports');
  fs.mkdirSync(reportDir, { recursive: true });
  const total = activeChecks.length + sequential.length;
  const report = {
    generated_at: releaseTimestamp,
    status,
    total_checks: total,
    passed_checks: passedCommands.length,
    failed_checks: failures
      .map(e => ({ cmd: e.cmd, code: e.code || 1, ms: e.ms || null }))
      .sort((left, right) => String(left.cmd).localeCompare(String(right.cmd))),
    duration_ms: null,
    duration_note: 'Runtime duration is printed to the console and intentionally omitted from committed evidence.',
    command_timeout_ms: commandTimeoutMs,
    execution_mode: reuseBuild ? 'reuse-build' : 'canonical-build',
    preparation_covered_checks: [...preparationCoveredChecks].filter(command => checks.includes(command)),
    rule: 'Every active command and every preparation-covered command in scripts/verify-all-runner.js is a release blocker.'
  };
  const reportFile = path.join(reportDir, 'release-gate-report.json');
  const renderedReport = JSON.stringify(report, null, 2) + '\n';
  if (!fs.existsSync(reportFile) || fs.readFileSync(reportFile, 'utf8') !== renderedReport) {
    fs.writeFileSync(reportFile, renderedReport);
  }
  if (process.env.SS_REPORT_OUTPUT_MTIME) {
    const outputMtime = new Date(process.env.SS_REPORT_OUTPUT_MTIME);
    if (Number.isNaN(outputMtime.getTime())) throw new Error('SS_REPORT_OUTPUT_MTIME must be a valid timestamp');
    fs.utimesSync(reportFile, outputMtime, outputMtime);
  }
}
function printFailures(failures) {
  console.error('VERIFY ALL FAST FAILED');
  for (const e of failures) {
    console.error(`\n--- ${e.cmd} (${e.ms}ms) ---`);
    if (e.out) console.error(e.out.slice(-8000));
    if (e.err) console.error(e.err.slice(-8000));
  }
}
async function main() {
  const started = Date.now();
  const passedCommands = [];
  const mode = reuseBuild ? 'reuse verified canonical build' : 'self-build public surface';
  console.log(`VERIFY ALL FAST — ${activeChecks.length + sequential.length} checks, concurrency ${concurrency}, timeout ${commandTimeoutMs}ms, mode: ${mode}`);
  for (const cmd of sequential) {
    try {
      const r = await run(cmd, { quiet: true });
      console.log(`PASS ${String(r.ms).padStart(6)}ms  ${cmd}`);
      passedCommands.push(cmd);
    } catch (error) {
      writeGateReport('failed', started, passedCommands, [error]);
      printFailures([error]);
      process.exitCode = 1;
      return;
    }
  }
  let index = 0, passed = 0;
  const failures = [];
  async function worker() {
    while (true) {
      const i = index++;
      if (i >= activeChecks.length || failures.length) return;
      const cmd = activeChecks[i];
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
    writeGateReport('failed', started, passedCommands, failures);
    printFailures(failures);
    process.exitCode = 1;
    return;
  }
  const elapsed = Date.now() - started;
  writeGateReport('passed', started, passedCommands, []);
  console.log(`VERIFY ALL FAST PASSED — ${passed + sequential.length}/${activeChecks.length + sequential.length} checks in ${(elapsed/1000).toFixed(1)}s.`);
}
if (require.main === module) {
  main().catch(e => { console.error(e && e.stack || e); process.exit(1); });
}
module.exports = { run, writeGateReport };
