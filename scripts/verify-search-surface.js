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
  const data=extractJsonScript(catalog,'resources-data');
  const expectedResources=(data.groups||[]).flatMap(g=>g.categories||[]).reduce((n,c)=>n+(c.entries||[]).length,0);
  const staticCatalog=(catalog.match(/<!-- SS_STATIC_CATALOG_START -->([\s\S]*?)<!-- SS_STATIC_CATALOG_END -->/)||[])[1]||'';
  const cardCount=count(/class="entry(?:\s|")/g,staticCatalog);
  if(!catalog.includes('data-ssr-catalog="true"')) fail('catalog: missing static catalog marker');
  if(cardCount!==expectedResources) fail(`catalog: expected ${expectedResources} server-delivered cards, found ${cardCount}`);
  if(manifest.resourceDetailPages!==expectedResources) fail(`catalog manifest: expected ${expectedResources} detail pages, found ${manifest.resourceDetailPages}`);

  const calendar=read('polymythseminars/index.html');
  const events=JSON.parse(read('polymythseminars/events.json')).events||[];
  const staticEvents=(calendar.match(/<!-- SS_STATIC_EVENTS_START -->([\s\S]*?)<!-- SS_STATIC_EVENTS_END -->/)||[])[1]||'';
  const eventCards=count(/<article class="event"/g,staticEvents);
  const clientCalendar=/\/js\/polymythcal-revamp\.js/.test(calendar)&&/id="pmEventList"/.test(calendar);
  if(calendar.includes('data-ssr-events="true"')) {
    if(eventCards!==manifest.upcomingEvents) fail(`calendar: expected ${manifest.upcomingEvents} server-delivered event cards, found ${eventCards}`);
  } else {
    if(!clientCalendar) fail('calendar: missing client calendar controller and result mount');
    if(!/<noscript>[\s\S]*RSS and calendar feeds[\s\S]*site map/i.test(calendar)) fail('calendar: client shell lacks a useful no-script route');
    if(events.length!==839) fail(`calendar: expected 839 public data records, found ${events.length}`);
    const missingStable=events.filter(event=>!fs.existsSync(path.join(ROOT,'polymythseminars','events',event.id,'index.html')));
    if(missingStable.length) fail(`calendar: ${missingStable.length} stable event pages are missing`);
  }
  if(/<div class="count-line" id="countLine">Loading events/i.test(calendar)) fail('calendar: initial HTML still says Loading events');

  const method=read('polymyth/methodologylist/index.html');
  const sections=count(/href="\/polymyth\/methodologylist\/[^"/]+\//g,method);
  if(!method.includes('id="static-methodology-editions"')) fail('methodology list: missing static section index');
  if(sections<manifest.methodologySections) fail(`methodology list: expected at least ${manifest.methodologySections} static section links, found ${sections}`);

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
  console.log(`SEARCH SURFACE CHECK PASSED — ${expectedResources} catalog resources, ${events.length} public calendar records with stable pages, ${manifest.methodologySections} methodology sections, ${urls.length} sitemap URLs.`);
}
try{main()}catch(err){console.error('SEARCH SURFACE CHECK FAILED:',err.stack||err.message);process.exit(1)}
