#!/usr/bin/env node
/* Verify Meaninglib AI Access Pack output and golden queries. */
const fs = require('fs');
const path = require('path');
const child_process = require('child_process');
const { search } = require('./build-ai-access-pack.js');

const root = process.cwd();
const outDir = path.join(root, 'hf_export', 'ai_access_pack');
const reportsDir = path.join(outDir, 'reports');
const mdPath = path.join(outDir, 'latest_access_pack.md');
const jsonPath = path.join(outDir, 'latest_access_pack.json');
const reportPath = path.join(reportsDir, 'ai_access_pack_verification_report.md');
const goldenPath = path.join(root, 'hf_export', 'eval', 'ai_access_pack_golden.jsonl');
function fail(msg){ console.error('FAIL:', msg); process.exit(1); }
function ensureDir(d){ fs.mkdirSync(d, {recursive:true}); }
function readLines(file){ return fs.existsSync(file) ? fs.readFileSync(file,'utf8').split(/\r?\n/).filter(Boolean) : []; }
function normalize(v){ return String(v||'').toLowerCase(); }
function main(){
  ensureDir(reportsDir);
  if(!fs.existsSync(path.join(root, 'hf_export','search','meaninglib_search_index.json'))) fail('missing meaninglib_search_index.json');
  if(!fs.existsSync(mdPath) || !fs.existsSync(jsonPath)) {
    child_process.execFileSync(process.execPath, [path.join(root, 'scripts','build-ai-access-pack.js'), '--query', 'Meaninglib ontology'], {stdio:'inherit'});
  }
  const md = fs.readFileSync(mdPath, 'utf8');
  const required = ['SOURCE OF TRUTH','ONTOLOGY LOCK','LOADED ROUTES','RETRIEVED RULES','ANTI-TWIST CHECK','MEPHISTODATA MODE','CITATION PAYLOAD'];
  const failures = [];
  for(const r of required){ if(!md.includes(`## ${r}`)) failures.push(`missing section ${r}`); }
  if(!/Meaninglib is the mother-category/i.test(md)) failures.push('missing ontology lock wording');
  if(!/Seminar Schools site\/archive is the source of truth/i.test(md)) failures.push('missing source of truth wording');
  if(/ml\* governs/i.test(md)) failures.push('forbidden hierarchy language: ml* governs');
  if(!/Do not psychologize/i.test(md)) failures.push('missing stop-psychologism guard');
  let json;
  try { json = JSON.parse(fs.readFileSync(jsonPath, 'utf8')); } catch(e){ failures.push('latest_access_pack.json invalid JSON'); }
  if(json && (!Array.isArray(json.retrieved) || json.retrieved.length < 3)) failures.push('latest_access_pack.json has too few retrieved rows');

  const goldenDefaults = [
    {query:'Meaninglib ontology', anyStar:['readme','ml']},
    {query:'interdependence rule', anyTitle:['INTERDEPENDENT','Meaninglib']},
    {query:'ML* hierarchy language governs BB*', anyStar:['readme','ml']},
    {query:'stop psychologism', anyTitle:['Stop psychologism']},
    {query:'AI prose tells', anyTitle:['AI prose tells']},
    {query:'bookwormburrows', anyStar:['bb']},
    {query:'modulecanon', anyStar:['mc']},
    {query:'campaigncodex', anyStar:['cc']},
    {query:'HTML txt mirror', anyTitle:['DUAL-WRITE','txt/HTML','html-vs-txt']},
    {query:'mephistodata', anyStar:['ml']},
    {query:'anti-TWIST', anyStar:['ml']},
    {query:'AI Access Pack Meaninglib context', anyStar:['readme','ml']}
  ];
  let golden = goldenDefaults;
  if(fs.existsSync(goldenPath)){
    golden = readLines(goldenPath).map((line, i) => { try { return JSON.parse(line); } catch(e){ failures.push(`golden JSONL invalid line ${i+1}`); return null; }}).filter(Boolean);
  }
  const testLines = [];
  for(const test of golden){
    const results = search(test.query, 8);
    if(results.length < 3){ failures.push(`too few results for ${test.query}`); continue; }
    const top = results.slice(0,5);
    let ok = true;
    if(test.anyStar){ ok = top.some(r => test.anyStar.includes(r.doc.star_file)); }
    if(test.anyTitle){ ok = top.some(r => test.anyTitle.some(t => normalize(r.doc.title).includes(normalize(t)))); }
    if(!ok) failures.push(`golden failed: ${test.query}`);
    testLines.push(`- ${ok ? 'PASS' : 'FAIL'}: ${test.query} -> ${top.map(r => '[' + r.doc.star_file + '] ' + r.doc.title).join(' | ')}`);
  }
  const report = [
    '# Meaninglib AI Access Pack verification report','',
    `Generated: ${new Date().toISOString()}`,'',
    `Latest markdown: hf_export/ai_access_pack/latest_access_pack.md`,
    `Latest JSON: hf_export/ai_access_pack/latest_access_pack.json`,'',
    '## Golden tests','',
    ...testLines,'',
    '## Result','',
    failures.length ? failures.map(f => `- FAIL: ${f}`).join('\n') : '- PASS: AI Access Pack verification passed',
    ''
  ].join('\n');
  fs.writeFileSync(reportPath, report, 'utf8');
  if(failures.length) fail(failures.join('; '));
  console.log('AI Access Pack verification passed');
  console.log('Report: hf_export/ai_access_pack/reports/ai_access_pack_verification_report.md');
}
main();
