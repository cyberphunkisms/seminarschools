#!/usr/bin/env python3
"""Verify that every governed release output has one canonical writer."""
from __future__ import annotations

import argparse
import fnmatch
import json
from pathlib import Path, PurePosixPath


SITE_ROOT = Path(__file__).resolve().parents[1]
DELIVERY_ROOT = SITE_ROOT.parent
DEFAULT_MAP = SITE_ROOT / "data/futureproofing/canonical-ownership-map.json"
REQUIRED_GOVERNED_OUTPUTS = frozenset({
    "SITE_PACKAGE/public/**",
    "SITE_PACKAGE/PACKAGE_CONTENTS_SHA256.json",
    "PACKAGE_CONTENTS_SHA256.json",
    "ss-site-*.zip",
    "ss-site-*.zip.sha256",
    "ss-site-*.zip.audit-receipt.json",
    "SITE_PACKAGE/scripts/reports/release-gate-report.json",
    "SITE_PACKAGE/scripts/reports/futureproofing-gate-report.json",
    "ss-site-*.zip.clean-room-report.json",
    "ss-site-*.zip.disaster-recovery-report.json",
})


def static_prefix(pattern: str) -> str:
    positions = [index for index in (pattern.find("*"), pattern.find("?"), pattern.find("[")) if index >= 0]
    return pattern[: min(positions)] if positions else pattern


def patterns_overlap(left: str, right: str) -> bool:
    if left == right:
        return True
    if not any(mark in left for mark in "*?["):
        return fnmatch.fnmatchcase(left, right)
    if not any(mark in right for mark in "*?["):
        return fnmatch.fnmatchcase(right, left)
    left_prefix = static_prefix(left).rstrip("/")
    right_prefix = static_prefix(right).rstrip("/")
    if "**" in left and (right_prefix == left_prefix or right_prefix.startswith(left_prefix + "/")):
        return True
    if "**" in right and (left_prefix == right_prefix or left_prefix.startswith(right_prefix + "/")):
        return True
    return False


def validate_ownership(document: dict, delivery_root: Path, *, require_writers: bool = True) -> list[str]:
    failures: list[str] = []
    if document.get("schema") != "seminar-schools-canonical-ownership-map-v1":
        failures.append("unsupported canonical ownership schema")
    owners = document.get("owners")
    if not isinstance(owners, list) or not owners:
        return failures + ["ownership map has no owners"]
    ids: set[str] = set()
    governed: list[tuple[str, str]] = []
    for owner in owners:
        owner_id = str(owner.get("id") or "")
        if not owner_id or owner_id in ids:
            failures.append(f"missing or duplicate owner id: {owner_id!r}")
        ids.add(owner_id)
        writer = str(owner.get("writer") or "")
        if not writer:
            failures.append(f"{owner_id} has no writer")
        elif require_writers and not (delivery_root / writer).is_file():
            failures.append(f"{owner_id} writer does not exist: {writer}")
        outputs = owner.get("outputs")
        if not isinstance(outputs, list) or not outputs:
            failures.append(f"{owner_id} has no governed outputs")
            outputs = []
        for output in outputs:
            output = str(output)
            parsed = PurePosixPath(output)
            if parsed.is_absolute() or ".." in parsed.parts or not output:
                failures.append(f"{owner_id} has unsafe output pattern: {output!r}")
            governed.append((owner_id, output))
        if not owner.get("classification"):
            failures.append(f"{owner_id} has no public/private classification")
        if not owner.get("lock_scope"):
            failures.append(f"{owner_id} has no lock scope")
        if owner.get("classification") in {
            "public_generated",
            "private_release_metadata",
            "private_complete_handoff",
            "public_handoff_evidence",
            "private_release_evidence",
        } and owner.get("lock_scope") != "release_build":
            failures.append(f"{owner_id} mutates release state without release_build lock scope")
    for index, (left_owner, left_pattern) in enumerate(governed):
        for right_owner, right_pattern in governed[index + 1 :]:
            if left_owner != right_owner and patterns_overlap(left_pattern, right_pattern):
                failures.append(
                    f"overlapping output ownership: {left_owner}:{left_pattern} and "
                    f"{right_owner}:{right_pattern}"
                )
    governed_outputs = {pattern for _, pattern in governed}
    for required in sorted(REQUIRED_GOVERNED_OUTPUTS - governed_outputs):
        failures.append(f"ownership map omits required governed output: {required}")
    return failures


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--map", type=Path, default=DEFAULT_MAP)
    parser.add_argument("--delivery-root", type=Path, default=DELIVERY_ROOT)
    args = parser.parse_args()
    document = json.loads(args.map.read_text(encoding="utf-8"))
    failures = validate_ownership(document, args.delivery_root.resolve())
    if failures:
        print("CANONICAL OWNERSHIP MAP FAILED")
        for failure in failures:
            print(f" - {failure}")
        raise SystemExit(1)
    print(f"CANONICAL OWNERSHIP MAP PASSED — {len(document['owners'])} governed output owners are unique and lock-scoped.")


if __name__ == "__main__":
    main()
