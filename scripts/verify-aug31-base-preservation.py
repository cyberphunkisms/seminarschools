#!/usr/bin/env python3
"""Verify the exact August 30 to August 31 SITE_PACKAGE transition.

The frozen predecessor is the complete package manifest embedded beside this
site tree.  This control deliberately narrows that complete manifest to its
SITE_PACKAGE rows and excludes only the inner package manifest, whose bytes
are regenerated after source verification.  Every other predecessor path is
partitioned as unchanged, exactly modified, policy-governed, or one of four
explicitly authorized public deletions.  Every successor-only path is also
bound exactly, except this contract's unavoidable self-reference.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

from package_selection import collect_package_files


SITE_ROOT = Path(__file__).resolve().parents[1]
DELIVERY_ROOT = SITE_ROOT.parent
BASELINE = SITE_ROOT / "data" / "futureproofing" / "aug30-package-contents-baseline.json"
CONTRACT = SITE_ROOT / "data" / "futureproofing" / "aug30-aug31-preservation-contract.json"

BASELINE_SHA256 = "42f2ab9667f2d74726eca346d6dd68c63ba15771b2f4eef60582fbe2ca323fd2"
PREDECESSOR_RELEASE_ID = "core-coreplus-mephistodata-activation-register-hardening-complete-2026-08-30"
PREDECESSOR_GENERATED_AT = "2026-08-30T12:00:00Z"
PREDECESSOR_FILE_COUNT = 21171
PREDECESSOR_TOTAL_BYTES = 542265582
GOVERNED_PREDECESSOR_COUNT = 21149
TRANSITION_ID = "aug30-to-aug31-mephistodata-activation-enforcement"
CONTRACT_SCHEMA = "seminar-schools-aug30-aug31-preservation-v1"
CONTENT_POLICY_VERSION = "aug30-aug31-fixed-point-policy-v1"
SITE_PREFIX = "SITE_PACKAGE/"
EXCLUDED_PREDECESSOR_PATH = "PACKAGE_CONTENTS_SHA256.json"
CONTRACT_RULE = (
    "Every governed August 30 SITE_PACKAGE path remains byte-identical unless its "
    "exact before/after hashes appear here; only four exact public research copies "
    "may be deleted; generated report fixed points use closed policy tokens; the "
    "Polymythcal event corpus remains byte-identical."
)

AUTHORIZED_PUBLIC_DELETIONS = (
    "public/polymyth/research/metoo-foundational-dissent-full-archive-2026-07-28.xlsx",
    "public/polymyth/research/metoo-foundational-dissent-full-archive-2026-07-28.xlsx.sha256",
    "public/polymyth/research/metoo-foundational-dissent-research-audit-2026-07-27.xlsx",
    "public/polymyth/research/metoo-foundational-dissent-research-audit-2026-07-27.xlsx.sha256",
)

EVENT_DATA_PATHS = (
    "data/polymyth-seminar-events.json",
    "polymythseminars/events.json",
    "data/polymythcal-publication-surfaces.json",
    "polymythseminars/browse.json",
    "polymythseminars/watchlist.json",
    "polymythseminars/research.json",
)

# These generated outputs are written during the build and verification chain.
# RELEASE_MANIFEST.json hashes this new contract and therefore cannot also be
# raw-hashed by the contract without creating a cryptographic fixed point.
# Their paths and writers are closed here; their final bytes remain package-
# manifest, clean-room, recovery, and receipt bound.  The new contract has the
# same unavoidable self-reference.
POLICY_ROWS = (
    {
        "path": "RELEASE_MANIFEST.json",
        "classification": "predecessor_release_manifest_fixed_point",
        "writer": "reviewed release manifest update plus canonical package pipeline",
        "semantic_gate": "node scripts/verify-release-gates.js plus final artifact receipt verification",
    },
    {
        "path": "scripts/reports/audit49-build-packaging-efficiency.json",
        "classification": "predecessor_generated_report",
        "writer": "scripts/verify-audit49-build-packaging-efficiency.js",
        "semantic_gate": "node scripts/verify-audit49-build-packaging-efficiency.js",
    },
    {
        "path": "scripts/reports/audit49-technical-efficiency.json",
        "classification": "predecessor_generated_report",
        "writer": "scripts/verify-audit49-technical-efficiency.js",
        "semantic_gate": "node scripts/verify-audit49-technical-efficiency.js",
    },
    {
        "path": "WEBSITE_AUDIT49_TECHNICAL_EFFICIENCY_RESILIENCE_REPORT_2026-07-26.md",
        "classification": "predecessor_generated_report",
        "writer": "scripts/verify-audit49-technical-efficiency.js",
        "semantic_gate": "node scripts/verify-audit49-technical-efficiency.js",
    },
    {
        "path": "scripts/reports/futureproofing-browser-family-report.json",
        "classification": "predecessor_generated_report",
        "writer": "scripts/run-browser-test-tier.mjs --tier family",
        "semantic_gate": "node scripts/run-browser-test-tier.mjs --tier family plus final artifact receipt verification",
    },
    {
        "path": "scripts/reports/release-gate-report.json",
        "classification": "predecessor_generated_report",
        "writer": "scripts/verify-all-runner.js",
        "semantic_gate": "scripts/verify-all-runner.js plus final artifact receipt verification",
    },
    {
        "path": "scripts/reports/futureproofing-gate-report.json",
        "classification": "predecessor_generated_report",
        "writer": "scripts/verify-futureproofing-contract.py",
        "semantic_gate": (
            "python3 scripts/verify-futureproofing-contract.py --run-source "
            "plus final artifact receipt verification"
        ),
    },
    {
        "path": "data/futureproofing/aug30-aug31-preservation-contract.json",
        "classification": "successor_contract_self_reference",
        "writer": "reviewed August 30 to August 31 transition seal",
        "semantic_gate": "python3 scripts/verify-aug31-base-preservation.py",
    },
)
POLICY_BY_PATH = {row["path"]: row for row in POLICY_ROWS}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def canonical_sha256(value: Any) -> str:
    encoded = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def aggregate(lines: list[str]) -> str:
    digest = hashlib.sha256()
    for line in sorted(lines):
        digest.update(line.encode("utf-8"))
    return digest.hexdigest()


def exact(path: str, file_path: Path) -> dict[str, Any]:
    return {
        "path": path,
        "bytes": file_path.stat().st_size,
        "sha256": sha256(file_path),
    }


def policy_binding(path: str) -> dict[str, str]:
    row = POLICY_BY_PATH[path]
    token = "\0".join(
        (
            CONTENT_POLICY_VERSION,
            row["path"],
            row["classification"],
            row["writer"],
            row["semantic_gate"],
        )
    )
    return {
        "binding": "versioned_semantic_policy",
        "policy_sha256": hashlib.sha256(token.encode("utf-8")).hexdigest(),
    }


def validate_policy_file(path: str, file_path: Path) -> None:
    if path == "RELEASE_MANIFEST.json":
        try:
            document = json.loads(file_path.read_text(encoding="utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise AssertionError("policy-governed release manifest is not valid JSON") from error
        assert isinstance(document, dict)
        assert isinstance(document.get("release_id"), str) and document["release_id"]
        assert isinstance(document.get("generated_at"), str) and document["generated_at"]
        return
    if not path.startswith("scripts/reports/"):
        return
    try:
        document = json.loads(file_path.read_text(encoding="utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise AssertionError(f"policy-governed report is not valid JSON: {path}") from error
    assert isinstance(document, dict), f"policy-governed report is not an object: {path}"
    if path.endswith("futureproofing-browser-family-report.json"):
        assert document.get("schema") == "seminar-schools-browser-tier-report-v1"
        assert document.get("contract_id") == "FP-08"
        assert document.get("tier") == "family"
        assert document.get("failures") == []
        assert document.get("selected") == len(document.get("results") or []) == 45
        return
    assert document.get("status") in {"passed", "failed"}, (
        f"policy-governed report has no recognized status: {path}"
    )
    if path.endswith("futureproofing-gate-report.json"):
        assert document.get("schema") == "seminar-schools-futureproofing-gate-report-v1"
    elif path.endswith("audit49-build-packaging-efficiency.json"):
        assert isinstance(document.get("metrics"), dict)
        assert isinstance(document.get("invariants"), dict)
    elif path.endswith("release-gate-report.json"):
        assert isinstance(document.get("total_checks"), int)
        assert isinstance(document.get("failed_checks"), list)


def baseline_document() -> dict[str, Any]:
    assert sha256(BASELINE) == BASELINE_SHA256, "August 30 package manifest hash drifted"
    document = json.loads(BASELINE.read_text(encoding="utf-8"))
    assert document.get("schema") == "seminar-schools-package-contents-v1"
    assert document.get("package_kind") == (
        "seminar-schools-complete-editable-masters-source-and-public"
    )
    assert document.get("release_id") == PREDECESSOR_RELEASE_ID
    assert document.get("generated_at") == PREDECESSOR_GENERATED_AT
    assert document.get("file_count") == len(document.get("files") or []) == PREDECESSOR_FILE_COUNT
    assert document.get("total_uncompressed_bytes") == PREDECESSOR_TOTAL_BYTES
    return document


def governed_baseline(document: dict[str, Any]) -> tuple[dict[str, dict[str, Any]], dict[str, Any]]:
    rows: dict[str, dict[str, Any]] = {}
    excluded: dict[str, Any] | None = None
    for source in document["files"]:
        full_path = source["path"]
        if not full_path.startswith(SITE_PREFIX):
            continue
        relative = full_path[len(SITE_PREFIX):]
        if relative == EXCLUDED_PREDECESSOR_PATH:
            assert excluded is None, "duplicate inner package manifest in predecessor"
            excluded = {
                "path": relative,
                "bytes": source["bytes"],
                "sha256": source["sha256"],
                "reason": "regenerated after source verification and bound by final package integrity",
            }
            continue
        assert relative not in rows, f"duplicate predecessor path: {relative}"
        rows[relative] = source
    assert excluded is not None, "predecessor inner package manifest boundary is missing"
    assert len(rows) == GOVERNED_PREDECESSOR_COUNT
    return rows, excluded


def summarize_exact(rows: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "count": len(rows),
        "bytes": sum(int(row["bytes"]) for row in rows),
        "paths_sha256": aggregate([f"{row['path']}\n" for row in rows]),
        "content_sha256": aggregate(
            [f"{row['path']}\0{row['bytes']}\0{row['sha256']}\n" for row in rows]
        ),
    }


def observed_transition() -> dict[str, Any]:
    baseline = baseline_document()
    baseline_by_path, excluded = governed_baseline(baseline)
    current_files, selection_stats = collect_package_files(
        SITE_ROOT,
        DELIVERY_ROOT / ".aug31-preservation-probe.zip",
        excluded_top_level={"qa"},
    )
    current_by_path = {
        path.relative_to(SITE_ROOT).as_posix(): path
        for path in current_files
    }
    assert len(current_by_path) == len(current_files), "duplicate current selected path"
    assert EXCLUDED_PREDECESSOR_PATH not in current_by_path, (
        "self-updating inner package manifest entered the source-transition selection"
    )

    unchanged: list[dict[str, Any]] = []
    modified: list[dict[str, Any]] = []
    modified_policy: list[dict[str, Any]] = []
    deleted: list[dict[str, Any]] = []

    for relative, before in sorted(baseline_by_path.items()):
        current = current_by_path.get(relative)
        policy = POLICY_BY_PATH.get(relative)
        before_exact = {
            "bytes": before["bytes"],
            "sha256": before["sha256"],
        }
        if current is None:
            deleted.append({"path": relative, "before": before_exact})
            continue
        if policy and policy["classification"].startswith("predecessor_"):
            validate_policy_file(relative, current)
            modified_policy.append(
                {
                    "path": relative,
                    "before": before_exact,
                    "after": policy_binding(relative),
                }
            )
            continue
        after = exact(relative, current)
        if after["sha256"] == before["sha256"] and after["bytes"] == before["bytes"]:
            unchanged.append(after)
        else:
            modified.append(
                {
                    "path": relative,
                    "before": before_exact,
                    "after": {"bytes": after["bytes"], "sha256": after["sha256"]},
                }
            )

    added: list[dict[str, Any]] = []
    added_policy: list[dict[str, Any]] = []
    for relative in sorted(set(current_by_path) - set(baseline_by_path)):
        policy = POLICY_BY_PATH.get(relative)
        if policy and policy["classification"] == "successor_contract_self_reference":
            added_policy.append({"path": relative, "after": policy_binding(relative)})
        else:
            added.append(exact(relative, current_by_path[relative]))

    assert [row["path"] for row in deleted] == list(AUTHORIZED_PUBLIC_DELETIONS), (
        "predecessor deletion set differs from the four authorized public/private corrections"
    )
    assert len(unchanged) + len(modified) + len(modified_policy) + len(deleted) == len(
        baseline_by_path
    )
    assert len(unchanged) + len(modified) + len(modified_policy) + len(added) + len(
        added_policy
    ) == len(current_by_path)

    event_data = []
    for relative in EVENT_DATA_PATHS:
        before = baseline_by_path.get(relative)
        current = current_by_path.get(relative)
        assert before is not None and current is not None, f"event-data boundary missing: {relative}"
        current_exact = exact(relative, current)
        event_data.append(
            {
                **current_exact,
                "unchanged_from_aug30": (
                    current_exact["bytes"] == before["bytes"]
                    and current_exact["sha256"] == before["sha256"]
                ),
            }
        )

    changed_path_rows = [
        *(f"modified\0{row['path']}\n" for row in modified),
        *(f"modified_policy\0{row['path']}\n" for row in modified_policy),
        *(f"added\0{row['path']}\n" for row in added),
        *(f"added_policy\0{row['path']}\n" for row in added_policy),
        *(f"deleted\0{row['path']}\n" for row in deleted),
    ]
    return {
        "transition_id": TRANSITION_ID,
        "baseline_manifest": {
            "path": "data/futureproofing/aug30-package-contents-baseline.json",
            "sha256": BASELINE_SHA256,
            "release_id": PREDECESSOR_RELEASE_ID,
            "full_package_file_count": PREDECESSOR_FILE_COUNT,
            "governed_site_predecessor_count": len(baseline_by_path),
            "excluded_predecessor": excluded,
        },
        "current_selected_count": len(current_by_path),
        "changed_paths_sha256": aggregate(changed_path_rows),
        "unchanged": summarize_exact(unchanged),
        "modified": modified,
        "modified_policy": modified_policy,
        "added": added,
        "added_policy": added_policy,
        "deleted": deleted,
        "event_data": event_data,
        "policy_rows": list(POLICY_ROWS),
        "selection_stats": {
            "files_selected": selection_stats["files_selected"],
            "polymythcal_artifacts_pruned": selection_stats["polymythcal_artifacts_pruned"],
            "reconstruction_duplicates_pruned": selection_stats[
                "reconstruction_duplicates_pruned"
            ],
        },
    }


def contract_document(observed: dict[str, Any]) -> dict[str, Any]:
    return {
        "schema": CONTRACT_SCHEMA,
        "contract_version": "2026-08-31.1",
        "status": "sealed",
        "transition_id": TRANSITION_ID,
        "predecessor_release_id": PREDECESSOR_RELEASE_ID,
        "baseline_manifest_sha256": BASELINE_SHA256,
        "rule": CONTRACT_RULE,
        "authorized_public_deletions": list(AUTHORIZED_PUBLIC_DELETIONS),
        "expected_transition": observed,
    }


def validate_expected(observed: dict[str, Any], contract: dict[str, Any]) -> None:
    assert set(contract) == {
        "schema",
        "contract_version",
        "status",
        "transition_id",
        "predecessor_release_id",
        "baseline_manifest_sha256",
        "rule",
        "authorized_public_deletions",
        "expected_transition",
    }, "August 30 to August 31 contract has unrecognized or missing fields"
    assert contract.get("schema") == CONTRACT_SCHEMA
    assert contract.get("contract_version") == "2026-08-31.1"
    assert contract.get("status") == "sealed", "August 31 preservation contract is unsealed"
    assert contract.get("transition_id") == TRANSITION_ID
    assert contract.get("predecessor_release_id") == PREDECESSOR_RELEASE_ID
    assert contract.get("baseline_manifest_sha256") == BASELINE_SHA256
    assert contract.get("rule") == CONTRACT_RULE
    assert contract.get("authorized_public_deletions") == list(AUTHORIZED_PUBLIC_DELETIONS)
    expected = contract.get("expected_transition")
    assert isinstance(expected, dict), "August 31 preservation transition is absent"
    assert observed == expected, "August 30 to August 31 exact preservation transition drifted"
    assert [row["path"] for row in observed["deleted"]] == list(AUTHORIZED_PUBLIC_DELETIONS)
    assert all(row["unchanged_from_aug30"] for row in observed["event_data"]), (
        "Polymythcal event corpus or safe public projections changed from August 30"
    )
    assert all("before" in row and "after" in row for row in observed["modified"])
    assert all(
        set(row["before"]) == {"bytes", "sha256"}
        and set(row["after"]) == {"bytes", "sha256"}
        for row in observed["modified"]
    ), "an ordinary predecessor modification lacks exact before/after hashes"
    assert all(set(row) == {"path", "bytes", "sha256"} for row in observed["added"]), (
        "an ordinary successor addition lacks an exact content hash"
    )
    assert observed["added_policy"] == [
        {
            "path": "data/futureproofing/aug30-aug31-preservation-contract.json",
            "after": policy_binding(
                "data/futureproofing/aug30-aug31-preservation-contract.json"
            ),
        }
    ], "the contract self-reference is the only permitted policy-bound addition"


def write_contract(observed: dict[str, Any]) -> None:
    CONTRACT.write_text(
        json.dumps(contract_document(observed), ensure_ascii=False, sort_keys=True, indent=2) + "\n",
        encoding="utf-8",
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--print-observed", action="store_true")
    parser.add_argument("--seal", action="store_true")
    parser.add_argument("--contract", type=Path, default=CONTRACT)
    args = parser.parse_args()
    observed = observed_transition()
    if args.print_observed:
        print(json.dumps(observed, ensure_ascii=False, sort_keys=True, indent=2))
        return
    if args.seal:
        if args.contract.resolve() != CONTRACT.resolve():
            raise SystemExit("--seal writes only the canonical August 31 preservation contract")
        write_contract(observed)
        print(
            "AUG30→AUG31 PRESERVATION SEALED — "
            f"{observed['baseline_manifest']['governed_site_predecessor_count']} predecessor "
            "files bound to the current quiescent tree."
        )
        return
    contract = json.loads(args.contract.read_text(encoding="utf-8"))
    validate_expected(observed, contract)
    modified_count = len(observed["modified"]) + len(observed["modified_policy"])
    added_count = len(observed["added"]) + len(observed["added_policy"])
    print(
        "AUG30→AUG31 PRESERVATION PASSED — "
        f"{observed['baseline_manifest']['governed_site_predecessor_count']} predecessor files; "
        f"{observed['unchanged']['count']} unchanged; "
        f"{modified_count} exact or fixed-point-governed modifications; "
        f"{added_count} exact or self-bound additions; "
        "four authorized public deletions; event corpus byte-identical."
    )


if __name__ == "__main__":
    main()
