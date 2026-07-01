# Mephistodata Hugging Face Activation Patch

Built from uploaded archive: `ss-site-current-github-meaninglib-ai-access-pack-v6safe(1).zip`

## Purpose

Make Hugging Face usable as a Meaninglib / Mephistodata handoff surface for another AI while preserving the source-of-truth and star-file ontology locks.

## Best operating model

1. Static activation file: paste `hf_export/ai_access_pack/MEPHISTODATA_ACTIVATION.md` into another AI first.
2. Task-specific pack: paste or retrieve `hf_export/ai_access_pack/latest_access_pack.md` for the task.
3. Future Space: build a Hugging Face Space later that searches `hf_export/search/meaninglib_search_index.json` and generates task-specific copy-paste packs.

## Changes made

- Added generated `hf_export/ai_access_pack/MEPHISTODATA_ACTIVATION.md`.
- Updated `scripts/build-ai-access-pack.js` so every AI Access Pack build writes:
  - `hf_export/ai_access_pack/MEPHISTODATA_ACTIVATION.md`
  - `hf_export/ai_access_pack/latest_access_pack.md`
  - `hf_export/ai_access_pack/latest_access_pack.json`
- Updated the default AI Access Pack query to:
  - `Meaninglib ontology Mephistodata default AI Access Pack`
- Tuned AI Access Pack retrieval scoring for Mephistodata / activation / Hugging Face handoff queries.
- Updated `scripts/verify-ai-access-pack.js` to verify the activation file and the new activation query.
- Updated `SYNC_MEANINGLIB_TO_HUGGINGFACE.bat` so sync rebuilds and verifies the AI Access Pack before upload.
- Updated the generated `hf_export/README.md` text in `scripts/export-meaninglib-dataset.js` so the dataset card explains the activation path and public/private access boundary.

## Key safety correction

`SYNC_MEANINGLIB_TO_HUGGINGFACE.bat` now rebuilds the AI Access Pack before uploading. This prevents stale `latest_access_pack.md` and stale activation files from being pushed after Meaninglib changes.

## Verification run

- PASS: `npm run export:meaninglib-dataset`
- PASS: `npm run verify:meaninglib-dataset`
- PASS: `npm run scan:private-data`
  - Failures: 0
  - Warnings: 5 conservative phone-like pattern warnings already reported by the privacy scanner
- PASS: `npm run build:meaninglib-search`
- PASS: `npm run verify:meaninglib-search`
- PASS: `npm run build:ai-access-pack`
- PASS: `npm run verify:ai-access-pack`
- PASS: `npm run verify:route-doctrine`
- PASS: `npm run verify:professional`
- PASS: `npm run verify:seo`
- PASS: `npm run verify:site`

## Public access note

If the Hugging Face dataset is private, another AI can use Mephistodata through pasted text or authorized access. If the goal is browser-based public access, the Hugging Face dataset or a curated companion Space needs public or protected visibility.
