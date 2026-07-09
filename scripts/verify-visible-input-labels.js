#!/usr/bin/env node
'use strict';
const fs=require('fs'); const path=require('path'); const ROOT=path.resolve(__dirname,'..');
const failures=[]; let checked=0, ignored=0;
function walk(d,acc=[]){ for(const e of fs.readdirSync(d,{withFileTypes:true})){ if(['.git','node_modules','.netlify','public'].includes(e.name)) continue; const f=path.join(d,e.name); if(e.isDirectory()) walk(f,acc); else if(e.name.endsWith('.html')) acc.push(f); } return acc; }
function attrsObj(s){ const o={}; const rx=/([:\w-]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'>]+))?/g; let m; while((m=rx.exec(s))){ o[m[1].toLowerCase()] = m[2] ? m[2].replace(/^['"]|['"]$/g,'') : ''; } return o; }
for(const f of walk(ROOT)){
  const rel=path.relative(ROOT,f).replace(/\\/g,'/'); const html=fs.readFileSync(f,'utf8');
  const labelFors=new Set([...html.matchAll(/<label\b[^>]*for=["']([^"']+)["']/gi)].map(m=>m[1]));
  const wrapped=[]; for(const m of html.matchAll(/<label\b[\s\S]*?<\/(?:label)>/gi)) wrapped.push(m[0]);
  for(const m of html.matchAll(/<(input|select|textarea)\b([^>]*)>/gi)){
    const tag=m[1].toLowerCase(), raw=m[0], attrs=attrsObj(m[2]); const type=(attrs.type|| (tag==='input'?'text':'')).toLowerCase();
    if(['hidden','submit','button','reset','image'].includes(type) || attrs['aria-hidden']==='true' || 'hidden' in attrs || attrs.tabindex==='-1' || /display\s*:\s*none/i.test(attrs.style||'')){ ignored++; continue; }
    checked++;
    const id=attrs.id; const hasDirect=!!(attrs['aria-label'] || attrs['aria-labelledby'] || attrs.title);
    const hasFor=id && labelFors.has(id);
    const wrappedByLabel=wrapped.some(w=>w.includes(raw));
    if(!hasDirect && !hasFor && !wrappedByLabel) failures.push(`${rel}: visible ${tag}${type?`[${type}]`:''} lacks label: ${raw.slice(0,140)}`);
  }
}
if(failures.length){ console.error('VISIBLE INPUT LABEL CHECK FAILED'); failures.slice(0,120).forEach(f=>console.error(' - '+f)); if(failures.length>120) console.error(` ... ${failures.length-120} more`); process.exit(1); }
console.log(`VISIBLE INPUT LABEL CHECK PASSED — ${checked} visible fields checked, ${ignored} hidden/honeypot/machine fields ignored.`);
