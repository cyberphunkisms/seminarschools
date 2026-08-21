#!/usr/bin/env node
'use strict';
/** Verifies the live external-link audit exists as a CI artifact-producing workflow. */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
let fail = 0;
function check(name, ok) { console.log((ok ? 'PASS' : 'FAIL') + '  ' + name); if (!ok) fail = 1; }
const wf = path.join(ROOT, '.github/workflows/audit-external-links.yml');
const text = fs.existsSync(wf) ? fs.readFileSync(wf, 'utf8') : '';
check('external link workflow exists', text.length > 0);
check('workflow runs manually', text.includes('workflow_dispatch'));
check('workflow runs on a schedule', text.includes('schedule:'));
check('workflow invokes live external link checker', text.includes('scripts/audit-external-links-live.js'));
check('workflow runs strict live checks', text.includes('EXTERNAL_LINK_STRICT: "1"') || text.includes('EXTERNAL_LINK_STRICT: 1'));
check('workflow uploads live report artifact', /actions\/upload-artifact@v(?:7|[89]|[1-9][0-9]+)/.test(text) && text.includes('external-link-live-report.json'));
check('workflow remains once weekly on Sunday', /cron:\s*["']17 10 \* \* 0["']/.test(text));
check('workflow preserves the exact 350-URL ceiling', /EXTERNAL_LINK_CHECK_LIMIT:\s*["']350["']/.test(text));
check('workflow configures bounded global concurrency', /EXTERNAL_LINK_CONCURRENCY:\s*["']16["']/.test(text));
check('workflow configures per-host throttling', /EXTERNAL_LINK_PER_HOST_CONCURRENCY:\s*["']4["']/.test(text));
check('workflow restores the bounded live cache', text.includes('actions/cache/restore@v5') && text.includes('scripts/reports/external-link-live-cache.json'));
check('workflow saves the bounded live cache even after strict failures', text.includes('actions/cache/save@v5') && text.includes("if: always() && hashFiles('scripts/reports/external-link-live-cache.json') != ''"));
check('workflow cache key is unique per run attempt', text.includes('github.run_id') && text.includes('github.run_attempt'));
check('workflow cache restore prefix is schema- and OS-scoped', text.includes('external-link-live-v1-${{ runner.os }}-'));
if (fail) {
  console.error('\nEXTERNAL LINK WORKFLOW CHECK FAILED');
  process.exit(1);
}
console.log('\nEXTERNAL LINK WORKFLOW CHECK PASSED');
