#!/usr/bin/env python3
from __future__ import annotations
import json, os, shutil, subprocess, sys
from pathlib import Path
from package_integrity import MANIFEST_NAME, write_verified_archive
from package_selection import collect_package_files
ROOT=Path(__file__).resolve().parents[1]
OUTPUT=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else ROOT.parent/'seminarschools-netlify-source.zip'
def load_current_release_manifest()->dict:
 release=json.loads((ROOT/'RELEASE_MANIFEST.json').read_text(encoding='utf-8'))
 if not release.get('release_id') or not release.get('generated_at'):raise SystemExit('RELEASE_MANIFEST.json lacks release_id or generated_at.')
 if release['release_id']!=(ROOT/'RELEASE_ID.txt').read_text(encoding='utf-8').strip():raise SystemExit('RELEASE_ID.txt and RELEASE_MANIFEST.json disagree at packaging time.')
 return release
def run_release_verification()->None:
 npm_name='npm.cmd' if os.name=='nt' else 'npm'
 npm=shutil.which(npm_name)
 if not npm:raise SystemExit(f'Cannot package: {npm_name} is not available on PATH.')
 print('BUILDING and verifying the current release before source packaging...')
 try:
  subprocess.run([npm,'run','build'],cwd=ROOT,check=True)
  subprocess.run([npm,'run','verify:all:built'],cwd=ROOT,check=True)
  subprocess.run([npm,'run','verify:audit48-live-harvest:current'],cwd=ROOT,check=True)
 except subprocess.CalledProcessError as exc:
  raise SystemExit(f'Cannot package: current release verification failed with exit {exc.returncode}.') from exc

def include_selected_file(path:Path)->bool:
 rel=path.relative_to(ROOT)
 if rel.as_posix()==MANIFEST_NAME:return False
 return True

AUDIT48_REQUIRED=[
 'WEBSITE_AUDIT48_EXTERNAL_VALIDATION_INTEROPERABILITY_REPORT_2026-07-26.md',
 'WEBSITE_AUDIT48_CALENDAR_CLIENT_INTEROPERABILITY_REPORT_2026-07-26.md',
 'AUDIT48_NATIVE_DEVICE_AT_TEST_PROTOCOL_2026-07-26.md',
 'AUDIT48_CALENDAR_VENDOR_IMPORT_PROTOCOL_2026-07-26.md',
 '.github/ISSUE_TEMPLATE/polymythcal-native-at-signoff.yml',
 'scripts/apply-audit48-approved-ui.js',
 'scripts/apply-audit48-release-stamp.js',
 'scripts/audit48-cross-engine-browser.js',
 'scripts/verify-audit48-browser-program.js',
 'data/audit48-browser/cross-engine-preflight.json',
 'scripts/verify-audit48-assistive-technology.js',
 'scripts/reports/audit48-assistive-technology.json',
 'scripts/test_polymythcal_calendar_clients.py',
 'scripts/verify-polymythcal-calendar-clients.py',
 'scripts/reports/audit48-calendar-client-interoperability.json',
 'scripts/audit_polymythcal_live_endpoints.py',
 'scripts/compose_audit48_live_harvest_evidence.py',
 'scripts/test_audit48_live_harvest.py',
 'scripts/verify_audit48_live_harvest.py',
 'scripts/verify-polymythcal-source-health-current.js',
 'scripts/reports/audit48-live-harvest-endpoints.json',
 'scripts/verify-audit48-external-validation.js',
 'scripts/reports/audit48-external-validation.json',
 'requirements-audit.txt',
 'requirements-audit.lock',
]
AUDIT49_REQUIRED=[
 'WEBSITE_AUDIT49_TECHNICAL_EFFICIENCY_RESILIENCE_REPORT_2026-07-26.md',
 'scripts/reports/audit49-technical-efficiency.json',
 'scripts/reports/audit49-metadata-surface.json',
 'scripts/reports/audit49-runtime-efficiency.json',
 'scripts/reports/audit49-build-packaging-efficiency.json',
 'scripts/apply-audit49-metadata-hygiene.js',
 'scripts/apply-audit49-release-stamp.js',
 'scripts/verify-audit49-technical-efficiency.js',
 'scripts/verify-audit49-metadata-surface.js',
 'scripts/verify-audit49-runtime-efficiency.js',
 'scripts/verify-audit49-build-packaging-efficiency.js',
 'scripts/verify-audit49-aa-dialog.mjs',
 'scripts/verify-audit49-aitr-resilience.mjs',
 'scripts/package_selection.py',
]
DESTINATION_REQUIRED=[
 'data/external-destination-contracts.json',
 'data/polymythcal-destination-overrides.json',
 'scripts/lib/external-destination-contracts.js',
 'scripts/apply-polymythcal-destination-specificity.js',
 'scripts/update-polymythcal-destination-contract.js',
 'scripts/test-external-destination-contracts.js',
 'scripts/verify-external-destination-contracts.js',
 'scripts/verify-polymythcal-destination-specificity.js',
 'scripts/verify-polymythcal-destination-browser.js',
 'scripts/fixtures/futureproofing/external-destinations/invalid-destinations.json',
]

def main()->None:
 run_release_verification()
 required=[*AUDIT48_REQUIRED,*AUDIT49_REQUIRED,*DESTINATION_REQUIRED]
 missing=[rel for rel in required if not (ROOT/rel).is_file()]
 if missing:raise SystemExit('Missing required current-release source files: '+', '.join(missing))
 files,selection=collect_package_files(ROOT,OUTPUT,excluded_top_level={'public'})
 files=[path for path in files if include_selected_file(path)]
 selection['files_selected']=len(files)
 selected={path.relative_to(ROOT).as_posix() for path in files}
 omitted=[rel for rel in required if rel not in selected]
 if omitted:raise SystemExit('Required current-release source files were excluded: '+', '.join(omitted))
 OUTPUT.parent.mkdir(parents=True,exist_ok=True)
 print(
  'PACKAGE SELECTION — '
  f"{selection['files_selected']} files selected; "
  f"{selection['files_considered']} files considered; "
  f"{selection['directories_pruned']} disposable directories pruned before descent."
 )
 release_manifest=load_current_release_manifest()
 result=write_verified_archive(ROOT,OUTPUT,files,release_manifest,'netlify-source')
 if any(result['manifest'].get(key)!=release_manifest.get(key) for key in ('release_id','generated_at')):raise SystemExit('Archive metadata does not match the packaged release manifest.')
 print(f"PACKAGED {result['file_count']} source files -> {OUTPUT} ({result['archive_bytes']} bytes; SHA-256 {result['archive_sha256']})")

if __name__=='__main__':
 main()
