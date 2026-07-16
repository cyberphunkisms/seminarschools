#!/usr/bin/env node
/*
  VERIFY VISIBLE GEOMETRY — hard guard for CL-63 / Indra geometry.
  Every actual source and deployable public webpage must be born connected to
  alive.css, mandala.js, indra.js, and the body-level geometry contract.
*/
'use strict';
const fs=require('fs');
const path=require('path');
const ROOT=process.cwd();
const PUBLIC=path.join(ROOT,'public');
const SOURCE_SKIP=new Set(['.git','node_modules','.netlify','public']);
const NESTED_SKIP=new Set(['.git','node_modules','.netlify']);
function walk(dir,skip,acc=[]){
  if(!fs.existsSync(dir)) return acc;
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    if(skip.has(entry.name)) continue;
    const full=path.join(dir,entry.name);
    if(entry.isDirectory()) walk(full,skip,acc);
    else if(entry.isFile()&&entry.name.endsWith('.html')&&!/^google.*\.html$/i.test(entry.name)) acc.push(full);
  }
  return acc;
}
function rel(base,file){return path.relative(base,file).replace(/\\/g,'/');}
function inspect(files,base,label,errors){
  for(const file of files){
    const r=rel(base,file); const html=fs.readFileSync(file,'utf8');
    if(!/<body\b/i.test(html)){errors.push(`${label}:${r}: missing body element`);continue;}
    if(!/alive\.css/.test(html))errors.push(`${label}:${r}: missing alive.css include`);
    if(!/\/js\/mandala\.js/.test(html))errors.push(`${label}:${r}: missing mandala.js include`);
    if(!/\/js\/indra\.js/.test(html))errors.push(`${label}:${r}: missing indra.js include`);
    if(!/<body\b[^>]*data-geometry=["']indra-web["']/i.test(html))errors.push(`${label}:${r}: body missing data-geometry="indra-web"`);
    const intensity=html.match(/<body\b[^>]*data-indra-intensity=["']([0-9.]+)["']/i);
    if(!intensity)errors.push(`${label}:${r}: body missing data-indra-intensity`);
    else {const n=Number(intensity[1]);if(!Number.isFinite(n)||n<0.025||n>0.18)errors.push(`${label}:${r}: geometry intensity ${intensity[1]} outside 0.025–0.18`);}
    const key=/^(polymythseminars|writingclub|writingkids|writingjuniors|writingteens|writinggrads|university|philosophy|humanities|cfps|lectures|fellowships|saul|main)\//.test(r)||r==='index.html';
    if(key&&!(/id=["']geo["']/.test(html)||/id=["']indraLayer["']/.test(html)||/\/js\/indra\.js/.test(html)))errors.push(`${label}:${r}: key page has no visible geometry mount path`);
  }
}
const source=walk(ROOT,SOURCE_SKIP);const deployed=walk(PUBLIC,NESTED_SKIP);const errors=[];const warnings=[];
inspect(source,ROOT,'source',errors);inspect(deployed,PUBLIC,'public',errors);
const sourceRoutes=new Set(source.map(f=>rel(ROOT,f)));const publicRoutes=new Set(deployed.map(f=>rel(PUBLIC,f)));
for(const r of sourceRoutes){if(!publicRoutes.has(r))errors.push(`public:${r}: source webpage missing from deploy tree`);}
for(const r of publicRoutes){if(!sourceRoutes.has(r))errors.push(`source:${r}: public webpage has no source twin`);}
const indraPath=path.join(ROOT,'js','indra.js');const alivePath=path.join(ROOT,'css','alive.css');
if(!fs.existsSync(indraPath))errors.push('js/indra.js missing');else{const x=fs.readFileSync(indraPath,'utf8');if(!/VISIBLE_GEOMETRY_GUARD/.test(x))warnings.push('js/indra.js lacks VISIBLE_GEOMETRY_GUARD marker');if(/document\.getElementById\(['"]printCv['"]\)/.test(x))errors.push('js/indra.js still disables geometry on CV pages via #printCv');if(!/layer\.id\s*=\s*['"]indraLayer['"]/.test(x))errors.push('js/indra.js does not create #indraLayer');if(!/pointerEvents\s*=\s*['"]none['"]|pointer-events\s*:\s*none/.test(x)&&!(/pointer-events\s*:\s*none/.test(fs.readFileSync(alivePath,'utf8'))))warnings.push('geometry pointer-event isolation not found');}
if(!fs.existsSync(alivePath))errors.push('css/alive.css missing');else{const x=fs.readFileSync(alivePath,'utf8');if(!/#indraLayer\s*\{/.test(x))errors.push('css/alive.css missing #indraLayer styling');if(!/VISIBLE_GEOMETRY_CONTRACT/.test(x))warnings.push('css/alive.css lacks VISIBLE_GEOMETRY_CONTRACT marker');if(!/@media\s+print[\s\S]*#indraLayer/.test(x))errors.push('css/alive.css must hide geometry in print');if(!/@media\s*\(prefers-reduced-motion:\s*reduce\)/.test(x))errors.push('css/alive.css missing reduced-motion handling');}
const cvCss=fs.readFileSync(path.join(ROOT,'saul','assets','saul-cv-spectrum-2026.css'),'utf8');
if(!/background:linear-gradient\([^\n]*rgba\([^)]*,\.(?:5|6|7|8)/.test(cvCss))warnings.push('CV surface translucency should be visually rechecked');
if(errors.length){console.error('VISIBLE GEOMETRY CHECK FAILED');errors.slice(0,160).forEach(e=>console.error(' - '+e));if(errors.length>160)console.error(` ... ${errors.length-160} more`);process.exit(1);}
if(warnings.length){console.warn('VISIBLE GEOMETRY WARNINGS');warnings.forEach(w=>console.warn(' - '+w));}
console.log(`VISIBLE GEOMETRY CHECK PASSED — ${source.length} source and ${deployed.length} public HTML webpages carry alive.css, mandala.js, indra.js, valid intensity markers and source/public route parity; CV pages remain included.`);
