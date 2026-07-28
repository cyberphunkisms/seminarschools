#!/usr/bin/env python3
"""Record byte-level preservation of the supplied Greenpeace/CV base."""
from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE_MANIFEST = ROOT / "PACKAGE_CONTENTS_SHA256.json"
OUTPUT = ROOT / "scripts" / "reports" / "audit52-greenpeace-base-preservation.json"
INPUT_ARCHIVE = "ss-site-audit50-greenpeace-cv-editable-complete-2026-07-28(1).zip"
INPUT_ARCHIVE_SHA256 = "a7256d204ee677eda973d416eec1eb1791cf705780fabfbc0154c0326f394079"
CV_PATTERN = re.compile(r"(greenpeace|saul.*cv|cv.*saul|editable-cv)", re.IGNORECASE)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def aggregate(rows: list[dict]) -> str:
    digest = hashlib.sha256()
    for row in sorted(rows, key=lambda item: item["path"]):
        digest.update(f"{row['path']}\0{row['sha256']}\n".encode("utf-8"))
    return digest.hexdigest()


def main() -> None:
    manifest_bytes = BASE_MANIFEST.read_bytes()
    manifest = json.loads(manifest_bytes)
    original_rows = manifest["files"]
    missing: list[str] = []
    modified: list[str] = []
    cv_rows: list[dict] = []
    cv_missing: list[str] = []
    cv_modified: list[str] = []

    for row in original_rows:
        relative = row["path"]
        current = ROOT / relative
        is_cv = bool(CV_PATTERN.search(relative))
        if not current.is_file():
            missing.append(relative)
            if is_cv:
                cv_missing.append(relative)
            continue
        current_sha = sha256(current)
        if current_sha != row["sha256"]:
            modified.append(relative)
            if is_cv:
                cv_modified.append(relative)
        if is_cv:
            cv_rows.append(
                {
                    "path": relative,
                    "bytes": row["bytes"],
                    "sha256": row["sha256"],
                }
            )

    status = (
        "passed"
        if not missing and not cv_missing and not cv_modified
        else "failed"
    )
    report = {
        "schema": "seminarschools.audit52.base-preservation.v1",
        "audit": 52,
        "generated_at": datetime.now().astimezone().isoformat(timespec="seconds"),
        "status": status,
        "input_archive": INPUT_ARCHIVE,
        "input_archive_sha256": INPUT_ARCHIVE_SHA256,
        "input_package_manifest_sha256": hashlib.sha256(manifest_bytes).hexdigest(),
        "original_files_checked": len(original_rows),
        "original_files_missing": missing,
        "original_files_modified_count": len(modified),
        "original_files_modified": modified,
        "cv_greenpeace_files_checked": len(cv_rows),
        "cv_greenpeace_files_missing": cv_missing,
        "cv_greenpeace_files_modified": cv_modified,
        "cv_greenpeace_expected_aggregate_sha256": aggregate(cv_rows),
        "cv_greenpeace_files": cv_rows,
        "interpretation": {
            "original_files_missing": "Every file supplied in the input package remains present.",
            "original_files_modified": "These are intentional Audit 52 integration, release, public-mirror, and report edits.",
            "cv_greenpeace_files_modified": "An empty list confirms byte-for-byte preservation of the supplied Greenpeace/CV surface."
        }
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(
        "AUDIT 52 BASE PRESERVATION "
        f"{status.upper()} — {len(original_rows)} original files checked; "
        f"{len(missing)} missing; {len(cv_rows)} Greenpeace/CV files checked; "
        f"{len(cv_modified)} modified."
    )
    if status != "passed":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
