#!/usr/bin/env node
'use strict';
const fs=require('fs');const path=require('path');const root=path.resolve(__dirname,'..');
const readJson=rel=>JSON.parse(fs.readFileSync(path.join(root,rel),'utf8'));
const readText=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg)};const list=p=>Array.isArray(p)?p:(p.events||[]);
const SRC='manual-polymythcal-director-present-set7-2026-08-13',SET='7-Director-Filmmaker-Present';
const manualDoc=readJson('data/manual-events.json'),manual=list(manualDoc),batch=manual.filter(e=>e._src===SRC);
const consolidated=list(readJson('data/polymyth-seminar-events.json'));
const publicEvents=list(readJson('polymythseminars/events.json'));
const sourcesDoc=readJson('scripts/sources.json'),sources=Array.isArray(sourcesDoc)?sourcesDoc:(sourcesDoc.sources||[]);
const schema=readJson('data/polymythcal-event-schema-v2.json');
const ledger=readJson('data/polymythcal-research-set-7-director-present-2026-08-13.json');
const pkg=readJson('package.json');
assert(batch.length===9,`Expected 9 Set 7 records; found ${batch.length}`);
const meta=manualDoc.polymythcal_director_present_set7_update_2026_08_13;
assert(meta&&meta.records_in_delta===9,'Set 7 metadata count drifted');
assert(meta.existing_records_cross_tagged===1,'Set 7 cross-tag count drifted');
assert(ledger.record_count===9&&ledger.research_set===SET,'Set 7 research ledger drifted');
const sourceIds=new Set(sources.map(s=>String(s.id||''))),ids=new Set();
for(const e of batch){
 assert(e.id&&!ids.has(e.id),`Missing or duplicate Set 7 ID ${e.id}`);ids.add(e.id);
 assert(e.source_url&&sourceIds.has(String(e.source_id||'')),`${e.id}: unresolved source`);
 assert(e.record_kind==='event'&&e.type==='screening',`${e.id}: Set 7 must remain an occurrence-level screening`);
 assert(e.entry_family==='creator-present',`${e.id}: wrong entry_family`);
 assert(e.research_set===SET,`${e.id}: missing research_set`);
 assert(e.talkback_confirmed===true&&e.talkback_status==='confirmed',`${e.id}: Q&A not preserved as confirmed`);
 assert(Array.isArray(e.presence_categories)&&e.presence_categories.includes('director-filmmaker'),`${e.id}: director/filmmaker facet missing`);
 assert(Array.isArray(e.presence_claims)&&e.presence_claims.length,`${e.id}: missing occurrence-scoped presence evidence`);
}
const byId=new Map(manual.map(e=>[e.id,e]));const req=id=>{const e=byId.get(id);assert(e,`Missing required record ${id}`);return e};
const namedDirectorEvents=batch.filter(e=>(e.presence_claims||[]).some(c=>String(c.category||'')==='director-filmmaker'&&['confirmed','confirmed-remote'].includes(String(c.status||''))&&c.person&&!/filmmakers and special guests/i.test(c.person)));
assert(namedDirectorEvents.length===8,`Expected 8 events with a named confirmed director/filmmaker; found ${namedDirectorEvents.length}`);
const remote=req('hot-docs-wild-inside-director-virtual-q-and-a-2026-08-16');
assert(remote.presence_mode==='remote'&&remote.event_format==='hybrid','Wild Inside remote participation was flattened');
assert((remote.presence_claims||[]).some(c=>c.person==='Penny Lane'&&c.mode==='remote'&&c.status==='confirmed'),'Penny Lane remote attendance missing');
const bootstrap=req('hot-docs-bootstraps-filmmaker-special-guest-q-and-a-2026-08-22');
assert(bootstrap.director_attendance_status==='unconfirmed','Bootstraps director attendance must remain unconfirmed');
assert((bootstrap.presence_claims||[]).some(c=>c.status==='identity-unannounced'),'Bootstraps generic filmmaker attendance missing');
assert((bootstrap.presence_claims||[]).some(c=>c.person==='Deia Schlosberg'&&c.status==='attendance-unconfirmed'),'Bootstraps incorrectly converts director credit into attendance');
const medusa=req('soulpepper-medusa-talkback-2026-07-08');
assert(medusa._src==='manual-polymythcal-comprehensive-2026-08-13','Medusa source lineage overwritten');
assert(medusa.talkback_status==='confirmed'&&medusa.director_attendance_status==='unconfirmed','Medusa regression distinction failed');
assert((medusa.research_set_cross_tags||[]).includes(SET),'Medusa Set 7 cross-tag missing');
assert((medusa.presence_categories||[]).includes('production-participants')&&(medusa.presence_categories||[]).includes('identity-pending'),'Medusa presence facets missing');
const cids=new Set(consolidated.map(e=>e.id)),pids=new Set(publicEvents.map(e=>e.id));
for(const e of batch){assert(cids.has(e.id),`${e.id}: absent from consolidated data`);assert(pids.has(e.id),`${e.id}: absent from public data`)}
assert(consolidated.length===publicEvents.length,'Canonical/public count mismatch');
for(const f of ['presence_claims','presence_categories','presence_mode','event_format','talkback_time_precision','source_history']) assert(schema.properties?.[f],`Schema missing ${f}`);
const ui=readText('polymythseminars/index.html'),revamp=readText('js/polymythcal-revamp.js');
assert(ui.includes('id="pmPresenceTitle"')&&ui.includes('value="director-filmmaker"'),'UI lacks first-class presence filter');
for(const n of ['attendanceBearingClaims','classifyPresence','event.presence_categories','scope !== "production-credit"']) assert(revamp.includes(n),`Presence classifier missing ${n}`);
const build=String(pkg.scripts?.['build:locked']||'');
for(const n of ['import-polymythcal-director-present-set7-2026-08-13.py','node scripts/upsert-manual-calendar-events.js','verify-polymythcal-director-present-set7-2026-08-13.js']) assert(build.includes(n),`build:locked missing ${n}`);
assert((build.match(/(?:^| && )node scripts\/upsert-manual-calendar-events\.js(?= && |$)/g)||[]).length===1,'build:locked must contain exactly one unfiltered manual-event upsert');
assert(!/node scripts\/upsert-manual-calendar-events\.js\s+--/.test(build),'build:locked must not restore a filtered manual-event upsert');
assert(pkg.scripts['import:polymythcal-director-present-set7-2026-08-13'],'Missing Set 7 import alias');
assert(pkg.scripts['verify:polymythcal-director-present-set7-2026-08-13'],'Missing Set 7 verify alias');
const clRows=readText('data/website-cl.jsonl').trim().split(/\n+/).map(JSON.parse),cl=new Map(clRows.map(r=>[r.id,r]));
for(let n=228;n<=235;n++){const id=`CL-WEB-${n}`;assert(cl.get(id)?.status==='complete',`Component List missing/incomplete ${id}`)}
for(const rel of ['WEBSITE_CL_2026-07-19.md','docs/WEBSITE_CL_2026-07-19.md']){const t=readText(rel);assert(t.includes('Completed in Polymythcal Set 7 — Director and Filmmaker Present'),`${rel}: missing Set 7 section`);assert(t.includes('CL-WEB-235'),`${rel}: missing final Set 7 component`)}
console.log(JSON.stringify({manual_records:manual.length,consolidated_records:consolidated.length,set7_records:batch.length,named_director_occurrences:namedDirectorEvents.length,sources:sources.length,change_list:'CL-WEB-228 through CL-WEB-235 complete'},null,2));
