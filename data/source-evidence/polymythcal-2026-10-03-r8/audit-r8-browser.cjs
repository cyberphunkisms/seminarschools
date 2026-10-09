const fs=require('fs'),path=require('path'),http=require('http');
const B='/workspace/scratch/cc6502ebeac7',R=B+'/r8-release',tag=process.argv[2]||'before';
const P=R+(process.env.AUDIT_SOURCE?'':'/public');
const {chromium}=require(R+'/node_modules/playwright');
const mime={'.html':'text/html','.js':'application/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{let rel=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(rel.endsWith('/'))rel+='index.html';const f=path.resolve(P,'.'+rel);if(!f.startsWith(P+'/')||!fs.existsSync(f)){res.writeHead(404);return res.end()};res.writeHead(200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res)});
let browser;const results=[];
(async()=>{
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const base='http://127.0.0.1:'+server.address().port;
browser=await chromium.launch({executablePath:B+'/r6-browsers/chromium_headless_shell-1179/chrome-linux/headless_shell',args:['--no-sandbox','--disable-dev-shm-usage']});
for(const lang of ['en','fr'])for(const width of [320,390,1280]){
 const c=await browser.newContext({viewport:{width,height:900},locale:lang==='fr'?'fr-CA':'en-CA',timezoneId:'America/Toronto'});
 await c.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.fulfill({status:204,body:''}));
 await c.addInitScript(()=>{window.audit={formats:0,longtasks:[]};const D=Intl.DateTimeFormat;Intl.DateTimeFormat=new Proxy(D,{construct(t,a){window.audit.formats++;return Reflect.construct(t,a)}});new PerformanceObserver(list=>window.audit.longtasks.push(...list.getEntries().map(e=>e.duration))).observe({type:'longtask',buffered:true});});
 const p=await c.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.clock.setFixedTime(new Date('2026-10-03T16:00:00Z'));
 await p.goto(base+'/polymythseminars/'+(lang==='fr'?'fr/':''),{waitUntil:'networkidle'});await p.waitForFunction(()=>document.querySelector('.pmd-shell')?.dataset.savedSearchLabel);
 const layout=await p.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,firstEvent:[...document.querySelectorAll('#pmdList article')].find(e=>!e.closest('details:not([open])'))?.getBoundingClientRect().top,sections:[...document.querySelector('.pmd-shell').children].slice(0,12).map(e=>({name:e.className,top:e.getBoundingClientRect().top,height:e.getBoundingClientRect().height})),audit:window.audit}));
 if(lang==='en'&&[390,1280].includes(width))await p.screenshot({path:B+`/r8-${tag}-${width}.png`,fullPage:false});
 const queries=[];
 for(const q of ['philosophy','toronto lecture','people:"Timothy Snyder"','zzzxxyy']){
 const r=await p.evaluate(q=>new Promise(resolve=>{window.audit.formats=0;const t=performance.now();document.addEventListener('polymythcal:results',()=>resolve({ms:performance.now()-t,formats:window.audit.formats,count:document.querySelector('#pmdResultsCount').textContent,titles:[...document.querySelectorAll('#pmdList h3 a')].slice(0,5).map(x=>x.textContent)}),{once:true});let e=document.querySelector('#pmdSearch');e.value=q;e.dispatchEvent(new Event('input',{bubbles:true}));}),q);queries.push({q,...r});
 }
 results.push({lang,width,...layout,queries,errors});await c.close();
}
fs.writeFileSync(B+`/r8-${tag}-browser-audit.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results.map(({lang,width,firstEvent,overflow,audit,queries,errors})=>({lang,width,firstEvent,overflow,initialFormats:audit.formats,longestTask:Math.max(...audit.longtasks),queries,errors}))));
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();server.close()});
