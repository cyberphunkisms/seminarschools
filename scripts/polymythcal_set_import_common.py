#!/usr/bin/env python3
"""Shared, deterministic helpers for Polymythcal researched-set imports."""
from __future__ import annotations
from pathlib import Path
from urllib.parse import urlsplit
import hashlib, json, re


def slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")[:72] or "source"


def source_root(url: str) -> str:
    parts = urlsplit(url)
    return f"{parts.scheme}://{parts.netloc}/" if parts.scheme and parts.netloc else url


def identity(source_url: str, title: str, date: str) -> str:
    return hashlib.sha256(f"{source_url}::{title}::{date[:10]}".encode()).hexdigest()[:20]


def grade_fields(age_band: str | None) -> dict:
    text = str(age_band or "").replace("–", "-").replace("—", "-")
    grades: list[str] = []
    for start, end in re.findall(r"\bGrades?\s*(\d{1,2})\s*-\s*(?:Grade\s*)?(\d{1,2})\b", text, re.I):
        a, b = int(start), int(end)
        if 1 <= a <= b <= 12:
            grades.extend(f"Grade {n}" for n in range(a, b + 1))
    for number in re.findall(r"\bGrade\s*(\d{1,2})\b", text, re.I):
        n = int(number)
        if 1 <= n <= 12:
            grades.append(f"Grade {n}")
    grades = list(dict.fromkeys(grades))
    levels: list[str] = []
    patterns = [
        ("elementary", r"\b(elementary|primary)\b"),
        ("secondary", r"\b(secondary|high school|middle school)\b"),
        ("CEGEP", r"\bCEGEP\b"),
        ("college", r"\bcollege\b"),
        ("undergraduate", r"\bundergraduate|university student|college student\b"),
        ("graduate", r"\bgraduate|master(?:'s|s)?|doctoral|PhD\b"),
        ("postdoctoral", r"\bpostdoctoral|post-doc\b"),
        ("educator", r"\beducator|teacher|adviser|advisor\b"),
        ("professional", r"\bprofessional|faculty|scholar|researcher|journalist|developer|filmmaker|photographer\b"),
        ("open", r"\bopen public|open to all|all photographers|independent game developers\b"),
    ]
    for label, pattern in patterns:
        if re.search(pattern, text, re.I): levels.append(label)
    out: dict = {"exact_grades": grades, "education_levels": levels}
    if grades:
        nums = [int(re.search(r"\d+", g).group()) for g in grades]
        out["grade_min"], out["grade_max"] = min(nums), max(nums)
    age = re.search(r"\bAges?\s*(\d{1,2})\s*-\s*(\d{1,2})\b", text, re.I)
    if age: out["age_range"] = {"min": int(age.group(1)), "max": int(age.group(2))}
    under = re.search(r"\bage\s*(\d{1,2})\s+and\s+under\b", text, re.I)
    if under: out["age_range"] = {"max": int(under.group(1))}
    return out


def make_record(*, config: dict, id: str, title: str, date: str, source_url: str,
                organizer: str, summary: str, subfields: list[str],
                record_kind: str = "opportunity", type: str = "contest",
                end_date: str | None = None, confirmed: bool = True,
                date_precision: str = "date", time_precision: str = "unknown",
                source_id: str | None = None, source_language: str = "en",
                source_languages: list[str] | None = None, age_band: str | None = None,
                education_levels: list[str] | None = None, exact_grades: list[str] | None = None,
                city: str = "Online", province: str = "", country: str = "Global",
                venue: str = "Online / organizer-defined", timezone: str = "America/Toronto",
                opportunity_kind: str | None = None, participation_unit: str | None = None,
                access_route: str | None = None, prize_form: str | None = None,
                institutional_restriction: str | None = None,
                registration_url: str | None = None, application_url: str | None = None,
                submission_url: str | None = None, parent_id: str | None = None,
                series_title: str | None = None, series_role: str | None = None,
                calendar_stage: str | None = None, source_inconsistency: str | None = None,
                source_notes: str | None = None, qualification_reasons: list[str] | None = None,
                recurrence_note: str | None = None, deadline_confidence: str | None = None,
                lifecycle_status: str = "active", ai_rule: str | None = None,
                tags: list[str] | None = None, extra: dict | None = None) -> dict:
    sid = source_id or slug(organizer)
    reasons = list(qualification_reasons or [])
    if not confirmed and not reasons:
        reasons = ["current-edition-unconfirmed", "date-unconfirmed", "time-unconfirmed"]
    domain = config["domain_label"]
    topic = config["topic_slug"]
    event = {
        "id": id, "identity_key": identity(source_url, title, date), "date": date,
        "end_date": end_date, "title": title, "type": type,
        "secondary_types": [topic], "speaker_or_director": organizer, "organizer": organizer,
        "venue": venue, "source_url": source_url, "source_id": sid,
        "source_name": organizer, "description": summary, "age_band": age_band,
        "subjects": [domain, *subfields], "topics": [topic, *[s.lower() for s in subfields]],
        "opportunity_kind": opportunity_kind,
        "tags": list(dict.fromkeys([config["set_tag"], topic, *(tags or [])])),
        "parent_id": parent_id, "series_title": series_title, "series_role": series_role,
        "calendar_stage": calendar_stage, "is_parent_festival": record_kind == "festival" and series_role == "parent",
        "attendance_confirmed": True, "confidence": 96 if confirmed else 78,
        "record_kind": record_kind, "date_precision": date_precision, "time_precision": time_precision,
        "deadline_confidence": deadline_confidence or ("official-current-cycle" if confirmed else "annual-watch-date-unannounced"),
        "source_notes": source_notes or f"Official or organizer-controlled source reviewed for {config['set_tag']} on {str(config['checked'])[:10]}.",
        "source_inconsistency": source_inconsistency, "recurrence_note": recurrence_note,
        "source_quality": "official-or-institutional", "source_language": source_language,
        "source_languages": source_languages or [source_language], "source_language_method": "source-declared",
        "platform_adapter": "manual", "first_seen_at": config["checked"], "last_checked_at": config["checked"],
        "scraped_at": config["checked"], "lifecycle_status": lifecycle_status,
        "city": city, "province": province, "country": country,
        "corridor_zone": "online-global" if city == "Online" else "unknown", "timezone": timezone,
        "confirmation_status": "confirmed" if confirmed else "unconfirmed",
        "qualification_reasons": reasons, "legacy_ids": [], "missing_count": 0,
        "research_id": f"{config['src']}:{id}", "research_source_ref": config["research_set"],
        "research_priority": "comprehensive-set-import", "research_registry_status": "included",
        "research_batch": config["src"], "research_set": config["research_set"],
        config["field_name"]: subfields,
        "participation_unit": participation_unit, "access_route": access_route,
        "prize_form": prize_form, "institutional_restriction": institutional_restriction,
        "registration_url": registration_url, "application_url": application_url,
        "submission_url": submission_url, "ai_rule": ai_rule,
        "_upsert_batches": [config["src"]], "entry_family": config["entry_family"], "_src": config["src"],
    }
    structured = grade_fields(age_band)
    if exact_grades is not None:
        structured["exact_grades"] = exact_grades
        nums = [int(re.search(r"\d+", g).group()) for g in exact_grades if re.search(r"\d+", g)]
        if nums: structured["grade_min"], structured["grade_max"] = min(nums), max(nums)
    if education_levels is not None: structured["education_levels"] = education_levels
    event.update({k: v for k, v in structured.items() if v not in (None, [], {})})
    if extra: event.update(extra)
    return {k: v for k, v in event.items() if v is not None and v != []}


def make_watch(*, config: dict, id: str, title: str, marker: str, source_url: str,
               organizer: str, summary: str, subfields: list[str], **kwargs) -> dict:
    return make_record(config=config, id=id, title=title, date=marker, source_url=source_url,
        organizer=organizer, summary=summary + " The displayed date is a monitoring marker, not a confirmed deadline or event date.",
        subfields=subfields, confirmed=False, date_precision="estimated", time_precision="unknown",
        qualification_reasons=kwargs.pop("qualification_reasons", ["current-edition-unconfirmed", "date-unconfirmed", "time-unconfirmed"]),
        deadline_confidence="annual-watch-date-unannounced", **kwargs)


def apply_import(*, root: Path, config: dict, records: list[dict], cross_tags: dict[str, dict], exclusions: list[dict]) -> dict:
    manual_path = root / "data" / "manual-events.json"
    sources_path = root / "scripts" / "sources.json"
    research_file = root / "data" / config["research_filename"]
    research_dir = root / "data" / "research" / config["research_dirname"]
    manual = json.loads(manual_path.read_text(encoding="utf-8"))
    sources_doc = json.loads(sources_path.read_text(encoding="utf-8"))
    source_rows = sources_doc["sources"]
    source_by_id = {str(s.get("id")): s for s in source_rows}
    for event in records:
        sid = event["source_id"]
        if sid in source_by_id: continue
        row = {"id": sid, "name": event.get("source_name") or event.get("organizer") or sid,
            "tier_priority": 3, "default_type": event.get("type", "other"),
            "base_url": source_root(event["source_url"]), "events_url": event["source_url"],
            "render_mode": "static", "feed_status": "manual-deep-research",
            "notes": f"Added by {config['src']}; official or organizer-controlled {config['set_tag']} source.",
            "source_mode": "crawl", "harvest_enabled": True}
        source_rows.append(row); source_by_id[sid] = row
    by_id = {event.get("id"): index for index, event in enumerate(manual["events"]) if event.get("id")}
    added = refreshed = 0
    for event in records:
        if event["id"] in by_id:
            index = by_id[event["id"]]; old = manual["events"][index]
            old_identity, first_seen = old.get("identity_key"), old.get("first_seen_at")
            refreshed_event = {**old, **event}
            # A source row explicitly marked as a series parent or standalone
            # record must not inherit an obsolete child backlink merely because
            # the new authoritative row omits parent_id.
            if event.get("series_role") in {"parent", "standalone"} and "parent_id" not in event:
                refreshed_event.pop("parent_id", None)
            manual["events"][index] = refreshed_event
            if old_identity: manual["events"][index]["identity_key"] = old_identity
            if first_seen: manual["events"][index]["first_seen_at"] = first_seen
            refreshed += 1
        else:
            by_id[event["id"]] = len(manual["events"]); manual["events"].append(event); added += 1
    cross_tagged = 0
    for event in manual["events"]:
        spec = cross_tags.get(str(event.get("id", "")))
        if not spec: continue
        for field in ["subjects", "topics", config["field_name"]]:
            event[field] = list(dict.fromkeys([*(event.get(field) or []), *(spec.get(field) or [])]))
        event["research_set_cross_tags"] = list(dict.fromkeys([*(event.get("research_set_cross_tags") or []), config["research_set"]]))
        event["_upsert_batches"] = list(dict.fromkeys([*(event.get("_upsert_batches") or []), config["src"]]))
        cross_tagged += 1
    manual["events"].sort(key=lambda e: (str(e.get("date", "")), str(e.get("title", "")), str(e.get("id", ""))))
    import_day = str(config["checked"])[:10]
    manual["count"] = len(manual["events"]); manual["last_event_research_import"] = import_day
    manual[config["metadata_key"]] = {"source": config["src"], "records_in_delta": len(records),
        "records_added": added, "records_refreshed": refreshed, "existing_records_cross_tagged": cross_tagged,
        "research_set": config["research_set"], "subfields": sorted({s for e in records for s in e.get(config["field_name"], [])}),
        "change_list_components": config["cl_ids"]}
    manual_path.write_text(json.dumps(manual, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    sources_doc["$updated"] = str(config["checked"])[:10]
    sources_doc[config["sources_metadata_key"]] = {"source": config["src"],
        "sources_added": len([s for s in source_rows if str(s.get("notes", "")).startswith(f"Added by {config['src']}")])}
    sources_path.write_text(json.dumps(sources_doc, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    ledger = {"schema": config["ledger_schema"], "generated_at": config["checked"], "source_batch": config["src"],
        "research_set": config["research_set"], "record_count": len(records), "cross_tagged_existing_ids": sorted(cross_tags),
        "records": records, "exclusions": exclusions, "notes": config["ledger_notes"]}
    research_dir.mkdir(parents=True, exist_ok=True)
    research_file.write_text(json.dumps(ledger, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    (research_dir/"research-ledger.json").write_text(json.dumps(ledger, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    (research_dir/"exclusions.json").write_text(json.dumps(exclusions, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    result = {"records": len(records), "added": added, "refreshed": refreshed, "cross_tagged_existing": cross_tagged,
        "manual_total": manual["count"], "sources_total": len(source_rows), "research_file": str(research_file)}
    print(json.dumps(result, indent=2)); return result
