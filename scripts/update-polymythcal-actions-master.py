#!/usr/bin/env python3
"""Append the reviewed actions release without replacing historical masters."""
import hashlib
import json
import os
import time
from pathlib import Path

SITE = Path(__file__).resolve().parents[1]
DELIVERY = SITE.parent
EDITABLE = DELIVERY / 'EDITABLE_MASTERS'
RELATIVE = '05_POLYMYTHCAL/Polymythcal_Research_and_Remediation_Plan.json'
MASTER = EDITABLE / RELATIVE


def read(path):
    return json.loads(path.read_text())


def save(path, text):
    if path.exists() and path.read_text() == text:
        return
    prior = path.stat().st_mtime if path.exists() else 0
    path.write_text(text)
    if prior > time.time() + 60:
        os.utime(path, (prior + 2, prior + 2))


def save_json(path, data):
    save(path, json.dumps(data, ensure_ascii=False, indent=2) + '\n')


review = read(SITE / 'data/polymythcal-actions-release-review.json')
assert review['destinations'] == 847 and review['canonical_count'] == 2086
assert not review['existing_destinations_lost']
master = read(MASTER)
key = 'actions_and_sources_update_2026_09_07'
master[key] = {
    'schema': 'polymythcal-editable-master-append-only-update-v1',
    'status': 'implemented',
    'release_id': 'seminar-schools-polymythcal-actions-complete-2026-09-07',
    'base_archive': {
        'filename': 'seminar-schools-geometry-motion-complete-2026-09-07.zip',
        'sha256': '1ccd42ebe5442d730bd19f62f8e12bdf2251ff9bb3a15215eb0de90b050f4430',
    },
    'requested_work': 'Comprehensive Polymythcal remediation, including actual event and application links and misleading inert controls.',
    'implemented': [
        'Primary external actions, separate internal details, plain category metadata, and visible unavailable-destination messages.',
        'Current saved items/searches, legacy migration, persistent removal, detail save state, and filtered return navigation.',
        'Current bounded calendar windows, ongoing ranges without invented daily sessions, phone Today control, and truthful result counts.',
        'Static fallback links, search tips disclosure, and shared English/French focused routes.',
        'Reviewed exact destinations, dates, deadline precision, duplicate aliases, and durable post-import corrections.',
    ],
    'inventory': {k: v for k, v in review.items() if k != 'unresolved'},
    'unresolved_destination_count': len(review['unresolved']),
    'source_review_limit': '39 dated record checks; 847 usable destinations include 395 event pages and 452 series pages. The full inventory has not been freshly verified. Missing destinations remain explicit.',
    'correction_ledger': 'SITE_PACKAGE/data/polymythcal-reviewed-corrections-2026-09-07.json',
    'remaining_source_work': 'SITE_PACKAGE/data/polymythcal-actions-release-review.json',
    'release_notes': 'POLYMYTHCAL_ACTIONS_2026-09-07.md',
    'preservation': 'Prior master history retained. Approved geometry/runtime/styles, ML*, Always Already evidence, and unrelated masters preserved.',
    'release_gate': 'SITE_PACKAGE/scripts/package-polymythcal-actions-successor.py',
    'archive_verifier': 'SITE_PACKAGE/scripts/verify-polymythcal-actions-archive.py',
    'interaction_test_scope': 'Production JavaScript in controlled DOM stubs; no fresh physical-phone or end-to-end browser measurements.',
}
save_json(MASTER, master)
digest = hashlib.sha256(MASTER.read_bytes()).hexdigest()
manifest_path = EDITABLE / 'EDITABLE_MASTERS_MANIFEST.json'
manifest = read(manifest_path)
rows = [row for row in manifest['files'] if row['path'] == RELATIVE]
assert len(rows) == 1
rows[0].update(bytes=MASTER.stat().st_size, sha256=digest,
    status='preserved historical context and Sets 1–15 research, plus appended 2026-09-07 actions/source correction record; never publish')
manifest['generated_on'] = '2026-09-07'
save_json(manifest_path, manifest)
sums_path = EDITABLE / 'SHA256SUMS.txt'
lines = sums_path.read_text().splitlines()
matched = 0
for index, line in enumerate(lines):
    if line.strip() and line.split(None, 1)[1].strip() == RELATIVE:
        lines[index] = f'{digest}  {RELATIVE}'
        matched += 1
assert matched == 1
save(sums_path, '\n'.join(lines) + '\n')
print(f'Appended Polymythcal release record; master SHA-256 {digest}.')
