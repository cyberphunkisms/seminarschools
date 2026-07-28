#!/usr/bin/env python3
"""Deterministic weekly shard selection and deterministic-stage skips."""
from __future__ import annotations

import argparse
import hashlib
import json
from datetime import date
from pathlib import Path

ANCHOR_MONDAY = date(2026, 1, 5)
DEFAULT_DETERMINISTIC_SHARD_COUNT = 4
DETERMINISTIC_EXTRA_RENDER_MODES = frozenset(
    {"static", "server-rendered", "wordpress", "drupal"}
)


def scheduled_shard(run_date: date, shard_count: int) -> int:
    """Advance exactly once per calendar week.

    A manual run on any other day in that week repeats the same slot. This
    keeps manual diagnostics from consuming a later week's shard and binds
    credit use to the approved once-weekly schedule.
    """
    if shard_count < 1:
        raise ValueError("shard_count must be positive")
    week_index = (run_date - ANCHOR_MONDAY).days // 7
    return week_index % shard_count


def stable_source_shard(source_id: str, shard_count: int) -> int:
    """Assign a source ID to one shard without depending on roster order.

    Python's built-in ``hash`` is intentionally process-randomized, so a
    cryptographic digest keeps assignments stable across runners and releases.
    """
    if shard_count < 1:
        raise ValueError("shard_count must be positive")
    source_id = str(source_id or "").strip()
    if not source_id:
        raise ValueError("source_id must be non-empty")
    digest = hashlib.sha256(source_id.encode("utf-8")).digest()
    return int.from_bytes(digest[:8], "big") % shard_count


def _is_active_http_crawl_source(source: dict) -> bool:
    return (
        source.get("enabled") is not False
        and source.get("harvest_enabled", True)
        and source.get("source_mode") != "manual"
        and str(source.get("render_mode") or "").lower() != "manual"
        and str(source.get("events_url") or "").startswith(("http://", "https://"))
    )


def priority_deterministic_sources(roster: dict) -> list[dict]:
    """Return the active every-run tier-one, non-protest source set."""
    return [
        source
        for source in roster.get("sources", [])
        if _is_active_http_crawl_source(source)
        and source.get("default_type") != "protest"
        and int(source.get("tier_priority") or 99) == 1
    ]


def rotating_deterministic_source_pool(roster: dict) -> list[dict]:
    """Return non-tier-one sources supported by the deterministic crawler."""
    return [
        source
        for source in roster.get("sources", [])
        if _is_active_http_crawl_source(source)
        and source.get("default_type") != "protest"
        and int(source.get("tier_priority") or 99) != 1
        and str(source.get("render_mode") or "").lower()
        in DETERMINISTIC_EXTRA_RENDER_MODES
    ]


def scheduled_deterministic_sources(
    roster: dict,
    run_date: date,
    shard_count: int = DEFAULT_DETERMINISTIC_SHARD_COUNT,
) -> list[dict]:
    """Return every priority source and exactly one stable extra shard."""
    active_shard = scheduled_shard(run_date, shard_count)
    priority = priority_deterministic_sources(roster)
    extras = [
        source
        for source in rotating_deterministic_source_pool(roster)
        if stable_source_shard(str(source.get("id") or ""), shard_count)
        == active_shard
    ]
    return priority + extras


def successful_deterministic_source_ids(
    roster: dict,
    payloads: list[dict],
) -> list[str]:
    """Return configured sources whose deterministic crawl fully succeeded.

    Every other result remains eligible for the paid-agent shard. In
    particular, partial, blocked, failed, confirmed-empty, and not-modified
    rows are deliberately not skipped.
    """
    configured_ids = {
        str(source.get("id"))
        for source in roster.get("sources", [])
        if str(source.get("id") or "")
    }
    successful = set()
    for payload in payloads:
        for row in payload.get("source_yields", []):
            source_id = str(row.get("source_id") or "")
            if (
                source_id in configured_ids
                and row.get("role") != "corroboration"
                and row.get("status") == "success"
            ):
                successful.add(source_id)
    return sorted(successful)


def successful_deterministic_tier1_ids(
    roster: dict,
    payloads: list[dict],
) -> list[str]:
    """Compatibility alias for the pre-Audit38 helper name."""
    return successful_deterministic_source_ids(roster, payloads)


def _read_json(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    shard = sub.add_parser("shard")
    shard.add_argument("--date", required=True)
    shard.add_argument("--count", type=int, required=True)
    skips = sub.add_parser("skip-ids")
    skips.add_argument("--roster", type=Path, required=True)
    skips.add_argument("--payload", type=Path, action="append", default=[])
    args = parser.parse_args()
    if args.command == "shard":
        print(scheduled_shard(date.fromisoformat(args.date), args.count))
    else:
        roster = _read_json(args.roster)
        payloads = [_read_json(path) for path in args.payload if path.exists()]
        print(",".join(successful_deterministic_source_ids(roster, payloads)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
