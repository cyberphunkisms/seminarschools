#!/usr/bin/env python3
"""Verify that package manifests cannot revive retired Polymythcal artifacts."""

from __future__ import annotations

import json
from pathlib import Path

from package_selection import collect_package_files, polymythcal_publication_exclusions


ROOT = Path(__file__).resolve().parents[1]
DELIVERY_ROOT = ROOT.parent
SURFACES = json.loads(
    (ROOT / "data" / "polymythcal-publication-surfaces.json").read_text(encoding="utf-8")
)
CANONICAL = json.loads(
    (ROOT / "data" / "polymyth-seminar-events.json").read_text(encoding="utf-8")
)


def require(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(f"POLYMYTHCAL PACKAGE BOUNDARY FAILED — {message}")


watch_ids = set(SURFACES["watchlist_ids"])
chronology_ids = set(SURFACES["chronology_ids"])
event_by_id = {event["id"]: event for event in CANONICAL["events"]}
retired_ics_ids = set(watch_ids)
for event_id in watch_ids:
    retired_ics_ids.update(event_by_id[event_id].get("legacy_ids") or [])

inner_exclusions = polymythcal_publication_exclusions(ROOT)
outer_exclusions = polymythcal_publication_exclusions(DELIVERY_ROOT)
require(
    outer_exclusions == {f"SITE_PACKAGE/{relative}" for relative in inner_exclusions},
    "inner and outer archive exclusions differ",
)
for relative in (
    "public/polymythseminars/events.json",
    "public/js/polymythcal-revamp.js",
    "public/css/polymythcal-revamp.css",
):
    require(relative in inner_exclusions, f"missing private public exclusion {relative}")
for event_id in retired_ics_ids:
    require(
        f"polymythseminars/ics/{event_id}.ics" in inner_exclusions
        and f"public/polymythseminars/ics/{event_id}.ics" in inner_exclusions,
        f"retired monitoring ICS is selectable: {event_id}",
    )
for event_id in chronology_ids:
    require(
        f"polymythseminars/ics/{event_id}.ics" not in inner_exclusions,
        f"chronology ICS was wrongly retired: {event_id}",
    )

probe = DELIVERY_ROOT / ".polymythcal-package-selection-probe.zip"
selected_files, stats = collect_package_files(ROOT, probe, excluded_top_level={"qa"})
selected = {path.relative_to(ROOT).as_posix() for path in selected_files}
require(not (selected & inner_exclusions), "retired/private artifacts remain package-selectable")
for relative in (
    "polymythseminars/events.json",
    "polymythseminars/browse.json",
    "polymythseminars/watchlist.json",
    "polymythseminars/research.json",
    "public/polymythseminars/browse.json",
    "public/polymythseminars/watchlist.json",
    "public/polymythseminars/research.json",
):
    require(relative in selected, f"required source/public projection was excluded: {relative}")
for event_id in watch_ids:
    require(
        f"polymythseminars/events/{event_id}/index.html" in selected
        and f"public/polymythseminars/events/{event_id}/index.html" in selected,
        f"stable monitoring detail route was excluded: {event_id}",
    )

require(
    stats["polymythcal_artifacts_pruned"]
    == sum((ROOT / relative).is_file() for relative in inner_exclusions),
    "reported pruned-artifact count does not match present retired files",
)
print(
    "POLYMYTHCAL PACKAGE BOUNDARY PASSED — "
    f"{len(retired_ics_ids)} canonical/legacy monitoring ICS ids and 3 private public assets "
    "are excluded from both inner and outer manifests; stable monitoring details remain selected."
)
