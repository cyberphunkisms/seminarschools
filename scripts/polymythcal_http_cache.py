#!/usr/bin/env python3
"""Persist validators only when they are bound to a parsed observation.

A bare HTTP 304 is not calendar evidence. This cache stores the ETag and/or
Last-Modified value together with the exact parser version, parsed records,
discovered URLs, explicit-empty evidence, and response body hash that produced
them. A later 304 is reusable only when that complete binding validates.
"""
from __future__ import annotations

import copy
import json
import os
import tempfile
import threading
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

PARSER_CACHE_VERSION = "polymythcal-parser-audit43-v1"
MAX_CACHE_ENTRIES = 2500


def _canonical_url(value: str) -> str:
    parsed = urlsplit(str(value or "").strip())
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return ""
    path = parsed.path or "/"
    return urlunsplit(
        (parsed.scheme.lower(), parsed.netloc.lower(), path, parsed.query, "")
    )


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class ParsedResponseCache:
    """Thread-safe versioned cache for retained parser output."""

    def __init__(
        self,
        path: Path | str,
        *,
        parser_version: str = PARSER_CACHE_VERSION,
    ):
        self.path = Path(path)
        self.parser_version = parser_version
        self._lock = threading.RLock()
        self._document = {
            "schema": "polymythcal-parsed-http-cache-v1",
            "parser_version": parser_version,
            "updated_at": None,
            "entries": {},
        }
        self._load()

    def _load(self) -> None:
        if not self.path.exists():
            return
        try:
            value = json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return
        if (
            isinstance(value, dict)
            and value.get("schema") == "polymythcal-parsed-http-cache-v1"
            and isinstance(value.get("entries"), dict)
        ):
            self._document = value

    def _entry(self, url: str) -> dict | None:
        key = _canonical_url(url)
        entry = self._document.get("entries", {}).get(key)
        if not isinstance(entry, dict):
            return None
        if entry.get("parser_version") != self.parser_version:
            return None
        if not isinstance(entry.get("parsed_records"), list):
            return None
        if not isinstance(entry.get("discovered_urls"), list):
            return None
        if not str(entry.get("body_hash") or ""):
            return None
        if not (entry.get("etag") or entry.get("last_modified")):
            return None
        return entry

    def conditional_headers(self, url: str) -> dict[str, str]:
        with self._lock:
            entry = self._entry(url)
            if not entry:
                return {}
            headers = {}
            if entry.get("etag"):
                headers["If-None-Match"] = str(entry["etag"])
            if entry.get("last_modified"):
                headers["If-Modified-Since"] = str(entry["last_modified"])
            return headers

    def reuse(self, url: str, outcome) -> dict | None:
        """Return a defensive copy of cached parser output for a valid 304."""
        if getattr(outcome, "status", "") != "not-modified":
            return None
        with self._lock:
            entry = self._entry(url)
            if not entry:
                return None
            response_etag = str(getattr(outcome, "etag", "") or "")
            response_modified = str(getattr(outcome, "last_modified", "") or "")
            if response_etag and entry.get("etag") and response_etag != entry["etag"]:
                return None
            if (
                response_modified
                and entry.get("last_modified")
                and response_modified != entry["last_modified"]
            ):
                return None
            return {
                "records": copy.deepcopy(entry["parsed_records"]),
                "discovered_urls": copy.deepcopy(entry["discovered_urls"]),
                "empty_evidence": str(entry.get("empty_evidence") or ""),
                "observed_at": str(entry.get("observed_at") or ""),
                "body_hash": str(entry["body_hash"]),
            }

    def store(
        self,
        url: str,
        outcome,
        *,
        records: list[dict],
        discovered_urls: list,
        empty_evidence: str = "",
    ) -> None:
        """Bind response validators to the parser output from that response."""
        key = _canonical_url(url)
        if not key or getattr(outcome, "status", "") != "success":
            return
        etag = str(getattr(outcome, "etag", "") or "")
        last_modified = str(getattr(outcome, "last_modified", "") or "")
        body_hash = str(getattr(outcome, "body_hash", "") or "")
        if not body_hash:
            return
        rows = []
        for item in discovered_urls:
            if isinstance(item, dict):
                row = item
            else:
                row = {
                    "url": getattr(item, "url", ""),
                    "kind": getattr(item, "kind", "detail"),
                    "depth": getattr(item, "depth", 0),
                }
            if str(row.get("url") or "").startswith(("http://", "https://")):
                rows.append(
                    {
                        "url": str(row["url"]),
                        "kind": str(row.get("kind") or "detail"),
                        "depth": int(row.get("depth") or 0),
                    }
                )
        with self._lock:
            entries = self._document.setdefault("entries", {})
            entries[key] = {
                "url": key,
                "final_url": str(getattr(outcome, "final_url", "") or key),
                "content_type": str(getattr(outcome, "content_type", "") or ""),
                "etag": etag,
                "last_modified": last_modified,
                "body_hash": body_hash,
                "parser_version": self.parser_version,
                "observed_at": _now(),
                "empty_evidence": str(empty_evidence or ""),
                "parsed_records": copy.deepcopy(records),
                "discovered_urls": rows,
            }
            self._document["parser_version"] = self.parser_version
            self._document["updated_at"] = _now()
            if len(entries) > MAX_CACHE_ENTRIES:
                ordered = sorted(
                    entries,
                    key=lambda item: str(entries[item].get("observed_at") or ""),
                )
                for stale in ordered[: len(entries) - MAX_CACHE_ENTRIES]:
                    del entries[stale]

    def save(self) -> None:
        with self._lock:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            payload = json.dumps(
                self._document,
                indent=2,
                ensure_ascii=False,
                sort_keys=True,
            ) + "\n"
            descriptor, temporary_name = tempfile.mkstemp(
                prefix=f".{self.path.name}.",
                suffix=".tmp",
                dir=self.path.parent,
            )
            try:
                with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
                    handle.write(payload)
                    handle.flush()
                    os.fsync(handle.fileno())
                os.replace(temporary_name, self.path)
            finally:
                if os.path.exists(temporary_name):
                    os.unlink(temporary_name)

    @property
    def entry_count(self) -> int:
        with self._lock:
            return len(self._document.get("entries", {}))
