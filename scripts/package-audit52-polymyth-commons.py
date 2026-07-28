#!/usr/bin/env python3
"""Package the complete Audit 52 source and public release."""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

from package_integrity import MANIFEST_NAME, write_verified_archive
from package_selection import collect_package_files

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = (
    Path(sys.argv[1]).resolve()
    if len(sys.argv) > 1
    else ROOT.parent / "ss-site-audit52-polymyth-commons-greenpeace-cv-complete-2026-07-28.zip"
)
RELEASE_ID = "2026-07-28-site-audit52-polymyth-commons-greenpeace-merge-final"
REQUIRED = [
    "WEBSITE_AUDIT52_POLYMYTH_COMMONS_FULL_POV_REPORT_2026-07-28.md",
    "WEBSITE_AUDIT52_POLYMYTH_COMMONS_VERIFICATION_2026-07-28.json",
    "scripts/reports/audit52-greenpeace-base-preservation.json",
    "scripts/verify-audit52-polymyth-commons.js",
    "scripts/verify-audit52-base-preservation.py",
    "polymythcommons/index.html",
    "polymythlib/index.html",
    "polymythlib/book-backbone/index.html",
    "polymythlib/data/directory-index.json",
    "polymythlib/data/backbone-index.json",
    "data/polymyth-commons-book-backbone.xlsx",
    "polymythlib/projects/PC-0001/index.html",
    "polymythlib/projects/PC-0346/index.html",
    "public/polymythcommons/index.html",
    "public/polymythlib/index.html",
    "public/polymythlib/projects/PC-0001/index.html",
    "public/polymythlib/projects/PC-0346/index.html",
    "SAUL_CV_GREENPEACE_EDITABLE_RELEASE_2026-07-28.md",
    "saul/cv.pdf",
    "saul/cv.docx",
    "public/saul/cv.pdf",
    "public/saul/cv.docx",
]


def main() -> None:
    release = json.loads((ROOT / "RELEASE_MANIFEST.json").read_text(encoding="utf-8"))
    if release.get("release_id") != RELEASE_ID:
        raise SystemExit("Cannot package: Audit 52 release stamp is absent.")
    missing = [relative for relative in REQUIRED if not (ROOT / relative).is_file()]
    if missing:
        raise SystemExit("Cannot package: missing required files: " + ", ".join(missing))

    subprocess.run(["node", "scripts/verify-audit52-polymyth-commons.js"], cwd=ROOT, check=True)
    subprocess.run(
        [sys.executable, "scripts/verify-audit52-base-preservation.py"],
        cwd=ROOT,
        check=True,
    )

    files, selection = collect_package_files(ROOT, OUTPUT)
    files = [
        path
        for path in files
        if path.relative_to(ROOT).as_posix() != MANIFEST_NAME
    ]
    selected = {path.relative_to(ROOT).as_posix() for path in files}
    omitted = [relative for relative in REQUIRED if relative not in selected]
    if omitted:
        raise SystemExit("Required Audit 52 files were excluded: " + ", ".join(omitted))
    selection["files_selected"] = len(files)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    print(
        "PACKAGE SELECTION — "
        f"{selection['files_selected']} files selected; "
        f"{selection['files_considered']} files considered; "
        f"{selection['directories_pruned']} disposable directories pruned."
    )
    result = write_verified_archive(
        ROOT,
        OUTPUT,
        files,
        release,
        "audit52-polymyth-commons-greenpeace-complete-source",
    )
    print(
        f"PACKAGED {result['file_count']} files -> {OUTPUT} "
        f"({result['archive_bytes']} bytes; SHA-256 {result['archive_sha256']})"
    )


if __name__ == "__main__":
    main()
