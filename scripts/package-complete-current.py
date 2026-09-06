#!/usr/bin/env python3
"""Build, verify, and package the complete CORE, CORE+, BB, site, and Polymythcal handoff."""

from __future__ import annotations

import argparse
from datetime import datetime
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import tomllib
import venv

from audit_python_dependencies import prepare_audit_python_dependencies
from build_lock import require_release_build_lock
from clean_room_copy import copy_clean_source
from editable_masters_integrity import verify_editable_masters


SITE_ROOT = Path(__file__).resolve().parents[1]
DELIVERY_ROOT = SITE_ROOT.parent
EDITABLE_ROOT = DELIVERY_ROOT / "EDITABLE_MASTERS"
REPORT = SITE_ROOT / "WEBSITE_FUTUREPROOFING_CONTRACTS_AUDIT_2026-08-09.md"
PACKAGE_RELEASE_ID = (
    "core-coreplus-mephistodata-degorgonified-feminism-retrieval-enforcement-complete-2026-09-05"
)
OUTPUT_BASENAME = (
    "seminar-schools-mephistodata-degorgonified-feminism-retrieval-enforcement-complete-2026-09-05.zip"
)
# Fixed timestamps make the September 5 degorgonified-feminism release reproducible across the
# primary, repository-checkout, clean-room, and disaster-recovery builds.
DERIVED_GENERATED_AT = "2026-09-05T20:15:00Z"
RELEASE_GENERATED_AT = "2026-09-05T20:15:00Z"
CORE_ACCESS_QUERY = (
    "portable CORE personal rules follow CORE+ assistant-owned filing task continuity "
    "actual 5000 character ceiling no random artifacts source status anti-Snakelogic "
    "Mephistodata Devil's Diary activation dispatch canonical locator evidence first "
    "current message scope external subject first Ouroborossyntheses Mearsheimer Mishlove "
    "Realist Power-Conversion Egregore comparative corpus artifact independence "
    "Mephistodata execution gates controlled archive evidence condition retained population "
    "exact-line audit quick-task reset privilege worship cutoff emotional labor "
    "internal material private ChatGPT Library workspace cloud browser external substitute "
    "writing composition same sentence lexical repetition topic continuity protected spans "
    "revision fidelity no invented bridge "
    "current non-strawman project comparison Polycognate genealogy always-already boundaries "
    "bottom-up definition local use first anti-subsumption defect provenance critic nonauthority "
    "internal ChatGPT recovery no sign-in request continue unblocked work "
    "truthful work claims false completion claim ledger operation evidence exact status "
    "feminism women creed flock self-description standpoint epistemology personal is political "
    "premise classifier internal Gorgonwars excommunicable outside unresolved white feminism "
    "subtype qualifier slavery patriarchy patriarchal pedestal distinct material relations "
    "academic research gate query ontology premise audit named actors institutions laws property "
    "primary works criticism category counterarguments outside vocabulary critic nonauthority "
    "Wikipedia inadmissible source definition answer frame "
    "degorgonified feminism exact ML* retrieval handle complete six-owner bundle nonsemantic "
    "no clean subtype mixed authority real women Gorgon imagery emotional labor bottom-up "
    "counters to counterarguments pentagram screenshot list unresolved "
    "Mephistodata PM15 PM17 default opener would say Bloom one-turn reset register fusion "
    "Ouroborosanalyses residue-only named-method fail-closed canonical owner "
    "Be Kind While We Exploit You The Struggle to Control AI "
    "Ask your favourite AI no planted conclusion BB no training"
)
EXPECTED_NETLIFY_COMMAND = (
    "python3 -m pip install --disable-pip-version-check --no-input "
    "--require-hashes --requirement requirements-audit.lock && npm run build"
)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def run(command: list[str]) -> None:
    subprocess.run(command, cwd=SITE_ROOT, check=True)


def tree_sha256(root: Path) -> str:
    digest = hashlib.sha256()
    for target in sorted(path for path in root.rglob("*") if path.is_file()):
        relative = target.relative_to(root).as_posix().encode("utf-8")
        digest.update(len(relative).to_bytes(4, "big"))
        digest.update(relative)
        digest.update(target.read_bytes())
    return digest.hexdigest()


def verify_netlify_repository_checkout(npm: str) -> None:
    """Build exactly the Git/Netlify topology, without handoff siblings.

    The complete-archive clean room intentionally contains EDITABLE_MASTERS;
    this separate gate starts from SITE_PACKAGE source only, removes ignored
    generated public output, installs the pinned runtimes, and builds twice in
    an otherwise empty parent. It catches parent-path dependencies and
    non-idempotent deploy output before the final ZIP can be issued.
    """
    configured = tomllib.loads((SITE_ROOT / "netlify.toml").read_text(encoding="utf-8"))
    if configured.get("build", {}).get("command") != EXPECTED_NETLIFY_COMMAND:
        raise SystemExit("Netlify repository gate is not bound to the configured build command.")

    with tempfile.TemporaryDirectory(prefix="ss-netlify-repository-checkout-") as temporary:
        audit_root = Path(temporary)
        repository = audit_root / "repo"
        environment_root = audit_root / "venv"
        copy_clean_source(SITE_ROOT, repository)
        shutil.rmtree(repository / "public", ignore_errors=True)
        for name in (".seminar-schools-build.lock", ".seminar-schools-build.lease"):
            target = repository / name
            if target.is_dir():
                shutil.rmtree(target)
            else:
                target.unlink(missing_ok=True)

        venv.EnvBuilder(with_pip=True, clear=True).create(environment_root)
        python = environment_root / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
        environment = os.environ.copy()
        environment.pop("SS_RELEASE_BUILD_LOCK_TOKEN", None)
        environment.pop("SS_RELEASE_BUILD_LOCK_ROOT", None)
        environment["PATH"] = str(python.parent) + os.pathsep + environment.get("PATH", "")
        environment["PYTHON_BIN"] = str(python)
        environment["NETLIFY"] = "true"
        environment["CI"] = "true"
        environment["NPM_CONFIG_CACHE"] = str(audit_root / "npm-cache")

        subprocess.run([npm, "ci", "--no-audit", "--no-fund"], cwd=repository, env=environment, check=True)
        parent_entries = {path.name for path in audit_root.iterdir()}
        public_hashes: list[str] = []
        pip_command = [
            str(python), "-m", "pip", "install", "--disable-pip-version-check",
            "--no-input", "--require-hashes", "--requirement", "requirements-audit.lock",
        ]
        for _ in range(2):
            subprocess.run(pip_command, cwd=repository, env=environment, check=True)
            subprocess.run([npm, "run", "build"], cwd=repository, env=environment, check=True)
            public_hashes.append(tree_sha256(repository / "public"))

        if public_hashes[0] != public_hashes[1]:
            raise SystemExit("Netlify repository build is not a byte-exact fixed point.")
        if {path.name for path in audit_root.iterdir()} != parent_entries:
            raise SystemExit("Netlify repository build wrote outside its repository root.")
        for relative in ("index.html", "_headers", "_redirects", "site-release.json"):
            if not (repository / "public" / relative).is_file():
                raise SystemExit(f"Netlify repository build omitted public/{relative}.")
        if (audit_root / "EDITABLE_MASTERS").exists():
            raise SystemExit("Netlify repository build manufactured or required private masters.")
        print(
            "NETLIFY REPOSITORY CHECKOUT PASSED — two exact isolated builds, "
            f"public tree {public_hashes[-1]}, unchanged parent boundary."
        )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("output", type=Path)
    parser.add_argument(
        "--preflight",
        action="store_true",
        help=(
            "validate the current release and preservation gates, release identity, "
            "and archive selection without building or writing a ZIP"
        ),
    )
    args = parser.parse_args()
    require_release_build_lock(DELIVERY_ROOT)
    output = args.output.resolve()
    if output.name != OUTPUT_BASENAME:
        raise SystemExit(
            f"Complete release output must use the canonical name: {OUTPUT_BASENAME}"
        )

    npm = shutil.which("npm.cmd" if os.name == "nt" else "npm")
    node = shutil.which("node.exe" if os.name == "nt" else "node")
    if not npm:
        raise SystemExit("npm is required for the complete current-release package.")
    if not node:
        raise SystemExit("node is required for the complete current-release package.")
    os.environ["MEPHISTODATA_GENERATED_AT"] = DERIVED_GENERATED_AT
    os.environ["SOURCE_DATE_EPOCH"] = str(
        int(datetime.fromisoformat(DERIVED_GENERATED_AT.replace("Z", "+00:00")).timestamp())
    )
    os.environ["SITE_BUILD_DATE"] = "2026-09-05"
    # Extracted artifact workspaces can otherwise reconcile an older public
    # tree after the atomic staging rename.  Pin every release build, including
    # its isolated idempotence and clean-checkout descendants, to the same
    # deterministic output timestamp used by the archive.
    os.environ["SS_PUBLIC_OUTPUT_MTIME"] = DERIVED_GENERATED_AT
    if args.preflight:
        run([
            sys.executable,
            str(SITE_ROOT / "scripts" / "package-front-facing-mephistodata-release.py"),
            str(output),
            "--release-id",
            PACKAGE_RELEASE_ID,
            "--generated-at",
            RELEASE_GENERATED_AT,
            "--preflight",
        ])
        print(json.dumps({
            "status": "passed",
            "mode": "preflight",
            "output": str(output),
            "release_id": PACKAGE_RELEASE_ID,
            "derived_generated_at": DERIVED_GENERATED_AT,
            "release_generated_at": RELEASE_GENERATED_AT,
            "site_build_date": os.environ["SITE_BUILD_DATE"],
        }, indent=2))
        return
    audit_dependency_holder = tempfile.TemporaryDirectory(
        prefix="ss-release-python-audit-deps-"
    )
    prepare_audit_python_dependencies(
        SITE_ROOT,
        Path(audit_dependency_holder.name) / "python-audit-deps",
    )
    # Reconstruct every derived CORE/Meaninglib surface from the canonical HTML
    # before the build and gate.  The fixed timestamp is retained in the source
    # snapshot, so the independent clean-room build verifies those exact bytes
    # without regenerating them from a wall clock.
    run([node, "scripts/sync-core-personal-rules.js"])
    run([npm, "run", "regen:all-txt"])
    run([node, "scripts/regen-methodologylist-manifest.js", "2026-09-05"])
    run([npm, "run", "export:meaninglib-dataset"])
    run([npm, "run", "verify:meaninglib-dataset"])
    run([npm, "run", "build:meaninglib-search"])
    run([npm, "run", "verify:meaninglib-search"])
    run([npm, "run", "build:ai-access-pack", "--", "--query", CORE_ACCESS_QUERY])
    run([npm, "run", "verify:ai-access-pack"])
    run([npm, "run", "build"])
    run([
        node,
        "scripts/run-browser-test-tier.mjs",
        "--tier",
        "family",
        "--report",
        "scripts/reports/futureproofing-browser-family-report.json",
    ])
    # Private editable masters are complete-handoff artifacts, never inputs to
    # the public Git/Netlify build. Refresh them only while the explicit outer
    # delivery-root lock is held, after canonical site data has been rebuilt.
    run([npm, "run", "sync:editable-masters:locked"])
    verify_netlify_repository_checkout(npm)
    # The clean-room verifier owns these fixed values.  Use the same values for
    # the primary gate so its packaged release report is reproducible byte for
    # byte instead of recording a caller-dependent timeout or concurrency.
    os.environ["VERIFY_ALL_CONCURRENCY"] = "4"
    os.environ["VERIFY_ALL_COMMAND_TIMEOUT_MS"] = "2700000"
    run([npm, "run", "verify:all:built"])
    verify_editable_masters(EDITABLE_ROOT)
    if not REPORT.is_file():
        raise SystemExit(f"Required audit evidence is missing: {REPORT.name}")

    # Snapshot the exact verified delivery inputs immediately before packaging.
    # The independent clean-room copy then repeats the canonical build and all
    # checks from the same source that the archive actually ships.
    snapshot_holder = tempfile.TemporaryDirectory(prefix="ss-release-source-snapshot-")
    source_snapshot = Path(snapshot_holder.name) / "delivery-source"
    copy_clean_source(DELIVERY_ROOT, source_snapshot)

    runtime_release = json.loads((SITE_ROOT / "RELEASE_MANIFEST.json").read_text(encoding="utf-8"))
    runtime_id = (SITE_ROOT / "RELEASE_ID.txt").read_text(encoding="utf-8").strip()
    if runtime_release.get("release_id") != runtime_id or not runtime_release.get("generated_at"):
        raise SystemExit("Verified runtime release metadata is inconsistent at package time.")
    generated_at = RELEASE_GENERATED_AT
    run([
        sys.executable,
        str(SITE_ROOT / "scripts" / "package-front-facing-mephistodata-release.py"),
        str(output),
        "--release-id",
        PACKAGE_RELEASE_ID,
        "--generated-at",
        generated_at,
    ])
    run([
        sys.executable,
        str(SITE_ROOT / "scripts" / "verify-complete-archive-classes.py"),
        str(output),
    ])
    clean_room_report = Path(str(output) + ".clean-room-report.json")
    disaster_recovery_report = Path(str(output) + ".disaster-recovery-report.json")
    receipt = Path(str(output) + ".audit-receipt.json")
    run([
        sys.executable,
        str(SITE_ROOT / "scripts" / "verify-clean-room-release.py"),
        "--reference-archive",
        str(output),
        "--source-root",
        str(source_snapshot),
        "--report",
        str(clean_room_report),
    ])
    run([
        sys.executable,
        str(SITE_ROOT / "scripts" / "verify-disaster-recovery.py"),
        str(output),
        "--report",
        str(disaster_recovery_report),
    ])
    run([
        sys.executable,
        str(SITE_ROOT / "scripts" / "create-artifact-audit-receipt.py"),
        str(output),
        "--audit-report",
        str(REPORT),
        "--clean-room-report",
        str(clean_room_report),
        "--disaster-recovery-report",
        str(disaster_recovery_report),
        "--output",
        str(receipt),
    ])
    run([
        sys.executable,
        str(SITE_ROOT / "scripts" / "verify-artifact-audit-receipt.py"),
        str(output),
        "--receipt",
        str(receipt),
        "--clean-room-report",
        str(clean_room_report),
        "--disaster-recovery-report",
        str(disaster_recovery_report),
    ])
    print(json.dumps({
        "archive": str(output),
        "archive_sha256": sha256(output),
        "checksum_sidecar": str(Path(str(output) + ".sha256")),
        "clean_room_report": str(clean_room_report),
        "disaster_recovery_report": str(disaster_recovery_report),
        "audit_receipt": str(receipt),
    }, indent=2))
    snapshot_holder.cleanup()
    audit_dependency_holder.cleanup()


if __name__ == "__main__":
    main()
