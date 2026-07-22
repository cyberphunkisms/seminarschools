#!/usr/bin/env node
'use strict';
const fs=require('fs');const path=require('path');const ROOT=path.resolve(__dirname,'..');const SITE='https://seminarschools.com';
const ROUTES={university:'both',philosophy:'both',humanities:'both',cfps:'apply',lectures:'attend',fellowships:'apply'};const failures=[];
const read=rel=>fs.readFileSync(path.join(ROOT,rel),'utf8');const fail=msg=>failures.push(msg);
function torontoDate(){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
function current(e){const value=String(e.end_date||e.date||'').slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(value)&&value>=torontoDate();}
function matches(e,slug){return Array.isArray(e.academic_bands)&&e.academic_bands.map(String).includes(slug);}
function noscriptCount(html){const match=html.match(/<noscript>([\s\S]*?)<\/noscript>/i);return match?(match[1].match(/href="\/polymythseminars\/events\//g)||[]).length:0;}
function main(){
 const root=read('polymythseminars/index.html');const sitemap=read('sitemap.xml');const redirects=read('_redirects');const headers=read('_headers');const sources=JSON.parse(read('scripts/sources.json')).sources||[];const events=JSON.parse(read('polymythseminars/events.json')).events||[];const counts={};
 for(const slug of Object.keys(ROUTES)) if(!root.includes(`href="/${slug}/"`)) fail(`calendar root missing ${slug} entry point`);
 for(const [slug,defaultContent] of Object.entries(ROUTES)){
  const rel=`${slug}/index.html`;if(!fs.existsSync(path.join(ROOT,rel))){fail(`${slug}: missing route page`);continue;}
  const html=read(rel);const expected=events.filter(e=>matches(e,slug)&&current(e)).length;counts[slug]=expected;
  if(!html.includes(`data-pm-route="${slug}"`)) fail(`${slug}: missing unified route identity`);
  if(!html.includes(`data-pm-default-content="${defaultContent}"`)) fail(`${slug}: wrong default content mode`);
  if(!html.includes('id="pmEventList"')||!html.includes('/js/polymythcal-revamp.js')) fail(`${slug}: missing shared interactive Polymythcal shell`);
  if(/eventsContainer|quickFocusNav|watchlistPanel|calendarSearch|data-focus="deadlines"/.test(html)) fail(`${slug}: legacy calendar controls remain`);
  if(!html.includes(`https://seminarschools.com/${slug}/`)) fail(`${slug}: missing route-specific canonical/schema URL`);
  if(!html.includes(`href="/${slug}/" aria-current="page"`)) fail(`${slug}: dedicated navigation does not identify the current route`);
  if(noscriptCount(html)!==Math.min(expected,40)) fail(`${slug}: expected ${Math.min(expected,40)} no-script listings, found ${noscriptCount(html)}`);
  if(!html.includes('application/ld+json')) fail(`${slug}: missing structured data`);
  if(!sitemap.includes(`${SITE}/${slug}/`)) fail(`${slug}: missing from sitemap`);
  if(!redirects.includes(`/${slug}`)) fail(`${slug}: missing slashless redirect`);
  const globalNoCache=/\/\*\s*\n\s*Cache-Control:\s*no-cache, max-age=0, must-revalidate/i.test(headers);if(!globalNoCache&&!headers.includes(`/${slug}/`)) fail(`${slug}: missing no-cache header rule`);
  if(expected<=0) fail(`${slug}: canonical data has no current route records`);
 }
 if(!sources.some(s=>s.id==='princeton-uchv')) fail('source roster missing princeton-uchv');
 if(!sources.some(s=>s.scope==='global-academic')) fail('source roster missing global-academic scope sources');
 if(!events.some(e=>Array.isArray(e.academic_bands)&&e.academic_bands.includes('philosophy'))) fail('events missing philosophy academic-band records');
 if(failures.length){console.error('ACADEMIC SHORTCUT CHECK FAILED');failures.forEach(x=>console.error(' - '+x));process.exit(1);}
 console.log(`ACADEMIC SHORTCUT CHECK PASSED — unified multi-select shell on 6 routes; current counts ${JSON.stringify(counts)}.`);
}
main();
