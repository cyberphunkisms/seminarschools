#!/usr/bin/env node
'use strict';
const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const SKIP=new Set(['.git','node_modules','.netlify','public']);
const rx=/font-size\s*:\s*(?:0?\.(?:5|50|55|56|58|6|60|62|63|64|65)rem|(?:8|9|10)px)\b/gi;
const breakAll=/word-break\s*:\s*break-all/gi;
let files=0,replacements=0,wrapFixes=0;
function walk(dir){
 for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
  if(SKIP.has(ent.name)) continue;
  const full=path.join(dir,ent.name);
  if(ent.isDirectory()) walk(full);
  else if(ent.isFile() && /\.(?:html|css)$/i.test(ent.name)){
   let s=fs.readFileSync(full,'utf8');
   let n=0;
   s=s.replace(rx,()=>{n++;return 'font-size:0.72rem';});
   let w=0; s=s.replace(breakAll,()=>{w++;return 'overflow-wrap:anywhere;word-break:normal';});
   if(n||w){fs.writeFileSync(full,s);files++;replacements+=n;wrapFixes+=w;}
  }
 }
}
walk(ROOT);
console.log(`TYPE + WORD-WRAP FLOOR APPLIED — ${replacements} tiny declarations raised and ${wrapFixes} break-all rules repaired across ${files} files.`);
