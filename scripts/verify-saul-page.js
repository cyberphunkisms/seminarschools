#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');const root=path.resolve(__dirname,'..');const h=fs.readFileSync(path.join(root,'saul','index.html'),'utf8');const errors=[];
['data-cv-purpose="general-employment"','data-saul-modular-cv="true"','data-cv-spectrum','cv-spectrum__rainbow','src="/img/saul.jpg"','class="cv-map-section"','id="careerArchive"','data-cv-designed','data-cv-ats','data-cv-text','data-cv-print','data-cv-copy','Combine focus areas','Other application formats','saul-cv-spectrum-2026.js'].forEach(t=>{if(!h.includes(t))errors.push('missing '+t)});
if(h.includes('class="cv-v3"')||h.includes('saul-cv-v3.js'))errors.push('download-first v3 wrapper returned');if((h.match(/<h1\b/g)||[]).length!==1)errors.push('expected one H1');if(!/data-cv-designed[\s\S]{0,180}>Download professional PDF</.test(h))errors.push('professional PDF is not the visible primary action');
if(errors.length){console.error('Saul page guard failed');errors.forEach(e=>console.error(' - '+e));process.exit(1)}console.log('Saul page guard passed - one visual modular card, compact focus rail, professional download hierarchy, portrait, map and complete archive.');
