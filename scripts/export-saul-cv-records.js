#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'saul', 'index.html'), 'utf8');
const m = src.match(/const D = (\[[\s\S]*?\n\]);/);
if (!m) throw new Error('Could not read Saul CV data array');
const D = vm.runInNewContext('(' + m[1] + ')');
const text = value => value && typeof value === 'object' ? (value.en || '') : (value || '');
const records = D.map((row, index) => {
  const categories = Array.isArray(row[2]) ? row[2] : [row[2]];
  const projectCopy = text(row[4]) + ' ' + text(row[6]);
  const isProject = categories.includes('seminarschools');
  const status = isProject && /concept/i.test(projectCopy)
    ? 'conceptual'
    : isProject && /development|developing|in progress/i.test(projectCopy)
      ? 'in development'
      : 'completed or ongoing experience';
  return {
    index,
    section_weight: row[0],
    date: row[1],
    categories,
    title: text(row[3]),
    note: text(row[4]),
    url: row[5] || null,
    description: text(row[6]),
    status,
    source: 'saul/index.html embedded historical career and project archive'
  };
});
const out = {
  generated_at: new Date().toISOString(),
  purpose: 'Structured factual snapshot and verification ledger for the modular online CV. The live page remains the public rendering source.',
  locked_wording: {
    experience: '12+ years of international teaching experience',
    curricula: '15 curricula & programs',
    learner_scale: '2,000+ students'
  },
  retired_claims: ['PhD Candidate', '1,000+ students', 'Seminar Schools as an operating institution', 'delivered status for conceptual projects'],
  records
};
const outfile = path.join(root, 'data', 'saul-cv-records.json');
fs.writeFileSync(outfile, JSON.stringify(out, null, 2) + '\n');
console.log(`Wrote ${outfile} with ${records.length} records.`);
