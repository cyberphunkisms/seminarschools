#!/usr/bin/env python3
"""Run one canonical writer beneath the repository-wide release lock."""
from __future__ import annotations

import argparse
from datetime import datetime
import os
from pathlib import Path
import subprocess
from zoneinfo import ZoneInfo

from build_lock import ReleaseBuildLock, inherited_release_build_root


SITE_ROOT = Path(__file__).resolve().parents[1]
TORONTO_TIME_ZONE = ZoneInfo("America/Toronto")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--delivery-root",
        type=Path,
        default=inherited_release_build_root(SITE_ROOT),
    )
    parser.add_argument("command", nargs=argparse.REMAINDER)
    args = parser.parse_args()
    command = list(args.command)
    if command and command[0] == "--":
        command.pop(0)
    if not command:
        raise SystemExit("Provide a command after --.")
    with ReleaseBuildLock(args.delivery_root):
        # Every date-sensitive generator in one build must observe one day.
        # Resolve the ordinary live-Toronto fallback once at lock entry so a
        # build crossing midnight cannot combine two publication dates. A
        # release or caller-supplied override remains authoritative.
        environment = dict(os.environ)
        if "SITE_BUILD_DATE" not in environment:
            environment["SITE_BUILD_DATE"] = (
                datetime.now(TORONTO_TIME_ZONE).date().isoformat()
            )
        completed = subprocess.run(
            command,
            cwd=SITE_ROOT,
            check=False,
            env=environment,
        )
    raise SystemExit(completed.returncode)


if __name__ == "__main__":
    main()
