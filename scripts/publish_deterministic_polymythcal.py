#!/usr/bin/env python3
"""Publish deterministic Polymythcal outputs before the optional agent stage."""
from __future__ import annotations

import json
import os
import argparse
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

from polymythcal_source_health import source_health_gate_error

ROOT = Path(__file__).resolve().parents[1]
PROTEST_PATH = Path("/tmp/polymythcal-protests.json")
STRUCTURED_PATH = Path("/tmp/polymythcal-structured.json")
AGENT_PLACEHOLDER_PATH = Path("/tmp/seminars-output.json")
MERGE_SCRIPT = ROOT / "scripts" / "merge_and_finalize.py"


class PublicationInputError(ValueError):
    """A required deterministic payload is missing or malformed."""


def _load_payload(path: Path, *, stream: str) -> dict:
    if not path.exists():
        raise PublicationInputError(f"required {stream} payload is missing: {path}")
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise PublicationInputError(
            f"required {stream} payload is unreadable: {path}: {exc}"
        ) from exc
    if not isinstance(payload, dict) or not isinstance(payload.get("events"), list):
        raise PublicationInputError(
            f"required {stream} payload must contain an events array: {path}"
        )
    if stream == "protest" and payload.get("sharded") is not False:
        raise PublicationInputError(
            f"protest payload must declare sharded=false: {path}"
        )
    gate_error = source_health_gate_error(
        payload,
        stream_label=f"deterministic {stream}",
        expected_stream={
            "protest": "deterministic-protests",
            "structured": "deterministic-structured-events",
        }[stream],
        expected_scope={
            "protest": "all-enabled-protest-sources-unsharded",
            "structured": "priority-plus-rotating-deterministic-non-protest",
        }[stream],
    )
    if gate_error:
        raise PublicationInputError(f"{gate_error}: {path}")
    return payload


def _write_agent_placeholder(path: Path) -> None:
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "events": [],
        "source_yields": [],
        "agent_stage": "not-started",
        "publication_stage": "deterministic-before-optional-agent",
    }
    path.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def publish_deterministic(
    *,
    protest_path: Path | None = PROTEST_PATH,
    structured_path: Path = STRUCTURED_PATH,
    agent_placeholder_path: Path = AGENT_PLACEHOLDER_PATH,
    merge_script: Path = MERGE_SCRIPT,
    root: Path = ROOT,
    run_command: Callable[..., object] = subprocess.run,
) -> int:
    """Validate the requested deterministic streams and run the finalizer."""
    if protest_path is not None:
        _load_payload(protest_path, stream="protest")
    _load_payload(structured_path, stream="structured")
    _write_agent_placeholder(agent_placeholder_path)
    environment = dict(os.environ)
    environment["POLYMYTHCAL_DETERMINISTIC_PROTEST_PATH"] = (
        str(protest_path) if protest_path is not None else ""
    )
    result = run_command(
        [sys.executable, str(merge_script)],
        cwd=root,
        check=False,
        env=environment,
    )
    return int(getattr(result, "returncode", 1))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--structured-only",
        action="store_true",
        help="Publish the structured stream while the dedicated protest workflow owns protest discovery.",
    )
    args = parser.parse_args()
    try:
        code = publish_deterministic(
            protest_path=None if args.structured_only else PROTEST_PATH,
        )
    except PublicationInputError as exc:
        print(f"FATAL: {exc}", file=sys.stderr)
        return 66
    if code:
        print(
            "FATAL: deterministic Polymythcal merge/publication failed "
            f"with exit code {code}.",
            file=sys.stderr,
        )
        return code
    streams = "structured" if args.structured_only else "protest and structured"
    print(
        f"DETERMINISTIC POLYMYTHCAL PUBLISHED — {streams} outputs merged "
        "before the optional agent stage."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
