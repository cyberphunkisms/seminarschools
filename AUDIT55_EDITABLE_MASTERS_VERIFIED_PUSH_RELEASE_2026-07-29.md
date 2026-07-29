# Audit 55: Editable Masters and Verified Push Release

Date: 2026-07-29

## Completed

- Added one collection point delivered as the ZIP-root `EDITABLE_MASTERS/` directory.
- Included the current rhetoric taxonomy workbook, Medusa evidence ledger, Gorgonwars source ledger, #MeToo working edition, #MeToo full archive, Polymyth Commons backbone, Polymythcal research/remediation plan, and Israeli official-rhetoric chronology v4 ledger.
- Preserved the composite canonical ML* source at `polymyth/methodologylist/index.html` plus its two JavaScript addenda.
- Separated the #MeToo preview-safe working edition from the larger full archive and assigned each its accurate filename.
- Supplied the FINAL7 Windows deployer outside the website root so it is available in the delivery ZIP but cannot be copied into the Git repository.
- Kept `EDITABLE_MASTERS/` source-only as a sibling of `SITE_PACKAGE/`: it remains in the delivery ZIP but is outside the website root and cannot be copied into the repository.

## Deploy correction

The prior FINAL6 deployer treated any nonzero `git push` exit as a final failure. The supplied FINAL7 deployer now:

- uses HTTP/1.1 and a 64 MiB Git request buffer for the push;
- checks the exact remote branch commit after an HTTP error;
- accepts the deployment when the remote commit equals local `HEAD`;
- retries a genuine mismatch up to two additional times; and
- never force-pushes.

## Verification

- Every collected editable file has a SHA-256 entry in the delivered `EDITABLE_MASTERS/SHA256SUMS.txt`.
- Every `.xlsx` master passed ZIP/OOXML container integrity checks.
- The working and full #MeToo editions have distinct verified hashes and accurate names.
- The deployer preserves the existing manual repository picker, prebuilt `public/` deployment, no-local-npm behavior, secret guard, manual Hugging Face sync, and stay-open result window.
