#!/usr/bin/env node
'use strict';
const fs=require('fs'); const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const doctrine=JSON.parse(fs.readFileSync(path.join(ROOT,'scripts/route-doctrine.json'),'utf8'));
const failures=[];
function fail(x){failures.push(x)}
const contracts=doctrine.page_type_contracts || {};
for(const key of ['service','cv','calendar','game','archive','tool','resource-catalog','campaign']){
  if(!contracts[key] || contracts[key].length<80) fail(`page type contract missing or too thin: ${key}`);
}
if(!/must not rename, flatten, or reframe ML\*, AA\*, polymyth, BB, Leizu, or CL/i.test(doctrine.anti_twist_rule||'')) fail('anti-TWIST route rule missing');
const routes=doctrine.routes||[];
for(const r of routes.filter(r=>!r.private)){
  const rel=r.path==='/'?'index.html':r.path.replace(/^\//,'').replace(/\/$/,'')+'/index.html';
  const full=path.join(ROOT,rel);
  if(!fs.existsSync(full)) continue;
  const html=fs.readFileSync(full,'utf8');
  if(!/data-route-type=/.test(html)) fail(`${r.path} lacks body data-route-type`);
}
if(failures.length){ console.error('PAGE TYPE CONTRACT CHECK FAILED'); failures.forEach(f=>console.error(' - '+f)); process.exit(1); }
console.log(`PAGE TYPE CONTRACT CHECK PASSED — ${Object.keys(contracts).length} page-type contracts and anti-TWIST rule present.`);
