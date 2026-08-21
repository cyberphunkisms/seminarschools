#!/usr/bin/env python3
"""Atomic, fsynced JSON evidence writes in the destination directory."""
from __future__ import annotations

import json
import os
from pathlib import Path
import uuid


def write_json_atomic(path: Path, value: dict) -> None:
    path = Path(path).resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.part-{os.getpid()}-{uuid.uuid4().hex}")
    rendered = json.dumps(value, sort_keys=True, indent=2) + "\n"
    try:
        with temporary.open("w", encoding="utf-8") as handle:
            handle.write(rendered)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)
