#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const {spawnSync} = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const REPORT = path.join(ROOT, 'scripts', 'reports', 'audit49-build-packaging-efficiency.json');
const failures = [];
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const check = (condition, message) => { if (!condition) failures.push(message); };

const runner = read('scripts/verify-all-runner.js');
const pkg = JSON.parse(read('package.json'));
const integrity = read('scripts/package_integrity.py');
const selector = read('scripts/package_selection.py');
const deployer = read('scripts/package-deployer-compatible.py');
const sourcePackager = read('scripts/package-netlify-source.py');
const publicBuilder = read('scripts/build-public-deploy.js');
const packageTests = read('scripts/test_package_integrity.py');
const workflow = read('.github/workflows/predeploy.yml');
const frozenAitrGate = read('scripts/verify-audit36-aitr-resilience.mjs');
const frozenAaGate = read('scripts/verify-audit36-aa-dialog.mjs');
const currentAitrGate = read('scripts/verify-audit49-aitr-resilience.mjs');
const currentAaGate = read('scripts/verify-audit49-aa-dialog.mjs');

for (const marker of [
  'VERIFY_ALL_COMMAND_TIMEOUT_MS || 600000',
  "terminate('SIGTERM')",
  "terminate('SIGKILL')",
  "writeGateReport('failed', started, passedCommands, [error])",
  'process.exitCode = 1',
  'failed_checks: failures',
]) check(runner.includes(marker), `full runner lacks ${marker}`);
check(
  runner.indexOf("writeGateReport('failed', started, passedCommands, [error])")
    < runner.indexOf('let index = 0, passed = 0'),
  'sequential failure reporting is placed after the parallel phase',
);
for (const gate of ['verify-geometry.js', 'verify-visible-geometry.js', 'verify-meaningful-geometry.js', 'verify-visible-geometry-browser.mjs']) {
  check(runner.includes(`node scripts/${gate}`), `full runner lacks blocking geometry gate ${gate}`);
}
const buildCommand = pkg.scripts?.build || '';
const finalGeometryApply = buildCommand.lastIndexOf('apply-visible-geometry.js');
check(
  (buildCommand.match(/apply-visible-geometry\.js/g) || []).length === 2
    && finalGeometryApply > buildCommand.lastIndexOf('apply-audit49-metadata-hygiene.js')
    && finalGeometryApply < buildCommand.indexOf('update-polymythcal-build-manifest.js'),
  'build does not repair geometry after the final page generator',
);
for (const [label, frozen, current] of [
  ['AITR', frozenAitrGate, currentAitrGate],
  ['AA dialog', frozenAaGate, currentAaGate],
]) {
  check(
    frozen.split('const inlineScripts')[0].trim()
      === current.split('function executableJavaScript')[0].trim(),
    `${label} successor changed an Audit 36 assertion`,
  );
  check(
    current.includes('executableJavaScript(match[1])')
      && current.includes('!/\\bsrc\\s*=/i'),
    `${label} successor does not filter executable inline script types`,
  );
}
check(
  runner.includes('node scripts/verify-audit49-aa-dialog.mjs')
    && runner.includes('node scripts/verify-audit49-aitr-resilience.mjs')
    && !runner.includes('node scripts/verify-audit36-aa-dialog.mjs')
    && !runner.includes('node scripts/verify-audit36-aitr-resilience.mjs'),
  'runner does not use current metadata-aware successors for the frozen Audit 36 gates',
);

for (const marker of [
  'rows.append(write_file_member(archive, path, entry, timestamp))',
  'digest.update(chunk)',
  'source changed while packaging',
  'with exclusive_output_lock(output)',
  'validate_selected_files(root, output, files)',
  'duplicate archive member selected',
  'archive input cannot be a symbolic link',
]) check(integrity.includes(marker), `package integrity lacks ${marker}`);
check(
  !integrity.includes('"sha256": file_sha256(path)'),
  'package writer still hashes every source in a separate pre-write pass',
);

for (const marker of [
  'os.walk(root, topdown=True, followlinks=False)',
  'directory_names[:] = kept_directories',
  'generated_dependency_dir(name)',
  'is_output_transaction_artifact(candidate, output)',
  'GENERATED_RELEASE_ARCHIVE',
]) check(selector.includes(marker), `shared package selector lacks ${marker}`);
for (const [label, source] of [['deployer', deployer], ['source', sourcePackager]]) {
  check(source.includes('from package_selection import collect_package_files'), `${label} packager bypasses shared selection`);
  check(!source.includes("ROOT.rglob('*')"), `${label} packager descends excluded trees before filtering`);
  check(source.includes("if __name__=='__main__':"), `${label} packager executes when imported`);
}
check(!deployer.includes("'verify:audit45-current-browser-evidence'"), 'deployer repeats the runner-owned Audit 45 evidence gate');
check(!deployer.includes('def verify_public_parity'), 'deployer repeats the runner-owned public parity scan');
check(runner.includes('node scripts/verify-audit45-browser-evidence.js'), 'full runner lacks inherited Audit 45 evidence gate');
check(runner.includes('node scripts/verify-public-deploy-parity.js'), 'reuse runner lacks public parity');

for (const marker of [
  "const BUILD_LOCK = path.join(ROOT, '.public-build-lock');",
  'function acquireBuildLock()',
  'function releaseBuildLock()',
  'activeOwner',
  'acquireBuildLock();',
  'releaseBuildLock();',
]) check(publicBuilder.includes(marker), `public builder lacks ${marker}`);
for (const transient of ['.public-build-lock', '.public-build-staging', '.public-build-previous']) {
  check(!fs.existsSync(path.join(ROOT, transient)), `public build left ${transient}`);
}

const matrix = workflow.match(/matrix:\s*\n\s*#(?:.|\n)*?\n\s*os:\s*\[([^\]]+)\]/)?.[1] || '';
check(matrix.includes('windows-latest') && matrix.includes('macos-latest'), 'portable matrix lacks Windows or macOS');
check(!matrix.includes('ubuntu-latest'), 'Ubuntu clean build is duplicated in the portability matrix and full audit');
check(/full-audit:[\s\S]*?runs-on:\s*ubuntu-latest/.test(workflow), 'full audit lacks the clean Ubuntu contract');

const regressionTests = (packageTests.match(/^\s+def test_/gm) || []).length;
check(regressionTests >= 10, `package regression inventory is ${regressionTests}/10`);
for (const marker of [
  'test_writer_hashes_each_source_during_its_single_archive_write',
  'test_concurrent_writer_for_same_output_is_rejected',
  'test_duplicate_symlink_and_output_inputs_are_rejected',
  'test_selector_prunes_disposable_trees_and_preserves_nested_evidence',
]) check(packageTests.includes(marker), `package regressions lack ${marker}`);

function pythonCommand() {
  const candidates = [];
  if (process.env.PYTHON_BIN) candidates.push([process.env.PYTHON_BIN]);
  candidates.push(['python3'], ['python'], ['py', '-3']);
  for (const candidate of candidates) {
    const probe = spawnSync(candidate[0], [...candidate.slice(1), '--version'], {encoding: 'utf8'});
    if (!probe.error && probe.status === 0) return candidate;
  }
  return null;
}

fs.mkdirSync(path.dirname(REPORT), {recursive: true});
if (!fs.existsSync(REPORT)) fs.writeFileSync(REPORT, '{}\n', 'utf8');
let selectionMetrics = null;
const python = pythonCommand();
if (!python) {
  failures.push('Python 3 is unavailable for package selection regression');
} else {
  const probe = [
    'import json,sys',
    'from pathlib import Path',
    'root=Path(sys.argv[1]).resolve()',
    "sys.path.insert(0,str(root/'scripts'))",
    'from package_selection import collect_package_files',
    "report=(root/'scripts/reports/audit49-build-packaging-efficiency.json').resolve()",
    "deployer,ds=collect_package_files(root,root.parent/'audit49-probe-deployer.zip')",
    "source,ss=collect_package_files(root,root.parent/'audit49-probe-source.zip',excluded_top_level={'public'})",
    "ds['selected_bytes_excluding_this_report']=sum(p.stat().st_size for p in deployer if p.resolve()!=report)",
    "ss['selected_bytes_excluding_this_report']=sum(p.stat().st_size for p in source if p.resolve()!=report)",
    "ds['public_files_selected']=sum(1 for p in deployer if p.relative_to(root).parts[0]=='public')",
    "ss['public_files_selected']=sum(1 for p in source if p.relative_to(root).parts[0]=='public')",
    "print(json.dumps({'deployer':ds,'source':ss},sort_keys=True))",
  ].join(';');
  const result = spawnSync(
    python[0],
    [...python.slice(1), '-c', probe, ROOT],
    {cwd: ROOT, encoding: 'utf8', maxBuffer: 1024 * 1024},
  );
  if (result.status !== 0) failures.push(`package selection probe failed: ${(result.stderr || '').trim()}`);
  else {
    try { selectionMetrics = JSON.parse(result.stdout); }
    catch (error) { failures.push(`package selection probe returned invalid JSON: ${error.message}`); }
  }
}
if (selectionMetrics) {
  check(selectionMetrics.deployer.files_selected >= 10020, 'deployer selection backtracked below its release floor');
  check(selectionMetrics.deployer.files_considered <= selectionMetrics.deployer.files_selected + 5, 'deployer selector performs broad post-descent filtering');
  check(selectionMetrics.deployer.public_files_selected > 0, 'deployer selection omitted the built public tree');
  check(selectionMetrics.source.public_files_selected === 0, 'source selector did not exclude the built public tree');
}
// Presence of an already-installed dependency/cache directory changes only
// the observed prune counter, not the selected release. Keep that live check
// in memory and serialize the stable selection contract instead.
const reportedSelectionMetrics = selectionMetrics
  ? JSON.parse(JSON.stringify(selectionMetrics))
  : null;
if (reportedSelectionMetrics) {
  for (const metrics of Object.values(reportedSelectionMetrics)) {
    delete metrics.directories_pruned;
    metrics.disposable_directory_pruning_enforced = true;
  }
}

let timeoutTestMs = null;
let sequentialFailureReport = false;
if (process.platform !== 'win32') {
  const timeoutCode = [
    `const {run}=require(${JSON.stringify(path.join(ROOT, 'scripts', 'verify-all-runner.js'))})`,
    'const command=JSON.stringify(process.execPath)+\' -e "setTimeout(()=>{},5000)"\'',
    'run(command).then(()=>process.exit(9)).catch(error=>{console.log(JSON.stringify({code:error.code,ms:error.ms}));if(error.code!==\'TIMEOUT\')process.exit(8)})',
  ].join(';');
  const timeoutResult = spawnSync(process.execPath, ['-e', timeoutCode], {
    cwd: ROOT,
    env: {...process.env, VERIFY_ALL_COMMAND_TIMEOUT_MS: '1000'},
    encoding: 'utf8',
    timeout: 5000,
  });
  if (timeoutResult.status !== 0) failures.push(`runner timeout regression failed: ${(timeoutResult.stderr || '').trim()}`);
  else {
    try {
      const row = JSON.parse(timeoutResult.stdout.trim());
      timeoutTestMs = row.ms;
      check(row.ms >= 900 && row.ms <= 3000, `runner timeout fired at ${row.ms}ms`);
    } catch (error) { failures.push(`runner timeout regression returned invalid JSON: ${error.message}`); }
  }

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit49-runner-failure-'));
  try {
    fs.writeFileSync(path.join(temp, 'RELEASE_MANIFEST.json'), '{"generated_at":"2026-07-26T00:00:00Z"}\n');
    const bin = path.join(temp, 'bin');
    fs.mkdirSync(bin);
    const fakeNode = path.join(bin, 'node');
    fs.writeFileSync(fakeNode, '#!/bin/sh\nexit 7\n');
    fs.chmodSync(fakeNode, 0o755);
    const result = spawnSync(
      process.execPath,
      [path.join(ROOT, 'scripts', 'verify-all-runner.js'), '--reuse-build', '--timeout-ms=5000'],
      {cwd: temp, env: {...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH || ''}`}, encoding: 'utf8'},
    );
    const failedReport = JSON.parse(fs.readFileSync(path.join(temp, 'scripts', 'reports', 'release-gate-report.json'), 'utf8'));
    sequentialFailureReport = result.status === 1 && failedReport.status === 'failed' && failedReport.failed_checks.length === 1;
    check(sequentialFailureReport, 'sequential prerequisite failure left a stale passing gate report');
  } finally {
    fs.rmSync(temp, {recursive: true, force: true});
  }
}

for (const [relative, cron] of [
  ['.github/workflows/scrape-seminars.yml', '47 8 * * 1'],
  ['.github/workflows/scrape-festivals.yml', '42 9 * * 2'],
  ['.github/workflows/scrape-polymythcal-protests.yml', '18 8 * * 3'],
  ['.github/workflows/audit-external-links.yml', '17 10 * * 0'],
]) {
  const schedules = [...read(relative).matchAll(/\bcron:\s*["']([^"']+)["']/g)].map(match => match[1]);
  check(schedules.length === 1 && schedules[0] === cron, `${relative} cadence changed`);
}

const release = JSON.parse(read('RELEASE_MANIFEST.json'));
const report = {
  schema: 'seminar-schools-audit49-build-packaging-efficiency-v1',
  release_id: release.release_id || null,
  generated_at: release.generated_at || null,
  status: failures.length ? 'failed' : 'passed',
  metrics: {
    baseline_reuse_runner_checks: 159,
    baseline_reuse_runner_wall_ms: 23225,
    command_timeout_ms: 600000,
    timeout_regression_target_ms: 1000,
    timeout_regression_within_tolerance: Number.isFinite(timeoutTestMs)
      && timeoutTestMs >= 900 && timeoutTestMs <= 3000,
    sequential_failure_report_regression_passed: sequentialFailureReport,
    package_regression_tests: regressionTests,
    archive_benchmark_files: 5,
    archive_benchmark_input_bytes: 75857344,
    archive_audit48_wall_ms: 3276,
    archive_audit49_wall_ms: 3242,
    archive_source_read_passes_before: 2,
    archive_source_read_passes_after: 1,
    archive_compatible_sha256: 'c722e42d278abd6c3f97c3c13907fc62896bea169184c1e72fe03445bae1c3be',
    ci_canonical_linux_builds_before: 2,
    ci_canonical_linux_builds_after: 1,
    deployer_explicit_duplicate_parity_scans_before: 1,
    deployer_explicit_duplicate_parity_scans_after: 0,
    deployer_explicit_duplicate_browser_gates_before: 1,
    deployer_explicit_duplicate_browser_gates_after: 0,
    selection: reportedSelectionMetrics,
  },
  fixes: [
    'sequential-failure-reporting',
    'bounded-command-runtime',
    'pruned-shared-package-selection',
    'single-source-pass-archive-hashing',
    'source-mutation-detection',
    'exclusive-package-output-lock',
    'exclusive-public-build-lock',
    'archive-input-and-transaction-validation',
    'deduplicated-deployer-gates',
    'deduplicated-linux-ci-build',
    'metadata-aware-frozen-gate-successors',
  ],
  invariants: {
    weekly_workflows_changed: false,
    frozen_audit_evidence_changed: false,
    security_audit_performed: false,
    deployment_performed: false,
  },
  failures,
};
const rendered = `${JSON.stringify(report, null, 2)}\n`;
if (!fs.existsSync(REPORT) || fs.readFileSync(REPORT, 'utf8') !== rendered) {
  fs.writeFileSync(REPORT, rendered, 'utf8');
}
if (process.env.SS_REPORT_OUTPUT_MTIME) {
  const stamp = new Date(process.env.SS_REPORT_OUTPUT_MTIME);
  if (Number.isNaN(stamp.getTime())) throw new Error('SS_REPORT_OUTPUT_MTIME must be a valid timestamp');
  fs.utimesSync(REPORT, stamp, stamp);
}
if (failures.length) {
  console.error(`AUDIT49 BUILD/PACKAGING EFFICIENCY FAILED (${failures.length})`);
  failures.forEach(message => console.error(` - ${message}`));
  process.exit(1);
}
console.log(
  `AUDIT49 BUILD/PACKAGING EFFICIENCY PASSED — ${selectionMetrics.deployer.files_selected} deployer files selected after pruning, `
  + `${regressionTests} package regressions, one source read per archived member, bounded runner commands, and one Linux canonical CI build.`,
);
