#!/usr/bin/env python3
"""Read-only live endpoint evidence for the three weekly Polymythcal harvests.

The probe performs one bounded GET per unique configured seed URL. It never
publishes events, writes candidate state, invokes a paid agent, or changes a
workflow schedule. Multiple source bindings to the same URL share one live
request so current-endpoint validation does not create needless traffic.
"""
from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import re
import threading
import time
import urllib.parse
from collections import Counter
from dataclasses import asdict, dataclass
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

import requests

from harvest_protests import load_protest_sources
from harvest_structured_events import load_scheduled_sources
from polymythcal_discovery import (
    configured_seed_urls,
    looks_like_challenge_page,
    looks_like_empty_app_shell,
)

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "scripts" / "reports" / "audit48-live-harvest-endpoints.json"
FESTIVAL_ROSTER = ROOT / "scripts" / "festivals-sources.json"
SEMINAR_ROSTER = ROOT / "scripts" / "sources.json"
USER_AGENT = (
    "Mozilla/5.0 (compatible; PolymythcalEndpointAudit/1.0; "
    "+https://seminarschools.com/polymythseminars/)"
)
EXPECTED_CADENCE = {
    "seminars": (".github/workflows/scrape-seminars.yml", "47 8 * * 1"),
    "festivals": (".github/workflows/scrape-festivals.yml", "42 9 * * 2"),
    "protests": (
        ".github/workflows/scrape-polymythcal-protests.yml",
        "18 8 * * 3",
    ),
}
SUPPORTED_CONTENT_HINTS = (
    "text/html",
    "application/xhtml+xml",
    "application/json",
    "application/ld+json",
    "application/xml",
    "text/xml",
    "application/rss+xml",
    "application/atom+xml",
    "text/calendar",
    "application/ics",
)


@dataclass
class EndpointResult:
    url: str
    status: str
    failure_class: str
    usable_by_http_harvester: bool
    browser_required: bool
    http_status: int | None = None
    final_url: str = ""
    redirected: bool = False
    content_type: str = ""
    content_length_header: int | None = None
    sampled_bytes: int = 0
    sample_sha256: str = ""
    body_truncated: bool = False
    elapsed_ms: int = 0
    error: str = ""


def _bounded_error(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()[:500]


def classify_request_exception(exc: requests.RequestException) -> str:
    if isinstance(exc, requests.exceptions.SSLError):
        return "tls-error"
    if isinstance(exc, requests.exceptions.Timeout):
        return "timeout"
    if isinstance(exc, requests.exceptions.TooManyRedirects):
        return "redirect-loop"
    if isinstance(exc, requests.exceptions.ConnectionError):
        message = str(exc)
        if re.search(
            r"name or service not known|name resolution|"
            r"temporary failure in name resolution|getaddrinfo failed|"
            r"nodename nor servname",
            message,
            re.I,
        ):
            return "dns-resolution"
        return "connection-error"
    return "request-error"


def classify_http_failure(status_code: int) -> str:
    return {
        401: "http-authentication",
        403: "http-forbidden",
        407: "http-proxy-authentication",
        429: "http-rate-limited",
        451: "http-legal-restriction",
        503: "http-service-unavailable",
    }.get(
        status_code,
        (
            "http-client-error"
            if 400 <= status_code < 500
            else "http-server-error"
            if 500 <= status_code < 600
            else "http-unexpected-status"
        ),
    )


def _content_length(value: str) -> int | None:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return None
    return parsed if parsed >= 0 else None


def _probe_url(
    url: str,
    *,
    connect_timeout: float,
    read_timeout: float,
    max_bytes: int,
    host_locks: dict[str, threading.Semaphore],
) -> EndpointResult:
    started = time.monotonic()
    host = (urllib.parse.urlsplit(url).hostname or "").lower()
    semaphore = host_locks[host]
    try:
        with semaphore:
            with requests.get(
                url,
                headers={
                    "User-Agent": USER_AGENT,
                    "Accept": (
                        "text/html,application/xhtml+xml,application/ld+json,"
                        "application/json,text/calendar,application/rss+xml,"
                        "application/atom+xml,application/xml;q=0.9,*/*;q=0.7"
                    ),
                    "Accept-Language": "en-CA,en;q=0.9,fr-CA;q=0.7",
                    "Cache-Control": "no-cache",
                },
                timeout=(connect_timeout, read_timeout),
                allow_redirects=True,
                stream=True,
            ) as response:
                content_type = (
                    response.headers.get("content-type", "")
                    .split(";", 1)[0]
                    .strip()
                    .lower()
                )
                body = bytearray()
                truncated = False
                for chunk in response.iter_content(chunk_size=32 * 1024):
                    if not chunk:
                        continue
                    remaining = max_bytes - len(body)
                    if remaining <= 0:
                        truncated = True
                        break
                    body.extend(chunk[:remaining])
                    if len(chunk) > remaining or len(body) >= max_bytes:
                        truncated = True
                        break
                final_url = str(response.url or url)
                common = {
                    "url": url,
                    "http_status": response.status_code,
                    "final_url": final_url,
                    "redirected": final_url != url,
                    "content_type": content_type,
                    "content_length_header": _content_length(
                        response.headers.get("content-length", "")
                    ),
                    "sampled_bytes": len(body),
                    "sample_sha256": hashlib.sha256(body).hexdigest(),
                    "body_truncated": truncated,
                    "elapsed_ms": round((time.monotonic() - started) * 1000),
                }
                if response.status_code < 200 or response.status_code >= 400:
                    failure = classify_http_failure(response.status_code)
                    return EndpointResult(
                        status=(
                            "blocked"
                            if response.status_code
                            in {401, 403, 407, 429, 451, 503}
                            else "http-error"
                        ),
                        failure_class=failure,
                        usable_by_http_harvester=False,
                        browser_required=False,
                        error=f"HTTP {response.status_code}",
                        **common,
                    )

                decoded = bytes(body).decode(
                    response.encoding or "utf-8", errors="replace"
                )
                if looks_like_challenge_page(decoded):
                    return EndpointResult(
                        status="blocked",
                        failure_class="challenge-page",
                        usable_by_http_harvester=False,
                        browser_required=True,
                        error="challenge page detected",
                        **common,
                    )
                if looks_like_empty_app_shell(decoded):
                    return EndpointResult(
                        status="browser-required",
                        failure_class="client-rendered-shell",
                        usable_by_http_harvester=False,
                        browser_required=True,
                        error="empty client-rendered application shell",
                        **common,
                    )
                if not body and response.status_code != 204:
                    return EndpointResult(
                        status="unproven-empty",
                        failure_class="blank-response",
                        usable_by_http_harvester=False,
                        browser_required=False,
                        error="successful response contained no sampled body",
                        **common,
                    )
                unsupported = (
                    bool(content_type)
                    and not any(
                        hint in content_type for hint in SUPPORTED_CONTENT_HINTS
                    )
                )
                if unsupported:
                    return EndpointResult(
                        status="unexpected-media",
                        failure_class="unsupported-content-type",
                        usable_by_http_harvester=False,
                        browser_required=False,
                        error=f"unsupported content type {content_type}",
                        **common,
                    )
                return EndpointResult(
                    status="reachable",
                    failure_class="",
                    usable_by_http_harvester=True,
                    browser_required=False,
                    **common,
                )
    except requests.RequestException as exc:
        return EndpointResult(
            url=url,
            status="transport-error",
            failure_class=classify_request_exception(exc),
            usable_by_http_harvester=False,
            browser_required=False,
            elapsed_ms=round((time.monotonic() - started) * 1000),
            error=_bounded_error(exc),
        )


def _workflow_cadence() -> dict[str, dict[str, Any]]:
    evidence = {}
    for stream, (relative, expected) in EXPECTED_CADENCE.items():
        source = (ROOT / relative).read_text(encoding="utf-8")
        schedules = re.findall(r"\bcron:\s*[\"']([^\"']+)[\"']", source)
        evidence[stream] = {
            "workflow": relative,
            "expected": expected,
            "observed": schedules,
            "exactly_once_weekly": schedules == [expected],
        }
    return evidence


def _source_bindings(run_date: date) -> tuple[list[dict[str, Any]], dict]:
    bindings: list[dict[str, Any]] = []
    seminars = load_scheduled_sources(SEMINAR_ROSTER, run_date=run_date)
    priority_count = sum(
        int(source.get("tier_priority") or 99) == 1 for source in seminars
    )
    for source in seminars:
        bindings.append(
            {
                "stream": "seminars",
                "role": (
                    "every-run-priority"
                    if int(source.get("tier_priority") or 99) == 1
                    else "scheduled-rotating"
                ),
                "source": source,
            }
        )

    protests, corroboration, _ = load_protest_sources()
    for source in protests:
        bindings.append(
            {"stream": "protests", "role": "primary", "source": source}
        )
    for source in corroboration:
        bindings.append(
            {
                "stream": "protests",
                "role": "corroboration",
                "source": source,
            }
        )

    festival_payload = json.loads(FESTIVAL_ROSTER.read_text(encoding="utf-8"))
    discovery = festival_payload.get("discovery_aggregators") or []
    primary = festival_payload.get("primary_sources") or []
    for source in discovery:
        bindings.append(
            {
                "stream": "festivals",
                "role": "discovery",
                "source": source,
            }
        )
    for source in primary:
        bindings.append(
            {"stream": "festivals", "role": "primary", "source": source}
        )

    selection = {
        "run_date": run_date.isoformat(),
        "seminars": {
            "selected_sources": len(seminars),
            "priority_sources": priority_count,
            "rotating_sources": len(seminars) - priority_count,
        },
        "protests": {
            "primary_sources": len(protests),
            "corroboration_sources": len(corroboration),
        },
        "festivals": {
            "discovery_sources": len(discovery),
            "primary_sources": len(primary),
        },
    }
    return bindings, selection


def build_probe_plan(run_date: date) -> tuple[list[dict[str, Any]], dict]:
    bindings, selection = _source_bindings(run_date)
    rows = []
    seen_keys = set()
    for binding in bindings:
        source = binding["source"]
        source_id = str(source.get("id") or "").strip()
        key = (binding["stream"], binding["role"], source_id)
        if not source_id or key in seen_keys:
            raise ValueError(f"missing or duplicate source binding: {key}")
        seen_keys.add(key)
        endpoints = [item.url for item in configured_seed_urls(source)]
        endpoints = list(dict.fromkeys(endpoints))
        if not endpoints:
            raise ValueError(
                f"{binding['stream']} source {source_id!r} has no HTTP endpoint"
            )
        rows.append(
            {
                "stream": binding["stream"],
                "role": binding["role"],
                "source_id": source_id,
                "source_name": str(source.get("name") or source_id),
                "configured_render_mode": str(
                    source.get("render_mode") or "unspecified"
                ),
                "endpoint_urls": endpoints,
            }
        )
    return rows, selection


def run_probe(
    *,
    run_date: date,
    connect_timeout: float,
    read_timeout: float,
    max_bytes: int,
    max_workers: int,
) -> dict[str, Any]:
    started_at = datetime.now(timezone.utc)
    sources, selection = build_probe_plan(run_date)
    urls = sorted(
        {
            url
            for source in sources
            for url in source["endpoint_urls"]
        }
    )
    # Create the host guards before workers start. A lazily populated mapping
    # can manufacture more than one semaphore for the same host when several
    # worker threads reach a new host at once, defeating the per-host bound.
    host_locks: dict[str, threading.Semaphore] = {
        (urllib.parse.urlsplit(url).hostname or "").lower():
        threading.Semaphore(2)
        for url in urls
    }
    results: dict[str, EndpointResult] = {}
    with concurrent.futures.ThreadPoolExecutor(
        max_workers=max(1, max_workers)
    ) as pool:
        future_by_url = {
            url: pool.submit(
                _probe_url,
                url,
                connect_timeout=connect_timeout,
                read_timeout=read_timeout,
                max_bytes=max_bytes,
                host_locks=host_locks,
            )
            for url in urls
        }
        for url, future in future_by_url.items():
            try:
                results[url] = future.result()
            except Exception as exc:  # defensive evidence, never a false green
                results[url] = EndpointResult(
                    url=url,
                    status="probe-error",
                    failure_class="probe-worker-exception",
                    usable_by_http_harvester=False,
                    browser_required=False,
                    error=_bounded_error(exc),
                )

    source_rows = []
    for source in sources:
        endpoint_rows = [asdict(results[url]) for url in source["endpoint_urls"]]
        usable = sum(
            bool(row["usable_by_http_harvester"]) for row in endpoint_rows
        )
        browser = sum(bool(row["browser_required"]) for row in endpoint_rows)
        if usable:
            source_status = "http-usable"
        elif browser:
            source_status = "browser-required"
        else:
            source_status = "unreachable-or-unsupported"
        source_rows.append(
            {
                **source,
                "source_status": source_status,
                "usable_endpoints": usable,
                "browser_required_endpoints": browser,
                "endpoints": endpoint_rows,
            }
        )

    endpoint_statuses = Counter(
        result.status for result in results.values()
    )
    failure_classes = Counter(
        result.failure_class
        for result in results.values()
        if result.failure_class
    )
    source_statuses = Counter(row["source_status"] for row in source_rows)
    streams = {}
    for stream in ("seminars", "protests", "festivals"):
        stream_rows = [row for row in source_rows if row["stream"] == stream]
        streams[stream] = {
            "sources": len(stream_rows),
            "http_usable_sources": sum(
                row["source_status"] == "http-usable" for row in stream_rows
            ),
            "browser_required_sources": sum(
                row["source_status"] == "browser-required"
                for row in stream_rows
            ),
            "unreachable_or_unsupported_sources": sum(
                row["source_status"] == "unreachable-or-unsupported"
                for row in stream_rows
            ),
        }
    cadence = _workflow_cadence()
    finished_at = datetime.now(timezone.utc)
    return {
        "schema": "audit48-polymythcal-live-endpoints-v1",
        "generated_at": finished_at.isoformat(timespec="seconds"),
        "scope": (
            "read-only-current-endpoints-for-next-weekly-seminar-selection-"
            "plus-all-weekly-protest-and-festival-sources"
        ),
        "publication_attempted": False,
        "external_mutation_attempted": False,
        "paid_agent_invoked": False,
        "cadence_changed": False,
        "selection": selection,
        "cadence": cadence,
        "limits": {
            "connect_timeout_seconds": connect_timeout,
            "read_timeout_seconds": read_timeout,
            "maximum_sampled_bytes_per_unique_url": max_bytes,
            "maximum_workers": max_workers,
            "maximum_concurrent_requests_per_host": 2,
        },
        "summary": {
            "status": (
                "complete"
                if all(
                    row["exactly_once_weekly"] for row in cadence.values()
                )
                else "cadence-contract-failed"
            ),
            "source_bindings_checked": len(source_rows),
            "endpoint_bindings_checked": sum(
                len(row["endpoint_urls"]) for row in source_rows
            ),
            "unique_live_requests": len(results),
            "unique_hosts": len(
                {
                    (urllib.parse.urlsplit(url).hostname or "").lower()
                    for url in results
                }
            ),
            "source_statuses": dict(sorted(source_statuses.items())),
            "endpoint_statuses": dict(sorted(endpoint_statuses.items())),
            "failure_classes": dict(sorted(failure_classes.items())),
            "streams": streams,
            "elapsed_seconds": round(
                (finished_at - started_at).total_seconds(), 3
            ),
        },
        "sources": source_rows,
    }


def _write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    temporary.replace(path)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--run-date",
        type=date.fromisoformat,
        default=datetime.now(timezone.utc).date(),
        help="UTC date used for the stable next seminar selection",
    )
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--connect-timeout", type=float, default=8)
    parser.add_argument("--read-timeout", type=float, default=15)
    parser.add_argument("--max-bytes", type=int, default=256 * 1024)
    parser.add_argument("--max-workers", type=int, default=8)
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Return nonzero when any source lacks an HTTP-usable endpoint",
    )
    args = parser.parse_args()
    if min(
        args.connect_timeout,
        args.read_timeout,
        args.max_bytes,
        args.max_workers,
    ) <= 0:
        parser.error("timeouts, byte limit, and worker count must be positive")
    payload = run_probe(
        run_date=args.run_date,
        connect_timeout=args.connect_timeout,
        read_timeout=args.read_timeout,
        max_bytes=args.max_bytes,
        max_workers=args.max_workers,
    )
    _write_json(args.output, payload)
    print(json.dumps(payload["summary"], sort_keys=True))
    unreachable = payload["summary"]["source_statuses"].get(
        "unreachable-or-unsupported", 0
    )
    if payload["summary"]["status"] != "complete":
        return 2
    if args.strict and unreachable:
        return 3
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
