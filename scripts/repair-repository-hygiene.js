#!/usr/bin/env node
'use strict';
const fs=require('fs');const path=require('path');const {execFileSync}=require('child_process');const ROOT=path.resolve(__dirname,'..');const ignorePath=path.join(ROOT,'.gitignore');
let ignore=fs.existsSync(ignorePath)?fs.readFileSync(ignorePath,'utf8'):'';const required=['public/','__pycache__/','*.pyc'];
for(const rule of required){const escaped=rule.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');if(!new RegExp(`^/?${escaped}$`,'m').test(ignore)){if(ignore&&!ignore.endsWith('\n'))ignore+='\n';ignore+=rule+'\n';console.log(`Added ${rule} to .gitignore.`);}}
fs.writeFileSync(ignorePath,ignore,'utf8');
try{
 const tracked=execFileSync('git',['ls-files'],{cwd:ROOT,encoding:'utf8'}).split(/\r?\n/).filter(Boolean);
 const generated=tracked.filter(rel=>rel==='public'||rel.startsWith('public/')||/(^|\/)__pycache__\//.test(rel)||/\.pyc$/i.test(rel));
 if(generated.length){
  const chunkSize=300;
  for(let i=0;i<generated.length;i+=chunkSize)execFileSync('git',['rm','--cached','--ignore-unmatch','--',...generated.slice(i,i+chunkSize)],{cwd:ROOT,stdio:'inherit'});
  console.log(`Removed ${generated.length} generated paths from the Git index while keeping public output on disk.`);
 }else console.log('Generated public and Python cache paths are already untracked.');
 for(const dir of findCacheDirs(ROOT))fs.rmSync(dir,{recursive:true,force:true});
}catch(error){console.error('Git cleanup could not run. Open a terminal in the repository and run: git rm -r --cached public');process.exit(1);}
console.log('One-time repair complete. Commit the .gitignore and generated-file removals, then push.');
function findCacheDirs(dir,out=[]){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){if(['.git','node_modules','.netlify','public'].includes(entry.name))continue;const full=path.join(dir,entry.name);if(entry.isDirectory()){if(entry.name==='__pycache__')out.push(full);else findCacheDirs(full,out);}}return out;}
