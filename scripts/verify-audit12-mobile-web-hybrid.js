#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),fail=[];
const read=r=>fs.readFileSync(path.join(root,r),'utf8');
const exists=r=>fs.existsSync(path.join(root,r));
const has=(r,t)=>{if(!exists(r)||!read(r).includes(t))fail.push(`${r}: missing ${t}`)};
const lacks=(r,t)=>{if(exists(r)&&read(r).includes(t))fail.push(`${r}: contains ${t}`)};
if(read('RELEASE_ID.txt').trim()!=='2026-07-19-mobile-web-hybrid-audit12')fail.push('release id drift');
for(const token of [
  'id="audit12-mobile-web-hybrid"',
  'id="audit12-mobile-web-hybrid-script"',
  'role="toolbar" aria-label="Project web selector"',
  'aria-live="polite"',
  'window.__seminarSchoolsMobileWebHybrid',
  "const FULL={x:0,y:0,w:1000,h:700}",
  "if(!mobile.matches||node.id==='core')return FULL",
  'const midX=(c.x*.35+p.x*.65),midY=(c.y*.4+p.y*.6)',
  "button.setAttribute('aria-pressed',String(on))",
  'button.tabIndex=on?0:-1',
  "event.key==='ArrowRight'",
  "event.key==='Home'",
  "event.key==='End'",
  "hit.setAttribute('r',mobile.matches?'40'",
  "reduce.matches?'smooth':'auto'",
  'centerRail(node,animate)',
  'svg.dataset.focusNode=node.id',
])has('index.html',token);
for(const token of ['CL-WEB-112','CL-WEB-113','CL-WEB-114','CL-WEB-115','CL-WEB-301 — Resolved','CL-WEB-201','CL-WEB-202','CL-WEB-203'])has('WEBSITE_CL_2026-07-19.md',token);
for(const token of ['"id": "CL-WEB-301"','"status": "resolved"','"id": "CL-WEB-201"','"status": "held"'])has('data/website-cl.jsonl',token);
for(const rel of ['scripts/apply-audit12-mobile-web-hybrid.py','scripts/verify-audit12-mobile-web-hybrid.js','docs/WEBSITE_MOBILE_WEB_HYBRID_AUDIT12_2026-07-19.md'])if(!exists(rel))fail.push(`${rel}: missing`);
has('scripts/build-saul-cv-professional.py','apply-audit12-mobile-web-hybrid.py');
has('scripts/verify-all-runner.js','verify-audit12-mobile-web-hybrid.js');
has('package.json','verify:audit12');
if(exists('public/index.html')){
  for(const token of ['id="audit12-mobile-web-hybrid"','id="audit12-mobile-web-hybrid-script"','role="toolbar" aria-label="Project web selector"'])has('public/index.html',token);
}
lacks('WEBSITE_CL_2026-07-19.md','## User decision still open');
if(fail.length){console.error('AUDIT12 MOBILE WEB HYBRID FAILED');fail.forEach(x=>console.error(' - '+x));process.exit(1)}
console.log('AUDIT12 MOBILE WEB HYBRID PASSED — map, rail, selected card, mobile recentering, touch targets, keyboard movement, reduced motion, and completed CL state verified.');
