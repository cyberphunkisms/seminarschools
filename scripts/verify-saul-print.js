#!/usr/bin/env node
'use strict';
const fs=require('fs'); const path=require('path');
const ROOT=path.resolve(__dirname,'..'); const rel='saul/index.html';
const html=fs.readFileSync(path.join(ROOT,rel),'utf8'); const failures=[];
if(!/data-cv-purpose=["']general-employment["']/.test(html)) failures.push('Saul CV lacks general-employment purpose marker');
if(/Saul\s+Karim\s+Nassau,\s*<small>MA<\/small>|Saul\s+Karim\s+Nassau,\s*MA/.test(html)) failures.push('Saul CV has comma before MA');
if(!/Saul\s+Karim\s+Nassau[\s\S]{0,80}<small>MA<\/small>|Saul\s+Karim\s+Nassau[\s\S]{0,80}MA/.test(html)) failures.push('Saul CV name/MA pattern missing');
if(!/CL_SELF_CV_PRINT_ZOOM_GUARD/.test(html)) failures.push('Saul CV missing print/zoom guard marker');
if(!/@media\s+print/i.test(html)) failures.push('Saul CV missing print media CSS');
if(!/overflow-wrap:\s*anywhere/.test(html)) failures.push('Saul CV missing overflow-wrap guard');

const pdfPath = path.join(ROOT, 'saul', 'cv.pdf');
if(!fs.existsSync(pdfPath)) failures.push('static Saul CV PDF missing');
else {
  const pdfBytes = fs.readFileSync(pdfPath);
  if(pdfBytes.length < 5000) failures.push('static Saul CV PDF looks too small');
  const buildScript = fs.readFileSync(path.join(ROOT, 'scripts', 'build-cv-pdf.js'), 'utf8');
  if(/Saul\s+Karim\s+NMH|NMH/.test(buildScript)) failures.push('static PDF builder still contains NMH');
}
if(failures.length){ console.error('SAUL PRINT/CV CHECK FAILED'); failures.forEach(f=>console.error(' - '+f)); process.exit(1); }
console.log('SAUL PRINT/CV CHECK PASSED — general CV marker, no comma before MA, print and zoom guards present.');
