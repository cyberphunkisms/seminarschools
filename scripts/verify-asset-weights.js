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
  const configuredKnown=new Map((budget.knownLargeAssets||[]).map(row=>[row.path,row]));
  if(configuredKnown.size!==(budget.knownLargeAssets||[]).length) failures.push('asset budget contains duplicate known-large paths');
  const retiredOrPrivate=new Set(['js/polymythcal-revamp.js','polymythseminars/events.json']);
  const currentContracts=new Map([
    ['polymyth/methodologylist.txt',{baselineBytes:4188931,ceilingBytes:4230000,reason:'canonical Methodologylist text mirror'}],
    ['polymyth/concordance/concordance-index.json',{baselineBytes:11007984,ceilingBytes:11100000,reason:'complete exact public concordance for the current methodology corpus'}],
    ['polymyth/alwaysalready/img/2026-09-06_youtube_matt-leblanc-joey-actor-as-vessel.png',{baselineBytes:875659,ceilingBytes:900000,reason:'user-supplied full-resolution Always Already evidence capture'}],
    ['polymyth/methodologylist/mephistodata-rule-hardening-addendum.js',{baselineBytes:131907,ceilingBytes:134000,reason:'canonical Mephistodata rule-hardening addendum'}],
    ['js/polymythcal-discovery.js',{baselineBytes:91937,ceilingBytes:93000,reason:'current bilingual Discovery v2 controller'}],
    ['css/polymythcal-discovery.css',{baselineBytes:22961,ceilingBytes:23000,reason:'current Discovery v2 presentation'}],
    ['polymythseminars/browse.json',{baselineBytes:2954297,ceilingBytes:3000000,reason:'current compact public Polymythcal browse projection'}],
    ['polymythseminars/watchlist.json',{baselineBytes:213174,ceilingBytes:220000,reason:'current compact public monitoring projection'}],
  ]);
  const known=new Map(
    [...configuredKnown].filter(([rel])=>!retiredOrPrivate.has(rel)),
  );
  for(const [rel,contract] of currentContracts) known.set(rel,{path:rel,...contract});
  for(const [rel,contract] of currentContracts){
    const row=known.get(rel); const file=path.join(publicPath,rel);
    if(row.ceilingBytes!==contract.ceilingBytes) failures.push(`${rel} ceiling must remain the current narrow ${contract.ceilingBytes} bytes`);
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
