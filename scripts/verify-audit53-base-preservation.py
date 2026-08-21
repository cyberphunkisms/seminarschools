#!/usr/bin/env python3
"""Verify Audit 52 preservation plus exact, approved successor changes.

Historical baselines are evidence, not a command to resurrect obsolete files.
Every approved deletion is bound to its former hash; all current modifications
are bound as one successor-transition digest so an unapproved byte still fails.

Two exact reports are generated during the release run and therefore cannot
include their own changing bytes in a fixed-point digest.  Their paths remain
in every count and path-set check, while versioned policy tokens stand in for
their live hashes.  The report schemas and semantic gates are checked here;
the final package manifest, clean-room rebuild, and receipt bind their bytes.
"""
from __future__ import annotations

import hashlib
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASELINE = ROOT / "scripts" / "reports" / "audit52-package-baseline.json"
CV_REPORT = ROOT / "scripts" / "reports" / "audit52-greenpeace-base-preservation.json"
LEDGER = ROOT / "data" / "futureproofing" / "approved-change-deletion-ledger.json"
RELEASE_MANIFEST = ROOT / "RELEASE_MANIFEST.json"

CONTENT_POLICY_SCOPE = (
    "all modified Audit 52 baseline files are content-hashed except the two "
    "exact self-updating generated evidence reports, which contribute "
    "versioned policy tokens"
)
CONTENT_POLICY_VERSION = "fp02-generated-evidence-content-policy-v1"
GENERATED_EVIDENCE_CONTENT_EXCLUSIONS = (
    {
        "path": "scripts/reports/audit49-build-packaging-efficiency.json",
        "baseline_sha256": "faca93a36c404488f6801e1b3d3713d13c3b4ffb8e1b1e708e49549d0c80f7f3",
        "writer": "scripts/verify-audit49-build-packaging-efficiency.js",
        "semantic_gate": "node scripts/verify-audit49-build-packaging-efficiency.js",
        "content_policy": "policy_token_only",
        "reason": (
            "The report measures the package selection that includes this report; "
            "its live byte hash is therefore self-referential."
        ),
    },
    {
        "path": "scripts/reports/release-gate-report.json",
        "baseline_sha256": "a5b911eced43a73d4d5fcb7660c64a29c790e4c291587ad60f6e14e9445bc749",
        "writer": "scripts/verify-all-runner.js",
        "semantic_gate": (
            "scripts/verify-all-runner.js plus final artifact receipt verification"
        ),
        "content_policy": "policy_token_only",
        "reason": (
            "The runner can write its final passing report only after FP-02 has run; "
            "its live byte hash is therefore self-referential."
        ),
    },
)
GENERATED_EVIDENCE_BY_PATH = {
    row["path"]: row for row in GENERATED_EVIDENCE_CONTENT_EXCLUSIONS
}

# The 2026-08-15 release began from this already-approved Aug14 successor
# state. Keeping the prior transition identity in code as well as the ledger
# proves exact lineage instead of accepting a new aggregate count with no
# explainable predecessor.
PREVIOUS_TRANSITION = {
    "transition_id": (
        "audit52-to-current-successor-release-2026-08-14-sitewide-canonical-"
        "indra-teacherresources-home-stability-final"
    ),
    "modified_count": 7979,
    "modified_paths_sha256": (
        "bb7bfec3ce4ec4fe18ace502bbc4730d567f34f4672783953d7cdddd1af4ddfd"
    ),
    "raw_content_hashed_count": 7977,
    "generated_evidence_content_exclusion_count": 2,
    "modified_content_policy_sha256": (
        "f46d091e9760f80a0b88416d93837648d708d7174d85ccbf44f210275e8c575a"
    ),
}

APPROVED_SUCCESSOR_ADDITION_COUNT = 473
APPROVED_SUCCESSOR_ADDITION_PATHS_SHA256 = (
    "2f87b177d05e9d5285af0791865d6a57fd7f75d41e00d295c6dc31203ad476f0"
)
APPROVED_SUCCESSOR_ADDITION_ROWS_SHA256 = (
    "57120802f9025b0b673df19a950bebfd4155b57a7064d7abb155982660458d58"
)
APPROVED_SUCCESSOR_ADDITION_CATEGORY_COUNTS = {
    "source_event_ics": 226,
    "source_feeds": 3,
    "public_event_ics": 226,
    "public_feeds": 3,
    "named": 15,
}
APPROVED_SUCCESSOR_NAMED_PATHS = (
    "WEBSITE_CL_2026-07-19.md",
    "data/polymythcal-event-schema-v2.json",
    "data/website-cl.jsonl",
    "docs/WEBSITE_CL_2026-07-19.md",
    "scripts/festivals-prompt.md",
    "scripts/polymythcal_adapters.py",
    "scripts/regen-bookwormburrows-txt.js",
    "scripts/regen-campaigncodex-txt.js",
    "scripts/regen-modulecanon-txt.js",
    "scripts/test_polymythcal_adapters.py",
    "scripts/validate-polymythcal.py",
    "scripts/verify-festival-parent-taxonomy.js",
    "scripts/verify-public-deploy-parity.js",
    "scripts/verify-register.js",
    "scripts/verify-repository-walk-policy.js",
)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def aggregate(lines: list[str]) -> str:
    digest = hashlib.sha256()
    for line in sorted(lines):
        digest.update(line.encode("utf-8"))
    return digest.hexdigest()


def validate_generated_evidence_policy_rows(rows: object) -> list[dict]:
    """Require the ledger to mirror the exact, code-owned two-path policy."""
    assert isinstance(rows, list), "generated-evidence exclusions must be a list"
    assert rows == list(GENERATED_EVIDENCE_CONTENT_EXCLUSIONS), (
        "generated-evidence exclusions differ from the exact code-owned policy"
    )
    assert len({row["path"] for row in rows}) == len(rows), (
        "duplicate generated-evidence exclusion path"
    )
    assert all("*" not in row["path"] and "?" not in row["path"] for row in rows), (
        "generated-evidence exclusions must be exact paths, never patterns"
    )
    return rows


def modified_content_policy_digest(modified: list[tuple[str, str]]) -> str:
    """Hash raw successor bytes except for the two versioned policy tokens."""
    lines: list[str] = []
    for relative, current_sha in modified:
        policy = GENERATED_EVIDENCE_BY_PATH.get(relative)
        if policy is None:
            lines.append(f"{relative}\0{current_sha}\n")
            continue
        token = "\0".join(
            [
                CONTENT_POLICY_VERSION,
                relative,
                policy["baseline_sha256"],
                policy["writer"],
                policy["semantic_gate"],
            ]
        )
        lines.append(f"{relative}\0POLICY\0{token}\n")
    return aggregate(lines)


def validate_generated_evidence_reports(
    baseline: dict,
    modified: list[tuple[str, str]],
    policy_rows: list[dict],
    root: Path,
) -> None:
    """Validate the exact reports whose live hashes are policy-substituted."""
    baseline_by_path = {row["path"]: row for row in baseline["files"]}
    modified_paths = {path for path, _ in modified}
    release = json.loads((root / "RELEASE_MANIFEST.json").read_text(encoding="utf-8"))

    for policy in policy_rows:
        relative = policy["path"]
        prior = baseline_by_path.get(relative)
        assert prior is not None, f"generated evidence is not in Audit 52: {relative}"
        assert prior["sha256"] == policy["baseline_sha256"], (
            f"generated-evidence baseline hash drifted: {relative}"
        )
        current = root / relative
        assert current.is_file() and not current.is_symlink(), (
            f"generated evidence must be a regular file: {relative}"
        )
        assert relative in modified_paths, (
            f"generated evidence unexpectedly matches its historical baseline: {relative}"
        )
        try:
            report = json.loads(current.read_text(encoding="utf-8"))
        except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
            raise AssertionError(f"generated evidence is not valid JSON: {relative}") from error

        if relative.endswith("audit49-build-packaging-efficiency.json"):
            assert report.get("schema") == (
                "seminar-schools-audit49-build-packaging-efficiency-v1"
            ), relative
            assert report.get("status") == "passed", relative
            assert report.get("failures") == [], relative
            assert report.get("release_id") == release.get("release_id"), relative
            assert report.get("generated_at") == release.get("generated_at"), relative
            continue

        assert relative.endswith("release-gate-report.json"), relative
        assert report.get("generated_at") == release.get("generated_at"), relative
        total = report.get("total_checks")
        passed = report.get("passed_checks")
        failures = report.get("failed_checks")
        status = report.get("status")
        assert isinstance(total, int) and total > 0, relative
        assert isinstance(passed, int) and 0 <= passed <= total, relative
        assert isinstance(failures, list), relative
        assert status in {"passed", "failed"}, relative
        if status == "passed":
            assert passed == total and failures == [], relative
        else:
            # The bounded runner stops scheduling new work after a failure, so
            # failed_checks contains executed failures rather than every check
            # that was never started.  Keep failed reports recoverable while a
            # passing report still requires every check above.
            assert passed < total and len(failures) >= 1, relative
            assert passed + len(failures) <= total, relative


def approved_successor_rows_digest(rows: list[dict]) -> str:
    """Bind every reviewed row and metadata field without duplicating 466 rows."""
    payload = json.dumps(
        rows,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def successor_addition_category(relative: str) -> str:
    if relative.startswith("polymythseminars/ics/"):
        return "source_event_ics"
    if relative.startswith("polymythseminars/feeds/"):
        return "source_feeds"
    if relative.startswith("public/polymythseminars/ics/"):
        return "public_event_ics"
    if relative.startswith("public/polymythseminars/feeds/"):
        return "public_feeds"
    return "named"


def validate_approved_successor_additions(
    baseline: dict,
    modified: list[tuple[str, str]],
    transition: dict,
    root: Path,
) -> None:
    """Prove exact lineage from the prior 7,979-path Aug14 successor state."""
    prior = transition.get("previous_transition")
    assert prior == PREVIOUS_TRANSITION, (
        "previous successor transition differs from the exact code-owned lineage"
    )
    rows = transition.get("approved_successor_additions")
    assert isinstance(rows, list), "successor additions must be a list"
    assert len(rows) == APPROVED_SUCCESSOR_ADDITION_COUNT, (
        "successor addition count differs from the exact reviewed inventory"
    )
    assert approved_successor_rows_digest(rows) == (
        APPROVED_SUCCESSOR_ADDITION_ROWS_SHA256
    ), "successor addition rows differ from the exact code-owned inventory"
    assert all(isinstance(row, dict) for row in rows), (
        "every successor addition must be an object"
    )
    paths = [row["path"] for row in rows]
    assert len(paths) == len(set(paths)), "duplicate approved successor addition path"
    assert paths == sorted(paths), "successor additions must use canonical path order"
    assert aggregate([f"{path}\n" for path in paths]) == (
        APPROVED_SUCCESSOR_ADDITION_PATHS_SHA256
    ), "successor addition path inventory drifted"
    assert all("*" not in path and "?" not in path for path in paths), (
        "successor additions must be exact paths, never patterns"
    )
    categories = Counter(successor_addition_category(path) for path in paths)
    assert dict(categories) == APPROVED_SUCCESSOR_ADDITION_CATEGORY_COUNTS, (
        "successor addition category inventory drifted"
    )
    named_paths = tuple(
        path for path in paths if successor_addition_category(path) == "named"
    )
    assert named_paths == APPROVED_SUCCESSOR_NAMED_PATHS, (
        "named successor addition inventory drifted"
    )

    baseline_by_path = {row["path"]: row for row in baseline["files"]}
    modified_by_path = dict(modified)
    for index, row in enumerate(rows, 1):
        relative = row["path"]
        assert row.get("approval") == "approved_by_successor_release_policy", relative
        assert row.get("decision_id") == f"FP-02-2026-08-15-{index:03d}", relative
        assert row.get("classification") and row.get("reason"), relative
        assert row.get("semantic_gate"), relative
        before = baseline_by_path.get(relative)
        assert before is not None, f"successor addition is not in Audit 52: {relative}"
        assert before["sha256"] == row["before_sha256"], relative
        assert before["bytes"] == row["before_bytes"], relative
        assert relative in modified_by_path, (
            f"approved successor addition unexpectedly matches Audit 52: {relative}"
        )
        current = root / relative
        assert current.is_file() and not current.is_symlink(), relative
        assert current.stat().st_size == row["after_bytes"], relative
        assert modified_by_path[relative] == row["after_sha256"], relative

    addition_paths = set(paths)
    assert addition_paths.isdisjoint(GENERATED_EVIDENCE_BY_PATH), (
        "reviewed successor additions must remain raw content-hashed"
    )
    prior_modified = [row for row in modified if row[0] not in addition_paths]
    assert len(prior_modified) == prior["modified_count"], (
        "removing reviewed additions does not reconstruct prior modified count"
    )
    assert aggregate([f"{path}\n" for path, _ in prior_modified]) == (
        prior["modified_paths_sha256"]
    ), "removing reviewed additions does not reconstruct prior modified paths"
    assert len(prior_modified) - len(GENERATED_EVIDENCE_CONTENT_EXCLUSIONS) == (
        prior["raw_content_hashed_count"]
    ), "prior raw content-hash count cannot be reconstructed"
    assert len(GENERATED_EVIDENCE_CONTENT_EXCLUSIONS) == (
        prior["generated_evidence_content_exclusion_count"]
    ), "prior generated-evidence policy count drifted"
    # The retained Aug14 path set legitimately contains current successor byte
    # changes, so its historical digest remains lineage evidence while the
    # current bytes are bound separately by the transition below.
    assert modified_content_policy_digest(prior_modified) == transition.get(
        "retained_previous_paths_current_content_policy_sha256"
    ), "current content on the retained prior path set drifted"
    assert len(modified) == prior["modified_count"] + len(rows), (
        "current modified count is not prior state plus exact reviewed additions"
    )


def validate_approved_deletions(
    baseline: dict,
    ledger: dict,
    root: Path,
) -> tuple[dict[str, dict], list[str]]:
    """Return exact approved deletions and the actual missing baseline paths."""
    baseline_by_path = {row["path"]: row for row in baseline["files"]}
    approved_rows = ledger.get("approved_deletions") or []
    approved_by_path = {row.get("path"): row for row in approved_rows}
    assert len(approved_by_path) == len(approved_rows), "duplicate approved deletion path"
    for relative, approval in approved_by_path.items():
        prior = baseline_by_path.get(relative)
        assert prior is not None, f"approved deletion is not in baseline: {relative}"
        assert approval.get("approval") == "approved_by_repository_policy", relative
        assert approval.get("current_state") == "absent", relative
        assert approval.get("before_sha256") == prior["sha256"], relative
        assert approval.get("before_bytes") == prior["bytes"], relative
        assert approval.get("decision_id") and approval.get("reason"), relative
        assert not (root / relative).exists(), (
            f"approved deletion reappeared and must be reviewed as a new change: {relative}"
        )
    missing = [row["path"] for row in baseline["files"] if not (root / row["path"]).is_file()]
    assert set(missing) == set(approved_by_path), (
        "Audit 52 missing-file set differs from exact approved deletions: "
        f"missing={missing[:10]} approved={sorted(approved_by_path)[:10]}"
    )
    return approved_by_path, missing


def main() -> None:
    ledger = json.loads(LEDGER.read_text(encoding="utf-8"))
    assert ledger["schema"] == "seminar-schools-approved-change-deletion-ledger-v3"
    assert ledger["baseline"]["path"] == BASELINE.relative_to(ROOT).as_posix()
    assert ledger["baseline"]["sha256"] == sha256(BASELINE), (
        "approved-change ledger is bound to a different Audit 52 baseline"
    )
    baseline = json.loads(BASELINE.read_text(encoding="utf-8"))
    approved_by_path, missing = validate_approved_deletions(baseline, ledger, ROOT)
    modified: list[tuple[str, str]] = []

    for row in baseline["files"]:
        relative = row["path"]
        current = ROOT / relative
        if not current.is_file():
            continue
        current_sha = sha256(current)
        if current_sha != row["sha256"]:
            modified.append((relative, current_sha))

    modified_paths_sha = aggregate([f"{path}\n" for path, _ in modified])
    transition = ledger.get("approved_transition") or {}
    assert transition.get("approval") == "approved_by_successor_release_policy"
    validate_approved_successor_additions(baseline, modified, transition, ROOT)
    policy_rows = validate_generated_evidence_policy_rows(
        transition.get("generated_evidence_content_exclusions")
    )
    validate_generated_evidence_reports(baseline, modified, policy_rows, ROOT)
    modified_content_policy_sha = modified_content_policy_digest(modified)
    raw_content_hashed_count = len(modified) - len(policy_rows)
    assert len(modified) == transition.get("modified_count"), (
        f"successor modified-file count drifted: {len(modified)} "
        f"!= {transition.get('modified_count')}"
    )
    assert modified_paths_sha == transition.get("modified_paths_sha256"), (
        "successor modified-path set drifted"
    )
    assert transition.get("content_digest_scope") == CONTENT_POLICY_SCOPE, (
        "successor content-digest scope drifted"
    )
    assert transition.get("raw_content_hashed_count") == raw_content_hashed_count, (
        "successor raw content-hash count drifted"
    )
    assert transition.get("generated_evidence_content_exclusion_count") == len(policy_rows), (
        "successor generated-evidence exclusion count drifted"
    )
    assert modified_content_policy_sha == transition.get("modified_content_policy_sha256"), (
        "successor modified content/policy digest drifted"
    )
    for relative in transition.get("evidence") or []:
        assert (ROOT / relative).is_file(), f"successor transition evidence missing: {relative}"

    cv = json.loads(CV_REPORT.read_text(encoding="utf-8"))
    assert cv["status"] == "passed"
    assert cv["cv_greenpeace_files_missing"] == []
    assert cv["cv_greenpeace_files_modified"] == []
    current_cv_updates = 0
    for row in cv["cv_greenpeace_files"]:
        current = ROOT / row["path"]
        assert current.is_file(), row["path"]
        if current.stat().st_size != row["bytes"] or sha256(current) != row["sha256"]:
            current_cv_updates += 1

    exact = len(baseline["files"]) - len(modified) - len(missing)
    print(
        "AUDIT 53 SUCCESSOR PRESERVATION PASSED — "
        f"{len(baseline['files'])} Audit 52 rows governed; "
        f"{exact} byte-identical; {len(modified)} governed Audit 53 changes; "
        f"{raw_content_hashed_count} raw content hashes plus "
        f"{len(policy_rows)} exact generated-evidence policy tokens; "
        f"{len(missing)} exact approved deletions; "
        f"{len(cv['cv_greenpeace_files'])} Greenpeace/CV files retained "
        f"({current_cv_updates} successor updates covered by the transition digest)."
    )


if __name__ == "__main__":
    main()
