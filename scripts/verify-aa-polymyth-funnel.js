#!/usr/bin/env node
'use strict';
const fs=require('fs'); const path=require('path'); const ROOT=path.resolve(__dirname,'..');
const failures=[]; for(const rel of ['aa/index.html','aa/cloud/index.html','aa/views/index.html']){ const html=fs.readFileSync(path.join(ROOT,rel),'utf8'); if(!/polymyth-funnel/.test(html)) failures.push(`${rel} missing polymyth funnel class`); if(!/href=["']\/polymyth\//.test(html)) failures.push(`${rel} missing /polymyth/ link`); }
const catalog=fs.readFileSync(path.join(ROOT,'aa/index.html'),'utf8');
function extractTaxonomies(source){
  const declaration='const TAXONOMIES = [';
  const startAt=source.indexOf(declaration);
  const start=source.indexOf('[',startAt);
  const endMarker='\n];\n\n// Tradition labels for UI';
  const end=source.indexOf(endMarker,start);
  if(startAt<0||start<0||end<0) throw new Error('missing TAXONOMIES declaration boundary');
  return source.slice(start,end+2);
}
try{
  const taxonomies=Function(`"use strict";return (${extractTaxonomies(catalog)});`)();
  const initialCount=catalog.match(/id="head-tax-count">(\d+) Taxonomies</)?.[1];
  if(Number(initialCount)!==taxonomies.length) failures.push(`aa/index.html initial taxonomy count ${initialCount||'missing'} does not match array length ${taxonomies.length}`);
}catch(error){ failures.push(`aa/index.html taxonomy count could not be derived: ${error.message}`); }
if(!/<div id="removed-entries-surface" hidden\b/.test(catalog)) failures.push('aa/index.html removed-entries audit surface is not hidden by default');
if(!/REMOVED_ENTRIES\.length > 0[\s\S]*surface\.hidden = false/.test(catalog)) failures.push('aa/index.html removed-entries audit surface is not revealed only for non-empty logs');
if(failures.length){ console.error('AA TO POLYMYTH FUNNEL CHECK FAILED'); failures.forEach(f=>console.error(' - '+f)); process.exit(1); }
console.log('AA TO POLYMYTH FUNNEL CHECK PASSED — aa* surfaces point to polymorphousmythology; taxonomy count and empty editorial-log state agree with source data.');
