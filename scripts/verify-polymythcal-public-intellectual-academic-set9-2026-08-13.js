#!/usr/bin/env node
'use strict';
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const readJson=rel=>JSON.parse(fs.readFileSync(path.join(root,rel),'utf8'));
const readText=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg)};
const list=p=>Array.isArray(p)?p:(p.events||[]);
const SRC='manual-polymythcal-public-intellectual-academic-set9-2026-08-13';
const SET='9-Public-Intellectual-and-Academic-Events';
const manualDoc=readJson('data/manual-events.json');
const manual=list(manualDoc);
const batch=manual.filter(e=>e._src===SRC);
const consolidated=list(readJson('data/polymyth-seminar-events.json'));
const publicEvents=list(readJson('polymythseminars/events.json'));
const sourcesDoc=readJson('scripts/sources.json');
const sources=Array.isArray(sourcesDoc)?sourcesDoc:(sourcesDoc.sources||[]);
const schema=readJson('data/polymythcal-event-schema-v2.json');
const ledger=readJson('data/polymythcal-research-set-9-public-intellectual-academic-2026-08-13.json');
const pkg=readJson('package.json');
const byId=new Map(manual.map(e=>[e.id,e]));
const req=id=>{const e=byId.get(id);assert(e,`Missing required record ${id}`);return e};

assert(batch.length===181,`Expected 181 Set 9 records; found ${batch.length}`);
const meta=manualDoc.polymythcal_public_intellectual_academic_set9_update_2026_08_13;
assert(meta&&meta.records_in_delta===181,'Set 9 metadata count drifted');
assert(meta.existing_records_cross_tagged===23,'Set 9 cross-tag count drifted');
assert(meta.legacy_records_reconciled===8,'Set 9 legacy reconciliation count drifted');
assert(meta.net_new_records===173&&meta.existing_records_refreshed===8,'Set 9 new/refresh accounting drifted');
assert(meta.official_time_corrections===6&&meta.source_url_corrections===2,'Set 9 correction accounting drifted');
assert(meta.parent_records===10&&meta.child_occurrences===120,'Set 9 parent/child metadata drifted');
assert(ledger.record_count===181&&ledger.research_set===SET,'Set 9 research ledger drifted');

const sourceIds=new Set(sources.map(s=>String(s.id||'')));
const ids=new Set();
for(const e of batch){
  assert(e.id&&!ids.has(e.id),`Missing or duplicate Set 9 ID ${e.id}`);ids.add(e.id);
  assert(e.source_url&&/^https?:\/\//.test(e.source_url),`${e.id}: source URL missing`);
  assert(sourceIds.has(String(e.source_id||'')),`${e.id}: unresolved source ${e.source_id}`);
  assert(e.research_set===SET,`${e.id}: missing research_set`);
  assert(e.record_kind==='event',`${e.id}: invalid record_kind ${e.record_kind}`);
  assert(Array.isArray(e.public_intellectual_academic_formats)&&e.public_intellectual_academic_formats.length,`${e.id}: legacy Set 9 form field missing`);
  assert(Array.isArray(e.academic_event_forms)&&e.academic_event_forms.length,`${e.id}: Academic format alias missing`);
  assert(typeof e.public_access_status==='string'&&e.public_access_status,`${e.id}: public-access status missing`);
  assert(typeof e.audience_scope==='string'&&e.audience_scope,`${e.id}: audience scope missing`);
  if(e.series_role==='child') assert(e.parent_id&&byId.has(e.parent_id),`${e.id}: unresolved parent ${e.parent_id}`);
}

const parents=batch.filter(e=>e.series_role==='parent');
const children=batch.filter(e=>e.series_role==='child');
assert(parents.length===10,`Expected 10 Set 9 parents; found ${parents.length}`);
assert(children.length===120,`Expected 120 Set 9 children; found ${children.length}`);

// Public thesis-defence coverage.
const concordiaParent=req('concordia-public-thesis-defences-2026-08-14-to-09-25');
const defences=batch.filter(e=>e.parent_id===concordiaParent.id);
assert(defences.length===48,`Expected 48 Concordia defence occurrences; found ${defences.length}`);
for(const e of defences){
  assert(e.type==='thesis-defence',`${e.id}: wrong defence type`);
  assert((e.academic_event_forms||[]).includes('thesis-defence'),`${e.id}: defence form missing`);
  assert(e.public_access_status==='free-public',`${e.id}: free public access lost`);
  assert((e.presence_claims||[]).some(c=>c.status==='confirmed'&&c.scope==='event'),`${e.id}: candidate occurrence evidence missing`);
  assert(e.thesis_title&&e.candidate&&e.degree_role,`${e.id}: thesis/candidate/degree structure missing`);
}
const salari=req('concordia-phd-soorena-salari-2026-08-28');
assert(salari.venue==='Location pending'&&(salari.qualification_reasons||[]).includes('location-unconfirmed'),'Pending Concordia location was erased');
assert(req('concordia-ma-zachary-yuzda-2026-08-28').event_format==='online','MA defence online format drifted');

// Reading, discussion, and philosophy-seminar series.
const practical=batch.filter(e=>e.parent_id==='practical-philosophy-club-biweekly-discussions-fall-2026');
assert(practical.length===9,'Practical Philosophy Club must retain nine separate occurrences');
assert(practical.every(e=>(e.academic_event_forms||[]).includes('philosophy-cafe')),'Practical Philosophy philosophy-café classification drifted');
assert(practical.every(e=>(e.presence_claims||[]).some(c=>c.person==='Jeffrey M.'&&c.category==='host-moderator')),'Practical Philosophy host evidence missing');
const proust=batch.filter(e=>e.parent_id==='proust-readers-support-group-2026-27');
assert(proust.length===13,'Proust reading series must retain thirteen dated sessions');
assert(proust[0]&&proust.some(e=>e.time_precision==='exact')&&proust.some(e=>e.time_precision==='estimated'),'Proust time precision was flattened');
const rip=batch.filter(e=>e.parent_id==='royal-institute-philosophy-phd-online-seminars-fall-2026');
assert(rip.length===4,'Royal Institute PhD seminar series must retain four occurrences');
assert(rip.every(e=>e.time_precision==='unknown'&&e.public_access_status==='member-only'),'Royal Institute time/access constraints drifted');
assert(req('royal-institute-philosophy-phd-seminar-2026-11-10').participant_identity_status==='partly-named','Partially published speaker identity was overclaimed');

// Exact source and time corrections retain prior values as history.
const correctedTimes={
 'utoronto-eeb-puneeth-deraje-exit-seminar-2026-08-25':'2026-08-25T12:00:00-04:00',
 'utoronto-eeb-ellen-nikelski-exit-seminar-2026-09-08':'2026-09-08T13:10:00-04:00',
 'utoronto-eeb-eniolaye-balogun-exit-seminar-2026-09-22':'2026-09-22T09:00:00-04:00'
};
for(const [id,date] of Object.entries(correctedTimes)){
 const e=req(id);assert(e.date===date,`${id}: corrected time drifted`);
 assert((e.source_history||[]).some(h=>h.status==='superseded-time'),`${id}: prior time history missing`);
 assert(/provisional Set 9 import/i.test(e.source_inconsistency||''),`${id}: correction explanation missing`);
}
const medieval=req('utoronto-medieval-philosophy-colloquium-2026');
assert(medieval.source_url.includes('/2025-toronto-colloquium-')&&/live URL slug begins with 2025/i.test(medieval.source_inconsistency||''),'Medieval colloquium official URL inconsistency missing');
assert((medieval.source_history||[]).some(h=>h.status==='superseded-source-url'),'Medieval colloquium source history missing');
const loewer=req('utoronto-quine-lewis-loewer-2026-09-25');
assert(loewer.source_url.includes('/bringin-quine-')&&/typographical slug/i.test(loewer.source_inconsistency||''),'Barry Loewer official URL typo not preserved');

// Access-state and academic-form coverage.
for(const access of ['free-public','public-rsvp','member-only','institution-restricted','selected-participants','public-registration']){
 assert(batch.some(e=>e.public_access_status===access),`Set 9 lacks access-state coverage: ${access}`);
}
const requiredForms=['lecture','panel','conference','symposium','colloquium','seminar','workshop','webinar','thesis-defence','reading-group','philosophy-cafe','book-launch','research-showcase','poster-session'];
for(const form of requiredForms) assert(batch.some(e=>(e.academic_event_forms||[]).some(v=>String(v).includes(form))),`Set 9 lacks form coverage: ${form}`);
for(const id of ['massey-house-of-anansi-cbc-massey-book-launch-2026-09-09','cigi-quantum-nexus-canadian-strategic-advantage-2026-10-21','perimeter-scicomm-collider-2026','perimeter-relativity-reframed-2026','queens-under-shadow-of-empire-conference-2026']) req(id);

// Cross-tagged records keep their original source identity.
for(const id of ledger.cross_tagged_existing_ids){
 const e=req(id);
 assert((e.research_set_cross_tags||[]).includes(SET),`${id}: Set 9 cross-tag missing`);
 assert((e._upsert_batches||[]).includes(SRC),`${id}: Set 9 batch provenance missing`);
}

// Previous-set regressions.
assert(manual.filter(e=>e._src==='manual-polymythcal-director-present-set7-2026-08-13').length===9,'Set 7 identity count changed');
assert(manual.filter(e=>e._src==='manual-polymythcal-creator-present-set8-2026-08-13').length===91,'Set 8 identity count changed');
const medusa=req('soulpepper-medusa-talkback-2026-07-08');
assert(medusa.director_attendance_status==='unconfirmed'&&medusa.talkback_status==='confirmed','Medusa attendance/talkback regression failed');

// Generated/public parity.
const cids=new Set(consolidated.map(e=>e.id));
const pids=new Set(publicEvents.map(e=>e.id));
for(const e of batch){assert(cids.has(e.id),`${e.id}: absent from consolidated data`);assert(pids.has(e.id),`${e.id}: absent from public data`)}
assert(consolidated.length===publicEvents.length,'Canonical/public event count mismatch');
assert(consolidated.length>=1587,`Set 9 baseline requires at least 1,587 consolidated/public events; found ${consolidated.length}`);

// Schema, UI, builder, build integration, and CL.
for(const f of ['public_intellectual_academic_formats','academic_event_forms','academic_disciplines','event_format','interaction_format','public_access_status','audience_scope','registration_required','participant_identity_status','source_history']) assert(schema.properties?.[f],`Schema missing ${f}`);
const ui=readText('polymythseminars/index.html');
const revamp=readText('js/polymythcal-revamp.js');
const builder=readText('scripts/build-polymythcal-audit13.py');
for(const value of ['public-lecture','panel-debate-forum','conference-symposium','colloquium-seminar','workshop-webinar','thesis-defence','research-showcase-poster','reading-group-philosophy-cafe','book-talk-launch']) assert(ui.includes(`value="${value}"`),`UI lacks Academic format facet ${value}`);
for(const marker of ['state.academicForms','classifyAcademicForms','event._academicForms','academic_event_forms','academic_disciplines']) assert(revamp.includes(marker),`Academic format runtime missing ${marker}`);
for(const marker of ['Academic event formats','Academic disciplines','Institutional restriction']) assert(builder.includes(marker),`Detail evidence surface missing ${marker}`);
const build=String(pkg.scripts?.['build:locked']||'');
for(const marker of ['import-polymythcal-public-intellectual-academic-set9-2026-08-13.py','node scripts/upsert-manual-calendar-events.js','verify-polymythcal-public-intellectual-academic-set9-2026-08-13.js']) assert(build.includes(marker),`build:locked missing ${marker}`);
assert((build.match(/(?:^| && )node scripts\/upsert-manual-calendar-events\.js(?= && |$)/g)||[]).length===1,'build:locked must contain exactly one unfiltered manual-event upsert');
assert(!/node scripts\/upsert-manual-calendar-events\.js\s+--/.test(build),'build:locked must not restore a filtered manual-event upsert');
assert(pkg.scripts['import:polymythcal-public-intellectual-academic-set9-2026-08-13'],'Missing Set 9 import alias');
assert(pkg.scripts['verify:polymythcal-public-intellectual-academic-set9-2026-08-13'],'Missing Set 9 verify alias');
const clRows=readText('data/website-cl.jsonl').trim().split(/\n+/).map(JSON.parse),cl=new Map(clRows.map(r=>[r.id,r]));
for(let n=244;n<=251;n++){const id=`CL-WEB-${n}`;assert(cl.get(id)?.status==='complete',`Component List missing/incomplete ${id}`)}
assert(/181 Set 9 records/.test(cl.get('CL-WEB-250')?.decision||''),'CL-WEB-250 count drifted');
for(const rel of ['WEBSITE_CL_2026-07-19.md','docs/WEBSITE_CL_2026-07-19.md']){
 const t=readText(rel);assert(t.includes('Completed in Polymythcal Set 9 — Public Intellectual and Academic Events'),`${rel}: missing Set 9 section`);assert(t.includes('CL-WEB-251'),`${rel}: missing final Set 9 component`);assert(t.includes('181 Set 9 records'),`${rel}: provisional count remains`);
}

console.log(JSON.stringify({manual_records:manual.length,consolidated_records:consolidated.length,set9_records:batch.length,parent_records:parents.length,child_occurrences:children.length,public_thesis_defences:defences.length,practical_philosophy_occurrences:practical.length,proust_reading_occurrences:proust.length,royal_institute_phd_seminars:rip.length,sources:sources.length,change_list:'CL-WEB-244 through CL-WEB-251 complete'},null,2));
