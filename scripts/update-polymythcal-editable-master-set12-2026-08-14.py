#!/usr/bin/env python3
"""Append Set 12 civic/political/legal/labour state to the private editable master."""
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
LEDGER=SITE_ROOT/'data'/'polymythcal-research-set-12-civic-political-legal-labour-2026-08-14.json'
KEY='civic_political_legal_labour_set12_update_2026_08_14'
SRC='manual-polymythcal-civic-political-legal-labour-set12-2026-08-14'
SET='12-Civic-Political-Legal-Labour-Events'
BASE_ARCHIVE={
 'filename':'SeminarSchools-Polymythcal-Sets-10-11-Arts-Participatory-Culture-CL-252-267-Complete-2026-08-14.zip',
 'bytes':228626733,
 'sha256':'47e51016224cc3b22cc550d86e95563f45c5d0078d5da9e08bdd26cfb4d3c4d5',
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
 match[0].update({'bytes':size,'sha256':digest,'status':'preserved historical source context plus append-only Set 12 civic/political/legal/labour ledger; never publish'})
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
 ledger=load(LEDGER); meta=manual_doc.get('polymythcal_civic_political_legal_labour_set12_update_2026_08_14') or {}
 batch=[e for e in manual if e.get('_src')==SRC]
 if len(batch)!=142 or ledger.get('record_count')!=142:
  raise SystemExit(f'Refusing editable-master update: Set 12 counts {len(batch)}/{ledger.get("record_count")}, expected 142/142.')
 if not (len(manual)>=1552 and len(consolidated)==len(public) and len(public)>=1842):
  raise SystemExit(f'Refusing editable-master update: manual/canonical/public counts {len(manual)}/{len(consolidated)}/{len(public)} fall below the repaired Set 12 baseline or disagree.')
 if meta.get('parent_records')!=14 or meta.get('child_occurrences')!=107 or meta.get('confirmed_records')!=87 or meta.get('qualified_records')!=55:
  raise SystemExit('Refusing editable-master update: Set 12 structure/qualification accounting drifted.')
 source_doc=load(SOURCES); source_rows=source_doc if isinstance(source_doc,list) else source_doc.get('sources',[])
 master=load(MASTER)
 master[KEY]={
  'status':'integrated_into_editable_and_public_site_source',
  'implemented_at':'2026-08-14T23:55:00-04:00',
  'base_archive':BASE_ARCHIVE,
  'research_set':SET,
  'records':142,
  'net_new_records':142,
  'existing_records_cross_tagged':25,
  'parent_records':14,
  'child_occurrences':107,
  'confirmed_records':87,
  'qualified_records':55,
  'court_hearings':31,
  'election_records':30,
  'scope':[
   'election and voting cycles, candidate and compliance stages',
   'councils, boards, committees, public hearings, deputations, consultations, legislatures, and parliamentary sittings',
   'courts, tribunals, inquests, public inquiries, publication limits, and webcast access',
   'union governance and education, rallies, marches, counter-protests, pickets, strikes, and labour commemorations',
  ],
  'fields':['civic_legal_labour_formats','civic_domain','authority_level','public_role','participation_route','public_input_status','legal_access_status','collective_action_type','election_stage','access_restrictions','webcast_status','publication_restriction','alternate_dates','civic_evidence'],
  'front_facing_formats':['election-voting','candidate-campaign','council-board-committee','public-hearing-deputation','public-consultation','legislature-parliamentary-sitting','court-tribunal-hearing','inquest-public-inquiry','union-conference','rally-march-counterprotest','picket-strike-labour-action','civic-deadline-compliance'],
  'decisions':[
   'Civic deadlines remain event occurrences when they govern public elections or compliance; they are not reclassified as application opportunities.',
   'Parent cycles and dated stages remain separate and linked.',
   'Public access, public input, webcast, publication, and recording restrictions remain occurrence-specific.',
   'Official date conflicts remain visible through alternate dates and source-inconsistency evidence.',
   'Unannounced annual observances remain qualified watches; exact dates are never invented.',
   'Unknown clock times on ordinary events remain qualified; date-only deadlines, bounded runs, and parent programmes use not-applicable time precision.',
  ],
  'implementation_files':[
   'SITE_PACKAGE/scripts/import-polymythcal-civic-political-legal-labour-set12-2026-08-14.py',
   'SITE_PACKAGE/scripts/verify-polymythcal-civic-political-legal-labour-set12-2026-08-14.js',
   'SITE_PACKAGE/data/polymythcal-research-set-12-civic-political-legal-labour-2026-08-14.json',
   'SITE_PACKAGE/data/polymythcal-event-schema-v2.json',
   'SITE_PACKAGE/js/polymythcal-revamp.js',
  ],
  'verification':{'manual_records':len(manual),'consolidated_records':len(consolidated),'public_records':len(public),'sources':len(source_rows),'set12_manual_consolidated_public':'142/142/142','status':'pass'},
  'deployment_status':'updated_deployable_source_and_public_mirror_not_live_deployed',
  'change_list':[f'CL-WEB-{n}' for n in range(268,276)],
  'research_ledger':{'path':'SITE_PACKAGE/data/polymythcal-research-set-12-civic-political-legal-labour-2026-08-14.json','sha256':sha256(LEDGER),'record_count':ledger.get('record_count'),'exclusion_count':len(ledger.get('exclusions') or [])},
 }
 MASTER.write_text(json.dumps(master,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
 update_manifest()
 print(json.dumps({'master':str(MASTER),'set12_records':len(batch),'bytes':MASTER.stat().st_size,'sha256':sha256(MASTER)},indent=2))
if __name__=='__main__': main()
