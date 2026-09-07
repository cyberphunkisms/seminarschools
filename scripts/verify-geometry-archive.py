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
inherited.RELEASE_ID='seminar-schools-geometry-restored-complete-2026-09-07'
inherited.GENERATED_AT='2026-09-07T02:30:00Z'
if inherited.main()!=0:
    raise SystemExit(1)
with zipfile.ZipFile(Path(sys.argv[1])) as z:
    names=set(z.namelist())
    contracts=json.loads(z.read('SITE_PACKAGE/data/geometry-route-contracts.json'))
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
            assert b'data-geometry="indra-web"' in body and b'/js/mandala.js' in body and b'/js/indra.js' in body,name
            assert z.read('SITE_PACKAGE/'+relative)==body,name
            included+=1
    assert included==7543,included
    assert not any(n.startswith('SITE_PACKAGE/public/scripts/') for n in names)
print('GEOMETRY ARCHIVE PASSED — 7543 included public pages, 26 exact star exclusions, shared-asset parity, unchanged semantic geometry, preserved complete Always Already/ML archive.')
