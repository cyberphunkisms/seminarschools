#!/usr/bin/env node
'use strict';
const fs=require('fs');const path=require('path');const ROOT=path.resolve(__dirname,'..');const SITE='https://seminarschools.com';
const ROUTES={writingclub:'club',writingkids:'kids',writingjuniors:'juniors',writingteens:'teens',writinggrads:'grads'};const failures=[];
const read=rel=>fs.readFileSync(path.join(ROOT,rel),'utf8');const fail=msg=>failures.push(msg);
function torontoDate(){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
function current(e){const value=String(e.end_date||e.date||'').slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(value)&&value>=torontoDate();}
function matches(e,band){const bands=Array.isArray(e.writing_bands)?e.writing_bands.map(String):[];return e.type==='contest'&&(band==='club'?bands.length>0:bands.includes(band));}
function noscriptCount(html){const match=html.match(/<noscript>([\s\S]*?)<\/noscript>/i);return match?(match[1].match(/href="\/polymythseminars\/events\//g)||[]).length:0;}
function main(){
 const events=JSON.parse(read('polymythseminars/events.json')).events||[];const sitemap=read('sitemap.xml');const redirects=read('_redirects');const root=read('polymythseminars/index.html');
 for(const slug of Object.keys(ROUTES)) if(!root.includes(`href="/${slug}/"`)) fail(`calendar root missing ${slug} entry point`);
 const counts={};
 for(const [slug,band] of Object.entries(ROUTES)){
  const rel=`${slug}/index.html`;if(!fs.existsSync(path.join(ROOT,rel))){fail(`${slug}: missing route page`);continue;}
  const html=read(rel);const expected=events.filter(e=>matches(e,band)&&current(e)).length;counts[slug]=expected;
  if(!html.includes(`data-pm-route="${slug}"`)) fail(`${slug}: missing unified route identity`);
  if(!html.includes('data-pm-default-content="apply"')) fail(`${slug}: writing route must default to opportunities`);
  if(!html.includes('id="pmEventList"')||!html.includes('/js/polymythcal-revamp.js')) fail(`${slug}: missing shared interactive Polymythcal shell`);
  if(/eventsContainer|quickFocusNav|watchlistPanel|calendarSearch|data-focus="deadlines"/.test(html)) fail(`${slug}: legacy calendar controls remain`);
  if(!html.includes(`https://seminarschools.com/${slug}/`)) fail(`${slug}: missing route-specific canonical/schema URL`);
  if(!html.includes(`aria-current="page">${html.match(/<h1>([^<]+)/)?.[1]||''}`) && !html.includes(`href="/${slug}/" aria-current="page"`)) fail(`${slug}: dedicated navigation does not identify the current route`);
  if(noscriptCount(html)!==Math.min(expected,40)) fail(`${slug}: expected ${Math.min(expected,40)} no-script listings, found ${noscriptCount(html)}`);
  if(!sitemap.includes(`${SITE}/${slug}/`)) fail(`${slug}: missing from sitemap`);
  if(!redirects.includes(`/${slug}`)) fail(`${slug}: missing slashless redirect`);
  if(expected<=0) fail(`${slug}: canonical data has no current route records`);
 }
 const writingEvents=events.filter(e=>e.type==='contest'&&Array.isArray(e.writing_bands)&&e.writing_bands.length);
 if(writingEvents.some(e=>(e.secondary_types||[]).some(t=>String(t).toLowerCase().trim()==='grades 1-12 pathway'))) fail('generic grade-band phrase remains in writing records');
 if(failures.length){console.error('WRITING SHORTCUT CHECK FAILED');failures.forEach(x=>console.error(' - '+x));process.exit(1);}
 console.log(`WRITING SHORTCUT CHECK PASSED — unified multi-select shell on 5 routes; current counts ${JSON.stringify(counts)}.`);
}
main();
