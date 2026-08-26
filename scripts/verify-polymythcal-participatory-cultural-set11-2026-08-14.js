#!/usr/bin/env node
'use strict';
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const readJson=rel=>JSON.parse(fs.readFileSync(path.join(root,rel),'utf8'));
const readText=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg)};
const list=d=>Array.isArray(d)?d:(d.events||[]);
const SRC='manual-polymythcal-participatory-cultural-set11-2026-08-14';
const SET='11-Participatory-Cultural-Events';
const manualDoc=readJson('data/manual-events.json');
const manual=list(manualDoc), byId=new Map(manual.filter(e=>e.id).map(e=>[e.id,e]));
const batch=manual.filter(e=>e._src===SRC);
const consolidated=list(readJson('data/polymyth-seminar-events.json'));
const publicEvents=list(readJson('polymythseminars/events.json'));
const cids=new Set(consolidated.map(e=>e.id)), pids=new Set(publicEvents.map(e=>e.id));
const sourcesDoc=readJson('scripts/sources.json');
const sourceRows=Array.isArray(sourcesDoc)?sourcesDoc:(sourcesDoc.sources||[]), sourceIds=new Set(sourceRows.map(s=>String(s.id||'')));
const schema=readJson('data/polymythcal-event-schema-v2.json');
const ledger=readJson('data/polymythcal-research-set-11-participatory-cultural-2026-08-14.json');
const pkg=readJson('package.json');
const meta=manualDoc.polymythcal_participatory_cultural_set11_update_2026_08_14;
assert(batch.length===113,`Expected 113 Set 11 records; found ${batch.length}`);
assert(meta&&meta.records_in_delta===113&&meta.net_new_records===113,'Set 11 record accounting drifted');
assert(meta.initial_records_added===113&&meta.records_added_latest_run===0&&meta.existing_records_refreshed_latest_run===113,'Set 11 idempotency accounting drifted');
assert(meta.existing_records_cross_tagged===5,'Set 11 cross-tag count drifted');
assert(meta.parent_records===12&&meta.child_occurrences===54,'Set 11 parent/child accounting drifted');
assert(meta.confirmed_records===104&&meta.qualified_records===9,'Set 11 confidence accounting drifted');
assert(ledger.research_set===SET&&ledger.record_count===113,'Set 11 ledger count/scope drifted');
assert((ledger.exclusions||[]).length===6,'Set 11 exclusion ledger drifted');
assert((ledger.cross_tagged_existing_ids||[]).length===5,'Set 11 cross-tag ledger drifted');

const ids=new Set();
for(const e of batch){
 assert(e.id&&!ids.has(e.id),`Missing/duplicate Set 11 ID ${e.id}`); ids.add(e.id);
 assert(e.source_url&&/^https?:\/\//.test(e.source_url),`${e.id}: source URL missing`);
 assert(sourceIds.has(String(e.source_id||'')),`${e.id}: unresolved source ${e.source_id}`);
 assert(e.research_set===SET,`${e.id}: research_set drifted`);
 assert(Array.isArray(e.participatory_formats)&&e.participatory_formats.length,`${e.id}: participation format missing`);
 assert(typeof e.participation_mode==='string'&&e.participation_mode,`${e.id}: participation mode missing`);
 assert(Array.isArray(e.participation_roles)&&e.participation_roles.length,`${e.id}: participation roles missing`);
 assert(typeof e.facilitation_status==='string'&&e.facilitation_status,`${e.id}: facilitation status missing`);
 assert(typeof e.skill_level==='string'&&e.skill_level,`${e.id}: skill level missing`);
 assert(typeof e.drop_in_status==='string'&&e.drop_in_status,`${e.id}: drop-in status missing`);
 assert(e.participation_required===true,`${e.id}: active participation requirement missing`);
 assert(typeof e.participation_evidence==='string'&&e.participation_evidence,`${e.id}: participation evidence missing`);
 if(e.series_role==='child') assert(e.parent_id&&byId.has(e.parent_id),`${e.id}: unresolved parent ${e.parent_id}`);
 assert(cids.has(e.id)&&pids.has(e.id),`${e.id}: missing from generated/public corpus`);
}
const parents=batch.filter(e=>e.series_role==='parent'), children=batch.filter(e=>e.series_role==='child');
assert(parents.length===12&&children.length===54,'Set 11 series shape drifted');
const childCount=id=>batch.filter(e=>e.parent_id===id).length;
const benchmarks={
 'repair-cafe-mid-scarborough-fall-2026':3,
 'repair-cafe-creative-reuse-fall-2026':15,
 'bad-dog-improv-drop-ins-fall-2026':10,
 'tpl-story-planet-comic-lab-fall-2026':6,
 'tpl-weston-book-club-fall-2026':5,
 'tranzac-epic-klezmer-jam-fall-2026':4,
 'tranzac-cabaret-open-mic-fall-2026':3,
 'tpl-east-end-writers-group-fall-2026':3,
 'tpl-poetry-fridays-fall-2026':2,
 'harbourfront-dancing-on-square-2026':3,
};
for(const [id,n] of Object.entries(benchmarks)){assert(byId.has(id),`Benchmark parent missing ${id}`);assert(childCount(id)===n,`${id}: expected ${n} children; found ${childCount(id)}`)}
const requiredFormats=['open-mic-stage','writing-poetry-circle','book-reading-group','conversation-language','storytelling','zine-comics','board-tabletop-games','game-jam-hackathon','maker-repair-craft','public-art-making','social-dance','music-jam','improv-theatre'];
for(const form of requiredFormats) assert(batch.some(e=>e.participatory_formats.includes(form)),`Set 11 format absent: ${form}`);
const watches=['toronto-contra-dance-2026-27-season','tojam-2027-watch','breakout-con-2027-watch'];
for(const id of watches){const e=byId.get(id);assert(e&&e.confirmation_status==='unconfirmed',`${id}: qualified watch status drifted`);assert((e.qualification_reasons||[]).includes('current-edition-unconfirmed'),`${id}: annual-watch qualification missing`)}
const qualified=batch.filter(e=>e.confirmation_status!=='confirmed');
assert(qualified.length===9,'Set 11 qualified-record inventory drifted');
for(const e of qualified){assert((e.qualification_reasons||[]).length,`${e.id}: qualified record lacks reasons`);if(e.time_precision==='unknown')assert((e.qualification_reasons||[]).includes('time-unconfirmed'),`${e.id}: unknown time lacks time-unconfirmed qualification`)}
for(const id of ledger.cross_tagged_existing_ids){const e=byId.get(id);assert(e,`Cross-tagged existing record missing ${id}`);assert((e.research_set_cross_tags||[]).includes(SET),`${id}: Set 11 cross-tag missing`);assert((e._upsert_batches||[]).includes(SRC),`${id}: Set 11 upsert provenance missing`)}
const medusa=byId.get('soulpepper-medusa-talkback-2026-07-08');
assert(medusa&&medusa.talkback_status==='confirmed'&&medusa.director_attendance_status==='unconfirmed','Medusa regression failed');
assert(consolidated.length===publicEvents.length&&consolidated.length>=1700,`Set 11 baseline requires at least 1,700 canonical/public records; found ${consolidated.length}/${publicEvents.length}`);
for(const f of ['participatory_formats','participation_mode','participation_roles','facilitation_status','skill_level','drop_in_status','participation_required','participation_evidence']) assert(schema.properties?.[f],`Schema missing ${f}`);
const taxonomy=readJson('polymythseminars/browse.json').taxonomy, revamp=readText('scripts/lib/polymythcal-discovery-model.js'), detail=readText('scripts/build-polymythcal-audit13.py');
for(const value of requiredFormats) assert(taxonomy?.axes?.participationFormats?.values?.[value]?.en&&taxonomy?.axes?.participationFormats?.values?.[value]?.fr,`Bilingual Research taxonomy lacks Participation facet ${value}`);
for(const marker of ['participationFormats','participatory_formats','participation_mode']) assert(revamp.includes(marker),`Participation discovery model missing ${marker}`);
for(const marker of ['Participation formats','Participation mode','Participation roles','Participation evidence']) assert(detail.includes(marker),`Participation detail surface missing ${marker}`);
const build=String(pkg.scripts?.['build:locked']||'');
for(const marker of ['import-polymythcal-participatory-cultural-set11-2026-08-14.py','node scripts/upsert-manual-calendar-events.js','verify-polymythcal-participatory-cultural-set11-2026-08-14.js']) assert(build.includes(marker),`build:locked missing ${marker}`);
assert((build.match(/(?:^| && )node scripts\/upsert-manual-calendar-events\.js(?= && |$)/g)||[]).length===1,'build:locked must contain exactly one unfiltered manual-event upsert');
assert(!/node scripts\/upsert-manual-calendar-events\.js\s+--/.test(build),'build:locked must not restore a filtered manual-event upsert');
assert(pkg.scripts['import:polymythcal-participatory-cultural-set11-2026-08-14'],'Missing Set 11 import alias');
assert(pkg.scripts['verify:polymythcal-participatory-cultural-set11-2026-08-14'],'Missing Set 11 verify alias');
const clRows=readText('data/website-cl.jsonl').trim().split(/\n+/).map(JSON.parse),cl=new Map(clRows.map(r=>[r.id,r]));
for(let n=260;n<=267;n++) assert(cl.get(`CL-WEB-${n}`)?.status==='complete',`CL-WEB-${n} missing/incomplete`);
assert(/113 Set 11 records/.test(cl.get('CL-WEB-266')?.decision||''),'CL-WEB-266 record count drifted');
for(const rel of ['WEBSITE_CL_2026-07-19.md','docs/WEBSITE_CL_2026-07-19.md']){const t=readText(rel);assert(t.includes('CL-WEB-267'),`${rel}: Set 11 section incomplete`)}
console.log(JSON.stringify({manual_records:manual.length,consolidated_records:consolidated.length,set11_records:batch.length,parent_records:parents.length,child_occurrences:children.length,confirmed_records:meta.confirmed_records,qualified_watches:watches.length,sources:sourceRows.length,change_list:'CL-WEB-260 through CL-WEB-267 complete'},null,2));

