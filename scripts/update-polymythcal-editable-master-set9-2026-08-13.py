#!/usr/bin/env python3
"""Append Polymythcal Set 9 state to the preserved editable master."""
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
LEDGER=SITE_ROOT/'data'/'polymythcal-research-set-9-public-intellectual-academic-2026-08-13.json'
KEY='public_intellectual_academic_set9_update_2026_08_13'
SRC='manual-polymythcal-public-intellectual-academic-set9-2026-08-13'
BASE_ARCHIVE={
 'filename':'SeminarSchools-Polymythcal-Sets-7-8-Creator-Presence-CL-228-243-Complete-2026-08-13.zip',
 'bytes':224200620,
 'sha256':'925f952de6b47b45aed090d0faf205f59a6fafb19a6d43f399dff7bb1a9e8a11',
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
 match[0].update({'bytes':size,'sha256':digest,'status':'preserved historical source context plus append-only Set 9 public-intellectual and academic event ledger; never publish'})
 manifest['generated_on']='2026-08-13'
 MANIFEST.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 sums={}
 for line in SUMS.read_text(encoding='utf-8').splitlines():
  if line.strip():
   expected,relative=line.split(None,1); sums[relative.strip()]=expected
 sums['05_POLYMYTHCAL/Polymythcal_Research_and_Remediation_Plan.json']=digest
 SUMS.write_text(''.join(f'{v}  {k}\n' for k,v in sorted(sums.items())),encoding='utf-8')

def main():
 manual_doc=load(MANUAL); consolidated_doc=load(CONSOLIDATED); public_doc=load(PUBLIC); ledger=load(LEDGER)
 manual=events(manual_doc); consolidated=events(consolidated_doc); public=events(public_doc)
 batch=[e for e in manual if e.get('_src')==SRC]
 cbatch=[e for e in consolidated if e.get('_src')==SRC]
 pbatch=[e for e in public if e.get('_src')==SRC]
 if not (len(batch)==len(cbatch)==len(pbatch)==181):
  raise SystemExit(f'Refusing editable-master update: Set 9 manual/consolidated/public counts are {len(batch)}/{len(cbatch)}/{len(pbatch)}, expected 181.')
 meta=manual_doc.get('polymythcal_public_intellectual_academic_set9_update_2026_08_13') or {}
 if meta.get('net_new_records')!=173 or meta.get('existing_records_refreshed')!=8 or meta.get('existing_records_cross_tagged')!=23:
  raise SystemExit('Refusing editable-master update: Set 9 accounting metadata drifted.')
 source_doc=load(SOURCES); source_rows=source_doc if isinstance(source_doc,list) else source_doc.get('sources',[])
 payload={
  'status':'integrated_into_editable_and_public_site_source',
  'implemented_at':'2026-08-13T20:08:00-04:00',
  'base_archive':BASE_ARCHIVE,
  'research_set':'9-Public-Intellectual-and-Academic-Events',
  'records':181,
  'net_new_records':173,
  'existing_records_refreshed':8,
  'existing_records_cross_tagged':23,
  'legacy_records_reconciled':8,
  'parent_records':10,
  'child_occurrences':120,
  'public_thesis_defence_occurrences':48,
  'practical_philosophy_occurrences':9,
  'proust_reading_occurrences':13,
  'royal_institute_phd_seminars':4,
  'official_time_corrections':6,
  'source_url_corrections':2,
  'scope':[
   'public lectures, scholar talks, panels, debates, forums, symposia, conferences and colloquia',
   'seminars, workshops, webinars, book talks, book launches, research showcases and poster sessions',
   'public thesis and dissertation defences with occurrence-level candidate and thesis evidence',
   'reading groups, philosophy cafes and recurring public intellectual discussions',
   'Toronto and GTA first, followed by Guelph, Waterloo, Hamilton, Kingston, Montreal and relevant online academic events',
  ],
  'decisions':[
   'Institutional calendar coverage does not count as event coverage until each useful dated occurrence is represented.',
   'Series parents and dated programme children remain separate and explicitly linked.',
   'Academic form and discipline are indexed independently from legacy event type.',
   'Public access, registration, audience, event format and participant identity are stored independently.',
   'Named attendance requires occurrence-level evidence; TBA or partially published identities remain visibly qualified.',
   'Specific official pages control over stale indexes; corrected URLs and times remain in source history.',
   'Administrative sessions, receptions, breaks, private events and Set 15 course forms remain outside Set 9.',
  ],
  'series_structure':{
   'University of Toronto University Lecture Series':12,
   'Munk Hungarian History, Memory, and Public Culture Symposium':6,
   'Fields Coxeter Distinguished Lecture Series':3,
   'University of Toronto Daniela Witten Distinguished Lecture Series':2,
   'McGill Community for Lifelong Learning Fall Lectures':9,
   'Guelph Jazz Festival Colloquium':14,
   'Concordia University Public Thesis Defences':48,
   'Practical Philosophy Club':9,
   'Proust Readers Support Group':13,
   'Royal Institute of Philosophy PhD Online Seminar Series':4,
  },
  'implementation_files':[
   'SITE_PACKAGE/scripts/import-polymythcal-public-intellectual-academic-set9-2026-08-13.py',
   'SITE_PACKAGE/scripts/verify-polymythcal-public-intellectual-academic-set9-2026-08-13.js',
   'SITE_PACKAGE/scripts/update-polymythcal-editable-master-set9-2026-08-13.py',
   'SITE_PACKAGE/data/polymythcal-research-set-9-public-intellectual-academic-2026-08-13.json',
   'SITE_PACKAGE/data/polymythcal-event-schema-v2.json',
   'SITE_PACKAGE/js/polymythcal-revamp.js',
   'SITE_PACKAGE/polymythseminars/index.html',
  ],
  'verification':{
   'manual_records':len(manual),
   'consolidated_records':len(consolidated),
   'public_records':len(public),
   'sources':len(source_rows),
   'set9_manual_consolidated_public':'181/181/181',
   'status':'pass',
  },
  'deployment_status':'updated_deployable_source_and_public_mirror_not_live_deployed',
  'change_list':[f'CL-WEB-{n}' for n in range(244,252)],
  'research_ledger':{
   'path':'SITE_PACKAGE/data/polymythcal-research-set-9-public-intellectual-academic-2026-08-13.json',
   'sha256':sha256(LEDGER),
   'record_count':ledger.get('record_count'),
   'exclusion_count':len(ledger.get('exclusions') or []),
  },
 }
 master=load(MASTER); master[KEY]=payload
 MASTER.write_text(json.dumps(master,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
 update_manifest()
 print(json.dumps({'master':str(MASTER),'records':181,'bytes':MASTER.stat().st_size,'sha256':sha256(MASTER)},indent=2))
if __name__=='__main__': main()
