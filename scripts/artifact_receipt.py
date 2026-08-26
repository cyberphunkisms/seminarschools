#!/usr/bin/env python3
"""Create and verify an external receipt bound to one exact release ZIP."""
from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path, PurePosixPath
import platform
import re
import subprocess
import zipfile

from audit_python_dependencies import (
    ARCHIVE_LOCK_PATH,
    ARCHIVE_REQUIREMENTS_PATH,
    pinned_audit_requirements_evidence_from_bytes,
)
from editable_masters_integrity import EXPECTED_EDITABLE_MASTER_PATHS


SCHEMA = "seminar-schools-artifact-audit-receipt-v1"
SHA256_PATTERN = re.compile(r"^[a-f0-9]{64}$")
CHUNK = 1024 * 1024
SOURCE_STAGE_IDS = {
    "FP-02", "FP-03", "FP-04", "FP-05", "FP-07", "FP-08",
    "FP-09", "FP-10", "FP-11", "FP-12", "FP-13", "FP-15",
}
POST_PACKAGE_IDS = {"FP-01", "FP-06", "FP-14"}
REQUIRED_ROOTS = ["SITE_PACKAGE", "EDITABLE_MASTERS", "DEPLOY_TOOLS"]
EXPECTED_MANIFEST_SCHEMA = "seminar-schools-package-contents-v1"
EXPECTED_PACKAGE_KIND = "seminar-schools-complete-editable-masters-source-and-public"
EXPECTED_PACKAGE_RELEASE_ID = "core-coreplus-mephistodata-controlled-archive-polymythcal-v2-2026-08-26"
EXPECTED_CLEAN_ROOM_PIPELINE_ID = "npm-ci-build-full-verify-editable-package-v1"
EXPECTED_CLEAN_ROOM_HELPERS = (
    "SITE_PACKAGE/scripts/clean_room_copy.py",
    "SITE_PACKAGE/scripts/build_lock.py",
    "SITE_PACKAGE/scripts/run-with-build-lock.py",
    "SITE_PACKAGE/scripts/build-clean-room-release.py",
    "SITE_PACKAGE/scripts/editable_masters_integrity.py",
    "SITE_PACKAGE/scripts/package-front-facing-mephistodata-release.py",
    "SITE_PACKAGE/scripts/package_integrity.py",
    "SITE_PACKAGE/scripts/package_selection.py",
    "SITE_PACKAGE/scripts/audit_python_dependencies.py",
)
EXPECTED_CLEAN_ROOM_ACTIONS = (
    "copy_clean_source",
    "run_locked_build_helper",
    "install_pinned_python_audit_dependencies",
    "npm_clean_install",
    "canonical_build",
    "full_built_tree_verification",
    "verify_editable_masters",
    "package_complete_release",
)
EXPECTED_CLEAN_ENV_ALLOWLIST = (
    "PATH", "SystemRoot", "WINDIR", "COMSPEC", "PATHEXT",
    "CHROME_EXECUTABLE", "CHROME_PATH", "CHROMIUM_PATH",
    "PUPPETEER_EXECUTABLE_PATH", "PLAYWRIGHT_BROWSERS_PATH",
    "HTTP_PROXY", "HTTPS_PROXY", "NO_PROXY", "ALL_PROXY",
    "http_proxy", "https_proxy", "no_proxy", "all_proxy",
    "NPM_CONFIG_REGISTRY", "NPM_CONFIG_OFFLINE",
    "NPM_CONFIG_PROXY",
    "NPM_CONFIG_HTTPS_PROXY", "NPM_CONFIG_HTTP_PROXY", "NPM_CONFIG_NOPROXY",
    "NODE_EXTRA_CA_CERTS", "SSL_CERT_FILE", "SSL_CERT_DIR", "NODE_USE_ENV_PROXY",
    "PIP_NO_INDEX", "PIP_FIND_LINKS",
)


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(CHUNK), b""):
            digest.update(chunk)
    return digest.hexdigest()


def bytes_sha256(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def json_sha256(value: object) -> str:
    rendered = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return bytes_sha256(rendered.encode("utf-8"))


def expected_clean_pipeline_steps(release_id: str, generated_at: str) -> list[dict]:
    return [
        {
            "order": 1,
            "action": "copy_clean_source",
            "implementation": "SITE_PACKAGE/scripts/clean_room_copy.py",
        },
        {
            "order": 2,
            "action": "run_locked_build_helper",
            "argv": [
                "{python}",
                "SITE_PACKAGE/scripts/run-with-build-lock.py",
                "--delivery-root",
                "{clean_delivery_root}",
                "--",
                "{python}",
                "SITE_PACKAGE/scripts/build-clean-room-release.py",
                "{output_zip}",
                "--release-id",
                release_id,
                "--generated-at",
                generated_at,
            ],
        },
        {
            "order": 3,
            "action": "install_pinned_python_audit_dependencies",
            "implementation": "SITE_PACKAGE/scripts/audit_python_dependencies.py",
            "top_level_requirements": ARCHIVE_REQUIREMENTS_PATH,
            "resolved_lock": ARCHIVE_LOCK_PATH,
            "target": "{isolated_python_audit_target}",
            "argv": [
                "{python}",
                "-m",
                "pip",
                "install",
                "--disable-pip-version-check",
                "--no-input",
                "--require-hashes",
                "--target",
                "{isolated_python_audit_target}",
                "-r",
                ARCHIVE_LOCK_PATH,
            ],
        },
        {"order": 4, "action": "npm_clean_install", "argv": ["npm", "ci"]},
        {"order": 5, "action": "canonical_build", "argv": ["npm", "run", "build"]},
        {
            "order": 6,
            "action": "full_built_tree_verification",
            "argv": ["npm", "run", "verify:all:built"],
        },
        {
            "order": 7,
            "action": "verify_editable_masters",
            "implementation": "SITE_PACKAGE/scripts/editable_masters_integrity.py",
        },
        {
            "order": 8,
            "action": "package_complete_release",
            "argv": [
                "{python}",
                "SITE_PACKAGE/scripts/package-front-facing-mephistodata-release.py",
                "{output_zip}",
                "--release-id",
                release_id,
                "--generated-at",
                generated_at,
            ],
        },
    ]


def require_exact_post_package_gate(
    report: dict,
    *,
    label: str,
    schema: str,
) -> None:
    if report.get("schema") != schema:
        raise ValueError(f"{label} has the wrong schema")
    if (
        report.get("status") != "passed"
        or report.get("total_checks") != 5
        or report.get("passed_checks") != 5
        or report.get("failed_checks") != []
    ):
        raise ValueError(f"{label} must contain the exact canonical 5/5 checks")


def validate_clean_room_contract(report: dict) -> dict:
    """Validate that identical bytes came from the fixed clean-build pipeline."""
    require_exact_post_package_gate(
        report,
        label="clean-room report",
        schema="seminar-schools-clean-room-release-report-v1",
    )
    if report.get("mode") != "reference_rebuild" or report.get("canonical_pipeline") is not True:
        raise ValueError("clean-room report is not a canonical reference rebuild")
    if report.get("pipeline_id") != EXPECTED_CLEAN_ROOM_PIPELINE_ID:
        raise ValueError("clean-room report did not run the complete clean build pipeline")
    release_id = report.get("release_id")
    generated_at = report.get("generated_at")
    if release_id != EXPECTED_PACKAGE_RELEASE_ID or not isinstance(generated_at, str):
        raise ValueError("clean-room report has the wrong release identity")
    try:
        stamp = datetime.fromisoformat(generated_at.replace("Z", "+00:00"))
    except ValueError as error:
        raise ValueError("clean-room generated_at is not ISO-8601") from error
    if stamp.tzinfo is None:
        raise ValueError("clean-room generated_at has no timezone")

    snapshot = report.get("source_snapshot") or {}
    if (
        not SHA256_PATTERN.fullmatch(str(snapshot.get("tree_sha256") or ""))
        or type(snapshot.get("file_count")) is not int
        or snapshot["file_count"] < 1
        or type(snapshot.get("total_bytes")) is not int
        or snapshot["total_bytes"] < 1
    ):
        raise ValueError("clean-room source snapshot evidence is incomplete")
    if report.get("source_snapshot_matches_archive") is not True:
        raise ValueError("clean-room report does not bind its prebuild snapshot to the archive")
    if report.get("archive_rebuild_inputs") != snapshot:
        raise ValueError("clean-room archive inputs differ from its prebuild snapshot")

    helpers = report.get("pipeline_helpers") or []
    if [row.get("path") for row in helpers if isinstance(row, dict)] != list(EXPECTED_CLEAN_ROOM_HELPERS):
        raise ValueError("clean-room helper set or ordering differs from the canonical pipeline")
    for row in helpers:
        if (
            type(row.get("bytes")) is not int
            or row["bytes"] < 1
            or not SHA256_PATTERN.fullmatch(str(row.get("sha256") or ""))
            or row.get("trusted_sha256") != row.get("sha256")
            or row.get("matches_trusted_helper") is not True
        ):
            raise ValueError("clean-room helper evidence is malformed")

    steps = report.get("pipeline_steps")
    if steps != expected_clean_pipeline_steps(release_id, generated_at):
        raise ValueError("clean-room pipeline steps differ from the canonical sequence")
    if tuple(row.get("action") for row in steps) != EXPECTED_CLEAN_ROOM_ACTIONS:
        raise ValueError("clean-room pipeline actions differ from the canonical sequence")

    pinned_dependencies = report.get("pinned_python_audit_dependencies") or {}
    pinned_requirements = pinned_dependencies.get("requirements")
    locked_distributions = pinned_dependencies.get("locked_distributions")
    installed_distributions = pinned_dependencies.get("installed_distributions")
    if (
        report.get("pinned_python_audit_dependencies_verified") is not True
        or pinned_dependencies.get("requirements_path") != ARCHIVE_REQUIREMENTS_PATH
        or type(pinned_dependencies.get("bytes")) is not int
        or pinned_dependencies["bytes"] < 1
        or not SHA256_PATTERN.fullmatch(str(pinned_dependencies.get("sha256") or ""))
        or type(pinned_dependencies.get("requirement_count")) is not int
        or pinned_dependencies["requirement_count"] < 1
        or not isinstance(pinned_requirements, list)
        or len(pinned_requirements) != pinned_dependencies["requirement_count"]
        or len(pinned_requirements) != len(set(pinned_requirements))
        or pinned_dependencies.get("all_top_level_requirements_exactly_pinned") is not True
        or pinned_dependencies.get("lock_path") != ARCHIVE_LOCK_PATH
        or type(pinned_dependencies.get("lock_bytes")) is not int
        or pinned_dependencies["lock_bytes"] < 1
        or not SHA256_PATTERN.fullmatch(str(pinned_dependencies.get("lock_sha256") or ""))
        or type(pinned_dependencies.get("locked_distribution_count")) is not int
        or not isinstance(locked_distributions, list)
        or len(locked_distributions) != pinned_dependencies["locked_distribution_count"]
        or len(locked_distributions) != len(set(locked_distributions))
        or pinned_dependencies.get("top_level_pins_present_in_lock") is not True
        or pinned_dependencies.get("installed_distribution_count")
        != pinned_dependencies.get("locked_distribution_count")
        or installed_distributions != locked_distributions
        or pinned_dependencies.get("installed_inventory_matches_lock") is not True
    ):
        raise ValueError("clean-room pinned Python audit dependency evidence is malformed")

    inputs = report.get("external_inputs") or {}
    if inputs.get("allowlisted_inherited_names") != list(EXPECTED_CLEAN_ENV_ALLOWLIST):
        raise ValueError("clean-room inherited environment allowlist drifted")
    fingerprints = inputs.get("inherited_value_fingerprints") or {}
    if not isinstance(fingerprints, dict) or not set(fingerprints).issubset(EXPECTED_CLEAN_ENV_ALLOWLIST):
        raise ValueError("clean-room evidence contains a non-allowlisted inherited input")
    for name, row in fingerprints.items():
        if (
            not isinstance(row, dict)
            or type(row.get("bytes")) is not int
            or row["bytes"] < 1
            or not SHA256_PATTERN.fullmatch(str(row.get("sha256") or ""))
        ):
            raise ValueError(f"clean-room inherited input fingerprint is malformed: {name}")
    fixed = inputs.get("fixed_values") or {}
    expected_fixed = {
        "TZ": "UTC",
        "LC_ALL": "C",
        "LANG": "C",
        "PYTHONHASHSEED": "0",
        "SOURCE_DATE_EPOCH": str(int(stamp.timestamp())),
        "CI": "1",
        "NPM_CONFIG_AUDIT": "false",
        "NPM_CONFIG_FUND": "false",
        "NPM_CONFIG_UPDATE_NOTIFIER": "false",
        "VERIFY_ALL_CONCURRENCY": "4",
        "VERIFY_ALL_COMMAND_TIMEOUT_MS": "2700000",
        "SS_CLEAN_ROOM_CANONICAL_PIPELINE": EXPECTED_CLEAN_ROOM_PIPELINE_ID,
    }
    if fixed != expected_fixed:
        raise ValueError("clean-room fixed environment differs from the canonical contract")
    isolated = set(inputs.get("isolated_paths") or [])
    if not {
        "HOME", "USERPROFILE", "TMPDIR", "TMP", "TEMP",
        "NPM_CONFIG_USERCONFIG", "NPM_CONFIG_CACHE",
    }.issubset(isolated):
        raise ValueError("clean-room environment paths were not isolated")
    python = inputs.get("python") or {}
    if not python.get("executable") or not python.get("version"):
        raise ValueError("clean-room Python provenance is missing")
    executables = inputs.get("executable_files") or []
    executable_names = [row.get("name") for row in executables if isinstance(row, dict)]
    if (
        not executables
        or len(executable_names) != len(set(executable_names))
        or not {"python", "node", "npm"}.issubset(executable_names)
    ):
        raise ValueError("clean-room executable input evidence is incomplete")
    for row in executables:
        if (
            not row.get("configured_path")
            or row.get("regular_file") is False
            or type(row.get("bytes")) is not int
            or row["bytes"] < 1
            or not SHA256_PATTERN.fullmatch(str(row.get("sha256") or ""))
            or row.get("clean_room_host_attested") is not True
        ):
            raise ValueError(f"clean-room executable fingerprint is malformed: {row.get('name')}")
    return {
        "mode": "reference_rebuild",
        "canonical_pipeline": True,
        "pipeline_id": EXPECTED_CLEAN_ROOM_PIPELINE_ID,
        "release_id": release_id,
        "generated_at": generated_at,
        "source_snapshot": snapshot,
        "source_snapshot_matches_archive": True,
        "archive_rebuild_inputs": snapshot,
        "pipeline_helpers": helpers,
        "pipeline_steps_sha256": json_sha256(steps),
        "pinned_python_audit_dependencies": pinned_dependencies,
        "pinned_python_audit_dependencies_verified": True,
        "external_inputs_sha256": json_sha256(inputs),
    }


def create_executable_rehash_attestation(clean_room_report: dict) -> dict:
    """Rehash every locally available clean-host executable at receipt creation."""
    rows = []
    for source in (clean_room_report.get("external_inputs") or {}).get("executable_files") or []:
        resolved = Path(str(source.get("resolved_path") or ""))
        locally_available = resolved.is_file()
        if locally_available:
            actual_bytes = resolved.stat().st_size
            actual_sha256 = file_sha256(resolved)
            if actual_bytes != source.get("bytes") or actual_sha256 != source.get("sha256"):
                raise ValueError(
                    f"clean-room executable changed before receipt creation: {source.get('name')}"
                )
        rows.append(
            {
                "name": source.get("name"),
                "bytes": source.get("bytes"),
                "sha256": source.get("sha256"),
                "clean_room_host_attested": True,
                "locally_rehashed_at_receipt_creation": locally_available,
                "portable_verification_attestation": True,
            }
        )
    mandatory = {"python", "node", "npm"}
    by_name = {row.get("name"): row for row in rows}
    if not mandatory.issubset(by_name) or not all(
        by_name[name]["locally_rehashed_at_receipt_creation"] for name in mandatory
    ):
        raise ValueError("mandatory executables were not locally rehashed at receipt creation")
    return {
        "schema": "seminar-schools-executable-rehash-attestation-v1",
        "mandatory_executables": sorted(mandatory),
        "rows": rows,
        "portable_rule": (
            "Trust the archive-bound clean-host hash attestation; rehash again whenever the "
            "recorded resolved executable is locally available."
        ),
    }


def verify_executable_rehash_attestation(attestation: dict, clean_room_report: dict) -> None:
    if attestation.get("schema") != "seminar-schools-executable-rehash-attestation-v1":
        raise ValueError("receipt executable rehash attestation has the wrong schema")
    if attestation.get("mandatory_executables") != ["node", "npm", "python"]:
        raise ValueError("receipt executable rehash attestation omits mandatory tools")
    source_rows = (clean_room_report.get("external_inputs") or {}).get("executable_files") or []
    receipt_rows = attestation.get("rows") or []
    if [row.get("name") for row in receipt_rows] != [row.get("name") for row in source_rows]:
        raise ValueError("receipt executable rehash attestation tool set drifted")
    for receipt_row, source_row in zip(receipt_rows, source_rows):
        for field in ("name", "bytes", "sha256", "clean_room_host_attested"):
            if receipt_row.get(field) != source_row.get(field):
                raise ValueError(f"receipt executable attestation differs for {source_row.get('name')}")
        if receipt_row.get("portable_verification_attestation") is not True:
            raise ValueError("receipt executable row lacks a portable attestation")
        resolved = Path(str(source_row.get("resolved_path") or ""))
        if resolved.is_file() and (
            resolved.stat().st_size != source_row.get("bytes")
            or file_sha256(resolved) != source_row.get("sha256")
        ):
            raise ValueError(f"locally available executable differs: {source_row.get('name')}")


def read_json(path: Path) -> dict:
    value = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"JSON object required: {path}")
    return value


def command_version(command: list[str]) -> str | None:
    try:
        result = subprocess.run(
            command,
            check=True,
            capture_output=True,
            text=True,
            timeout=10,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    return (result.stdout or result.stderr).strip().splitlines()[0]


def archive_member_for(path: Path, delivery_root: Path) -> str:
    try:
        relative = Path(path).resolve().relative_to(Path(delivery_root).resolve())
    except ValueError as error:
        raise ValueError(f"receipt evidence must be inside the complete delivery root: {path}") from error
    member = relative.as_posix()
    if member == "PACKAGE_CONTENTS_SHA256.json":
        return member
    if PurePosixPath(member).is_absolute() or ".." in PurePosixPath(member).parts:
        raise ValueError(f"unsafe archive evidence member: {member}")
    return member


def validate_gate_report(report: dict, label: str) -> dict:
    if report.get("status") != "passed":
        raise ValueError(f"{label} is not passed")
    total = report.get("total_checks")
    passed = report.get("passed_checks")
    failed = report.get("failed_checks")
    if not isinstance(total, int) or total < 1:
        raise ValueError(f"{label} has no positive total_checks")
    if passed != total:
        raise ValueError(f"{label} passed_checks does not equal total_checks")
    if failed != []:
        raise ValueError(f"{label} records failed checks")
    if type(total) is not int or type(passed) is not int:
        raise ValueError(f"{label} check counts must be integers")
    return {"status": "passed", "total_checks": total, "passed_checks": passed, "failed_checks": []}


def validate_futureproofing_source_report(report: dict) -> dict:
    summary = validate_gate_report(report, "futureproofing source-stage report")
    executed = report.get("executed") or []
    executed_ids = {
        str(row.get("id") or "")
        for row in executed
        if isinstance(row, dict) and row.get("exit_code") == 0
    }
    if report.get("scope") != "source-stage":
        raise ValueError("futureproofing report does not identify its source-stage scope")
    if report.get("contract_total_controls") != 15 or report.get("implemented_controls") != 15:
        raise ValueError("futureproofing report does not bind all 15 registered controls")
    if set(report.get("source_stage_controls") or []) != SOURCE_STAGE_IDS:
        raise ValueError("futureproofing report has the wrong source-stage control set")
    if set(report.get("post_package_checks") or []) != POST_PACKAGE_IDS:
        raise ValueError("futureproofing report has the wrong deferred post-package set")
    if executed_ids != SOURCE_STAGE_IDS or len(executed) != len(SOURCE_STAGE_IDS):
        raise ValueError("futureproofing report did not execute every source-stage control")
    if summary["total_checks"] != len(SOURCE_STAGE_IDS):
        raise ValueError("futureproofing report overstates its executed check count")
    return summary


def manifested_archive_evidence(zipped: zipfile.ZipFile, embedded: dict) -> dict:
    """Recompute manifest, tree, root, and editable evidence from ZIP members."""
    rows = embedded.get("files") or []
    if embedded.get("file_count") != len(rows):
        raise ValueError("embedded package manifest count differs from its rows")
    names = zipped.namelist()
    expected_names = [row.get("path") for row in rows] + ["PACKAGE_CONTENTS_SHA256.json"]
    if names != expected_names or len(names) != len(set(names)):
        raise ValueError("archive members or ordering differ from the embedded manifest")
    tree_digest = hashlib.sha256()
    by_path: dict[str, dict] = {}
    for row in rows:
        name = str(row.get("path") or "")
        parsed = PurePosixPath(name)
        if not name or parsed.is_absolute() or ".." in parsed.parts:
            raise ValueError(f"unsafe manifested archive member: {name}")
        digest = hashlib.sha256()
        byte_count = 0
        with zipped.open(name, "r") as source:
            for chunk in iter(lambda: source.read(CHUNK), b""):
                digest.update(chunk)
                byte_count += len(chunk)
        actual = digest.hexdigest()
        if byte_count != row.get("bytes") or actual != row.get("sha256"):
            raise ValueError(f"archive member differs from embedded manifest: {name}")
        tree_digest.update(f"{name}\0{byte_count}\0{actual}\n".encode("utf-8"))
        by_path[name] = row
    roots = {PurePosixPath(name).parts[0] for name in by_path}
    if not set(REQUIRED_ROOTS).issubset(roots):
        raise ValueError("archive omits one or more required complete-handoff roots")
    editable_name = "EDITABLE_MASTERS/EDITABLE_MASTERS_MANIFEST.json"
    editable = json.loads(zipped.read(editable_name))
    editable_rows = editable.get("files") or []
    editable_paths = {str(row.get("path") or "") for row in editable_rows}
    if (
        editable.get("file_count") != 10
        or len(editable_rows) != 10
        or editable_paths != EXPECTED_EDITABLE_MASTER_PATHS
    ):
        raise ValueError("editable-masters manifest count differs from its rows")
    for row in editable_rows:
        outer_name = f"EDITABLE_MASTERS/{row.get('path')}"
        outer = by_path.get(outer_name) or {}
        if outer.get("bytes") != row.get("bytes") or outer.get("sha256") != row.get("sha256"):
            raise ValueError(f"editable master is not bound by the outer manifest: {outer_name}")
    return {
        "file_count": len(rows),
        "tree_sha256": tree_digest.hexdigest(),
        "required_roots": REQUIRED_ROOTS,
        "editable_master_count": 10,
    }


def rebuild_input_evidence_from_manifest(embedded: dict) -> dict:
    """Derive the clean prebuild-input digest from the final outer manifest."""
    excluded = {
        "PACKAGE_CONTENTS_SHA256.json",
        "SITE_PACKAGE/PACKAGE_CONTENTS_SHA256.json",
    }
    rows = [
        row for row in (embedded.get("files") or [])
        if row.get("path") not in excluded
    ]
    digest = hashlib.sha256()
    total_bytes = 0
    for row in sorted(rows, key=lambda value: str(value.get("path") or "")):
        relative = str(row.get("path") or "")
        size = row.get("bytes")
        file_digest = str(row.get("sha256") or "")
        if type(size) is not int or size < 0 or not SHA256_PATTERN.fullmatch(file_digest):
            raise ValueError(f"manifest has malformed rebuild-input evidence: {relative}")
        digest.update(f"{relative}\0{size}\0{file_digest}\n".encode("utf-8"))
        total_bytes += size
    return {
        "tree_sha256": digest.hexdigest(),
        "file_count": len(rows),
        "total_bytes": total_bytes,
        "excluded_generated_manifests": sorted(excluded),
    }


def read_sidecar(sidecar: Path, archive: Path) -> str:
    text = Path(sidecar).read_text(encoding="utf-8")
    match = re.fullmatch(r"([a-f0-9]{64})  ([^\r\n]+)\r?\n?", text)
    if not match:
        raise ValueError("archive checksum sidecar has an invalid format")
    if match.group(2) != Path(archive).name:
        raise ValueError("archive checksum sidecar names a different artifact")
    return match.group(1)


def exact_release_sibling(archive: Path, candidate: Path, suffix: str, label: str) -> Path:
    archive = Path(archive).resolve()
    expected = Path(str(archive) + suffix).resolve()
    actual = Path(candidate).resolve()
    if actual != expected:
        raise ValueError(
            f"{label} must be the exact resolved sibling {expected.name} of {archive.name}"
        )
    return actual


def create_receipt(
    *,
    archive: Path,
    sidecar: Path,
    delivery_root: Path,
    package_manifest: Path,
    gate_report: Path,
    futureproof_report: Path,
    audit_report: Path,
    release_manifest: Path,
    clean_room_report: Path,
    disaster_recovery_report: Path,
    receipt_path: Path,
) -> dict:
    archive = Path(archive).resolve()
    sidecar = exact_release_sibling(archive, sidecar, ".sha256", "checksum sidecar")
    clean_room_report = exact_release_sibling(
        archive,
        clean_room_report,
        ".clean-room-report.json",
        "clean-room report",
    )
    disaster_recovery_report = exact_release_sibling(
        archive,
        disaster_recovery_report,
        ".disaster-recovery-report.json",
        "disaster-recovery report",
    )
    receipt_path = exact_release_sibling(
        archive,
        receipt_path,
        ".audit-receipt.json",
        "audit receipt",
    )
    archive_digest = file_sha256(archive)
    if read_sidecar(sidecar, archive) != archive_digest:
        raise ValueError("archive checksum sidecar does not match the archive")
    package = read_json(package_manifest)
    gate = read_json(gate_report)
    futureproof = read_json(futureproof_report)
    runtime_release = read_json(release_manifest)
    clean_room = read_json(clean_room_report)
    disaster_recovery = read_json(disaster_recovery_report)
    gate_summary = validate_gate_report(gate, "release gate report")
    futureproof_summary = validate_futureproofing_source_report(futureproof)
    clean_room_summary = validate_gate_report(clean_room, "clean-room report")
    clean_room_contract = validate_clean_room_contract(clean_room)
    executable_rehash_attestation = create_executable_rehash_attestation(clean_room)
    require_exact_post_package_gate(
        disaster_recovery,
        label="disaster-recovery report",
        schema="seminar-schools-disaster-recovery-report-v1",
    )
    disaster_recovery_summary = validate_gate_report(
        disaster_recovery, "disaster-recovery report"
    )

    with zipfile.ZipFile(archive, "r") as zipped:
        try:
            embedded_bytes = zipped.read("PACKAGE_CONTENTS_SHA256.json")
        except KeyError as error:
            raise ValueError("release archive has no embedded package manifest") from error
        embedded = json.loads(embedded_bytes)
        if embedded != package:
            raise ValueError("external package manifest differs from the manifest embedded in the archive")
        expected_members = {row.get("path") for row in embedded.get("files", [])}
        for evidence_path in (gate_report, futureproof_report, audit_report, release_manifest):
            member = archive_member_for(evidence_path, delivery_root)
            if member not in expected_members:
                raise ValueError(f"receipt evidence is not a manifested archive member: {member}")

    package_release_id = str(package.get("release_id") or "")
    runtime_release_id = str(runtime_release.get("release_id") or "")
    if not package_release_id or not runtime_release_id:
        raise ValueError("package and runtime release IDs must both be present")
    if package.get("schema") != EXPECTED_MANIFEST_SCHEMA:
        raise ValueError("package manifest has the wrong schema")
    if package.get("package_kind") != EXPECTED_PACKAGE_KIND:
        raise ValueError("package manifest is not the complete handoff class")
    if package_release_id != EXPECTED_PACKAGE_RELEASE_ID:
        raise ValueError("package manifest has the wrong futureproofing release ID")

    def evidence(path: Path) -> dict:
        return {
            "archive_member": archive_member_for(path, delivery_root),
            "bytes": Path(path).stat().st_size,
            "sha256": file_sha256(path),
        }

    def external_evidence(path: Path, expected_name: str) -> dict:
        resolved = Path(path).resolve()
        if resolved.parent != archive.parent or resolved.name != expected_name:
            raise ValueError(
                f"external release evidence must be the exact sibling {expected_name}"
            )
        return {
            "name": resolved.name,
            "bytes": resolved.stat().st_size,
            "sha256": file_sha256(resolved),
        }

    receipt = {
        "schema": SCHEMA,
        "receipt_version": "1.0",
        "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "archive": {
            "name": archive.name,
            "bytes": archive.stat().st_size,
            "sha256": archive_digest,
        },
        "checksum_sidecar": {
            "name": sidecar.name,
            "bytes": sidecar.stat().st_size,
            "sha256": file_sha256(sidecar),
        },
        "embedded_manifest": {
            "archive_member": "PACKAGE_CONTENTS_SHA256.json",
            "bytes": len(embedded_bytes),
            "sha256": bytes_sha256(embedded_bytes),
            "schema": embedded.get("schema"),
            "package_kind": embedded.get("package_kind"),
            "release_id": package_release_id,
            "generated_at": embedded.get("generated_at"),
            "file_count": embedded.get("file_count"),
        },
        "package_manifest": {
            **evidence(package_manifest),
            "archive_member": "PACKAGE_CONTENTS_SHA256.json",
        },
        "gate_report": {**evidence(gate_report), **gate_summary},
        "futureproofing_gate_report": {
            **evidence(futureproof_report),
            **futureproof_summary,
        },
        "clean_room_report": {
            **external_evidence(
                clean_room_report, f"{archive.name}.clean-room-report.json"
            ),
            **clean_room_summary,
            **clean_room_contract,
            "receipt_creation_executable_rehash": executable_rehash_attestation,
            "reference_archive_sha256": clean_room.get("left", {}).get("sha256"),
            "clean_rebuild_sha256": clean_room.get("right", {}).get("sha256"),
            "reference_archive_bytes": clean_room.get("left", {}).get("bytes"),
            "clean_rebuild_bytes": clean_room.get("right", {}).get("bytes"),
            "byte_identical": clean_room.get("byte_identical"),
            "sidecar_identical": clean_room.get("sidecar_identical"),
            "manifest_identical": clean_room.get("manifest_identical"),
            "reference_manifest_sha256": clean_room.get("left_manifest", {}).get("sha256"),
            "clean_rebuild_manifest_sha256": clean_room.get("right_manifest", {}).get("sha256"),
        },
        "disaster_recovery_report": {
            **external_evidence(
                disaster_recovery_report,
                f"{archive.name}.disaster-recovery-report.json",
            ),
            **disaster_recovery_summary,
            "restored_file_count": disaster_recovery.get("archive", {}).get("file_count"),
            "restored_tree_sha256": disaster_recovery.get("restored_tree", {}).get("sha256"),
            "editable_master_count": disaster_recovery.get("editable_masters", {}).get("file_count"),
            "required_roots": disaster_recovery.get("required_roots"),
        },
        "audit_report": evidence(audit_report),
        "release": {
            **evidence(release_manifest),
            "package_release_id": package_release_id,
            "runtime_release_id": runtime_release_id,
            "runtime_generated_at": runtime_release.get("generated_at"),
        },
        "tools": {
            "python": platform.python_version(),
            "node": command_version(["node", "--version"]),
            "npm": command_version(["npm", "--version"]),
            "receipt_tool": "scripts/create-artifact-audit-receipt.py",
        },
        "anti_fabrication_rule": "Every result and count is read from a named, hash-bound file; the receipt CLI accepts no manual status or count override.",
    }
    _verify_receipt_payload(
        receipt,
        archive=archive,
        sidecar=sidecar,
        clean_room_report=clean_room_report,
        disaster_recovery_report=disaster_recovery_report,
    )
    return receipt


def _verify_receipt_payload(
    receipt: dict,
    *,
    archive: Path,
    sidecar: Path,
    clean_room_report: Path | None = None,
    disaster_recovery_report: Path | None = None,
) -> None:
    if receipt.get("schema") != SCHEMA:
        raise ValueError("unsupported artifact receipt schema")
    archive = Path(archive).resolve()
    sidecar = exact_release_sibling(archive, sidecar, ".sha256", "checksum sidecar")
    archive_row = receipt.get("archive") or {}
    sidecar_row = receipt.get("checksum_sidecar") or {}
    if archive_row.get("name") != archive.name:
        raise ValueError("receipt names a different archive")
    if archive_row.get("bytes") != archive.stat().st_size:
        raise ValueError("archive size differs from receipt")
    archive_digest = file_sha256(archive)
    if archive_row.get("sha256") != archive_digest:
        raise ValueError("archive digest differs from receipt")
    if sidecar_row.get("name") != sidecar.name:
        raise ValueError("receipt names a different checksum sidecar")
    if sidecar_row.get("bytes") != sidecar.stat().st_size:
        raise ValueError("checksum sidecar size differs from receipt")
    if sidecar_row.get("sha256") != file_sha256(sidecar):
        raise ValueError("checksum sidecar digest differs from receipt")
    if read_sidecar(sidecar, archive) != archive_digest:
        raise ValueError("checksum sidecar does not bind to the receipt archive")

    external_reports = {
        "clean_room_report": exact_release_sibling(
            archive,
            clean_room_report or Path(str(archive) + ".clean-room-report.json"),
            ".clean-room-report.json",
            "clean-room report",
        ),
        "disaster_recovery_report": exact_release_sibling(
            archive,
            disaster_recovery_report or Path(str(archive) + ".disaster-recovery-report.json"),
            ".disaster-recovery-report.json",
            "disaster-recovery report",
        ),
    }
    for key, report_path in external_reports.items():
        row = receipt.get(key) or {}
        if row.get("name") != report_path.name:
            raise ValueError(f"{key} names a different external report")
        if row.get("bytes") != report_path.stat().st_size:
            raise ValueError(f"{key} size differs from receipt")
        if row.get("sha256") != file_sha256(report_path):
            raise ValueError(f"{key} digest differs from receipt")
        report = read_json(report_path)
        summary = validate_gate_report(report, key)
        for field, value in summary.items():
            if row.get(field) != value:
                raise ValueError(f"{key} {field} differs from its report")
    clean_room = read_json(external_reports["clean_room_report"])
    clean_row = receipt["clean_room_report"]
    if clean_room.get("schema") != "seminar-schools-clean-room-release-report-v1":
        raise ValueError("clean-room report has the wrong schema")
    clean_contract = validate_clean_room_contract(clean_room)
    for field, value in clean_contract.items():
        if clean_row.get(field) != value:
            raise ValueError(f"receipt clean-room {field} differs from its report")
    verify_executable_rehash_attestation(
        clean_row.get("receipt_creation_executable_rehash") or {},
        clean_room,
    )
    if clean_room.get("byte_identical") is not True:
        raise ValueError("clean-room report does not prove byte identity")
    if clean_room.get("sidecar_identical") is not True:
        raise ValueError("clean-room report does not prove checksum-sidecar identity")
    if clean_room.get("manifest_identical") is not True:
        raise ValueError("clean-room report does not prove embedded-manifest identity")
    if clean_room.get("pipeline_id") != EXPECTED_CLEAN_ROOM_PIPELINE_ID:
        raise ValueError("clean-room report did not run the complete clean build pipeline")
    if clean_row.get("reference_archive_sha256") != archive_digest:
        raise ValueError("clean-room report is not bound to the receipt archive")
    if clean_row.get("reference_archive_sha256") != clean_room.get("left", {}).get("sha256"):
        raise ValueError("clean-room reference digest differs from its report")
    if clean_row.get("clean_rebuild_sha256") != clean_room.get("right", {}).get("sha256"):
        raise ValueError("clean-room rebuild digest differs from its report")
    for key in ("left", "right"):
        if clean_room.get(key, {}).get("sha256") != archive_digest:
            raise ValueError(f"clean-room {key} digest differs from the receipt archive")
        if clean_room.get(key, {}).get("bytes") != archive.stat().st_size:
            raise ValueError(f"clean-room {key} size differs from the receipt archive")
    if clean_row.get("reference_archive_bytes") != archive.stat().st_size:
        raise ValueError("clean-room reference size differs from receipt")
    if clean_row.get("clean_rebuild_bytes") != archive.stat().st_size:
        raise ValueError("clean-room rebuild size differs from receipt")
    if clean_row.get("sidecar_identical") is not True:
        raise ValueError("receipt omits clean-room checksum-sidecar identity")
    if clean_row.get("manifest_identical") is not True:
        raise ValueError("receipt omits clean-room embedded-manifest identity")
    if clean_row.get("pipeline_id") != clean_room.get("pipeline_id"):
        raise ValueError("receipt clean-room pipeline differs from its report")
    recovery = read_json(external_reports["disaster_recovery_report"])
    recovery_row = receipt["disaster_recovery_report"]
    require_exact_post_package_gate(
        recovery,
        label="disaster-recovery report",
        schema="seminar-schools-disaster-recovery-report-v1",
    )
    if recovery.get("archive", {}).get("sha256") != archive_digest:
        raise ValueError("disaster-recovery report is not bound to the receipt archive")
    for receipt_field, report_value in (
        ("restored_file_count", recovery.get("archive", {}).get("file_count")),
        ("restored_tree_sha256", recovery.get("restored_tree", {}).get("sha256")),
        ("editable_master_count", recovery.get("editable_masters", {}).get("file_count")),
    ):
        if recovery_row.get(receipt_field) != report_value:
            raise ValueError(f"disaster-recovery {receipt_field} differs from its report")

    with zipfile.ZipFile(archive, "r") as zipped:
        embedded_bytes = zipped.read("PACKAGE_CONTENTS_SHA256.json")
        embedded = json.loads(embedded_bytes)
        manifest_evidence = manifested_archive_evidence(zipped, embedded)
        embedded_row = receipt.get("embedded_manifest") or {}
        if embedded_row.get("sha256") != bytes_sha256(embedded_bytes):
            raise ValueError("embedded package manifest digest differs from receipt")
        if embedded_row.get("bytes") != len(embedded_bytes):
            raise ValueError("embedded package manifest size differs from receipt")
        if embedded_row.get("release_id") != embedded.get("release_id"):
            raise ValueError("embedded package release ID differs from receipt")
        if embedded_row.get("generated_at") != embedded.get("generated_at"):
            raise ValueError("embedded package timestamp differs from receipt")
        if embedded_row.get("file_count") != embedded.get("file_count"):
            raise ValueError("embedded package file count differs from receipt")
        if embedded.get("schema") != EXPECTED_MANIFEST_SCHEMA:
            raise ValueError("embedded package manifest has the wrong schema")
        if embedded.get("package_kind") != EXPECTED_PACKAGE_KIND:
            raise ValueError("embedded archive is not the complete handoff class")
        if embedded.get("release_id") != EXPECTED_PACKAGE_RELEASE_ID:
            raise ValueError("embedded archive has the wrong futureproofing release ID")
        if clean_contract["release_id"] != embedded.get("release_id"):
            raise ValueError("clean-room release ID differs from the embedded archive")
        if clean_contract["generated_at"] != embedded.get("generated_at"):
            raise ValueError("clean-room timestamp differs from the embedded archive")
        if embedded_row.get("schema") != EXPECTED_MANIFEST_SCHEMA:
            raise ValueError("receipt records the wrong package-manifest schema")
        if embedded_row.get("package_kind") != EXPECTED_PACKAGE_KIND:
            raise ValueError("receipt records the wrong package class")
        for label, manifest_row in (
            ("reference", clean_room.get("left_manifest") or {}),
            ("clean rebuild", clean_room.get("right_manifest") or {}),
        ):
            if manifest_row.get("sha256") != bytes_sha256(embedded_bytes):
                raise ValueError(f"clean-room {label} manifest differs from the receipt archive")
            if manifest_row.get("schema") != EXPECTED_MANIFEST_SCHEMA:
                raise ValueError(f"clean-room {label} manifest has the wrong schema")
            if manifest_row.get("package_kind") != EXPECTED_PACKAGE_KIND:
                raise ValueError(f"clean-room {label} manifest has the wrong package class")
            if manifest_row.get("release_id") != EXPECTED_PACKAGE_RELEASE_ID:
                raise ValueError(f"clean-room {label} manifest has the wrong release ID")
            if manifest_row.get("generated_at") != embedded.get("generated_at"):
                raise ValueError(f"clean-room {label} manifest has the wrong timestamp")
            if manifest_row.get("file_count") != embedded.get("file_count"):
                raise ValueError(f"clean-room {label} manifest has the wrong file count")
        rebuild_inputs = rebuild_input_evidence_from_manifest(embedded)
        if clean_room.get("source_snapshot") != rebuild_inputs:
            raise ValueError("clean-room source snapshot is not derivable from the final archive")
        if clean_room.get("archive_rebuild_inputs") != rebuild_inputs:
            raise ValueError("clean-room archive-input digest is not derivable from the final archive")
        if clean_row.get("source_snapshot") != rebuild_inputs:
            raise ValueError("receipt source snapshot is not derivable from the final archive")
        for helper in clean_room.get("pipeline_helpers") or []:
            helper_path = helper["path"]
            try:
                content = zipped.read(helper_path)
            except KeyError as error:
                raise ValueError(f"clean-room helper is absent from the final archive: {helper_path}") from error
            if helper.get("bytes") != len(content) or helper.get("sha256") != bytes_sha256(content):
                raise ValueError(f"clean-room helper differs from the final archive: {helper_path}")
        try:
            requirements_content = zipped.read(ARCHIVE_REQUIREMENTS_PATH)
            lock_content = zipped.read(ARCHIVE_LOCK_PATH)
        except KeyError as error:
            raise ValueError(
                "pinned Python audit requirements or resolved lock are absent from the final archive"
            ) from error
        try:
            archived_pinned_dependencies = pinned_audit_requirements_evidence_from_bytes(
                requirements_content,
                lock_content,
            )
        except RuntimeError as error:
            raise ValueError("final archive has invalid pinned Python audit requirements") from error
        archived_pinned_dependencies.update(
            {
                "installed_distribution_count": archived_pinned_dependencies[
                    "locked_distribution_count"
                ],
                "installed_distributions": archived_pinned_dependencies[
                    "locked_distributions"
                ],
                "installed_inventory_matches_lock": True,
            }
        )
        if clean_room.get("pinned_python_audit_dependencies") != archived_pinned_dependencies:
            raise ValueError(
                "clean-room pinned Python dependency evidence differs from the final archive"
            )
        if clean_row.get("pinned_python_audit_dependencies") != archived_pinned_dependencies:
            raise ValueError(
                "receipt pinned Python dependency evidence differs from the final archive"
            )
        if clean_row.get("reference_manifest_sha256") != bytes_sha256(embedded_bytes):
            raise ValueError("receipt clean-room reference manifest is not archive-bound")
        if clean_row.get("clean_rebuild_manifest_sha256") != bytes_sha256(embedded_bytes):
            raise ValueError("receipt clean-room rebuild manifest is not archive-bound")
        package_row = receipt.get("package_manifest") or {}
        if package_row.get("sha256") != bytes_sha256(embedded_bytes):
            raise ValueError("package manifest hash is not bound to the embedded manifest")
        if package_row.get("bytes") != len(embedded_bytes):
            raise ValueError("package manifest size is not bound to the embedded manifest")

        for key in ("gate_report", "futureproofing_gate_report", "audit_report", "release"):
            row = receipt.get(key) or {}
            member = str(row.get("archive_member") or "")
            if not member or PurePosixPath(member).is_absolute() or ".." in PurePosixPath(member).parts:
                raise ValueError(f"receipt has an unsafe or missing {key} archive member")
            content = zipped.read(member)
            if row.get("sha256") != bytes_sha256(content) or row.get("bytes") != len(content):
                raise ValueError(f"{key} archive evidence differs from receipt")

        gate = json.loads(zipped.read(receipt["gate_report"]["archive_member"]))
        futureproof = json.loads(
            zipped.read(receipt["futureproofing_gate_report"]["archive_member"])
        )
        for key, report in (("gate_report", gate), ("futureproofing_gate_report", futureproof)):
            summary = (
                validate_futureproofing_source_report(report)
                if key == "futureproofing_gate_report"
                else validate_gate_report(report, key)
            )
            for field, value in summary.items():
                if receipt[key].get(field) != value:
                    raise ValueError(f"{key} {field} differs from hash-bound report")
        runtime = json.loads(zipped.read(receipt["release"]["archive_member"]))
        if receipt["release"].get("runtime_release_id") != runtime.get("release_id"):
            raise ValueError("runtime release ID differs from hash-bound release manifest")
        if receipt["release"].get("package_release_id") != embedded.get("release_id"):
            raise ValueError("package release ID differs from embedded manifest")

    recovery_archive = recovery.get("archive") or {}
    if recovery_archive.get("bytes") != archive.stat().st_size:
        raise ValueError("disaster-recovery archive size differs from the receipt archive")
    if recovery_archive.get("file_count") != manifest_evidence["file_count"]:
        raise ValueError("disaster-recovery file count differs from the embedded manifest")
    if recovery.get("restored_tree", {}).get("sha256") != manifest_evidence["tree_sha256"]:
        raise ValueError("disaster-recovery tree digest is not derivable from the embedded manifest")
    if recovery.get("editable_masters", {}).get("file_count") != manifest_evidence["editable_master_count"]:
        raise ValueError("disaster-recovery editable count differs from the embedded manifests")
    if recovery.get("required_roots") != manifest_evidence["required_roots"]:
        raise ValueError("disaster-recovery required roots differ from the archive")
    if recovery_row.get("required_roots") != manifest_evidence["required_roots"]:
        raise ValueError("receipt required roots differ from the archive")

    tools = receipt.get("tools") or {}
    if not tools.get("python") or not tools.get("receipt_tool"):
        raise ValueError("receipt tool provenance is incomplete")


def verify_receipt(
    receipt: dict,
    *,
    archive: Path,
    sidecar: Path,
    receipt_path: Path,
    clean_room_report: Path | None = None,
    disaster_recovery_report: Path | None = None,
) -> None:
    """Verify only the exact four evidence siblings belonging to *archive*."""
    archive = Path(archive).resolve()
    receipt_path = exact_release_sibling(
        archive,
        receipt_path,
        ".audit-receipt.json",
        "audit receipt",
    )
    if read_json(receipt_path) != receipt:
        raise ValueError("audit receipt payload differs from its exact sibling file")
    _verify_receipt_payload(
        receipt,
        archive=archive,
        sidecar=sidecar,
        clean_room_report=clean_room_report,
        disaster_recovery_report=disaster_recovery_report,
    )
