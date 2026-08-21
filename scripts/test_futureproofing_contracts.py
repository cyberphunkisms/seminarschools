#!/usr/bin/env python3
"""Deliberate pass/fail fixtures for the FP controls owned by this module."""
from __future__ import annotations

import collections
from contextlib import redirect_stderr
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import socket
import sys
import tempfile
import time
import unittest
from unittest import mock
import zipfile


SCRIPTS = Path(__file__).resolve().parent
SITE_ROOT = SCRIPTS.parent
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from artifact_receipt import (  # noqa: E402
    EXPECTED_CLEAN_ROOM_ACTIONS,
    EXPECTED_CLEAN_ROOM_HELPERS,
    EXPECTED_MANIFEST_SCHEMA,
    EXPECTED_PACKAGE_KIND,
    EXPECTED_PACKAGE_RELEASE_ID,
    POST_PACKAGE_IDS,
    REQUIRED_ROOTS,
    SOURCE_STAGE_IDS,
    create_receipt,
    expected_clean_pipeline_steps,
    rebuild_input_evidence_from_manifest,
    verify_receipt,
)
from audit_python_dependencies import (  # noqa: E402
    ARCHIVE_LOCK_PATH,
    ARCHIVE_REQUIREMENTS_PATH,
    pinned_audit_requirements_evidence_from_bytes,
    prepare_audit_python_dependencies,
)
from build_lock import (  # noqa: E402
    INHERITED_TOKEN_ENV,
    LEASE_FILE_NAME,
    ReleaseBuildLock,
    process_identity,
    require_release_build_lock,
    release_build_lease_is_held,
)
from editable_masters_integrity import EXPECTED_EDITABLE_MASTER_PATHS  # noqa: E402


def load_hyphen_module(name: str, filename: str):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / filename)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


ownership = load_hyphen_module("futureproof_ownership", "verify-canonical-ownership.py")
boundary = load_hyphen_module("futureproof_boundary", "verify-public-private-boundary.py")
clean_room = load_hyphen_module("futureproof_clean_room", "verify-clean-room-release.py")
recovery = load_hyphen_module("futureproof_recovery", "verify-disaster-recovery.py")
audit53 = load_hyphen_module("futureproof_audit53", "verify-audit53-base-preservation.py")


def digest(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def write_json(path: Path, value: dict) -> bytes:
    data = (json.dumps(value, sort_keys=True, indent=2) + "\n").encode("utf-8")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return data


def editable_fixture_files(*, omit: str | None = None) -> dict[str, bytes]:
    paths = sorted(EXPECTED_EDITABLE_MASTER_PATHS - ({omit} if omit else set()))
    files: dict[str, bytes] = {}
    rows = []
    sums = []
    for relative in paths:
        payload = f"fixture for {relative}\n".encode()
        files[f"EDITABLE_MASTERS/{relative}"] = payload
        rows.append({"path": relative, "bytes": len(payload), "sha256": digest(payload)})
        sums.append(f"{digest(payload)}  {relative}\n")
    files["EDITABLE_MASTERS/EDITABLE_MASTERS_MANIFEST.json"] = (
        json.dumps({"file_count": len(rows), "files": rows}, sort_keys=True, indent=2) + "\n"
    ).encode()
    files["EDITABLE_MASTERS/SHA256SUMS.txt"] = "".join(sums).encode()
    return files


def write_complete_archive(
    archive: Path,
    files: dict[str, bytes],
    *,
    package_kind: str = EXPECTED_PACKAGE_KIND,
    release_id: str = EXPECTED_PACKAGE_RELEASE_ID,
) -> tuple[Path, dict, bytes]:
    rows = [
        {"path": name, "bytes": len(content), "sha256": digest(content)}
        for name, content in sorted(files.items())
    ]
    manifest = {
        "schema": EXPECTED_MANIFEST_SCHEMA,
        "package_kind": package_kind,
        "release_id": release_id,
        "generated_at": "2026-08-09T00:00:00Z",
        "file_count": len(rows),
        "total_uncompressed_bytes": sum(row["bytes"] for row in rows),
        "files": rows,
    }
    manifest_bytes = (json.dumps(manifest, sort_keys=True, indent=2) + "\n").encode()
    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as zipped:
        for name, content in sorted(files.items()):
            zipped.writestr(name, content)
        zipped.writestr("PACKAGE_CONTENTS_SHA256.json", manifest_bytes)
    sidecar = Path(str(archive) + ".sha256")
    sidecar.write_text(f"{digest(archive.read_bytes())}  {archive.name}\n", encoding="utf-8")
    return sidecar, manifest, manifest_bytes


def restored_tree_digest(manifest: dict) -> str:
    value = hashlib.sha256()
    for row in manifest["files"]:
        value.update(
            f"{row['path']}\0{row['bytes']}\0{row['sha256']}\n".encode("utf-8")
        )
    return value.hexdigest()


def verify_fixture_receipt(receipt: dict, archive: Path, sidecar: Path) -> None:
    receipt_path = Path(str(archive) + ".audit-receipt.json")
    write_json(receipt_path, receipt)
    verify_receipt(
        receipt,
        archive=archive,
        sidecar=sidecar,
        receipt_path=receipt_path,
    )


class ReceiptTests(unittest.TestCase):
    def make_release(self, root: Path) -> tuple[Path, Path, dict]:
        delivery = root / "delivery"
        site = delivery / "SITE_PACKAGE"
        gate_path = site / "scripts/reports/release-gate-report.json"
        future_path = site / "scripts/reports/futureproofing-gate-report.json"
        audit_path = site / "FINAL_AUDIT.md"
        release_path = site / "RELEASE_MANIFEST.json"
        gate = {"status": "passed", "total_checks": 2, "passed_checks": 2, "failed_checks": []}
        future = {
            "schema": "seminar-schools-futureproofing-gate-report-v1",
            "scope": "source-stage",
            "status": "passed",
            "contract_total_controls": 15,
            "implemented_controls": 15,
            "total_checks": 12,
            "passed_checks": 12,
            "failed_checks": [],
            "pending_checks": [],
            "source_stage_controls": sorted(SOURCE_STAGE_IDS),
            "post_package_checks": sorted(POST_PACKAGE_IDS),
            "executed": [
                {"id": item, "command": ["fixture"], "exit_code": 0}
                for item in sorted(SOURCE_STAGE_IDS)
            ],
        }
        files = {
            "SITE_PACKAGE/scripts/reports/release-gate-report.json": write_json(gate_path, gate),
            "SITE_PACKAGE/scripts/reports/futureproofing-gate-report.json": write_json(future_path, future),
            "SITE_PACKAGE/FINAL_AUDIT.md": b"# Passed\n",
            "SITE_PACKAGE/RELEASE_MANIFEST.json": write_json(
                release_path,
                {"release_id": "runtime-test", "generated_at": "2026-08-09T00:00:00Z"},
            ),
            "DEPLOY_TOOLS/readme.txt": b"deploy fixture\n",
            ARCHIVE_REQUIREMENTS_PATH: (SITE_ROOT / "requirements-audit.txt").read_bytes(),
            ARCHIVE_LOCK_PATH: (SITE_ROOT / "requirements-audit.lock").read_bytes(),
        }
        for helper_path in EXPECTED_CLEAN_ROOM_HELPERS:
            files[helper_path] = f"fixture helper: {helper_path}\n".encode("utf-8")
        files.update(editable_fixture_files())
        audit_path.write_bytes(files["SITE_PACKAGE/FINAL_AUDIT.md"])
        archive = delivery / "ss-site-test.zip"
        sidecar, manifest, manifest_bytes = write_complete_archive(archive, files)
        manifest_path = delivery / "PACKAGE_CONTENTS_SHA256.json"
        manifest_path.write_bytes(manifest_bytes)
        archive_digest = digest(archive.read_bytes())
        manifest_evidence = {
            "sha256": digest(manifest_bytes),
            "schema": manifest["schema"],
            "package_kind": manifest["package_kind"],
            "release_id": manifest["release_id"],
            "generated_at": manifest["generated_at"],
            "file_count": manifest["file_count"],
        }
        snapshot = rebuild_input_evidence_from_manifest(manifest)
        helpers = [
            {
                "path": helper_path,
                "bytes": len(files[helper_path]),
                "sha256": digest(files[helper_path]),
                "trusted_sha256": digest(files[helper_path]),
                "matches_trusted_helper": True,
            }
            for helper_path in EXPECTED_CLEAN_ROOM_HELPERS
        ]
        _, external_inputs = clean_room.clean_environment(
            root / "receipt-clean-environment",
            manifest["generated_at"],
        )
        pinned_python_dependencies = pinned_audit_requirements_evidence_from_bytes(
            files[ARCHIVE_REQUIREMENTS_PATH],
            files[ARCHIVE_LOCK_PATH],
        )
        pinned_python_dependencies.update(
            {
                "installed_distribution_count": pinned_python_dependencies[
                    "locked_distribution_count"
                ],
                "installed_distributions": pinned_python_dependencies[
                    "locked_distributions"
                ],
                "installed_inventory_matches_lock": True,
            }
        )
        clean_room_path = Path(str(archive) + ".clean-room-report.json")
        write_json(
            clean_room_path,
            {
                "schema": "seminar-schools-clean-room-release-report-v1",
                "status": "passed",
                "total_checks": 5,
                "passed_checks": 5,
                "failed_checks": [],
                "mode": "reference_rebuild",
                "canonical_pipeline": True,
                "pipeline_id": "npm-ci-build-full-verify-editable-package-v1",
                "release_id": manifest["release_id"],
                "generated_at": manifest["generated_at"],
                "source_snapshot": snapshot,
                "source_snapshot_matches_archive": True,
                "archive_rebuild_inputs": snapshot,
                "pipeline_helpers": helpers,
                "pipeline_steps": clean_room.canonical_pipeline_steps(
                    manifest["release_id"], manifest["generated_at"]
                ),
                "pinned_python_audit_dependencies": pinned_python_dependencies,
                "pinned_python_audit_dependencies_verified": True,
                "external_inputs": external_inputs,
                "left": {"bytes": archive.stat().st_size, "sha256": archive_digest},
                "right": {"bytes": archive.stat().st_size, "sha256": archive_digest},
                "byte_identical": True,
                "sidecar_identical": True,
                "manifest_identical": True,
                "left_manifest": manifest_evidence,
                "right_manifest": manifest_evidence,
            },
        )
        recovery_path = Path(str(archive) + ".disaster-recovery-report.json")
        write_json(
            recovery_path,
            {
                "schema": "seminar-schools-disaster-recovery-report-v1",
                "status": "passed",
                "total_checks": 5,
                "passed_checks": 5,
                "failed_checks": [],
                "archive": {
                    "bytes": archive.stat().st_size,
                    "sha256": archive_digest,
                    "file_count": manifest["file_count"],
                },
                "restored_tree": {"sha256": restored_tree_digest(manifest)},
                "editable_masters": {"file_count": 10},
                "required_roots": REQUIRED_ROOTS,
            },
        )
        receipt_path = Path(str(archive) + ".audit-receipt.json")
        receipt = create_receipt(
            archive=archive,
            sidecar=sidecar,
            delivery_root=delivery,
            package_manifest=manifest_path,
            gate_report=gate_path,
            futureproof_report=future_path,
            audit_report=audit_path,
            release_manifest=release_path,
            clean_room_report=clean_room_path,
            disaster_recovery_report=recovery_path,
            receipt_path=receipt_path,
        )
        write_json(receipt_path, receipt)
        return archive, sidecar, receipt

    def test_receipt_accepts_exact_archive_and_rejects_one_byte_tamper(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            archive, sidecar, receipt = self.make_release(Path(temporary))
            verify_fixture_receipt(receipt, archive, sidecar)
            archive.write_bytes(archive.read_bytes() + b"x")
            with self.assertRaisesRegex(ValueError, "archive (size|digest)"):
                verify_fixture_receipt(receipt, archive, sidecar)

    def test_receipt_rejects_external_clean_room_report_tamper(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            archive, sidecar, receipt = self.make_release(Path(temporary))
            clean_room = Path(str(archive) + ".clean-room-report.json")
            clean_room.write_text('{"status":"failed"}\n', encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "clean_room_report (size|digest)"):
                verify_fixture_receipt(receipt, archive, sidecar)

    def test_receipt_recomputes_clean_room_digest_from_archive(self) -> None:
        """A self-consistent forged report/receipt pair cannot replace ZIP evidence."""
        with tempfile.TemporaryDirectory() as temporary:
            archive, sidecar, receipt = self.make_release(Path(temporary))
            report_path = Path(str(archive) + ".clean-room-report.json")
            report = json.loads(report_path.read_text(encoding="utf-8"))
            forged_digest = "0" * 64
            report["right"]["sha256"] = forged_digest
            report_bytes = write_json(report_path, report)
            receipt_row = receipt["clean_room_report"]
            receipt_row["bytes"] = len(report_bytes)
            receipt_row["sha256"] = digest(report_bytes)
            receipt_row["clean_rebuild_sha256"] = forged_digest

            with self.assertRaisesRegex(
                ValueError, "clean-room right digest differs from the receipt archive"
            ):
                verify_fixture_receipt(receipt, archive, sidecar)

    def test_receipt_rejects_coherently_rewritten_noncanonical_clean_report(self) -> None:
        """Matching report/receipt hashes cannot invent a canonical rebuild."""
        with tempfile.TemporaryDirectory() as temporary:
            archive, sidecar, receipt = self.make_release(Path(temporary))
            report_path = Path(str(archive) + ".clean-room-report.json")
            report = json.loads(report_path.read_text(encoding="utf-8"))
            report["mode"] = "compare_only"
            report["canonical_pipeline"] = False
            report_bytes = write_json(report_path, report)
            receipt_row = receipt["clean_room_report"]
            receipt_row["bytes"] = len(report_bytes)
            receipt_row["sha256"] = digest(report_bytes)
            receipt_row["mode"] = "compare_only"
            receipt_row["canonical_pipeline"] = False

            with self.assertRaisesRegex(ValueError, "canonical reference rebuild"):
                verify_fixture_receipt(receipt, archive, sidecar)

    def test_receipt_rejects_clean_pipeline_without_pinned_python_install(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            archive, sidecar, receipt = self.make_release(Path(temporary))
            report_path = Path(str(archive) + ".clean-room-report.json")
            report = json.loads(report_path.read_text(encoding="utf-8"))
            report["pipeline_steps"] = [
                step
                for step in report["pipeline_steps"]
                if step["action"] != "install_pinned_python_audit_dependencies"
            ]
            report_bytes = write_json(report_path, report)
            receipt_row = receipt["clean_room_report"]
            receipt_row["bytes"] = len(report_bytes)
            receipt_row["sha256"] = digest(report_bytes)

            with self.assertRaisesRegex(ValueError, "pipeline steps differ"):
                verify_fixture_receipt(receipt, archive, sidecar)

    def test_receipt_recomputes_prebuild_snapshot_from_archive(self) -> None:
        """A matching forged snapshot in both JSON files still fails ZIP derivation."""
        with tempfile.TemporaryDirectory() as temporary:
            archive, sidecar, receipt = self.make_release(Path(temporary))
            report_path = Path(str(archive) + ".clean-room-report.json")
            report = json.loads(report_path.read_text(encoding="utf-8"))
            forged = dict(report["source_snapshot"])
            forged["tree_sha256"] = "e" * 64
            report["source_snapshot"] = forged
            report["archive_rebuild_inputs"] = forged
            report_bytes = write_json(report_path, report)
            receipt_row = receipt["clean_room_report"]
            receipt_row["bytes"] = len(report_bytes)
            receipt_row["sha256"] = digest(report_bytes)
            receipt_row["source_snapshot"] = forged
            receipt_row["archive_rebuild_inputs"] = forged

            with self.assertRaisesRegex(ValueError, "not derivable from the final archive"):
                verify_fixture_receipt(receipt, archive, sidecar)

    def test_receipt_recomputes_disaster_recovery_tree_from_archive(self) -> None:
        """Editing both DR JSON and its receipt row cannot forge restored-tree proof."""
        with tempfile.TemporaryDirectory() as temporary:
            archive, sidecar, receipt = self.make_release(Path(temporary))
            report_path = Path(str(archive) + ".disaster-recovery-report.json")
            report = json.loads(report_path.read_text(encoding="utf-8"))
            forged_digest = "f" * 64
            report["restored_tree"]["sha256"] = forged_digest
            report_bytes = write_json(report_path, report)
            receipt_row = receipt["disaster_recovery_report"]
            receipt_row["bytes"] = len(report_bytes)
            receipt_row["sha256"] = digest(report_bytes)
            receipt_row["restored_tree_sha256"] = forged_digest

            with self.assertRaisesRegex(
                ValueError,
                "disaster-recovery tree digest is not derivable from the embedded manifest",
            ):
                verify_fixture_receipt(receipt, archive, sidecar)

    def test_receipt_rejects_non_sibling_artifacts_with_the_same_basename(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            archive, sidecar, receipt = self.make_release(root)
            exact = {
                "sidecar": sidecar,
                "receipt_path": Path(str(archive) + ".audit-receipt.json"),
                "clean_room_report": Path(str(archive) + ".clean-room-report.json"),
                "disaster_recovery_report": Path(
                    str(archive) + ".disaster-recovery-report.json"
                ),
            }
            other = root / "non-sibling"
            other.mkdir()
            for field, original in exact.items():
                with self.subTest(field=field):
                    impostor = other / original.name
                    impostor.write_bytes(original.read_bytes())
                    arguments = dict(exact)
                    arguments[field] = impostor
                    with self.assertRaisesRegex(ValueError, "exact resolved sibling"):
                        verify_receipt(
                            receipt,
                            archive=archive,
                            **arguments,
                        )

    def test_receipt_rejects_coherently_reduced_clean_and_dr_check_counts(self) -> None:
        for suffix, receipt_key in (
            (".clean-room-report.json", "clean_room_report"),
            (".disaster-recovery-report.json", "disaster_recovery_report"),
        ):
            with self.subTest(report=receipt_key), tempfile.TemporaryDirectory() as temporary:
                archive, sidecar, receipt = self.make_release(Path(temporary))
                report_path = Path(str(archive) + suffix)
                report = json.loads(report_path.read_text(encoding="utf-8"))
                report["total_checks"] = 1
                report["passed_checks"] = 1
                report_bytes = write_json(report_path, report)
                receipt_row = receipt[receipt_key]
                receipt_row["bytes"] = len(report_bytes)
                receipt_row["sha256"] = digest(report_bytes)
                receipt_row["total_checks"] = 1
                receipt_row["passed_checks"] = 1
                with self.assertRaisesRegex(ValueError, "exact canonical 5/5"):
                    verify_fixture_receipt(receipt, archive, sidecar)


class ApprovedDeletionTests(unittest.TestCase):
    def test_unapproved_missing_baseline_file_is_rejected(self) -> None:
        fixture = json.loads(
            (SITE_ROOT / "scripts/fixtures/futureproofing/unapproved-deletion-ledger.json").read_text(encoding="utf-8")
        )
        baseline = {"files": [{"path": "retired.txt", "bytes": 1, "sha256": digest(b"x")}]}
        with tempfile.TemporaryDirectory() as temporary:
            with self.assertRaisesRegex(AssertionError, "missing-file set"):
                audit53.validate_approved_deletions(baseline, fixture, Path(temporary))

    def test_generated_evidence_policy_is_exact_and_cannot_expand(self) -> None:
        ledger = json.loads(
            (SITE_ROOT / "data/futureproofing/approved-change-deletion-ledger.json").read_text(
                encoding="utf-8"
            )
        )
        rows = ledger["approved_transition"]["generated_evidence_content_exclusions"]
        self.assertEqual(audit53.validate_generated_evidence_policy_rows(rows), rows)
        for mutation in (
            rows[:-1],
            rows + [{**rows[0], "path": "scripts/reports/*.json"}],
            [{**rows[0], "writer": "another-writer.js"}, rows[1]],
        ):
            with self.subTest(mutation=mutation):
                with self.assertRaises(AssertionError):
                    audit53.validate_generated_evidence_policy_rows(mutation)

    def test_only_exact_generated_report_bytes_are_policy_substituted(self) -> None:
        audit49, release = [
            row["path"] for row in audit53.GENERATED_EVIDENCE_CONTENT_EXCLUSIONS
        ]
        first = [(audit49, "a" * 64), (release, "b" * 64), ("authored.html", "c" * 64)]
        generated_changed = [
            (audit49, "d" * 64),
            (release, "e" * 64),
            ("authored.html", "c" * 64),
        ]
        authored_changed = [
            (audit49, "a" * 64),
            (release, "b" * 64),
            ("authored.html", "f" * 64),
        ]
        self.assertEqual(
            audit53.modified_content_policy_digest(first),
            audit53.modified_content_policy_digest(generated_changed),
        )
        self.assertNotEqual(
            audit53.modified_content_policy_digest(first),
            audit53.modified_content_policy_digest(authored_changed),
        )

    def test_sets1_15_successor_inventory_reconstructs_aug14_path_set(self) -> None:
        baseline = json.loads(
            (SITE_ROOT / "scripts/reports/audit52-package-baseline.json").read_text(
                encoding="utf-8"
            )
        )
        ledger = json.loads(
            (SITE_ROOT / "data/futureproofing/approved-change-deletion-ledger.json").read_text(
                encoding="utf-8"
            )
        )
        modified = []
        for row in baseline["files"]:
            current = SITE_ROOT / row["path"]
            if current.is_file():
                current_sha = audit53.sha256(current)
                if current_sha != row["sha256"]:
                    modified.append((row["path"], current_sha))
        transition = ledger["approved_transition"]
        rows = transition["approved_successor_additions"]
        self.assertEqual(len(rows), audit53.APPROVED_SUCCESSOR_ADDITION_COUNT)
        self.assertEqual(
            audit53.approved_successor_rows_digest(rows),
            audit53.APPROVED_SUCCESSOR_ADDITION_ROWS_SHA256,
        )
        self.assertEqual(
            audit53.aggregate([f"{row['path']}\n" for row in rows]),
            audit53.APPROVED_SUCCESSOR_ADDITION_PATHS_SHA256,
        )
        categories = collections.Counter(
            audit53.successor_addition_category(row["path"]) for row in rows
        )
        self.assertEqual(
            dict(categories), audit53.APPROVED_SUCCESSOR_ADDITION_CATEGORY_COUNTS
        )
        audit53.validate_approved_successor_additions(
            baseline, modified, transition, SITE_ROOT
        )
        mutations = []
        removed = json.loads(json.dumps(transition))
        removed["approved_successor_additions"].pop()
        mutations.append(removed)
        content_tampered = json.loads(json.dumps(transition))
        content_tampered["approved_successor_additions"][0]["after_sha256"] = "0" * 64
        mutations.append(content_tampered)
        wildcarded = json.loads(json.dumps(transition))
        wildcarded["approved_successor_additions"][0]["path"] = "polymythseminars/ics/*.ics"
        mutations.append(wildcarded)
        for mutation in mutations:
            with self.subTest(mutation=mutation["approved_successor_additions"][0]):
                with self.assertRaises(AssertionError):
                    audit53.validate_approved_successor_additions(
                        baseline, modified, mutation, SITE_ROOT
                    )

    def test_protest_harvest_fixtures_remain_historical_bytes(self) -> None:
        baseline = json.loads(
            (SITE_ROOT / "scripts/reports/audit52-package-baseline.json").read_text(
                encoding="utf-8"
            )
        )
        baseline_by_path = {row["path"]: row for row in baseline["files"]}
        fixture_paths = (
            "scripts/fixtures/protest_harvest/action-network.html",
            "scripts/fixtures/protest_harvest/challenge-page.html",
            "scripts/fixtures/protest_harvest/cupe-calendar.html",
            "scripts/fixtures/protest_harvest/cupe-detail.html",
            "scripts/fixtures/protest_harvest/generic-detail.html",
            "scripts/fixtures/protest_harvest/generic-listing.html",
            "scripts/fixtures/protest_harvest/javascript-shell.html",
        )
        for relative in fixture_paths:
            with self.subTest(path=relative):
                self.assertEqual(
                    audit53.sha256(SITE_ROOT / relative),
                    baseline_by_path[relative]["sha256"],
                )


class OwnershipTests(unittest.TestCase):
    def test_overlapping_writers_are_rejected(self) -> None:
        fixture = json.loads(
            (SITE_ROOT / "scripts/fixtures/futureproofing/ownership-overlap.json").read_text(encoding="utf-8")
        )
        failures = ownership.validate_ownership(fixture, SITE_ROOT.parent, require_writers=False)
        self.assertTrue(any("overlapping output ownership" in failure for failure in failures))

    def test_required_governed_output_cannot_be_omitted(self) -> None:
        document = json.loads(
            (SITE_ROOT / "data/futureproofing/canonical-ownership-map.json").read_text(encoding="utf-8")
        )
        document["owners"] = [
            row for row in document["owners"] if row["id"] != "release-gate-report"
        ]
        failures = ownership.validate_ownership(document, SITE_ROOT.parent, require_writers=False)
        self.assertIn(
            "ownership map omits required governed output: "
            "SITE_PACKAGE/scripts/reports/release-gate-report.json",
            failures,
        )

    def test_current_ownership_map_governs_every_required_output(self) -> None:
        document = json.loads(
            (SITE_ROOT / "data/futureproofing/canonical-ownership-map.json").read_text(encoding="utf-8")
        )
        release_gate_owner = next(
            row for row in document["owners"] if row["id"] == "release-gate-report"
        )
        self.assertEqual(
            {
                "writer": release_gate_owner["writer"],
                "outputs": release_gate_owner["outputs"],
                "classification": release_gate_owner["classification"],
                "lock_scope": release_gate_owner["lock_scope"],
            },
            {
                "writer": "SITE_PACKAGE/scripts/verify-all-runner.js",
                "outputs": ["SITE_PACKAGE/scripts/reports/release-gate-report.json"],
                "classification": "private_release_evidence",
                "lock_scope": "release_build",
            },
        )
        self.assertEqual(
            ownership.validate_ownership(document, SITE_ROOT.parent),
            [],
        )


class BuildLockTests(unittest.TestCase):
    def setUp(self) -> None:
        self.parent_lock_token = os.environ.pop(INHERITED_TOKEN_ENV, None)

    def tearDown(self) -> None:
        os.environ.pop(INHERITED_TOKEN_ENV, None)
        if self.parent_lock_token is not None:
            os.environ[INHERITED_TOKEN_ENV] = self.parent_lock_token

    def test_second_independent_writer_cannot_claim_live_lock(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            first = ReleaseBuildLock(Path(temporary)).acquire()
            inherited = os.environ.pop(INHERITED_TOKEN_ENV)
            try:
                with self.assertRaisesRegex(RuntimeError, "already owned"):
                    ReleaseBuildLock(Path(temporary)).acquire()
            finally:
                os.environ[INHERITED_TOKEN_ENV] = inherited
                first.release()
            self.assertFalse((Path(temporary) / ".seminar-schools-build.lock").exists())
            self.assertTrue((Path(temporary) / LEASE_FILE_NAME).is_file())
            self.assertFalse(release_build_lease_is_held(Path(temporary)))

    def test_nested_token_inheritance_uses_outer_live_lease(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            first = ReleaseBuildLock(Path(temporary)).acquire()
            try:
                nested = ReleaseBuildLock(Path(temporary)).acquire()
                self.assertTrue(nested.inherited)
                self.assertEqual(nested.token, first.token)
                nested.release()
                self.assertTrue(release_build_lease_is_held(Path(temporary)))
            finally:
                first.release()

    def test_owner_records_pid_namespace_and_process_start_identity(self) -> None:
        identity = process_identity(os.getpid())
        if set(identity) != {"pid_namespace", "process_start_ticks"}:
            self.skipTest("Linux /proc process identity is unavailable")
        with tempfile.TemporaryDirectory() as temporary:
            first = ReleaseBuildLock(Path(temporary)).acquire()
            try:
                owner = json.loads(first.owner_path.read_text(encoding="utf-8"))
                self.assertEqual(owner["pid_namespace"], identity["pid_namespace"])
                self.assertEqual(owner["process_start_ticks"], identity["process_start_ticks"])
                self.assertEqual(owner["lease_file"], LEASE_FILE_NAME)
                self.assertEqual(owner["lease_backend"], "fcntl.flock")
            finally:
                first.release()

    def test_stale_owner_with_current_live_pid_is_reclaimed_without_lease(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            lock_dir = root / ".seminar-schools-build.lock"
            lock_dir.mkdir()
            write_json(
                lock_dir / "owner.json",
                {
                    "schema": "seminar-schools-single-writer-lock-v1",
                    "token": "stale-owner",
                    "hostname": socket.gethostname(),
                    "pid": os.getpid(),
                    "created_epoch": time.time(),
                    "scope": "release_build",
                },
            )
            replacement = ReleaseBuildLock(root).acquire()
            try:
                owner = json.loads(replacement.owner_path.read_text(encoding="utf-8"))
                self.assertEqual(owner["token"], replacement.token)
                self.assertTrue(release_build_lease_is_held(root))
            finally:
                replacement.release()
            self.assertFalse(lock_dir.exists())

    def test_owner_token_without_live_lease_cannot_authorize_writer(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            lock_dir = root / ".seminar-schools-build.lock"
            lock_dir.mkdir()
            token = "diagnostic-token-only"
            write_json(
                lock_dir / "owner.json",
                {
                    "schema": "seminar-schools-single-writer-lock-v2",
                    "token": token,
                    "hostname": socket.gethostname(),
                    "pid": os.getpid(),
                    "created_epoch": time.time(),
                    "scope": "release_build",
                    "lease_file": LEASE_FILE_NAME,
                    "lease_backend": "fcntl.flock",
                },
            )
            os.environ[INHERITED_TOKEN_ENV] = token
            with self.assertRaisesRegex(RuntimeError, "no live advisory lease"):
                require_release_build_lock(root)
            os.environ.pop(INHERITED_TOKEN_ENV, None)

    def test_resurrected_stale_owner_cannot_defeat_active_lease(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            first = ReleaseBuildLock(root).acquire()
            inherited = os.environ.pop(INHERITED_TOKEN_ENV)
            write_json(
                first.owner_path,
                {
                    "schema": "seminar-schools-single-writer-lock-v1",
                    "token": "resurrected-stale-owner",
                    "hostname": socket.gethostname(),
                    "pid": os.getpid(),
                    "created_epoch": time.time(),
                    "scope": "release_build",
                },
            )
            try:
                with self.assertRaisesRegex(RuntimeError, "active advisory lease"):
                    ReleaseBuildLock(root).acquire()
            finally:
                os.environ[INHERITED_TOKEN_ENV] = inherited
                first.release()
            replacement = ReleaseBuildLock(root).acquire()
            replacement.release()
            self.assertFalse((root / ".seminar-schools-build.lock").exists())


class CleanRoomTests(unittest.TestCase):
    def test_source_and_archive_evidence_share_global_path_order(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "source"
            archive = root / "release.zip"
            files = {
                "DEPLOY_TOOLS/z-last.txt": b"deploy\n",
                "SITE_PACKAGE/a-first.txt": b"site\n",
                "SITE_PACKAGE/nested/inside.txt": b"nested\n",
                **editable_fixture_files(),
            }
            for relative, payload in files.items():
                target = source / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(payload)
            write_complete_archive(archive, files)

            self.assertEqual(
                clean_room.source_tree_evidence(source),
                clean_room.archive_rebuild_input_evidence(archive),
            )

    def test_pinned_python_pipeline_contract_is_synchronized(self) -> None:
        release_id = EXPECTED_PACKAGE_RELEASE_ID
        generated_at = "2026-08-09T00:00:00Z"
        steps = clean_room.canonical_pipeline_steps(release_id, generated_at)
        self.assertEqual(clean_room.PIPELINE_HELPERS, EXPECTED_CLEAN_ROOM_HELPERS)
        self.assertEqual(len(clean_room.PIPELINE_HELPERS), 9)
        self.assertEqual(steps, expected_clean_pipeline_steps(release_id, generated_at))
        self.assertEqual(tuple(step["action"] for step in steps), EXPECTED_CLEAN_ROOM_ACTIONS)
        self.assertEqual(len(steps), 8)
        self.assertEqual(steps[2]["action"], "install_pinned_python_audit_dependencies")
        self.assertEqual(steps[2]["top_level_requirements"], ARCHIVE_REQUIREMENTS_PATH)
        self.assertEqual(steps[2]["resolved_lock"], ARCHIVE_LOCK_PATH)

    def test_python_audit_installer_requires_exact_pins_and_isolated_target(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            site = root / "site"
            site.mkdir()
            requirements = site / "requirements-audit.txt"
            requirements.write_text("requests==2.32.4\nopenpyxl==3.1.5\n", encoding="utf-8")
            lock = site / "requirements-audit.lock"
            lock.write_text(
                "openpyxl==3.1.5 \\\n"
                "    --hash=sha256:" + "a" * 64 + "\n"
                "requests==2.32.4 \\\n"
                "    --hash=sha256:" + "b" * 64 + "\n",
                encoding="utf-8",
            )
            target = root / "isolated-dependencies"
            with mock.patch.dict(os.environ, {}, clear=True), mock.patch(
                "audit_python_dependencies.subprocess.run"
            ) as run, mock.patch(
                "audit_python_dependencies.installed_distribution_inventory",
                return_value=["openpyxl==3.1.5", "requests==2.32.4"],
            ):
                prepared = prepare_audit_python_dependencies(site, target)
                command = run.call_args.args[0]
                self.assertEqual(prepared, target.resolve())
                self.assertEqual(command[:4], [sys.executable, "-m", "pip", "install"])
                self.assertIn("--require-hashes", command)
                self.assertIn("--target", command)
                self.assertEqual(command[command.index("--target") + 1], str(target.resolve()))
                self.assertEqual(command[-2:], ["-r", str(lock.resolve())])
                self.assertEqual(os.environ["PYTHONPATH"], str(target.resolve()))

            requirements.write_text("requests>=2\n", encoding="utf-8")
            with mock.patch("audit_python_dependencies.subprocess.run") as run:
                with self.assertRaisesRegex(RuntimeError, "non-exact requirements"):
                    prepare_audit_python_dependencies(site, target)
                run.assert_not_called()

            requirements.write_text("requests==2.32.4\n", encoding="utf-8")
            lock.write_text("requests==2.32.4\n", encoding="utf-8")
            with mock.patch("audit_python_dependencies.subprocess.run") as run:
                with self.assertRaisesRegex(RuntimeError, "unsupported line|without hashes"):
                    prepare_audit_python_dependencies(site, target)
                run.assert_not_called()

    def test_clean_copy_prunes_state_and_preserves_nested_download_archives(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "source"
            destination = root / "clean-copy"
            nested = source / "SITE_PACKAGE" / "saul" / "downloads"
            nested.mkdir(parents=True)
            (nested / "saul-karim-nassau-all-cv-outputs.zip").write_bytes(b"nested zip")
            (nested / "ss-site-legitimate-nested.zip").write_bytes(b"nested release-name zip")
            (source / "ss-site-prior.zip").write_bytes(b"prior release")
            (source / ".seminar-schools-build.lease").write_text("lease", encoding="utf-8")
            (source / ".env").write_text("SECRET=one\n", encoding="utf-8")
            (source / ".env.production").write_text("SECRET=two\n", encoding="utf-8")
            (source / ".env.example").write_text("SECRET=example\n", encoding="utf-8")
            for relative in (
                "node_modules/package",
                ".netlify/state",
                ".public-build-staging/output",
                ".public-build-previous/output",
                ".public-build-lock/owner",
                ".ss-public-build-abandoned-manual-fixture/staging/index.html",
                ".seminar-schools-build.lock/owner.json",
                ".venv/bin/python",
                "env/bin/python",
                "audit99-work/transient.txt",
            ):
                path = source / relative
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text("disposable\n", encoding="utf-8")
            regular = source / "SITE_PACKAGE" / "index.html"
            regular.parent.mkdir(parents=True, exist_ok=True)
            regular.write_text("<!doctype html>\n", encoding="utf-8")
            symlink_supported = True
            try:
                (source / "linked-file").symlink_to(regular)
                (source / "linked-directory").symlink_to(nested, target_is_directory=True)
            except OSError:
                symlink_supported = False

            clean_room.copy_clean_source(source, destination)

            self.assertTrue(
                (destination / "SITE_PACKAGE/saul/downloads/saul-karim-nassau-all-cv-outputs.zip").is_file()
            )
            self.assertTrue(
                (destination / "SITE_PACKAGE/saul/downloads/ss-site-legitimate-nested.zip").is_file()
            )
            self.assertTrue((destination / ".env.example").is_file())
            for relative in (
                "ss-site-prior.zip",
                ".seminar-schools-build.lease",
                ".env",
                ".env.production",
                "node_modules",
                ".netlify",
                ".public-build-staging",
                ".public-build-previous",
                ".public-build-lock",
                ".ss-public-build-abandoned-manual-fixture",
                ".seminar-schools-build.lock",
                ".venv",
                "env",
                "audit99-work",
            ):
                self.assertFalse((destination / relative).exists(), relative)
            if symlink_supported:
                self.assertFalse((destination / "linked-file").exists())
                self.assertFalse((destination / "linked-directory").exists())

    def test_reference_mode_rejects_caller_supplied_fake_copy_command(self) -> None:
        stderr = io.StringIO()
        with redirect_stderr(stderr), self.assertRaises(SystemExit):
            clean_room.main(
                [
                    "--reference-archive",
                    "reference.zip",
                    "--command-json",
                    '["cp", "reference.zip", "{output}"]',
                ]
            )
        self.assertIn("--command-json is forbidden", stderr.getvalue())

    def test_substituted_clean_build_helper_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            clean_root = Path(temporary)
            for relative in clean_room.PIPELINE_HELPERS:
                trusted = clean_room.DELIVERY_ROOT / relative
                copied = clean_root / relative
                copied.parent.mkdir(parents=True, exist_ok=True)
                copied.write_bytes(trusted.read_bytes())
            substituted = clean_root / "SITE_PACKAGE/scripts/build-clean-room-release.py"
            substituted.write_bytes(substituted.read_bytes() + b"\n# fake copy shortcut\n")
            with self.assertRaisesRegex(ValueError, "substituted canonical helper"):
                clean_room.helper_evidence(clean_root)

    def test_compare_mode_cannot_claim_canonical_pipeline(self) -> None:
        stderr = io.StringIO()
        with redirect_stderr(stderr), self.assertRaises(SystemExit):
            clean_room.main(
                [
                    "--compare",
                    "left.zip",
                    "right.zip",
                    "--pipeline-id",
                    clean_room.PIPELINE_ID,
                ]
            )
        self.assertIn("--pipeline-id is verifier-owned", stderr.getvalue())

    def test_canonical_environment_is_allowlisted_and_timestamp_bound(self) -> None:
        actual_path = os.environ.get("PATH", os.defpath)
        with tempfile.TemporaryDirectory() as temporary, mock.patch.dict(
            os.environ,
            {
                "PATH": actual_path,
                "CHROMIUM_PATH": sys.executable,
                "NPM_CONFIG_OFFLINE": "true",
                "PIP_NO_INDEX": "1",
                "PIP_FIND_LINKS": "/verified/wheelhouse",
                "UNRELATED_SECRET": "must-not-pass",
                "SOURCE_DATE_EPOCH": "wrong-caller-value",
            },
            clear=True,
        ):
            environment, evidence = clean_room.clean_environment(
                Path(temporary), "2026-08-09T00:00:00Z"
            )
            self.assertEqual(environment["PATH"], actual_path)
            self.assertEqual(environment["CHROMIUM_PATH"], sys.executable)
            self.assertEqual(environment["NPM_CONFIG_OFFLINE"], "true")
            self.assertEqual(environment["PIP_NO_INDEX"], "1")
            self.assertEqual(environment["PIP_FIND_LINKS"], "/verified/wheelhouse")
            self.assertNotIn("UNRELATED_SECRET", environment)
            self.assertEqual(environment["SOURCE_DATE_EPOCH"], "1786233600")
            self.assertEqual(evidence["fixed_values"]["TZ"], "UTC")
            self.assertEqual(evidence["fixed_values"]["PYTHONHASHSEED"], "0")

    def test_reference_report_binds_manifest_metadata_and_pipeline_evidence(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            reference = root / "reference.zip"
            report_path = root / "clean-room-report.json"
            write_complete_archive(
                reference,
                {
                    "DEPLOY_TOOLS/readme.txt": b"deploy\n",
                    "SITE_PACKAGE/index.html": b"<!doctype html>\n",
                    ARCHIVE_REQUIREMENTS_PATH: (SITE_ROOT / "requirements-audit.txt").read_bytes(),
                    ARCHIVE_LOCK_PATH: (SITE_ROOT / "requirements-audit.lock").read_bytes(),
                    **editable_fixture_files(),
                },
            )
            archive_inputs = clean_room.archive_rebuild_input_evidence(reference)

            def fake_materialize(
                source_root: Path,
                destination: Path,
                label: str,
                release_id: str,
                generated_at: str,
            ) -> tuple[Path, dict]:
                self.assertEqual(release_id, EXPECTED_PACKAGE_RELEASE_ID)
                self.assertEqual(generated_at, "2026-08-09T00:00:00Z")
                rebuilt = destination / label / "ss-site-clean-room.zip"
                rebuilt.parent.mkdir(parents=True)
                rebuilt.write_bytes(reference.read_bytes())
                Path(str(rebuilt) + ".sha256").write_text(
                    f"{digest(rebuilt.read_bytes())}  {rebuilt.name}\n",
                    encoding="utf-8",
                )
                return rebuilt, {
                    "source_snapshot": archive_inputs,
                    "pipeline_helpers": [
                        {"path": "SITE_PACKAGE/scripts/build-clean-room-release.py", "sha256": "b" * 64}
                    ],
                    "pipeline_steps": clean_room.canonical_pipeline_steps(
                        release_id, generated_at
                    ),
                    "pinned_python_audit_dependencies": {
                        **pinned_audit_requirements_evidence_from_bytes(
                            (SITE_ROOT / "requirements-audit.txt").read_bytes(),
                            (SITE_ROOT / "requirements-audit.lock").read_bytes(),
                        ),
                        "installed_distribution_count": 22,
                        "installed_distributions": pinned_audit_requirements_evidence_from_bytes(
                            (SITE_ROOT / "requirements-audit.txt").read_bytes(),
                            (SITE_ROOT / "requirements-audit.lock").read_bytes(),
                        )["locked_distributions"],
                        "installed_inventory_matches_lock": True,
                    },
                    "pinned_python_audit_dependencies_verified": True,
                    "external_inputs": {"fixed_values": {"TZ": "UTC"}},
                }

            with mock.patch.object(
                clean_room, "require_release_build_lock"
            ), mock.patch.object(clean_room, "materialize_and_run", side_effect=fake_materialize):
                clean_room.main(
                    [
                        "--reference-archive",
                        str(reference),
                        "--source-root",
                        str(root),
                        "--delivery-root",
                        str(root),
                        "--report",
                        str(report_path),
                    ]
                )
            report = json.loads(report_path.read_text(encoding="utf-8"))
            self.assertEqual(report["mode"], "reference_rebuild")
            self.assertIs(report["canonical_pipeline"], True)
            self.assertEqual(report["pipeline_id"], clean_room.PIPELINE_ID)
            self.assertEqual(report["release_id"], EXPECTED_PACKAGE_RELEASE_ID)
            self.assertEqual(report["generated_at"], "2026-08-09T00:00:00Z")
            self.assertEqual(
                report["source_snapshot"]["tree_sha256"],
                archive_inputs["tree_sha256"],
            )
            self.assertIs(report["source_snapshot_matches_archive"], True)
            self.assertEqual(report["passed_checks"], 5)

    def test_byte_drift_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            left = root / "left.zip"
            right = root / "right.zip"
            files = {
                "DEPLOY_TOOLS/readme.txt": b"deploy fixture\n",
                "SITE_PACKAGE/index.html": b"<!doctype html>\n",
            }
            files.update(editable_fixture_files())
            write_complete_archive(left, files)
            right.write_bytes(left.read_bytes())
            right_digest = digest(right.read_bytes())
            Path(str(right) + ".sha256").write_text(
                f"{right_digest}  {right.name}\n", encoding="utf-8"
            )
            failures, _ = clean_room.compare_archive_pair(left, right)
            self.assertEqual(failures, [])
            right.write_bytes(right.read_bytes() + b"drift")
            right_digest = digest(right.read_bytes())
            Path(str(right) + ".sha256").write_text(
                f"{right_digest}  {right.name}\n", encoding="utf-8"
            )
            failures, _ = clean_room.compare_archive_pair(left, right)
            self.assertIn("clean-room archives are not byte-identical", failures)


class DisasterRecoveryTests(unittest.TestCase):
    def make_archive(self, root: Path) -> tuple[Path, Path]:
        files = {
            "DEPLOY_TOOLS/readme.txt": b"deploy\n",
            "SITE_PACKAGE/index.html": b"<!doctype html>\n",
        }
        files.update(editable_fixture_files())
        archive = root / "recovery.zip"
        sidecar, _, _ = write_complete_archive(archive, files)
        return archive, sidecar

    def test_clean_restore_passes_and_truncated_archive_fails(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            archive, sidecar = self.make_archive(Path(temporary))
            evidence = recovery.verify_recovery_archive(archive, sidecar)
            self.assertEqual(evidence["editable_masters"]["file_count"], 10)
            archive.write_bytes(archive.read_bytes()[:40])
            sidecar.write_text(f"{digest(archive.read_bytes())}  {archive.name}\n", encoding="utf-8")
            with self.assertRaises((ValueError, zipfile.BadZipFile)):
                recovery.verify_recovery_archive(archive, sidecar)

    def test_coherent_nine_master_archive_is_rejected(self) -> None:
        """A matching nine-row JSON, sums file, and ZIP still violates the contract."""
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            omitted = sorted(EXPECTED_EDITABLE_MASTER_PATHS)[0]
            files = {
                "DEPLOY_TOOLS/readme.txt": b"deploy\n",
                "SITE_PACKAGE/index.html": b"<!doctype html>\n",
            }
            files.update(editable_fixture_files(omit=omitted))
            archive = root / "shrunk-recovery.zip"
            sidecar, _, _ = write_complete_archive(archive, files)

            with self.assertRaisesRegex(ValueError, "exact ten canonical masters"):
                recovery.verify_recovery_archive(archive, sidecar)


class PublicPrivateBoundaryTests(unittest.TestCase):
    @staticmethod
    def make_delivery(root: Path, *, omit_editable: str | None = None) -> dict:
        public = root / "SITE_PACKAGE/public"
        for directory in (
            public,
            root / "SITE_PACKAGE/scripts",
            root / "EDITABLE_MASTERS",
            root / "DEPLOY_TOOLS",
        ):
            directory.mkdir(parents=True, exist_ok=True)
        (public / "index.html").write_text("<!doctype html>", encoding="utf-8")
        for relative, payload in editable_fixture_files(omit=omit_editable).items():
            target = root / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(payload)
        write_json(
            root / "PACKAGE_CONTENTS_SHA256.json",
            {
                "files": [
                    {"path": "SITE_PACKAGE/index.html"},
                    {"path": "EDITABLE_MASTERS/EDITABLE_MASTERS_MANIFEST.json"},
                    {"path": "DEPLOY_TOOLS/README"},
                ]
            },
        )
        return {
            "schema": "seminar-schools-public-private-boundary-v1",
            "public_root": "SITE_PACKAGE/public",
            "private_roots": ["SITE_PACKAGE/scripts", "EDITABLE_MASTERS", "DEPLOY_TOOLS"],
            "complete_package_required_roots": ["SITE_PACKAGE", "EDITABLE_MASTERS", "DEPLOY_TOOLS"],
            "public_forbidden_top_level": ["EDITABLE_MASTERS"],
            "public_forbidden_files": [".env"],
            "public_forbidden_name_pattern": "(?:PRIVATE|SECRET)",
            "secret_patterns": ["TOKEN=\\S+"],
            "required_private_manifests": [
                "EDITABLE_MASTERS/EDITABLE_MASTERS_MANIFEST.json",
                "EDITABLE_MASTERS/SHA256SUMS.txt",
            ],
        }

    def test_private_root_in_public_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            policy = self.make_delivery(root)
            public = root / "SITE_PACKAGE/public"
            failures, evidence = boundary.validate_boundary(policy, root)
            self.assertEqual(failures, [])
            self.assertEqual(evidence["editable_masters_verified"], 10)
            (public / "EDITABLE_MASTERS").mkdir()
            failures, _ = boundary.validate_boundary(policy, root)
            self.assertTrue(any("private/operator root reached public deploy" in failure for failure in failures))

    def test_coherent_nine_master_handoff_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            omitted = sorted(EXPECTED_EDITABLE_MASTER_PATHS)[0]
            policy = self.make_delivery(root, omit_editable=omitted)
            failures, evidence = boundary.validate_boundary(policy, root)
            self.assertTrue(any("exact ten canonical masters" in failure for failure in failures))
            self.assertEqual(evidence["editable_masters_verified"], 0)

    def test_github_token_pattern_does_not_match_reddit_slug_suffix(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            policy = self.make_delivery(root)
            policy["secret_patterns"] = [
                "(?<![A-Za-z0-9_])gh[pousr]_[A-Za-z0-9_]{20,}"
            ]
            public = root / "SITE_PACKAGE/public"
            page = public / "event.html"
            page.write_text(
                "https://www.reddit.com/r/movies/comments/example/"
                "hi_reddit_i_am_yeon_sangho_director_of_train_to/",
                encoding="utf-8",
            )
            failures, _ = boundary.validate_boundary(policy, root)
            self.assertFalse(
                any("secret-shaped content" in failure for failure in failures)
            )
            page.write_text(
                "GITHUB_TOKEN=" + "gh" + "p_" + "1234567890abcdefghijklmnop",
                encoding="utf-8",
            )
            failures, _ = boundary.validate_boundary(policy, root)
            self.assertTrue(
                any("secret-shaped content" in failure for failure in failures)
            )


if __name__ == "__main__":
    unittest.main()
