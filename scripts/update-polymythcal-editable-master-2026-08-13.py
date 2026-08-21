#!/usr/bin/env python3
"""Append the August 13 Polymythcal import to the preserved editable master."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path


SITE_ROOT = Path(__file__).resolve().parents[1]
DELIVERY_ROOT = SITE_ROOT.parent
EDITABLE_ROOT = DELIVERY_ROOT / "EDITABLE_MASTERS"
MASTER = EDITABLE_ROOT / "05_POLYMYTHCAL" / "Polymythcal_Research_and_Remediation_Plan.json"
MANIFEST = EDITABLE_ROOT / "EDITABLE_MASTERS_MANIFEST.json"
SUMS = EDITABLE_ROOT / "SHA256SUMS.txt"
RESEARCH = SITE_ROOT / "data" / "research" / "polymythcal-2026-08-13" / "research-ledger.json"
EXCLUSIONS = SITE_ROOT / "data" / "research" / "polymythcal-2026-08-13" / "exclusions.json"
IMPORT_REPORT = SITE_ROOT / "data" / "polymythcal-research-sets-1-3-celestial-2026-08-13.json"
MANUAL = SITE_ROOT / "data" / "manual-events.json"
CONSOLIDATED = SITE_ROOT / "data" / "polymyth-seminar-events.json"
KEY = "canonical_update_2026_08_13"
BASE_ARCHIVE = {
    "filename": "ss-site-core-5000-coreplus-bb-aligned-complete-2026-08-13 (1).zip",
    "bytes": 214569841,
    "sha256": "6edea69e7400f8c2801d3c6049717a4271ccde32da80639df34c60a81d5978cf",
    "manifest_files_verified": 11153,
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def source_evidence(path: Path) -> dict:
    return {
        "path": path.relative_to(SITE_ROOT).as_posix(),
        "bytes": path.stat().st_size,
        "sha256": sha256(path),
    }


def update_manifest() -> None:
    digest = sha256(MASTER)
    size = MASTER.stat().st_size
    manifest = load(MANIFEST)
    rows = manifest.get("files") or []
    matches = [row for row in rows if row.get("path") == "05_POLYMYTHCAL/Polymythcal_Research_and_Remediation_Plan.json"]
    if len(matches) != 1:
        raise SystemExit("Editable-master manifest does not contain exactly one Polymythcal row.")
    matches[0]["bytes"] = size
    matches[0]["sha256"] = digest
    matches[0]["status"] = (
        "preserved historical source context plus append-only 2026-08-13 canonical import ledger; never publish"
    )
    manifest["generated_on"] = "2026-08-13"
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    sums: dict[str, str] = {}
    for line in SUMS.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        expected, relative = line.split(None, 1)
        sums[relative.strip()] = expected
    relative = "05_POLYMYTHCAL/Polymythcal_Research_and_Remediation_Plan.json"
    sums[relative] = digest
    SUMS.write_text(
        "".join(f"{value}  {path}\n" for path, value in sorted(sums.items())),
        encoding="utf-8",
    )


def main() -> None:
    research = load(RESEARCH)
    exclusions = load(EXCLUSIONS)
    import_report = load(IMPORT_REPORT)
    manual = load(MANUAL)
    consolidated = load(CONSOLIDATED)
    records = research.get("records") or []
    imported = [row for row in (manual.get("events") or []) if row.get("_src") == "manual-polymythcal-comprehensive-2026-08-13"]
    consolidated_imported = [row for row in (consolidated.get("events") or []) if row.get("_src") == "manual-polymythcal-comprehensive-2026-08-13"]
    if len(records) != 292 or len(imported) != 292 or len(consolidated_imported) != 292:
        raise SystemExit(
            "Refusing editable-master update: research/manual/consolidated record counts are not all 292."
        )

    family_counts: dict[str, int] = {}
    status_counts: dict[str, int] = {}
    set_counts: dict[str, int] = {}
    for row in records:
        family = str(row.get("entry_family") or "unclassified")
        family_counts[family] = family_counts.get(family, 0) + 1
        status = "qualified_unconfirmed" if row.get("confirmation_status") == "unconfirmed" else "confirmed"
        status_counts[status] = status_counts.get(status, 0) + 1
        source = str(row.get("research_source_ref") or "unclassified")
        set_counts[source] = set_counts.get(source, 0) + 1

    payload = {
        "schema": "polymythcal-editable-master-append-only-update-v1",
        "status": "implemented",
        "implemented_at": "2026-08-13T13:50:00-04:00",
        "base_archive": BASE_ARCHIVE,
        "scope": {
            "research_sets": [
                "Set 1 — English, Writing, Literature and Poetry",
                "Set 2 — Philosophy",
                "Set 3 — History",
                "Polymorphous Mythology Calendar — astronomy, astrology, ritual and holiday entries",
                "Medusa creator-present regression benchmark",
            ],
            "time_horizon": "2026-08-13 through 2027-12-31, plus rolling and annual-watch records",
            "preservation_rule": "Existing stable identities and accepted content were preserved; recurring programs were refreshed rather than duplicated.",
        },
        "counts": {
            "research_records": len(records),
            "manual_imported_records": len(imported),
            "consolidated_imported_records": len(consolidated_imported),
            "manual_total": len(manual.get("events") or []),
            "consolidated_total": len(consolidated.get("events") or []),
            "registered_sources": len(load(SITE_ROOT / "scripts" / "sources.json").get("sources") or []),
            "exclusions": len(exclusions),
            "by_entry_family": dict(sorted(family_counts.items())),
            "by_confirmation_status": dict(sorted(status_counts.items())),
            "by_research_source": dict(sorted(set_counts.items())),
        },
        "canonical_operational_sources": [
            source_evidence(RESEARCH),
            source_evidence(EXCLUSIONS),
            source_evidence(IMPORT_REPORT),
            source_evidence(MANUAL),
            source_evidence(CONSOLIDATED),
            source_evidence(SITE_ROOT / "data" / "polymythcal-event-schema-v2.json"),
            source_evidence(SITE_ROOT / "scripts" / "import-polymythcal-comprehensive-2026-08-13.py"),
            source_evidence(SITE_ROOT / "scripts" / "verify-polymythcal-comprehensive-2026-08-13.js"),
        ],
        "regression_requirements": {
            "medusa": {
                "production_parent": "soulpepper-medusa-2026",
                "talkback_child": "soulpepper-medusa-talkback-2026-07-08",
                "talkback": "confirmed",
                "artists_from_production_present": "confirmed",
                "director_role": "Mitchell Cushman confirmed as director",
                "director_attendance": "unconfirmed",
                "run_date_conflict": "preserved",
            },
            "celestial": {
                "2026_annular_solar_eclipse": "2026-02-17",
                "2026_total_solar_eclipse": "2026-08-12",
                "2026_second_lunar_eclipse": "partial lunar eclipse on 2026-08-28; no false 2026-09-07 total lunar eclipse",
            },
            "idempotence": "A repeated importer run adds zero new stable identities and refreshes all 292 records in place.",
        },
        "records": records,
        "exclusions": exclusions,
        "legacy_import_report_snapshot": import_report,
    }

    master = load(MASTER)
    master[KEY] = payload
    # Preserve the original compact single-line serialization rather than
    # reformatting or abridging the historical source/session material.
    MASTER.write_text(
        json.dumps(master, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    update_manifest()
    print(
        json.dumps(
            {
                "master": str(MASTER),
                "records": len(records),
                "bytes": MASTER.stat().st_size,
                "sha256": sha256(MASTER),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
