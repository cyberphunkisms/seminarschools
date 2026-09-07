# ML* update source — universal document continuity

Date: 2026-09-06  
Status: direct operator instruction with a supplied visual example

## Operator instruction

> “you see how sections get cut off ? lets make a rule that for EVERY document you give me, we need to make sure this doesnt happpen, put it in ML*”

The supplied 792 × 409 screenshot shows page 11 ending with the heading `4.3 Rating gates`, a table header, and one data row. The same table resumes on page 12. Screenshot SHA-256: `beae08ffbad69be8b03a78922d70207b5e7a4feab3855c5fc6fd08a5ec4a863d`.

## Adopted meaning

The instruction applies to every user-facing file with pages or slides that the assistant creates or revises. This includes Word documents, PDFs, presentations, and print exports of spreadsheets or web pages.

A document fails when any page or slide contains clipped or overflowing content, a heading without its first meaningful content block, a short table or form split despite fitting on a fresh page, a table fragment with only one data row, a split row, a tiny list continuation, a citation or label broken into an ambiguous fragment, or a footer, header, note, image, or table that collides with the content area.

A long table or list may cross a page only when the whole unit cannot fit on one fresh page at a readable size. Every table continuation repeats its column headers, keeps rows intact, and leaves at least two data rows on each side of the break whenever the row count permits. The heading, table header, and first two data rows stay together. The final two data rows stay together. A short table, form, callout, captioned figure, or short list stays whole with its heading when it fits on a fresh page.

Before delivery, render the actual final file through the delivery renderer and inspect every page or slide at readable scale. Audit every boundary, table, list, figure, form, header, footer, link label, and page number. Spot checks, source-code inspection, or a successful export do not satisfy the rule. Delivery remains blocked until every avoidable continuity defect is corrected. If the renderer makes a defect impossible to resolve, identify the exact page and defect and do not call the artifact finished.

Resolve fit with layout controls first. Use spacing, padding, row grouping, table widths, page breaks, section placement, and structural reflow. Do not delete user-approved substance to make a page fit unless the user explicitly authorizes the cut.

## Link-function amendment

The operator later reported that the PDF links did not work. This extends the same final-file rule from visible layout to usable navigation.

A link audit fails when it proves only that annotations exist. Every external link must use a standard URI action, every internal link must resolve to the intended destination, and every link hitbox must overlap its visible label without being empty or displaced. A source list must print a complete copyable URL or DOI beside each source so the reader retains a fallback when a PDF viewer blocks link activation.

Before delivery, test the actual final PDF with at least two independent PDF link parsers. Compare their link counts and targets, resolve internal destinations, and check every hitbox against rendered text. When the delivery reader is available, open the delivered file and test representative external, internal, and footer links there as well. Annotation presence alone, a source-file hyperlink, or a successful export does not establish that the delivered link works.
