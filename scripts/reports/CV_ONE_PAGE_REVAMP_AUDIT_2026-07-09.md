# CV one-page revamp audit

Date: 2026-07-09
Scope: Saul CV page, modular print output, static PDF builder, default shipped PDF.

## Starting audit

The old CV's strongest qualities were one-page discipline, strong hierarchy, centered identity, direct contact bar, dense but readable experience grouping, and a memorable visual rhythm. Its weakness was that density came from compression rather than modular targeting.

The newer CV output had the opposite problem. It had richer data and modular filters, but the print artifact stretched into two pages, used a generic timeline feel, buried the strongest profile signal, and allowed the top description to feel static even when the selected module changed.

## Dialectical design decision

Old-CV thesis: keep the one-page, high-density, memorable document.

Modern modular thesis: preserve additive tabs, dynamic role targeting, filtered credentials, and a screen archive that can hold the full record.

Synthesis applied: keep the website as the full archive, but make the downloaded CV a one-page editorial folio. The print layer now selects and compresses the relevant evidence for the chosen module instead of trying to print the whole archive.

## Repairs made

1. Rebuilt the print/download CV into a one-page modular design.
2. Added a strong identity header, contact column, profile band, dense experience column, and right-side core-signals column.
3. Made the top profile copy change for all major module states.
4. Kept additive multi-tab selection.
5. Preserved website-only portrait and map.
6. Rewrote the static CV builder to use the same one-page modular logic.
7. Rebuilt `saul/cv.pdf` and `public/saul/cv.pdf` as one-page PDFs.
8. Updated Saul page and modular verifiers so the one-page output cannot silently regress.
9. Added a forced block for the root `POLYMYTH_FIX_REPORT_2026-07-09.md` artifact so the public-artifact guard stays clean.

## Modular page-count check

Generated with `scripts/build-cv-pdf.js` and rendered with WeasyPrint in the audit container.

| Output | Cats | Rows | Pages |
|---|---:|---:|---:|
| General | all | 22 | 1 |
| Teaching | teaching | 21 | 1 |
| Education | education | 19 | 1 |
| Community | community | 12 | 1 |
| Culinary Hospitality | kitchen | 9 | 1 |
| Volunteer | volunteer | 10 | 1 |
| Performance | performance | 4 | 1 |
| Portfolio | seminarschools | 10 | 1 |
| Hospitality and Community | kitchen, community | 17 | 1 |
| Teaching and Education | teaching, education | 20 | 1 |

## Verification

Targeted checks passed.

```text
npm run verify:saul
npm run verify:saul-print
npm run verify:saul-modular-cv
```

Full gate passed after the patch.

```text
VERIFY ALL FAST PASSED — 77/77 checks in 18.8s.
```

## Remaining design choice

The print CV is now a one-page targeted artifact rather than a total archive dump. That is the correct tradeoff for the user's stated priority. The complete record remains on the webpage, and the PDF becomes the role-facing output.
