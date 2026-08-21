#!/usr/bin/env python3
"""Normalize the reviewed Set 15 proposal into the canonical import ledger.

The research proposal intentionally retains source-native vocabulary.  This
preparation step maps that vocabulary to the locked calendar schema while
keeping the exact source terms and caveats in Set 15-specific evidence fields.
It does not mutate the calendar or source registry.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PROPOSAL = Path("/tmp/polymythcal-set15-proposed.json")
SRC = "manual-polymythcal-courses-multi-session-programs-set15-2026-08-15"
SET = "15-Courses-and-Multi-Session-Programs"
CLASSIFIED_AT = "2026-08-15T12:00:00-04:00"
LEDGER_REL = Path("data/polymythcal-research-set-15-courses-multi-session-programs-2026-08-15.json")
RESEARCH_REL = Path("data/research/polymythcal-set15-courses-multi-session-programs-2026-08-15")

FORMAT_MAP = {
    "public-short-courses": "public-short-course",
    "summer-schools": "summer-school",
    "camps": "camp",
    "academies": "academy",
    "institutes": "institute",
    "intensives": "intensive",
    "masterclass-series": "masterclass-series",
    "cohort-programs": "cohort-program",
    "mentorship-programs": "mentorship-program",
    "film-theatre-labs": "film-theatre-lab",
    "research-schools": "research-school",
    "field-schools": "field-school",
    "study-tours": "study-tour",
    "teacher-professional-development": "teacher-professional-development",
    "admissions-registration-dates": "admissions-registration",
    "educational-open-houses": "open-house",
    "orientations": "orientation",
    "convocations": "convocation",
    "academic-showcases": "academic-showcase",
}

STAGE_MAP = {
    "application-deadline": "admission-deadline",
    "application-opening-watch": "admission-open",
    "application-window": "admission-open",
    "convocation": "convocation",
    "masterclass-session": "session",
    "open-house": "open-house",
    "orientation": "orientation",
    "program-delivery": "program-run",
    "registration-watch": "registration-open",
    "scholarship-application-deadline": "admission-deadline",
    "series-season": "program-run",
    "showcase": "showcase",
}

SCHEDULE_MAP = {
    "bounded-application-window": "rolling-admission-bounded",
    "bounded-graduate-application-window": "rolling-admission-bounded",
    "daily-virtual-intensive": "multi-day-intensive",
    "discipline-lab-within-full-time-cohort": "fixed-cohort",
    "eleven-week-cohort-with-live-weekly-components": "fixed-cohort",
    "five-consecutive-days": "multi-day-intensive",
    "five-day-new-student-orientation": "multi-day-intensive",
    "five-day-research-school": "multi-day-intensive",
    "four-week-field-season-with-weekly-entry-points": "multi-day-intensive",
    "full-time-five-and-a-half-month-accelerated-program": "fixed-cohort",
    "full-time-six-month-conservatory": "fixed-cohort",
    "guided-online-ten-week-cohort": "fixed-cohort",
    "one-day-cohort-showcase": "single-stage",
    "one-day-conference-with-presentations-and-posters": "single-stage",
    "one-day-research-showcase": "single-stage",
    "one-day-student-pitch-showcase": "single-stage",
    "qualified-fall-window-marker": "single-stage",
    "qualified-monitoring-marker": "single-stage",
    "qualified-month-marker": "single-stage",
    "qualified-window-marker": "single-stage",
    "research-showcase-session-within-two-day-symposium": "single-stage",
    "residential-professional-training-block": "multi-day-intensive",
    "rolling-throughout-year-with-dated-sessions": "bounded-series",
    "single-day-campus-open-house": "single-stage",
    "single-day-campus-orientation": "single-stage",
    "single-day-program-open-house": "single-stage",
    "single-day-virtual-graduate-open-house": "single-stage",
    "single-day-welcome-with-pre-arrival-series": "single-stage",
    "single-deadline": "single-stage",
    "single-deadline-for-two-week-residency": "single-stage",
    "single-deadline-for-yearlong-cohort": "single-stage",
    "single-degree-ceremony": "single-stage",
    "single-evening-educational-open-house": "single-stage",
    "single-public-observation-session": "single-stage",
    "single-session-within-festival-intensive": "single-stage",
    "single-two-hour-ceremony": "single-stage",
    "term-length-shared-graduate-course": "bounded-series",
    "third-round-deadline-for-fifteen-month-program": "single-stage",
    "three-day-first-year-orientation": "multi-day-intensive",
    "three-day-hybrid-new-student-orientation": "multi-day-intensive",
    "three-day-institute": "multi-day-intensive",
    "three-day-selected-cohort-intensive": "multi-day-intensive",
    "three-day-streamed-teacher-candidate-orientation": "multi-day-intensive",
    "three-week-field-school": "multi-day-intensive",
    "three-week-intercultural-residency": "multi-day-intensive",
    "twelve-day-performance-intensive": "multi-day-intensive",
    "twelve-week-full-time-language-program": "fixed-cohort",
    "two-ceremony-day": "bounded-series",
    "two-day-guided-alumni-study-trip": "multi-day-intensive",
    "two-day-program-open-house": "multi-day-intensive",
    "two-month-undergraduate-research-cohort": "fixed-cohort",
    "two-week-self-directed-residency": "multi-day-intensive",
    "weekly-five-session-virtual-course": "bounded-series",
    "weekly-five-week-course": "bounded-series",
    "weekly-fourteen-session-course": "bounded-series",
    "weekly-ten-week-course": "bounded-series",
    "weekly-ten-week-youth-cohort": "fixed-cohort",
}

ALLOWED_REASONS = {
    "date-unconfirmed", "time-unconfirmed", "location-unconfirmed",
    "current-edition-unconfirmed", "public-access-unconfirmed",
    "registration-unconfirmed", "participant-attendance-unconfirmed",
    "official-source-unconfirmed", "aggregator-only",
    "private-status-unconfirmed", "organizer-unconfirmed",
    "occurrence-unconfirmed", "closing-date-unconfirmed",
    "director-attendance-unconfirmed", "exact-date-unconfirmed",
    "exact-screening-date-unconfirmed", "exact-talkback-participants-unconfirmed",
    "local-deadline-varies", "official-page-date-requires-reconfirmation",
    "official-source-date-conflict", "opening-date-confirmed", "program-paused",
    "recurrence-unconfirmed", "platform-or-stream-unconfirmed",
    "creator-participation-unconfirmed", "programme-schedule-unconfirmed",
    "eligibility-unconfirmed",
}

REASON_MAP = {
    "exact-fall-opening-day-not-announced": ["exact-date-unconfirmed", "programme-schedule-unconfirmed"],
    "displayed-date-is-monitoring-marker": ["date-unconfirmed"],
    "exact-application-opening-day-not-announced": ["exact-date-unconfirmed", "programme-schedule-unconfirmed"],
    "displayed-date-is-mid-window-monitoring-marker": ["date-unconfirmed"],
    "exact-march-opening-day-not-announced": ["exact-date-unconfirmed", "programme-schedule-unconfirmed"],
    "program-year-inferred-from-application-opening": ["current-edition-unconfirmed"],
}

PRESERVED_CROSS_TAG_FIELDS = [
    "date", "end_date", "title", "source_url", "source_id", "source_name",
    "organizer", "identity_key", "confirmation_status", "qualification_reasons",
    "date_precision", "time_precision", "entry_family", "_src", "research_set",
    "record_kind", "type",
]


def unique(values: list) -> list:
    return list(dict.fromkeys(values))


def normalized_reasons(raw_reasons: list[str]) -> list[str]:
    mapped: list[str] = []
    for reason in raw_reasons:
        if reason in ALLOWED_REASONS:
            mapped.append(reason)
            continue
        if reason not in REASON_MAP:
            raise ValueError(f"Unmapped Set 15 qualification reason: {reason}")
        mapped.extend(REASON_MAP[reason])
    return unique(mapped)


def date_only(event: dict) -> bool:
    if event.get("record_kind") == "opportunity" or event.get("type") == "deadline":
        return True
    if event.get("series_role") == "parent":
        return True
    if event.get("program_stage") in {
        "admission-open", "admission-deadline", "registration-open", "registration-deadline",
    }:
        return True
    start, end = str(event.get("date") or ""), str(event.get("end_date") or "")
    return bool(end and start[:10] != end[:10])


def normalize_evidence_state(event: dict) -> None:
    reasons = unique(event.get("qualification_reasons") or [])
    status = event.get("confirmation_status", "confirmed")
    if event.get("time_precision") == "unknown" and date_only(event):
        event["time_precision"] = "not-applicable"
        reasons = [reason for reason in reasons if reason != "time-unconfirmed"]
    elif event.get("time_precision") == "unknown":
        if "time-unconfirmed" not in reasons:
            reasons.append("time-unconfirmed")
        status = "unconfirmed"
    if reasons:
        status = "unconfirmed"
    elif status == "unconfirmed":
        reasons = ["occurrence-unconfirmed"]
    if status == "confirmed":
        reasons = []
    event["confirmation_status"] = "confirmed" if status == "confirmed" else "unconfirmed"
    event["qualification_reasons"] = reasons


def role_fields(raw: dict) -> dict:
    source_role = raw.get("series_role")
    if source_role and str(source_role).startswith("parent"):
        role = "parent"
    elif raw.get("parent_id"):
        role = "child"
    else:
        role = "standalone"
    result = {
        "set15_series_role": role,
        "set15_series_role_source": source_role,
        "set15_parent_id": raw.get("parent_id"),
        "set15_child_ids": raw.get("child_ids") or [],
    }
    return {key: value for key, value in result.items() if value not in (None, [])}


def evidence_fields(raw: dict) -> dict:
    original_formats = raw.get("course_program_formats") or raw.get("set15_formats") or []
    evidence = raw.get("program_evidence") or raw.get("evidence_facts") or []
    if isinstance(evidence, str):
        evidence = [evidence]
    caveats = list(raw.get("qualification_reasons") or [])
    if raw.get("source_inconsistency"):
        caveats.append(str(raw["source_inconsistency"]))
    text = " ".join(str(item).strip() for item in evidence if str(item).strip())
    text += (
        f" Source vocabulary retained: formats={','.join(original_formats)}; "
        f"stage={raw.get('program_stage')}; schedule={raw.get('schedule_model')}."
    )
    fields = {
        "course_program_formats": unique([FORMAT_MAP[value] for value in original_formats]),
        "program_stage": STAGE_MAP[raw["program_stage"]],
        "schedule_model": SCHEDULE_MAP[raw["schedule_model"]],
        "program_stage_source_value": raw.get("program_stage"),
        "program_schedule_detail": raw.get("schedule_model"),
        "session_count": raw.get("session_count"),
        "program_evidence": text.strip(),
        "program_start_date": raw.get("program_start_date"),
        "program_end_date": raw.get("program_end_date"),
        "eligibility_audience": raw.get("eligibility_audience"),
        "registration_application_route": raw.get("registration_application_route"),
        "set15_classified_at": CLASSIFIED_AT,
        "set15_source_formats": original_formats,
        "set15_program_stage_source": raw.get("program_stage"),
        "set15_schedule_model_source": raw.get("schedule_model"),
        "set15_source_caveats": caveats,
        "set15_program_evidence_facts": evidence,
        "set15_evidence_source_url": raw.get("source_url"),
        "set15_evidence_source_id": raw.get("source_id"),
        "set15_evidence_source_name": raw.get("source_name") or raw.get("organizer"),
        "set15_eligibility_audience": raw.get("eligibility_audience"),
        "set15_registration_application_route": raw.get("registration_application_route"),
        "set15_program_start_date": raw.get("program_start_date"),
        "set15_program_end_date": raw.get("program_end_date"),
        "set15_session_count_status": raw.get("session_count_status"),
        "set15_time_precision_source": raw.get("time_precision"),
    }
    fields.update(role_fields(raw))
    # ``session_count: null`` is an explicit, schema-valid statement that the
    # official source did not publish a count; retain it through every layer.
    return {
        key: value for key, value in fields.items()
        if value is not None or key in {"session_count", "program_start_date", "program_end_date"}
    }


def normalize_new(raw: dict) -> dict:
    event = copy.deepcopy(raw)
    original_alternate_dates = event.get("alternate_dates") or []
    event.update(evidence_fields(raw))
    if event.get("time_precision") == "qualified":
        # These proposal rows carry explicit start/end clocks.  "Qualified"
        # was research-state vocabulary, not an allowed time precision.
        event["time_precision"] = "exact"
    event["qualification_reasons"] = normalized_reasons(raw.get("qualification_reasons") or [])
    event["confirmation_status"] = "confirmed" if raw.get("confirmation_status") == "confirmed" else "unconfirmed"
    event["source_quality"] = "official-or-institutional"
    event["entry_family"] = "courses-multi-session-programs"
    event["_src"] = SRC
    event["_upsert_batches"] = [SRC]
    event["research_batch"] = SRC
    event["research_id"] = f"{SRC}:{raw['id']}"
    event["research_set"] = SET
    event["research_set_cross_tags"] = [SET]
    event["research_source_ref"] = SET
    event["research_registry_status"] = "included"
    event["corridor_zone"] = "online-global" if str(event.get("city")) == "Online" else "unknown"
    source_role = raw.get("series_role")
    if source_role and str(source_role).startswith("parent"):
        event["series_role"] = "parent"
    elif raw.get("parent_id"):
        event["series_role"] = "child"
    else:
        event.pop("series_role", None)
    if original_alternate_dates and any(not isinstance(value, str) for value in original_alternate_dates):
        event["set15_alternate_date_details"] = original_alternate_dates
        event["alternate_dates"] = [
            value if isinstance(value, str) else json.dumps(value, ensure_ascii=False, sort_keys=True)
            for value in original_alternate_dates
        ]
    for key in ["record_action", "stable_id_origin", "set15_formats"]:
        event.pop(key, None)
    normalize_evidence_state(event)
    return event


def normalize_cross(raw: dict, target: dict) -> dict:
    return {
        "id": raw["id"],
        "set15_fields": evidence_fields(raw),
        "preserved_event": {key: copy.deepcopy(target.get(key)) for key in PRESERVED_CROSS_TAG_FIELDS},
    }


def validate_proposal(proposal: dict) -> None:
    records = proposal.get("records") or []
    new = [record for record in records if record.get("record_action") == "propose-new"]
    cross = [record for record in records if record.get("record_action") == "cross-tag-existing"]
    if (len(records), len(new), len(cross)) != (81, 72, 9):
        raise ValueError(f"Set 15 proposal accounting drifted: {len(records)}/{len(new)}/{len(cross)}")
    observed_formats = {value for record in records for value in record.get("course_program_formats", [])}
    if observed_formats != set(FORMAT_MAP):
        raise ValueError(f"Set 15 proposal format vocabulary drifted: {sorted(observed_formats ^ set(FORMAT_MAP))}")
    observed_stages = {record.get("program_stage") for record in records}
    if observed_stages != set(STAGE_MAP):
        raise ValueError(f"Set 15 proposal stage vocabulary drifted: {sorted(observed_stages ^ set(STAGE_MAP))}")
    observed_schedules = {record.get("schedule_model") for record in records}
    if observed_schedules != set(SCHEDULE_MAP):
        raise ValueError(f"Set 15 proposal schedule vocabulary drifted: {sorted(observed_schedules ^ set(SCHEDULE_MAP))}")
    if len(proposal.get("exclusions") or []) != 12:
        raise ValueError("Set 15 proposal must retain exactly 12 explicit exclusions")
    if not any(item.get("id") == "exclude-historical-thinking-institute-2026-existing-date-mismatch" for item in proposal["exclusions"]):
        raise ValueError("Historical Thinking date-conflict exclusion is missing")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("proposal", nargs="?", type=Path, default=DEFAULT_PROPOSAL)
    args = parser.parse_args()
    proposal_bytes = args.proposal.read_bytes()
    proposal = json.loads(proposal_bytes)
    validate_proposal(proposal)

    manual = json.loads((ROOT / "data/manual-events.json").read_text(encoding="utf-8"))["events"]
    manual_by_id = {str(event.get("id")): event for event in manual if event.get("id")}
    new_records: list[dict] = []
    cross_tags: list[dict] = []
    for raw in proposal["records"]:
        if raw["record_action"] == "propose-new":
            if raw["id"] in manual_by_id:
                raise ValueError(f"Set 15 proposed-new ID already exists: {raw['id']}")
            new_records.append(normalize_new(raw))
        else:
            target = manual_by_id.get(raw["id"])
            if not target:
                raise ValueError(f"Set 15 cross-tag target is missing: {raw['id']}")
            cross_tags.append(normalize_cross(raw, target))

    ids = [record["id"] for record in new_records]
    identities = [record["identity_key"] for record in new_records]
    if len(ids) != len(set(ids)) or len(identities) != len(set(identities)):
        raise ValueError("Set 15 new IDs or identities are not unique")
    existing_identity = {str(event.get("identity_key")) for event in manual if event.get("identity_key")}
    if existing_identity.intersection(identities):
        raise ValueError("Set 15 new identity collides with the existing manual corpus")

    all_items = [*new_records, *(item["set15_fields"] for item in cross_tags)]
    normalized_formats = sorted({value for item in all_items for value in item["course_program_formats"]})
    parents = sum(item.get("set15_series_role") == "parent" for item in all_items)
    children = sum(item.get("set15_series_role") == "child" for item in all_items)
    if len(normalized_formats) != 19 or (parents, children) != (7, 18):
        raise ValueError(f"Set 15 normalized coverage drifted: formats={len(normalized_formats)}, links={parents}/{children}")

    ledger = {
        "schema": "polymythcal-courses-multi-session-programs-set15-canonical-ledger-v1",
        "generated_at": CLASSIFIED_AT,
        "as_of_date": "2026-08-15",
        "source_batch": SRC,
        "research_set": SET,
        "entry_family": "courses-multi-session-programs",
        "proposal_sha256": hashlib.sha256(proposal_bytes).hexdigest(),
        "scope_rule": proposal.get("scope_rule"),
        "record_count": 81,
        "new_record_count": 72,
        "cross_tagged_record_count": 9,
        "cross_tagged_existing_ids": sorted(item["id"] for item in cross_tags),
        "normalized_format_count": 19,
        "normalized_formats": normalized_formats,
        "parent_record_count": 7,
        "child_record_count": 18,
        "source_count": len({item["set15_evidence_source_id"] for item in all_items}),
        "category_gaps": proposal.get("category_gaps") or [],
        "records": new_records,
        "cross_tags": cross_tags,
        "exclusions": proposal["exclusions"],
        "notes": [
            "Each requested bullet is an independent Set 15 facet, never a global event type.",
            "Existing stable IDs receive Set 15 fields only; their title, date, status, source, identity, entry family, and original batch remain unchanged.",
            "Source-native plural formats, stage labels, schedule descriptions, evidence facts, and caveats remain preserved in set15_* evidence fields.",
            "The Historical Thinking Institute conflict remains an explicit exclusion and is not cross-tagged.",
            "Parents model bounded programmes or series; independently actionable stages and sessions are linked child records.",
        ],
    }

    ledger_path = ROOT / LEDGER_REL
    research_dir = ROOT / RESEARCH_REL
    research_dir.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(ledger, ensure_ascii=False, indent=2) + "\n"
    exclusions_payload = json.dumps(proposal["exclusions"], ensure_ascii=False, indent=2) + "\n"
    ledger_path.write_text(payload, encoding="utf-8")
    (research_dir / "research-ledger.json").write_text(payload, encoding="utf-8")
    (research_dir / "exclusions.json").write_text(exclusions_payload, encoding="utf-8")
    (research_dir / "normalization-report.json").write_text(
        json.dumps({
            "status": "passed",
            "proposal_sha256": ledger["proposal_sha256"],
            "new_records": 72,
            "cross_tags": 9,
            "formats": 19,
            "parents": 7,
            "children": 18,
            "qualification_vocabulary": sorted(ALLOWED_REASONS),
        }, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps({
        "status": "pass",
        "ledger": str(LEDGER_REL),
        "proposal_sha256": ledger["proposal_sha256"],
        "new_records": 72,
        "cross_tags": 9,
        "formats": 19,
        "parents": 7,
        "children": 18,
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
