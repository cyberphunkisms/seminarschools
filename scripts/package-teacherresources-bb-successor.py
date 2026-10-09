#!/usr/bin/env python3
"""Package the Teacher Resources and BB delta over the exact complete predecessor.

This build helper deliberately does not alter historical package
wrappers. The independent class verifier's release identity is parameterized
for this successor and its CORE hash is bound to the exact verified predecessor.
All class, CORE mirror and size, format, hash and safety checks remain.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import sys
import zipfile


MANIFEST = "PACKAGE_CONTENTS_SHA256.json"
SITE_MANIFEST = "SITE_PACKAGE/" + MANIFEST
PACKAGE_KIND = "seminar-schools-complete-editable-masters-source-and-public"
HISTORICAL_EXPORT = "SITE_PACKAGE/hf_export/data/ml/sections/corehistory.jsonl"
HISTORICAL_HTML = {
    "SITE_PACKAGE/polymyth/methodologylist/corehistory/index.html",
    "SITE_PACKAGE/public/polymyth/methodologylist/corehistory/index.html",
}


def verify_history_shell_refresh(before, after, old_version, new_version):
    """Allow only the current shared CSS cache token and trailing head whitespace.

    Historical record markup, all body bytes, and every other head byte remain
    exact. The shared asset itself is independently bound by release identity.
    """
    old_link = '<link rel="stylesheet" href="/css/alive.css?v=' + old_version + '">'
    new_link = '<link rel="stylesheet" href="/css/alive.css?v=' + new_version + '">'
    require(before.count(old_link) == after.count(new_link) == 1,
            "historical shell must have exactly one versioned shared stylesheet")
    expected = before.replace(old_link, new_link)
    normalize_head_end = lambda value: re.sub(r"\s*</head>", "\n</head>", value, count=1)
    require(normalize_head_end(expected) == normalize_head_end(after),
            "historical HTML changed beyond the shared CSS cache token and trailing head whitespace")


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def digest(path):
    result = hashlib.sha256()
    with path.open("rb") as stream:
        for part in iter(lambda: stream.read(1024 * 1024), b""):
            result.update(part)
    return result.hexdigest()


def load_module(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + "\n", encoding="utf-8")


def row(root, relative):
    target = root / relative
    return {"path": relative, "bytes": target.stat().st_size, "sha256": digest(target)}


def render_manifest(rows, release, kind):
    return {"schema": "seminar-schools-package-contents-v1", "package_kind": kind,
            **release, "file_count": len(rows),
            "total_uncompressed_bytes": sum(item["bytes"] for item in rows), "files": rows}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("config", type=Path, help="package contract with exact predecessor hash and approved relative-path delta")
    parser.add_argument("--baseline", type=Path, help="verified predecessor ZIP, required when no baseline_zip is configured")
    parser.add_argument("--root", type=Path, help="complete handoff root, defaults to this packaged script's delivery root")
    parser.add_argument("--output", type=Path, help="successor ZIP outside the selected source tree")
    parser.add_argument("--report", type=Path, help="post-package verification JSON outside the selected source tree")
    parser.add_argument("--preflight", action="store_true", help="read-only delta validation, without manifest/ZIP writes")
    args = parser.parse_args()
    config = json.loads(args.config.read_text(encoding="utf-8"))
    root = Path(args.root or config.get("root") or Path(__file__).resolve().parents[2]).resolve()
    require(args.baseline or config.get("baseline_zip"), "provide --baseline with the exact predecessor ZIP")
    baseline = Path(args.baseline or config["baseline_zip"]).resolve()
    output = Path(args.output or config.get("output") or root.parent / (config["release_id"] + ".zip")).resolve()
    report_path = Path(args.report or config.get("report") or output.with_suffix(".verification.json")).resolve()
    require(not output.is_relative_to(root), "write the successor outside the selected source tree")
    require(not report_path.is_relative_to(root), "post-package report must remain outside its own payload")
    require(baseline != output, "predecessor archive must not be overwritten")
    require(digest(baseline) == config["baseline_sha256"], "predecessor archive SHA-256 mismatch")
    release = {"release_id": config["release_id"], "generated_at": config["generated_at"]}
    with zipfile.ZipFile(baseline) as archive:
        previous = json.loads(archive.read(MANIFEST))
        old_site_manifest = json.loads(archive.read(SITE_MANIFEST))
        old_release = json.loads(archive.read("SITE_PACKAGE/RELEASE_MANIFEST.json"))
        baseline_core = archive.read("SITE_PACKAGE/CHARTER.txt")
        old_history_html = {name: archive.read(name).decode("utf-8") for name in HISTORICAL_HTML}
        require(baseline_core == archive.read("Mephistodata_CORE_Personal_Rules_2026-08-12.md"),
                "predecessor CORE mirrors differ")
        old_historical_export = [json.loads(line) for line in archive.read(HISTORICAL_EXPORT).decode("utf-8").splitlines() if line.strip()]
        required = {item["path"]: item for item in previous["files"]}
        require(previous["package_kind"] == PACKAGE_KIND, "predecessor is not the complete archive class")
        require(len(required) == previous["file_count"], "duplicate or inconsistent predecessor manifest")
        require(archive.namelist() == list(required) + [MANIFEST], "predecessor member list differs from its manifest")
        require({"SITE_PACKAGE/" + item["path"] for item in old_site_manifest["files"]}
                == {name for name in required if name.startswith("SITE_PACKAGE/")} - {SITE_MANIFEST},
                "predecessor inner and outer manifest membership differs")

    additions = config["added_paths"]
    allowed_changes = set(config["allowed_changed_paths"]) | {SITE_MANIFEST}
    require(len(additions) == len(set(additions)), "duplicate approved additions")
    require(not set(additions) & set(required), "new paths already exist in predecessor")
    require(MANIFEST not in additions, "outer manifest is generated, never a selected input")
    selected = sorted(set(required) | set(additions))
    for relative in selected:
        target = root / relative
        require(not target.is_symlink() and target.is_file(), "missing or nonregular selected path: " + relative)
        require(target.resolve().is_relative_to(root), "selected path escapes package: " + relative)
    current = {relative: row(root, relative) for relative in selected}
    changed = [name for name in required if current[name] != required[name]]
    require(not set(changed) - allowed_changes,
            "unapproved predecessor changes: " + repr(sorted(set(changed) - allowed_changes)))
    require(not any(name.startswith("EDITABLE_MASTERS/") or ("corehistory" in name.lower() and name != HISTORICAL_EXPORT and name not in HISTORICAL_HTML)
                    or name in {"SITE_PACKAGE/CHARTER.txt", "Mephistodata_CORE_Personal_Rules_2026-08-12.md"}
                    for name in changed), "protected masters, CORE or historical mirror changed")
    historical_export_refresh = {"path": HISTORICAL_EXPORT, "timestamp_only_change": False}
    if HISTORICAL_EXPORT in changed:
        new_historical_export = [json.loads(line) for line in (root / HISTORICAL_EXPORT).read_text(encoding="utf-8").splitlines() if line.strip()]
        expected_exported_at = datetime.fromisoformat(release["generated_at"].replace("Z", "+00:00")).astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
        require(len(old_historical_export) == len(new_historical_export) == 30,
                "historical export must retain exactly the 30 predecessor rows")
        for index, (old_row, new_row) in enumerate(zip(old_historical_export, new_historical_export)):
            require("exported_at" in old_row and new_row.get("exported_at") == expected_exported_at,
                    "historical export timestamp differs from successor at row " + str(index))
            require({key: value for key, value in old_row.items() if key != "exported_at"}
                    == {key: value for key, value in new_row.items() if key != "exported_at"},
                    "historical export changed beyond exported_at at row " + str(index))
        historical_export_refresh.update({"timestamp_only_change": True,
                                          "preserved_rows": len(new_historical_export),
                                          "exported_at": expected_exported_at})
    new_release = json.loads((root / "SITE_PACKAGE/RELEASE_MANIFEST.json").read_text(encoding="utf-8"))
    historical_shell_refresh = []
    for name in sorted(HISTORICAL_HTML & set(changed)):
        verify_history_shell_refresh(old_history_html[name], (root / name).read_text(encoding="utf-8"),
                                     old_release["geometry_asset_version"], new_release["geometry_asset_version"])
        historical_shell_refresh.append({"path": name, "record_markup_and_body_bytes_preserved": True,
                                         "allowed_changes": ["shared CSS cache token", "trailing head whitespace"]})
    amendment = new_release.get(config["release_manifest_key"], {})
    mutable_identity = {"geometry_asset_version", "teacherresources_asset_versions", "asset_digests"}
    for key, value in old_release.items():
        if key in mutable_identity:
            require(amendment.get("predecessor_asset_identity", {}).get(key) == value,
                    "prior asset identity was not preserved: " + key)
        else:
            require(new_release.get(key) == value, "historical release field changed: " + key)
    require(set(new_release) - set(old_release) == {config["release_manifest_key"]},
            "release manifest must add exactly the approved amendment object")
    update = new_release[config["release_manifest_key"]]
    require(update["release_id"] == release["release_id"], "amendment release ID differs")
    require(update["predecessor_sha256"] == config["baseline_sha256"], "amendment predecessor binding differs")
    for relative, expected in update["artifact_sha256"].items():
        require(digest(root / "SITE_PACKAGE" / relative) == expected, "amendment hash differs: " + relative)
    delta = {"predecessor_archive": baseline.name, "predecessor_sha256": config["baseline_sha256"],
             "predecessor_payload_paths_retained": len(required), "predecessor_zip_members": len(required) + 1,
             "new_payload_paths": sorted(additions), "changed_predecessor_paths": sorted(set(changed) | {SITE_MANIFEST}),
             "expected_successor_payload_files": len(selected),
             "editable_master_payload_files_preserved": sum(name.startswith("EDITABLE_MASTERS/") for name in required),
             "historical_release_fields_preserved": len(old_release),
             "historical_shell_refresh": historical_shell_refresh,
             "historical_export_refresh": historical_export_refresh}
    if args.preflight:
        print(json.dumps({"status": "passed", "mode": "read-only-preflight", **delta}, indent=2))
        return

    scripts = root / "SITE_PACKAGE/scripts"
    sys.path.insert(0, str(scripts))
    from build_lock import ReleaseBuildLock
    from package_integrity import write_verified_archive
    class_verifier = load_module(scripts / "verify-complete-archive-classes.py", "complete_archive_classes")
    recovery_verifier = load_module(scripts / "verify-disaster-recovery.py", "disaster_recovery")
    class_verifier.EXPECTED_RELEASE_ID = release["release_id"]
    class_verifier.EXPECTED_GENERATED_AT = release["generated_at"]
    # The inherited verifier pins an older September 5 CORE. The verified
    # predecessor ZIP and protected-path check above bind this successor to
    # the exact newer CORE without relaxing mirror equality or its size gate.
    class_verifier.EXPECTED_CORE_SHA256 = hashlib.sha256(baseline_core).hexdigest()
    with ReleaseBuildLock(root):
        # Recheck the approved delta after acquiring the package writer lock.
        for name, expected in current.items():
            require(row(root, name) == expected, "source changed since preflight: " + name)
        site_rows = [{**current[name], "path": name.removeprefix("SITE_PACKAGE/")}
                     for name in selected if name.startswith("SITE_PACKAGE/") and name != SITE_MANIFEST]
        write_json(root / SITE_MANIFEST, render_manifest(site_rows, release, old_site_manifest["package_kind"]))
        packaged = write_verified_archive(root, output, [root / name for name in selected], release, PACKAGE_KIND)
        classes = class_verifier.verify_archive(output)
        recovery = recovery_verifier.verify_recovery_archive(output, Path(str(output) + ".sha256"))
        # Independently cross-check every nested site-manifest row against the
        # verified outer payload; neither archive class nor recovery performs it.
        outer = {item["path"]: item for item in packaged["manifest"]["files"]}
        for item in site_rows:
            outer_name = "SITE_PACKAGE/" + item["path"]
            require(outer[outer_name] == {**item, "path": outer_name}, "nested manifest hash mismatch: " + outer_name)
        require(digest(baseline) == config["baseline_sha256"], "predecessor changed during packaging")
        result = {"schema": "seminar-schools-ouroboros-package-verification-v1", "status": "passed",
                  "release": release, "scope": "focused amendment package integrity, preservation, formats and restoration",
                  "delta": delta, "archive": {"path": str(output), "sha256": packaged["archive_sha256"],
                  "bytes": packaged["archive_bytes"], "payload_files": packaged["file_count"]},
                  "archive_classes": classes, "disaster_recovery": recovery,
                  "inner_manifest": {"file_count": len(site_rows), "outer_row_parity": True},
                  "full_site_certification_performed": False, "deployment_performed": False,
                  "external_chat_host_integration_verified": False}
        write_json(report_path, result)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
