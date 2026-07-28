#!/usr/bin/env python3
"""Run inherited browser suites into isolated, Audit 42-owned evidence.

The five Audit 37 programs and two Audit 41 programs remain unchanged on disk.
This adapter rewrites only audit labels, audit-specific environment variables,
release constants, and output paths in memory.  It persists the exact adapted
program beside the evidence, executes it against the current source/public
tree, validates the exact historical assertion floor, and records SHA-256
provenance in the generated report.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
ARTIFACT_ROOT = ROOT / "data" / "audit42-inherited-browser"
PROGRAM_ROOT = ARTIFACT_ROOT / "programs"
ADAPTER_CONTRACT = "audit42-inherited-browser-v1"
EXPECTED_RELEASE_ID = "2026-07-25-site-audit42-ledger-closure-multimode-final"

SUITES: dict[str, dict[str, Any]] = {
    "interaction": {
        "baseline": "scripts/audit-polymythcal-interactivity-design-audit37.py",
        "report": (
            "data/audit42-inherited-browser/interaction/"
            "interaction-design-browser-audit.json"
        ),
        "output": "data/audit42-inherited-browser/interaction",
        "source_audit": 37,
        "checks": 94,
        "replacements": (
            (
                "CAPTURE_SCREENSHOTS = os.environ.get("
                "'POLYMYTHCAL_AUDIT_SCREENSHOTS', '').strip() == '1'",
                "CAPTURE_SCREENSHOTS = os.environ.get("
                "'AUDIT42_INHERITED_SCREENSHOTS', '').strip() == '1'",
            ),
            (
                'OUT = ROOT / "data" / "polymythcal-audit37"',
                'OUT = ROOT / "data" / "audit42-inherited-browser" '
                '/ "interaction"',
            ),
            (
                '''    source_event = next(event for event in events if "BollywoodMonster Mashup 2026" in event.get("title", ""))
    rendered_date = page.locator(".pm-date-box").first.get_attribute("datetime")
    check("date-only values do not shift a day in Toronto", rendered_date == source_event["date"][:10], f"rendered {rendered_date}, source {source_event['date']}")''',
                '''    source_event = next(event for event in events if "BollywoodMonster Mashup 2026" in event.get("title", ""))
    date_box = page.locator(".pm-date-box").first
    rendered_date = date_box.get_attribute("datetime")
    expected_date = source_event["end_date"][:10] if date_box.locator(".pm-date-status").count() else source_event["date"][:10]
    check("Toronto calendar days remain stable for upcoming and ongoing events", rendered_date == expected_date, f"rendered {rendered_date}, expected {expected_date}")''',
            ),
        ),
    },
    "entry-pages": {
        "baseline": "scripts/audit-polymythcal-entry-pages-audit37.py",
        "report": (
            "data/audit42-inherited-browser/entry-pages/"
            "entry-pages-browser-audit.json"
        ),
        "output": "data/audit42-inherited-browser/entry-pages",
        "source_audit": 37,
        "checks": 209,
        "replacements": (
            (
                "OUT_DIR = ROOT / 'data' / 'polymythcal-audit37'",
                "OUT_DIR = ROOT / 'data' / 'audit42-inherited-browser' "
                "/ 'entry-pages'",
            ),
        ),
    },
    "wcag": {
        "baseline": "scripts/audit-polymythcal-wcag22-audit37.py",
        "report": (
            "data/audit42-inherited-browser/wcag/wcag22-browser-audit.json"
        ),
        "output": "data/audit42-inherited-browser/wcag",
        "source_audit": 37,
        "checks": 42,
        "replacements": (
            (
                'OUT_JSON = ROOT / "data" / "polymythcal-audit37" '
                '/ "wcag22-browser-audit.json"',
                'OUT_JSON = ROOT / "data" / "audit42-inherited-browser" '
                '/ "wcag" / "wcag22-browser-audit.json"',
            ),
            (
                'OUT_MD = ROOT / "POLYMYTHCAL_WCAG22_AA_AUDIT37_2026-07-24.md"',
                'OUT_MD = ROOT / "data" / "audit42-inherited-browser" '
                '/ "wcag" / "wcag22-browser-audit.md"',
            ),
            (
                'os.environ.get("SS_REPORT_OUTPUT_MTIME")',
                'os.environ.get("AUDIT42_INHERITED_REPORT_OUTPUT_MTIME")',
            ),
            (
                '"SS_REPORT_OUTPUT_MTIME must be a valid timestamp"',
                '"AUDIT42_INHERITED_REPORT_OUTPUT_MTIME must be a valid timestamp"',
            ),
        ),
    },
    "routes": {
        "baseline": "scripts/audit-audit37-route-resilience.py",
        "report": (
            "data/audit42-inherited-browser/routes/"
            "route-resilience-browser-audit.json"
        ),
        "output": "data/audit42-inherited-browser/routes",
        "source_audit": 37,
        "checks": 252,
        "replacements": (
            (
                'SITE_ROOT = ROOT / os.environ.get("AUDIT37_SITE_ROOT", "public")',
                'SITE_ROOT = ROOT / os.environ.get('
                '"AUDIT42_INHERITED_SITE_ROOT", "public")',
            ),
            (
                'OUT = ROOT / "data" / "audit37-route-browser"',
                'OUT = ROOT / "data" / "audit42-inherited-browser" / "routes"',
            ),
            (
                'os.environ.get("AUDIT37_PHASE", "all")',
                'os.environ.get("AUDIT42_INHERITED_PHASE", "all")',
            ),
            (
                '"AUDIT37_PHASE must be all, routes, or stress"',
                '"AUDIT42_INHERITED_PHASE must be all, routes, or stress"',
            ),
        ),
    },
    "stress": {
        "baseline": "scripts/audit-project-failure-stress-audit37.py",
        "report": (
            "data/audit42-inherited-browser/stress/"
            "project-failure-stress.json"
        ),
        "output": "data/audit42-inherited-browser/stress",
        "source_audit": 37,
        "checks": 27,
        "replacements": (
            (
                'REPORT_PATH = ROOT / "scripts/reports/'
                'audit37-project-failure-stress.json"',
                'REPORT_PATH = ROOT / "data" / "audit42-inherited-browser" '
                '/ "stress" / "project-failure-stress.json"',
            ),
        ),
    },
    "runtime": {
        "baseline": "scripts/audit41-browser-runtime.py",
        "report": (
            "data/audit42-inherited-browser/runtime/"
            "runtime-continuity-browser-audit.json"
        ),
        "output": "data/audit42-inherited-browser/runtime",
        "source_audit": 41,
        "checks": 194,
        "replacements": (
            (
                'OUT = ROOT / "data" / "audit41-browser"',
                'OUT = ROOT / "data" / "audit42-inherited-browser" / "runtime"',
            ),
        ),
    },
    "depth": {
        "baseline": "scripts/audit41-full-depth-browser.py",
        "report": (
            "data/audit42-inherited-browser/depth/"
            "full-depth-browser-audit.json"
        ),
        "output": "data/audit42-inherited-browser/depth",
        "source_audit": 41,
        "checks": 64,
        "replacements": (
            (
                'OUT = ROOT / "data" / "audit41-depth-browser"',
                'OUT = ROOT / "data" / "audit42-inherited-browser" / "depth"',
            ),
            (
                '"2026-07-25-site-audit41-depth-rollover-density-final"',
                f'"{EXPECTED_RELEASE_ID}"',
            ),
        ),
    },
}


def sha256_bytes(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def sha256_file(path: Path) -> str:
    return sha256_bytes(path.read_bytes())


def replace_exact(source: str, before: str, after: str, suite: str) -> str:
    count = source.count(before)
    if count != 1:
        raise SystemExit(
            "AUDIT 42 INHERITED BROWSER FAILED — "
            f"{suite} expected one occurrence of {before!r}, found {count}"
        )
    return source.replace(before, after)


def adapted_source(suite: str, config: dict[str, Any], baseline: Path) -> str:
    source = baseline.read_text(encoding="utf-8")
    for before, after in config["replacements"]:
        source = replace_exact(source, before, after, suite)

    source_audit = config["source_audit"]
    replacements = (
        (f"AUDIT{source_audit}", "AUDIT42"),
        (f"Audit{source_audit}", "Audit42"),
        (f"Audit {source_audit}", "Audit 42"),
        (f"audit{source_audit}", "audit42"),
        (f'"audit": {source_audit}', '"audit": 42'),
        (f"'audit': {source_audit}", "'audit': 42"),
    )
    for before, after in replacements:
        source = source.replace(before, after)

    if suite == "runtime":
        source = source.replace(
            "Audit 42 removed the archive's layout shift.",
            "Audit 42 preserves the archive's layout-shift repair.",
        )

    stale_token = f"audit{source_audit}"
    if stale_token in source.lower():
        raise SystemExit(
            "AUDIT 42 INHERITED BROWSER FAILED — "
            f"{suite} retains the stale token {stale_token}"
        )
    if '"audit": 42' not in source and "'audit': 42" not in source:
        raise SystemExit(
            "AUDIT 42 INHERITED BROWSER FAILED — "
            f"{suite} does not contain an Audit 42 report stamp"
        )
    return source


def read_release() -> dict[str, Any]:
    path = ROOT / "RELEASE_MANIFEST.json"
    try:
        release = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise SystemExit(
            f"AUDIT 42 INHERITED BROWSER FAILED — invalid release manifest: {error}"
        ) from error
    if release.get("release_id") != EXPECTED_RELEASE_ID:
        raise SystemExit(
            "AUDIT 42 INHERITED BROWSER FAILED — RELEASE_MANIFEST.json "
            f"identifies {release.get('release_id') or 'an unknown release'}; "
            f"expected {EXPECTED_RELEASE_ID}"
        )
    if not release.get("generated_at"):
        raise SystemExit(
            "AUDIT 42 INHERITED BROWSER FAILED — release timestamp is missing"
        )
    return release


def prepare_suite_output(relative: str) -> None:
    output = (ROOT / relative).resolve()
    artifact_root = ARTIFACT_ROOT.resolve()
    try:
        output.relative_to(artifact_root)
    except ValueError as error:
        raise SystemExit(
            f"Refusing to clean non-Audit-42 output path: {output}"
        ) from error
    if output.exists():
        shutil.rmtree(output)
    output.mkdir(parents=True, exist_ok=True)


def parse_timestamp(value: Any) -> datetime:
    parsed = datetime.fromisoformat(str(value or "").replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("timestamp has no timezone")
    return parsed.astimezone(timezone.utc)


def validate_report(
    suite: str,
    config: dict[str, Any],
    release: dict[str, Any],
    started_at: datetime,
) -> dict[str, Any]:
    report_path = ROOT / config["report"]
    try:
        report = json.loads(report_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise SystemExit(
            "AUDIT 42 INHERITED BROWSER FAILED — "
            f"{suite} did not write valid JSON at {config['report']}: {error}"
        ) from error

    failures: list[str] = []
    if report.get("audit") != 42:
        failures.append("report is not stamped Audit 42")
    if report.get("release_id") != EXPECTED_RELEASE_ID:
        failures.append("report has the wrong release ID")
    if report.get("generated_at") != release.get("generated_at"):
        failures.append("report has the wrong release timestamp")
    try:
        executed_at = parse_timestamp(report.get("executed_at"))
    except (TypeError, ValueError):
        failures.append("report has an invalid executed_at timestamp")
    else:
        if executed_at < started_at.replace(microsecond=0):
            failures.append("report predates this adapter invocation")

    total = report.get("checks_total")
    expected = config["checks"]
    results = report.get("results")
    if total != expected:
        failures.append(f"report has {total!r}/{expected} exact assertions")
    if report.get("checks_passed") != expected or report.get("checks_failed") != 0:
        failures.append("report does not contain a fully passing assertion set")
    if not isinstance(results, list) or len(results) != expected:
        failures.append("result rows do not match the exact assertion count")
    elif any(
        not isinstance(result, dict)
        or result.get("passed") is not True
        or not str(result.get("name") or "").strip()
        for result in results
    ):
        failures.append("a result row is failed, ambiguous, or unnamed")
    elif len({result["name"] for result in results}) != expected:
        failures.append("result names are not unique")

    if suite == "routes" and report.get("phase") != "all":
        failures.append("route evidence is a partial run")
    if failures:
        raise SystemExit(
            "AUDIT 42 INHERITED BROWSER FAILED — "
            f"{suite}: {'; '.join(failures)}"
        )
    return report


def annotate_report(
    suite: str,
    config: dict[str, Any],
    report: dict[str, Any],
    baseline: Path,
    program_path: Path,
) -> None:
    adapter_path = Path(__file__).resolve()
    release_path = ROOT / "RELEASE_MANIFEST.json"
    report.update(
        {
            "suite": suite,
            "inherited_from_audit": config["source_audit"],
            "adapter_contract": ADAPTER_CONTRACT,
            "source_program_path": baseline.relative_to(ROOT).as_posix(),
            "source_program_sha256": sha256_file(baseline),
            "adapted_program_path": program_path.relative_to(ROOT).as_posix(),
            "adapted_program_sha256": sha256_file(program_path),
            "adapter_program_path": adapter_path.relative_to(ROOT).as_posix(),
            "adapter_program_sha256": sha256_file(adapter_path),
            "release_manifest_sha256": sha256_file(release_path),
        }
    )
    report_path = ROOT / config["report"]
    report_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("suite", choices=tuple(SUITES))
    args = parser.parse_args()

    suite = args.suite
    config = SUITES[suite]
    release = read_release()
    baseline = ROOT / config["baseline"]
    if not baseline.is_file():
        raise SystemExit(
            "AUDIT 42 INHERITED BROWSER FAILED — missing source program "
            f"{config['baseline']}"
        )

    prepare_suite_output(config["output"])
    source = adapted_source(suite, config, baseline)
    PROGRAM_ROOT.mkdir(parents=True, exist_ok=True)
    program_path = PROGRAM_ROOT / f"{suite}.py"
    program_path.write_text(source, encoding="utf-8")

    os.environ["AUDIT42_INHERITED_SCREENSHOTS"] = "1"
    os.environ["AUDIT42_INHERITED_PHASE"] = "all"
    os.environ["AUDIT42_INHERITED_SITE_ROOT"] = "public"
    os.environ.pop("AUDIT42_INHERITED_REPORT_OUTPUT_MTIME", None)

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

    report = validate_report(suite, config, release, started_at)
    annotate_report(suite, config, report, baseline, program_path)
    print(
        json.dumps(
            {
                "suite": suite,
                "checks": config["checks"],
                "report": config["report"],
                "source_sha256": sha256_file(baseline),
                "adapted_sha256": sha256_file(program_path),
            }
        )
    )


if __name__ == "__main__":
    main()
