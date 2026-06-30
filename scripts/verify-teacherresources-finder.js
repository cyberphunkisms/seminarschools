#!/usr/bin/env node
'use strict';
const fs=require('fs'); const path=require('path');
const ROOT=path.resolve(__dirname,'..'); const html=fs.readFileSync(path.join(ROOT,'teacherresources','index.html'),'utf8');
const failures=[];
for(const needle of ['quick-finder','data-preset-subject','data-preset-grade','data-preset-format','Search resources','result-count']) if(!html.includes(needle)) failures.push(`teacherresources missing ${needle}`);
const subjects=(html.match(/data-preset-subject=/g)||[]).length; const grades=(html.match(/data-preset-grade=/g)||[]).length; const formats=(html.match(/data-preset-format=/g)||[]).length;
if(subjects<4) failures.push(`expected at least 4 subject quick buttons, found ${subjects}`);
if(grades<2) failures.push(`expected at least 2 grade quick buttons, found ${grades}`);
if(formats<3) failures.push(`expected at least 3 format quick buttons, found ${formats}`);
if(!/querySelectorAll\('\[data-preset-subject\],\[data-preset-grade\],\[data-preset-format\]'\)/.test(html)) failures.push('quick finder buttons are not wired to JS state');
if(failures.length){ console.error('TEACHER RESOURCES FINDER CHECK FAILED'); failures.forEach(f=>console.error(' - '+f)); process.exit(1); }
console.log(`TEACHER RESOURCES FINDER CHECK PASSED — ${subjects} subject, ${grades} grade, ${formats} format quick buttons wired.`);
