#!/usr/bin/env python3
"""Import Polymythcal Set 13 without changing existing-event identity.

The canonical research ledger contains 120 new records and 50 in-place
cross-tags.  New records are refreshed idempotently.  Cross-tags are limited
to the Set 13 classification/evidence fields declared below; title, date,
status, and source identity are protected by a ledger snapshot.
"""
from __future__ import annotations

import copy
import json
from pathlib import Path
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parents[1]
LEDGER_PATH = (
    ROOT
    / "data"
    / "polymythcal-research-set-13-community-charity-mutual-aid-heritage-place-2026-08-15.json"
)
MANUAL_PATH = ROOT / "data" / "manual-events.json"
SOURCES_PATH = ROOT / "scripts" / "sources.json"

SRC = "manual-polymythcal-community-charity-mutual-aid-heritage-place-set13-2026-08-15"
RESEARCH_SET = "13-Community-Charity-Mutual-Aid-Heritage-Place"
ENTRY_FAMILY = "community-charity-mutual-aid-heritage-place"
METADATA_KEY = "polymythcal_community_charity_mutual_aid_heritage_place_set13_update_2026_08_15"
SOURCES_METADATA_KEY = "polymythcal_community_charity_mutual_aid_heritage_place_set13_2026_08_15"

FORMAT_VALUES = {
    "charity-walk-run-ride",
    "fundraiser",
    "benefit-performance",
    "food-clothing-drive",
    "mutual-aid-action",
    "volunteer-day",
    "community-cleanup",
    "repair-cafe",
    "community-garden",
    "neighbourhood-assembly",
    "community-meal",
    "block-party",
    "bazaar-night-market",
    "newcomer-diaspora",
    "historical-walk",
    "architecture-tour",
    "cemetery-tour",
    "public-dig",
    "reenactment",
    "open-archive",
    "doors-open",
    "land-based-learning",
}

ARRAY_FIELDS = {
    "community_heritage_formats",
    "community_participation_roles",
    "contribution_routes",
    "community_heritage_scope",
}
SCALAR_FIELDS = {
    "beneficiary_or_cause",
    "place_relation",
    "community_evidence",
    "set13_classified_at",
    "community_public_access_status",
    "community_registration_required",
    "community_participation_mode",
    "community_date_evidence",
    "community_access_evidence",
    "community_participation_evidence",
    "community_beneficiary_evidence",
    "community_place_evidence",
    "community_heritage_evidence",
}
SET13_FIELDS = ARRAY_FIELDS | SCALAR_FIELDS
PROTECTED_IDENTITY_FIELDS = {
    "id",
    "identity_key",
    "occurrence_key",
    "date",
    "end_date",
    "title",
    "source_url",
    "source_id",
    "source_name",
    "source_quality",
    "confirmation_status",
    "qualification_reasons",
    "lifecycle_status",
}


def unique(values: list[object]) -> list[object]:
    result: list[object] = []
    for value in values:
        if value not in result:
            result.append(value)
    return result


def validate_ledger(ledger: dict) -> tuple[list[dict], list[dict]]:
    if ledger.get("source_batch") != SRC:
        raise SystemExit("Set 13 ledger source batch drifted")
    if ledger.get("research_set") != RESEARCH_SET:
        raise SystemExit("Set 13 ledger research-set identity drifted")
    if ledger.get("record_count") != 170:
        raise SystemExit("Set 13 ledger must contain exactly 170 researched records")
    records = ledger.get("records") or []
    inserted = [row for row in records if row.get("record_action") == "insert"]
    cross_tags = [row for row in records if row.get("record_action") == "cross-tag-existing"]
    if len(inserted) != 120 or len(cross_tags) != 50:
        raise SystemExit(
            f"Set 13 ledger split drifted: {len(inserted)} new / {len(cross_tags)} cross-tags"
        )
    ids = [str(row.get("id") or "") for row in records]
    if not all(ids) or len(ids) != len(set(ids)):
        raise SystemExit("Set 13 ledger has missing or duplicate record IDs")
    represented: set[str] = set()
    forbidden = {
        "community_charity_heritage_formats",
        "participation_roles",
        "beneficiary_scope",
        "place_relationship",
    }
    for row in records:
        if forbidden & set(row):
            raise SystemExit(f"{row.get('id')}: Set 13 ledger contains deprecated fields")
        formats = row.get("community_heritage_formats") or []
        if not formats or not set(formats) <= FORMAT_VALUES:
            raise SystemExit(f"{row.get('id')}: invalid Set 13 formats {formats!r}")
        represented.update(formats)
        if row.get("record_action") == "insert":
            if row.get("_src") != SRC or row.get("entry_family") != ENTRY_FAMILY:
                raise SystemExit(f"{row.get('id')}: Set 13 insert provenance drifted")
            if row.get("record_kind") != "event":
                raise SystemExit(
                    f"{row.get('id')}: bounded parents and linked children must use record_kind=event"
                )
            if row.get("source_quality") != "official-or-institutional":
                raise SystemExit(f"{row.get('id')}: source quality is not normalized")
            if not str(row.get("source_url") or "").startswith(("http://", "https://")):
                raise SystemExit(f"{row.get('id')}: official occurrence URL missing")
        else:
            snapshot = row.get("preserved_identity") or {}
            if not {"id", "date", "title", "source_url", "source_id", "confirmation_status"} <= set(snapshot):
                raise SystemExit(f"{row.get('id')}: protected identity snapshot incomplete")
            if set(row) - ({"id", "record_action", "preserved_identity"} | SET13_FIELDS):
                raise SystemExit(f"{row.get('id')}: cross-tag contains non-Set 13 merge fields")
    if represented != FORMAT_VALUES:
        raise SystemExit(f"Set 13 format coverage drifted: {sorted(FORMAT_VALUES - represented)}")
    return inserted, cross_tags


def identity_snapshot(event: dict) -> dict:
    return {key: copy.deepcopy(event.get(key)) for key in PROTECTED_IDENTITY_FIELDS if key in event}


def main() -> int:
    ledger = json.loads(LEDGER_PATH.read_text(encoding="utf-8"))
    inserted, cross_tags = validate_ledger(ledger)
    manual = json.loads(MANUAL_PATH.read_text(encoding="utf-8"))
    events = manual.get("events") or []
    if len({str(row.get("id") or "") for row in events}) != len(events):
        raise SystemExit("Manual event IDs must be unique before Set 13 import")
    by_id = {str(row.get("id")): index for index, row in enumerate(events)}

    added = refreshed = 0
    for authored in inserted:
        event_id = str(authored["id"])
        clean = {key: copy.deepcopy(value) for key, value in authored.items() if key != "record_action"}
        if event_id in by_id:
            index = by_id[event_id]
            old = events[index]
            if old.get("_src") != SRC:
                raise SystemExit(f"{event_id}: Set 13 insert collides with a non-Set 13 record")
            merged = {**old, **clean}
            if old.get("identity_key"):
                merged["identity_key"] = old["identity_key"]
            if old.get("first_seen_at"):
                merged["first_seen_at"] = old["first_seen_at"]
            merged["_upsert_batches"] = unique(
                [*(old.get("_upsert_batches") or []), *(clean.get("_upsert_batches") or [])]
            )
            events[index] = merged
            refreshed += 1
        else:
            by_id[event_id] = len(events)
            events.append(clean)
            added += 1

    cross_tagged = 0
    for spec in cross_tags:
        event_id = str(spec["id"])
        if event_id not in by_id:
            raise SystemExit(f"{event_id}: Set 13 cross-tag target is missing")
        event = events[by_id[event_id]]
        expected_identity = spec["preserved_identity"]
        current_identity = identity_snapshot(event)
        if current_identity != expected_identity:
            changed = sorted(
                key
                for key in set(current_identity) | set(expected_identity)
                if current_identity.get(key) != expected_identity.get(key)
            )
            raise SystemExit(f"{event_id}: protected cross-tag identity drifted in {changed}")
        before_identity = identity_snapshot(event)
        for field in ARRAY_FIELDS:
            if field in spec:
                event[field] = unique([*(event.get(field) or []), *(spec.get(field) or [])])
        for field in SCALAR_FIELDS:
            if field in spec:
                event[field] = copy.deepcopy(spec[field])
        event["research_set_cross_tags"] = unique(
            [*(event.get("research_set_cross_tags") or []), RESEARCH_SET]
        )
        event["_upsert_batches"] = unique([*(event.get("_upsert_batches") or []), SRC])
        if identity_snapshot(event) != before_identity:
            raise SystemExit(f"{event_id}: Set 13 cross-tag changed protected identity")
        cross_tagged += 1

    events.sort(key=lambda row: (str(row.get("date") or ""), str(row.get("title") or ""), str(row.get("id") or "")))
    previous_meta = manual.get(METADATA_KEY) or {}
    initial_added = previous_meta.get("initial_records_added", added)
    batch = [row for row in events if row.get("_src") == SRC]
    manual["events"] = events
    manual["count"] = len(events)
    manual["last_event_research_import"] = "2026-08-15"
    manual[METADATA_KEY] = {
        "source": SRC,
        "research_set": RESEARCH_SET,
        "records_in_delta": 120,
        "net_new_records": 120,
        "initial_records_added": initial_added,
        "records_added_latest_run": added,
        "records_refreshed_latest_run": refreshed,
        "existing_records_cross_tagged": cross_tagged,
        "parent_records": sum(row.get("series_role") == "parent" for row in batch),
        "child_occurrences": sum(bool(row.get("parent_id")) for row in batch),
        "confirmed_records": sum(row.get("confirmation_status") == "confirmed" for row in batch),
        "qualified_records": sum(row.get("confirmation_status") != "confirmed" for row in batch),
        "subfields": sorted(FORMAT_VALUES),
    }
    MANUAL_PATH.write_text(json.dumps(manual, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    sources_doc = json.loads(SOURCES_PATH.read_text(encoding="utf-8"))
    source_rows = sources_doc.get("sources") or []
    source_by_id = {str(row.get("id") or ""): row for row in source_rows}
    sources_added = 0
    for authored in ledger.get("sources") or []:
        source_id = str(authored.get("id") or "")
        if source_id in source_by_id:
            old_host = urlsplit(str(source_by_id[source_id].get("base_url") or "")).netloc.lower()
            new_host = urlsplit(str(authored.get("base_url") or "")).netloc.lower()
            if old_host and new_host and old_host != new_host:
                raise SystemExit(f"{source_id}: source registry ID collides across hosts")
            continue
        row = copy.deepcopy(authored)
        source_rows.append(row)
        source_by_id[source_id] = row
        sources_added += 1
    source_rows.sort(key=lambda row: str(row.get("id") or ""))
    previous_sources_meta = sources_doc.get(SOURCES_METADATA_KEY) or {}
    sources_doc["sources"] = source_rows
    sources_doc["$updated"] = "2026-08-15"
    sources_doc[SOURCES_METADATA_KEY] = {
        "source": SRC,
        "initial_sources_added": previous_sources_meta.get("initial_sources_added", sources_added),
        "sources_added_latest_run": sources_added,
        "source_records": len(ledger.get("sources") or []),
    }
    SOURCES_PATH.write_text(json.dumps(sources_doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(
        json.dumps(
            {
                "records": len(inserted),
                "added": added,
                "refreshed": refreshed,
                "cross_tagged_existing": cross_tagged,
                "manual_total": len(events),
                "sources_added": sources_added,
                "sources_total": len(source_rows),
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
