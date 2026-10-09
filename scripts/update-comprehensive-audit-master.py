#!/usr/bin/env python3
"""Append the comprehensive audit without replacing any earlier master record."""
from pathlib import Path
import hashlib,json
S=Path(__file__).resolve().parents[1];D=S.parent;E=D/'EDITABLE_MASTERS'
rel='05_POLYMYTHCAL/Polymythcal_Research_and_Remediation_Plan.json';p=E/rel
master=json.loads(p.read_text());assert 'actions_and_sources_update_2026_09_07' in master
master['comprehensive_audit_update_2026_09_07']={
 'schema':'polymythcal-editable-master-append-only-update-v1',
 'status':'implemented',
 'release_id':'seminar-schools-comprehensive-audit-complete-2026-09-07',
 'predecessor_archive':'seminar-schools-polymythcal-actions-complete-2026-09-07.zip',
 'predecessor_sha256':'1f3b4138cf5bd1ceb3e449b87103a27f6442339f88c588e2add4e603f2e4c3ec',
 'requested_work':'Comprehensive website and calendar audit, fixes, individualized shared geometry, efficiency and complete successor ZIP.',
 'implemented':['Deterministic per-route focal regions, zoom and curved camera journeys; original drawing/palette and finite scheduling retained.','Storage-safe saves/migrations, monitoring saves, correction context and keyboard focus.','Cached filtering and date formatting with cache invalidation regression coverage.','Reviewed moved destinations, explicit unavailable sources and uncertain-date monitoring.','Intake storage resilience and server body/timeout validation.','Generator consistency and current release verification contracts.'],
 'inventory':{'canonical':2086,'chronology':1950,'monitoring':136,'external_actions':844,'unresolved_specific_destinations':1242},
 'report':'COMPREHENSIVE_AUDIT_2026-09-07.md',
 'evidence':'AUDIT_EVIDENCE_2026-09-07/',
 'preservation':'Original screenshots, canonical drawing, ML* content and prior master entries retained.',
 'limits':['External network audit is partial; destination, access restriction and environment failures distinguished.','Physical-phone performance unverified; controlled runtime and sampled rendered evidence are separate.','Full browser suite and provider transactions not represented as passed.','Inherited register-style lint findings are recorded without rewriting accepted content.'],
 'archive_verifier':'SITE_PACKAGE/scripts/verify-comprehensive-audit-archive.py',
 'deployment':'No deployment performed.'
}
p.write_text(json.dumps(master,ensure_ascii=False,indent=2)+'\n');digest=hashlib.sha256(p.read_bytes()).hexdigest()
m=E/'EDITABLE_MASTERS_MANIFEST.json';data=json.loads(m.read_text());rows=[r for r in data['files'] if r['path']==rel];assert len(rows)==1
rows[0].update(bytes=p.stat().st_size,sha256=digest,status='preserved historical master and prior updates, with appended comprehensive audit record; never publish');data['generated_on']='2026-09-07';m.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
p=E/'SHA256SUMS.txt';lines=p.read_text().splitlines();matches=0
for i,line in enumerate(lines):
 if line.strip() and line.split(None,1)[1].strip()==rel:lines[i]=digest+'  '+rel;matches+=1
assert matches==1;p.write_text('\n'.join(lines)+'\n')
print('Comprehensive audit master appended; prior entries preserved.')
