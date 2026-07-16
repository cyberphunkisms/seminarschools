# FINAL6 Deploy-Contract Repair — 2026-07-16

## Failure reproduced

The prior full-CV package contained `public/data/saul-cv-canonical-2026.json`. FINAL6 correctly rejected the package because `public/data` is an internal folder inside the Netlify publish surface.

## Repair

- Deleted the redundant public copy and removed the empty `public/data/` directory.
- Preserved `data/saul-cv-canonical-2026.json` in the complete source archive.
- Confirmed that no HTML or JavaScript runtime surface references the removed public copy.
- Added `scripts/verify-final6-deploy-contract.js` with the exact seven-folder FINAL6 block list.
- Added the guard to `package.json`, `scripts/verify-all-runner.js`, and `scripts/verify-release-gates.js`.
- Strengthened `scripts/build-public-deploy.js` to reject the same seven forbidden directories.

## Protected public-deploy boundary

The following paths must remain absent from `/public`:

- `public/scripts`
- `public/data`
- `public/hf_export`
- `public/.github`
- `public/node_modules`
- `public/.git`
- `public/.netlify`

## Preservation result

The source-side canonical CV JSON remains at `data/saul-cv-canonical-2026.json`. Current CV PDFs, text files, focused CV webpages, modular CV controls, sitemap entries, search surfaces, and the complete source tree remain in the package.
