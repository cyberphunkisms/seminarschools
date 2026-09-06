#!/usr/bin/env python3
"""Append verified Set 13 and Set 15 state to the private editable master."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path


SITE_ROOT = Path(__file__).resolve().parents[1]
DELIVERY_ROOT = SITE_ROOT.parent
EDITABLE_ROOT = DELIVERY_ROOT / "EDITABLE_MASTERS"
MASTER = EDITABLE_ROOT / "05_POLYMYTHCAL" / "Polymythcal_Research_and_Remediation_Plan.json"
MANIFEST = EDITABLE_ROOT / "EDITABLE_MASTERS_MANIFEST.json"
SUMS = EDITABLE_ROOT / "SHA256SUMS.txt"
MANUAL = SITE_ROOT / "data" / "manual-events.json"
CANONICAL = SITE_ROOT / "data" / "polymyth-seminar-events.json"
PUBLISHED = SITE_ROOT / "polymythseminars" / "events.json"
BROWSE = SITE_ROOT / "polymythseminars" / "browse.json"
WATCHLIST = SITE_ROOT / "polymythseminars" / "watchlist.json"
RESEARCH = SITE_ROOT / "polymythseminars" / "research.json"
SOURCES = SITE_ROOT / "scripts" / "sources.json"

SET13_LEDGER = SITE_ROOT / "data" / "polymythcal-research-set-13-community-charity-mutual-aid-heritage-place-2026-08-15.json"
SET13_EXCLUSIONS = SITE_ROOT / "data" / "polymythcal-research-set-13-community-charity-mutual-aid-heritage-place-exclusions-2026-08-15.json"
SET15_LEDGER = SITE_ROOT / "data" / "polymythcal-research-set-15-courses-multi-session-programs-2026-08-15.json"
SET15_EXCLUSIONS = SITE_ROOT / "data" / "research" / "polymythcal-set15-courses-multi-session-programs-2026-08-15" / "exclusions.json"

SET13_SRC = "manual-polymythcal-community-charity-mutual-aid-heritage-place-set13-2026-08-15"
SET14_SRC = "manual-polymythcal-live-media-digitally-native-set14-2026-08-15"
SET15_SRC = "manual-polymythcal-courses-multi-session-programs-set15-2026-08-15"
SET13_NAME = "13-Community-Charity-Mutual-Aid-Heritage-Place"
SET15_NAME = "15-Courses-and-Multi-Session-Programs"

SET13_FIELDS = [
    "community_heritage_formats", "community_participation_roles", "contribution_routes",
    "beneficiary_or_cause", "place_relation", "community_evidence",
    "community_heritage_scope", "community_public_access_status",
    "community_registration_required", "community_participation_mode",
    "community_date_evidence", "community_access_evidence",
    "community_participation_evidence", "community_beneficiary_evidence",
    "community_place_evidence", "community_heritage_evidence", "set13_classified_at",
]

SET15_FIELDS = [
    "course_program_formats", "program_stage", "schedule_model", "session_count",
    "program_stage_source_value", "program_schedule_detail", "program_start_date",
    "program_end_date", "eligibility_audience", "registration_application_route",
    "program_date_precision", "application_deadline", "registration_deadline",
    "session_count_status", "parent_id", "child_ids", "series_role",
    "alternate_sections", "evidence_facts", "evidence", "source_control",
    "program_evidence", "set15_alternate_date_details", "set15_child_ids",
    "set15_eligibility_audience", "set15_evidence_source_id",
    "set15_evidence_source_name", "set15_evidence_source_url", "set15_parent_id",
    "set15_program_start_date", "set15_program_end_date",
    "set15_program_evidence_facts", "set15_program_stage_source",
    "set15_registration_application_route", "set15_schedule_model_source",
    "set15_series_role", "set15_series_role_source", "set15_session_count_status",
    "set15_source_caveats", "set15_source_formats", "set15_time_precision_source",
    "set15_classified_at",
]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def events(document) -> list[dict]:
    return document if isinstance(document, list) else document.get("events", [])


def equal(left, right) -> bool:
    return left == right


def has_browser_value(value) -> bool:
    return value is not None and value != "" and not (isinstance(value, list) and not value)


def assert_propagation(
    tagged: list[dict],
    fields: list[str],
    canonical: list[dict],
    published: list[dict],
    chronology: list[dict],
    monitoring: list[dict],
    research: dict,
    facet_axis: str,
) -> None:
    canonical_map = {row["id"]: row for row in canonical}
    published_map = {row["id"]: row for row in published}
    chronology_map = {row["id"]: row for row in chronology}
    monitoring_map = {row["id"]: row for row in monitoring}
    public_map = {**chronology_map, **monitoring_map}
    research_map = {row["id"]: row for row in research.get("records", [])}
    allowed_facets = set(
        (research.get("taxonomy", {}).get("axes", {}).get(facet_axis, {}).get("values", {}))
    )
    for authored in tagged:
        for output_map in (canonical_map, published_map):
            output = output_map.get(authored["id"])
            if output is None:
                raise SystemExit(f"{authored['id']}: missing from an editable-master proof surface")
            for field in fields:
                if field in authored and not equal(output.get(field), authored[field]):
                    raise SystemExit(f"{authored['id']}: {field} changed before editable-master update")
        compact = public_map.get(authored["id"])
        if compact is None:
            raise SystemExit(f"{authored['id']}: missing from both public browser projections")
        specialist = research_map.get(authored["id"])
        for field in fields:
            if field in compact or (specialist is not None and field in specialist):
                raise SystemExit(f"{authored['id']}: private {field} leaked into a browser projection")

        expected_facets = list(dict.fromkeys(
            value for value in authored.get(fields[0], []) if value in allowed_facets
        ))
        if authored["id"] in chronology_map:
            if specialist is None:
                raise SystemExit(f"{authored['id']}: missing from the chronology Research projection")
            actual_facets = specialist.get("facets", {}).get(facet_axis, [])
            if not equal(actual_facets, expected_facets):
                raise SystemExit(f"{authored['id']}: exact {facet_axis} facets changed in Research")
        elif authored["id"] in monitoring_map:
            if specialist is not None:
                raise SystemExit(f"{authored['id']}: monitoring record leaked into chronology Research")
        else:
            raise SystemExit(f"{authored['id']}: missing from the chronology/watchlist partition")


def update_manifest() -> None:
    digest = sha256(MASTER)
    manifest = load(MANIFEST)
    rows = manifest.get("files") or []
    matches = [
        row for row in rows
        if row.get("path") == "05_POLYMYTHCAL/Polymythcal_Research_and_Remediation_Plan.json"
    ]
    if len(matches) != 1:
        raise SystemExit("Editable master manifest must contain exactly one Polymythcal row")
    matches[0].update({
        "bytes": MASTER.stat().st_size,
        "sha256": digest,
        "status": "preserved historical source context plus append-only verified Sets 1-15 Polymythcal research; never publish",
    })
    manifest["generated_on"] = "2026-08-15"
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    sums: dict[str, str] = {}
    for line in SUMS.read_text(encoding="utf-8").splitlines():
        if line.strip():
            expected, relative = line.split(None, 1)
            sums[relative.strip()] = expected
    sums["05_POLYMYTHCAL/Polymythcal_Research_and_Remediation_Plan.json"] = digest
    SUMS.write_text(
        "".join(f"{value}  {key}\n" for key, value in sorted(sums.items())),
        encoding="utf-8",
    )


def main() -> int:
    manual_doc = load(MANUAL)
    manual = events(manual_doc)
    canonical = events(load(CANONICAL))
    published = events(load(PUBLISHED))
    browse = events(load(BROWSE))
    watchlist = load(WATCHLIST).get("items", [])
    research = load(RESEARCH)
    browser_records = [*browse, *watchlist]
    source_doc = load(SOURCES)
    sources = source_doc if isinstance(source_doc, list) else source_doc.get("sources", [])
    set13_ledger = load(SET13_LEDGER)
    set13_exclusions = load(SET13_EXCLUSIONS)
    set15_ledger = load(SET15_LEDGER)
    set15_exclusions = load(SET15_EXCLUSIONS)

    if (
        len(manual), len(canonical), len(published), len(browse), len(watchlist), len(sources)
    ) != (1798, 2088, 2088, 1954, 134, 779):
        raise SystemExit(
            "Refusing editable-master update: expected final manual/canonical/public/"
            "chronology/watchlist/source inventory 1798/2088/2088/1954/134/779; found "
            f"{len(manual)}/{len(canonical)}/{len(published)}/{len(browse)}/"
            f"{len(watchlist)}/{len(sources)}"
        )
    browser_ids = [str(row.get("id") or "") for row in browser_records]
    if not all(browser_ids) or len(browser_ids) != len(set(browser_ids)) or len(browser_ids) != len(canonical):
        raise SystemExit("Refusing editable-master update: chronology/watchlist is not a unique complete partition")
    ids = [str(row.get("id") or "") for row in manual]
    if not all(ids) or len(ids) != len(set(ids)):
        raise SystemExit("Refusing editable-master update: manual event IDs are missing or duplicated")

    set13_batch = [row for row in manual if row.get("_src") == SET13_SRC]
    set13_tagged = [row for row in manual if row.get("community_heritage_formats")]
    set13_meta = manual_doc.get("polymythcal_community_charity_mutual_aid_heritage_place_set13_update_2026_08_15") or {}
    if (len(set13_batch), len(set13_tagged), set13_ledger.get("record_count")) != (120, 170, 170):
        raise SystemExit("Refusing editable-master update: Set 13 accounting drifted")
    if (
        set13_meta.get("records_added_latest_run") != 0
        or set13_meta.get("existing_records_cross_tagged") != 50
        or set13_meta.get("parent_records") != 8
        or set13_meta.get("child_occurrences") != 33
        or set13_meta.get("confirmed_records") != 101
        or set13_meta.get("qualified_records") != 19
    ):
        raise SystemExit("Refusing editable-master update: Set 13 idempotency/structure/evidence drifted")
    if len(set13_exclusions) != 9 and set13_exclusions.get("exclusion_count") != 9:
        raise SystemExit("Refusing editable-master update: Set 13 exclusions drifted")
    assert_propagation(
        set13_tagged, SET13_FIELDS, canonical, published, browse, watchlist, research, "communityFormats"
    )

    set15_batch = [row for row in manual if row.get("_src") == SET15_SRC]
    set15_tagged = [row for row in manual if row.get("course_program_formats")]
    set15_meta = manual_doc.get("polymythcal_courses_multi_session_programs_set15_update_2026_08_15") or {}
    if (len(set15_batch), len(set15_tagged), set15_ledger.get("record_count")) != (72, 81, 81):
        raise SystemExit("Refusing editable-master update: Set 15 accounting drifted")
    if (
        set15_meta.get("records_added_latest_run") != 0
        or set15_meta.get("existing_records_cross_tagged") != 9
        or set15_meta.get("parent_records") != 7
        or set15_meta.get("child_occurrences") != 18
        or set15_meta.get("confirmed_records") != 61
        or set15_meta.get("qualified_records") != 11
    ):
        raise SystemExit("Refusing editable-master update: Set 15 idempotency/structure/evidence drifted")
    if len(set15_exclusions) != 12:
        raise SystemExit("Refusing editable-master update: Set 15 exclusions drifted")
    assert_propagation(
        set15_tagged, SET15_FIELDS, canonical, published, browse, watchlist, research, "programFormats"
    )

    source_ids = {str(row.get("id") or "") for row in sources}
    set13_source_ids = {str(row.get("id") or "") for row in set13_ledger.get("sources") or []}
    set15_source_ids = {
        str(row.get("set15_evidence_source_id") or "")
        for row in [*set15_ledger.get("records", []), *(item.get("set15_fields") or {} for item in set15_ledger.get("cross_tags", []))]
    }
    if len(set13_source_ids) != 31 or not set13_source_ids <= source_ids:
        raise SystemExit("Refusing editable-master update: Set 13 source registry is incomplete")
    if len(set15_source_ids) != 32 or not set15_source_ids <= source_ids:
        raise SystemExit("Refusing editable-master update: Set 15 source registry is incomplete")

    master = load(MASTER)
    master["community_charity_mutual_aid_heritage_place_set13_update_2026_08_15"] = {
        "status": "integrated_into_editable_and_public_site_source",
        "implemented_at": "2026-08-15T18:00:00-04:00",
        "research_set": SET13_NAME,
        "research_actions": 170,
        "net_new_records": 120,
        "existing_records_cross_tagged": 50,
        "new_source_records": 31,
        "parent_records": 8,
        "child_occurrences": 33,
        "confirmed_records": 101,
        "qualified_records": 19,
        "excluded_candidates": 9,
        "scope": [
            "charity walks, runs and rides; fundraisers; benefit performances; food and clothing drives",
            "mutual aid, volunteering, community cleanups, repair cafes, and community gardens",
            "assemblies, meals, block parties, markets, and newcomer or diaspora gatherings",
            "historical and architecture walks, cemetery tours, public digs, reenactments, archives, Doors Open, and land-based learning",
        ],
        "fields": SET13_FIELDS,
        "front_facing_formats": sorted(set13_ledger.get("format_counts") or {}),
        "decisions": [
            "Existing stable IDs are cross-tagged in place; date, title, status, and source identity remain unchanged.",
            "Community participation, contribution, beneficiary, access, place, and heritage claims remain independent and evidence-bearing.",
            "Series parents and their dated children remain separate linked records.",
            "Land-based learning requires explicit source evidence and is never inferred from a venue alone.",
        ],
        "implementation_files": [
            "SITE_PACKAGE/scripts/import-polymythcal-community-charity-mutual-aid-heritage-place-set13-2026-08-15.py",
            "SITE_PACKAGE/scripts/verify-polymythcal-community-charity-mutual-aid-heritage-place-set13-2026-08-15.js",
            "SITE_PACKAGE/data/polymythcal-research-set-13-community-charity-mutual-aid-heritage-place-2026-08-15.json",
            "SITE_PACKAGE/data/polymythcal-event-schema-v2.json",
            "SITE_PACKAGE/js/polymythcal-revamp.js",
        ],
        "verification": {
            "manual_records": len(manual), "consolidated_records": len(canonical),
            "public_records": len(published), "browser_records": len(browser_records),
            "chronology_records": len(browse), "monitoring_records": len(watchlist),
            "sources": len(sources), "set13_new_cross_tagged_total": "120/50/170", "status": "pass",
        },
        "deployment_status": "updated_deployable_source_and_public_mirror_not_live_deployed",
        "change_list": [f"CL-WEB-{number}" for number in range(276, 284)],
        "research_ledger": {
            "path": "SITE_PACKAGE/data/polymythcal-research-set-13-community-charity-mutual-aid-heritage-place-2026-08-15.json",
            "sha256": sha256(SET13_LEDGER), "record_count": 170, "exclusion_count": 9,
        },
    }
    master["courses_multi_session_programs_set15_update_2026_08_15"] = {
        "status": "integrated_into_editable_and_public_site_source",
        "implemented_at": "2026-08-15T18:00:00-04:00",
        "research_set": SET15_NAME,
        "research_actions": 81,
        "net_new_records": 72,
        "existing_records_cross_tagged": 9,
        "new_source_records": 32,
        "parent_records": 7,
        "child_occurrences": 18,
        "confirmed_records": 61,
        "qualified_records": 11,
        "excluded_candidates": 12,
        "scope": [
            "public courses, summer schools, camps, academies, institutes, and intensives",
            "masterclass series, cohorts, mentorships, film and theatre labs",
            "research and field schools, study tours, and teacher professional development",
            "admissions and registration stages, open houses, orientations, convocations, and academic showcases",
        ],
        "fields": SET15_FIELDS,
        "front_facing_formats": sorted(set15_ledger.get("format_counts") or set15_ledger.get("normalized_format_counts") or {}),
        "decisions": [
            "Existing stable IDs are cross-tagged in place and retain their accepted date, title, status, and source identity.",
            "Normalized program stage and schedule models retain the exact source-native detail alongside them.",
            "Parents, bounded runs, applications, deadlines, and dated sessions remain distinct.",
            "The unsupported Historical Thinking Institute date conflict remains an exclusion rather than being propagated.",
        ],
        "implementation_files": [
            "SITE_PACKAGE/scripts/prepare-polymythcal-courses-multi-session-programs-set15-2026-08-15.py",
            "SITE_PACKAGE/scripts/import-polymythcal-courses-multi-session-programs-set15-2026-08-15.py",
            "SITE_PACKAGE/scripts/verify-polymythcal-courses-multi-session-programs-set15-2026-08-15.js",
            "SITE_PACKAGE/data/polymythcal-research-set-15-courses-multi-session-programs-2026-08-15.json",
            "SITE_PACKAGE/data/polymythcal-event-schema-v2.json",
            "SITE_PACKAGE/js/polymythcal-revamp.js",
        ],
        "verification": {
            "manual_records": len(manual), "consolidated_records": len(canonical),
            "public_records": len(published), "browser_records": len(browser_records),
            "chronology_records": len(browse), "monitoring_records": len(watchlist),
            "sources": len(sources), "set15_new_cross_tagged_total": "72/9/81", "status": "pass",
        },
        "deployment_status": "updated_deployable_source_and_public_mirror_not_live_deployed",
        "change_list": [f"CL-WEB-{number}" for number in range(292, 300)],
        "research_ledger": {
            "path": "SITE_PACKAGE/data/polymythcal-research-set-15-courses-multi-session-programs-2026-08-15.json",
            "sha256": sha256(SET15_LEDGER), "record_count": 81, "exclusion_count": 12,
        },
    }
    master["sets1_15_site_synthesis_2026_08_15"] = {
        "status": "verified_source_synthesis_complete",
        "implemented_at": "2026-08-15T18:00:00-04:00",
        "canonical_events": len(canonical),
        "manual_research_records": len(manual),
        "registered_sources": len(sources),
        "decision": "Sets 1-15 rebuild through one canonical pipeline while every-page geometry, Teacher Resources state/layout repair, stable homepage selection, and exact researched-field propagation remain release gates.",
        "change_list": ["CL-WEB-300"],
        "deployment_status": "deployable_package_not_live_deployed",
    }
    MASTER.write_text(json.dumps(master, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    update_manifest()
    print(json.dumps({
        "master": str(MASTER), "set13_tagged": len(set13_tagged),
        "set15_tagged": len(set15_tagged), "bytes": MASTER.stat().st_size,
        "sha256": sha256(MASTER),
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
