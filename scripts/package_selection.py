#!/usr/bin/env python3
"""Shared, pruned file selection for Seminar Schools release archives."""
from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Iterable

try:
    from .package_integrity import MANIFEST_NAME
except ImportError:
    from package_integrity import MANIFEST_NAME


FIXED_GENERATED_DIRECTORIES = {
    ".git",
    ".netlify",
    "node_modules",
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
    ".tox",
    ".nox",
    "htmlcov",
    ".public-build-staging",
    ".public-build-previous",
    ".public-build-lock",
    ".seminar-schools-build.lock",
}
EXCLUDED_FILES = {
    "cv-modular-onepage-samples-2026-07-09.zip",
    "cv-modular-onepage-samples-final-2026-07-09.zip",
    "Saul_Karim_Nassau_CV_onepage_revamp_2026-07-09.pdf",
    "Saul_Karim_Nassau_CV_onepage_final_2026-07-09.pdf",
}
GENERATED_RELEASE_ARCHIVE = re.compile(
    r"(?:ss-site-[^/]*|seminarschools-(?:deployer-compatible|netlify-source)[^/]*)"
    r"\.zip(?:\.sha256)?$",
    re.IGNORECASE,
)
GENERATED_RELEASE_EVIDENCE = re.compile(
    r"ss-site-[^/]*\.zip\.(?:audit-receipt|clean-room-report|disaster-recovery-report)\.json$",
    re.IGNORECASE,
)


def generated_work_dir(part: str) -> bool:
    return bool(
        re.fullmatch(r"(?:polymythcal[-_])?audit\d+(?:[-_].*)?", part, re.IGNORECASE)
        or re.fullmatch(r"\.ss-public-build-abandoned(?:-.*)?", part, re.IGNORECASE)
        or re.fullmatch(r".*[-_]work", part, re.IGNORECASE)
        or re.fullmatch(r".*[-_]packaged[-_]test", part, re.IGNORECASE)
    )


def generated_dependency_dir(part: str) -> bool:
    value = part.lower()
    return bool(
        re.fullmatch(r"\.?venv(?:[-_].+)?", value)
        or value in {"env", ".env", "pip-wheel-metadata", ".rsync-tmp", ".rsync-partial"}
    )


def selected_bytes_excluding(
    files: Iterable[Path],
    excluded_paths: Iterable[Path],
) -> int:
    """Measure selected bytes without self-updating evidence files.

    Report generators use this with an exact set of self-updating evidence
    files instead of measuring their circular output state. Every supplied
    file remains selected, hashed, and packaged; only the diagnostic byte
    total excludes it.
    """
    excluded = {Path(path).resolve() for path in excluded_paths}
    return sum(path.stat().st_size for path in files if path.resolve() not in excluded)


def output_transaction_names(output: Path) -> set[str]:
    sidecar_name = f"{output.name}.sha256"
    return {
        output.name,
        sidecar_name,
        f".{output.name}.previous",
        f".{sidecar_name}.previous",
        f".{output.name}.lock",
    }


def is_output_transaction_artifact(path: Path, output: Path) -> bool:
    if path.parent.resolve() != output.parent.resolve():
        return False
    names = output_transaction_names(output)
    if path.name in names:
        return True
    return (
        path.name.startswith(f".{output.name}.part-")
        or path.name.startswith(f".{output.name}.lock-")
        or path.name.startswith(f".{output.name}.sha256.part-")
    )


def collect_package_files(
    root: Path,
    output: Path,
    *,
    excluded_top_level: Iterable[str] = (),
) -> tuple[list[Path], dict[str, int]]:
    """Select regular files while pruning disposable trees before descent."""
    root = root.resolve()
    output = output.resolve()
    excluded_roots = set(excluded_top_level)
    files: list[Path] = []
    stats = {
        "directories_visited": 0,
        "directories_pruned": 0,
        "files_considered": 0,
        "files_selected": 0,
    }

    for current, directory_names, file_names in os.walk(root, topdown=True, followlinks=False):
        stats["directories_visited"] += 1
        current_path = Path(current)
        at_root = current_path == root
        kept_directories = []
        for name in sorted(directory_names):
            candidate = current_path / name
            should_prune = (
                candidate.is_symlink()
                or name in FIXED_GENERATED_DIRECTORIES
                or generated_dependency_dir(name)
                or (at_root and (name in excluded_roots or generated_work_dir(name)))
            )
            if should_prune:
                stats["directories_pruned"] += 1
            else:
                kept_directories.append(name)
        directory_names[:] = kept_directories

        for name in sorted(file_names):
            stats["files_considered"] += 1
            candidate = current_path / name
            if candidate.is_symlink() or not candidate.is_file():
                continue
            relative = candidate.relative_to(root)
            relative_name = relative.as_posix()
            if relative_name in EXCLUDED_FILES or relative_name == MANIFEST_NAME:
                continue
            if len(relative.parts) == 1 and name == ".seminar-schools-build.lease":
                continue
            if name == ".env" or (name.startswith(".env.") and not name.endswith(".example")):
                continue
            if candidate.suffix.lower() in {".log", ".pyc"}:
                continue
            if is_output_transaction_artifact(candidate, output):
                continue
            if len(relative.parts) == 1 and GENERATED_RELEASE_ARCHIVE.fullmatch(name):
                continue
            if len(relative.parts) == 1 and GENERATED_RELEASE_EVIDENCE.fullmatch(name):
                continue
            files.append(candidate)

    files.sort(key=lambda path: path.relative_to(root).as_posix())
    stats["files_selected"] = len(files)
    return files, stats
