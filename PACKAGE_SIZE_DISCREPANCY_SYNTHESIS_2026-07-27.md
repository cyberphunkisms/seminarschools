# Audit49 Package-Size Discrepancy

The two supplied ZIPs are different package classes, not two supposedly identical source packages.

| Package | Internal package kind | Payload files | ZIP entries including manifest | ZIP bytes |
|---|---|---:|---:|---:|
| `ss-site-audit49-technical-efficiency-resilience-final-2026-07-26(1).zip` | `deployer-compatible` | 10,056 | 10,057 | 171,449,486 |
| `ss-site-audit49-ml-full-conversation-final-2026-07-27(1).zip` | `netlify-source` | 5,595 | 5,596 | 118,547,491 |

The exact ZIP difference is 52,901,995 bytes.

## Exact cause

- The older deployer-compatible archive contains 4,477 files under `public/`, totalling 107,485,127 uncompressed bytes and 59,387,308 compressed bytes.
- Of those 4,477 files, 4,476 are byte-identical generated copies of source-root files. The remaining file is the 290-byte generated `public/site-release.json`.
- The newer source archive intentionally excludes `public/`. `npm run build` recreates that deployment tree from the canonical source before verification and packaging.
- The only other older-only path was the 1,014-byte generated `hf_export/reports/privacy_scan_report.md`. This synthesis regenerates the report from the current data rather than copying its stale July 22 version.
- The newer archive adds 17 current files totalling 8,177,916 uncompressed bytes and 7,556,573 compressed bytes. These additions, including the current #MeToo research layer, are preserved without alteration.
- Common-file compression decreased by 55,990 bytes, and ZIP directory/header overhead decreased by 1,014,820 bytes because the source package has 4,461 fewer entries.

Arithmetic:

`171,449,486 − 59,387,758 + 7,556,573 − 55,990 − 1,014,820 = 118,547,491`

## Synthesis decision

The final “best” artifact is deployer-compatible so it contains both the complete current source and a freshly generated current `public/` deployment tree. It does not copy the older stale `public/` folder or either old integrity manifest. It rebuilds `public/`, regenerates the privacy report, runs the full release gate, and creates a new package-content SHA-256 manifest.

The clean extracted tree also exposed one portability defect in the Audit49 packaging evidence: its verifier required fixed counts of pruned dependency/cache directories even when those disposable directories were correctly absent. The repaired gate now checks the actual package boundary—`public/` must be selected by the deployer package and must be absent from the source-package selection—while the existing regression suite continues to test dependency/cache pruning when such directories exist.

No #MeToo file, entry, count, classifier, citation, or verifier rule is removed or altered by this package-format synthesis.
