#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const g=require('./lib/mephistodata-runtime-gate');
const {KEY,BASE_ARCHIVE}=require('./lib/ml-concept-release-binding');
const root=path.resolve(__dirname,'..'),sha=v=>crypto.createHash('sha256').update(v).digest('hex');
const contract=JSON.parse(fs.readFileSync(path.join(root,'data/futureproofing/ml-concept-application-preservation-2026-10-05.json'),'utf8'));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'RELEASE_MANIFEST.json'),'utf8')),update=manifest[KEY];
const copy=v=>JSON.parse(JSON.stringify(v));
function assert(ok,message){if(!ok)throw Error(message);}
assert(update&&update.predecessor_archive_sha256===BASE_ARCHIVE&&contract.predecessor_archive_sha256===BASE_ARCHIVE,'Predecessor mismatch');
function checkOwners(entries){
 assert(entries.length===contract.canonical_records.length&&entries.length===1233,'Canonical population changed');
 for(const prior of contract.canonical_records){
  const matches=entries.filter(e=>e.s===prior.section&&e.t===prior.title);assert(matches.length===1,'Owner identity lost/duplicated');
  const e=matches[0];assert((e.id||null)===(prior.id||null),'Owner ID changed');
  if(prior.before_body_utf16_length!==undefined){
   const b=e.b.slice(0,prior.before_body_utf16_length);assert(sha(b)===prior.before_body_sha256,'Original body lost: '+e.t);
   assert(e.b.slice(prior.before_body_utf16_length).startsWith('\n\n'),'Missing additive boundary');
   assert(g.canonicalEntrySha({...e,b})===prior.semantic_sha256,'Original fields changed: '+e.t);
  }else assert(g.canonicalEntrySha(e)===prior.semantic_sha256,'Unrelated canonical record changed: '+e.t);
 }
}
const entries=g.canonicalOwnerRecords(root);checkOwners(entries);
for(const [rel,digest] of Object.entries(update.artifact_sha256))assert(sha(fs.readFileSync(path.join(root,rel)))===digest,'Stale successor binding: '+rel);
let unchanged=0,changed=0;
for(const item of contract.predecessor_payloads){
 if(item.path==='RELEASE_MANIFEST.json'||item.path==='PACKAGE_CONTENTS_SHA256.json')continue;
 const p=path.join(root,item.path);assert(fs.existsSync(p)&&fs.lstatSync(p).isFile()&&!fs.lstatSync(p).isSymbolicLink(),'Predecessor payload missing/unsafe: '+item.path);
 const actual=sha(fs.readFileSync(p));
 if(actual===item.sha256){unchanged++;continue;}
 assert(update.predecessor_artifact_sha256[item.path]===item.sha256&&update.artifact_sha256[item.path]===actual,'Unapproved payload mutation: '+item.path);
 assert(!/^(?:polymythcal\/|polymythseminars\/|teacherresources\/|aa\/|bb\/|campaigns\/|polymyth\/(?:coherence|research|archive)\/)/.test(item.path),'Unrelated site/instrument source changed: '+item.path);
 changed++;
}
// Check hostile preservation failures, not only the self-consistent current map.
let hostile=0;
for(const mutate of [es=>es.pop(),es=>es.push(copy(es[0])),es=>{es.find(e=>e.t==='Gorgonification').b='FORGED '+es.find(e=>e.t==='Gorgonification').b;},es=>{es.find(e=>e.t==='Hegelianegirl').r='FORGED';},es=>{es.find(e=>e.s==='corehistory').b+=' FORGED';}]){
 const fake=copy(entries);mutate(fake);let rejected=false;try{checkOwners(fake);}catch{rejected=true;}assert(rejected,'Hostile canonical change accepted');hostile++;
}
console.log(`ML CONCEPT PRESERVATION PASS — ${entries.length} owners; nine additive body extensions; ${unchanged} predecessor payloads unchanged / ${changed} explicitly bound changes; ${hostile} hostile mutations rejected. No semantic-adoption or host-invocation certification.`);
