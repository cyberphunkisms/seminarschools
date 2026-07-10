#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://seminarschools.com';
const ROUTES = ['university','philosophy','humanities','cfps','lectures','fellowships'];
const failures=[];
function read(rel){ return fs.readFileSync(path.join(ROOT, rel),'utf8'); }
function fail(msg){ failures.push(msg); }
function staticCount(html){ return (html.match(/<article class="event"/g)||[]).length; }
function main(){
  const root=read('polymythseminars/index.html');
  const sitemap=read('sitemap.xml');
  const redirects=read('_redirects');
  const headers=read('_headers');
  const sources=JSON.parse(read('scripts/sources.json')).sources || [];
  const data=JSON.parse(read('polymythseminars/events.json'));
  if(!root.includes('id="academicNav"')) fail('calendar root missing University humanities shortcut nav');
  for(const r of ROUTES){
    const rel=`${r}/index.html`;
    if(!fs.existsSync(path.join(ROOT, rel))) { fail(`${r}: missing route page`); continue; }
    const html=read(rel);
    const inner=(html.match(/<!-- SS_STATIC_EVENTS_START -->([\s\S]*?)<!-- SS_STATIC_EVENTS_END -->/)||[,''])[1];
    const count=staticCount(inner);
    if(count<=0) fail(`${r}: static event list empty`);
    if(!html.includes(`https://seminarschools.com/${r}/`)) fail(`${r}: missing route-specific canonical/schema URL`);
    if(!html.includes('id="academicNav"')) fail(`${r}: missing academic nav`);
    if(!html.includes(`data-academic="${r}"`)) fail(`${r}: missing active data-academic link`);
    if(!html.includes('application/ld+json')) fail(`${r}: missing structured data`);
    if(!sitemap.includes(`${SITE}/${r}/`)) fail(`${r}: missing from sitemap`);
    if(!redirects.includes(`/${r}     /${r}/`) && !redirects.includes(`/${r}\t/${r}/`)) fail(`${r}: missing slashless redirect`);
    const globalNoCache = /\/\*\s*\n\s*Cache-Control:\s*no-cache, max-age=0, must-revalidate/i.test(headers);
    if(!globalNoCache && !headers.includes(`/${r}/`)) fail(`${r}: missing no-cache header rule`);
  }
  if(!sources.some(s=>s.id==='princeton-uchv')) fail('source roster missing princeton-uchv');
  if(!sources.some(s=>s.scope==='global-academic')) fail('source roster missing global-academic scope sources');
  if(!data.events.some(e=>Array.isArray(e.academic_bands) && e.academic_bands.includes('philosophy'))) fail('events missing academic_bands philosophy records');
  if(failures.length){
    console.error('ACADEMIC SHORTCUT CHECK FAILED');
    failures.forEach(f=>console.error(' - '+f));
    process.exit(1);
  }
  const counts=Object.fromEntries(ROUTES.map(r=>[r, staticCount((read(`${r}/index.html`).match(/<!-- SS_STATIC_EVENTS_START -->([\s\S]*?)<!-- SS_STATIC_EVENTS_END -->/)||[,''])[1])]));
  const globalSources=sources.filter(s=>s.scope==='global-academic').length;
  console.log(`ACADEMIC SHORTCUT CHECK PASSED — ${globalSources} global-academic sources; counts ${JSON.stringify(counts)}.`);
}
main();
