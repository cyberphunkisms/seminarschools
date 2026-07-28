#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'summarize-harvest-status.js');

function run(status) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'audit38-harvest-status-'));
  const output = path.join(directory, 'github-output.txt');
  const summary = path.join(directory, 'summary.md');
  if (status !== undefined) {
    fs.writeFileSync(
      path.join(directory, 'festivals-latest.status.json'),
      typeof status === 'string' ? status : `${JSON.stringify(status)}\n`,
    );
  }
  const result = spawnSync(process.execPath, [SCRIPT, 'festivals'], {
    cwd: ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      HARVEST_LOG_DIR: directory,
      GITHUB_OUTPUT: output,
      GITHUB_STEP_SUMMARY: summary,
    },
  });
  return {
    result,
    output: fs.existsSync(output) ? fs.readFileSync(output, 'utf8') : '',
    summary: fs.existsSync(summary) ? fs.readFileSync(summary, 'utf8') : '',
  };
}

const missing = run(undefined);
assert.strictEqual(missing.result.status, 0);
assert.match(missing.output, /degraded=true/);
assert.match(missing.summary, /No festivals harvest status file/);

const healthy = run({
  stream: 'festivals',
  status: 'success',
  exit_code: 0,
  stage: 'published',
  failure_kind: 'none',
  publication_status: 'published',
  agent_exit_code: 0,
  agent_failure_kind: 'none',
  attempt: 1,
  attempts: 1,
});
assert.strictEqual(healthy.result.status, 0);
assert.match(healthy.output, /degraded=false/);

const deterministicFallback = run({
  stream: 'festivals',
  status: 'success',
  exit_code: 0,
  stage: 'published-deterministic',
  failure_kind: 'none',
  publication_status: 'published',
  agent_exit_code: 124,
  agent_failure_kind: 'timeout-or-interrupted',
  attempt: 1,
  attempts: 1,
});
assert.strictEqual(deterministicFallback.result.status, 0);
assert.match(deterministicFallback.output, /degraded=true/);
assert.match(deterministicFallback.summary, /agent_failure_kind.*timeout-or-interrupted/i);

const malformed = run('{broken json');
assert.strictEqual(malformed.result.status, 1);
assert.match(malformed.output, /degraded=true/);

console.log(
  'HARVEST STATUS SUMMARY TESTS PASSED — healthy runs stay quiet; missing, malformed, '
    + 'and soft agent failures remain observable.',
);
