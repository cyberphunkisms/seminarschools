# Futureproofing release contract

This release keeps three things distinct:

1. `SITE_PACKAGE/public/` is the deployable, reader-facing website.
2. `SITE_PACKAGE/` is the complete source and operator workspace.
3. `EDITABLE_MASTERS/` and `DEPLOY_TOOLS/` stay in the complete handoff ZIP but never enter the public deploy tree.

The machine-readable registry is `data/futureproofing/futureproofing-contract.json`. It enumerates every control from FP-01 through FP-15, its verifier, its deliberate failure fixture, and the evidence fields a passing result must contain. `scripts/verify-futureproofing-contract.py` rejects a missing ID, a placeholder in a final release, a missing verifier or fixture, and a source gate that exits nonzero.

## Artifact identity

The complete ZIP remains deterministic and self-verifying through its embedded `PACKAGE_CONTENTS_SHA256.json` and sibling `.sha256` file. After the archive exists, the wrapper writes external clean-room and disaster-recovery reports, then `scripts/create-artifact-audit-receipt.py` writes a separate `<zip>.audit-receipt.json`. Keeping all three proofs outside the archive avoids an impossible self-hash. The receipt binds the exact ZIP bytes, checksum sidecar, embedded package manifest, runtime and package release identities, release-gate counts, futureproofing-gate counts, final audit report, clean-copy rebuild, clean restore, and tool versions. The verifier recomputes those values from the ZIP, sidecar, and two named sibling reports; it does not accept claimed status/count overrides.

## Historical changes

`data/futureproofing/approved-change-deletion-ledger.json` replaces the stale assumption that every Audit 52 file must still exist forever. Five obsolete generated/sample artifacts have exact before-hash deletion approvals. They remain absent. The full set of changed baseline files is bound by count and path-set digest. Every authored or source change is also raw-content-hashed. Exactly two self-updating JSON reports use hard-coded, versioned policy tokens instead of circular live hashes; their schemas and semantic gates are checked, and their final bytes remain bound by the package manifest, independent clean-room rebuild, disaster-recovery proof, and artifact receipt. No wildcard or report-directory exemption exists.

## Writers and recovery

`data/futureproofing/canonical-ownership-map.json` gives every governed release output one writer and one public/private classification. Canonical build and package entry points must run beneath `scripts/run-with-build-lock.py`; an operating-system advisory lease blocks a second writer, while recorded token and process identity remain diagnostic evidence. `scripts/verify-clean-room-release.py` requires the locked primary package and an independent clean-copy rebuild to produce byte-identical archives. The rebuild installs all 22 resolved Python audit distributions from a 332-hash lock and confirms the installed inventory. `scripts/verify-disaster-recovery.py` then restores the complete ZIP into a temporary directory and checks every manifested file, the source root, deployment tools, and every editable master.

## Permanent public/private boundary

`data/futureproofing/public-private-boundary.json` is the lasting boundary policy. `scripts/verify-public-private-boundary.py` rejects private roots, operator artifacts, secret-shaped values, unsafe links, or package tooling in the public deploy tree. The same gate verifies that the complete handoff still contains the source package, deployment tools, and hash-verified editable masters. The goal is not to remove private working material; it is to ship it in the correct artifact class.

The final handoff is therefore a five-file set: the complete ZIP, its `.sha256`, its `.clean-room-report.json`, its `.disaster-recovery-report.json`, and its `.audit-receipt.json`. A ZIP without the four matching siblings is incomplete release evidence.
