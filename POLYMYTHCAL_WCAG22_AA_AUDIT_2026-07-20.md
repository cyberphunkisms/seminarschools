# Polymythcal WCAG 2.2 AA audit

- Browser-assisted checks passed: **26/26**
- Browser-assisted checks failed: **0**
- Native VoiceOver status: **manual protocol prepared; native run requires macOS**
- Native NVDA status: **manual protocol prepared; native run requires Windows**

## Browser-assisted results

- PASS · Calendar has unique IDs · 4.1.1 · `[]`
- PASS · Calendar controls have programmatic labels · 1.3.1, 3.3.2, 4.1.2 · `[]`
- PASS · Calendar interactive elements have accessible names · 2.4.4, 4.1.2 · `{"buttons": 0, "links": 0}`
- PASS · Calendar has a valid skip link and main landmark · 2.4.1 · `{"label": "calendar", "duplicateIds": [], "missingLabels": [], "unnamedButtons": 0, "unnamedLinks": 0, "headingJumps": [], "mainCount": 1, "h1Count": 1, "skipTargetValid": true, "lang": "fr-CA"}`
- PASS · French URL state restores interface language · 3.1.1, 3.1.2 · `{"lang": "fr-CA", "query": "montral"}`
- PASS · Typo-tolerant bilingual search returns Montréal results · 3.2.2 · `{"visibleEvents": 11, "countLine": "11 sur 32 événements  ·  Recherche: montral  ·  12 prochains mois"}`
- PASS · URL-backed focus restores Montréal · 3.2.3 · `"true"`
- PASS · First keyboard focus reaches visible skip link · 2.1.1, 2.4.1, 2.4.7, 2.4.11 · `{"tag": "A", "cls": "skip-link", "outline": "solid", "width": "3px"}`
- PASS · Slash shortcut focuses search · 2.1.1 · `"calendarSearch"`
- PASS · Saved events persist in device-local storage · 4.1.2 · `[{"id": "fdc0f440490c", "title": "The Let Down Reflex at the FOFA Gallery", "href": "/polymythseminars/events/fdc0f440490c/", "date": "2026-07-10T00:00-04:00", "saved": "2026-07-21T15:07:31.662Z"}]`
- PASS · Saved searches persist URL state locally · 3.2.3 · `[{"query": "?q=montral&focus=montreal&lang=fr", "label": "montral", "created": "2026-07-21T15:07:32.967Z"}]`
- PASS · Calendar reflows at 320 CSS px · 1.4.10 · `{"scrollWidth": 320, "clientWidth": 320, "bodyScrollWidth": 320}`
- PASS · Reduced-motion preference suppresses transitions and smooth scrolling · user-requested reduced-motion check · `{"animationDuration": "1e-06s", "transitionDuration": "0s", "scrollBehavior": "auto"}`
- PASS · Forced-colour mode preserves focus and tool boundaries · 1.4.11, 2.4.7 · `{"focusedTag": "BUTTON", "focusedText": "Enregistrer la recherche", "focusOutline": "solid", "focusWidth": "3px", "toolsBorder": "solid", "forcedAdjust": "auto"}`
- PASS · Chrome accessibility tree names all exposed controls · 4.1.2 · `[]`
- PASS · Submission form fields have labels · 1.3.1, 3.3.2 · `[]`
- PASS · Submission form has one main landmark and heading · 1.3.1, 2.4.6 · `{"label": "submission form", "duplicateIds": [], "missingLabels": [], "unnamedButtons": 0, "unnamedLinks": 0, "headingJumps": [], "mainCount": 1, "h1Count": 1, "skipTargetValid": true, "lang": "en-CA"}`
- PASS · Submission form reflows at 320 CSS px · 1.4.10 · `{"scrollWidth": 320, "clientWidth": 320}`
- PASS · Correction form fields have labels · 1.3.1, 3.3.2 · `[]`
- PASS · Correction form has one main landmark and heading · 1.3.1, 2.4.6 · `{"label": "correction form", "duplicateIds": [], "missingLabels": [], "unnamedButtons": 0, "unnamedLinks": 0, "headingJumps": [], "mainCount": 1, "h1Count": 1, "skipTargetValid": true, "lang": "en-CA"}`
- PASS · Correction form pre-fills the selected stable listing · 3.3.2 · `"https://seminarschools.com/polymythseminars/events/clarkson-laureateships-high-table-2026-01-30/"`
- PASS · Correction form reflows at 320 CSS px · 1.4.10 · `{"scrollWidth": 320, "clientWidth": 320}`
- PASS · Stable event detail has correction, source, and calendar actions · 2.4.4 · `["Official source · Source officielle ↗", "Add to calendar · Ajouter au calendrier", "Correct this listing · Corriger cette fiche"]`
- PASS · Stable event detail receives a local save control · 4.1.2 · `1`
- PASS · Event detail language follows the French preference · 3.1.1 · `"fr-CA"`
- PASS · Event detail reflows at 320 CSS px · 1.4.10 · `{"scrollWidth": 320, "clientWidth": 320}`

## Native assistive-technology boundary

The Chromium accessibility tree, keyboard flow, labels, names, state, reflow, forced-colour mode, and reduced-motion mode were exercised in this environment. VoiceOver speech output and rotor behaviour require macOS. NVDA speech output and browse-mode behaviour require Windows. The companion protocol records the exact paths, keystrokes, expected announcements, and evidence fields for both native runs.

## Console errors

- console: Failed to load resource: net::ERR_NAME_NOT_RESOLVED
