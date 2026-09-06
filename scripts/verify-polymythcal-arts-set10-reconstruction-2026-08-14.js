#!/usr/bin/env node
'use strict';
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const readJson=rel=>JSON.parse(fs.readFileSync(path.join(root,rel),'utf8'));
const readText=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg)};
const list=d=>Array.isArray(d)?d:(d.events||[]);
const SRC='manual-polymythcal-arts-set10-reconstruction-2026-08-14';
const SET='10-Arts-Performance-Exhibitions-and-Festivals';
const manualDoc=readJson('data/manual-events.json');
const manual=list(manualDoc);
const byId=new Map(manual.filter(e=>e.id).map(e=>[e.id,e]));
const consolidated=list(readJson('data/polymyth-seminar-events.json'));
const publicEvents=list(readJson('polymythseminars/events.json'));
const cById=new Map(consolidated.map(e=>[e.id,e]));
const pById=new Map(publicEvents.map(e=>[e.id,e]));
const ledger=readJson('data/polymythcal-research-set-10-arts-reconstruction-2026-08-14.json');
const schema=readJson('data/polymythcal-event-schema-v2.json');
const pkg=readJson('package.json');
const meta=manualDoc.polymythcal_arts_set10_reconstruction_2026_08_14;
assert(meta,'Set 10 metadata missing');
// The synthesized Sets 1-15 corpus adds 11 evidenced Set 13 benefit
// performances and 12 Set 14 arts/media occurrences to the preserved Set 10
// reconstruction.  These are cross-classifications of existing identities, not
// new Set 10 identities.
const expected={records_enriched:486,baseline_set9_arts_records:401,post_set9_arts_records_cross_classified:85,set11_arts_records_cross_classified:62,set11_existing_records_cross_tagged:3,set12_arts_records_cross_classified:1,upsert_eligible_records:482,canonical_duplicate_records_not_upserted:4,stable_public_ids_backfilled:67,unresolved_legacy_records_without_ids:0};
for(const [k,v] of Object.entries(expected)) assert(meta[k]===v,`Set 10 metadata ${k} expected ${v}; found ${meta[k]}`);
assert(meta.reconstruction_note&&/verified Set 9 archive/i.test(meta.reconstruction_note),'Set 10 reconstruction provenance missing');
assert(ledger.research_set===SET&&ledger.record_count===486,'Set 10 ledger count/scope drifted');
assert(ledger.set11_arts_records_cross_classified===62&&ledger.set11_existing_records_cross_tagged===3&&ledger.set12_arts_records_cross_classified===1,'Set 10 later-set cross-classification accounting drifted');
assert(ledger.stable_public_ids_backfilled===67,'Set 10 ledger stable-ID count drifted');
assert((ledger.unresolved_no_id||[]).length===0,'Set 10 unresolved legacy count drifted');
assert((ledger.canonical_duplicates_not_upserted||[]).length===4,'Set 10 duplicate holdout count drifted');
assert((ledger.notes||[]).some(n=>/not a claim that a missing Set 10 archive was recovered/i.test(n)),'Set 10 ledger must state reconstruction limitation');

const batch=manual.filter(e=>(e._upsert_batches||[]).includes(SRC));
assert(batch.length===482,`Expected 482 Set 10 upsert-eligible records; found ${batch.length}`);
const ids=new Set();
for(const e of batch){
 assert(e.id&&!ids.has(e.id),`Missing/duplicate Set 10 ID ${e.id}`); ids.add(e.id);
 assert(Array.isArray(e.arts_event_forms)&&e.arts_event_forms.length,`${e.id}: arts forms missing`);
 assert(Array.isArray(e.arts_disciplines)&&e.arts_disciplines.length,`${e.id}: arts disciplines missing`);
 assert(typeof e.arts_occurrence_role==='string'&&e.arts_occurrence_role,`${e.id}: arts occurrence role missing`);
 assert(typeof e.arts_access_status==='string'&&e.arts_access_status,`${e.id}: arts access missing`);
 assert(e.set10_classified_at,`${e.id}: Set 10 classification timestamp missing`);
 assert(cById.has(e.id),`${e.id}: absent from consolidated corpus`);
 assert(pById.has(e.id),`${e.id}: absent from public corpus`);
}
const requiredForms=['theatre-performance','dance-performance','music-performance','opera-orchestral','exhibition','festival','public-art-site-specific','artist-curator-program','screening-film-festival','talkback-discussion','multidisciplinary-performance'];
for(const form of requiredForms) assert(batch.some(e=>e.arts_event_forms.includes(form)),`Set 10 form absent: ${form}`);
for(const role of ['parent','child','run','single-occurrence']) assert(batch.some(e=>e.arts_occurrence_role===role),`Set 10 occurrence role absent: ${role}`);
const roleCounts=meta.occurrence_roles||{};
assert(roleCounts.parent===29&&roleCounts.child===104&&roleCounts.run===167&&roleCounts['single-occurrence']===186,'Set 10 occurrence-role accounting drifted');

// Duplicate holdouts must remain represented by the canonical public identities, never as duplicate upserts.
for(const row of ledger.canonical_duplicates_not_upserted){
 assert(row.duplicate_of,`Set 10 holdout lacks canonical target: ${row.title}`);
 assert(cById.has(row.duplicate_of)&&pById.has(row.duplicate_of),`Set 10 canonical duplicate target absent: ${row.duplicate_of}`);
 assert(!batch.some(e=>e.id===row.duplicate_of&&e.title===row.title&&e.date===row.date),`Set 10 holdout was duplicated: ${row.title}`);
}

// Set 11 cross-classification and prior creator-presence evidence survive.
const set11Cross=batch.filter(e=>e.research_set=== '11-Participatory-Cultural-Events' || (e.research_set_cross_tags||[]).includes('11-Participatory-Cultural-Events'));
assert(set11Cross.length>=62,`Expected at least 62 Set 11 arts cross-classifications; found ${set11Cross.length}`);
const set12Cross=batch.filter(e=>e.research_set==='12-Civic-Political-Legal-Labour-Events'||(e.research_set_cross_tags||[]).includes('12-Civic-Political-Legal-Labour-Events'));
assert(set12Cross.length===1&&set12Cross[0].id==='toronto-mayworks-2027-watch','Set 12 arts/labour crossover drifted');
const set13Cross=batch.filter(e=>e.research_set==='13-Community-Charity-Mutual-Aid-Heritage-Place');
const set14Cross=batch.filter(e=>e.research_set==='14-Live-Media-and-Digitally-Native-Events');
assert(set13Cross.length===11,'Set 13 benefit-performance arts cross-classification drifted');
assert(set14Cross.length===12,'Set 14 live-media arts cross-classification drifted');
const medusa=byId.get('soulpepper-medusa-talkback-2026-07-08');
assert(medusa&&medusa.talkback_status==='confirmed'&&medusa.director_attendance_status==='unconfirmed','Medusa creator-presence regression failed');
assert((medusa.arts_event_forms||[]).includes('talkback-discussion'),'Medusa Set 10 talkback classification missing');

assert(consolidated.length===publicEvents.length,'Canonical/public count mismatch');
assert(consolidated.length>=1700,`Set 10 baseline requires at least 1,700 public records; found ${consolidated.length}`);
for(const f of ['arts_event_forms','arts_disciplines','arts_occurrence_role','arts_access_status','set10_classified_at']) assert(schema.properties?.[f],`Schema missing ${f}`);
const taxonomy=readJson('polymythseminars/research.json').taxonomy;
const revamp=readText('scripts/lib/polymythcal-discovery-model.js');
const detail=readText('scripts/build-polymythcal-audit13.py');
for(const value of requiredForms) assert(taxonomy?.axes?.artsFormats?.values?.[value]?.en&&taxonomy?.axes?.artsFormats?.values?.[value]?.fr,`Bilingual Research taxonomy lacks Arts facet ${value}`);
for(const marker of ['artsFormats','arts_event_forms','allowedDeclared','classifyTopics']) assert(revamp.includes(marker),`Arts discovery model missing ${marker}`);
for(const marker of ['Arts disciplines','Arts occurrence role']) assert(detail.includes(marker),`Arts detail evidence missing ${marker}`);
const build=String(pkg.scripts?.['build:locked']||'');
for(const marker of ['import-polymythcal-arts-set10-reconstruction-2026-08-14.py','node scripts/upsert-manual-calendar-events.js','verify-polymythcal-arts-set10-reconstruction-2026-08-14.js']) assert(build.includes(marker),`build:locked missing ${marker}`);
assert((build.match(/(?:^| && )node scripts\/upsert-manual-calendar-events\.js(?= && |$)/g)||[]).length===1,'build:locked must contain exactly one unfiltered manual-event upsert');
assert(!/node scripts\/upsert-manual-calendar-events\.js\s+--/.test(build),'build:locked must not restore a filtered manual-event upsert');
assert(pkg.scripts['import:polymythcal-arts-set10-reconstruction-2026-08-14'],'Missing Set 10 import alias');
assert(pkg.scripts['verify:polymythcal-arts-set10-reconstruction-2026-08-14'],'Missing Set 10 verifier alias');
const clRows=readText('data/website-cl.jsonl').trim().split(/\n+/).map(JSON.parse), cl=new Map(clRows.map(r=>[r.id,r]));
for(let n=252;n<=259;n++) assert(cl.get(`CL-WEB-${n}`)?.status==='complete',`CL-WEB-${n} missing/incomplete`);
assert(/401 baseline arts records/.test(cl.get('CL-WEB-258')?.decision||''),'CL-WEB-258 baseline count drifted');
for(const rel of ['WEBSITE_CL_2026-07-19.md','docs/WEBSITE_CL_2026-07-19.md']){
 const t=readText(rel); assert(t.includes('CL-WEB-259'),`${rel}: Set 10 section incomplete`);
}
console.log(JSON.stringify({manual_records:manual.length,consolidated_records:consolidated.length,set10_ledger_records:ledger.record_count,set10_upsert_records:batch.length,stable_ids_backfilled:meta.stable_public_ids_backfilled,duplicate_holdouts:ledger.canonical_duplicates_not_upserted.length,change_list:'CL-WEB-252 through CL-WEB-259 complete'},null,2));
