#!/usr/bin/env node
'use strict';
const fs=require('fs');const path=require('path');const root=path.resolve(__dirname,'..');
const readJson=rel=>JSON.parse(fs.readFileSync(path.join(root,rel),'utf8'));
const readText=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg)};const list=p=>Array.isArray(p)?p:(p.events||[]);
const SRC='manual-polymythcal-media-literacy-set5-2026-08-13',SET='5-Media-Literacy';
const manualDoc=readJson('data/manual-events.json'),manual=list(manualDoc);
const consolidated=list(readJson('data/polymyth-seminar-events.json'));
const publicEvents=list(readJson('polymythseminars/events.json'));
const sourcesDoc=readJson('scripts/sources.json'),sources=Array.isArray(sourcesDoc)?sourcesDoc:(sourcesDoc.sources||[]);
const schema=readJson('data/polymythcal-event-schema-v2.json');
const ledger=readJson('data/polymythcal-research-set-5-media-literacy-2026-08-13.json');
const pkg=readJson('package.json');const batch=manual.filter(e=>e._src===SRC);
assert(batch.length===73,`Expected 73 Set 5 records; found ${batch.length}`);
const meta=manualDoc.polymythcal_media_literacy_set5_update_2026_08_13;
assert(meta&&meta.records_in_delta===73,'Set 5 metadata count drifted');
assert(meta.existing_records_cross_tagged===9,'Set 5 cross-tag count drifted');
assert(ledger.record_count===73&&ledger.research_set===SET,'Set 5 research ledger drifted');
const sourceIds=new Set(sources.map(s=>String(s.id||''))),ids=new Set();
for(const e of batch){
 assert(e.id&&!ids.has(e.id),`Missing or duplicate Set 5 ID ${e.id}`);ids.add(e.id);
 assert(e.source_url&&sourceIds.has(String(e.source_id||'')),`${e.id}: unresolved source`);
 assert(['event','opportunity'].includes(e.record_kind),`${e.id}: invalid record_kind ${e.record_kind}`);
 assert(['confirmed','unconfirmed'].includes(e.confirmation_status),`${e.id}: bad confirmation status`);
 assert(e.research_set===SET,`${e.id}: missing research_set`);
 assert(Array.isArray(e.media_literacy_subfields)&&e.media_literacy_subfields.length,`${e.id}: missing media_literacy_subfields`);
 assert((e.subjects||[]).includes('Media Literacy'),`${e.id}: missing Media Literacy subject`);
 assert((e.topics||[]).includes('media-literacy'),`${e.id}: missing media-literacy topic`);
 assert(e.entry_family==='media-literacy',`${e.id}: wrong entry_family`);
 if(e.confirmation_status==='unconfirmed'){
  const reasons=new Set(e.qualification_reasons||[]);
  assert(reasons.size>0,`${e.id}: unconfirmed record lacks qualification reasons`);
  if(e.date_precision==='estimated'){
   assert(/monitoring marker, not a confirmed/i.test(e.description||''),`${e.id}: watch marker not disclosed`);
   assert([...reasons].some(reason=>/date.*unconfirmed/.test(reason)),`${e.id}: estimated watch lacks date-unconfirmed evidence`);
  }else{
   assert(['date','month'].includes(e.date_precision),`${e.id}: unsupported partial date precision ${e.date_precision}`);
   assert(e.time_precision==='unknown'&&reasons.has('time-unconfirmed'),`${e.id}: partial date must disclose an unpublished time`);
  }
 }
}
const byId=new Map(manual.map(e=>[e.id,e]));const req=id=>{const e=byId.get(id);assert(e,`Missing required record ${id}`);return e};
const child=id=>{const e=req(id);assert(e.parent_id&&byId.has(e.parent_id),`${id}: unresolved parent`);assert(e.series_role==='child',`${id}: missing child role`);return e};
[
 'sony-world-photography-student-2027-deadline','hot-docs-2027-festival','connecther-film-festival-2026-deadline',
 'one-earth-young-filmmakers-2027-deadline','my-hero-international-film-festival-2026-deadline','regard-festival-2027',
 'scms-2027-conference','ica-2027-conference','caj-2027-conference','nspa-2027-convention','acp-spring-conference-2027',
 'codeart-game-design-2027-deadline','global-game-jam-2027','igf-2027','breakthrough-junior-challenge-2026-results',
 'nsac-2027-national-final','unesco-global-media-information-literacy-week-2026'
].forEach(req);
[
 'hot-docs-2027-submissions-open','hot-docs-2027-early-deadline','hot-docs-2027-regular-deadline','hot-docs-2027-late-deadline',
 'regard-2027-early-deadline','regard-2027-regular-deadline','scms-2027-cfp-deadline','ica-2027-cfp-deadline',
 'nspa-innovation-2027-deadline','acp-pacemaker-2027-deadline','global-game-jam-2027-site-registration',
 'igf-2027-submission-deadline','breakthrough-junior-challenge-2026-submission','nsac-2027-plans-book-deadline'
].forEach(child);
const oneEarth=req('one-earth-young-filmmakers-2027-deadline');
assert(oneEarth.exact_grades.length===10&&oneEarth.exact_grades[0]==='Grade 3'&&oneEarth.exact_grades.at(-1)==='Grade 12','One Earth Grade 3–12 indexing failed');
const codeart=req('codeart-game-design-2027-deadline');
assert(codeart.exact_grades.length===10&&codeart.grade_min===3&&codeart.grade_max===12,'Code/Art Grade 3–12 indexing failed');
assert(req('jea-media-poster-2026-deadline').institutional_restriction.includes('United States'),'JEA restriction missing');
assert(/stale 2022/i.test(req('my-hero-international-film-festival-2026-deadline').source_inconsistency||''),'MY HERO inconsistency missing');
assert(/conflict between April 15/i.test(req('nspa-2027-convention').source_inconsistency||''),'NSPA date conflict missing');
assert(/human authorship/i.test(req('connecther-film-festival-2026-deadline').ai_rule||''),'ConnectHER AI rule missing');
const cross={
 'soulpepper-medusa-2026':'manual-polymythcal-comprehensive-2026-08-13',
 'soulpepper-medusa-talkback-2026-07-08':'manual-polymythcal-comprehensive-2026-08-13',
 'neuroethics-essay-contest-2026':'manual-polymythcal-comprehensive-2026-08-13',
 'legion-video-contest-2026':'manual-polymythcal-comprehensive-2026-08-13',
 'capture-ton-patrimoine-2027':'manual-polymythcal-comprehensive-2026-08-13',
 'lance-ton-balado-2027':'manual-polymythcal-comprehensive-2026-08-13',
 'canadian-literature-graphic-autobiography-2027':'manual-polymythcal-comprehensive-2026-08-13',
 'carkner-labour-history-media-2027-watch':'manual-polymythcal-comprehensive-2026-08-13',
 'oral-history-multimedia-award-2027':'manual-polymythcal-comprehensive-2026-08-13'
};
for(const [id,src] of Object.entries(cross)){const e=req(id);assert(e._src===src,`${id}: source identity overwritten`);assert((e.media_literacy_subfields||[]).length,`${id}: Media Literacy cross-tag missing`);assert((e.research_set_cross_tags||[]).includes(SET),`${id}: research cross-tag missing`)}
assert(manual.filter(e=>e._src==='manual-polymythcal-comprehensive-2026-08-13').length===292,'Sets 1–3 batch changed');
assert(manual.filter(e=>e._src==='manual-polymythcal-social-studies-set4-2026-08-13').length===68,'Set 4 batch changed');
const cids=new Set(consolidated.map(e=>e.id)),pids=new Set(publicEvents.map(e=>e.id));
for(const e of batch){assert(cids.has(e.id),`${e.id}: absent from consolidated data`);assert(pids.has(e.id),`${e.id}: absent from public data`)}
assert(consolidated.length===publicEvents.length,'Canonical/public count mismatch');
for(const f of ['media_literacy_subfields','subjects','topics','research_set','research_set_cross_tags','calendar_stage','series_role']) assert(schema.properties?.[f],`Schema missing ${f}`);
const taxonomy=readJson('polymythseminars/browse.json').taxonomy,revamp=readText('scripts/lib/polymythcal-discovery-model.js');
assert(taxonomy?.axes?.topics?.values?.['media-literacy']?.en&&taxonomy?.axes?.topics?.values?.['media-literacy']?.fr,'Bilingual Research taxonomy lacks Media Literacy');
for(const n of ['media-literacy','subjects','entry_family']) assert(revamp.includes(n),`Discovery classifier/search missing ${n}`);
const clRows=readText('data/website-cl.jsonl').trim().split(/\n+/).map(JSON.parse),cl=new Map(clRows.map(r=>[r.id,r]));
for(let n=212;n<=219;n++){const id=`CL-WEB-${n}`;assert(cl.get(id)?.status==='complete',`Component List missing/incomplete ${id}`)}
for(const rel of ['WEBSITE_CL_2026-07-19.md','docs/WEBSITE_CL_2026-07-19.md']){const t=readText(rel);assert(t.includes('Completed in Polymythcal Set 5 — Media Literacy'),`${rel}: missing Set 5 section`);assert(t.includes('CL-WEB-219'),`${rel}: missing final Set 5 component`)}
const build=String(pkg.scripts?.['build:locked']||'');
for(const n of ['import-polymythcal-media-literacy-set5-2026-08-13.py','node scripts/upsert-manual-calendar-events.js','verify-polymythcal-media-literacy-set5-2026-08-13.js']) assert(build.includes(n),`build:locked missing ${n}`);
assert((build.match(/(?:^| && )node scripts\/upsert-manual-calendar-events\.js(?= && |$)/g)||[]).length===1,'build:locked must contain exactly one unfiltered manual-event upsert');
assert(!/node scripts\/upsert-manual-calendar-events\.js\s+--/.test(build),'build:locked must not restore a filtered manual-event upsert');
assert(pkg.scripts['import:polymythcal-media-literacy-set5-2026-08-13'],'Missing Set 5 import alias');
assert(pkg.scripts['verify:polymythcal-media-literacy-set5-2026-08-13'],'Missing Set 5 verify alias');
console.log(JSON.stringify({manual_records:manual.length,consolidated_records:consolidated.length,set5_records:batch.length,confirmed:batch.filter(e=>e.confirmation_status==='confirmed').length,qualified_watches:batch.filter(e=>e.confirmation_status==='unconfirmed').length,sources:sources.length,change_list:'CL-WEB-212 through CL-WEB-219 complete'},null,2));

