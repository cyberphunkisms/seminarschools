# PolymythCAL Audit 19 final pre-deploy report

Release ID: `2026-07-22-polymythcal-audit19-final`

## Result

The Audit 18 source package was re-audited from deployment, maintainability, accessibility, privacy, dependency, browser, interaction, and release-engineering perspectives. Every reproducible package-level defect found during this pass was repaired.

## Repairs completed

### One canonical production build

Netlify now runs `npm run build`. The full build chain lives once in `package.json`, covering search surfaces, writing routes, academic routes, typography links, type floors, public deployment, and the PolymythCAL efficiency gate. This removes configuration drift between local builds and Netlify.

### Runtime alignment

Netlify, `.nvmrc`, `package.json`, and GitHub Actions now specify Node.js 24. The package declares npm 11. Clean-build CI runs on Ubuntu, Windows, and macOS.

### Dependency reproducibility and monitoring

`@netlify/blobs` is pinned exactly to `10.1.0` in both `package.json` and `package-lock.json`. The lockfile retains the public npm registry URL and SHA-512 integrity metadata. A release verifier enforces this contract. Dependabot and a scheduled dependency-health workflow now check npm packages, GitHub Actions, and production vulnerability advisories.

### Portable browser audits

The interaction and WCAG audit scripts no longer depend solely on `/usr/bin/chromium`. They accept `CHROMIUM_PATH`, detect common system installations, and fall back to Playwright-managed Chromium. The pre-deploy workflow installs Playwright Chromium and runs both browser suites.

### Native assistive-technology sign-off

The full VoiceOver and NVDA protocol remains in `docs/POLYMYTHCAL_SCREEN_READER_TEST_PROTOCOL.md`. A structured GitHub issue template now records release ID, platform versions, every spoken-output result, evidence, defects, and final sign-off. Automated browser checks and multi-platform builds remain separate from native spoken-output confirmation.

### Current release metadata

`RELEASE_ID.txt`, `RELEASE_MANIFEST.json`, and `data/polymythcal-build-manifest.json` now describe the same Audit 19 release. The stale Audit 12 release manifest and Audit 15 interface counts were removed.

### Verifier compatibility

Legacy deployment verifiers were updated to understand the canonical `npm run build` command rather than requiring `build-public-deploy.js` to appear directly inside `netlify.toml`.

## Verification results

- Exact production build passed from a clean `public/` state
- Confirmation production build changed zero source files
- Full repository verifier passed 91 of 91
- PolymythCAL clarity verifier passed 29 of 29
- Interaction and design browser audit passed 94 of 94
- WCAG 2.2 AA browser audit passed 42 of 42
- Audit 13 passed 13 of 13
- Audit 14 passed 28 of 28
- Adapter fixtures passed 8 of 8
- Lifecycle tests passed 6 of 6
- Dependency lock contract passed
- Pre-deploy automation contract passed
- GitHub YAML files parsed successfully

## Preserved publication surface

- 839 canonical events
- 839 stable event pages
- 839 legacy redirect aliases
- 839 individual ICS files
- 847 sitemap URLs
- 2,474 generated public HTML pages
- 25,851-byte PolymythCAL client shell
- 418 registered sources
- 243 confirmed and 596 qualified unconfirmed records

## External execution boundaries

Two checks depend on external platform execution rather than additional source changes.

1. Native VoiceOver speech must be confirmed on macOS and native NVDA speech must be confirmed on Windows. The package now provides the exact protocol and mandatory sign-off record.
2. The local npm advisory endpoint returned an upstream HTTP 503. The package now runs the online production advisory check on GitHub Actions with retries and retained evidence. Dependency versions and lockfile integrity were verified locally.

These boundaries have an executable process in the repository. They no longer rely on an undocumented manual reminder.

## Final packaged-source test

A preliminary source ZIP was extracted into a blank directory containing no `public/`, no `.env`, no `node_modules/`, and no prior build output. From that extracted package:

- `npm run build` passed in 1.71 seconds
- `npm run verify:all` passed 91 of 91 in 7.50 seconds
- Clarity passed 29 of 29
- Interaction and design passed 94 of 94
- WCAG browser checks passed 42 of 42
- Adapter tests passed 8 of 8
- Lifecycle tests passed 6 of 6
- Audit 14 passed 28 of 28

The final package contains 4,063 source files and intentionally excludes generated `public/`, local secrets, local dependency folders, browser screenshots, logs, and Python bytecode.
