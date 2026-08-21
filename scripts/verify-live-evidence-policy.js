#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const policy = JSON.parse(read('data/live-evidence-policy.json'));
const pkg = JSON.parse(read('package.json'));
const failures = [];

if (policy.schema !== 'seminar-schools-live-evidence-policy-v1' || policy.contract_id !== 'FP-09') {
  failures.push('live evidence policy identity drifted');
}
for (const claim of policy.claims || []) {
  if (!Number.isFinite(claim.max_age_hours) || claim.max_age_hours <= 0 || claim.max_age_hours > 336) {
    failures.push(`${claim.id}: invalid or overlong live-evidence lifetime`);
  }
  if (!fs.existsSync(path.join(ROOT, claim.report))) failures.push(`${claim.id}: report missing`);
  const workflow = read(claim.release_workflow);
  const packageCommand = pkg.scripts && pkg.scripts['verify:audit48-live-harvest:current'];
  if (packageCommand !== claim.strict_verifier) failures.push(`${claim.id}: strict package verifier drifted`);
  if (!workflow.includes('npm run verify:audit48-live-harvest:current')) {
    failures.push(`${claim.id}: release workflow does not require current evidence`);
  }
  if (claim.historical_mode_may_not_claim_current !== true) {
    failures.push(`${claim.id}: historical/current claim boundary is missing`);
  }
}
const verifier = read('scripts/verify_audit48_live_harvest.py');
for (const token of ['expiration_failures(', '--require-current', '--max-age-hours']) {
  if (!verifier.includes(token)) failures.push(`live verifier misses ${token}`);
}

if (failures.length) {
  console.error('FP-09 LIVE-EVIDENCE POLICY FAILED');
  failures.forEach(failure => console.error(` - ${failure}`));
  process.exit(1);
}
console.log('FP-09 LIVE-EVIDENCE POLICY PASSED — current claims expire within 336 hours; historical validation cannot silently renew them.');
