#!/usr/bin/env python3
"""Prove that a complete ZIP and sidecar restore source plus editable masters."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import tempfile
import zipfile

from atomic_json import write_json_atomic
from build_lock import require_release_build_lock
from editable_masters_integrity import verify_editable_masters


MANIFEST_MEMBER = "PACKAGE_CONTENTS_SHA256.json"
CHUNK = 1024 * 1024
SITE_ROOT = Path(__file__).resolve().parents[1]
DELIVERY_ROOT = SITE_ROOT.parent


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(CHUNK), b""):
            digest.update(chunk)
    return digest.hexdigest()


def safe_member(name: str) -> bool:
    parsed = PurePosixPath(name)
    return bool(name) and not parsed.is_absolute() and ".." not in parsed.parts and "" not in parsed.parts


def verify_editable_restore(root: Path) -> dict:
    editable = root / "EDITABLE_MASTERS"
    return {"file_count": verify_editable_masters(editable)}


def verify_recovery_archive(archive: Path, sidecar: Path) -> dict:
    archive = Path(archive).resolve()
    sidecar = Path(sidecar).resolve()
    digest = file_sha256(archive)
    sidecar_parts = sidecar.read_text(encoding="utf-8").split()
    if len(sidecar_parts) != 2 or sidecar_parts[0] != digest or sidecar_parts[1] != archive.name:
        raise ValueError("disaster-recovery checksum sidecar does not bind to the archive")
    with zipfile.ZipFile(archive, "r") as zipped:
        names = zipped.namelist()
        if len(names) != len(set(names)) or not all(safe_member(name) for name in names):
            raise ValueError("archive has duplicate or unsafe member paths")
        if MANIFEST_MEMBER not in names:
            raise ValueError("archive has no integrity manifest")
        manifest = json.loads(zipped.read(MANIFEST_MEMBER))
        rows = manifest.get("files") or []
        if manifest.get("file_count") != len(rows):
            raise ValueError("archive manifest count differs from its rows")
        expected_names = [row.get("path") for row in rows] + [MANIFEST_MEMBER]
        if names != expected_names:
            raise ValueError("archive members or ordering differ from the integrity manifest")
        with tempfile.TemporaryDirectory(prefix="ss-disaster-recovery-") as temporary:
            restored = Path(temporary)
            tree_digest = hashlib.sha256()
            for row in rows:
                name = str(row.get("path") or "")
                target = restored / name
                target.parent.mkdir(parents=True, exist_ok=True)
                member_digest = hashlib.sha256()
                byte_count = 0
                with zipped.open(name, "r") as source, target.open("wb") as output:
                    for chunk in iter(lambda: source.read(CHUNK), b""):
                        output.write(chunk)
                        member_digest.update(chunk)
                        byte_count += len(chunk)
                actual = member_digest.hexdigest()
                if byte_count != row.get("bytes") or actual != row.get("sha256"):
                    raise ValueError(f"restored member failed integrity: {name}")
                tree_digest.update(f"{name}\0{byte_count}\0{actual}\n".encode("utf-8"))
            required_roots = ["SITE_PACKAGE", "EDITABLE_MASTERS", "DEPLOY_TOOLS"]
            for root_name in required_roots:
                if not (restored / root_name).is_dir():
                    raise ValueError(f"restored archive omits required root: {root_name}")
            editable = verify_editable_restore(restored)
            return {
                "archive": {"bytes": archive.stat().st_size, "sha256": digest, "file_count": len(rows)},
                "restored_tree": {"sha256": tree_digest.hexdigest()},
                "editable_masters": editable,
                "required_roots": required_roots,
            }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("archive", type=Path)
    parser.add_argument("--sidecar", type=Path)
    parser.add_argument("--report", type=Path)
    parser.add_argument("--delivery-root", type=Path, default=DELIVERY_ROOT)
    args = parser.parse_args()
    require_release_build_lock(args.delivery_root)
    archive = args.archive.resolve()
    sidecar = (args.sidecar or Path(str(archive) + ".sha256")).resolve()
    evidence = verify_recovery_archive(archive, sidecar)
    report = {
        "schema": "seminar-schools-disaster-recovery-report-v1",
        "status": "passed",
        "total_checks": 5,
        "passed_checks": 5,
        "failed_checks": [],
        **evidence,
    }
    if args.report:
        write_json_atomic(args.report, report)
    print(
        "DISASTER RECOVERY PASSED — "
        f"{evidence['archive']['file_count']} files restored in a clean room; "
        f"{evidence['editable_masters']['file_count']} editable masters verified."
    )


if __name__ == "__main__":
    main()
