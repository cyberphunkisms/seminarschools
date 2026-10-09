#!/usr/bin/env python3
"""Verify the exact V3-to-V4 transition; historical transition verifiers remain intact."""
import hashlib,json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
BASELINE=ROOT/'SITE_PACKAGE/data/futureproofing/teacher-bb-v3-package-baseline.json'
BASELINE_SHA='dd872c01b293ea2d5ca6520360d7d0e410976c1eef8f884dc59aced60acb3f0e'
KEY='teacher_resources_bb_final_20260928'
SEED_PINS={'bookwormburrows': '69e8421b1649afb38a4038117f87a2de9959b1cb38a99452a5b2c662f74a6131', 'campaigncodex': '2dc2a5189fd34cb0d22e08eb93abcecb613cfbf9d43dc78af6119b57e221c1a2', 'modulecanon': '8341b2547d952abcc3546368d3d423b821ce528d8087274553f5a93005fb9e25'}
CORE={'SITE_PACKAGE/CHARTER.txt','Mephistodata_CORE_Personal_Rules_2026-08-12.md'}
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def protected(n):return n.startswith('EDITABLE_MASTERS/') or n in CORE or ('corehistory' in n.lower())
def permitted_change(n,before,after,approved,binding):
    if before==after:return True
    if protected(n) or n not in approved:return False
    # These generated checks/screen captures are rewritten by their existing
    # release-runner commands. The final archive binds every exact output byte.
    # Historical evidence cannot enter this exception without an explicit delta.
    if n.startswith('SITE_PACKAGE/scripts/reports/') and n.endswith(('.json','.png')):return True
    if n in {'SITE_PACKAGE/PACKAGE_CONTENTS_SHA256.json','SITE_PACKAGE/RELEASE_MANIFEST.json'}:return True
    if n.startswith('SITE_PACKAGE/'):return binding.get(n[len('SITE_PACKAGE/'):])==after
    return True

def run():
    # The historical V3/V4 contract remains below. A later complete handoff
    # uses its own pinned predecessor and explicit approved transition.
    manifest_path = ROOT/'SITE_PACKAGE/RELEASE_MANIFEST.json'
    if 'polymythcal_maintenance_20261001' in json.loads(manifest_path.read_text()):
        import runpy
        current = runpy.run_path(str(ROOT/'SITE_PACKAGE/scripts/verify-polymythcal-current-preservation.py'))
        return current['run']()
    assert sha(BASELINE)==BASELINE_SHA,'V3 baseline manifest changed'
    base=json.loads(BASELINE.read_text());assert base['release_id']=='seminar-schools-teacher-resources-bb-fixed-v3-2026-09-27'
    rows={v['path']:v for v in base['files']};assert len(rows)==21410
    cfg=json.loads((ROOT/'SITE_PACKAGE/data/teacher-resources-bb-final-contract-20260928.json').read_text())
    manifest=json.loads((ROOT/'SITE_PACKAGE/RELEASE_MANIFEST.json').read_text());amendment=manifest[KEY]
    assert cfg['baseline_sha256']==amendment['predecessor_sha256']=='93f00bdef4a639eed7e349df26ba6764b6bc811ab33893ba12b43e71caebc6e9'
    approved=set(cfg['allowed_changed_paths'])|{'SITE_PACKAGE/PACKAGE_CONTENTS_SHA256.json'}
    current={};changed=[]
    for n,row in rows.items():
        p=ROOT/n;assert p.is_file() and not p.is_symlink(),'Missing predecessor file: '+n
        h=sha(p);current[n]=h
        assert permitted_change(n,row['sha256'],h,approved,amendment['artifact_sha256']),'Unapproved change or stale source binding: '+n
        if h!=row['sha256']:changed.append(n)
    for n in cfg['added_paths']:
        assert n not in rows and (ROOT/n).is_file() and not (ROOT/n).is_symlink(),'Invalid approved addition: '+n
        if n.startswith('SITE_PACKAGE/') and not n.startswith('SITE_PACKAGE/scripts/reports/'):
            assert amendment['artifact_sha256'].get(n[len('SITE_PACKAGE/'):])==sha(ROOT/n),'Added source binding stale: '+n
    from package_selection import collect_package_files
    selected,_=collect_package_files(ROOT,ROOT.parent/'v4-current-validation.zip')
    known=set(rows)|set(cfg['added_paths'])|{'PACKAGE_CONTENTS_SHA256.json'}
    assert not {p.relative_to(ROOT).as_posix() for p in selected}-known,'Unapproved new payload paths'
    # Inline source JSON compaction must retain the full ordered record arrays.
    for stem,pin in SEED_PINS.items():
        text=(ROOT/f'SITE_PACKAGE/polymyth/{stem}/index.html').read_text()
        start=re.search(r'const SEED\s*=\s*',text).end()
        records=json.JSONDecoder().raw_decode(text[start:])[0]
        assert hashlib.sha256(json.dumps(records,sort_keys=True,separators=(',',':')).encode()).hexdigest()==pin,'Canonical records changed: '+stem
    assert sha(ROOT/'SITE_PACKAGE/teacherresources/resources-data.json')==rows['SITE_PACKAGE/teacherresources/resources-data.json']['sha256']
    assert sha(ROOT/'SITE_PACKAGE/polymyth/modulecanon/thank-you-maam.json')==rows['SITE_PACKAGE/polymyth/modulecanon/thank-you-maam.json']['sha256']
    assert (ROOT/'SITE_PACKAGE/CHARTER.txt').read_bytes()==(ROOT/'Mephistodata_CORE_Personal_Rules_2026-08-12.md').read_bytes()
    # Deliberate defect fixtures exercise the same production decision function.
    assert not permitted_change('EDITABLE_MASTERS/master.docx','a','b',{'EDITABLE_MASTERS/master.docx'},{})
    assert not permitted_change('SITE_PACKAGE/CHARTER.txt','a','b',{'SITE_PACKAGE/CHARTER.txt'},{})
    assert not permitted_change('SITE_PACKAGE/unapproved.js','a','b',set(),{'unapproved.js':'b'})
    assert not permitted_change('SITE_PACKAGE/approved.js','a','b',{'SITE_PACKAGE/approved.js'},{'approved.js':'c'})
    assert not permitted_change('SITE_PACKAGE/scripts/reports/history.json','a','b',set(),{})
    assert permitted_change('SITE_PACKAGE/approved.js','a','b',{'SITE_PACKAGE/approved.js'},{'approved.js':'b'})
    print('CURRENT V3→V4 PRESERVATION PASSED — 21410 predecessor payload paths retained; protected masters and CORE exact; approved source hashes bound; five negative and one positive transition fixtures passed.')
if __name__=='__main__':run()
