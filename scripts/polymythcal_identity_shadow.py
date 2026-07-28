#!/usr/bin/env python3
"""Compare conservative identity behavior with a richer non-mutating matcher."""
from __future__ import annotations

import re
from datetime import datetime
from difflib import SequenceMatcher

from polymythcal_adapters import canonical_event_url


def _normal(value: str) -> str:
    return re.sub(r"\W+", " ", str(value or "").lower()).strip()


def _similarity(left: str, right: str) -> float:
    return SequenceMatcher(None, _normal(left), _normal(right)).ratio()


def _date(value: str) -> datetime | None:
    try:
        parsed = datetime.fromisoformat(str(value or "").replace("Z", "+00:00"))
        return parsed
    except (TypeError, ValueError):
        return None


def _candidate_score(existing: dict, incoming: dict) -> tuple[float, list[str]]:
    reasons = []
    score = 0.0
    left_uid = str(existing.get("external_uid") or "").strip()
    right_uid = str(incoming.get("external_uid") or "").strip()
    if left_uid and right_uid and left_uid == right_uid:
        score += 0.78
        reasons.append("shared-external-uid")

    left_url = canonical_event_url(str(existing.get("source_url") or ""))
    right_url = canonical_event_url(str(incoming.get("source_url") or ""))
    if left_url and right_url and left_url == right_url:
        score += 0.62
        reasons.append("same-canonical-url")

    if str(existing.get("source_id") or "") == str(incoming.get("source_id") or ""):
        score += 0.08
        reasons.append("same-source")

    title_similarity = _similarity(
        str(existing.get("title") or ""),
        str(incoming.get("title") or ""),
    )
    if title_similarity >= 0.88:
        score += 0.18 * title_similarity
        reasons.append(f"title-similarity-{title_similarity:.3f}")

    organizer_similarity = _similarity(
        str(existing.get("organizer") or ""),
        str(incoming.get("organizer") or ""),
    )
    if (
        existing.get("organizer")
        and incoming.get("organizer")
        and organizer_similarity >= 0.9
    ):
        score += 0.08
        reasons.append("same-organizer")

    left_date = _date(existing.get("date"))
    right_date = _date(incoming.get("date"))
    if left_date and right_date:
        try:
            shift_days = abs((right_date - left_date).total_seconds()) / 86400
        except TypeError:
            shift_days = 9999
        if shift_days <= 90:
            score += 0.04
            reasons.append(f"date-shift-{shift_days:.1f}-days")
        else:
            score -= 0.3
            reasons.append("implausible-date-shift")
    return max(0.0, min(1.0, score)), reasons


def identity_shadow_decision(
    existing_events: list[dict],
    incoming: dict,
    *,
    current_action: str,
    current_target_index: int | None,
    recurring_batch: bool,
) -> dict:
    """Return diagnostics only; never chooses the production mutation."""
    candidates = []
    for index, existing in enumerate(existing_events):
        score, reasons = _candidate_score(existing, incoming)
        if score >= 0.55:
            candidates.append(
                {
                    "index": index,
                    "id": existing.get("id"),
                    "title": existing.get("title"),
                    "date": existing.get("date"),
                    "score": round(score, 3),
                    "reasons": reasons,
                }
            )
    candidates.sort(key=lambda item: (-item["score"], str(item.get("id") or "")))
    best = candidates[0] if candidates else None
    runner_up = candidates[1] if len(candidates) > 1 else None
    unambiguous = bool(
        best
        and best["score"] >= 0.9
        and (not runner_up or best["score"] - runner_up["score"] >= 0.08)
    )
    if recurring_batch or incoming.get("recurrence_id"):
        proposed_action = "add"
        reason = "recurring-occurrences-must-remain-distinct"
        proposed_index = None
    elif unambiguous:
        proposed_index = int(best["index"])
        proposed_action = (
            "refresh"
            if str(existing_events[proposed_index].get("date") or "")
            == str(incoming.get("date") or "")
            else "reschedule"
        )
        reason = "one-high-confidence-candidate"
    else:
        proposed_action = "add"
        proposed_index = None
        reason = "no-unambiguous-high-confidence-candidate"

    return {
        "incoming_id": incoming.get("id"),
        "incoming_title": incoming.get("title"),
        "incoming_date": incoming.get("date"),
        "source_id": incoming.get("source_id"),
        "current_action": current_action,
        "current_target_id": (
            existing_events[current_target_index].get("id")
            if current_target_index is not None
            else None
        ),
        "shadow_action": proposed_action,
        "shadow_target_id": (
            existing_events[proposed_index].get("id")
            if proposed_index is not None
            else None
        ),
        "agreement": (
            current_action == proposed_action
            and current_target_index == proposed_index
        ),
        "reason": reason,
        "recurring_batch": bool(recurring_batch),
        "candidate_count": len(candidates),
        "candidates": candidates[:5],
    }
