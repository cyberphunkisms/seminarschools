#!/usr/bin/env python3
"""Normalize occurrence confirmation separately from time applicability.

An official all-day deadline or bounded run can be confirmed without a clock;
its time precision is ``not-applicable``. A normal event whose start time is
still missing remains a qualified occurrence with ``time-unconfirmed``.
"""
from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TARGETS = [ROOT / "data/manual-events.json", ROOT / "polymythseminars/events.json"]


def is_date_only(event: dict) -> bool:
    if event.get("record_kind") == "opportunity" or event.get("type") == "deadline":
        return True
    if event.get("is_parent_festival") or event.get("series_role") == "parent":
        return True
    if event.get("program_stage") in {
        "admission-open",
        "admission-deadline",
        "registration-open",
        "registration-deadline",
    }:
        return True
    start = str(event.get("date") or "")
    end = str(event.get("end_date") or "")
    return bool(end and start[:10] != end[:10])


def normalize(event: dict) -> bool:
    before = json.dumps(event, ensure_ascii=False, sort_keys=True)
    reasons = list(dict.fromkeys(event.get("qualification_reasons") or []))
    precision = str(event.get("time_precision") or "unknown")
    status = str(event.get("confirmation_status") or "confirmed")

    if precision == "unknown" and is_date_only(event):
        event["time_precision"] = "not-applicable"
        reasons = [reason for reason in reasons if reason != "time-unconfirmed"]
    elif precision == "unknown":
        if "time-unconfirmed" not in reasons:
            reasons.append("time-unconfirmed")
        status = "unconfirmed"

    # Qualification reasons mean the record is qualified at the calendar
    # level. More granular evidence remains in its dedicated status fields.
    if reasons:
        status = "unconfirmed"
    elif status == "unconfirmed":
        reasons = ["occurrence-unconfirmed"]

    if status == "confirmed":
        reasons = []
    event["confirmation_status"] = status
    event["qualification_reasons"] = reasons
    return before != json.dumps(event, ensure_ascii=False, sort_keys=True)


def refresh_batch_accounting(document: dict, events: list[dict]) -> None:
    """Keep release metadata aligned with the normalized live evidence model."""
    for value in document.values():
        if not isinstance(value, dict) or not value.get("source"):
            continue
        if "confirmed_records" not in value and "qualified_records" not in value:
            continue
        batch = [event for event in events if event.get("_src") == value["source"]]
        if not batch:
            continue
        value["confirmed_records"] = sum(
            event.get("confirmation_status") == "confirmed" for event in batch
        )
        value["qualified_records"] = sum(
            event.get("confirmation_status") != "confirmed" for event in batch
        )


def main() -> int:
    results = []
    for target in TARGETS:
        document = json.loads(target.read_text(encoding="utf-8"))
        events = document.get("events", [])
        changed = sum(1 for event in events if normalize(event))
        refresh_batch_accounting(document, events)
        document["count"] = len(events)
        if "_total_events" in document:
            document["_total_events"] = len(events)
        target.write_text(
            json.dumps(document, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        results.append({"path": str(target.relative_to(ROOT)), "events": len(events), "changed": changed})
    print(json.dumps({"status": "pass", "targets": results}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
