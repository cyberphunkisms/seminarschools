#!/usr/bin/env python3
"""Upsert deterministic protest records into the one Polymythcal calendar."""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from collections import Counter
from pathlib import Path

from polymythcal_adapters import (
    event_identity_aliases,
    event_occurrence_key,
)
from polymythcal_source_health import source_health_gate_error as _shared_gate_error
from polymythcal_identity_shadow import identity_shadow_decision

ROOT = Path(__file__).resolve().parents[1]
PUBLIC_PATH = ROOT / "polymythseminars" / "events.json"
MASTER_PATH = ROOT / "data" / "polymyth-seminar-events.json"
SHADOW_PATH = ROOT / "data" / "polymythcal-identity-shadow.json"


def _key(event: dict) -> str:
    occurrence = str(event.get("occurrence_key") or "")
    if not occurrence and event.get("title") and event.get("date"):
        occurrence = event_occurrence_key(event)
    return "occurrence:" + occurrence


def _read(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def source_health_gate_error(payload: dict) -> str:
    """Return a refusal reason when deterministic source health is unproven."""
    return _shared_gate_error(
        payload,
        stream_label="deterministic protest",
        expected_stream="deterministic-protests",
        expected_scope="all-enabled-protest-sources-unsharded",
    )


def upsert(
    public_data: dict,
    incoming: list[dict],
    *,
    shadow_sink: list[dict] | None = None,
) -> tuple[dict, dict]:
    events = list(public_data.get("events") or [])
    added = refreshed = 0
    prepared = []
    for raw in incoming:
        if raw.get("type") != "protest":
            continue
        if not all(raw.get(key) for key in ("title", "date", "source_url")):
            continue
        event = dict(raw)
        event["identity_aliases"] = (
            event.get("identity_aliases") or event_identity_aliases(event)
        )
        event["occurrence_key"] = (
            event.get("occurrence_key") or event_occurrence_key(event)
        )
        if not event.get("identity_key") or event["identity_key"] in event["identity_aliases"]:
            event["identity_key"] = event["occurrence_key"]
        prepared.append(event)

    batch_alias_counts = Counter(
        alias
        for event in prepared
        for alias in event["identity_aliases"]
    )
    for event in prepared:
        occurrence_index = {_key(existing): i for i, existing in enumerate(events)}
        exact = occurrence_index.get(_key(event))
        identity_matches = [
            i
            for i, existing in enumerate(events)
            if set(
                existing.get("identity_aliases") or event_identity_aliases(existing)
            ).intersection(event["identity_aliases"])
        ]
        target = exact
        recurring_batch = bool(event.get("recurrence_id")) or any(
            batch_alias_counts[alias] > 1 for alias in event["identity_aliases"]
        )
        rescheduled = False
        if target is None and len(identity_matches) == 1 and not recurring_batch:
            # One stable URL/UID identity with a changed occurrence is a
            # reschedule. Multiple matches are recurring events and must not
            # be collapsed.
            target = identity_matches[0]
            rescheduled = True
        current_action = (
            "add"
            if target is None
            else ("reschedule" if rescheduled else "refresh")
        )
        if shadow_sink is not None:
            shadow_sink.append(
                identity_shadow_decision(
                    events,
                    event,
                    current_action=current_action,
                    current_target_index=target,
                    recurring_batch=recurring_batch,
                )
            )
        if target is None:
            events.append(event)
            added += 1
            continue
        old = events[target]
        canonical_id = old.get("id") or event.get("id")
        aliases = list(dict.fromkeys(
            list(old.get("identity_aliases") or event_identity_aliases(old))
            + list(event["identity_aliases"])
        ))
        previous_dates = list(old.get("previous_dates") or [])
        if rescheduled and old.get("date") and old.get("date") != event.get("date"):
            previous_dates.append(old["date"])
        events[target] = {
            **old,
            **event,
            "id": canonical_id,
            "identity_key": old.get("identity_key") or event["identity_key"],
            "identity_aliases": aliases,
            "previous_dates": list(dict.fromkeys(previous_dates))[-12:],
            "lifecycle_status": (
                "rescheduled" if rescheduled else event.get("lifecycle_status", old.get("lifecycle_status", "active"))
            ),
            "legacy_ids": list(
                dict.fromkeys(
                    list(old.get("legacy_ids") or [])
                    + ([event.get("id")] if event.get("id") and event.get("id") != canonical_id else [])
                )
            ),
        }
        refreshed += 1
    events.sort(
        key=lambda item: (
            str(item.get("date") or ""),
            str(item.get("title") or ""),
        )
    )
    result = dict(public_data)
    result["events"] = events
    result["count"] = len(events)
    result["_total_events"] = len(events)
    return result, {"added": added, "refreshed": refreshed, "total": len(events)}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=Path("/tmp/polymythcal-protests.json"))
    parser.add_argument("--skip-finalize", action="store_true")
    args = parser.parse_args()
    if not args.input.exists():
        print(f"Missing deterministic protest harvest: {args.input}", file=sys.stderr)
        return 2
    payload = _read(args.input)
    if payload.get("sharded") is not False:
        print("Refusing a sharded protest harvest.", file=sys.stderr)
        return 2
    gate_error = source_health_gate_error(payload)
    if gate_error:
        print(f"Refusing protest publication: {gate_error}.", file=sys.stderr)
        return 2
    events = payload.get("events")
    if not isinstance(events, list):
        print("Deterministic protest harvest must contain an events array.", file=sys.stderr)
        return 2
    public_data = _read(PUBLIC_PATH)
    shadow = []
    updated, counts = upsert(public_data, events, shadow_sink=shadow)
    text = json.dumps(updated, indent=2, ensure_ascii=False) + "\n"
    PUBLIC_PATH.write_text(text, encoding="utf-8")
    MASTER_PATH.write_text(text, encoding="utf-8")
    shadow_report = {
        "schema": "polymythcal-identity-reschedule-shadow-v1",
        "generated_at": payload.get("generated_at"),
        "mode": "diagnostic-only-backward-compatible",
        "rule": (
            "The production matcher remains authoritative. Richer URL, UID, "
            "organizer, title, and temporal signals are recorded but cannot "
            "merge or reschedule an event in this release."
        ),
        "decisions": len(shadow),
        "agreements": sum(row.get("agreement") for row in shadow),
        "disagreements": sum(not row.get("agreement") for row in shadow),
        "items": shadow,
    }
    SHADOW_PATH.write_text(
        json.dumps(shadow_report, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(
        "DETERMINISTIC PROTEST PUBLICATION — "
        f"{counts['added']} added, {counts['refreshed']} refreshed, {counts['total']} total."
    )
    if args.skip_finalize:
        return 0
    result = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "finalize-polymythcal-publication.py")],
        cwd=ROOT,
        check=False,
    )
    return result.returncode


if __name__ == "__main__":
    raise SystemExit(main())
