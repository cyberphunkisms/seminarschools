#!/usr/bin/env node
'use strict';
const fs=require('fs'), path=require('path');
const ROOT=path.resolve(__dirname,'..');
const errors=[];
function read(rel){return fs.readFileSync(path.join(ROOT,rel),'utf8');}
for(const rel of ['css/alive.css','js/indra.js','scripts/apply-visible-geometry.js','scripts/verify-visible-geometry.js']) if(!fs.existsSync(path.join(ROOT,rel))) errors.push(`${rel}: missing`);
const alive=read('css/alive.css');
const indra=read('js/indra.js');
const apply=read('scripts/apply-visible-geometry.js');
if(!/MAIN-LIKE VISIBLE GEOMETRY/.test(alive)) errors.push('alive.css: missing main-like visible geometry marker');
if(!/Math\.min\(0\.38/.test(indra)) errors.push('indra.js: visible opacity cap not raised');
if(!/return '0\.245'/.test(apply)) errors.push('apply-visible-geometry.js: Polymythcal intensity not raised');
const verifyAll = read('scripts/verify-all.js') + read('package.json');
for(const guard of ['verify-visible-geometry.js','verify-responsive-layout.js','verify-anti-yap.js','verify-coreplus-release-filter.js']) if(!verifyAll.includes(guard)) errors.push(`verify:all missing ${guard}`);
if(errors.length){console.error('COREPLUS RELEASE FILTER CHECK FAILED'); errors.forEach(e=>console.error(' - '+e)); process.exit(1);} 
console.log('COREPLUS RELEASE FILTER CHECK PASSED — geometry, responsiveness, and anti-yap guards are in verify:all.');
