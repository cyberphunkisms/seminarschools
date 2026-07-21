#!/usr/bin/env node
'use strict';
const fs=require('fs'); const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const failures=[];
const helper=path.join(ROOT,'js','site-keyboard-enhancements.js');
if(!fs.existsSync(helper)) failures.push('missing js/site-keyboard-enhancements.js');
else {
  const js=fs.readFileSync(helper,'utf8');
  for(const needle of ['CL_SELF_KEYBOARD_HELPERS','keydown','firstSearch','ArrowRight','ArrowLeft','?']) if(!js.includes(needle)) failures.push(`keyboard helper missing ${needle}`);
}
const requiredRoutes=['polymythseminars/index.html','aa/cloud/index.html','aa/views/index.html','leizu/cloud/index.html','polymyth/concordance/index.html','polymyth/dmboard/index.html'];
for(const rel of requiredRoutes){
  const full=path.join(ROOT,rel); if(!fs.existsSync(full)) continue;
  const html=fs.readFileSync(full,'utf8');
  if(!/class=["'][^"']*keyboard-hint/i.test(html)) failures.push(`${rel} lacks visible keyboard hint`);
  if(!/site-keyboard-enhancements\.js/.test(html)) failures.push(`${rel} does not load keyboard helper`);
}
const allHtml=[]; function walk(d){ for(const e of fs.readdirSync(d,{withFileTypes:true})){ if(['.git','node_modules','.netlify','public','fixtures'].includes(e.name)) continue; const f=path.join(d,e.name); if(e.isDirectory()) walk(f); else if(e.name.endsWith('.html')) allHtml.push(f); } } walk(ROOT);
const interactiveHtml=allHtml.filter(f=>{ const html=fs.readFileSync(f,'utf8'); if(/<meta[^>]+http-equiv=["']refresh["']/i.test(html)) return false; if(/google[0-9a-f]+\.html$/i.test(f)) return false; return true; });
let loaded=0; for(const f of interactiveHtml){ const html=fs.readFileSync(f,'utf8'); if(/site-keyboard-enhancements\.js/.test(html)) loaded++; }
if(loaded < Math.max(25, interactiveHtml.length - 5)) failures.push(`keyboard helper loaded on only ${loaded}/${interactiveHtml.length} interactive HTML files`);
if(failures.length){ console.error('KEYBOARD NAVIGATION CHECK FAILED'); failures.forEach(f=>console.error(' - '+f)); process.exit(1); }
console.log(`KEYBOARD NAVIGATION CHECK PASSED — shared helper loaded on ${loaded} HTML files, dense routes carry keyboard hints.`);
