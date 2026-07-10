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
check('workflow uploads live report artifact', text.includes('actions/upload-artifact@v6') && text.includes('external-link-live-report.json'));
if (fail) {
  console.error('\nEXTERNAL LINK WORKFLOW CHECK FAILED');
  process.exit(1);
}
console.log('\nEXTERNAL LINK WORKFLOW CHECK PASSED');
