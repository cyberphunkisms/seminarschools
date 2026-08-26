#!/usr/bin/env python3
"""Focused Audit47 regressions for feeds, recurrence, and legacy ICS continuity."""
from __future__ import annotations

import importlib.util
import hashlib
import html
import json
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from difflib import SequenceMatcher
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
INVENTORY_CONTRACT = json.loads(
    (ROOT / 'data' / 'polymythcal-inventory-contract.json').read_text(encoding='utf-8')
)
MINIMUM_CANONICAL_EVENTS = int(INVENTORY_CONTRACT['minimum_canonical_events'])
RETIRED_DUPLICATE_IDS = {
    '98410ad8a93b',
    '9da10dbbb785',
    'toronto-caribbean-carnival-2026-caribana-59th-year-2026-07-30',
    'caribana-official-launch-2026-2026-06-13',
    'caribana-grand-parade-2026-08-01',
}
CARIBANA_PARENT_EXPECTATIONS = {
    # The Aug. 14 Set 10 reconstruction preserves the authoritative source
    # records as found; it does not invent a festival hierarchy. Only the two
    # inherited seminar-harvest occurrences carry an explicit parent link.
    '275a3d6c2cb5': None,
    'edb124435d99': None,
    'caribana-junior-king-queen-showcase-2026-07-11': None,
    'ocpa-calypso-showcase-caribana-2026-07-25': '275a3d6c2cb5',
    'king-queen-showcase-caribana-2026-07-30': '275a3d6c2cb5',
    'caribana-king-queen-showcase-2026-07-31': None,
    '119d86af47de': None,
    'caribana-pan-alive-closing-day-2026-08-02': None,
}
EXPECTED_DISCOVERY_COUNTS = {'canonical': 2_088, 'chronology': 1_954, 'watchlist': 134}
WATCHLIST_REASON = {
    'code': 'monitoring-marker',
    'detail': 'Displayed date is a monitoring marker, not a confirmed event or deadline date.',
}


def load_module(name: str, relative: str):
    path = ROOT / relative
    scripts_path = str(path.parent)
    added_scripts_path = scripts_path not in sys.path
    if added_scripts_path:
        sys.path.insert(0, scripts_path)
    try:
        spec = importlib.util.spec_from_file_location(name, path)
        module = importlib.util.module_from_spec(spec)
        assert spec.loader is not None
        spec.loader.exec_module(module)
        return module
    finally:
        if added_scripts_path:
            sys.path.remove(scripts_path)


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

    def test_civic_feed_does_not_treat_calendar_month_as_a_march(self):
        for title, description in (
            ('Kids Write 4 Kids', 'Submissions close March 31, 2027.'),
            ('Inklings Book Contest', 'The January to March submission window.'),
            ('March Writing Contest', 'A seasonal student competition.'),
        ):
            event = {
                'title': title,
                'description': description,
                'type': 'contest',
                'secondary_types': [],
                'record_kind': 'opportunity',
            }
            self.assertFalse(self.feeds.FOCUSES['civic'][2](event), title)
        self.assertTrue(self.feeds.FOCUSES['civic'][2]({
            'title': 'Climate justice march',
            'type': 'gathering',
            'secondary_types': [],
            'record_kind': 'event',
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

    def test_interval_parser_normalizes_aware_and_date_only_endpoints(self):
        event = {
            'date': '2026-08-14T17:00:00-04:00',
            'end_date': '2026-08-16',
            'timezone': 'America/New_York',
        }
        start, end = self.lifecycle.event_interval(event)
        self.assertEqual(start, datetime(2026, 8, 14, 21, 0, tzinfo=timezone.utc))
        self.assertEqual(end, datetime(2026, 8, 16, 4, 0, tzinfo=timezone.utc))
        self.assertIs(start.tzinfo, timezone.utc)
        self.assertIs(end.tzinfo, timezone.utc)


class LegacyIcsTests(unittest.TestCase):
    def test_explicit_legacy_ids_receive_canonical_ics_content(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for relative in (
                'scripts/build-polymythcal-audit13.py',
                'scripts/geometry_asset_version.py',
                'scripts/apply-sitewide-type-zoom-link.js',
                'data/geometry-route-contracts.json',
                'css/alive.css',
                'js/mandala.js',
                'js/indra.js',
            ):
                destination = root / relative
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(ROOT / relative, destination)
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
            (root / 'data/polymythcal-publication-surfaces.json').write_text(
                json.dumps({
                    '_schema': 'polymythcal-publication-surfaces-v2',
                    'schema': 'polymythcal-publication-surfaces-v2',
                    'canonical_count': 1,
                    'chronology_count': 1,
                    'watchlist_count': 0,
                    'chronology_ids': ['canonical-event'],
                    'watchlist_ids': [],
                    'reasons': {},
                }),
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


class PublicationSurfaceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.canonical = json.loads(
            (ROOT / 'data/polymyth-seminar-events.json').read_text(encoding='utf-8')
        )
        cls.private_mirror = json.loads(
            (ROOT / 'polymythseminars/events.json').read_text(encoding='utf-8')
        )
        cls.browse = json.loads(
            (ROOT / 'polymythseminars/browse.json').read_text(encoding='utf-8')
        )
        cls.watchlist = json.loads(
            (ROOT / 'polymythseminars/watchlist.json').read_text(encoding='utf-8')
        )
        cls.surfaces = json.loads(
            (ROOT / 'data/polymythcal-publication-surfaces.json').read_text(encoding='utf-8')
        )

    def test_discovery_v2_is_an_exact_disjoint_partition(self):
        canonical_ids = [event['id'] for event in self.canonical['events']]
        browse_ids = [event['id'] for event in self.browse['events']]
        watchlist_ids = [event['id'] for event in self.watchlist['items']]

        self.assertEqual(len(canonical_ids), EXPECTED_DISCOVERY_COUNTS['canonical'])
        self.assertEqual(len(browse_ids), EXPECTED_DISCOVERY_COUNTS['chronology'])
        self.assertEqual(len(watchlist_ids), EXPECTED_DISCOVERY_COUNTS['watchlist'])
        self.assertEqual(len(canonical_ids), len(set(canonical_ids)))
        self.assertEqual(len(browse_ids), len(set(browse_ids)))
        self.assertEqual(len(watchlist_ids), len(set(watchlist_ids)))
        self.assertFalse(set(browse_ids) & set(watchlist_ids))
        self.assertEqual(set(browse_ids) | set(watchlist_ids), set(canonical_ids))
        self.assertEqual(self.surfaces['_schema'], 'polymythcal-publication-surfaces-v2')
        self.assertEqual(self.surfaces['schema'], 'polymythcal-publication-surfaces-v2')
        self.assertEqual(self.surfaces['chronology_ids'], browse_ids)
        self.assertEqual(self.surfaces['watchlist_ids'], watchlist_ids)
        self.assertEqual(list(self.surfaces['reasons']), watchlist_ids)
        self.assertEqual(
            self.surfaces['reasons'],
            {event_id: WATCHLIST_REASON for event_id in watchlist_ids},
        )
        self.assertEqual(self.browse['count'], len(browse_ids))
        self.assertEqual(self.browse['_chronology_count'], len(browse_ids))
        self.assertEqual(self.browse['_canonical_count'], len(canonical_ids))
        self.assertEqual(self.watchlist['count'], len(watchlist_ids))
        self.assertEqual(self.watchlist['_canonical_count'], len(canonical_ids))

    def test_watchlist_exactly_matches_explicit_monitoring_markers(self):
        marker_ids = []
        for event in self.canonical['events']:
            evidence = f"{event.get('description', '')} {event.get('raw_excerpt', '')}"
            if (
                event.get('date_precision') == 'estimated'
                and re.search(r'\bmonitoring marker\b', evidence, flags=re.I)
            ):
                marker_ids.append(event['id'])
        watchlist_ids = [event['id'] for event in self.watchlist['items']]
        self.assertEqual(marker_ids, watchlist_ids)
        for item in self.watchlist['items']:
            self.assertNotIn('date', item)
            self.assertNotIn('end_date', item)
            self.assertEqual(item['date_status'], 'awaiting-confirmed-date')

    def test_private_corpus_and_monitoring_route_quarantine(self):
        self.assertEqual(self.private_mirror, self.canonical)
        self.assertFalse((ROOT / 'public/polymythseminars/events.json').exists())
        sitemap = (ROOT / 'sitemap.xml').read_text(encoding='utf-8')
        canonical_by_id = {event['id']: event for event in self.canonical['events']}

        def hashed_alias(value):
            source = html.unescape(str(value or 'event')).lower().replace('&', ' and ')
            slug = re.sub(r'[^a-z0-9]+', '-', source).strip('-')[:76] or 'event'
            digest = hashlib.sha1(str(value).encode()).hexdigest()[:8]
            return f'{slug}-{digest}'

        for event_id in self.surfaces['watchlist_ids']:
            event = canonical_by_id[event_id]
            legacy_ids = [str(value) for value in event.get('legacy_ids', [])]
            english_ids = {event_id, hashed_alias(event_id)}
            french_ids = {event_id}
            ics_ids = {event_id}
            for legacy_id in legacy_ids:
                english_ids.update((legacy_id, hashed_alias(legacy_id)))
                french_ids.add(legacy_id)
                ics_ids.add(legacy_id)
            for route_id in english_ids:
                self.assertFalse((ROOT / f'polymythseminars/events/{route_id}/index.html').exists())
                self.assertFalse((ROOT / f'public/polymythseminars/events/{route_id}/index.html').exists())
                self.assertNotIn(
                    f'<loc>https://seminarschools.com/polymythseminars/events/{route_id}/</loc>',
                    sitemap,
                )
            for route_id in french_ids:
                self.assertFalse((ROOT / f'polymythseminars/fr/events/{route_id}/index.html').exists())
                self.assertFalse((ROOT / f'public/polymythseminars/fr/events/{route_id}/index.html').exists())
                self.assertNotIn(
                    f'<loc>https://seminarschools.com/polymythseminars/fr/events/{route_id}/</loc>',
                    sitemap,
                )
            for route_id in ics_ids:
                self.assertFalse((ROOT / f'polymythseminars/ics/{route_id}.ics').exists())
                self.assertFalse((ROOT / f'public/polymythseminars/ics/{route_id}.ics').exists())


class CurrentDataConsolidationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.lifecycle = load_module(
            'audit47_current_data_lifecycle',
            'scripts/reconcile_polymythcal_lifecycle.py',
        )

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
            self.assertGreaterEqual(len(events), MINIMUM_CANONICAL_EVENTS)

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
    def test_optional_authoritative_parent_links_are_preserved(self):
        for payload in self.payloads:
            by_id = {event['id']: event for event in payload['events']}
            for event_id, expected_parent in CARIBANA_PARENT_EXPECTATIONS.items():
                self.assertIn(event_id, by_id)
                self.assertEqual(by_id[event_id].get('parent_id'), expected_parent)
                if expected_parent is not None:
                    self.assertIn(expected_parent, by_id)
                    self.assertNotEqual(event_id, expected_parent)

    def test_no_high_similarity_same_source_overlapping_duplicates_remain(self):
        events = self.payloads[0]['events']

        reconciled, collapse_changes = self.lifecycle.collapse_shadow_duplicates(
            events,
            include_changes=True,
        )
        self.assertEqual(len(reconciled), 2_088)
        self.assertEqual(collapse_changes, [])
        self.assertEqual(
            [event['id'] for event in reconciled],
            [event['id'] for event in events],
        )

        def source_key(event):
            parsed = urlsplit(str(event.get('source_url') or ''))
            return (
                parsed.netloc.lower().removeprefix('www.'),
                parsed.path.rstrip('/').lower(),
            )

        def interval(event):
            start = self.lifecycle.parse_event_datetime(event, event['date'])
            end = self.lifecycle.parse_event_datetime(
                event,
                event.get('end_date') or event['date'],
            )
            self.assertIsNotNone(start)
            self.assertIsNotNone(end)
            self.assertIsNotNone(start.utcoffset())
            self.assertIsNotNone(end.utcoffset())
            return min(start, end), max(start, end)

        def title_key(event):
            value = str(event.get('title') or '').casefold()
            value = self.lifecycle_words(value)
            return value

        def structurally_related(first, second):
            first_parent = str(first.get('parent_id') or '')
            second_parent = str(second.get('parent_id') or '')
            return (
                first_parent == second['id']
                or second_parent == first['id']
                or (first_parent and first_parent == second_parent)
            )

        def opportunity_category(event):
            """Return the named category, excluding catalog/deadline boilerplate."""
            if event.get('record_kind') != 'opportunity':
                return ()

            import re

            generic = {
                'application', 'applications', 'call', 'calls', 'competition',
                'competitions', 'contest', 'contests', 'deadline', 'deadlines',
                'grant', 'grants', 'submission', 'submissions',
            }
            for field in ('organizer', 'source_name', 'opportunity_kind', 'type'):
                generic.update(
                    re.findall(r'[a-z0-9]+', str(event.get(field) or '').casefold())
                )

            return tuple(
                token
                for token in re.findall(
                    r'[a-z0-9]+',
                    str(event.get('title') or '').casefold(),
                )
                if token not in generic and not re.fullmatch(r'20\d{2}', token)
            )

        def distinct_named_opportunity_categories(first, second):
            first_category = opportunity_category(first)
            second_category = opportunity_category(second)
            return bool(
                first_category
                and second_category
                and first_category != second_category
            )

        suspicious = []
        for index, first in enumerate(events):
            if first.get('confirmation_status') != 'confirmed':
                continue
            for second in events[index + 1:]:
                if second.get('confirmation_status') != 'confirmed':
                    continue
                if source_key(first) != source_key(second):
                    continue
                if structurally_related(first, second):
                    continue
                if distinct_named_opportunity_categories(first, second):
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

