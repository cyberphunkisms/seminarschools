#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://seminarschools.com';
const doctrine = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'route-doctrine.json'), 'utf8'));
const sitemap = fs.existsSync(path.join(ROOT, 'sitemap.xml')) ? fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8') : '';
const robots = fs.existsSync(path.join(ROOT, 'robots.txt')) ? fs.readFileSync(path.join(ROOT, 'robots.txt'), 'utf8') : '';
const failures = [];
function fail(x){ failures.push(x); }
function fileFor(route){ if(route === '/') return 'index.html'; return route.replace(/^\//,'').replace(/\/$/,'') + '/index.html'; }
function read(rel){ return fs.existsSync(path.join(ROOT, rel)) ? fs.readFileSync(path.join(ROOT, rel), 'utf8') : ''; }
function hasNoindex(html){ return /<meta\b[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html); }
function routeInSitemap(route){ return sitemap.includes(`<loc>${SITE}${route}</loc>`); }
if(!/^seminarschools-route-doctrine-v2/.test(doctrine.schema || '')) fail('route doctrine schema must be v2');
if(!Array.isArray(doctrine.routes) || doctrine.routes.length < 40) fail('route doctrine must govern at least 40 explicit routes');
if(!Array.isArray(doctrine.route_groups) || doctrine.route_groups.length < 4) fail('route doctrine must define generated/pattern route groups');
const requiredTypes = ['service','cv','calendar','game','archive','tool','generated','private','resource-catalog','campaign'];
const typeText = JSON.stringify(doctrine);
for (const t of requiredTypes){ if(!typeText.includes(t)) fail(`route doctrine missing route type ${t}`); }
for(const r of doctrine.routes || []){
  if(!r.path || !r.path.startsWith('/')) { fail(`bad route entry: ${JSON.stringify(r)}`); continue; }
  const rel = fileFor(r.path);
  const full = path.join(ROOT, rel);
  const blocked = robots.includes('Disallow: ' + r.path);
  if(r.private){
    if(fs.existsSync(full)){
      const html = read(rel);
      if(!hasNoindex(html) && !blocked) fail(`${r.path} is private but lacks noindex or robots disallow`);
    } else if(!blocked) fail(`${r.path} is private but lacks file and robots disallow`);
    continue;
  }
  if(!fs.existsSync(full)){ fail(`${r.path} missing ${rel}`); continue; }
  const html = read(rel);
  if(!/<title>[\s\S]*?<\/title>/i.test(html)) fail(`${r.path} lacks title`);
  if(!/<meta\b[^>]*name=["']description["']/i.test(html)) fail(`${r.path} lacks meta description`);
  if(!/<link\b[^>]*rel=["']canonical["']/i.test(html)) fail(`${r.path} lacks canonical`);
  if(!/<h1\b/i.test(html)) fail(`${r.path} lacks h1`);
  if(r.sitemap && !routeInSitemap(r.path)) fail(`${r.path} missing from sitemap`);
  if(/archive/i.test(r.type || '') && !/route-note|archive-route-note|polymyth-funnel/i.test(html)) fail(`${r.path} archive route lacks visible route note or funnel`);
}
if(failures.length){
  console.error('ROUTE DOCTRINE CHECK FAILED');
  for(const f of failures.slice(0, 180)) console.error(' - ' + f);
  if(failures.length > 180) console.error(` ... ${failures.length - 180} more`);
  process.exit(1);
}
console.log(`ROUTE DOCTRINE CHECK PASSED — ${(doctrine.routes||[]).length} explicit routes and ${(doctrine.route_groups||[]).length} route groups governed.`);
