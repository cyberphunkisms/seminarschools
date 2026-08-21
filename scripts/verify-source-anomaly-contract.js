#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const history = JSON.parse(read('data/harvest-source-history.json'));
const moduleText = read('scripts/polymythcal_source_anomalies.py');
const cli = read('scripts/check-polymythcal-source-anomalies.py');
const seminars = read('.github/workflows/scrape-seminars.yml');
const protests = read('.github/workflows/scrape-polymythcal-protests.yml');
const seminarAgent = read('scripts/seminars-prompt-runner.sh');
const festivalAgent = read('scripts/festivals-prompt-runner.sh');
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

check(history.schema === 'polymythcal-source-anomaly-history-v1' && history.contract_id === 'FP-10', 'source anomaly history identity drifted');
check(history.policy.minimum_baseline_observations >= 3, 'per-source baselines do not require warmup');
check(history.policy.history_limit_per_source <= 12, 'per-source history is unbounded');
for (const token of ['status-regression', 'events-collapse', 'events-spike', 'pages-fetched-spike', 'rejection-rate-spike', 'confirmed_empty']) {
  check(moduleText.includes(token), `per-source detector misses ${token}`);
}
for (const token of ['--strict', '--write-history', 'report["status"] == "passed"', 'ANOMALY_EXIT = 68']) {
  check(cli.includes(token), `source anomaly CLI misses ${token}`);
}
check(seminars.includes('--stream seminars-deterministic') && seminars.indexOf('check-polymythcal-source-anomalies.py') < seminars.indexOf('publish_deterministic_polymythcal.py'), 'deterministic seminar anomalies are not checked before publication');
check(protests.includes('--stream protests-deterministic') && protests.indexOf('check-polymythcal-source-anomalies.py') < protests.indexOf('publish_protest_harvest.py'), 'protest anomalies are not checked before publication');
check(seminarAgent.includes('--stream seminars-agent') && seminarAgent.indexOf('check-polymythcal-source-anomalies.py') < seminarAgent.lastIndexOf('merge_and_finalize.py'), 'seminar agent anomalies are not checked before merge');
check(festivalAgent.includes('--stream festivals-agent') && festivalAgent.indexOf('check-polymythcal-source-anomalies.py') < festivalAgent.indexOf('merge_festivals.py'), 'festival anomalies are not checked before merge');

if (failures.length) {
  console.error('FP-10 PER-SOURCE ANOMALY CONTRACT FAILED');
  failures.forEach(failure => console.error(` - ${failure}`));
  process.exit(1);
}
console.log('FP-10 PER-SOURCE ANOMALY CONTRACT PASSED — each scraper stream checks mature source-specific yield/status anomalies before publication.');
