# PolymythCAL Audit 18 pre-deploy report

Release: `2026-07-21-polymythcal-audit18-predeploy`  
Generated: 2026-07-22T03:58:36.138451+00:00

## Result

The exact Netlify production command passes repeatedly. The final source build is idempotent: the latest run changed zero source files. The complete repository gate passes 90 of 90 checks. PolymythCAL-specific browser audits pass 29 of 29 clarity checks, 94 of 94 interaction/design checks, and 42 of 42 WCAG 2.2 AA checks.

## Problems found and fixed

### Build ownership

The search builder previously assumed the legacy event-card injection point. It now recognizes the lightweight JSON-backed PolymythCAL shell and preserves the 25 KB page.

### Netlify change detection

The ignore rule could skip deploys when build scripts changed. Build-affecting scripts now trigger production builds.

### Dedicated routes

The writing and academic generators now preserve their dedicated templates and canonical URLs instead of replacing them with calendar copies.

### Academic page weight

Inline fallback data is capped at 60 records while the complete canonical JSON remains available.

### Idempotence

Typography and route generators now make zero source edits on a second build.

### Expired listings

Past event permalinks remain available as noindex archive records, lose Event schema, gain a plain archive notice, and leave the sitemap.

### Search completeness

Search now covers excerpts, topics, tags, and qualification reasons as well as titles and core metadata.

### Freshness

Cards show confirmation state, projected status where applicable, and the last-checked date.

### Saved searches

Device-local saved searches were restored beside saved events in one focus-managed dialog.

### Keyboard use

The slash key focuses search, arrow keys change calendar months, and all controls retain visible focus.

### Mobile interaction

Agenda links and event titles meet the 24 px WCAG 2.2 minimum target size.

### High contrast

Forced-colour focus indicators use the system Highlight colour.

### Data freshness

Event JSON requests use no-cache revalidation so a stale browser cache does not hide a new harvest.

### Forms

Submission, correction, and confirmation surfaces carry bilingual alternates and social metadata.

### Toronto date boundary

The final clean-package test crossed midnight in Toronto. Eleven July 21 listings moved into the archive during that test. Those transitions are now pre-applied in the source package, and the confirmation build makes zero source changes.

### Verification drift

Legacy verifiers were updated to test the current architecture instead of rejecting newer releases or looking for removed controls.

### Audit speed

The geometry audit now classifies the full site statically and executes a representative browser sample, reducing the full 90-check gate to 7.8 seconds.

### Privacy

The targeted personal references removed in the previous release remain absent from source, public mirrors, search indexes, and Hugging Face export.

### Packaging

The GitHub/Netlify ZIP omits the generated public mirror, node_modules, logs, caches, duplicate legacy archives, and local secret files.

## Verified release metrics

- Canonical events: **839**
- Stable event pages: **839**
- Legacy redirect aliases: **839**
- Individual ICS files: **839**
- Explicit past-event archive notes: **265**
- Event pages excluded from indexing: **770**
- Current indexable event pages: **69**
- Sitemap URLs: **847**
- Main PolymythCAL HTML shell: **25,851 bytes**
- Public HTML pages after the production build: **2,474**
- Exact production build time in this environment: **1.53 seconds**
- Privacy scan: **0 blocking failures**, **5 conservative phone-like warnings**

## Verification ledger

- Full repository gate: **90 / 90**
- PolymythCAL clarity: **29 / 29**
- Interaction and design browser audit: **94 / 94**
- WCAG 2.2 AA browser audit: **42 / 42**
- Audit 13: **13 / 13**
- Audit 14: **28 / 28**
- Adapter fixtures: **8 / 8**
- Lifecycle reconciliation: **6 / 6**

## Packaged-artifact test

The final source archive was extracted into a new empty directory. The extraction contained **4,052 source files**, no generated `public/` directory, no `.env`, no `node_modules`, no logs, and no cache directories. The exact Netlify command rebuilt the site in **1.52 seconds**, followed by **28 / 28** Audit 14 checks, **29 / 29** clarity checks, and the complete **90 / 90** repository gate.

## Remaining manual boundaries

Native VoiceOver confirmation requires macOS. Native NVDA confirmation requires Windows. The complete test protocol remains in `docs/POLYMYTHCAL_SCREEN_READER_TEST_PROTOCOL.md`.

The online npm advisory endpoint returned an upstream 503/DNS error in this execution environment. The project contains one production dependency, `@netlify/blobs` **10.1.0**, locked with registry URL and integrity metadata. This report makes no fresh online vulnerability claim.

## Deployment package contract

The ZIP is a GitHub and Netlify source package. Netlify publishes `public/` after rebuilding it. The archive excludes generated `public/`, `.git`, `.netlify`, `node_modules`, Python caches, logs, local `.env` secrets, and duplicate legacy binary archives, and local browser-audit screenshots that are unnecessary for deployment.
