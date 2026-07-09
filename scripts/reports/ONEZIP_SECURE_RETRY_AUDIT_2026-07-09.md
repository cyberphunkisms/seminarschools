# One-zip secure retry audit — 2026-07-09

## User constraint
Keep absolutely everything in one zip.

## Resolution
The zip remains a complete archive. The site deploy surface is now generated into `/public`, and Netlify publishes only `/public` through `netlify.toml`.

## Safety model
- Full archive remains in zip root.
- Operator/source files remain available in the zip.
- `scripts/build-public-deploy.js` copies only allowlisted public routes/assets to `/public`.
- `/public` excludes scripts, data, hf_export, netlify functions, source reports, root operator artifacts, and package files.
- `_redirects` and `netlify.toml` keep fallback 404 blocks for root operator artifacts if root is accidentally published.
- `_headers` includes `Content-Security-Policy-Report-Only` for staged CSP hardening.
- `RELEASE_ID.txt`, `RELEASE_MANIFEST.json`, and `/public/site-release.json` identify the deployed release.

## Audit findings resolved or controlled
- Root audit/operator artifacts can stay in the zip because `/public` is the publish directory.
- The public-artifact guard now checks `CRITIQUE`, `DASHBOARD`, `RELEASE`, and related operator words.
- Campaign meta descriptions were resolved except for the intentional Google verification file.
- Public deploy output passed the public artifact hygiene check.
- External-link audit remains inventory-only unless intentionally run as a live rot-check.
- Redirect redundancy is retained where it functions as fallback protection across `_redirects` and `netlify.toml`; deduplication would reduce belt-and-suspenders safety.

## Verification
The full verify chain exceeded the tool timeout as one command, so the same checks were run in split form. The late-stage public deploy, site integrity, professional readiness, SEO, typography, and Bookwormcard gates passed.
