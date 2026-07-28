#!/usr/bin/env node
'use strict';
const fs=require('fs');const path=require('path');const root=path.resolve(__dirname,'..');
const home=fs.readFileSync(path.join(root,'index.html'),'utf8');const indra=fs.readFileSync(path.join(root,'js','indra.js'),'utf8');let failures=0;
function check(ok,label){process.stdout.write((ok?'PASS  ':'FAIL  ')+label+'\n');if(!ok)failures++;}
check(home.includes("class:'label-plate'"),'map label plates exist');
check(!home.includes('paint-order:stroke;stroke:var(--bg);stroke-width:4px'),'map labels no longer use halo strokes');
check(home.includes('class="map-rail" id="mapRail"'),'mobile project rail exists');
check(home.includes("href:'/about/', tier:0"),'core jewel opens the conceptual centre');
check(home.includes("href:'/bb/', tier:3"),'bookwormburrows jewel routes to its landing page');
check(home.includes("role:'link'")&&home.includes("'aria-label'"),'jewels expose link semantics and names');
check(home.includes("g.addEventListener('click',()=>window.location.assign(n.href))"),'jewels navigate on the first click');
check(!home.includes('lastPointer')&&!home.includes("lastPointer==='touch'"),'touch no longer requires select-before-navigate');
check(home.includes("document.body.style.setProperty('--indra-active',col)")&&home.includes("document.body.style.setProperty('--indra-opacity'"),'focus selection connects the constellation to the background web');
check(home.includes('new MutationObserver')&&home.includes("attributeFilter:['class','data-theme']"),'map colors refresh after theme changes');
check(indra.includes("data-indra-intensity")&&indra.includes("layer.style.setProperty('--indra-opacity'"),'Indra accepts page-specific intensity');
check(!/setInterval\s*\(/.test(indra)&&!/pointer(move|down|up)/i.test(indra)&&indra.includes("addEventListener('scroll', schedule"),'Indra is scroll-triggered and has no idle or pointer animation loop');
if(failures){console.error(`\n${failures} homepage map check(s) failed.`);process.exit(1);}console.log('\nHomepage map guard passed.');
