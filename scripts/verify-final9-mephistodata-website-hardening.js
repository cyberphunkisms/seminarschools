#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const fail = [];
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = rel => fs.existsSync(path.join(root, rel));
const has = (rel, token) => { if(!read(rel).includes(token)) fail.push(`${rel}: missing ${token}`); };
const lacks = (rel, token) => { if(read(rel).includes(token)) fail.push(`${rel}: reintroduced ${token}`); };
const release = read('RELEASE_ID.txt').trim();
if(!/^\d{4}-\d{2}-\d{2}-.+/.test(release)) fail.push(`release id malformed: ${release}`);
const ultimate = read('saul/index.html').includes('data-cv-ultimate="true"');

for(const rel of ['polymyth/methodologylist/index.html','polymyth/methodologylist-coreplus.txt','polymyth/methodologylist.txt']){
  for(const token of ['BOLTED-ON','GENERIC ETHICAL ANNOUNCEMENT / ABSTRACT SELFHOOD','OBVIOUS-COMPETENCE ANNOUNCEMENT','BALANCED CONSEQUENCE-SUMMARY / TWO-OUTCOME CLOSER','Competitive soccer and years of youth programming also make the pace of a SportStars field or facility familiar to me.','If a take needs repeating, I can do it.','This keeps X natural and gives Y Z.']) has(rel, token);
}
has('CHARTER.txt', 'Concise affirmative prose; every clause advances.');
has('polymyth/methodologylist-coreplus.txt', 'Add no unsolicited steps, audits, taxonomies, lists, summaries, artifacts, deliverables, next steps, or offers of more help.');
for(const token of ['## WRITING DISCIPLINE','bolted-on also/category appendages','balanced consequence-summary/two-outcome closers','Use the deletion test.']) has('hf_export/ai_access_pack/MEPHISTODATA_ACTIVATION.md', token);

const directCopyPairs = [
  ['index.html','Select a project to preview it. Open it from the description.'],
  ['index.html','Every project has the same weight.'],
  ['index.html','Its plain-language description will appear here before you leave this page.'],
  ['about/index.html','Explore Saul’s experience by field, share the selected view, or download a one-page CV.'],
  ['about/index.html','more than twelve years of teaching and program experience across six countries']
];
directCopyPairs.push(ultimate
  ? ['saul/index.html','CV downloads']
  : ['saul/index.html','Use the webpage for the visual record. Download a monochrome PDF for applications.']);
for(const pair of directCopyPairs) has(pair[0], pair[1]);
for(const pair of [
  ['index.html','The site opens through practical entrances'],
  ['index.html','Leizu gives the tutoring path'],
  ['about/index.html','The CV is not a Leizu-only funnel'],
  ['about/index.html','Each project offers a different entrance into the same room.'],
  ['about/index.html','PhD candidate in Education'],
  ['saul/index.html','The webpage is the visual record. Downloaded PDFs use a separate professional monochrome design.']
]) lacks(pair[0], pair[1]);

const canonical = JSON.parse(read('data/saul-cv-canonical-2026.json'));
if(!/^\d{4}-\d{2}-\d{2}-.+/.test(String(canonical.release||''))) fail.push('canonical CV release malformed');
const canonicalText = JSON.stringify(canonical);
if(ultimate){
  if(!read('saul/index.html').includes('Supported transport, information, security, and crowd flow during festival operations and participated in 2025 and 2026 planning.')) fail.push('BUMI operational archive detail missing');
  for(const token of ['"application_experience_rows":37','"application_phd_excluded":true','"application_downloads_have_email_only_variants":true']) if(!canonicalText.includes(token)) fail.push(`ultimate canonical missing ${token}`);
}else if(!canonicalText.includes('Supported transport, information, security, and crowd flow during festival operations and participated in 2025 and 2026 planning.')) fail.push('BUMI operational bullet missing');
if(canonicalText.includes('Helps with transport, information, security and crowd support;')) fail.push('old BUMI bullet returned');
if(/TELUS/i.test(canonicalText)) fail.push('TELUS returned to canonical CV');
if(!/GEICO/.test(canonicalText)) fail.push('GEICO missing from canonical CV');

const routePages = fs.readdirSync(path.join(root,'saul','cv'), {withFileTypes:true}).filter(d=>d.isDirectory()).map(d=>`saul/cv/${d.name}/index.html`).filter(exists);
routePages.push('saul/hospitality/index.html');
if(routePages.length < 13) fail.push(`focused CV route count ${routePages.length}`);
for(const rel of routePages){
  if(ultimate){
    has(rel, 'http-equiv="refresh"');
    has(rel, 'selected experience view');
    has(rel, 'data-cv-share-status=""');
  }else{
    has(rel, 'Use the webpage for the visual record. Download a monochrome PDF for applications.');
    has(rel, 'Open the full CV for the map, complete timeline, every focus area, and combined views.');
    has(rel, 'Use this link for the selected focus. Open the full CV when you need the complete record.');
  }
  lacks(rel, 'This focused route stays shareable while the main archive preserves the wider record.');
}

for(const token of ['cv-map-section--enhanced','class="cv-local-nav"','class="archive-shell"','archive-tools cv-module-tabs','const qArchive']) has('saul/index.html', token);
for(const token of ['Modular CV tabs are additive','active = next;']) has('saul/index.html', token);
for(const rel of ['docs/MEPHISTODATA_SENTENCE_DISCIPLINE_AND_WEBSITE_FINAL9_AUDIT_2026-07-18.md','data/audits/COREPLUS_BOLTED_ON_PROSE_AND_CONSEQUENCE_CLOSER_HARDENING_2026-07-18.md']) if(!exists(rel)) fail.push(`${rel}: missing audit`);
has('scripts/build-saul-cv-professional.py','apply-final9-mephistodata-website-hardening.py');
has('scripts/verify-all-runner.js','verify-final9-mephistodata-website-hardening.js');

if(exists('public/index.html')){
  has('public/index.html','Select a project to preview it. Open it from the description.');
  has('public/index.html','Every project has the same weight.');
  has('public/index.html','Its plain-language description will appear here before you leave this page.');
  has('public/about/index.html','more than twelve years of teaching and program experience across six countries');
  lacks('public/about/index.html','PhD candidate in Education');
  has('public/saul/index.html',ultimate ? 'CV downloads' : 'Use the webpage for the visual record. Download a monochrome PDF for applications.');
}
if(fail.length){ console.error('FINAL9 MEPHISTODATA WEBSITE HARDENING FAILED'); fail.forEach(x=>console.error(' - '+x)); process.exit(1); }
console.log(`FINAL9 MEPHISTODATA WEBSITE HARDENING PASSED - ${routePages.length} focused routes, canonical writing discipline, direct front-facing copy, and Final8 interaction invariants verified.`);
