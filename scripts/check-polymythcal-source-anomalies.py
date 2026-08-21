#!/usr/bin/env python3
"""Check a harvest payload for mature per-source anomalies before publication."""
from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
from pathlib import Path

from polymythcal_source_anomalies import evaluate_run

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_HISTORY = ROOT / "data" / "harvest-source-history.json"
ANOMALY_EXIT = 68


def load_object(path: Path, label: str) -> dict:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"{label} could not be read: {exc}") from exc
    if not isinstance(payload, dict):
        raise ValueError(f"{label} must be a JSON object")
    return payload


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, prefix=f".{path.name}.", suffix=".tmp", delete=False) as handle:
            json.dump(payload, handle, indent=2, ensure_ascii=False)
            handle.write("\n")
            temporary = Path(handle.name)
        os.replace(temporary, path)
    finally:
        if temporary and temporary.exists():
            temporary.unlink()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--stream", required=True)
    parser.add_argument("--current", type=Path, required=True)
    parser.add_argument("--history", type=Path, default=DEFAULT_HISTORY)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--strict", action="store_true")
    parser.add_argument("--write-history", action="store_true")
    args = parser.parse_args()
    try:
        payload = load_object(args.current, "current harvest")
        history = load_object(args.history, "source history")
        if history.get("schema") != "polymythcal-source-anomaly-history-v1" or history.get("contract_id") != "FP-10":
            raise ValueError("source history identity does not satisfy FP-10")
        report, candidate = evaluate_run(payload, history, stream=args.stream)
        write_json(args.report, report)
        if args.write_history and report["status"] == "passed":
            write_json(args.history, candidate)
    except ValueError as exc:
        print(f"FP-10 SOURCE ANOMALY CHECK FAILED — {exc}", file=sys.stderr)
        return 2
    anomalies = report["blocking_anomalies"]
    if anomalies:
        print(f"FP-10 SOURCE ANOMALY CHECK BLOCKED — {len(anomalies)} anomaly/anomalies in {args.stream}.", file=sys.stderr)
        for anomaly in anomalies:
            print(f" - {anomaly['source_id']}: {anomaly['message']}", file=sys.stderr)
        return ANOMALY_EXIT if args.strict else 0
    print(f"FP-10 SOURCE ANOMALY CHECK PASSED — {report['sources_observed']} attempted source(s), {report['warmup_sources']} still warming up, no mature per-source anomalies.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
