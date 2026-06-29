#!/usr/bin/env node
'use strict';
const fs=require('fs'), path=require('path');
const ROOT=path.resolve(__dirname,'..');
const errors=[];
function read(rel){return fs.readFileSync(path.join(ROOT,rel),'utf8');}
const keyPages=['index.html','main/index.html','saul/index.html','agora/index.html','polymythseminars/index.html','writingjuniors/index.html'];
for(const rel of keyPages){
  const html=read(rel);
  if(!/name="viewport"/.test(html)) errors.push(`${rel}: missing viewport meta`);
  if(!/WIDE RESPONSIVE SURFACE|RESPONSIVE_RELEASE|BEAUTY_RESPONSIVE_RELEASE|CONCISE_RESPONSIVE_RELEASE/.test(html+read('css/theme.css')+read('css/alive.css'))) errors.push(`${rel}: missing responsive release marker`);
}
const theme=read('css/theme.css');
if(!/--wide-content-width:\s*1220px/.test(theme)) errors.push('theme.css: desktop width token missing');
const alive=read('css/alive.css');
if(!/calc\(100vw - 72px\)/.test(alive+theme)) errors.push('global responsive CSS missing desktop viewport width rule');
if(errors.length){console.error('RESPONSIVE LAYOUT CHECK FAILED'); errors.forEach(e=>console.error(' - '+e)); process.exit(1);} 
console.log('RESPONSIVE LAYOUT CHECK PASSED — key pages have phone viewport and desktop-width rules.');
