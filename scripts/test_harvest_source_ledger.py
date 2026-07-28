#!/usr/bin/env python3
import json
import unittest
from pathlib import Path

from scripts.validate_harvest_source_ledger import (
    LedgerValidationError,
    validate_festivals,
    validate_seminars,
)

ROOT = Path(__file__).resolve().parents[1]


def event(source_id, number=1):
    return {
        "title": f"Event {source_id} {number}",
        "date": "2026-08-01T12:00:00-04:00",
        "source_url": f"https://example.test/{source_id}/{number}",
        "source_id": source_id,
    }


class SeminarSourceLedgerTests(unittest.TestCase):
    def setUp(self):
        self.roster = {
            "sources": [
                {
                    "id": "tier-one",
                    "tier_priority": 1,
                    "events_url": "https://example.test/tier-one",
                },
                {
                    "id": "deterministic",
                    "tier_priority": 2,
                    "events_url": "https://example.test/deterministic",
                },
                {
                    "id": "disabled",
                    "enabled": False,
                    "events_url": "https://example.test/disabled",
                },
                {
                    "id": "manual",
                    "source_mode": "manual",
                    "events_url": "https://example.test/manual",
                },
                {
                    "id": "non-http",
                    "tier_priority": 2,
                    "events_url": "manual",
                },
                {
                    "id": "reserve",
                    "tier_priority": 3,
                    "default_type": "contest",
                    "events_url": "https://example.test/reserve",
                },
                {
                    "id": "shard-source",
                    "tier_priority": 2,
                    "events_url": "https://example.test/shard-source",
                },
                {
                    "id": "out-of-shard",
                    "tier_priority": 3,
                    "default_type": "lecture",
                    "events_url": "https://example.test/out-of-shard",
                },
            ]
        }
        self.payload = {
            "events": [
                event("tier-one"),
                event("shard-source"),
                event("reserve"),
            ],
            "source_yields": [
                {"source_id": "tier-one", "status": "crawled", "events": 1},
                {
                    "source_id": "shard-source",
                    "status": "crawled",
                    "events": 1,
                },
                {
                    "source_id": "reserve",
                    "status": "crawled-urgency-reserve",
                    "events": 1,
                },
            ],
        }

    def validate(self, payload=None):
        return validate_seminars(
            self.payload if payload is None else payload,
            self.roster,
            shard=0,
            shard_count=2,
            deterministic_success_ids=["deterministic"],
        )

    def test_expands_agent_rows_to_full_roster_order(self):
        result = self.validate()
        self.assertEqual(
            [row["source_id"] for row in result["source_yields"]],
            [source["id"] for source in self.roster["sources"]],
        )
        self.assertEqual(
            [row["status"] for row in result["source_yields"]],
            [
                "crawled",
                "skipped-deterministic-success",
                "skipped-disabled",
                "skipped-disabled",
                "skipped-disabled",
                "crawled-urgency-reserve",
                "crawled",
                "skipped-shard",
            ],
        )

    def test_real_422_source_roster_expands_from_compact_rows(self):
        roster = json.loads(
            (ROOT / "scripts" / "sources.json").read_text(encoding="utf-8")
        )
        rows = []
        for position, source in enumerate(roster["sources"]):
            active = (
                source.get("enabled") is not False
                and source.get("harvest_enabled", True)
                and source.get("source_mode") != "manual"
                and str(source.get("render_mode") or "").lower() != "manual"
                and str(source.get("events_url") or "")
                .lower()
                .startswith(("http://", "https://"))
            )
            if active and (
                int(source.get("tier_priority") or 99) == 1
                or position % 8 == 3
            ):
                rows.append(
                    {
                        "source_id": source["id"],
                        "status": "budget-exhausted",
                        "events": 0,
                    }
                )
        result = validate_seminars(
            {"events": [], "source_yields": rows},
            roster,
            shard=3,
            shard_count=8,
        )
        self.assertEqual(len(roster["sources"]), 422)
        self.assertEqual(len(result["source_yields"]), 422)
        self.assertLess(len(rows), len(result["source_yields"]) // 3)

    def test_missing_assigned_source_is_rejected(self):
        payload = dict(self.payload)
        payload["source_yields"] = self.payload["source_yields"][:1]
        payload["events"] = [event("tier-one")]
        with self.assertRaisesRegex(
            LedgerValidationError, "omits assigned sources"
        ):
            self.validate(payload)

    def test_duplicate_and_unknown_accounting_rows_are_rejected(self):
        for extra, message in (
            (
                {"source_id": "tier-one", "status": "crawled", "events": 1},
                "duplicate source",
            ),
            (
                {"source_id": "unknown", "status": "crawled", "events": 0},
                "unknown source",
            ),
        ):
            with self.subTest(extra=extra):
                payload = dict(self.payload)
                payload["source_yields"] = self.payload["source_yields"] + [extra]
                with self.assertRaisesRegex(LedgerValidationError, message):
                    self.validate(payload)

    def test_event_count_and_event_source_are_validated(self):
        payload = dict(self.payload)
        payload["source_yields"] = [
            dict(row, events=0)
            if row["source_id"] == "tier-one"
            else row
            for row in self.payload["source_yields"]
        ]
        with self.assertRaisesRegex(LedgerValidationError, "reports 0 event"):
            self.validate(payload)

        payload = dict(self.payload)
        payload["events"] = self.payload["events"] + [event("out-of-shard")]
        with self.assertRaisesRegex(
            LedgerValidationError, "without a valid agent accounting row"
        ):
            self.validate(payload)

        payload = dict(self.payload)
        payload["events"] = [dict(event("tier-one"), source_id=["tier-one"])]
        with self.assertRaisesRegex(LedgerValidationError, "unknown source_id"):
            self.validate(payload)

    def test_reserve_is_limited_and_type_checked(self):
        # A lecture outside the assigned shard cannot masquerade as reserve.
        bad = dict(self.payload)
        bad["source_yields"] = self.payload["source_yields"] + [
            {
                "source_id": "out-of-shard",
                "status": "crawled-urgency-reserve",
                "events": 0,
            }
        ]
        with self.assertRaisesRegex(LedgerValidationError, "not a valid urgency"):
            self.validate(bad)

        roster = {
            "sources": [
                {
                    "id": "tier-one",
                    "tier_priority": 1,
                    "events_url": "https://example.test/tier-one",
                }
            ]
        }
        rows = [
            {
                "source_id": "tier-one",
                "status": "crawled",
                "events": 0,
            }
        ]
        for index in range(6):
            source_id = f"reserve-{index}"
            roster["sources"].append(
                {
                    "id": source_id,
                    "tier_priority": 3,
                    "default_type": "cfp",
                    "events_url": f"https://example.test/{source_id}",
                }
            )
            rows.append(
                {
                    "source_id": source_id,
                    "status": "crawled-urgency-reserve",
                    "events": 0,
                }
            )
        with self.assertRaisesRegex(LedgerValidationError, "maximum is 5"):
            validate_seminars(
                {"events": [], "source_yields": rows},
                roster,
                shard=0,
                shard_count=100,
            )


class FestivalSourceLedgerTests(unittest.TestCase):
    def setUp(self):
        self.roster = {
            "primary_sources": [
                {"id": "festival-a"},
                {"id": "festival-b"},
                {"id": "festival-c"},
            ]
        }
        self.payload = {
            "events": [event("festival-a")],
            "source_yields": [
                {"source_id": "festival-a", "status": "crawled", "events": 1},
                {
                    "source_id": "festival-b",
                    "status": "skipped-shard",
                    "events": 0,
                },
                {
                    "source_id": "festival-c",
                    "status": "unreachable",
                    "events": 0,
                },
            ],
        }

    def test_complete_roster_order_and_counts_pass(self):
        result = validate_festivals(self.payload, self.roster)
        self.assertEqual(result, self.payload)

    def test_missing_duplicate_reordered_and_bad_counts_fail(self):
        cases = []
        missing = dict(self.payload)
        missing["source_yields"] = self.payload["source_yields"][:-1]
        cases.append((missing, "omits festival primary"))

        duplicate = dict(self.payload)
        duplicate["source_yields"] = self.payload["source_yields"] + [
            self.payload["source_yields"][0]
        ]
        cases.append((duplicate, "duplicate source"))

        reordered = dict(self.payload)
        reordered["source_yields"] = list(reversed(self.payload["source_yields"]))
        cases.append((reordered, "roster order"))

        bad_count = dict(self.payload)
        bad_count["source_yields"] = [
            dict(row, events=2)
            if row["source_id"] == "festival-a"
            else row
            for row in self.payload["source_yields"]
        ]
        cases.append((bad_count, "reports 2 event"))

        for payload, message in cases:
            with self.subTest(message=message):
                with self.assertRaisesRegex(LedgerValidationError, message):
                    validate_festivals(payload, self.roster)


if __name__ == "__main__":
    unittest.main()
