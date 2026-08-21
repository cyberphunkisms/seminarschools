#!/usr/bin/env python3
"""Verify Audit 48 live-harvest evidence against current source configuration."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
from collections import Counter
from datetime import date, datetime, timezone
from pathlib import Path

from live_evidence_expiration import expiration_failures, parse_utc

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_REPORT = (
    ROOT / "scripts" / "reports" / "audit48-live-harvest-endpoints.json"
)
EXPECTED_CADENCE = {
    "seminars": (".github/workflows/scrape-seminars.yml", "47 8 * * 1"),
    "festivals": (".github/workflows/scrape-festivals.yml", "42 9 * * 2"),
    "protests": (
        ".github/workflows/scrape-polymythcal-protests.yml",
        "18 8 * * 3",
    ),
}
CONFIGURATION_FILES = (
    "scripts/sources.json",
    "scripts/protest-sources.json",
    "scripts/festivals-sources.json",
    ".github/workflows/scrape-seminars.yml",
    ".github/workflows/scrape-festivals.yml",
    ".github/workflows/scrape-polymythcal-protests.yml",
)
ALLOWED_ROLES = {
    "seminars": {"every-run-priority", "scheduled-rotating"},
    "protests": {"primary", "corroboration"},
    "festivals": {"discovery", "primary"},
}
SOURCE_STATUSES = {
    "http-usable",
    "browser-required",
    "unreachable-or-unsupported",
}
ENDPOINT_STATUSES = {
    "reachable",
    "blocked",
    "browser-required",
    "unproven-empty",
    "unexpected-media",
    "http-error",
    "transport-error",
    "probe-error",
}
FAILURE_CLASSES = {
    "",
    "tls-error",
    "timeout",
    "redirect-loop",
    "dns-resolution",
    "connection-error",
    "request-error",
    "http-authentication",
    "http-forbidden",
    "http-proxy-authentication",
    "http-rate-limited",
    "http-legal-restriction",
    "http-service-unavailable",
    "http-client-error",
    "http-server-error",
    "http-unexpected-status",
    "challenge-page",
    "client-rendered-shell",
    "blank-response",
    "unsupported-content-type",
    "probe-worker-exception",
}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    parser.add_argument(
        "--require-current",
        action="store_true",
        help=(
            "Require both a current configuration match and evidence generated "
            "within --max-age-hours"
        ),
    )
    parser.add_argument(
        "--now",
        help=argparse.SUPPRESS,
    )
    parser.add_argument(
        "--max-age-hours",
        type=float,
        default=float(os.environ.get("AUDIT48_LIVE_MAX_AGE_HOURS", "336")),
    )
    args = parser.parse_args()
    failures: list[str] = []

    try:
        report = json.loads(args.report.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"AUDIT48 LIVE HARVEST EVIDENCE FAILED — {exc}", file=sys.stderr)
        return 1
    if report.get("schema") != "audit48-polymythcal-live-endpoints-v1":
        failures.append("unsupported report schema")
    if report.get("publication_attempted") is not False:
        failures.append("report does not prove publication stayed disabled")
    if report.get("external_mutation_attempted") is not False:
        failures.append("report does not prove external mutation stayed disabled")
    if report.get("paid_agent_invoked") is not False:
        failures.append("report does not prove paid-agent execution stayed disabled")
    if report.get("cadence_changed") is not False:
        failures.append("report says harvest cadence changed")

    try:
        now = parse_utc(args.now) if args.now else datetime.now(timezone.utc)
    except ValueError:
        failures.append("--now is invalid")
        now = datetime.now(timezone.utc)
    expiry_failures, expires_at, age_hours = expiration_failures(
        report.get("generated_at"),
        now=now,
        max_age_hours=args.max_age_hours,
        enforce_current=args.require_current,
    )
    failures.extend(expiry_failures)

    selection = report.get("selection") or {}
    try:
        date.fromisoformat(str(selection.get("run_date") or ""))
    except (ValueError, TypeError) as exc:
        failures.append(f"report run-date selection is invalid: {exc}")
    configured_hashes = report.get("configuration_sha256") or {}
    configuration_drift: list[str] = []
    if set(configured_hashes) != set(CONFIGURATION_FILES):
        failures.append("report configuration hash inventory is incomplete")
    for relative in CONFIGURATION_FILES:
        expected_digest = hashlib.sha256((ROOT / relative).read_bytes()).hexdigest()
        if configured_hashes.get(relative) != expected_digest:
            configuration_drift.append(relative)
    if configuration_drift and args.require_current:
        failures.extend(
            f"current configuration differs from live evidence: {relative}"
            for relative in configuration_drift
        )
    report_sources = report.get("sources")
    if not isinstance(report_sources, list):
        failures.append("report sources must be an array")
        report_sources = []
    report_by_key = {}
    endpoint_bindings = 0
    unique_urls = set()
    source_statuses: Counter[str] = Counter()
    unique_endpoint_results = {}
    for index, row in enumerate(report_sources):
        if not isinstance(row, dict):
            failures.append(f"sources[{index}] is not an object")
            continue
        key = (
            str(row.get("stream") or ""),
            str(row.get("role") or ""),
            str(row.get("source_id") or ""),
        )
        if key in report_by_key:
            failures.append(f"duplicate source evidence row: {key}")
            continue
        report_by_key[key] = row
        stream, role, source_id = key
        if not source_id or role not in ALLOWED_ROLES.get(stream, set()):
            failures.append(f"report contains an invalid source binding: {key}")
        source_status = str(row.get("source_status") or "")
        source_statuses[source_status] += 1
        if source_status not in SOURCE_STATUSES:
            failures.append(f"{key} has unsupported source_status {source_status!r}")
        endpoint_urls = row.get("endpoint_urls")
        if (
            not isinstance(endpoint_urls, list)
            or not endpoint_urls
            or len(endpoint_urls) != len(set(endpoint_urls))
            or any(
                not isinstance(url, str)
                or not url.startswith(("http://", "https://"))
                for url in endpoint_urls
            )
        ):
            failures.append(f"{key} endpoint plan is malformed")
            endpoint_urls = []
        endpoints = row.get("endpoints")
        if not isinstance(endpoints, list):
            failures.append(f"{key} endpoints must be an array")
            continue
        if len(endpoints) != len(endpoint_urls):
            failures.append(f"{key} endpoint evidence is incomplete")
        if [item.get("url") for item in endpoints if isinstance(item, dict)] != endpoint_urls:
            failures.append(f"{key} endpoint evidence order or identity changed")
        endpoint_bindings += len(endpoints)
        unique_urls.update(endpoint_urls)
        usable = 0
        browser_required = 0
        for endpoint in endpoints:
            if not isinstance(endpoint, dict):
                failures.append(f"{key} contains a non-object endpoint result")
                continue
            status = str(endpoint.get("status") or "")
            failure = str(endpoint.get("failure_class") or "")
            endpoint_url = str(endpoint.get("url") or "")
            prior_endpoint = unique_endpoint_results.get(endpoint_url)
            if prior_endpoint is None:
                unique_endpoint_results[endpoint_url] = endpoint
            elif prior_endpoint != endpoint:
                failures.append(
                    f"duplicate URL has inconsistent live evidence: {endpoint_url}"
                )
            if status not in ENDPOINT_STATUSES:
                failures.append(f"{key} has unsupported endpoint status {status!r}")
            if failure not in FAILURE_CLASSES:
                failures.append(f"{key} has unsupported failure class {failure!r}")
            if endpoint.get("usable_by_http_harvester") is True:
                usable += 1
                if status != "reachable" or failure:
                    failures.append(f"{key} marks a failed endpoint HTTP-usable")
            if endpoint.get("browser_required") is True:
                browser_required += 1
            if not re.fullmatch(r"[0-9a-f]{64}", str(endpoint.get("sample_sha256") or "")):
                if int(endpoint.get("sampled_bytes") or 0) > 0:
                    failures.append(f"{key} has invalid sampled-body digest")
        if int(row.get("usable_endpoints") or 0) != usable:
            failures.append(f"{key} usable endpoint count disagrees")
        if int(row.get("browser_required_endpoints") or 0) != browser_required:
            failures.append(f"{key} browser endpoint count disagrees")
        derived = (
            "http-usable"
            if usable
            else "browser-required"
            if browser_required
            else "unreachable-or-unsupported"
        )
        if source_status != derived:
            failures.append(f"{key} source status disagrees with endpoint evidence")

    role_counts = Counter((key[0], key[1]) for key in report_by_key)
    expected_role_counts = {
        ("seminars", "every-run-priority"): int(
            (selection.get("seminars") or {}).get("priority_sources") or -1
        ),
        ("seminars", "scheduled-rotating"): int(
            (selection.get("seminars") or {}).get("rotating_sources") or -1
        ),
        ("protests", "primary"): int(
            (selection.get("protests") or {}).get("primary_sources") or -1
        ),
        ("protests", "corroboration"): int(
            (selection.get("protests") or {}).get("corroboration_sources") or -1
        ),
        ("festivals", "discovery"): int(
            (selection.get("festivals") or {}).get("discovery_sources") or -1
        ),
        ("festivals", "primary"): int(
            (selection.get("festivals") or {}).get("primary_sources") or -1
        ),
    }
    if dict(role_counts) != expected_role_counts:
        failures.append("report source-role counts disagree with its saved selection")

    cadence = report.get("cadence") or {}
    for stream, (workflow, expected) in EXPECTED_CADENCE.items():
        row = cadence.get(stream) or {}
        source = (ROOT / workflow).read_text(encoding="utf-8")
        observed = re.findall(r"\bcron:\s*[\"']([^\"']+)[\"']", source)
        if (
            row.get("workflow") != workflow
            or row.get("expected") != expected
            or row.get("observed") != observed
            or row.get("exactly_once_weekly") is not True
            or observed != [expected]
        ):
            failures.append(f"{stream} exactly-once-weekly cadence evidence failed")

    endpoint_statuses = Counter(
        str(row.get("status") or "")
        for row in unique_endpoint_results.values()
    )
    failure_classes = Counter(
        str(row.get("failure_class") or "")
        for row in unique_endpoint_results.values()
        if row.get("failure_class")
    )
    summary = report.get("summary") or {}
    if summary.get("status") != "complete":
        failures.append("report did not complete")
    expected_summary = {
        "source_bindings_checked": len(report_sources),
        "endpoint_bindings_checked": endpoint_bindings,
        "unique_live_requests": len(unique_urls),
        "source_statuses": dict(sorted(source_statuses.items())),
        "endpoint_statuses": dict(sorted(endpoint_statuses.items())),
        "failure_classes": dict(sorted(failure_classes.items())),
    }
    for key, expected in expected_summary.items():
        if summary.get(key) != expected:
            failures.append(f"summary {key} disagrees with detailed evidence")

    dry_runs = report.get("scheduled_dry_runs") or {}
    serialized_report = json.dumps(report, ensure_ascii=False)
    for leaked in ("/tmp/", "/workspace/", "scratch/"):
        if leaked in serialized_report:
            failures.append(f"report leaks a non-portable runtime path: {leaked}")
    for stream, expected_stream in (
        ("seminars", "deterministic-structured-events"),
        ("protests", "deterministic-protests"),
    ):
        row = dry_runs.get(stream)
        if not isinstance(row, dict):
            failures.append(f"{stream} scheduled dry-run evidence is missing")
            continue
        if row.get("expected_stream") != expected_stream or row.get("stream_matches") is not True:
            failures.append(f"{stream} dry-run stream binding failed")
        if row.get("exact_source_selection") is not True:
            failures.append(f"{stream} dry-run source selection failed")
        if not re.fullmatch(
            r"\$AUDIT48_RUNTIME_EVIDENCE/[A-Za-z0-9._-]+",
            str(row.get("evidence_path") or ""),
        ):
            failures.append(f"{stream} dry-run evidence path is not portable")
        gate = row.get("source_health_gate") or {}
        if gate.get("status") != "passed":
            failures.append(f"{stream} source-health gate did not pass")
        if int(row.get("primary_source_yield_rows") or 0) != int(
            row.get("selected_sources") or -1
        ):
            failures.append(f"{stream} dry-run source-yield coverage is incomplete")
    browser = dry_runs.get("protest_browser_ocr")
    if not isinstance(browser, dict):
        failures.append("protest browser/OCR evidence is missing")
    elif browser.get("exact_source_selection") is not True:
        failures.append("protest browser/OCR selection is incomplete")
    elif not re.fullmatch(
        r"\$AUDIT48_RUNTIME_EVIDENCE/[A-Za-z0-9._-]+",
        str(browser.get("evidence_path") or ""),
    ):
        failures.append("protest browser/OCR evidence path is not portable")
    festivals = dry_runs.get("festivals") or {}
    if festivals.get("execution") != "endpoint-validation-only":
        failures.append("festival external limit is not recorded precisely")

    if failures:
        print("AUDIT48 LIVE HARVEST EVIDENCE FAILED", file=sys.stderr)
        for failure in failures:
            print(f" - {failure}", file=sys.stderr)
        return 1
    dry_seminars = dry_runs["seminars"]
    dry_protests = dry_runs["protests"]
    evidence_label = (
        "AUDIT48 HISTORICAL LIVE HARVEST EVIDENCE PASSED"
        if configuration_drift
        else "AUDIT48 LIVE HARVEST EVIDENCE PASSED"
    )
    drift_note = (
        "; current configuration changed in "
        + ", ".join(configuration_drift)
        + "; run the live audit before claiming current endpoint evidence"
        if configuration_drift
        else ""
    )
    print(
        evidence_label + " — "
        f"{len(report_sources)} source bindings, {endpoint_bindings} endpoint "
        f"bindings, {len(unique_urls)} unique live requests; "
        f"seminars {dry_seminars['selected_sources']} sources/"
        f"{dry_seminars['events']} events and protests "
        f"{dry_protests['selected_sources']} sources/"
        f"{dry_protests['events']} events; exact weekly cadence preserved"
        f"{drift_note}."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
