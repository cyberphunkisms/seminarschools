#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const stream = process.argv[2];
if (!['seminars', 'festivals'].includes(stream)) {
  console.error('Usage: node scripts/initialize-harvest-status.js seminars|festivals');
  process.exit(2);
}
const logDir = process.env.HARVEST_LOG_DIR || 'data/harvest-runs';
fs.mkdirSync(logDir, { recursive: true });
const now = new Date();
const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const logFile = path.join(logDir, `${stream}-${stamp}.log`);
const statusFile = path.join(logDir, `${stream}-${stamp}.status.json`);
const latest = path.join(logDir, `${stream}-latest.status.json`);
const shardCount = stream === 'seminars' ? process.env.SHARD_COUNT : process.env.FESTIVAL_SHARD_COUNT;
const payload = {
  stream,
  run_id: stamp,
  date_utc: now.toISOString().slice(0, 10),
  status: 'started',
  exit_code: 124,
  stage: 'workflow',
  failure_kind: 'timeout-or-interrupted',
  message: 'Workflow initialized. If this remains the latest status, the job stopped before the harvest runner completed.',
  attempt: 0,
  attempts: Number(process.env.HARVEST_ATTEMPTS || 1),
  log_file: logFile,
  max_turns: Number(process.env.MAX_TURNS || 40),
  max_budget_usd: Number(process.env.MAX_BUDGET_USD || 0),
  timeout_seconds: Number(process.env.HARVEST_TIMEOUT_SECONDS || 840),
  shard_count: Number(shardCount || 0),
  strict_harvest_failures: /^(1|true|yes)$/i.test(process.env.STRICT_HARVEST_FAILURES || ''),
  harvest_strict: /^(1|true|yes)$/i.test(process.env.HARVEST_STRICT || ''),
  model: process.env.CLAUDE_MODEL || '',
};
fs.writeFileSync(statusFile, JSON.stringify(payload, null, 2) + '\n');
fs.copyFileSync(statusFile, latest);
fs.appendFileSync(logFile, `=== ${stream} workflow initialized ${stamp} ===\n`);
console.log(`${stream} harvest diagnostics initialized: ${latest}`);
