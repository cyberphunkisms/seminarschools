# Editing Saul’s CV

## Canonical source

Edit:

`data/saul-ultimate-school-cv-2026.json`

Do not edit generated HTML, `data/saul-cv-records.json`, PDF text exports or
the embedded `const LETTERS` object directly. The build replaces those derived
surfaces from the canonical JSON.

### Shared application fields

Each experience belongs in one of the three `experience_sections`. A record contains:

- `id`
- `focus`
- `role`
- `description`
- `organization`
- `dates`

The `focus` values decide which role-focused website views and PDFs include the record.

The unprefixed fields remain the application-document and shared-data source:

- `profile`
- `core_skills`
- `credentials`
- `methods_tools`
- `languages`
- `education`
- `professional_learning`
- `courses`

### Front-facing website fields

The public `/saul/` page can use a clearer web presentation without changing
the application documents:

- `web_profile` replaces `profile` in the web hero.
- `impact_facts` supplies the hero fact cards. Each item has `value` and
  `label`.
- `public_highlights` supplies the selected-evidence cards. Each item has a
  stable `id`, one or more `focus` values, a `title` and a plain-text `body`.
  The focus values control the same field filters used by experience records.
- `web_core_skills`, `web_credentials`, `web_methods_tools` and
  `web_languages` override their unprefixed counterparts on the website only.
  Every web override is optional; when it is absent, the builder falls back to
  the corresponding shared field.

Keep `public_highlights.body` as plain text because the builder escapes it.
Use the application fields when a factual correction must reach both the web
page and downloadable CVs. Use a `web_*` field only for a presentation change
that should remain website-specific.

### Historical archive introductions

`archive_letters` is the source of truth for the front-facing prose above each
historical archive category. Its current category keys are `seminarschools`,
`teaching`, `kitchen`, `community`, `volunteer`, `performance` and `education`.
Each category contains localized `title` and `body` values for `en`, `zh`,
`zhs`, `fa` and `fr`. The body values may contain the intended paragraph HTML.

During the build, `archive_letters` replaces the embedded `const LETTERS`
object. Historical record exports are then regenerated into
`data/saul-cv-records.json`. Edit neither derived surface by hand.

## Rebuild everything

From the website folder, run:

`npm run build:saul-cv`

That command runs the CV pipeline in this order:

1. `build-saul-cv-outputs.py` rebuilds the Word, PDF, ATS, text and archive
   downloads during a full local build. Static hosting builds reuse the
   committed verified binary outputs.
2. `build-saul-ultimate-web-cv.py` synchronizes the legacy mirrors and
   downloads, retires focused routes, updates redirects, rebuilds `/saul/`,
   applies the archive consistency corrections and injects `archive_letters`.
3. `export-saul-cv-records.js` regenerates `data/saul-cv-records.json` from the
   rebuilt historical archive.
4. `verify-saul-ultimate-web-cv.js` checks the web CV and generated surfaces.
5. `verify-saul-cv-release.py` checks the document release and manifest.

The completed pipeline rebuilds and verifies:

- the `/saul/` CV page
- the Gmail application Word and PDF files
- the ProtonMail application Word and PDF files
- all role-focused PDFs
- all ATS PDFs
- all plain-text CV exports
- the complete career-archive PDF
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
