#!/usr/bin/env node
'use strict';
const fs=require('fs'); const path=require('path'); const ROOT=path.resolve(__dirname,'..');
const {isGeneratedDependencyDirectory}=require('./repository-walk-policy');
const reportPath=path.join(ROOT,'scripts','reports','asset-weight-report.json');
const budgetPath=path.join(ROOT,'scripts','reports','asset-weight-budget.json');
const release=JSON.parse(fs.readFileSync(path.join(ROOT,'RELEASE_MANIFEST.json'),'utf8'));
const failures=[];
const publicPath=path.join(ROOT,'public');
if(!fs.existsSync(publicPath)) failures.push('missing generated public deploy surface');
if(!fs.existsSync(reportPath)) failures.push('missing scripts/reports/asset-weight-report.json');
if(!fs.existsSync(budgetPath)) failures.push('missing scripts/reports/asset-weight-budget.json');
let publicFiles=[];let totalBytes=0;let knownCount=0;
function walk(d,acc=[]){ for(const e of fs.readdirSync(d,{withFileTypes:true})){ const f=path.join(d,e.name); if(e.isDirectory()&&!isGeneratedDependencyDirectory(e.name)) walk(f,acc); else if(e.isFile()) acc.push(f); } return acc; }
if(fs.existsSync(publicPath)) {
  publicFiles=walk(publicPath,[]);
  totalBytes=publicFiles.reduce((sum,file)=>sum+fs.statSync(file).size,0);
}
if(fs.existsSync(reportPath)) {
  const r=JSON.parse(fs.readFileSync(reportPath,'utf8'));
  if(r.scope!=='public') failures.push('asset report does not describe the public deploy surface');
  if(!Array.isArray(r.largestAssets) || r.largestAssets.length<10) failures.push('asset report lacks largestAssets list');
  if(r.generatedAt!==release.generated_at) failures.push('asset report release timestamp is stale');
  if(r.totalFiles!==publicFiles.length) failures.push(`asset report file count is stale: ${r.totalFiles} != ${publicFiles.length}`);
  if(r.totalBytes!==totalBytes) failures.push(`asset report byte count is stale: ${r.totalBytes} != ${totalBytes}`);
}
if(fs.existsSync(budgetPath)){
  const budget=JSON.parse(fs.readFileSync(budgetPath,'utf8'));
  if(budget.schema!=='asset-weight-budget-v1') failures.push(`unsupported asset budget schema ${budget.schema||'missing'}`);
  if(totalBytes>Number(budget.totalPublicCeilingBytes||0)) failures.push(`public deploy is ${totalBytes} bytes; ceiling ${budget.totalPublicCeilingBytes}`);
  const known=new Map((budget.knownLargeAssets||[]).map(row=>[row.path,row]));
  if(known.size!==(budget.knownLargeAssets||[]).length) failures.push('asset budget contains duplicate known-large paths');
  for(const [rel,row] of known){
    const file=path.join(publicPath,rel);
    if(!fs.existsSync(file)){ failures.push(`${rel} known-large asset is missing`); continue; }
    const size=fs.statSync(file).size;knownCount+=1;
    if(!Number.isInteger(row.baselineBytes)||!Number.isInteger(row.ceilingBytes)||row.ceilingBytes<row.baselineBytes) failures.push(`${rel} has invalid baseline/ceiling metadata`);
    if(size>row.ceilingBytes) failures.push(`${rel} is ${size} bytes; ceiling ${row.ceilingBytes}`);
  }
  for(const file of publicFiles){
    const rel=path.relative(publicPath,file).replace(/\\/g,'/');
    if(known.has(rel)||path.extname(file).toLowerCase()==='.html') continue;
    const ext=path.extname(file).toLowerCase();
    const limit=Number(budget.limitsByExtension?.[ext]||budget.defaultFileLimitBytes||0);
    const size=fs.statSync(file).size;
    if(size>limit) failures.push(`${rel} is ${size} bytes; unbudgeted ${ext||'file'} ceiling ${limit}`);
  }
}
if(failures.length){ console.error('ASSET WEIGHT CHECK FAILED'); failures.forEach(f=>console.error(' - '+f)); process.exit(1); }
console.log(`ASSET WEIGHT CHECK PASSED — ${publicFiles.length} deploy files / ${totalBytes} bytes; ${knownCount} intentional large assets have narrow ceilings and all other files meet type budgets.`);
