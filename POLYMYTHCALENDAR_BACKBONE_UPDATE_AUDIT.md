# polymythcalendar backbone update and audit — 2026-06-28

## Archive changes made

- Imported 21 deep-research backbone records into `data/manual-events.json`.
- Regenerated `polymythseminars/events.json` and `data/polymyth-seminar-events.json` so the public calendar data and internal master remain byte-identical.
- Refreshed the non-JavaScript fallback inside `polymythseminars/index.html`.
- Rebuilt static event pages and the sitemap through `scripts/build-search-pages.js`.
- Added a reusable import record at `data/polymythcalendar-backbone-import-2026-06-28.json`.
- Expanded `scripts/sources.json` with durable source targets found during deep research.
- Fixed an audit regression where the Toronto Jazz Festival parent was typed as `festival-of-form` instead of `festival`, which made linked child productions point to a non-parent record.
- Added plain-English scraper setup instructions at `POLYMYTHCALENDAR_SCRAPER_LAYMAN_SETUP.md`.

## Calendar data audit

- Total calendar records: 459
- Manual/base records: 171
- Upcoming records as of 2026-06-28: 230
- Source roster records: 314
- Duplicate normalized title plus start-date pairs: 0
- Records missing source URLs: 0
- Records with invalid date strings: 0
- Parent festival seasons: 30
- Linked individual productions: 56
- Orphan child records: 0
- Sitemap URLs after rebuild: 979
- HTML pages checked by the full suite: 1103

## New backbone records added

- Energy-Aware Agents 2026
- Funding Opportunities for Graduate Students in Research Programs within the Social Sciences, Arts and Humanities
- The Let Down Reflex at the FOFA Gallery
- Colson Whitehead: Cool Machine
- Le Concierge
- Transfers
- Devising Immersive & Site Specific Performance
- Bringing Us Together: Dance, Description and Access
- AFSA Scientific Day — New Horizons in Health Statistics
- Invention to Impact Training Program Fall 2026 Application Deadline
- Health Policy Symposium and Sinclair Lecture: Aging in Communities
- Beyond the Veil of Things
- University Lecture Series: Esme Fuller-Thomson on Optimal Aging
- Hughlings Jackson Lecture 2026: Behaviour, Brain Computation, and Evolution
- University Lecture Series: Catherine Fogerty on The Ethics of Storytelling
- University Lecture Series: W. David Ward, Alan Toff Lecturer: Eyes of Society
- Public Talk: Les trous noirs sous toutes leurs couleurs
- Advanced Workshop for Stage or Screen
- Tate McRae at OSHEAGA 2026
- Saint Levant at Festival International de Jazz de Montréal 2026
- Patrick Watson at Festival International de Jazz de Montréal 2026

## New or newly promoted source IDs represented in the backbone import

- `concordia-fofa`
- `concordia-gradproskills`
- `kingston-writersfest`
- `mcgill-science`
- `montreal-jazz`
- `osheaga`
- `queens-events`
- `summerworks`
- `tmu-research-events`
- `tpl-salon-series`
- `u-t-lecture-series`

## Current type distribution

- lecture: 57
- performance: 51
- cfp: 49
- festival: 36
- festival-of-form: 36
- contest: 32
- cultural-reproduction: 27
- reading: 21
- workshop: 19
- site-specific-art: 18
- gathering: 17
- conference: 17
- talk: 16
- panel: 12
- exhibition: 11
- symposium: 7
- artist-talk: 7
- screening: 5
- defence: 5
- book-talk: 3
- celebration: 2
- scholar-talk: 2
- colloquium: 1
- meeting: 1
- forum: 1
- webinar: 1
- residency: 1
- memorial: 1
- book-launch: 1
- networking: 1
- retreat: 1

## Rough region distribution

This is a quick text-based estimate from venue and description fields. It is useful for spotting gaps, not for formal geography.

- Other/unclear: 267
- Toronto: 125
- Southern Ontario: 34
- Kingston: 20
- Montréal: 13

## Permanent source expansion

The source roster now treats these as durable scraper targets from the deep-research pass:

- Toronto Public Library Salon Series
- Toronto Public Library Programs
- University of Toronto School of Continuing Studies Lecture Series
- Toronto Metropolitan University Research Events
- Royal Ontario Museum Events
- Royal Ontario Museum Talks
- Art Gallery of Ontario Events
- Concordia FOFA Gallery Events
- Concordia GradProSkills Events
- McGill Faculty of Science Events
- Rotman School of Management Public Events

Existing regional anchors remain in place for Queen’s University, Kingston WritersFest, Agnes Etherington Art Centre, Montréal Jazz Festival, OSHEAGA, McGill Events, Concordia Events, Fantasia, Brott, SummerWorks, and the wider Toronto and Southern Ontario roster.

## Scraper architecture audit

The archive keeps the safer scraper architecture from the previous repair:

- `Refresh polymythcalendar seminars` runs from `.github/workflows/scrape-seminars.yml`.
- `Refresh polymythcalendar festivals` runs from `.github/workflows/scrape-festivals.yml`.
- Each stream has its own timeout, budget, transcript log, and retained diagnostics artifact.
- A failed run leaves the currently published calendar untouched.
- Both workflows support manual runs through `workflow_dispatch`.
- Both workflows preserve `data/harvest-runs/` as a 30-day GitHub artifact on every run.
- The full verification suite runs before the bot commits refreshed data.

## Verification result

The full local predeploy suite passes.

Important green checks:

- critical calendar checks
- static search-surface checks
- calendar alias redirects
- calendar data parity
- festival parent taxonomy
- harvest pipeline design
- public `polymythcalendar` naming
- geometry and site-integrity gates
- Leizu payment, booking, localization and funnel gates
- SEO deployment guard

## Exact verification excerpt

```text
course coverage
PASS  Persian course descriptions use Persian text
PASS  All Five Elements glosses have Persian text
PASS  Course renderer receives Persian descriptions
PASS  Five Elements renderer receives Persian glosses
Persian localization guard passed.
PASS CTA state reader
PASS source CTA handoff
PASS course handoff across CTAs
PASS path handoff across CTAs
PASS automatic ESL state
PASS automatic ESL cleared on exit
PASS clear removes course support state
PASS persistent language support
PASS semantic RTL direction
PASS Traditional Chinese Forest payment copy
PASS Simplified Chinese Forest payment copy
PASS Persian Forest payment copy
PASS Traditional Chinese seminar correction
PASS Simplified Chinese seminar correction
PASS Simplified Chinese editorial correction
PASS Simplified Chinese core-unit correction
PASS language state on leizu/intake/index.html
PASS language state on leizu/policies/index.html
PASS language state on leizu/scholarship/index.html
PASS language state on leizu/donate/index.html
PASS language state on leizu/cloud/index.html
PASS language state on leizu/teach/index.html
PASS language state on leizu/flyer/index.html
PASS language state on leizu/booking-success/index.html
Leizu localization and funnel guard passed.
PASS  map label plates exist
PASS  map labels no longer use halo strokes
PASS  mobile project rail exists
PASS  core jewel opens the conceptual centre
PASS  bookwormburrows jewel routes to its landing page
PASS  jewels expose selected state
PASS  touch uses select-before-navigate behavior
PASS  selection connects the constellation to the background web
PASS  map colors refresh after theme changes
PASS  Indra accepts page-specific intensity
PASS  Indra pauses its animation when idle or hidden

Homepage map guard passed.
PASS bb/why/index.html
PASS bb/index.html
PASS netlify.toml
PASS sitemap.xml
PASS  main page has three practical entry routes
PASS  main page routes to tutoring, public reading, and resources
PASS  main page has explicit geometry control
PASS  main page uses the lighter geometry depth
PASS  main page can quiet ornamental geometry independently
PASS  main page does not auto-loop at the footer
PASS  main page does not intercept ordinary top scrolling
PASS  footer has an explicit return link
PASS  homepage core jewel links to main page
PASS  main page has balanced script tags

Main-page guard passed.
PASS main route enters canonical portfolio intake
PASS standalone application form removed
PASS portfolio statement remains present
PASS intake recognises the portfolio source
PASS intake offers a portfolio purpose
PASS portfolio source avoids automatic payment
PASS portfolio receives its own manual-review receipt
PASS retired standalone form file is absent
PASS legacy success route redirects to portfolio intake
PASS tree sitemap points to canonical portfolio intake
PASS graph replaces retired portfolio success route
Main to Leizu portfolio funnel guard passed.
Saul page guard passed.
=== SITE INTEGRITY GUARD ===
HTML pages: 1103 | JS files: 73 | Redirect rules: 149
PASS — public routes, local links, assets, forms, anchors, and scripts are internally consistent.
=== PROFESSIONAL PREDEPLOY READINESS ===
PASS — cache, PWA, sitemap, entitlement, diagnostics, accessibility semantics, and public build boundaries are hardened.
=== SEO DEPLOYMENT GUARD ===
PASS — 979 sitemap URLs, canonical/indexing controls, AI crawler privacy, structured data, local offer facts, and multilingual links are coherent.

```

## Still external to this archive

These items require live account access:

- uploading or pushing the archive into `github.com/cyberphunkisms/seminarschools`
- deleting the retired combined workflow from GitHub if it still exists there
- adding `CLAUDE_CODE_OAUTH_TOKEN` as a GitHub Actions repository secret
- manually running the two new workflows once
- checking the saved `harvest-diagnostics` artifacts after those first runs
- confirming Netlify deployed the Git push
- checking the live domain and sitemap after deployment
- submitting or re-submitting `www.seminarschools.com/sitemap.xml` in Google Search Console and Bing Webmaster Tools

## References for the external steps

- GitHub repository secrets documentation: www.docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets
- GitHub manual workflow runs documentation: www.docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow
- Netlify Git workflow documentation: www.docs.netlify.com/build/git-workflows/overview/
