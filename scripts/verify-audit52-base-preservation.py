#!/usr/bin/env python3
"""Recheck the Audit 52 Greenpeace/CV preservation evidence."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPORT = ROOT / "scripts" / "reports" / "audit52-greenpeace-base-preservation.json"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    report = json.loads(REPORT.read_text(encoding="utf-8"))
    assert report["status"] == "passed"
    assert report["original_files_missing"] == []
    assert report["cv_greenpeace_files_missing"] == []
    assert report["cv_greenpeace_files_modified"] == []
    assert report["cv_greenpeace_files_checked"] >= 150

    aggregate = hashlib.sha256()
    for row in sorted(report["cv_greenpeace_files"], key=lambda item: item["path"]):
        current = ROOT / row["path"]
        assert current.is_file(), row["path"]
        assert current.stat().st_size == row["bytes"], row["path"]
        current_sha = sha256(current)
        assert current_sha == row["sha256"], row["path"]
        aggregate.update(f"{row['path']}\0{current_sha}\n".encode("utf-8"))
    assert aggregate.hexdigest() == report["cv_greenpeace_expected_aggregate_sha256"]
    print(
        "AUDIT 52 GREENPEACE/CV PRESERVATION PASSED — "
        f"{report['cv_greenpeace_files_checked']} supplied files are byte-identical."
    )


if __name__ == "__main__":
    main()
