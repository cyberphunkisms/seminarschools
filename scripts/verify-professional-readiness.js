#!/usr/bin/env node
/*
 * Professional predeployment guard.
 * Covers controls outside the page-by-page presentation checks: private build
 * artifacts, cache policy for sensitive flows, PWA icon validity, sitemap
 * hygiene, webhook entitlement rules, and basic API information exposure.
 */
'use strict';
const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const errors=[];
const fail=(msg)=>errors.push(msg);
const read=(rel)=>fs.readFileSync(path.join(ROOT,rel),'utf8');
const exists=(rel)=>fs.existsSync(path.join(ROOT,rel));

function pngDimensions(rel){
  const buf=fs.readFileSync(path.join(ROOT,rel));
  const signature='89504e470d0a1a0a';
  if(buf.subarray(0,8).toString('hex')!==signature) return null;
  return {width:buf.readUInt32BE(16),height:buf.readUInt32BE(20)};
}

// PWA installability needs square raster icons. Social images are not app icons.
let manifest;
try { manifest=JSON.parse(read('manifest.json')); } catch(error) { fail('manifest.json does not parse'); }
if(manifest){
  const wanted=[['/pwa-192.png',192],['/pwa-512.png',512]];
  for(const [src,size] of wanted){
    const icon=(manifest.icons||[]).find((item)=>item.src===src && item.sizes===`${size}x${size}`);
    if(!icon) { fail(`manifest missing ${size}×${size} PWA icon`); continue; }
    if(!exists(src.slice(1))) fail(`PWA icon missing ${src}`);
    else {
      const dim=pngDimensions(src.slice(1));
      if(!dim || dim.width!==size || dim.height!==size) fail(`PWA icon has wrong dimensions ${src}`);
    }
  }
  if((manifest.icons||[]).some((item)=>item.src==='/og-image.png')) fail('manifest still treats the rectangular social image as an app icon');
}

// Sitemap should contain each canonical URL once and should not advertise noindex interface pages.
const sitemap=read('sitemap.xml');
const urls=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m)=>m[1]);
const seen=new Set();
for(const url of urls){
  if(seen.has(url)) fail(`sitemap has duplicate URL ${url}`);
  seen.add(url);
}
for(const forbidden of [
  'https://seminarschools.com/bookwormcard/print/',
  'https://seminarschools.com/bookwormcard/pdf/',
  'https://seminarschools.com/aa/cloud/',
  'https://seminarschools.com/campaigns/studio-qibla/pregame/',
  'https://seminarschools.com/polymyth/notebook/',
  'https://seminarschools.com/polymyth/dmboard/',
  'https://seminarschools.com/polymyth/trace/',
  'https://seminarschools.com/aa/editorial'
]){
  if(seen.has(forbidden)) fail(`sitemap includes noindex or alias route ${forbidden}`);
}
for(const core of ['https://seminarschools.com/','https://seminarschools.com/main/','https://seminarschools.com/saul/','https://seminarschools.com/leizu/','https://seminarschools.com/bb/why/']){
  if(!seen.has(core)) fail(`sitemap missing core route ${core}`);
}

const netlify=read('netlify.toml');
for(const required of [
  'from = "/sitemap"',
  'from = "/sitemap/"',
  'to = "/polymyth/sitemap/"',
  'from = "/SETUP.md"',
  'from = "/netlify.toml"',
  'from = "/_headers"',
  'from = "/_redirects"',
  'from = "/_build_txt_from_html.py"',
  'from = "/CHARTER.txt"',
  'from = "/netlify.env.example"',
  'from = "/package.json"',
  'from = "/package-lock.json"',
  'from = "/leizu/*.md"',
  'from = "/teacherresources/audit-batch-01.json"',
  'for = "/leizu/intake/*"',
  'for = "/leizu/booking-success/*"',
  'Cache-Control = "no-store"',
  'for = "/.well-known/security.txt"'
]) if(!netlify.includes(required)) fail(`netlify.toml missing professional readiness rule ${required}`);

// Payment entitlement must be a paid Checkout Session, never a no-charge session.
const payments=read('netlify/functions/_leizu-payment-common.mjs');
if(/no_payment_required/.test(payments)) fail('Leizu payment entitlement still permits no_payment_required sessions');
if(!/session\.payment_status\s*===\s*'paid'/.test(payments)) fail('Leizu payment entitlement no longer checks Stripe paid state directly');

// The public Gemini health endpoint may confirm service reachability without
// advertising secret presence or secret length to anonymous callers.
const gemini=read('netlify/functions/gemini-chat.js');
for(const secretDetail of ['api_key_present','api_key_length']) if(gemini.includes(secretDetail)) fail(`Gemini diagnostic leaks ${secretDetail}`);

// The methodology architecture references are progressive-enhancement links.
// JavaScript switches the current virtual section, while the href points to a
// static control that exists in the source for keyboard and no-script fallback.
const methodology=read('polymyth/methodologylist/index.html');
for(const section of ['sabachtan','methodology','gorgonification','degorgonification','idiomary']){
  if(!methodology.includes(`href="#tabs" data-jump-section="${section}"`)) fail(`methodology architecture link is missing its ${section} section route`);
}
if(!methodology.includes('href="#search" data-jump-tag="contentinternet"')) fail('methodology architecture link is missing its contentinternet filter route');

// Critical search controls need explicit names beyond their placeholder strings.
for(const [file,id] of [
  ['aa/index.html','search-input'],
  ['aa/cloud/index.html','search-overlay-input'],
  ['polymyth/campaigncodex/index.html','search'],
  ['polymyth/modulecanon/index.html','search']
]){
  const text=read(file);
  const idx=text.indexOf(`id="${id}"`);
  if(idx<0 || !/aria-label=/.test(text.slice(Math.max(0,idx-100),idx+220))) fail(`${file} search control ${id} needs an accessible name`);
}

// The legacy redirect page must self-canonicalize until Netlify serves its 301.
const legacySitemap=read('sitemap/index.html');
if(!legacySitemap.includes('https://seminarschools.com/sitemap/')) fail('legacy sitemap page does not self-canonicalize');

// A security contact should be reachable from the conventional location.
if(!exists('.well-known/security.txt')) fail('security.txt is missing');
else {
  const security=read('.well-known/security.txt');
  for(const line of ['Contact: mailto:saulnassau@protonmail.com','Canonical: https://seminarschools.com/.well-known/security.txt','Expires:']){
    if(!security.includes(line)) fail(`security.txt missing ${line}`);
  }
}

console.log('=== PROFESSIONAL PREDEPLOY READINESS ===');
if(errors.length){
  for(const error of errors) console.error('FAIL ' + error);
  process.exit(1);
}
console.log('PASS — cache, PWA, sitemap, entitlement, diagnostics, accessibility semantics, and public build boundaries are hardened.');
