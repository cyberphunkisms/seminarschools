#!/usr/bin/env node
'use strict';
const fs=require('fs'); const path=require('path'); const ROOT=path.resolve(__dirname,'..');
const outDir=path.join(ROOT,'scripts','reports'); fs.mkdirSync(outDir,{recursive:true});
const release=JSON.parse(fs.readFileSync(path.join(ROOT,'RELEASE_MANIFEST.json'),'utf8')); const releaseTimestamp=release.generated_at||'1970-01-01T00:00:00Z';
const domainCounts=new Map(); let total=0; const important=[];
function walk(d,acc=[]){ for(const e of fs.readdirSync(d,{withFileTypes:true})){ if(['.git','node_modules','.netlify','public'].includes(e.name)) continue; const f=path.join(d,e.name); if(e.isDirectory()) walk(f,acc); else if(e.name.endsWith('.html')) acc.push(f); } return acc; }
for(const f of walk(ROOT)){
  const rel=path.relative(ROOT,f).replace(/\\/g,'/'); const html=fs.readFileSync(f,'utf8');
  for(const m of html.matchAll(/<a\b[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*>/gi)){
    total++; let u; try{ u=new URL(m[1]); } catch(e){ continue; }
    domainCounts.set(u.hostname,(domainCounts.get(u.hostname)||0)+1);
    if(/teacherresources|polymythseminars|leizu|saul|bb\//.test(rel)) important.push({source:rel, href:m[1], host:u.hostname});
  }
}
const top=[...domainCounts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,60).map(([host,count])=>({host,count}));
fs.writeFileSync(path.join(outDir,'external-link-inventory.json'), JSON.stringify({schema:'external-link-inventory-v1',generatedAt:releaseTimestamp,totalExternalLinks:total,topHosts:top,importantSample:important.slice(0,500)},null,2));
console.log(`EXTERNAL LINK INVENTORY WRITTEN — ${total} external links across ${domainCounts.size} hosts. No network calls made.`);
