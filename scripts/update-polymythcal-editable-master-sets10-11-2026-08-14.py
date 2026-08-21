#!/usr/bin/env python3
"""Append reconstructed Set 10 and integrated Set 11 state to the private editable master."""
from __future__ import annotations
import hashlib, json
from pathlib import Path

SITE_ROOT=Path(__file__).resolve().parents[1]
DELIVERY_ROOT=SITE_ROOT.parent
EDITABLE_ROOT=DELIVERY_ROOT/'EDITABLE_MASTERS'
MASTER=EDITABLE_ROOT/'05_POLYMYTHCAL'/'Polymythcal_Research_and_Remediation_Plan.json'
MANIFEST=EDITABLE_ROOT/'EDITABLE_MASTERS_MANIFEST.json'
SUMS=EDITABLE_ROOT/'SHA256SUMS.txt'
MANUAL=SITE_ROOT/'data'/'manual-events.json'
CONSOLIDATED=SITE_ROOT/'data'/'polymyth-seminar-events.json'
PUBLIC=SITE_ROOT/'polymythseminars'/'events.json'
SOURCES=SITE_ROOT/'scripts'/'sources.json'
LEDGER10=SITE_ROOT/'data'/'polymythcal-research-set-10-arts-reconstruction-2026-08-14.json'
LEDGER11=SITE_ROOT/'data'/'polymythcal-research-set-11-participatory-cultural-2026-08-14.json'
KEY10='arts_performance_exhibitions_festivals_set10_reconstruction_2026_08_14'
KEY11='participatory_cultural_set11_update_2026_08_14'
BASE_ARCHIVE={
 'filename':'SeminarSchools-Polymythcal-Set-9-Public-Intellectual-Academic-CL-244-251-Complete-2026-08-13.zip',
 'bytes':226837813,
 'sha256':'d3f9b9cb15ec44511c82e728eaf67e0863c4131a947963c611f6671ce121863a',
}

def sha256(path:Path)->str:
 h=hashlib.sha256()
 with path.open('rb') as f:
  for block in iter(lambda:f.read(1024*1024),b''): h.update(block)
 return h.hexdigest()

def load(path:Path): return json.loads(path.read_text(encoding='utf-8'))
def events(doc): return doc if isinstance(doc,list) else doc.get('events',[])

def update_manifest():
 digest=sha256(MASTER); size=MASTER.stat().st_size
 manifest=load(MANIFEST); rows=manifest.get('files') or []
 match=[r for r in rows if r.get('path')=='05_POLYMYTHCAL/Polymythcal_Research_and_Remediation_Plan.json']
 if len(match)!=1: raise SystemExit('Editable master manifest must contain exactly one Polymythcal row.')
 match[0].update({'bytes':size,'sha256':digest,'status':'preserved historical source context plus append-only Set 10 reconstruction and Set 11 participatory-culture ledger; never publish'})
 manifest['generated_on']='2026-08-14'
 MANIFEST.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 sums={}
 for line in SUMS.read_text(encoding='utf-8').splitlines():
  if line.strip():
   expected,relative=line.split(None,1); sums[relative.strip()]=expected
 sums['05_POLYMYTHCAL/Polymythcal_Research_and_Remediation_Plan.json']=digest
 SUMS.write_text(''.join(f'{v}  {k}\n' for k,v in sorted(sums.items())),encoding='utf-8')

def main():
 manual_doc=load(MANUAL); manual=events(manual_doc)
 consolidated=events(load(CONSOLIDATED)); public=events(load(PUBLIC))
 ledger10=load(LEDGER10); ledger11=load(LEDGER11)
 meta10=manual_doc.get('polymythcal_arts_set10_reconstruction_2026_08_14') or {}
 meta11=manual_doc.get('polymythcal_participatory_cultural_set11_update_2026_08_14') or {}
 batch10=[e for e in manual if 'manual-polymythcal-arts-set10-reconstruction-2026-08-14' in (e.get('_upsert_batches') or [])]
 batch11=[e for e in manual if e.get('_src')=='manual-polymythcal-participatory-cultural-set11-2026-08-14']
 if len(batch10)!=482 or ledger10.get('record_count')!=486:
  raise SystemExit(f'Refusing editable-master update: Set 10 counts {len(batch10)}/{ledger10.get("record_count")}, expected 482/486 after the Sets 12-14 cross-classifications.')
 if len(batch11)!=113 or ledger11.get('record_count')!=113:
  raise SystemExit(f'Refusing editable-master update: Set 11 counts {len(batch11)}/{ledger11.get("record_count")}, expected 113/113.')
 if not (len(consolidated)==len(public) and len(consolidated)>=1700):
  raise SystemExit(f'Refusing editable-master update: canonical/public counts {len(consolidated)}/{len(public)}, expected matching counts at or above the 1700-record Set 11 baseline.')
 if (meta10.get('stable_public_ids_backfilled')!=67
     or meta10.get('canonical_duplicate_records_not_upserted')!=4
     or meta10.get('unresolved_legacy_records_without_ids')!=0
     or meta10.get('set12_arts_records_cross_classified')!=1):
  raise SystemExit('Refusing editable-master update: Set 10 stable-ID/duplicate accounting drifted.')
 if (meta11.get('parent_records')!=12 or meta11.get('child_occurrences')!=54
     or meta11.get('confirmed_records')!=104 or meta11.get('qualified_records')!=9):
  raise SystemExit('Refusing editable-master update: Set 11 series/qualification accounting drifted.')
 source_doc=load(SOURCES); source_rows=source_doc if isinstance(source_doc,list) else source_doc.get('sources',[])
 master=load(MASTER)
 master[KEY10]={
  'status':'reconstructed_from_verified_set9_and_integrated_into_editable_and_public_site_source',
  'implemented_at':'2026-08-14T22:00:00-04:00',
  'base_archive':BASE_ARCHIVE,
  'research_set':'10-Arts-Performance-Exhibitions-and-Festivals',
  'reconstruction_limit':'The previously claimed Set 10 archive was not present. This layer was rebuilt from the verified Set 9 release and does not claim recovery of the missing archive.',
  'ledger_records':486,
  'baseline_set9_arts_records':401,
  'post_set9_arts_records_cross_classified':85,
  'set11_arts_records_cross_classified':62,
  'set11_existing_records_cross_tagged':3,
  'set12_arts_records_cross_classified':1,
  'set13_benefit_performance_records_cross_classified':11,
  'set14_live_media_records_cross_classified':12,
  'upsert_eligible_records':482,
  'stable_public_ids_backfilled':67,
  'canonical_duplicate_records_not_upserted':4,
  'unresolved_legacy_records_without_ids':0,
  'occurrence_roles':meta10.get('occurrence_roles'),
  'decisions':[
   'Existing identities, source lineage, accepted content, and creator-presence evidence remain authoritative.',
   'Arts form, discipline, access, and occurrence role are independent searchable dimensions.',
   'Programme parents, dated children, multi-day runs, and single occurrences remain separate.',
   'A production credit never proves attendance at a particular occurrence.',
   'Canonical duplicates remain holdouts rather than generating new public identities.',
  ],
  'implementation_files':[
   'SITE_PACKAGE/scripts/import-polymythcal-arts-set10-reconstruction-2026-08-14.py',
   'SITE_PACKAGE/scripts/verify-polymythcal-arts-set10-reconstruction-2026-08-14.js',
   'SITE_PACKAGE/data/polymythcal-research-set-10-arts-reconstruction-2026-08-14.json',
   'SITE_PACKAGE/data/polymythcal-event-schema-v2.json',
   'SITE_PACKAGE/js/polymythcal-revamp.js',
  ],
  'verification':{'manual_records':len(manual),'consolidated_records':len(consolidated),'public_records':len(public),'sources':len(source_rows),'status':'pass'},
  'deployment_status':'updated_deployable_source_and_public_mirror_not_live_deployed',
  'change_list':[f'CL-WEB-{n}' for n in range(252,260)],
  'research_ledger':{'path':'SITE_PACKAGE/data/polymythcal-research-set-10-arts-reconstruction-2026-08-14.json','sha256':sha256(LEDGER10),'record_count':ledger10.get('record_count'),'set11_cross_classified':ledger10.get('set11_arts_records_cross_classified'),'set11_existing_cross_tagged':ledger10.get('set11_existing_records_cross_tagged'),'set12_cross_classified':ledger10.get('set12_arts_records_cross_classified')},
 }
 master[KEY11]={
  'status':'integrated_into_editable_and_public_site_source',
  'implemented_at':'2026-08-14T22:00:00-04:00',
  'base_archive':BASE_ARCHIVE,
  'research_set':'11-Participatory-Cultural-Events',
  'records':113,
  'net_new_records':113,
  'existing_records_cross_tagged':5,
  'parent_records':12,
  'child_occurrences':54,
  'confirmed_records':104,
  'qualified_records':9,
  'scope':[
   'open stages, poetry and writing circles, reading groups, language conversation, and storytelling',
   'zines, comics, tabletop play, game jams, repair, making, and public art-making',
   'social dance, music jams, improv, and other actively participatory performance forms',
  ],
  'decisions':[
   'A Set 11 entry requires an evidenced active role beyond passive attendance.',
   'Participation mode, participant roles, facilitation, skill level, registration, drop-in status, and access are independent fields.',
   'Series parents and dated occurrences remain separate and linked.',
   'A recurring facility or general programme page does not prove an unlisted occurrence.',
   'Annual watches remain qualified; exact future dates are never invented.',
  ],
  'implementation_files':[
   'SITE_PACKAGE/scripts/import-polymythcal-participatory-cultural-set11-2026-08-14.py',
   'SITE_PACKAGE/scripts/verify-polymythcal-participatory-cultural-set11-2026-08-14.js',
   'SITE_PACKAGE/data/polymythcal-research-set-11-participatory-cultural-2026-08-14.json',
   'SITE_PACKAGE/data/polymythcal-event-schema-v2.json',
   'SITE_PACKAGE/js/polymythcal-revamp.js',
  ],
  'verification':{'manual_records':len(manual),'consolidated_records':len(consolidated),'public_records':len(public),'sources':len(source_rows),'set11_manual_consolidated_public':'113/113/113','status':'pass'},
  'deployment_status':'updated_deployable_source_and_public_mirror_not_live_deployed',
  'change_list':[f'CL-WEB-{n}' for n in range(260,268)],
  'research_ledger':{'path':'SITE_PACKAGE/data/polymythcal-research-set-11-participatory-cultural-2026-08-14.json','sha256':sha256(LEDGER11),'record_count':ledger11.get('record_count'),'exclusion_count':len(ledger11.get('exclusions') or [])},
 }
 MASTER.write_text(json.dumps(master,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
 update_manifest()
 print(json.dumps({'master':str(MASTER),'set10_records':486,'set11_records':113,'bytes':MASTER.stat().st_size,'sha256':sha256(MASTER)},indent=2))
if __name__=='__main__': main()
