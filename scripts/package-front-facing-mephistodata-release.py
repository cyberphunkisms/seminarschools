#!/usr/bin/env python3
"""Create the complete Mephistodata/front-facing editable-masters release."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from package_integrity import file_sha256, write_verified_archive
from package_selection import collect_package_files
from build_lock import require_release_build_lock


SITE_ROOT = Path(__file__).resolve().parents[1]
DELIVERY_ROOT = SITE_ROOT.parent
MANIFEST_NAME = "PACKAGE_CONTENTS_SHA256.json"
CORE_MAX_CHARACTERS = 5000
REQUIRED_DELIVERY_FILES = {
    "README_FIRST.txt",
    "Mephistodata_CORE_Personal_Rules_2026-08-12.md",
    "SITE_PACKAGE/CHARTER.txt",
    "SITE_PACKAGE/PACKAGE_CONTENTS_SHA256.json",
    "SITE_PACKAGE/polymyth/methodologylist/index.html",
    "SITE_PACKAGE/polymyth/methodologylist.txt",
    "SITE_PACKAGE/hf_export/data/ml/sections/framework-core.jsonl",
    "SITE_PACKAGE/hf_export/data/ml/methodologylist.jsonl",
    "SITE_PACKAGE/hf_export/data/all_meaninglib_rows.jsonl",
    "SITE_PACKAGE/scripts/sync-core-personal-rules.js",
    "SITE_PACKAGE/scripts/verify-core-coreplus-alignment.js",
    "DEPLOY_TOOLS/SeminarSchools-Deploy-FINAL7-VerifiedPush-StayOpen-NoLocalNpm-ManualRepoPicker-ManualHFSync.cmd",
    "SITE_PACKAGE/polymyth/coherence/Polymyth_Coherence_Assessment_Instrument_V5.1.2.xlsx",
    "SITE_PACKAGE/polymyth/coherence/Polymyth_Coherence_AI_Application_Protocol_V5.1.2.md",
    "SITE_PACKAGE/polymyth/coherence/Polymyth_Coherence_Assessment_Schema_V5.1.2.json",
    "SITE_PACKAGE/polymyth/coherence/index.html",
    "SITE_PACKAGE/public/polymyth/coherence/index.html",
    "SITE_PACKAGE/public/polymyth/coherence/Polymyth_Coherence_Assessment_Instrument_V5.1.2.xlsx",
    "SITE_PACKAGE/public/polymyth/coherence/Polymyth_Coherence_AI_Application_Protocol_V5.1.2.md",
    "SITE_PACKAGE/public/polymyth/coherence/Polymyth_Coherence_Assessment_Schema_V5.1.2.json",
    "EDITABLE_MASTERS/07_POLYMYTH_COHERENCE/Polymyth_Coherence_Assessment_Instrument.xlsx",
    "EDITABLE_MASTERS/07_POLYMYTH_COHERENCE/Polymyth_Coherence_Worked_Applications.xlsx",
    "EDITABLE_MASTERS/07_POLYMYTH_COHERENCE/README.md",
    "EDITABLE_MASTERS/01_RHETORIC_TAXONOMY/Polymyth_Rhetoric_Taxonomy_Continuously_Editable_Master_v2.xlsx",
    "EDITABLE_MASTERS/02_MEDUSA_GORGONWARS/Medusa_Speaking_Snakehair_Evidence_Ledger.xlsx",
    "EDITABLE_MASTERS/02_MEDUSA_GORGONWARS/gorgonwars-conversation-source-ledger-2026-07-27.txt",
    "EDITABLE_MASTERS/03_METOO_DISSENT/metoo_foundational_dissent_research_audit_2026-07-27.xlsx",
    "EDITABLE_MASTERS/03_METOO_DISSENT/metoo_foundational_dissent_full_archive_2026-07-28.xlsx",
    "EDITABLE_MASTERS/04_POLYMYTH_COMMONS/polymyth-commons-book-backbone.xlsx",
    "EDITABLE_MASTERS/05_POLYMYTHCAL/Polymythcal_Research_and_Remediation_Plan.json",
    "EDITABLE_MASTERS/06_OTHER_ONGOING_RESEARCH/israeli_official_rhetoric_chronology_editable_v4.docx",
    "EDITABLE_MASTERS/README_FIRST.md",
    "EDITABLE_MASTERS/EDITABLE_MASTERS_MANIFEST.json",
    "EDITABLE_MASTERS/SHA256SUMS.txt",
    "DEPLOY_TOOLS/README_NEXT_DEPLOY.txt",
    "SITE_PACKAGE/WEBSITE_FUTUREPROOFING_CONTRACTS_AUDIT_2026-08-09.md",
    "SITE_PACKAGE/polymyth/devilsdiary/11/index.html",
    "SITE_PACKAGE/public/polymyth/devilsdiary/11/index.html",
    "SITE_PACKAGE/polymyth/devilsdiary/img/linkedin-marriage-merger-screenshot-2026-08-12.png",
    "SITE_PACKAGE/public/polymyth/devilsdiary/img/linkedin-marriage-merger-screenshot-2026-08-12.png",
    "SITE_PACKAGE/FUTUREPROOFING_RELEASE_CONTRACT_2026-08-09.md",
    "SITE_PACKAGE/data/futureproofing/futureproofing-contract.json",
    "SITE_PACKAGE/data/futureproofing/approved-change-deletion-ledger.json",
    "SITE_PACKAGE/data/futureproofing/canonical-ownership-map.json",
    "SITE_PACKAGE/data/futureproofing/public-private-boundary.json",
    "SITE_PACKAGE/data/article-body-fingerprints.json",
    "SITE_PACKAGE/data/browser-test-tiers.json",
    "SITE_PACKAGE/data/live-evidence-policy.json",
    "SITE_PACKAGE/data/harvest-source-history.json",
    "SITE_PACKAGE/data/external-destination-contracts.json",
    "SITE_PACKAGE/data/polymythcal-destination-overrides.json",
    "SITE_PACKAGE/data/route-tombstones.json",
    "SITE_PACKAGE/data/versioned-data-contracts.json",
    "SITE_PACKAGE/.github/workflows/browser-assurance.yml",
    "SITE_PACKAGE/scripts/verify-futureproofing-contract.py",
    "SITE_PACKAGE/scripts/run-with-build-lock.py",
    "SITE_PACKAGE/scripts/build_lock.py",
    "SITE_PACKAGE/scripts/assert-build-lock.py",
    "SITE_PACKAGE/scripts/artifact_receipt.py",
    "SITE_PACKAGE/scripts/create-artifact-audit-receipt.py",
    "SITE_PACKAGE/scripts/verify-artifact-audit-receipt.py",
    "SITE_PACKAGE/scripts/verify-clean-room-release.py",
    "SITE_PACKAGE/scripts/build-clean-room-release.py",
    "SITE_PACKAGE/scripts/clean_room_copy.py",
    "SITE_PACKAGE/scripts/audit_python_dependencies.py",
    "SITE_PACKAGE/requirements-audit.txt",
    "SITE_PACKAGE/requirements-audit.lock",
    "SITE_PACKAGE/scripts/editable_masters_integrity.py",
    "SITE_PACKAGE/scripts/package-front-facing-mephistodata-release.py",
    "SITE_PACKAGE/scripts/package_integrity.py",
    "SITE_PACKAGE/scripts/package_selection.py",
    "SITE_PACKAGE/scripts/atomic_json.py",
    "SITE_PACKAGE/scripts/lib/external-destination-contracts.js",
    "SITE_PACKAGE/scripts/apply-polymythcal-destination-specificity.js",
    "SITE_PACKAGE/scripts/update-polymythcal-destination-contract.js",
    "SITE_PACKAGE/scripts/test-external-destination-contracts.js",
    "SITE_PACKAGE/scripts/verify-external-destination-contracts.js",
    "SITE_PACKAGE/scripts/verify-polymythcal-destination-specificity.js",
    "SITE_PACKAGE/scripts/verify-polymythcal-destination-browser.js",
    "SITE_PACKAGE/scripts/fixtures/futureproofing/external-destinations/invalid-destinations.json",
    "SITE_PACKAGE/scripts/reports/release-gate-report.json",
    "SITE_PACKAGE/scripts/reports/futureproofing-gate-report.json",
    "SITE_PACKAGE/RELEASE_MANIFEST.json",
    "SITE_PACKAGE/RELEASE_ID.txt",
    "SITE_PACKAGE/scripts/verify-disaster-recovery.py",
    "SITE_PACKAGE/scripts/verify-public-private-boundary.py",
    "SITE_PACKAGE/scripts/reports/futureproofing-fp07-fp10-targeted-tests.json",
    "SITE_PACKAGE/scripts/reports/futureproofing-browser-family-report.json",
}
FORBIDDEN_DELIVERY_SUFFIXES = {
    "Polymyth_Coherence_V5.1.1.xlsx",
    "07_POLYMYTH_COHERENCE/Polymyth_Coherence.xlsx",
}


def manifest_row(manifest: dict, relative: str) -> dict:
    matches = [row for row in manifest.get("files", []) if row.get("path") == relative]
    if len(matches) != 1:
        raise SystemExit(f"Package manifest expected exactly one {relative} row; found {len(matches)}.")
    return matches[0]


def portable_core_length_metrics(text: str, utf8_bytes: int | None = None) -> dict[str, int]:
    return {
        "unicode_code_points": len(text),
        "utf16_units": len(text.encode("utf-16-le")) // 2,
        "utf8_bytes": len(text.encode("utf-8")) if utf8_bytes is None else utf8_bytes,
    }


def validate_portable_core_length(text: str, utf8_bytes: int | None = None) -> dict[str, int]:
    metrics = portable_core_length_metrics(text, utf8_bytes)
    if metrics["utf16_units"] > CORE_MAX_CHARACTERS:
        raise ValueError(
            f"portable CORE exceeds the {CORE_MAX_CHARACTERS}-UTF-16-unit "
            f"Personal Rules limit (utf16_units={metrics['utf16_units']}; informational: "
            f"unicode_code_points={metrics['unicode_code_points']}, utf8_bytes={metrics['utf8_bytes']})."
        )
    return metrics


def require_portable_core_equality() -> tuple[int, str]:
    charter = SITE_ROOT / "CHARTER.txt"
    delivered = DELIVERY_ROOT / "Mephistodata_CORE_Personal_Rules_2026-08-12.md"
    if not charter.is_file() or not delivered.is_file():
        raise SystemExit("Portable CORE package mirrors are missing.")
    charter_bytes = charter.read_bytes()
    if charter_bytes != delivered.read_bytes():
        raise SystemExit("Refusing package: CHARTER.txt and delivered Personal Rules differ.")
    try:
        charter_text = charter_bytes.decode("utf-8")
    except UnicodeDecodeError as error:
        raise SystemExit(f"Refusing package: portable CORE is not valid UTF-8: {error}") from error
    try:
        validate_portable_core_length(charter_text, len(charter_bytes))
    except ValueError as error:
        raise SystemExit(f"Refusing package: {error}") from error
    return charter.stat().st_size, file_sha256(charter)


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
    require_release_build_lock(DELIVERY_ROOT)

    output = args.output.resolve()
    release = {
        "release_id": args.release_id,
        "generated_at": args.generated_at,
    }
    core_bytes, core_sha256 = require_portable_core_equality()

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
    site_core_row = manifest_row(site_manifest, "CHARTER.txt")
    if site_core_row["bytes"] != core_bytes or site_core_row["sha256"] != core_sha256:
        raise SystemExit("Inner SITE_PACKAGE manifest does not bind the verified portable CORE bytes.")
    write_manifest(SITE_ROOT / MANIFEST_NAME, site_manifest)

    delivery_files, delivery_selection = collect_package_files(DELIVERY_ROOT, output)
    selected = {source.relative_to(DELIVERY_ROOT).as_posix() for source in delivery_files}
    missing = sorted(REQUIRED_DELIVERY_FILES - selected)
    if missing:
        raise SystemExit(
            "Refusing incomplete handoff; required current release files are missing: "
            + ", ".join(missing)
        )
    forbidden = sorted(
        relative for relative in selected
        if any(relative.endswith(suffix) for suffix in FORBIDDEN_DELIVERY_SUFFIXES)
    )
    if forbidden:
        raise SystemExit(
            "Refusing handoff with retired Coherence files: " + ", ".join(forbidden)
        )
    result = write_verified_archive(
        DELIVERY_ROOT,
        output,
        delivery_files,
        release,
        "seminar-schools-complete-editable-masters-source-and-public",
    )
    archive_manifest = result["manifest"]
    archive_charter = manifest_row(archive_manifest, "SITE_PACKAGE/CHARTER.txt")
    archive_delivered = manifest_row(
        archive_manifest,
        "Mephistodata_CORE_Personal_Rules_2026-08-12.md",
    )
    if archive_charter != {
        "path": "SITE_PACKAGE/CHARTER.txt",
        "bytes": core_bytes,
        "sha256": core_sha256,
    }:
        raise SystemExit("Outer package manifest does not bind the verified SITE_PACKAGE portable CORE.")
    if archive_delivered != {
        "path": "Mephistodata_CORE_Personal_Rules_2026-08-12.md",
        "bytes": core_bytes,
        "sha256": core_sha256,
    }:
        raise SystemExit("Outer package manifest does not bind the verified delivered Personal Rules.")
    if archive_charter["bytes"] != site_core_row["bytes"] or archive_charter["sha256"] != site_core_row["sha256"]:
        raise SystemExit("Inner and outer package manifests disagree on portable CORE bytes.")
    write_manifest(DELIVERY_ROOT / MANIFEST_NAME, archive_manifest)

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
