#!/usr/bin/env node
'use strict';
const fs=require('fs');const path=require('path');const ROOT=path.resolve(__dirname,'..');
const POLY_ROUTES=['polymythseminars','writingclub','writingkids','writingjuniors','writingteens','writinggrads','university','philosophy','humanities','cfps','lectures','fellowships'];let errors=[];let warnings=[];
const read=rel=>fs.readFileSync(path.join(ROOT,rel),'utf8');const exists=rel=>fs.existsSync(path.join(ROOT,rel));
function allFiles(dir,out=[]){for(const name of fs.readdirSync(dir)){if(['.git','node_modules','.netlify','public'].includes(name))continue;const p=path.join(dir,name);const st=fs.statSync(p);if(st.isDirectory())allFiles(p,out);else out.push(p);}return out;}
const appPath=path.join(ROOT,'js','polymythcal-revamp.js');const app=fs.existsSync(appPath)?fs.readFileSync(appPath,'utf8'):'';
if(!/function render\(\)/.test(app)||!/writeStateToUrl\(\)/.test(app)||!/function routeMatches\(event\)/.test(app)) errors.push('shared Polymythcal controller lacks render, URL-state, or route-restriction handling');
if(/scrollIntoView\(/.test(app)&&!/behavior:\s*["']smooth["']/.test(app)) warnings.push('shared Polymythcal controller contains a non-smooth programmatic scroll');
for(const route of POLY_ROUTES){
 const rel=`${route}/index.html`;if(!exists(rel)){errors.push(`missing ${rel}`);continue;}const html=read(rel);
 const h1=(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)||[])[1]||'';if(!h1.replace(/<[^>]+>/g,'').trim()) errors.push(`${rel} visible h1 is empty`);
 if(route==='polymythseminars'){if(!/Polymythcal/i.test(h1)) errors.push(`${rel} main h1 does not identify Polymythcal`);}else if(!html.includes(`data-pm-route="${route}"`)) errors.push(`${rel} lacks route identity`);
 if(!/id="polymythContext"/.test(html)||!/id="polymythDescription"/.test(html)) errors.push(`${rel} missing context/description fields`);
 if(!/id="quickGuideCopy"/.test(html)||!/Open a title to reach the official source|Open a title for the official source|Open a title for the stable Polymythcal page/.test(html)) errors.push(`${rel} missing plain-language use guide`);
 if(!/polymythcal-revamp\.js/.test(html)) errors.push(`${rel} does not load the shared Polymythcal interaction controller`);
 if(/onclick="/.test(html)) errors.push(`${rel} contains inline onclick handler`);
 if(/document\.title/.test(html)) errors.push(`${rel} mutates document.title`);
 if(/function dispatchRender|scheduleScrollToToday|eventsScroll/.test(html)) errors.push(`${rel} retains legacy inline render/scroll code`);
}
for(const junk of fs.readdirSync(ROOT)) if(junk===']]"' || junk===' ]]' || junk.startsWith('= git status')||junk.startsWith('ersuserDocumentsGitHub')||junk.startsWith('till failed')) errors.push(`junk paste artifact remains at repo root: ${junk}`);
const files=allFiles(ROOT).filter(p=>/\.(html|js)$/i.test(p));let hrefHash=0,preventDefault=0,scrollCalls=0,javascriptHref=0;
for(const p of files){const rel=path.relative(ROOT,p).replace(/\\/g,'/');const s=fs.readFileSync(p,'utf8');if(/href=["']javascript:/i.test(s)){javascriptHref++;errors.push(`${rel} has javascript: href`);}if(/href=["']#["']/i.test(s))hrefHash++;if(/preventDefault\(/.test(s))preventDefault++;if(/\bscroll(?:To|IntoView)\s*\(/.test(s))scrollCalls++;}
if(hrefHash>12)warnings.push(`${hrefHash} bare hash links found; current allowance is 12 for legacy interactive shells.`);if(scrollCalls>30)warnings.push(`${scrollCalls} scroll calls found; current allowance is 30 after Polymythcal de-jank.`);
if(errors.length){console.error('SITE INTERACTIVITY CHECK FAILED');errors.forEach(e=>console.error(' - '+e));warnings.forEach(w=>console.warn('WARN '+w));process.exit(1);}
console.log(`SITE INTERACTIVITY CHECK PASSED — ${POLY_ROUTES.length} Polymythcal pages use one route-aware controller, clear page-specific headings, URL-backed state, no inline click handlers, and no legacy filter re-anchoring. Site scan: ${files.length} HTML/JS files, ${preventDefault} intentional preventDefault handlers, ${scrollCalls} scroll helpers, ${hrefHash} bare hash links, ${javascriptHref} javascript hrefs.`);warnings.forEach(w=>console.warn('WARN '+w));
