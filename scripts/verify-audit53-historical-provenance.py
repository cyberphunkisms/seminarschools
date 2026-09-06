#!/usr/bin/env python3
"""Validate the frozen Audit53/Aug15 ledger as historical provenance only."""
from __future__ import annotations

import hashlib
import json
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BASELINE = ROOT / "scripts" / "reports" / "audit52-package-baseline.json"
LEDGER = ROOT / "data" / "futureproofing" / "approved-change-deletion-ledger.json"
BASELINE_SHA256 = "2fb4eacc283865625368275b737308cde72701a92b0f4f8790881b214374722d"
ROWS_SHA256 = "c040e85a1bcf9afadbee41f8ef68782d4cd9ba4286e6a09a4d41b6f9746ae37a"
PATHS_SHA256 = "4ba9f4b1b584ca01b61e14336ef4ca6995952da2573eda65671d027ee34c335d"
TRANSITION_ID = "audit52-to-current-successor-release-2026-08-15-polymythcal-sets1-15-sitewide-fixes-synthesized-final"
PREVIOUS_TRANSITION = {
    "transition_id": "audit52-to-current-successor-release-2026-08-14-sitewide-canonical-indra-teacherresources-home-stability-final",
    "modified_count": 7979,
    "modified_paths_sha256": "bb7bfec3ce4ec4fe18ace502bbc4730d567f34f4672783953d7cdddd1af4ddfd",
    "raw_content_hashed_count": 7977,
    "generated_evidence_content_exclusion_count": 2,
    "modified_content_policy_sha256": "f46d091e9760f80a0b88416d93837648d708d7174d85ccbf44f210275e8c575a",
}


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def aggregate(lines: list[str]) -> str:
    value = hashlib.sha256()
    for line in sorted(lines):
        value.update(line.encode("utf-8"))
    return value.hexdigest()


def rows_digest(rows: list[dict]) -> str:
    payload = json.dumps(rows, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def category(relative: str) -> str:
    if relative.startswith("polymythseminars/ics/"):
        return "source_event_ics"
    if relative.startswith("polymythseminars/feeds/"):
        return "source_feeds"
    if relative.startswith("public/polymythseminars/ics/"):
        return "public_event_ics"
    if relative.startswith("public/polymythseminars/feeds/"):
        return "public_feeds"
    return "named"


def validate_historical_provenance() -> dict:
    assert digest(BASELINE) == BASELINE_SHA256, "Audit52 historical baseline drifted"
    baseline = json.loads(BASELINE.read_text(encoding="utf-8"))
    baseline_by_path = {row["path"]: row for row in baseline["files"]}
    ledger = json.loads(LEDGER.read_text(encoding="utf-8"))
    assert ledger.get("schema") == "seminar-schools-approved-change-deletion-ledger-v3"
    assert ledger.get("baseline") == {
        "path": "scripts/reports/audit52-package-baseline.json",
        "sha256": BASELINE_SHA256,
    }
    for row in ledger.get("approved_deletions") or []:
        before = baseline_by_path.get(row.get("path"))
        assert before is not None and row.get("before_sha256") == before["sha256"]
        assert row.get("before_bytes") == before["bytes"]
        assert row.get("approval") == "approved_by_repository_policy"

    transition = ledger.get("approved_transition") or {}
    assert transition.get("transition_id") == TRANSITION_ID
    assert transition.get("approval") == "approved_by_successor_release_policy"
    assert transition.get("previous_transition") == PREVIOUS_TRANSITION
    assert transition.get("modified_count") == 8455
    assert transition.get("modified_paths_sha256") == "f1f976d87f20b2d4b1cbe6a94ad82d36a1f2d3df9ea734838137c1bd90a6064a"
    assert transition.get("raw_content_hashed_count") == 8453
    assert transition.get("generated_evidence_content_exclusion_count") == 2
    assert transition.get("modified_content_policy_sha256") == "2877aa0d686f5db2b5f07de9991850bd83c5a11c742a6bf2c59f7d2410e8fece"
    rows = transition.get("approved_successor_additions") or []
    assert len(rows) == 476
    assert rows_digest(rows) == ROWS_SHA256
    assert aggregate([f"{row['path']}\n" for row in rows]) == PATHS_SHA256
    assert Counter(category(row["path"]) for row in rows) == Counter({
        "source_event_ics": 226,
        "source_feeds": 3,
        "public_event_ics": 226,
        "public_feeds": 3,
        "named": 18,
    })
    for index, row in enumerate(rows, 1):
        before = baseline_by_path.get(row["path"])
        assert before is not None
        assert row.get("before_sha256") == before["sha256"]
        assert row.get("before_bytes") == before["bytes"]
        assert row.get("decision_id") == f"FP-02-2026-08-15-{index:03d}"
        assert row.get("approval") == "approved_by_successor_release_policy"
        assert len(str(row.get("after_sha256") or "")) == 64
        assert isinstance(row.get("after_bytes"), int) and row["after_bytes"] >= 0
        assert row.get("classification") and row.get("reason") and row.get("semantic_gate")
    return {"approved_deletions": len(ledger["approved_deletions"]), "successor_additions": len(rows)}


def main() -> None:
    result = validate_historical_provenance()
    print(
        "AUDIT53 HISTORICAL PROVENANCE PASSED — immutable Aug15 ledger retained; "
        f"{result['successor_additions']} reviewed additions and "
        f"{result['approved_deletions']} repository deletions internally authenticated."
    )


if __name__ == "__main__":
    main()
