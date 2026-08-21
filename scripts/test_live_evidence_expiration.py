#!/usr/bin/env python3
from __future__ import annotations

import unittest
import json
from datetime import datetime, timezone
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))

from live_evidence_expiration import expiration_failures


NOW = datetime(2026, 8, 9, 12, 0, tzinfo=timezone.utc)
EXPIRED_FIXTURE = json.loads(
    (Path(__file__).resolve().parent / "fixtures/futureproofing/live-evidence/expired-report.json").read_text(encoding="utf-8")
)


class LiveEvidenceExpirationTests(unittest.TestCase):
    def test_fresh_current_evidence_passes(self):
        failures, expires, age = expiration_failures(
            "2026-08-08T12:00:00Z",
            now=NOW,
            max_age_hours=48,
            enforce_current=True,
        )
        self.assertEqual(failures, [])
        self.assertEqual(age, 24)
        self.assertEqual(expires.isoformat(), "2026-08-10T12:00:00+00:00")

    def test_expired_current_evidence_fails(self):
        failures, _, _ = expiration_failures(
            EXPIRED_FIXTURE["generated_at"],
            now=NOW,
            max_age_hours=48,
            enforce_current=True,
        )
        self.assertTrue(any("stale" in failure for failure in failures))

    def test_historical_validation_does_not_make_current_claim(self):
        failures, _, age = expiration_failures(
            "2026-01-01T00:00:00Z",
            now=NOW,
            max_age_hours=48,
            enforce_current=False,
        )
        self.assertEqual(failures, [])
        self.assertGreater(age, 48)

    def test_future_invalid_and_zero_ttl_are_rejected(self):
        future, _, _ = expiration_failures(
            "2026-08-10T14:00:00Z",
            now=NOW,
            max_age_hours=48,
            enforce_current=True,
        )
        self.assertIn("report timestamp is in the future", future)
        zero, _, _ = expiration_failures(
            "2026-08-09T11:00:00Z",
            now=NOW,
            max_age_hours=0,
            enforce_current=True,
        )
        self.assertIn("max-age-hours must be greater than zero", zero)


if __name__ == "__main__":
    unittest.main()
