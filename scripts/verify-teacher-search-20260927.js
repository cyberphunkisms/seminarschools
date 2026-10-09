#!/usr/bin/env node
'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright'):'playwright');
const E=require('../teacherresources/search-engine'),D=require('../teacherresources/resources-data.json');
const entries=D.groups.flatMap(g=>g.categories.flatMap(c=>c.entries));
assert.equal(entries.length,646);assert.equal(new Set(entries.map(e=>e.id)).size,646);
const tell=entries.find(e=>e.title==='The Tell-Tale Heart');
for(const q of ['telltale heart','Tell-Tale Heart','tell tale heart','THE TELL—TALE HEART'])assert(E.match(tell,q).score,q);
assert(!E.match({title:'Macbeth',author:'Shakespeare'},'Poe').score);assert(E.materialMatches(tell.format,'anthology'));
const reportDir=path.join(__dirname,'reports/teacher-search-20260927');fs.mkdirSync(reportDir,{recursive:true});
const results=[];function pass(n){results.push({test:n,status:'passed'});console.log('PASS',n);}
(async()=>{
 const root=path.resolve(__dirname,'..');
 const server=require('http').createServer((req,res)=>{let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}try{if(fs.statSync(file).isDirectory())file=path.join(file,'index.html');res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch(e){res.writeHead(404).end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port;
 try {
 const browser=await chromium.launch({headless:true, executablePath:process.env.CHROME_EXECUTABLE || undefined,args:['--no-sandbox','--disable-dev-shm-usage']}),ctx=await browser.newContext({viewport:{width:1280,height:850}});
 await ctx.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message+' at '+page.url()));
 await page.goto(origin+'/teacherresources/',{waitUntil:'domcontentloaded'});await page.waitForSelector('body.finder-enhanced');
 async function search(q){await page.locator('#search').fill(q);await page.waitForTimeout(180);}
 async function count(n){await page.waitForFunction(expected=>document.querySelectorAll('#result-list .work-result').length===expected,n);assert.equal(await page.locator('#result-list .work-result').count(),n);}
 await count(30);assert(!(await page.locator('#search-results').isVisible()));pass('Unfiltered page prioritizes browsing over the initial ranked list');
 await search('telltale heart');await count(1);pass('Joined title');
 await page.locator('[data-preset-format="anthology"]').click();await count(1);pass('Texts retains story');
 await page.locator('[data-preset-format="practice"]').click();await count(1);pass('Text and practice classifications');
 await page.locator('#clear').click();await search('Poe');let txt=await page.locator('#result-list').innerText();assert(!txt.includes('Macbeth'));assert(!txt.includes('Anne of Green Gables'));assert(txt.includes('Edgar Allan Poe'));pass('Author precision');
 assert.equal(await page.locator('.work-result').filter({hasText:'The Cask of Amontillado'}).count(),1);assert(await page.locator('.resource-version').count()>0);pass('Edition grouping');
 await search('IELTS');await count(1);pass('IELTS indexed');
 await page.locator('#search').press('Enter');assert(page.url().includes('?q=IELTS'));assert(await page.locator('#search-results').evaluate(el=>el===document.activeElement));pass('Enter shows results without navigation');
 await page.locator('#clear').click();await search('tell tale heart');await page.locator('[data-preset-grades="K,1,2,3,4,5,6"]').click();await count(0);assert((await page.locator('#empty').innerText()).includes('excluded by'));await page.getByRole('button',{name:'Clear filters, keep search',exact:true}).click();assert.equal(await page.locator('#search').inputValue(),'tell tale heart');pass('Filter recovery retains query');
 await page.locator('#result-list .entry-detail').click();await page.waitForLoadState('domcontentloaded');assert((await page.locator('.search-return').getAttribute('href')).includes('q=tell+tale+heart'));await page.locator('.search-return').click();await page.waitForSelector('#result-list .work-result');assert.equal(await page.locator('#search').inputValue(),'tell tale heart');pass('Return to search');
 for(const width of [320,375,768,1280]){await page.setViewportSize({width,height:850});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'overflow '+width);pass('Layout '+width);}
 await page.goto(origin+'/teacherresources/?q=IELTS&grade=9');await page.waitForSelector('#empty:not([hidden])');await count(0);await page.locator('#filter-toggle').click();await page.locator('#include-unclassified').check();await count(1);assert((await page.locator('#result-list').innerText()).includes('suitability has not been established'));pass('Missing metadata is opt-in and labelled');
 await page.locator('#clear').click();await search('Thank You Mam');assert(await page.locator('#result-list .work-result').count()>0);pass('Thank You Mam title alias');
 await search('未来课本');await count(0);pass('Non-Latin query does not return the entire catalog');
 await page.goto(origin+'/teacherresources/?file=PDF');await page.waitForSelector('#result-list .work-result');await page.locator('#more-results').click();await count(60);pass('Pagination expands without dropping source records');
 await page.locator('#clear').click();await page.evaluate(()=>dispatchEvent(new Event('beforeprint')));assert.equal(await page.locator('#result-list .entry-shell').count(),646);await page.evaluate(()=>dispatchEvent(new Event('afterprint')));await count(30);pass('Print includes all matching sources and restores pagination');
 await search('tell tale heart');
 if(await page.locator('#filter-toggle').getAttribute('aria-expanded')==='true')await page.locator('#filter-toggle').click();
 const noJs=await browser.newContext({javaScriptEnabled:false});const staticPage=await noJs.newPage();await staticPage.goto(origin+'/teacherresources/');assert.equal(await staticPage.locator('#catalog .entry').count(),646);await staticPage.emulateMedia({media:'print'});assert(await staticPage.locator('#catalog').isVisible());await noJs.close();pass('No-JavaScript catalog and print remain available');
 await page.setViewportSize({width:375,height:850});await page.locator('#search').press('Enter');await page.screenshot({path:path.join(reportDir,'mobile.png')});
 await page.setViewportSize({width:1280,height:850});await page.evaluate(()=>window.scrollTo(0,document.querySelector('#search').getBoundingClientRect().top+scrollY-25));await page.screenshot({path:path.join(reportDir,'desktop.png')});
 await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('#search-results').evaluate(el=>getComputedStyle(el).scrollBehavior),'auto');pass('Reduced motion');
 await page.emulateMedia({media:'print'});assert(!(await page.locator('#catalog').isVisible()));pass('Print excludes duplicate catalog');
 await page.emulateMedia({media:'screen'});
 await page.goto(origin+'/polymyth/modulecanon/');assert((await page.locator('body').innerText()).includes('Thank You, Ma’am'));pass('MC entry page loads');
 await page.goto(origin+'/polymyth/modulecanon/thank-you-maam/');assert.equal(await page.locator('details.module-record').count(),185);await page.locator('details.module-record summary').first().click();assert(await page.locator('details.module-record').first().getAttribute('open')!==null);pass('Readable module dossier opens preserved source records');
 await page.goto(origin+'/bb/');assert((await page.locator('.how-play').innerText()).includes('three fictional players'));pass('Public how-to-play guidance');
 assert.deepEqual(errors,[]);pass('No runtime errors');
 await browser.close();fs.writeFileSync(path.join(__dirname,'reports/teacher-search-20260927.json'),JSON.stringify({status:'passed',resource_count:646,browser:await browser.version(),tests:results},null,2)+'\n');
 }finally{server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
