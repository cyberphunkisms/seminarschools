#!/usr/bin/env python3
"""
test_scrape_seminars.py

Offline correctness tests for the source fetchers in scrape_seminars.py.

Run:
    python3 scripts/test_scrape_seminars.py

Tests parse against saved fixtures from /scripts/test_fixtures/ so they run
without internet access. Production code paths use requests against live
sources and are exercised in the Netlify Function environment.
"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

import scrape_seminars as ss  # noqa: E402

FIXTURES = ROOT / "scripts" / "test_fixtures"


def assert_equal(expected, actual, label):
    if expected != actual:
        print(f"FAIL: {label}\n  expected: {expected!r}\n  actual:   {actual!r}")
        return False
    print(f"PASS: {label}")
    return True


def assert_true(cond, label):
    if not cond:
        print(f"FAIL: {label}")
        return False
    print(f"PASS: {label}")
    return True


def test_director_flag_matches():
    cases_should_match = [
        "Revue Event: THE END OF THE INTERNET – director in attendance + Hybrid Installation!",
        "Revue Event: BLIND COP 2 – Director In Attendance!",
        "Bleak Week: LAST NIGHT (1998) – Q&A with director Don McKellar!",
        "Bleak Week: DARKEST MIRIAM – Q&A with director Naomi Jaye!",
    ]
    cases_should_not_match = [
        "Bleak Week: TO BE TWENTY (Avere vent'anni) – Uncensored Director's Cut",
        "Revue Event: BLUE VELVET – 40th Anniversary Screening!",
        "Throwback Cinema: A BUG'S LIFE (1998)",
        "Anime At The Revue: WHISPER OF THE HEART (1995) – New 4K Restoration!",
        "FOUND FOOTAGE FEST: Volume 11",
    ]
    passed = True
    for title in cases_should_match:
        passed &= assert_true(
            ss.has_director_flag(title), f"director-flag SHOULD match: {title[:50]}"
        )
    for title in cases_should_not_match:
        passed &= assert_true(
            not ss.has_director_flag(title),
            f"director-flag should NOT match: {title[:50]}",
        )
    return passed


def test_revue_markdown_extraction():
    md_text = (FIXTURES / "revue_films_sample.md").read_text(encoding="utf-8")
    blocks = ss.extract_revue_blocks_from_markdown(
        md_text, "https://revuecinema.ca/films/"
    )

    passed = True
    passed &= assert_true(
        len(blocks) >= 8, f"extracted at least 8 blocks (got {len(blocks)})"
    )

    titles = [b[0] for b in blocks]
    passed &= assert_true(
        any("END OF THE INTERNET" in t for t in titles),
        "END OF THE INTERNET block present",
    )
    passed &= assert_true(
        any("BLIND COP 2" in t for t in titles), "BLIND COP 2 block present"
    )
    passed &= assert_true(
        any("Director's Cut" in t for t in titles), "Director's Cut block present"
    )

    return passed


def test_revue_record_building_filters_to_director_events():
    md_text = (FIXTURES / "revue_films_sample.md").read_text(encoding="utf-8")
    blocks = ss.extract_revue_blocks_from_markdown(
        md_text, "https://revuecinema.ca/films/"
    )

    source_config = {
        "id": "revue",
        "events_url": "https://revuecinema.ca/films/",
    }
    records = ss.build_revue_records(blocks, source_config)

    passed = True
    # Four director-attended events; END OF THE INTERNET has two dates so total 5 records
    passed &= assert_equal(
        5,
        len(records),
        f"built 5 records from 4 director-attended films (got {len(records)})",
    )

    titles = sorted({r["title"] for r in records})
    passed &= assert_true(
        any("END OF THE INTERNET" in t for t in titles), "END OF THE INTERNET kept"
    )
    passed &= assert_true(
        any("BLIND COP 2" in t for t in titles), "BLIND COP 2 kept"
    )
    passed &= assert_true(
        any("LAST NIGHT" in t for t in titles), "LAST NIGHT kept"
    )
    passed &= assert_true(
        any("DARKEST MIRIAM" in t for t in titles), "DARKEST MIRIAM kept"
    )
    passed &= assert_true(
        not any("Director's Cut" in t for t in titles),
        "Director's Cut filtered out (false-positive guard)",
    )
    passed &= assert_true(
        not any("BLUE VELVET" in t for t in titles), "BLUE VELVET (no Q&A) filtered out"
    )

    for r in records:
        passed &= assert_true(
            r["confidence"] == 90, f"confidence == 90 for {r['title'][:30]}"
        )
        passed &= assert_true(
            r["type"] == "screening", f"type == screening for {r['title'][:30]}"
        )
        passed &= assert_true(
            r["attendance_confirmed"] is True,
            f"attendance_confirmed True for {r['title'][:30]}",
        )

    return passed


def test_record_ids_are_stable_and_unique():
    md_text = (FIXTURES / "revue_films_sample.md").read_text(encoding="utf-8")
    blocks = ss.extract_revue_blocks_from_markdown(
        md_text, "https://revuecinema.ca/films/"
    )
    source_config = {"id": "revue", "events_url": "https://revuecinema.ca/films/"}

    records_a = ss.build_revue_records(blocks, source_config)
    records_b = ss.build_revue_records(blocks, source_config)

    ids_a = sorted(r["id"] for r in records_a)
    ids_b = sorted(r["id"] for r in records_b)

    passed = True
    passed &= assert_equal(ids_a, ids_b, "record IDs stable across runs")
    passed &= assert_equal(
        len(set(ids_a)), len(ids_a), "record IDs unique within a run"
    )
    return passed


def main():
    print("Running parser-correctness tests against fixtures.\n")
    results = [
        test_director_flag_matches(),
        test_revue_markdown_extraction(),
        test_revue_record_building_filters_to_director_events(),
        test_record_ids_are_stable_and_unique(),
    ]
    passed_count = sum(1 for r in results if r)
    total = len(results)
    print(f"\n{passed_count}/{total} test groups passed.")
    sys.exit(0 if passed_count == total else 1)


if __name__ == "__main__":
    main()
