#!/usr/bin/env node
/**
 * Regression guard for searchable public surfaces.
 * Catalog and methodology indexes remain server-rendered. Polymythcal uses a
 * lightweight client shell backed by a public JSON index and stable event pages.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://seminarschools.com';
const {RESOURCE_LABEL_ALIASES,resourceTaxonomyLabel,resourceDescription,resourceReviewSection}=require('./build-search-pages');
let failures = [];
function read(rel){ return fs.readFileSync(path.join(ROOT, rel),'utf8'); }
function fail(s){ failures.push(s); }
function count(re, text){ return [...text.matchAll(re)].length; }
function extractJsonScript(html,id){ const m=html.match(new RegExp(`<script[^>]+id=["']${id}["'][^>]*>([\\s\\S]*?)<\\/script>`,'i')); if(!m) throw new Error(`missing #${id}`); return JSON.parse(m[1]); }
function sourcePath(url){ const u=new URL(url); const p=u.pathname; return p.endsWith('/') ? p.slice(1)+'index.html' : p.slice(1); }
function checkGeneratedPage(url, label){ const rel=sourcePath(url); if(!fs.existsSync(path.join(ROOT,rel))) { fail(`${label}: missing ${rel}`); return; } const h=read(rel); const roots=new Set([SITE+'/teacherresources/',SITE+'/polymythseminars/',SITE+'/polymyth/methodologylist/']); const stableEvent=url.startsWith(SITE+'/polymythseminars/events/') && h.includes('data-route-type="calendar-event"'); if(!roots.has(url) && !h.includes('Seminar Schools Static Search Surface') && !stableEvent) fail(`${label}: generated-page ownership marker missing in ${rel}`); const canonical=h.match(/<link rel="canonical" href="([^"]+)"/i)?.[1]; if(canonical!==url) fail(`${label}: canonical mismatch in ${rel}`); if(!/<h1\b/i.test(h)) fail(`${label}: no H1 in ${rel}`); }
function main(){
  const manifest=JSON.parse(read('scripts/search-surface-manifest.json'));
  const catalog=read('teacherresources/index.html');
  const data=JSON.parse(read('teacherresources/resources-data.json'));
  const finder=read('teacherresources/finder.js');
  const entries=(data.groups||[]).flatMap(group=>(group.categories||[]).flatMap(category=>category.entries||[]));
  const expectedResources=entries.length;
  const staticCatalog=(catalog.match(/<!-- SS_STATIC_CATALOG_START -->([\s\S]*?)<!-- SS_STATIC_CATALOG_END -->/)||[])[1]||'';
  const cardCount=count(/class="entry(?:\s|")/g,staticCatalog);
  if(!catalog.includes('data-ssr-catalog="true"')) fail('catalog: missing static catalog marker');
  if(cardCount!==expectedResources) fail(`catalog: expected ${expectedResources} server-delivered cards, found ${cardCount}`);
  if(manifest.resourceDetailPages!==expectedResources) fail(`catalog manifest: expected ${expectedResources} detail pages, found ${manifest.resourceDetailPages}`);

  const expectedAliases={
    subject:{sciences:'Sciences',cs:'Computer Science',french:'French/FSL'},
    format:{'french-lesson':'French Lesson','museum-lesson':'Museum Lesson','indigenous-pdf':'Indigenous Education PDF'},
    curriculum:{atlantic:'Atlantic Canada'}
  };
  for(const [kind,aliases] of Object.entries(expectedAliases)){
    for(const [code,label] of Object.entries(aliases)){
      if(RESOURCE_LABEL_ALIASES[kind]?.[code]!==label) fail(`catalog taxonomy: ${kind} alias ${code} is not declared as ${label}`);
      if(resourceTaxonomyLabel({},kind,code)!==label) fail(`catalog taxonomy: ${kind} alias ${code} does not resolve`);
      if(!finder.includes(`${code.includes('-')?`'${code}'`:code}: '${label}'`) && !finder.includes(`'${code}': '${label}'`)) {
        fail(`catalog browser taxonomy: ${kind} alias ${code} is not declared as ${label}`);
      }
    }
  }
  for(const [index,entry] of entries.entries()){
    for(const kind of ['subject','format','curriculum']){
      const code=entry[kind];
      if(code && !resourceTaxonomyLabel(data,kind,code)) fail(`catalog taxonomy: entry ${index+1} has unresolved ${kind} code ${code}`);
    }
  }
  if(!catalog.includes('/teacherresources/finder.js')) fail('catalog browser: route-scoped finder controller is missing');
  if(catalog.includes('id="resources-data"')) fail('catalog browser: duplicate inline resource dataset remains');
  if(resourceReviewSection({})!=='') fail('catalog detail: empty records still generate a Classroom fit section');
  const noteReview=resourceReviewSection({notes:'Specific classroom note.'});
  if(!noteReview.includes('<h2>Classroom fit</h2>') || !noteReview.includes('Specific classroom note.')) fail('catalog detail: genuine notes do not generate a Classroom fit section');
  const blurbReview=resourceReviewSection({notes:' ',blurb:'Specific classroom blurb.'});
  if(!blurbReview.includes('Specific classroom blurb.')) fail('catalog detail: a genuine blurb is not used when notes are blank');
  const aliasDescription=resourceDescription({title:'Museum source',format:'museum-lesson',grade:'all'},{},{},data);
  if(!aliasDescription.includes('Museum Lesson')) fail('catalog detail: fallback descriptions do not use resolved taxonomy labels');
  if(read('scripts/build-search-pages.js').includes('The record keeps subject, level, and source visible')) fail('catalog detail: generic Classroom fit filler remains in the generator');

  const calendar=read('polymythseminars/index.html');
  const browse=JSON.parse(read('polymythseminars/browse.json'));
  const watchlist=JSON.parse(read('polymythseminars/watchlist.json'));
  const events=browse.events||[];
  const monitored=watchlist.items||[];
  const surfaces=JSON.parse(read('data/polymythcal-publication-surfaces.json'));
  const staticEvents=(calendar.match(/<!-- SS_STATIC_EVENTS_START -->([\s\S]*?)<!-- SS_STATIC_EVENTS_END -->/)||[])[1]||'';
  const eventCards=count(/<article class="event"/g,staticEvents);
  const clientCalendar=/\/js\/polymythcal-discovery\.js/.test(calendar)&&/id="pmdList"/.test(calendar);
  if(calendar.includes('data-ssr-events="true"')) {
    if(eventCards!==manifest.upcomingEvents) fail(`calendar: expected ${manifest.upcomingEvents} server-delivered event cards, found ${eventCards}`);
  } else {
    if(!clientCalendar) fail('calendar: missing client calendar controller and result mount');
    if(!/<noscript>[\s\S]*calendar feeds[\s\S]*site map/i.test(calendar)) fail('calendar: client shell lacks a useful no-script route');
    if(!events.length) fail('calendar: chronology projection is empty');
    if(browse._schema!=='polymythcal-discovery-v2'||browse.count!==events.length) fail(`calendar: chronology projection totals do not match ${events.length} records`);
    if(!Array.isArray(surfaces.chronology_ids)||events.length!==surfaces.chronology_ids.length) fail('calendar: publication-surface chronology count is stale');
    const stableRecords=[...events,...monitored];
    const missingStable=stableRecords.filter(event=>[
      path.join(ROOT,'polymythseminars','events',event.id,'index.html'),
      path.join(ROOT,'polymythseminars','fr','events',event.id,'index.html'),
      path.join(ROOT,'public','polymythseminars','events',event.id,'index.html'),
      path.join(ROOT,'public','polymythseminars','fr','events',event.id,'index.html'),
    ].some(relative=>!fs.existsSync(relative)));
    if(missingStable.length) fail(`calendar: ${missingStable.length} records are missing a stable EN/FR source/public detail-route set`);
    const invalidMonitoring=monitored.filter(event=>{
      const detail=path.join(ROOT,'public','polymythseminars','events',event.id,'index.html');
      if(!fs.existsSync(detail)) return true;
      const html=fs.readFileSync(detail,'utf8');
      return !html.includes('data-publication-surface="watchlist"') || /<time\s+datetime=/i.test(html) || /"@type"\s*:\s*"Event"/.test(html);
    });
    if(invalidMonitoring.length) fail(`calendar: ${invalidMonitoring.length} monitoring detail pages violate the undated stable-route contract`);
    if(fs.existsSync(path.join(ROOT,'public','polymythseminars','events.json'))) fail('calendar: private canonical corpus leaked into the public deploy');
  }
  if(/<div class="count-line" id="countLine">Loading events/i.test(calendar)) fail('calendar: initial HTML still says Loading events');

  const method=read('polymyth/methodologylist/index.html');
  const sections=count(/href="\/polymyth\/methodologylist\/[^"/]+\//g,method);
  if(!method.includes('id="static-methodology-editions"')) fail('methodology list: missing static section index');
  if(sections<manifest.methodologySections) fail(`methodology list: expected at least ${manifest.methodologySections} static section links, found ${sections}`);
  if(!method.includes('<h3>Pending User Authorship</h3>')) fail('methodology list: pending-user-authorship section lacks a human-readable root label');
  if(method.includes("getElementById('search').addEventListener('input',render)")) fail('methodology list: search still renders synchronously on every input event');
  for(const token of [
    "getElementById('search').addEventListener('input',scheduleSearchRender)",
    'searchRenderTimer = setTimeout(()=>{',
    'if(!_entryTitleIndex) _entryTitleIndex = buildEntryTitleIndex();',
    'const sectionCounts = entrySectionCounts();',
    'entrySearchText(e).includes(q)',
    "const tagQuery=q.startsWith('tg:')?q.slice(3).trim():null;",
    'candidate.trim().toLowerCase() === needle',
    'entryHasExactTag(e,tagQuery)',
    "searchInput.value = 'tg:' + tag",
  ]) {
    if(!method.includes(token)) fail(`methodology list: missing bounded search/index runtime token ${token}`);
  }
  if(method!==read('public/polymyth/methodologylist/index.html')) fail('methodology list: source/public runtime mirrors diverge');
  if(count(/invalidateEntryIndexes\(\);/g,method)<5) fail('methodology list: entry indexes are not invalidated after load, edit, add, delete, and import mutations');
  for(const url of manifest.methodologyPrefixes||[]){
    const rel=sourcePath(url);
    if(!read(rel).includes('data-page-weight="heavy"')) fail(`methodology archive: heavy-page rendering contract missing in ${rel}`);
    if(!read(rel).includes('data-route-type="archive"')) fail(`methodology archive: route type missing in ${rel}`);
  }
  const pendingAuthorship=read('polymyth/methodologylist/pending-user-authorship/index.html');
  if(!pendingAuthorship.includes('<h1>Pending User Authorship</h1>')) fail('methodology list: pending-user-authorship generated page lacks a human-readable H1');
  if(!pendingAuthorship.includes('<title>Pending User Authorship | Polymyth Methodologylist | Seminar Schools</title>')) fail('methodology list: pending-user-authorship generated page lacks a human-readable title');

  const campaign=read('polymyth/campaigncodex/index.html');
  if(campaign.includes("getElementById('search').addEventListener('input', render)")) fail('campaign codex: search still renders synchronously on every input event');
  for(const token of [
    'const normalizedEntrySearchText = new WeakMap();',
    'normalizedEntrySearchText.get(entry)',
    'normalizedEntrySearchText.set(entry,text)',
    'searchRenderTimer = setTimeout(() => {',
    '},120);',
    'entrySearchText(e).includes(search)',
    "getElementById('search').addEventListener('input', scheduleSearchRender)",
  ]) {
    if(!campaign.includes(token)) fail(`campaign codex: missing bounded search runtime token ${token}`);
  }
  if(campaign!==read('public/polymyth/campaigncodex/index.html')) fail('campaign codex: source/public runtime mirrors diverge');

  const sitemap=read('sitemap.xml');
  const urls=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
  if(urls.length!==manifest.sitemapUrls) fail(`sitemap: expected ${manifest.sitemapUrls} URLs, found ${urls.length}`);
  const expectedGenerated = [
    ...urls.filter(u=>u.startsWith(SITE+'/teacherresources/')),
    ...urls.filter(u=>u.startsWith(SITE+'/polymythseminars/events/')),
    ...urls.filter(u=>u.startsWith(SITE+'/polymyth/methodologylist/'))
  ];
  for(const url of expectedGenerated) checkGeneratedPage(url,'sitemap');
  for(const url of urls){ const rel=sourcePath(url); if(!fs.existsSync(path.join(ROOT,rel))) fail(`sitemap: target file missing ${url}`); else if(/<meta name="robots" content="noindex/i.test(read(rel))) fail(`sitemap: noindex page leaked ${url}`); }

  const robots=read('robots.txt');
  if(!/Sitemap:\s*https:\/\/seminarschools\.com\/sitemap\.xml/i.test(robots)) fail('robots: missing absolute sitemap declaration');
  if(/Disallow:\s*\/polymythseminars\/events\.json/i.test(robots)) fail('robots: public events.json is blocked');
  if(/Disallow:\s*\/teacherresources\//i.test(robots)) fail('robots: teacher resource routes are blocked');

  if(failures.length){ console.error('SEARCH SURFACE CHECK FAILED'); failures.forEach(x=>console.error(' - '+x)); process.exit(1); }
  console.log(`SEARCH SURFACE CHECK PASSED — ${expectedResources} catalog resources, ${events.length} chronology records with stable pages, ${manifest.methodologySections} methodology sections, ${urls.length} sitemap URLs.`);
}
try{main()}catch(err){console.error('SEARCH SURFACE CHECK FAILED:',err.stack||err.message);process.exit(1)}
