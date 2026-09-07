#!/usr/bin/env python3
"""Package the complete site, public build, and IELTS editable bundle."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import shutil
import subprocess
import sys

from package_integrity import file_sha256, write_verified_archive
from package_selection import collect_package_files


SITE_ROOT = Path(__file__).resolve().parents[1]
DELIVERY_ROOT = SITE_ROOT.parent
OUTPUT_NAME = "seminar-schools-ielts-rubric-complete-2026-09-06.zip"
RELEASE = {
    "release_id": "seminar-schools-ielts-rubric-complete-2026-09-06",
    "generated_at": "2026-09-06T10:30:00Z",
}
MANIFEST_NAME = "PACKAGE_CONTENTS_SHA256.json"


def run(command: list[str]) -> None:
    subprocess.run(command, cwd=SITE_ROOT, check=True)


def run_with_build_lock(command: list[str]) -> None:
    run([
        sys.executable,
        "scripts/run-with-build-lock.py",
        "--",
        *command,
    ])


def render_manifest(root: Path, files: list[Path], package_kind: str) -> dict:
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
        "package_kind": package_kind,
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

    run([node, "scripts/verify-ielts-rubric-release.js"])
    run([sys.executable, "scripts/verify-ielts-rubric-bundle.py"])
    for verifier in (
        "verify-public-build-lock-recovery.js",
        "verify-public-deploy-parity.js",
        "verify-release-asset-identity.js",
        "verify-visible-geometry.js",
        "verify-front-facing-boundary.js",
        "verify-teacherresources-finder.js",
        "verify-site-integrity.js",
        "verify-seo.js",
        "verify-audit49-metadata-surface.js",
        "verify-audit49-runtime-efficiency.js",
        "verify-audit49-build-packaging-efficiency.js",
    ):
        command = [node, f"scripts/{verifier}"]
        if verifier == "verify-public-deploy-parity.js":
            run_with_build_lock(command)
        else:
            run(command)

    site_probe = output.parent / ".ielts-site-manifest-probe.zip"
    site_files, site_selection = collect_package_files(
        SITE_ROOT,
        site_probe,
        excluded_top_level={"qa"},
    )
    site_manifest = render_manifest(
        SITE_ROOT,
        site_files,
        "seminar-schools-complete-editable-site-source",
    )
    write_manifest(SITE_ROOT / MANIFEST_NAME, site_manifest)

    delivery_files, delivery_selection = collect_package_files(DELIVERY_ROOT, output)
    required = {
        "IELTS_RUBRIC_RELEASE_NOTES_2026-09-06.md",
        "EDITABLE_MASTERS/08_IELTS_RUBRIC/BUNDLE_MANIFEST.json",
        "EDITABLE_MASTERS/08_IELTS_RUBRIC/DESIGN_CONTINUITY_AUDIT_2026-09-06.md",
        "EDITABLE_MASTERS/08_IELTS_RUBRIC/Seminar_Schools_IELTS_Band_Guide_and_Rubric_Final.docx",
        "EDITABLE_MASTERS/08_IELTS_RUBRIC/verify_document_continuity.py",
        "SITE_PACKAGE/IELTS_RUBRIC_RELEASE_VERIFICATION_2026-09-06.json",
        "SITE_PACKAGE/teacherresources/ieltsrubric/index.html",
        "SITE_PACKAGE/teacherresources/ieltsrubric/ielts-band-guide-and-assessment-rubric.pdf",
        "SITE_PACKAGE/public/teacherresources/ieltsrubric/index.html",
        "SITE_PACKAGE/public/teacherresources/ieltsrubric/ielts-band-guide-and-assessment-rubric.pdf",
    }
    selected = {path.relative_to(DELIVERY_ROOT).as_posix() for path in delivery_files}
    missing = sorted(required - selected)
    if missing:
        raise SystemExit("Required IELTS release files are missing: " + ", ".join(missing))

    result = write_verified_archive(
        DELIVERY_ROOT,
        output,
        delivery_files,
        RELEASE,
        "seminar-schools-complete-site-public-and-ielts-editable-masters",
    )
    write_manifest(DELIVERY_ROOT / MANIFEST_NAME, result["manifest"])
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
