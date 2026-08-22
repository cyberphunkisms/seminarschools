#!/usr/bin/env python3
"""Fail unless the current process inherited the live release-build lock."""
from __future__ import annotations

import argparse
from pathlib import Path

from build_lock import inherited_release_build_root, require_release_build_lock


SITE_ROOT = Path(__file__).resolve().parents[1]


def require_lock(delivery_root: Path) -> dict:
    return require_release_build_lock(delivery_root)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--delivery-root",
        type=Path,
        default=inherited_release_build_root(SITE_ROOT),
    )
    args = parser.parse_args()
    owner = require_lock(args.delivery_root)
    print(
        "RELEASE BUILD LOCK VERIFIED — "
        f"writer {owner.get('hostname')}:{owner.get('pid')} owns {args.delivery_root.resolve()}."
    )


if __name__ == "__main__":
    main()
