#!/usr/bin/env python3
"""Verify the exact September 3 to September 5 SITE_PACKAGE transition.

The frozen predecessor is the complete package manifest embedded beside this
site tree. This control binds its outer delivery rows and its SITE_PACKAGE
rows, while excluding only the inner package manifest, whose bytes are
regenerated after source verification. Every other predecessor path is
partitioned as unchanged, exactly modified, or policy-governed. No deletion is
authorized. Every successor-only path is also bound exactly, except this
contract's unavoidable self-reference.
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
BASELINE = SITE_ROOT / "data" / "futureproofing" / "sep3-package-contents-baseline.json"
CONTRACT = SITE_ROOT / "data" / "futureproofing" / "sep3-sep5-preservation-contract.json"

BASELINE_SHA256 = "61284f8a2d095599d502c350bc8f8cb12c50776327b86be95783f4dd55aa5a13"
PREDECESSOR_RELEASE_ID = "core-coreplus-mephistodata-bottom-up-definition-enforcement-complete-2026-09-03"
PREDECESSOR_GENERATED_AT = "2026-09-03T18:00:00Z"
PREDECESSOR_FILE_COUNT = 21193
PREDECESSOR_TOTAL_BYTES = 555115844
GOVERNED_PREDECESSOR_COUNT = 21170
OUTER_PREDECESSOR_COUNT = 22
TRANSITION_ID = "sep3-to-sep5-truthful-completion-enforcement"
CONTRACT_SCHEMA = "seminar-schools-sep3-sep5-preservation-v1"
CONTENT_POLICY_VERSION = "sep3-sep5-fixed-point-policy-v1"
SITE_PREFIX = "SITE_PACKAGE/"
EXCLUDED_PREDECESSOR_PATH = "PACKAGE_CONTENTS_SHA256.json"
CONTRACT_RULE = (
    "Every governed September 3 SITE_PACKAGE and outer delivery path remains "
    "byte-identical unless its "
    "exact before/after hashes appear here; no predecessor path may be deleted; "
    "generated report fixed points use closed policy tokens; the "
    "Polymythcal event corpus remains byte-identical."
)

AUTHORIZED_PUBLIC_DELETIONS: tuple[str, ...] = ()

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
        "path": "data/futureproofing/sep3-sep5-preservation-contract.json",
        "classification": "successor_contract_self_reference",
        "writer": "reviewed September 3 to September 5 transition seal",
        "semantic_gate": "python3 scripts/verify-sep5-base-preservation.py",
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


HISTORICAL_FILES = {
    "data/futureproofing/aug26-package-contents-baseline.json": (
        "18305c5dae0a951ce7486737cf3914eae16d986900fbaf6c3681956402c4d1c1"
    ),
    "data/futureproofing/aug26-aug27-preservation-contract.json": (
        "37eb09b1659ab62f74a111982686c9056acdd31d5a44bd3f84837627aae9fb4d"
    ),
    "scripts/verify-aug27-base-preservation.py": (
        "16f391f9abcb1904355b2a74afd968b07c13d816398caae3ebcde2f10c8d3010"
    ),
    "scripts/fixtures/futureproofing/aug27-preservation-tampered.json": (
        "31238ed069db8dc2479868669242be60082f9ed0a9cc7ccbb242e4f6b4123c45"
    ),
    "data/futureproofing/aug30-package-contents-baseline.json": (
        "42f2ab9667f2d74726eca346d6dd68c63ba15771b2f4eef60582fbe2ca323fd2"
    ),
    "data/futureproofing/aug30-aug31-preservation-contract.json": (
        "b0f5029666b20407e15e9a94f5bd3bc5b10fcc37653ecce44212a204daaac6d4"
    ),
    "scripts/verify-aug31-base-preservation.py": (
        "3fb0d4cfd23731c5100bd6f06e6cc5687b77fb3ec598b131187b41598d561a3d"
    ),
    "scripts/fixtures/futureproofing/aug31-preservation-tampered.json": (
        "afe13de568330252fc45a30e14c7797b5d3f3e5d27d74834233717e88cb62113"
    ),
    "scripts/verify-futureproofing-base-preservation.py": (
        "0d203281b5a74472f152ee7054e84fee9d1d7e8cd07914611ad0710f14bd54ea"
    ),
    "data/futureproofing/aug31-package-contents-baseline.json": (
        "40e0f94e5bf88486d6d16c003ed6e01132e22a366675243b5b8fbe84b260773a"
    ),
    "data/futureproofing/aug31-sep3-preservation-contract.json": (
        "7341f4ebd776ef7c6cb20b2c3bf5ee9c3de998fa5d1d4f8d8b0e492873b807f6"
    ),
    "scripts/verify-sep3-base-preservation.py": (
        "a76596b29981eba3a9a9f440298db068b66e6566eeb2ff2be8ce9b887d446c10"
    ),
    "scripts/fixtures/futureproofing/sep3-preservation-tampered.json": (
        "5c7bd59e7254b8cd9366b51bed815c385b911c78cb2220b2fc6590dd6f9bc667"
    ),
}


def verify_historical_bytes() -> None:
    for relative, expected in HISTORICAL_FILES.items():
        actual = sha256(SITE_ROOT / relative)
        assert actual == expected, f"historical FP-02 evidence drifted: {relative}"
    assert sha256(BASELINE) == BASELINE_SHA256, (
        "September 3 baseline is not the exact predecessor package manifest"
    )


def baseline_document() -> dict[str, Any]:
    assert sha256(BASELINE) == BASELINE_SHA256, "September 3 package manifest hash drifted"
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


def outer_baseline(document: dict[str, Any]) -> dict[str, dict[str, Any]]:
    rows: dict[str, dict[str, Any]] = {}
    for source in document["files"]:
        relative = source["path"]
        if relative.startswith(SITE_PREFIX):
            continue
        assert relative not in rows, f"duplicate outer predecessor path: {relative}"
        rows[relative] = source
    assert len(rows) == OUTER_PREDECESSOR_COUNT
    return rows


def exact_transition(
    baseline_by_path: dict[str, dict[str, Any]],
    current_by_path: dict[str, Path],
) -> dict[str, Any]:
    unchanged: list[dict[str, Any]] = []
    modified: list[dict[str, Any]] = []
    deleted: list[dict[str, Any]] = []
    for relative, before in sorted(baseline_by_path.items()):
        current = current_by_path.get(relative)
        before_exact = {"bytes": before["bytes"], "sha256": before["sha256"]}
        if current is None:
            deleted.append({"path": relative, "before": before_exact})
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
    added = [
        exact(relative, current_by_path[relative])
        for relative in sorted(set(current_by_path) - set(baseline_by_path))
    ]
    changed_path_rows = [
        *(f"modified\0{row['path']}\n" for row in modified),
        *(f"added\0{row['path']}\n" for row in added),
        *(f"deleted\0{row['path']}\n" for row in deleted),
    ]
    return {
        "predecessor_count": len(baseline_by_path),
        "current_selected_count": len(current_by_path),
        "changed_paths_sha256": aggregate(changed_path_rows),
        "unchanged": summarize_exact(unchanged),
        "modified": modified,
        "added": added,
        "deleted": deleted,
    }


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
    outer_baseline_by_path = outer_baseline(baseline)
    current_files, selection_stats = collect_package_files(
        SITE_ROOT,
        DELIVERY_ROOT / ".sep5-preservation-probe.zip",
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

    delivery_files, _delivery_selection = collect_package_files(
        DELIVERY_ROOT,
        DELIVERY_ROOT / ".sep5-delivery-preservation-probe.zip",
        excluded_top_level={"qa"},
    )
    current_outer_by_path = {
        path.relative_to(DELIVERY_ROOT).as_posix(): path
        for path in delivery_files
        if not path.relative_to(DELIVERY_ROOT).as_posix().startswith(SITE_PREFIX)
    }
    outer_delivery = exact_transition(outer_baseline_by_path, current_outer_by_path)
    assert outer_delivery["deleted"] == [], (
        "September 5 transition contains an unauthorized outer delivery deletion"
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
        "September 5 transition contains an unauthorized predecessor deletion"
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
                "unchanged_from_sep3": (
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
            "path": "data/futureproofing/sep3-package-contents-baseline.json",
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
        "outer_delivery": outer_delivery,
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
        "contract_version": "2026-09-05.1",
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
    }, "September 3 to September 5 contract has unrecognized or missing fields"
    assert contract.get("schema") == CONTRACT_SCHEMA
    assert contract.get("contract_version") == "2026-09-05.1"
    assert contract.get("status") == "sealed", "September 5 preservation contract is unsealed"
    assert contract.get("transition_id") == TRANSITION_ID
    assert contract.get("predecessor_release_id") == PREDECESSOR_RELEASE_ID
    assert contract.get("baseline_manifest_sha256") == BASELINE_SHA256
    assert contract.get("rule") == CONTRACT_RULE
    assert contract.get("authorized_public_deletions") == list(AUTHORIZED_PUBLIC_DELETIONS)
    expected = contract.get("expected_transition")
    assert isinstance(expected, dict), "September 5 preservation transition is absent"
    assert observed == expected, "September 3 to September 5 exact preservation transition drifted"
    assert [row["path"] for row in observed["deleted"]] == list(AUTHORIZED_PUBLIC_DELETIONS)
    assert all(row["unchanged_from_sep3"] for row in observed["event_data"]), (
        "Polymythcal event corpus or safe public projections changed from September 3"
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
    outer_delivery = observed["outer_delivery"]
    assert outer_delivery["deleted"] == [], "an outer delivery predecessor was deleted"
    assert all(
        set(row["before"]) == {"bytes", "sha256"}
        and set(row["after"]) == {"bytes", "sha256"}
        for row in outer_delivery["modified"]
    ), "an outer delivery modification lacks exact before/after hashes"
    assert all(
        set(row) == {"path", "bytes", "sha256"}
        for row in outer_delivery["added"]
    ), "an outer delivery addition lacks an exact content hash"
    assert any(
        row["path"] == "README_FIRST.txt" for row in outer_delivery["modified"]
    ), "the final outer README bytes are absent from the transition"
    assert [
        row["path"] for row in outer_delivery["added"]
        if row["path"] == (
            "UPDATE_SOURCES/"
            "ML_STAR_UPDATE_SOURCE_TRUTHFUL_WORK_CLAIMS_2026-09-05.md"
        )
    ] == [
        "UPDATE_SOURCES/ML_STAR_UPDATE_SOURCE_TRUTHFUL_WORK_CLAIMS_2026-09-05.md"
    ], "the exact outer September 5 provenance source addition is absent"
    assert observed["added_policy"] == [
        {
            "path": "data/futureproofing/sep3-sep5-preservation-contract.json",
            "after": policy_binding(
                "data/futureproofing/sep3-sep5-preservation-contract.json"
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
    verify_historical_bytes()
    observed = observed_transition()
    if args.print_observed:
        print(json.dumps(observed, ensure_ascii=False, sort_keys=True, indent=2))
        return
    if args.seal:
        if args.contract.resolve() != CONTRACT.resolve():
            raise SystemExit("--seal writes only the canonical September 5 preservation contract")
        write_contract(observed)
        print(
            "SEP3→SEP5 PRESERVATION SEALED — "
            f"{observed['baseline_manifest']['governed_site_predecessor_count']} predecessor "
            "site files and "
            f"{observed['outer_delivery']['predecessor_count']} outer delivery files bound "
            "to the current quiescent tree."
        )
        return
    contract = json.loads(args.contract.read_text(encoding="utf-8"))
    validate_expected(observed, contract)
    modified_count = len(observed["modified"]) + len(observed["modified_policy"])
    added_count = len(observed["added"]) + len(observed["added_policy"])
    print(
        "SEP3→SEP5 PRESERVATION PASSED — "
        f"{observed['baseline_manifest']['governed_site_predecessor_count']} predecessor files; "
        f"{observed['unchanged']['count']} unchanged; "
        f"{modified_count} exact or fixed-point-governed modifications; "
        f"{added_count} exact or self-bound additions; "
        f"{observed['outer_delivery']['predecessor_count']} outer predecessor files; "
        "zero predecessor deletions; event corpus byte-identical."
    )


if __name__ == "__main__":
    main()
