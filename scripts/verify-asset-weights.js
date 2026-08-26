#!/usr/bin/env node
'use strict';
const fs=require('fs'); const path=require('path'); const crypto=require('crypto'); const ROOT=path.resolve(__dirname,'..');
const {isGeneratedDependencyDirectory}=require('./repository-walk-policy');
const reportPath=path.join(ROOT,'scripts','reports','asset-weight-report.json');
const budgetPath=path.join(ROOT,'scripts','reports','asset-weight-budget.json');
const release=JSON.parse(fs.readFileSync(path.join(ROOT,'RELEASE_MANIFEST.json'),'utf8'));
const failures=[];
const publicPath=path.join(ROOT,'public');
if(!fs.existsSync(publicPath)) failures.push('missing generated public deploy surface');
if(fs.existsSync(path.join(publicPath,'polymythseminars','events.json'))) failures.push('private polymythseminars/events.json is present in the public deploy surface');
if(!fs.existsSync(reportPath)) failures.push('missing scripts/reports/asset-weight-report.json');
if(!fs.existsSync(budgetPath)) failures.push('missing scripts/reports/asset-weight-budget.json');
let publicFiles=[];let totalBytes=0;let knownCount=0;
let publicTreeSha256='';
function walk(d,acc=[]){ for(const e of fs.readdirSync(d,{withFileTypes:true})){ const f=path.join(d,e.name); if(e.isDirectory()&&!isGeneratedDependencyDirectory(e.name)) walk(f,acc); else if(e.isFile()) acc.push(f); } return acc; }
if(fs.existsSync(publicPath)) {
  publicFiles=walk(publicPath,[]);
  totalBytes=publicFiles.reduce((sum,file)=>sum+fs.statSync(file).size,0);
  publicTreeSha256=crypto.createHash('sha256').update(publicFiles.map(file=>({
    path:path.relative(publicPath,file).replace(/\\/g,'/'),
    size:fs.statSync(file).size,
    sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
  })).sort((a,b)=>a.path.localeCompare(b.path)).map(row=>`${row.path}\0${row.size}\0${row.sha256}\n`).join('')).digest('hex');
}
if(fs.existsSync(reportPath)) {
  const r=JSON.parse(fs.readFileSync(reportPath,'utf8'));
  if(r.scope!=='public') failures.push('asset report does not describe the public deploy surface');
  if(!Array.isArray(r.largestAssets) || r.largestAssets.length<10) failures.push('asset report lacks largestAssets list');
  if(r.generatedAt!==release.generated_at) failures.push('asset report release timestamp is stale');
  if(r.totalFiles!==publicFiles.length) failures.push(`asset report file count is stale: ${r.totalFiles} != ${publicFiles.length}`);
  if(r.totalBytes!==totalBytes) failures.push(`asset report byte count is stale: ${r.totalBytes} != ${totalBytes}`);
  if(r.publicTreeSha256!==publicTreeSha256) failures.push(`asset report public-tree digest is stale: ${r.publicTreeSha256||'missing'} != ${publicTreeSha256}`);
}
if(fs.existsSync(budgetPath)){
  const budget=JSON.parse(fs.readFileSync(budgetPath,'utf8'));
  if(budget.schema!=='asset-weight-budget-v1') failures.push(`unsupported asset budget schema ${budget.schema||'missing'}`);
  if(totalBytes>Number(budget.totalPublicCeilingBytes||0)) failures.push(`public deploy is ${totalBytes} bytes; ceiling ${budget.totalPublicCeilingBytes}`);
  const known=new Map((budget.knownLargeAssets||[]).map(row=>[row.path,row]));
  if(known.size!==(budget.knownLargeAssets||[]).length) failures.push('asset budget contains duplicate known-large paths');
  const currentContractCeilings=new Map([
    ['polymyth/methodologylist.txt',4075000],
    ['js/polymythcal-revamp.js',134000],
    ['js/polymythcal-discovery.js',90000],
    ['css/polymythcal-discovery.css',26000],
    ['polymythseminars/browse.json',2600000],
    ['polymythseminars/watchlist.json',210000],
  ]);
  for(const [rel,ceiling] of currentContractCeilings){
    const row=known.get(rel); const file=path.join(publicPath,rel);
    if(!row){ failures.push(`${rel} lacks its narrow current-release budget`); continue; }
    if(row.ceilingBytes!==ceiling) failures.push(`${rel} ceiling must remain the current narrow ${ceiling} bytes`);
    if(fs.existsSync(file)&&row.baselineBytes!==fs.statSync(file).size) failures.push(`${rel} baseline is stale: ${row.baselineBytes} != ${fs.statSync(file).size}`);
  }
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

