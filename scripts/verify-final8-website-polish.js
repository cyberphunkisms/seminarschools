#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),fail=[];
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const need=(hay,t,msg)=>{if(!hay.includes(t))fail.push(msg||`missing ${t}`)};
const release=read('RELEASE_ID.txt').trim();
if(!/^\d{4}-\d{2}-\d{2}-.+/.test(release))fail.push(`release id malformed: ${release}`);
const main=read('saul/index.html'),css=read('saul/assets/saul-cv-spectrum-2026.css'),js=read('saul/assets/saul-cv-spectrum-2026.js'),home=read('about/index.html');
['cv-map-section--enhanced','data-cv-map-frame','cv-map-threads','Text location list','data-cv-local-nav','id="archiveCount"','archive=','document.createElement("details")','renderedArchiveCount','data-cv-print-template'].forEach(t=>need(main,t,`main Saul missing ${t}`));
['FINAL8_MAP_ARCHIVE_INTERACTION_POLISH','cv-route-bridge','cv-map-grid','min-height:44px','.page>.cv-local-nav','.section-count'].forEach(t=>need(css,t,`shared CSS missing ${t}`));
['preparePrintJobs','clearPrintJobs','COMBINATION_PROFILES','data-cv-selection-count','data-cv-share-status'].forEach(t=>need(js,t,`shared JS missing ${t}`));
if((home.match(/fonts\.googleapis\.com\/css2/g)||[]).length!==1)fail.push('main homepage must load exactly one Google Fonts css2 bundle');
need(home,'.ss-fz button{width:44px;height:44px;','main homepage type-size controls are below 44px');
const data=JSON.parse(read('data/saul-cv-canonical-2026.json'));
for(const slug of Object.keys(data.modules)){const x=read(`saul/cv/${slug}/index.html`);['cv-route-bridge','Explore the full work record','View places behind the work','data-cv-print-template'].forEach(t=>need(x,t,`${slug} missing ${t}`));if(x.includes('Same visual system'))fail.push(`${slug} retains old bottom block`)}
const hospitality=read('saul/hospitality/index.html');need(hospitality,'cv-route-bridge','hospitality missing archive bridge');
// Inspect literal markup only; href="#" inside JavaScript template strings is an in-app control implementation, not a static anchor.
function walk(dir,out=[]){for(const ent of fs.readdirSync(dir,{withFileTypes:true})){if(ent.name==='public'||ent.name==='.git'||ent.name==='node_modules')continue;const p=path.join(dir,ent.name);if(ent.isDirectory())walk(p,out);else if(ent.name.endsWith('.html'))out.push(p)}return out}
for(const p of walk(root)){let x=fs.readFileSync(p,'utf8').replace(/<script\b[\s\S]*?<\/script>/gi,'').replace(/<style\b[\s\S]*?<\/style>/gi,'');if(/<a\b[^>]*href\s*=\s*["']#["']/i.test(x))fail.push(`static placeholder link ${path.relative(root,p)}`)}
const card=read('bookwormcard/index.html');if(/<a\b[^>]*id=["']resume-from-file/.test(card))fail.push('bookwormcard resume action remains an anchor');
const textareas=(card.match(/<textarea\b[^>]*>/gi)||[]);if(textareas.some(t=>!/(aria-label|aria-labelledby)=/i.test(t)))fail.push('bookwormcard has unlabelled textarea');
const dash=read('dashboard/index.html');if(!/label[^>]+for=["']starFilter/.test(dash))fail.push('dashboard filter label missing');if(dash.includes('privacy_scan_report.md'))fail.push('broken dashboard privacy report link returned');
const booking=read('leizu/booking-success/index.html');if(/id=["']manual-link["'][^>]*href=["']#|href=["']#["'][^>]*id=["']manual-link/.test(booking))fail.push('booking fallback remains a placeholder');
const intake=read('leizu/intake/index.html');if(/<a\b[^>]*class=["'][^"']*tier-pick/.test(intake))fail.push('intake choices remain anchor controls');if(/id=["']stripe-link["'][^>]*href=["']#|href=["']#["'][^>]*id=["']stripe-link/.test(intake))fail.push('Stripe fallback remains a placeholder');
const requiredSkip=['404.html','index.html','bookwormcard/index.html','leizu/intake/index.html','leizu/toronto-tutoring/index.html','dashboard/index.html','polymythseminars/index.html','cfps/index.html','lectures/index.html','fellowships/index.html','humanities/index.html'];for(const rel of requiredSkip){if(fs.existsSync(path.join(root,rel))&&!read(rel).includes('class="skip-link"'))fail.push(`${rel} missing skip link`)}
for(const term of ['TELUS','Telus']){if(main.includes(term)||JSON.stringify(data).includes(term))fail.push(`${term} returned to Saul CV`)}
need(JSON.stringify(data),'GEICO','GEICO credit missing');
if(fail.length){console.error('FINAL8 WEBSITE POLISH FAILED');fail.forEach(x=>console.error(' - '+x));process.exit(1)}
console.log('FINAL8 WEBSITE POLISH PASSED - map, archive bridge, interaction, accessibility and release-state contracts hold.');
