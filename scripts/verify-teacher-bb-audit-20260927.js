#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright'):'playwright');
const root=process.env.AUDIT_SITE_ROOT?path.resolve(process.env.AUDIT_SITE_ROOT):path.resolve(__dirname,'..'),rows=[];
const baseline=process.argv.includes('--baseline');
function check(name,value){rows.push({name,passed:Boolean(value)});console.log(value?'PASS':'FAIL',name);}
(async()=>{
 const server=require('http').createServer((req,res)=>{let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}try{if(fs.statSync(file).isDirectory())file=path.join(file,'index.html');res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port;
 let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE||undefined,args:['--no-sandbox','--disable-dev-shm-usage']});
  const context=await browser.newContext({viewport:{width:375,height:850}});
  await context.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const [url,name,expected] of [
   ['?q=IELTS&file=PDF','IELTS is retained by PDF filter',1],
   ['?q=IELTS&file=Webpage','IELTS is retained by Webpage filter',1],
   ['?q=IELTS&file=PDF%20and%20webpage','Existing composite-file URL remains compatible',1],
   ['?q=telltale%20heart%20pdf','Joined title plus PDF query finds story',1],
   ['?q=telltale%20haert','Joined title plus transposed letters finds story',1],
   ['?q=telltlae%20heart','Misspelled joined title finds story',1],
   ['?q=poe%20pdf','Author plus file-format query finds sources',null],
   ['?q=Macbeth%20Poe','Unrelated title and author are not combined',0]
  ]){await page.goto(origin+'/teacherresources/'+url,{waitUntil:'domcontentloaded'});await page.waitForTimeout(220);const n=await page.locator('#result-list .work-result').count();const requestedFile=new URL(url,origin).searchParams.get('file');let fileRetained=!requestedFile||new URL(page.url()).searchParams.get('file')===requestedFile;if(requestedFile&&requestedFile!=='PDF and webpage'){const chip=page.locator('[data-filter-type="file"][data-filter-value="'+requestedFile+'"]');fileRetained=fileRetained&&(await chip.count())===1&&await chip.getAttribute('aria-pressed')==='true';}check(name,fileRetained&&(expected===null?n>0:n===expected));}
  await page.goto(origin+'/polymyth/modulecanon/thank-you-maam/',{waitUntil:'domcontentloaded'});
  await page.locator('.module-contents > summary').click();
  const link=page.locator('.index a').first(),hash=await link.getAttribute('href');
  await link.click();await page.waitForTimeout(100);
  check('Module contents link opens its record',await page.locator(hash).evaluate(e=>e.open));
  await page.reload({waitUntil:'domcontentloaded'});
  check('Shared module fragment opens its record',await page.locator(hash).evaluate(e=>e.open));
  const openCount=await page.locator('details.module-record[open]').count();await page.evaluate(()=>dispatchEvent(new Event('beforeprint')));const printed=await page.locator('details.module-record[open]').count();await page.evaluate(()=>dispatchEvent(new Event('afterprint')));check('Module printing expands all records and restores state',printed===185&&await page.locator('details.module-record[open]').count()===openCount);
  check('Module has visible colophon',await page.locator('footer').count()===1);
  check('Module is in sitemap',fs.readFileSync(path.join(root,'sitemap.xml'),'utf8').includes('/polymyth/modulecanon/thank-you-maam/'));
  check('Canonical build invokes module generator',fs.readFileSync(path.join(root,'scripts/build-search-pages.js'),'utf8').includes("require('./build-thank-you-maam-module')"));
  check('No mobile overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  check('No runtime errors',errors.length===0);
  const report={status:rows.every(r=>r.passed)?'passed':'failed',scope:'Independent audit of combined queries, overlapping file formats, module navigation and build closure',browser:browser.version(),tests:rows,errors};
  fs.writeFileSync(path.join(__dirname,'reports/teacher-bb-audit-20260927'+(baseline?'-before':'')+'.json'),JSON.stringify(report,null,2)+'\n');
  if(!baseline)assert(rows.every(r=>r.passed),'Audit failures remain');
 }finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
