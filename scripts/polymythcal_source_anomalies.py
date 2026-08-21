#!/usr/bin/env python3
"""Per-source anomaly rules layered around existing Polymythcal scrapers."""
from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from statistics import median
from typing import Any

AUTHORITATIVE_STATUSES = {
    "success",
    "confirmed-empty",
    "partial-failure",
    "crawled",
    "crawled-urgency-reserve",
}
FAILURE_STATUSES = {
    "blocked",
    "fetch-error",
    "parse-empty-regression",
    "unreachable",
    "budget-exhausted",
}
IGNORED_STATUSES = {
    "not-modified",
    "skipped-deterministic-success",
    "skipped-disabled",
    "skipped-shard",
}


def _count(value: Any) -> int:
    if isinstance(value, bool):
        return 0
    if isinstance(value, int) and value >= 0:
        return value
    if isinstance(value, list):
        return len(value)
    return 0


def _optional_count(value: Any) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int) and value >= 0:
        return value
    if isinstance(value, list):
        return len(value)
    return None


def _observation(row: dict[str, Any], observed_at: str) -> dict[str, Any] | None:
    status = str(row.get("status") or "")
    if not status or status in IGNORED_STATUSES or status.startswith("skipped-"):
        return None
    parsed = _optional_count(row.get("records_parsed"))
    rejected = _optional_count(row.get("qualification_rejected"))
    return {
        "observed_at": observed_at,
        "status": status,
        "events": _count(row.get("events")),
        "records_parsed": parsed,
        "pages_fetched": _optional_count(row.get("pages_fetched")),
        "rejection_rate": round(rejected / parsed, 6) if parsed and rejected is not None else None,
        "confirmed_empty": status == "confirmed-empty",
        "authoritative": status in AUTHORITATIVE_STATUSES,
    }


def _numeric_baseline(observations: list[dict[str, Any]], field: str) -> list[float]:
    return [
        float(item[field])
        for item in observations
        if item.get("authoritative") is True
        and not item.get("confirmed_empty")
        and isinstance(item.get(field), (int, float))
        and not isinstance(item.get(field), bool)
    ]


def _anomaly(
    source_id: str,
    kind: str,
    message: str,
    current: dict[str, Any],
    baseline_count: int,
) -> dict[str, Any]:
    return {
        "source_id": source_id,
        "severity": "blocking",
        "kind": kind,
        "message": message,
        "baseline_observations": baseline_count,
        "current": current,
    }


def evaluate_run(
    payload: dict[str, Any],
    history: dict[str, Any],
    *,
    stream: str,
    observed_at: str | None = None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Evaluate every attempted source independently and return candidate history."""
    observed_at = observed_at or str(payload.get("generated_at") or "")
    if not observed_at:
        observed_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    policy = history.get("policy") or {}
    minimum = int(policy.get("minimum_baseline_observations") or 3)
    limit = int(policy.get("history_limit_per_source") or 12)
    collapse_ratio = float(policy.get("collapse_ratio") or 0.2)
    spike_ratio = float(policy.get("spike_ratio") or 5.0)
    minimum_collapse = float(policy.get("minimum_collapse_baseline") or 5)
    minimum_spike = float(policy.get("minimum_spike_value") or 20)
    stream_history = ((history.get("streams") or {}).get(stream) or {})
    rows = payload.get("source_yields")
    if not isinstance(rows, list):
        rows = []

    anomalies: list[dict[str, Any]] = []
    current_by_source: dict[str, dict[str, Any]] = {}
    duplicates: set[str] = set()
    ignored = 0
    for row in rows:
        if not isinstance(row, dict) or row.get("role") == "corroboration":
            continue
        source_id = str(row.get("source_id") or "")
        if not source_id:
            continue
        observation = _observation(row, observed_at)
        if observation is None:
            ignored += 1
            continue
        if source_id in current_by_source:
            duplicates.add(source_id)
        current_by_source[source_id] = observation

    for source_id in sorted(duplicates):
        anomalies.append(_anomaly(source_id, "duplicate-source-row", "source appeared more than once in the current run", current_by_source[source_id], 0))

    for source_id, current in sorted(current_by_source.items()):
        prior = list(stream_history.get(source_id) or [])
        authoritative_prior = [item for item in prior if item.get("authoritative") is True]
        if len(authoritative_prior) < minimum:
            continue
        if current["status"] in FAILURE_STATUSES:
            anomalies.append(_anomaly(source_id, "status-regression", f"status regressed from an authoritative baseline to {current['status']}", current, len(authoritative_prior)))
            continue
        if current.get("confirmed_empty"):
            # An explicit, source-supported empty observation is valid, not a yield collapse.
            continue
        for field in ("events", "records_parsed"):
            collapse_kind = {"events": "events-collapse", "records_parsed": "records-parsed-collapse"}[field]
            spike_kind = {"events": "events-spike", "records_parsed": "records-parsed-spike"}[field]
            values = _numeric_baseline(authoritative_prior, field)
            if len(values) < minimum or not isinstance(current.get(field), (int, float)):
                continue
            typical = median(values)
            actual = float(current[field])
            if typical >= minimum_collapse and actual <= typical * collapse_ratio:
                anomalies.append(_anomaly(source_id, collapse_kind, f"{field} fell to {actual:g} from a per-source median of {typical:g}", current, len(values)))
            if actual >= minimum_spike and actual >= max(minimum_spike, typical * spike_ratio):
                anomalies.append(_anomaly(source_id, spike_kind, f"{field} rose to {actual:g} from a per-source median of {typical:g}", current, len(values)))
        page_values = _numeric_baseline(authoritative_prior, "pages_fetched")
        if len(page_values) >= minimum and isinstance(current.get("pages_fetched"), (int, float)):
            typical_pages = median(page_values)
            actual_pages = float(current["pages_fetched"])
            if actual_pages >= minimum_spike and actual_pages >= max(minimum_spike, typical_pages * spike_ratio):
                anomalies.append(_anomaly(source_id, "pages-fetched-spike", f"pages fetched rose to {actual_pages:g} from a per-source median of {typical_pages:g}", current, len(page_values)))
        rejection_values = _numeric_baseline(authoritative_prior, "rejection_rate")
        if len(rejection_values) >= minimum and current.get("rejection_rate") is not None:
            typical_rejection = median(rejection_values)
            if current["records_parsed"] >= 10 and current["rejection_rate"] >= 0.9 and typical_rejection <= 0.5:
                anomalies.append(_anomaly(source_id, "rejection-rate-spike", f"qualification rejection rate rose to {current['rejection_rate']:.1%} from a per-source median of {typical_rejection:.1%}", current, len(rejection_values)))

    candidate = deepcopy(history)
    candidate.setdefault("streams", {})
    candidate["streams"].setdefault(stream, {})
    for source_id, observation in sorted(current_by_source.items()):
        observations = list(candidate["streams"][stream].get(source_id) or [])
        observations = [item for item in observations if item.get("observed_at") != observed_at]
        observations.append(observation)
        candidate["streams"][stream][source_id] = observations[-limit:]

    report = {
        "schema": "polymythcal-source-anomaly-report-v1",
        "contract_id": "FP-10",
        "stream": stream,
        "observed_at": observed_at,
        "sources_reported": len(rows),
        "sources_observed": len(current_by_source),
        "sources_ignored_not_attempted": ignored,
        "minimum_baseline_observations": minimum,
        "warmup_sources": sum(1 for source_id in current_by_source if len([item for item in stream_history.get(source_id, []) if item.get("authoritative") is True]) < minimum),
        "blocking_anomalies": anomalies,
        "status": "blocked" if anomalies else "passed",
    }
    return report, candidate
