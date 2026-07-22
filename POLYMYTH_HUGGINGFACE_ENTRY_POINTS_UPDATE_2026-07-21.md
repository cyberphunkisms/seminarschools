# Polymyth Hugging Face Entry Points Update

Date: 2026-07-21

## Updated page

- `polymyth/index.html`
- `public/polymyth/index.html`

## Entry points preserved and expanded

1. Read methodologylist online
2. Copy methodologylist text
3. Download methodologylist text
4. Download the Mephistodata activation file
5. Open the structured Meaninglib dataset on Hugging Face

The Hugging Face card states that authorized access is currently required. The page continues to identify the Seminar Schools website and archive as the source of truth.

## Maintained source pipeline

- `scripts/build-ai-access-pack.js` now republishes `hf_export/ai_access_pack/MEPHISTODATA_ACTIVATION.md` to `polymyth/mephistodata-activation.md` whenever the access pack is rebuilt.
- The public deploy builder copies the activation file into `public/polymyth/`.
- `scripts/verify-polymyth-entry-points.js` checks all five routes and confirms that the public activation file matches the Hugging Face export.
- The new verifier is included in `scripts/verify-all-runner.js` and in `package.json` as `verify:polymyth-entry-points`.
- The repaired Windows Hugging Face sync BAT is included under both the original and fixed filenames.

## Verification

- Public deploy build passed.
- Polymyth entry-point verification passed.
- AI Access Pack build passed.
- AI Access Pack verification passed.
- Site integrity passed across 2,474 HTML pages.
- SEO deployment verification passed across 931 sitemap URLs.
- Keyboard navigation verification passed across 1,630 HTML pages.
- Responsive regression verification passed.
- Site interactivity verification passed.
- Front-facing boundary verification passed.
- Final9 Mephistodata hardening verification passed.

The broad page-size gate continues to report the pre-existing oversized `polymythseminars/index.html` and `university/index.html` pages. This update did not change either page.
