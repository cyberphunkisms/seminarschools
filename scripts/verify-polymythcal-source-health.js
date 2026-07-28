#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const failures = [];
const need = (source, token, message) => {
  if (!source.includes(token)) failures.push(message);
};

const shared = read('scripts/polymythcal_source_health.py');
const structured = read('scripts/harvest_structured_events.py');
const protest = read('scripts/harvest_protests.py');
const deterministicPublisher = read('scripts/publish_deterministic_polymythcal.py');
const protestPublisher = read('scripts/publish_protest_harvest.py');
const merger = read('scripts/merge_and_finalize.py');
const sharding = read('scripts/polymythcal_sharding.py');
const seminarRunner = read('scripts/seminars-prompt-runner.sh');
const behaviorTests = read('scripts/test_deterministic_before_agent.py');
const shardingTests = read('scripts/test_polymythcal_sharding.py');
const seminarWorkflow = read('.github/workflows/scrape-seminars.yml');
const protestWorkflow = read('.github/workflows/scrape-polymythcal-protests.yml');

for (const [token, message] of [
  ['SOURCE_HEALTH_FAILURE_EXIT = 69', 'distinct source-health failure exit is missing'],
  ['MINIMUM_AUTHORITATIVE_RATIO = 0.25', 'broad source-health quorum is missing'],
  ['MINIMUM_CRITICAL_AUTHORITATIVE_RATIO = 0.10', 'critical-source floor is missing'],
  ['"confirmed-empty"', 'explicit empty observations must remain authoritative'],
  ['minimum_authoritative_primary_sources', 'coverage-quorum evidence is missing'],
  ['minimum_authoritative_critical_sources', 'critical-source evidence is missing'],
  ['insufficient-authoritative-primary-source-coverage', 'systemic coverage failure reason is missing'],
  ['insufficient-critical-source-coverage', 'critical-source failure reason is missing'],
  ['expected_stream: str | None = None', 'payload stream binding is missing'],
  ['expected_scope: str | None = None', 'payload scope binding is missing'],
  ['selected_source_ids = payload.get("selected_source_ids")', 'saved selection binding is missing'],
  ['source-health gate does not meet its authoritative coverage quorum', 'saved gate quorum validation is missing'],
]) need(shared, token, message);

const authoritativeBlock = shared.match(/AUTHORITATIVE_SOURCE_STATUSES\s*=\s*\{([\s\S]*?)\}/)?.[1] || '';
if (authoritativeBlock.includes('not-modified')) {
  failures.push('bare HTTP 304 is still treated as authoritative without retained parsed data');
}

for (const [source, tokens, label] of [
  [deterministicPublisher, ['expected_stream={', '"deterministic-protests"', '"deterministic-structured-events"'], 'deterministic publisher'],
  [protestPublisher, ['expected_stream="deterministic-protests"'], 'protest publisher'],
  [merger, ['expected_stream="deterministic-protests"', 'expected_stream="deterministic-structured-events"'], 'direct merger'],
  [structured, ['evaluate_source_health(sources, yields)', '"source_health_gate": source_health_gate'], 'structured harvester'],
  [protest, ['evaluate_source_health', 'load_candidate_state'], 'protest harvester'],
]) {
  for (const token of tokens) need(source, token, `${label} is missing ${token}`);
}
if (!/RequestsFetcher\(\s*timeout=request_timeout\s*\)/.test(protest)) {
  failures.push('protest harvester is missing RequestsFetcher(timeout=request_timeout)');
}

for (const token of [
  'def successful_deterministic_source_ids(',
  'row.get("status") == "success"',
  'row.get("role") != "corroboration"',
]) need(sharding, token, `deterministic paid-work deduplication is missing ${token}`);
need(
  seminarRunner,
  'Skip these configured sources whose deterministic stage fully succeeded',
  'paid-agent prompt does not receive the complete deterministic success set',
);

for (const testName of [
  'test_not_modified_without_retained_observation_is_not_authoritative',
  'test_stream_mismatch_refuses_before_placeholder_or_merge',
  'test_direct_merger_rejects_a_wrong_structured_stream',
  'test_selection_mismatch_refuses_before_placeholder_or_merge',
  'test_scope_mismatch_refuses_before_placeholder_or_merge',
  'test_near_total_source_failure_does_not_pass_on_one_success',
  'test_quarter_source_quorum_allows_bounded_partial_outage',
  'test_critical_source_floor_is_independent_of_overall_quorum',
]) need(behaviorTests, testName, `focused source-health test ${testName} is missing`);
need(
  shardingTests,
  'test_all_and_only_fully_successful_deterministic_sources_are_skipped',
  'focused paid-work deduplication test is missing',
);

if (!seminarWorkflow.includes('47 8 * * 1')) failures.push('weekly seminar cadence changed');
if (!protestWorkflow.includes('18 8 * * 3') || protestWorkflow.includes('--shard')) {
  failures.push('weekly unsharded deterministic protest cadence changed');
}
if (/CLAUDE|ANTHROPIC/.test(protestWorkflow)) {
  failures.push('the weekly protest crawl unexpectedly uses a paid agent');
}

if (failures.length) {
  console.error('POLYMYTHCAL SOURCE-HEALTH INTEGRITY FAILED');
  failures.forEach(failure => console.error(` - ${failure}`));
  process.exit(1);
}

console.log(
  'POLYMYTHCAL SOURCE-HEALTH INTEGRITY PASSED — 25% overall quorum, critical-source floor, '
    + '304 refusal, stream binding, complete deterministic paid-work skips, and weekly harvest cadence.',
);
