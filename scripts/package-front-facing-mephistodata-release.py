#!/usr/bin/env python3
"""Create the complete Mephistodata/front-facing editable-masters release."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from package_integrity import file_sha256, write_verified_archive
from package_selection import collect_package_files


SITE_ROOT = Path(__file__).resolve().parents[1]
DELIVERY_ROOT = SITE_ROOT.parent
MANIFEST_NAME = "PACKAGE_CONTENTS_SHA256.json"


def render_manifest(root: Path, files: list[Path], release: dict, package_kind: str) -> dict:
    rows = []
    for source in files:
        rows.append(
            {
                "bytes": source.stat().st_size,
                "path": source.relative_to(root).as_posix(),
                "sha256": file_sha256(source),
            }
        )
    return {
        "schema": "seminar-schools-package-contents-v1",
        "package_kind": package_kind,
        "release_id": release["release_id"],
        "generated_at": release["generated_at"],
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
    parser.add_argument("--release-id", required=True)
    parser.add_argument("--generated-at", required=True)
    args = parser.parse_args()

    output = args.output.resolve()
    release = {
        "release_id": args.release_id,
        "generated_at": args.generated_at,
    }

    inner_probe = DELIVERY_ROOT / ".site-package-manifest-probe.zip"
    site_files, site_selection = collect_package_files(
        SITE_ROOT,
        inner_probe,
        excluded_top_level={"qa"},
    )
    site_manifest = render_manifest(
        SITE_ROOT,
        site_files,
        release,
        "seminar-schools-complete-editable-site-source",
    )
    write_manifest(SITE_ROOT / MANIFEST_NAME, site_manifest)

    delivery_files, delivery_selection = collect_package_files(DELIVERY_ROOT, output)
    result = write_verified_archive(
        DELIVERY_ROOT,
        output,
        delivery_files,
        release,
        "seminar-schools-complete-editable-masters-source-and-public",
    )
    write_manifest(DELIVERY_ROOT / MANIFEST_NAME, result["manifest"])

    print(
        json.dumps(
            {
                "output": str(output),
                "site_selection": site_selection,
                "delivery_selection": delivery_selection,
                "file_count": result["file_count"],
                "archive_bytes": result["archive_bytes"],
                "archive_sha256": result["archive_sha256"],
                "sidecar": str(result["sidecar"]),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
