#!/usr/bin/env python3
"""Publish undated organizer announcements outside the dated calendar."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STATE = ROOT / "data" / "polymythcal-protest-candidates.json"
OUTPUT = ROOT / "polymythseminars" / "candidates.json"

PUBLIC_FIELDS = (
    "id",
    "record_kind",
    "title",
    "organizer",
    "cause",
    "source_id",
    "source_url",
    "announcement_url",
    "original_announcement_text",
    "first_seen_at",
    "last_checked_at",
    "next_recheck_at",
    "confirmation_status",
    "qualification_reasons",
    "missing_details",
    "lifecycle_status",
)


def build(state: dict) -> dict:
    announcements = []
    for raw in state.get("announcements", []):
        if not isinstance(raw, dict):
            continue
        if raw.get("record_kind") != "announcement-candidate":
            continue
        if raw.get("lifecycle_status") != "awaiting-date":
            continue
        if "event-date" not in (raw.get("missing_details") or []):
            continue
        if raw.get("date"):
            raise ValueError(
                f"Undated candidate {raw.get('identity_key')} unexpectedly has a date"
            )
        if not all(raw.get(key) for key in ("id", "title", "source_url")):
            continue
        announcements.append(
            {
                key: raw[key]
                for key in PUBLIC_FIELDS
                if raw.get(key) not in (None, "", [])
            }
        )
    announcements.sort(
        key=lambda item: (
            str(item.get("first_seen_at") or ""),
            str(item.get("title") or ""),
        ),
        reverse=True,
    )
    return {
        "_schema": "polymythcal-undated-announcement-candidates-v1",
        "_comment": (
            "Organizer announcements missing an event date. These are not "
            "chronological calendar records and never enter RSS, ICS, event "
            "detail routes, or Event structured data until a date is observed."
        ),
        "_generated_at": state.get("updated_at"),
        "count": len(announcements),
        "announcements": announcements,
    }


def main() -> int:
    state = json.loads(STATE.read_text(encoding="utf-8"))
    payload = build(state)
    text = json.dumps(payload, indent=2, ensure_ascii=False) + "\n"
    if not OUTPUT.exists() or OUTPUT.read_text(encoding="utf-8") != text:
        OUTPUT.write_text(text, encoding="utf-8")
        status = "updated"
    else:
        status = "already current"
    print(
        "POLYMYTHCAL UNDATED CANDIDATES — "
        f"{payload['count']} announcements, {status}."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
