#!/usr/bin/env node
'use strict';
const fs=require('fs'); const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const failures=[];
const css=fs.readFileSync(path.join(ROOT,'css','alive.css'),'utf8');
for(const [name,rx] of [
 ['zoom contract',/ZOOM_RESILIENCE_CONTRACT/],
 ['CL self guard contract',/CL_SELF_GUARD_CONTRACT/],
 ['760 mobile query',/@media\s*\(max-width:\s*760px\)/],
 ['print query',/@media\s+print/],
 ['overflow wrap',/overflow-wrap:\s*(anywhere|break-word)/],
 ['max width viewport guard',/max-width:\s*calc\(100vw|max-width:\s*min\(/]
]){ if(!rx.test(css)) failures.push(`css/alive.css missing ${name}`); }
const smoke=['index.html','main/index.html','saul/index.html','bb/index.html','bookwormcard/index.html','polymythseminars/index.html','teacherresources/index.html','aa/index.html','polymyth/index.html'];
for(const rel of smoke){ const full=path.join(ROOT,rel); if(!fs.existsSync(full)) continue; const html=fs.readFileSync(full,'utf8'); if(!/<meta[^>]+name=["']viewport["']/i.test(html)) failures.push(`${rel} missing viewport meta`); if(/user-scalable\s*=\s*no|maximum-scale\s*=\s*1/i.test(html)) failures.push(`${rel} disables user zoom`); if(!/alive\.css/.test(html)) failures.push(`${rel} missing alive.css`); }
if(failures.length){ console.error('RESPONSIVE REGRESSION CHECK FAILED'); failures.forEach(f=>console.error(' - '+f)); process.exit(1); }
console.log('RESPONSIVE REGRESSION CHECK PASSED — 200 percent zoom and mobile source contracts are present on smoke routes.');
