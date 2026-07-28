#!/usr/bin/env python3
"""Verify complete preservation against the packaged Audit 52 baseline."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASELINE = ROOT / "scripts" / "reports" / "audit52-package-baseline.json"
CV_REPORT = ROOT / "scripts" / "reports" / "audit52-greenpeace-base-preservation.json"

# These final-release constants are populated after all Audit 53 generators run.
EXPECTED_MODIFIED_COUNT = 5597
EXPECTED_MODIFIED_PATHS_SHA256 = (
    "2941ab6a6a0c843882e04c3badeb5fbac5378ed9e426f4ae50601daf9ceff990"
)
EXPECTED_MODIFIED_CONTENT_SHA256 = (
    "43188841d05c29818f9ea395ffc7cfa7270cf71ea221a5cf656905817c6dbac1"
)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def aggregate(lines: list[str]) -> str:
    digest = hashlib.sha256()
    for line in sorted(lines):
        digest.update(line.encode("utf-8"))
    return digest.hexdigest()


def main() -> None:
    baseline = json.loads(BASELINE.read_text(encoding="utf-8"))
    missing: list[str] = []
    modified: list[tuple[str, str]] = []

    for row in baseline["files"]:
        relative = row["path"]
        current = ROOT / relative
        if not current.is_file():
            missing.append(relative)
            continue
        current_sha = sha256(current)
        if current_sha != row["sha256"]:
            modified.append((relative, current_sha))

    assert not missing, f"Audit 52 baseline files missing: {missing[:10]}"
    modified_paths_sha = aggregate([f"{path}\n" for path, _ in modified])
    modified_content_sha = aggregate(
        [f"{path}\0{current_sha}\n" for path, current_sha in modified]
    )
    assert len(modified) == EXPECTED_MODIFIED_COUNT, (
        f"Audit 53 modified-file count drifted: {len(modified)} "
        f"!= {EXPECTED_MODIFIED_COUNT}"
    )
    assert modified_paths_sha == EXPECTED_MODIFIED_PATHS_SHA256, (
        "Audit 53 modified-path set drifted"
    )
    assert modified_content_sha == EXPECTED_MODIFIED_CONTENT_SHA256, (
        "Audit 53 modified content drifted"
    )

    cv = json.loads(CV_REPORT.read_text(encoding="utf-8"))
    assert cv["status"] == "passed"
    assert cv["cv_greenpeace_files_missing"] == []
    assert cv["cv_greenpeace_files_modified"] == []
    for row in cv["cv_greenpeace_files"]:
        current = ROOT / row["path"]
        assert current.is_file(), row["path"]
        assert current.stat().st_size == row["bytes"], row["path"]
        assert sha256(current) == row["sha256"], row["path"]

    exact = len(baseline["files"]) - len(modified)
    print(
        "AUDIT 53 BASE PRESERVATION PASSED — "
        f"{len(baseline['files'])} Audit 52 files present; "
        f"{exact} byte-identical; {len(modified)} governed Audit 53 changes; "
        f"{len(cv['cv_greenpeace_files'])} Greenpeace/CV files byte-identical."
    )


if __name__ == "__main__":
    main()
