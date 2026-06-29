# Polymythcal technical audit — 2026-06-29

Scope: writing shortcut pages first, then `polymythcalendar`, then the wider Seminar Schools static website.

## Executive result

The deployable bundle passes the full verification suite after this audit pass. The writing pages are usable as one-slash share links, render the correct static competition lists, and now expose crawlable writing-band navigation, accessible result-count updates, safer external-link attributes, clearer SEO titles, and `ItemList` structured data.

The most important remaining issue is performance architecture: each writing shortcut page still embeds the full 470-event calendar fallback payload, even when the page displays only 13 to 39 writing competitions. This is robust, but inefficient.

## Fixed in this pass

- Converted the Writing shortcut controls from JavaScript-state buttons to real links: `/writingclub/`, `/writingkids/`, `/writingjuniors/`, `/writingteens/`, `/writinggrads/`.
- Added accessible status semantics to the result-count line: `role="status"`, `aria-live="polite"`, and `aria-atomic="true"`.
- Set the calendar and writing pages to Canadian English locale markup: `lang="en-CA"`.
- Hardened JavaScript-rendered external source links with `rel="noopener noreferrer"`.
- Added route-specific `ItemList` JSON-LD to all five writing pages.
- Strengthened the five writing-page `<title>` values.
- Added explicit no-cache header rules for `/polymythseminars/` and all five writing shortcut routes.
- Added forced 404 deploy-block rules for the new audit handoff files so the audit can travel inside the archive without becoming a public page.

## Verification result

```text
npm run verify:all PASS
SEARCH SURFACE CHECK PASSED — 719 catalog resources, 266 current event cards, 15 methodology sections, 981 sitemap URLs.
CALENDAR DATA PARITY OK — 470 mirrored entries.
WRITING SHORTCUT CHECK PASSED — 39 current youth writing competitions; counts {"writingclub":39,"writingkids":13,"writingjuniors":20,"writingteens":36,"writinggrads":36}.
SITE INTEGRITY GUARD PASS.
SEO DEPLOYMENT GUARD PASS.
PROFESSIONAL PREDEPLOY READINESS PASS.
BOOKWORMCARD GATE PASS.
```

## Writing route status

| Route | Static cards | Title | Canonical | Writing nav | Count line | JSON-LD |
|---|---:|---|---|---:|---|---|
| `/writingclub/` | 39 | `Writing Club | Youth Writing Competitions | Seminar Schools` | `https://seminarschools.com/writingclub/` | 5 links | accessible | CollectionPage, ItemList |
| `/writingkids/` | 13 | `Writing Kids | Children’s Writing Competitions | Seminar Schools` | `https://seminarschools.com/writingkids/` | 5 links | accessible | CollectionPage, ItemList |
| `/writingjuniors/` | 20 | `Writing Juniors | Middle Grade Writing Competitions | Seminar Schools` | `https://seminarschools.com/writingjuniors/` | 5 links | accessible | CollectionPage, ItemList |
| `/writingteens/` | 36 | `Writing Teens | High School Writing Competitions | Seminar Schools` | `https://seminarschools.com/writingteens/` | 5 links | accessible | CollectionPage, ItemList |
| `/writinggrads/` | 36 | `Writing Grads | Grade 11 and 12 Writing Competitions | Seminar Schools` | `https://seminarschools.com/writinggrads/` | 5 links | accessible | CollectionPage, ItemList |

## Calendar data status

```text
Calendar records: 470
Current static cards on /polymythseminars/: 266
Youth writing competitions with explicit writing_bands: 39
writingclub: 39
writingkids: 13
writingjuniors: 20
writingteens: 36
writinggrads: 36
Missing source URLs: 0
Duplicate exact title/date pairs: 0
```

`writingteens` and `writinggrads` intentionally overlap because many contests are open to a broad high-school or age 13–18 band. The user-facing copy should make this clear: `Writing Teens` means teen/high-school eligibility, while `Writing Grads` means contests especially useful for Grade 11, Grade 12, graduating, scholarship, and portfolio-building students.

## Priority 1 — writing shortcut page issues

### 1. Full calendar fallback is still embedded in every writing page

| Page | HTML bytes | Gzip bytes | Full fallback payload | Visible static cards |
|---|---:|---:|---:|---:|
| `/polymythseminars/` | 594,512 | 97,809 | 361,013 | 266 |
| `/writingclub/` | 464,109 | 76,636 | 361,013 | 39 |
| `/writingkids/` | 436,311 | 72,603 | 361,013 | 13 |
| `/writingjuniors/` | 443,667 | 73,643 | 361,013 | 20 |
| `/writingteens/` | 460,681 | 76,087 | 361,013 | 36 |
| `/writinggrads/` | 461,240 | 76,126 | 361,013 | 36 |

Recommended fix:

```text
/writingclub/events.json
/writingkids/events.json
/writingjuniors/events.json
/writingteens/events.json
/writinggrads/events.json
```

Then each page can keep a small server-rendered list and only load the matching writing-band data. The full `/polymythseminars/events.json` file can load only when a visitor opens the wider calendar.

### 2. Competition cards need structured eligibility fields

The current writing-band logic works, but much of the useful contest detail lives inside prose descriptions. The next model upgrade should turn that prose into filterable fields.

Recommended fields:

```json
{
  "organizer": "",
  "eligibility_country": "Canada / Worldwide / province-specific",
  "eligible_grades": [],
  "eligible_ages": [],
  "province_scope": [],
  "genres": [],
  "entry_fee": "free / fee / unknown",
  "prize_summary": "",
  "deadline_status": "verified / projected / rolling / unknown",
  "submission_url": "",
  "rules_url": "",
  "last_verified": "YYYY-MM-DD"
}
```

This unlocks filters and chips that teachers and students will actually use:

```text
Free
Canada-wide
Ontario
Worldwide
Poetry
Essay
Story
Journalism
French
Braille
Verified deadline
Projected deadline
Official rules
```

### 3. Writing pages need “why this page” microcopy

Each writing shortcut should explain the band in one sentence:

```text
Writing Kids: contests for elementary-age writers and younger children.
Writing Juniors: contests for junior and middle-grade writers.
Writing Teens: contests open to teen writers and high-school students.
Writing Grads: contests useful for Grade 11, Grade 12, graduating, scholarship, and portfolio-building students.
```

### 4. Add teacher/parent export controls

Recommended controls:

```text
Print this list
Download CSV
Copy student link
Copy parent link
Show free contests only
Show verified deadlines only
```

## Priority 2 — Polymythcal-wide issues

### 5. Twelve indexable pages sit outside the sitemap

The SEO guard confirms all sitemap URLs are clean. A deeper crawl found 12 pages that declare canonical indexable URLs but are not included in `sitemap.xml`.

Examples:

```text
/polymyth/
/marginalia/example-review/
/polymyth/devils-notebook/
/teacherresources/pedagogical-case/
/polymythseminars/events/pride-toronto-parade-2026-2026-06-28-3dcecab8/
```

Recommended rule:

- Add pages to the sitemap when they should receive search traffic.
- Add `noindex,follow` when they are utility, staging, archive, internal, or thin pages.

### 6. Five hash links target missing anchors

Routes resolve, but the fragment IDs do not exist.

```text
aa/editorial.html -> /aa/#mode=pending
campaigns/thank-you-mam/pregame/index.html -> /polymyth/campaigncodex/#cc-cmp001-curriculum-anchor-map
campaigns/thank-you-mam/pregame/index.html -> /polymyth/campaigncodex/#cc-cmp001-triangulation-rubric
teacherresources/ela/ela-inst-esl/denote-92453e09/index.html -> /aitr/#denote
teacherresources/ela/ela-inst-esl/monster-battle-73b3b982/index.html -> /aitr/#monster-battle
```

Recommended fix: add matching destination IDs or update the source links to existing anchors.

### 7. Single-event pages need a clear indexing policy

Event pages are internally linked from calendar cards. Some have canonical/indexable markup while staying outside the sitemap. That can be deliberate, but the policy should be explicit.

Recommended policy:

```text
Index evergreen route pages and strong current event pages.
Noindex thin or expired event pages.
Keep only search-worthy event pages in the sitemap.
Use noindex,follow automatically after expiry when standalone content is thin.
```

### 8. Metadata cleanup remains across the wider site

Current crawl:

```text
Missing title: 1
Missing meta description: 4
Missing canonical: 2
No H1: 1
Multiple H1: 1
Duplicate IDs: 0
Images missing alt: 0
Invalid JSON-LD: 0
```

Known items:

```text
google20234ae70106ee9d.html — verification file, acceptable exception
404.html — noindex page; canonical optional
bookwormcard/index.html — 2 H1 elements
campaigns/thank-you-mam/dm-board/index.html — missing meta description
campaigns/thank-you-mam/unlocks/index.html — missing meta description
sitemap/index.html — missing meta description
```

Recommended fix: leave the Google verification file alone, add missing descriptions to public pages, and change the second Bookwormcard H1 to H2.

## Priority 3 — whole-site security and deployment issues

### 9. Security headers are good; CSP is the next hardening layer

Present:

```text
X-Frame-Options: present
X-Content-Type-Options: present
Referrer-Policy: present
Permissions-Policy: present
Strict-Transport-Security: present
Content-Security-Policy: missing
Content-Security-Policy-Report-Only: missing
```

Recommended next step: add `Content-Security-Policy-Report-Only`, monitor violations, then enforce CSP after inline scripts/styles and external dependencies are inventoried.

Starter report-only policy:

```text
Content-Security-Policy-Report-Only: default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; img-src 'self' data: https:; font-src 'self' data: https:; style-src 'self' 'unsafe-inline' https:; script-src 'self' 'unsafe-inline' https:; connect-src 'self' https:; upgrade-insecure-requests
```

### 10. Header behavior should be verified on final Netlify URLs

The archive now has explicit no-cache rules for:

```text
/polymythseminars/
/writingclub/
/writingkids/
/writingjuniors/
/writingteens/
/writinggrads/
```

After deployment, check final response headers:

```bash
curl -I https://www.seminarschools.com/writingclub/
curl -I https://www.seminarschools.com/writinggrads/
curl -I https://www.seminarschools.com/polymythseminars/
```

Confirm:

```text
cache-control
x-frame-options
x-content-type-options
referrer-policy
permissions-policy
strict-transport-security
```

### 11. Public artifact boundaries are now guarded, but architecture can be cleaner

The current zip contains source, script, and audit files because it is also a handoff artifact. Forced block rules protect root audit files and internal folders. Long-term, the cleaner architecture is:

```text
/src        source files, scripts, audits, raw data
/public     deployable static output only
/reports    handoff reports, kept out of production deploy
```

### 12. Redirect order remains important

The writing shortcuts and slashless redirects are healthy. Keep specific shortcut rules before broad aliases or catch-all rules so `www.seminarschools.com/writinggrads` resolves directly to `www.seminarschools.com/writinggrads/`.

## Priority 4 — automated guard improvements

Recommended new checks:

```text
scripts/verify-writing-page-weight.js
scripts/verify-indexable-sitemap-coverage.js
scripts/verify-hash-anchors.js
scripts/verify-csp-baseline.js
scripts/verify-event-indexing-policy.js
scripts/verify-writing-card-fields.js
```

These would catch the exact hidden issues found in this pass.

## Custom crawl summary

```json
{
  "html_pages": 1119,
  "js_files": 73,
  "css_files": 7,
  "sitemap_urls": 981,
  "calendar_events": 470,
  "current_event_cards": 266,
  "current_youth_writing_competitions": 39,
  "missing_internal_links": 0,
  "missing_local_assets": 0,
  "bad_hash_anchors": 5,
  "duplicate_ids": 0,
  "images_missing_alt": 0,
  "target_blank_missing_noopener_noreferrer": 0,
  "invalid_jsonld": 0,
  "missing_source_urls_in_calendar": 0,
  "duplicate_title_date_calendar_pairs": 0
}
```

## Best next implementation batch

1. Generate route-scoped writing JSON and remove the full 470-event fallback from writing shortcut pages.
2. Add first-class writing competition fields for eligibility, genre, fee, prize, deadline confidence, rules URL, and submission URL.
3. Add public chips for `Free`, `Canada-wide`, `Ontario`, `Poetry`, `Essay`, `French`, `Braille`, `Verified`, and `Projected`.
4. Resolve the five bad hash anchors.
5. Decide sitemap/noindex policy for the 12 indexable pages outside the sitemap.
6. Add CSP in report-only mode.
7. Add print, CSV, and copy-link controls for teachers and parents.

## Reference standards consulted

- Google Search Central, Learn about sitemaps: `https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview`
- Google Search Central, Block Search indexing with noindex: `https://developers.google.com/search/docs/crawling-indexing/block-indexing`
- Google Search Central, How to specify a canonical URL: `https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls`
- Google Search Central, Introduction to structured data markup: `https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data`
- W3C WAI, ARIA22 role=status technique: `https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA22.html`
- W3C WAI, WCAG 2.2 target size minimum: `https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html`
- MDN, Content Security Policy: `https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP`
- Netlify Docs, custom headers: `https://docs.netlify.com/routing/headers/`
- Netlify Docs, redirects and rewrites: `https://docs.netlify.com/routing/redirects/`
