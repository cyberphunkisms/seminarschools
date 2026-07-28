#!/usr/bin/env python3
"""Validate the Polymythcal source roster and its active-source contract."""
from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path

from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ROSTER = ROOT / "scripts" / "sources.json"
DEFAULT_SCHEMA = ROOT / "data" / "polymythcal-source-schema.json"


def validation_errors(
    payload: dict,
    schema_path: Path = DEFAULT_SCHEMA,
) -> list[str]:
    schema = json.loads(schema_path.read_text(encoding="utf-8"))
    validator = Draft202012Validator(schema)
    errors = []
    for error in sorted(validator.iter_errors(payload), key=lambda row: list(row.path)):
        location = ".".join(str(part) for part in error.absolute_path) or "$"
        errors.append(f"{location}: {error.message}")

    ids = [
        str(source.get("id") or "").strip()
        for source in payload.get("sources", [])
        if isinstance(source, dict)
    ]
    for source_id, count in sorted(Counter(ids).items()):
        if source_id and count > 1:
            errors.append(f"sources: duplicate id {source_id!r} appears {count} times")
    return errors


def load_validated_roster(
    roster_path: Path = DEFAULT_ROSTER,
    schema_path: Path = DEFAULT_SCHEMA,
) -> dict:
    payload = json.loads(roster_path.read_text(encoding="utf-8"))
    errors = validation_errors(payload, schema_path)
    if errors:
        preview = "\n".join(f"- {error}" for error in errors[:20])
        remaining = len(errors) - 20
        suffix = f"\n- …and {remaining} more" if remaining > 0 else ""
        raise ValueError(f"Invalid Polymythcal source roster:\n{preview}{suffix}")
    return payload


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--roster", type=Path, default=DEFAULT_ROSTER)
    parser.add_argument("--schema", type=Path, default=DEFAULT_SCHEMA)
    args = parser.parse_args()
    payload = json.loads(args.roster.read_text(encoding="utf-8"))
    errors = validation_errors(payload, args.schema)
    if errors:
        for error in errors:
            print(error)
        return 1
    active = sum(source.get("enabled") is not False for source in payload["sources"])
    disabled = len(payload["sources"]) - active
    print(
        json.dumps(
            {
                "sources": len(payload["sources"]),
                "active": active,
                "disabled": disabled,
            },
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
