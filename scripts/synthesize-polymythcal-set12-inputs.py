#!/usr/bin/env python3
"""Import the canonical Sets 1-12 semantic inputs into a newer site shell.

The consolidated Set 12 event JSON is retained as a semantic seed because 289
verified harvested records do not exist in the authored manual ledger. Event
pages, feeds, payloads, public mirrors, reports, release manifests, and package
evidence are never copied; the destination release rebuilds all of them.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
EXPECTED_REFERENCE_MANUAL_COUNT = 1553
EXPECTED_REFERENCE_SOURCE_COUNT = 694
EXPECTED_SET12_COUNT = 142
EXPECTED_CONSOLIDATED_COUNT = 1842


def read_json(path: Path) -> object:
    return json.loads(path.read_text(encoding="utf-8"))


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def copy_file(source: Path, target: Path) -> None:
    if not source.is_file():
        raise SystemExit(f"Required Set 12 input is missing: {source}")
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.is_file() and target.read_bytes() == source.read_bytes():
        return
    shutil.copy2(source, target)


def copy_tree(source: Path, target: Path) -> None:
    if not source.is_dir():
        raise SystemExit(f"Required Set 12 input directory is missing: {source}")
    for path in sorted(source.rglob("*")):
        if path.is_file():
            copy_file(path, target / path.relative_to(source))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "reference_root",
        type=Path,
        help="Extracted Set 12 delivery root containing SITE_PACKAGE and EDITABLE_MASTERS",
    )
    args = parser.parse_args()
    reference_root = args.reference_root.resolve()
    reference = reference_root / "SITE_PACKAGE"

    manual = read_json(reference / "data/manual-events.json")
    sources = read_json(reference / "scripts/sources.json")
    set12 = read_json(
        reference
        / "data/polymythcal-research-set-12-civic-political-legal-labour-2026-08-14.json"
    )
    consolidated = read_json(reference / "polymythseminars/events.json")
    manual_events = manual.get("events", []) if isinstance(manual, dict) else []
    source_rows = sources.get("sources", []) if isinstance(sources, dict) else []
    if len(manual_events) != EXPECTED_REFERENCE_MANUAL_COUNT:
        raise SystemExit(
            f"Set 12 reference manual count is {len(manual_events)}, expected "
            f"{EXPECTED_REFERENCE_MANUAL_COUNT}"
        )
    if len(source_rows) != EXPECTED_REFERENCE_SOURCE_COUNT:
        raise SystemExit(
            f"Set 12 reference source count is {len(source_rows)}, expected "
            f"{EXPECTED_REFERENCE_SOURCE_COUNT}"
        )
    if set12.get("record_count") != EXPECTED_SET12_COUNT:
        raise SystemExit("Set 12 research ledger is not the accepted 142-record release")
    consolidated_events = (
        consolidated.get("events", []) if isinstance(consolidated, dict) else []
    )
    if len(consolidated_events) != EXPECTED_CONSOLIDATED_COUNT:
        raise SystemExit(
            f"Set 12 consolidated count is {len(consolidated_events)}, expected "
            f"{EXPECTED_CONSOLIDATED_COUNT}"
        )

    canonical_files = [
        "data/manual-events.json",
        "data/polymythcal-event-schema-v2.json",
        "data/polymythcal-inventory-contract.json",
        "data/website-cl.jsonl",
        "scripts/sources.json",
        "scripts/polymythcal_set_import_common.py",
        "scripts/build-polymythcal-sets-1-3-celestial-ledger.py",
        "scripts/import-polymythcal-comprehensive-2026-08-13.py",
        "scripts/import-polymythcal-social-studies-set4-2026-08-13.py",
        "scripts/import-polymythcal-media-literacy-set5-2026-08-13.py",
        "scripts/import-polymythcal-interdisciplinary-set6-2026-08-13.py",
        "scripts/import-polymythcal-director-present-set7-2026-08-13.py",
        "scripts/import-polymythcal-creator-present-set8-2026-08-13.py",
        "scripts/import-polymythcal-public-intellectual-academic-set9-2026-08-13.py",
        "scripts/import-polymythcal-arts-set10-reconstruction-2026-08-14.py",
        "scripts/import-polymythcal-participatory-cultural-set11-2026-08-14.py",
        "scripts/import-polymythcal-civic-political-legal-labour-set12-2026-08-14.py",
        "scripts/update-polymythcal-editable-master-2026-08-13.py",
        "scripts/update-polymythcal-editable-master-set9-2026-08-13.py",
        "scripts/update-polymythcal-editable-master-sets10-11-2026-08-14.py",
        "scripts/update-polymythcal-editable-master-set12-2026-08-14.py",
        "scripts/update-polymythcal-listing-counts.js",
        "scripts/verify-polymythcal-comprehensive-2026-08-13.js",
        "scripts/verify-polymythcal-social-studies-set4-2026-08-13.js",
        "scripts/verify-polymythcal-media-literacy-set5-2026-08-13.js",
        "scripts/verify-polymythcal-interdisciplinary-set6-2026-08-13.js",
        "scripts/verify-polymythcal-director-present-set7-2026-08-13.js",
        "scripts/verify-polymythcal-creator-present-set8-2026-08-13.js",
        "scripts/verify-polymythcal-public-intellectual-academic-set9-2026-08-13.js",
        "scripts/verify-polymythcal-arts-set10-reconstruction-2026-08-14.js",
        "scripts/verify-polymythcal-participatory-cultural-set11-2026-08-14.js",
        "scripts/verify-polymythcal-civic-political-legal-labour-set12-2026-08-14.js",
        "WEBSITE_CL_2026-07-19.md",
        "docs/WEBSITE_CL_2026-07-19.md",
    ]
    research_files = [
        "data/polymythcal-research-sets-1-3-celestial-2026-08-13.json",
        *[
            f"data/polymythcal-research-set-{number}-{slug}-2026-08-{day}.json"
            for number, slug, day in [
                (4, "social-studies", "13"),
                (5, "media-literacy", "13"),
                (6, "interdisciplinary", "13"),
                (7, "director-present", "13"),
                (8, "creator-present", "13"),
                (9, "public-intellectual-academic", "13"),
                (10, "arts-reconstruction", "14"),
                (11, "participatory-cultural", "14"),
                (12, "civic-political-legal-labour", "14"),
            ]
        ],
    ]
    for rel in [*canonical_files, *research_files]:
        copy_file(reference / rel, ROOT / rel)
    copy_tree(reference / "data/research", ROOT / "data/research")

    # This is the only derived Set 12 file retained: it carries verified
    # harvested records that cannot be reconstructed from manual-events.json.
    # The repaired upserter immediately refreshes every manual record and all
    # downstream browser/detail/feed/public artifacts are regenerated later.
    copy_file(
        reference / "polymythseminars/events.json",
        ROOT / "polymythseminars/events.json",
    )
    copy_file(
        reference / "polymythseminars/events.json",
        ROOT / "data/polymyth-seminar-events.json",
    )

    master_rel = Path(
        "05_POLYMYTHCAL/Polymythcal_Research_and_Remediation_Plan.json"
    )
    destination_delivery = ROOT.parent
    copy_file(
        reference_root / "EDITABLE_MASTERS" / master_rel,
        destination_delivery / "EDITABLE_MASTERS" / master_rel,
    )

    result = {
        "status": "pass",
        "reference_root": str(reference_root),
        "manual_records": len(manual_events),
        "registered_sources": len(source_rows),
        "set12_records": set12.get("record_count"),
        "consolidated_seed_records": len(consolidated_events),
        "set12_manual_sha256": sha256(reference / "data/manual-events.json"),
        "set12_sources_sha256": sha256(reference / "scripts/sources.json"),
        "generated_outputs_copied": False,
        "semantic_consolidated_seed_copied": True,
    }
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
