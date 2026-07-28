#!/usr/bin/env python3
"""Focused regression tests for the approved Audit 43 discovery changes."""
from __future__ import annotations

import sys
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from harvest_protests import extract_undated_announcements  # noqa: E402
from polymythcal_discovery import (  # noqa: E402
    FetchOutcome,
    _mixed_calendar_filter,
    parse_ical,
)
from polymythcal_http_cache import ParsedResponseCache  # noqa: E402
from polymythcal_identity_shadow import identity_shadow_decision  # noqa: E402


def calendar_source(**overrides):
    value = {
        "id": "audit43-calendar",
        "name": "Audit 43 calendar",
        "events_url": "https://example.org/events.ics",
        "default_type": "protest",
        "city": "Toronto",
        "timezone": "America/Toronto",
        "recurrence_reference_date": "2026-07-01T00:00:00-04:00",
    }
    value.update(overrides)
    return value


class Audit43DiscoveryTests(unittest.TestCase):
    def test_rrule_honours_count_exdate_duration_and_bounded_cap(self):
        document = """BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:weekly-march@example.org
DTSTART;TZID=America/Toronto:20260701T180000
DTEND;TZID=America/Toronto:20260701T193000
RRULE:FREQ=WEEKLY;COUNT=6
EXDATE;TZID=America/Toronto:20260715T180000
SUMMARY:Weekly housing march
LOCATION:Queen's Park
END:VEVENT
END:VCALENDAR
"""
        records = parse_ical(
            document,
            calendar_source(recurrence_occurrence_cap=3),
        )
        self.assertEqual(len(records), 3)
        self.assertEqual(
            [item["date"][:10] for item in records],
            ["2026-07-01", "2026-07-08", "2026-07-22"],
        )
        self.assertTrue(all(item.get("recurrence_id") for item in records))
        self.assertTrue(all(item["end_date"] > item["date"] for item in records))

    def test_mixed_calendar_requires_explicit_include_rules(self):
        with self.assertRaisesRegex(ValueError, "no include_event_patterns"):
            _mixed_calendar_filter(
                [{"title": "Housing rally", "description": "", "type": "protest"}],
                {"id": "mixed", "mixed_calendar": True},
            )

    def test_mixed_calendar_excludes_unrelated_organizer_events(self):
        records = [
            {
                "title": "Tenant rally at City Hall",
                "description": "Public demonstration for affordable housing",
                "organizer": "Toronto ACORN",
                "type": "protest",
            },
            {
                "title": "Board training webinar",
                "description": "Quarterly professional development",
                "organizer": "Toronto ACORN",
                "type": "workshop",
            },
        ]
        filtered = _mixed_calendar_filter(
            records,
            {
                "id": "mixed",
                "mixed_calendar": True,
                "include_event_patterns": [r"\b(rally|demonstration)\b"],
                "exclude_event_patterns": [r"\btraining\b"],
                "allowed_event_types": ["protest"],
            },
        )
        self.assertEqual([item["title"] for item in filtered], ["Tenant rally at City Hall"])

    def test_http_304_reuses_only_a_parser_bound_observation(self):
        with tempfile.TemporaryDirectory() as directory:
            cache = ParsedResponseCache(Path(directory) / "cache.json")
            url = "https://example.org/events"
            success = FetchOutcome(
                url=url,
                status="success",
                body="<article>Housing rally</article>",
                etag='"v1"',
                http_status=200,
            )
            records = [{"title": "Housing rally", "date": "2026-08-01T12:00:00-04:00"}]
            cache.store(url, success, records=records, discovered_urls=[])
            retained = cache.reuse(
                url,
                FetchOutcome(url=url, status="not-modified", etag='"v1"', http_status=304),
            )
            self.assertEqual(retained["records"], records)

            bare_cache = ParsedResponseCache(Path(directory) / "bare.json")
            self.assertIsNone(
                bare_cache.reuse(
                    url,
                    FetchOutcome(url=url, status="not-modified", etag='"v1"', http_status=304),
                )
            )

    def test_undated_announcement_never_becomes_a_calendar_event(self):
        rows = extract_undated_announcements(
            """
            <article>
              <h2>Save the date: housing march</h2>
              <p>A major tenant rally is coming soon. Date, time, and assembly
              location are to be announced.</p>
              <a href="/housing-action">Announcement</a>
            </article>
            """,
            {
                "id": "tenant-union",
                "name": "Tenant Union",
                "timezone": "America/Toronto",
                "undated_candidates": True,
            },
            "https://example.org/news/",
            checked_at=datetime(2026, 7, 25, 12, tzinfo=timezone.utc),
            recheck_hours=168,
        )
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["record_kind"], "announcement-candidate")
        self.assertNotIn("date", rows[0])
        self.assertEqual(rows[0]["missing_details"][0], "event-date")
        self.assertIn("2026-08-01", rows[0]["next_recheck_at"])

    def test_identity_shadow_keeps_recurrences_distinct_but_flags_reschedule(self):
        existing = [
            {
                "id": "housing-march-old",
                "title": "Toronto Housing March",
                "date": "2026-08-01T12:00:00-04:00",
                "external_uid": "housing-march@example.org",
                "source_id": "tenant-union",
                "source_url": "https://example.org/housing-march",
                "organizer": "Tenant Union",
            }
        ]
        incoming = {
            **existing[0],
            "id": "housing-march-new",
            "date": "2026-08-08T12:00:00-04:00",
        }
        reschedule = identity_shadow_decision(
            existing,
            incoming,
            current_action="add",
            current_target_index=None,
            recurring_batch=False,
        )
        self.assertEqual(reschedule["shadow_action"], "reschedule")
        self.assertEqual(reschedule["shadow_target_id"], "housing-march-old")

        recurring = identity_shadow_decision(
            existing,
            {**incoming, "recurrence_id": "2026-08-08T12:00-04:00"},
            current_action="add",
            current_target_index=None,
            recurring_batch=True,
        )
        self.assertEqual(recurring["shadow_action"], "add")
        self.assertEqual(
            recurring["reason"],
            "recurring-occurrences-must-remain-distinct",
        )


if __name__ == "__main__":
    unittest.main()
