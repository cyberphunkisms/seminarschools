#!/usr/bin/env node
'use strict';
const fs=require('fs');const path=require('path');const {execFileSync}=require('child_process');
const ROOT=path.resolve(__dirname,'..');const script=fs.readFileSync(path.join(ROOT,'scripts/netlify-ignore-build.js'),'utf8');
const failures=[];const check=(ok,msg)=>{if(!ok)failures.push(msg);};
check(script.includes('CACHED_COMMIT_REF')&&script.includes('COMMIT_REF'),'ignore script does not use Netlify commit refs');
check(script.includes('/^public\\//'),'generated public changes are not recognized as non-deploying');
check(script.includes("process.exit(1)"),'ignore script lacks build-required outcome');
check(/ignore\s*=\s*"node \.\/scripts\/netlify-ignore-build\.js"/.test(fs.readFileSync(path.join(ROOT,'netlify.toml'),'utf8')),'netlify.toml does not call the tested ignore script');
if(failures.length){console.error('NETLIFY IGNORE CONTRACT FAILED');failures.forEach(x=>console.error(' - '+x));process.exit(1);}console.log('NETLIFY IGNORE CONTRACT PASSED — conservative build-on-error behavior and generated-only skip rules are present.');
