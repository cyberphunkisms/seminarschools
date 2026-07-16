#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');const root=path.resolve(__dirname,'..');const m=JSON.parse(fs.readFileSync(path.join(root,'data','saul-cv-pdf-manifest.json'),'utf8'));const css=fs.readFileSync(path.join(root,'saul','assets','saul-cv-spectrum-2026.css'),'utf8');const f=[];
if(!css.includes('grid-template-columns:minmax(0,1.52fr) minmax(225px,.68fr)'))f.push('visual web preview grid missing');if(!css.includes('cv-spectrum__rainbow'))f.push('web spectrum missing');if(m.design_system!=='professional-monochrome')f.push('PDF design separation missing');for(const o of m.outputs){if(o.pages!==1)f.push(o.path+' exceeds one page')}
if(f.length){console.error('SAUL CV LAYOUT CHECK FAILED');f.forEach(x=>console.error(' - '+x));process.exit(1)}console.log('SAUL CV LAYOUT CHECK PASSED - visual spectrum website and separate professional monochrome one-page PDFs verified.');
