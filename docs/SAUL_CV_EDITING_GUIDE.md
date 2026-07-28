# Editing Saul’s CV

## One source of truth

Edit:

`data/saul-ultimate-school-cv-2026.json`

Each experience belongs in one of the three `experience_sections`. A record contains:

- `id`
- `focus`
- `role`
- `description`
- `organization`
- `dates`

The `focus` values decide which role-focused website views and PDFs include the record.

## Rebuild everything

From the website folder, run:

`npm run build:saul-cv`

That single command rebuilds and verifies:

- the `/saul/` CV page
- the Gmail application Word and PDF files
- the ProtonMail application Word and PDF files
- all role-focused PDFs
- all ATS PDFs
- all plain-text CV exports
- the complete `EVERYTHING` PDF
- the ZIP containing every CV output
- the public JSON mirrors and output manifest

## Application-document template

The visual Word template is:

`templates/saul-ultimate-school-cv-template.docx`

Ordinary factual edits belong in the JSON file. Edit the template only when changing page geometry, typography, borders, tab stops or other document-wide styling.

## Locked output rules

- Gmail and ProtonMail application files differ only by the visible email and `mailto:` target.
- Application experience text uses 11 pt for roles, organizations and dates, with 10 pt descriptions.
- Experience rows have zero paragraph spacing.
- Each underlined section heading has one genuine 0.5 pt spacer before its first row.
- Dates use a right-aligned tab stop.
- The application CV remains one US Letter page.
- `seminarschools.com/saul` and `seminarschools.com/reviews` remain the public links.

