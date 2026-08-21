#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { preservationDefects } = require('./lib/futureproofing-contract-checks');

const ROOT = path.resolve(__dirname, '..');
const reportPath = path.join(ROOT, 'data', 'futureproofing-preservation-contract.json');
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const defects = preservationDefects(
  report.files,
  rel => fs.readFileSync(path.join(ROOT, rel)),
);

if (defects.length) {
  console.error('FP-07 PRESERVATION CONTRACT FAILED');
  defects.slice(0, 120).forEach(defect => console.error(` - ${defect}`));
  if (defects.length > 120) console.error(` ... ${defects.length - 120} more`);
  process.exit(1);
}

console.log(
  `FP-07 PRESERVATION CONTRACT PASSED — ${report.files.length} accepted files retain exact bytes and SHA-256 identities.`,
);
