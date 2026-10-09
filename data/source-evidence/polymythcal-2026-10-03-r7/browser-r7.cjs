const fs=require('node:fs'), path=require('node:path'), http=require('node:http');
const B='/workspace/scratch/cc6502ebeac7', R=B+'/r7-release';
const {chromium}=require(R+'/node_modules/playwright');
const mime={'.html':'text/html','.js':'application/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png'};
const server=http.createServer((req,res)=>{let rel=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(rel.endsWith('/'))rel+='index.html';const f=path.resolve(R+'/public','.'+rel);if(!f.startsWith(R+'/public/')||!fs.existsSync(f)){res.writeHead(404);return res.end('Not found');}res.writeHead(200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res);});
let assertions=0;const errors=[],rows=[];let browser;
function check(ok,msg){assertions++;if(!ok)throw Error(msg)}
(async()=>{
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const base='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage']});
 for(const lang of ['en','fr'])for(const width of [320,390,1280]){
  const c=await browser.newContext({viewport:{width,height:900},locale:lang==='fr'?'fr-CA':'en-CA',timezoneId:'America/Toronto'});
  await c.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.fulfill({status:204,body:''}));
  const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));
  await p.clock.setFixedTime(new Date('2026-10-03T16:00:00Z'));
  const prefix='/polymythseminars/'+(lang==='fr'?'fr/':'');
  async function go(query=''){await p.goto(base+prefix+query,{waitUntil:'networkidle'});await p.waitForFunction(()=>document.querySelector('.pmd-shell')?.dataset.savedSearchLabel);}
  await go('?formats=online&what=event%3Atalks&date=30d');
  const series=p.locator('[data-event-id="mcgill-mcll-fall-2026-lectures"]');
  check(await series.count()===1,`${lang}/${width}: filtered McGill parent identity`);
  check(/McGill|MCLL/.test(await series.locator('h3').innerText()),'series heading names parent');
  check((await series.locator('h3 a').getAttribute('href')).includes('/mcgill-mcll-fall-2026-lectures/'),'series details target parent');
  await series.locator('.pmd-series-occurrences summary').click();
  check((await series.locator('.pmd-series-occurrences').innerText()).includes('The Myth of Human Supremacy'),'matched session retained');
  check((await series.locator('.pmd-series-occurrences li').count())===3,'only three matching sessions included');
  await series.locator('.save-event').click();
  check(await series.locator('.save-event').getAttribute('aria-pressed')==='true','save series works');
  await p.locator('.pmd-tools summary').click();
  const saveLabel=lang==='fr'?'Enregistrer la recherche':'Save search';
  await p.getByRole('button',{name:saveLabel,exact:true}).click();
  await p.locator('#pmSavedToggle').click();
  check((await p.locator('.pm-saved-meta').innerText()).length>15,'saved series retains date and place');
  check((await p.locator('.pm-saved-list a').getAttribute('href')).includes('/mcgill-mcll-fall-2026-lectures/'),'saved series identity stable');
  await go('?places=toronto-gta&date=7d');
  await p.locator('.pmd-tools summary').click();
  await p.getByRole('button',{name:saveLabel,exact:true}).click();
  await p.locator('#pmSavedToggle').click();
  const labels=await p.locator('.pm-search-list a').allTextContents();
  check(labels.length===2&&new Set(labels).size===2,'filter-only saved searches have distinct names');
  check(labels.every(x=>!x.includes('Seminar Schools')),'saved searches do not use generic document title');
  await p.reload({waitUntil:'networkidle'});await p.waitForFunction(()=>document.querySelector('.pmd-shell')?.dataset.savedSearchLabel);
  await p.locator('.pmd-tools summary').click();await p.locator('#pmSavedToggle').click();
  check(await p.locator('.pm-search-list a').count()===2,'saved searches survive reload');
  check(await p.locator('.pm-saved-meta').count()===1,'saved event date survives reload');
  await p.locator('.pm-saved-list .saved-remove').click();
  check(await p.locator('.pm-saved-row').count()===0,'remove saved event works');
  await go('?q=philosophy&places=toronto-gta&date=30d');
  const practical=p.locator('#pmdList .pmd-series-card').filter({hasText:'Practical Philosophy Club'});
  check(await practical.count()===1&&await practical.isVisible(),'upcoming practical philosophy series visible with relevance sort');
  check(!(await practical.evaluate(el=>Boolean(el.closest('.pmd-ongoing')))),'future sessions not collapsed as ongoing');
  await practical.locator('summary').click();
  check((await practical.locator('ol').innerText()).includes('2026'),'matching sessions accessible');
  const href=await practical.locator('h3 a').getAttribute('href');
  await p.goto(base+href,{waitUntil:'networkidle'});
  const back=await p.locator('[data-calendar-return]').getAttribute('href');
  check(back.includes('q=philosophy')&&back.includes('toronto-gta'),'details preserve return filters');
  await go('?q=people%3A%22Timothy+Snyder%22&date=all');
  check((await p.locator('#pmdList').innerText()).includes('Snyder'),'existing people search indexes verified participant');
  await go('?q=cupe&audiences=public&date=all');
  check(!/CUPE Ontario/.test(await p.locator('#pmdList').innerText()),'restricted union events excluded from public audience filter');
  await go('?formats=online&what=event%3Atalks&date=30d&view=calendar');
  check(await p.locator('#pmdCalendar').isVisible(),'calendar view opens');
  check(!(await p.locator('#pmdCalendar').innerText()).includes('NaN'),'calendar dates valid');
  await go();
  const layout=await p.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,firstEvent:[...document.querySelectorAll('#pmdList article')].find(e=>!e.closest('details:not([open])'))?.getBoundingClientRect().top,nav:[...document.querySelectorAll('.pmd-context-nav a')].map(a=>({text:a.textContent,x:a.getBoundingClientRect().x,right:a.getBoundingClientRect().right}))}));
  check(!layout.overflow,`${lang}/${width}: no horizontal overflow`);
  check(layout.nav.every(a=>a.x>=0&&a.right<=width+1),'all existing context navigation remains onscreen');
  rows.push({lang,width,...layout});
  if(lang==='en'&&[390,1280].includes(width)){await p.screenshot({path:B+`/r7-list-${width}.png`,fullPage:true});await p.screenshot({path:B+`/r7-viewport-${width}.png`});}
  for(const id of ['3018f2437e1f','nuit-blanche-toronto-2026-20th-anniversary-2026-10-03','utoronto-uls-tba-2027-02-05']){
   await p.goto(base+prefix+'events/'+id+'/',{waitUntil:'networkidle'});
   const facts=await p.locator('.pm-event-detail').innerText();
   if(id.startsWith('utoronto')){check(facts.includes('Kim Echlin')&&facts.includes('2027-02-04'),'corrected lecture title and day');check(!facts.includes('Friday'),'obsolete date conflict removed');}
   else check(facts.includes('19:00')&&facts.includes('07:00')&&facts.includes('Toronto'),'Nuit Blanche precise local interval and city');
   check(await p.locator('.pm-event-action.primary').count()===1,'verified destination exposed');
   check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'detail no horizontal overflow');
  }
  await c.close();
 }
 check(errors.length===0,'no browser runtime exceptions: '+errors.join(';'));
 const result={status:'passed',assertions,browser:browser.version(),rows,errors};fs.writeFileSync(B+'/r7-browser-results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();server.close()});
