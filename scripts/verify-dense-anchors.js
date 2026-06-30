#!/usr/bin/env node
'use strict';
const fs=require('fs'); const path=require('path'); const ROOT=path.resolve(__dirname,'..');
const dense=['polymyth/methodologylist/index.html','polymyth/campaigncodex/index.html','polymyth/modulecanon/index.html','teacherresources/index.html','polymythseminars/index.html','aa/index.html'];
const failures=[];
function stripCommentsAndScriptsForAnchors(html){
  return html
    .replace(/<!--[\s\S]*?-->/g,'')
    .replace(/<script\b[\s\S]*?<\/script>/gi,'')
    .replace(/<style\b[\s\S]*?<\/style>/gi,'');
}
for(const rel of dense){
  const full=path.join(ROOT,rel); if(!fs.existsSync(full)) continue;
  const raw=fs.readFileSync(full,'utf8'); const html=stripCommentsAndScriptsForAnchors(raw);
  const ids=new Set([...html.matchAll(/\bid=["']([^"']+)["']/gi)].map(m=>m[1]));
  const anchors=[...html.matchAll(/href=["']#([^"']+)["']/gi)].map(m=>decodeURIComponent(m[1]));
  const broken=anchors.filter(a=>a && a !== 'top' && !ids.has(a));
  const hasSearchOrDynamic=/id=["']search["']|class=["'][^"']*search|id=["']entries["']|data-ssr-/i.test(raw);
  if(ids.size<10 && !hasSearchOrDynamic) failures.push(`${rel} has only ${ids.size} ids and no search/dynamic entry surface`);
  if(broken.length) failures.push(`${rel} has broken local anchors: ${broken.slice(0,10).join(', ')}`);
}
if(failures.length){ console.error('DENSE ANCHOR CHECK FAILED'); failures.forEach(f=>console.error(' - '+f)); process.exit(1); }
console.log(`DENSE ANCHOR CHECK PASSED — ${dense.length} dense pages have intact local anchors or explicit search/dynamic navigation.`);
