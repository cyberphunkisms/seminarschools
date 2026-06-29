# Seminar Schools Crawlability, Indexation, and Search-Surface Audit

**Audit date:** June 27, 2026  
**Working archive:** `seminarschools-seo-audited.zip`  
**Outcome:** Static search surface generated and verified. The public deployment itself remains unchanged until this archive is deployed.

## Governing finding

The central diagnosis was correct. The teacher-resource catalog, calendar, and methodologylist previously depended on client-side rendering for their useful content. A non-JavaScript fetch received filter controls, loading states, or an explicit empty-state notice instead of the resource and event records that search engines need to discover, understand, and rank.

The repair moves searchable content into build-time HTML while retaining JavaScript for filtering, interaction, and the existing visual experience.

## What now exists in the initial HTML response

| Search surface | Previous crawler-facing state | Static repair | Current audited count |
|---|---|---|---:|
| Teacher Resources | Filters and an empty catalog shell | Full server-delivered catalog plus permanent hierarchy | 719 resource detail pages, 8 group pages, 26 collection pages |
| polymythcalendar | `Loading events…` until JavaScript and JSON fetch | Server-delivered current calendar list plus permanent event pages | 198 current event cards, 205 future event pages |
| Event indexation | No permanent route per event | Stable event URLs with confidence controls | 31 indexable Event pages |
| Methodologylist | Interactive editor and an explicit non-JS empty state | Static section index plus permanent HTML reference editions | 1,080 entries across 15 section pages |
| XML sitemap | Broad site map without the generated search hierarchy | Generated from the same build pipeline | 852 canonical indexable URLs |

## Changes implemented

### 1. Static rendering and permanent URLs

- Added `scripts/build-search-pages.js`.
- The builder reads the same catalog JSON already embedded in `teacherresources/index.html` and emits fully rendered HTML without requiring browser JavaScript.
- Every catalog entry receives a permanent, descriptive URL under:
  - `/teacherresources/{subject-group}/{collection}/{resource-slug-hash}/`
- Added parent collection pages for every subject group and collection.
- The public calendar now ships a visible event list in the original HTML response and creates permanent event URLs under:
  - `/polymythseminars/events/{event-slug-hash}/`
- The interactive methodologylist remains intact, and the parent page now links to static HTML editions under:
  - `/polymyth/methodologylist/{section}/`

### 2. Crawl controls, sitemap, and canonicals

- Rebuilt `sitemap.xml` during the static build.
- Added all generated catalog hierarchy pages, resource pages, verified event pages, and methodology section pages to the sitemap.
- Preserved hand-authored pages that share the `/teacherresources/` parent path, including pages such as `/teacherresources/pedagogical-case/`.
- Confirmed that every sitemap URL maps to a real local HTML file, has a canonical URL, and does not carry `noindex`.
- Confirmed that `robots.txt` allows public educational routes, permits the public event data path, preserves restricted route exclusions, and declares the absolute sitemap URL.

### 3. Event trust and structured data gate

Calendar entries are stored with varied confidence and editorial-review states. Publishing uncertain dates as `Event` schema would create a trust problem and can produce incorrect rich-result facts.

- All 198 current calendar entries are readable in HTML and link to their own pages.
- 31 entries currently meet the index gate:
  - future event date within the coming year
  - editorial status `manual` or `auto-published`
  - confidence score of at least 80
  - no text indicating projected, verify, or confirm on the site
  - not an abstract call-for-papers or contest item
- Indexable event pages use `Event` schema.
- Lower-confidence event pages remain accessible to users but use `noindex,follow` and omit Event rich-result markup.

### 4. Unique relevance signals

- Added a unique title, meta description, canonical URL, Open Graph metadata, Twitter metadata, one H1, BreadcrumbList, WebPage schema, and purpose-specific structured data to every generated page.
- Resource pages use `LearningResource` schema and include the collection, subject, grade span, resource format, curriculum, publisher or host, original source link, and a curatorial explanation.
- Calendar pages use Event schema only for verified records.
- A duplicate audit after generation returned:
  - **0 duplicate generated title tags**
  - **0 duplicate generated meta descriptions**

### 5. Continuous generation and regression prevention

- Netlify now runs `node scripts/build-search-pages.js` during a public build.
- The daily event merge script calls the builder after refreshing `events.json`, so calendar updates refresh HTML pages and `sitemap.xml` in the same workflow.
- Added `scripts/verify-search-surface.js`.
- Added `npm run verify:search-surface` and wired it into `npm run verify:all`.
- The guard fails when:
  - the root catalog no longer contains all 719 server-delivered cards
  - the calendar returns to a loading shell
  - methodology section pages disappear
  - a sitemap URL is missing, noncanonical, or `noindex`
  - public resource/event paths become blocked in `robots.txt`
  - generated files become stale relative to their JSON/content source

## Audit evidence from the archive

| Test | Result |
|---|---:|
| Full catalog entries in source data | 719 |
| Catalog resource cards in initial HTML | 719 |
| Resource entries with authored notes or blurbs | 174 / 719 (24.2%) |
| Resource entries with original source URLs | 719 / 719 |
| Resource entries with stated grades | 633 / 719 |
| Resource entries with stated author or publisher | 711 / 719 |
| Current event cards in initial HTML | 198 |
| Future event detail pages | 205 |
| Indexable high-confidence Event pages | 31 |
| Static methodology sections | 15 |
| Methodology entries in section pages | 1,080 |
| Sitemap URLs | 852 |
| HTML pages checked by full predeploy suite | 1,043 |
| JavaScript files checked | 65 |
| Redirect rules checked | 145 |
| Generated title duplicates | 0 |
| Generated meta-description duplicates | 0 |

## Performance implications

The static catalog repairs indexation and creates a larger document response. The teacher catalog root is 921,457 bytes before compression and 148,620 bytes when gzip-compressed. The calendar root is 464,586 bytes before compression and 78,598 bytes gzip-compressed.

The static hierarchy distributes search discovery and user navigation across smaller group, collection, and detail pages. The root catalog still intentionally carries the full inventory so crawlers and users can reach every entry without JavaScript.

The next performance step requires deployed field measurement rather than archive-level guesses:

1. Run PageSpeed Insights for `/teacherresources/`, `/polymythseminars/`, and the largest methodology page.
2. Review Search Console Core Web Vitals after the deployment gathers real-user data.
3. Measure HTML transfer compression and cache headers on the deployed Netlify response.
4. Use `content-visibility: auto` for collapsed catalog sections only after confirming the affected text remains discoverable in the initial DOM and accessible to keyboard users.

## Remaining work that requires live ownership or external data

### Search Console and Bing Webmaster Tools

1. Verify `seminarschools.com` as a Domain property in Google Search Console.
2. Submit `https://seminarschools.com/sitemap.xml`.
3. Verify the site in Bing Webmaster Tools and submit the same sitemap.
4. Inspect at least one resource URL, one category URL, one verified event URL, and one methodology section URL using each platform’s URL inspection tools.
5. Watch the index coverage and page-indexing reports weekly for the first eight weeks.

### Analytics and performance monitoring

1. Confirm Google Analytics 4 is active on the deployed domain and exclude internal traffic.
2. Link Search Console and GA4.
3. Create a dashboard for impressions, clicks, indexed pages, non-indexed pages, average position, and organic leads by directory.
4. Track Core Web Vitals for the catalog, calendar, methodologylist, and Leizu service pages separately.

### Keyword research and intent mapping

The site now has crawlable targets. Search-volume and keyword-difficulty figures still require a current Canadian export from Ahrefs, Semrush, or Google Keyword Planner.

Prioritize clusters with clear user intent:

- OSSD teacher resources
- Ontario Grade 9, 10, 11, and 12 teaching resources
- IB teaching resources
- English Language Arts teaching resources
- Ontario humanities and history teaching resources
- French and FSL classroom resources
- Toronto public lectures, seminars, readings, and cultural events
- Toronto tutor, OSSD tutor Toronto, IB tutor Toronto, essay writing tutor Toronto

Map one query cluster to one canonical page family. Add editorial introductions, teacher-use cases, and curriculum-alignment notes before expanding page counts further.

### Content-quality and index-quality programme

The 719 resource pages now provide source, grade, format, collection, and curatorial context. The next material improvement lies in expanding the 174 entries that already have notes into richer editorial annotations and adding original educational value to the remaining entries.

Editorial priority:

1. Ontario and Canadian curriculum-aligned entries.
2. High-demand Grade 9–12 English, science, math, history, and IB resources.
3. Collections with strong source authority and useful teaching implementation notes.
4. Pages that receive impressions but weak click-through rates in Search Console.

Each upgraded page should answer teacher questions such as classroom use, preparation time, grade fit, differentiation, assessment application, source authority, and curriculum relationship.

### Local and off-page search

- Claim or review the Google Business Profile only if the service has a stable, eligible public business identity and accurate service-area information.
- Keep name, address or service area, phone, and website data consistent across any directory listing that is intentionally maintained.
- Earn links through original resources, public syllabus pages, teaching organizations, Ontario education communities, university or library event partners, and editorial coverage of original research or public programming.
- Avoid paid-link schemes and bulk directory submissions.

### Multilingual

Existing reciprocal language signals remain limited to genuine language equivalents. Expand `hreflang` only when each translated page offers equivalent content and a stable canonical counterpart. Do not point French, Traditional Chinese, or Simplified Chinese users to a language page that lacks the same subject matter.

## Recommended deployment sequence

1. Deploy this archive through Netlify.
2. Open the deployed teacher catalog, calendar, one resource URL, one event URL, and one methodology section URL in a browser with JavaScript disabled.
3. Submit the regenerated sitemap to Google Search Console and Bing Webmaster Tools.
4. Confirm that Google’s URL Inspection rendered HTML includes entry cards and event details.
5. Monitor pages indexed, crawl status, impressions, and Core Web Vitals for eight weeks.
6. Use the first Search Console query data to guide the next editorial and backlink cycle.

## Verification record

The full repository suite passed after these changes:

- critical calendar and data parity checks
- static search-surface checks
- geometry and presentation checks
- copy/register checks
- payments and Leizu intake checks
- localization and accessibility checks
- homepage and portfolio funnel checks
- site-integrity checks for routes, links, assets, anchors, forms, and scripts
- professional predeploy checks
- SEO deployment checks

The package includes `VERIFY_ALL_OUTPUT.txt` as the complete verification log.

## External standards referenced

- Google JavaScript SEO basics: https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics
- Google dynamic rendering guidance: https://developers.google.com/search/docs/crawling-indexing/javascript/dynamic-rendering
- Google sitemap guidance: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- Google canonicalization guidance: https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls
- Google Event structured data: https://developers.google.com/search/docs/appearance/structured-data/event
- Google Breadcrumb structured data: https://developers.google.com/search/docs/appearance/structured-data/breadcrumb
- Google course and educational structured data reference: https://developers.google.com/search/docs/appearance/structured-data
- Google Core Web Vitals guidance: https://developers.google.com/search/docs/appearance/core-web-vitals
