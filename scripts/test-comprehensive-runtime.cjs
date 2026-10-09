const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const root=require('path').resolve(__dirname,'..');const src=fs.readFileSync(root+'/netlify/functions/gemini-chat.js','utf8');
function setup(kind='ok'){
 let seq=0;const timers=new Map();let requests=[];
 const neverUntilAbort=signal=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Object.assign(new Error('aborted'),{name:'AbortError'})),{once:true}));
 const scope={exports:{},process:{env:{GEMINI_API_KEY:'test-placeholder'}},Date,AbortController,setTimeout(fn,ms){const id=++seq;timers.set(id,{fn,ms});return id},clearTimeout(id){timers.delete(id)},fetch:async(url,opts)=>{requests.push(url);if(url.includes('bookwormburrows.txt'))return {ok:true,text:()=>kind==='corpus-hang'?neverUntilAbort(opts.signal):Promise.resolve('source')};return {ok:kind!=='error-hang',json:()=>kind==='json-hang'?neverUntilAbort(opts.signal):Promise.resolve({candidates:[{content:{parts:[{text:'ok'}]}}]}),text:()=>kind==='error-hang'?neverUntilAbort(opts.signal):Promise.resolve('err')};}};
 vm.runInNewContext(src,scope);return {timers,scope,requests,invoke(body=JSON.stringify({mode:'reaction',prompt:'fixture'})){return scope.exports.handler({httpMethod:'POST',headers:{'x-nf-client-connection-ip':'fixture'},body})}};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
 for(const body of ['null','[]','"str"','1']){const h=setup(),r=await h.invoke(body);assert.equal(r.statusCode,400);assert.equal(h.requests.length,0);}
 console.log('PASS malformed JSON value shapes return 400 before network');
 let h=setup(),r=await h.invoke();assert.equal(JSON.parse(r.body).text,'ok');assert.equal(h.timers.size,0);console.log('PASS success clears every timeout');
 for(const kind of ['json-hang','error-hang']){h=setup(kind);const p=h.invoke();await flush();let pending=[...h.timers.values()];assert.deepEqual(pending.map(r=>r.ms),[5000]);pending[0].fn();r=await p;assert.equal(JSON.parse(r.body).reason,'timeout');assert.equal(h.timers.size,0);console.log('PASS '+kind+' retains 5-second timeout and returns timeout fallback');}
 h=setup('corpus-hang');let p=h.invoke();await flush();let pending=[...h.timers.values()];assert.deepEqual(pending.map(r=>r.ms),[2000]);pending[0].fn();r=await p;assert.equal(JSON.parse(r.body).text,'ok');assert.equal(h.timers.size,0);console.log('PASS corpus body timeout falls back and clears timer');
 const intake=fs.readFileSync(root+'/leizu/intake/index.html','utf8');const from=intake.indexOf("  var storedLanguage = '';");const to=intake.indexOf("  var source = String(params.get('source')",from);assert.ok(from>0&&to>from);const snippet=intake.slice(from,to);
 for(const search of ['', '?lang=fr']){const scope={params:new URLSearchParams(search),languageInput:{value:''},localStorage:{getItem(){throw new Error('SecurityError')},setItem(){throw new Error('SecurityError')}}};vm.runInNewContext(snippet,scope);assert.equal(scope.languageInput.value,search?'fr':'en');}console.log('PASS blocked storage preserves English default and explicit French choice');
})();
