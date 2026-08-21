#!/usr/bin/env python3
from __future__ import annotations

import unittest
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from polymythcal_source_anomalies import evaluate_run


def history_for(source_id="alpha", observations=None):
    observations = observations or []
    return {
        "schema": "polymythcal-source-anomaly-history-v1",
        "contract_id": "FP-10",
        "policy": {
            "minimum_baseline_observations": 3,
            "history_limit_per_source": 4,
            "collapse_ratio": 0.2,
            "spike_ratio": 5,
            "minimum_collapse_baseline": 5,
            "minimum_spike_value": 20,
        },
        "streams": {"test": {source_id: observations}},
    }


def prior(events=10, status="success", suffix="1", parsed=None, pages=2, rejection=0.1):
    parsed = events if parsed is None else parsed
    return {
        "observed_at": f"2026-07-0{suffix}T00:00:00Z",
        "status": status,
        "events": events,
        "records_parsed": parsed,
        "pages_fetched": pages,
        "rejection_rate": rejection,
        "confirmed_empty": status == "confirmed-empty",
        "authoritative": True,
    }


class SourceAnomalyTests(unittest.TestCase):
    def test_warmup_does_not_block(self):
        report, candidate = evaluate_run({"source_yields": [{"source_id": "alpha", "status": "success", "events": 1}]}, history_for(), stream="test", observed_at="2026-08-01T00:00:00Z")
        self.assertEqual(report["status"], "passed")
        self.assertEqual(report["warmup_sources"], 1)
        self.assertEqual(len(candidate["streams"]["test"]["alpha"]), 1)

    def test_explicit_confirmed_empty_is_not_a_collapse(self):
        base = [prior(10, suffix=str(index)) for index in (1, 2, 3)]
        report, _ = evaluate_run({"source_yields": [{"source_id": "alpha", "status": "confirmed-empty", "events": 0}]}, history_for(observations=base), stream="test")
        self.assertEqual(report["blocking_anomalies"], [])

    def test_per_source_collapse_and_status_regression_are_caught(self):
        fixture = json.loads(
            (Path(__file__).resolve().parent / "fixtures/futureproofing/source-anomalies/collapse-run.json").read_text(encoding="utf-8")
        )
        base = [prior(20, suffix=str(index)) for index in (1, 2, 3)]
        collapse, _ = evaluate_run(fixture["current"], fixture["history"], stream="test")
        self.assertIn("events-collapse", {item["kind"] for item in collapse["blocking_anomalies"]})
        regression, _ = evaluate_run({"source_yields": [{"source_id": "alpha", "status": "fetch-error", "events": 0}]}, history_for(observations=base), stream="test")
        self.assertEqual(regression["blocking_anomalies"][0]["kind"], "status-regression")

    def test_spikes_are_caught_without_implicating_healthy_source(self):
        alpha = [prior(2, suffix=str(index), pages=1) for index in (1, 2, 3)]
        history = history_for(observations=alpha)
        history["streams"]["test"]["beta"] = [prior(8, suffix=str(index)) for index in (1, 2, 3)]
        report, _ = evaluate_run({"source_yields": [
            {"source_id": "alpha", "status": "success", "events": 30, "pages_fetched": 30},
            {"source_id": "beta", "status": "success", "events": 8, "pages_fetched": 2},
        ]}, history, stream="test")
        kinds = {(item["source_id"], item["kind"]) for item in report["blocking_anomalies"]}
        self.assertIn(("alpha", "events-spike"), kinds)
        self.assertIn(("alpha", "pages-fetched-spike"), kinds)
        self.assertFalse(any(source == "beta" for source, _ in kinds))

    def test_rejection_spike_and_bounded_deduplicated_history(self):
        base = [prior(8, suffix=str(index), parsed=20, rejection=0.1) for index in (1, 2, 3)]
        history = history_for(observations=base)
        payload = {"source_yields": [{"source_id": "alpha", "status": "success", "events": 1, "records_parsed": 20, "qualification_rejected": 19}]}
        report, candidate = evaluate_run(payload, history, stream="test", observed_at="2026-08-01T00:00:00Z")
        self.assertIn("rejection-rate-spike", {item["kind"] for item in report["blocking_anomalies"]})
        _, candidate = evaluate_run(payload, candidate, stream="test", observed_at="2026-08-01T00:00:00Z")
        observations = candidate["streams"]["test"]["alpha"]
        self.assertEqual(len(observations), 4)
        self.assertEqual(sum(item["observed_at"] == "2026-08-01T00:00:00Z" for item in observations), 1)

    def test_skipped_sources_are_not_observations(self):
        report, candidate = evaluate_run({"source_yields": [{"source_id": "alpha", "status": "skipped-shard", "events": 0}]}, history_for(), stream="test")
        self.assertEqual(report["sources_observed"], 0)
        self.assertEqual(candidate["streams"]["test"]["alpha"], [])


if __name__ == "__main__":
    unittest.main()
