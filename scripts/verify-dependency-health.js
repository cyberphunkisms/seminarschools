#!/usr/bin/env node
'use strict';
const fs=require('fs');const path=require('path');const ROOT=path.resolve(__dirname,'..');
const pkg=JSON.parse(fs.readFileSync(path.join(ROOT,'package.json'),'utf8'));
const lock=JSON.parse(fs.readFileSync(path.join(ROOT,'package-lock.json'),'utf8'));
const failures=[];const fail=m=>failures.push(m);
const declared=pkg.dependencies?.['@netlify/blobs'];
const rootDeclared=lock.packages?.['']?.dependencies?.['@netlify/blobs'];
const entry=lock.packages?.['node_modules/@netlify/blobs'];
const exact=/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
if(!exact.test(declared||'')) fail(`package.json must pin @netlify/blobs to an exact semver; found ${declared||'missing'}`);
if(rootDeclared!==declared) fail(`package-lock root declaration ${rootDeclared||'missing'} does not match package.json ${declared||'missing'}`);
if(!entry) fail('package-lock entry for @netlify/blobs is missing');
else{
  if(entry.version!==declared) fail(`locked version ${entry.version} does not match declared version ${declared}`);
  if(!/^https:\/\/registry\.npmjs\.org\//.test(entry.resolved||'')) fail('locked package is not resolved from the public npm registry');
  if(!/^sha512-/.test(entry.integrity||'')) fail('locked package lacks SHA-512 integrity metadata');
}
const prod=Object.keys(pkg.dependencies||{});
if(prod.length!==1||prod[0]!=='@netlify/blobs') fail(`expected one production dependency (@netlify/blobs); found ${prod.join(', ')||'none'}`);
if(failures.length){console.error('DEPENDENCY HEALTH CONTRACT FAILED');failures.forEach(x=>console.error(' - '+x));process.exit(1);}
console.log(`DEPENDENCY HEALTH CONTRACT PASSED — @netlify/blobs ${declared} is exactly pinned, lock-aligned, public-registry resolved, integrity protected, and the sole production dependency.`);
