# One-zip safety and technical fix report — 2026-07-09

## Goal

Keep the whole website/source/operator archive together in one zip while preventing source, audit, script, data, and operator files from becoming public website pages.

## Implemented

- Kept one full zip as the deliverable.
- Set Netlify build publish directory to `public`.
- Added `scripts/build-public-deploy.js` so the public deploy surface is generated from an allowlist.
- Kept root source/operator files in the zip root.
- Added root fallback 404 rules for operator files, scripts, data, `.github`, `hf_export`, `netlify`, package files, release files, and root audit/report artifacts.
- Expanded the public-artifact guard to catch `CRITIQUE`, `DASHBOARD`, `HANDOFF`, and `RELEASE` artifacts.
- Removed duplicate redirect rules from `netlify.toml` and kept `_redirects` unique.
- Added/kept CSP in report-only mode.
- Added optional live external-link audit with cache and rate limits.
- Added release markers: `RELEASE_ID.txt`, `RELEASE_MANIFEST.json`, and generated `public/site-release.json`.
- Kept CV anti-backtracking doctrine unchanged.
- Downgraded/pinned `@netlify/blobs` to `^10.1.0`; `npm audit --omit=dev` reports 0 vulnerabilities.

## Safety model

Normal Netlify build deploys `public/` only.

If a root deploy happens by mistake, `_redirects` and `netlify.toml` still force private/operator paths to 404.

The zip still contains the full working site and archive.
