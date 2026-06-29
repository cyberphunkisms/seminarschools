#!/usr/bin/env node
'use strict';
const fs=require('fs'), path=require('path');
const ROOT=path.resolve(__dirname,'..');
const SKIP=new Set(['.git','node_modules','.netlify']);
const skipRel=r=> r.startsWith('polymyth/') || r.startsWith('aa/') || /methodologylist|modulecanon|coreplus|ML\*/i.test(r);
function walk(dir,out=[]){for(const ent of fs.readdirSync(dir,{withFileTypes:true})){if(SKIP.has(ent.name))continue; const full=path.join(dir,ent.name); if(ent.isDirectory())walk(full,out); else if(ent.isFile()&&/\.(html|md|txt)$/.test(ent.name))out.push(full);} return out;}
function rel(f){return path.relative(ROOT,f).replace(/\\/g,'/');}
const errors=[];
const banned=['CV module tabs','PDF follows active tabs','All Writing = all writing contests.','This project is not merely','not only','what is happening on this page','Descriptions say what each item is'];
for(const file of walk(ROOT)){
  const r=rel(file); if(skipRel(r)) continue;
  const txt=fs.readFileSync(file,'utf8');
  for(const b of banned){ if(txt.includes(b)) errors.push(`${r}: banned/self-explaining phrase: ${b}`); }
}
const agora=fs.readFileSync(path.join(ROOT,'agora/index.html'),'utf8');
if(!agora.includes('Read the text. Show up. Talk clearly.')) errors.push('agora/index.html: concise top line missing');
const saul=fs.readFileSync(path.join(ROOT,'saul/index.html'),'utf8');
if(!saul.includes('Choose CV sections')) errors.push('saul/index.html: plain CV section wording missing');
if(errors.length){console.error('ANTI-YAP CHECK FAILED'); errors.slice(0,80).forEach(e=>console.error(' - '+e)); if(errors.length>80) console.error(` ... ${errors.length-80} more`); process.exit(1);} 
console.log('ANTI-YAP CHECK PASSED — public copy avoids self-explaining labels outside ML* archives.');
