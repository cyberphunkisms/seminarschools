# FINAL6 Deploy-Ready Release Gate — 2026-07-16

## Release identity

`2026-07-16-full-cv-seo-final6-deploy-ready`

Generated: `2026-07-16T02:47:24Z`

## Corrected deployment boundary

The deployable `/public` tree contains none of the seven folders rejected by FINAL6:

- `public/scripts`
- `public/data`
- `public/hf_export`
- `public/.github`
- `public/node_modules`
- `public/.git`
- `public/.netlify`

The canonical CV source record remains at `data/saul-cv-canonical-2026.json`. The redundant copy formerly placed at `public/data/saul-cv-canonical-2026.json` is removed.

## Additional release repairs discovered by the full gate

- Removed the noindex `/saul/hospitality/` alias from the sitemap while retaining the route and canonical link to `/saul/cv/hospitality/`.
- Updated the search-surface manifest to 925 sitemap URLs.
- Added shared geometry, zoom, typography, keyboard and responsive contracts to all 12 focused CV routes and the preserved hospitality alias.
- Repaired the web-manifest link to `/manifest.json`.
- Updated the Saul verifier to skip declarative JSON data blocks and validate the current decluttered role-focus workflow.
- Refreshed the general static CV PDF and modular sample archives so the established print and whitespace gates pass.

## Verification

The central release runner reports **82/82 checks passed**. The exact FINAL6 contract is one of those release-blocking checks.
