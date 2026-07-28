#!/usr/bin/env python3
"""Create a verified full-site ZIP while excluding temporary QA renders."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from package_integrity import write_verified_archive
from package_selection import collect_package_files


ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("output", type=Path)
    parser.add_argument("--release-id", required=True)
    parser.add_argument("--generated-at", required=True)
    args = parser.parse_args()

    output = args.output.resolve()
    files, selection = collect_package_files(
        ROOT,
        output,
        excluded_top_level={"qa"},
    )
    result = write_verified_archive(
        ROOT,
        output,
        files,
        {
            "release_id": args.release_id,
            "generated_at": args.generated_at,
        },
        "seminar-schools-complete-editable-site-source",
    )
    print(
        json.dumps(
            {
                "output": str(output),
                "selection": selection,
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
