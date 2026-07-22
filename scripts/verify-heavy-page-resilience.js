#!/usr/bin/env node
'use strict';
const fs=require('fs'); const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const failures=[];
function read(rel){return fs.readFileSync(path.join(ROOT,rel),'utf8')}
function fail(x){failures.push(x)}
const css=read('css/alive.css');
if(!css.includes('CL_SUGGESTION_PASS_CONTRACT')) fail('missing CL suggestion pass CSS contract');
if(!css.includes('content-visibility: auto')) fail('missing heavy-page content-visibility containment');
const expected=['polymyth/methodologylist/index.html','teacherresources/index.html','aa/index.html','polymyth/campaigncodex/index.html'];
for(const rel of expected){ const html=read(rel); if(!/data-page-weight=["']heavy["']/.test(html)) fail(`${rel} missing heavy page marker`); }
const calendar=read('polymythseminars/index.html');
if(/data-page-weight=["']heavy["']/.test(calendar)) fail('lightweight PolymythCAL shell is incorrectly marked heavy');
if(Buffer.byteLength(calendar,'utf8')>=100000) fail('lightweight PolymythCAL shell exceeds 100 KB');
const shortcuts=['writingkids','writingjuniors','writingteens','writinggrads','writingclub','university','philosophy','humanities','cfps','lectures','fellowships'];
for(const route of shortcuts){
  const html=read(`${route}/index.html`);
  const m=html.match(/<script[^>]*id=["']events-fallback["'][^>]*>([\s\S]*?)<\/script>/);
  if(!m){ fail(`${route} missing events fallback`); continue; }
  let data; try{data=JSON.parse(m[1])}catch(e){ fail(`${route} fallback JSON malformed`); continue; }
  if(!Array.isArray(data.events)) fail(`${route} fallback lacks events array`);
  if((data.events||[]).length>60) fail(`${route} fallback is too large for a route-specific shortcut: ${(data.events||[]).length}`);
  if(!/data-source=["']\/polymythseminars\/events\.json["']/.test(m[0])) fail(`${route} fallback missing canonical data-source marker`);
}
if(failures.length){ console.error('HEAVY PAGE RESILIENCE FAILED'); failures.forEach(f=>console.error(' - '+f)); process.exit(1); }
console.log('HEAVY PAGE RESILIENCE PASSED — large pages are render-contained, PolymythCAL stays lightweight, and shortcut pages carry compact route-specific fallbacks.');
