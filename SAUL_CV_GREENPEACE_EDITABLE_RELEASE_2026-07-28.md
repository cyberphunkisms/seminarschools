# Saul CV Greenpeace + Editable Release Audit

Release: `2026-07-28-greenpeace-cv-editable`

## Completed

- Added `Fundraiser & Volunteer Coordinator | Fundraising & Volunteer Coordination | Greenpeace | 2006–2010`.
- Added the record to the one-page application CV, relevant modular views and PDFs, the website application ledger, the website historical archive, and the complete EVERYTHING PDF.
- Preserved all earlier CV records, including La Plante.
- Preserved the true circular website portrait and additive CV focus-module system.
- Replaced the old download-alias workflow with distinct generated modular and archive files.
- Mirrored the completed source into `public/` and verified byte-for-byte deploy parity.

## Canonical counts

- Application CV: 37 experiences
- Application sections: 16 teaching / 13 research-community-volunteer / 8 additional work
- Historical career and project archive: 65 records
- Modular outputs: 36 files (12 designed PDFs, 12 ATS PDFs, 12 text editions)
- Complete EVERYTHING PDF: 5 pages

## Locked application-document checks

- Gmail and ProtonMail editions are generated from the same document package.
- Only the visible email and `mailto:` target differ.
- Roles, organizations, locations, separators and dates: 11 pt.
- Descriptions: 10 pt.
- Exactly four genuine 0.5 pt spacers, each immediately below an underlined section heading.
- Zero spacing before or after every experience row.
- Every date uses the same right-aligned tab stop.
- Both application PDFs remain one-page Letter documents.
- `seminarschools.com/saul` and `seminarschools.com/reviews` are retained.

## Future editing

Edit:

`data/saul-ultimate-school-cv-2026.json`

Then run:

`npm run build:saul-cv`

That one command regenerates and verifies the website CV, both email editions, all modular outputs, the EVERYTHING PDF, the CV-output ZIP, and the output manifest.

The editable Word layout template is:

`templates/saul-ultimate-school-cv-template.docx`

Detailed instructions are in:

`docs/SAUL_CV_EDITING_GUIDE.md`

The structural and rendered-output release gate is:

`scripts/verify-saul-cv-release.py`
