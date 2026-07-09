#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const leizu = fs.readFileSync(path.join(ROOT, 'leizu/index.html'), 'utf8');
const theme = fs.readFileSync(path.join(ROOT, 'js/theme.js'), 'utf8');
const hardener = fs.readFileSync(path.join(ROOT, 'leizu/chrome-controls.js'), 'utf8');
const failures = [];
function must(label, condition){ if(!condition) failures.push(label); }
must('Leizu ESL button exists', /class="esl-btn"[^>]*data-esl-toggle/.test(leizu));
must('Leizu theme button exists', /class="theme-btn"[^>]*data-theme-toggle/.test(leizu));
must('Leizu text-size buttons exist', /data-size-step="-1"/.test(leizu) && /data-size-step="\+1"/.test(leizu));
must('Leizu chrome hardener is loaded', /\/leizu\/chrome-controls\.js\?v=20260628a/.test(leizu));
must('Hardener delegates ESL clicks', /esl-btn\[data-esl-toggle\]/.test(hardener) && /applyEslHard/.test(hardener));
must('Hardener delegates theme clicks', /theme-btn\[data-theme-toggle\]/.test(hardener) && /applyThemeHard/.test(hardener));
must('Hardener delegates text-size clicks', /size-btn\[data-size-step\]/.test(hardener) && /applyTypeHard/.test(hardener));
must('Global theme toggle is direct not system-cycle ambiguous', /Direct, predictable light\/dark toggle/.test(theme) && /var STORAGE_KEY = 'ss-theme'/.test(theme) && /setStoredPreference/.test(theme));
must('Global theme syncs data-theme for page-specific CSS', /setAttribute\('data-theme', 'dark'\)/.test(theme));

// Inventory font sizes across HTML/CSS so the audit has a real count.
const files = [];
(function walk(dir){
  for(const name of fs.readdirSync(dir)){
    const p = path.join(dir, name);
    const rel = path.relative(ROOT, p).replace(/\\/g,'/');
    if(rel.startsWith('.git/') || rel.startsWith('public/') || rel.includes('/node_modules/') || rel.includes('/data/harvest-runs/')) continue;
    const st = fs.statSync(p);
    if(st.isDirectory()) walk(p);
    else if(/\.(html|css)$/.test(name)) files.push(p);
  }
})(ROOT);
const small = [];
const re = /font-size\s*:\s*([^;}{]+)/gi;
for(const p of files){
  const rel = path.relative(ROOT,p).replace(/\\/g,'/');
  const txt = fs.readFileSync(p,'utf8');
  let m;
  while((m = re.exec(txt))){
    const raw = m[1].trim();
    let px = null;
    const n = parseFloat(raw);
    if(/px\b/.test(raw)) px = n;
    else if(/rem\b/.test(raw)) px = n * 16;
    else if(/em\b/.test(raw)) px = n * 16;
    if(px !== null && px < 10.5) small.push({file:rel, value:raw, px:Math.round(px*10)/10});
  }
}
const report = {
  checkedFiles: files.length,
  tinyFontDeclarationsUnder10_5px: small.length,
  examples: small.slice(0, 40)
};
fs.mkdirSync(path.join(ROOT,'scripts/audits'), {recursive:true});
fs.writeFileSync(path.join(ROOT,'scripts/audits/typography-controls-audit.json'), JSON.stringify(report,null,2));
if(failures.length){
  console.error('Typography/control verification failed:');
  for(const f of failures) console.error(' - '+f);
  process.exit(1);
}
console.log(`Typography/control verification passed: ${files.length} HTML/CSS files scanned, ${small.length} very-small declarations inventoried.`);
