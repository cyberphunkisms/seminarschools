#!/usr/bin/env python3
"""Import the verified July 21, 2026 PolymythCAL event research corpus.

The research package contains specific events and high-volume source-calendar
placeholders. This importer publishes only verified, net-new event records.
Source-calendar placeholders remain in data/research for later adapter work.
"""
from __future__ import annotations

import hashlib
import json
import re
from collections import Counter
from copy import deepcopy
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
RESEARCH = ROOT / "data/research/polymythcal-2026-07-21/research.json"
MANUAL = ROOT / "data/manual-events.json"
PUBLIC = ROOT / "polymythseminars/events.json"
MASTER = ROOT / "data/polymyth-seminar-events.json"
REPORT_JSON = ROOT / "POLYMYTHCAL_EVENT_IMPORT_VERIFICATION_2026-07-21.json"
REPORT_MD = ROOT / "POLYMYTHCAL_EVENT_IMPORT_2026-07-21.md"
TZ = ZoneInfo("America/Toronto")
IMPORTED_AT = "2026-07-21T12:00:00-04:00"

QUEBEC_CITIES = {"Montréal", "Vaudreuil-Dorion", "Dollard-des-Ormeaux", "Pointe-Claire"}
CITY_ZONE = {
    "Toronto": "toronto",
    "Kingston": "kingston",
    "Gananoque": "gananoque-thousand-islands",
    "Brockville": "brockville-leeds-grenville",
    "Prescott": "brockville-leeds-grenville",
    "South Dundas": "cornwall-sdg",
    "South Stormont": "cornwall-sdg",
    "Cornwall": "cornwall-sdg",
    "Montréal": "montreal",
    "Vaudreuil-Dorion": "montreal",
    "Dollard-des-Ormeaux": "montreal",
    "Pointe-Claire": "montreal",
    "Online": "online-global",
}


def clean(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def normalized_title(value: object) -> str:
    return re.sub(r"[^a-z0-9]+", "", clean(value).casefold())


def event_key(event: dict) -> tuple[str, str, str]:
    return normalized_title(event.get("title")), str(event.get("date", event.get("start_date", "")))[:10], clean(event.get("city")).casefold()


def parse_time_range(value: str) -> tuple[str | None, str | None]:
    value = clean(value).replace("–", "-").replace("—", "-")
    if not value:
        return None, None
    parts = [p.strip() for p in value.split("-", 1)]
    start = parts[0] if re.fullmatch(r"\d{2}:\d{2}", parts[0]) else None
    end = parts[1] if len(parts) == 2 and re.fullmatch(r"\d{2}:\d{2}", parts[1]) else None
    return start, end


def local_iso(day: str, hhmm: str | None = None) -> str:
    hour, minute = (0, 0)
    if hhmm:
        hour, minute = map(int, hhmm.split(":"))
    dt = datetime.strptime(day, "%Y-%m-%d").replace(hour=hour, minute=minute, tzinfo=TZ)
    return dt.isoformat(timespec="minutes")


def type_from_category(category: str) -> str:
    c = clean(category).casefold()
    if any(x in c for x in ("lecture", "seminar", "talk")):
        return "lecture"
    if "conference" in c or "institute" in c:
        return "conference"
    if any(x in c for x in ("workshop", "writing group", "book club", "storytime", "reading program")):
        return "workshop" if "book" not in c and "story" not in c and "reading" not in c else "reading"
    if any(x in c for x in ("book launch", "literary", "storytelling")):
        return "reading"
    if "artist talk" in c:
        return "artist-talk"
    if any(x in c for x in ("exhibition", "museum", "curator tour", "art activity")):
        return "exhibition"
    if any(x in c for x in ("screening", "film")):
        return "screening"
    if any(x in c for x in ("concert", "performance", "theatre", "comedy", "dance", "music", "open mic", "sound experience", "improv")):
        return "performance"
    if any(x in c for x in ("festival", "parade", "cultural celebration", "civic celebration", "holiday")):
        return "festival"
    if any(x in c for x in ("meeting", "consultation", "election", "public engagement", "civic/open data")):
        return "meeting"
    if "civic action" in c:
        return "community"
    return "community"


def source_language(value: str, city: str) -> str:
    value = clean(value).casefold()
    if "french/english" in value or "english/french" in value:
        return "fr-CA,en-CA"
    if "french" in value:
        return "fr-CA"
    return "und"


def province_for(city: str) -> str:
    if city in QUEBEC_CITIES:
        return "Quebec"
    if city == "Online":
        return "Online"
    return "Ontario"


def build_description(row: dict) -> str:
    parts = []
    if clean(row.get("notes")):
        parts.append(clean(row["notes"]))
    if clean(row.get("recurrence")):
        parts.append(f"Schedule note: {clean(row['recurrence'])}.")
    audience = clean(row.get("audience"))
    if audience and audience.casefold() != "public":
        parts.append(f"Audience: {audience}.")
    return " ".join(parts)


def make_record(row: dict) -> dict:
    start_time, end_time = parse_time_range(row.get("time", ""))
    start_day = row["start_date"]
    end_day = clean(row.get("end_date")) or start_day
    start_iso = local_iso(start_day, start_time)
    end_iso = None
    if clean(row.get("end_date")) or end_time:
        end_iso = local_iso(end_day, end_time or start_time)
    city = clean(row.get("city")) or "Unknown"
    venue_known = bool(clean(row.get("venue")))
    venue = clean(row.get("venue")) or "Location unconfirmed · Lieu non confirmé"
    time_known = bool(start_time)
    reasons = []
    if not time_known:
        reasons.append("time-unconfirmed")
    if not venue_known:
        reasons.append("location-unconfirmed")
    confirmation = "confirmed" if not reasons else "unconfirmed"
    category = clean(row.get("category")) or "community event"
    event_type = type_from_category(category)
    record_kind = "festival" if event_type == "festival" else ("civic-action" if "civic action" in category.casefold() else "event")
    research_id = clean(row["research_id"])
    stable_id = f"research-{research_id}"
    identity_key = hashlib.sha256(f"polymythcal-research-2026-07-21|{research_id}".encode()).hexdigest()[:20]
    desc = build_description(row)
    language = source_language(row.get("language", ""), city)
    secondary = []
    if category.casefold() != event_type.casefold():
        secondary.append(category)
    if event_type in {"meeting", "community"} and "community" not in secondary:
        secondary.append("community")
    return {
        "date": start_iso,
        "end_date": end_iso,
        "title": clean(row["title"]),
        "speaker_or_director": None,
        "venue": venue,
        "type": event_type,
        "source_url": clean(row["source_url"]),
        "source_id": "manual-curated",
        "description": desc,
        "secondary_types": secondary,
        "parent_id": None,
        "is_parent_festival": event_type == "festival" and bool(clean(row.get("end_date"))),
        "age_band": clean(row.get("audience")) or None,
        "id": stable_id,
        "attendance_confirmed": confirmation == "confirmed",
        "confidence": 100 if confirmation == "confirmed" else 86,
        "four_condition_test": {
            "time_place": time_known and venue_known,
            "prepared_offering": True,
            "substantive_engagement": True,
            "intellectual_stake": event_type in {"lecture", "conference", "workshop", "reading", "screening", "exhibition", "artist-talk", "meeting"},
        },
        "raw_excerpt": desc[:700] if desc else clean(row["title"]),
        "scraped_at": IMPORTED_AT,
        "review_status": "manual",
        "marginalia_url": None,
        "_src": "manual-deep-research-2026-07-21",
        "record_kind": record_kind,
        "date_precision": "exact" if time_known else "date",
        "time_precision": "exact" if time_known else "unknown",
        "source_quality": "official-or-institutional",
        "source_language": language,
        "platform_adapter": "manual-research-import",
        "organizer": clean(row.get("source_name")) or None,
        "first_seen_at": IMPORTED_AT,
        "last_checked_at": IMPORTED_AT,
        "lifecycle_status": "active",
        "city": city,
        "province": province_for(city),
        "country": "Canada" if city != "Online" else "Online",
        "corridor_zone": CITY_ZONE.get(city, "outside-corridor"),
        "timezone": "America/Toronto",
        "confirmation_status": confirmation,
        "qualification_reasons": reasons,
        "legacy_ids": [],
        "identity_key": identity_key,
        "missing_count": 0,
        "research_id": research_id,
        "research_source_ref": clean(row.get("source_ref")),
        "research_priority": clean(row.get("harvest_priority")),
        "research_registry_status": clean(row.get("source_registry_status")),
        "recurrence_note": clean(row.get("recurrence")) or None,
    }


def main() -> None:
    research = json.loads(RESEARCH.read_text(encoding="utf-8"))
    public = json.loads(PUBLIC.read_text(encoding="utf-8"))
    manual = json.loads(MANUAL.read_text(encoding="utf-8"))
    original_events = public.get("events", [])
    original_manual = manual.get("events", [])

    candidates = [
        row for row in research.get("candidate_events", [])
        if row.get("confirmation_status") == "confirmed"
        and row.get("dedup_status") == "new-candidate"
        and row.get("recommended_action") == "add-after-final-source-check"
    ]
    source_placeholders = [row for row in research.get("candidate_events", []) if row.get("confirmation_status") == "source-calendar"]
    research_duplicates = [row for row in research.get("candidate_events", []) if row.get("dedup_status") == "already-present"]

    existing_keys = {event_key(e) for e in original_events}
    existing_ids = {e.get("id") for e in original_events}
    existing_identity = {e.get("identity_key") for e in original_events}
    manual_research_ids = {clean(e.get("research_id")) for e in original_manual if clean(e.get("research_id"))}

    inserted = []
    skipped_existing = []
    skipped_manual = []
    for row in candidates:
        rec = make_record(row)
        if event_key(rec) in existing_keys or rec["id"] in existing_ids or rec["identity_key"] in existing_identity:
            skipped_existing.append({"research_id": row["research_id"], "title": row["title"], "date": row["start_date"], "city": row["city"]})
            continue
        if rec["research_id"] in manual_research_ids:
            skipped_manual.append({"research_id": row["research_id"], "title": row["title"]})
            continue
        original_events.append(rec)
        original_manual.append(deepcopy(rec))
        inserted.append(rec)
        existing_keys.add(event_key(rec))
        existing_ids.add(rec["id"])
        existing_identity.add(rec["identity_key"])
        manual_research_ids.add(rec["research_id"])

    original_events.sort(key=lambda e: (str(e.get("date") or ""), str(e.get("title") or ""), str(e.get("city") or "")))
    original_manual.sort(key=lambda e: (str(e.get("date") or ""), str(e.get("title") or ""), str(e.get("city") or "")))
    public["events"] = original_events
    public["count"] = public["_total_events"] = len(original_events)
    public["_generated_at"] = IMPORTED_AT
    public["_comment"] = "Consolidated Polymythcal events, including the verified July 21, 2026 regional event-research import."
    manual["events"] = original_manual
    manual["count"] = len(original_manual)
    manual["last_event_research_import"] = "2026-07-21"
    manual["event_research_import_count_2026_07_21"] = len(inserted)

    serialized = json.dumps(public, ensure_ascii=False, indent=2) + "\n"
    PUBLIC.write_text(serialized, encoding="utf-8")
    MASTER.write_text(serialized, encoding="utf-8")
    MANUAL.write_text(json.dumps(manual, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    report = {
        "generated_at": IMPORTED_AT,
        "baseline_canonical_events": len(public["events"]) - len(inserted),
        "research_records": len(research.get("candidate_events", [])),
        "specific_verified_records": sum(1 for r in research.get("candidate_events", []) if r.get("confirmation_status") == "confirmed"),
        "research_source_calendar_placeholders_excluded": len(source_placeholders),
        "research_already_present_excluded": len(research_duplicates),
        "candidate_records_selected": len(candidates),
        "inserted": len(inserted),
        "skipped_on_live_canonical_dedup": skipped_existing,
        "skipped_as_already_imported_manual": skipped_manual,
        "final_canonical_events_before_publication_rebuild": len(original_events),
        "inserted_by_city": dict(sorted(Counter(e["city"] for e in inserted).items())),
        "inserted_by_type": dict(sorted(Counter(e["type"] for e in inserted).items())),
        "confirmation_status": dict(sorted(Counter(e["confirmation_status"] for e in inserted).items())),
        "qualified_uncertainty_reasons": dict(sorted(Counter(reason for e in inserted for reason in e["qualification_reasons"]).items())),
        "source_files": {
            "research": str(RESEARCH.relative_to(ROOT)),
            "manual": str(MANUAL.relative_to(ROOT)),
            "canonical": str(PUBLIC.relative_to(ROOT)),
        },
    }
    REPORT_JSON.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    lines = [
        "# PolymythCAL event research import",
        "",
        "Date: 2026-07-21",
        "",
        f"- Baseline canonical events: {report['baseline_canonical_events']}",
        f"- Research records reviewed: {report['research_records']}",
        f"- Verified specific events: {report['specific_verified_records']}",
        f"- Source-calendar placeholders excluded: {report['research_source_calendar_placeholders_excluded']}",
        f"- Already-present research record excluded: {report['research_already_present_excluded']}",
        f"- Net-new events inserted: {report['inserted']}",
        f"- Final canonical events before publication rebuild: {report['final_canonical_events_before_publication_rebuild']}",
        "",
        "## Truth handling",
        "",
        "Events with an official date but no published start time carry `time-unconfirmed`. Events without a published venue carry `location-unconfirmed`. No times or venues were inferred.",
        "",
        "## Geographic additions",
        "",
    ]
    lines.extend(f"- {city}: {count}" for city, count in report["inserted_by_city"].items())
    lines += ["", "## Publication work", "", "The canonical data, manual source layer, search surfaces, event pages, ICS files, focused feeds, sitemap, deploy mirror, and validation evidence are rebuilt after this import.", ""]
    REPORT_MD.write_text("\n".join(lines), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
