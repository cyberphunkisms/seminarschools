#!/usr/bin/env node
/* Prevents a return to one unbounded, opaque scraper job. */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }
function need(text, needle, file, problems) { if (!text.includes(needle)) problems.push(`${file} must contain ${needle}`); }
const problems = [];
for (const [runner, stream] of [['scripts/seminars-prompt-runner.sh', 'seminars'], ['scripts/festivals-prompt-runner.sh', 'festivals']]) {
  const s = read(runner);
  for (const needle of [
    'timeout --signal=INT',
    'tee -a "${LOG_FILE}"',
    'HARVEST_TIMEOUT_SECONDS',
    'HARVEST_ATTEMPTS',
    'MAX_TURNS',
    'MAX_BUDGET_USD',
    'STRICT_HARVEST_FAILURES',
    'HARVEST_STRICT',
    'soft_exit_or_fail',
    'latest.status.json',
    'failure_kind',
    'Expected output file',
    'data/harvest-runs',
    'CLAUDE_CODE_OAUTH_TOKEN',
  ]) need(s, needle, runner, problems);
  if (stream === 'seminars') need(s, 'SHARD_COUNT', runner, problems);
  if (stream === 'festivals') need(s, 'FESTIVAL_SHARD_COUNT', runner, problems);
  if (/exit "\$\{CLAUDE_STATUS\}"/.test(s)) problems.push(`${runner} should not hard-fail scheduled runs on agent nonzero status.`);
  if (/\|\|\s*\{\s*echo\s+"ERROR: claude -p invocation failed"[^}]*exit 1/.test(s)) problems.push(`${runner} still drops the command exit context through the legacy one-line failure handler.`);
}
const summary = read('scripts/summarize-harvest-status.js');
for (const needle of ['failure_kind', 'status', 'attempt', 'shard_count', 'GITHUB_STEP_SUMMARY']) need(summary, needle, 'scripts/summarize-harvest-status.js', problems);
for (const workflow of ['.github/workflows/scrape-seminars.yml', '.github/workflows/scrape-festivals.yml']) {
  if (!fs.existsSync(path.join(ROOT, workflow))) { problems.push(`${workflow} is missing`); continue; }
  const s = read(workflow);
  for (const needle of [
    'timeout-minutes: 45',
    'actions/upload-artifact@v6',
    'actions/checkout@v5',
    'actions/setup-node@v6',
    'actions/setup-python@v6',
    'concurrency:',
    'CLAUDE_CODE_OAUTH_TOKEN',
    'STRICT_HARVEST_FAILURES',
    'HARVEST_ATTEMPTS',
    'FORCE_JAVASCRIPT_ACTIONS_TO_NODE24',
    'strict_harvest',
    'Install Claude Code CLI',
    'npm install -g @anthropic-ai/claude-code',
    'claude --version',
    'Summarize harvest outcome',
    'Preserve harvest diagnostics',
    'Summarize harvest diagnostics',
    'Verify generated calendar',
  ]) need(s, needle, workflow, problems);
  if (!/actions\/checkout@v(5|6|7)/.test(s)) problems.push(`${workflow} must use a Node 24-compatible checkout action.`);
  if (!/actions\/setup-node@v(5|6)/.test(s)) problems.push(`${workflow} must use a Node 24-compatible setup-node action.`);
  if (!/actions\/setup-python@v6/.test(s)) problems.push(`${workflow} must use a Node 24-compatible setup-python action.`);
}
const seminarPrompt = read('scripts/seminars-prompt.md');
for (const needle of ['Kingston', 'Montréal', 'A screening qualifies **only when a creator or principal collaborator is confirmed', 'type: "festival"', 'SHARD_COUNT', 'crawled-urgency-reserve', 'smaller verified harvest is better than a failed run', 'findaprotest-toronto', 'qualification queue']) need(seminarPrompt, needle, 'scripts/seminars-prompt.md', problems);
const sourcesRoster = read('scripts/sources.json');
for (const needle of ['findaprotest-toronto', 'https://www.findaprotest.info/canada/toronto']) need(sourcesRoster, needle, 'scripts/sources.json', problems);
const festivalPrompt = read('scripts/festivals-prompt.md');
for (const needle of ['Kingston', 'Montréal', 'one parent festival record', 'individual production record', 'type: "festival"', 'SHARD', 'seven consecutive runs', 'source_yields', 'smaller verified harvest is better than a failed run']) need(festivalPrompt, needle, 'scripts/festivals-prompt.md', problems);
const seminarMerger = read('scripts/merge_and_finalize.py');
for (const needle of ['merge-seminar-harvest-into-calendar.js', 'finalize-polymythcal-publication.py']) need(seminarMerger, needle, 'scripts/merge_and_finalize.py', problems);
const seminarPublish = read('scripts/merge-seminar-harvest-into-calendar.js');
for (const needle of ['SEMINAR CALENDAR INTEGRATION', 'polymythseminars', 'preservedManual']) need(seminarPublish, needle, 'scripts/merge-seminar-harvest-into-calendar.js', problems);
const diagnostics = read('scripts/summarize-harvest-diagnostics.sh');
for (const needle of ['GITHUB_STEP_SUMMARY', 'Last 120 log lines', 'status.json']) need(diagnostics, needle, 'scripts/summarize-harvest-diagnostics.sh', problems);
const festivalMerger = read('scripts/merge_festivals.py');
for (const needle of ['merge-festival-harvest-into-calendar.js', 'finalize-polymythcal-publication.py', 'normalize_festival_parents', '"festival", "festival-of-form"']) need(festivalMerger, needle, 'scripts/merge_festivals.py', problems);
if (problems.length) {
  console.error('HARVEST PIPELINE FAILED\n- ' + problems.join('\n- '));
  process.exit(1);
}
console.log('HARVEST PIPELINE OK — bounded, observable, qualification-preserving regional harvest workflow.');
