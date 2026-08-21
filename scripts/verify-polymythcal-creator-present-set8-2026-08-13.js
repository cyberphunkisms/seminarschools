#!/usr/bin/env node
'use strict';
const fs=require('fs');const path=require('path');const root=path.resolve(__dirname,'..');
const readJson=rel=>JSON.parse(fs.readFileSync(path.join(root,rel),'utf8'));
const readText=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg)};const list=p=>Array.isArray(p)?p:(p.events||[]);
const SRC='manual-polymythcal-creator-present-set8-2026-08-13',SET='8-Creator-Participant-Witness-Present';
const manualDoc=readJson('data/manual-events.json'),manual=list(manualDoc),batch=manual.filter(e=>e._src===SRC);
const consolidated=list(readJson('data/polymyth-seminar-events.json'));
const publicEvents=list(readJson('polymythseminars/events.json'));
const sourcesDoc=readJson('scripts/sources.json'),sources=Array.isArray(sourcesDoc)?sourcesDoc:(sourcesDoc.sources||[]);
const schema=readJson('data/polymythcal-event-schema-v2.json');
const ledger=readJson('data/polymythcal-research-set-8-creator-present-2026-08-13.json');
const pkg=readJson('package.json');
assert(batch.length===91,`Expected 91 Set 8 records; found ${batch.length}`);
const meta=manualDoc.polymythcal_creator_present_set8_update_2026_08_13;
assert(meta&&meta.records_in_delta===91,'Set 8 metadata count drifted');
assert(meta.existing_records_cross_tagged===10,'Set 8 cross-tag count drifted');
assert(meta.existing_parent_records_enriched===3,'Set 8 parent-enrichment count drifted');
assert(ledger.record_count===91&&ledger.research_set===SET,'Set 8 research ledger drifted');
const sourceIds=new Set(sources.map(s=>String(s.id||''))),ids=new Set();
for(const e of batch){
 assert(e.id&&!ids.has(e.id),`Missing or duplicate Set 8 ID ${e.id}`);ids.add(e.id);
 assert(e.source_url&&sourceIds.has(String(e.source_id||'')),`${e.id}: unresolved source`);
 assert(e.research_set===SET,`${e.id}: missing research_set`);
 assert(['event','festival'].includes(e.record_kind),`${e.id}: invalid record_kind ${e.record_kind}`);
 if(String(e.entry_family||'').startsWith('creator-present')){
  assert(Array.isArray(e.presence_categories)&&e.presence_categories.length,`${e.id}: creator-present occurrence lacks a presence facet`);
  assert(Array.isArray(e.presence_claims)&&e.presence_claims.length,`${e.id}: creator-present occurrence lacks evidence`);
 }
}
const byId=new Map(manual.map(e=>[e.id,e]));const req=id=>{const e=byId.get(id);assert(e,`Missing required record ${id}`);return e};
const set8Children=batch.filter(e=>e.series_role==='child'),set8Parents=batch.filter(e=>e.series_role==='parent');
assert(set8Children.length===74,`Expected 74 Set 8 child occurrences; found ${set8Children.length}`);
assert(set8Parents.length===13,`Expected 13 Set 8 parent records; found ${set8Parents.length}`);
for(const e of set8Children){assert(e.parent_id&&byId.has(e.parent_id),`${e.id}: unresolved parent ${e.parent_id}`)}
const tarragonParents=batch.filter(e=>e.organizer==='Tarragon Theatre'&&e.series_role==='parent');
const tarragonChildren=batch.filter(e=>e.organizer==='Tarragon Theatre'&&e.series_role==='child');
assert(tarragonParents.length===8&&tarragonChildren.length===46,`Tarragon parent/child structure drifted: ${tarragonParents.length}/${tarragonChildren.length}`);
for(const e of tarragonParents){
 assert(!(e.presence_categories||[]).length,`${e.id}: production credits must not become attendance facets`);
 assert((e.presence_claims||[]).every(c=>c.status==='role-confirmed'&&c.scope==='production-credit'),`${e.id}: role-only claims were converted into attendance`);
}
for(const e of tarragonChildren){
 assert(e.talkback_confirmed===true&&e.talkback_status==='confirmed',`${e.id}: confirmed talkback lost`);
 assert((e.presence_categories||[]).includes('identity-pending'),`${e.id}: unnamed participants not surfaced`);
 assert((e.presence_claims||[]).some(c=>c.status==='identity-unannounced'),`${e.id}: generic participation evidence missing`);
}
const docSoup=batch.filter(e=>e.parent_id==='hot-docs-doc-soup-2026-27');
assert(docSoup.length===14,'Doc Soup must retain 14 separate screening/conversation occurrences');
assert(docSoup.every(e=>(e.presence_categories||[]).includes('identity-pending')),'Doc Soup pending identities were flattened');
const canadianTalkIds=['goodnight-desdemona-talkback-2026-11-19','rogers-v-rogers-talkback-2026-11-19','sex-in-the-80s-talkback-2027-01-28','cabaret-talkback-2027-02-25','creditors-talkback-2027-04-15'];
for(const id of canadianTalkIds){const e=req(id);assert(e.talkback_confirmed===true&&e.talkback_status==='confirmed',`${id}: talkback missing`);assert((e.presence_categories||[]).includes('identity-pending'),`${id}: attendee uncertainty erased`)}
for(const id of ['goodnight-desdemona-good-morning-juliet-2026-11-06','rogers-v-rogers-healey-2026-11-08','tifa-2026-festival']){
 const e=req(id);assert((e._upsert_batches||[]).includes(SRC),`${id}: enriched parent omitted from Set 8 upsert batch`);assert((e.source_history||[]).length,`${id}: prior source/date history missing`);
}
const tifa=req('tifa-2026-festival');
assert(tifa.date.startsWith('2026-10-28')&&/October 27–November 1/i.test(tifa.source_inconsistency||''),'TIFA current date or source conflict not preserved');
assert((tifa.alternate_date_ranges||[]).some(r=>String(r.date||'').startsWith('2026-10-27')),'TIFA superseded range missing');
const rom=req('rom-shokkan-curator-coffee-chat-afternoon-2026-08-28');
assert(rom.date.startsWith('2026-08-28T13:30')&&/13:00–14:30/i.test(rom.source_inconsistency||''),'ROM agenda/header timing conflict missing');
const set7=manual.filter(e=>e._src==='manual-polymythcal-director-present-set7-2026-08-13');
assert(set7.length===9,'Set 7 identities changed');
for(const e of set7){assert((e.research_set_cross_tags||[]).includes(SET),`${e.id}: Set 8 cross-tag missing`);assert((e._upsert_batches||[]).includes(SRC),`${e.id}: Set 8 batch provenance missing`)}
const medusa=req('soulpepper-medusa-talkback-2026-07-08');
assert(medusa._src==='manual-polymythcal-comprehensive-2026-08-13','Medusa source lineage overwritten');
assert((medusa.research_set_cross_tags||[]).includes(SET)&&medusa.director_attendance_status==='unconfirmed','Medusa Set 8 regression failed');
const cids=new Set(consolidated.map(e=>e.id)),pids=new Set(publicEvents.map(e=>e.id));
for(const e of batch){assert(cids.has(e.id),`${e.id}: absent from consolidated data`);assert(pids.has(e.id),`${e.id}: absent from public data`)}
for(const id of meta.existing_parent_ids){assert(cids.has(id)&&pids.has(id),`${id}: enriched parent absent from generated data`)}
assert(consolidated.length===publicEvents.length,'Canonical/public count mismatch');
for(const f of ['presence_claims','presence_categories','presence_mode','event_format','talkback_time_precision','source_history']) assert(schema.properties?.[f],`Schema missing ${f}`);
const ui=readText('polymythseminars/index.html'),revamp=readText('js/polymythcal-revamp.js');
for(const value of ['author-writer','artist-curator','scholar-expert','production-participants','community-witness-elder','identity-pending']) assert(ui.includes(`value="${value}"`),`UI lacks presence facet ${value}`);
for(const n of ['attendanceBearingClaims','classifyPresence','event._presence','state.presence']) assert(revamp.includes(n),`Presence filter/runtime missing ${n}`);
const build=String(pkg.scripts?.['build:locked']||'');
for(const n of ['import-polymythcal-creator-present-set8-2026-08-13.py','node scripts/upsert-manual-calendar-events.js','verify-polymythcal-creator-present-set8-2026-08-13.js']) assert(build.includes(n),`build:locked missing ${n}`);
assert((build.match(/(?:^| && )node scripts\/upsert-manual-calendar-events\.js(?= && |$)/g)||[]).length===1,'build:locked must contain exactly one unfiltered manual-event upsert');
assert(!/node scripts\/upsert-manual-calendar-events\.js\s+--/.test(build),'build:locked must not restore a filtered manual-event upsert');
assert(pkg.scripts['import:polymythcal-creator-present-set8-2026-08-13'],'Missing Set 8 import alias');
assert(pkg.scripts['verify:polymythcal-creator-present-set8-2026-08-13'],'Missing Set 8 verify alias');
const clRows=readText('data/website-cl.jsonl').trim().split(/\n+/).map(JSON.parse),cl=new Map(clRows.map(r=>[r.id,r]));
for(let n=236;n<=243;n++){const id=`CL-WEB-${n}`;assert(cl.get(id)?.status==='complete',`Component List missing/incomplete ${id}`)}
for(const rel of ['WEBSITE_CL_2026-07-19.md','docs/WEBSITE_CL_2026-07-19.md']){const t=readText(rel);assert(t.includes('Completed in Polymythcal Set 8 — Creator, Participant, Witness, and Community Present'),`${rel}: missing Set 8 section`);assert(t.includes('CL-WEB-243'),`${rel}: missing final Set 8 component`)}
console.log(JSON.stringify({manual_records:manual.length,consolidated_records:consolidated.length,set8_records:batch.length,parent_records:set8Parents.length,child_occurrences:set8Children.length,tarragon_talkbacks:tarragonChildren.length,doc_soup_occurrences:docSoup.length,sources:sources.length,change_list:'CL-WEB-236 through CL-WEB-243 complete'},null,2));
