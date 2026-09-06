#!/usr/bin/env node
/* Verify Meaninglib AI Access Pack output and golden queries. */
const fs = require('fs');
const path = require('path');
const child_process = require('child_process');
const crypto = require('crypto');
const {
  search,
  registerLockLines,
  CURRENT_EXECUTION_OWNER,
  DEGORGONIFIED_FEMINISM_LABEL,
  DEGORGONIFIED_FEMINISM_OWNER,
  FEMINISM_ACADEMIC_RESEARCH_OWNERS,
  isDegorgonifiedFeminismQuery,
  isFeminismAcademicResearchQuery,
} = require('./build-ai-access-pack.js');
const {loadCanonicalCore} = require('./sync-core-personal-rules');
const {generatedAt} = require('./lib/deterministic-timestamp');

const root = process.cwd();
const reportTimestamp = generatedAt();
const outDir = path.join(root, 'hf_export', 'ai_access_pack');
const reportsDir = path.join(outDir, 'reports');
const mdPath = path.join(outDir, 'latest_access_pack.md');
const jsonPath = path.join(outDir, 'latest_access_pack.json');
const reportPath = path.join(reportsDir, 'ai_access_pack_verification_report.md');
const activationPath = path.join(outDir, 'MEPHISTODATA_ACTIVATION.md');
const goldenPath = path.join(root, 'hf_export', 'eval', 'ai_access_pack_golden.jsonl');
const currentWritingOwner = 'coreplus-handler-writing-composition-delivery-2026-08-29';
const registerLockNeedles = [
  `Current execution owner is ${CURRENT_EXECUTION_OWNER}.`,
  'Every ML*-active conversational response begins at byte zero with exactly one literal opener.',
  'The default is `Mephistodata would say:`.',
  'changes only that response to `Mephistodata bloomed:`',
  'The next ML*-active response resets to the default unless Bloom is explicitly invoked again.',
  'Bloom never persists, self-initiates, or imposes an automatic question-first form.',
  'The opener is excluded from character scoring and never substitutes for the body.',
  'source-grounded Mephistophelean diagnostic intelligence with Data-level evidence',
  'Prefix-only, Data-only, costume-only, sycophantic, unsupported-source, and invented-opposition drafts fail closed.'
];
const writingLockNeedles = [
  `Current writing owner is ${currentWritingOwner}.`,
  'Load the current writing owner before drafting every assistant-authored conversational answer or artifact, then run it again before delivery.',
  'Composition begins with source lock and paragraph map, then runs clause admission, sentence close, paragraph close, and document close.',
  'Revise from the accepted original, preserve every untouched feature',
  'Block needless repetition of the same salient content word or lemma within one sentence.',
  'Using includes twice in one sentence is the canonical failure.',
  'Require sentence-topic continuity or a genuine marked shift.',
  'Never invent a conceptual bridge to make adjacent material look coherent.',
  'A protected span never exempts surrounding assistant-authored prose.',
  'Authored ordinary prose uses no colons, semicolons, em dashes, en dashes, or dash-attached clauses.',
  'Mechanical lint identifies candidates. Semantic review decides necessity, fidelity, topic relation, distinctiveness, and meaning.'
];
function fail(msg){ console.error('FAIL:', msg); process.exit(1); }
function ensureDir(d){ fs.mkdirSync(d, {recursive:true}); }
function readLines(file){ return fs.existsSync(file) ? fs.readFileSync(file,'utf8').split(/\r?\n/).filter(Boolean) : []; }
function normalize(v){ return String(v||'').toLowerCase(); }
function sha256(v){ return crypto.createHash('sha256').update(String(v || ''), 'utf8').digest('hex'); }
function expectedRetrieved(results){
  return results.map(result => ({score:Number(result.score.toFixed(2)), ...result.doc}));
}
function expectedRetrievedMarkdown(results){
  const lines = [];
  results.forEach((result, index) => {
    const doc = result.doc;
    lines.push(`### ${index + 1}. [${doc.star_file || 'unknown'}] ${doc.title}`);
    lines.push(`- Score: ${result.score.toFixed(2)}`);
    lines.push(`- ID: ${doc.id}`);
    lines.push(`- Source path: ${doc.source_path}`);
    if(doc.route) lines.push(`- Route: ${doc.route}`);
    if(doc.section) lines.push(`- Section: ${doc.section}`);
    lines.push('');
    lines.push(String(doc.preview || '').replace(/\s+/g, ' ').trim());
    lines.push('');
  });
  return lines.join('\n');
}
function verifyFeminismAcademicResearchOwners(rows, label, failures){
  const retrievedById = new Map(rows.map(row => [row.id || row.doc?.id, row]));
  for(const owner of FEMINISM_ACADEMIC_RESEARCH_OWNERS){
    const row = retrievedById.get(owner.id);
    const title = row && (row.title || row.doc?.title);
    if(!row || title !== owner.title){
      failures.push(`${label} misses exact canonical owner ${owner.id} | ${owner.title}`);
    }
  }
}
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
  if(!md.includes('## CURRENT REGISTER LOCK')) failures.push('missing current register lock section');
  for(const needle of registerLockNeedles){
    if(!md.includes(needle)) failures.push(`current register lock missing from access-pack markdown: ${needle}`);
  }
  if(!md.includes('## CURRENT WRITING LOCK')) failures.push('missing current writing lock section');
  for(const needle of writingLockNeedles){
    if(!md.includes(needle)) failures.push(`current writing lock missing from access-pack markdown: ${needle}`);
  }
  if(!fs.existsSync(activationPath)) {
    failures.push('missing MEPHISTODATA_ACTIVATION.md');
  } else {
    const activation = fs.readFileSync(activationPath, 'utf8');
    const activationRequired = ['MEPHISTODATA ACTIVATION','EXACT CORE / PERSONAL RULES','SOURCE OF TRUTH','CURRENT EXECUTION LOCK','CURRENT REGISTER LOCK','CURRENT WRITING LOCK','CONDITIONAL PROJECT LOAD','DEGORGONIFIED FEMINISM RECALL','ONTOLOGY LOCK','OPERATING MODE','TASK-SPECIFIC RETRIEVAL','RESPONSE CONTRACT'];
    for(const r of activationRequired){ if(!activation.includes(r)) failures.push(`activation missing section ${r}`); }
    for(const needle of [
      'An exact user query of `degorgonified feminism` activates ML* for that task.',
      'Retrieve the complete bodies of the six canonical owners identified below and restate their combined feminism definition and academic-research controls.',
      'It does not name an innocent or purified feminist subtype, create a clean feminist remainder, or mean Arendtianfeminism.',
      ...FEMINISM_ACADEMIC_RESEARCH_OWNERS.flatMap(owner => [owner.id, owner.title]),
    ]) if(!activation.includes(needle)) failures.push(`activation missing degorgonified-feminism recall contract: ${needle}`);
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
    for(const needle of registerLockNeedles){
      if(!activation.includes(needle)) failures.push(`current register lock missing from activation: ${needle}`);
    }
    for(const needle of writingLockNeedles){
      if(!activation.includes(needle)) failures.push(`current writing lock missing from activation: ${needle}`);
    }
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
  if(json && Array.isArray(json.retrieved)) {
    const liveResults = search(json.query, 8);
    const expectedRows = expectedRetrieved(liveResults);
    if(JSON.stringify(json.retrieved) !== JSON.stringify(expectedRows)) {
      failures.push('latest_access_pack.json retrieved rows differ from search(query, 8) in identity, order, score, or document payload');
    }
    const retrievedMatch = md.match(/## RETRIEVED RULES\n\n([\s\S]*?)\n## ANTI-TWIST CHECK/);
    if(!retrievedMatch) failures.push('access-pack markdown has no bounded RETRIEVED RULES block');
    else if(retrievedMatch[1] !== expectedRetrievedMarkdown(liveResults)) {
      failures.push('access-pack Markdown retrieved rows differ from search(query, 8) ordered row blocks');
    }
    if(isFeminismAcademicResearchQuery(json.query)){
      verifyFeminismAcademicResearchOwners(
        json.retrieved,
        'successor feminism/academic-research access pack top eight',
        failures,
      );
    }
  }
  if(json && json.current_execution_owner !== CURRENT_EXECUTION_OWNER) failures.push('latest_access_pack.json missing current execution owner');
  if(json && !Array.isArray(json.register_lock)) failures.push('latest_access_pack.json missing register lock');
  if(json && Array.isArray(json.register_lock)){
    const jsonRegisterLock = json.register_lock.join('\n');
    for(const needle of registerLockNeedles){
      if(!jsonRegisterLock.includes(needle)) failures.push(`current register lock missing from access-pack JSON: ${needle}`);
    }
  }
  if(json && json.current_writing_owner !== currentWritingOwner) failures.push('latest_access_pack.json missing current writing owner');
  if(json && !Array.isArray(json.writing_composition_lock)) failures.push('latest_access_pack.json missing writing composition lock');
  if(json && Array.isArray(json.writing_composition_lock)){
    const jsonWritingLock = json.writing_composition_lock.join('\n');
    for(const needle of writingLockNeedles){
      if(!jsonWritingLock.includes(needle)) failures.push(`current writing lock missing from access-pack JSON: ${needle}`);
    }
  }
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
    ,{query:'current non-strawman project comparison Polycognate genealogy always-already boundaries', anyContent:['non-strawman','strongest actual claim','current-position','user ruling']}
    ,{query:'individual Polycognate claims examples structural position same operation', anyContent:['polycognate','structural position','same operation']}
    ,{query:'boundaries historical genealogy structural analogy direct transmission', anyContent:['boundaries','structural analogy','direct transmission']}
    ,{query:'Detienne comparison point in favor always-already', anyContent:['detienne','always-already','always already']}
    ,{query:'Clastres Society Against the State source project', topContent:['clastres','society against the state'], topSection:'citation'}
  ];
  let golden = goldenDefaults;
  if(fs.existsSync(goldenPath)){
    golden = readLines(goldenPath).map((line, i) => { try { return JSON.parse(line); } catch(e){ failures.push(`golden JSONL invalid line ${i+1}`); return null; }}).filter(Boolean);
  }
  const testLines = [];
  const degorgonifiedFeminismResults = search(DEGORGONIFIED_FEMINISM_LABEL, 8);
  const degorgonifiedFeminismTriggered = (
    isDegorgonifiedFeminismQuery(DEGORGONIFIED_FEMINISM_LABEL)
    && isFeminismAcademicResearchQuery(DEGORGONIFIED_FEMINISM_LABEL)
  );
  if(!degorgonifiedFeminismTriggered){
    failures.push('exact degorgonified feminism query does not trigger its specialized ML* retrieval route');
  }
  verifyFeminismAcademicResearchOwners(
    degorgonifiedFeminismResults.map(result => result.doc),
    'degorgonified feminism exact-label retrieval top eight',
    failures,
  );
  const degorgonifiedFeminismTop = degorgonifiedFeminismResults[0];
  const degorgonifiedFeminismOwnerFirst = Boolean(
    degorgonifiedFeminismTop
    && degorgonifiedFeminismTop.doc.id === DEGORGONIFIED_FEMINISM_OWNER.id
    && degorgonifiedFeminismTop.doc.title === DEGORGONIFIED_FEMINISM_OWNER.title
  );
  if(!degorgonifiedFeminismOwnerFirst){
    failures.push(`exact degorgonified feminism query does not rank ${DEGORGONIFIED_FEMINISM_OWNER.id} | ${DEGORGONIFIED_FEMINISM_OWNER.title} first`);
  }
  testLines.push(
    `- ${degorgonifiedFeminismTriggered && degorgonifiedFeminismOwnerFirst && FEMINISM_ACADEMIC_RESEARCH_OWNERS.every(owner => (
      degorgonifiedFeminismResults.some(result => (
        result.doc.id === owner.id && result.doc.title === owner.title
      ))
    )) ? 'PASS' : 'FAIL'}: degorgonified feminism exact-label six-owner recall -> ${degorgonifiedFeminismResults.map(result => `[${result.doc.star_file}] ${result.doc.title}`).join(' | ')}`,
  );
  const feminismAcademicResearchQuery = (
    'feminism academic research academic category Gorgonwars no-default-feminist-frame '
    + 'citation-substrate scanner hivemindidiom'
  );
  const feminismAcademicResearchResults = search(feminismAcademicResearchQuery, 8);
  verifyFeminismAcademicResearchOwners(
    feminismAcademicResearchResults.map(result => result.doc),
    'feminism/academic-category retrieval regression top eight',
    failures,
  );
  testLines.push(
    `- ${FEMINISM_ACADEMIC_RESEARCH_OWNERS.every(owner => (
      feminismAcademicResearchResults.some(result => (
        result.doc.id === owner.id && result.doc.title === owner.title
      ))
    )) ? 'PASS' : 'FAIL'}: feminism/academic-category exact owners -> ${feminismAcademicResearchResults.map(result => `[${result.doc.star_file}] ${result.doc.title}`).join(' | ')}`,
  );
  const writingOwnerResults = search('current writing composition lexical repetition topic continuity protected spans original preservation punctuation invented conceptual bridge', 8);
  const writingOwnerRetrieved = writingOwnerResults.some(r => r.doc.id === currentWritingOwner);
  if(!writingOwnerRetrieved) failures.push(`search cannot retrieve current writing owner ${currentWritingOwner}`);
  testLines.push(`- ${writingOwnerRetrieved ? 'PASS' : 'FAIL'}: current writing composition owner -> ${writingOwnerResults.slice(0,5).map(r => '[' + r.doc.star_file + '] ' + r.doc.title).join(' | ')}`);
  for(const test of golden){
    const results = search(test.query, 8);
    if(results.length < 3){ failures.push(`too few results for ${test.query}`); continue; }
    const top = results.slice(0,5);
    let ok = true;
    if(test.anyStar){ ok = top.some(r => test.anyStar.includes(r.doc.star_file)); }
    if(test.anyTitle){ ok = top.some(r => test.anyTitle.some(t => normalize(r.doc.title).includes(normalize(t)))); }
    if(test.anyContent){
      ok = top.some(r => {
        const content = normalize([r.doc.id, r.doc.title, r.doc.preview, r.doc.section, r.doc.tags].join(' '));
        return test.anyContent.some(token => content.includes(normalize(token)));
      });
    }
    if(test.topContent){
      const first = top[0];
      const content = normalize(first && [first.doc.id, first.doc.title, first.doc.preview, first.doc.section, first.doc.tags].join(' '));
      ok = Boolean(first) && test.topContent.every(token => content.includes(normalize(token)));
      if(ok && test.topSection) ok = normalize(first.doc.section) === normalize(test.topSection);
    }
    if(!ok) failures.push(`golden failed: ${test.query}`);
    testLines.push(`- ${ok ? 'PASS' : 'FAIL'}: ${test.query} -> ${top.map(r => '[' + r.doc.star_file + '] ' + r.doc.title).join(' | ')}`);
  }
  const report = [
    '# Meaninglib AI Access Pack verification report','',
    `Generated: ${reportTimestamp}`,'',
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
