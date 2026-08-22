#!/usr/bin/env python3
"""Enforce the permanent public-deploy/complete-handoff boundary."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import re

from editable_masters_integrity import verify_editable_masters


SITE_ROOT = Path(__file__).resolve().parents[1]
DELIVERY_ROOT = SITE_ROOT.parent
DEFAULT_POLICY = SITE_ROOT / "data/futureproofing/public-private-boundary.json"
TEXT_SUFFIXES = {".css", ".csv", ".html", ".js", ".json", ".md", ".mjs", ".svg", ".txt", ".xml", ".yml", ".yaml"}
OPERATOR_DOCUMENT_SUFFIXES = {".csv", ".json", ".log", ".md", ".txt"}
SCAN_LIMIT = 2 * 1024 * 1024


def validate_editable_masters(delivery_root: Path, policy: dict) -> tuple[list[str], int]:
    failures: list[str] = []
    required = policy.get("required_private_manifests") or []
    for relative in required:
        if not (delivery_root / relative).is_file():
            failures.append(f"required private manifest missing: {relative}")
    try:
        verified_count = verify_editable_masters(delivery_root / "EDITABLE_MASTERS")
    except (OSError, ValueError) as error:
        failures.append(f"editable-masters integrity failed: {error}")
        return failures, 0
    return failures, verified_count


def validate_boundary(
    policy: dict,
    delivery_root: Path,
    public_root: Path | None = None,
    *,
    site_only: bool = False,
) -> tuple[list[str], dict]:
    failures: list[str] = []
    if policy.get("schema") != "seminar-schools-public-private-boundary-v1":
        failures.append("unsupported public/private boundary schema")
    delivery_root = delivery_root.resolve()
    default_public_root = (
        delivery_root / "public"
        if site_only
        else delivery_root / str(policy.get("public_root") or "")
    )
    public_root = (public_root or default_public_root).resolve()
    try:
        public_root.relative_to(delivery_root)
    except ValueError:
        failures.append("public root escapes the complete delivery root")
        return failures, {}
    if not public_root.is_dir():
        failures.append(f"public root is missing: {public_root}")
        return failures, {}

    forbidden_top = set(policy.get("public_forbidden_top_level") or [])
    forbidden_files = set(policy.get("public_forbidden_files") or [])
    operator_re = re.compile(str(policy.get("public_forbidden_name_pattern") or r"$^"), re.I)
    secret_res = [re.compile(value) for value in policy.get("secret_patterns") or []]
    exempt_operator_prefixes = ("polymyth/", "aa/", "bb/", "bookwormcard/")
    scanned = 0
    for child in public_root.iterdir():
        if child.name in forbidden_top:
            failures.append(f"private/operator root reached public deploy: {child.name}")
        if child.name in forbidden_files:
            failures.append(f"private/operator file reached public deploy: {child.name}")
    for target in public_root.rglob("*"):
        if target.is_symlink():
            failures.append(f"public deploy contains a symbolic link: {target.relative_to(public_root).as_posix()}")
            continue
        if not target.is_file():
            continue
        scanned += 1
        relative = target.relative_to(public_root).as_posix()
        if target.name in forbidden_files:
            failures.append(f"private/operator file reached public deploy: {relative}")
        if (
            target.name != "site-release.json"
            and not relative.startswith(exempt_operator_prefixes)
            and operator_re.search(target.name)
            and target.suffix.lower() in OPERATOR_DOCUMENT_SUFFIXES
        ):
            failures.append(f"operator/audit artifact reached public deploy: {relative}")
        if target.suffix.lower() in TEXT_SUFFIXES and target.stat().st_size <= SCAN_LIMIT:
            try:
                text = target.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                continue
            for pattern in secret_res:
                if pattern.search(text):
                    failures.append(f"secret-shaped content reached public deploy: {relative}")
                    break

    editable_count = 0
    manifested_roots: set[str] = set()
    if not site_only:
        for relative in policy.get("private_roots") or []:
            private = delivery_root / relative
            if not private.exists():
                failures.append(f"declared private root is missing: {relative}")
        for root_name in policy.get("complete_package_required_roots") or []:
            if not (delivery_root / root_name).exists():
                failures.append(f"complete-handoff root is missing: {root_name}")

        editable_failures, editable_count = validate_editable_masters(delivery_root, policy)
        failures.extend(editable_failures)

        package_manifest_path = delivery_root / "PACKAGE_CONTENTS_SHA256.json"
        if not package_manifest_path.is_file():
            failures.append("complete package manifest is missing")
        else:
            package_manifest = json.loads(package_manifest_path.read_text(encoding="utf-8"))
            for row in package_manifest.get("files") or []:
                path = str(row.get("path") or "")
                if path:
                    manifested_roots.add(path.split("/", 1)[0])
            for root_name in policy.get("complete_package_required_roots") or []:
                if root_name not in manifested_roots:
                    failures.append(f"complete package manifest omits required root: {root_name}")

    return failures, {
        "public_root": public_root.as_posix(),
        "public_files_scanned": scanned,
        "editable_masters_verified": editable_count,
        "manifested_roots": sorted(manifested_roots),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--policy", type=Path, default=DEFAULT_POLICY)
    parser.add_argument("--delivery-root", type=Path, default=DELIVERY_ROOT)
    parser.add_argument("--public-root", type=Path)
    parser.add_argument("--site-only", action="store_true")
    args = parser.parse_args()
    policy = json.loads(args.policy.read_text(encoding="utf-8"))
    root = SITE_ROOT if args.site_only else args.delivery_root
    failures, evidence = validate_boundary(
        policy,
        root,
        args.public_root,
        site_only=args.site_only,
    )
    if failures:
        print("PUBLIC/PRIVATE BOUNDARY FAILED")
        for failure in failures:
            print(f" - {failure}")
        raise SystemExit(1)
    print(
        "PUBLIC/PRIVATE BOUNDARY PASSED — "
        f"{evidence['public_files_scanned']} public files scanned; "
        + (
            "repository-only deploy boundary verified without private handoff inputs."
            if args.site_only
            else f"{evidence['editable_masters_verified']} editable masters retained only in the complete handoff."
        )
    )


if __name__ == "__main__":
    main()
