# Meaninglib AI Access Pack current-GitHub patch

Built from current GitHub master archive `seminarschools-current-github-master.zip`, not from the older full-site Meaninglib zip.

## Source rule

Current GitHub master is the website baseline. Meaninglib/AI Access Pack files were added as a patch so newer website work is preserved.

## Added or restored

- Meaninglib Phase 1 export/sync tooling
- Meaninglib Phase 2 local search and retrieval verifier
- Meaninglib Phase 3 local dashboard files
- Phase 4 AI Access Pack builder, verifier, batch files, and generated outputs
- ML* stop-psychologism rule
- ML* AI prose tells rule
- ML* anti-backtracking affordance ledger rule
- BB* / PolymythDND clarification studylist item
- Regenerated methodologylist txt mirrors
- Updated Meaninglib `hf_export/` dataset, search index, and AI Access Pack outputs

## New Phase 4 files

- `scripts/build-ai-access-pack.js`
- `scripts/verify-ai-access-pack.js`
- `BUILD_AI_ACCESS_PACK.bat`
- `VERIFY_AI_ACCESS_PACK.bat`
- `QUERY_AI_ACCESS_PACK.bat`
- `hf_export/ai_access_pack/latest_access_pack.md`
- `hf_export/ai_access_pack/latest_access_pack.json`
- `hf_export/ai_access_pack/reports/latest_access_pack_report.md`
- `hf_export/ai_access_pack/reports/ai_access_pack_verification_report.md`

## Verified

- `npm run export:meaninglib-dataset`
- `npm run verify:meaninglib-dataset`
- `npm run scan:private-data`
- `npm run build:meaninglib-search`
- `npm run verify:meaninglib-search`
- `npm run build:ai-access-pack`
- `npm run verify:ai-access-pack`
- `npm run verify:meaninglib-dashboard`
- `npm run verify:ml-stop-psychologism`
- `npm run verify:ml-ai-prose-tells`
- `npm run verify:route-doctrine`
- `npm run verify:professional`
- `npm run verify:seo`
- `npm run verify:site`

## Counts

- Meaninglib export rows: 1973
- Meaninglib search docs: 1974
- Sitemap URLs reported by SEO guard: 996
- Site integrity HTML pages: 1167

## Deployment note

This is a full website zip built from current GitHub master plus the Meaninglib/AI Access Pack patch. It is safer than deploying `ss-site-meaninglib-final.zip` or `ss-site-meaninglib-ai-access-pack.zip`, which were based on an older website state.

