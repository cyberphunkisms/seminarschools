#!/usr/bin/env node
'use strict';
/* Netlify ignore command: exit 0 to skip, exit 1 to build. Uses Node 18-compatible syntax and no dependencies. */
const {execFileSync}=require('child_process');
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const from=process.env.CACHED_COMMIT_REF;
const to=process.env.COMMIT_REF;
if(!from || !to){console.log('NETLIFY IGNORE — commit refs unavailable; build required.');process.exit(1);}
let changed;
try{changed=execFileSync('git',['diff','--name-only',from,to],{cwd:ROOT,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim().split(/\r?\n/).filter(Boolean);}
catch(error){console.log('NETLIFY IGNORE — diff unavailable; build required.');process.exit(1);}
const nonDeploying=[
  /^\.github\//,
  /^data\/history\//,
  /^data\/scrape-log\.json$/,
  /^scripts\/reports\//,
  /^public\//
];
const deployAffecting=changed.filter(file=>!nonDeploying.some(re=>re.test(file)));
if(changed.length && deployAffecting.length===0){console.log(`NETLIFY IGNORE — skipping build; ${changed.length} changed path(s) are generated or operational only.`);process.exit(0);}
console.log(`NETLIFY IGNORE — build required; ${deployAffecting.length || changed.length} deploy-affecting path(s).`);
process.exit(1);
