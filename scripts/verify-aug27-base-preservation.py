#!/usr/bin/env python3
"""Verify the August 27 release against the exact August 26 input package.

Audit 53 remains historical evidence.  This current-release control instead
uses the complete manifest embedded in the supplied August 26 ZIP, partitions
every selected file as unchanged/modified/added/deleted, and binds the exact
path and content-policy digests for the approved August 27 transition.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from package_selection import collect_package_files


ROOT = Path(__file__).resolve().parents[1]
BASELINE = ROOT / "data" / "futureproofing" / "aug26-package-contents-baseline.json"
CONTRACT = ROOT / "data" / "futureproofing" / "aug26-aug27-preservation-contract.json"
BASELINE_SHA256 = "18305c5dae0a951ce7486737cf3914eae16d986900fbaf6c3681956402c4d1c1"
INPUT_ARCHIVE_SHA256 = "2212b569d13a19842cb67b890e1d3cc432cd44d345c6dc03139784327aaacd21"
PREDECESSOR_RELEASE_ID = "core-coreplus-mephistodata-controlled-archive-polymythcal-v2-2026-08-26"
CURRENT_TRANSITION_ID = "aug26-to-aug27-rainbow-geometry-star-exclusion"
CONTENT_POLICY_VERSION = "aug26-aug27-generated-evidence-policy-v1"

# These paths are selected and packaged, but cannot include their own live
# hashes in the code-owned fixed point.  The final package manifest and audit
# receipt bind their bytes; exact policy tokens keep them in every path/count
# assertion here.
CONTENT_POLICY_ROWS = (
    {
        "path": "data/futureproofing/aug26-aug27-preservation-contract.json",
        "writer": "reviewed release transition",
        "semantic_gate": "python3 scripts/verify-aug27-base-preservation.py",
    },
    {
        "path": "scripts/verify-aug27-base-preservation.py",
        "writer": "reviewed release transition",
        "semantic_gate": "python3 scripts/verify-aug27-base-preservation.py",
    },
    {
        "path": "scripts/reports/audit49-build-packaging-efficiency.json",
        "writer": "scripts/verify-audit49-build-packaging-efficiency.js",
        "semantic_gate": "node scripts/verify-audit49-build-packaging-efficiency.js",
    },
    {
        "path": "scripts/reports/release-gate-report.json",
        "writer": "scripts/verify-all-runner.js",
        "semantic_gate": "scripts/verify-all-runner.js plus final artifact receipt verification",
    },
    {
        "path": "scripts/reports/futureproofing-gate-report.json",
        "writer": "scripts/verify-futureproofing-contract.py",
        "semantic_gate": (
            "python3 scripts/verify-futureproofing-contract.py --run-source "
            "plus final artifact receipt verification"
        ),
    },
)
CONTENT_POLICY_BY_PATH = {row["path"]: row for row in CONTENT_POLICY_ROWS}

EVENT_DATA_PATHS = (
    "data/polymyth-seminar-events.json",
    "polymythseminars/events.json",
    "data/polymythcal-publication-surfaces.json",
    "polymythseminars/browse.json",
    "polymythseminars/watchlist.json",
    "polymythseminars/research.json",
)

# Populated only after the canonical tree is quiescent.  The JSON contract's
# canonical serialization must match this code-owned digest, so neither code
# nor data can silently broaden the approved transition.
CODE_OWNED_EXPECTED_SHA256 = "6bd0e036bead8224f858d4614aabd16c999dbfc8afd4e8bc4720bf3082a920ec"


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


def policy_content_digest(rows: list[tuple[str, str]]) -> str:
    lines: list[str] = []
    for relative, current_sha in rows:
        policy = CONTENT_POLICY_BY_PATH.get(relative)
        if policy is None:
            lines.append(f"{relative}\0{current_sha}\n")
            continue
        token = "\0".join(
            (
                CONTENT_POLICY_VERSION,
                relative,
                policy["writer"],
                policy["semantic_gate"],
            )
        )
        lines.append(f"{relative}\0POLICY\0{token}\n")
    return aggregate(lines)


def summarize(rows: list[tuple[str, str, int]]) -> dict:
    content_rows = [(relative, current_sha) for relative, current_sha, _ in rows]
    policy_count = sum(relative in CONTENT_POLICY_BY_PATH for relative, _, _ in rows)
    return {
        "count": len(rows),
        # A policy-token row cannot bind its own live byte length any more than
        # it can bind its own hash: editing the reviewed contract/verifier would
        # otherwise move this fixed point.  All ordinary content bytes remain
        # exact here; final package integrity binds every selected file byte.
        "raw_content_bytes": sum(
            byte_count
            for relative, _, byte_count in rows
            if relative not in CONTENT_POLICY_BY_PATH
        ),
        "paths_sha256": aggregate([f"{relative}\n" for relative, _, _ in rows]),
        "content_policy_sha256": policy_content_digest(content_rows),
        "raw_content_hashed_count": len(rows) - policy_count,
        "policy_token_count": policy_count,
    }


def observed_transition() -> dict:
    assert sha256(BASELINE) == BASELINE_SHA256, "August 26 frozen manifest hash drifted"
    baseline = json.loads(BASELINE.read_text(encoding="utf-8"))
    assert baseline.get("schema") == "seminar-schools-package-contents-v1"
    assert baseline.get("package_kind") == "seminar-schools-complete-editable-site-source"
    assert baseline.get("release_id") == PREDECESSOR_RELEASE_ID
    assert baseline.get("file_count") == len(baseline.get("files") or []) == 21111
    assert baseline.get("total_uncompressed_bytes") == 491732554

    baseline_by_path = {row["path"]: row for row in baseline["files"]}
    assert len(baseline_by_path) == len(baseline["files"]), "duplicate August 26 manifest path"
    current_files, _ = collect_package_files(
        ROOT,
        ROOT.parent / ".aug27-preservation-probe.zip",
        excluded_top_level={"qa"},
    )
    current_by_path = {path.relative_to(ROOT).as_posix(): path for path in current_files}
    assert len(current_by_path) == len(current_files), "duplicate current selected path"
    assert "PACKAGE_CONTENTS_SHA256.json" not in current_by_path, (
        "self-updating package manifest entered the source-transition selection"
    )

    deleted: list[tuple[str, str, int]] = []
    modified: list[tuple[str, str, int]] = []
    unchanged: list[tuple[str, str, int]] = []
    for relative, before in baseline_by_path.items():
        current = current_by_path.get(relative)
        if current is None:
            deleted.append((relative, before["sha256"], before["bytes"]))
            continue
        current_sha = sha256(current)
        row = (relative, current_sha, current.stat().st_size)
        # A baseline policy row is always placed in the governed-modified
        # bucket, even when its current bytes happen to equal the predecessor.
        # That keeps the partition stable when its declared writer runs after
        # this gate (notably the futureproofing runner's own final report).
        if current_sha == before["sha256"] and relative not in CONTENT_POLICY_BY_PATH:
            unchanged.append(row)
        else:
            modified.append(row)

    added = [
        (relative, sha256(current), current.stat().st_size)
        for relative, current in current_by_path.items()
        if relative not in baseline_by_path
    ]
    modified_geometry_html = [row for row in modified if row[0].endswith(".html")]
    modified_generated_or_governed = [row for row in modified if not row[0].endswith(".html")]
    current_rows = [
        (relative, sha256(current), current.stat().st_size)
        for relative, current in current_by_path.items()
    ]

    event_data = []
    for relative in EVENT_DATA_PATHS:
        before = baseline_by_path.get(relative)
        current = current_by_path.get(relative)
        assert before is not None and current is not None, f"event-data boundary missing: {relative}"
        current_sha = sha256(current)
        event_data.append(
            {
                "path": relative,
                "bytes": current.stat().st_size,
                "sha256": current_sha,
                "unchanged_from_aug26": (
                    current_sha == before["sha256"] and current.stat().st_size == before["bytes"]
                ),
            }
        )

    changed_path_rows = [
        *(f"modified\0{relative}\n" for relative, _, _ in modified),
        *(f"added\0{relative}\n" for relative, _, _ in added),
        *(f"deleted\0{relative}\n" for relative, _, _ in deleted),
    ]
    return {
        "transition_id": CURRENT_TRANSITION_ID,
        "input_archive_sha256": INPUT_ARCHIVE_SHA256,
        "baseline_manifest_sha256": BASELINE_SHA256,
        "baseline_file_count": len(baseline_by_path),
        "current_file_count": len(current_by_path),
        "changed_paths_sha256": aggregate(changed_path_rows),
        "unchanged": summarize(unchanged),
        "modified_geometry_html": summarize(modified_geometry_html),
        "modified_generated_or_governed": summarize(modified_generated_or_governed),
        "added": {
            **summarize(added),
            "paths": sorted(relative for relative, _, _ in added),
        },
        "deleted": {
            **summarize(deleted),
            "paths": sorted(relative for relative, _, _ in deleted),
        },
        "current_selected": summarize(current_rows),
        "content_policy_rows": list(CONTENT_POLICY_ROWS),
        "event_data": event_data,
        "post_package_manifest_boundary": {
            "path": "PACKAGE_CONTENTS_SHA256.json",
            "selected_by_source_transition": False,
            "writer": "scripts/package_integrity.py via scripts/package-front-facing-mephistodata-release.py",
            "verification": "embedded/external manifest equality plus final artifact receipt",
        },
    }


def validate_expected(observed: dict, contract: dict) -> None:
    assert contract.get("schema") == "seminar-schools-aug26-aug27-preservation-v1"
    assert contract.get("historical_audit53_status") == "historical_provenance_only"
    expected = contract.get("expected_transition")
    encoded = json.dumps(expected, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    assert hashlib.sha256(encoded.encode("utf-8")).hexdigest() == CODE_OWNED_EXPECTED_SHA256, (
        "preservation contract differs from code-owned transition digest"
    )
    assert observed == expected, "August 26 to August 27 exact preservation transition drifted"
    assert all(row["unchanged_from_aug26"] for row in observed["event_data"]), (
        "Polymythcal event corpus or safe public projections changed from August 26"
    )
    assert observed["deleted"]["count"] == 0, "August 27 release deleted an August 26 package file"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--print-observed", action="store_true")
    args = parser.parse_args()
    observed = observed_transition()
    if args.print_observed:
        print(json.dumps(observed, ensure_ascii=False, sort_keys=True, indent=2))
        return
    contract = json.loads(CONTRACT.read_text(encoding="utf-8"))
    validate_expected(observed, contract)
    print(
        "AUG26→AUG27 PRESERVATION PASSED — "
        f"{observed['baseline_file_count']} predecessor files governed; "
        f"{observed['unchanged']['count']} unchanged; "
        f"{observed['modified_geometry_html']['count']} geometry HTML changes; "
        f"{observed['modified_generated_or_governed']['count']} exact generated/governed changes; "
        f"{observed['added']['count']} additions; zero deletions; event corpus byte-identical."
    )


if __name__ == "__main__":
    main()
