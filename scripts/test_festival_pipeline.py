#!/usr/bin/env python3
import unittest
from datetime import datetime, timedelta, timezone

from scripts.merge_festivals import enforce_date_sanity, host_of, rss_date


class FestivalPipelineTests(unittest.TestCase):
    def test_www_prefix_is_removed_exactly(self):
        self.assertEqual(host_of("https://www.worldwideweb.example/events"), "worldwideweb.example")
        self.assertEqual(host_of("https://window.example/events"), "window.example")

    def test_rss_date_is_rfc_822_gmt(self):
        self.assertEqual(
            rss_date("2026-07-24T12:30:00-04:00"),
            "Fri, 24 Jul 2026 16:30:00 GMT",
        )

    def test_ongoing_festival_is_not_dropped_by_old_start_date(self):
        now = datetime.now(timezone.utc)
        records = [{
            "title": "Ongoing Festival",
            "date": (now - timedelta(days=20)).isoformat(),
            "end_date": (now + timedelta(days=1)).isoformat(),
        }]
        kept, dropped = enforce_date_sanity(records)
        self.assertEqual(kept, records)
        self.assertEqual(dropped, [])

    def test_finished_festival_is_dropped_using_end_date(self):
        now = datetime.now(timezone.utc)
        records = [{
            "title": "Finished Festival",
            "date": (now - timedelta(days=30)).isoformat(),
            "end_date": (now - timedelta(days=10)).isoformat(),
        }]
        kept, dropped = enforce_date_sanity(records)
        self.assertEqual(kept, [])
        self.assertEqual(len(dropped), 1)


if __name__ == "__main__":
    unittest.main()
