#!/usr/bin/env python3
"""Expose unresolved source observations in a private, deterministic review queue."""
import json
from pathlib import Path
from atomic_json import write_json_atomic

ROOT = Path(__file__).resolve().parents[1]
document = json.loads((ROOT / 'data/polymyth-seminar-events.json').read_text())
rows = []
for event in document['events']:
    for observation in event.get('source_observations', []):
        if observation.get('status') != 'pending-source-review':
            continue
        rows.append({
            'event_id': event['id'], 'title': event['title'],
            'reviewed_source_url': event.get('source_url'),
            'observation': observation,
            'next_action': 'Check the publisher evidence; preserve the accepted facts until the observation is adjudicated in a dated correction ledger.',
        })
rows.sort(key=lambda row: (row['event_id'], str(row['observation'].get('key', ''))))
write_json_atomic(ROOT / 'data/polymythcal-source-review-queue.json', {
    'schema': 'polymythcal-source-review-queue-v1', 'visibility': 'private',
    'count': len(rows), 'items': rows,
})
print(f'Private source-review queue: {len(rows)} pending observations.')
