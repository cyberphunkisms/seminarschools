#!/usr/bin/env python3
"""Append the verified Set 14 state to the private editable master."""
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
MANUAL = SITE_ROOT / "data" / "manual-events.json"
CONSOLIDATED = SITE_ROOT / "data" / "polymyth-seminar-events.json"
PUBLIC = SITE_ROOT / "polymythseminars" / "events.json"
SOURCES = SITE_ROOT / "scripts" / "sources.json"
LEDGER = SITE_ROOT / "data" / "polymythcal-research-set-14-live-media-digitally-native-2026-08-15.json"
EXCLUSIONS = SITE_ROOT / "data" / "polymythcal-research-set-14-live-media-digitally-native-exclusions-2026-08-15.json"

KEY = "live_media_digitally_native_set14_update_2026_08_15"
SRC = "manual-polymythcal-live-media-digitally-native-set14-2026-08-15"
SET = "14-Live-Media-and-Digitally-Native-Events"
FIELDS = [
    "live_digital_formats",
    "platform_names",
    "synchronous_status",
    "audience_interaction_routes",
    "recording_availability",
    "digital_evidence",
    "set14_classified_at",
    "event_format",
    "online_location",
    "platform",
    "platform_notes",
    "liveness_status",
    "synchronicity",
    "audience_interaction",
    "interaction_status",
    "interaction_evidence",
    "access_status",
    "registration_required",
    "registration_url",
    "access_route",
    "replay_archive_status",
    "recording_evidence",
    "creator_participation_status",
    "creator_participation_evidence",
    "occurrence_evidence",
    "replay_source_field",
]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def events(document: object) -> list[dict]:
    return document if isinstance(document, list) else document.get("events", [])


def update_manifest() -> None:
    digest = sha256(MASTER)
    manifest = load(MANIFEST)
    rows = manifest.get("files") or []
    match = [
        row
        for row in rows
        if row.get("path") == "05_POLYMYTHCAL/Polymythcal_Research_and_Remediation_Plan.json"
    ]
    if len(match) != 1:
        raise SystemExit("Editable master manifest must contain exactly one Polymythcal row")
    match[0].update(
        {
            "bytes": MASTER.stat().st_size,
            "sha256": digest,
            "status": "preserved historical source context plus append-only verified Sets 1-15 Polymythcal research; never publish",
        }
    )
    manifest["generated_on"] = "2026-08-15"
    MANIFEST.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    sums: dict[str, str] = {}
    for line in SUMS.read_text(encoding="utf-8").splitlines():
        if line.strip():
            expected, relative = line.split(None, 1)
            sums[relative.strip()] = expected
    sums["05_POLYMYTHCAL/Polymythcal_Research_and_Remediation_Plan.json"] = digest
    SUMS.write_text(
        "".join(f"{value}  {key}\n" for key, value in sorted(sums.items())),
        encoding="utf-8",
    )


def main() -> int:
    manual_doc = load(MANUAL)
    manual = events(manual_doc)
    consolidated = events(load(CONSOLIDATED))
    public = events(load(PUBLIC))
    ledger = load(LEDGER)
    exclusion_ledger = load(EXCLUSIONS)
    metadata = manual_doc.get("polymythcal_live_media_digitally_native_set14_update_2026_08_15") or {}
    batch = [event for event in manual if event.get("_src") == SRC]
    tagged = [event for event in manual if event.get("live_digital_formats")]

    if len(batch) != 54 or len(tagged) != 144 or ledger.get("record_count") != 144:
        raise SystemExit(
            "Refusing editable-master update: Set 14 counts "
            f"{len(batch)}/{len(tagged)}/{ledger.get('record_count')}, expected 54/144/144"
        )
    if not (
        len(manual) >= 1726
        and len(consolidated) == len(public)
        and len(public) >= len(manual)
    ):
        raise SystemExit(
            "Refusing editable-master update: manual/canonical/public counts "
            f"{len(manual)}/{len(consolidated)}/{len(public)} disagree or fall below Set 14"
        )
    if (
        metadata.get("parent_records") != 9
        or metadata.get("child_occurrences") != 21
        or metadata.get("confirmed_records") != 48
        or metadata.get("qualified_records") != 6
        or metadata.get("existing_records_cross_tagged") != 90
    ):
        raise SystemExit("Refusing editable-master update: Set 14 structure/evidence accounting drifted")
    if exclusion_ledger.get("exclusion_count") != 11:
        raise SystemExit("Refusing editable-master update: Set 14 exclusion accounting drifted")

    manual_by_id = {event["id"]: event for event in manual}
    consolidated_by_id = {event["id"]: event for event in consolidated}
    public_by_id = {event["id"]: event for event in public}
    for event in tagged:
        for field in FIELDS:
            if field not in event:
                continue
            if consolidated_by_id.get(event["id"], {}).get(field) != event[field]:
                raise SystemExit(f"Refusing editable-master update: {event['id']} canonical {field} drifted")
            if public_by_id.get(event["id"], {}).get(field) != event[field]:
                raise SystemExit(f"Refusing editable-master update: {event['id']} public {field} drifted")
    if len(manual_by_id) != len(manual):
        raise SystemExit("Refusing editable-master update: manual IDs are not unique")

    source_doc = load(SOURCES)
    source_rows = source_doc if isinstance(source_doc, list) else source_doc.get("sources", [])
    source_ids = {str(source.get("id") or "") for source in source_rows}
    authored_source_ids = {str(source.get("id") or "") for source in ledger.get("sources") or []}
    if len(authored_source_ids) != 22 or not authored_source_ids <= source_ids:
        raise SystemExit("Refusing editable-master update: Set 14 source registry is incomplete")

    master = load(MASTER)
    master[KEY] = {
        "status": "integrated_into_editable_and_public_site_source",
        "implemented_at": "2026-08-15T18:00:00-04:00",
        "research_set": SET,
        "research_actions": 144,
        "net_new_records": 54,
        "existing_records_cross_tagged": 90,
        "new_source_records": 22,
        "parent_records": 9,
        "child_occurrences": 21,
        "confirmed_records": 48,
        "qualified_records": 6,
        "excluded_candidates": 11,
        "scope": [
            "live podcasts, public-radio recordings, and media tapings",
            "livestreamed discussions, AMAs, and virtual conferences, exhibitions, and festivals",
            "creator livestreams and creator-participating watch parties",
            "game streams, VR/AR events, online premieres, and platform-native cultural events",
        ],
        "fields": FIELDS,
        "front_facing_formats": sorted(ledger.get("format_counts") or {}),
        "decisions": [
            "Existing stable IDs are cross-tagged in place; identity, date, status, and source fields remain unchanged.",
            "creator-watch-party and game-stream are the locked vocabulary; proposal aliases are not retained.",
            "Detailed source-reviewed platform, liveness, interaction, recording, access, occurrence, and creator-participation evidence remains alongside normalized fields.",
            "Unknown event clocks remain qualified; bounded series and multi-day windows use not-applicable time precision.",
            "Undated portals, secondary roundups, misclassified physical events, and duplicate platform mirrors remain explicit exclusions.",
        ],
        "implementation_files": [
            "SITE_PACKAGE/scripts/import-polymythcal-live-media-digitally-native-set14-2026-08-15.py",
            "SITE_PACKAGE/scripts/verify-polymythcal-live-media-digitally-native-set14-2026-08-15.js",
            "SITE_PACKAGE/data/polymythcal-research-set-14-live-media-digitally-native-2026-08-15.json",
            "SITE_PACKAGE/data/polymythcal-research-set-14-live-media-digitally-native-exclusions-2026-08-15.json",
            "SITE_PACKAGE/data/polymythcal-event-schema-v2.json",
            "SITE_PACKAGE/js/polymythcal-revamp.js",
        ],
        "verification": {
            "manual_records": len(manual),
            "consolidated_records": len(consolidated),
            "public_records": len(public),
            "sources": len(source_rows),
            "set14_new_cross_tagged_total": "54/90/144",
            "status": "pass",
        },
        "deployment_status": "updated_deployable_source_and_public_mirror_not_live_deployed",
        "change_list": [f"CL-WEB-{number}" for number in range(284, 292)],
        "research_ledger": {
            "path": "SITE_PACKAGE/data/polymythcal-research-set-14-live-media-digitally-native-2026-08-15.json",
            "sha256": sha256(LEDGER),
            "record_count": ledger.get("record_count"),
            "exclusion_count": ledger.get("exclusion_count"),
        },
        "exclusion_ledger": {
            "path": "SITE_PACKAGE/data/polymythcal-research-set-14-live-media-digitally-native-exclusions-2026-08-15.json",
            "sha256": sha256(EXCLUSIONS),
            "exclusion_count": exclusion_ledger.get("exclusion_count"),
        },
    }
    MASTER.write_text(
        json.dumps(master, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    update_manifest()
    print(
        json.dumps(
            {
                "master": str(MASTER),
                "set14_new_records": len(batch),
                "set14_tagged_records": len(tagged),
                "bytes": MASTER.stat().st_size,
                "sha256": sha256(MASTER),
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
