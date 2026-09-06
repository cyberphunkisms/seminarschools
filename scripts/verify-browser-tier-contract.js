#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const policy = JSON.parse(read('data/browser-test-tiers.json'));
const workflow = read('.github/workflows/browser-assurance.yml');
const runner = read('scripts/run-browser-test-tier.mjs');
const selection = read('scripts/lib/browser-test-tiers.js');
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

check(policy.schema === 'seminar-schools-browser-test-tiers-v1' && policy.contract_id === 'FP-08', 'browser contract identity drifted');
check(JSON.stringify(Object.keys(policy.tiers)) === JSON.stringify(['changed', 'family', 'full']), 'three browser tiers are not exact');
check(policy.tiers.changed.selection === 'changed-pages-with-family-expansion', 'changed-page tier lost shared-impact expansion');
check(policy.tiers.family.selection === 'every-route-type', 'release family tier no longer covers each route type');
check(policy.tiers.full.selection === 'every-renderable-page' && policy.tiers.full.full_page === true, 'scheduled tier is not full inventory/full-page');
check(policy.tiers.full.shard_count === 16, 'scheduled shard contract drifted');
check(policy.exact_exceptions.length === 1 && policy.exact_exceptions[0] === 'google20234ae70106ee9d.html', 'browser exception is not the exact verification token');
for (const token of ['pull_request:', 'push:', 'workflow_dispatch:', 'schedule:', '--tier changed', '--tier family', '--tier full', 'fail-fast: false', 'shard: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]', '--shard-count 16']) {
  check(workflow.includes(token), `browser workflow misses ${token}`);
}
for (const token of ["fullPage: contract.tiers[tier].full_page === true", "data-geometry-ready", "geometryExemptionForRelativeHtmlPath", "geometryOpacityBounds", "document.documentElement.clientWidth", "frontFacing !== 'general-audience'", "state.overflow > 1", "runtimeErrors.length", "pointerEvents !== 'none'", "value === 'Failed to load resource: net::ERR_FAILED'", "runtimeErrors.push(value)"]) {
  check(runner.includes(token), `browser runner misses ${token}`);
}
for (const token of ['familyRepresentatives(pages)', "tier === 'full'", 'index % shardCount === shardIndex', 'hasSharedImpact(changedFiles)']) {
  check(selection.includes(token), `browser page selection misses ${token}`);
}
check((policy.required_assertions || []).length === 5, 'browser assertion inventory drifted');

if (failures.length) {
  console.error('FP-08 BROWSER TIER CONTRACT FAILED');
  failures.forEach(failure => console.error(` - ${failure}`));
  process.exit(1);
}
console.log('FP-08 BROWSER TIER CONTRACT PASSED — changed pages, every release family, and scheduled sharded full-page rendering are enforced.');
