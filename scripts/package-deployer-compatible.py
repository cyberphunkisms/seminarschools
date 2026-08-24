#!/usr/bin/env python3
from __future__ import annotations
import json, os, shutil, subprocess, sys
from pathlib import Path
from package_integrity import MANIFEST_NAME, write_verified_archive
from package_selection import collect_package_files
ROOT=Path(__file__).resolve().parents[1]
OUTPUT=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else ROOT.parent/'seminarschools-deployer-compatible.zip'
def load_current_release_manifest()->dict:
 release=json.loads((ROOT/'RELEASE_MANIFEST.json').read_text(encoding='utf-8'))
 if not release.get('release_id') or not release.get('generated_at'):raise SystemExit('RELEASE_MANIFEST.json lacks release_id or generated_at.')
 if release['release_id']!=(ROOT/'RELEASE_ID.txt').read_text(encoding='utf-8').strip():raise SystemExit('RELEASE_ID.txt and RELEASE_MANIFEST.json disagree at packaging time.')
 return release
MIN_DEPLOYER_FILES=10020
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
def run_production_build()->None:
 npm_name='npm.cmd' if os.name=='nt' else 'npm'
 npm=shutil.which(npm_name)
 if not npm:raise SystemExit(f'Cannot package: {npm_name} is not available on PATH.')
 print('BUILDING canonical public deploy surface before packaging...')
 try:subprocess.run([npm,'run','build'],cwd=ROOT,check=True)
 except subprocess.CalledProcessError as exc:raise SystemExit(f'Cannot package: npm run build failed with exit {exc.returncode}.') from exc

def run_portable_verification()->None:
 npm_name='npm.cmd' if os.name=='nt' else 'npm'
 npm=shutil.which(npm_name)
 if not npm:raise SystemExit(f'Cannot package: {npm_name} is not available on PATH.')
 print('RUNNING the complete portable release gate before packaging...')
 try:subprocess.run([npm,'run','verify:all:built'],cwd=ROOT,check=True)
 except subprocess.CalledProcessError as exc:raise SystemExit(f'Cannot package: npm run verify:all:built failed with exit {exc.returncode}.') from exc

def run_current_live_evidence_verification()->None:
 npm_name='npm.cmd' if os.name=='nt' else 'npm'
 npm=shutil.which(npm_name)
 if not npm:raise SystemExit(f'Cannot package: {npm_name} is not available on PATH.')
 print('VERIFYING current Audit 48 live-harvest evidence before packaging...')
 try:subprocess.run([npm,'run','verify:audit48-live-harvest:current'],cwd=ROOT,check=True)
 except subprocess.CalledProcessError as exc:raise SystemExit(f'Cannot package: current Audit 48 live evidence failed with exit {exc.returncode}.') from exc

def include_selected_file(path:Path)->bool:
 rel=path.relative_to(ROOT)
 if rel.as_posix()==MANIFEST_NAME:return False
 return True

required=[
 'public/index.html','public/polymythseminars/index.html',
 'public/polymythseminars/events.json','public/polymythseminars/browse.json',
 'public/polymythseminars/candidates.json',
 'package.json','package-lock.json','netlify.toml','.gitignore',
 'RELEASE_ID.txt','RELEASE_MANIFEST.json','REPAIR_PUBLIC_GIT_TRACKING_ONCE.bat',
 'WEBSITE_AUDIT34_IMPECCABLE_UI_EFFICIENCY_REPORT_2026-07-23.md',
 'data/polymythcal-audit34/interaction-design-browser-audit.json',
 'data/polymythcal-audit34/entry-pages-browser-audit.json',
 'POLYMYTHCAL_WCAG22_AA_AUDIT34_2026-07-23.md',
 'WEBSITE_AUDIT35_BUILD_RUNTIME_RESILIENCE_REPORT_2026-07-23.md',
 'WEBSITE_AUDIT35_RESILIENCE_POLISH_REPORT_2026-07-23.md',
 'data/polymythcal-audit35/interaction-design-browser-audit.json',
 'data/polymythcal-audit35/entry-pages-browser-audit.json',
 'data/polymythcal-wcag22-browser-audit.json',
 'data/audit35-route-browser/route-resilience-browser-audit.json',
 'scripts/reports/audit35-project-failure-stress.json',
 'POLYMYTHCAL_WCAG22_AA_AUDIT35_2026-07-23.md',
 'WEBSITE_AUDIT36_DISCOVERY_RESILIENCE_REPORT_2026-07-24.md',
 'data/audit35-frozen-sha256.json',
 'scripts/apply-audit36-release-stamp.js',
 'scripts/verify-audit36-evolution.js',
 'WEBSITE_AUDIT37_SOURCE_HEALTH_RUNTIME_POLISH_REPORT_2026-07-24.md',
 'data/audit36-frozen-sha256.json',
 'scripts/apply-audit37-release-stamp.js',
 'scripts/verify-audit37-source-health.js',
 'scripts/verify-audit37-evolution.js',
 'WEBSITE_AUDIT38_HARVEST_OPERATIONAL_INTEGRITY_REPORT_2026-07-24.md',
 'data/audit37-frozen-sha256.json',
 'scripts/apply-audit38-release-stamp.js',
 'scripts/verify-frozen-audit37.js',
 'scripts/live-content-integrity.js',
 'scripts/verify-live-content-integrity.js',
 'scripts/verify-polymythcal-source-health.js',
 'scripts/verify-audit38-methodology-state.js',
 'scripts/verify-aa-saul-runtime-smoothness.mjs',
 'scripts/verify-audit38-accessibility-p0.mjs',
 'scripts/verify-audit38-evolution.js',
 'scripts/run-audit38-browser.py',
 'scripts/verify-audit38-browser-evidence.js',
 'WEBSITE_AUDIT39_DISCOVERY_CONTINUITY_ROUTE_RESILIENCE_REPORT_2026-07-24.md',
 'data/audit38-frozen-sha256.json',
 'scripts/apply-audit39-release-stamp.js',
 'scripts/verify-frozen-audit38.js',
 'scripts/verify-audit39-protest-recall.js',
 'scripts/verify-audit39-generated-routes.js',
 'scripts/verify-audit39-runtime-ui.mjs',
 'scripts/verify-audit39-cache-coherence.js',
 'scripts/verify-audit39-font-delivery.js',
 'scripts/verify-audit39-methodology-runtime.js',
 'scripts/verify-audit39-package-roundtrip.js',
 'scripts/verify-audit39-evolution.js',
 'scripts/run-audit39-browser.py',
 'scripts/verify-audit39-browser-evidence.js',
 'WEBSITE_AUDIT40_BROWSER_RUNTIME_CONTINUITY_REPORT_2026-07-24.md',
 'data/audit39-frozen-sha256.json',
 'scripts/verify-frozen-audit39.js',
 'scripts/apply-audit40-release-stamp.js',
 'scripts/verify-audit40-content-structure.js',
 'scripts/verify-audit40-runtime-efficiency.js',
 'scripts/verify-audit40-evolution.js',
 'scripts/run-audit40-browser.py',
 'scripts/audit40-browser-runtime.py',
 'scripts/verify-audit40-browser-evidence.js',
 'data/audit40-frozen-sha256.json',
 'scripts/verify-frozen-audit40.js',
 'WEBSITE_AUDIT41_DEPTH_ROLLOVER_DENSITY_REPORT_2026-07-25.md',
 'scripts/apply-audit41-release-stamp.js',
 'scripts/verify-audit41-content-structure.js',
 'scripts/verify-audit41-runtime-efficiency.js',
 'scripts/verify-audit41-teacher-density.js',
 'scripts/verify-audit41-event-rollover.js',
 'scripts/verify-current-event-rollover.js',
 'scripts/verify-audit41-evolution.js',
 'scripts/run-audit41-browser.py',
 'scripts/audit41-browser-runtime.py',
 'scripts/audit41-full-depth-browser.py',
 'scripts/verify-audit41-browser-evidence.js',
 'data/polymythcal-audit41/interaction-design-browser-audit.json',
 'data/polymythcal-audit41/entry-pages-browser-audit.json',
 'data/polymythcal-audit41/wcag22-browser-audit.json',
 'data/polymythcal-audit41/desktop-final.png',
 'data/polymythcal-audit41/mobile-final.png',
 'data/polymythcal-audit41/small-mobile-final.png',
 'data/audit41-route-browser/route-resilience-browser-audit.json',
 'scripts/reports/audit41-project-failure-stress.json',
 'data/audit41-browser/runtime-continuity-browser-audit.json',
 'data/audit41-browser/screenshots/deep-link-1.png',
 'data/audit41-browser/screenshots/deep-link-2.png',
 'data/audit41-browser/screenshots/deep-link-3.png',
 'data/audit41-browser/screenshots/deep-link-4.png',
 'data/audit41-browser/screenshots/teacher-resources-reset.png',
 'data/audit41-browser/screenshots/dm-board-mobile.png',
 'data/audit41-depth-browser/full-depth-browser-audit.json',
 'data/audit41-depth-browser/screenshots/bookwormcard.png',
 'data/audit41-depth-browser/screenshots/teacher-resources.png',
 'data/audit41-depth-browser/screenshots/upcoming-event.png',
 'data/audit41-depth-browser/screenshots/expired-event.png',
 'POLYMYTHCAL_WCAG22_AA_AUDIT41_2026-07-25.md',
 'WEBSITE_AUDIT42_COMPLETE_LEDGER_CLOSURE_REPORT_2026-07-25.md',
 'data/audit41-frozen-sha256.json',
 'scripts/verify-frozen-audit41.js',
 'scripts/apply-audit42-release-stamp.js',
 'scripts/build-audit42-site-inventory.js',
 'scripts/verify-audit42-ledger-closure.js',
 'scripts/audit42-multimode-browser.py',
 'scripts/verify-audit42-browser-evidence.js',
 'scripts/run-audit42-inherited-browser.py',
 'scripts/run-audit42-inherited-browser-all.py',
 'scripts/verify-audit42-inherited-browser-evidence.js',
 'data/audit42-inherited-browser/run-summary.json',
 'data/audit42-inherited-browser/interaction/interaction-design-browser-audit.json',
 'data/audit42-inherited-browser/entry-pages/entry-pages-browser-audit.json',
 'data/audit42-inherited-browser/wcag/wcag22-browser-audit.json',
 'data/audit42-inherited-browser/routes/route-resilience-browser-audit.json',
 'data/audit42-inherited-browser/stress/project-failure-stress.json',
 'data/audit42-inherited-browser/runtime/runtime-continuity-browser-audit.json',
 'data/audit42-inherited-browser/depth/full-depth-browser-audit.json',
 'scripts/lib/audit42-png-signature.js',
 'scripts/build-audit42-visual-baseline.js',
 'scripts/test-audit42-visual-baseline.js',
 'scripts/verify-audit42-visual-baseline.js',
 'data/audit42-visual-baseline.json',
 'scripts/build-audit42-design-token-inventory.js',
 'data/audit42-design-token-inventory.json',
 'scripts/build-audit42-editorial-density-inventory.js',
 'data/audit42-editorial-density-inventory.json',
 'scripts/build-audit42-symbol-vocabulary-inventory.js',
 'data/audit42-symbol-vocabulary-inventory.json',
 'scripts/verify-bb-qr-placement.js',
 'scripts/verify-external-link-live-shards.js',
 'data/audit42-site-inventory.json',
 'data/audit42-multimode-browser/multimode-browser-audit.json',
 'data/audit42-frozen-sha256.json',
 'scripts/verify-frozen-audit42.js',
 'WEBSITE_AUDIT43_APPROVED_EVOLUTION_REPORT_2026-07-25.md',
 'scripts/apply-audit43-release-stamp.js',
 'scripts/apply-audit43-approved-ui.js',
 'scripts/build-audit43-continuity-inventory.js',
 'scripts/verify-audit43-approved-direction.js',
 'scripts/test_polymythcal_audit43.py',
 'scripts/audit43-approved-browser.py',
 'scripts/verify-audit43-browser-evidence.js',
 'scripts/polymythcal_http_cache.py',
 'scripts/harvest_protests_browser_ocr.py',
 'scripts/polymythcal_identity_shadow.py',
 'scripts/build-polymythcal-candidate-surface.py',
 'css/audit43-approved.css',
 'js/audit43-reader.js',
 'js/polymythcal-candidates.js',
 'data/polymythcal-http-cache.json',
 'data/polymythcal-identity-shadow.json',
 'data/audit43-continuity-inventory.json',
 'data/audit43-browser/approved-direction-browser-audit.json',
 'data/audit43-frozen-sha256.json',
 'scripts/verify-frozen-audit43.js',
 'WEBSITE_AUDIT44_FULL_TRANSLATION_REPORT_2026-07-25.md',
 'WEBSITE_AUDIT45_FULL_TRANSLATION_IMPLEMENTATION_REPORT_2026-07-25.md',
 'scripts/apply-audit45-language-model.py',
 'scripts/build-leizu-i18n-source.js',
 'scripts/build-polymythcal-i18n-source.js',
 'scripts/build-audit45-localized-routes.py',
 'scripts/apply-audit45-translation-ui.js',
 'scripts/verify-audit45-translations.py',
 'scripts/audit45-translation-browser.js',
 'scripts/verify-audit45-browser-evidence.js',
 'scripts/apply-audit45-release-stamp.js',
 'css/audit45-localization.css',
 'data/audit45-translation-governance.json',
 'data/leizu-i18n-audit45.json',
 'data/polymythcal-static-i18n-audit45.json',
 'data/audit45-browser/translation-browser-audit.json',
 'WEBSITE_AUDIT46_TECHNICAL_EFFICIENCY_REPORT_2026-07-26.md',
 'scripts/reports/audit46-technical-efficiency.json',
 'scripts/verify-audit46-technical-efficiency.js',
 'scripts/normalize-shared-asset-references.js',
 'scripts/verify-cloud-input-runtime.js',
 'scripts/verify-function-dependency-resolution.mjs',
 'scripts/verify-redirect-policy-coherence.js',
 'scripts/package_integrity.py',
 'scripts/test_package_integrity.py',
 'scripts/polymythcal-build-date.js',
 'requirements-harvest.txt',
 'requirements-harvest-browser.txt',
 'WEBSITE_AUDIT47_TECHNICAL_EFFICIENCY_REPORT_2026-07-26.md',
 'scripts/reports/audit47-technical-efficiency.json',
 'scripts/verify-audit47-technical-efficiency.js',
 'scripts/verify-polymythcal-audit47.js',
 'scripts/test_polymythcal_audit47.py',
 'scripts/reconcile_polymythcal_lifecycle.py',
'scripts/build-polymythcal-feeds.py',
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
'_headers',
 '_redirects',
 '.nvmrc',
 '.github/workflows/predeploy.yml',
 'leizu/fr/index.html',
 'leizu/zh-hant/index.html',
 'leizu/zh-hans/index.html',
 'leizu/fa/index.html',
 'leizu/fr/intake/index.html',
 'leizu/zh-hant/intake/index.html',
 'leizu/zh-hans/intake/index.html',
 'leizu/fa/intake/index.html',
 'polymythseminars/fr/index.html',
 'polymythseminars/fr/submit/index.html',
 'polymythseminars/fr/correct/index.html',
 'polymythseminars/fr/subscribe/index.html',
 'saul/fr/index.html',
 'saul/zh-hant/index.html',
 'saul/zh-hans/index.html',
 'saul/fa/index.html',
 'public/leizu/fr/index.html',
 'public/polymythseminars/fr/index.html',
 'public/saul/fa/index.html',
 'public/teacherresources/index.html',
]
required.extend([
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
])
required.extend(
 f'data/audit43-browser/screenshots/{name}'
 for name in '''
home-desktop.png
home-mobile.png
polymythcal-nearby.png
reader-view.png
candidate-surface.png
teacher-first-match.png
'''.split()
)
required.extend(
 f'data/audit45-browser/screenshots/{name}'
 for name in '''
leizu-fr-desktop.png
leizu-fa-mobile.png
leizu-zh-hans-intake-mobile.png
polymythcal-fr-desktop.png
polymythcal-writing-fr-mobile.png
polymythcal-fr-event-mobile.png
polymythcal-fr-submit-mobile.png
saul-fa-mobile.png
saul-zh-hant-desktop.png
teacherresources-language-filter.png
bb-why-zh-mobile.png
'''.split()
)
required.extend(
 f'data/audit42-multimode-browser/screenshots/{name}'
 for name in '''
ultrawide-home.png
ultrawide-polymythcal.png
ultrawide-teacher-resources.png
ultrawide-bb.png
ultrawide-bookwormcard.png
ultrawide-thank-you-mam.png
ultrawide-thank-you-mam-pregame.png
foldable-landscape-home.png
foldable-landscape-polymythcal.png
foldable-landscape-teacher-resources.png
foldable-landscape-bb.png
foldable-landscape-bookwormcard.png
foldable-landscape-thank-you-mam.png
foldable-landscape-thank-you-mam-pregame.png
text-spacing-polymythcal.png
text-spacing-teacher-resources.png
text-spacing-bookwormcard.png
reduced-transparency-home.png
reduced-transparency-polymythcal.png
reduced-transparency-leizu.png
print-polymythcal.png
grayscale-polymythcal.png
'''.split()
)
required.extend(
 f'data/audit41-route-browser/{name}'
 for name in '''
aa-desktop.png
aa-forced-colors.png
aa-landscape-short.png
aa-mobile-short.png
about-desktop.png
about-landscape-short.png
about-mobile-short.png
agora-desktop.png
agora-landscape-short.png
agora-mobile-short.png
bb-desktop.png
bb-forced-colors.png
bb-landscape-short.png
bb-mobile-short.png
bookwormcard-desktop.png
bookwormcard-forced-colors.png
bookwormcard-landscape-short.png
bookwormcard-mobile-short.png
cv-desktop.png
cv-landscape-short.png
cv-mobile-short.png
home-desktop.png
home-forced-colors.png
home-landscape-short.png
home-mobile-short.png
leizu-desktop.png
leizu-landscape-short.png
leizu-mobile-short.png
methodology-list-desktop.png
methodology-list-landscape-short.png
methodology-list-mobile-short.png
polymythcal-desktop.png
polymythcal-forced-colors.png
polymythcal-landscape-short.png
polymythcal-mobile-short.png
teacher-resources-desktop.png
teacher-resources-forced-colors.png
teacher-resources-landscape-short.png
teacher-resources-mobile-short.png
'''.split()
)
required.extend(AUDIT49_REQUIRED)
def main()->None:
 run_production_build()
 run_portable_verification()
 run_current_live_evidence_verification()
 missing=[rel for rel in required if not (ROOT/rel).is_file()]
 if missing:raise SystemExit('Missing required deployer files: '+', '.join(missing))
 files,selection=collect_package_files(ROOT,OUTPUT)
 files=[path for path in files if include_selected_file(path)]
 selection['files_selected']=len(files)
 if len(files)<MIN_DEPLOYER_FILES:raise SystemExit(f'Cannot package: deployer file floor backtracked to {len(files)}/{MIN_DEPLOYER_FILES}.')
 selected={path.relative_to(ROOT).as_posix() for path in files}
 omitted=[rel for rel in required if rel not in selected]
 if omitted:raise SystemExit('Required deployer files were excluded from the archive: '+', '.join(omitted))
 OUTPUT.parent.mkdir(parents=True,exist_ok=True)
 print(
  'PACKAGE SELECTION — '
  f"{selection['files_selected']} files selected; "
  f"{selection['files_considered']} files considered; "
  f"{selection['directories_pruned']} disposable directories pruned before descent."
 )
 release_manifest=load_current_release_manifest()
 result=write_verified_archive(ROOT,OUTPUT,files,release_manifest,'deployer-compatible')
 if any(result['manifest'].get(key)!=release_manifest.get(key) for key in ('release_id','generated_at')):raise SystemExit('Archive metadata does not match the packaged release manifest.')
 print(f"PACKAGED {result['file_count']} deployer files -> {OUTPUT} ({result['archive_bytes']} bytes; SHA-256 {result['archive_sha256']})")

if __name__=='__main__':
 main()
