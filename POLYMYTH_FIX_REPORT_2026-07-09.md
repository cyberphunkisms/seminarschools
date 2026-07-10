# Polymyth technical repair report — 2026-07-09

## Source checklist

The repair target was the seven-issue technical ledger from the pasted Claude audit:

1. regen landmine for the BB campaign ruling
2. stale `polymyth/manifest.txt`
3. stale `polymyth/concordance/concordance-index.json`
4. shipping rule gap across release gates
5. empty `data/seminars.json` and stale `data/scrape-log.json`
6. CSP in report-only mode
7. external link rot audit missing from the live CI surface

## Repairs applied

### 1. Regen landmine

- Confirmed the BB campaign ruling already lived in canonical `polymyth/campaigncodex/index.html`.
- Patched `scripts/regen-campaigncodex-txt.js` so the plain-text mirror now regenerates the current BB / PolymythDND campaign ruling from the canonical HTML, instead of preserving it through a hand edit.
- Patched `scripts/regen-all-txt.js` so normal regen includes:
  - full star-file text mirrors
  - ML* section mirrors
  - ML* manifest
  - concordance index
- Added `scripts/verify-regen-safety.js`.
- Confirmed `node scripts/verify-bb-clarification.js` passes after real regen.

### 2. Manifest

- Added `scripts/regen-methodologylist-manifest.js`.
- Added `scripts/verify-methodologylist-manifest.js`.
- Regenerated `polymyth/manifest.txt` and `public/polymyth/manifest.txt`.
- Current manifest reports 1,091 ML* entries across 15 sections.

### 3. Concordance

- Regenerated `polymyth/concordance/concordance-index.json`.
- Size changed from 1,726,337 bytes to 1,783,096 bytes.
- `regen-all-txt.js` now refreshes the concordance every routine regen.

### 4. Release gates

- Patched `scripts/verify-all-runner.js` to make all 77 checks release-blocking.
- Added `scripts/verify-release-gates.js`.
- Added `scripts/reports/release-gate-report.json` output.
- Pointed `npm run verify:release` and `npm run verify:all:serial` to the same central runner.
- Added previously missing Meaninglib, AI Access Pack, scraper-layout, npm-registry, CSP, data, manifest, regen-safety, external-workflow, and release-gate checks to the full gate.

### 5. Data hygiene

- Retired empty `data/seminars.json` to `data/history/retired-empty-seminars-json-2026-07-09.json`.
- Refreshed `data/scrape-log.json` as a current canonical/public calendar summary.
- Added `data/README.md` naming `data/polymyth-seminar-events.json` as the canonical calendar master and `polymythseminars/events.json` as the public copy.
- Added `scripts/verify-data-hygiene.js`.

### 6. CSP

- Changed `_headers` and `public/_headers` from `Content-Security-Policy-Report-Only` to enforced `Content-Security-Policy`.
- Added `https://cdnjs.cloudflare.com` to `script-src` for D3 and PDF.js surfaces.
- Added `worker-src 'self' blob: https://cdnjs.cloudflare.com` for PDF.js worker compatibility.
- Added `scripts/verify-csp-enforced.js`.

### 7. External live link audit

- Changed `.github/workflows/audit-external-links.yml` to strict mode with `EXTERNAL_LINK_STRICT: "1"`.
- Kept weekly and manual triggers.
- Added offline inventory before the live checker.
- Ensured the workflow uploads `scripts/reports/external-link-live-report.json` as an artifact.
- Added `scripts/verify-external-link-workflow.js`.
- Updated workflow action majors to current official action lines:
  - `actions/checkout@v5`
  - `actions/setup-node@v6`
  - `actions/upload-artifact@v6`

## Regenerated surfaces

- `polymyth/methodologylist.txt`
- all existing `polymyth/methodologylist-*.txt` section mirrors
- `polymyth/modulecanon.txt`
- `polymyth/bookwormburrows.txt`
- `polymyth/campaigncodex.txt`
- `polymyth/manifest.txt`
- `polymyth/concordance/concordance-index.json`
- `hf_export/data/**`
- `hf_export/search/meaninglib_search_index.json`
- `hf_export/ai_access_pack/**`
- `public/**`

## Commands run

```bash
node scripts/regen-all-txt.js
npm run export:meaninglib-dataset
npm run build:meaninglib-search
npm run build:ai-access-pack
npm run build:public-deploy
VERIFY_ALL_CONCURRENCY=4 npm run verify:all
```

## Verification result

```text
VERIFY ALL FAST PASSED — 77/77 checks in 26.7s.
```

`release-gate-report.json` status:

```json
{
  "status": "passed",
  "total_checks": 77,
  "passed_checks": 77,
  "failed_checks": []
}
```

## Remaining operational note

The local package now contains the live-link workflow and the offline link inventory passed during `verify:all`. The live external-link check itself is designed to run in GitHub Actions, where the public internet and artifact upload are available.
