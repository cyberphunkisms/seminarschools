#!/usr/bin/env python3
"""Build, verify, and package the complete CORE, CORE+, BB, site, and Polymythcal handoff."""

from __future__ import annotations

import argparse
from datetime import datetime
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

from audit_python_dependencies import prepare_audit_python_dependencies
from build_lock import require_release_build_lock
from clean_room_copy import copy_clean_source
from editable_masters_integrity import verify_editable_masters


SITE_ROOT = Path(__file__).resolve().parents[1]
DELIVERY_ROOT = SITE_ROOT.parent
EDITABLE_ROOT = DELIVERY_ROOT / "EDITABLE_MASTERS"
REPORT = SITE_ROOT / "WEBSITE_FUTUREPROOFING_CONTRACTS_AUDIT_2026-08-09.md"
PACKAGE_RELEASE_ID = "core-coreplus-mephistodata-bb-polymythcal-sets1-15-sitewide-fixes-synthesized-2026-08-15"
OUTPUT_BASENAME = (
    "ss-site-polymythcal-sets1-15-sitewide-fixes-synthesized-"
    "complete-2026-08-15.zip"
)
# Preserve the inherited CORE/Meaninglib derived snapshot timestamp. The outer
# handoff and website runtime have their own August 15 identities; changing
# this value would rewrite unrelated canonical retrieval artifacts.
DERIVED_GENERATED_AT = "2026-08-13T04:00:00Z"
RELEASE_GENERATED_AT = "2026-08-15T18:00:00-04:00"
CORE_ACCESS_QUERY = (
    "portable CORE personal rules follow CORE+ assistant-owned filing task continuity "
    "actual 5000 character ceiling no random artifacts source status anti-Snakelogic "
    "Mephistodata Devil's Diary activation dispatch canonical locator evidence first "
    "Ask your favourite AI no planted conclusion BB no training"
)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def run(command: list[str]) -> None:
    subprocess.run(command, cwd=SITE_ROOT, check=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    require_release_build_lock(DELIVERY_ROOT)
    output = args.output.resolve()
    if output.name != OUTPUT_BASENAME:
        raise SystemExit(
            f"Complete release output must use the canonical name: {OUTPUT_BASENAME}"
        )

    npm = shutil.which("npm.cmd" if os.name == "nt" else "npm")
    node = shutil.which("node.exe" if os.name == "nt" else "node")
    if not npm:
        raise SystemExit("npm is required for the complete current-release package.")
    if not node:
        raise SystemExit("node is required for the complete current-release package.")
    os.environ["MEPHISTODATA_GENERATED_AT"] = DERIVED_GENERATED_AT
    os.environ["SOURCE_DATE_EPOCH"] = str(
        int(datetime.fromisoformat(DERIVED_GENERATED_AT.replace("Z", "+00:00")).timestamp())
    )
    os.environ["SITE_BUILD_DATE"] = "2026-08-15"
    audit_dependency_holder = tempfile.TemporaryDirectory(
        prefix="ss-release-python-audit-deps-"
    )
    prepare_audit_python_dependencies(
        SITE_ROOT,
        Path(audit_dependency_holder.name) / "python-audit-deps",
    )
    # Reconstruct every derived CORE/Meaninglib surface from the canonical HTML
    # before the build and gate.  The fixed timestamp is retained in the source
    # snapshot, so the independent clean-room build verifies those exact bytes
    # without regenerating them from a wall clock.
    run([node, "scripts/sync-core-personal-rules.js"])
    run([npm, "run", "regen:all-txt"])
    run([node, "scripts/regen-methodologylist-manifest.js", "2026-08-13"])
    run([npm, "run", "export:meaninglib-dataset"])
    run([npm, "run", "verify:meaninglib-dataset"])
    run([npm, "run", "build:meaninglib-search"])
    run([npm, "run", "verify:meaninglib-search"])
    run([npm, "run", "build:ai-access-pack", "--", "--query", CORE_ACCESS_QUERY])
    run([npm, "run", "verify:ai-access-pack"])
    run([npm, "run", "build"])
    # The clean-room verifier owns these fixed values.  Use the same values for
    # the primary gate so its packaged release report is reproducible byte for
    # byte instead of recording a caller-dependent timeout or concurrency.
    os.environ["VERIFY_ALL_CONCURRENCY"] = "4"
    os.environ["VERIFY_ALL_COMMAND_TIMEOUT_MS"] = "1200000"
    run([npm, "run", "verify:all:built"])
    verify_editable_masters(EDITABLE_ROOT)
    if not REPORT.is_file():
        raise SystemExit(f"Required audit evidence is missing: {REPORT.name}")

    # Snapshot the exact verified delivery inputs immediately before packaging.
    # The independent clean-room copy then repeats the canonical build and all
    # checks from the same source that the archive actually ships.
    snapshot_holder = tempfile.TemporaryDirectory(prefix="ss-release-source-snapshot-")
    source_snapshot = Path(snapshot_holder.name) / "delivery-source"
    copy_clean_source(DELIVERY_ROOT, source_snapshot)

    runtime_release = json.loads((SITE_ROOT / "RELEASE_MANIFEST.json").read_text(encoding="utf-8"))
    runtime_id = (SITE_ROOT / "RELEASE_ID.txt").read_text(encoding="utf-8").strip()
    if runtime_release.get("release_id") != runtime_id or not runtime_release.get("generated_at"):
        raise SystemExit("Verified runtime release metadata is inconsistent at package time.")
    generated_at = RELEASE_GENERATED_AT
    run([
        sys.executable,
        str(SITE_ROOT / "scripts" / "package-front-facing-mephistodata-release.py"),
        str(output),
        "--release-id",
        PACKAGE_RELEASE_ID,
        "--generated-at",
        generated_at,
    ])
    clean_room_report = Path(str(output) + ".clean-room-report.json")
    disaster_recovery_report = Path(str(output) + ".disaster-recovery-report.json")
    receipt = Path(str(output) + ".audit-receipt.json")
    run([
        sys.executable,
        str(SITE_ROOT / "scripts" / "verify-clean-room-release.py"),
        "--reference-archive",
        str(output),
        "--source-root",
        str(source_snapshot),
        "--report",
        str(clean_room_report),
    ])
    run([
        sys.executable,
        str(SITE_ROOT / "scripts" / "verify-disaster-recovery.py"),
        str(output),
        "--report",
        str(disaster_recovery_report),
    ])
    run([
        sys.executable,
        str(SITE_ROOT / "scripts" / "create-artifact-audit-receipt.py"),
        str(output),
        "--audit-report",
        str(REPORT),
        "--clean-room-report",
        str(clean_room_report),
        "--disaster-recovery-report",
        str(disaster_recovery_report),
        "--output",
        str(receipt),
    ])
    run([
        sys.executable,
        str(SITE_ROOT / "scripts" / "verify-artifact-audit-receipt.py"),
        str(output),
        "--receipt",
        str(receipt),
        "--clean-room-report",
        str(clean_room_report),
        "--disaster-recovery-report",
        str(disaster_recovery_report),
    ])
    print(json.dumps({
        "archive": str(output),
        "archive_sha256": sha256(output),
        "checksum_sidecar": str(Path(str(output) + ".sha256")),
        "clean_room_report": str(clean_room_report),
        "disaster_recovery_report": str(disaster_recovery_report),
        "audit_receipt": str(receipt),
    }, indent=2))
    snapshot_holder.cleanup()
    audit_dependency_holder.cleanup()


if __name__ == "__main__":
    main()
