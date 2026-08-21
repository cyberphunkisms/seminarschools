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
    'publication_status',
    'agent_exit_code',
    'agent_failure_kind',
    'Expected output file',
    'data/harvest-runs',
    'CLAUDE_CODE_OAUTH_TOKEN',
  ]) need(s, needle, runner, problems);
  if (stream === 'seminars') need(s, 'SHARD_COUNT', runner, problems);
  if (stream === 'seminars') {
    for (const needle of [
      'publish_deterministic_fallback',
      '/tmp/polymythcal-protests.json',
      '/tmp/polymythcal-structured.json',
      'published-deterministic',
      'validate_harvest_source_ledger.py seminars',
      '--deterministic-success-ids "${DETERMINISTIC_SKIP_IDS}"',
      '--shard "${SHARD}"',
      '--shard-count "${SHARD_COUNT}"',
    ]) need(s, needle, runner, problems);
  }
  if (stream === 'festivals') {
    for (const needle of [
      'FESTIVAL_SHARD_COUNT',
      'validate_harvest_source_ledger.py festivals',
      '--roster scripts/festivals-sources.json',
    ]) need(s, needle, runner, problems);
  }
  need(s, 'soft_exit_or_fail 66 "Harvest JSON or source accounting failed validation;', runner, problems);
  need(s, 'polymythcal_sharding.py shard', runner, problems);
  if (s.includes('/ 259200')) {
    problems.push(`${runner} uses legacy three-day epoch windows instead of the weekly selector.`);
  }
  if (/exit "\$\{CLAUDE_STATUS\}"/.test(s)) problems.push(`${runner} should not hard-fail scheduled runs on agent nonzero status.`);
  if (/\|\|\s*\{\s*echo\s+"ERROR: claude -p invocation failed"[^}]*exit 1/.test(s)) problems.push(`${runner} still drops the command exit context through the legacy one-line failure handler.`);
}
const summary = read('scripts/summarize-harvest-status.js');
for (const needle of ['failure_kind', 'status', 'attempt', 'shard_count', 'GITHUB_STEP_SUMMARY', 'GITHUB_OUTPUT', "setOutput('degraded'", 'publication_status', 'agent_exit_code', 'agent_failure_kind']) need(summary, needle, 'scripts/summarize-harvest-status.js', problems);
if (!fs.existsSync(path.join(ROOT, 'scripts/test-harvest-status-summary.js'))) {
  problems.push('scripts/test-harvest-status-summary.js is missing.');
}
for (const workflow of ['.github/workflows/scrape-seminars.yml', '.github/workflows/scrape-festivals.yml']) {
  if (!fs.existsSync(path.join(ROOT, workflow))) { problems.push(`${workflow} is missing`); continue; }
  const s = read(workflow);
  for (const needle of [
    'timeout-minutes: 45',
    'actions/upload-artifact@v7',
    'actions/checkout@v6',
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
    'requirements-harvest.txt',
    'retention-days: 7',
  ]) need(s, needle, workflow, problems);
  if (s.includes('python3 -m unittest')) problems.push(`${workflow} repeats code-change unit tests during scheduled data collection.`);
  if (s.includes('verify:polymythcal-audit14')) problems.push(`${workflow} repeats the full Audit 14 gate before the publication PR gate.`);
  if (!/actions\/checkout@v(?:6|7|[89]|[1-9][0-9])/.test(s)) problems.push(`${workflow} must use a Node 24-compatible checkout action.`);
  if (!/actions\/setup-node@v(?:6|7|[89]|[1-9][0-9])/.test(s)) problems.push(`${workflow} must use a Node 24-compatible setup-node action.`);
  if (!/actions\/setup-python@v6/.test(s)) problems.push(`${workflow} must use a Node 24-compatible setup-python action.`);
}
const seminarPrompt = read('scripts/seminars-prompt.md');
for (const needle of ['Kingston', 'Montréal', 'A screening qualifies **only when a creator or principal collaborator is confirmed', 'type: "festival"', 'SHARD_COUNT', 'crawled-urgency-reserve', 'smaller verified harvest is better than a failed run', 'findaprotest-toronto', 'qualification_reasons', 'deterministic protest stage', '`defence`', '`meeting`', 'Do not copy the full registered-source roster into the output', "Each row's integer `events` value must equal"]) need(seminarPrompt, needle, 'scripts/seminars-prompt.md', problems);
const sourcesRoster = read('scripts/sources.json');
for (const needle of [
  'findaprotest-toronto',
  'https://www.findaprotest.info/canada/toronto',
  'https://www.thepowerplant.org/whats-on/calendar',
  'https://soundstreams.ca/upcoming-events/',
  'https://www.fields.utoronto.ca/calendar',
  'https://www.concordia.ca/finearts/about/galleries-venues/fofa-gallery.html',
  'https://www.ethics.harvard.edu/calendar/upcoming',
  'https://www.folger.edu/research/the-folger-institute/fellowships/',
  'https://cornwalltourism.com/events/',
]) need(sourcesRoster, needle, 'scripts/sources.json', problems);
if (sourcesRoster.includes('https://soundstreams.ca/wp-json/tribe/events/v1/events')) {
  problems.push('scripts/sources.json restores the retired Soundstreams Tribe endpoint that returns 404.');
}
const festivalPrompt = read('scripts/festivals-prompt.md');
for (const needle of ['Kingston', 'Montréal', 'one parent festival record', 'individual production record', 'type: "festival"', 'SHARD', 'seven consecutive runs', 'source_yields', 'smaller verified harvest is better than a failed run', 'seven once-weekly scheduled slots', 'Every event must use a primary-source `source_id`']) need(festivalPrompt, needle, 'scripts/festivals-prompt.md', problems);
if (festivalPrompt.includes('seven daily shards') || festivalPrompt.includes('run every day') || festivalPrompt.includes('twice-weekly')) {
  problems.push('scripts/festivals-prompt.md describes a cadence other than once weekly.');
}
const ledgerValidator = read('scripts/validate_harvest_source_ledger.py');
for (const needle of [
  'validate_seminars',
  'validate_festivals',
  'skipped-deterministic-success',
  'skipped-disabled',
  'skipped-shard',
  'crawled-urgency-reserve',
  'maximum is 5',
  'without a valid ',
  'agent accounting row',
  'festival source_yields must follow primary_sources roster order',
  '_write_json_atomically',
]) need(ledgerValidator, needle, 'scripts/validate_harvest_source_ledger.py', problems);
if (!fs.existsSync(path.join(ROOT, 'scripts/test_harvest_source_ledger.py'))) {
  problems.push('scripts/test_harvest_source_ledger.py is missing.');
}
for (const [runner, merger] of [
  ['scripts/seminars-prompt-runner.sh', 'python3 scripts/merge_and_finalize.py'],
  ['scripts/festivals-prompt-runner.sh', 'python3 scripts/merge_festivals.py'],
]) {
  const text = read(runner);
  const validatorIndex = text.lastIndexOf('validate_harvest_source_ledger.py');
  const mergerIndex = text.lastIndexOf(merger);
  if (validatorIndex < 0 || mergerIndex < 0 || validatorIndex > mergerIndex) {
    problems.push(`${runner} must validate source accounting before publication merge.`);
  }
}
const seminarMerger = read('scripts/merge_and_finalize.py');
for (const needle of ['merge-seminar-harvest-into-calendar.js', 'finalize-polymythcal-publication.py', 'entry.get("superseded_by")', 'entry.get("id") or make_id', '"city"']) need(seminarMerger, needle, 'scripts/merge_and_finalize.py', problems);
const canonicalEvents = JSON.parse(read('polymythseminars/events.json')).events || [];
const manualEvents = JSON.parse(read('data/manual-events.json')).events || [];
const legacyTargets = new Map();
for (const event of canonicalEvents) for (const legacy of event.legacy_ids || []) legacyTargets.set(String(legacy), String(event.id || event.identity_key));
for (const event of manualEvents) {
  const target = legacyTargets.get(String(event.id || ''));
  if (target && String(event.superseded_by || '') !== target) problems.push(`data/manual-events.json legacy event ${event.id} must declare superseded_by=${target}`);
}
const seminarPublish = read('scripts/merge-seminar-harvest-into-calendar.js');
for (const needle of ['SEMINAR CALENDAR INTEGRATION', 'polymythseminars', 'preservedManual']) need(seminarPublish, needle, 'scripts/merge-seminar-harvest-into-calendar.js', problems);
const diagnostics = read('scripts/summarize-harvest-diagnostics.sh');
for (const needle of ['GITHUB_STEP_SUMMARY', 'Last 120 log lines', 'status.json', "status.get('status'", "status.get('publication_status'", "status.get('agent_exit_code'"]) need(diagnostics, needle, 'scripts/summarize-harvest-diagnostics.sh', problems);
if (!fs.existsSync(path.join(ROOT, 'data/harvest-runs/.gitignore'))) {
  problems.push('data/harvest-runs/.gitignore is missing, so transient status JSON can enter publication PRs.');
} else {
  const harvestIgnore = read('data/harvest-runs/.gitignore');
  for (const needle of ['*', '!.gitignore']) need(harvestIgnore, needle, 'data/harvest-runs/.gitignore', problems);
}
const seminarWorkflow = read('.github/workflows/scrape-seminars.yml');
for (const needle of [
  '47 8 * * 1',
  'Run deterministic priority structured discovery',
  'python3 scripts/harvest_structured_events.py',
  'Build deterministic harvest coverage report',
  'scripts/build-polymythcal-harvest-coverage-report.py',
  '/tmp/polymythcal-harvest-coverage.json',
  'Preserve structured source-health diagnostics',
  'seminars-deterministic-failed.json',
  'publish_deterministic_polymythcal.py --structured-only',
  'node scripts/summarize-harvest-status.js seminars',
  'bash scripts/summarize-harvest-diagnostics.sh seminars',
  'id: harvest_summary',
  "if: failure() || steps.harvest_summary.outputs.degraded == 'true'",
]) need(seminarWorkflow, needle, '.github/workflows/scrape-seminars.yml', problems);
if (!seminarWorkflow.includes('actions/cache/restore@v5') || !seminarWorkflow.includes('actions/cache/save@v5')) {
  problems.push('.github/workflows/scrape-seminars.yml must use Node 24-compatible cache actions v5.');
}
if (!seminarWorkflow.includes('if: failure()')) {
  problems.push('.github/workflows/scrape-seminars.yml uploads diagnostics on successful runs.');
}
if (seminarWorkflow.includes('Run deterministic protest harvest') || seminarWorkflow.includes('python3 scripts/harvest_protests.py')) {
  problems.push('.github/workflows/scrape-seminars.yml duplicates the dedicated protest crawl.');
}
for (const file of [
  'scripts/polymythcal_discovery.py',
  'scripts/polymythcal_source_health.py',
  'scripts/polymythcal_sharding.py',
  'scripts/harvest_protests.py',
  'scripts/harvest_structured_events.py',
  'scripts/build-polymythcal-harvest-coverage-report.py',
  'scripts/validate_polymythcal_sources.py',
  'scripts/publish_protest_harvest.py',
  'scripts/protest-sources.json',
  'data/polymythcal-source-schema.json',
  'data/polymythcal-protest-candidate-schema.json',
  'data/polymythcal-protest-candidates.json',
  'data/polymythcal-http-cache.json',
  'data/polymythcal-identity-shadow.json',
  'scripts/polymythcal_http_cache.py',
  'scripts/polymythcal_identity_shadow.py',
  'scripts/harvest_protests_browser_ocr.py',
  'scripts/build-polymythcal-candidate-surface.py',
  'polymythseminars/candidates.json',
  '.github/workflows/scrape-polymythcal-protests.yml',
]) {
  if (!fs.existsSync(path.join(ROOT, file))) problems.push(`${file} is missing`);
}
const protestWorkflow = read('.github/workflows/scrape-polymythcal-protests.yml');
for (const needle of [
  '18 8 * * 3',
  'Harvest every protest source without sharding',
  'harvest_protests_browser_ocr.py',
  '--browser-ocr-input',
  'publish_protest_harvest.py',
  'build-polymythcal-candidate-surface.py',
  'polymythcal-http-cache.json',
  'requirements-harvest-browser.txt',
  'retention-days: 7',
]) need(protestWorkflow, needle, '.github/workflows/scrape-polymythcal-protests.yml', problems);
if (!protestWorkflow.includes('actions/cache/restore@v5') || !protestWorkflow.includes('actions/cache/save@v5')) {
  problems.push('.github/workflows/scrape-polymythcal-protests.yml must use Node 24-compatible cache actions v5.');
}
if (protestWorkflow.includes('python3 -m unittest')) problems.push('.github/workflows/scrape-polymythcal-protests.yml repeats code-change unit tests in the weekly content job.');
if (protestWorkflow.includes('verify:polymythcal-audit14')) problems.push('.github/workflows/scrape-polymythcal-protests.yml repeats the full Audit 14 gate in the weekly content job.');
if (!protestWorkflow.includes('if: failure()')) problems.push('.github/workflows/scrape-polymythcal-protests.yml uploads diagnostics on successful runs.');
const protestHarvester = read('scripts/harvest_protests.py');
for (const needle of ['evaluate_source_health', 'SOURCE_HEALTH_FAILURE_EXIT', 'source_health_gate', 'confirmed-empty']) need(protestHarvester, needle, 'scripts/harvest_protests.py', problems);
const sourceHealth = read('scripts/polymythcal_source_health.py');
for (const needle of ['evaluate_source_health', 'source_health_gate_error', 'SOURCE_HEALTH_FAILURE_EXIT', 'confirmed-empty', 'no-authoritative-primary-source-observation', 'saved source-yield diagnostics do not pass']) need(sourceHealth, needle, 'scripts/polymythcal_source_health.py', problems);
const protestPublisher = read('scripts/publish_protest_harvest.py');
for (const needle of ['source_health_gate_error', '_shared_gate_error', 'Refusing protest publication']) need(protestPublisher, needle, 'scripts/publish_protest_harvest.py', problems);
const festivalWorkflow = read('.github/workflows/scrape-festivals.yml');
if (!festivalWorkflow.includes('if: failure()')) problems.push('.github/workflows/scrape-festivals.yml uploads diagnostics on successful runs.');
for (const needle of [
  '42 9 * * 2',
  'HARVEST_ATTEMPTS: "1"',
  'HARVEST_TIMEOUT_SECONDS: "1500"',
  'node scripts/summarize-harvest-status.js festivals',
  'bash scripts/summarize-harvest-diagnostics.sh festivals',
  'id: harvest_summary',
  "if: failure() || steps.harvest_summary.outputs.degraded == 'true'",
]) need(festivalWorkflow, needle, '.github/workflows/scrape-festivals.yml', problems);
for (const needle of [
  'HARVEST_TIMEOUT_SECONDS="${HARVEST_TIMEOUT_SECONDS:-1500}"',
  'HARVEST_ATTEMPTS="${HARVEST_ATTEMPTS:-1}"',
  'if [[ "${ATTEMPT}" -lt "${HARVEST_ATTEMPTS}" ]]',
]) need(read('scripts/festivals-prompt-runner.sh'), needle, 'scripts/festivals-prompt-runner.sh', problems);
if (/node scripts\/summarize-harvest-status\.js\s*(?:>>|$)/m.test(festivalWorkflow)) {
  problems.push('.github/workflows/scrape-festivals.yml calls the status summarizer without the required festivals stream.');
}
if (/bash scripts\/summarize-harvest-diagnostics\.sh\s*$/m.test(festivalWorkflow)) {
  problems.push('.github/workflows/scrape-festivals.yml calls the diagnostics summarizer without the required festivals stream.');
}
const discovery = read('scripts/polymythcal_discovery.py');
for (const needle of ['partial-failure', 'wordpress-tec', 'parse_ical', 'RRULE', 'EXDATE', 'MAX_RRULE_OCCURRENCES', '_mixed_calendar_filter', 'parse_campaign_locations', 'actionnetwork.org', 'humanitix.com', 'meetup.com', 'max_elapsed_seconds', 'crawl-budget-exhausted', 'javascript source returned no deterministic event records']) need(discovery, needle, 'scripts/polymythcal_discovery.py', problems);
const sourceSharding = read('scripts/polymythcal_sharding.py');
for (const needle of ['DEFAULT_DETERMINISTIC_SHARD_COUNT = 4', 'stable_source_shard', 'scheduled_deterministic_sources', 'source.get("enabled") is not False', 'DETERMINISTIC_EXTRA_RENDER_MODES']) need(sourceSharding, needle, 'scripts/polymythcal_sharding.py', problems);
const structuredHarvester = read('scripts/harvest_structured_events.py');
for (const needle of ['load_validated_roster', 'load_scheduled_sources', '--run-date', '--shard-count', 'priority-plus-rotating-deterministic-non-protest', 'evaluate_source_health', 'source_health_gate', 'SOURCE_HEALTH_FAILURE_EXIT', 'Publication was blocked']) need(structuredHarvester, needle, 'scripts/harvest_structured_events.py', problems);
const deterministicPublisher = read('scripts/publish_deterministic_polymythcal.py');
for (const needle of ['source_health_gate_error', 'PublicationInputError']) need(deterministicPublisher, needle, 'scripts/publish_deterministic_polymythcal.py', problems);
const sourceValidator = read('scripts/validate_polymythcal_sources.py');
for (const needle of ['Draft202012Validator', 'duplicate id', 'Invalid Polymythcal source roster']) need(sourceValidator, needle, 'scripts/validate_polymythcal_sources.py', problems);
for (const file of ['scripts/harvest_protests.py', 'scripts/harvest_structured_events.py']) {
  const text = read(file);
  for (const needle of ['ThreadPoolExecutor', 'max_workers']) need(text, needle, file, problems);
}
const merger = read('scripts/merge_and_finalize.py');
for (const needle of ['DETERMINISTIC_PROTEST_PATH', 'DETERMINISTIC_STRUCTURED_PATH', 'merge_deterministic_protests', 'merge_deterministic_structured_events', 'merge_source_yield_telemetry', 'deterministic_observations', 'source_health_gate_error']) need(merger, needle, 'scripts/merge_and_finalize.py', problems);
const festivalMerger = read('scripts/merge_festivals.py');
for (const needle of ['merge-festival-harvest-into-calendar.js', 'finalize-polymythcal-publication.py', 'normalize_festival_parents', '"festival", "festival-of-form"']) need(festivalMerger, needle, 'scripts/merge_festivals.py', problems);
if (problems.length) {
  console.error('HARVEST PIPELINE FAILED\n- ' + problems.join('\n- '));
  process.exit(1);
}
console.log('HARVEST PIPELINE OK — bounded, observable, qualification-preserving regional harvest workflow.');
