#!/usr/bin/env python3
"""Package the complete Audit 53 shared-discovery source and public release."""
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
    else ROOT.parent
    / "ss-site-audit53-shared-discovery-teacherresources-polymythcal-commons-complete-2026-07-28.zip"
)
RELEASE_ID = (
    "2026-07-28-site-audit53-shared-discovery-"
    "teacherresources-polymythcal-commons-final"
)
REQUIRED = [
    "WEBSITE_AUDIT53_SHARED_DISCOVERY_FULL_POV_REPORT_2026-07-28.md",
    "WEBSITE_AUDIT53_SHARED_DISCOVERY_VERIFICATION_2026-07-28.json",
    "scripts/reports/audit52-package-baseline.json",
    "scripts/reports/audit52-greenpeace-base-preservation.json",
    "scripts/verify-audit53-shared-discovery.js",
    "scripts/verify-audit53-base-preservation.py",
    "scripts/build-polymyth-data.mjs",
    "data/polymyth-commons-book-backbone.xlsx.inspect.ndjson",
    "teacherresources/index.html",
    "teacherresources/resources-data.json",
    "teacherresources/feed.xml",
    "polymythseminars/index.html",
    "polymythseminars/fr/index.html",
    "polymythseminars/events.json",
    "polymythcommons/index.html",
    "polymythlib/index.html",
    "polymythlib/collections/index.html",
    "polymythlib/data/collections.json",
    "polymythlib/data/data-manifest.json",
    "polymythlib/projects/PC-0001/index.html",
    "polymythlib/projects/PC-0346/index.html",
    "public/teacherresources/index.html",
    "public/polymythseminars/index.html",
    "public/polymythseminars/fr/index.html",
    "public/polymythcommons/index.html",
    "public/polymythlib/index.html",
    "SAUL_CV_GREENPEACE_EDITABLE_RELEASE_2026-07-28.md",
    "saul/cv.pdf",
    "saul/cv.docx",
    "public/saul/cv.pdf",
    "public/saul/cv.docx",
]


def run(*command: str) -> None:
    subprocess.run(list(command), cwd=ROOT, check=True)


def main() -> None:
    release = json.loads((ROOT / "RELEASE_MANIFEST.json").read_text(encoding="utf-8"))
    if release.get("release_id") != RELEASE_ID:
        raise SystemExit("Cannot package: Audit 53 release stamp is absent.")
    missing = [relative for relative in REQUIRED if not (ROOT / relative).is_file()]
    if missing:
        raise SystemExit("Cannot package: missing required files: " + ", ".join(missing))

    run("node", "scripts/verify-audit53-shared-discovery.js")
    run(sys.executable, "scripts/verify-audit53-base-preservation.py")
    run("node", "scripts/build-search-pages.js", "--check")
    run("node", "scripts/verify-teacherresources-finder.js")
    run("node", "scripts/verify-polymythcalendar-ux-efficiency.js")
    run("node", "scripts/verify-polymyth-commons.js")
    run("node", "scripts/verify-page-size-budget.js")
    run("node", "scripts/verify-public-deploy-parity.js")

    files, selection = collect_package_files(ROOT, OUTPUT)
    files = [
        path
        for path in files
        if path.relative_to(ROOT).as_posix() != MANIFEST_NAME
    ]
    selected = {path.relative_to(ROOT).as_posix() for path in files}
    omitted = [relative for relative in REQUIRED if relative not in selected]
    if omitted:
        raise SystemExit(
            "Required Audit 53 files were excluded: " + ", ".join(omitted)
        )
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
        "audit53-shared-discovery-complete-source",
    )
    print(
        f"PACKAGED {result['file_count']} files -> {OUTPUT} "
        f"({result['archive_bytes']} bytes; SHA-256 {result['archive_sha256']})"
    )


if __name__ == "__main__":
    main()
