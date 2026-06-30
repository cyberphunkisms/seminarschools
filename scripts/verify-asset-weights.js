#!/usr/bin/env node
'use strict';
const fs=require('fs'); const path=require('path'); const ROOT=path.resolve(__dirname,'..');
const reportPath=path.join(ROOT,'scripts','reports','asset-weight-report.json'); const failures=[];
if(!fs.existsSync(reportPath)) failures.push('missing scripts/reports/asset-weight-report.json');
else { const r=JSON.parse(fs.readFileSync(reportPath,'utf8')); if(!Array.isArray(r.largestAssets) || r.largestAssets.length<10) failures.push('asset report lacks largestAssets list'); }
function walk(d,acc=[]){ for(const e of fs.readdirSync(d,{withFileTypes:true})){ if(['.git','node_modules','.netlify'].includes(e.name)) continue; const f=path.join(d,e.name); if(e.isDirectory()) walk(f,acc); else if(e.isFile()) acc.push(f); } return acc; }
let hugeImages=[]; for(const f of walk(ROOT)){ const ext=path.extname(f).toLowerCase(); if(['.png','.jpg','.jpeg','.webp','.gif'].includes(ext)){ const size=fs.statSync(f).size; if(size>2_500_000) hugeImages.push(`${path.relative(ROOT,f).replace(/\\/g,'/')} ${size}`); } }
if(hugeImages.length) failures.push('images over 2.5MB: '+hugeImages.slice(0,10).join('; '));
if(failures.length){ console.error('ASSET WEIGHT CHECK FAILED'); failures.forEach(f=>console.error(' - '+f)); process.exit(1); }
console.log('ASSET WEIGHT CHECK PASSED — asset report present and no image exceeds 2.5MB.');
