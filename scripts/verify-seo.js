#!/usr/bin/env node
/*
 * SEO deployment guard.
 * Keeps the public search surface internally consistent: sitemap URLs should
 * be canonical/indexable HTML pages, no dated metadata may be in the future,
 * AI crawler policy must preserve the private-route exclusions, and core
 * landing pages keep their metadata and structured data intact.
 */
'use strict';
const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const errors=[];
const fail=(m)=>errors.push(m);
const read=(rel)=>fs.readFileSync(path.join(ROOT,rel),'utf8');
const exists=(rel)=>fs.existsSync(path.join(ROOT,rel));
const SITE='https://seminarschools.com';

function htmlForUrl(url){
  if(!url.startsWith(SITE)) return null;
  const route=url.slice(SITE.length) || '/';
  if(route==='/') return 'index.html';
  if(route.endsWith('.html')) return route.slice(1);
  if(/\.(?:txt|md|xml|pdf)$/i.test(route)) return null; // public text editions are validated separately as files.
  return route.slice(1).replace(/\/$/,'')+'/index.html';
}
function attrValue(tag,name){
  const m=tag.match(new RegExp('\\b'+name+'\\s*=\\s*(["\'])(.*?)\\1','i'));
  return m?m[2]:'';
}
function pageMeta(file){
  const text=read(file);
  const head=(text.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)||[])[1]||'';
  const title=(head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||'';
  const description=(head.match(/<meta\b[^>]*name=["']description["'][^>]*>/i)||[])[0]||'';
  const canonical=(head.match(/<link\b[^>]*rel=["']canonical["'][^>]*>/i)||[])[0]||'';
  const h1=(text.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)||[])[1]||'';
  return {text,head,title,description,canonical,h1};
}

const sitemap=read('sitemap.xml');
let entries=[];
for(const block of sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)){
  const loc=(block[1].match(/<loc>([^<]+)<\/loc>/)||[])[1];
  const lastmod=(block[1].match(/<lastmod>([^<]+)<\/lastmod>/)||[])[1];
  if(loc) entries.push({loc,lastmod});
}
if(!entries.length) fail('sitemap has no URL entries');
const seen=new Set();
const today=new Date().toISOString().slice(0,10);
for(const {loc,lastmod} of entries){
  if(!loc.startsWith(SITE+'/')) fail(`sitemap has non-canonical host: ${loc}`);
  if(seen.has(loc)) fail(`sitemap repeats ${loc}`);
  seen.add(loc);
  if(lastmod && !/^\d{4}-\d{2}-\d{2}$/.test(lastmod)) fail(`sitemap has invalid lastmod ${lastmod} on ${loc}`);
  if(lastmod && lastmod>today) fail(`sitemap lastmod is in the future: ${loc} (${lastmod})`);
  const file=htmlForUrl(loc);
  if(file){
    if(!exists(file)) { fail(`sitemap route has no HTML file: ${loc} -> ${file}`); continue; }
    const page=pageMeta(file);
    if(/name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(page.head)) fail(`sitemap advertises noindex page: ${loc}`);
    if(!page.canonical) fail(`sitemap page lacks canonical: ${loc}`);
    else if(attrValue(page.canonical,'href')!==loc) fail(`canonical mismatch: ${loc} declares ${attrValue(page.canonical,'href')}`);
    if(!page.title.trim()) fail(`sitemap page lacks title: ${loc}`);
    if(!page.description) fail(`sitemap page lacks description: ${loc}`);
    if(!page.h1.trim()) fail(`sitemap page lacks H1: ${loc}`);
  }
}
for(const unwanted of [
  SITE+'/leizu/cloud/', SITE+'/polymyth/concordance/', SITE+'/teacherresources/feed.xml',
  SITE+'/aa/editorial.html', SITE+'/polymyth/notebook/the-burrow-notebook_v2-1.pdf',
  SITE+'/polymyth/notebook/the-burrow-notebook-supplement_v0-1.pdf',
  SITE+'/polymyth/notebook/your-teammate-page_v0-1.pdf'
]) if(seen.has(unwanted)) fail(`sitemap includes excluded/non-canonical route: ${unwanted}`);
for(const core of [
  SITE+'/', SITE+'/leizu/', SITE+'/leizu/toronto-tutoring/', SITE+'/teacherresources/',
  SITE+'/polymythseminars/', SITE+'/bb/why/', SITE+'/bb/why/zh/'
]) if(!seen.has(core)) fail(`sitemap is missing core searchable page: ${core}`);

// The private routes must remain private even when a named AI bot takes
// precedence over the generic crawler group.
const robots=read('robots.txt');
const privacy=[
  '/leizu/booking-success','/leizu/account','/leizu/admin','/apply/success','/bookwormcard/success',
  '/campaigns/thank-you-mam/unlocks','/polymyth/dmboard/','/polymyth/trace/','/polymyth/notebook/',
  '/data/','/aa/cloud/','/leizu/cloud/','/bookwormcard/print/','/bookwormcard/pdf/','/scripts/'
];
for(const bot of ['GPTBot','ChatGPT-User','OAI-SearchBot','ClaudeBot','Google-Extended','PerplexityBot']){
  const pos=robots.indexOf('User-agent: '+bot);
  if(pos<0) { fail(`robots lacks ${bot} policy`); continue; }
  const tail=robots.slice(pos);
  const next=tail.indexOf('\n#');
  const group=next>=0 ? tail.slice(0,next) : tail;
  for(const disallow of privacy) if(!group.includes('Disallow: '+disallow)) fail(`${bot} policy lacks ${disallow}`);
}
if(!robots.includes('Sitemap: '+SITE+'/sitemap.xml')) fail('robots lacks sitemap declaration');

// llms.txt is an optional compatibility layer for agents that recognise the
// emerging convention; it supplements, rather than replaces, crawlable HTML.
if(!exists('llms.txt')) fail('llms.txt compatibility guide is missing');
else {
  const llms=read('llms.txt');
  for(const url of [SITE+'/', SITE+'/leizu/', SITE+'/leizu/toronto-tutoring/', SITE+'/teacherresources/', SITE+'/polymythseminars/']){
    if(!llms.includes(url)) fail(`llms.txt lacks core URL ${url}`);
  }
}

// Structured data must parse, and price/availability facts should stay explicit on commercial pages.
const priority=[
  'index.html','leizu/index.html','leizu/toronto-tutoring/index.html','teacherresources/index.html',
  'polymythseminars/index.html','bb/why/index.html','bb/why/zh/index.html','teacherresources/pedagogical-case/index.html'
];
for(const file of priority){
  if(!exists(file)) { fail(`missing priority SEO file ${file}`); continue; }
  const page=pageMeta(file);
  if(!page.title.trim()) fail(`${file} lacks title`);
  if(!page.description) fail(`${file} lacks description`);
  if(!page.canonical) fail(`${file} lacks canonical`);
  const schemas=[...page.head.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  if(!schemas.length) fail(`${file} lacks JSON-LD`);
  for(const match of schemas){
    try { JSON.parse(match[1]); } catch(e) { fail(`${file} has invalid JSON-LD: ${e.message}`); }
  }
}
const leizu=read('leizu/index.html');
const local=read('leizu/toronto-tutoring/index.html');
for(const [file,text] of [['leizu/index.html',leizu],['leizu/toronto-tutoring/index.html',local]]){
  if(!text.includes('priceCurrency')) fail(`${file} lacks machine-readable price currency`);
  if(!text.includes('CAD')) fail(`${file} does not expose Canadian-dollar pricing`);
  if(!text.includes('availability')) fail(`${file} lacks machine-readable availability`);
}
const en=read('bb/why/index.html'), zh=read('bb/why/zh/index.html');
for(const [file,text,expected] of [
  ['bb/why/index.html',en,'hreflang="zh-Hans" href="https://seminarschools.com/bb/why/zh/"'],
  ['bb/why/zh/index.html',zh,'hreflang="en" href="https://seminarschools.com/bb/why/"']
]) if(!text.includes(expected)) fail(`${file} lacks reciprocal language alternate`);
if(!/name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(read('404.html'))) fail('404 page needs noindex');
if(!/name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(read('aa/editorial.html'))) fail('editorial log needs noindex');

console.log('=== SEO DEPLOYMENT GUARD ===');
if(errors.length){
  for(const error of errors) console.error('FAIL '+error);
  process.exit(1);
}
console.log(`PASS — ${entries.length} sitemap URLs, canonical/indexing controls, AI crawler privacy, structured data, local offer facts, and multilingual links are coherent.`);
