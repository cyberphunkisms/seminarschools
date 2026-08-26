#!/usr/bin/env node
'use strict';
const fs=require('fs');const path=require('path');const crypto=require('crypto');const zlib=require('zlib');
const {dateOneYearAfter,resolveSiteBuildDate}=require('./polymythcal-build-date');
const ROOT=path.resolve(__dirname,'..');const read=r=>fs.readFileSync(path.join(ROOT,r),'utf8');
const BUILD_MTIME=new Date(process.env.SS_BUILD_OUTPUT_MTIME||'2034-01-06T00:00:00Z');
if(Number.isNaN(BUILD_MTIME.getTime()))throw new Error('SS_BUILD_OUTPUT_MTIME must be a valid timestamp');
const eventsDoc=JSON.parse(read('polymythseminars/events.json'));const events=eventsDoc.events||[];
const releaseId=read('RELEASE_ID.txt').trim();const release=JSON.parse(read('RELEASE_MANIFEST.json'));
const sources=JSON.parse(read('scripts/sources.json'));const sourceCount=Array.isArray(sources)?sources.length:(sources.sources||[]).length;
const hash=r=>crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,r))).digest('hex');
const writeIfChanged=(file,out)=>{if(!fs.existsSync(file)||fs.readFileSync(file,'utf8')!==out)fs.writeFileSync(file,out);if(fs.statSync(file).mtime<BUILD_MTIME)fs.utimesSync(file,BUILD_MTIME,BUILD_MTIME);};
const browserPath='polymythseminars/browse.json';const browserBytes=fs.readFileSync(path.join(ROOT,browserPath));
const watchlistPath='polymythseminars/watchlist.json';const watchlistBytes=fs.readFileSync(path.join(ROOT,watchlistPath));
const researchPath='polymythseminars/research.json';const researchBytes=fs.readFileSync(path.join(ROOT,researchPath));
const browseDoc=JSON.parse(browserBytes);const watchlistDoc=JSON.parse(watchlistBytes);const researchDoc=JSON.parse(researchBytes);
const today=resolveSiteBuildDate({root:ROOT});const horizonText=dateOneYearAfter(today);
const current=events.filter(e=>String(e.end_date||e.date||'').slice(0,10)>=today&&String(e.date||'').slice(0,10)<=horizonText).length;
const doc={
  build_id:releaseId.replace(/^\d{4}-\d{2}-\d{2}-polymythcal-/,''),
  release_id:releaseId,
  generated_at:release.generated_at,
  polymythcal_discovery_release_id:release.polymythcal_discovery_release_id,
  polymythcal_discovery_built_at:release.polymythcal_discovery_built_at,
  polymythcal_discovery_asset_version:release.polymythcal_discovery_asset_version,
  canonical_data_sha256:hash('data/polymyth-seminar-events.json'),
  browser_payload_path:browserPath,
  browser_payload_sha256:hash(browserPath),
  browser_payload_raw_bytes:browserBytes.length,
  browser_payload_gzip_bytes:zlib.gzipSync(browserBytes,{level:9}).length,
  browser_payload_minimum_gzip_reduction_percent:25,
  watchlist_payload_path:watchlistPath,
  watchlist_payload_sha256:hash(watchlistPath),
  watchlist_payload_raw_bytes:watchlistBytes.length,
  watchlist_payload_gzip_bytes:zlib.gzipSync(watchlistBytes,{level:9}).length,
  research_payload_path:researchPath,
  research_payload_sha256:hash(researchPath),
  research_payload_raw_bytes:researchBytes.length,
  research_payload_gzip_bytes:zlib.gzipSync(researchBytes,{level:9}).length,
  schema_sha256:hash('data/polymythcal-event-schema-v2.json'),
  record_count:events.length,
  chronology_count:browseDoc.count,
  watchlist_count:watchlistDoc.count,
  research_count:researchDoc.count,
  confirmed_count:events.filter(e=>e.confirmation_status==='confirmed').length,
  unconfirmed_count:events.filter(e=>e.confirmation_status!=='confirmed').length,
  source_count:sourceCount,
  current_record_count_next_12_months:current,
  interface_release:releaseId,
  polymythcal_asset_version:release.polymythcal_asset_version,
  deployment_contract:'Netlify generates public/ from source; Windows deployer packages may additionally include the same generated public/ tree.',
  route_shells:['polymythseminars','polymythseminars/research','polymythseminars/monitoring','writingclub','writingkids','writingjuniors','writingteens','writinggrads','university','philosophy','humanities','cfps','lectures','fellowships']
};
const out=JSON.stringify(doc,null,2)+'\n';const file=path.join(ROOT,'data/polymythcal-build-manifest.json');
writeIfChanged(file,out);
const scrape=JSON.parse(read('data/scrape-log.json'));scrape.canonical_event_count=events.length;scrape.public_event_count=events.length;scrape.public_copy_byte_identical_to_master=fs.readFileSync(path.join(ROOT,'data/polymyth-seminar-events.json')).compare(fs.readFileSync(path.join(ROOT,'polymythseminars/events.json')))===0;scrape.note='Canonical and public Polymythcal event files are byte-identical; counts are updated by the publication pipeline.';
const scrapeFile=path.join(ROOT,'data/scrape-log.json');writeIfChanged(scrapeFile,JSON.stringify(scrape,null,2)+'\n');
console.log(`POLYMYTHCAL BUILD MANIFEST — ${events.length} records, ${sourceCount} sources, release ${releaseId}.`);
