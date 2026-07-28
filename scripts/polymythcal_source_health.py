#!/usr/bin/env python3
"""Shared fail-closed source-health rules for deterministic Polymythcal crawls."""
from __future__ import annotations

from collections import Counter
from math import ceil

SOURCE_HEALTH_FAILURE_EXIT = 69
MINIMUM_AUTHORITATIVE_RATIO = 0.25
MINIMUM_CRITICAL_AUTHORITATIVE_RATIO = 0.10

AUTHORITATIVE_SOURCE_STATUSES = {
    "success",
    "confirmed-empty",
}
# A bare HTTP 304 proves only that the remote representation did not change.
# Until a retained, validated parsed observation is bound to that validator,
# ``not-modified`` cannot prove that this run observed usable event data.
SYSTEMIC_FAILURE_STATUSES = {
    "blocked",
    "fetch-error",
    "parse-empty-regression",
}


def _partial_result_is_authoritative(row: dict) -> bool:
    """A partial crawl is usable only when event or explicit-empty evidence survived."""
    if int(row.get("events") or 0) > 0:
        return True
    return any(
        bool(item.get("empty_evidence"))
        for item in row.get("http_statuses", [])
        if isinstance(item, dict)
    )


def evaluate_source_health(sources: list[dict], source_yields: list[dict]) -> dict:
    """Prove that a configured crawl retained broad, trustworthy coverage.

    A zero-event run is valid when a source explicitly reports
    ``confirmed-empty``. Missing source rows and all-source
    blocked/fetch/parse failures are systemic failures, not empty calendars.
    The ``primary`` field names are retained because existing protest
    diagnostics already expose this schema; for a structured run they refer
    to every source selected for that run.
    """
    expected_ids = [
        str(source.get("id") or "")
        for source in sources
        if str(source.get("id") or "")
    ]
    configured_duplicate_ids = sorted(
        source_id
        for source_id, count in Counter(expected_ids).items()
        if count > 1
    )
    expected_set = set(expected_ids)
    critical_ids = {
        str(source.get("id") or "")
        for source in sources
        if str(source.get("id") or "")
        and (
            source.get("source_health_required") is True
            or str(source.get("tier_priority") or "") == "1"
        )
    }
    rows_by_id: dict[str, list[dict]] = {source_id: [] for source_id in expected_ids}
    for row in source_yields:
        source_id = str(row.get("source_id") or "")
        if source_id in expected_set and row.get("role") != "corroboration":
            rows_by_id[source_id].append(row)

    missing_ids = sorted(
        source_id for source_id, rows in rows_by_id.items() if not rows
    )
    duplicate_ids = sorted(
        source_id for source_id, rows in rows_by_id.items() if len(rows) > 1
    )
    authoritative_ids: list[str] = []
    systemic_failure_ids: list[str] = []
    non_authoritative_ids: list[str] = []
    for source_id, rows in rows_by_id.items():
        if len(rows) != 1:
            continue
        row = rows[0]
        status = str(row.get("status") or "")
        authoritative = (
            status in AUTHORITATIVE_SOURCE_STATUSES
            or (status == "partial-failure" and _partial_result_is_authoritative(row))
        )
        if authoritative:
            authoritative_ids.append(source_id)
        else:
            non_authoritative_ids.append(source_id)
            if status in SYSTEMIC_FAILURE_STATUSES or status == "partial-failure":
                systemic_failure_ids.append(source_id)
    minimum_authoritative = (
        min(len(expected_ids), max(1, ceil(len(expected_ids) * MINIMUM_AUTHORITATIVE_RATIO)))
        if expected_ids
        else 0
    )
    authoritative_critical_ids = sorted(critical_ids.intersection(authoritative_ids))
    minimum_critical_authoritative = (
        min(
            len(critical_ids),
            max(1, ceil(len(critical_ids) * MINIMUM_CRITICAL_AUTHORITATIVE_RATIO)),
        )
        if critical_ids
        else 0
    )

    if not expected_ids:
        status = "failed"
        reason = "no-primary-sources-configured"
    elif configured_duplicate_ids or missing_ids or duplicate_ids:
        status = "failed"
        reason = "incomplete-primary-source-coverage"
    elif not authoritative_ids:
        status = "failed"
        reason = "no-authoritative-primary-source-observation"
    elif len(authoritative_ids) < minimum_authoritative:
        status = "failed"
        reason = "insufficient-authoritative-primary-source-coverage"
    elif len(authoritative_critical_ids) < minimum_critical_authoritative:
        status = "failed"
        reason = "insufficient-critical-source-coverage"
    else:
        status = "passed"
        reason = "authoritative-primary-source-observation"

    return {
        "status": status,
        "reason": reason,
        "expected_primary_sources": len(expected_ids),
        "reported_primary_sources": sum(
            len(rows) == 1 for rows in rows_by_id.values()
        ),
        "authoritative_primary_sources": len(authoritative_ids),
        "minimum_authoritative_primary_sources": minimum_authoritative,
        "minimum_authoritative_ratio": MINIMUM_AUTHORITATIVE_RATIO,
        "authoritative_source_ids": sorted(authoritative_ids),
        "critical_source_ids": sorted(critical_ids),
        "authoritative_critical_source_ids": authoritative_critical_ids,
        "minimum_authoritative_critical_sources": minimum_critical_authoritative,
        "minimum_critical_authoritative_ratio": MINIMUM_CRITICAL_AUTHORITATIVE_RATIO,
        "non_authoritative_source_ids": sorted(non_authoritative_ids),
        "systemic_failure_source_ids": sorted(systemic_failure_ids),
        "missing_source_ids": missing_ids,
        "duplicate_source_ids": duplicate_ids,
        "duplicate_configured_source_ids": configured_duplicate_ids,
    }


def source_health_gate_error(
    payload: dict,
    *,
    stream_label: str,
    expected_stream: str | None = None,
    expected_scope: str | None = None,
) -> str:
    """Return a refusal reason unless a saved gate matches its source-yield rows."""
    gate = payload.get("source_health_gate")
    if not isinstance(gate, dict):
        return f"{stream_label} harvest has no source-health gate result"
    if gate.get("status") != "passed":
        return (
            f"{stream_label} source-health gate did not pass"
            f" ({gate.get('reason') or 'unknown reason'})"
        )

    expected = gate.get("expected_primary_sources")
    reported = gate.get("reported_primary_sources")
    authoritative = gate.get("authoritative_primary_sources")
    minimum_authoritative = gate.get("minimum_authoritative_primary_sources")
    if not isinstance(expected, int) or expected < 1:
        return "source-health gate has no configured primary sources"
    if reported != expected:
        return "source-health gate did not report every configured primary source"
    if not isinstance(authoritative, int) or authoritative < 1:
        return "source-health gate has no authoritative primary-source observation"
    if (
        not isinstance(minimum_authoritative, int)
        or minimum_authoritative < 1
        or authoritative < minimum_authoritative
    ):
        return "source-health gate does not meet its authoritative coverage quorum"

    authoritative_ids = gate.get("authoritative_source_ids")
    non_authoritative_ids = gate.get("non_authoritative_source_ids")
    if not isinstance(authoritative_ids, list) or not isinstance(
        non_authoritative_ids, list
    ):
        return "source-health gate is missing its configured source identities"
    expected_ids = [
        str(source_id)
        for source_id in authoritative_ids + non_authoritative_ids
        if str(source_id)
    ]
    if len(expected_ids) != expected or len(set(expected_ids)) != expected:
        return "source-health gate source identities do not match its expected count"
    selected_source_ids = payload.get("selected_source_ids")
    if not isinstance(selected_source_ids, list):
        return f"{stream_label} harvest has no independently saved source selection"
    normalized_selection = [str(source_id) for source_id in selected_source_ids if str(source_id)]
    if (
        len(normalized_selection) != expected
        or len(set(normalized_selection)) != expected
        or sorted(normalized_selection) != sorted(expected_ids)
    ):
        return f"{stream_label} saved source selection does not match its source-health gate"
    if any(
        gate.get(field)
        for field in (
            "missing_source_ids",
            "duplicate_source_ids",
            "duplicate_configured_source_ids",
        )
    ):
        return "source-health gate reports incomplete or duplicate source coverage"
    critical_ids = gate.get("critical_source_ids")
    authoritative_critical_ids = gate.get("authoritative_critical_source_ids")
    minimum_critical = gate.get("minimum_authoritative_critical_sources")
    if not isinstance(critical_ids, list) or not isinstance(
        authoritative_critical_ids, list
    ):
        return "source-health gate is missing its critical-source identities"
    if any(str(source_id) not in expected_ids for source_id in critical_ids):
        return "source-health gate contains an unconfigured critical source"
    if any(str(source_id) not in authoritative_ids for source_id in authoritative_critical_ids):
        return "source-health gate marks a non-authoritative source as critical-authoritative"
    if (
        not isinstance(minimum_critical, int)
        or minimum_critical < 0
        or len(authoritative_critical_ids) < minimum_critical
    ):
        return "source-health gate does not meet its critical-source coverage floor"

    source_yields = payload.get("source_yields")
    if not isinstance(source_yields, list):
        return f"{stream_label} harvest has no source-yield diagnostics"
    primary_row_ids = [
        str(row.get("source_id") or "")
        for row in source_yields
        if isinstance(row, dict) and row.get("role") != "corroboration"
    ]
    if any(not source_id for source_id in primary_row_ids):
        return f"{stream_label} source-yield diagnostics contain an unidentified source"
    unknown_source_ids = sorted(set(primary_row_ids) - set(expected_ids))
    if unknown_source_ids:
        return (
            f"{stream_label} source-yield diagnostics contain unconfigured "
            f"sources: {', '.join(unknown_source_ids)}"
        )
    recomputed = evaluate_source_health(
        [
            {
                "id": source_id,
                "source_health_required": source_id in set(map(str, critical_ids)),
            }
            for source_id in expected_ids
        ],
        source_yields,
    )
    if recomputed["status"] != "passed":
        return (
            f"{stream_label} saved source-yield diagnostics do not pass "
            f"source health ({recomputed['reason']})"
        )
    if recomputed["authoritative_source_ids"] != sorted(
        str(source_id) for source_id in authoritative_ids
    ):
        return (
            f"{stream_label} source-health gate disagrees with its "
            "authoritative source-yield diagnostics"
        )
    if recomputed["authoritative_primary_sources"] != authoritative:
        return (
            f"{stream_label} source-health gate authoritative count "
            "does not match its diagnostics"
        )
    for field in (
        "minimum_authoritative_primary_sources",
        "critical_source_ids",
        "authoritative_critical_source_ids",
        "minimum_authoritative_critical_sources",
    ):
        if recomputed[field] != gate.get(field):
            return f"{stream_label} source-health gate {field} does not match its diagnostics"
    if expected_stream is not None and payload.get("stream") != expected_stream:
        actual_stream = payload.get("stream")
        return (
            f"{stream_label} harvest declares stream "
            f"{actual_stream!r}; expected {expected_stream!r}"
        )
    if expected_scope is not None and payload.get("scope") != expected_scope:
        actual_scope = payload.get("scope")
        return (
            f"{stream_label} harvest declares scope "
            f"{actual_scope!r}; expected {expected_scope!r}"
        )
    return ""
