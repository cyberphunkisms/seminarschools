#!/usr/bin/env python3
"""Focused offline regressions for Audit 48 live-harvest evidence."""
from __future__ import annotations

import unittest
from collections import Counter
from datetime import date
from pathlib import Path
import sys

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))

from audit_polymythcal_live_endpoints import (
    build_probe_plan,
    classify_http_failure,
    classify_request_exception,
)
from compose_audit48_live_harvest_evidence import (
    portable_browser_executable,
)


class FailureClassificationTests(unittest.TestCase):
    def test_transport_failures_remain_distinct(self):
        cases = [
            (requests.exceptions.SSLError("certificate failed"), "tls-error"),
            (requests.exceptions.ConnectTimeout("late"), "timeout"),
            (requests.exceptions.ReadTimeout("late"), "timeout"),
            (
                requests.exceptions.TooManyRedirects("loop"),
                "redirect-loop",
            ),
            (
                requests.exceptions.ConnectionError(
                    "NameResolutionError: name resolution failed"
                ),
                "dns-resolution",
            ),
            (
                requests.exceptions.ConnectionError("connection reset"),
                "connection-error",
            ),
            (requests.exceptions.RequestException("other"), "request-error"),
        ]
        for error, expected in cases:
            with self.subTest(expected=expected):
                self.assertEqual(classify_request_exception(error), expected)

    def test_http_failures_remain_distinct(self):
        expected = {
            401: "http-authentication",
            403: "http-forbidden",
            407: "http-proxy-authentication",
            404: "http-client-error",
            429: "http-rate-limited",
            451: "http-legal-restriction",
            500: "http-server-error",
            503: "http-service-unavailable",
        }
        for status, failure_class in expected.items():
            with self.subTest(status=status):
                self.assertEqual(
                    classify_http_failure(status), failure_class
                )


class ProbePlanTests(unittest.TestCase):
    def test_next_weekly_plan_covers_every_stream_without_duplicate_bindings(self):
        rows, selection = build_probe_plan(date(2026, 7, 27))
        keys = [
            (row["stream"], row["role"], row["source_id"]) for row in rows
        ]
        self.assertEqual(len(keys), len(set(keys)))
        self.assertTrue(all(row["endpoint_urls"] for row in rows))
        by_stream = Counter(row["stream"] for row in rows)
        self.assertEqual(
            by_stream["seminars"],
            selection["seminars"]["selected_sources"],
        )
        self.assertEqual(
            by_stream["protests"],
            selection["protests"]["primary_sources"]
            + selection["protests"]["corroboration_sources"],
        )
        self.assertEqual(
            by_stream["festivals"],
            selection["festivals"]["discovery_sources"]
            + selection["festivals"]["primary_sources"],
        )
        self.assertGreaterEqual(by_stream["seminars"], 90)
        self.assertGreaterEqual(by_stream["protests"], 17)
        self.assertEqual(by_stream["festivals"], 86)

    def test_browser_executable_evidence_is_portable(self):
        self.assertEqual(
            portable_browser_executable("/workspace/cache/chromium"),
            "$PLAYWRIGHT_BROWSER_EXECUTABLE/chromium",
        )
        self.assertEqual(
            portable_browser_executable(r"C:\browser\chrome.exe"),
            "$PLAYWRIGHT_BROWSER_EXECUTABLE/chrome.exe",
        )
        self.assertEqual(
            portable_browser_executable("playwright-managed"),
            "playwright-managed",
        )


if __name__ == "__main__":
    unittest.main()
