#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');const root=path.resolve(__dirname,'..');const fail=[];
const h=fs.readFileSync(path.join(root,'saul','index.html'),'utf8');const css=fs.readFileSync(path.join(root,'saul','assets','saul-cv-spectrum-2026.css'),'utf8');const js=fs.readFileSync(path.join(root,'saul','assets','saul-cv-spectrum-2026.js'),'utf8');const data=JSON.parse(fs.readFileSync(path.join(root,'data','saul-cv-canonical-2026.json'),'utf8'));
const need=(hay,t,msg)=>{if(!hay.includes(t))fail.push(msg||`missing ${t}`)};
['data-cv-spectrum','cv-spectrum__rainbow','cv-spectrum__portrait','data-cv-designed','Other application formats','Combine focus areas','class="cv-map-section"','id="careerArchive"','data-geometry="indra-web"'].forEach(t=>need(h,t));
['--cv-gold','--cv-sky','--cv-green','--cv-teal','--cv-indigo','--cv-violet','--cv-rose','--cv-coral','@media print'].forEach(t=>need(css,t));
['routeFor','combineModules','data-cv-post','/saul/assets/saul-cv-canonical-2026.json'].forEach(t=>need(js,t));
if(h.includes('class="cv-v3"')||h.includes('saul-cv-v3.js'))fail.push('download-first v3 wrapper returned');
if((h.match(/<h1\b/g)||[]).length!==1)fail.push('main CV page must have exactly one H1');
if(!data.rules.website_mild_spectrum||!data.rules.pdf_professional_monochrome||data.rules.pdf_rainbow!==false)fail.push('visual/PDF separation rules missing');
for(const slug of Object.keys(data.modules)){const p=path.join(root,'saul','cv',slug,'index.html');if(!fs.existsSync(p)){fail.push(`missing route ${slug}`);continue}const x=fs.readFileSync(p,'utf8');['data-cv-spectrum','cv-spectrum__rainbow',`data-default-focus="${slug}"`,'data-geometry="indra-web"'].forEach(t=>{if(!x.includes(t))fail.push(`${slug} missing ${t}`)})}
if(fail.length){console.error('SAUL VISUAL GOVERNANCE FAILED');fail.forEach(x=>console.error(' - '+x));process.exit(1)}
console.log('SAUL VISUAL GOVERNANCE PASSED - mild spectrum remains web-only; all routes share one modular card; portrait, geometry, map and archive are preserved.');
