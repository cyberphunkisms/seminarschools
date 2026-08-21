#!/usr/bin/env node
'use strict';
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const readJson=rel=>JSON.parse(fs.readFileSync(path.join(root,rel),'utf8'));
const readText=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg)};
const list=d=>Array.isArray(d)?d:(d.events||[]);
const SRC='manual-polymythcal-civic-political-legal-labour-set12-2026-08-14';
const SET='12-Civic-Political-Legal-Labour-Events';
const manualDoc=readJson('data/manual-events.json');
const manual=list(manualDoc), byId=new Map(manual.filter(e=>e.id).map(e=>[e.id,e]));
const batch=manual.filter(e=>e._src===SRC);
const consolidated=list(readJson('data/polymyth-seminar-events.json'));
const publicEvents=list(readJson('polymythseminars/events.json'));
const browserEvents=list(readJson('polymythseminars/browse.json'));
const cids=new Set(consolidated.map(e=>e.id)), pids=new Set(publicEvents.map(e=>e.id));
const consolidatedById=new Map(consolidated.map(e=>[e.id,e]));
const publicById=new Map(publicEvents.map(e=>[e.id,e]));
const browserById=new Map(browserEvents.map(e=>[e.id,e]));
const sourcesDoc=readJson('scripts/sources.json');
const sourceRows=Array.isArray(sourcesDoc)?sourcesDoc:(sourcesDoc.sources||[]), sourceIds=new Set(sourceRows.map(s=>String(s.id||'')));
const schema=readJson('data/polymythcal-event-schema-v2.json');
const schemaFields=['civic_legal_labour_formats','civic_domain','authority_level','public_role','participation_route','public_input_status','legal_access_status','collective_action_type','election_stage','access_restrictions','webcast_status','publication_restriction','public_access_status','registration_required','event_format','alternate_dates','civic_evidence','source_inconsistency','set12_classified_at'];
const ledger=readJson('data/polymythcal-research-set-12-civic-political-legal-labour-2026-08-14.json');
const pkg=readJson('package.json');
const meta=manualDoc.polymythcal_civic_political_legal_labour_set12_update_2026_08_14;

assert(batch.length===142,`Expected 142 Set 12 records; found ${batch.length}`);
assert(meta&&meta.records_in_delta===142&&meta.net_new_records===142,'Set 12 record accounting drifted');
assert(meta.initial_records_added===142&&meta.records_added_latest_run===0&&meta.existing_records_refreshed_latest_run===142,'Set 12 idempotency accounting drifted');
assert(meta.existing_records_cross_tagged===25,'Set 12 cross-tag count drifted');
assert(meta.parent_records===14&&meta.child_occurrences===107,'Set 12 parent/child accounting drifted');
assert(meta.confirmed_records===87&&meta.qualified_records===55,'Set 12 normalized evidence accounting drifted');
assert(meta.court_hearings===31&&meta.election_records===30,'Set 12 court/election accounting drifted');
assert(ledger.research_set===SET&&ledger.record_count===142,'Set 12 ledger count/scope drifted');
assert((ledger.exclusions||[]).length===9,'Set 12 exclusion ledger drifted');
assert((ledger.cross_tagged_existing_ids||[]).length===25,'Set 12 cross-tag ledger drifted');

const requiredFields=['civic_legal_labour_formats','civic_domain','authority_level','public_role','participation_route','public_input_status','legal_access_status','webcast_status','civic_evidence'];
const ids=new Set();
for(const e of batch){
 assert(e.id&&!ids.has(e.id),`Missing/duplicate Set 12 ID ${e.id}`); ids.add(e.id);
 assert(e.source_url&&/^https?:\/\//.test(e.source_url),`${e.id}: source URL missing`);
 assert(sourceIds.has(String(e.source_id||'')),`${e.id}: unresolved source ${e.source_id}`);
 assert(e.research_set===SET,`${e.id}: research_set drifted`);
 assert(e.entry_family==='civic-political-legal-labour',`${e.id}: entry family drifted`);
 assert(e.record_kind==='event',`${e.id}: civic occurrence must remain an event`);
 for(const field of requiredFields){
  const value=e[field];
  assert(!(value===undefined||value===null||value===''||(Array.isArray(value)&&!value.length)),`${e.id}: ${field} missing`);
 }
 assert(Array.isArray(e.civic_legal_labour_formats)&&e.civic_legal_labour_formats.length,`${e.id}: civic format missing`);
 if(e.series_role==='child') assert(e.parent_id&&byId.has(e.parent_id),`${e.id}: unresolved parent ${e.parent_id}`);
 assert(cids.has(e.id)&&pids.has(e.id),`${e.id}: missing from generated/public corpus`);
 const canonical=consolidatedById.get(e.id), published=publicById.get(e.id), compact=browserById.get(e.id);
 for(const field of schemaFields){
  if(!Object.hasOwn(e,field))continue;
  assert(JSON.stringify(canonical?.[field])===JSON.stringify(e[field]),`${e.id}: canonical ${field} differs from manual`);
  assert(JSON.stringify(published?.[field])===JSON.stringify(e[field]),`${e.id}: public ${field} differs from manual`);
  if(e[field]!==null&&e[field]!==''&&(!Array.isArray(e[field])||e[field].length)){
   assert(JSON.stringify(compact?.[field])===JSON.stringify(e[field]),`${e.id}: browse ${field} differs from manual`);
  }
 }
}
const parents=batch.filter(e=>e.series_role==='parent'), children=batch.filter(e=>e.series_role==='child');
assert(parents.length===14&&children.length===107,'Set 12 series shape drifted');
for(const e of parents) assert(e.time_precision==='not-applicable',`${e.id}: series parent must remain an inclusive date span, not a synthetic midnight event`);
const ttcParent=byId.get('ttc-board-fall-2026'), ttcChild=byId.get('ttc-board-fall-2026-2026-12-15');
assert(ttcParent?.time_precision==='not-applicable'&&ttcParent.date.slice(0,10)===ttcParent.end_date.slice(0,10),'TTC one-day parent date-span semantics drifted');
assert(ttcChild?.time_precision==='unknown'&&ttcChild.confirmation_status==='unconfirmed'&&(ttcChild.qualification_reasons||[]).includes('time-unconfirmed'),'TTC occurrence must preserve its officially unpublished start time');
const childCount=id=>batch.filter(e=>e.parent_id===id).length;
const benchmarks={
 'supreme-court-canada-hearings-fall-2026':31,
 'toronto-municipal-election-cycle-2026':24,
 'toronto-east-york-committee-adjustment-fall-2026':12,
 'montreal-city-council-fall-2026':10,
 'quebec-general-election-cycle-2026':4,
 'outremont-borough-council-fall-2026':4,
 'montreal-nord-borough-council-fall-2026':4,
 'toronto-design-review-panel-fall-2026':4,
 'toronto-police-service-board-fall-2026':3,
 'toronto-public-library-board-fall-2026':3,
};
for(const [id,n] of Object.entries(benchmarks)){assert(byId.has(id),`Benchmark parent missing ${id}`);assert(childCount(id)===n,`${id}: expected ${n} children; found ${childCount(id)}`)}
const representedFormats=['election-voting','council-board-committee','public-hearing-deputation','public-consultation','legislature-parliamentary-sitting','court-tribunal-hearing','inquest-public-inquiry','union-conference','rally-march-counterprotest','civic-deadline-compliance'];
for(const form of representedFormats) assert(batch.some(e=>(e.civic_legal_labour_formats||[]).includes(form)),`Set 12 format absent: ${form}`);
assert(batch.some(e=>(e.civic_legal_labour_formats||[]).includes('union-education')),'Set 12 union-education source form absent');

const qualified=batch.filter(e=>e.confirmation_status!=='confirmed');
assert(qualified.length===55,'Set 12 qualified-record count drifted');
for(const e of qualified) assert(Array.isArray(e.qualification_reasons)&&e.qualification_reasons.length,`${e.id}: qualified record lacks reasons`);
const conflictChecks={
 'river-run-grassy-narrows-2026':'2026-09-26T12:00:00-04:00',
 'cupe-young-ontario-workers-conference-2026':'2026-11-19/2026-11-21',
};
for(const [id,alt] of Object.entries(conflictChecks)){
 const e=byId.get(id); assert(e&&e.confirmation_status==='unconfirmed',`${id}: source-conflict status drifted`);
 assert((e.qualification_reasons||[]).includes('official-source-date-conflict'),`${id}: source-conflict qualification missing`);
 assert((e.alternate_dates||[]).includes(alt),`${id}: alternate date missing`);
 assert(typeof e.source_inconsistency==='string'&&e.source_inconsistency,`${id}: source inconsistency missing`);
}
for(const id of ledger.cross_tagged_existing_ids){
 const e=byId.get(id); assert(e,`Cross-tagged existing record missing ${id}`);
 assert((e.research_set_cross_tags||[]).includes(SET),`${id}: Set 12 cross-tag missing`);
 assert((e._upsert_batches||[]).includes(SRC),`${id}: Set 12 upsert provenance missing`);
 const canonical=consolidatedById.get(id), published=publicById.get(id), compact=browserById.get(id);
 for(const field of schemaFields){
  if(!Object.hasOwn(e,field))continue;
  assert(JSON.stringify(canonical?.[field])===JSON.stringify(e[field]),`${id}: cross-tag canonical ${field} differs from manual`);
  assert(JSON.stringify(published?.[field])===JSON.stringify(e[field]),`${id}: cross-tag public ${field} differs from manual`);
  if(e[field]!==null&&e[field]!==''&&(!Array.isArray(e[field])||e[field].length)){
   assert(JSON.stringify(compact?.[field])===JSON.stringify(e[field]),`${id}: cross-tag browse ${field} differs from manual`);
  }
 }
}
const medusa=byId.get('soulpepper-medusa-talkback-2026-07-08');
assert(medusa&&medusa.talkback_status==='confirmed'&&medusa.director_attendance_status==='unconfirmed','Medusa regression failed');
assert(manual.length>=1552,`Expected at least the 1,552-record deduplicated Set 12 manual baseline; found ${manual.length}`);
assert(
  consolidated.length===publicEvents.length&&consolidated.length>=1842,
  `Expected canonical/public parity above the 1,842-record Set 12 baseline; found ${consolidated.length}/${publicEvents.length}`,
);

for(const f of schemaFields) assert(schema.properties?.[f],`Schema missing ${f}`);
const allUiFormats=['election-voting','candidate-campaign','council-board-committee','public-hearing-deputation','public-consultation','legislature-parliamentary-sitting','court-tribunal-hearing','inquest-public-inquiry','union-conference','rally-march-counterprotest','picket-strike-labour-action','civic-deadline-compliance'];
const ui=readText('polymythseminars/index.html'), uiFr=readText('polymythseminars/fr/index.html'), revamp=readText('js/polymythcal-revamp.js'), detail=readText('scripts/build-polymythcal-audit13.py'), browser=readText('scripts/build-polymythcal-browser-payload.js');
for(const value of allUiFormats){assert(ui.includes(`value="${value}"`),`UI lacks Civic facet ${value}`);assert(uiFr.includes(`value="${value}"`),`French UI lacks Civic facet ${value}`)}
for(const marker of ['civicFormats','classifyCivicFormats','event._civicFormats','civic_legal_labour_formats','civic-political-legal-labour']) assert(revamp.includes(marker),`Civic runtime missing ${marker}`);
assert(revamp.includes('event.entry_family === "civic-political-legal-labour" && event.record_kind === "event"'),'Civic deadline event lock missing');
for(const marker of ['Civic, legal, and labour formats','Participation route','Legal access','Publication restriction','Civic evidence']) assert(detail.includes(marker),`Civic detail surface missing ${marker}`);
for(const marker of ['civic_legal_labour_formats','public_input_status','publication_restriction','civic_evidence']) assert(browser.includes(marker),`Browser payload missing ${marker}`);

const build=String(pkg.scripts?.['build:locked']||'');
for(const marker of ['import-polymythcal-civic-political-legal-labour-set12-2026-08-14.py','normalize-polymythcal-manual-identities.py','normalize-polymythcal-evidence-model.py','node scripts/upsert-manual-calendar-events.js','update-polymythcal-editable-master-set12-2026-08-14.py','verify-polymythcal-civic-political-legal-labour-set12-2026-08-14.js']) assert(build.includes(marker),`build:locked missing ${marker}`);
assert((build.match(/(?:^| && )node scripts\/upsert-manual-calendar-events\.js(?= && |$)/g)||[]).length===1,'build:locked must contain exactly one unfiltered manual-event upsert');
assert(!/node scripts\/upsert-manual-calendar-events\.js\s+--/.test(build),'build:locked must not restore a filtered manual-event upsert');
assert(pkg.scripts['import:polymythcal-civic-political-legal-labour-set12-2026-08-14'],'Missing Set 12 import alias');
assert(pkg.scripts['verify:polymythcal-civic-political-legal-labour-set12-2026-08-14'],'Missing Set 12 verify alias');
const clRows=readText('data/website-cl.jsonl').trim().split(/\n+/).map(JSON.parse),cl=new Map(clRows.map(r=>[r.id,r]));
for(let n=268;n<=275;n++) assert(cl.get(`CL-WEB-${n}`)?.status==='complete',`CL-WEB-${n} missing/incomplete`);
assert(/142 Set 12 records/.test(cl.get('CL-WEB-274')?.decision||''),'CL-WEB-274 record count drifted');
for(const rel of ['WEBSITE_CL_2026-07-19.md','docs/WEBSITE_CL_2026-07-19.md']){const text=readText(rel);assert(text.includes('CL-WEB-275'),`${rel}: Set 12 section incomplete`)}
console.log(JSON.stringify({manual_records:manual.length,consolidated_records:consolidated.length,set12_records:batch.length,parent_records:parents.length,child_occurrences:children.length,confirmed_records:meta.confirmed_records,qualified_records:qualified.length,court_hearings:meta.court_hearings,election_records:meta.election_records,sources:sourceRows.length,change_list:'CL-WEB-268 through CL-WEB-275 complete'},null,2));
