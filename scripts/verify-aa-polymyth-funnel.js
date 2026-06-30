#!/usr/bin/env node
'use strict';
const fs=require('fs'); const path=require('path'); const ROOT=path.resolve(__dirname,'..');
const failures=[]; for(const rel of ['aa/index.html','aa/cloud/index.html','aa/views/index.html']){ const html=fs.readFileSync(path.join(ROOT,rel),'utf8'); if(!/polymyth-funnel/.test(html)) failures.push(`${rel} missing polymyth funnel class`); if(!/href=["']\/polymyth\//.test(html)) failures.push(`${rel} missing /polymyth/ link`); }
if(failures.length){ console.error('AA TO POLYMYTH FUNNEL CHECK FAILED'); failures.forEach(f=>console.error(' - '+f)); process.exit(1); }
console.log('AA TO POLYMYTH FUNNEL CHECK PASSED — aa* surfaces point to polymorphousmythology.');
