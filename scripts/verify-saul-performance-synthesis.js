#!/usr/bin/env node
'use strict';
const fs=require('fs'), path=require('path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const data=JSON.parse(read('data/saul-cv-canonical-2026.json'));
const html=read('saul/index.html');
const perf=read('saul/downloads/saul-karim-nassau-performance-cv.txt');
const arts=read('saul/downloads/saul-karim-nassau-arts-culture-cv.txt');
const general=read('saul/downloads/saul-karim-nassau-general-cv.txt');
const manifest=JSON.parse(read('data/saul-cv-pdf-manifest.json'));
const fail=[];
const required=[
  'GEICO’s 2012 “California” commercial',
  'on-camera interviewer',
  'Jesus Christ Superstar',
  'the 2008 production One Thousand and One Nights',
  'Sears Ontario Drama Festival productions in 2005, 2006 and 2007',
  'script writing and editing',
  'Spartacus Soccer Club',
  'five years of karate',
  'Bronze Cross and First Aid at age 16'
];
for(const t of required){if(!perf.includes(t))fail.push(`performance output missing ${t}`)}
const artsRequired=['GEICO, “California” commercial','On-Camera Interviewer - Street Kids International','Jesus Christ Superstar','the 2008 production One Thousand and One Nights','Sears Ontario Drama Festival - Claude Watson Arts Program','script writing and editing'];
for(const t of artsRequired){if(!arts.includes(t))fail.push(`arts output missing ${t}`)}
if(!html.includes('https://www.youtube.com/watch?v=bz-bDLya3gg'))fail.push('GEICO source link missing from web CV');
const scan=JSON.stringify(data)+'\n'+html+'\n'+perf+'\n'+arts+'\n'+general;
if(/telus.{0,120}commercial|commercial.{0,120}telus/i.test(scan))fail.push('TELUS commercial credit remained');
if(data.modules.general.records.some(r=>r.title==='Seminar Schools'))fail.push('project-only Seminar Schools record remained in General');
if(data.modules['arts-culture'].records.some(r=>r.title==='polymyth / AA*'))fail.push('project-only polymyth record remained in Arts and Culture');
if(!data.modules.portfolio.records.some(r=>r.title==='Seminar Schools'))fail.push('Project focus lost Seminar Schools record');
const projectTitles=new Set(['Seminar Schools','polymyth / AA*','Toronto Arts and Public Events Resource','Florilegium']);
for(const [slug,module] of Object.entries(data.modules)){
  if(slug==='portfolio')continue;
  for(const r of module.records||[]){if(projectTitles.has(r.title))fail.push(`project-only ${r.title} leaked into ${slug}`)}
}
for(const slug of ['performance','arts-culture']){
  for(const typ of ['designed','ats']){
    const row=manifest.outputs.find(x=>x.slug===slug&&x.type===typ);
    if(!row||row.pages!==1)fail.push(`${slug} ${typ} PDF is missing or not one page`);
  }
}
if(fail.length){console.error('SAUL PERFORMANCE SYNTHESIS FAILED');fail.forEach(x=>console.error(' - '+x));process.exit(1)}
console.log('SAUL PERFORMANCE SYNTHESIS PASSED - GEICO-only commercial correction, named stage/screen credits, teaching/presentation skills and athletic background are synchronized.');
