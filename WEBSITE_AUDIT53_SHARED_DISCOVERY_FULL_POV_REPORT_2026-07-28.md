# Website Audit 53

## Shared discovery for Teacher Resources, Polymythcal, and Polymyth Commons

Date: 2026-07-28

Release: `2026-07-28-site-audit53-shared-discovery-teacherresources-polymythcal-commons-final`

## Decision

The three projects now share one discovery rhythm while keeping the interface each task needs.

1. Start with the visitor’s goal
2. Search or narrow with precise filters
3. Keep the complete collection or record set available
4. Show the project’s place inside Polymyth Commons
5. Preserve sources, routes, evidence, and machine-readable data

Teacher Resources remains a classroom-resource collection. Polymythcal remains a bilingual calendar. Polymythlib remains a link-only library of libraries. Polymyth Commons remains the umbrella that explains their shared method, contribution paths, and governance.

The release adds no universal project-quality score and no classroom session runner.

## Teacher Resources

- 644 resources
- 25 source collections
- 7 teaching areas
- 644 stable `TR` identifiers
- 644 stable route keys
- 644 feed items
- 677 unique public routes including the root
- 677 unique page titles and canonicals

Search now comes first. Six task-led doors cover lesson planning, classroom texts, assessment, interactive material, Ontario teaching, and IB teaching. Subject, learner, and material shortcuts follow. The complete 25-collection shelf remains below them.

Every collection now has a specific description. Taxonomy values are normalized. Missing curriculum alignment is labeled as unrecorded instead of being converted to a generic cross-curricular claim. Teacher Resources remains English while source-language metadata remains visible, filterable, and semantic.

The root page is 445,357 bytes, 4,643 bytes below its hard ceiling. Its HTML, CSS, and JavaScript total 67,442 bytes gzip.

## Polymythcal

- 833 canonical records
- 32 event types
- 833 English record routes
- 833 French record routes
- 857 valid English recovery aliases
- 12 French aliases
- 845 per-record calendar files
- 11 indexed aggregate feed families
- Weekly refresh cadence

Goal-led doors now cover today, the coming week, attendance, application deadlines, youth and families, educators, and online participation. Detailed content, time, place, topic, audience, cost, access, and confidence filters remain available.

Dates without known times publish as dates rather than midnight. Application dates are labeled as deadlines. Pure opportunities emit no Event schema. Two evidence-clear confirmed events, JHI Writing Retreat and OSA Toronto Panorama, were corrected from opportunity records to event records.

English and French routes stay reciprocal and share related-record ordering. Saved listings and searches use versioned ID arrays with migration from the earlier local formats. The public calendar remains a once-weekly discovery system.

The compact browser payload retains all 833 IDs and 32 types while reducing transfer from 126,916 to 87,298 bytes gzip.

## Polymyth Commons

- 346 stable project records
- 393 book mentions
- 437 printed links
- 43 commons forms
- 79 project types
- 50 relationship terms
- 20 current-status seeds
- 8 versioned collections

One explicit collection model now powers both the static Seminar Schools directory and the hosted application.

| Collection | Records |
|---|---:|
| Ostrom seeds | 128 |
| Libraries and repositories | 67 |
| Open access | 85 |
| Archives and preservation | 53 |
| Community and civic knowledge | 36 |
| Standards and infrastructure | 71 |
| Concepts and comparisons | 25 |
| Currently reviewed | 20 |

Each collection publishes its rule, anchors, count, and stable member IDs. Every book mention and current-status seed joins to a stable project ID. Canonical project names win over aliases, which closes the California Digital Library and CIRCLE alias collisions.

Record pages distinguish a current site, continuing service, surviving archive, surviving documentation, reviewed destination, and book-era pointer. Book-derived descriptions are labeled source-grounded summaries. Related records are presented as shared book types rather than asserted relationships.

The data manifest now publishes schema documentation, rights context, and SHA-256 file digests. CSV nested values remain machine-readable. The deterministic generator and its inspected workbook input ship in the release.

The hosted directory now loads release-versioned compact indexes instead of bundling the complete research payload into page HTML.

- `/polymythlib` fell from 576,146 to 12,711 raw HTML bytes
- `/book-backbone` fell from 1,651,809 to 12,628 raw HTML bytes
- The 1,425,569-byte bundled data chunk was removed
- Directory and backbone client chunks are approximately 4.1 and 2.4 KB gzip
- All 27 table headers declare column scope

## Full-perspective critique and resolution

| Point of view | Strongest concern | Audit 53 resolution |
|---|---|---|
| First-time visitor | Three large projects can feel like three unrelated databases. | Each begins with plain-language goals and links back to the same Commons context. |
| Teacher in a hurry | A shelf-first resource page makes planning slow. | Search and real teaching tasks precede the complete shelf. |
| Teacher browsing widely | Task doors could hide useful material. | All 644 resources and all 25 collections remain available below the shortcuts. |
| Calendar visitor | Topic-first filtering can require knowing the site’s taxonomy. | Today, week, attend, apply, family, educator, and online goals provide direct starts. |
| Bilingual visitor | A translated shell can drift from record routes or machine metadata. | English and French routes, labels, related records, source hashes, and feeds are verified together. |
| Librarian or scholar | Current claims can overwrite the Ostrom book record. | Book evidence, current review, and Polymyth curation remain separate layers. |
| Archivist | A dead historical link can be mistaken for a living project home. | Role-aware endpoint labels preserve archives and documentation without calling them current homes. |
| Known-item researcher | Curated collections can obstruct direct retrieval. | Search, filters, stable IDs, table view, URL state, and complete downloads remain primary. |
| Curious browser | A flat directory of 346 records is exhausting. | Eight transparent collections provide optional paths through the complete directory. |
| Project representative | Aliases can attach evidence to the wrong entity. | Canonical names are resolved before aliases and every embedded and top-level join must agree. |
| Data reuser | Display-oriented CSV or undocumented JSON is difficult to reuse. | Nested CSV values serialize cleanly and the manifest publishes schema, rights, and digests. |
| Accessibility user | Dense controls and data tables can lose semantic structure. | Goal cards, semantic headings, visible labels, keyboard paths, scoped headers, zoom, and responsive gates pass. |
| Mobile or low-bandwidth visitor | Complete datasets can dominate the first response. | Compact release-keyed indexes load after the lightweight hosted shells. Full research data stays optional. |
| Search visitor | Duplicate resource titles can create duplicate metadata. | Distinct same-title records use source-qualified titles while preserving their stable routes. |
| Maintainer | Three independently generated systems can drift. | Permanent generators and release gates cover counts, routes, joins, labels, payloads, sitemaps, public mirrors, and preservation. |
| Existing-site owner | A large merge can regress the Greenpeace and CV work. | All 160 protected files remain byte-identical. |
| Skeptical critic | A universal quality score would add work and false authority. | The site reports evidence coverage and record state without ranking projects. |

## Compatible forks synthesized

### Goal-led guide and complete collection

Both. Goals shorten the first decision. Complete inventories preserve serendipity, auditability, and power-user access.

### Curated collections and direct search

Both. Collections explain why records belong together. Search and stable routes remain the factual retrieval layer.

### Historical source and current web status

Both, in separate fields. The book layer stays fixed. Current evidence carries a date, source, and role.

### Compact browsing and complete research data

Both. Ordinary visitors load compact indexes. Researchers can download full JSON, CSV, workbook, manifest, and changelog artifacts.

### English Teacher Resources and multilingual sources

Both. The interface stays English. Every resource retains source-language metadata and non-English titles carry language boundaries.

### Calendar event and application opportunity

Both, with different date and schema rules. Attendance uses event dates. Application records use deadline labels and omit Event schema unless the record is a confirmed event.

### Static Seminar Schools routes and hosted Commons application

Both. The ZIP contains the complete static site and research releases. The hosted Commons application provides the faster interactive directory and backbone.

## Cross-project integration

The Seminar Schools home page exposes Polymyth Commons in the visible section cards and the shared desktop and mobile project data. Direct Commons routes also remain in:

- About
- Teacher Resources
- English Polymythcal
- French Polymythcal
- Human sitemap
- XML sitemap
- `llms.txt`

Teacher Resources and Polymythcal link to each other and to Polymythlib. The Commons footer and navigation link back to both verticals.

## Technical verification

- 4,886 allowlisted public files are byte-identical to source
- 4,887 deployed public artifacts total 127,142,139 bytes
- 3,748 public HTML pages pass internal route, asset, form, anchor, and script checks
- 1,263 sitemap URLs reproduce deterministically
- 18,565 of 18,565 translation assertions pass
- 28 of 28 Polymythcal Audit 14 checks pass
- All aggregate RSS and ICS counts agree
- All checked calendar files use CRLF framing, 75-octet folding, and correct date or date-time values
- All 346 Commons project pages and 13 data-manifest digests pass
- 9,763 local Commons references resolve
- Managed Commons lint, TypeScript, build, artifact, render, and route-smoke checks pass
- All 160 protected Greenpeace and CV files are byte-identical

## External evidence boundary

The agent preview server started. A saved browser permission blocked the cloud browser from opening the internal preview, so this release makes no browser-interaction claim for that surface. Managed build, render, route-smoke, artifact, and production-deployment checks remain the release evidence.

Native Safari, branded Firefox, VoiceOver, NVDA, physical-device observation, real-user task completion, vendor-account calendar imports, deployed subscription refresh, and live review of every historical external link remain external follow-up.

The pinned `icalendar` dependency was unavailable in this shell. Independent calendar framing, folding, count, date-only, and timed-event checks passed. The vendor-library interoperability run remains external evidence.

No security audit was performed.
