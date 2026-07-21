#!/usr/bin/env node
'use strict';
const fs=require('fs'); const path=require('path');
const ROOT=path.resolve(__dirname,'..'); const SITE='https://seminarschools.com';
const sitemap=fs.readFileSync(path.join(ROOT,'sitemap.xml'),'utf8');
const locs=[...sitemap.matchAll(/<loc>https:\/\/seminarschools\.com([^<]+)<\/loc>/g)].map(m=>m[1]);
const failures=[]; const counts={html:0,txt:0,md:0,xml:0,other:0,missing:0};
function existsFor(route){
  if(route.endsWith('/')) return fs.existsSync(path.join(ROOT, route.slice(1), 'index.html'));
  return fs.existsSync(path.join(ROOT, route.slice(1)));
}
for(const route of locs){
  const ext=path.extname(route).toLowerCase();
  if(route.endsWith('/')) counts.html++;
  else if(ext==='.txt') counts.txt++;
  else if(ext==='.md') counts.md++;
  else if(ext==='.xml') counts.xml++;
  else counts.other++;
  if(!existsFor(route)){ counts.missing++; failures.push(`${route} listed in sitemap but file is missing`); }
}
const htmls=[]; function walk(d){ for(const e of fs.readdirSync(d,{withFileTypes:true})){ if(['.git','node_modules','.netlify','public'].includes(e.name)) continue; const f=path.join(d,e.name); if(e.isDirectory()) walk(f); else if(e.name==='index.html') htmls.push(f); } } walk(ROOT);
let classifiedMissing=0;
for(const f of htmls){ const rel=path.relative(ROOT,f).replace(/\\/g,'/'); const route=rel==='index.html' ? '/' : '/' + rel.slice(0,-'index.html'.length); if(!sitemap.includes(`<loc>${SITE}${route}</loc>`)){ const html=fs.readFileSync(f,'utf8'); const noindex=/<meta\b(?=[^>]*name=["']robots["'])(?=[^>]*content=["'][^"']*noindex)[^>]*>/i.test(html); if(noindex || route.startsWith('/data/') || route.startsWith('/scripts/') || route.includes('/success/') || route.includes('/print/') || route.includes('/pdf/')) classifiedMissing++; else failures.push(`${route} is indexable-looking HTML missing from sitemap`); } }
if(failures.length){ console.error('SITEMAP CLASSIFICATION FAILED'); failures.slice(0,140).forEach(f=>console.error(' - '+f)); if(failures.length>140) console.error(` ... ${failures.length-140} more`); process.exit(1); }
console.log(`SITEMAP CLASSIFICATION PASSED — ${locs.length} sitemap URLs classified (${counts.html} HTML, ${counts.txt} txt, ${counts.md} md, ${counts.xml} xml, ${counts.other} other); ${classifiedMissing} non-sitemap HTML routes are intentionally classified.`);
