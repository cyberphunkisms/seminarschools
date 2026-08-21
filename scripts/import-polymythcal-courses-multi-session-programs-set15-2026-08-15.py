#!/usr/bin/env python3
"""Idempotently import canonical Polymythcal Set 15 records and cross-tags."""
from __future__ import annotations

import copy
import fcntl
import json
from pathlib import Path
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parents[1]
MANUAL_PATH = ROOT / "data/manual-events.json"
SOURCES_PATH = ROOT / "scripts/sources.json"
LEDGER_PATH = ROOT / "data/polymythcal-research-set-15-courses-multi-session-programs-2026-08-15.json"
RESEARCH_LEDGER_PATH = ROOT / "data/research/polymythcal-set15-courses-multi-session-programs-2026-08-15/research-ledger.json"
SRC = "manual-polymythcal-courses-multi-session-programs-set15-2026-08-15"
SET = "15-Courses-and-Multi-Session-Programs"
META_KEY = "polymythcal_courses_multi_session_programs_set15_update_2026_08_15"
SOURCES_META_KEY = "polymythcal_courses_multi_session_programs_set15_2026_08_15"
LOCK_PATH = Path("/tmp/polymythcal-set15-import-2026-08-15.lock")

LOCKED_FIELDS = {
    "course_program_formats", "program_stage", "schedule_model", "session_count",
    "program_evidence", "set15_classified_at",
}
DETAIL_FIELDS = {
    "program_stage_source_value", "program_schedule_detail", "program_start_date",
    "program_end_date", "eligibility_audience", "registration_application_route",
}
PROVENANCE_FIELDS = {"research_set_cross_tags", "_upsert_batches"}


def write_json(path: Path, payload: object) -> None:
    temporary = path.with_name(path.name + ".set15.tmp")
    temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def source_root(url: str) -> str:
    parsed = urlsplit(url)
    return f"{parsed.scheme}://{parsed.netloc}/"


def validate_ledger(ledger: dict) -> None:
    expected = (
        ledger.get("record_count"), ledger.get("new_record_count"),
        ledger.get("cross_tagged_record_count"), ledger.get("normalized_format_count"),
        ledger.get("parent_record_count"), ledger.get("child_record_count"),
    )
    if expected != (81, 72, 9, 19, 7, 18):
        raise ValueError(f"Set 15 ledger accounting drifted: {expected}")
    if ledger.get("source_batch") != SRC or ledger.get("research_set") != SET:
        raise ValueError("Set 15 ledger identity drifted")
    if len(ledger.get("records") or []) != 72 or len(ledger.get("cross_tags") or []) != 9:
        raise ValueError("Set 15 ledger rows drifted")
    if len(ledger.get("exclusions") or []) != 12:
        raise ValueError("Set 15 exclusions drifted")
    historical = "exclude-historical-thinking-institute-2026-existing-date-mismatch"
    if not any(item.get("id") == historical for item in ledger["exclusions"]):
        raise ValueError("Historical Thinking date-conflict exclusion is missing")
    for item in ledger["cross_tags"]:
        fields = set(item.get("set15_fields") or {})
        if not (LOCKED_FIELDS | DETAIL_FIELDS).issubset(fields):
            raise ValueError(f"{item.get('id')}: cross-tag lacks locked Set 15 fields")
        if any(not (field in LOCKED_FIELDS or field in DETAIL_FIELDS or field.startswith("set15_")) for field in fields):
            raise ValueError(f"{item.get('id')}: cross-tag contains a non-Set-15 field")


def main() -> int:
    with LOCK_PATH.open("w", encoding="utf-8") as lock:
        fcntl.flock(lock.fileno(), fcntl.LOCK_EX)
        ledger = json.loads(LEDGER_PATH.read_text(encoding="utf-8"))
        if ledger != json.loads(RESEARCH_LEDGER_PATH.read_text(encoding="utf-8")):
            raise ValueError("Set 15 canonical and research ledgers differ")
        validate_ledger(ledger)

        manual_doc = json.loads(MANUAL_PATH.read_text(encoding="utf-8"))
        events = manual_doc.get("events") or []
        ids = [str(event.get("id") or "") for event in events]
        if not all(ids) or len(ids) != len(set(ids)):
            raise ValueError("Manual corpus must have unique explicit IDs before Set 15 import")
        by_id = {event["id"]: index for index, event in enumerate(events)}
        identity_owners: dict[str, set[str]] = {}
        for event in events:
            if event.get("identity_key"):
                identity_owners.setdefault(str(event["identity_key"]), set()).add(str(event["id"]))

        added = refreshed = 0
        for record in ledger["records"]:
            event = copy.deepcopy(record)
            identifier = event["id"]
            if identifier in by_id:
                index = by_id[identifier]
                old = events[index]
                if old.get("_src") != SRC:
                    raise ValueError(f"Set 15 proposed-new ID collides with another batch: {identifier}")
                if old.get("identity_key") != event.get("identity_key"):
                    raise ValueError(f"Set 15 identity drift on refresh: {identifier}")
                event["first_seen_at"] = old.get("first_seen_at") or event.get("first_seen_at")
                events[index] = event
                refreshed += 1
            else:
                owners = identity_owners.get(str(event.get("identity_key")), set())
                if owners:
                    raise ValueError(f"Set 15 identity collision for {identifier}: {sorted(owners)}")
                by_id[identifier] = len(events)
                events.append(event)
                identity_owners.setdefault(str(event["identity_key"]), set()).add(identifier)
                added += 1

        cross_tagged = 0
        cross_allowed = LOCKED_FIELDS | DETAIL_FIELDS | PROVENANCE_FIELDS
        for spec in ledger["cross_tags"]:
            identifier = spec["id"]
            if identifier not in by_id:
                raise ValueError(f"Set 15 cross-tag target is missing: {identifier}")
            event = events[by_id[identifier]]
            for field, expected in spec["preserved_event"].items():
                if event.get(field) != expected:
                    raise ValueError(f"{identifier}: preserved field drift before cross-tag: {field}")
            before = copy.deepcopy(event)
            for field, value in spec["set15_fields"].items():
                event[field] = copy.deepcopy(value)
                cross_allowed.add(field)
            event["research_set_cross_tags"] = list(dict.fromkeys([
                *(event.get("research_set_cross_tags") or []), SET,
            ]))
            event["_upsert_batches"] = list(dict.fromkeys([
                *(event.get("_upsert_batches") or []), SRC,
            ]))
            changed = {key for key in set(before) | set(event) if before.get(key) != event.get(key)}
            if any(not (key in cross_allowed or key.startswith("set15_")) for key in changed):
                raise ValueError(f"{identifier}: cross-tag changed a non-Set-15 field: {sorted(changed)}")
            for field, expected in spec["preserved_event"].items():
                if event.get(field) != expected:
                    raise ValueError(f"{identifier}: preserved field changed during cross-tag: {field}")
            cross_tagged += 1

        events.sort(key=lambda event: (
            str(event.get("date") or ""), str(event.get("title") or ""), str(event.get("id") or ""),
        ))
        previous_meta = manual_doc.get(META_KEY) or {}
        batch = [event for event in events if event.get("_src") == SRC]
        tagged = [event for event in events if event.get("set15_classified_at")]
        manual_doc["events"] = events
        manual_doc["count"] = len(events)
        manual_doc["last_event_research_import"] = "2026-08-15"
        manual_doc[META_KEY] = {
            "source": SRC,
            "research_set": SET,
            "records_in_delta": 81,
            "net_new_records": 72,
            "initial_records_added": previous_meta.get("initial_records_added", added),
            "records_added_latest_run": added,
            "existing_records_refreshed_latest_run": refreshed,
            "existing_records_cross_tagged": cross_tagged,
            "set15_tagged_records": len(tagged),
            "parent_records": 7,
            "child_occurrences": 18,
            "format_count": 19,
            "confirmed_records": sum(event.get("confirmation_status") == "confirmed" for event in batch),
            "qualified_records": sum(event.get("confirmation_status") != "confirmed" for event in batch),
        }

        sources_doc = json.loads(SOURCES_PATH.read_text(encoding="utf-8"))
        sources = sources_doc if isinstance(sources_doc, list) else sources_doc.get("sources", [])
        source_by_id = {str(row.get("id") or ""): row for row in sources}
        evidence_items = [*ledger["records"], *(item["set15_fields"] for item in ledger["cross_tags"])]
        source_added = 0
        for event in evidence_items:
            source_id = str(event.get("set15_evidence_source_id") or "")
            source_url = str(event.get("set15_evidence_source_url") or "")
            if not source_id or not source_url.startswith("https://"):
                raise ValueError("Every Set 15 evidence source must have an ID and official HTTPS URL")
            if source_id in source_by_id:
                continue
            row = {
                "id": source_id,
                "name": event.get("set15_evidence_source_name") or source_id,
                "tier_priority": 3,
                "default_type": "workshop",
                "base_url": source_root(source_url),
                "events_url": source_url,
                "render_mode": "static",
                "feed_status": "manual-deep-research",
                "notes": f"Added by {SRC}; official or institution-controlled Set 15 source.",
                "source_mode": "crawl",
                "harvest_enabled": True,
            }
            sources.append(row)
            source_by_id[source_id] = row
            source_added += 1
        if not isinstance(sources_doc, list):
            sources_doc["sources"] = sources
            sources_doc["$updated"] = "2026-08-15"
            sources_doc[SOURCES_META_KEY] = {
                "source": SRC,
                "source_count_in_ledger": ledger["source_count"],
                "sources_added_latest_run": source_added,
                "sources_added_total": sum(
                    str(row.get("notes") or "").startswith(f"Added by {SRC}") for row in sources
                ),
            }

        write_json(MANUAL_PATH, manual_doc)
        write_json(SOURCES_PATH, sources_doc)
        print(json.dumps({
            "status": "pass",
            "records": 81,
            "added": added,
            "refreshed": refreshed,
            "cross_tagged_existing": cross_tagged,
            "manual_total": len(events),
            "sources_total": len(sources),
            "sources_added": source_added,
        }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
