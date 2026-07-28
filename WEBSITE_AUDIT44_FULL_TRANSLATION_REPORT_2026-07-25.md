# Audit 44 — Full Translation and Localization Audit

**Date:** 2026-07-25  
**Audited release:** `2026-07-25-site-audit43-approved-evolution-weekly-final`  
**Frozen source ZIP SHA-256:** `198686d846e0cfcd11a67b744b70c6b4e70d26f698d999de0909f9636b8ac9c5`  
**Scope:** translation, localization, language semantics, multilingual routing, translated metadata, RTL/LTR layout, content parity, anti-yap, anti-jerk, and translation-specific performance  
**Excluded:** security auditing and implementation

## Verdict

The site does **not** yet have a coherent translation system. It has four separate implementations:

1. Leizu: a strong five-language runtime dictionary on the homepage, plus a much weaker preference banner on English subpages.
2. Polymythcal: an English/French runtime dictionary on calendar shells, a different persistence layer on event and utility pages, and bilingual side-by-side event/form chrome.
3. Saul: an inline five-language archive system layered under an English-only professional CV surface.
4. bookwormburrows: one proper dedicated Simplified Chinese route paired with its English route.

The previous “complete” translation gates were too shallow. They proved that dictionaries, labels, or bilingual markers existed; they did not prove that:

- the page's declared language matched what users actually read;
- French survived navigation;
- translated URLs rendered materially different content;
- translated facts remained synchronized with English;
- RTL layouts stayed on screen;
- browser metadata, forms, downloads, and assistive labels were localized;
- source-language content was marked correctly.

No website source was changed during this audit. No replacement website ZIP was produced.

## Audit coverage

- 2,476 deployable HTML files parsed.
- 0 HTML parse failures.
- 470 live Chromium assertions across desktop and mobile.
- 344 passed; 126 failed.
- The 126 failures are repeated manifestations across languages and viewports, not 126 unique defects.
- 205 live Leizu homepage translation keys compared across English, French, Traditional Chinese, Simplified Chinese, and Persian.
- 24 Leizu course names and descriptions compared across all five languages.
- 5 Leizu element glosses compared across all five languages.
- 64 Saul career archive records compared across five languages.
- 838 Polymythcal event records and their generated alternate URLs inspected.
- 644 Teacher Resources records inspected for language metadata.
- Existing localization release gates rerun successfully, then tested beyond their marker-level assertions.

The browser run blocked external resources to isolate local behavior. This exposed font-fallback resilience but means missing CJK glyphs in audit screenshots are not, by themselves, proof that production users see missing glyphs.

## Static language inventory

| Item | Result |
|---|---:|
| Static `html lang="en-CA"` | 2,390 pages |
| Static `html lang="en"` | 84 pages |
| Static `html lang="zh-Hans"` | 1 page |
| Static missing `lang` | 1 Google verification file; exempt from content findings |
| Pages with `hreflang` | 855 |
| Pages using query-string language alternatives | 853 |
| Proper dedicated localized content routes | 1: `/bb/why/zh/` |
| Pages with `og:locale` | 0 |
| Nested `lang="fr"` declarations | 40 |
| Nested `lang="en"` declarations | 11 |
| Pages containing Han script | 27 |
| Pages containing Arabic script | 9 |

Nearly all nested language declarations occur on four Polymythcal utility pages. Other projects do not consistently mark foreign-language words, labels, or passages.

## Release blockers

### S0.1 — Saul's Persian CV is visibly displaced off screen

This is the most severe translation-specific UI failure.

At `/saul/?lang=fa`:

- desktop `.cv-spectrum`: only 60.7% remains in the viewport;
- desktop identity block: only 46.9% remains in the viewport;
- mobile `.cv-spectrum`: only 46.3% remains in the viewport;
- mobile identity block: only 45.8% remains in the viewport.

The page applies document-level RTL to a large English/LTR CV layout. The browser's ordinary `scrollWidth` check reports zero because the content is displaced to negative coordinates and then hidden by `overflow-x:hidden`. A user loses roughly half the main CV.

**Required correction:** make the professional CV genuinely RTL-aware, or keep the English professional surface LTR and mark only the Persian archive sections as Persian/RTL. Hiding off-screen content is not an acceptable fallback.

### S0.2 — Eight Leizu subpages falsely declare English pages as French, Chinese, or Persian

The following pages load `language-state.js`:

- booking success;
- cloud;
- donate;
- flyer;
- intake;
- policies;
- scholarship;
- teach.

When a Persian preference is active, these English pages change the document to `lang="fa"` and `dir="rtl"`. Only the fallback notice is Persian; the predominant page remains English.

Consequences:

- screen readers may pronounce English using Persian, French, or Chinese rules;
- English forms and policies inherit the wrong reading language;
- the entire English layout reverses for Persian;
- inserted notices cause large layout shifts.

Measured translation-triggered CLS included:

- 0.1279 on Leizu Cloud;
- 0.7641 on Donate, Intake, Policies, Scholarship, and Teach.

`/leizu/toronto-tutoring/` is a ninth English-only Leizu page and is outside the language-state system entirely.

**Required correction:** until a subpage is truly translated, keep its root `lang="en"`/`dir="ltr"`, put the fallback notice in the requested language with its own `lang` and `dir`, and preserve the user's language preference in navigation and form data.

### S0.3 — Polymythcal advertises 838 French event pages that are not French versions

All 838 generated event pages advertise an English URL and a `?lang=fr` alternate. A live comparison of a representative event found the English and French URL bodies to be effectively identical.

On `?lang=fr`:

- the document root becomes `fr-CA`;
- navigation still reads side-by-side, such as “All listings · Toutes les fiches”;
- the English organizer title and description inherit French;
- there is no part-level `lang="en"` boundary;
- the alternate does not constitute a materially separate French page.

This is simultaneously:

- an accessibility defect;
- an international SEO defect;
- an anti-yap defect because both languages remain visible at once;
- a content-integrity risk if source text is later machine-translated without policy.

**Required correction:** do not translate organizer-authored event titles/descriptions by default. Translate the interface, preserve source text verbatim, and tag the source text with its actual language. Remove French `hreflang` from identical bilingual/query pages until a real localized interface URL exists.

### S0.4 — Saul declares partial pages as fully translated and uses poor Chinese tags

Saul's language switch changes the root language even though the top professional CV, main controls, Methods and Tools, download labels, and metadata remain English and unmarked.

Traditional Chinese becomes generic `lang="zh"`. Simplified Chinese becomes custom `lang="zhs"`. The W3C-recommended script tags are `zh-Hant` and `zh-Hans`.

**Required correction:** use `zh-Hant` and `zh-Hans`; mark English fallback surfaces with `lang="en"`; do not declare a whole page translated until the predominant visible surface is translated.

## High-priority findings

### S1.1 — Saul translations have missing records and factual drift

Saul contains 64 archive records. Eleven records have English-only fields, producing:

- 116 missing localized values across French, Traditional Chinese, Simplified Chinese, and Persian;
- 36 missing descriptions;
- 44 missing notes;
- 36 missing titles.

Affected records include The Agora, Ohm Dome, polymyth/AA, Polymythcal, Florilegium, AODA Training, BUMI Festival, Claude Watson Screen Arts, two commercial/performance records, and Bronze Cross.

Thirty-five shared archive dates still contain English markers such as “May,” “Present,” “early,” or “c.” in every language.

Automated parity review raised 58 numeric-detail discrepancies and 102 length outliers. Some are legitimate number formatting or natural language compression, but several are confirmed semantic drift:

- the English Seminar Schools record now describes an independent website and carefully distinguishes completed work, active development, and proposals; localized versions describe an older umbrella teaching practice and make different project claims;
- the French Teacher Resources record adds Grades 7–11 and RSS claims that are absent from the current English source;
- the French robotics record introduces PhD and Grade 2 claims absent from English;
- the French refugee-support record drops the `$8,000` and six-country facts;
- the French McMUN/SSUNS record drops the approximately 1,600-delegate fact;
- localized Food Handler summaries assert 2006 while current English deliberately says the training was completed during Pizza Pizza employment and labels the date historical.

The current localized CV cannot be treated as synchronized with the factual English source.

### S1.2 — Saul's upper CV is English-only under every non-English switch

The following remain English:

- page title and meta description;
- skip link and theme control;
- CV / Map / Timeline / Education / Methods navigation;
- hero role, profile, and portrait caption;
- focus labels and share controls;
- selected experience and skills;
- Methods and Tools;
- professional PDF/download labels;
- several map and archive controls.

The lower archive does translate many records, so the result is a mixed page presented as a complete language version.

### S1.3 — Polymythcal French state is lost during ordinary navigation

The main calendar reads only the current query string. Event and utility pages use a different localStorage key.

French is dropped from:

- event-detail links;
- all 11 focused-calendar links;
- submit, correction, and subscription links;
- a card-to-event journey;
- focused-route event links;
- form confirmation routes.

A French preference stored by an event page is not honored when the user returns to the main calendar.

**Required correction:** one shared language-state contract must cover URL generation, current URL, localStorage, links, forms, confirmations, and browser back/forward.

### S1.4 — Polymythcal's French shells still contain English UI

The current dictionary has 161 static markers, but newer HTML text was added without dictionary entries.

Confirmed untranslated main-calendar UI includes:

- “Popular starting points”;
- “Shortcuts reset the filters”;
- “Search” as an assistive label;
- “Calendar tools”;
- “Personal calendar tools”;
- “Contribute and language”;
- “Current filter choices”;
- “Choose list or calendar view”;
- most of the shared site footer.

Confirmed untranslated focused-route UI includes:

- “Focused Polymythcal view”;
- “is selected. Use the filters below or…”;
- “browse every listing”;
- “Other focused calendars”;
- “Choose another focused view”;
- “Browse by focus”;
- “Choose one or more opportunity types.”

This explains why the old marker inventory reported “complete” while live semantic parity failed.

### S1.5 — Polymythcal metadata and alternates are internally inconsistent

- Main and focused French modes retain English browser titles and descriptions.
- French query pages normally canonicalize to the unmarked English URL.
- 853 pages use query-string French alternates.
- Google recommends separate stable URLs for language versions and warns against showing side-by-side translations as the primary multilingual strategy.
- 0 pages provide Open Graph locale metadata. This is an enhancement, not a blocker by itself.

### S1.6 — Polymythcal cannot reliably mark event source language

Of 838 event records:

| `source_language` | Count |
|---|---:|
| Missing | 513 |
| `und` | 288 |
| `fr-CA` | 24 |
| `fr-CA,en-CA` | 13 |

801 of 838 records (95.6%) are missing or undetermined.

The 13 comma-delimited bilingual values should be represented as a proper array or normalized language relation, not as one opaque string.

**Required correction:** source language must be a first-class field on every candidate and published event. Unknown is acceptable when honest, but it must trigger re-evaluation and must never silently become English.

### S1.7 — Leizu's homepage is structurally complete but the funnel is not

Positive result:

- 205/205 live homepage UI keys exist in all five dictionaries;
- all five dictionaries contain the same 258 total keys;
- 24/24 course names and descriptions exist in all five languages;
- 5/5 element subjects and glosses exist in all five languages;
- desktop and mobile showed no page overflow on the translated homepage;
- Persian homepage direction is correct.

Incomplete result:

- language switching does not update the current shareable URL;
- browser title, description, canonical, and structured data stay English;
- no `hreflang` alternatives are advertised;
- intake, payment confirmation, policies, scholarship, donation, teacher, flyer, and cloud pages remain English;
- the Traditional Chinese intake still displays “World History,” “Tell me what the student needs,” and other English funnel copy;
- fallback form actions can drop the language.

Content-parity review also found exact-detail drift. For example:

- French FAQ copy removes the 40–45 / 5–10 / 40–45 session structure;
- French FAQ copy removes the 20–40 private-session seminar threshold;
- French FAQ copy removes the stated student age range;
- Persian Forest Year copy introduces 144 hours where current English presents approximately 80–100 sessions.

These may be intentional editorial condensations, but they are not faithful translations of the current English source and need explicit approval.

### S1.8 — Translation-triggered layout shift exceeds the site's standard

Measured failures:

- Polymythcal French main: CLS 0.2018;
- Polymythcal focused French mobile: CLS 0.2720;
- Leizu localized intake mobile: CLS 0.1137;
- several Leizu English fallback pages: CLS up to 0.7641.

Language initialization must happen before paint, or layout space must be reserved. A language switch must not cause the page to jump.

### S1.9 — Teacher Resources has no source-language model

All 644 records lack a `language` or `inLanguage` field.

The FSL group contains 26 known French-learning resources:

- 21 French literature texts;
- 5 FSL curriculum resources.

On a French-source resource page:

- the English catalog shell correctly remains `en-CA`;
- the French H1 inherits English;
- related French titles inherit English;
- the `LearningResource` schema has no source `inLanguage`.

This finding does **not** require translating the Teacher Resources interface. The safe correction is to add source/instruction language metadata, part-level `lang`, schema language, and a language filter.

### S1.10 — bookwormburrows' Chinese essay is strong but not finished

Positive result:

- dedicated `/bb/why/zh/` route;
- reciprocal English / `zh-Hans` / x-default `hreflang`;
- localized title and meta description;
- matching article structure, reference count, and link count;
- no runtime errors, overflow, or CLS on desktop/mobile.

Remaining English under a Chinese root:

- “Skip to main content”;
- “English version” without an English language boundary;
- “References”;
- 23 English references without `lang="en"`;
- footer controls such as English, Back, and Home.

This is the closest current implementation to the recommended localized-route model.

### S1.11 — Foreign-language parts are not consistently marked

The static scan found 27 pages with Han script and 9 with Arabic script, while nested language tags are concentrated on four Polymythcal utility pages.

Not every decorative glyph requires a language declaration. Language names, readable phrases, citations, buttons, and prose do.

Examples requiring review:

- Chinese and Persian language buttons on English pages;
- Leizu's Chinese names and readable phrases;
- Saul's language switch labels and mixed archive;
- BB's English references on the Chinese page;
- French Teacher Resources titles inside an English catalog.

## Lower-priority findings

### S2.1 — `en` and `en-CA` are inconsistent

Both are valid. Standardizing by project would improve predictability but is not a functional failure.

### S2.2 — No project emits `og:locale`

This affects social-preview localization more than core operation. Add it only when a real localized URL exists.

### S2.3 — Remote font dependence needs a language fallback plan

Leizu and BB load Noto/Vazirmatn from Google Fonts. The isolated audit browser showed missing CJK glyph boxes when external fonts were blocked and no suitable system CJK font was installed.

Recommended resilience:

- explicit native fallback names such as `Songti SC`, `STSong`, `SimSun`, and appropriate Persian system stacks;
- optionally self-host small, subsetted WOFF2 files for localized surfaces;
- do not ship large all-language font bundles to every English page.

### S2.4 — Footer localization is inconsistent

Polymythcal's French calendar shells retain the English global footer. Decide whether the shared site footer is a brand-level English element or part of each localized experience; then apply that rule consistently and mark fallback language explicitly.

## Project-by-project status

| Project/surface | Current status | Audit result |
|---|---|---|
| Leizu homepage | EN/FR/Traditional Chinese/Simplified Chinese/Persian runtime dictionaries | Strong structural parity; weak URL, metadata, and content-version governance |
| Leizu funnel/subpages | English pages with localized preference notice | Failing language semantics and anti-jerk; not translated |
| Saul CV/archive | Five runtime language modes | Partial and internally stale; Persian layout broken |
| Polymythcal main + 11 focused calendars | EN/FR runtime translation | Useful translation, but incomplete chrome, metadata, and state propagation |
| Polymythcal event pages/forms | Side-by-side bilingual labels plus `?lang=fr` | Not valid alternate language versions |
| BB Why essay | Dedicated English and Simplified Chinese routes | Strongest localization model; minor language-part cleanup needed |
| Teacher Resources | English catalog with multilingual source materials | Interface intentionally English; source-language metadata missing |
| Other projects | English-only | Not a translation defect unless the site chooses a site-wide language promise |

## Safe corrections that do not change the site's direction

These can be implemented without deciding to translate the whole site:

1. Fix Saul Persian geometry immediately.
2. Use `zh-Hant` and `zh-Hans` on Saul.
3. Keep untranslated Leizu subpages `lang="en"`/`dir="ltr"` and localize only the fallback notice.
4. Mark all readable foreign-language parts with the correct `lang` and `dir`.
5. Unify Polymythcal's language persistence and propagate it through every local link and form.
6. Translate the missing Polymythcal UI and ARIA strings.
7. Remove false `hreflang` from identical query alternatives.
8. Add event `source_language` validation and DOM/schema language boundaries.
9. Add Teacher Resources language fields, filters, part tags, and `LearningResource.inLanguage`.
10. Finish BB's skip link, reference heading, reference language boundaries, and footer.
11. Prevent translation banners and dictionaries from shifting layout after paint.
12. Add translation gates for keys, URLs, language tags, RTL geometry, CLS, metadata, source hashes, numbers, and named entities.

## Decisions that would change the site's direction

No direction-changing work should be implemented until these are approved.

### Decision 1 — Localized URL architecture

**Recommended:** use project-local dedicated URLs only for complete localized pages:

- `/leizu/fr/`, `/leizu/zh-hant/`, `/leizu/zh-hans/`, `/leizu/fa/`;
- `/polymythseminars/fr/`;
- `/saul/fr/`, etc.;
- keep BB's existing dedicated Chinese route.

Use query parameters only as a transition mechanism or non-indexed preference state.

Why this changes direction: it creates new indexable route trees, canonical relationships, sitemap entries, and release-generation obligations.

### Decision 2 — What “translated” promises per project

**Recommended scope:**

- Leizu: translate the whole business funnel, not just the homepage.
- Polymythcal: translate the complete interface and utility flow into French; preserve organizer source text verbatim and mark its source language.
- Saul: either finish the entire visible HTML surface or relabel the switch as “archive language.” Keep PDFs explicitly English until separately reviewed.
- BB: keep Chinese limited to the Why essay until core-game translation receives editorial approval.
- Teacher Resources: keep the interface English for now; add source-language semantics and filtering.
- Other projects: make no site-wide translation promise yet.

Why this changes direction: each added language becomes an ongoing publishing and quality commitment, not a one-time text replacement.

### Decision 3 — Translation authority and content governance

**Recommended:**

- current English is the source of truth for owned copy;
- every localized block stores the English source hash/version it translated;
- machine translation may draft ordinary UI;
- policies, payments, professional CV claims, and high-stakes instructional copy require bilingual review;
- organizer event titles and descriptions are never silently machine-translated;
- missing translations fall back visibly to English with correct language boundaries, never by changing the whole page's language.

Why this changes direction: it defines who may publish translated claims and how the site prevents stale or invented facts.

## Recommended implementation order after approval

### Phase A — stop active harm

1. Saul Persian layout and Chinese tags.
2. Leizu fallback page language/direction and layout shift.
3. Polymythcal false event alternates and source-language boundaries.
4. BB and Teacher Resources part-level language tags.

### Phase B — make existing language promises real

1. One Polymythcal language-state contract.
2. Complete Polymythcal French UI/forms/metadata.
3. Synchronize Saul archive translations and remove stale facts.
4. Complete Leizu intake, policies, payment, and customer funnel translations.

### Phase C — dedicated URLs and discoverability

1. Generate complete localized routes.
2. Add reciprocal self-referencing `hreflang`, canonicals, sitemaps, and localized metadata.
3. Keep incomplete or bilingual fallbacks non-indexed as language alternatives.

### Phase D — permanent anti-backtracking gates

Every release should fail if:

- a translated route loses a key;
- source and translation versions diverge;
- numbers, prices, dates, named entities, or uncertainty labels drift without approval;
- a language is lost during navigation or form submission;
- an alternate URL renders substantially identical language content;
- RTL content moves outside the viewport;
- translated CLS exceeds 0.1;
- root language and predominant content disagree;
- foreign-language parts lack language boundaries;
- metadata and structured data disagree with the visible page.

## Standards used

- [WCAG 2.2 — Language of Page](https://www.w3.org/WAI/WCAG22/Understanding/language-of-page)
- [WCAG 2.2 — Language of Parts](https://www.w3.org/WAI/WCAG22/Understanding/language-of-parts)
- [W3C — Declaring language in HTML](https://www.w3.org/International/questions/qa-html-language-declarations.html)
- [W3C — Structural markup and right-to-left text](https://www.w3.org/International/questions/qa-html-dir.en)
- [W3C — Simplified and Traditional Chinese language tags](https://www.w3.org/International/questions/qa-css-lang.en)
- [Google Search — Localized versions and `hreflang`](https://developers.google.com/search/docs/specialty/international/localized-versions?hl=en)
- [Google Search — Managing multilingual sites](https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites?hl=en)
- [Schema.org — `inLanguage`](https://schema.org/inLanguage)

## Evidence files

- `translation_audit44_static.json`
- `translation_audit44_browser.json`
- `translation_audit44_saul_browser.json`
- `translation_audit44_leizu_i18n.json`
- `translation_audit44_saul_i18n.json`
- `translation_audit44_polymythcal_parity.json`
- `translation_audit44_screenshots/`

