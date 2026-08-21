#!/usr/bin/env python3
"""Copy release source without disposable, secret, or prior-release state.

The clean-room copy deliberately follows the release packager's pruning
vocabulary.  Generated archives are pruned only at the delivery-root level so
intentional nested downloads remain part of the reproducibility input.
"""
from __future__ import annotations

from pathlib import Path
import shutil

from package_selection import (
    FIXED_GENERATED_DIRECTORIES,
    GENERATED_RELEASE_ARCHIVE,
    GENERATED_RELEASE_EVIDENCE,
    generated_dependency_dir,
    generated_work_dir,
)


def secret_environment_file(name: str) -> bool:
    """Return whether *name* is a non-example dotenv input."""
    return name == ".env" or (name.startswith(".env.") and not name.endswith(".example"))


def ignored_copy_path(
    directory: str,
    names: list[str],
    source_root: Path,
) -> set[str]:
    """Return entries excluded from a clean source snapshot.

    This is suitable for ``shutil.copytree(ignore=...)`` and therefore checks
    the real candidate path to reject both file and directory symlinks.
    """
    ignored: set[str] = set()
    current = Path(directory)
    source_root = Path(source_root).resolve()
    at_root = current.resolve() == source_root
    for name in names:
        candidate = current / name
        if candidate.is_symlink():
            ignored.add(name)
        elif name in FIXED_GENERATED_DIRECTORIES or generated_dependency_dir(name):
            ignored.add(name)
        elif at_root and generated_work_dir(name):
            ignored.add(name)
        elif secret_environment_file(name):
            ignored.add(name)
        elif candidate.is_file() and name.endswith((".pyc", ".log")):
            ignored.add(name)
        elif at_root and name == ".seminar-schools-build.lease":
            ignored.add(name)
        elif at_root and (
            GENERATED_RELEASE_ARCHIVE.fullmatch(name)
            or GENERATED_RELEASE_EVIDENCE.fullmatch(name)
            or name.startswith(".ss-site-")
        ):
            ignored.add(name)
    return ignored


def copy_clean_source(source_root: Path, destination: Path) -> None:
    source_root = Path(source_root).resolve()
    shutil.copytree(
        source_root,
        destination,
        ignore=lambda directory, names: ignored_copy_path(
            directory, names, source_root
        ),
        copy_function=shutil.copy2,
    )
