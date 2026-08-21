#!/usr/bin/env python3
"""Central gate for the complete FP-01 through FP-15 release contract."""
from __future__ import annotations

import argparse
import json
from pathlib import Path, PurePosixPath
import subprocess

from atomic_json import write_json_atomic
from build_lock import require_release_build_lock


SITE_ROOT = Path(__file__).resolve().parents[1]
DELIVERY_ROOT = SITE_ROOT.parent
DEFAULT_CONTRACT = SITE_ROOT / "data/futureproofing/futureproofing-contract.json"
CANONICAL_NAMES = {
    "FP-01": "artifact_bound_audit_receipts",
    "FP-02": "approved_change_deletion_ledger",
    "FP-03": "article_body_fingerprints",
    "FP-04": "canonical_ownership_map",
    "FP-05": "single_writer_build_lock",
    "FP-06": "clean_room_reproducible_releases",
    "FP-07": "gate_the_gates_fixtures",
    "FP-08": "tiered_browser_testing",
    "FP-09": "live_evidence_expiration",
    "FP-10": "scraper_anomaly_detection",
    "FP-11": "external_destination_status",
    "FP-12": "route_tombstone_registry",
    "FP-13": "versioned_data_migrations",
    "FP-14": "disaster_recovery_verification",
    "FP-15": "permanent_public_private_boundary",
}


def validate_contract(document: dict, *, allow_pending: bool = False) -> tuple[list[str], list[dict]]:
    failures: list[str] = []
    if document.get("schema") != "seminar-schools-futureproofing-contract-v1":
        failures.append("unsupported futureproofing contract schema")
    items = document.get("items")
    if not isinstance(items, list):
        return failures + ["futureproofing contract items must be a list"], []
    by_id = {str(item.get("id") or ""): item for item in items}
    if len(by_id) != len(items):
        failures.append("futureproofing contract has duplicate or blank IDs")
    if set(by_id) != set(CANONICAL_NAMES):
        failures.append("futureproofing contract must enumerate exactly FP-01 through FP-15")
    for item_id, expected_name in CANONICAL_NAMES.items():
        item = by_id.get(item_id)
        if not item:
            continue
        if item.get("name") != expected_name:
            failures.append(f"{item_id} canonical name mismatch")
        status = item.get("status")
        if status not in {"implemented", "pending"}:
            failures.append(f"{item_id} has invalid status {status!r}")
        if status == "pending" and not allow_pending:
            failures.append(f"{item_id} remains pending")
        if status == "implemented":
            for field in ("verifier_paths", "fixture_paths", "evidence_fields", "gate_command"):
                if not isinstance(item.get(field), list) or not item[field]:
                    failures.append(f"{item_id} implemented entry has no {field}")
            for field in ("verifier_paths", "fixture_paths"):
                for relative in item.get(field) or []:
                    parsed = PurePosixPath(str(relative))
                    if parsed.is_absolute() or ".." in parsed.parts:
                        failures.append(f"{item_id} has unsafe {field} path: {relative}")
                    elif not (SITE_ROOT / str(relative)).is_file():
                        failures.append(f"{item_id} {field} path is missing: {relative}")
            command = item.get("gate_command") or []
            if any(not isinstance(part, str) or not part for part in command):
                failures.append(f"{item_id} gate command must contain non-empty strings")
        if item.get("stage") not in {"source", "post_package"}:
            failures.append(f"{item_id} has invalid stage")
    return failures, items


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--contract", type=Path, default=DEFAULT_CONTRACT)
    parser.add_argument("--allow-pending", action="store_true")
    parser.add_argument("--run-source", action="store_true")
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()
    if args.report and args.report.resolve() == (SITE_ROOT / "scripts/reports/futureproofing-gate-report.json").resolve():
        require_release_build_lock(DELIVERY_ROOT)
    document = json.loads(args.contract.read_text(encoding="utf-8"))
    failures, items = validate_contract(document, allow_pending=args.allow_pending)
    executed: list[dict] = []
    if not failures and args.run_source:
        for item in items:
            if item.get("status") != "implemented" or item.get("stage") != "source":
                continue
            command = item["gate_command"]
            if any("{" in part for part in command):
                failures.append(f"{item['id']} source command contains unresolved placeholders")
                continue
            completed = subprocess.run(command, cwd=SITE_ROOT, check=False)
            executed.append({"id": item["id"], "command": command, "exit_code": completed.returncode})
            if completed.returncode:
                failures.append(f"{item['id']} gate failed with exit code {completed.returncode}")
    pending = [item["id"] for item in items if item.get("status") == "pending"]
    implemented = [item["id"] for item in items if item.get("status") == "implemented"]
    source_controls = [
        item["id"] for item in items
        if item.get("status") == "implemented" and item.get("stage") == "source"
    ]
    post_package_controls = [
        item["id"] for item in items
        if item.get("status") == "implemented" and item.get("stage") == "post_package"
    ]
    executed_passes = sum(row["exit_code"] == 0 for row in executed)
    status = "failed" if failures else (
        "incomplete" if pending else ("passed" if args.run_source else "validated")
    )
    report = {
        "schema": "seminar-schools-futureproofing-gate-report-v1",
        "contract_version": document.get("contract_version"),
        "scope": "source-stage",
        "status": status,
        "contract_total_controls": len(items),
        "implemented_controls": len(implemented),
        "total_checks": len(source_controls) if args.run_source else 0,
        "passed_checks": executed_passes,
        "failed_checks": failures,
        "pending_checks": pending,
        "source_stage_controls": source_controls,
        "post_package_checks": post_package_controls,
        "executed": executed,
        "rule": document.get("rule"),
    }
    if args.report:
        write_json_atomic(args.report, report)
    if failures:
        print("FUTUREPROOFING CONTRACT FAILED")
        for failure in failures:
            print(f" - {failure}")
        raise SystemExit(1)
    if pending:
        print(f"FUTUREPROOFING CONTRACT INCOMPLETE — {len(implemented)} implemented; {len(pending)} pending (allowed for integration).")
    elif args.run_source:
        print(
            "FUTUREPROOFING SOURCE STAGE PASSED — "
            f"{len(source_controls)} source controls executed; "
            f"{len(post_package_controls)} post-package controls remain bound to the final artifact workflow."
        )
    else:
        print("FUTUREPROOFING CONTRACT VALIDATED — all 15 controls are implemented and evidence-bound.")


if __name__ == "__main__":
    main()
