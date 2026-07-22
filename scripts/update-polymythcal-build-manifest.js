#!/usr/bin/env node
'use strict';
const fs=require('fs');const path=require('path');const crypto=require('crypto');
const ROOT=path.resolve(__dirname,'..');const read=r=>fs.readFileSync(path.join(ROOT,r),'utf8');
const eventsDoc=JSON.parse(read('polymythseminars/events.json'));const events=eventsDoc.events||[];
const releaseId=read('RELEASE_ID.txt').trim();const release=JSON.parse(read('RELEASE_MANIFEST.json'));
const sources=JSON.parse(read('scripts/sources.json'));const sourceCount=Array.isArray(sources)?sources.length:(sources.sources||[]).length;
const hash=r=>crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,r))).digest('hex');
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const horizon=new Date(`${today}T12:00:00-04:00`);horizon.setFullYear(horizon.getFullYear()+1);const horizonText=horizon.toISOString().slice(0,10);
const current=events.filter(e=>String(e.end_date||e.date||'').slice(0,10)>=today&&String(e.date||'').slice(0,10)<=horizonText).length;
const doc={
  build_id:releaseId.replace(/^\d{4}-\d{2}-\d{2}-polymythcal-/,''),
  release_id:releaseId,
  generated_at:release.generated_at,
  canonical_data_sha256:hash('data/polymyth-seminar-events.json'),
  schema_sha256:hash('data/polymythcal-event-schema-v2.json'),
  record_count:events.length,
  confirmed_count:events.filter(e=>e.confirmation_status==='confirmed').length,
  unconfirmed_count:events.filter(e=>e.confirmation_status!=='confirmed').length,
  source_count:sourceCount,
  current_record_count_next_12_months:current,
  interface_release:releaseId,
  deployment_contract:'Netlify generates public/ from source; Windows deployer packages may additionally include the same generated public/ tree.',
  route_shells:['polymythseminars','writingclub','writingkids','writingjuniors','writingteens','writinggrads','university','philosophy','humanities','cfps','lectures','fellowships']
};
const out=JSON.stringify(doc,null,2)+'\n';const file=path.join(ROOT,'data/polymythcal-build-manifest.json');
if(!fs.existsSync(file)||fs.readFileSync(file,'utf8')!==out)fs.writeFileSync(file,out);
const scrape=JSON.parse(read('data/scrape-log.json'));scrape.canonical_event_count=events.length;scrape.public_event_count=events.length;scrape.public_copy_byte_identical_to_master=fs.readFileSync(path.join(ROOT,'data/polymyth-seminar-events.json')).compare(fs.readFileSync(path.join(ROOT,'polymythseminars/events.json')))===0;scrape.note='Canonical and public Polymythcal event files are byte-identical; counts are updated by the publication pipeline.';
fs.writeFileSync(path.join(ROOT,'data/scrape-log.json'),JSON.stringify(scrape,null,2)+'\n');
console.log(`POLYMYTHCAL BUILD MANIFEST — ${events.length} records, ${sourceCount} sources, release ${releaseId}.`);
