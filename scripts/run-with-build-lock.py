#!/usr/bin/env python3
"""Run one canonical writer beneath the repository-wide release lock."""
from __future__ import annotations

import argparse
from pathlib import Path
import subprocess

from build_lock import ReleaseBuildLock


SITE_ROOT = Path(__file__).resolve().parents[1]
DELIVERY_ROOT = SITE_ROOT.parent


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--delivery-root", type=Path, default=DELIVERY_ROOT)
    parser.add_argument("command", nargs=argparse.REMAINDER)
    args = parser.parse_args()
    command = list(args.command)
    if command and command[0] == "--":
        command.pop(0)
    if not command:
        raise SystemExit("Provide a command after --.")
    with ReleaseBuildLock(args.delivery_root):
        completed = subprocess.run(command, cwd=SITE_ROOT, check=False)
    raise SystemExit(completed.returncode)


if __name__ == "__main__":
    main()
