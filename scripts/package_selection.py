#!/usr/bin/env python3
"""Shared, pruned file selection for Seminar Schools release archives."""
from __future__ import annotations

import json
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
TRANSIENT_DIRECTORY_NAMES = {
    ".cache",
    "cache",
    ".locks",
    "locks",
    ".logs",
    "logs",
    ".log",
    "log",
    ".staging",
    "staging",
    ".temp",
    "temp",
    ".tmp",
    "tmp",
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
POLYMYTHCAL_SAFE_ID = re.compile(r"^[A-Za-z0-9._~-]+$")
DUPLICATE_RECONSTRUCTION_FILES = {
    "UPDATE_SOURCES/Detienne_Comparing_the_Incomparable_Polymyth_Master_Notes_2026-08-27.md",
    "SITE_PACKAGE/UPDATE_SOURCES/Detienne_Comparing_the_Incomparable_Polymyth_Master_Notes_2026-08-27.md",
}
DUPLICATE_RECONSTRUCTION_PREFIXES = (
    "UPDATE_SOURCES/Detienne_Evidence_Ledgers_2026-08-27/",
    "SITE_PACKAGE/UPDATE_SOURCES/Detienne_Evidence_Ledgers_2026-08-27/",
)


def is_reconstruction_duplicate(relative_name: str) -> bool:
    """Identify transient mixed-case Detienne copies from interrupted recovery."""
    return (
        relative_name in DUPLICATE_RECONSTRUCTION_FILES
        or relative_name.startswith(DUPLICATE_RECONSTRUCTION_PREFIXES)
    )


def polymythcal_publication_exclusions(root: Path) -> set[str]:
    """Return retired/private Polymythcal files that can never enter a ZIP.

    The shared artifact workspace may reconcile a deleted baseline file after
    the public builder has removed it. Package selection therefore derives the
    exclusion set from the authoritative publication partition instead of
    trusting deletion state. The same filter applies when *root* is either the
    site package itself or the complete delivery root that contains it.
    """
    root = Path(root).resolve()
    prefix = Path()
    surfaces_path = root / "data" / "polymythcal-publication-surfaces.json"
    canonical_path = root / "data" / "polymyth-seminar-events.json"
    if not surfaces_path.is_file() or not canonical_path.is_file():
        prefix = Path("SITE_PACKAGE")
        surfaces_path = root / prefix / "data" / "polymythcal-publication-surfaces.json"
        canonical_path = root / prefix / "data" / "polymyth-seminar-events.json"
    if not surfaces_path.is_file() and not canonical_path.is_file():
        return set()
    if not surfaces_path.is_file() or not canonical_path.is_file():
        raise ValueError("Polymythcal package boundary requires both publication surfaces and canonical data")

    surfaces = json.loads(surfaces_path.read_text(encoding="utf-8"))
    canonical = json.loads(canonical_path.read_text(encoding="utf-8"))
    if surfaces.get("_schema") != "polymythcal-publication-surfaces-v2":
        raise ValueError("Polymythcal package boundary requires publication-surfaces-v2")
    watchlist_ids = surfaces.get("watchlist_ids")
    events = canonical.get("events")
    if not isinstance(watchlist_ids, list) or not isinstance(events, list):
        raise ValueError("Polymythcal package boundary has malformed canonical arrays")
    if len(set(watchlist_ids)) != len(watchlist_ids):
        raise ValueError("Polymythcal package boundary has duplicate watchlist ids")

    event_by_id = {}
    for event in events:
        if not isinstance(event, dict):
            raise ValueError("Polymythcal canonical data contains a non-object event")
        event_id = str(event.get("id") or event.get("identity_key") or "").strip()
        if not POLYMYTHCAL_SAFE_ID.fullmatch(event_id) or event_id in event_by_id:
            raise ValueError(f"Polymythcal canonical data has an unsafe or duplicate id: {event_id!r}")
        event_by_id[event_id] = event

    retired_ics_ids: set[str] = set()
    for raw_id in watchlist_ids:
        event_id = str(raw_id or "").strip()
        if not POLYMYTHCAL_SAFE_ID.fullmatch(event_id) or event_id not in event_by_id:
            raise ValueError(f"Polymythcal watchlist has an unsafe or unknown id: {event_id!r}")
        retired_ics_ids.add(event_id)
        legacy_ids = event_by_id[event_id].get("legacy_ids") or []
        if not isinstance(legacy_ids, list):
            raise ValueError(f"Polymythcal event {event_id} has malformed legacy_ids")
        for raw_legacy in legacy_ids:
            legacy_id = str(raw_legacy or "").strip()
            if not legacy_id:
                continue
            if not POLYMYTHCAL_SAFE_ID.fullmatch(legacy_id):
                raise ValueError(f"Polymythcal event {event_id} has an unsafe legacy id: {legacy_id!r}")
            retired_ics_ids.add(legacy_id)

    relative = lambda value: (prefix / value).as_posix()
    excluded = {
        relative("public/polymythseminars/events.json"),
        relative("public/js/polymythcal-revamp.js"),
        relative("public/css/polymythcal-revamp.css"),
    }
    for event_id in retired_ics_ids:
        excluded.add(relative(f"polymythseminars/ics/{event_id}.ics"))
        excluded.add(relative(f"public/polymythseminars/ics/{event_id}.ics"))
    return excluded


def generated_work_dir(part: str) -> bool:
    return bool(
        re.fullmatch(r"(?:polymythcal[-_])?audit\d+(?:[-_].*)?", part, re.IGNORECASE)
        or re.fullmatch(
            r"\.ss-public-build-(?:claim|empty-overlay|postprocess|tombstones|abandoned)(?:-.*)?",
            part,
            re.IGNORECASE,
        )
        or re.fullmatch(r".*[-_]work", part, re.IGNORECASE)
        or re.fullmatch(r".*[-_]packaged[-_]test", part, re.IGNORECASE)
    )


def generated_dependency_dir(part: str) -> bool:
    value = part.lower()
    return bool(
        re.fullmatch(r"\.?venv(?:[-_].+)?", value)
        or value
        in {
            "env",
            ".env",
            "pip-wheel-metadata",
            ".rsync-tmp",
            ".rsync-partial",
            ".public-build-quarantine",
        }
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
    publication_exclusions = polymythcal_publication_exclusions(root)
    files: list[Path] = []
    stats = {
        "directories_visited": 0,
        "directories_pruned": 0,
        "files_considered": 0,
        "files_selected": 0,
        "polymythcal_artifacts_pruned": 0,
        "reconstruction_duplicates_pruned": 0,
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
                or name.lower() in TRANSIENT_DIRECTORY_NAMES
                or name.lower().endswith(".lock")
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
            if len(relative.parts) == 1 and name in FIXED_GENERATED_DIRECTORIES:
                continue
            if is_reconstruction_duplicate(relative_name):
                stats["reconstruction_duplicates_pruned"] += 1
                continue
            if relative_name in publication_exclusions:
                stats["polymythcal_artifacts_pruned"] += 1
                continue
            if relative_name in EXCLUDED_FILES or relative_name == MANIFEST_NAME:
                continue
            if name == ".seminar-schools-build.lease":
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
