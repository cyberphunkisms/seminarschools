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
const themeCss=fs.readFileSync(path.join(ROOT,'css','theme.css'),'utf8');
if(!/\.theme-toggle\s*\{[\s\S]*?width:\s*44px;[\s\S]*?height:\s*44px;/.test(themeCss)) failures.push('theme toggle is not a 44px circle');
const typeCss=fs.readFileSync(path.join(ROOT,'css','site-wide-type-zoom.css'),'utf8');
if(!/\.ss-fz button\{[^}]*width:44px!important;[^}]*height:44px!important;/.test(typeCss)) failures.push('shared text-size controls are not 44px circles');
if(!/@media screen and \(max-width:820px\)\{[\s\S]*?\.ss-fz\{[\s\S]*?left:\.75rem!important/.test(typeCss)) failures.push('shared text-size controls do not clear narrow and high-zoom mastheads');
if(!/@media screen and \(max-width:820px\)\{[\s\S]*?\.theme-toggle\{[\s\S]*?bottom:max\(\.75rem,env\(safe-area-inset-bottom\)\)!important/.test(typeCss)) failures.push('theme toggle does not clear narrow and high-zoom mastheads');
if(!/\.ss-fz\[data-fz-placement="bottom-left"\]\{right:auto!important\}/.test(typeCss)) failures.push('bottom-left text-size controls inherit an opposing right offset');
const polyCss=fs.readFileSync(path.join(ROOT,'css','polymythcal-revamp.css'),'utf8');
if(!/\.pm-search-clear\s*\{[\s\S]*?width:\s*44px;[\s\S]*?height:\s*44px;/.test(polyCss)) failures.push('Polymythcal search clear control is not 44px square');
if(!/@media\s*\(pointer:\s*coarse\)[\s\S]*?\.pm-calendar-more[\s\S]*?min-height:\s*44px;/.test(polyCss)) failures.push('Polymythcal calendar more control lacks the coarse-pointer target floor');
const saul=fs.readFileSync(path.join(ROOT,'saul','index.html'),'utf8');
if(!/\.fz-controls button\s*\{[\s\S]*?width:\s*44px;[\s\S]*?height:\s*44px;/.test(saul)) failures.push('Saul text-size controls are not 44px circles');
const smoke=['index.html','about/index.html','saul/index.html','bb/index.html','bookwormcard/index.html','polymythseminars/index.html','teacherresources/index.html','aa/index.html','polymyth/index.html'];
for(const rel of smoke){ const full=path.join(ROOT,rel); if(!fs.existsSync(full)) continue; const html=fs.readFileSync(full,'utf8'); if(!/<meta[^>]+name=["']viewport["']/i.test(html)) failures.push(`${rel} missing viewport meta`); if(/user-scalable\s*=\s*no|maximum-scale\s*=\s*1/i.test(html)) failures.push(`${rel} disables user zoom`); if(!/alive\.css/.test(html)) failures.push(`${rel} missing alive.css`); }
if(failures.length){ console.error('RESPONSIVE REGRESSION CHECK FAILED'); failures.forEach(f=>console.error(' - '+f)); process.exit(1); }
console.log('RESPONSIVE REGRESSION CHECK PASSED — 200 percent zoom and mobile source contracts are present on smoke routes.');
