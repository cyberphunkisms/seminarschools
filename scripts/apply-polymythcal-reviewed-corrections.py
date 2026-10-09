#!/usr/bin/env python3
"""Apply source-reviewed field and identity corrections after imports.

The dated ledger preserves complete predecessor records and source evidence.
Its fixed review date is never advanced by rebuilding or harvesting.
"""
import json
import os
import time
from pathlib import Path
from atomic_json import write_text_atomic

ROOT = Path(__file__).resolve().parents[1]
ledgers = [json.loads(path.read_text()) for path in
           sorted((ROOT / 'data').glob('polymythcal-reviewed-corrections-????-??-??.json'))]
target = ROOT / 'polymythseminars/events.json'
payload = json.loads(target.read_text())
records = {record['id']: record for record in payload['events']}
for ledger in ledgers:
    for identifier, fields in ledger['corrections'].items():
        if identifier not in records:
            raise ValueError(f'Reviewed record missing: {identifier}')
        record = records[identifier]
        # A later genuinely checked record must not be rolled back by this release.
        if str(record.get('last_checked_at') or '')[:10] <= ledger['reviewed_on']:
            record.update(fields)
            # An old import can momentarily restore its original date and record
            # the reviewed date as previous. Restoring the correction must also
            # remove that self-reference; it is not evidence of a rescheduling.
            if isinstance(record.get('previous_dates'), list):
                record['previous_dates'] = [date for date in record['previous_dates']
                                            if date != record.get('date')]
    for old, current in ledger['identity_migrations'].items():
        winner = records[current]
        predecessor = records.pop(old, ledger['pre_correction_records'][old])
        winner['legacy_ids'] = sorted(set(winner.get('legacy_ids', []) + [old, predecessor.get('identity_key') or old]))
        winner['previous_dates'] = sorted(set(winner.get('previous_dates', []) + [str(predecessor.get('date') or '')]))
payload['events'] = list(records.values())
for key in ('count', '_total_events'):
    if key in payload:
        payload[key] = len(records)
text = json.dumps(payload, ensure_ascii=False, separators=(',', ':')) + '\n'
if target.read_text() != text:
    prior_mtime = target.stat().st_mtime
    write_text_atomic(target, text)
    # Extracted artifacts can carry future stamps. Keep corrected content newer
    # than that generation so a workspace overlay cannot restore the old bytes.
    if prior_mtime > time.time() + 60:
        os.utime(target, (prior_mtime + 2, prior_mtime + 2))
print(f'Reviewed corrections applied from {len(ledgers)} dated ledgers; {len(records)} distinct records, {sum(len(ledger["identity_migrations"]) for ledger in ledgers)} preserved identity aliases.')
