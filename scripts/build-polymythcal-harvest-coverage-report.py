#!/usr/bin/env python3
"""Build an honest Polymythcal source, crawl, and candidate-loss ledger.

The report deliberately does not estimate events hidden behind blocked,
unselected, browser-only, or unparseable sources. Those source states are
countable; the number of events inside content the harvest never observed is
not.
"""
from __future__ import annotations

import argparse
import json
import os
from collections import Counter
from datetime import date, datetime, timezone
from pathlib import Path

from polymythcal_sharding import (
    DEFAULT_DETERMINISTIC_SHARD_COUNT,
    priority_deterministic_sources,
    rotating_deterministic_source_pool,
    scheduled_deterministic_sources,
    scheduled_shard,
)

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ROSTER = ROOT / "scripts" / "sources.json"
DEFAULT_EVENTS = ROOT / "polymythseminars" / "events.json"
DEFAULT_REVIEW = ROOT / "data" / "seminars-review.json"
DEFAULT_LIVE_REPORT = ROOT / "scripts" / "reports" / "audit48-live-harvest-endpoints.json"
DEFAULT_OUTPUT = Path("/tmp/polymythcal-harvest-coverage.json")
AGENT_SHARD_COUNT = 8


def read_json(path: Path | None) -> dict | None:
    if path is None or not path.exists():
        return None
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return value if isinstance(value, dict) else None


def active_http_source(source: dict) -> bool:
    return (
        source.get("enabled") is not False
        and source.get("harvest_enabled", True)
        and source.get("source_mode") != "manual"
        and str(source.get("render_mode") or "").lower() != "manual"
        and str(source.get("events_url") or "").startswith(("http://", "https://"))
    )


def count_agent_assignment(roster: dict, run_date: date) -> dict:
    active_shard = scheduled_shard(run_date, AGENT_SHARD_COUNT)
    assigned = []
    for position, source in enumerate(roster.get("sources", [])):
        if not active_http_source(source):
            continue
        if int(source.get("tier_priority") or 99) == 1 or position % AGENT_SHARD_COUNT == active_shard:
            assigned.append(str(source.get("id") or ""))
    return {
        "shard": active_shard,
        "shard_count": AGENT_SHARD_COUNT,
        "assigned_sources_before_deterministic_success_skips": len(assigned),
    }


def structured_accounting(payload: dict | None) -> dict:
    if payload is None:
        return {
            "available": False,
            "source_statuses": None,
            "records_parsed": None,
            "records_qualified_before_deduplication": None,
            "qualification_rejected": None,
            "qualification_rejection_reasons": None,
            "duplicates_suppressed": None,
            "records_published": None,
        }
    source_yields = [row for row in payload.get("source_yields", []) if isinstance(row, dict)]
    saved = payload.get("coverage_accounting")
    if not isinstance(saved, dict):
        saved = {
            key: sum(int(row.get(key) or 0) for row in source_yields)
            for key in (
                "records_parsed",
                "records_qualified_before_deduplication",
                "qualification_rejected",
                "duplicates_suppressed",
                "records_published",
            )
        }
        reasons = Counter()
        for row in source_yields:
            reasons.update(row.get("qualification_rejection_reasons") or {})
        saved["qualification_rejection_reasons"] = dict(sorted(reasons.items()))
    return {
        "available": True,
        "generated_at": payload.get("generated_at"),
        "selected_sources": len(payload.get("selected_source_ids") or []),
        "source_statuses": dict(sorted(Counter(str(row.get("status") or "unknown") for row in source_yields).items())),
        **{
            key: saved.get(key)
            for key in (
                "records_parsed",
                "records_qualified_before_deduplication",
                "qualification_rejected",
                "qualification_rejection_reasons",
                "duplicates_suppressed",
                "records_published",
            )
        },
    }


def published_accounting(events_payload: dict | None, review_payload: dict | None) -> dict:
    events = [] if events_payload is None else [row for row in events_payload.get("events", []) if isinstance(row, dict)]
    confirmation = Counter(str(row.get("confirmation_status") or "unconfirmed") for row in events)
    reasons = Counter()
    for row in events:
        reasons.update(str(reason) for reason in row.get("qualification_reasons") or [])
    review_events = [] if review_payload is None else review_payload.get("events") or []
    return {
        "events": len(events),
        "confirmation_statuses": dict(sorted(confirmation.items())),
        "qualification_reasons": dict(sorted(reasons.items())),
        "review_queue_events": len(review_events),
    }


def source_repair_status(roster: dict) -> dict:
    by_id = {str(source.get("id") or ""): source for source in roster.get("sources", []) if isinstance(source, dict)}
    expected = {
        "power-plant": "https://www.thepowerplant.org/",
        "soundstreams": "https://soundstreams.ca/upcoming-events/",
        "fields": "https://www.fields.utoronto.ca/calendar",
        "concordia-fofa": "https://www.concordia.ca/finearts/about/galleries-venues/fofa-gallery.html",
        "harvard-safra-ethics": "https://www.ethics.harvard.edu/calendar/upcoming",
        "folger-fellowships": "https://www.folger.edu/research/the-folger-institute/fellowships/",
        "cornwall-events": "https://cornwalltourism.com/events/",
    }
    rows = {}
    for source_id, expected_url in expected.items():
        source = by_id.get(source_id, {})
        rows[source_id] = {
            "events_url": source.get("events_url"),
            "expected_current_url": expected_url,
            "configured_as_expected": source.get("events_url") == expected_url,
        }
    soundstreams = by_id.get("soundstreams", {})
    rows["soundstreams"]["retired_inferred_feed_absent"] = "feed_url" not in soundstreams
    power_plant = by_id.get("power-plant", {})
    rows["power-plant"]["calendar_discovery_url_present"] = (
        "https://www.thepowerplant.org/whats-on/calendar" in (power_plant.get("additional_urls") or [])
    )
    return rows


def build_report(roster: dict, run_date: date, events_payload: dict | None, review_payload: dict | None, live_payload: dict | None, structured_payload: dict | None) -> dict:
    sources = [row for row in roster.get("sources", []) if isinstance(row, dict)]
    active = [row for row in sources if row.get("enabled") is not False]
    active_http = [row for row in active if str(row.get("events_url") or "").startswith(("http://", "https://"))]
    priority = priority_deterministic_sources(roster)
    rotating = rotating_deterministic_source_pool(roster)
    selected = scheduled_deterministic_sources(roster, run_date, DEFAULT_DETERMINISTIC_SHARD_COUNT)
    priority_ids = {str(row.get("id") or "") for row in priority}
    selected_rotating = [row for row in selected if str(row.get("id") or "") not in priority_ids]
    deterministic_ids = {str(row.get("id") or "") for row in [*priority, *rotating]}
    nonprotest_http = [row for row in active if active_http_source(row) and row.get("default_type") != "protest"]
    incompatible = [row for row in nonprotest_http if str(row.get("id") or "") not in deterministic_ids]
    incompatible_modes = Counter(str(row.get("render_mode") or "unknown").lower() for row in incompatible)
    return {
        "schema": "polymythcal-harvest-coverage-v1",
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "run_date": run_date.isoformat(),
        "exact_missed_event_count": None,
        "exact_missed_event_count_reason": "Events inside blocked, timed-out, deferred, browser-only, or unparseable source content were not observed, so their total is unknowable.",
        "source_registry": {
            "registered_sources": len(sources),
            "active_sources": len(active),
            "disabled_sources": len(sources) - len(active),
            "active_http_sources": len(active_http),
            "active_manual_or_non_http_sources": len(active) - len(active_http),
        },
        "weekly_selection": {
            "deterministic_shard": scheduled_shard(run_date, DEFAULT_DETERMINISTIC_SHARD_COUNT),
            "deterministic_shard_count": DEFAULT_DETERMINISTIC_SHARD_COUNT,
            "priority_sources": len(priority),
            "rotating_pool_sources": len(rotating),
            "selected_deterministic_sources": len(selected),
            "selected_rotating_sources": len(selected_rotating),
            "deferred_rotating_sources": len(rotating) - len(selected_rotating),
            "active_nonprotest_sources_not_deterministic_compatible": len(incompatible),
            "not_deterministic_compatible_by_render_mode": dict(sorted(incompatible_modes.items())),
            "paid_agent": count_agent_assignment(roster, run_date),
        },
        "retained_live_endpoint_probe": {
            "available": live_payload is not None,
            "generated_at": None if live_payload is None else live_payload.get("generated_at"),
            "selection": None if live_payload is None else live_payload.get("selection"),
            "summary": None if live_payload is None else live_payload.get("summary"),
            "retained_snapshot_not_current_run": True,
        },
        "structured_fetch_parse_candidate_accounting": structured_accounting(structured_payload),
        "published_state": published_accounting(events_payload, review_payload),
        "source_repairs": source_repair_status(roster),
    }


def append_github_summary(report: dict) -> None:
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if not summary_path:
        return
    registry = report["source_registry"]
    selection = report["weekly_selection"]
    structured = report["structured_fetch_parse_candidate_accounting"]
    published = report["published_state"]
    lines = [
        "## Polymythcal harvest coverage", "", "| Measure | Count |", "|---|---:|",
        f"| Registered sources | {registry['registered_sources']} |",
        f"| Active sources | {registry['active_sources']} |",
        f"| Deterministic sources selected | {selection['selected_deterministic_sources']} |",
        f"| Rotating sources deferred | {selection['deferred_rotating_sources']} |",
        f"| Published events | {published['events']} |",
    ]
    if structured["available"]:
        lines.extend([
            f"| Parsed candidates this run | {structured['records_parsed']} |",
            f"| Qualification rejects this run | {structured['qualification_rejected']} |",
            f"| Duplicates suppressed this run | {structured['duplicates_suppressed']} |",
        ])
    lines.extend(["", "**Exact missed-event count: unknowable.** The report counts observable source and pipeline states without inventing totals for content the harvester could not read.", ""])
    with open(summary_path, "a", encoding="utf-8") as handle:
        handle.write("\n".join(lines))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--roster", type=Path, default=DEFAULT_ROSTER)
    parser.add_argument("--events", type=Path, default=DEFAULT_EVENTS)
    parser.add_argument("--review", type=Path, default=DEFAULT_REVIEW)
    parser.add_argument("--live-report", type=Path, default=DEFAULT_LIVE_REPORT)
    parser.add_argument("--structured-run", type=Path)
    parser.add_argument("--run-date", type=date.fromisoformat, default=date.today())
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    roster = read_json(args.roster)
    if roster is None or not isinstance(roster.get("sources"), list):
        raise SystemExit(f"Source roster is missing or invalid: {args.roster}")
    report = build_report(roster, args.run_date, read_json(args.events), read_json(args.review), read_json(args.live_report), read_json(args.structured_run))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    append_github_summary(report)
    print(json.dumps({
        "exact_missed_event_count": report["exact_missed_event_count"],
        "published_events": report["published_state"]["events"],
        "registered_sources": report["source_registry"]["registered_sources"],
        "selected_deterministic_sources": report["weekly_selection"]["selected_deterministic_sources"],
    }, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
