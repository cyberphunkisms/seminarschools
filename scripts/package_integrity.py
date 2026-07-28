#!/usr/bin/env python3
"""Deterministic ZIP writer with an extracted-content integrity manifest."""
from __future__ import annotations

import datetime
import hashlib
import json
import os
import socket
import time
import zipfile
from contextlib import contextmanager
from pathlib import Path
from typing import Iterable

MANIFEST_NAME = "PACKAGE_CONTENTS_SHA256.json"
STREAM_CHUNK_BYTES = 1024 * 1024
LOCK_STALE_SECONDS = 6 * 60 * 60


def stable_zip_time(release_manifest: dict) -> tuple[int, int, int, int, int, int]:
    value = str(release_manifest.get("generated_at") or "2026-01-01T00:00:00+00:00").replace("Z", "+00:00")
    moment = datetime.datetime.fromisoformat(value).astimezone(datetime.timezone.utc)
    year = min(2107, max(1980, moment.year))
    return (year, moment.month, moment.day, moment.hour, moment.minute, moment.second - (moment.second % 2))


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(STREAM_CHUNK_BYTES), b""):
            digest.update(chunk)
    return digest.hexdigest()


def zip_info(name: str, timestamp: tuple[int, int, int, int, int, int], mode: int = 0o644) -> zipfile.ZipInfo:
    info = zipfile.ZipInfo(name, timestamp)
    info.compress_type = zipfile.ZIP_DEFLATED
    info.create_system = 3
    info.external_attr = (mode & 0o777) << 16
    return info


def write_file_member(
    archive: zipfile.ZipFile,
    path: Path,
    entry: dict,
    timestamp: tuple[int, int, int, int, int, int],
) -> dict:
    """Write and hash one stable source snapshot in a single source-file pass."""
    info = zip_info(entry["path"], timestamp, entry["mode"])
    info.file_size = entry["bytes"]
    info._compresslevel = 9
    digest = hashlib.sha256()
    byte_count = 0
    with path.open("rb") as source, archive.open(info, "w") as destination:
        for chunk in iter(lambda: source.read(STREAM_CHUNK_BYTES), b""):
            destination.write(chunk)
            digest.update(chunk)
            byte_count += len(chunk)
    if byte_count != entry["bytes"] or file_snapshot(path) != entry["snapshot"]:
        raise RuntimeError(f"source changed while packaging: {entry['path']}")
    return {
        "path": entry["path"],
        "bytes": byte_count,
        "sha256": digest.hexdigest(),
    }


def verify_file_member(archive: zipfile.ZipFile, row: dict) -> None:
    """Verify size, SHA-256, and ZIP CRC in one streamed archive-member pass."""
    digest = hashlib.sha256()
    byte_count = 0
    try:
        with archive.open(row["path"], "r") as member:
            for chunk in iter(lambda: member.read(STREAM_CHUNK_BYTES), b""):
                byte_count += len(chunk)
                digest.update(chunk)
    except zipfile.BadZipFile as error:
        raise RuntimeError(f"archive CRC verification failed for {row['path']}") from error
    if byte_count != row["bytes"] or digest.hexdigest() != row["sha256"]:
        raise RuntimeError(f"archive content verification failed for {row['path']}")


def file_snapshot(path: Path) -> tuple[int, int, int, int, int]:
    status = path.stat()
    return (
        status.st_dev,
        status.st_ino,
        status.st_mode,
        status.st_size,
        status.st_mtime_ns,
    )


def process_is_alive(pid: int) -> bool:
    if pid <= 0:
        return False
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    except OSError:
        return True
    return True


@contextmanager
def exclusive_output_lock(output: Path):
    """Serialize writers targeting the same archive and recover stale locks."""
    lock = output.with_name(f".{output.name}.lock")
    host = socket.gethostname()
    token = f"{host}:{os.getpid()}:{time.time_ns()}"
    payload = {
        "token": token,
        "hostname": host,
        "pid": os.getpid(),
        "created_epoch": time.time(),
    }
    acquired = False
    for _ in range(2):
        try:
            descriptor = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        except FileExistsError as error:
            try:
                owner = json.loads(lock.read_text(encoding="utf-8"))
            except (OSError, ValueError, TypeError):
                owner = {}
            try:
                created_epoch = float(owner.get("created_epoch") or lock.stat().st_mtime)
            except (FileNotFoundError, TypeError, ValueError):
                continue
            age = max(0.0, time.time() - created_epoch)
            same_host = owner.get("hostname") == host
            active_owner = same_host and process_is_alive(int(owner.get("pid") or 0))
            if active_owner or age < LOCK_STALE_SECONDS:
                raise RuntimeError(f"package output is already being written: {output}") from error
            try:
                lock.unlink()
            except FileNotFoundError:
                pass
            continue
        try:
            with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
                json.dump(payload, handle, sort_keys=True)
                handle.write("\n")
                handle.flush()
                os.fsync(handle.fileno())
        except Exception:
            lock.unlink(missing_ok=True)
            raise
        acquired = True
        break
    if not acquired:
        raise RuntimeError(f"could not acquire package output lock: {output}")
    try:
        yield lock
    finally:
        try:
            current = json.loads(lock.read_text(encoding="utf-8"))
        except (OSError, ValueError, TypeError):
            current = {}
        if current.get("token") == token:
            lock.unlink(missing_ok=True)


def validate_selected_files(root: Path, output: Path, files: Iterable[Path]) -> list[Path]:
    """Reject duplicate, escaping, special, symlinked, and transaction inputs."""
    ordered_by_name: dict[str, Path] = {}
    sidecar = Path(str(output) + ".sha256")
    reserved_outputs = {
        output,
        sidecar,
        output.with_name(f".{output.name}.previous"),
        sidecar.with_name(f".{sidecar.name}.previous"),
        output.with_name(f".{output.name}.lock"),
    }
    for supplied in files:
        candidate = Path(supplied)
        if candidate.is_symlink():
            raise ValueError(f"archive input cannot be a symbolic link: {candidate}")
        try:
            resolved = candidate.resolve(strict=True)
            relative = resolved.relative_to(root)
        except (FileNotFoundError, ValueError) as error:
            raise ValueError(f"archive input must be a regular file inside {root}: {candidate}") from error
        if not resolved.is_file():
            raise ValueError(f"archive input is not a regular file: {candidate}")
        path = resolved
        if path.relative_to(root).as_posix() == MANIFEST_NAME:
            raise ValueError(
                f"{MANIFEST_NAME} is generated by the archive writer and cannot be selected as input"
            )
        relative_name = relative.as_posix()
        if resolved in reserved_outputs:
            raise ValueError(f"archive transaction artifact cannot be selected as input: {candidate}")
        if relative_name in ordered_by_name:
            raise ValueError(f"duplicate archive member selected: {relative_name}")
        ordered_by_name[relative_name] = resolved
    return [ordered_by_name[name] for name in sorted(ordered_by_name)]


def recover_interrupted_pair(
    output: Path,
    sidecar: Path,
    backup_output: Path,
    backup_sidecar: Path,
) -> None:
    """Finish or roll back an interrupted two-file commit before writing again."""
    if not backup_output.exists() and not backup_sidecar.exists():
        return
    if output.exists() and sidecar.exists():
        backup_output.unlink(missing_ok=True)
        backup_sidecar.unlink(missing_ok=True)
        return
    output.unlink(missing_ok=True)
    sidecar.unlink(missing_ok=True)
    if backup_output.exists():
        os.replace(backup_output, output)
    if backup_sidecar.exists():
        os.replace(backup_sidecar, sidecar)


def commit_verified_pair(
    temporary_output: Path,
    output: Path,
    temporary_sidecar: Path,
    sidecar: Path,
    archive_sha256: str,
    sidecar_text: str,
) -> None:
    """Commit a verified ZIP/checksum pair and restore the prior pair on failure."""
    backup_output = output.with_name(f".{output.name}.previous")
    backup_sidecar = sidecar.with_name(f".{sidecar.name}.previous")
    recover_interrupted_pair(output, sidecar, backup_output, backup_sidecar)
    moved_output = False
    moved_sidecar = False
    installed_output = False
    installed_sidecar = False
    try:
        if output.exists():
            os.replace(output, backup_output)
            moved_output = True
        if sidecar.exists():
            os.replace(sidecar, backup_sidecar)
            moved_sidecar = True
        os.replace(temporary_output, output)
        installed_output = True
        os.replace(temporary_sidecar, sidecar)
        installed_sidecar = True
        if file_sha256(output) != archive_sha256:
            raise RuntimeError("committed archive digest differs from the verified temporary archive")
        if sidecar.read_text(encoding="utf-8") != sidecar_text:
            raise RuntimeError("committed checksum sidecar differs from the verified digest")
    except Exception as commit_error:
        if installed_output:
            output.unlink(missing_ok=True)
        if installed_sidecar:
            sidecar.unlink(missing_ok=True)
        rollback_errors = []
        if moved_output:
            try:
                os.replace(backup_output, output)
            except Exception as rollback_error:
                rollback_errors.append(f"archive rollback failed: {rollback_error}")
        if moved_sidecar:
            try:
                os.replace(backup_sidecar, sidecar)
            except Exception as rollback_error:
                rollback_errors.append(f"sidecar rollback failed: {rollback_error}")
        if rollback_errors:
            raise RuntimeError(
                f"package pair commit failed ({commit_error}); "
                + "; ".join(rollback_errors)
                + f"; recovery files: {backup_output}, {backup_sidecar}"
            ) from commit_error
        raise
    else:
        backup_output.unlink(missing_ok=True)
        backup_sidecar.unlink(missing_ok=True)


def write_verified_archive(
    root: Path,
    output: Path,
    files: Iterable[Path],
    release_manifest: dict,
    package_kind: str,
) -> dict:
    root = root.resolve()
    output = output.resolve()
    ordered = validate_selected_files(root, output, files)
    entries = []
    for path in ordered:
        status = path.stat()
        entries.append({
            "path": path.relative_to(root).as_posix(),
            "bytes": status.st_size,
            "mode": status.st_mode,
            "snapshot": (
                status.st_dev,
                status.st_ino,
                status.st_mode,
                status.st_size,
                status.st_mtime_ns,
            ),
        })
    timestamp = stable_zip_time(release_manifest)
    output.parent.mkdir(parents=True, exist_ok=True)
    sidecar = Path(str(output) + ".sha256")
    temporary_output = output.with_name(f".{output.name}.part-{os.getpid()}")
    temporary_sidecar = sidecar.with_name(f".{sidecar.name}.part-{os.getpid()}")
    with exclusive_output_lock(output):
        temporary_output.unlink(missing_ok=True)
        temporary_sidecar.unlink(missing_ok=True)
        try:
            rows = []
            with zipfile.ZipFile(temporary_output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9, allowZip64=True) as archive:
                for path, entry in zip(ordered, entries):
                    rows.append(write_file_member(archive, path, entry, timestamp))
                manifest = {
                    "schema": "seminar-schools-package-contents-v1",
                    "package_kind": package_kind,
                    "release_id": release_manifest.get("release_id"),
                    "generated_at": release_manifest.get("generated_at"),
                    "file_count": len(rows),
                    "total_uncompressed_bytes": sum(row["bytes"] for row in rows),
                    "files": rows,
                }
                manifest_bytes = (
                    json.dumps(manifest, ensure_ascii=False, sort_keys=True, indent=2) + "\n"
                ).encode("utf-8")
                archive.writestr(
                    zip_info(MANIFEST_NAME, timestamp),
                    manifest_bytes,
                    compress_type=zipfile.ZIP_DEFLATED,
                    compresslevel=9,
                )

            expected_names = [row["path"] for row in rows] + [MANIFEST_NAME]
            with zipfile.ZipFile(temporary_output, "r") as archive:
                if archive.namelist() != expected_names:
                    raise RuntimeError("archive member order/content differs from the deterministic manifest")
                archived_manifest = json.loads(archive.read(MANIFEST_NAME))
                if archived_manifest != manifest:
                    raise RuntimeError("archived integrity manifest differs from the generated manifest")
                for row in rows:
                    verify_file_member(archive, row)

            archive_sha256 = file_sha256(temporary_output)
            sidecar_text = f"{archive_sha256}  {output.name}\n"
            temporary_sidecar.write_text(sidecar_text, encoding="utf-8")
            # Commit only after the complete archive has passed CRC, manifest,
            # size, and byte-digest verification. The output lock serializes
            # pair-level recovery and replacement for a shared target.
            commit_verified_pair(
                temporary_output,
                output,
                temporary_sidecar,
                sidecar,
                archive_sha256,
                sidecar_text,
            )
        finally:
            temporary_output.unlink(missing_ok=True)
            temporary_sidecar.unlink(missing_ok=True)

    sidecar = Path(str(output) + ".sha256")
    return {
        "file_count": len(rows),
        "archive_bytes": output.stat().st_size,
        "archive_sha256": archive_sha256,
        "sidecar": sidecar,
        "manifest": manifest,
    }
