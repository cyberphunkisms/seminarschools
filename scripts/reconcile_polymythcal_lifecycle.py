#!/usr/bin/env python3
"""Reconcile Polymythcal cancellations, disappearances, recurrence, and rescheduling."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from collections import Counter
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path

from dateutil.rrule import rrulestr

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CURRENT = ROOT / 'polymythseminars/events.json'
DEFAULT_STATE = ROOT / 'data/polymythcal-lifecycle-state.json'
DEFAULT_LOG = ROOT / 'data/polymythcal-lifecycle-log.json'
DEFAULT_SCRAPE_LOG = ROOT / 'data/scrape-log.json'
CANCEL_RE = re.compile(r'\b(cancelled|canceled|annul(?:é|e|ée|és|ees)?|annulation)\b', re.I)
POSTPONE_RE = re.compile(r'\b(postponed|report(?:é|e|ée|és|ees)?|remis(?:e)?|différé(?:e)?)\b', re.I)
RESCHED_RE = re.compile(r'\b(rescheduled|reprogrammé(?:e)?|nouvelle date|date modifiée|date changed?)\b', re.I)


def utc_stamp() -> str:
    return datetime.now(timezone.utc).isoformat(timespec='seconds')


def norm(value) -> str:
    return re.sub(r'[^a-z0-9]+', '', str(value or '').lower())


def source_key(event) -> str:
    return str(event.get('source_id') or event.get('source_url') or '')


def identity(event) -> str:
    if event.get('identity_key'):
        return str(event['identity_key'])
    basis = '|'.join([
        norm(event.get('title'))[:160],
        norm(source_key(event))[:120],
        norm(event.get('organizer'))[:80],
    ])
    return hashlib.sha256(basis.encode()).hexdigest()[:20]


def series_identity(event) -> str:
    return str(event.get('series_id') or identity(event))


def title_source_key(event) -> str:
    return f'{norm(event.get("title"))}|{norm(source_key(event))}'


def same_moment(a, b) -> bool:
    if str(a or '') == str(b or ''):
        return True
    try:
        da = datetime.fromisoformat(str(a).replace('Z', '+00:00'))
        db = datetime.fromisoformat(str(b).replace('Z', '+00:00'))
        return da == db
    except Exception:
        return False


def successful_sources(path: Path) -> set[str]:
    if not path.exists():
        return set()
    try:
        data = json.loads(path.read_text(encoding='utf-8'))
    except Exception:
        return set()
    return {str(item.get('id')) for item in data.get('sources', []) if item.get('status') == 'ok'}


def write_json_if_changed(path: Path, payload) -> bool:
    text = json.dumps(payload, ensure_ascii=False, indent=2) + '\n'
    if path.exists() and path.read_text(encoding='utf-8') == text:
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding='utf-8')
    return True


def write_text_if_changed(path: Path, text: str) -> bool:
    if path.exists() and path.read_text(encoding='utf-8') == text:
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding='utf-8')
    return True


def expand_recurrence(records):
    out = []
    for event in records:
        rule = event.get('rrule') or event.get('recurrence_rule')
        if not rule:
            out.append(event)
            continue
        try:
            start = datetime.fromisoformat(str(event['date']).replace('Z', '+00:00'))
            dates = list(rrulestr(rule, dtstart=start))[:366]
        except Exception:
            failed = deepcopy(event)
            failed.setdefault('lifecycle_notes', []).append('recurrence-parse-failed')
            out.append(failed)
            continue
        duration = None
        if event.get('end_date'):
            try:
                duration = datetime.fromisoformat(str(event['end_date']).replace('Z', '+00:00')) - start
            except Exception:
                pass
        sid = series_identity(event)
        for index, dt in enumerate(dates):
            instance = deepcopy(event)
            instance['series_id'] = sid
            instance['recurrence_index'] = index
            instance['recurrence_source'] = 'rrule'
            instance['date'] = dt.isoformat(timespec='minutes')
            if duration:
                instance['end_date'] = (dt + duration).isoformat(timespec='minutes')
            instance['identity_key'] = hashlib.sha256(f'{sid}|{instance["date"]}'.encode()).hexdigest()[:20]
            instance['id'] = f"{event.get('id') or sid}-{dt.strftime('%Y%m%dT%H%M')}"
            out.append(instance)
    return out


def text_status(event):
    value = ' '.join(str(event.get(key) or '') for key in ('title', 'description', 'raw_excerpt', 'status', 'lifecycle_note'))
    if CANCEL_RE.search(value):
        return 'cancelled'
    if POSTPONE_RE.search(value):
        return 'postponed'
    if RESCHED_RE.search(value):
        return 'rescheduled'
    return None


def reconcile(current, previous, ok_sources, stamp: str | None = None, missing_threshold=2):
    stamp = stamp or utc_stamp()
    current = expand_recurrence(current)
    prev_by_identity = {identity(event): event for event in previous}
    previous_title_source_counts = Counter(title_source_key(event) for event in previous)
    current_title_source_counts = Counter(title_source_key(event) for event in current)
    prev_by_title_source = {
        title_source_key(event): event
        for event in previous
        if previous_title_source_counts[title_source_key(event)] == 1
    }
    seen = set()
    changes = []
    result = []

    for raw in current:
        event = deepcopy(raw)
        ident = identity(event)
        event['identity_key'] = ident
        seen.add(ident)
        ts_key = title_source_key(event)
        prior = prev_by_identity.get(ident)
        if prior is None and current_title_source_counts[ts_key] == 1:
            prior = prev_by_title_source.get(ts_key)

        explicit = text_status(event)
        if explicit:
            if event.get('lifecycle_status') != explicit:
                changes.append({'identity_key': ident, 'change': explicit, 'title': event.get('title')})
            event['lifecycle_status'] = explicit
        elif prior and not same_moment(prior.get('date'), event.get('date')):
            old_dates = list(prior.get('previous_dates') or [])
            if prior.get('date') and prior.get('date') not in old_dates:
                old_dates.append(prior['date'])
            event['previous_dates'] = old_dates[-12:]
            event['lifecycle_status'] = 'rescheduled'
            event['rescheduled_at'] = stamp
            event['id'] = prior.get('id') or event.get('id')
            changes.append({
                'identity_key': ident,
                'change': 'rescheduled',
                'from': prior.get('date'),
                'to': event.get('date'),
                'title': event.get('title'),
            })
        elif prior and prior.get('lifecycle_status') == 'missing-on-source':
            event['lifecycle_status'] = 'active'
            event['reappeared_at'] = stamp
            event['missing_count'] = 0
            changes.append({'identity_key': ident, 'change': 'reappeared', 'title': event.get('title')})
        else:
            event.setdefault('lifecycle_status', 'active')
            event['missing_count'] = 0

        if prior:
            event.setdefault('first_seen_at', prior.get('first_seen_at') or stamp)
        else:
            event.setdefault('first_seen_at', stamp)
        event['last_checked_at'] = event.get('last_checked_at') or (prior or {}).get('last_checked_at') or stamp
        result.append(event)

    for prior in previous:
        ident = identity(prior)
        if ident in seen:
            continue
        sid = source_key(prior)
        if sid not in ok_sources:
            continue
        if prior.get('lifecycle_status') in {'cancelled', 'archived', 'superseded'}:
            continue
        missing = deepcopy(prior)
        missing['missing_count'] = int(prior.get('missing_count') or 0) + 1
        missing['last_checked_at'] = stamp
        if missing['missing_count'] >= missing_threshold:
            missing['lifecycle_status'] = 'missing-on-source'
            missing.setdefault('missing_since', stamp)
            changes.append({
                'identity_key': ident,
                'change': 'missing-on-source',
                'title': missing.get('title'),
                'source_id': sid,
            })
        result.append(missing)

    result.sort(key=lambda event: (str(event.get('date') or ''), str(event.get('title') or '')))
    return result, changes


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--current', type=Path, default=DEFAULT_CURRENT)
    parser.add_argument('--state', type=Path, default=DEFAULT_STATE)
    parser.add_argument('--log', type=Path, default=DEFAULT_LOG)
    parser.add_argument('--scrape-log', type=Path, default=DEFAULT_SCRAPE_LOG)
    parser.add_argument('--missing-threshold', type=int, default=2)
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()

    payload = json.loads(args.current.read_text(encoding='utf-8'))
    current = payload.get('events', [])
    previous = []
    state_payload = {}
    if args.state.exists():
        state_payload = json.loads(args.state.read_text(encoding='utf-8'))
        previous = state_payload.get('events', [])

    stamp = utc_stamp()
    reconciled, changes = reconcile(
        current,
        previous,
        successful_sources(args.scrape_log),
        stamp,
        args.missing_threshold,
    )

    unchanged = reconciled == current and not changes
    if unchanged:
        stable_stamp = (
            payload.get('_lifecycle_reconciled_at')
            or state_payload.get('generated_at')
            or (json.loads(args.log.read_text(encoding='utf-8')).get('generated_at') if args.log.exists() else None)
            or stamp
        )
        report = {
            'generated_at': stable_stamp,
            'previous_count': len(previous),
            'input_count': len(current),
            'output_count': len(reconciled),
            'changes': [],
            'status': 'unchanged',
        }
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return

    report = {
        'generated_at': stamp,
        'previous_count': len(previous),
        'input_count': len(current),
        'output_count': len(reconciled),
        'changes': changes,
        'status': 'updated',
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if args.dry_run:
        return

    payload['events'] = reconciled
    payload['count'] = payload['_total_events'] = len(reconciled)
    payload['_lifecycle_reconciled_at'] = stamp
    write_json_if_changed(args.current, payload)
    write_json_if_changed(args.state, {'generated_at': stamp, 'events': reconciled})
    write_json_if_changed(args.log, report)

    mirror = ROOT / 'data/polymyth-seminar-events.json'
    if args.current.resolve() == DEFAULT_CURRENT.resolve():
        write_text_if_changed(mirror, args.current.read_text(encoding='utf-8'))


if __name__ == '__main__':
    main()
