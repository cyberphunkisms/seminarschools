#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const failures = [];

function requireToken(source, token, message) {
  if (!source.includes(token)) failures.push(message);
}

const shared = read('scripts/polymythcal_source_health.py');
const structured = read('scripts/harvest_structured_events.py');
const protest = read('scripts/harvest_protests.py');
const deterministicPublisher = read('scripts/publish_deterministic_polymythcal.py');
const protestPublisher = read('scripts/publish_protest_harvest.py');
const merger = read('scripts/merge_and_finalize.py');
const workflow = read('.github/workflows/scrape-seminars.yml');
const protestWorkflow = read('.github/workflows/scrape-polymythcal-protests.yml');
const tests = read('scripts/test_deterministic_before_agent.py');

for (const [token, message] of [
  ['SOURCE_HEALTH_FAILURE_EXIT = 69', 'shared source health needs a distinct failure exit'],
  ['def evaluate_source_health(', 'shared source health evaluator is missing'],
  ['"confirmed-empty"', 'explicit empty observations must remain authoritative'],
  ['"parse-empty-regression"', 'parser collapse must remain a systemic failure'],
  ['"no-authoritative-primary-source-observation"', 'all-source collapse reason is missing'],
  ['def source_health_gate_error(', 'saved-payload validator is missing'],
  ['saved source-yield diagnostics do not pass', 'saved gates must be checked against source rows'],
  ['unknown_source_ids', 'unconfigured diagnostic rows must be rejected'],
]) requireToken(shared, token, message);

for (const [token, message] of [
  ['from polymythcal_source_health import', 'structured harvest must use the shared evaluator'],
  ['source_health_gate = evaluate_source_health(sources, yields)', 'structured harvest must evaluate every selected source'],
  ['"source_health_gate": source_health_gate', 'structured diagnostics must save the gate'],
  ['args.output.write_text(', 'structured diagnostics must be written'],
  ['return SOURCE_HEALTH_FAILURE_EXIT', 'structured collapse must return the distinct failure exit'],
  ['Publication was blocked.', 'structured failure must be explicit'],
]) requireToken(structured, token, message);
if (
  structured.indexOf('args.output.write_text(')
  > structured.indexOf('return SOURCE_HEALTH_FAILURE_EXIT')
) {
  failures.push('structured harvest returns before preserving failure diagnostics');
}

requireToken(protest, 'from polymythcal_source_health import', 'protest and structured crawls must share one source-health definition');
requireToken(protestPublisher, '_shared_gate_error', 'protest publisher must use the shared saved-payload validator');
requireToken(deterministicPublisher, 'source_health_gate_error(', 'deterministic publisher must revalidate source health');
if (
  deterministicPublisher.indexOf('_write_agent_placeholder(agent_placeholder_path)')
  < deterministicPublisher.indexOf('_load_payload(structured_path, stream="structured")')
) {
  failures.push('deterministic publisher writes its placeholder before validating structured health');
}

const structuredMergeAt = merger.indexOf('def merge_deterministic_structured_events');
const structuredGateAt = merger.indexOf('source_health_gate_error(', structuredMergeAt);
const structuredResultAt = merger.indexOf('result = dict(harvest_data)', structuredMergeAt);
if (
  structuredMergeAt < 0
  || structuredGateAt < structuredMergeAt
  || structuredResultAt < structuredGateAt
) {
  failures.push('direct structured merge does not fail closed before changing its result');
}
const protestMergeAt = merger.indexOf('def merge_deterministic_protests');
const protestGateAt = merger.indexOf('source_health_gate_error(', protestMergeAt);
const protestResultAt = merger.indexOf('result = dict(harvest_data)', protestMergeAt);
if (
  protestMergeAt < 0
  || protestGateAt < protestMergeAt
  || protestResultAt < protestGateAt
) {
  failures.push('direct protest merge does not fail closed before changing its result');
}

for (const [token, message] of [
  ['47 8 * * 1,4', 'seminar cadence changed'],
  ['Preserve structured source-health diagnostics', 'failed structured diagnostics are not preserved'],
  ['if: failure()', 'diagnostic preservation must run on failure'],
  ['seminars-deterministic-failed.json', 'failed structured diagnostic artifact path is missing'],
  ['publish_deterministic_polymythcal.py --structured-only', 'structured publication step is missing'],
]) requireToken(workflow, token, message);
if (workflow.includes('continue-on-error: true\n        run: python3 scripts/harvest_structured_events.py')) {
  failures.push('structured source-health failure is incorrectly non-blocking');
}
if (!protestWorkflow.includes('18 */4 * * *') || protestWorkflow.includes('--shard')) {
  failures.push('the unsharded four-hour protest contract changed');
}

for (const testName of [
  'test_all_selected_source_failures_fail_closed',
  'test_confirmed_empty_is_an_authoritative_zero_event_run',
  'test_cli_writes_diagnostics_then_returns_source_health_failure',
  'test_missing_structured_gate_refuses_before_placeholder_or_merge',
  'test_forged_passed_gate_disagreeing_with_yields_is_refused',
  'test_direct_merger_rejects_a_gate_less_structured_payload',
  'test_failed_structured_crawl_preserves_gate_diagnostics',
]) requireToken(tests, testName, `missing focused behavior test ${testName}`);

if (failures.length) {
  console.error('AUDIT37 SOURCE-HEALTH GATE FAILED');
  failures.forEach(failure => console.error(` - ${failure}`));
  process.exit(1);
}

console.log(
  'AUDIT37 SOURCE-HEALTH GATE PASSED — shared evaluator, diagnostic-first failure, ' +
  'publisher/direct-merge refusal, workflow artifact retention, unchanged cadence, and focused tests.'
);
