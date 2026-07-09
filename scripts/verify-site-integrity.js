#!/usr/bin/env node
/**
 * Whole-site deployment guard.
 * Verifies public routes, local assets, local scripts, anchors, forms, and
 * outbound-link safety before a static Netlify deployment.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const os = require('os');
const ROOT = path.resolve(__dirname, '..');
function configuredPublishDir(){
  const fp=path.join(ROOT,'netlify.toml');
  if(!fs.existsSync(fp)) return '.';
  const m=fs.readFileSync(fp,'utf8').match(/\bpublish\s*=\s*"([^"]+)"/);
  return m ? m[1] : '.';
}
const PUBLISH_DIR = configuredPublishDir();
const SITE_ROOT = path.resolve(ROOT, PUBLISH_DIR);
if (PUBLISH_DIR !== '.' && !fs.existsSync(SITE_ROOT)) {
  console.error(`SITE INTEGRITY GUARD: publish directory ${PUBLISH_DIR} is missing. Run node scripts/build-public-deploy.js first.`);
  process.exit(1);
}
const EXCLUDE = new Set(['node_modules','.git','.github','public']);
const errors=[];
const warnings=[];
const fail=(m)=>errors.push(m);
const warn=(m)=>warnings.push(m);
const rel=(p)=>path.relative(SITE_ROOT,p).replace(/\\/g,'/');

function walk(dir, out=[]) {
  for (const e of fs.readdirSync(dir,{withFileTypes:true})) {
    if (EXCLUDE.has(e.name)) continue;
    const full=path.join(dir,e.name);
    if (e.isDirectory()) walk(full,out);
    else out.push(full);
  }
  return out;
}
const files=walk(SITE_ROOT);
const html=files.filter(f=>f.endsWith('.html'));
const publicFiles=new Set(files.map(f=>'/'+rel(f)));
const publicRoutes=new Set(['/']);
for (const f of files) {
  const r='/'+rel(f);
  if (r.endsWith('/index.html')) publicRoutes.add(r.slice(0,-'index.html'.length));
  if (r.endsWith('.html')) publicRoutes.add(r.slice(0,-'.html'.length));
  publicRoutes.add(r);
}

function parseRedirects() {
  const rows=[];
  const sources=['_redirects','netlify.toml'];
  for (const s of sources) {
    const fp=path.join(ROOT,s); if(!fs.existsSync(fp)) continue;
    const text=fs.readFileSync(fp,'utf8');
    if(s==='_redirects') {
      for(const line of text.split(/\r?\n/)) {
        const t=line.trim(); if(!t||t.startsWith('#')) continue;
        const parts=t.split(/\s+/); if(parts[0]?.startsWith('/')) rows.push(parts[0]);
      }
    } else {
      for(const m of text.matchAll(/\bfrom\s*=\s*"([^"]+)"/g)) rows.push(m[1]);
    }
  }
  return rows;
}
const redirects=parseRedirects();
function redirected(p) {
  return redirects.some(r=>r===p || (r.includes('*') && new RegExp('^'+r.replace(/[.+?^${}()|[\]\\]/g,'\\$&').replace(/\*/g,'.*')+'$').test(p)));
}
function stripUrl(v){return v.split('#')[0].split('?')[0];}
function localPathExists(page, value) {
  const raw=stripUrl(value);
  if (!raw || raw==='#' || raw.startsWith('#') || raw.startsWith('mailto:') || raw.startsWith('tel:') || raw.startsWith('javascript:') || raw.startsWith('data:')) return true;
  if(raw.includes('${') || raw.includes("'+") || raw.includes("\"+")) return true; // rendered client-side
  let target;
  if(raw.startsWith('https://seminarschools.com')) target=raw.replace(/^https:\/\/seminarschools\.com/,'') || '/';
  else if(raw.startsWith('http://seminarschools.com')) target=raw.replace(/^http:\/\/seminarschools\.com/,'') || '/';
  else if(raw.startsWith('/')) target=raw;
  else if(/^[a-z][a-z0-9+.-]*:/i.test(raw)||raw.startsWith('//')) return true;
  else target=path.posix.normalize(path.posix.join(path.posix.dirname('/'+rel(page)),raw));
  if(!target.startsWith('/')) target='/'+target;
  if(target.includes('..')) return false;
  const candidates=[target, target.endsWith('/')?target:target+'/', target.endsWith('.html')?target:target+'.html'];
  return candidates.some(c=>publicRoutes.has(c)||publicFiles.has(c)||redirected(c));
}
function getAttr(s,attr) {
  const r=new RegExp('\\b'+attr+'\\s*=\\s*(["\'])([\\s\\S]*?)\\1','gi');
  return [...s.matchAll(r)].map(m=>m[2]);
}
function allTags(s,tag) {
  const r=new RegExp('<'+tag+'\\b[^>]*>','gi'); return [...s.matchAll(r)].map(m=>m[0]);
}

for(const f of html) {
  const text=fs.readFileSync(f,'utf8');
  const markup=text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'');
  const name=rel(f);
  // Required tag balance.
  for(const tag of ['script','style','main','body','html']) {
    const o=(markup.match(new RegExp('<'+tag+'(?:\\s|>)','gi'))||[]).length;
    const c=(markup.match(new RegExp('</'+tag+'>','gi'))||[]).length;
    if(o!==c) fail(`${name}: <${tag}> balance ${o}/${c}`);
  }
  // Local href/src/form paths.
  const refs=[...getAttr(markup,'href').map(v=>['href',v]),...getAttr(markup,'src').map(v=>['src',v])];
  for(const form of allTags(markup,'form')) {
    const action=(form.match(/\baction\s*=\s*(["'])(.*?)\1/i)||[])[2];
    if(action) refs.push(['action',action]);
  }
  for(const [kind,v] of refs) {
    if(!localPathExists(f,v)) fail(`${name}: missing ${kind} target ${v}`);
  }
  // #anchor targets must exist in the same document.
  const ids=new Set(getAttr(markup,'id'));
  for(const v of getAttr(markup,'href')) {
    if(v.includes('${') || v.includes("' +") || v.includes("\" +")) continue;
    const m=v.match(/^(?:[^#]*)#(.+)$/); if(!m || v==='#') continue;
    const before=stripUrl(v);
    if((!before || before==='') && !ids.has(m[1])) fail(`${name}: missing local anchor #${m[1]}`);
  }
  // New-window links need tab isolation.
  for(const a of allTags(markup,'a')) {
    if(/\btarget\s*=\s*(["'])_blank\1/i.test(a) && !/\brel\s*=\s*(["'])[^"']*\bnoopener\b[^"']*\1/i.test(a)) fail(`${name}: target=_blank missing rel=noopener`);
  }
  // Images require useful or intentionally-empty alt.
  for(const img of allTags(markup,'img')) {
    if(!/\balt\s*=/i.test(img)) fail(`${name}: image missing alt text`);
  }
  // Forms need a name and a post method unless a form target explicitly documents GET.
  for(const form of allTags(markup,'form')) {
    if(!/\bname\s*=/.test(form) && !/\bid\s*=/.test(form)) fail(`${name}: form has no name or id`);
    const method=(form.match(/\bmethod\s*=\s*(["'])(.*?)\1/i)||[])[2];
    if(method && method.toLowerCase()!=='post' && !/search/i.test(form)) warn(`${name}: non-POST form (${method})`);
  }
}

// Backup pages and generated audit material must not ship as public HTML routes.
for(const f of files) {
  const r=rel(f);
  if(/(^|\/)index\.before-|\.bak\.(?:html?|htm)$/i.test(r)) fail(`${r}: deployment backup is publicly reachable`);
}

// Validate all first-party JavaScript files with Node's parser.
const jsFiles=files.filter(f=>/\.(?:js|mjs)$/.test(f) && !rel(f).startsWith('scripts/_retired/'));
for(const f of jsFiles) {
  const out=cp.spawnSync(process.execPath,['--check',f],{encoding:'utf8'});
  if(out.status!==0) fail(`${rel(f)}: JavaScript parse error: ${(out.stderr||out.stdout).trim().split('\n')[0]}`);
}
// Validate inline JS other than data declarations.
for(const f of html) {
  const text=fs.readFileSync(f,'utf8'); const name=rel(f); let i=0;
  for(const m of text.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs=m[1], code=m[2]; i++;
    if(/\bsrc\s*=/.test(attrs)||/application\/(?:ld\+)?json|application\/json/i.test(attrs)||!code.trim()) continue;
    const tmp=path.join(os.tmpdir(),`site-inline-${process.pid}-${i}.js`);
    fs.writeFileSync(tmp,code);
    const out=cp.spawnSync(process.execPath,['--check',tmp],{encoding:'utf8'});
    fs.unlinkSync(tmp);
    if(out.status!==0) fail(`${name}: inline script ${i} parse error: ${(out.stderr||out.stdout).trim().split('\n')[0]}`);
  }
}

// Core public files must exist and be represented in sitemap.
for(const p of ['/','/main/','/saul/','/leizu/','/leizu/intake/','/bb/','/bb/why/','/agora/','/teacherresources/','/polymyth/']) {
  if(!publicRoutes.has(p)) fail(`core route missing ${p}`);
}
const sitemap=fs.readFileSync(path.join(SITE_ROOT,'sitemap.xml'),'utf8');
for(const p of ['/','/main/','/saul/','/leizu/','/bb/why/']) {
  if(!sitemap.includes(`https://seminarschools.com${p}`)) fail(`sitemap missing ${p}`);
}

console.log('=== SITE INTEGRITY GUARD ===');
console.log(`Publish dir: ${PUBLISH_DIR} | HTML pages: ${html.length} | JS files: ${jsFiles.length} | Redirect rules: ${redirects.length}`);
if(warnings.length){console.log(`Warnings (${warnings.length}):`); warnings.forEach(x=>console.log('  WARN '+x));}
if(errors.length){console.log(`Errors (${errors.length}):`); errors.forEach(x=>console.log('  FAIL '+x)); process.exit(1);}
console.log('PASS — public routes, local links, assets, forms, anchors, and scripts are internally consistent.');
