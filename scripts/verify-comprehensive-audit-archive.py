#!/usr/bin/env python3
"""Complete archive verification plus independently checked geometry delivery."""
from pathlib import Path
import hashlib
import importlib.util
import json
import re
import subprocess
import sys
import xml.etree.ElementTree as ET
import zipfile

ROOT=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('alwaysalready_archive',ROOT/'verify-alwaysalready-ml-archive.py')
inherited=importlib.util.module_from_spec(spec)
spec.loader.exec_module(inherited)
inherited.require(__debug__, 'Run archive verification without Python optimization (-O).')
inherited.RELEASE_ID='seminar-schools-comprehensive-audit-complete-2026-09-07'
inherited.GENERATED_AT='2026-09-07T12:00:00Z'
if inherited.main()!=0:
    raise SystemExit(1)
with zipfile.ZipFile(Path(sys.argv[1])) as z:
    names=set(z.namelist())
    contracts=json.loads(z.read('SITE_PACKAGE/data/geometry-route-contracts.json'))
    inherited.require('GEOMETRY_MOTION_2026-09-07.md' in names,'motion release notes missing')
    inherited.require(set(contracts['motion_presets'])=={'flow','reading','study','overview','recurrence'},'motion presets missing')
    runtime=z.read('SITE_PACKAGE/js/indra.js').decode('utf-8')
    inherited.require('MOTION_SETTLE_MS = 360' in runtime and 'MOTION_RESPONSE_MS = 65' in runtime,'finite motion constants missing')
    # Derive both identities from code extracted from the ZIP, independently of
    # the working tree and the contract's claimed digest.
    rendered=subprocess.run(['node','-e',
        "const fs=require('fs'),vm=require('vm'),w={};vm.runInNewContext(fs.readFileSync(0,'utf8'),{window:w,console,Math,Object},{timeout:2000});process.stdout.write(w.PolymythMandala.buildCanonical({idPrefix:'archive-proof'}));"],
        input=z.read('SITE_PACKAGE/js/mandala.js'),capture_output=True,check=True,timeout=15).stdout.decode('utf-8')
    normalized=re.sub(r'[a-zA-Z0-9_-]+-jewel-(?:core|prism)','canonical-jewel',rendered)
    normalized=re.sub(r'\s+',' ',normalized)
    inherited.require(hashlib.sha256(normalized.encode()).hexdigest()==contracts['canonical_web']['normalized_sha256'],'archived canonical markup digest differs')
    rows=[]
    for node in ET.fromstring(rendered).iter():
        tag=node.tag.rsplit('}',1)[-1]
        if tag not in ('circle','path'):continue
        a=node.attrib
        fill=a.get('fill','')
        if re.match(r'^url\(#[^)]*prism\)$',fill,re.I):fill='PRISM'
        elif re.match(r'^url\(#[^)]*core\)$',fill,re.I):fill='CORE'
        keys=('cx','cy','r','stroke-width','opacity') if tag=='circle' else ('d','stroke-width','opacity')
        rows.append('|'.join([tag[0],*[a.get(k,'') for k in keys],fill]))
        if 'geo-stroke' in a.get('class','').split():
            inherited.require(a.get('stroke')=='currentColor' and a.get('vector-effect')=='non-scaling-stroke','archived line paint is not self-contained')
    inherited.require(hashlib.sha256('\n'.join(sorted(rows)).encode()).hexdigest()=='4ee88632a9eb1bb4d0062b0509163d822210f7c8acf055d4712b3ae7c5191ddc','archived geometric coordinates or original presentation values changed')
    assert contracts['canonical_web']['semantic_sha256']=='4ee88632a9eb1bb4d0062b0509163d822210f7c8acf055d4712b3ae7c5191ddc'
    assert 'GEOMETRY_REPAIR_2026-09-07.md' in names
    for relative in ('js/mandala.js','js/indra.js','css/alive.css'):
        assert z.read('SITE_PACKAGE/'+relative)==z.read('SITE_PACKAGE/public/'+relative),relative
    assert b'stroke="currentColor" vector-effect="non-scaling-stroke" class="geo-stroke' in z.read('SITE_PACKAGE/js/mandala.js')
    assert b'rendered line-only geometry failed' in z.read('SITE_PACKAGE/scripts/verify-visible-geometry-browser.mjs')
    star=set(contracts['coverage']['star_page_routes'])
    included=0
    for name in names:
        if not name.startswith('SITE_PACKAGE/public/') or not name.endswith('.html'):continue
        relative=name[len('SITE_PACKAGE/public/'):]
        body=z.read(name)
        if relative in star:
            assert b'/js/indra.js' not in body and b'data-geometry="indra-web"' not in body,name
        elif relative!='google20234ae70106ee9d.html':
            inherited.require(b'data-geometry-motion-preset="' in body,name+': missing motion preset')
            assert b'data-geometry="indra-web"' in body and b'/js/mandala.js' in body and b'/js/indra.js' in body,name
            assert z.read('SITE_PACKAGE/'+relative)==body,name
            included+=1
    assert included==7549,included
    assert not any(n.startswith('SITE_PACKAGE/public/scripts/') for n in names)
print('POLYMYTHCAL ACTIONS ARCHIVE PASSED — preserved geometry on every included public page, 26 exact star exclusions, shared-asset parity, unchanged semantic geometry, preserved complete Always Already/ML archive.')

with zipfile.ZipFile(Path(sys.argv[1])) as z:
    assert 'POLYMYTHCAL_ACTIONS_2026-09-07.md' in z.namelist()
    events=json.loads(z.read('SITE_PACKAGE/polymythseminars/events.json'))['events']
    assert len(events)==2086
    by_id={e['id']:e for e in events}
    assert by_id['mccall-macbain-2027-canada-us-deadline']['time_precision']=='exact'
    assert by_id['mccall-macbain-2027-canada-us-deadline']['destination_url']=='https://apply.mccallmacbainscholars.org/apply/'
    assert b'20260907-discovery-v4' in z.read('SITE_PACKAGE/public/cfps/index.html')
    for old,current in {'b62fe9ac2e56':'the-impressionist-revolution-monet-to-matisse-2026-07-07','research-54ecc2f1065b':'bees-a-story-of-survival-2026-05-16'}.items():
        assert old not in by_id and old in by_id[current]['legacy_ids']
        assert current.encode() in z.read('SITE_PACKAGE/public/polymythseminars/events/'+old+'/index.html')
    assert 'SITE_PACKAGE/public/data/polymythcal-reviewed-corrections-2026-09-07.json' not in z.namelist()
print('Archived actions, deadline precision, identity aliases and private source boundary verified.')

with zipfile.ZipFile(Path(sys.argv[1])) as z:
    inherited.require('COMPREHENSIVE_AUDIT_2026-09-07.md' in z.namelist(), 'comprehensive audit report missing')
    release=json.loads(z.read('SITE_PACKAGE/RELEASE_MANIFEST.json'))
    audit=release['comprehensive_audit_update']
    inherited.require(audit['predecessor_sha256']=='1f3b4138cf5bd1ceb3e449b87103a27f6442339f88c588e2add4e603f2e4c3ec','wrong predecessor archive')
    inherited.require(audit['canonical_drawing_changed'] is False, 'drawing preservation not recorded')
    inherited.require(hashlib.sha256(z.read('SITE_PACKAGE/js/mandala.js')).hexdigest()=='385644d98014c11f3b63d8bda8b25f981a6b4f44476592907a74b0cb0e1d1e13','canonical drawing bytes changed')
    browse=json.loads(z.read('SITE_PACKAGE/public/polymythseminars/browse.json'))['events']
    watch=json.loads(z.read('SITE_PACKAGE/public/polymythseminars/watchlist.json'))['items']
    inherited.require((len(browse),len(watch))==(1950,136),'wrong chronology/monitoring partition')
    inherited.require(sum(bool(e.get('destination_url')) for e in events)==844,'wrong external destination count')
    for event_id in ('canadian-philosophical-association-congress-2027','oecta-young-authors-awards-2027'):
        inherited.require(any(e['id']==event_id for e in watch), event_id+': uncertain-date record lost from monitoring')
        inherited.require('SITE_PACKAGE/public/polymythseminars/ics/'+event_id+'.ics' not in z.namelist(),event_id+': fabricated calendar deadline survived')
    inherited.require('cameraVariation' in runtime and 'drawingFit' in runtime,'route-specific camera math missing')
    preservation=json.loads(z.read('AUDIT_EVIDENCE_2026-09-07/preservation.json'))
    for row in preservation['unchanged_artifacts']:
        inherited.require(hashlib.sha256(z.read(row['path'])).hexdigest()==row['sha256'],row['path']+': preserved bytes differ')
    master=json.loads(z.read('EDITABLE_MASTERS/05_POLYMYTHCAL/Polymythcal_Research_and_Remediation_Plan.json'))
    inherited.require('comprehensive_audit_update_2026_09_07' in master,'new master update missing')
    inherited.require('actions_and_sources_update_2026_09_07' in master,'prior master update lost')
    master.pop('comprehensive_audit_update_2026_09_07')
    inherited.require(hashlib.sha256(json.dumps(master,sort_keys=True,ensure_ascii=False,separators=(',',':')).encode()).hexdigest()==preservation['master_predecessor_semantic_sha256'],'earlier editable-master meaning changed')
print('COMPREHENSIVE AUDIT ARCHIVE PASSED — full inherited package checks, unchanged canonical drawing/evidence/master artifacts, corrected partition, external actions and per-route camera math.')
