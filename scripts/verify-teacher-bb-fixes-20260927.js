#!/usr/bin/env node
'use strict';
// Browser regressions for the eleven-issue follow-up. Reports record checks,
// not external-source verification or a claim of complete site certification.
const fs=require('fs'),path=require('path'),http=require('http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),checks=[];
function check(name,condition,detail){checks.push({name,passed:Boolean(condition),...(detail?{detail}: {})});if(!condition)console.error('FAIL',name,detail||'');}
(async()=>{
 const server=http.createServer((req,res)=>{
  let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  try{if(fs.statSync(file).isDirectory())file=path.join(file,'index.html');res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port;let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE||undefined,args:['--no-sandbox','--disable-dev-shm-usage']});
  const context=await browser.newContext({viewport:{width:1280,height:850}});
  await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const goto=async(query='')=>{await page.goto(origin+'/teacherresources/'+query,{waitUntil:'domcontentloaded'});await page.waitForSelector('body.finder-enhanced');};
  await goto();
  for(const q of ['telltale heart Poe','telltale haert pdf','telltale haert Poe','telltlae heart Poe PDF','tell tale heart Edgar Allan Poe PDF']){
   await page.locator('#search').fill(q);await page.locator('#search').press('Enter');
   check('Combined query: '+q,await page.locator('#result-list [data-resource-id="TR-0014"]').count()===1);
  }
  for(const q of ['Thank You Maam PDF','Thank You Maam Hughes','Thank You Mam PDF']){
   await page.locator('#search').fill(q);await page.locator('#search').press('Enter');
   check('Alias combination retains the story: '+q,(await page.locator('#result-list .entry-title').allTextContents()).includes("Thank You, M'am"));
  }
  await page.locator('#search').fill('Macbeth Poe');await page.locator('#search').press('Enter');
  check('Unrelated title and author stay excluded',await page.locator('#result-list .work-result').count()===0);
  for(const width of [320,375,768,1280]){
   await page.setViewportSize({width,height:850});await goto();
   const layout=await page.evaluate(()=>({searchBottom:document.querySelector('#search').getBoundingClientRect().bottom,browseTop:document.querySelector('.teacher-orientation').getBoundingClientRect().top,resultsHidden:document.querySelector('#search-results').hidden,overflow:document.documentElement.scrollWidth-innerWidth}));
   check('Initial navigation is reachable at '+width,layout.resultsHidden&&layout.searchBottom<850&&layout.browseTop<1600&&layout.overflow<=1,layout);
   if(width===320||width===1280)await page.screenshot({path:path.join(__dirname,`reports/teacher-bb-fixes-20260927-finder-${width}.png`),animations:'disabled'});
  }
  await goto('?format=lesson#catalog');
  await page.waitForLoadState('load');
  const landing=await page.evaluate(()=>({hash:location.hash,hidden:document.querySelector('#search-results').hidden,focus:document.activeElement.id,top:document.querySelector('#search-results').getBoundingClientRect().top}));
  check('Legacy task fragment lands on visible results',landing.hash==='#search-results'&&!landing.hidden&&landing.focus==='search-results'&&landing.top>=0&&landing.top<425,landing);
  check('Skip link targets the visible results',await page.locator('.skip-catalog').getAttribute('href')==='#search-results');
  await goto('?file=PDF');await page.locator('#more-results').click();
  check('Pagination focuses the first added result',await page.evaluate(()=>document.querySelectorAll('#result-list .work-result')[30].contains(document.activeElement)));
  check('Pagination retains existing and added results',await page.locator('#result-list .work-result').count()===60);
  await goto('?q=Poe&format=anthology&file=PDF');await page.locator('#active-filters button').first().click();
  check('Filter removal keeps focus on a remaining control',await page.evaluate(()=>document.querySelector('#active-filters').contains(document.activeElement)));
  await page.locator('#active-filters button').click();
  check('Last filter removal returns focus to search',await page.locator('#search').evaluate(e=>e===document.activeElement));
  await goto();await page.evaluate(()=>dispatchEvent(new Event('beforeprint')));
  check('Unfiltered printing includes the complete catalog',await page.locator('#result-list .entry-shell').count()===646&&await page.locator('#search-results').isVisible());
  await page.evaluate(()=>dispatchEvent(new Event('afterprint')));
  check('Printing restores the browsing view',!(await page.locator('#search-results').isVisible()));
  for(const mode of ['disabled','blocked']){
   const fallback=await browser.newContext({javaScriptEnabled:mode!=='disabled'});
   await fallback.route('**/*',r=>new URL(r.request().url()).origin!==origin||mode==='blocked'&&r.request().resourceType()==='script'?r.abort():r.continue());
   const p=await fallback.newPage();await p.goto(origin+'/teacherresources/',{waitUntil:'domcontentloaded'});
   check('Fallback hides inactive controls when scripts are '+mode,!(await p.locator('#search').isVisible())&&await p.locator('.finder-fallback').isVisible());
   check('Fallback preserves all sources when scripts are '+mode,await p.locator('#catalog .entry').count()===646);
   await fallback.close();
  }
  await page.setViewportSize({width:375,height:850});await page.goto(origin+'/polymyth/modulecanon/thank-you-maam/');
  check('Module retains 185 source records',await page.locator('details.module-record').count()===185);
  check('Module starts with an actionable five-step guide',await page.locator('.quick-start > li').count()===5);
  check('Module contents start collapsed',await page.locator('.module-contents').getAttribute('open')===null);
  check('Module introduction has no conversation-dependent authorization claim',!(await page.locator('main').innerText()).includes('The request authorizes'));
  await page.screenshot({path:path.join(__dirname,'reports/teacher-bb-fixes-20260927-module-375.png'),animations:'disabled'});
  await page.locator('.preparation-links a').first().click();
  check('Preparation link opens its source record',await page.locator('#cc-cmp001-sp-anchor-text').evaluate(e=>e.open&&e.contains(document.activeElement)));
  await page.reload();check('Module source fragment survives reload',await page.locator('#cc-cmp001-sp-anchor-text').evaluate(e=>e.open));
  check('Module has no phone overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  check('No runtime errors',errors.length===0,errors);
  const report={schema:'seminar-schools-teacher-bb-fixes-v3',status:checks.every(x=>x.passed)?'passed':'failed',browser:browser.version(),checks};
  fs.writeFileSync(path.join(__dirname,'reports/teacher-bb-fixes-20260927.json'),JSON.stringify(report,null,2)+'\n');
  console.log(`${report.status.toUpperCase()} — ${checks.filter(x=>x.passed).length}/${checks.length} search, navigation, fallback, print and module checks`);
  if(report.status!=='passed')process.exitCode=1;
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
