#!/usr/bin/env python3
"""Validate paid-agent source accounting before publication.

The seminar agent reports only sources assigned to it (plus a tightly bounded
urgency reserve). This gate validates those rows and expands them into the full
roster-ordered ledger used by the publication pipeline. The festival agent
still reports its full primary-source ledger, which this gate validates.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
from collections import Counter
from pathlib import Path
from typing import Any, Iterable

SEMINAR_ATTEMPT_STATUSES = frozenset(
    {"crawled", "unreachable", "budget-exhausted"}
)
SEMINAR_URGENCY_STATUS = "crawled-urgency-reserve"
SEMINAR_URGENCY_TYPES = frozenset({"cfp", "contest", "screening"})
FESTIVAL_STATUSES = frozenset(
    {"crawled", "skipped-shard", "unreachable", "budget-exhausted"}
)
NON_PRODUCING_STATUSES = frozenset(
    {
        "skipped-deterministic-success",
        "skipped-disabled",
        "skipped-shard",
        "unreachable",
        "budget-exhausted",
    }
)


class LedgerValidationError(ValueError):
    """Raised when agent output cannot be safely attributed to the roster."""


def _load_json(path: Path, label: str) -> dict[str, Any]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except OSError as exc:
        raise LedgerValidationError(f"{label} could not be read: {exc}") from exc
    except json.JSONDecodeError as exc:
        raise LedgerValidationError(f"{label} is malformed JSON: {exc}") from exc
    if not isinstance(payload, dict):
        raise LedgerValidationError(f"{label} must be a JSON object")
    return payload


def _roster_rows(roster: dict[str, Any], key: str) -> list[dict[str, Any]]:
    rows = roster.get(key)
    if not isinstance(rows, list) or not rows:
        raise LedgerValidationError(f"roster must contain a non-empty {key} array")
    ids: list[str] = []
    for index, row in enumerate(rows):
        if not isinstance(row, dict):
            raise LedgerValidationError(f"roster {key}[{index}] must be an object")
        source_id = row.get("id")
        if not isinstance(source_id, str) or not source_id.strip():
            raise LedgerValidationError(
                f"roster {key}[{index}] must have a non-empty string id"
            )
        ids.append(source_id)
    duplicates = sorted(
        source_id for source_id, count in Counter(ids).items() if count > 1
    )
    if duplicates:
        raise LedgerValidationError(
            f"roster has duplicate source ids: {', '.join(duplicates)}"
        )
    return rows


def _validate_payload_shape(payload: dict[str, Any]) -> tuple[list[dict], list[dict]]:
    events = payload.get("events")
    ledger = payload.get("source_yields")
    if not isinstance(events, list):
        raise LedgerValidationError("harvest must contain an events array")
    if not isinstance(ledger, list):
        raise LedgerValidationError("harvest must contain a source_yields array")
    for index, event in enumerate(events):
        if not isinstance(event, dict):
            raise LedgerValidationError(f"event {index} must be an object")
        missing = [
            field
            for field in ("title", "date", "source_url", "source_id")
            if not event.get(field)
        ]
        if missing:
            raise LedgerValidationError(
                f"event {index} lacks required fields: {', '.join(missing)}"
            )
    return events, ledger


def _parse_agent_rows(
    raw_rows: list[dict],
    roster_ids: set[str],
    allowed_statuses: frozenset[str],
) -> tuple[dict[str, dict[str, Any]], list[str]]:
    rows: dict[str, dict[str, Any]] = {}
    order: list[str] = []
    for index, raw in enumerate(raw_rows):
        if not isinstance(raw, dict):
            raise LedgerValidationError(f"source_yields[{index}] must be an object")
        source_id = raw.get("source_id")
        if not isinstance(source_id, str) or not source_id.strip():
            raise LedgerValidationError(
                f"source_yields[{index}] must have a non-empty source_id"
            )
        if source_id not in roster_ids:
            raise LedgerValidationError(
                f"source_yields[{index}] names unknown source {source_id!r}"
            )
        if source_id in rows:
            raise LedgerValidationError(
                f"source_yields contains duplicate source {source_id!r}"
            )
        status = raw.get("status")
        if not isinstance(status, str) or status not in allowed_statuses:
            allowed = ", ".join(sorted(allowed_statuses))
            raise LedgerValidationError(
                f"source {source_id!r} has invalid status {status!r}; "
                f"allowed: {allowed}"
            )
        event_count = raw.get("events")
        if (
            isinstance(event_count, bool)
            or not isinstance(event_count, int)
            or event_count < 0
        ):
            raise LedgerValidationError(
                f"source {source_id!r} events must be a non-negative integer"
            )
        rows[source_id] = dict(raw)
        order.append(source_id)
    return rows, order


def _event_counts(
    events: list[dict], roster_ids: set[str], accountable_ids: set[str]
) -> Counter[str]:
    counts: Counter[str] = Counter()
    for index, event in enumerate(events):
        source_id = event.get("source_id")
        if not isinstance(source_id, str) or source_id not in roster_ids:
            raise LedgerValidationError(
                f"event {index} names unknown source_id {source_id!r}"
            )
        if source_id not in accountable_ids:
            raise LedgerValidationError(
                f"event {index} uses source {source_id!r} without a valid "
                "agent accounting row"
            )
        counts[source_id] += 1
    return counts


def _validate_reported_counts(
    rows: dict[str, dict[str, Any]], event_counts: Counter[str]
) -> None:
    for source_id, row in rows.items():
        actual = event_counts[source_id]
        reported = row["events"]
        if reported != actual:
            raise LedgerValidationError(
                f"source {source_id!r} reports {reported} event(s), "
                f"but the harvest contains {actual}"
            )
        if row["status"] in NON_PRODUCING_STATUSES and actual:
            raise LedgerValidationError(
                f"non-producing source {source_id!r} with status "
                f"{row['status']!r} cannot own events"
            )


def _is_active_http_source(source: dict[str, Any]) -> bool:
    return (
        source.get("enabled") is not False
        and bool(source.get("harvest_enabled", True))
        and source.get("source_mode") != "manual"
        and str(source.get("render_mode") or "").lower() != "manual"
        and str(source.get("events_url") or "")
        .strip()
        .lower()
        .startswith(("http://", "https://"))
    )


def validate_seminars(
    payload: dict[str, Any],
    roster: dict[str, Any],
    *,
    shard: int,
    shard_count: int,
    deterministic_success_ids: Iterable[str] = (),
) -> dict[str, Any]:
    """Validate seminar agent rows and return a full roster-ordered ledger."""
    if shard_count < 1:
        raise LedgerValidationError("shard_count must be positive")
    if shard < 0 or shard >= shard_count:
        raise LedgerValidationError(
            f"shard must be between 0 and {shard_count - 1}"
        )

    sources = _roster_rows(roster, "sources")
    sources_by_id = {source["id"]: source for source in sources}
    roster_ids = {source["id"] for source in sources}
    if isinstance(deterministic_success_ids, str):
        deterministic_success_ids = deterministic_success_ids.split(",")
    skip_ids = [str(value).strip() for value in deterministic_success_ids]
    skip_ids = [value for value in skip_ids if value and value != "none"]
    duplicate_skips = sorted(
        source_id
        for source_id, count in Counter(skip_ids).items()
        if count > 1
    )
    if duplicate_skips:
        raise LedgerValidationError(
            "deterministic-success ids contain duplicates: "
            + ", ".join(duplicate_skips)
        )
    unknown_skips = sorted(set(skip_ids) - roster_ids)
    if unknown_skips:
        raise LedgerValidationError(
            "deterministic-success ids are not in the roster: "
            + ", ".join(unknown_skips)
        )
    skip_set = set(skip_ids)
    inactive_ids = {
        source["id"] for source in sources if not _is_active_http_source(source)
    }
    invalid_skips = sorted(skip_set & inactive_ids)
    if invalid_skips:
        raise LedgerValidationError(
            "inactive/manual/non-http sources cannot be deterministic successes: "
            + ", ".join(invalid_skips)
        )

    assigned_ids: set[str] = set()
    automatic_status: dict[str, str] = {}
    for position, source in enumerate(sources):
        source_id = source["id"]
        if source_id in skip_set:
            automatic_status[source_id] = "skipped-deterministic-success"
        elif source_id in inactive_ids:
            automatic_status[source_id] = "skipped-disabled"
        elif int(source.get("tier_priority") or 99) == 1:
            assigned_ids.add(source_id)
        elif position % shard_count == shard:
            assigned_ids.add(source_id)
        else:
            automatic_status[source_id] = "skipped-shard"

    allowed = SEMINAR_ATTEMPT_STATUSES | {SEMINAR_URGENCY_STATUS}
    events, raw_rows = _validate_payload_shape(payload)
    agent_rows, _ = _parse_agent_rows(raw_rows, roster_ids, allowed)

    urgency_ids: set[str] = set()
    for source_id, row in agent_rows.items():
        if source_id in assigned_ids:
            if row["status"] == SEMINAR_URGENCY_STATUS:
                raise LedgerValidationError(
                    f"assigned source {source_id!r} cannot use "
                    f"{SEMINAR_URGENCY_STATUS!r}"
                )
            continue
        source = sources_by_id[source_id]
        eligible_reserve = (
            automatic_status.get(source_id) == "skipped-shard"
            and source.get("default_type") in SEMINAR_URGENCY_TYPES
        )
        if row["status"] != SEMINAR_URGENCY_STATUS or not eligible_reserve:
            raise LedgerValidationError(
                f"unassigned source {source_id!r} is not a valid urgency-reserve "
                "crawl"
            )
        urgency_ids.add(source_id)
    if len(urgency_ids) > 5:
        raise LedgerValidationError(
            f"urgency reserve contains {len(urgency_ids)} sources; maximum is 5"
        )

    missing_assigned = sorted(assigned_ids - agent_rows.keys())
    if missing_assigned:
        raise LedgerValidationError(
            "source_yields omits assigned sources: " + ", ".join(missing_assigned)
        )

    accountable_ids = set(agent_rows)
    counts = _event_counts(events, roster_ids, accountable_ids)
    _validate_reported_counts(agent_rows, counts)

    expanded: list[dict[str, Any]] = []
    for source in sources:
        source_id = source["id"]
        if source_id in agent_rows:
            expanded.append(agent_rows[source_id])
        else:
            expanded.append(
                {
                    "source_id": source_id,
                    "status": automatic_status[source_id],
                    "events": 0,
                }
            )
    result = dict(payload)
    result["source_yields"] = expanded
    return result


def validate_festivals(
    payload: dict[str, Any], roster: dict[str, Any]
) -> dict[str, Any]:
    """Validate a complete primary-source festival ledger."""
    sources = _roster_rows(roster, "primary_sources")
    roster_order = [source["id"] for source in sources]
    roster_ids = set(roster_order)
    events, raw_rows = _validate_payload_shape(payload)
    rows, row_order = _parse_agent_rows(raw_rows, roster_ids, FESTIVAL_STATUSES)

    missing = sorted(roster_ids - rows.keys())
    if missing:
        raise LedgerValidationError(
            "source_yields omits festival primary sources: " + ", ".join(missing)
        )
    if row_order != roster_order:
        raise LedgerValidationError(
            "festival source_yields must follow primary_sources roster order"
        )

    counts = _event_counts(events, roster_ids, set(rows))
    _validate_reported_counts(rows, counts)
    return dict(payload)


def _write_json_atomically(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            "w",
            encoding="utf-8",
            dir=path.parent,
            prefix=f".{path.name}.",
            suffix=".tmp",
            delete=False,
        ) as handle:
            json.dump(payload, handle, indent=2, ensure_ascii=False)
            handle.write("\n")
            temporary_path = Path(handle.name)
        os.replace(temporary_path, path)
    finally:
        if temporary_path is not None and temporary_path.exists():
            temporary_path.unlink()


def _parse_csv_ids(value: str) -> list[str]:
    return [part.strip() for part in value.split(",") if part.strip()]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="stream", required=True)

    seminars = subparsers.add_parser("seminars")
    seminars.add_argument("--harvest", type=Path, required=True)
    seminars.add_argument("--roster", type=Path, required=True)
    seminars.add_argument("--shard", type=int, required=True)
    seminars.add_argument("--shard-count", type=int, required=True)
    seminars.add_argument("--deterministic-success-ids", default="")

    festivals = subparsers.add_parser("festivals")
    festivals.add_argument("--harvest", type=Path, required=True)
    festivals.add_argument("--roster", type=Path, required=True)

    args = parser.parse_args(argv)
    try:
        payload = _load_json(args.harvest, "harvest")
        roster = _load_json(args.roster, "roster")
        if args.stream == "seminars":
            validated = validate_seminars(
                payload,
                roster,
                shard=args.shard,
                shard_count=args.shard_count,
                deterministic_success_ids=_parse_csv_ids(
                    args.deterministic_success_ids
                ),
            )
        else:
            validated = validate_festivals(payload, roster)
        _write_json_atomically(args.harvest, validated)
    except LedgerValidationError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    print(
        f"=== validated {args.stream} source ledger: "
        f"{len(validated['source_yields'])} source(s), "
        f"{len(validated['events'])} event(s) ==="
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
