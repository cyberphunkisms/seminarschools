# Website Audit 51

## Polymyth Commons and Polymythlib Generation 0

Date: 2026-07-28

Release: `2026-07-28-site-audit51-polymyth-commons-generation0`

## Public architecture

- `/polymythcommons/` is the shared umbrella.
- `/polymythlib/` is the link-only library of libraries.
- `/teacherresources/` remains the classroom collection vertical.
- `/polymythseminars/` remains the Polymythcal calendar vertical.
- `/polymythlib/collections/` supplies transparent curated pathways.
- `/polymythlib/book-backbone/` exposes the full generation-0 research tables.
- `/polymythlib/method/` publishes the record model, expansion logic, governance, and citations.
- `/polymythlib/contribute/` supports project suggestions, corrections, link reports, relationship proposals, and project-representative evidence.

## Generation-0 backbone

- 346 unique named records
- 393 chapter-level project mentions
- 128 core directory candidates
- 154 commons-project scope records
- 167 supporting-ecosystem records
- 25 concept and comparison records
- 437 unique printed URL or domain strings
- 484 printed-link occurrences
- 252 distinct parsed hosts
- 43 stable commons forms
- 79 granular book-derived project types
- 50 relationship terms
- 20 bounded current-status seed checks
- 383 supplied PDF pages inspected
- 0 embedded PDF hyperlink annotations

Source: Charlotte Hess and Elinor Ostrom, eds., *Understanding Knowledge as a Commons: From Theory to Practice*, MIT Press.

## Interface

- Search across names, aliases, types, roles, operators, current evidence, and page references
- Four directory scopes
- Intent-led quick starts
- Public filters for type, book role, and verification
- Research Mode for candidate tier and chapter
- List and table views
- Stable record pages for every generation-0 entity
- Current and book-era pointers kept separately
- Visible evidence and record-completeness signals
- Relationship lists based on an explicit shared book-derived type
- Curated collections with transparent selection rules
- JSON, CSV, manifest, and changelog downloads

## Evidence model

The release preserves three distinct layers:

1. Book facts with exact source pagination and printed pointers
2. Current verification with source URLs, dates, and confidence
3. Polymyth curation with scopes, collections, and editorial decisions

Historical, current, successor, operator, archive, and preservation claims do not overwrite one another.

## Quality

The release does not assign a universal project-quality score.

It reports concrete features and the completeness of Polymyth’s own evidence:

- Current URL recorded
- Current state checked
- Operator identified
- Verification sources recorded
- Book pointer preserved
- Book entity and page evidence present

## Integration

- Added Polymyth Commons to the Seminar Schools home project map.
- Added a Commons start-here card.
- Added Commons context to Teacher Resources.
- Added Commons context to Polymythcal.
- Added all public routes and 346 stable record pages to the sitemap.
- Added Commons, Polymythlib, method, backbone, and data routes to `llms.txt`.
- Added `polymythcommons` and `polymythlib` to the allowlisted public build.
- Preserved source and public deploy mirrors.

## Verification

`node scripts/verify-polymyth-commons.js`

Result:

> POLYMYTH COMMONS VERIFICATION PASSED — 346 records, 437 printed links, 346 stable pages, complete data releases, native site integration, and deploy parity.

Additional gates:

- Polymyth Commons app lint passed.
- Polymyth Commons TypeScript check passed.
- Managed production build completed.
- Managed production deployment succeeded.
- Static JavaScript syntax checks passed.
- Public build completed with the new allowlisted routes.

## External validation boundary

The managed live preview could not start because the environment exhausted its file-watcher allowance while the complete legacy archive was present. The production build and deployment completed successfully. Native Safari, Firefox, screen-reader, physical-device, and real-user validation remain external.

No security audit was performed.
