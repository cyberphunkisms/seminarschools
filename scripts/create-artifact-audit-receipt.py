#!/usr/bin/env python3
"""Write `<zip>.audit-receipt.json` only after the ZIP has been verified."""
from __future__ import annotations

import argparse
from pathlib import Path

from artifact_receipt import create_receipt
from atomic_json import write_json_atomic
from build_lock import require_release_build_lock


SITE_ROOT = Path(__file__).resolve().parents[1]
DELIVERY_ROOT = SITE_ROOT.parent


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("archive", type=Path)
    parser.add_argument("--sidecar", type=Path)
    parser.add_argument("--delivery-root", type=Path, default=DELIVERY_ROOT)
    parser.add_argument("--package-manifest", type=Path, default=DELIVERY_ROOT / "PACKAGE_CONTENTS_SHA256.json")
    parser.add_argument("--gate-report", type=Path, default=SITE_ROOT / "scripts/reports/release-gate-report.json")
    parser.add_argument("--futureproof-report", type=Path, default=SITE_ROOT / "scripts/reports/futureproofing-gate-report.json")
    parser.add_argument("--audit-report", type=Path, default=SITE_ROOT / "WEBSITE_FUTUREPROOFING_CONTRACTS_AUDIT_2026-08-09.md")
    parser.add_argument("--release-manifest", type=Path, default=SITE_ROOT / "RELEASE_MANIFEST.json")
    parser.add_argument("--clean-room-report", type=Path)
    parser.add_argument("--disaster-recovery-report", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    require_release_build_lock(args.delivery_root)
    archive = args.archive.resolve()
    sidecar = (args.sidecar or Path(str(archive) + ".sha256")).resolve()
    output = (args.output or Path(str(archive) + ".audit-receipt.json")).resolve()
    clean_room_report = (
        args.clean_room_report
        or Path(str(archive) + ".clean-room-report.json")
    ).resolve()
    disaster_recovery_report = (
        args.disaster_recovery_report
        or Path(str(archive) + ".disaster-recovery-report.json")
    ).resolve()
    receipt = create_receipt(
        archive=archive,
        sidecar=sidecar,
        delivery_root=args.delivery_root,
        package_manifest=args.package_manifest,
        gate_report=args.gate_report,
        futureproof_report=args.futureproof_report,
        audit_report=args.audit_report,
        release_manifest=args.release_manifest,
        clean_room_report=clean_room_report,
        disaster_recovery_report=disaster_recovery_report,
        receipt_path=output,
    )
    write_json_atomic(output, receipt)
    print(f"ARTIFACT AUDIT RECEIPT PASSED — {output.name} binds {archive.name} at {receipt['archive']['sha256']}.")


if __name__ == "__main__":
    main()
