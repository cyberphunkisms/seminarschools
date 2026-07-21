#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),fail=[];
const read=r=>fs.readFileSync(path.join(root,r),'utf8');
const exists=r=>fs.existsSync(path.join(root,r));
const has=(r,t)=>{if(!exists(r)||!read(r).includes(t))fail.push(`${r}: missing ${t}`)};
const lacks=(r,t)=>{if(exists(r)&&read(r).includes(t))fail.push(`${r}: contains ${t}`)};
if(!['2026-07-19-polymythcal-about-cl-audit11','2026-07-19-mobile-web-hybrid-audit12'].includes(read('RELEASE_ID.txt').trim()))fail.push('release id drift');
for(const t of ['Open Polymythcal','class="path-card featured"','priority:true','selectNode(NODES.find(n=>n.id===\'calendar\')','plain:\'Events and deadlines\''])has('index.html',t);
has('about/index.html','https://seminarschools.com/about/');
has('main/index.html',"location.replace('/about/'");
has('_redirects','/main/ /about/ 301');
lacks('sitemap.xml','https://seminarschools.com/main/');
has('sitemap.xml','https://seminarschools.com/about/');
for(const t of ['class="prototype-mark"','Prototype · in development'])has('about/index.html',t);
for(const t of ['data-archive-expand="all"','data-archive-expand="recent"','data-archive-expand="none"',"g.i >= 8"])has('saul/index.html',t);
const data=JSON.parse(read('data/saul-cv-canonical-2026.json'));
if(!data.modules.general.records.some(r=>r.organization==='BUMI Festival'))fail.push('BUMI missing from general CV');
if(!data.modules['volunteer-events'].records.some(r=>r.organization==='BUMI Festival'))fail.push('BUMI missing from volunteer CV');
for(const t of ['ss-col-title','<h2 class="ss-col-title">',"['About', '/about/']"])has('js/footer.js',t);
for(const r of ['WEBSITE_CL_2026-07-19.md','data/website-cl.jsonl','docs/WEBSITE_ACCEPTED_DECISIONS_AUDIT11_2026-07-19.md'])if(!exists(r))fail.push(`${r}: missing`);
for(const t of ['CL-WEB-201','CL-WEB-202','CL-WEB-203','CL-WEB-301'])has('WEBSITE_CL_2026-07-19.md',t);
has('saul/index.html','audit11-mobile-cv-return-link');
for(const t of ["'about'","'main'"])has('scripts/build-public-deploy.js',t);
for(const t of ['apply-final8-website-polish.py','apply-final9-mephistodata-website-hardening.py','apply-audit10-remaining-website-fixes.py','apply-audit11-website-decisions.py'])has('scripts/build-saul-cv-professional.py',t);
has('scripts/verify-audit10-remaining-website.js','/js/footer.js?v=20260719-audit11-decisions');
const active=[];
function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){if(['public','docs','.git','node_modules'].includes(e.name))continue;const p=path.join(d,e.name);if(e.isDirectory())walk(p);else if(/\.(html|xml|txt)$/.test(e.name))active.push(p)}}
walk(root);
for(const p of active){const rel=path.relative(root,p);if(rel==='main/index.html')continue;const x=fs.readFileSync(p,'utf8');if(x.includes('href="/main')||x.includes("href='/main")||x.includes('https://seminarschools.com/main/'))fail.push(`${rel}: live /main reference remains`)}
if(exists('public/about/index.html')){
  has('public/index.html','Open Polymythcal');
  has('public/about/index.html','https://seminarschools.com/about/');
  has('public/main/index.html',"location.replace('/about/'");
  has('public/js/footer.js','ss-col-title');
  has('public/saul/index.html','data-archive-expand="all"');
}
if(fail.length){console.error('AUDIT11 WEBSITE DECISIONS FAILED');fail.forEach(x=>console.error(' - '+x));process.exit(1)}
console.log('AUDIT11 WEBSITE DECISIONS PASSED — Polymythcal priority, /about route, prototype markers, expandable complete CV archive, BUMI placement, visible footer groups, and website CL verified.');
