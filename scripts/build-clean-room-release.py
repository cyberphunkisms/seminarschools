#!/usr/bin/env python3
"""Rebuild a clean copied site, then create its deterministic complete ZIP."""
from __future__ import annotations

import argparse
from datetime import datetime
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

from audit_python_dependencies import prepare_audit_python_dependencies
from build_lock import require_release_build_lock
from editable_masters_integrity import verify_editable_masters


SITE_ROOT = Path(__file__).resolve().parents[1]
DELIVERY_ROOT = SITE_ROOT.parent
CANONICAL_PIPELINE_ID = "npm-ci-build-full-verify-editable-package-v1"
DERIVED_GENERATED_AT = "2026-08-26T16:30:00Z"
CORE_ACCESS_QUERY = (
    "portable CORE personal rules follow CORE+ assistant-owned filing task continuity "
    "actual 5000 character ceiling no random artifacts source status anti-Snakelogic "
    "Mephistodata Devil's Diary activation dispatch canonical locator evidence first "
    "current message scope external subject first Ouroborossyntheses Mearsheimer Mishlove "
    "Realist Power-Conversion Egregore comparative corpus artifact independence "
    "Ask your favourite AI no planted conclusion BB no training"
)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("output", type=Path)
    parser.add_argument("--release-id", required=True)
    parser.add_argument("--generated-at", required=True)
    args = parser.parse_args()
    require_release_build_lock(DELIVERY_ROOT)
    if os.environ.get("SS_CLEAN_ROOM_CANONICAL_PIPELINE") != CANONICAL_PIPELINE_ID:
        raise SystemExit(
            "clean-room helper may run only through verify-clean-room-release.py's "
            "fixed canonical pipeline"
        )
    npm = shutil.which("npm.cmd" if os.name == "nt" else "npm")
    if not npm:
        raise SystemExit("npm is required for the clean-room release build")
    temporary_root = Path(os.environ.get("TMPDIR") or tempfile.gettempdir())
    prepare_audit_python_dependencies(
        SITE_ROOT,
        temporary_root / "seminar-schools-python-audit-deps",
    )
    node = shutil.which("node.exe" if os.name == "nt" else "node")
    if not node:
        raise SystemExit("node is required for the clean-room release build")
    os.environ["MEPHISTODATA_GENERATED_AT"] = DERIVED_GENERATED_AT
    os.environ["SOURCE_DATE_EPOCH"] = str(
        int(datetime.fromisoformat(DERIVED_GENERATED_AT.replace("Z", "+00:00")).timestamp())
    )
    os.environ["SITE_BUILD_DATE"] = "2026-08-26"
    subprocess.run([npm, "ci"], cwd=SITE_ROOT, check=True)
    subprocess.run([node, "scripts/sync-core-personal-rules.js"], cwd=SITE_ROOT, check=True)
    subprocess.run([npm, "run", "regen:all-txt"], cwd=SITE_ROOT, check=True)
    subprocess.run(
        [node, "scripts/regen-methodologylist-manifest.js", "2026-08-26"],
        cwd=SITE_ROOT,
        check=True,
    )
    subprocess.run([npm, "run", "export:meaninglib-dataset"], cwd=SITE_ROOT, check=True)
    subprocess.run([npm, "run", "verify:meaninglib-dataset"], cwd=SITE_ROOT, check=True)
    subprocess.run([npm, "run", "build:meaninglib-search"], cwd=SITE_ROOT, check=True)
    subprocess.run([npm, "run", "verify:meaninglib-search"], cwd=SITE_ROOT, check=True)
    subprocess.run(
        [npm, "run", "build:ai-access-pack", "--", "--query", CORE_ACCESS_QUERY],
        cwd=SITE_ROOT,
        check=True,
    )
    subprocess.run([npm, "run", "verify:ai-access-pack"], cwd=SITE_ROOT, check=True)
    subprocess.run([npm, "run", "build"], cwd=SITE_ROOT, check=True)
    subprocess.run([npm, "run", "sync:editable-masters:locked"], cwd=SITE_ROOT, check=True)
    subprocess.run([npm, "run", "verify:all:built"], cwd=SITE_ROOT, check=True)
    verify_editable_masters(DELIVERY_ROOT / "EDITABLE_MASTERS")
    subprocess.run(
        [
            sys.executable,
            str(SITE_ROOT / "scripts" / "package-front-facing-mephistodata-release.py"),
            str(args.output.resolve()),
            "--release-id",
            args.release_id,
            "--generated-at",
            args.generated_at,
        ],
        cwd=SITE_ROOT,
        check=True,
    )


if __name__ == "__main__":
    main()
