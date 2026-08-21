#!/usr/bin/env python3
"""Import Polymythcal Set 14 without changing existing-event identity.

The authored ledger contains 54 new records and 90 in-place cross-tags. New
records are refreshed idempotently. Cross-tags are restricted to the seven
locked Set 14 classification/evidence fields; identity, date, status, and
source fields are protected by an exact snapshot.
"""
from __future__ import annotations

import argparse
import copy
import json
from pathlib import Path
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parents[1]
LEDGER_PATH = (
    ROOT
    / "data"
    / "polymythcal-research-set-14-live-media-digitally-native-2026-08-15.json"
)
MANUAL_PATH = ROOT / "data" / "manual-events.json"
SOURCES_PATH = ROOT / "scripts" / "sources.json"

SRC = "manual-polymythcal-live-media-digitally-native-set14-2026-08-15"
RESEARCH_SET = "14-Live-Media-and-Digitally-Native-Events"
ENTRY_FAMILY = "live-media-digital-native"
METADATA_KEY = "polymythcal_live_media_digitally_native_set14_update_2026_08_15"
SOURCES_METADATA_KEY = "polymythcal_live_media_digitally_native_set14_2026_08_15"

FORMAT_VALUES = {
    "live-podcast",
    "public-radio-recording",
    "media-taping",
    "livestreamed-discussion",
    "ama",
    "virtual-conference",
    "virtual-exhibition",
    "virtual-festival",
    "creator-livestream",
    "creator-watch-party",
    "game-stream",
    "vr-ar-event",
    "online-premiere",
    "platform-native-cultural-event",
}
SYNCHRONOUS_VALUES = {
    "live",
    "live-and-replay",
    "scheduled-premiere",
    "asynchronous-bounded",
    "hybrid",
}
ARRAY_FIELDS = {
    "live_digital_formats",
    "platform_names",
    "audience_interaction_routes",
}
SCALAR_FIELDS = {
    "synchronous_status",
    "recording_availability",
    "digital_evidence",
    "set14_classified_at",
    "event_format",
    "online_location",
    "platform",
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
}
SET14_FIELDS = ARRAY_FIELDS | SCALAR_FIELDS
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
DEPRECATED_FIELDS = {
    "set14_formats",
}


def unique(values: list[object]) -> list[object]:
    result: list[object] = []
    for value in values:
        if value not in result:
            result.append(value)
    return result


def identity_snapshot(event: dict) -> dict:
    return {
        key: copy.deepcopy(event.get(key))
        for key in PROTECTED_IDENTITY_FIELDS
        if key in event
    }


def validate_ledger(ledger: dict) -> tuple[list[dict], list[dict]]:
    if ledger.get("source_batch") != SRC:
        raise SystemExit("Set 14 ledger source batch drifted")
    if ledger.get("research_set") != RESEARCH_SET:
        raise SystemExit("Set 14 ledger research-set identity drifted")
    if ledger.get("record_count") != 144:
        raise SystemExit("Set 14 ledger must contain exactly 144 researched actions")
    if ledger.get("source_count") != 22:
        raise SystemExit("Set 14 ledger must contain exactly 22 source records")
    if ledger.get("exclusion_count") != 11:
        raise SystemExit("Set 14 exclusion accounting drifted")

    records = ledger.get("records") or []
    inserted = [row for row in records if row.get("record_action") == "insert"]
    cross_tags = [
        row for row in records if row.get("record_action") == "cross-tag-existing"
    ]
    if len(inserted) != 54 or len(cross_tags) != 90:
        raise SystemExit(
            f"Set 14 ledger split drifted: {len(inserted)} new / "
            f"{len(cross_tags)} cross-tags"
        )
    ids = [str(row.get("id") or "") for row in records]
    if not all(ids) or len(ids) != len(set(ids)):
        raise SystemExit("Set 14 ledger has missing or duplicate record IDs")

    represented: set[str] = set()
    source_ids = {str(row.get("id") or "") for row in ledger.get("sources") or []}
    if len(source_ids) != 22 or "" in source_ids:
        raise SystemExit("Set 14 source ledger contains missing or duplicate IDs")
    allowed_cross_tag_fields = {
        "id",
        "record_action",
        "preserved_identity",
        *SET14_FIELDS,
    }
    required_snapshot = {
        "id",
        "date",
        "title",
        "source_url",
        "source_id",
        "confirmation_status",
    }
    for row in records:
        deprecated = DEPRECATED_FIELDS & set(row)
        if deprecated:
            raise SystemExit(f"{row.get('id')}: deprecated Set 14 fields {sorted(deprecated)}")
        formats = row.get("live_digital_formats") or []
        if not formats or not set(formats) <= FORMAT_VALUES:
            raise SystemExit(f"{row.get('id')}: invalid Set 14 formats {formats!r}")
        represented.update(formats)
        if row.get("synchronous_status") not in SYNCHRONOUS_VALUES:
            raise SystemExit(f"{row.get('id')}: invalid synchronous status")
        for field in ("platform_names", "audience_interaction_routes"):
            values = row.get(field)
            if not isinstance(values, list) or not values or not all(
                isinstance(value, str) and value.strip() for value in values
            ):
                raise SystemExit(f"{row.get('id')}: {field} is empty or malformed")
        for field in ("recording_availability", "digital_evidence", "set14_classified_at"):
            if not isinstance(row.get(field), str) or not row[field].strip():
                raise SystemExit(f"{row.get('id')}: {field} is empty or malformed")

        if row.get("record_action") == "insert":
            if row.get("_src") != SRC or row.get("entry_family") != ENTRY_FAMILY:
                raise SystemExit(f"{row.get('id')}: Set 14 insert provenance drifted")
            if row.get("research_set") != RESEARCH_SET:
                raise SystemExit(f"{row.get('id')}: Set 14 insert research-set drifted")
            if row.get("record_kind") != "event":
                raise SystemExit(f"{row.get('id')}: Set 14 insert must remain an event")
            if row.get("source_quality") != "official-or-institutional":
                raise SystemExit(f"{row.get('id')}: source quality is not normalized")
            if row.get("source_id") not in source_ids:
                raise SystemExit(f"{row.get('id')}: source ID is absent from Set 14 ledger")
            if not str(row.get("source_url") or "").startswith(("http://", "https://")):
                raise SystemExit(f"{row.get('id')}: official occurrence URL missing")
            status = row.get("confirmation_status")
            reasons = row.get("qualification_reasons") or []
            if status == "confirmed" and reasons:
                raise SystemExit(f"{row.get('id')}: confirmed record has qualifications")
            if status == "unconfirmed" and not reasons:
                raise SystemExit(f"{row.get('id')}: qualified record lacks reasons")
            if row.get("time_precision") == "unknown" and (
                status != "unconfirmed" or "time-unconfirmed" not in reasons
            ):
                raise SystemExit(f"{row.get('id')}: unknown time is not qualified")
            if row.get("time_precision") not in {
                "exact", "approximate", "all-day", "estimated", "unknown", "not-applicable"
            }:
                raise SystemExit(f"{row.get('id')}: time precision is outside the locked enum")
            if row.get("date_precision") not in {
                "exact", "date", "range", "month", "estimated", "unknown"
            }:
                raise SystemExit(f"{row.get('id')}: date precision is outside the locked enum")
        else:
            snapshot = row.get("preserved_identity") or {}
            if not required_snapshot <= set(snapshot):
                raise SystemExit(f"{row.get('id')}: protected identity snapshot incomplete")
            extras = set(row) - allowed_cross_tag_fields
            if extras:
                raise SystemExit(f"{row.get('id')}: cross-tag contains merge fields {sorted(extras)}")

    if represented != FORMAT_VALUES:
        raise SystemExit(f"Set 14 format coverage drifted: {sorted(FORMAT_VALUES - represented)}")
    if len(ledger.get("sources") or []) != len(source_ids):
        raise SystemExit("Set 14 source ledger contains duplicate IDs")
    return inserted, cross_tags


def validate_against_current(
    inserted: list[dict], cross_tags: list[dict], events: list[dict], sources_doc: dict
) -> None:
    if len({str(row.get("id") or "") for row in events}) != len(events):
        raise SystemExit("Manual event IDs must be unique before Set 14 import")
    by_id = {str(row.get("id")): row for row in events}
    for row in inserted:
        old = by_id.get(str(row["id"]))
        if old and old.get("_src") != SRC:
            raise SystemExit(f"{row['id']}: Set 14 insert collides with another record")
    for spec in cross_tags:
        event_id = str(spec["id"])
        if event_id not in by_id:
            raise SystemExit(f"{event_id}: Set 14 cross-tag target is missing")
        current = identity_snapshot(by_id[event_id])
        if current != spec["preserved_identity"]:
            changed = sorted(
                key
                for key in set(current) | set(spec["preserved_identity"])
                if current.get(key) != spec["preserved_identity"].get(key)
            )
            raise SystemExit(f"{event_id}: protected cross-tag identity drifted in {changed}")

    source_by_id = {
        str(row.get("id") or ""): row for row in (sources_doc.get("sources") or [])
    }
    for authored in json.loads(LEDGER_PATH.read_text(encoding="utf-8")).get("sources") or []:
        source_id = str(authored.get("id") or "")
        if source_id not in source_by_id:
            continue
        old_host = urlsplit(str(source_by_id[source_id].get("base_url") or "")).netloc.lower()
        new_host = urlsplit(str(authored.get("base_url") or "")).netloc.lower()
        if old_host and new_host and old_host != new_host:
            raise SystemExit(f"{source_id}: source registry ID collides across hosts")


def write_json(path: Path, payload: object) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--check",
        action="store_true",
        help="validate the authored ledger and current targets without writing",
    )
    args = parser.parse_args()

    ledger = json.loads(LEDGER_PATH.read_text(encoding="utf-8"))
    inserted, cross_tags = validate_ledger(ledger)
    manual = json.loads(MANUAL_PATH.read_text(encoding="utf-8"))
    events = manual.get("events") or []
    sources_doc = json.loads(SOURCES_PATH.read_text(encoding="utf-8"))
    validate_against_current(inserted, cross_tags, events, sources_doc)

    if args.check:
        print(
            json.dumps(
                {
                    "status": "ready",
                    "new_records": len(inserted),
                    "cross_tagged_existing": len(cross_tags),
                    "source_records": len(ledger.get("sources") or []),
                    "current_manual_total": len(events),
                    "current_sources_total": len(sources_doc.get("sources") or []),
                },
                indent=2,
            )
        )
        return 0

    by_id = {str(row.get("id")): index for index, row in enumerate(events)}
    added = refreshed = 0
    for authored in inserted:
        event_id = str(authored["id"])
        clean = {
            key: copy.deepcopy(value)
            for key, value in authored.items()
            if key != "record_action"
        }
        if event_id in by_id:
            index = by_id[event_id]
            old = events[index]
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
        event = events[by_id[event_id]]
        before_identity = identity_snapshot(event)
        for field in ARRAY_FIELDS:
            event[field] = unique([*(event.get(field) or []), *(spec.get(field) or [])])
        for field in SCALAR_FIELDS:
            if field in spec:
                event[field] = copy.deepcopy(spec[field])
        event["research_set_cross_tags"] = unique(
            [*(event.get("research_set_cross_tags") or []), RESEARCH_SET]
        )
        event["_upsert_batches"] = unique([*(event.get("_upsert_batches") or []), SRC])
        if identity_snapshot(event) != before_identity:
            raise SystemExit(f"{event_id}: Set 14 cross-tag changed protected identity")
        cross_tagged += 1

    events.sort(
        key=lambda row: (
            str(row.get("date") or ""),
            str(row.get("title") or ""),
            str(row.get("id") or ""),
        )
    )
    previous_meta = manual.get(METADATA_KEY) or {}
    initial_added = previous_meta.get("initial_records_added", added)
    batch = [row for row in events if row.get("_src") == SRC]
    manual["events"] = events
    manual["count"] = len(events)
    manual["last_event_research_import"] = "2026-08-15"
    manual[METADATA_KEY] = {
        "source": SRC,
        "research_set": RESEARCH_SET,
        "records_in_delta": 54,
        "net_new_records": 54,
        "initial_records_added": initial_added,
        "records_added_latest_run": added,
        "records_refreshed_latest_run": refreshed,
        "existing_records_cross_tagged": cross_tagged,
        "parent_records": sum(row.get("series_role") == "parent" for row in batch),
        "child_occurrences": sum(bool(row.get("parent_id")) for row in batch),
        "confirmed_records": sum(
            row.get("confirmation_status") == "confirmed" for row in batch
        ),
        "qualified_records": sum(
            row.get("confirmation_status") != "confirmed" for row in batch
        ),
        "subfields": sorted(FORMAT_VALUES),
    }
    write_json(MANUAL_PATH, manual)

    source_rows = sources_doc.get("sources") or []
    source_by_id = {str(row.get("id") or ""): row for row in source_rows}
    sources_added = 0
    for authored in ledger.get("sources") or []:
        source_id = str(authored.get("id") or "")
        if source_id in source_by_id:
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
        "initial_sources_added": previous_sources_meta.get(
            "initial_sources_added", sources_added
        ),
        "sources_added_latest_run": sources_added,
        "source_records": len(ledger.get("sources") or []),
    }
    write_json(SOURCES_PATH, sources_doc)

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
