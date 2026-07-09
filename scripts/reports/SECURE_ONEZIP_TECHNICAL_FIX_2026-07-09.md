# Secure one-zip technical fix — 2026-07-09

## Core decision

The archive remains a complete one-zip source package. No source/operator substrate was split into a separate download.

Deployment safety is handled by changing the Netlify publish surface:

- `netlify.toml` now publishes `public` instead of the repository root.
- `scripts/build-public-deploy.js` generates `public/` from an allowlist of front-facing/static website files.
- The root stays the full archive: source pages, scripts, data, workflows, reports, ML*, BB*, AA*, hf_export, and operator files remain in the zip.
- Root fallback redirects still force operator/audit/tooling paths to 404 if someone accidentally publishes the root on Netlify.

## Technical fixes applied

- Added `scripts/build-public-deploy.js`.
- Updated Netlify build command to run the public deploy builder.
- Updated `[build].publish` to `public`.
- Hardened `scripts/verify-public-artifact-blocks.js` so it checks both the root fallback blocks and the generated publish directory.
- Expanded the operator-file detector to include `CRITIQUE`, `DASHBOARD`, `HANDOFF`, and `RELEASE` artifacts.
- Added explicit root 404 fallback blocks for previously missed operator artifacts.
- Added `RELEASE_ID.txt` and `RELEASE_MANIFEST.json` for deployment/version confirmation.
- Added `site-release.json` to the generated public deploy surface.
- Added `Content-Security-Policy-Report-Only` to `_headers`.
- Added image dimensions to fixed raster images to reduce layout shift.
- Added missing meta descriptions to noindex/private campaign surfaces and legacy sitemap/dashboard surfaces.
- Added `scripts/audit-external-links-live.js` as an optional live rot-checker with caching.
- Added `.github/workflows/audit-external-links.yml` for scheduled link-audit reports.
- Added `public/` and live-link cache reports to `.gitignore`.
- Updated `verify-site-integrity.js` and `verify-page-size-budget.js` to read the configured publish surface.
- Updated root-walking guards to ignore generated `public/` where appropriate.
- Added content-visibility containment on long public catalogs where safe.

## Preserved doctrine

- Default CV stays broad.
- Selected CV focus areas stay targeted.
- Multiple CV focus areas combine additively.
- PDF/export follows the exact selected focus combination.
- Portrait and map stay website-only.
- Performance stays separate.
- Seminar Schools stays under Portfolio.

## Verification

The all-in-one `npm run verify:all` exceeded the tool timeout during the combined run, but the full guard set was completed in split form.

Passed checks included:

- critical deployment checks
- public artifact/publish-surface hygiene
- search surface
- calendar/data parity
- generated shortcut checks
- site interactivity
- geometry, visible geometry, zoom, register
- route doctrine, page-type contracts, pathfinder navigation
- page size and heavy-page resilience
- generated route indexing and sitemap classification
- keyboard/responsive checks
- CV print and modular CV guards
- teacher resources finder
- AA to Polymyth funnel
- visible input labels
- external link inventory
- dense anchors
- asset weights
- Leizu payment/intake/localization guards
- BB clarity/final/kid-friendly/why guards
- main page/funnel guards
- front-facing boundary guard
- public deploy build
- site integrity on `public`
- professional readiness
- SEO
- typography controls
- Bookwormcard gate
- Meaninglib dataset/search/AI access pack

## Practical deployment note

For the normal GitHub/Netlify workflow, push the whole zip contents. Netlify runs the build and publishes only `public/`.

For manual static hosting that does not run Netlify redirects or build commands, deploy the generated `public/` folder rather than the whole root. Netlify can safely use the whole root because the publish directory and fallback redirects are now configured.
