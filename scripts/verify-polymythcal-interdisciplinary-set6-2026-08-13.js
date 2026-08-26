#!/usr/bin/env node
'use strict';
const fs=require('fs');const path=require('path');const root=path.resolve(__dirname,'..');
const readJson=rel=>JSON.parse(fs.readFileSync(path.join(root,rel),'utf8'));
const readText=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg)};const list=p=>Array.isArray(p)?p:(p.events||[]);
const SRC='manual-polymythcal-interdisciplinary-set6-2026-08-13',SET='6-Interdisciplinary-General';
const manualDoc=readJson('data/manual-events.json'),manual=list(manualDoc);
const consolidated=list(readJson('data/polymyth-seminar-events.json'));
const publicEvents=list(readJson('polymythseminars/events.json'));
const sourcesDoc=readJson('scripts/sources.json'),sources=Array.isArray(sourcesDoc)?sourcesDoc:(sourcesDoc.sources||[]);
const schema=readJson('data/polymythcal-event-schema-v2.json');
const ledger=readJson('data/polymythcal-research-set-6-interdisciplinary-2026-08-13.json');
const pkg=readJson('package.json');const batch=manual.filter(e=>e._src===SRC);
assert(batch.length===42,`Expected 42 Set 6 records; found ${batch.length}`);
const meta=manualDoc.polymythcal_interdisciplinary_set6_update_2026_08_13;
assert(meta&&meta.records_in_delta===42,'Set 6 metadata count drifted');
assert(meta.existing_records_cross_tagged===7,'Set 6 cross-tag count drifted');
assert(ledger.record_count===42&&ledger.research_set===SET,'Set 6 research ledger drifted');
const sourceIds=new Set(sources.map(s=>String(s.id||''))),ids=new Set();
for(const e of batch){
 assert(e.id&&!ids.has(e.id),`Missing or duplicate Set 6 ID ${e.id}`);ids.add(e.id);
 assert(e.source_url&&sourceIds.has(String(e.source_id||'')),`${e.id}: unresolved source`);
 assert(['event','opportunity'].includes(e.record_kind),`${e.id}: invalid record_kind ${e.record_kind}`);
 assert(['confirmed','unconfirmed'].includes(e.confirmation_status),`${e.id}: bad confirmation status`);
 assert(e.research_set===SET,`${e.id}: missing research_set`);
 assert(Array.isArray(e.interdisciplinary_domains)&&e.interdisciplinary_domains.length,`${e.id}: missing interdisciplinary_domains`);
 assert((e.subjects||[]).includes('Interdisciplinary'),`${e.id}: missing Interdisciplinary subject`);
 assert((e.topics||[]).includes('interdisciplinary'),`${e.id}: missing interdisciplinary topic`);
 assert(e.entry_family==='interdisciplinary',`${e.id}: wrong entry_family`);
 if(e.confirmation_status==='unconfirmed'){
  const reasons=Array.isArray(e.qualification_reasons)?e.qualification_reasons:[];
  assert(reasons.length,`${e.id}: unconfirmed record lacks qualification reasons`);
  if(reasons.includes('date-unconfirmed')){
   assert(/monitoring marker, not a confirmed/i.test(e.description||''),`${e.id}: watch marker not disclosed`);
   assert(e.date_precision==='estimated',`${e.id}: watch date precision must be estimated`);
  }else{
   assert(reasons.includes('time-unconfirmed'),`${e.id}: unconfirmed record lacks date- or time-specific evidence status`);
   assert(e.date_precision==='date',`${e.id}: time-only uncertainty must preserve the official date`);
   assert(e.time_precision==='unknown',`${e.id}: time-only uncertainty must remain explicitly unknown`);
  }
 }
}
const byId=new Map(manual.map(e=>[e.id,e]));const req=id=>{const e=byId.get(id);assert(e,`Missing required record ${id}`);return e};
const child=id=>{const e=req(id);assert(e.parent_id&&byId.has(e.parent_id),`${id}: unresolved parent`);assert(e.series_role==='child',`${id}: missing child role`);return e};
[
 'loran-2027-application-deadline','terry-fox-humanitarian-award-2027-deadline','schulich-leader-scholarships-2027-offer-period',
 'mccall-macbain-2027-canada-us-deadline','diamond-challenge-summit-2027','conrad-innovation-summit-2027',
 'earth-prize-2027-deadline-watch','technovation-student-ambassador-2026-27-deadline','wharton-global-investment-competition-2026-27-registration',
 'canada-wide-science-fair-2027','ncur-2027-conference','connectur-2027-onsite','cur-grant-dialogues-2027','undergraduate-research-week-2027'
].forEach(req);
[
 'loran-2027-applications-open','terry-fox-humanitarian-award-2027-open','schulich-leader-scholarships-2027-school-nomination',
 'schulich-leader-scholarships-2027-nominee-application','mccall-macbain-2027-international-deadline','diamond-challenge-2027-deadline',
 'diamond-challenge-2027-finalists','conrad-challenge-2027-innovation-stage-deadline','conrad-challenge-2027-finalists',
 'canada-wide-science-fair-2027-public-viewing-may30','ncur-2027-submission-deadline','ncur-2027-early-bird-registration',
 'connectur-2027-submission-deadline','connectur-2027-online'
].forEach(child);
const cwsf=req('canada-wide-science-fair-2027');assert(cwsf.exact_grades.length===6&&cwsf.grade_min===7&&cwsf.grade_max===12,'CWSF Grades 7–12 indexing failed');
assert(/stale 2025–26/i.test(req('conrad-challenge-2027-innovation-stage-deadline').source_inconsistency||''),'Conrad source inconsistency missing');
assert(/conflict between 4:00 p.m. and 5:00 p.m./i.test(req('wharton-global-investment-competition-2026-27-registration').source_inconsistency||''),'Wharton source conflict missing');
assert(/detailed timeline still describes the 2026 cycle/i.test(req('earth-prize-2027-deadline-watch').source_inconsistency||''),'Earth Prize source inconsistency missing');
assert(req('schulich-leader-scholarships-2027-school-nomination').access_route==='school nomination','Schulich nomination route missing');
const crossIds=['breakthrough-junior-challenge-2026-submission','breakthrough-junior-challenge-2026-peer-review','breakthrough-junior-challenge-2026-results','one-earth-young-filmmakers-2027-deadline','one-earth-young-filmmakers-2027-premieres','connecther-film-festival-2026-deadline','codeart-changemaker-2027-deadline'];
for(const id of crossIds){const e=req(id);assert(e._src==='manual-polymythcal-media-literacy-set5-2026-08-13',`${id}: Set 5 identity overwritten`);assert((e.interdisciplinary_domains||[]).length,`${id}: interdisciplinary cross-tag missing`);assert((e.research_set_cross_tags||[]).includes(SET),`${id}: research cross-tag missing`)}
assert(manual.filter(e=>e._src==='manual-polymythcal-media-literacy-set5-2026-08-13').length===73,'Set 5 batch changed');
assert(manual.filter(e=>e._src==='manual-polymythcal-social-studies-set4-2026-08-13').length===68,'Set 4 batch changed');
const cids=new Set(consolidated.map(e=>e.id)),pids=new Set(publicEvents.map(e=>e.id));for(const e of batch){assert(cids.has(e.id),`${e.id}: absent from consolidated data`);assert(pids.has(e.id),`${e.id}: absent from public data`)}
assert(consolidated.length===publicEvents.length,'Canonical/public count mismatch');
for(const f of ['interdisciplinary_domains','subjects','topics','research_set','research_set_cross_tags','calendar_stage','series_role']) assert(schema.properties?.[f],`Schema missing ${f}`);
const taxonomy=readJson('polymythseminars/browse.json').taxonomy,revamp=readText('scripts/lib/polymythcal-discovery-model.js');assert(taxonomy?.axes?.topics?.values?.interdisciplinary?.en&&taxonomy?.axes?.topics?.values?.interdisciplinary?.fr,'Bilingual Research taxonomy lacks Interdisciplinary');
for(const n of ['interdisciplinary','subjects','entry_family']) assert(revamp.includes(n),`Discovery classifier/search missing ${n}`);
const clRows=readText('data/website-cl.jsonl').trim().split(/\n+/).map(JSON.parse),cl=new Map(clRows.map(r=>[r.id,r]));for(let n=220;n<=227;n++){const id=`CL-WEB-${n}`;assert(cl.get(id)?.status==='complete',`Component List missing/incomplete ${id}`)}
for(const rel of ['WEBSITE_CL_2026-07-19.md','docs/WEBSITE_CL_2026-07-19.md']){const t=readText(rel);assert(t.includes('Completed in Polymythcal Set 6 — Interdisciplinary and General'),`${rel}: missing Set 6 section`);assert(t.includes('CL-WEB-227'),`${rel}: missing final Set 6 component`)}
const build=String(pkg.scripts?.['build:locked']||'');for(const n of ['import-polymythcal-interdisciplinary-set6-2026-08-13.py','node scripts/upsert-manual-calendar-events.js','verify-polymythcal-interdisciplinary-set6-2026-08-13.js']) assert(build.includes(n),`build:locked missing ${n}`);
assert((build.match(/(?:^| && )node scripts\/upsert-manual-calendar-events\.js(?= && |$)/g)||[]).length===1,'build:locked must contain exactly one unfiltered manual-event upsert');
assert(!/node scripts\/upsert-manual-calendar-events\.js\s+--/.test(build),'build:locked must not restore a filtered manual-event upsert');
assert(pkg.scripts['import:polymythcal-interdisciplinary-set6-2026-08-13'],'Missing Set 6 import alias');assert(pkg.scripts['verify:polymythcal-interdisciplinary-set6-2026-08-13'],'Missing Set 6 verify alias');
console.log(JSON.stringify({manual_records:manual.length,consolidated_records:consolidated.length,set6_records:batch.length,confirmed:batch.filter(e=>e.confirmation_status==='confirmed').length,qualified_watches:batch.filter(e=>e.confirmation_status==='unconfirmed').length,sources:sources.length,change_list:'CL-WEB-220 through CL-WEB-227 complete'},null,2));

