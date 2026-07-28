#!/usr/bin/env python3
"""Bind live scheduled-harvest dry runs to the Audit 48 endpoint report."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from collections import Counter
from pathlib import Path
from typing import Any

from harvest_protests import load_protest_sources

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_REPORT = (
    ROOT / "scripts" / "reports" / "audit48-live-harvest-endpoints.json"
)
CONFIGURATION_FILES = (
    "scripts/sources.json",
    "scripts/protest-sources.json",
    "scripts/festivals-sources.json",
    ".github/workflows/scrape-seminars.yml",
    ".github/workflows/scrape-festivals.yml",
    ".github/workflows/scrape-polymythcal-protests.yml",
)


def _read(path: Path) -> tuple[dict[str, Any], str]:
    raw = path.read_bytes()
    payload = json.loads(raw)
    if not isinstance(payload, dict):
        raise ValueError(f"evidence must be a JSON object: {path}")
    return payload, hashlib.sha256(raw).hexdigest()


def summarize_harvest(
    path: Path,
    *,
    expected_stream: str,
    expected_source_ids: list[str],
) -> dict[str, Any]:
    payload, digest = _read(path)
    source_yields = payload.get("source_yields")
    if not isinstance(source_yields, list):
        raise ValueError(f"harvest evidence has no source_yields array: {path}")
    selected = [str(value) for value in payload.get("selected_source_ids") or []]
    status_counts = Counter(
        str(row.get("status") or "missing")
        for row in source_yields
        if isinstance(row, dict)
    )
    failure_classes: Counter[str] = Counter()
    parse_classes: Counter[str] = Counter()
    for row in source_yields:
        if not isinstance(row, dict):
            continue
        for key, value in (row.get("failure_classes") or {}).items():
            failure_classes[str(key)] += int(value)
        for failure in row.get("parse_errors") or []:
            if isinstance(failure, dict) and failure.get("failure_kind"):
                parse_classes[str(failure["failure_kind"])] += 1
    gate = payload.get("source_health_gate") or {}
    return {
        "evidence_path": f"$AUDIT48_RUNTIME_EVIDENCE/{path.name}",
        "evidence_sha256": digest,
        "stream": str(payload.get("stream") or ""),
        "expected_stream": expected_stream,
        "stream_matches": payload.get("stream") == expected_stream,
        "generated_at": payload.get("generated_at"),
        "scope": payload.get("scope"),
        "selected_sources": len(selected),
        "expected_selected_sources": len(expected_source_ids),
        "exact_source_selection": (
            len(selected) == len(set(selected))
            and sorted(selected) == sorted(expected_source_ids)
        ),
        "source_yield_rows": len(source_yields),
        "primary_source_yield_rows": sum(
            isinstance(row, dict) and row.get("role") != "corroboration"
            for row in source_yields
        ),
        "events": len(payload.get("events") or []),
        "announcements": len(payload.get("announcements") or []),
        "source_statuses": dict(sorted(status_counts.items())),
        "fetch_failure_classes": dict(sorted(failure_classes.items())),
        "parse_failure_classes": dict(sorted(parse_classes.items())),
        "source_health_gate": {
            "status": gate.get("status"),
            "reason": gate.get("reason"),
            "authoritative_primary_sources": gate.get(
                "authoritative_primary_sources"
            ),
            "minimum_authoritative_primary_sources": gate.get(
                "minimum_authoritative_primary_sources"
            ),
            "authoritative_critical_sources": len(
                gate.get("authoritative_critical_source_ids") or []
            ),
            "minimum_authoritative_critical_sources": gate.get(
                "minimum_authoritative_critical_sources"
            ),
        },
        "summary": payload.get("summary") or {},
    }


def _browser_failure_class(row: dict[str, Any]) -> str:
    if row.get("failure_kind"):
        return str(row["failure_kind"])
    status = str(row.get("status") or "")
    error = str(row.get("error") or "")
    if "ERR_TIMED_OUT" in error:
        return "browser-network-timeout"
    if "ERR_NAME_NOT_RESOLVED" in error:
        return "browser-dns-resolution"
    if "ERR_CERT" in error:
        return "browser-tls-error"
    if "ERR_TOO_MANY_REDIRECTS" in error:
        return "browser-redirect-loop"
    if status == "timeout":
        return "browser-navigation-timeout"
    if status == "browser-unavailable":
        return "browser-runtime-unavailable"
    if status == "browser-error":
        return "browser-runtime-error"
    return ""


def portable_browser_executable(value: object) -> str:
    text = str(value or "").strip()
    if not text or text == "playwright-managed":
        return text
    if Path(text).is_absolute() or re.match(r"^[A-Za-z]:[\\/]", text):
        name = re.split(r"[\\/]", text)[-1] or "browser"
        return f"$PLAYWRIGHT_BROWSER_EXECUTABLE/{name}"
    return text


def summarize_browser(
    path: Path,
    *,
    expected_source_ids: list[str],
) -> dict[str, Any]:
    payload, digest = _read(path)
    results = payload.get("results")
    if not isinstance(results, list):
        raise ValueError(f"browser evidence has no results array: {path}")
    selected = [str(value) for value in payload.get("source_ids") or []]
    statuses = Counter(
        str(row.get("status") or "missing")
        for row in results
        if isinstance(row, dict)
    )
    classes = Counter(
        kind
        for row in results
        if isinstance(row, dict)
        for kind in [_browser_failure_class(row)]
        if kind
    )
    return {
        "evidence_path": f"$AUDIT48_RUNTIME_EVIDENCE/{path.name}",
        "evidence_sha256": digest,
        "schema": payload.get("schema"),
        "generated_at": payload.get("generated_at"),
        "browser_executable": portable_browser_executable(
            payload.get("browser_executable")
        ),
        "selected_sources": len(selected),
        "expected_selected_sources": len(expected_source_ids),
        "exact_source_selection": (
            len(selected) == len(set(selected))
            and sorted(selected) == sorted(expected_source_ids)
        ),
        "documents": len(payload.get("documents") or []),
        "result_rows": len(results),
        "result_statuses": dict(sorted(statuses.items())),
        "failure_classes": dict(sorted(classes.items())),
        "summary": payload.get("summary") or {},
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    parser.add_argument("--structured-evidence", type=Path, required=True)
    parser.add_argument("--protest-evidence", type=Path, required=True)
    parser.add_argument("--browser-evidence", type=Path, required=True)
    args = parser.parse_args()

    report, _ = _read(args.report)
    rows = report.get("sources")
    if not isinstance(rows, list):
        raise ValueError("endpoint report has no sources array")
    seminar_ids = [
        str(row.get("source_id") or "")
        for row in rows
        if row.get("stream") == "seminars"
    ]
    protest_ids = [
        str(row.get("source_id") or "")
        for row in rows
        if row.get("stream") == "protests" and row.get("role") == "primary"
    ]
    browser_ids = sorted(
        str(source.get("id") or "")
        for source in load_protest_sources()[0]
        if source.get("browser_harvest")
    )
    report["scheduled_dry_runs"] = {
        "seminars": summarize_harvest(
            args.structured_evidence,
            expected_stream="deterministic-structured-events",
            expected_source_ids=seminar_ids,
        ),
        "protests": summarize_harvest(
            args.protest_evidence,
            expected_stream="deterministic-protests",
            expected_source_ids=protest_ids,
        ),
        "protest_browser_ocr": summarize_browser(
            args.browser_evidence,
            expected_source_ids=browser_ids,
        ),
        "festivals": {
            "execution": "endpoint-validation-only",
            "paid_agent_invoked": False,
            "reason": (
                "The scheduled festival extractor requires a paid agent. "
                "This read-only audit validated every configured discovery "
                "and official primary endpoint without invoking that service."
            ),
        },
    }
    report["configuration_sha256"] = {
        relative: hashlib.sha256((ROOT / relative).read_bytes()).hexdigest()
        for relative in CONFIGURATION_FILES
    }
    report["summary"]["scheduled_dry_run_status"] = {
        "seminars": report["scheduled_dry_runs"]["seminars"][
            "source_health_gate"
        ]["status"],
        "protests": report["scheduled_dry_runs"]["protests"][
            "source_health_gate"
        ]["status"],
        "protest_browser_ocr": (
            "passed"
            if report["scheduled_dry_runs"]["protest_browser_ocr"]["documents"]
            else "environment-blocked"
        ),
        "festivals": "endpoint-validation-only",
    }
    temporary = args.report.with_suffix(args.report.suffix + ".tmp")
    temporary.write_text(
        json.dumps(report, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    temporary.replace(args.report)
    print(
        json.dumps(
            {
                "seminars": report["scheduled_dry_runs"]["seminars"]["summary"],
                "protests": report["scheduled_dry_runs"]["protests"]["summary"],
                "protest_browser_ocr": report["scheduled_dry_runs"][
                    "protest_browser_ocr"
                ]["summary"],
                "festival_execution": "endpoint-validation-only",
            },
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
