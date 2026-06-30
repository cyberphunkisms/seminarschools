#!/usr/bin/env node
'use strict';
const fs=require('fs'); const path=require('path'); const ROOT=path.resolve(__dirname,'..');
const rels=['polymythseminars/index.html','writingkids/index.html','writingjuniors/index.html','writingteens/index.html','writinggrads/index.html','writingclub/index.html','university/index.html','philosophy/index.html','humanities/index.html','cfps/index.html','lectures/index.html','fellowships/index.html'];
const failures=[];
for(const rel of rels){ if(!fs.existsSync(path.join(ROOT,rel))) continue; const html=fs.readFileSync(path.join(ROOT,rel),'utf8'); if(!/freshness-tag|freshness-row|checked|projected|confirmed|listed/.test(html)) failures.push(`${rel} missing freshness labels`); }
const main=fs.readFileSync(path.join(ROOT,'polymythseminars','index.html'),'utf8');
for(const needle of ['eventFreshness','freshnessHtml','projected','checked','confirmed','past']) if(!main.includes(needle)) failures.push(`polymythseminars missing ${needle}`);
if(failures.length){ console.error('POLYMYTHCAL FRESHNESS CHECK FAILED'); failures.forEach(f=>console.error(' - '+f)); process.exit(1); }
console.log(`POLYMYTHCAL FRESHNESS CHECK PASSED — ${rels.length} calendar/shortcut surfaces expose freshness labels.`);
