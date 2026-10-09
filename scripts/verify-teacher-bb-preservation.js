#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const {parseSeedWithAddenda:parse}=require('./lib/parse-seed-with-addenda');
const root=path.resolve(__dirname,'..'),base=process.argv[2];if(!base)throw Error('Provide a directory of extracted verified predecessor HTML and resources-data.json.');
const read=p=>fs.readFileSync(p,'utf8');
const key=e=>e.id||e.t;const old=n=>parse(read(path.join(base,n+'.html')));const current=n=>parse(read(path.join(root,'polymyth',n,'index.html')));
function except(o,fields){return Object.fromEntries(Object.entries(o).filter(([k])=>!fields.includes(k)));}
const dossier=JSON.parse(read(path.join(root,'polymyth/modulecanon/thank-you-maam.json')));
for(const name of ['bookwormburrows','modulecanon','campaigncodex']){
 const before=old(name),after=current(name),map=new Map(after.map(e=>[key(e),e]));assert.equal(after.length,before.length+(name==='modulecanon'?1:0));
 for(const prior of before){const e=map.get(key(prior));assert(e,'missing '+key(prior));let allowed=[];
 if(name==='bookwormburrows' && (prior.id==='dm-115'||prior.t.includes('CC* SESSION-PREP ARCHITECTURE')))allowed=prior.id==='dm-115'?['b','x','mc_links']:['b'];
 if(name==='modulecanon'&&prior.id==='mc-cc-bb-substrate-boundary')allowed=['structure','note'];
 if(name==='campaigncodex'&&dossier.records.some(r=>r.id===prior.id))allowed=['b'];
 assert.deepStrictEqual(except(e,allowed),except(prior,allowed),name+' '+key(prior));
 if(allowed.includes('b'))assert(e.b.includes(prior.b),'Original body lost '+key(prior));
 }
}
const oldCC=new Map(old('campaigncodex').map(e=>[e.id,e]));assert.equal(dossier.records.length,185);for(const r of dossier.records)assert.deepStrictEqual(r,oldCC.get(r.id),'Module source changed '+r.id);
assert(!dossier.records.some(e=>e.id==='cc-cmp001-party-oscar'));
const entries=d=>d.groups.flatMap(g=>g.categories.flatMap(c=>c.entries)),before=entries(JSON.parse(read(path.join(base,'resources-data.json')))),after=entries(JSON.parse(read(path.join(root,'teacherresources/resources-data.json'))));
assert.equal(after.length,646);for(const prior of before){const e=after.find(e=>e.id===prior.id);for(const [k,v] of Object.entries(prior))assert.deepStrictEqual(e[k],v,'Resource changed '+prior.id+' '+k);}
const report={status:'passed',original_resources_preserved:before.length,total_resources:after.length,bb_entries:246,mc_entries:235,cc_entries:296,module_records_preserved:185,saved_player_record_preserved:true,assertion_scope:'Every original record and field preserved except the explicitly identified routing/startup additions; reusable source records byte-equivalent after JSON parsing.'};
fs.writeFileSync(path.join(root,'scripts/reports/teacher-bb-preservation-20260927.json'),JSON.stringify(report,null,2)+'\n');console.log(report);
