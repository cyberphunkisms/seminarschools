#!/usr/bin/env python3
"""
validate_seminars.py

Standalone post-commit validator. Runs after merge_and_finalize.py to
confirm the deployed /seminars/events.json file passes schema. Idempotent.
Used as the workflow gate before the commit step.
"""

import json
import sys
from pathlib import Path

try:
    from jsonschema import Draft7Validator
except ImportError:
    print("FATAL: jsonschema not installed.", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parent.parent
EVENTS_PATH = ROOT / "seminars" / "events.json"
SCHEMA_PATH = ROOT / "data" / "seminars-schema.json"


def main():
    if not EVENTS_PATH.exists():
        print(f"FATAL: {EVENTS_PATH} missing", file=sys.stderr)
        sys.exit(1)

    data = json.loads(EVENTS_PATH.read_text(encoding="utf-8"))
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    validator = Draft7Validator(schema)

    events = data.get("events", [])
    errors = []
    for i, record in enumerate(events):
        for e in validator.iter_errors(record):
            errors.append(f"  record[{i}] ({record.get('title','?')[:40]}): {e.message}")

    if errors:
        print(f"FATAL: {len(errors)} schema errors in {EVENTS_PATH}", file=sys.stderr)
        for err in errors[:20]:
            print(err, file=sys.stderr)
        sys.exit(1)

    print(f"OK: {len(events)} events, all schema-valid")
    sys.exit(0)


if __name__ == "__main__":
    main()
