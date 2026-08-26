#!/usr/bin/env node
/* Verify Meaninglib AI Access Pack output and golden queries. */
const fs = require('fs');
const path = require('path');
const child_process = require('child_process');
const crypto = require('crypto');
const { search } = require('./build-ai-access-pack.js');
const {loadCanonicalCore} = require('./sync-core-personal-rules');
const {generatedAt} = require('./lib/deterministic-timestamp');

const root = process.cwd();
const releaseTimestamp = JSON.parse(fs.readFileSync(path.join(root, 'RELEASE_MANIFEST.json'), 'utf8')).generated_at || '1970-01-01T00:00:00Z';
const outDir = path.join(root, 'hf_export', 'ai_access_pack');
const reportsDir = path.join(outDir, 'reports');
const mdPath = path.join(outDir, 'latest_access_pack.md');
const jsonPath = path.join(outDir, 'latest_access_pack.json');
const reportPath = path.join(reportsDir, 'ai_access_pack_verification_report.md');
const activationPath = path.join(outDir, 'MEPHISTODATA_ACTIVATION.md');
const goldenPath = path.join(root, 'hf_export', 'eval', 'ai_access_pack_golden.jsonl');
function fail(msg){ console.error('FAIL:', msg); process.exit(1); }
function ensureDir(d){ fs.mkdirSync(d, {recursive:true}); }
function readLines(file){ return fs.existsSync(file) ? fs.readFileSync(file,'utf8').split(/\r?\n/).filter(Boolean) : []; }
function normalize(v){ return String(v||'').toLowerCase(); }
function sha256(v){ return crypto.createHash('sha256').update(String(v || ''), 'utf8').digest('hex'); }
function main(){
  ensureDir(reportsDir);
  if(!fs.existsSync(path.join(root, 'hf_export','search','meaninglib_search_index.json'))) fail('missing meaninglib_search_index.json');
  if(!fs.existsSync(mdPath) || !fs.existsSync(jsonPath) || !fs.existsSync(activationPath)) {
    child_process.execFileSync(process.execPath, [path.join(root, 'scripts','build-ai-access-pack.js'), '--query', 'Meaninglib ontology'], {stdio:'inherit'});
  }
  const md = fs.readFileSync(mdPath, 'utf8');
  const required = ['SOURCE OF TRUTH','ONTOLOGY LOCK','CORE / CORE+ GATES','LOADED ROUTES','RETRIEVED RULES','ANTI-TWIST CHECK','MEPHISTODATA MODE','CITATION PAYLOAD'];
  const failures = [];
  for(const r of required){ if(!md.includes(`## ${r}`)) failures.push(`missing section ${r}`); }
  if(!/Meaninglib is the mother-category/i.test(md)) failures.push('missing ontology lock wording');
  if(!/Seminar Schools site\/archive is the source of truth/i.test(md)) failures.push('missing source of truth wording');
  if(/ml\* governs/i.test(md)) failures.push('forbidden hierarchy language: ml* governs');
  if(!/Do not psychologize/i.test(md)) failures.push('missing stop-psychologism guard');
  if(!/NO RANDOM ARTIFACTS/i.test(md) || !/A requirement invented or amended during the same task cannot authorize its own file/i.test(md) || !/Audit results default to the response/i.test(md)) failures.push('missing no-random-artifact gate');
  if(!/NO PLANTED CONCLUSION/i.test(md) || !/exact source language or neutral source facts/i.test(md) || !/The answer must do the interpretation/i.test(md)) failures.push('missing no-planted-conclusion gate');
  if(!fs.existsSync(activationPath)) {
    failures.push('missing MEPHISTODATA_ACTIVATION.md');
  } else {
    const activation = fs.readFileSync(activationPath, 'utf8');
    const activationRequired = ['MEPHISTODATA ACTIVATION','EXACT CORE / PERSONAL RULES','SOURCE OF TRUTH','CURRENT EXECUTION LOCK','CONDITIONAL PROJECT LOAD','ONTOLOGY LOCK','OPERATING MODE','TASK-SPECIFIC RETRIEVAL','RESPONSE CONTRACT'];
    for(const r of activationRequired){ if(!activation.includes(r)) failures.push(`activation missing section ${r}`); }
    const core = loadCanonicalCore();
    const embedded = activation.match(/<!-- BEGIN EXACT CORE -->\n([\s\S]*?)\n<!-- END EXACT CORE -->/);
    if(!embedded || `${embedded[1]}\n` !== core.document) failures.push('activation does not embed the exact canonical CORE document');
    if(!activation.includes(`Canonical id: ${core.id}`)) failures.push('activation does not identify the canonical CORE owner');
    if(!activation.includes(`SHA-256 (exact UTF-8 document including the final newline): ${core.sha256}`)) failures.push('activation does not bind the exact CORE document hash');
    if(sha256(core.document) !== core.sha256) failures.push('canonical CORE helper returned an invalid hash');
    if(!/Meaninglib is the mother-category/i.test(activation)) failures.push('activation missing ontology lock wording');
    if(/ml\* governs/i.test(activation)) failures.push('activation uses forbidden hierarchy language: ml* governs');
    if(!/Do not psychologize/i.test(activation)) failures.push('activation missing stop-psychologism guard');
    if(!activation.includes('CORE+ FIRST. Follow CORE + newest canonical CORE+ as one system.')) failures.push('activation missing portable CORE first rule');
    if(!activation.includes('CORE+=all other active rules;')) failures.push('activation missing compact complete CORE+ definition');
    if(!activation.includes('Analysis=>response, never a new file.')) failures.push('activation missing compact no-random-artifact gate');
    if(!activation.includes("Mephistodata, Devil's Diary, CORE, or CORE+")) failures.push("activation preamble does not explicitly trigger Mephistodata and Devil's Diary work");
    if(!activation.includes('Canonical CORE+ locator: https://seminarschools.com/polymyth/methodologylist-coreplus.txt')) failures.push('activation missing stable canonical CORE+ locator');
    if(!activation.includes('Canonical full Methodologylist locator: https://seminarschools.com/polymyth/methodologylist.txt')) failures.push('activation missing stable canonical full Methodologylist locator');
    if(!activation.includes('coreplus-current-map-amendment-2026-08-26')) failures.push('activation missing current August 26 map companion');
    if(!activation.includes('coreplus-handler-mephistodata-execution-gates-2026-08-26')) failures.push('activation missing current fail-closed execution owner');
    if(!activation.includes('method-controlled-archive-evidence-institutional-metrics-2026-08-26')) failures.push('activation missing controlled-archive owner');
    if(!activation.includes('explicit Mephistodata reactivation discards the unsent stale draft')) failures.push('activation missing reactivation reset behavior');
    if(!activation.includes("For Devil's Diary work, load the current CORE+ Devil's Diary dispatch plus the base recipe, comprehensive article rules, Audience-register separation, anti-twisting and SOURCE-STATUS owners, Interpretive pleonexia, and the Mephistodata mirror criterion before drafting.")) failures.push("activation missing exact Devil's Diary handler dispatch");
    if(!/Otherwise apply portable CORE alone/i.test(activation)) failures.push('activation missing conditional ML fallback');
    if(!/Do not make Mephistodata or ML\* session-wide merely because this file was opened/i.test(activation)) failures.push('activation missing no-session-wide-load rule');
    for(const forbidden of [
      'Treat Mephistodata as an operating context for this session',
      'Load Meaninglib as the substrate for interpreting the task',
      'Open every response with one of two openers',
      'Ask the operator what they want to degorgonify, build, or analyze',
    ]) if(activation.includes(forbidden)) failures.push(`activation retains obsolete unconditional instruction: ${forbidden}`);
    const published = path.join(root, 'polymyth', 'mephistodata-activation.md');
    if(!fs.existsSync(published) || fs.readFileSync(published, 'utf8') !== activation) failures.push('published activation mirror differs from generated activation');
  }
  let json;
  try { json = JSON.parse(fs.readFileSync(jsonPath, 'utf8')); } catch(e){ failures.push('latest_access_pack.json invalid JSON'); }
  if(json && (!Array.isArray(json.retrieved) || json.retrieved.length < 3)) failures.push('latest_access_pack.json has too few retrieved rows');
  if(json && (process.env.MEPHISTODATA_GENERATED_AT || process.env.SOURCE_DATE_EPOCH)) {
    const expectedTimestamp = generatedAt();
    if(json.generated_at !== expectedTimestamp) failures.push(`access-pack timestamp does not match deterministic build timestamp ${expectedTimestamp}`);
    if(!md.includes(`Generated: ${expectedTimestamp}`)) failures.push('access-pack markdown timestamp differs from deterministic build timestamp');
  }

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
    {query:'AI Access Pack Meaninglib context', anyStar:['readme','ml']},
    {query:'activate Mephistodata using Hugging Face for another AI', anyStar:['readme','ml']},
    {query:'portable CORE personal rules follow CORE+', anyTitle:['CORE / Personal Rules','CORE CURRENT MAP']}
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
    `Generated: ${releaseTimestamp}`,'',
    `Latest markdown: hf_export/ai_access_pack/latest_access_pack.md`,
    `Latest JSON: hf_export/ai_access_pack/latest_access_pack.json`,
    `Activation markdown: hf_export/ai_access_pack/MEPHISTODATA_ACTIVATION.md`,'',
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
