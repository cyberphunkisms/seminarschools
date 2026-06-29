#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const stream = process.argv[2];
if (!stream || !['seminars', 'festivals'].includes(stream)) {
  console.error('Usage: node scripts/summarize-harvest-status.js seminars|festivals');
  process.exit(2);
}
const logDir = process.env.HARVEST_LOG_DIR || 'data/harvest-runs';
const latest = path.join(logDir, `${stream}-latest.status.json`);
function appendSummary(markdown) {
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown + '\n');
}
if (!fs.existsSync(latest)) {
  const msg = `No ${stream} harvest status file was produced.`;
  console.log(`::warning::${msg}`);
  appendSummary(`### ${stream} harvest\n\n⚠️ ${msg}`);
  process.exit(0);
}
let status;
try {
  status = JSON.parse(fs.readFileSync(latest, 'utf8'));
} catch (err) {
  console.error(`::error::Could not parse ${latest}: ${err.message}`);
  process.exit(1);
}
const rows = [
  ['stream', status.stream],
  ['run_id', status.run_id],
  ['status', status.status],
  ['exit_code', status.exit_code],
  ['stage', status.stage],
  ['failure_kind', status.failure_kind || 'none'],
  ['message', status.message || ''],
  ['attempt', `${status.attempt || 0}/${status.attempts || 0}`],
  ['log_file', status.log_file],
  ['budget', `$${Number(status.max_budget_usd || 0).toFixed(2)}`],
  ['max_turns', status.max_turns],
  ['timeout_seconds', status.timeout_seconds],
  ['shard_count', status.shard_count],
  ['model', status.model || ''],
];
appendSummary(`### ${stream} harvest\n\n` + rows.map(([k, v]) => `- **${k}:** ${v}`).join('\n'));
if (Number(status.exit_code) === 0) {
  console.log(`${stream} harvest status: ${status.status || 'success'}.`);
  process.exit(0);
}
const message = `${stream} harvest ${status.status || 'skipped'} with ${status.failure_kind} (${status.exit_code}); existing calendar data stayed intact. See artifact ${status.log_file}.`;
if (status.status === 'started') {
  console.log(`::warning::${message}`);
  process.exit(0);
}
if (status.failure_kind === 'configuration') {
  console.error(`::error::${message}`);
  process.exit(Number(status.exit_code) || 1);
}
console.log(`::warning::${message}`);
process.exit(0);
