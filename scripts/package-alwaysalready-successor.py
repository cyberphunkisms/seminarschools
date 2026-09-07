#!/usr/bin/env python3
"""Package the complete site and editable masters with the Always Already page."""

from __future__ import annotations

import argparse
from datetime import datetime
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

from package_integrity import file_sha256, write_verified_archive
from package_selection import collect_package_files


SITE_ROOT = Path(__file__).resolve().parents[1]
DELIVERY_ROOT = SITE_ROOT.parent
OUTPUT_NAME = "seminar-schools-alwaysalready-complete-2026-09-06.zip"
RELEASE = {
    "release_id": "seminar-schools-alwaysalready-complete-2026-09-06",
    "generated_at": "2026-09-06T21:07:09Z",
}
PACKAGE_KIND = "seminar-schools-complete-editable-masters-source-and-public"
MANIFEST_NAME = "PACKAGE_CONTENTS_SHA256.json"


def run(command: list[str]) -> None:
    subprocess.run(command, cwd=SITE_ROOT, check=True)


def run_with_build_lock(command: list[str]) -> None:
    run([
        sys.executable,
        "scripts/run-with-build-lock.py",
        "--delivery-root",
        "..",
        "--",
        *command,
    ])


def render_manifest(root: Path, files: list[Path]) -> dict:
    rows = [
        {
            "bytes": path.stat().st_size,
            "path": path.relative_to(root).as_posix(),
            "sha256": file_sha256(path),
        }
        for path in files
    ]
    return {
        "schema": "seminar-schools-package-contents-v1",
        "package_kind": "seminar-schools-complete-editable-site-source",
        "release_id": RELEASE["release_id"],
        "generated_at": RELEASE["generated_at"],
        "file_count": len(rows),
        "total_uncompressed_bytes": sum(row["bytes"] for row in rows),
        "files": rows,
    }


def write_manifest(path: Path, manifest: dict) -> None:
    path.write_text(
        json.dumps(manifest, ensure_ascii=False, sort_keys=True, indent=2) + "\n",
        encoding="utf-8",
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    output = args.output.resolve()
    if output.name != OUTPUT_NAME:
        raise SystemExit(f"Output must be named {OUTPUT_NAME}")

    node = shutil.which("node")
    if not node:
        raise SystemExit("Node.js is required")

    os.environ["SOURCE_DATE_EPOCH"] = str(
        int(datetime.fromisoformat(RELEASE["generated_at"].replace("Z", "+00:00")).timestamp())
    )
    os.environ["SS_PUBLIC_OUTPUT_MTIME"] = RELEASE["generated_at"]

    run_with_build_lock([node, "scripts/build-public-deploy.js"])
    run([node, "scripts/build-asset-weight-report.js"])
    run([node, "scripts/verify-alwaysalready-page.js"])
    run([node, "scripts/verify-ielts-rubric-release.js"])
    run([sys.executable, "scripts/verify-ielts-rubric-bundle.py"])

    for verifier in (
        "verify-public-build-lock-recovery.js",
        # Extracted artifact workspaces can expose a post-commit overlay after
        # the atomic public-directory swap.  Reconcile that bounded state
        # before the efficiency guard asserts that no public-build transient
        # remains, matching the established IELTS successor package order.
        "verify-public-deploy-parity.js",
        "verify-release-asset-identity.js",
        "verify-page-size-budget.js",
        "verify-asset-weights.js",
        "verify-visible-geometry.js",
        "verify-meaningful-geometry.js",
        "verify-front-facing-boundary.js",
        "verify-site-integrity.js",
        "verify-seo.js",
        "verify-responsive-regression.js",
        "verify-page-type-contracts.js",
        "verify-keyboard-navigation.js",
        "verify-zoom-resilience.js",
        "verify-generated-route-indexing.js",
        "verify-sitemap-classification.js",
        "verify-csp-enforced.js",
        "verify-audit49-metadata-surface.js",
        "verify-audit49-runtime-efficiency.js",
        "verify-audit49-build-packaging-efficiency.js",
    ):
        command = [node, f"scripts/{verifier}"]
        if verifier == "verify-public-deploy-parity.js":
            run_with_build_lock(command)
        else:
            run(command)

    site_probe = output.parent / ".alwaysalready-site-manifest-probe.zip"
    site_files, site_selection = collect_package_files(
        SITE_ROOT,
        site_probe,
        excluded_top_level={"qa"},
    )
    site_manifest = render_manifest(SITE_ROOT, site_files)
    write_manifest(SITE_ROOT / MANIFEST_NAME, site_manifest)

    delivery_files, delivery_selection = collect_package_files(DELIVERY_ROOT, output)
    required = {
        "ALWAYSALREADY_RELEASE_NOTES_2026-09-06.md",
        "README_FIRST.txt",
        "Mephistodata_CORE_Personal_Rules_2026-08-12.md",
        "EDITABLE_MASTERS/README_FIRST.md",
        "EDITABLE_MASTERS/08_IELTS_RUBRIC/Seminar_Schools_IELTS_Band_Guide_and_Rubric_Final.docx",
        "DEPLOY_TOOLS/README_NEXT_DEPLOY.txt",
        "SITE_PACKAGE/polymyth/alwaysalready/index.html",
        "SITE_PACKAGE/polymyth/alwaysalready/specimens.json",
        "SITE_PACKAGE/public/polymyth/alwaysalready/index.html",
        "SITE_PACKAGE/public/polymyth/alwaysalready/specimens.json",
        "SITE_PACKAGE/scripts/verify-alwaysalready-page.js",
        "SITE_PACKAGE/scripts/verify-alwaysalready-archive.py",
        "SITE_PACKAGE/scripts/package-alwaysalready-successor.py",
    }
    image_names = {
        "2026-07-09_reddit_mirror-shadow-realm.png",
        "2026-08-14_youtube_star-trek-vs-hunger-games.png",
        "2026-08-30_youtube_christianity-fandom-discourse.png",
        "2026-09-06_youtube_psychedelic-comments_full.png",
        "2026-09-06_youtube_psychedelic-comments_crop.png",
    }
    for image_name in image_names:
        required.add(f"SITE_PACKAGE/polymyth/alwaysalready/img/{image_name}")
        required.add(f"SITE_PACKAGE/public/polymyth/alwaysalready/img/{image_name}")

    selected = {path.relative_to(DELIVERY_ROOT).as_posix() for path in delivery_files}
    missing = sorted(required - selected)
    if missing:
        raise SystemExit("Required Always Already release files are missing: " + ", ".join(missing))

    result = write_verified_archive(
        DELIVERY_ROOT,
        output,
        delivery_files,
        RELEASE,
        PACKAGE_KIND,
    )
    write_manifest(DELIVERY_ROOT / MANIFEST_NAME, result["manifest"])
    run([
        sys.executable,
        "scripts/verify-alwaysalready-archive.py",
        str(output),
    ])
    print(json.dumps({
        "archive": str(output),
        "archive_bytes": result["archive_bytes"],
        "archive_sha256": result["archive_sha256"],
        "archive_payload_files": result["file_count"],
        "archive_members_including_manifest": result["file_count"] + 1,
        "site_manifest_files": site_manifest["file_count"],
        "site_selection": site_selection,
        "delivery_selection": delivery_selection,
        "checksum_sidecar": str(result["sidecar"]),
    }, indent=2))


if __name__ == "__main__":
    main()
