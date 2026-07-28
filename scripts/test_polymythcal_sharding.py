#!/usr/bin/env python3
import json
import sys
import unittest
from collections import Counter
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from polymythcal_sharding import (  # noqa: E402
    priority_deterministic_sources,
    rotating_deterministic_source_pool,
    scheduled_deterministic_sources,
    scheduled_shard,
    stable_source_shard,
    successful_deterministic_source_ids,
)

ROSTER_PATH = ROOT / "scripts" / "sources.json"


class ShardingTests(unittest.TestCase):
    def test_weekly_schedule_covers_full_cycle_in_order(self):
        monday = date(2026, 1, 5)
        runs = [monday + timedelta(weeks=week) for week in range(8)]
        self.assertEqual([scheduled_shard(day, 8) for day in runs], list(range(8)))

    def test_manual_runs_repeat_the_calendar_week_slot(self):
        self.assertEqual(scheduled_shard(date(2026, 1, 6), 8), 0)
        self.assertEqual(scheduled_shard(date(2026, 1, 9), 8), 0)

    def test_source_hash_is_stable_and_bounded(self):
        self.assertEqual(
            stable_source_shard("kingston-city", 4),
            stable_source_shard("kingston-city", 4),
        )
        self.assertIn(stable_source_shard("kingston-city", 4), range(4))

    def test_weekly_festival_schedule_covers_every_shard(self):
        tuesday = date(2026, 7, 28)
        runs = [tuesday + timedelta(weeks=week) for week in range(7)]
        shards = [scheduled_shard(day, 7) for day in runs]
        self.assertEqual(len(set(shards)), 7)
        self.assertEqual(
            shards,
            [(shards[0] + offset) % 7 for offset in range(7)],
        )

    def test_all_and_only_fully_successful_deterministic_sources_are_skipped(self):
        roster = {
            "sources": [
                {"id": "tier1-ok", "tier_priority": 1},
                {"id": "tier1-partial", "tier_priority": 1},
                {"id": "tier2-ok", "tier_priority": 2},
                {"id": "tier2-blocked", "tier_priority": 2},
                {"id": "tier2-fetch-error", "tier_priority": 2},
                {"id": "tier2-parse-regression", "tier_priority": 2},
                {"id": "tier2-confirmed-empty", "tier_priority": 2},
                {"id": "tier2-not-modified", "tier_priority": 2},
                {"id": "tier2-corroboration", "tier_priority": 2},
            ]
        }
        payloads = [{
            "source_yields": [
                {"source_id": "tier1-ok", "status": "success"},
                {"source_id": "tier1-partial", "status": "partial-failure"},
                {"source_id": "tier2-ok", "status": "success"},
                {"source_id": "tier2-blocked", "status": "blocked"},
                {"source_id": "tier2-fetch-error", "status": "fetch-error"},
                {
                    "source_id": "tier2-parse-regression",
                    "status": "parse-empty-regression",
                },
                {
                    "source_id": "tier2-confirmed-empty",
                    "status": "confirmed-empty",
                },
                {"source_id": "tier2-not-modified", "status": "not-modified"},
                {
                    "source_id": "tier2-corroboration",
                    "role": "corroboration",
                    "status": "success",
                },
                {"source_id": "not-in-roster", "status": "success"},
            ]
        }]
        self.assertEqual(
            successful_deterministic_source_ids(roster, payloads),
            ["tier1-ok", "tier2-ok"],
        )


class DeterministicSourceSelectionTests(unittest.TestCase):
    def setUp(self):
        self.payload = json.loads(ROSTER_PATH.read_text(encoding="utf-8"))
        self.priority_ids = {
            source["id"] for source in priority_deterministic_sources(self.payload)
        }
        self.rotating_ids = {
            source["id"]
            for source in rotating_deterministic_source_pool(self.payload)
        }
        self.run_dates = [
            date(2026, 1, 5),
            date(2026, 1, 12),
            date(2026, 1, 19),
            date(2026, 1, 26),
        ]

    def test_real_roster_count_and_priority_compatibility_are_unchanged(self):
        self.assertEqual(len(self.payload["sources"]), 422)
        self.assertEqual(len(self.priority_ids), 41)
        disabled = [
            source
            for source in self.payload["sources"]
            if source.get("enabled") is False
        ]
        self.assertEqual(len(disabled), 15)
        self.assertTrue(
            all(
                key not in source
                for source in disabled
                for key in ("tier_priority", "default_type", "render_mode")
            )
        )

    def test_every_tier_one_source_is_in_every_scheduled_run(self):
        for run_date in self.run_dates:
            with self.subTest(run_date=run_date):
                selected_ids = {
                    source["id"]
                    for source in scheduled_deterministic_sources(
                        self.payload,
                        run_date,
                        4,
                    )
                }
                self.assertTrue(self.priority_ids <= selected_ids)

    def test_each_eligible_extra_appears_once_per_four_shard_cycle(self):
        seen = Counter()
        for run_date in self.run_dates:
            selected_ids = {
                source["id"]
                for source in scheduled_deterministic_sources(
                    self.payload,
                    run_date,
                    4,
                )
            }
            seen.update(selected_ids - self.priority_ids)
        self.assertEqual(set(seen), self.rotating_ids)
        self.assertEqual(set(seen.values()), {1})

    def test_disabled_manual_javascript_and_todo_rows_never_enter_extra_pool(self):
        excluded_ids = {
            source["id"]
            for source in self.payload["sources"]
            if source.get("enabled") is False
            or source.get("source_mode") == "manual"
            or source.get("render_mode") in {"manual", "javascript", "todo"}
        }
        self.assertFalse(self.rotating_ids & excluded_ids)
        self.assertTrue(
            all(
                source.get("enabled") is not False
                and source.get("harvest_enabled") is True
                and source.get("default_type") != "protest"
                and source.get("render_mode")
                in {"static", "server-rendered", "wordpress", "drupal"}
                for source in rotating_deterministic_source_pool(self.payload)
            )
        )


if __name__ == "__main__":
    unittest.main()
