# Website Audit 52

## Polymyth Commons full-perspective critique, smoothness audit, and newest-base integration

Date: 2026-07-28

Release: `2026-07-28-site-audit52-polymyth-commons-greenpeace-merge-final`

Input package: `ss-site-audit50-greenpeace-cv-editable-complete-2026-07-28(1).zip`

## Decision

Polymyth Commons is the umbrella. Polymythlib is its link-only library of libraries. Teacher Resources and Polymythcal remain complete projects with their own interfaces while also functioning as Commons verticals.

The page architecture synthesizes the compatible alternatives:

- A searchable directory for known-item discovery
- Curated collections for guided discovery
- A complete book backbone for research and auditability
- Stable project pages for durable citation
- A method and governance section for editorial transparency
- Contribution routes for suggestions, corrections, relationships, status evidence, and preservation routes
- Compact browser indexes for speed plus complete research downloads for reuse and preservation

The release assigns no universal project-quality score. It reports field-specific evidence and the completeness of Polymyth’s record.

## Generation-0 backbone

- 346 unique named records
- 393 chapter-level project mentions
- 128 core directory candidates
- 154 commons-project scope records
- 167 supporting-ecosystem records
- 25 concepts and comparisons
- 437 unique printed URL or domain strings
- 484 printed-link occurrences
- 252 distinct parsed hosts
- 43 stable commons forms
- 79 book-derived project types
- 50 relationship terms
- 20 current-status seed checks
- 383 supplied PDF pages inspected
- 0 embedded PDF hyperlink annotations

Source: Charlotte Hess and Elinor Ostrom, eds., *Understanding Knowledge as a Commons: From Theory to Practice*, MIT Press.

## Full-perspective critique and resolution

| Point of view | Strongest critique | Audit 52 resolution |
|---|---|---|
| First-time visitor | “Commons,” “library,” “backbone,” and “vertical” can feel abstract. | The umbrella page offers four plain-language doors: browse projects, use Teacher Resources, open the calendar, and understand the method. |
| Known-item researcher | Curated storytelling can obstruct direct retrieval. | Search, filters, stable IDs, list/table views, URL state, and 346 canonical project routes provide direct retrieval. |
| Curious browser | A flat directory of 346 entries becomes tiring. | Six transparent collections and intent-led quick starts provide guided paths without hiding the complete directory. |
| Librarian or scholar | Current claims can accidentally rewrite the historical source. | Book evidence, current verification, and Polymyth curation remain three separate layers with page-level provenance. |
| Teacher | A research directory can feel detached from classroom use. | Teacher Resources stays a complete 644-resource, 25-collection vertical and links back into the Commons. |
| Calendar user | A library metaphor alone does not explain events. | Polymythcal stays a calendar vertical; English and French start pages identify its Commons relationship. |
| Project representative | A directory may misstate ownership, status, or succession. | Every record exposes a correction route; contribution options distinguish links, relationships, current evidence, and preservation routes. |
| Contributor | Fully open editing can create duplicate, promotional, or weakly sourced records. | Structured contribution routes feed a transparent editorial workflow while stable IDs and release history preserve changes. |
| Archivist | Link directories decay and can erase disappeared projects. | Historical pointers, current pointers, successor/operator/archive fields, stable IDs, downloadable releases, and a changelog preserve distinct states. |
| Accessibility user | Score-like icons and oversized live regions can become ambiguous or noisy. | Signal rows say “Recorded” or “Open field,” filters use ordinary pressed buttons, result counts carry the live update, and project pages include keyboard, zoom, calm-mode, and semantic-list support. |
| Mobile or low-bandwidth user | Loading the complete research JSON for ordinary browsing is excessive. | The directory uses a 212 KB raw index under 40 KB gzip; the backbone uses a 641 KB raw index under 120 KB gzip. Complete exports remain optional downloads. |
| Search and sharing | Generated records can become orphaned or share poorly. | Canonicals, route types, Open Graph/Twitter metadata, XML sitemap coverage, human-sitemap links, and `llms.txt` coverage make the project legible to people and machines. |
| Maintainer | Hundreds of hand-edited project pages become inconsistent. | One generator creates all 346 records and both compact indexes; permanent verifiers enforce counts, semantics, payload ceilings, navigation, and public parity. |
| Skeptical critic | “Current,” “verified,” or “quality” language can overclaim. | The interface uses “current review pending,” dates and sources current evidence, and evaluates individual evidence fields rather than projects. |
| Privacy and governance | Contribution forms can collect more personal information than the directory requires. | The static form prepares user-controlled email content and requests project evidence rather than accounts or background profiles. |
| Security and delivery | A new route family can weaken headers, CSP, or build boundaries. | Commons routes are explicitly allowlisted; CSP, cache, route-doctrine, data-hygiene, runtime-delivery, page-size, and public-artifact gates cover the new surfaces. |
| Existing-site owner | Merging into a new ZIP can regress the newest Greenpeace/CV work. | The supplied manifest was checked across all original files; 160 Greenpeace/CV-related files remain byte-identical. |

## Substantial forks and the chosen synthesis

### Directory or curated guide

Both. The directory is the complete factual surface; collections are optional, rule-based paths through it.

### Historical catalog or live status tracker

Both, with separate fields. The book record stays fixed. Current status carries its own source and date. Polymyth’s curation remains visibly editorial.

### One large Commons page or a routed system

A small start page plus focused routes. This keeps first contact simple while letting the directory, collections, method, backbone, contribution form, and record pages do one job each.

### Small browser payload or complete research data

Both. Compact indexes serve interactive browsing. Full JSON, CSV, XLSX, manifest, and changelog files serve researchers and preservation.

### Commons everywhere or an isolated microsite

Light integration everywhere, independent interfaces where needed. The home page, About, Teacher Resources, English/French Polymythcal, human sitemap, XML sitemap, and `llms.txt` all expose the Commons; each vertical retains its own task-specific design.

### Project-quality rating or descriptive evidence

Descriptive evidence. A universal rating creates maintenance work and false authority. Six explicit field states tell visitors what Polymyth has actually recorded.

## Seminar Schools integration

The Seminar Schools home page exposes `/polymythcommons/` in:

1. The visible “Choose a section” card set
2. The desktop project map
3. The mobile project rail generated from the same project-node data

Additional Commons routes appear in:

- `/about/`
- `/teacherresources/`
- `/polymythseminars/`
- `/polymythseminars/fr/`
- `/polymyth/sitemap/`
- `/sitemap.xml`
- `/llms.txt`

## Technical smoothness results

- Directory index: 346 records, approximately 212 KB raw and 28 KB gzip
- Backbone index: 346 records, approximately 641 KB raw and 100 KB gzip
- Stable project pages: 346 source and 346 public mirrors
- Collection counts: library 42, open access 40, preservation 53, community 41, infrastructure 47, core book candidates 128
- Teacher Resources retained: 644 resources and 25 collections
- Polymythcal retained: 833 canonical events
- Original supplied files missing: 0
- Greenpeace/CV-related files checked: 160
- Greenpeace/CV-related files modified: 0
- Browser payload ceilings remain separate from the bounded complete-deploy archive ceiling

## Verification surfaces

- Commons schema, counts, stable IDs, project pages, filters, collections, contribution routes, method, and data releases
- Front-page card, desktop-map, mobile-rail, About, Teacher Resources, English/French Polymythcal, and sitemap integration
- Source/public route parity and generated-route indexing
- Current English-source hashes across governed French, Chinese, and Persian routes
- Keyboard navigation, zoom resilience, visible labels, semantic controls, and responsive regression contracts
- Canonical, social-sharing, SEO, sitemap, route-doctrine, CSP, cache, runtime-delivery, and data-hygiene contracts
- Page-size, heavy-page, compact-index gzip, and complete-deploy asset ceilings
- Greenpeace/CV release and byte-level preservation checks
- Deterministic ZIP membership, CRC, SHA-256, and checksum-sidecar verification

## External follow-up boundary

The managed preview server started successfully. The cloud browser permission gate declined access to its local URL, so browser interaction evidence remains external to this run. Native Safari, branded Firefox, VoiceOver, NVDA, physical-device observation, real-user testing, and live review of all 437 historical external links remain valuable follow-up evidence.

The release includes CSP, data-hygiene, public-artifact, and runtime-delivery checks. A dedicated penetration test remains a separate security exercise.
