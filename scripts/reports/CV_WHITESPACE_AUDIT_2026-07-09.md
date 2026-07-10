# CV whitespace audit and repair - 2026-07-09

## Front-facing problem

The one-page CV design was much stronger after the editorial folio revamp, but the default PDF still stranded a large blank area under the footer. The page looked designed in the top half and abandoned in the bottom half. That contradicted the standing CV rule: one page first, visually distinctive second, modular and targeted third, with no return to a boring archive-print layout.

## Repairs made

- Default broad CV now keeps 25 selected experience rows rather than 22, using the bottom third of the page without creating a second page.
- General output includes more legitimate experience rows instead of relying only on the older hand-picked keep list.
- Multi-tab combination PDFs now cap at 20 rows so dense mixed outputs do not spill into a second page.
- Sparse modular outputs now use density classes: `cv-ultra`, `cv-sparse`, `cv-airy`, and `cv-dense`.
- Sparse and airy outputs use a bottom-anchored footer so the page reads as an intentional one-page folio rather than a short half-page.
- Very sparse outputs use fuller descriptions drawn from the existing CV data instead of inventing content.
- Sparse selected outputs now add a front-facing `Selected Strengths` sidebar block.
- Date gutter widened to reduce date-column crowding against the vertical rule.
- `Core Signals` remains blocked. `Key Skills` remains the active public heading.
- Portrait and map remain website-only. The PDF remains text-first and one page.

## All-modular-state PDF audit

All 128 possible module states were rendered to PDF and checked with `pdfinfo` after the whitespace repair. Every rendered state returned `Pages: 1`.

The audit ledger is `cv-whitespace-rendered-128-states-2026-07-09.csv`.

## Rendered sample set

The downloadable rendered sample set still covers the default output, every single-tab output, the two core multi-tab outputs, and the all-tabs stress output.

| Output | Pages |
|---|---:|
| Default broad CV | 1 |
| Kitchen | 1 |
| Teaching | 1 |
| Community | 1 |
| Education | 1 |
| Volunteer | 1 |
| Performance | 1 |
| Portfolio | 1 |
| Kitchen + Community | 1 |
| Teaching + Education | 1 |
| All tabs stress output | 1 |

## Guardrails added

- `scripts/build-cv-pdf.js` has `CV_WHITESPACE_FILL_2026_07_09`.
- `saul/index.html` has `CV_WHITESPACE_FILL_2026_07_09`.
- `scripts/verify-saul-cv-whitespace.js` checks all 128 generated modular states at builder level.
- The verifier blocks multi-tab row caps above 20, missing density classes, missing bottom anchoring, missing `Key Skills`, and any return of `Core Signals`.
- `scripts/verify-all-runner.js` treats the whitespace verifier as a release gate.
- Static PDFs and sample PDFs were rebuilt after the patch.

## Verdict

The CV keeps the revamp's stronger visual identity while using page space more deliberately. The PDF still stays one page in every possible modular state, modular descriptions still change at the top, `Key Skills` remains front-facing, and the website remains the full archive.
