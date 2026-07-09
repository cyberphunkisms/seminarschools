#!/usr/bin/env node
'use strict';
const fs=require('fs'); const path=require('path');
const ROOT=path.resolve(__dirname,'..');
function configuredPublishDir(){ const fp=path.join(ROOT,'netlify.toml'); if(!fs.existsSync(fp)) return '.'; const m=fs.readFileSync(fp,'utf8').match(/\bpublish\s*=\s*"([^"]+)"/); return m?m[1]:'.'; }
const SITE_ROOT=path.resolve(ROOT, configuredPublishDir());
const budgetPath=path.join(ROOT,'scripts','reports','page-size-budget.json');
const failures=[]; const warnings=[];
function walk(dir,acc=[]){ for(const e of fs.readdirSync(dir,{withFileTypes:true})){ if(['.git','node_modules','.netlify','public'].includes(e.name)) continue; const full=path.join(dir,e.name); if(e.isDirectory()) walk(full,acc); else if(e.isFile() && e.name.endsWith('.html')) acc.push(full); } return acc; }
if(!fs.existsSync(budgetPath)){ console.error('PAGE SIZE BUDGET FAILED — missing scripts/reports/page-size-budget.json'); process.exit(1); }
const budget=JSON.parse(fs.readFileSync(budgetPath,'utf8'));
const byPath=new Map((budget.budgetedLargePages||[]).map(x=>[x.path,x]));
for(const f of walk(SITE_ROOT)){
  const rel=path.relative(SITE_ROOT,f).replace(/\\/g,'/'); const size=fs.statSync(f).size;
  const row=byPath.get(rel);
  if(row){ if(size > row.ceilingBytes) failures.push(`${rel} ${size} exceeds budget ceiling ${row.ceilingBytes}`); }
  else if(size > (budget.unbudgetedLimitBytes || 500000)) failures.push(`${rel} is ${size} bytes and lacks a page-size budget entry`);
  else if(size > 350000) warnings.push(`${rel} is ${size} bytes`);
}
if(failures.length){ console.error('PAGE SIZE BUDGET FAILED'); failures.forEach(f=>console.error(' - '+f)); process.exit(1); }
console.log(`PAGE SIZE BUDGET PASSED — ${(budget.budgetedLargePages||[]).length} known-heavy pages budgeted; no unbudgeted HTML over ${budget.unbudgetedLimitBytes||500000} bytes.`);
if(warnings.length) console.log(`PAGE SIZE BUDGET WARNINGS — ${warnings.length} medium-heavy pages tracked below hard budget.`);
