#!/usr/bin/env node
'use strict';
const fs=require('fs'); const path=require('path');
const ROOT=path.resolve(__dirname,'..'); const SITE='https://seminarschools.com';
const sitemap=fs.readFileSync(path.join(ROOT,'sitemap.xml'),'utf8');
const failures=[]; let checked=0, noindexed=0, indexed=0;
function hasNoindex(html){ return /<meta\b[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html); }
function routeFor(f){ const rel=path.relative(ROOT,f).replace(/\\/g,'/'); if(rel==='index.html') return '/'; return '/' + rel.slice(0,-'index.html'.length); }
function checkDir(dir){ if(!fs.existsSync(dir)) return; for(const f of fs.readdirSync(dir,{withFileTypes:true})){ const full=path.join(dir,f.name); if(f.isDirectory()) { const ix=path.join(full,'index.html'); if(fs.existsSync(ix)){ checked++; const route=routeFor(ix); const html=fs.readFileSync(ix,'utf8'); const inMap=sitemap.includes(`<loc>${SITE}${route}</loc>`); const no=hasNoindex(html); if(inMap) indexed++; else if(no) noindexed++; else failures.push(`${route} generated page is outside sitemap and lacks noindex`); } } } }
checkDir(path.join(ROOT,'polymythseminars','events'));
// Teacher-resource detail pages are public discovery pages. If generated and indexable, they must be in the sitemap.
for(const base of ['ela','fsl','hist','ib','ind','math','sci']){
  const dir=path.join(ROOT,'teacherresources',base); if(!fs.existsSync(dir)) continue;
  const stack=[dir];
  while(stack.length){ const d=stack.pop(); for(const ent of fs.readdirSync(d,{withFileTypes:true})){ const full=path.join(d,ent.name); if(ent.isDirectory()) stack.push(full); else if(ent.name==='index.html'){ checked++; const route=routeFor(full); const html=fs.readFileSync(full,'utf8'); const inMap=sitemap.includes(`<loc>${SITE}${route}</loc>`); if(inMap) indexed++; else if(hasNoindex(html)) noindexed++; else failures.push(`${route} resource page is outside sitemap and lacks noindex`); } } }
}
if(failures.length){ console.error('GENERATED ROUTE INDEXING FAILED'); failures.slice(0,120).forEach(f=>console.error(' - '+f)); if(failures.length>120) console.error(` ... ${failures.length-120} more`); process.exit(1); }
console.log(`GENERATED ROUTE INDEXING PASSED — ${checked} generated pages checked, ${indexed} sitemap-indexed, ${noindexed} intentionally noindexed.`);
