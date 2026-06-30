#!/usr/bin/env node
'use strict';
const fs=require('fs'); const path=require('path'); const ROOT=path.resolve(__dirname,'..');
const rels=['writingkids','writingjuniors','writingteens','writinggrads','writingclub','university','philosophy','humanities','cfps','lectures','fellowships'];
const titles=[]; const failures=[];
for(const dir of rels){ const full=path.join(ROOT,dir,'index.html'); if(!fs.existsSync(full)){ failures.push(`${dir}/index.html missing`); continue; } const html=fs.readFileSync(full,'utf8'); const m=html.match(/<title>([\s\S]*?)<\/title>/i); if(!m) failures.push(`${dir} lacks title`); else titles.push([dir,m[1].replace(/\s+/g,' ').trim()]); }
const seen=new Map(); for(const [dir,title] of titles){ if(seen.has(title)) failures.push(`${dir} duplicates title with ${seen.get(title)}: ${title}`); seen.set(title,dir); if(/^Polymythcal \| Seminar Schools$/i.test(title)) failures.push(`${dir} still has generic Polymythcal title`); }
for(const script of ['build-writing-shortcuts.js','build-academic-shortcuts.js']){ const js=fs.readFileSync(path.join(ROOT,'scripts',script),'utf8'); if(!/title/i.test(js) || !/Polymythcal/.test(js)) failures.push(`${script} lacks title generation logic`); }
if(failures.length){ console.error('SHORTCUT TITLE UNIQUENESS FAILED'); failures.forEach(f=>console.error(' - '+f)); process.exit(1); }
console.log(`SHORTCUT TITLE UNIQUENESS PASSED — ${titles.length} shortcut titles are unique.`);
