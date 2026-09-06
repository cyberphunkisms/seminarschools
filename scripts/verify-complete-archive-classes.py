#!/usr/bin/env python3
"""Independently verify the complete September 5 handoff ZIP, without extraction.

This verifier deliberately does not import the package builder.  It treats the
archive and its outer manifest as untrusted inputs, streams every payload hash,
checks the required handoff classes, validates structured/text payloads, and
opens every OOXML workbook/document/presentation as a nested ZIP/XML container.
It is read-only: no archive member is extracted and no worktree file is written.
"""

from __future__ import annotations

import argparse
import codecs
from datetime import datetime, timezone
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import stat
import sys
import unicodedata
import xml.etree.ElementTree as ET
import zipfile
import zlib


MANIFEST_NAME = "PACKAGE_CONTENTS_SHA256.json"
EXPECTED_SCHEMA = "seminar-schools-package-contents-v1"
EXPECTED_PACKAGE_KIND = "seminar-schools-complete-editable-masters-source-and-public"
EXPECTED_RELEASE_ID = (
    "core-coreplus-mephistodata-degorgonified-feminism-retrieval-enforcement-complete-2026-09-05"
)
EXPECTED_GENERATED_AT = "2026-09-05T20:15:00Z"
CORE_PATHS = (
    "Mephistodata_CORE_Personal_Rules_2026-08-12.md",
    "SITE_PACKAGE/CHARTER.txt",
)
EXPECTED_CORE_UTF16_UNITS = 5000
EXPECTED_CORE_SHA256 = "f34b4de5dbef3526b1ae54dc31941325322e85c3d720efd50e092e6687360bc0"

REQUIRED_EXACT_PATHS = {
    "README_FIRST.txt",
    "UPDATE_SOURCES/ML_STAR_UPDATE_SOURCE_DEGORGONIFIED_FEMINISM_RETRIEVAL_ENFORCEMENT_2026-09-05.md",
    "UPDATE_SOURCES/ML_STAR_UPDATE_SOURCE_FEMINISM_ACADEMIC_RESEARCH_GORGONIFICATION_2026-09-05.md",
    "UPDATE_SOURCES/ML_STAR_UPDATE_SOURCE_TRUTHFUL_WORK_CLAIMS_2026-09-05.md",
    "SITE_PACKAGE/package.json",
    "SITE_PACKAGE/PACKAGE_CONTENTS_SHA256.json",
    "SITE_PACKAGE/RELEASE_MANIFEST.json",
    "SITE_PACKAGE/UPDATE_SOURCES/ML_STAR_UPDATE_SOURCE_DEGORGONIFIED_FEMINISM_RETRIEVAL_ENFORCEMENT_2026-09-05.md",
    "SITE_PACKAGE/UPDATE_SOURCES/ML_STAR_UPDATE_SOURCE_FEMINISM_ACADEMIC_RESEARCH_GORGONIFICATION_2026-09-05.md",
    "SITE_PACKAGE/UPDATE_SOURCES/ML_STAR_UPDATE_SOURCE_TRUTHFUL_WORK_CLAIMS_2026-09-05.md",
    "SITE_PACKAGE/UPDATE_SOURCES/TRUTHFUL_WORK_CLAIM_SCREENSHOTS_2026-09-05/b4f6ab5a-4eb3-44d0-943e-41acd52faec9.png",
    "SITE_PACKAGE/UPDATE_SOURCES/TRUTHFUL_WORK_CLAIM_SCREENSHOTS_2026-09-05/3066e1d8-f6f9-4267-a948-90c076e29f93.png",
    "SITE_PACKAGE/ML_EXECUTION_AND_CONTROLLED_ARCHIVE_SYNTHESIS_2026-08-26.md",
    "SITE_PACKAGE/polymyth/methodologylist/mephistodata-rule-hardening-addendum.js",
    "SITE_PACKAGE/public/polymyth/methodologylist/mephistodata-rule-hardening-addendum.js",
    "SITE_PACKAGE/scripts/lib/mephistodata-runtime-gate.js",
    "SITE_PACKAGE/scripts/fixtures/ml-execution-gates/mephistodata-runtime-gate-hostile-fixtures.json",
    "SITE_PACKAGE/scripts/fixtures/ml-execution-gates/internal-writing-fixtures.json",
    "SITE_PACKAGE/scripts/verify-mephistodata-runtime-gate.js",
    "SITE_PACKAGE/scripts/verify-ml-execution-gates.js",
    "SITE_PACKAGE/data/futureproofing/sep3-package-contents-baseline.json",
    "SITE_PACKAGE/data/futureproofing/sep3-sep5-preservation-contract.json",
    "SITE_PACKAGE/data/futureproofing/sep5-package-contents-baseline.json",
    "SITE_PACKAGE/data/futureproofing/sep5-truthful-sep5-feminism-preservation-contract.json",
    "SITE_PACKAGE/data/futureproofing/sep5-feminism-package-contents-baseline.json",
    "SITE_PACKAGE/data/futureproofing/sep5-feminism-sep5-degorgonified-feminism-preservation-contract.json",
    "SITE_PACKAGE/data/futureproofing/futureproofing-contract.json",
    "SITE_PACKAGE/scripts/verify-sep5-base-preservation.py",
    "SITE_PACKAGE/scripts/verify-sep5-feminism-base-preservation.py",
    "SITE_PACKAGE/scripts/verify-sep5-degorgonified-feminism-base-preservation.py",
    "SITE_PACKAGE/scripts/fixtures/futureproofing/sep5-preservation-tampered.json",
    "SITE_PACKAGE/scripts/fixtures/futureproofing/sep5-feminism-preservation-tampered.json",
    "SITE_PACKAGE/scripts/fixtures/futureproofing/sep5-degorgonified-feminism-preservation-tampered.json",
    "SITE_PACKAGE/scripts/test_futureproofing_contracts.py",
    "SITE_PACKAGE/scripts/package-front-facing-mephistodata-release.py",
    "SITE_PACKAGE/scripts/build-clean-room-release.py",
    "SITE_PACKAGE/scripts/verify-complete-archive-classes.py",
    "SITE_PACKAGE/scripts/package-complete-current.py",
    "SITE_PACKAGE/scripts/artifact_receipt.py",
    "SITE_PACKAGE/scripts/verify-release-gates.js",
    "SITE_PACKAGE/polymyth/methodologylist/index.html",
    "SITE_PACKAGE/public/index.html",
    "SITE_PACKAGE/public/_headers",
    "SITE_PACKAGE/public/_redirects",
    "SITE_PACKAGE/public/site-release.json",
    "EDITABLE_MASTERS/EDITABLE_MASTERS_MANIFEST.json",
    "EDITABLE_MASTERS/SHA256SUMS.txt",
    "DEPLOY_TOOLS/README_NEXT_DEPLOY.txt",
    *CORE_PATHS,
}

JSON_SUFFIXES = (".json", ".jsonld", ".geojson", ".ipynb", ".webmanifest")
JSONL_SUFFIXES = (".jsonl", ".ndjson")
TEXT_SUFFIXES = {
    ".bat",
    ".cfg",
    ".cjs",
    ".cmd",
    ".conf",
    ".css",
    ".csv",
    ".example",
    ".htm",
    ".html",
    ".ics",
    ".ini",
    ".js",
    ".jsx",
    ".lock",
    ".map",
    ".md",
    ".mjs",
    ".ps1",
    ".py",
    ".rels",
    ".sha256",
    ".sh",
    ".sql",
    ".svg",
    ".toml",
    ".ts",
    ".tsv",
    ".tsx",
    ".txt",
    ".xml",
    ".xsl",
    ".yaml",
    ".yml",
}
TEXT_BASENAMES = {
    ".editorconfig",
    ".env.example",
    ".gitattributes",
    ".gitignore",
    ".npmrc",
    ".nvmrc",
    ".prettierignore",
    "CNAME",
    "Dockerfile",
    "LICENSE",
    "LICENSE.txt",
    "Makefile",
    "_headers",
    "_redirects",
}
OOXML_REQUIRED_PART = {
    ".xlsx": "xl/workbook.xml",
    ".docx": "word/document.xml",
    ".pptx": "ppt/presentation.xml",
}

HEX_256 = re.compile(r"[0-9a-f]{64}\Z")
DRIVE_PREFIX = re.compile(r"[A-Za-z]:")
RFC3339_UTC = re.compile(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z\Z")
WINDOWS_FORBIDDEN = frozenset('<>:"|?*')
WINDOWS_DEVICES = {
    "CON",
    "PRN",
    "AUX",
    "NUL",
    *(f"COM{number}" for number in range(1, 10)),
    *(f"LPT{number}" for number in range(1, 10)),
}
CHUNK_SIZE = 1024 * 1024
MAX_ARCHIVE_MEMBERS = 100_000
MAX_ARCHIVE_UNCOMPRESSED = 2 * 1024 * 1024 * 1024
MAX_MANIFEST_BYTES = 64 * 1024 * 1024
MAX_STRUCTURED_BYTES = 128 * 1024 * 1024
MAX_OOXML_BYTES = 128 * 1024 * 1024
MAX_OOXML_INNER_MEMBERS = 10_000
MAX_OOXML_INNER_MEMBER = 128 * 1024 * 1024
MAX_OOXML_INNER_TOTAL = 512 * 1024 * 1024

ARCHIVE_READ_ERRORS = (
    OSError,
    RuntimeError,
    EOFError,
    NotImplementedError,
    LookupError,
    UnicodeError,
    zipfile.BadZipFile,
    zlib.error,
)
XML_READ_ERRORS = (ET.ParseError, *ARCHIVE_READ_ERRORS)


class VerificationError(Exception):
    """A closed-gate archive verification failure."""


def require(condition: bool, message: str) -> None:
    if not condition:
        raise VerificationError(message)


def exact_int(value: object) -> bool:
    return type(value) is int


def validate_path(name: object, *, context: str, allow_directory: bool = False) -> bool:
    """Validate a ZIP/manifest path and return whether it is a directory name."""
    require(isinstance(name, str) and bool(name), f"{context}: empty or non-string path")
    assert isinstance(name, str)
    require("\x00" not in name, f"{context}: NUL in path {name!r}")
    require("\\" not in name, f"{context}: backslash in path {name!r}")
    require(not name.startswith("/"), f"{context}: absolute path {name!r}")
    is_directory = name.endswith("/")
    require(allow_directory or not is_directory, f"{context}: directory entry is forbidden: {name!r}")
    canonical = name[:-1] if is_directory else name
    require(bool(canonical), f"{context}: root directory entry is forbidden")
    parts = canonical.split("/")
    require(
        all(part not in {"", ".", ".."} for part in parts),
        f"{context}: empty/dot/traversal component in {name!r}",
    )
    require(not DRIVE_PREFIX.match(parts[0]), f"{context}: drive-prefixed path {name!r}")
    require(
        all(all(ord(character) >= 32 and ord(character) != 127 for character in part) for part in parts),
        f"{context}: control character in path {name!r}",
    )
    for part in parts:
        require(not part.endswith((" ", ".")), f"{context}: Windows-unsafe path {name!r}")
        require(
            not any(character in WINDOWS_FORBIDDEN for character in part),
            f"{context}: Windows-unsafe character in path {name!r}",
        )
        device_stem = part.split(".", 1)[0].upper()
        require(device_stem not in WINDOWS_DEVICES, f"{context}: Windows device path {name!r}")
    require(
        PurePosixPath(canonical).as_posix() == canonical,
        f"{context}: non-canonical path {name!r}",
    )
    return is_directory


def portable_path_key(name: str) -> str:
    """A conservative cross-platform collision key for archive member names."""
    return unicodedata.normalize("NFC", name.rstrip("/")).casefold()


def validate_zipinfo(info: zipfile.ZipInfo, *, context: str, allow_directory: bool) -> None:
    require(
        info.orig_filename == info.filename,
        f"{context}: member name was truncated or normalized by the ZIP reader",
    )
    is_directory = validate_path(info.filename, context=context, allow_directory=allow_directory)
    require(not (info.flag_bits & 0x1), f"{context}: encrypted member {info.filename!r}")
    require(info.file_size >= 0 and info.compress_size >= 0, f"{context}: invalid size metadata")
    if info.create_system == 3:
        mode = (info.external_attr >> 16) & 0xFFFF
        kind = stat.S_IFMT(mode)
        allowed_kind = stat.S_IFDIR if is_directory else stat.S_IFREG
        require(kind in {0, allowed_kind}, f"{context}: link or special member {info.filename!r}")


def unique_object(pairs: list[tuple[str, object]]) -> dict[str, object]:
    value: dict[str, object] = {}
    for key, item in pairs:
        if key in value:
            raise VerificationError(f"JSON object repeats key {key!r}")
        value[key] = item
    return value


def parse_json_bytes(payload: bytes, *, label: str) -> object:
    try:
        text = payload.decode("utf-8", errors="strict")
    except UnicodeDecodeError as error:
        raise VerificationError(f"{label}: invalid UTF-8: {error}") from error
    try:
        return json.loads(text, object_pairs_hook=unique_object)
    except VerificationError as error:
        raise VerificationError(f"{label}: {error}") from error
    except json.JSONDecodeError as error:
        raise VerificationError(f"{label}: invalid JSON: {error}") from error


def read_member(
    archive: zipfile.ZipFile,
    info: zipfile.ZipInfo,
    *,
    label: str,
    maximum: int,
) -> bytes:
    require(info.file_size <= maximum, f"{label}: exceeds safe parse limit ({info.file_size} bytes)")
    try:
        with archive.open(info, "r") as source:
            payload = source.read(maximum + 1)
    except ARCHIVE_READ_ERRORS as error:
        raise VerificationError(f"{label}: cannot read member: {error}") from error
    require(len(payload) == info.file_size, f"{label}: declared/read size mismatch")
    require(len(payload) <= maximum, f"{label}: exceeds safe parse limit")
    return payload


def parse_outer_manifest(payload: bytes) -> dict[str, object]:
    document = parse_json_bytes(payload, label=MANIFEST_NAME)
    require(isinstance(document, dict), f"{MANIFEST_NAME}: root must be an object")
    assert isinstance(document, dict)
    required_keys = {
        "schema",
        "package_kind",
        "release_id",
        "generated_at",
        "file_count",
        "total_uncompressed_bytes",
        "files",
    }
    require(set(document) == required_keys, f"{MANIFEST_NAME}: schema keys do not match exactly")
    require(document["schema"] == EXPECTED_SCHEMA, f"{MANIFEST_NAME}: unsupported schema")
    require(document["package_kind"] == EXPECTED_PACKAGE_KIND, f"{MANIFEST_NAME}: wrong package kind")
    require(document["release_id"] == EXPECTED_RELEASE_ID, f"{MANIFEST_NAME}: wrong release ID")
    generated_at = document["generated_at"]
    require(
        isinstance(generated_at, str) and RFC3339_UTC.fullmatch(generated_at) is not None,
        f"{MANIFEST_NAME}: generated_at must be second-precision UTC RFC3339",
    )
    try:
        parsed_time = datetime.strptime(generated_at, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    except ValueError as error:
        raise VerificationError(f"{MANIFEST_NAME}: invalid generated_at: {error}") from error
    require(parsed_time.tzinfo is timezone.utc, f"{MANIFEST_NAME}: generated_at is not UTC")
    require(generated_at == EXPECTED_GENERATED_AT, f"{MANIFEST_NAME}: wrong fixed generated_at")
    require(exact_int(document["file_count"]), f"{MANIFEST_NAME}: file_count must be an integer")
    require(
        exact_int(document["total_uncompressed_bytes"]),
        f"{MANIFEST_NAME}: total_uncompressed_bytes must be an integer",
    )
    rows = document["files"]
    require(isinstance(rows, list), f"{MANIFEST_NAME}: files must be an array")
    assert isinstance(rows, list)
    require(document["file_count"] == len(rows), f"{MANIFEST_NAME}: file_count mismatch")
    require(len(rows) > 0, f"{MANIFEST_NAME}: payload is empty")

    row_paths = [row.get("path") if isinstance(row, dict) else None for row in rows]
    require(
        all(isinstance(path, str) for path in row_paths)
        and row_paths == sorted(row_paths),
        f"{MANIFEST_NAME}: file rows must be lexically path-sorted",
    )

    seen: set[str] = set()
    byte_total = 0
    for position, row in enumerate(rows):
        label = f"{MANIFEST_NAME} files[{position}]"
        require(isinstance(row, dict), f"{label}: row must be an object")
        assert isinstance(row, dict)
        require(set(row) == {"path", "bytes", "sha256"}, f"{label}: row schema mismatch")
        path = row["path"]
        validate_path(path, context=label)
        assert isinstance(path, str)
        require(path != MANIFEST_NAME, f"{label}: outer manifest must not list itself")
        require(path not in seen, f"{label}: duplicate manifest path {path!r}")
        seen.add(path)
        require(exact_int(row["bytes"]) and row["bytes"] >= 0, f"{label}: invalid byte count")
        require(
            isinstance(row["sha256"], str) and HEX_256.fullmatch(row["sha256"]) is not None,
            f"{label}: sha256 must be lowercase hexadecimal",
        )
        byte_total += row["bytes"]
    require(
        document["total_uncompressed_bytes"] == byte_total,
        f"{MANIFEST_NAME}: total_uncompressed_bytes mismatch",
    )
    return document


def stream_and_match_payloads(
    archive: zipfile.ZipFile,
    infos: dict[str, zipfile.ZipInfo],
    manifest: dict[str, object],
) -> None:
    rows = manifest["files"]
    assert isinstance(rows, list)
    for row in rows:
        assert isinstance(row, dict)
        path = row["path"]
        assert isinstance(path, str)
        info = infos[path]
        require(info.file_size == row["bytes"], f"{path}: ZIP/manifest byte-count mismatch")
        digest = hashlib.sha256()
        counted = 0
        try:
            with archive.open(info, "r") as source:
                for block in iter(lambda: source.read(CHUNK_SIZE), b""):
                    counted += len(block)
                    digest.update(block)
        except ARCHIVE_READ_ERRORS as error:
            raise VerificationError(f"{path}: payload read/CRC failure: {error}") from error
        require(counted == row["bytes"], f"{path}: streamed byte-count mismatch")
        require(digest.hexdigest() == row["sha256"], f"{path}: SHA-256 mismatch")


def require_package_classes(paths: set[str]) -> None:
    missing = sorted(REQUIRED_EXACT_PATHS - paths)
    require(not missing, "required package-class files are missing: " + ", ".join(missing))
    require(any(path.startswith("SITE_PACKAGE/public/") for path in paths), "public class is empty")
    require(
        any(path.startswith("SITE_PACKAGE/scripts/") for path in paths),
        "site source/script class is empty",
    )
    require(
        any(path.startswith("EDITABLE_MASTERS/") for path in paths),
        "editable-masters class is empty",
    )
    require(any(path.startswith("DEPLOY_TOOLS/") for path in paths), "deploy-tools class is empty")
    require(
        any(path.startswith("DEPLOY_TOOLS/") and path.lower().endswith(".cmd") for path in paths),
        "deploy-tools class has no .cmd deployment tool",
    )
    require(
        any(
            path.startswith("EDITABLE_MASTERS/")
            and PurePosixPath(path).suffix.lower() in OOXML_REQUIRED_PART
            for path in paths
        ),
        "editable-masters class has no OOXML master",
    )
    require(
        not any(path.startswith("SITE_PACKAGE/public/EDITABLE_MASTERS/") for path in paths),
        "private editable masters leaked into the deployable public class",
    )
    require(
        not any(path.startswith("SITE_PACKAGE/public/DEPLOY_TOOLS/") for path in paths),
        "deployment tooling leaked into the deployable public class",
    )


def verify_portable_core(archive: zipfile.ZipFile, infos: dict[str, zipfile.ZipInfo]) -> None:
    payloads = [
        read_member(archive, infos[path], label=path, maximum=64 * 1024)
        for path in CORE_PATHS
    ]
    require(payloads[0] == payloads[1], "portable CORE mirrors are not byte-equal")
    digest = hashlib.sha256(payloads[0]).hexdigest()
    require(digest == EXPECTED_CORE_SHA256, "portable CORE is not the expected hardened document")
    try:
        text = payloads[0].decode("utf-8", errors="strict")
    except UnicodeDecodeError as error:
        raise VerificationError(f"portable CORE is not UTF-8: {error}") from error
    require(text.endswith("\n"), "portable CORE must retain its final newline")
    units = len(text.encode("utf-16-le")) // 2
    require(units == EXPECTED_CORE_UTF16_UNITS, f"portable CORE is {units}, not 5000, UTF-16 units")


def validate_utf8_stream(archive: zipfile.ZipFile, info: zipfile.ZipInfo, *, label: str) -> None:
    decoder = codecs.getincrementaldecoder("utf-8")("strict")
    try:
        with archive.open(info, "r") as source:
            for block in iter(lambda: source.read(CHUNK_SIZE), b""):
                decoder.decode(block, final=False)
            decoder.decode(b"", final=True)
    except UnicodeDecodeError as error:
        raise VerificationError(f"{label}: invalid UTF-8 text: {error}") from error
    except ARCHIVE_READ_ERRORS as error:
        raise VerificationError(f"{label}: text read/CRC failure: {error}") from error


def parse_json_member(archive: zipfile.ZipFile, info: zipfile.ZipInfo, *, label: str) -> None:
    payload = read_member(archive, info, label=label, maximum=MAX_STRUCTURED_BYTES)
    parse_json_bytes(payload, label=label)


def parse_jsonl_member(archive: zipfile.ZipFile, info: zipfile.ZipInfo, *, label: str) -> int:
    require(info.file_size <= MAX_STRUCTURED_BYTES, f"{label}: exceeds safe JSONL parse limit")
    records = 0
    try:
        with archive.open(info, "r") as raw:
            with io.TextIOWrapper(raw, encoding="utf-8", errors="strict", newline=None) as source:
                for line_number, line in enumerate(source, 1):
                    if not line.strip():
                        continue
                    try:
                        json.loads(line, object_pairs_hook=unique_object)
                    except VerificationError as error:
                        raise VerificationError(f"{label}:{line_number}: {error}") from error
                    except json.JSONDecodeError as error:
                        raise VerificationError(f"{label}:{line_number}: invalid JSON: {error}") from error
                    records += 1
    except UnicodeDecodeError as error:
        raise VerificationError(f"{label}: invalid UTF-8 JSONL: {error}") from error
    except ARCHIVE_READ_ERRORS as error:
        raise VerificationError(f"{label}: JSONL read/CRC failure: {error}") from error
    return records


def verify_ooxml_payload(payload: bytes, *, label: str, suffix: str) -> int:
    require(len(payload) <= MAX_OOXML_BYTES, f"{label}: exceeds OOXML container limit")
    try:
        container = zipfile.ZipFile(io.BytesIO(payload), "r")
    except ARCHIVE_READ_ERRORS as error:
        raise VerificationError(f"{label}: invalid OOXML ZIP container: {error}") from error
    with container:
        inner_infos = container.infolist()
        require(bool(inner_infos), f"{label}: empty OOXML container")
        require(
            len(inner_infos) <= MAX_OOXML_INNER_MEMBERS,
            f"{label}: OOXML member count exceeds safe limit",
        )
        names: set[str] = set()
        portable_names: set[str] = set()
        total = 0
        for info in inner_infos:
            validate_zipinfo(info, context=f"{label} inner ZIP", allow_directory=True)
            require(info.filename not in names, f"{label}: duplicate OOXML member {info.filename!r}")
            names.add(info.filename)
            collision_key = portable_path_key(info.filename)
            require(
                collision_key not in portable_names,
                f"{label}: cross-platform OOXML name collision at {info.filename!r}",
            )
            portable_names.add(collision_key)
            require(
                info.file_size <= MAX_OOXML_INNER_MEMBER,
                f"{label}: oversized OOXML member {info.filename!r}",
            )
            total += info.file_size
        require(total <= MAX_OOXML_INNER_TOTAL, f"{label}: OOXML expansion exceeds safe limit")
        required = {"[Content_Types].xml", "_rels/.rels", OOXML_REQUIRED_PART[suffix]}
        missing = sorted(required - names)
        require(not missing, f"{label}: required OOXML parts missing: {', '.join(missing)}")
        try:
            bad_crc = container.testzip()
        except ARCHIVE_READ_ERRORS as error:
            raise VerificationError(f"{label}: OOXML CRC failure: {error}") from error
        require(bad_crc is None, f"{label}: OOXML CRC failure in {bad_crc!r}")

        xml_count = 0
        for info in inner_infos:
            inner_name = info.filename.lower()
            if info.is_dir() or not (inner_name.endswith(".xml") or inner_name.endswith(".rels")):
                continue
            try:
                with container.open(info, "r") as source:
                    ET.parse(source)
            except XML_READ_ERRORS as error:
                raise VerificationError(
                    f"{label}: unparseable XML part {info.filename!r}: {error}"
                ) from error
            xml_count += 1
        require(xml_count > 0, f"{label}: OOXML container has no parseable XML parts")
        return xml_count


def validate_payload_formats(
    archive: zipfile.ZipFile,
    infos: dict[str, zipfile.ZipInfo],
    paths: list[str],
) -> dict[str, int]:
    counts = {"json": 0, "jsonl": 0, "jsonl_records": 0, "utf8_text": 0, "ooxml": 0, "ooxml_xml": 0}
    for path in paths:
        info = infos[path]
        lower = path.lower()
        suffix = PurePosixPath(lower).suffix
        if lower.endswith(JSONL_SUFFIXES):
            counts["jsonl_records"] += parse_jsonl_member(archive, info, label=path)
            counts["jsonl"] += 1
        elif lower.endswith(JSON_SUFFIXES):
            parse_json_member(archive, info, label=path)
            counts["json"] += 1
        elif suffix in OOXML_REQUIRED_PART:
            payload = read_member(archive, info, label=path, maximum=MAX_OOXML_BYTES)
            counts["ooxml_xml"] += verify_ooxml_payload(payload, label=path, suffix=suffix)
            counts["ooxml"] += 1
        elif suffix in TEXT_SUFFIXES or PurePosixPath(path).name in TEXT_BASENAMES:
            validate_utf8_stream(archive, info, label=path)
            counts["utf8_text"] += 1
    require(counts["ooxml"] > 0, "archive contains no OOXML containers")
    return counts


def handle_sha256(source: io.BufferedReader) -> str:
    digest = hashlib.sha256()
    try:
        source.seek(0)
        for block in iter(lambda: source.read(CHUNK_SIZE), b""):
            digest.update(block)
        source.seek(0)
    except ARCHIVE_READ_ERRORS as error:
        raise VerificationError(f"cannot hash archive: {error}") from error
    return digest.hexdigest()


def stat_signature(value: os.stat_result) -> tuple[int, int, int, int, int]:
    return (value.st_dev, value.st_ino, value.st_size, value.st_mtime_ns, value.st_ctime_ns)


def verify_archive(path: Path) -> dict[str, object]:
    require(path.is_file(), f"archive does not exist or is not a file: {path}")
    try:
        source = path.open("rb")
    except ARCHIVE_READ_ERRORS as error:
        raise VerificationError(f"cannot open archive: {error}") from error

    with source:
        try:
            initial_stat = os.fstat(source.fileno())
        except OSError as error:
            raise VerificationError(f"cannot stat open archive: {error}") from error
        require(stat.S_ISREG(initial_stat.st_mode), "archive path is not a regular file")
        initial_signature = stat_signature(initial_stat)
        archive_digest = handle_sha256(source)
        require(
            stat_signature(os.fstat(source.fileno())) == initial_signature,
            "archive changed while its initial digest was read",
        )
        try:
            archive = zipfile.ZipFile(source, "r")
        except ARCHIVE_READ_ERRORS as error:
            raise VerificationError(f"cannot open ZIP: {error}") from error

        with archive:
            all_infos = archive.infolist()
            require(
                len(all_infos) <= MAX_ARCHIVE_MEMBERS,
                "archive member count exceeds safe limit",
            )
            require(bool(all_infos), "archive is empty")
            infos: dict[str, zipfile.ZipInfo] = {}
            portable_names: set[str] = set()
            declared_total = 0
            for info in all_infos:
                validate_zipinfo(info, context="outer ZIP", allow_directory=False)
                require(info.filename not in infos, f"outer ZIP: duplicate member {info.filename!r}")
                infos[info.filename] = info
                collision_key = portable_path_key(info.filename)
                require(
                    collision_key not in portable_names,
                    f"outer ZIP: cross-platform name collision at {info.filename!r}",
                )
                portable_names.add(collision_key)
                declared_total += info.file_size
            require(
                declared_total <= MAX_ARCHIVE_UNCOMPRESSED,
                "archive declared uncompressed size exceeds safe limit",
            )
            require(MANIFEST_NAME in infos, f"outer ZIP: missing {MANIFEST_NAME}")
            manifest_info = infos[MANIFEST_NAME]
            manifest_payload = read_member(
                archive,
                manifest_info,
                label=MANIFEST_NAME,
                maximum=MAX_MANIFEST_BYTES,
            )
            manifest = parse_outer_manifest(manifest_payload)
            rows = manifest["files"]
            assert isinstance(rows, list)
            payload_paths = [row["path"] for row in rows]
            assert all(isinstance(item, str) for item in payload_paths)
            path_set = set(payload_paths)
            require(
                set(infos) == path_set | {MANIFEST_NAME},
                "outer ZIP member set does not exactly match the manifest",
            )
            require(
                len(all_infos) == manifest["file_count"] + 1,
                "outer ZIP member count does not equal manifest file_count plus manifest",
            )
            require(
                [info.filename for info in all_infos] == payload_paths + [MANIFEST_NAME],
                "outer ZIP order must match sorted manifest rows followed by the manifest",
            )
            require_package_classes(path_set)

            # Reading every payload and the manifest to EOF validates each outer
            # member's CRC; a separate testzip() would redundantly decompress the
            # entire release a second time.
            stream_and_match_payloads(archive, infos, manifest)
            verify_portable_core(archive, infos)
            format_counts = validate_payload_formats(archive, infos, payload_paths)

        require(
            stat_signature(os.fstat(source.fileno())) == initial_signature,
            "archive changed during ZIP verification",
        )
        final_digest = handle_sha256(source)
        require(final_digest == archive_digest, "archive bytes changed during verification")
        require(
            stat_signature(os.fstat(source.fileno())) == initial_signature,
            "archive changed while its final digest was read",
        )
        try:
            path_signature = stat_signature(path.stat())
        except OSError as error:
            raise VerificationError(f"archive path changed during verification: {error}") from error
        require(path_signature == initial_signature, "archive path was replaced during verification")

    return {
        "status": "passed",
        "archive": str(path),
        "archive_sha256": archive_digest,
        "release_id": EXPECTED_RELEASE_ID,
        "payload_file_count": manifest["file_count"],
        "payload_uncompressed_bytes": manifest["total_uncompressed_bytes"],
        "portable_core_utf16_units": EXPECTED_CORE_UTF16_UNITS,
        "portable_core_sha256": EXPECTED_CORE_SHA256,
        **format_counts,
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Read-only independent verifier for the complete September 5 handoff ZIP."
    )
    parser.add_argument("archive", type=Path, help="complete release ZIP to verify")
    args = parser.parse_args()
    try:
        result = verify_archive(args.archive.resolve())
    except VerificationError as error:
        print(f"COMPLETE ARCHIVE CLASS VERIFICATION FAILED: {error}", file=sys.stderr)
        return 1
    except XML_READ_ERRORS as error:
        print(
            f"COMPLETE ARCHIVE CLASS VERIFICATION FAILED: malformed input: {error}",
            file=sys.stderr,
        )
        return 1
    print(json.dumps(result, ensure_ascii=False, sort_keys=True, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
