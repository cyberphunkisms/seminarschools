#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from publish_deterministic_polymythcal import (  # noqa: E402
    PublicationInputError,
    publish_deterministic,
)
from polymythcal_discovery import CrawlResult, FetchOutcome  # noqa: E402
from polymythcal_source_health import evaluate_source_health  # noqa: E402
import harvest_structured_events as structured_harvest  # noqa: E402
import merge_and_finalize as deterministic_merger  # noqa: E402


class DeterministicPublicationTests(unittest.TestCase):
    def payload(self, path: Path, *, protest: bool = False) -> None:
        source_yields = [
            {
                "source_id": "test-source",
                "status": "confirmed-empty",
                "events": 0,
                "pages_fetched": 1,
                "fetch_statuses": {"success": 1},
                "http_statuses": [
                    {
                        "url": "https://example.test/events",
                        "status": 200,
                        "result": "success",
                        "empty_evidence": "No upcoming events",
                    }
                ],
                "parse_errors": [],
            }
        ]
        value = {
            "stream": (
                "deterministic-protests"
                if protest
                else "deterministic-structured-events"
            ),
            "scope": (
                "all-enabled-protest-sources-unsharded"
                if protest
                else "priority-plus-rotating-deterministic-non-protest"
            ),
            "selected_source_ids": ["test-source"],
            "events": [],
            "source_yields": source_yields,
            "source_health_gate": evaluate_source_health(
                [{"id": "test-source"}],
                source_yields,
            ),
        }
        if protest:
            value["sharded"] = False
        path.write_text(json.dumps(value), encoding="utf-8")

    def test_both_deterministic_streams_are_required(self):
        with tempfile.TemporaryDirectory() as folder:
            temp = Path(folder)
            protest = temp / "protests.json"
            self.payload(protest, protest=True)
            with self.assertRaises(PublicationInputError):
                publish_deterministic(
                    protest_path=protest,
                    structured_path=temp / "missing-structured.json",
                    agent_placeholder_path=temp / "agent.json",
                    merge_script=temp / "merge.py",
                    root=temp,
                    run_command=lambda *args, **kwargs: SimpleNamespace(returncode=0),
                )

    def test_combined_ledger_keeps_one_row_per_source_and_both_stage_results(self):
        paid = [
            {
                "source_id": "deterministic-success",
                "status": "skipped-deterministic-success",
                "events": 0,
            },
            {"source_id": "agent-retry", "status": "crawled", "events": 2},
        ]
        deterministic = [
            {"source_id": "deterministic-success", "status": "success", "events": 3},
            {"source_id": "agent-retry", "status": "partial-failure", "events": 1},
        ]
        merged = deterministic_merger.merge_source_yield_telemetry(
            paid,
            deterministic,
            "deterministic-structured-events",
        )
        self.assertEqual(len(merged), 2)
        self.assertEqual(len({row["source_id"] for row in merged}), 2)
        by_id = {row["source_id"]: row for row in merged}
        self.assertEqual(by_id["deterministic-success"]["status"], "success")
        self.assertEqual(
            by_id["deterministic-success"]["paid_agent_status"],
            "skipped-deterministic-success",
        )
        self.assertEqual(by_id["agent-retry"]["status"], "crawled")
        self.assertEqual(
            by_id["agent-retry"]["deterministic_observations"][0]["status"],
            "partial-failure",
        )

    def test_placeholder_is_written_before_merge(self):
        with tempfile.TemporaryDirectory() as folder:
            temp = Path(folder)
            protest = temp / "protests.json"
            structured = temp / "structured.json"
            placeholder = temp / "agent.json"
            self.payload(protest, protest=True)
            self.payload(structured)
            calls = []

            def fake_run(command, **kwargs):
                self.assertTrue(placeholder.exists())
                calls.append((command, kwargs))
                return SimpleNamespace(returncode=0)

            code = publish_deterministic(
                protest_path=protest,
                structured_path=structured,
                agent_placeholder_path=placeholder,
                merge_script=temp / "merge.py",
                root=temp,
                run_command=fake_run,
            )
            self.assertEqual(code, 0)
            self.assertEqual(len(calls), 1)
            saved = json.loads(placeholder.read_text(encoding="utf-8"))
            self.assertEqual(
                saved["publication_stage"],
                "deterministic-before-optional-agent",
            )

    def test_structured_only_mode_does_not_require_or_merge_protest_payload(self):
        with tempfile.TemporaryDirectory() as folder:
            temp = Path(folder)
            structured = temp / "structured.json"
            placeholder = temp / "agent.json"
            self.payload(structured)
            calls = []

            def fake_run(command, **kwargs):
                calls.append((command, kwargs))
                return SimpleNamespace(returncode=0)

            code = publish_deterministic(
                protest_path=None,
                structured_path=structured,
                agent_placeholder_path=placeholder,
                merge_script=temp / "merge.py",
                root=temp,
                run_command=fake_run,
            )
            self.assertEqual(code, 0)
            self.assertEqual(len(calls), 1)
            self.assertEqual(
                calls[0][1]["env"]["POLYMYTHCAL_DETERMINISTIC_PROTEST_PATH"],
                "",
            )

    def test_merge_failure_is_propagated(self):
        with tempfile.TemporaryDirectory() as folder:
            temp = Path(folder)
            protest = temp / "protests.json"
            structured = temp / "structured.json"
            self.payload(protest, protest=True)
            self.payload(structured)
            code = publish_deterministic(
                protest_path=protest,
                structured_path=structured,
                agent_placeholder_path=temp / "agent.json",
                merge_script=temp / "merge.py",
                root=temp,
                run_command=lambda *args, **kwargs: SimpleNamespace(returncode=23),
            )
            self.assertEqual(code, 23)

    def test_missing_structured_gate_refuses_before_placeholder_or_merge(self):
        with tempfile.TemporaryDirectory() as folder:
            temp = Path(folder)
            structured = temp / "structured.json"
            placeholder = temp / "agent.json"
            structured.write_text(
                json.dumps({"events": [], "source_yields": []}),
                encoding="utf-8",
            )
            calls = []
            with self.assertRaisesRegex(
                PublicationInputError,
                "no source-health gate",
            ):
                publish_deterministic(
                    protest_path=None,
                    structured_path=structured,
                    agent_placeholder_path=placeholder,
                    merge_script=temp / "merge.py",
                    root=temp,
                    run_command=lambda *args, **kwargs: calls.append(args),
                )
            self.assertFalse(placeholder.exists())
            self.assertEqual(calls, [])

    def test_stream_mismatch_refuses_before_placeholder_or_merge(self):
        with tempfile.TemporaryDirectory() as folder:
            temp = Path(folder)
            structured = temp / "structured.json"
            placeholder = temp / "agent.json"
            self.payload(structured)
            payload = json.loads(structured.read_text(encoding="utf-8"))
            payload["stream"] = "deterministic-protests"
            structured.write_text(json.dumps(payload), encoding="utf-8")
            calls = []
            with self.assertRaisesRegex(
                PublicationInputError,
                "expected 'deterministic-structured-events'",
            ):
                publish_deterministic(
                    protest_path=None,
                    structured_path=structured,
                    agent_placeholder_path=placeholder,
                    merge_script=temp / "merge.py",
                    root=temp,
                    run_command=lambda *args, **kwargs: calls.append(args),
                )
            self.assertFalse(placeholder.exists())
            self.assertEqual(calls, [])

    def test_selection_mismatch_refuses_before_placeholder_or_merge(self):
        with tempfile.TemporaryDirectory() as folder:
            temp = Path(folder)
            structured = temp / "structured.json"
            placeholder = temp / "agent.json"
            self.payload(structured)
            value = json.loads(structured.read_text(encoding="utf-8"))
            value["selected_source_ids"] = ["different-source"]
            structured.write_text(json.dumps(value), encoding="utf-8")
            with self.assertRaisesRegex(
                PublicationInputError,
                "saved source selection does not match",
            ):
                publish_deterministic(
                    protest_path=None,
                    structured_path=structured,
                    agent_placeholder_path=placeholder,
                    merge_script=temp / "merge.py",
                    root=temp,
                    run_command=lambda *args, **kwargs: SimpleNamespace(returncode=0),
                )
            self.assertFalse(placeholder.exists())

    def test_scope_mismatch_refuses_before_placeholder_or_merge(self):
        with tempfile.TemporaryDirectory() as folder:
            temp = Path(folder)
            structured = temp / "structured.json"
            placeholder = temp / "agent.json"
            self.payload(structured)
            value = json.loads(structured.read_text(encoding="utf-8"))
            value["scope"] = "wrong-scope"
            structured.write_text(json.dumps(value), encoding="utf-8")
            with self.assertRaisesRegex(PublicationInputError, "declares scope"):
                publish_deterministic(
                    protest_path=None,
                    structured_path=structured,
                    agent_placeholder_path=placeholder,
                    merge_script=temp / "merge.py",
                    root=temp,
                    run_command=lambda *args, **kwargs: SimpleNamespace(returncode=0),
                )
            self.assertFalse(placeholder.exists())

    def test_forged_passed_gate_disagreeing_with_yields_is_refused(self):
        with tempfile.TemporaryDirectory() as folder:
            temp = Path(folder)
            structured = temp / "structured.json"
            placeholder = temp / "agent.json"
            failed_row = {
                "source_id": "test-source",
                "status": "blocked",
                "events": 0,
                "http_statuses": [],
            }
            structured.write_text(
                json.dumps(
                    {
                        "stream": "deterministic-structured-events",
                        "scope": "priority-plus-rotating-deterministic-non-protest",
                        "selected_source_ids": ["test-source"],
                        "events": [],
                        "source_yields": [failed_row],
                        "source_health_gate": {
                            "status": "passed",
                            "reason": "authoritative-primary-source-observation",
                            "expected_primary_sources": 1,
                            "reported_primary_sources": 1,
                            "authoritative_primary_sources": 1,
                            "minimum_authoritative_primary_sources": 1,
                            "minimum_authoritative_ratio": 0.25,
                            "authoritative_source_ids": ["test-source"],
                            "critical_source_ids": [],
                            "authoritative_critical_source_ids": [],
                            "minimum_authoritative_critical_sources": 0,
                            "minimum_critical_authoritative_ratio": 0.10,
                            "non_authoritative_source_ids": [],
                            "systemic_failure_source_ids": [],
                            "missing_source_ids": [],
                            "duplicate_source_ids": [],
                            "duplicate_configured_source_ids": [],
                        },
                    }
                ),
                encoding="utf-8",
            )
            with self.assertRaisesRegex(
                PublicationInputError,
                "saved source-yield diagnostics do not pass",
            ):
                publish_deterministic(
                    protest_path=None,
                    structured_path=structured,
                    agent_placeholder_path=placeholder,
                    merge_script=temp / "merge.py",
                    root=temp,
                    run_command=lambda *args, **kwargs: SimpleNamespace(returncode=0),
                )
            self.assertFalse(placeholder.exists())


class StructuredSourceHealthTests(unittest.TestCase):
    @staticmethod
    def source(source_id: str) -> dict:
        return {
            "id": source_id,
            "events_url": f"https://{source_id}.example/events",
            "timezone": "America/Toronto",
        }

    def test_all_selected_source_failures_fail_closed(self):
        sources = [self.source("blocked"), self.source("fetch-error")]
        results = {
            "blocked": CrawlResult(
                source_id="blocked",
                status="blocked",
                fetches=[
                    FetchOutcome(
                        url=sources[0]["events_url"],
                        status="blocked",
                        http_status=403,
                    )
                ],
            ),
            "fetch-error": CrawlResult(
                source_id="fetch-error",
                status="fetch-error",
                fetches=[
                    FetchOutcome(
                        url=sources[1]["events_url"],
                        status="fetch-error",
                        error="connection failed",
                    )
                ],
            ),
        }
        with mock.patch.object(
            structured_harvest,
            "crawl_source",
            side_effect=lambda source, **kwargs: results[source["id"]],
        ):
            payload = structured_harvest.run(sources, max_workers=2)
        gate = payload["source_health_gate"]
        self.assertEqual(gate["status"], "failed")
        self.assertEqual(
            gate["reason"],
            "no-authoritative-primary-source-observation",
        )
        self.assertEqual(payload["summary"]["source_health_gate"], "failed")

    def test_confirmed_empty_is_an_authoritative_zero_event_run(self):
        source = self.source("empty")
        result = CrawlResult(
            source_id="empty",
            status="confirmed-empty",
            fetches=[
                FetchOutcome(
                    url=source["events_url"],
                    status="success",
                    body="<p>No upcoming events.</p>",
                    empty_evidence="No upcoming events",
                )
            ],
        )
        with mock.patch.object(
            structured_harvest,
            "crawl_source",
            return_value=result,
        ):
            payload = structured_harvest.run([source], max_workers=1)
        self.assertEqual(payload["events"], [])
        self.assertEqual(payload["source_health_gate"]["status"], "passed")
        self.assertEqual(
            payload["source_health_gate"]["authoritative_primary_sources"],
            1,
        )

    def test_candidate_loss_accounting_closes_exactly(self):
        source = self.source("accounted")
        soon = (datetime.now(timezone.utc) + timedelta(days=10)).isoformat()
        too_late = (datetime.now(timezone.utc) + timedelta(days=181)).isoformat()
        base = {
            "title": "One public lecture",
            "date": soon,
            "source_url": source["events_url"],
            "type": "lecture",
            "confidence": 90,
        }
        result = CrawlResult(
            source_id="accounted",
            status="success",
            records=[
                base,
                {**base, "confidence": 70},
                {**base, "title": ""},
                {**base, "title": "Too late", "date": too_late},
            ],
            fetches=[FetchOutcome(
                url=source["events_url"],
                status="success",
                body="<p>Events</p>",
                http_status=200,
            )],
        )
        with mock.patch.object(structured_harvest, "crawl_source", return_value=result):
            payload = structured_harvest.run([source], max_workers=1)
        accounting = payload["coverage_accounting"]
        self.assertEqual(accounting["records_parsed"], 4)
        self.assertEqual(accounting["qualification_rejected"], 2)
        self.assertEqual(accounting["records_qualified_before_deduplication"], 2)
        self.assertEqual(accounting["duplicates_suppressed"], 1)
        self.assertEqual(accounting["records_published"], 1)
        self.assertEqual(
            accounting["records_parsed"],
            accounting["qualification_rejected"] + accounting["records_qualified_before_deduplication"],
        )
        self.assertEqual(
            accounting["records_qualified_before_deduplication"],
            accounting["duplicates_suppressed"] + accounting["records_published"],
        )
        row = payload["source_yields"][0]
        for key, value in accounting.items():
            self.assertEqual(row[key], value)

    def test_not_modified_without_retained_observation_is_not_authoritative(self):
        source = self.source("not-modified")
        source_yields = [
            {
                "source_id": "not-modified",
                "status": "not-modified",
                "events": 0,
                "http_statuses": [
                    {
                        "url": source["events_url"],
                        "status": 304,
                        "result": "not-modified",
                    }
                ],
            }
        ]
        gate = evaluate_source_health([source], source_yields)
        self.assertEqual(gate["status"], "failed")
        self.assertEqual(
            gate["reason"],
            "no-authoritative-primary-source-observation",
        )
        self.assertEqual(gate["authoritative_primary_sources"], 0)
        self.assertEqual(gate["non_authoritative_source_ids"], ["not-modified"])

    def test_near_total_source_failure_does_not_pass_on_one_success(self):
        sources = [self.source(f"source-{index}") for index in range(16)]
        source_yields = [
            {
                "source_id": source["id"],
                "status": "success" if index == 0 else "blocked",
                "events": 1 if index == 0 else 0,
                "http_statuses": [],
            }
            for index, source in enumerate(sources)
        ]
        gate = evaluate_source_health(sources, source_yields)
        self.assertEqual(gate["minimum_authoritative_primary_sources"], 4)
        self.assertEqual(gate["status"], "failed")
        self.assertEqual(
            gate["reason"],
            "insufficient-authoritative-primary-source-coverage",
        )

    def test_quarter_source_quorum_allows_bounded_partial_outage(self):
        sources = [self.source(f"source-{index}") for index in range(16)]
        source_yields = [
            {
                "source_id": source["id"],
                "status": "success" if index < 4 else "blocked",
                "events": 1 if index < 4 else 0,
                "http_statuses": [],
            }
            for index, source in enumerate(sources)
        ]
        gate = evaluate_source_health(sources, source_yields)
        self.assertEqual(gate["status"], "passed")

    def test_critical_source_floor_is_independent_of_overall_quorum(self):
        sources = [self.source(f"source-{index}") for index in range(10)]
        for index, source in enumerate(sources):
            source["tier_priority"] = 1 if index < 4 else 2
        source_yields = [
            {
                "source_id": source["id"],
                "status": "success" if index in {4, 5, 6} else "blocked",
                "events": 1 if index in {4, 5, 6} else 0,
                "http_statuses": [],
            }
            for index, source in enumerate(sources)
        ]
        gate = evaluate_source_health(sources, source_yields)
        self.assertEqual(gate["minimum_authoritative_primary_sources"], 3)
        self.assertEqual(gate["minimum_authoritative_critical_sources"], 1)
        self.assertEqual(gate["reason"], "insufficient-critical-source-coverage")

    def test_cli_writes_diagnostics_then_returns_source_health_failure(self):
        source = self.source("blocked")
        source_yields = [
            {
                "source_id": "blocked",
                "status": "blocked",
                "events": 0,
                "http_statuses": [],
            }
        ]
        payload = {
            "events": [],
            "source_yields": source_yields,
            "source_health_gate": evaluate_source_health([source], source_yields),
            "summary": {
                "sources": 1,
                "events": 0,
                "source_health_gate": "failed",
                "authoritative_primary_sources": 0,
            },
        }
        with tempfile.TemporaryDirectory() as folder:
            output = Path(folder) / "nested" / "structured.json"
            with (
                mock.patch.object(
                    sys,
                    "argv",
                    [
                        "harvest_structured_events.py",
                        "--output",
                        str(output),
                    ],
                ),
                mock.patch.object(
                    structured_harvest,
                    "load_scheduled_sources",
                    return_value=[source],
                ),
                mock.patch.object(
                    structured_harvest,
                    "run",
                    return_value=payload,
                ),
            ):
                self.assertEqual(
                    structured_harvest.main(),
                    structured_harvest.SOURCE_HEALTH_FAILURE_EXIT,
                )
            self.assertTrue(output.exists())
            saved = json.loads(output.read_text(encoding="utf-8"))
            self.assertEqual(saved["source_health_gate"]["status"], "failed")

    def test_direct_merger_rejects_a_gate_less_structured_payload(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "structured.json"
            path.write_text(
                json.dumps({"events": [], "source_yields": []}),
                encoding="utf-8",
            )
            with (
                mock.patch.object(
                    deterministic_merger,
                    "DETERMINISTIC_STRUCTURED_PATH",
                    path,
                ),
                self.assertRaises(SystemExit),
            ):
                deterministic_merger.merge_deterministic_structured_events(
                    {"events": [], "source_yields": []}
                )

    def test_direct_merger_rejects_a_wrong_structured_stream(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "structured.json"
            source = self.source("structured")
            source_yields = [
                {
                    "source_id": "structured",
                    "status": "confirmed-empty",
                    "events": 0,
                    "http_statuses": [
                        {
                            "url": source["events_url"],
                            "status": 200,
                            "result": "success",
                            "empty_evidence": "No upcoming events",
                        }
                    ],
                }
            ]
            path.write_text(
                json.dumps(
                    {
                        "stream": "deterministic-protests",
                        "scope": "priority-plus-rotating-deterministic-non-protest",
                        "selected_source_ids": ["structured"],
                        "events": [],
                        "source_yields": source_yields,
                        "source_health_gate": evaluate_source_health(
                            [source],
                            source_yields,
                        ),
                    }
                ),
                encoding="utf-8",
            )
            with (
                mock.patch.object(
                    deterministic_merger,
                    "DETERMINISTIC_STRUCTURED_PATH",
                    path,
                ),
                self.assertRaises(SystemExit),
            ):
                deterministic_merger.merge_deterministic_structured_events(
                    {"events": [], "source_yields": []}
                )


class WorkflowContractTests(unittest.TestCase):
    def setUp(self):
        self.workflow = (
            ROOT / ".github" / "workflows" / "scrape-seminars.yml"
        ).read_text(encoding="utf-8")

    def test_deterministic_publication_precedes_optional_cli(self):
        discovery = self.workflow.index(
            "- name: Run deterministic priority structured discovery"
        )
        publication = self.workflow.index(
            "- name: Publish deterministic harvest before optional agent"
        )
        install = self.workflow.index("- name: Install Claude Code CLI")
        agent = self.workflow.index("- name: Run seminar harvest")
        self.assertLess(discovery, publication)
        self.assertLess(publication, install)
        self.assertLess(install, agent)

    def test_cli_failures_are_non_blocking_and_gate_agent_only(self):
        self.assertIn("id: install_claude", self.workflow)
        self.assertIn("id: claude_version", self.workflow)
        self.assertGreaterEqual(self.workflow.count("continue-on-error: true"), 2)
        self.assertIn("timeout-minutes: 5", self.workflow)
        self.assertIn("timeout-minutes: 1", self.workflow)
        self.assertIn(
            "steps.install_claude.outcome == 'success'",
            self.workflow,
        )
        self.assertIn(
            "steps.claude_version.outcome == 'success'",
            self.workflow,
        )

    def test_publication_step_is_fail_loud(self):
        start = self.workflow.index(
            "- name: Publish deterministic harvest before optional agent"
        )
        end = self.workflow.index("- name: Install Claude Code CLI")
        publication_step = self.workflow[start:end]
        self.assertNotIn("continue-on-error", publication_step)
        self.assertIn(
            "python3 scripts/publish_deterministic_polymythcal.py",
            publication_step,
        )
        self.assertIn(
            "python3 scripts/validate-polymythcal.py",
            publication_step,
        )

    def test_failed_structured_crawl_preserves_gate_diagnostics(self):
        self.assertIn(
            "- name: Preserve structured source-health diagnostics",
            self.workflow,
        )
        self.assertIn(
            "data/harvest-runs/seminars-deterministic-failed.json",
            self.workflow,
        )
        discovery = self.workflow.index(
            "- name: Run deterministic priority structured discovery"
        )
        diagnostics = self.workflow.index(
            "- name: Preserve structured source-health diagnostics"
        )
        publication = self.workflow.index(
            "- name: Publish deterministic harvest before optional agent"
        )
        self.assertLess(discovery, diagnostics)
        self.assertLess(diagnostics, publication)

    def test_coverage_report_always_runs_and_is_preserved(self):
        discovery = self.workflow.index("- name: Run deterministic priority structured discovery")
        coverage = self.workflow.index("- name: Build deterministic harvest coverage report")
        diagnostics = self.workflow.index("- name: Preserve structured source-health diagnostics")
        self.assertLess(discovery, coverage)
        self.assertLess(coverage, diagnostics)
        coverage_step = self.workflow[coverage:diagnostics]
        self.assertIn("if: always()", coverage_step)
        self.assertIn("scripts/build-polymythcal-harvest-coverage-report.py", coverage_step)
        self.assertIn("/tmp/polymythcal-structured.json", self.workflow)
        self.assertIn("/tmp/polymythcal-harvest-coverage.json", self.workflow)


if __name__ == "__main__":
    unittest.main()
