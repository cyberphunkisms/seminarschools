#!/usr/bin/env python3
"""Regenerate and verify all seven inherited Audit 42 Chromium suites."""
from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ARTIFACT_ROOT = ROOT / "data" / "audit42-inherited-browser"
ADAPTER = ROOT / "scripts" / "run-audit42-inherited-browser.py"
VERIFIER = ROOT / "scripts" / "verify-audit42-inherited-browser-evidence.js"
RELEASE_PATH = ROOT / "RELEASE_MANIFEST.json"
SUITES = (
    ("interaction", 94),
    ("entry-pages", 209),
    ("wcag", 42),
    ("routes", 252),
    ("stress", 27),
    ("runtime", 194),
    ("depth", 64),
)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def main() -> None:
    release = json.loads(RELEASE_PATH.read_text(encoding="utf-8"))
    started_at = iso_now()
    if ARTIFACT_ROOT.exists():
        shutil.rmtree(ARTIFACT_ROOT)
    ARTIFACT_ROOT.mkdir(parents=True, exist_ok=True)

    completed: list[dict[str, object]] = []
    for suite, expected in SUITES:
        print(
            f"AUDIT 42 INHERITED BROWSER — {suite} ({expected} assertions)",
            flush=True,
        )
        subprocess.run(
            [sys.executable, str(ADAPTER), suite],
            cwd=ROOT,
            check=True,
        )
        completed.append({"suite": suite, "checks": expected})

    summary = {
        "audit": 42,
        "contract": "audit42-inherited-browser-v1",
        "release_id": release.get("release_id"),
        "generated_at": release.get("generated_at"),
        "release_manifest_sha256": sha256(RELEASE_PATH),
        "started_at": started_at,
        "completed_at": iso_now(),
        "suite_count": len(SUITES),
        "combined_checks": sum(expected for _suite, expected in SUITES),
        "suites": completed,
        "wrapper_program_path": Path(__file__).resolve().relative_to(ROOT).as_posix(),
        "wrapper_program_sha256": sha256(Path(__file__).resolve()),
        "adapter_program_path": ADAPTER.relative_to(ROOT).as_posix(),
        "adapter_program_sha256": sha256(ADAPTER),
        "verifier_program_path": VERIFIER.relative_to(ROOT).as_posix(),
        "verifier_program_sha256": sha256(VERIFIER),
    }
    summary_path = ARTIFACT_ROOT / "run-summary.json"
    summary_path.write_text(
        json.dumps(summary, indent=2) + "\n",
        encoding="utf-8",
    )
    subprocess.run(["node", str(VERIFIER)], cwd=ROOT, check=True)
    print(
        "AUDIT 42 INHERITED BROWSER COMPLETE — "
        f"{summary['combined_checks']} assertions across {len(SUITES)} suites",
        flush=True,
    )


if __name__ == "__main__":
    main()
