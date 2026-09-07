#!/usr/bin/env node
'use strict';
const fs=require('fs'); const path=require('path');
const {isGeneratedDependencyDirectory}=require('./repository-walk-policy');
const ROOT=path.resolve(__dirname,'..');
function configuredPublishDir(){ const fp=path.join(ROOT,'netlify.toml'); if(!fs.existsSync(fp)) return '.'; const m=fs.readFileSync(fp,'utf8').match(/\bpublish\s*=\s*"([^"]+)"/); return m?m[1]:'.'; }
const SITE_ROOT=path.resolve(ROOT, configuredPublishDir());
const budgetPath=path.join(ROOT,'scripts','reports','page-size-budget.json');
const failures=[]; const warnings=[];
function walk(dir,acc=[]){ for(const e of fs.readdirSync(dir,{withFileTypes:true})){ if(['.git','.netlify','public'].includes(e.name)||isGeneratedDependencyDirectory(e.name)) continue; const full=path.join(dir,e.name); if(e.isDirectory()) walk(full,acc); else if(e.isFile() && e.name.endsWith('.html')) acc.push(full); } return acc; }
if(!fs.existsSync(budgetPath)){ console.error('PAGE SIZE BUDGET FAILED — missing scripts/reports/page-size-budget.json'); process.exit(1); }
const budget=JSON.parse(fs.readFileSync(budgetPath,'utf8'));
if(budget.schema!=='page-size-budget-v3') failures.push(`unsupported page budget schema ${budget.schema||'missing'}`);
const currentReleaseBudgets=new Map([
  ['polymyth/methodologylist/index.html',{baselineBytes:4223608,ceilingBytes:4250000}],
  ['polymyth/methodologylist/methodology/index.html',{baselineBytes:2016237,ceilingBytes:2050000}],
  ['polymyth/methodologylist/coreplus/index.html',{baselineBytes:385357,ceilingBytes:395000}],
]);
const byPath=new Map((budget.budgetedLargePages||[]).map(row=>[
  row.path,
  currentReleaseBudgets.has(row.path)?{...row,...currentReleaseBudgets.get(row.path)}:row,
]));
const discoveryShells=[
  'polymythseminars/index.html','polymythseminars/fr/index.html',
  'polymythseminars/research/index.html','polymythseminars/fr/research/index.html',
  'polymythseminars/monitoring/index.html','polymythseminars/fr/monitoring/index.html',
];
const discoveryShellCeilingBytes=32000;
if(byPath.size!==(budget.budgetedLargePages||[]).length) failures.push('page-size budget contains duplicate paths');
for(const row of byPath.values()){
  const file=path.join(SITE_ROOT,row.path);
  if(!fs.existsSync(file)){ failures.push(`${row.path} budget entry has no deployed file`); continue; }
  const size=fs.statSync(file).size;
  if(!Number.isInteger(row.baselineBytes)||!Number.isInteger(row.ceilingBytes)||row.baselineBytes<=0||row.ceilingBytes<row.baselineBytes) failures.push(`${row.path} has an invalid baseline/ceiling`);
  if(currentReleaseBudgets.has(row.path)&&size!==row.baselineBytes) failures.push(`${row.path} current-release baseline is stale: ${row.baselineBytes} != ${size}`);
  if(size<=(budget.unbudgetedLimitBytes||350000)) failures.push(`${row.path} is now ${size} bytes and no longer needs a large-page exception`);
}
for(const f of walk(SITE_ROOT)){
  const rel=path.relative(SITE_ROOT,f).replace(/\\/g,'/'); const size=fs.statSync(f).size;
  const row=byPath.get(rel);
  if(row){ if(size > row.ceilingBytes) failures.push(`${rel} ${size} exceeds budget ceiling ${row.ceilingBytes}`); }
  else if(size > (budget.unbudgetedLimitBytes || 350000)) failures.push(`${rel} is ${size} bytes and lacks a page-size budget entry`);
  else if(size > (budget.warningLimitBytes || 250000)) warnings.push(`${rel} is ${size} bytes`);
}
for(const rel of discoveryShells){
  const file=path.join(SITE_ROOT,rel);
  if(!fs.existsSync(file)){ failures.push(`${rel} discovery shell is missing`); continue; }
  const html=fs.readFileSync(file,'utf8'); const size=fs.statSync(file).size;
  if(size>discoveryShellCeilingBytes) failures.push(`${rel} is ${size} bytes; discovery shell ceiling ${discoveryShellCeilingBytes}`);
  if(html.includes('id="events-fallback"')||html.includes('id="eventsContainer"')) failures.push(`${rel} embeds a legacy full-corpus fallback`);
}
if(failures.length){ console.error('PAGE SIZE BUDGET FAILED'); failures.forEach(f=>console.error(' - '+f)); process.exit(1); }
console.log(`PAGE SIZE BUDGET PASSED — ${(budget.budgetedLargePages||[]).length} current heavy pages budgeted; six Discovery v2 shells stay below ${discoveryShellCeilingBytes} bytes; no stale exception and no unbudgeted HTML over ${budget.unbudgetedLimitBytes||350000} bytes.`);
if(warnings.length) console.log(`PAGE SIZE BUDGET WARNINGS — ${warnings.length} medium-heavy pages tracked below hard budget.`);
