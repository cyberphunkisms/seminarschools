# Website front-facing re-audit

Date: 8 August 2026  
Scope: complete editable Seminar Schools website package  
Baseline: `ss-site-saul-cv-job-evidence-front-facing-audited-editable-masters-complete-2026-08-07.zip`  
Baseline SHA-256: `3651dca98f2693e49f474092c2df1243f72b9ec9b1a8a60a7e1f37968fcb09bd`

## Finding

The prior CV revision solved a retrieval problem by adding a separate “Selected evidence / How the work was done” panel. That was the wrong information architecture. It repeated facts outside the jobs and projects that made them credible, sounded like an internal evidence ledger, added another navigation destination, and made the page feel written for an evaluator or an AI rather than an employer or ordinary reader.

The same underlying problem appeared elsewhere in smaller forms: database field names on Polymythlib records, audit language injected into the calendar, partial translations that looked complete to search engines, unexplained `open_transmission` links, a stale build stamp, and product names whose casing changed between pages.

## Reader and stakeholder critique

- **General visitor:** headings should answer “what is this?” and “where do I go?”, not describe the site’s production process.
- **Hiring manager:** evidence is strongest inside the relevant employment entry. A detached proof panel makes the reader reconcile two versions of the same record.
- **Recruiter and ATS user:** the web profile, one-page application files, and complete history need distinct purposes and ordinary download labels. Internal module, email-edition, and output-archive choices do not belong in the public interface.
- **Community and nonprofit employer:** volunteer recruitment, student leadership, records, participant scale, and live operations are material work. They should be stated plainly under Campus Crops, teaching, BUMI Festival, and Model UN rather than abstracted into “selected evidence.”
- **Parent, student, or prospective teacher:** current services must be separated from future plans. Platform comparisons and unverified superlatives undermine trust; the actual 80/20 arrangement can stand on its own.
- **Multilingual reader:** a localized summary followed by English detail is useful only when that boundary is immediate and explicit. It is not a complete translation and must not be indexed as one.
- **Accessibility user:** every extra panel and dead anchor increases navigation cost. Localized CV routes should expose only the sections that remain visible.
- **Maintainer:** fixes must live in canonical generators, data, and regression gates as well as generated HTML; otherwise the next build restores the failure.

## Repairs made

### CV and professional record

- Removed the detached evidence panel, its heading, anchor, navigation item, CSS, JavaScript, data field, print logic, and generator logic.
- Integrated the evidence into the relevant experience entries:
  - teaching now includes the substantial initial work used to establish student governments that later ran independently, Model UN, environmental and yearbook clubs, and reviewed, approved, and signed volunteer-hour records;
  - Campus Crops now states responsibility for recruiting, interviewing, orienting, placing, supporting, evaluating, and maintaining records for approximately 20 core volunteers, plus recruitment and coordination for the associated farmers’ market;
  - BUMI Festival now states five days of operations serving nearly 2,000 participants, including setup, takedown, transport, information, security, crowd flow, guests, vendors, and participant needs;
  - Model UN now states the schedules, assignments, stakeholders, deadlines, participant questions, and live logistics involved, including approximately 1,600 McMUN delegates.
- Reframed the public profile as educator, program coordinator, and community organizer.
- Kept the credential record exact: Bronze Cross / First Aid was earned in 2006 and is not current.
- Kept Farsi speaking and reading strength distinct from slower functional writing; French and Mandarin remain basic.
- Reduced public downloads to a professional PDF, professional Word file, and complete career-history PDF.
- Restored the CV section navigation as separate, readable 44-pixel controls with contained horizontal scrolling on narrow screens; the regression gate now checks the live stylesheet as well as the anchor targets.
- Rebuilt focused application PDFs as actual role-oriented documents with matching experience, education, credentials, and languages.
- Localized Saul archive routes now offer only Map and Full history navigation, a localized link to the English application CV, and no dead return link to the hidden application section.

### Whole-site language

- Rewrote Florilegium and Marginalia production/editorial explanations as direct descriptions for readers.
- Made the reviews page singular and factual because one public recommendation is currently available.
- Removed the visible stale build stamp.
- Standardized current human-facing calendar chrome as `Polymythcal` while preserving historical and methodological references where the old form is part of the record.
- Replaced opaque `open_transmission` labels with descriptive public reading, announcement, project, or RSS link text.
- Simplified the Agora schedule explanation and the focused-calendar route navigation.
- Changed the Simple English control to `Exit Simple English`.
- Changed subscription explanations from internal “canonical data” language to the plain statement that RSS and ICS contain the same calendar listings.

### Leizu accuracy and localization

- Corrected `嫲祖學院` to `嫘祖學院`.
- Replaced Zoom with Google Meet in current service copy.
- Removed Wyzant, Outschool, and Preply comparisons and the unsupported “highest take-home” claim.
- Retained the direct 80% teacher / 20% shared-services model and its written-rate boundary.
- Clarified that Saul currently teaches Leizu students and future teachers may join only after interview and seminar-method training.
- Removed the PhD claim and aligned About with the verified experience and language record.
- Classified all 36 Leizu locale funnel pages honestly as `localized-summary-english-detail`: localized summary first, explicit notice that the details are in English, immediate link to the complete English page, `noindex,follow`, and deterministic removal from the sitemap.
- Added WebPage JSON-LD to the English and French subscription pages.

### Polymythlib

- Replaced database and review-workflow headings with ordinary reader labels such as Current status, Responsible organization, What this record includes, Book source, Sources and links, and Related records.
- Mapped candidate tiers, scopes, source roles, and status codes to readable phrases in browser text while preserving raw values in datasets and data attributes.
- Rewrote the directory, source-book index, collections, contribution, and method pages for public readers.
- Replaced the old fallback with `Current status not yet reviewed`.
- Removed the repeated “X, not Y” sentence and dash-heavy explanatory copy from the record generator; the register gate now reports zero dash, negation-definition, or filler violations across the generated pages.

## Deliberately preserved

This audit does not flatten substantive work simply because it discusses AI, facilitation, research method, or internal game operations. The Polymyth methodology, AA and BB manuals, Bookwormcard systems, noindex facilitator and campaign routes, AITR, teacher-resource pedagogy, and creative or research prose retain the language their subject requires. The boundary is between meaningful content and production chatter, not between “ordinary” and technically complex subjects.

## Regression protection

`scripts/verify-front-facing-boundary.js` now audits source HTML, the public mirror, browser-loaded JavaScript, reader-facing generators, Saul data and generators, all 346 Polymythlib records, the 36 Leizu summary-only locale routes, current product chrome, localized Saul navigation, and existing manual/public boundaries. It rejects the removed CV panel, stale build text, Leizu typo and unsupported claims, opaque public link labels, old Polymythlib labels, raw status codes in visible record text, misleading translation metadata, bad localized navigation, and reintroduction of retired routes.

`scripts/verify-audit45-translations.py` now enforces the same 36-route partial-translation contract and sitemap exclusion. Focused-calendar verifiers now enforce the shorter reader-facing navigation sentence.

The complete built-site runner passes 161/161 checks, including the immediate-rebuild fixed-point test and the real-browser geometry matrix.

No deployment was performed as part of this re-audit. The final ZIP remains a complete editable handoff with source, generated public mirror, editable CV masters, verification scripts, and release documentation.
