#!/usr/bin/env python3
"""Focused Audit47 regressions for feeds, recurrence, and legacy ICS continuity."""
from __future__ import annotations

import importlib.util
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from datetime import datetime, timedelta
from difflib import SequenceMatcher
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
RETIRED_DUPLICATE_IDS = {
    '98410ad8a93b',
    '9da10dbbb785',
    'toronto-caribbean-carnival-2026-caribana-59th-year-2026-07-30',
    'caribana-official-launch-2026-2026-06-13',
    'caribana-grand-parade-2026-08-01',
}


def load_module(name: str, relative: str):
    spec = importlib.util.spec_from_file_location(name, ROOT / relative)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


class FeedClassificationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.feeds = load_module('audit47_feeds', 'scripts/build-polymythcal-feeds.py')

    def test_french_feed_uses_language_metadata_not_montreal_location(self):
        english_montreal = {
            'title': 'Concordia Farmers Market',
            'city': 'Montréal',
            'source_language': 'und',
            'source_languages': [],
        }
        french = {'source_language': 'fr-CA', 'source_languages': ['fr-CA']}
        multilingual = {'source_language': 'mul', 'source_languages': ['en-CA', 'fr-CA']}
        self.assertFalse(self.feeds.FOCUSES['fr'][2](english_montreal))
        self.assertTrue(self.feeds.FOCUSES['fr'][2](french))
        self.assertTrue(self.feeds.FOCUSES['fr'][2](multilingual))

    def test_arts_feed_does_not_match_art_inside_unrelated_words(self):
        for title in (
            'Philosophy Department Talk',
            'Royal Tea Party',
            'Parade start time',
            'James Bartleman Award',
            'Hart House Symposium',
        ):
            event = {'title': title, 'type': 'lecture', 'secondary_types': []}
            self.assertFalse(self.feeds.FOCUSES['arts'][2](event), title)
        self.assertTrue(self.feeds.FOCUSES['arts'][2]({
            'title': 'Public art gallery tour',
            'type': 'community',
            'secondary_types': [],
        }))


class RecurrenceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.lifecycle = load_module(
            'audit47_lifecycle',
            'scripts/reconcile_polymythcal_lifecycle.py',
        )

    def test_open_ended_recurrence_is_bounded_before_materialization(self):
        records = self.lifecycle.expand_recurrence([{
            'id': 'daily-series',
            'identity_key': 'daily-series-identity',
            'series_id': 'daily-series',
            'date': '2026-07-26T10:00:00-04:00',
            'timezone': 'America/Toronto',
            'rrule': 'FREQ=DAILY',
        }])
        self.assertEqual(len(records), 366)
        self.assertEqual(records[-1]['recurrence_index'], 365)

    def test_toronto_wall_time_survives_fall_dst_transition(self):
        records = self.lifecycle.expand_recurrence([{
            'id': 'weekly-series',
            'identity_key': 'weekly-series-identity',
            'series_id': 'weekly-series',
            'date': '2026-10-25T10:00:00-04:00',
            'end_date': '2026-10-25T11:00:00-04:00',
            'timezone': 'America/Toronto',
            'rrule': 'FREQ=WEEKLY;COUNT=3',
        }])
        self.assertEqual(
            [record['date'] for record in records],
            [
                '2026-10-25T10:00-04:00',
                '2026-11-01T10:00-05:00',
                '2026-11-08T10:00-05:00',
            ],
        )
        for record in records:
            start = datetime.fromisoformat(record['date'])
            end = datetime.fromisoformat(record['end_date'])
            self.assertEqual(end - start, timedelta(hours=1))

    def test_toronto_wall_time_survives_spring_dst_transition(self):
        records = self.lifecycle.expand_recurrence([{
            'id': 'spring-weekly-series',
            'identity_key': 'spring-weekly-series-identity',
            'series_id': 'spring-weekly-series',
            'date': '2027-03-07T10:00:00-05:00',
            'end_date': '2027-03-07T11:00:00-05:00',
            'timezone': 'America/Toronto',
            'rrule': 'FREQ=WEEKLY;COUNT=3',
        }])
        self.assertEqual(
            [record['date'] for record in records],
            [
                '2027-03-07T10:00-05:00',
                '2027-03-14T10:00-04:00',
                '2027-03-21T10:00-04:00',
            ],
        )
        for record in records:
            start = datetime.fromisoformat(record['date'])
            end = datetime.fromisoformat(record['end_date'])
            self.assertEqual(end - start, timedelta(hours=1))


class LegacyIcsTests(unittest.TestCase):
    def test_explicit_legacy_ids_receive_canonical_ics_content(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'scripts').mkdir()
            shutil.copy2(
                ROOT / 'scripts/build-polymythcal-audit13.py',
                root / 'scripts/build-polymythcal-audit13.py',
            )
            (root / 'polymythseminars').mkdir()
            (root / 'RELEASE_MANIFEST.json').write_text(json.dumps({
                'generated_at': '2026-07-26T12:00:00-04:00',
                'polymythcal_asset_version': '20260725-audit45',
            }), encoding='utf-8')
            event = {
                'id': 'canonical-event',
                'identity_key': 'canonical-event-identity',
                'legacy_ids': ['old-event-id'],
                'date': '2026-08-01T10:00:00-04:00',
                'end_date': '2026-08-01T11:00:00-04:00',
                'date_precision': 'exact',
                'time_precision': 'exact',
                'timezone': 'America/Toronto',
                'title': 'Canonical Event',
                'venue': 'Test Hall',
                'city': 'Toronto',
                'description': 'Organizer text.',
                'source_url': 'https://example.test/event',
                'source_quality': 'official-or-institutional',
                'source_language': 'en-CA',
                'confirmation_status': 'confirmed',
                'qualification_reasons': [],
                'lifecycle_status': 'active',
                'last_checked_at': '2026-07-26T12:00:00-04:00',
                'type': 'lecture',
            }
            (root / 'polymythseminars/events.json').write_text(
                json.dumps({'events': [event]}),
                encoding='utf-8',
            )
            subprocess.run(
                [sys.executable, str(root / 'scripts/build-polymythcal-audit13.py')],
                cwd=root,
                check=True,
                capture_output=True,
                text=True,
            )
            canonical = (root / 'polymythseminars/ics/canonical-event.ics').read_bytes()
            legacy = (root / 'polymythseminars/ics/old-event-id.ics').read_bytes()
            self.assertEqual(legacy, canonical)
            self.assertIn(
                b'URL:https://seminarschools.com/polymythseminars/events/canonical-event/',
                legacy.replace(b'\r\n ', b''),
            )


class CurrentDataConsolidationTests(unittest.TestCase):
    def setUp(self):
        self.payloads = [
            json.loads((ROOT / relative).read_text(encoding='utf-8'))
            for relative in (
                'polymythseminars/events.json',
                'data/polymyth-seminar-events.json',
                'data/polymythcal-lifecycle-state.json',
            )
        ]

    def test_current_state_surfaces_preserve_consolidated_aliases_and_hierarchy(self):
        for payload in self.payloads:
            events = payload['events']
            by_id = {event['id']: event for event in events}
            self.assertEqual(RETIRED_DUPLICATE_IDS & set(by_id), set())
            self.assertEqual(len(events), 833)

            self.assertTrue({
                '98410ad8a93b',
                'c5886c8e117e20ec199f',
                '9da10dbbb785',
                'fec4b1adf01c0d1256cb',
            }.issubset(by_id['3018f2437e1f']['legacy_ids']))
            self.assertTrue({
                'toronto-caribbean-carnival-2026-caribana-59th-year-2026-07-30',
                '4b607ac0260d4e0bf7a0',
            }.issubset(by_id['275a3d6c2cb5']['legacy_ids']))
            self.assertTrue({
                'caribana-official-launch-2026-2026-06-13',
                '22f33e9649f13bf1aac5',
            }.issubset(by_id['edb124435d99']['legacy_ids']))
            self.assertTrue({
                'caribana-grand-parade-2026-08-01',
                '92de21e054230cc057f4',
            }.issubset(by_id['119d86af47de']['legacy_ids']))

            for event in events:
                self.assertNotEqual(
                    event.get('parent_id'),
                    'caribana-official-launch-2026-2026-06-13',
                )
            for event_id in (
                'edb124435d99',
                'caribana-junior-king-queen-showcase-2026-07-11',
                'ocpa-calypso-showcase-caribana-2026-07-25',
                'king-queen-showcase-caribana-2026-07-30',
                'caribana-king-queen-showcase-2026-07-31',
                '119d86af47de',
                'caribana-pan-alive-closing-day-2026-08-02',
            ):
                self.assertEqual(by_id[event_id].get('parent_id'), '275a3d6c2cb5')

    def test_no_high_similarity_same_source_overlapping_duplicates_remain(self):
        events = self.payloads[0]['events']

        def source_key(event):
            parsed = urlsplit(str(event.get('source_url') or ''))
            return (
                parsed.netloc.lower().removeprefix('www.'),
                parsed.path.rstrip('/').lower(),
            )

        def interval(event):
            start = datetime.fromisoformat(str(event['date']).replace('Z', '+00:00'))
            end = datetime.fromisoformat(
                str(event.get('end_date') or event['date']).replace('Z', '+00:00')
            )
            return min(start, end), max(start, end)

        def title_key(event):
            value = str(event.get('title') or '').casefold()
            value = self.lifecycle_words(value)
            return value

        suspicious = []
        for index, first in enumerate(events):
            if first.get('confirmation_status') != 'confirmed':
                continue
            for second in events[index + 1:]:
                if second.get('confirmation_status') != 'confirmed':
                    continue
                if source_key(first) != source_key(second):
                    continue
                first_start, first_end = interval(first)
                second_start, second_end = interval(second)
                if first_end < second_start or second_end < first_start:
                    continue
                similarity = SequenceMatcher(
                    None,
                    title_key(first),
                    title_key(second),
                ).ratio()
                if similarity >= 0.84:
                    suspicious.append((first['id'], second['id'], similarity))
        self.assertEqual(suspicious, [])

    @staticmethod
    def lifecycle_words(value):
        import re
        value = re.sub(r'[^a-z0-9]+', ' ', value)
        value = re.sub(
            r'\b(?:2026|annual|anniversary|the|a|an|and|city|wide|toronto)\b',
            ' ',
            value,
        )
        return ' '.join(value.split())


if __name__ == '__main__':
    unittest.main()
