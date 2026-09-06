#!/usr/bin/env python3
"""Verify the private IELTS rubric bundle and its public PDF mirror."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path


SITE_ROOT = Path(__file__).resolve().parents[1]
BUNDLE_ROOT = SITE_ROOT.parent / "EDITABLE_MASTERS" / "08_IELTS_RUBRIC"
MANIFEST_PATH = BUNDLE_ROOT / "BUNDLE_MANIFEST.json"
PUBLIC_PDF = (
    SITE_ROOT
    / "teacherresources"
    / "ieltsrubric"
    / "ielts-band-guide-and-assessment-rubric.pdf"
)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
rows = manifest.get("files") or []
assert manifest.get("schema") == "seminar-schools-ielts-rubric-bundle-v1"
assert manifest.get("payload_file_count") == len(rows) == 7

row_paths = {str(row["path"]) for row in rows}
actual_paths = {
    path.relative_to(BUNDLE_ROOT).as_posix()
    for path in BUNDLE_ROOT.iterdir()
    if path.is_file() and path.name not in {"BUNDLE_MANIFEST.json", "README.md"}
}
assert row_paths == actual_paths, (sorted(row_paths), sorted(actual_paths))

for row in rows:
    path = BUNDLE_ROOT / row["path"]
    assert path.is_file(), row["path"]
    assert path.stat().st_size == int(row["bytes"]), row["path"]
    assert sha256(path) == row["sha256"], row["path"]

bundle_pdf = BUNDLE_ROOT / "Seminar_Schools_IELTS_Band_Guide_and_Rubric.pdf"
assert sha256(bundle_pdf) == sha256(PUBLIC_PDF)
assert bundle_pdf.read_bytes() == PUBLIC_PDF.read_bytes()

print(
    "IELTS RUBRIC BUNDLE CHECK PASSED — 7 payload files and the public PDF "
    "mirror are byte-exact and SHA-256 verified."
)

