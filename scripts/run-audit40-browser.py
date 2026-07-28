#!/usr/bin/env python3
"""Run frozen Audit 37 browser logic with Audit 40-owned evidence paths.

The historical browser programs remain byte-identical baselines. This adapter
changes only release labels, environment variable names, and output paths in
memory, then executes the same Chromium assertions against the current build.
It refuses to generate mis-stamped, partial, or stale evidence.
"""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
EXPECTED_RELEASE_ID = (
    "2026-07-24-site-audit40-browser-runtime-continuity-final"
)
BASELINES = {
    "interaction": ROOT
    / "scripts"
    / "audit-polymythcal-interactivity-design-audit37.py",
    "entry-pages": ROOT
    / "scripts"
    / "audit-polymythcal-entry-pages-audit37.py",
    "wcag": ROOT / "scripts" / "audit-polymythcal-wcag22-audit37.py",
    "routes": ROOT / "scripts" / "audit-audit37-route-resilience.py",
    "stress": ROOT / "scripts" / "audit-project-failure-stress-audit37.py",
}
REPORTS = {
    "interaction": ROOT
    / "data"
    / "polymythcal-audit40"
    / "interaction-design-browser-audit.json",
    "entry-pages": ROOT
    / "data"
    / "polymythcal-audit40"
    / "entry-pages-browser-audit.json",
    "wcag": ROOT
    / "data"
    / "polymythcal-audit40"
    / "wcag22-browser-audit.json",
    "routes": ROOT
    / "data"
    / "audit40-route-browser"
    / "route-resilience-browser-audit.json",
    "stress": ROOT
    / "scripts"
    / "reports"
    / "audit40-project-failure-stress.json",
}


def audit40_source(path: Path) -> str:
    """Return an in-memory Audit 40 variant without modifying the baseline."""
    source = path.read_text(encoding="utf-8")
    replacements = (
        ("AUDIT37", "AUDIT40"),
        ("Audit37", "Audit40"),
        ("Audit 37", "Audit 40"),
        ("audit37", "audit40"),
        ('"audit": 37', '"audit": 40'),
        ("'audit': 37", "'audit': 40"),
    )
    for before, after in replacements:
        source = source.replace(before, after)
    return source


def read_release() -> dict[str, Any]:
    release_path = ROOT / "RELEASE_MANIFEST.json"
    try:
        release = json.loads(release_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise SystemExit(
            f"AUDIT 40 BROWSER ADAPTER FAILED — invalid {release_path.name}: {error}"
        ) from error
    release_id = release.get("release_id")
    if release_id != EXPECTED_RELEASE_ID:
        raise SystemExit(
            "AUDIT 40 BROWSER ADAPTER FAILED — RELEASE_MANIFEST.json identifies "
            f"{release_id or 'an unknown release'}; expected {EXPECTED_RELEASE_ID}. "
            "Apply the Audit 40 release stamp before generating browser evidence."
        )
    if not release.get("generated_at"):
        raise SystemExit(
            "AUDIT 40 BROWSER ADAPTER FAILED — RELEASE_MANIFEST.json has no "
            "generated_at timestamp."
        )
    return release


def validate_fresh_report(
    audit_name: str,
    report_path: Path,
    release: dict[str, Any],
    started_at: datetime,
) -> None:
    try:
        report = json.loads(report_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise SystemExit(
            f"AUDIT 40 BROWSER ADAPTER FAILED — {audit_name} did not write a "
            f"valid report at {report_path.relative_to(ROOT)}: {error}"
        ) from error

    failures: list[str] = []
    if report.get("audit") != 40:
        failures.append("report is not stamped Audit 40")
    if report.get("release_id") != EXPECTED_RELEASE_ID:
        failures.append("report has the wrong release ID")
    if report.get("generated_at") != release.get("generated_at"):
        failures.append("report has the wrong release timestamp")

    try:
        executed_at = datetime.fromisoformat(
            str(report.get("executed_at", "")).replace("Z", "+00:00")
        )
        if executed_at.tzinfo is None:
            raise ValueError("timestamp has no timezone")
        executed_at = executed_at.astimezone(timezone.utc)
    except ValueError:
        failures.append("report has an invalid executed_at timestamp")
    else:
        if executed_at < started_at.replace(microsecond=0):
            failures.append("report predates this browser-audit invocation")

    total = report.get("checks_total")
    passed = report.get("checks_passed")
    failed = report.get("checks_failed")
    results = report.get("results")
    if isinstance(total, bool) or not isinstance(total, int) or total < 1:
        failures.append("report has an invalid check count")
    elif (
        passed != total
        or failed != 0
        or not isinstance(results, list)
        or len(results) != total
        or any(
            not isinstance(result, dict) or result.get("passed") is not True
            for result in results
        )
    ):
        failures.append("report does not contain a complete passing result set")

    if audit_name == "routes" and report.get("phase") != "all":
        failures.append("route report is partial; AUDIT40_PHASE must be all")

    if failures:
        details = "; ".join(failures)
        raise SystemExit(
            f"AUDIT 40 BROWSER ADAPTER FAILED — {audit_name}: {details}"
        )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("audit", choices=sorted(BASELINES))
    args = parser.parse_args()

    release = read_release()
    baseline = BASELINES[args.audit]
    if not baseline.is_file():
        raise SystemExit(
            "AUDIT 40 BROWSER ADAPTER FAILED — baseline is missing: "
            f"{baseline.relative_to(ROOT)}"
        )

    source = audit40_source(baseline)
    if "audit40" not in source.lower() or "audit37" in source.lower():
        raise SystemExit(
            "AUDIT 40 BROWSER ADAPTER FAILED — release-label substitution was "
            f"incomplete for {baseline.relative_to(ROOT)}"
        )

    started_at = datetime.now(timezone.utc)
    namespace = {
        "__name__": "__main__",
        "__file__": str(baseline),
        "__package__": None,
    }
    try:
        exec(compile(source, str(baseline), "exec"), namespace)
    except SystemExit as error:
        if error.code not in (None, 0):
            raise

    validate_fresh_report(
        args.audit,
        REPORTS[args.audit],
        release,
        started_at,
    )


if __name__ == "__main__":
    main()
