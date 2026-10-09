#!/usr/bin/env python3
"""Verify the exact complete V5-to-V6 maintenance transition."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BASELINE = ROOT / 'SITE_PACKAGE/data/futureproofing/polymythcal-v5-package-baseline.json'
CONTRACT = ROOT / 'SITE_PACKAGE/data/futureproofing/polymythcal-v6-preservation-contract.json'
BASELINE_SHA = 'cd975b7195b13dc23e9c8c7dab3f6645142804dcc053a6261919a090d34b27b6'
ARCHIVE_SHA = 'b963e1eed45eab5fe4118e0b6670f0dbc1ecceda2b650fb91c195f9d3537c33a'
CORE = {'SITE_PACKAGE/CHARTER.txt', 'Mephistodata_CORE_Personal_Rules_2026-08-12.md'}

def sha(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        while block := stream.read(4 * 1024 * 1024):
            digest.update(block)
    return digest.hexdigest()

def protected(name):
    return name.startswith(('EDITABLE_MASTERS/', 'RESEARCH_ARCHIVE_2026-09-29/')) or name in CORE or 'corehistory' in name.lower()

def permitted_change(name, before, after, contract):
    if before == after:
        return True
    if protected(name):
        return False
    row = contract['changes'].get(name)
    if not row or row['before_sha256'] != before:
        return False
    if name in contract['mutable_generated_paths']:
        return True
    return row['after_sha256'] == after

def run():
    assert sha(BASELINE) == BASELINE_SHA, 'Verified V5 baseline manifest changed'
    baseline = json.loads(BASELINE.read_text())
    rows = {row['path']: row for row in baseline['files']}
    assert len(rows) == 21904, 'V5 baseline payload count changed'
    contract = json.loads(CONTRACT.read_text())
    manifest = json.loads((ROOT / 'SITE_PACKAGE/RELEASE_MANIFEST.json').read_text())
    maintenance = manifest['polymythcal_maintenance_20261001']
    assert maintenance['release_id'] == '2026-10-01-polymythcal-maintenance-v6'
    assert contract['baseline_archive_sha256'] == maintenance['predecessor_archive_sha256'] == ARCHIVE_SHA
    assert contract['baseline_manifest_sha256'] == BASELINE_SHA
    assert sha(CONTRACT) == maintenance['preservation_contract_sha256'], 'Current preservation contract binding changed'
    for name in contract['mutable_generated_paths']:
        assert name in rows and name in contract['changes'] and not protected(name)
        assert name in {'SITE_PACKAGE/RELEASE_MANIFEST.json', 'SITE_PACKAGE/WEBSITE_AUDIT49_TECHNICAL_EFFICIENCY_RESILIENCE_REPORT_2026-07-26.md'} or (name.startswith('SITE_PACKAGE/scripts/reports/') and name.endswith(('.json', '.png', '.md'))), 'Non-report entered mutable output list'
    for name, row in rows.items():
        p = ROOT / name
        assert p.is_file() and not p.is_symlink(), 'Missing predecessor payload: ' + name
        assert permitted_change(name, row['sha256'], sha(p), contract), 'Unapproved change or stale V6 source binding: ' + name
    for name, digest in contract['added_files'].items():
        p = ROOT / name
        assert name not in rows and p.is_file() and not p.is_symlink(), 'Missing approved addition: ' + name
        assert sha(p) == digest, 'Added source binding changed: ' + name
    evidence = set(contract['private_handoff_evidence_paths'])
    assert all(name.startswith('POLYMYTHCAL_REPAIR_2026-10-01/') or name == 'START_HERE_POLYMYTHCAL_REPAIRS_2026-10-01.html' for name in evidence)
    from package_selection import collect_package_files
    selected, _ = collect_package_files(ROOT, ROOT.parent / 'v6-current-validation.zip')
    known = set(rows) | set(contract['added_files']) | evidence | {
        'PACKAGE_CONTENTS_SHA256.json', CONTRACT.relative_to(ROOT).as_posix(),
    }
    unexpected = {p.relative_to(ROOT).as_posix() for p in selected} - known
    assert not unexpected, 'Unapproved new payload paths: ' + ', '.join(sorted(unexpected))
    # Exercise the production decision function against deliberate tampering.
    fixture = {'changes': {'SITE_PACKAGE/approved.js': {'before_sha256': 'a', 'after_sha256': 'b'}}, 'mutable_generated_paths': []}
    assert permitted_change('SITE_PACKAGE/approved.js', 'a', 'b', fixture)
    assert not permitted_change('SITE_PACKAGE/approved.js', 'a', 'c', fixture)
    assert not permitted_change('SITE_PACKAGE/approved.js', 'wrong', 'b', fixture)
    assert not permitted_change('SITE_PACKAGE/unapproved.js', 'a', 'b', fixture)
    for name in ['EDITABLE_MASTERS/master.docx', 'RESEARCH_ARCHIVE_2026-09-29/source.txt', 'SITE_PACKAGE/CHARTER.txt', 'SITE_PACKAGE/polymyth/corehistory/source.txt']:
        hostile = {'changes': {name: {'before_sha256': 'a', 'after_sha256': 'b'}}, 'mutable_generated_paths': [name]}
        assert not permitted_change(name, 'a', 'b', hostile)
    assert not permitted_change('SITE_PACKAGE/scripts/reports/history.json', 'a', 'b', fixture)
    print('CURRENT V5→V6 PRESERVATION PASSED — 21904 predecessor payload paths retained; masters, research, CORE and corehistory byte-identical; explicit source bindings and tamper fixtures passed.')

if __name__ == '__main__':
    run()
