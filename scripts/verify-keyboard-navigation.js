#!/usr/bin/env node
'use strict';
const fs=require('fs'); const path=require('path');
const {isGeneratedDependencyDirectory}=require('./repository-walk-policy');
const ROOT=path.resolve(__dirname,'..');
const failures=[];
const release=JSON.parse(fs.readFileSync(path.join(ROOT,'RELEASE_MANIFEST.json'),'utf8'));
const siteWideApplier=fs.readFileSync(path.join(ROOT,'scripts','apply-sitewide-type-zoom-link.js'),'utf8');
const globalAssetVersion=siteWideApplier.match(/const BUILD = ['"]([^'"]+)['"];/)?.[1]||'';
const allowedAssetVersions=new Set([String(release.polymythcal_asset_version||''),globalAssetVersion].filter(Boolean));
if(!allowedAssetVersions.size) failures.push('no owned keyboard-helper asset version is available');
const helper=path.join(ROOT,'js','site-keyboard-enhancements.js');
if(!fs.existsSync(helper)) failures.push('missing js/site-keyboard-enhancements.js');
else {
  const js=fs.readFileSync(helper,'utf8');
  for(const needle of ['CL_SELF_KEYBOARD_HELPERS','keydown','firstSearch','ArrowRight','ArrowLeft','?']) if(!js.includes(needle)) failures.push(`keyboard helper missing ${needle}`);
  if(!js.includes('if(ev.defaultPrevented) return;')) failures.push('keyboard helper must yield to route-specific handlers');
  if(!js.includes('!interactive(ev.target)')) failures.push('horizontal keyboard helper must preserve focused interactive controls');
  for(const modifier of ['!ev.altKey','!ev.ctrlKey','!ev.metaKey','!ev.shiftKey']){
    if(!js.includes(modifier)) failures.push(`horizontal keyboard helper must preserve ${modifier.slice(3)} modifier shortcuts`);
  }
}
const requiredRoutes=['polymythseminars/index.html','aa/cloud/index.html','aa/views/index.html','leizu/cloud/index.html','polymyth/concordance/index.html','polymyth/dmboard/index.html'];
for(const rel of requiredRoutes){
  const full=path.join(ROOT,rel); if(!fs.existsSync(full)) continue;
  const html=fs.readFileSync(full,'utf8');
  if(!/class=["'][^"']*keyboard-hint/i.test(html)) failures.push(`${rel} lacks visible keyboard hint`);
  if(!/site-keyboard-enhancements\.js/.test(html)) failures.push(`${rel} does not load keyboard helper`);
}
const allHtml=[]; function walk(d){ for(const e of fs.readdirSync(d,{withFileTypes:true})){ if(['.git','.netlify','public','fixtures'].includes(e.name)||isGeneratedDependencyDirectory(e.name)) continue; const f=path.join(d,e.name); if(e.isDirectory()) walk(f); else if(e.name.endsWith('.html')) allHtml.push(f); } } walk(ROOT);
const interactiveHtml=allHtml.filter(f=>{ const html=fs.readFileSync(f,'utf8'); if(/<meta[^>]+http-equiv=["']refresh["']/i.test(html)) return false; if(/google[0-9a-f]+\.html$/i.test(f)) return false; return true; });
let loaded=0; for(const f of interactiveHtml){ const html=fs.readFileSync(f,'utf8'); if(/site-keyboard-enhancements\.js/.test(html)){ loaded++; const references=[...html.matchAll(/site-keyboard-enhancements\.js\?v=([^"']+)/g)]; if(references.length!==1) failures.push(`${path.relative(ROOT,f)} must load exactly one cache-busted keyboard helper`); else if(!allowedAssetVersions.has(references[0][1])) failures.push(`${path.relative(ROOT,f)} uses an unowned keyboard-helper asset token`); } }
if(loaded < Math.max(25, interactiveHtml.length - 5)) failures.push(`keyboard helper loaded on only ${loaded}/${interactiveHtml.length} interactive HTML files`);
if(failures.length){ console.error('KEYBOARD NAVIGATION CHECK FAILED'); failures.forEach(f=>console.error(' - '+f)); process.exit(1); }
console.log(`KEYBOARD NAVIGATION CHECK PASSED — shared helper loaded on ${loaded} HTML files, dense routes carry keyboard hints.`);
