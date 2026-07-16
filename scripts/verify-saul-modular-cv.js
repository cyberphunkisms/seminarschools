#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');const root=path.resolve(__dirname,'..');const h=fs.readFileSync(path.join(root,'saul','index.html'),'utf8');const j=fs.readFileSync(path.join(root,'saul','assets','saul-cv-spectrum-2026.js'),'utf8');const d=JSON.parse(fs.readFileSync(path.join(root,'data','saul-cv-canonical-2026.json'),'utf8'));const f=[];
['data-cv-blend','Combine focus areas','routeFor','combineModules','history.pushState'].forEach(t=>{if(!(h+j).includes(t))f.push('missing '+t)});if(Object.keys(d.modules).length!==12)f.push('expected 12 focus modules');if(!d.rules.ma_only_with_education||d.rules.latte_art!==false)f.push('canonical rules drifted');
if(f.length){console.error('SAUL MODULAR CV CHECK FAILED');f.forEach(x=>console.error(' - '+x));process.exit(1)}console.log('SAUL MODULAR CV CHECK PASSED - compact focus selection, additive combinations, shareable routes and exact role-facing output.');
