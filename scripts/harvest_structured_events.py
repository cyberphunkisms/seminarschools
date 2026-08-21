#!/usr/bin/env python3
"""Deterministic discovery for priority and rotating non-protest sources.

This bounded stage exercises the same feed/API/sitemap/pagination/detail-page
crawler as the protest pipeline. Tier-one sources run every time; one stable
shard of deterministic-compatible sources expands coverage without changing
the schedule or paid-agent frequency. The stage only upserts records, so a
partial source run cannot erase canonical events.
"""
from __future__ import annotations

import argparse
import concurrent.futures
import json
import sys
from collections import Counter
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from polymythcal_adapters import (
    creator_attendance_confirmed,
    event_identity_aliases,
    event_occurrence_key,
    normalise_source_config,
)
from polymythcal_discovery import RequestsFetcher, crawl_source
from polymythcal_sharding import (
    DEFAULT_DETERMINISTIC_SHARD_COUNT,
    priority_deterministic_sources,
    rotating_deterministic_source_pool,
    scheduled_deterministic_sources,
    scheduled_shard,
)
from polymythcal_source_health import (
    SOURCE_HEALTH_FAILURE_EXIT,
    evaluate_source_health,
)
from polymythcal_http_cache import ParsedResponseCache
from validate_polymythcal_sources import load_validated_roster

ROOT = Path(__file__).resolve().parents[1]
SOURCES_PATH = ROOT / "scripts" / "sources.json"
DEFAULT_OUTPUT = Path("/tmp/polymythcal-structured.json")
HTTP_CACHE_PATH = ROOT / "data" / "polymythcal-http-cache.json"


def _normalise_sources(sources: list[dict]) -> list[dict]:
    return [
        normalise_source_config(raw)
        for raw in sources
    ]


def load_priority_sources(path: Path = SOURCES_PATH) -> list[dict]:
    """Return the compatibility every-run tier-one deterministic set."""
    roster = load_validated_roster(path)
    return _normalise_sources(priority_deterministic_sources(roster))


def load_rotating_source_pool(path: Path = SOURCES_PATH) -> list[dict]:
    """Return active non-protest sources safe for deterministic rotation."""
    roster = load_validated_roster(path)
    return _normalise_sources(rotating_deterministic_source_pool(roster))


def load_scheduled_sources(
    path: Path = SOURCES_PATH,
    *,
    run_date: date | None = None,
    shard_count: int = DEFAULT_DETERMINISTIC_SHARD_COUNT,
) -> list[dict]:
    """Return every tier-one source plus this run's stable extra shard."""
    run_date = run_date or datetime.now(timezone.utc).date()
    roster = load_validated_roster(path)
    return _normalise_sources(
        scheduled_deterministic_sources(roster, run_date, shard_count)
    )


def qualify_with_reason(
    record: dict,
    source: dict,
    checked_at: datetime,
) -> tuple[dict | None, str | None]:
    """Qualify one parsed record and preserve an explicit rejection reason."""
    source = normalise_source_config(source)
    for key in ("title", "date", "source_url"):
        if not record.get(key):
            return None, f"missing-required-{key.replace('_', '-')}"
    try:
        event_dt = datetime.fromisoformat(str(record["date"]).replace("Z", "+00:00"))
        if event_dt.tzinfo is None:
            event_dt = event_dt.replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return None, "invalid-date"
    if event_dt < checked_at - timedelta(days=1):
        return None, "outside-publication-window-past"
    if event_dt > checked_at + timedelta(days=180):
        return None, "outside-publication-window-future"
    if record.get("type") == "screening":
        screening_evidence = " ".join(
            str(record.get(key) or "")
            for key in (
                "title", "raw_excerpt", "description", "organizer",
                "speaker_or_director", "attendance_evidence",
            )
        )
        if not creator_attendance_confirmed(screening_evidence):
            return None, "screening-creator-attendance-unconfirmed"
        record = dict(record)
        record["attendance_confirmed"] = True
    result = dict(record)
    result["identity_aliases"] = (
        result.get("identity_aliases") or event_identity_aliases(result)
    )
    result["occurrence_key"] = (
        result.get("occurrence_key") or event_occurrence_key(result)
    )
    if not result.get("identity_key") or result["identity_key"] in result["identity_aliases"]:
        result["identity_key"] = result["occurrence_key"]
    result.setdefault("record_kind", "event")
    result.setdefault("date_precision", "exact" if result.get("time_precision") == "exact" else "date")
    result.setdefault("time_precision", "unknown")
    result.setdefault("lifecycle_status", "active")
    result["city"] = (
        result.get("city") or source.get("city") or source.get("region") or "Location varies"
    )
    result["corridor_zone"] = (
        result.get("corridor_zone") or source.get("corridor_zone") or "unknown"
    )
    result["timezone"] = (
        result.get("timezone") or source.get("timezone") or "America/Toronto"
    )
    result.setdefault("source_quality", "official-or-institutional")
    reasons = list(result.get("qualification_reasons") or [])
    if result.get("time_precision") != "exact":
        reasons.append("time-unconfirmed")
    venue = str(result.get("venue") or "").strip()
    if not venue or venue.lower() in {"toronto", "montréal", "montreal", "kingston", "tbd", "tba"}:
        reasons.append("location-unconfirmed")
    if not result.get("organizer"):
        reasons.append("organizer-unconfirmed")
    result["qualification_reasons"] = list(dict.fromkeys(reasons))
    result["confirmation_status"] = "unconfirmed" if reasons else "confirmed"
    result["review_status"] = "auto-published"
    result["first_seen_at"] = result.get("first_seen_at") or checked_at.isoformat(timespec="seconds")
    result["last_checked_at"] = checked_at.isoformat(timespec="seconds")
    result["scraped_at"] = checked_at.isoformat(timespec="seconds")
    return result, None


def qualify(record: dict, source: dict, checked_at: datetime) -> dict | None:
    """Compatibility wrapper for callers that only need the qualified row."""
    qualified, _ = qualify_with_reason(record, source, checked_at)
    return qualified


def run(
    sources: list[dict],
    *,
    max_pages: int = 8,
    max_depth: int = 3,
    max_elapsed_seconds: float = 75,
    max_workers: int = 6,
    parsed_cache: ParsedResponseCache | None = None,
) -> dict:
    now = datetime.now(timezone.utc)
    candidate_events = []
    yields = []
    accounting = {}

    def crawl_one(source):
        return crawl_source(
            source,
            fetcher=RequestsFetcher(),
            max_pages=max_pages,
            max_depth=max_depth,
            max_elapsed_seconds=max_elapsed_seconds,
            parsed_cache=parsed_cache,
        )

    results = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, max_workers)) as pool:
        futures = {
            str(source.get("id") or ""): pool.submit(crawl_one, source)
            for source in sources
        }
        for sid, future in futures.items():
            try:
                results[sid] = future.result()
            except Exception as exc:
                from polymythcal_discovery import CrawlResult, FetchOutcome
                results[sid] = CrawlResult(
                    source_id=sid,
                    status="fetch-error",
                    fetches=[
                        FetchOutcome(
                            url="",
                            status="fetch-error",
                            error=f"crawl worker failed: {exc}",
                            failure_kind="worker-exception",
                        )
                    ],
                )

    for source in sources:
        source_id = str(source.get("id") or "")
        result = results[source_id]
        rejection_reasons = Counter()
        qualified_before_deduplication = 0
        for record in result.records:
            qualified, rejection_reason = qualify_with_reason(record, source, now)
            if qualified:
                qualified_before_deduplication += 1
                candidate_events.append((qualified, source_id))
            else:
                rejection_reasons[rejection_reason or "unspecified"] += 1
        accounting[source_id] = {
            "records_parsed": len(result.records),
            "records_qualified_before_deduplication": qualified_before_deduplication,
            "qualification_rejected": sum(rejection_reasons.values()),
            "qualification_rejection_reasons": dict(sorted(rejection_reasons.items())),
            "duplicates_suppressed": 0,
            "records_published": 0,
        }
        source_yield = result.source_yield()
        source_yield.update(accounting[source_id])
        yields.append(source_yield)
    by_key = {}
    for event, source_id in candidate_events:
        key = event["occurrence_key"]
        prior = by_key.get(key)
        if not prior:
            by_key[key] = (event, source_id)
            continue
        prior_event, prior_source_id = prior
        if int(event.get("confidence") or 0) > int(prior_event.get("confidence") or 0):
            accounting[prior_source_id]["duplicates_suppressed"] += 1
            by_key[key] = (event, source_id)
        else:
            accounting[source_id]["duplicates_suppressed"] += 1
    for _, source_id in by_key.values():
        accounting[source_id]["records_published"] += 1
    for source_yield in yields:
        source_id = str(source_yield.get("source_id") or "")
        source_yield.update(accounting[source_id])
    result_events = sorted(
        (event for event, _ in by_key.values()),
        key=lambda item: (str(item.get("date") or ""), str(item.get("title") or "")),
    )
    coverage_accounting = {
        "records_parsed": sum(row["records_parsed"] for row in accounting.values()),
        "records_qualified_before_deduplication": sum(
            row["records_qualified_before_deduplication"]
            for row in accounting.values()
        ),
        "qualification_rejected": sum(
            row["qualification_rejected"] for row in accounting.values()
        ),
        "qualification_rejection_reasons": dict(sorted(sum(
            (
                Counter(row["qualification_rejection_reasons"])
                for row in accounting.values()
            ),
            Counter(),
        ).items())),
        "duplicates_suppressed": sum(
            row["duplicates_suppressed"] for row in accounting.values()
        ),
        "records_published": len(result_events),
    }
    source_health_gate = evaluate_source_health(sources, yields)
    return {
        "stream": "deterministic-structured-events",
        "generated_at": now.isoformat(timespec="seconds"),
        "scope": "priority-plus-rotating-deterministic-non-protest",
        "selected_source_ids": [str(source.get("id") or "") for source in sources],
        "events": result_events,
        "source_yields": yields,
        "source_health_gate": source_health_gate,
        "coverage_accounting": coverage_accounting,
        "summary": {
            "sources": len(sources),
            "events": len(result_events),
            "records_parsed": coverage_accounting["records_parsed"],
            "qualification_rejected": coverage_accounting["qualification_rejected"],
            "duplicates_suppressed": coverage_accounting["duplicates_suppressed"],
            "source_failures": sum(
                row.get("status") in {
                    "partial-failure", "fetch-error", "blocked", "parse-empty-regression"
                }
                for row in yields
            ),
            "source_health_gate": source_health_gate["status"],
            "authoritative_primary_sources": source_health_gate[
                "authoritative_primary_sources"
            ],
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sources", type=Path, default=SOURCES_PATH)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--source", action="append")
    parser.add_argument("--max-pages", type=int, default=8)
    parser.add_argument("--max-depth", type=int, default=3)
    parser.add_argument("--max-elapsed-seconds", type=float, default=75)
    parser.add_argument("--max-workers", type=int, default=6)
    parser.add_argument("--http-cache", type=Path, default=HTTP_CACHE_PATH)
    parser.add_argument(
        "--run-date",
        type=date.fromisoformat,
        help="UTC run date used for the stable deterministic shard (YYYY-MM-DD)",
    )
    parser.add_argument(
        "--shard-count",
        type=int,
        default=DEFAULT_DETERMINISTIC_SHARD_COUNT,
    )
    args = parser.parse_args()
    run_date = args.run_date or datetime.now(timezone.utc).date()
    sources = load_scheduled_sources(
        args.sources,
        run_date=run_date,
        shard_count=args.shard_count,
    )
    if args.source:
        wanted = set(args.source)
        sources = [source for source in sources if source.get("id") in wanted]
    parsed_cache = ParsedResponseCache(args.http_cache)
    payload = run(
        sources,
        max_pages=args.max_pages,
        max_depth=args.max_depth,
        max_elapsed_seconds=args.max_elapsed_seconds,
        max_workers=args.max_workers,
        parsed_cache=parsed_cache,
    )
    priority_count = sum(
        int(source.get("tier_priority") or 99) == 1
        for source in sources
    )
    payload["selection"] = {
        "run_date": run_date.isoformat(),
        "shard": scheduled_shard(run_date, args.shard_count),
        "shard_count": args.shard_count,
        "priority_sources": priority_count,
        "rotating_sources": len(sources) - priority_count,
    }
    # Preserve complete diagnostics before failing closed so the workflow can
    # upload evidence without ever publishing a false-green crawl.
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    parsed_cache.save()
    print(json.dumps(payload["summary"], sort_keys=True))
    gate = payload["source_health_gate"]
    if gate["status"] != "passed":
        print(
            "STRUCTURED HARVEST SOURCE-HEALTH GATE FAILED — "
            f"{gate['reason']}; "
            f"{gate['authoritative_primary_sources']}/"
            f"{gate['expected_primary_sources']} selected sources produced an "
            "authoritative observation. Publication was blocked.",
            file=sys.stderr,
        )
        return SOURCE_HEALTH_FAILURE_EXIT
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
