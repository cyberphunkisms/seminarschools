#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
function update(root,check=false){
 const assets=['finder.css','finder.js','search-engine.js','return-to-search.js'];
 const versions=Object.fromEntries(assets.map(n=>[n,'sha256-'+crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'teacherresources',n))).digest('hex').slice(0,12)]));
 let changed=0;
 function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(e.name.endsWith('.html')){let before=fs.readFileSync(p,'utf8'),s=before;for(const [n,v] of Object.entries(versions))s=s.replace(new RegExp('(/teacherresources/'+n.replace('.','\\.')+'\\?v=)[^"\\s>]+','g'),'$1'+v);
 if(s!==before){if(check)throw Error('Stale teacher resource asset references: '+p);fs.writeFileSync(p,s);changed++;}}}}
 walk(path.join(root,'teacherresources'));return changed;
}
if(require.main===module)console.log('Teacher asset references:',update(path.resolve(__dirname,'..'),process.argv.includes('--check')),'files');
module.exports=update;
