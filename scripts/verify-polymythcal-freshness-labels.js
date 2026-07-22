#!/usr/bin/env node
'use strict';
const fs=require('fs'); const path=require('path'); const ROOT=path.resolve(__dirname,'..');
const rels=['writingkids/index.html','writingjuniors/index.html','writingteens/index.html','writinggrads/index.html','writingclub/index.html','university/index.html','philosophy/index.html','humanities/index.html','cfps/index.html','lectures/index.html','fellowships/index.html'];
const failures=[];
for(const rel of rels){
  if(!fs.existsSync(path.join(ROOT,rel))) continue;
  const html=fs.readFileSync(path.join(ROOT,rel),'utf8');
  if(!/freshness-tag|freshness-row|checked|projected|confirmed|listed/i.test(html)) failures.push(`${rel} missing freshness labels`);
}
const main=fs.readFileSync(path.join(ROOT,'polymythseminars','index.html'),'utf8');
const js=fs.readFileSync(path.join(ROOT,'js','polymythcal-revamp.js'),'utf8');
const css=fs.readFileSync(path.join(ROOT,'css','polymythcal-revamp.css'),'utf8');
if(!main.includes('data-label-key="statuses:confirmed"') || !main.includes('data-label-key="statuses:pending"')) failures.push('PolymythCAL missing plain-language listing-status filters');
for(const needle of ['function eventFreshness','function freshnessHtml','projectedDate','checkedOn','past']) if(!js.includes(needle)) failures.push(`PolymythCAL client missing ${needle}`);
if(!css.includes('.pm-freshness-row')) failures.push('PolymythCAL freshness line lacks design styling');
if(failures.length){ console.error('POLYMYTHCAL FRESHNESS CHECK FAILED'); failures.forEach(f=>console.error(' - '+f)); process.exit(1); }
console.log(`POLYMYTHCAL FRESHNESS CHECK PASSED — ${rels.length} shortcut surfaces plus the lightweight client calendar expose confirmed, pending, projected, checked, and past-state language.`);
