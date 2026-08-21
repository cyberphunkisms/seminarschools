#!/usr/bin/env python3
"""Install the pinned Python audit runtime into an isolated temporary target."""
from __future__ import annotations

import hashlib
from importlib import metadata
import os
from pathlib import Path
import re
import subprocess
import sys


REQUIREMENTS_NAME = "requirements-audit.txt"
LOCK_NAME = "requirements-audit.lock"
ARCHIVE_REQUIREMENTS_PATH = f"SITE_PACKAGE/{REQUIREMENTS_NAME}"
ARCHIVE_LOCK_PATH = f"SITE_PACKAGE/{LOCK_NAME}"
PINNED_REQUIREMENT = re.compile(
    r"^[A-Za-z0-9][A-Za-z0-9_.-]*(?:\[[A-Za-z0-9_,.-]+\])?==[^\s;]+$"
)


def pinned_requirements_evidence_from_bytes(payload: bytes) -> dict:
    """Validate exact top-level pins and return archive-bindable evidence."""
    try:
        text = payload.decode("utf-8")
    except UnicodeDecodeError as error:
        raise RuntimeError(f"{REQUIREMENTS_NAME} is not UTF-8") from error
    requirements = [
        line.strip()
        for line in text.splitlines()
        if line.strip() and not line.lstrip().startswith("#")
    ]
    if not requirements:
        raise RuntimeError(f"{REQUIREMENTS_NAME} has no pinned dependencies")
    unpinned = [line for line in requirements if not PINNED_REQUIREMENT.fullmatch(line)]
    if unpinned:
        raise RuntimeError(
            f"{REQUIREMENTS_NAME} contains non-exact requirements: " + ", ".join(unpinned)
        )
    if len(requirements) != len(set(requirements)):
        raise RuntimeError(f"{REQUIREMENTS_NAME} contains duplicate requirements")
    return {
        "requirements_path": ARCHIVE_REQUIREMENTS_PATH,
        "bytes": len(payload),
        "sha256": hashlib.sha256(payload).hexdigest(),
        "requirement_count": len(requirements),
        "requirements": requirements,
        "all_top_level_requirements_exactly_pinned": True,
    }


def _normalized_distribution(requirement: str) -> str:
    name, version = requirement.split("==", 1)
    normalized_name = re.sub(r"[-_.]+", "-", name).lower()
    return f"{normalized_name}=={version}"


def pinned_audit_requirements_evidence_from_bytes(
    requirements_payload: bytes,
    lock_payload: bytes,
) -> dict:
    top_level = pinned_requirements_evidence_from_bytes(requirements_payload)
    locked = hashed_lock_evidence_from_bytes(lock_payload)
    locked_inventory = locked["locked_distributions"]
    missing = sorted(
        set(_normalized_distribution(item) for item in top_level["requirements"])
        - set(locked_inventory)
    )
    if missing:
        raise RuntimeError(
            f"{LOCK_NAME} omits or changes top-level pins: " + ", ".join(missing)
        )
    return {
        **top_level,
        "lock_path": ARCHIVE_LOCK_PATH,
        "lock_bytes": locked["bytes"],
        "lock_sha256": locked["sha256"],
        "locked_distribution_count": len(locked_inventory),
        "locked_distributions": locked_inventory,
        "locked_artifact_hash_count": locked["artifact_hash_count"],
        "all_locked_distributions_exactly_pinned": True,
        "all_locked_artifacts_sha256_hashed": True,
        "top_level_pins_present_in_lock": True,
    }


def hashed_lock_evidence_from_bytes(payload: bytes) -> dict:
    """Parse a pip-tools hash lock without relying on pip's own acceptance."""
    try:
        text = payload.decode("utf-8")
    except UnicodeDecodeError as error:
        raise RuntimeError(f"{LOCK_NAME} is not UTF-8") from error
    distributions: list[str] = []
    hashes_by_distribution: dict[str, list[str]] = {}
    current: str | None = None
    for line_number, raw in enumerate(text.splitlines(), start=1):
        stripped = raw.strip()
        if not stripped or stripped.startswith("#"):
            continue
        pin_candidate = stripped[:-1].rstrip() if stripped.endswith("\\") else stripped
        if not raw[:1].isspace() and PINNED_REQUIREMENT.fullmatch(pin_candidate):
            current = _normalized_distribution(pin_candidate)
            if current in hashes_by_distribution:
                raise RuntimeError(f"{LOCK_NAME} repeats distribution {current}")
            distributions.append(current)
            hashes_by_distribution[current] = []
            continue
        hash_candidate = stripped[:-1].rstrip() if stripped.endswith("\\") else stripped
        match = re.fullmatch(r"--hash=sha256:([a-f0-9]{64})", hash_candidate)
        if current and match:
            hashes_by_distribution[current].append(match.group(1))
            continue
        raise RuntimeError(f"{LOCK_NAME} has unsupported line {line_number}: {stripped}")
    if not distributions:
        raise RuntimeError(f"{LOCK_NAME} has no locked distributions")
    missing_hashes = [name for name, hashes in hashes_by_distribution.items() if not hashes]
    if missing_hashes:
        raise RuntimeError(
            f"{LOCK_NAME} has distributions without hashes: " + ", ".join(missing_hashes)
        )
    all_hashes = [digest for hashes in hashes_by_distribution.values() for digest in hashes]
    if len(all_hashes) != len(set(all_hashes)):
        raise RuntimeError(f"{LOCK_NAME} repeats one or more artifact hashes")
    return {
        "bytes": len(payload),
        "sha256": hashlib.sha256(payload).hexdigest(),
        "locked_distribution_count": len(distributions),
        "locked_distributions": sorted(distributions),
        "artifact_hash_count": len(all_hashes),
        "all_locked_distributions_exactly_pinned": True,
        "all_locked_artifacts_sha256_hashed": True,
    }


def pinned_audit_requirements_evidence(site_root: Path) -> dict:
    requirements = Path(site_root).resolve() / REQUIREMENTS_NAME
    lock = Path(site_root).resolve() / LOCK_NAME
    if not requirements.is_file() or requirements.is_symlink():
        raise RuntimeError(f"{REQUIREMENTS_NAME} is missing or not a regular file")
    if not lock.is_file() or lock.is_symlink():
        raise RuntimeError(f"{LOCK_NAME} is missing or not a regular file")
    return pinned_audit_requirements_evidence_from_bytes(
        requirements.read_bytes(), lock.read_bytes()
    )


def installed_distribution_inventory(target: Path) -> list[str]:
    inventory = []
    for distribution in metadata.distributions(path=[str(Path(target).resolve())]):
        name = distribution.metadata.get("Name")
        version = distribution.version
        if not name or not version:
            raise RuntimeError("installed audit distribution lacks name or version metadata")
        inventory.append(_normalized_distribution(f"{name}=={version}"))
    if len(inventory) != len(set(inventory)):
        raise RuntimeError("installed audit runtime contains duplicate distributions")
    return sorted(inventory)


def prepare_audit_python_dependencies(site_root: Path, target: Path) -> Path:
    site_root = Path(site_root).resolve()
    target = Path(target).resolve()
    lock = site_root / LOCK_NAME
    expected = pinned_audit_requirements_evidence(site_root)
    target.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            sys.executable,
            "-m",
            "pip",
            "install",
            "--disable-pip-version-check",
            "--no-input",
            "--require-hashes",
            "--target",
            str(target),
            "-r",
            str(lock),
        ],
        cwd=site_root,
        check=True,
    )
    installed = installed_distribution_inventory(target)
    if installed != expected["locked_distributions"]:
        raise RuntimeError("installed audit dependency inventory differs from requirements-audit.lock")
    prior = os.environ.get("PYTHONPATH")
    os.environ["PYTHONPATH"] = str(target) + (os.pathsep + prior if prior else "")
    return target
