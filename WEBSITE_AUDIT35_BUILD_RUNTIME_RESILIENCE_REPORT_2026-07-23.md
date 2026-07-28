# Website Audit 35 — Build and Runtime Resilience

Date: 2026-07-23  
Scope: non-security build, runtime, delivery, CI, evidence, and package resilience

## Direction

No architecture, schedule, content, route, or visual-direction decision changed.
The four-hour no-shard protest crawl, three-operating-system clean build/tests,
full Audit 14 gate, and all browser/predeployment protections remain held.
Audit 34 evidence and gates remain historical records.

## Tier 0 fixes

- Added a reuse-built release-verifier mode. A canonical build followed by the
  complete verifier no longer regenerates the browser payload, public tree,
  asset report, or four build-owned gates in the same job.
- Made the serial verifier genuinely single-worker while retaining bounded
  four-worker verification by default.
- Predeployment now fails fast across the OS matrix, caches pinned Python
  requirements on every test OS, and gates expensive downstream jobs on the
  clean-build matrix.
- The tracked-public regression creates only the public fixture before running
  the one canonical regression build.
- Playwright Chromium installation is deferred until build and static release
  gates pass. The duplicated Ubuntu adapter/lifecycle test step was removed;
  the same six suites still run on Ubuntu, Windows, and macOS.
- Deployer packaging reuses its just-completed canonical build instead of
  rebuilding it inside the portable verifier.

## Tier 1 fixes

- Replaced stale page exceptions with twelve current large-page budgets,
  removed obsolete 26–34 KB calendar-shell exceptions, and lowered the
  unbudgeted HTML ceiling from 500 KB to 350 KB.
- Added a 100 MB total deploy ceiling, narrow exceptions for the two archival
  PDFs and concordance index, and type-specific limits for scripts, styles,
  images, fonts, data, PDFs, and archives.
- Expanded the asset report with per-extension totals and a runtime-asset view.
- Added a delivery-resilience gate: third-party styles must be Google Fonts
  with preconnect and `display=swap`; third-party scripts must defer/async;
  external embeds/images must be lazy; external CSS imports are rejected.
- Added cache-contract checks for bounded CSS/JS/media/archive caching and
  five-minute calendar-data revalidation.
- Both ZIP formats now contain `PACKAGE_CONTENTS_SHA256.json`, verify every
  member after writing, use release-owned timestamps and stable ordering, and
  emit a `.sha256` sidecar. A repeatability unit test proves byte-identical
  output for identical inputs.
- Active browser evidence moved to Audit 35 paths and now also requires the
  representative route-resilience report. Audit 34 evidence remains untouched.

## Verification and release order

Focused static syntax, budget, workflow-contract, runtime-delivery, and package
repeatability checks are required before handoff. Final generation order:

1. Finish all source edits.
2. Apply the Audit 35 release/asset stamp and refresh release manifests.
3. Run the canonical build once.
4. Run `npm run verify:all:built`.
5. Run the three Polymythcal browser audits and the representative Audit 35
   route-resilience audit.
6. Run `npm run verify:audit35-browser-evidence`, Audit 14, and the final
   release gate.
7. Package the deployer-compatible ZIP; its packager reuses the canonical build
   and complete verifier, validates public parity, writes the internal content
   manifest, and emits the ZIP SHA-256 sidecar.

Security assessment is intentionally outside Audit 35.
