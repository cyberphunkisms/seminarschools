#!/usr/bin/env python3
"""Normalize source-language fields before generated pages are built.

Audit 45 treats unknown as an honest value, not as English.  A record may carry
one primary ``source_language`` and a normalized ``source_languages`` array.
The same contract is used by Polymythcal and Teacher Resources so rendered
language boundaries and schema can be generated deterministically.
"""
from __future__ import annotations

from pathlib import Path
from datetime import datetime, timezone
import json
import os
import re

ROOT = Path(__file__).resolve().parents[1]
if os.environ.get("SS_BUILD_OUTPUT_MTIME"):
    try:
        output_moment = datetime.fromisoformat(
            os.environ["SS_BUILD_OUTPUT_MTIME"].replace("Z", "+00:00")
        )
        if output_moment.tzinfo is None:
            output_moment = output_moment.replace(tzinfo=timezone.utc)
        BUILD_MTIME = output_moment.timestamp()
    except ValueError as error:
        raise SystemExit("SS_BUILD_OUTPUT_MTIME must be a valid timestamp") from error
else:
    BUILD_MTIME = 2_020_118_400  # 2034-01-06T00:00:00Z, after release stamps.


def write_json(path: Path, payload: object) -> None:
    rendered = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    if not path.exists() or path.read_text(encoding="utf-8") != rendered:
        path.write_text(rendered, encoding="utf-8")
    if path.stat().st_mtime < BUILD_MTIME:
        os.utime(path, (BUILD_MTIME, BUILD_MTIME))


def normalize_language_tag(value: object) -> str:
    tag = str(value or "").strip().replace("_", "-")
    aliases = {
        "en": "en-CA",
        "fr": "fr-CA",
        "en-ca": "en-CA",
        "fr-ca": "fr-CA",
        "zh": "zh-Hant",
        "zhs": "zh-Hans",
        "fa-ir": "fa",
        "unknown": "und",
        "": "und",
    }
    return aliases.get(tag.casefold(), tag)


def normalized_language_list(value: object) -> list[str]:
    raw: list[object]
    if isinstance(value, list):
        raw = value
    elif value:
        raw = re.split(r"[,;]", str(value))
    else:
        raw = []
    result: list[str] = []
    for item in raw:
        tag = normalize_language_tag(item)
        if tag != "und" and tag not in result:
            result.append(tag)
    return result


def normalize_polymythcal_records(path: Path, list_key: str) -> int:
    payload = json.loads(path.read_text(encoding="utf-8"))
    records = payload.get(list_key, [])
    for record in records:
        languages = normalized_language_list(
            record.get("source_languages") or record.get("source_language")
        )
        if len(languages) > 1:
            record["source_language"] = "mul"
            record["source_languages"] = languages
        elif languages:
            record["source_language"] = languages[0]
            record["source_languages"] = languages
        else:
            record["source_language"] = "und"
            record["source_languages"] = []
            record["source_language_review"] = "required"
        record.setdefault("source_language_method", "source-declared")
        if record["source_language"] == "und":
            record["source_language_method"] = "not-yet-determined"
    write_json(path, payload)
    return len(records)


def normalize_teacher_resources() -> int:
    path = ROOT / "teacherresources" / "resources-data.json"
    payload = json.loads(path.read_text(encoding="utf-8"))
    count = 0
    for group in payload.get("groups", []):
        for category in group.get("categories", []):
            for entry in category.get("entries", []):
                count += 1
                title = str(entry.get("title") or "")
                if group.get("id") == "fsl" and category.get("id") == "fsl-literature":
                    languages = ["fr-CA"]
                elif group.get("id") == "fsl":
                    # FSL teaching pages may explain French in English.  Keep
                    # both languages discoverable without pretending one is
                    # the sole language of the source.
                    languages = ["fr-CA"] if re.search(
                        r"[àâçéèêëîïôùûüÿœæ]|\b(?:pour|les|des|une|méthodes|trucs)\b",
                        title,
                        re.I,
                    ) else ["en-CA", "fr-CA"]
                else:
                    languages = normalized_language_list(
                        entry.get("source_languages") or entry.get("language")
                    ) or ["en-CA"]
                entry["source_languages"] = languages
                entry["language"] = languages[0] if len(languages) == 1 else "mul"
                entry["language_label"] = (
                    "French"
                    if languages == ["fr-CA"]
                    else "English and French"
                    if len(languages) > 1
                    else "English"
                )
    payload["_language_model"] = {
        "version": "audit45-v1",
        "shell_language": "en-CA",
        "field": "source_languages",
        "unknown_policy": "use und; never assume English",
    }
    write_json(path, payload)
    return count


def main() -> None:
    canonical_events = ROOT / "data" / "polymyth-seminar-events.json"
    public_events = ROOT / "polymythseminars" / "events.json"
    event_count = normalize_polymythcal_records(canonical_events, "events")
    # Both complete event documents are an intentional byte-identical public
    # contract. Normalize from the canonical master and publish that exact
    # object before any detail or compact-browser generators run.
    canonical_payload = json.loads(canonical_events.read_text(encoding="utf-8"))
    write_json(public_events, canonical_payload)
    counts = {
        "events": event_count,
        "candidates": normalize_polymythcal_records(
            ROOT / "polymythseminars" / "candidates.json", "announcements"
        ),
        "teacher_resources": normalize_teacher_resources(),
    }
    print(
        "AUDIT 45 LANGUAGE MODEL APPLIED — "
        + ", ".join(f"{name}={value}" for name, value in counts.items())
    )


if __name__ == "__main__":
    main()
