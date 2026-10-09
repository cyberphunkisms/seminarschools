"""Preserve source changes without overwriting a manually reviewed record."""
import hashlib
import json


def record_manual_observation(manual, incoming):
    changes = {
        field: {'reviewed': manual.get(field), 'observed': incoming[field]}
        for field in ('date', 'end_date', 'venue', 'source_url', 'lifecycle_status')
        if incoming.get(field) not in (None, '') and incoming[field] != manual.get(field)
    }
    if not changes:
        return
    observation = {
        'source_id': incoming.get('source_id'),
        'source_url': incoming.get('source_url'),
        'checked_at': incoming.get('last_checked_at') or incoming.get('scraped_at'),
        'changes': changes,
        'excerpt': incoming.get('raw_excerpt'),
        'status': 'pending-source-review',
    }
    key = hashlib.sha256(json.dumps(observation, sort_keys=True).encode()).hexdigest()
    observations = manual.setdefault('source_observations', [])
    if not any(row.get('key') == key for row in observations):
        observations.append({'key': key, **observation})
