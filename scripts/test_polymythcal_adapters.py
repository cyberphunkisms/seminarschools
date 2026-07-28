#!/usr/bin/env python3
import sys
import unittest
import json
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path

from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from harvest_structured_events import load_priority_sources, qualify
from merge_and_finalize import merge as merge_for_publication
from merge_and_finalize import validate as validate_finalizer
from polymythcal_adapters import infer_adapter, normalise_source_config, parse_html
from validate_polymythcal_sources import validation_errors

FIXTURES = ROOT / "scripts" / "fixtures" / "polymythcal"

class AdapterTests(unittest.TestCase):
    def parse(self, name, adapter, **source):
        html = (FIXTURES / f"{name}.html").read_text(encoding="utf-8")
        cfg = {
            "id": name,
            "name": name.title(),
            "url": f"https://example.org/{name}/",
            "city": source.pop("city", "Toronto"),
            "timezone": "America/Toronto",
            "platform_adapter": adapter,
            **source,
        }
        return parse_html(html, cfg, adapter)

    def test_source_contract_normalizes_url(self):
        cfg = normalise_source_config({"id":"x", "url":"https://example.org/events", "name":"City of X"})
        self.assertEqual(cfg["events_url"], "https://example.org/events")
        self.assertEqual(cfg["platform_adapter"], "municipal")

    def test_source_schema_requires_active_taxonomy_and_unique_ids(self):
        payload = json.loads(
            (ROOT / "scripts" / "sources.json").read_text(encoding="utf-8")
        )
        self.assertEqual(validation_errors(payload), [])

        missing_taxonomy = deepcopy(payload)
        active = next(
            source
            for source in missing_taxonomy["sources"]
            if source.get("enabled") is not False
        )
        del active["tier_priority"]
        self.assertTrue(
            any(
                "tier_priority" in error
                for error in validation_errors(missing_taxonomy)
            )
        )

        duplicate = deepcopy(payload)
        duplicate["sources"].append(deepcopy(duplicate["sources"][0]))
        self.assertTrue(
            any("duplicate id" in error for error in validation_errors(duplicate))
        )

    def test_priority_sources_have_nonempty_canonical_geography(self):
        sources = load_priority_sources()
        self.assertEqual(len(sources), 41)
        for source in sources:
            with self.subTest(source=source["id"]):
                self.assertTrue(source.get("city"))
                self.assertTrue(source.get("corridor_zone"))
                self.assertTrue(source.get("timezone"))

    def test_structured_record_passes_v2_and_publication_finalizer_schemas(self):
        source = next(
            row for row in load_priority_sources() if row["id"] == "queens-events"
        )
        record = {
            "id": "queens-ethics-lecture",
            "date": "2026-10-20T19:00:00-04:00",
            "end_date": None,
            "title": "Public Ethics Lecture",
            "venue": "Watson Hall, Kingston",
            "source_url": "https://www.queensu.ca/eventscalendar/event/ethics-lecture",
            "source_id": source["id"],
            "type": "lecture",
            "organizer": "Queen's University",
            "time_precision": "exact",
            "date_precision": "exact",
            "record_kind": "event",
            "lifecycle_status": "active",
            "confidence": 90,
        }
        qualified = qualify(
            record,
            source,
            datetime(2026, 7, 23, tzinfo=timezone.utc),
        )
        self.assertIsNotNone(qualified)
        v2_schema = json.loads(
            (ROOT / "data" / "polymythcal-event-schema-v2.json").read_text(
                encoding="utf-8"
            )
        )
        self.assertEqual(
            list(Draft202012Validator(v2_schema).iter_errors(qualified)),
            [],
        )
        finalizer_schema = json.loads(
            (ROOT / "data" / "seminars-schema.json").read_text(encoding="utf-8")
        )
        publication_records = merge_for_publication([qualified], [])
        self.assertEqual(
            validate_finalizer(publication_records, finalizer_schema),
            [],
        )

    def test_publication_merge_preserves_same_title_same_day_sessions(self):
        common = {
            "title": "Public Clinic",
            "source_id": "clinic-series",
            "type": "workshop",
            "review_status": "auto-published",
        }
        records = [
            {
                **common,
                "id": "clinic-morning",
                "date": "2026-10-20T10:00:00-04:00",
                "venue": "Room A",
                "source_url": "https://example.org/events/clinic-morning",
            },
            {
                **common,
                "id": "clinic-afternoon",
                "date": "2026-10-20T14:00:00-04:00",
                "venue": "Room B",
                "source_url": "https://example.org/events/clinic-afternoon",
            },
        ]
        merged = merge_for_publication(records, [])
        self.assertEqual(len(merged), 2)
        self.assertEqual({row["id"] for row in merged}, {"clinic-morning", "clinic-afternoon"})
        self.assertEqual(len({row["identity_key"] for row in merged}), 2)

    def test_inference_covers_six_profiles(self):
        cases = [
            ({"name":"City of Kingston Events"}, "municipal"),
            ({"name":"Queen's University Events"}, "university"),
            ({"name":"Brockville Public Library"}, "library"),
            ({"name":"Kingston WritersFest Festival"}, "festival"),
            ({"name":"Calendrier culturel", "language":"fr"}, "french-language"),
            ({"name":"Civic Action Rally Listings"}, "civic-action"),
        ]
        for source, expected in cases:
            self.assertEqual(infer_adapter(source), expected)

    def test_municipal(self):
        events = self.parse("municipal", "municipal", city="Kingston")
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["title"], "Public Art Walk")
        self.assertEqual(events[0]["time_precision"], "exact")

    def test_university_jsonld(self):
        events = self.parse("university", "university", city="Kingston")
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["type"], "lecture")
        self.assertIn("Watson Hall", events[0]["venue"])

    def test_library(self):
        events = self.parse("library", "library", city="Brockville")
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["type"], "workshop")
        self.assertIn("community", events[0]["secondary_types"])

    def test_festival(self):
        events = self.parse("festival", "festival", city="Kingston")
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["series_title"], "Kingston WritersFest")

    def test_french_date_and_reschedule(self):
        events = self.parse("french", "french-language", city="Montréal", language="fr")
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["date"][:16], "2026-10-12T19:30")
        self.assertEqual(events[0]["lifecycle_status"], "rescheduled")
        self.assertEqual(events[0]["source_language"], "fr")

    def test_civic_status(self):
        events = self.parse("civic", "civic-action")
        self.assertEqual(len(events), 2)
        by_title = {e["title"]: e for e in events}
        self.assertEqual(by_title["Climate Justice March"]["type"], "protest")
        self.assertEqual(by_title["Housing Rally"]["lifecycle_status"], "cancelled")

if __name__ == "__main__":
    unittest.main()
