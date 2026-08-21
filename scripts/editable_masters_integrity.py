#!/usr/bin/env python3
"""Shared exact integrity check for the ten private editable masters."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path


EXPECTED_EDITABLE_MASTER_PATHS = frozenset({
    "01_RHETORIC_TAXONOMY/Polymyth_Rhetoric_Taxonomy_Continuously_Editable_Master_v2.xlsx",
    "02_MEDUSA_GORGONWARS/Medusa_Speaking_Snakehair_Evidence_Ledger.xlsx",
    "02_MEDUSA_GORGONWARS/gorgonwars-conversation-source-ledger-2026-07-27.txt",
    "03_METOO_DISSENT/metoo_foundational_dissent_research_audit_2026-07-27.xlsx",
    "03_METOO_DISSENT/metoo_foundational_dissent_full_archive_2026-07-28.xlsx",
    "04_POLYMYTH_COMMONS/polymyth-commons-book-backbone.xlsx",
    "05_POLYMYTHCAL/Polymythcal_Research_and_Remediation_Plan.json",
    "06_OTHER_ONGOING_RESEARCH/israeli_official_rhetoric_chronology_editable_v4.docx",
    "07_POLYMYTH_COHERENCE/Polymyth_Coherence_Assessment_Instrument.xlsx",
    "07_POLYMYTH_COHERENCE/Polymyth_Coherence_Worked_Applications.xlsx",
})

def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def verify_editable_masters(editable_root: Path) -> int:
    editable_root = Path(editable_root).resolve()
    manifest_path = editable_root / "EDITABLE_MASTERS_MANIFEST.json"
    sums_path = editable_root / "SHA256SUMS.txt"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    rows = manifest.get("files") or []
    if manifest.get("file_count") != len(rows):
        raise ValueError("Editable-masters manifest file_count does not match its rows.")
    sums: dict[str, str] = {}
    for line in sums_path.read_text(encoding="utf-8").splitlines():
        expected, relative = line.split(None, 1)
        sums[relative.strip()] = expected
    row_paths = {str(row.get("path") or "") for row in rows}
    if manifest.get("file_count") != 10 or row_paths != EXPECTED_EDITABLE_MASTER_PATHS:
        raise ValueError("Editable-masters manifest must retain the exact ten canonical masters.")
    if row_paths != set(sums):
        raise ValueError("Editable-masters JSON manifest and SHA256SUMS path sets disagree.")
    for row in rows:
        relative = str(row["path"])
        file = editable_root / relative
        if not file.is_file():
            raise ValueError(f"Editable master is missing: {relative}")
        actual_hash = sha256(file)
        if file.stat().st_size != int(row["bytes"]):
            raise ValueError(f"Editable master size mismatch: {relative}")
        if actual_hash != row["sha256"] or actual_hash != sums[relative]:
            raise ValueError(f"Editable master SHA-256 mismatch: {relative}")
    return len(EXPECTED_EDITABLE_MASTER_PATHS)
