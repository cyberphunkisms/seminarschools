#!/usr/bin/env python3
"""Deterministic expiry rules for evidence that makes a current live claim."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone


def parse_utc(value: object) -> datetime:
    parsed = datetime.fromisoformat(str(value or "").replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def expiration_failures(
    generated_at: object,
    *,
    now: datetime,
    max_age_hours: float,
    enforce_current: bool,
) -> tuple[list[str], datetime | None, float | None]:
    failures: list[str] = []
    if max_age_hours <= 0:
        return ["max-age-hours must be greater than zero"], None, None
    try:
        generated = parse_utc(generated_at)
    except (TypeError, ValueError):
        return ["report generated_at is invalid"], None, None
    reference = now if now.tzinfo else now.replace(tzinfo=timezone.utc)
    reference = reference.astimezone(timezone.utc)
    age_hours = (reference - generated).total_seconds() / 3600
    expires_at = generated + timedelta(hours=max_age_hours)
    if enforce_current:
        if age_hours < -1:
            failures.append("report timestamp is in the future")
        if reference > expires_at:
            failures.append(
                f"report is stale: {age_hours:.1f}h exceeds {max_age_hours:.1f}h"
            )
    return failures, expires_at, age_hours
