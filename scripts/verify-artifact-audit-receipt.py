#!/usr/bin/env python3
"""Recompute every artifact receipt binding from the ZIP and its sidecar."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from artifact_receipt import verify_receipt


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("archive", type=Path)
    parser.add_argument("--sidecar", type=Path)
    parser.add_argument("--receipt", type=Path)
    parser.add_argument("--clean-room-report", type=Path)
    parser.add_argument("--disaster-recovery-report", type=Path)
    args = parser.parse_args()
    archive = args.archive.resolve()
    sidecar = (args.sidecar or Path(str(archive) + ".sha256")).resolve()
    receipt_path = (args.receipt or Path(str(archive) + ".audit-receipt.json")).resolve()
    receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
    verify_receipt(
        receipt,
        archive=archive,
        sidecar=sidecar,
        receipt_path=receipt_path,
        clean_room_report=(
            args.clean_room_report
            or Path(str(archive) + ".clean-room-report.json")
        ).resolve(),
        disaster_recovery_report=(
            args.disaster_recovery_report
            or Path(str(archive) + ".disaster-recovery-report.json")
        ).resolve(),
    )
    print(f"ARTIFACT AUDIT RECEIPT VERIFIED — {archive.name} matches {receipt_path.name}.")


if __name__ == "__main__":
    main()
