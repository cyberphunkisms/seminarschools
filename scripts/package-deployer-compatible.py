#!/usr/bin/env python3
from __future__ import annotations
import datetime, json, re, sys, zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUTPUT=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else ROOT.parent/'seminarschools-deployer-compatible.zip'
RELEASE_MANIFEST=json.loads((ROOT/'RELEASE_MANIFEST.json').read_text(encoding='utf-8'))
def zip_time():
 value=str(RELEASE_MANIFEST.get('generated_at') or '2026-01-01T00:00:00+00:00').replace('Z','+00:00')
 dt=datetime.datetime.fromisoformat(value).astimezone(datetime.timezone.utc)
 return (max(1980,dt.year),dt.month,dt.day,dt.hour,dt.minute,dt.second-(dt.second%2))
ZIP_TIME=zip_time()
EXCLUDED_FIXED={'.git','.netlify','node_modules','__pycache__'}
EXCLUDED_FILES={'cv-modular-onepage-samples-2026-07-09.zip','Saul_Karim_Nassau_CV_onepage_revamp_2026-07-09.pdf'}
def generated_work_dir(part:str)->bool:
 return bool(re.fullmatch(r'(?:polymythcal[-_])?audit\d+(?:[-_].*)?',part,re.I) or re.fullmatch(r'.*[-_]work',part,re.I) or re.fullmatch(r'.*[-_]packaged[-_]test',part,re.I))
def include(path:Path)->bool:
 rel=path.relative_to(ROOT)
 if any(part in EXCLUDED_FIXED or generated_work_dir(part) for part in rel.parts):return False
 if rel.as_posix() in EXCLUDED_FILES:return False
 if path.name=='.env' or (path.name.startswith('.env.') and not path.name.endswith('.example')):return False
 if path.suffix.lower() in {'.log','.pyc'}:return False
 if path.resolve()==OUTPUT:return False
 return path.is_file()
required=['public/index.html','public/polymythseminars/index.html','public/polymythseminars/events.json','package.json','package-lock.json','netlify.toml','.gitignore','RELEASE_ID.txt','RELEASE_MANIFEST.json','REPAIR_PUBLIC_GIT_TRACKING_ONCE.bat']
missing=[rel for rel in required if not (ROOT/rel).is_file()]
if missing:raise SystemExit('Missing required deployer files: '+', '.join(missing))
files=sorted((p for p in ROOT.rglob('*') if include(p)),key=lambda p:p.relative_to(ROOT).as_posix())
OUTPUT.parent.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(OUTPUT,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9,allowZip64=True) as archive:
 for path in files:
  rel=path.relative_to(ROOT).as_posix();info=zipfile.ZipInfo(rel,ZIP_TIME);info.compress_type=zipfile.ZIP_DEFLATED;info.create_system=3;info.external_attr=(path.stat().st_mode&0o777)<<16
  archive.writestr(info,path.read_bytes(),compress_type=zipfile.ZIP_DEFLATED,compresslevel=9)
print(f'PACKAGED {len(files)} deployer files -> {OUTPUT} ({OUTPUT.stat().st_size} bytes)')
