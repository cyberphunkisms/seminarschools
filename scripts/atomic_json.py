#!/usr/bin/env python3
"""Atomic, fsynced JSON evidence writes in the destination directory."""
from __future__ import annotations

import json
import os
import time
from pathlib import Path
import uuid


def write_json_atomic(path: Path, value: dict) -> None:
    write_text_atomic(path, json.dumps(value, sort_keys=True, indent=2) + "\n")


def write_text_atomic(path: Path, rendered: str) -> None:
    """Replace complete text while leaving the old file intact on failure."""
    path = Path(path).resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    prior_mtime = path.stat().st_mtime if path.exists() else 0
    temporary = path.with_name(f".{path.name}.part-{os.getpid()}-{uuid.uuid4().hex}")
    try:
        with temporary.open("w", encoding="utf-8") as handle:
            handle.write(rendered)
            handle.flush()
            os.fsync(handle.fileno())
        if prior_mtime > time.time() + 60:
            os.utime(temporary, (prior_mtime + 2, prior_mtime + 2))
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)
