#!/usr/bin/env python3
"""Make manual-event identities explicit and remove one proven source shadow.

The accepted Set 12 manual ledger contains 43 historical rows without an ID and
one superseded research shadow for an event already represented by a stronger
official-source record.  The former upserter happened to reconcile most rows by
title/date and silently left five duplicates.  This normalizer binds every row
to the established canonical public ID and records the one deduplication.
"""
from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MANUAL_PATH = ROOT / "data" / "manual-events.json"
CANONICAL_PATH = ROOT / "polymythseminars" / "events.json"

EXPLICIT_ID_BY_TITLE = {
    "Caribana Official Launch 2026": "edb124435d99",
    "Toronto Caribbean Carnival 2026 (Caribana, 59th year)": "275a3d6c2cb5",
    "Caribana Grand Parade": "119d86af47de",
    "Nuit Blanche Toronto 2026 (20th anniversary, 'Tomorrow's Memories')": "3018f2437e1f",
}
SHADOW_ID = "research-90988e54ea05"
CANONICAL_SHADOW_TARGET = "fdc0f440490c"


def key(event: dict) -> tuple[str, str]:
    return (
        str(event.get("title", "")).strip().casefold(),
        str(event.get("date", ""))[:10],
    )


def write_json(path: Path, payload: object) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    manual_payload = json.loads(MANUAL_PATH.read_text(encoding="utf-8"))
    canonical_payload = json.loads(CANONICAL_PATH.read_text(encoding="utf-8"))
    manual = manual_payload.get("events", [])
    canonical = canonical_payload.get("events", [])
    canonical_by_id = {str(row.get("id", "")): row for row in canonical if row.get("id")}
    canonical_by_key: dict[tuple[str, str], list[dict]] = {}
    for row in canonical:
        canonical_by_key.setdefault(key(row), []).append(row)

    if CANONICAL_SHADOW_TARGET not in canonical_by_id:
        raise SystemExit(f"Missing canonical shadow target {CANONICAL_SHADOW_TARGET}")

    changed = 0
    normalized: list[dict] = []
    shadow: dict | None = None
    for row in manual:
        if str(row.get("id", "")) == SHADOW_ID:
            shadow = row
            changed += 1
            continue
        if not row.get("id"):
            explicit = EXPLICIT_ID_BY_TITLE.get(str(row.get("title", "")))
            if explicit:
                candidates = [canonical_by_id.get(explicit)]
            else:
                candidates = canonical_by_key.get(key(row), [])
            candidates = [candidate for candidate in candidates if candidate]
            if len(candidates) != 1:
                raise SystemExit(
                    f"Manual identity is not uniquely resolvable: {row.get('title')} "
                    f"({row.get('date')}); candidates={len(candidates)}"
                )
            row["id"] = candidates[0]["id"]
            changed += 1
        normalized.append(row)

    if shadow is None:
        # Idempotent reruns after the shadow has already been consolidated.
        target = next((row for row in normalized if row.get("id") == CANONICAL_SHADOW_TARGET), None)
        if not target or SHADOW_ID not in target.get("legacy_ids", []):
            raise SystemExit("The reconciled source shadow and its legacy ID are both missing")
    else:
        target = next((row for row in normalized if row.get("id") == CANONICAL_SHADOW_TARGET), None)
        if not target:
            raise SystemExit(f"Missing manual shadow target {CANONICAL_SHADOW_TARGET}")
        legacy_ids = list(dict.fromkeys([*(target.get("legacy_ids") or []), SHADOW_ID]))
        if legacy_ids != target.get("legacy_ids"):
            target["legacy_ids"] = legacy_ids
        previous_dates = list(
            dict.fromkeys([*(target.get("previous_dates") or []), str(shadow.get("date", ""))])
        )
        target["previous_dates"] = [value for value in previous_dates if value]
        target["identity_reconciliation"] = {
            "superseded_id": SHADOW_ID,
            "reason": "official occurrence page supersedes a generic listing shadow",
            "canonical_source_url": target.get("source_url"),
        }

    ids = [str(row.get("id", "")) for row in normalized]
    if not all(ids) or len(ids) != len(set(ids)):
        raise SystemExit("Manual identity normalization did not produce unique non-empty IDs")
    if any(row.get("id") == SHADOW_ID for row in normalized):
        raise SystemExit("Superseded source shadow survived normalization")

    manual_payload["events"] = normalized
    manual_payload["count"] = len(normalized)
    write_json(MANUAL_PATH, manual_payload)
    print(
        json.dumps(
            {
                "status": "pass",
                "events": len(normalized),
                "changed": changed,
                "shadow_reconciled": SHADOW_ID,
                "all_ids_explicit": True,
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
