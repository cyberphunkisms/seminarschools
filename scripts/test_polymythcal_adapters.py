#!/usr/bin/env python3
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from polymythcal_adapters import infer_adapter, normalise_source_config, parse_html

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
