#!/usr/bin/env python3
"""Verify historical FP-02 evidence bytes, then the current transition."""
from __future__ import annotations

import hashlib
import subprocess
import sys
from pathlib import Path


SITE_ROOT = Path(__file__).resolve().parents[1]
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
}
CURRENT_BASELINE = "data/futureproofing/aug30-package-contents-baseline.json"
CURRENT_BASELINE_SHA256 = "42f2ab9667f2d74726eca346d6dd68c63ba15771b2f4eef60582fbe2ca323fd2"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def verify_historical_bytes() -> None:
    for relative, expected in HISTORICAL_FILES.items():
        actual = sha256(SITE_ROOT / relative)
        assert actual == expected, f"historical FP-02 evidence drifted: {relative}"
    assert sha256(SITE_ROOT / CURRENT_BASELINE) == CURRENT_BASELINE_SHA256, (
        "August 30 baseline is not the exact predecessor package manifest"
    )


def main() -> None:
    verify_historical_bytes()
    completed = subprocess.run(
        [sys.executable, "scripts/verify-aug31-base-preservation.py"],
        cwd=SITE_ROOT,
        check=False,
    )
    if completed.returncode:
        raise SystemExit(completed.returncode)
    print(
        "FUTUREPROOFING BASE PRESERVATION PASSED — historical August 26→27 evidence "
        "is byte-identical and the sealed August 30→31 transition passed."
    )


if __name__ == "__main__":
    main()
