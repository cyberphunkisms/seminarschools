#!/usr/bin/env python3
"""Create the complete Mephistodata/front-facing editable-masters release."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import shutil
import subprocess
import sys

from package_integrity import file_sha256, write_verified_archive
from package_selection import collect_package_files, is_reconstruction_duplicate
from build_lock import require_release_build_lock


SITE_ROOT = Path(__file__).resolve().parents[1]
DELIVERY_ROOT = SITE_ROOT.parent
MANIFEST_NAME = "PACKAGE_CONTENTS_SHA256.json"
CORE_MAX_CHARACTERS = 5000
EXPECTED_PACKAGE_RELEASE_ID = (
    "core-coreplus-mephistodata-degorgonified-feminism-retrieval-enforcement-complete-2026-09-05"
)
EXPECTED_PACKAGE_GENERATED_AT = "2026-09-05T20:15:00Z"
REQUIRED_DELIVERY_FILES = {
    "README_FIRST.txt",
    "UPDATE_SOURCES/ML_STAR_UPDATE_SOURCE_DEGORGONIFIED_FEMINISM_RETRIEVAL_ENFORCEMENT_2026-09-05.md",
    "UPDATE_SOURCES/ML_STAR_UPDATE_SOURCE_FEMINISM_ACADEMIC_RESEARCH_GORGONIFICATION_2026-09-05.md",
    "UPDATE_SOURCES/ML_STAR_UPDATE_SOURCE_TRUTHFUL_WORK_CLAIMS_2026-09-05.md",
    "SITE_PACKAGE/UPDATE_SOURCES/ML_STAR_UPDATE_SOURCE_FEMINISM_ACADEMIC_RESEARCH_GORGONIFICATION_2026-09-05.md",
    "SITE_PACKAGE/UPDATE_SOURCES/ML_STAR_UPDATE_SOURCE_DEGORGONIFIED_FEMINISM_RETRIEVAL_ENFORCEMENT_2026-09-05.md",
    "SITE_PACKAGE/UPDATE_SOURCES/ML_STAR_UPDATE_SOURCE_BOTTOM_UP_DEFINITION_DEFECT_PROVENANCE_INTERNAL_RETRIEVAL_2026-09-03.md",
    "SITE_PACKAGE/UPDATE_SOURCES/ML_STAR_UPDATE_SOURCE_TRUTHFUL_WORK_CLAIMS_2026-09-05.md",
    "SITE_PACKAGE/UPDATE_SOURCES/TRUTHFUL_WORK_CLAIM_SCREENSHOTS_2026-09-05/b4f6ab5a-4eb3-44d0-943e-41acd52faec9.png",
    "SITE_PACKAGE/UPDATE_SOURCES/TRUTHFUL_WORK_CLAIM_SCREENSHOTS_2026-09-05/3066e1d8-f6f9-4267-a948-90c076e29f93.png",
    "UPDATE_SOURCES/ML_STAR_UPDATE_SOURCE_GORGON_FREE_SPEECH_EVIDENCE_CONTROL_2026-08-24.md",
    "SITE_PACKAGE/UPDATE_SOURCES/MEPHISTODATA_REGISTER_ACTIVATION_RECOVERY_2026-08-30.md",
    "SITE_PACKAGE/UPDATE_SOURCES/MEPHISTODATA_REGISTER_ACTIVATION_SCREENSHOTS_2026-08-30/04648eb9-885c-43c7-ad53-ca6af390fa0c.png",
    "SITE_PACKAGE/UPDATE_SOURCES/MEPHISTODATA_REGISTER_ACTIVATION_SCREENSHOTS_2026-08-30/13912ef0-3924-4d11-bae9-6bab8d294b93.png",
    "SITE_PACKAGE/UPDATE_SOURCES/MEPHISTODATA_REGISTER_ACTIVATION_SCREENSHOTS_2026-08-30/0fd75220-92bf-4df1-89e9-a90893430fdc.png",
    "SITE_PACKAGE/UPDATE_SOURCES/MEPHISTODATA_REGISTER_ACTIVATION_SCREENSHOTS_2026-08-30/a9c4d9d2-16e6-4995-9064-4db5bc5d484e.png",
    "SITE_PACKAGE/UPDATE_SOURCES/MEPHISTODATA_REGISTER_ACTIVATION_SCREENSHOTS_2026-08-30/097d5008-8e7c-4b24-822f-88a04fd1e7e7.png",
    "SITE_PACKAGE/UPDATE_SOURCES/MEPHISTODATA_REGISTER_ACTIVATION_SCREENSHOTS_2026-08-30/d1557ac1-79e1-4038-8521-edba929b8e29.png",
    "SITE_PACKAGE/UPDATE_SOURCES/MEPHISTODATA_REGISTER_ACTIVATION_SCREENSHOTS_2026-08-30/ca5c05c1-5e8f-4997-9409-0a83f3bbf302.png",
    "SITE_PACKAGE/UPDATE_SOURCES/MEPHISTODATA_REGISTER_ACTIVATION_SCREENSHOTS_2026-08-30/b2726035-3129-4117-99ad-76d4ae8c12de.png",
    "SITE_PACKAGE/UPDATE_SOURCES/NON_STRAWMAN_CURRENT_POSITION_CORRECTION_2026-08-29.md",
    "SITE_PACKAGE/UPDATE_SOURCES/DETIENNE_COMPARING_THE_INCOMPARABLE_POLYMYTH_MASTER_NOTES_2026-08-28.md",
    "SITE_PACKAGE/UPDATE_SOURCES/DETIENNE_CHAPTER_LEDGERS_2026-08-27/README.md",
    "SITE_PACKAGE/UPDATE_SOURCES/DETIENNE_CHAPTER_LEDGERS_2026-08-27/01_FOREWORD_AND_CHAPTER_1.md",
    "SITE_PACKAGE/UPDATE_SOURCES/DETIENNE_CHAPTER_LEDGERS_2026-08-27/02_CONSTRUCTING_COMPARABLES.md",
    "SITE_PACKAGE/UPDATE_SOURCES/DETIENNE_CHAPTER_LEDGERS_2026-08-27/03_REGIMES_OF_HISTORICITY.md",
    "SITE_PACKAGE/UPDATE_SOURCES/DETIENNE_CHAPTER_LEDGERS_2026-08-27/04_POLYTHEISMS.md",
    "SITE_PACKAGE/UPDATE_SOURCES/DETIENNE_CHAPTER_LEDGERS_2026-08-27/05_ASSEMBLY_AND_POLITICS.md",
    "SITE_PACKAGE/UPDATE_SOURCES/DETIENNE_CHAPTER_LEDGERS_2026-08-27/06_ENDNOTES_AND_SOURCE_LINEAGE.md",
    "Mephistodata_CORE_Personal_Rules_2026-08-12.md",
    "SITE_PACKAGE/CHARTER.txt",
    "SITE_PACKAGE/PACKAGE_CONTENTS_SHA256.json",
    "SITE_PACKAGE/polymyth/methodologylist/index.html",
    "SITE_PACKAGE/polymyth/methodologylist.txt",
    "SITE_PACKAGE/polymyth/manifest.txt",
    "SITE_PACKAGE/public/polymyth/methodologylist/index.html",
    "SITE_PACKAGE/public/polymyth/methodologylist.txt",
    "SITE_PACKAGE/public/polymyth/manifest.txt",
    "SITE_PACKAGE/polymyth/concordance/index.html",
    "SITE_PACKAGE/polymyth/concordance/concordance-index.json",
    "SITE_PACKAGE/polymyth/concordance/vocabulary.json",
    "SITE_PACKAGE/public/polymyth/concordance/index.html",
    "SITE_PACKAGE/public/polymyth/concordance/concordance-index.json",
    "SITE_PACKAGE/public/polymyth/concordance/vocabulary.json",
    "SITE_PACKAGE/hf_export/data/ml/sections/framework-core.jsonl",
    "SITE_PACKAGE/hf_export/data/ml/sections/analysis.jsonl",
    "SITE_PACKAGE/hf_export/data/ml/sections/citation.jsonl",
    "SITE_PACKAGE/hf_export/data/ml/sections/corehistory.jsonl",
    "SITE_PACKAGE/hf_export/data/ml/sections/coreplus.jsonl",
    "SITE_PACKAGE/hf_export/data/ml/sections/degorgonification.jsonl",
    "SITE_PACKAGE/hf_export/data/ml/sections/gorgonification.jsonl",
    "SITE_PACKAGE/hf_export/data/ml/sections/idiomary.jsonl",
    "SITE_PACKAGE/hf_export/data/ml/sections/learnings.jsonl",
    "SITE_PACKAGE/hf_export/data/ml/sections/methodology.jsonl",
    "SITE_PACKAGE/hf_export/data/ml/sections/pending-user-authorship.jsonl",
    "SITE_PACKAGE/hf_export/data/ml/sections/pending.jsonl",
    "SITE_PACKAGE/hf_export/data/ml/sections/polycognate.jsonl",
    "SITE_PACKAGE/hf_export/data/ml/sections/rainbowsol.jsonl",
    "SITE_PACKAGE/hf_export/data/ml/sections/sabachtan.jsonl",
    "SITE_PACKAGE/hf_export/data/ml/sections/studylist.jsonl",
    "SITE_PACKAGE/hf_export/data/ml/methodologylist.jsonl",
    "SITE_PACKAGE/hf_export/data/all_meaninglib_rows.jsonl",
    "SITE_PACKAGE/hf_export/search/meaninglib_search_index.json",
    "SITE_PACKAGE/hf_export/ai_access_pack/latest_access_pack.json",
    "SITE_PACKAGE/hf_export/ai_access_pack/latest_access_pack.md",
    "SITE_PACKAGE/scripts/sync-core-personal-rules.js",
    "SITE_PACKAGE/scripts/verify-core-coreplus-alignment.js",
    "SITE_PACKAGE/ML_EXECUTION_AND_CONTROLLED_ARCHIVE_SYNTHESIS_2026-08-26.md",
    "SITE_PACKAGE/polymyth/methodologylist/mephistodata-rule-hardening-addendum.js",
    "SITE_PACKAGE/public/polymyth/methodologylist/mephistodata-rule-hardening-addendum.js",
    "SITE_PACKAGE/polymyth/methodologylist/mephistodata-register-fixtures.json",
    "SITE_PACKAGE/scripts/fixtures/ml-execution-gates/fixtures.json",
    "SITE_PACKAGE/scripts/fixtures/ml-execution-gates/adjudication-v2-fixtures.json",
    "SITE_PACKAGE/scripts/fixtures/ml-execution-gates/internal-writing-fixtures.json",
    "SITE_PACKAGE/scripts/verify-ml-execution-gates.js",
    "SITE_PACKAGE/scripts/lib/mephistodata-runtime-gate.js",
    "SITE_PACKAGE/scripts/fixtures/ml-execution-gates/mephistodata-runtime-gate-hostile-fixtures.json",
    "SITE_PACKAGE/scripts/verify-mephistodata-runtime-gate.js",
    "SITE_PACKAGE/scripts/verify-ml-active-form-conflicts.js",
    "SITE_PACKAGE/data/baseline-morality-amendment-scope-contract.json",
    "SITE_PACKAGE/scripts/verify-baseline-morality-amendment-scope.js",
    "SITE_PACKAGE/scripts/test-baseline-morality-amendment-scope.js",
    "SITE_PACKAGE/scripts/verify-ml-project-adjudication-v2.js",
    "SITE_PACKAGE/data/author-sources/saul-writing-rules-deep-scan-2026-08-29.md",
    "SITE_PACKAGE/scripts/fixtures/ml-writing-rules/fixtures.json",
    "SITE_PACKAGE/scripts/lib/ml-writing-lint.js",
    "SITE_PACKAGE/scripts/verify-ml-writing-rules.js",
    "SITE_PACKAGE/polymyth/articles/be-kind-while-we-exploit-you.md",
    "SITE_PACKAGE/public/polymyth/articles/be-kind-while-we-exploit-you.md",
    "SITE_PACKAGE/polymyth/articles/the-struggle-to-control-ai.md",
    "SITE_PACKAGE/public/polymyth/articles/the-struggle-to-control-ai.md",
    "SITE_PACKAGE/scripts/verify-mephistodata-articles.js",
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
    "SITE_PACKAGE/data/futureproofing/aug26-package-contents-baseline.json",
    "SITE_PACKAGE/data/futureproofing/aug26-aug27-preservation-contract.json",
    "SITE_PACKAGE/data/futureproofing/aug30-package-contents-baseline.json",
    "SITE_PACKAGE/data/futureproofing/aug30-aug31-preservation-contract.json",
    "SITE_PACKAGE/data/futureproofing/aug31-package-contents-baseline.json",
    "SITE_PACKAGE/data/futureproofing/aug31-sep3-preservation-contract.json",
    "SITE_PACKAGE/data/futureproofing/sep3-package-contents-baseline.json",
    "SITE_PACKAGE/data/futureproofing/sep3-sep5-preservation-contract.json",
    "SITE_PACKAGE/data/futureproofing/sep5-package-contents-baseline.json",
    "SITE_PACKAGE/data/futureproofing/sep5-truthful-sep5-feminism-preservation-contract.json",
    "SITE_PACKAGE/data/futureproofing/sep5-feminism-package-contents-baseline.json",
    "SITE_PACKAGE/data/futureproofing/sep5-feminism-sep5-degorgonified-feminism-preservation-contract.json",
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
    "SITE_PACKAGE/scripts/test_futureproofing_contracts.py",
    "SITE_PACKAGE/scripts/verify-futureproofing-base-preservation.py",
    "SITE_PACKAGE/scripts/verify-aug31-base-preservation.py",
    "SITE_PACKAGE/scripts/verify-sep3-base-preservation.py",
    "SITE_PACKAGE/scripts/verify-sep5-base-preservation.py",
    "SITE_PACKAGE/scripts/verify-sep5-feminism-base-preservation.py",
    "SITE_PACKAGE/scripts/verify-sep5-degorgonified-feminism-base-preservation.py",
    "SITE_PACKAGE/scripts/verify-aug27-base-preservation.py",
    "SITE_PACKAGE/scripts/verify-audit53-historical-provenance.py",
    "SITE_PACKAGE/scripts/fixtures/futureproofing/aug27-preservation-tampered.json",
    "SITE_PACKAGE/scripts/fixtures/futureproofing/aug31-preservation-tampered.json",
    "SITE_PACKAGE/scripts/fixtures/futureproofing/sep3-preservation-tampered.json",
    "SITE_PACKAGE/scripts/fixtures/futureproofing/sep5-preservation-tampered.json",
    "SITE_PACKAGE/scripts/fixtures/futureproofing/sep5-feminism-preservation-tampered.json",
    "SITE_PACKAGE/scripts/fixtures/futureproofing/sep5-degorgonified-feminism-preservation-tampered.json",
    "SITE_PACKAGE/scripts/build-public-deploy.js",
    "SITE_PACKAGE/scripts/verify-public-deploy-parity.js",
    "SITE_PACKAGE/scripts/run-with-build-lock.py",
    "SITE_PACKAGE/scripts/build_lock.py",
    "SITE_PACKAGE/scripts/lib/public-build-lock.js",
    "SITE_PACKAGE/scripts/verify-public-build-lock-recovery.js",
    "SITE_PACKAGE/scripts/assert-build-lock.py",
    "SITE_PACKAGE/scripts/artifact_receipt.py",
    "SITE_PACKAGE/scripts/package-complete-current.py",
    "SITE_PACKAGE/scripts/create-artifact-audit-receipt.py",
    "SITE_PACKAGE/scripts/verify-artifact-audit-receipt.py",
    "SITE_PACKAGE/scripts/verify-clean-room-release.py",
    "SITE_PACKAGE/scripts/build-clean-room-release.py",
    "SITE_PACKAGE/scripts/verify-complete-archive-classes.py",
    "SITE_PACKAGE/scripts/verify-release-gates.js",
    "SITE_PACKAGE/scripts/clean_room_copy.py",
    "SITE_PACKAGE/scripts/audit_python_dependencies.py",
    "SITE_PACKAGE/requirements-audit.txt",
    "SITE_PACKAGE/requirements-audit.lock",
    "SITE_PACKAGE/scripts/editable_masters_integrity.py",
    "SITE_PACKAGE/scripts/package-front-facing-mephistodata-release.py",
    "SITE_PACKAGE/scripts/package_integrity.py",
    "SITE_PACKAGE/scripts/package_selection.py",
    "SITE_PACKAGE/scripts/test-polymythcal-package-boundary.py",
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


def verify_current_release_state() -> None:
    """Fail closed before either preflight success or archive mutation."""
    node = shutil.which("node.exe" if sys.platform == "win32" else "node")
    if not node:
        raise SystemExit("Refusing package: Node.js is required for the release gate.")
    gates = (
        (
            "September 5 feminism-gate predecessor preservation",
            [
                sys.executable,
                str(
                    SITE_ROOT
                    / "scripts"
                    / "verify-sep5-degorgonified-feminism-base-preservation.py"
                ),
            ],
        ),
        (
            "September 5 degorgonified-feminism retrieval release",
            [node, str(SITE_ROOT / "scripts" / "verify-release-gates.js")],
        ),
    )
    for label, command in gates:
        completed = subprocess.run(command, cwd=SITE_ROOT, check=False)
        if completed.returncode != 0:
            raise SystemExit(f"Refusing package: {label} gate failed.")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("output", type=Path)
    parser.add_argument("--release-id", required=True)
    parser.add_argument("--generated-at", required=True)
    parser.add_argument(
        "--preflight",
        action="store_true",
        help=(
            "validate the current release and preservation gates plus the complete "
            "selection contract without writing manifests or a ZIP"
        ),
    )
    args = parser.parse_args()
    require_release_build_lock(DELIVERY_ROOT)

    output = args.output.resolve()
    release = {
        "release_id": args.release_id,
        "generated_at": args.generated_at,
    }
    if release != {
        "release_id": EXPECTED_PACKAGE_RELEASE_ID,
        "generated_at": EXPECTED_PACKAGE_GENERATED_AT,
    }:
        raise SystemExit(
            "Refusing package: release ID and generated-at must match the fixed "
            "September 5 degorgonified-feminism retrieval release."
        )
    verify_current_release_state()
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
    delivery_files, delivery_selection = collect_package_files(DELIVERY_ROOT, output)
    selected = {source.relative_to(DELIVERY_ROOT).as_posix() for source in delivery_files}
    transient_duplicates = sorted(
        relative for relative in selected if is_reconstruction_duplicate(relative)
    )
    if transient_duplicates:
        raise SystemExit(
            "Refusing handoff with transient mixed-case Detienne duplicates: "
            + ", ".join(transient_duplicates)
        )
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
    if args.preflight:
        print(
            json.dumps(
                {
                    "status": "passed",
                    "mode": "preflight",
                    "output": str(output),
                    "release_id": release["release_id"],
                    "generated_at": release["generated_at"],
                    "site_selection": site_selection,
                    "delivery_selection": delivery_selection,
                    "required_file_count": len(REQUIRED_DELIVERY_FILES),
                    "planned_site_manifest_file_count": site_manifest["file_count"],
                    "planned_delivery_file_count": len(delivery_files),
                },
                indent=2,
            )
        )
        return

    write_manifest(SITE_ROOT / MANIFEST_NAME, site_manifest)
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
