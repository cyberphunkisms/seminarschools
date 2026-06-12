# Feed-endpoint pass, June 11 2026

Direct-verification pass replacing a failed research-tool launch. Goal: convert the
javascript/wordpress/drupal third of the roster (68 of 160 sources) from fragile HTML
fetches to machine-readable or server-rendered endpoints.

## Platform cheat sheet (apply to any future source before research)

| Platform | Endpoint pattern | Format | Notes |
|---|---|---|---|
| BiblioCommons (TPL, Mississauga, Markham libraries) | `{lib}.bibliocommons.com/v2/events` | server-rendered HTML | VERIFIED live on TPL; Halifax, KCLS, Tacoma confirm platform-wide. BiblioEvents also exports XML(RSS)/CSV per product docs. |
| WordPress + The Events Calendar | `{base}/wp-json/tribe/events/v1/events` | JSON (`events` array) | Probable per fingerprint; harvester falls back to events_url on 404. |
| Meetup | `{group_url}/events/ical/` | ICS | Stable documented pattern. |
| Localist (campus calendars) | `{domain}/api/2/events?days=90` | JSON, anonymous access | Verified pattern per Localist API docs; 370-day max window. events.yorku.ca is NOT Localist (it is WordPress). |
| Drupal (U of T SiteWorks family) | listing pages are server-rendered | HTML | No feed needed; plain fetch works (jhi, uoft-philosophy/history/english, utm-historical, cms-medieval). |
| Squarespace | `{page}?format=json` | JSON | Untested on this roster. |
| Instagram-only venues | none | none | Unscrapeable by plain fetch; replace the source (flagged: art-bar). |

## Wired this pass (feed_url + feed_format + feed_status in sources.json)

VERIFIED: tpl-appel.
PATTERN-VERIFIED: mississauga-library, markham-library.
PROBABLE: practical-philosophy-on, toronto-philosophy-meetup (Meetup ICS);
york-events, york-cinema (Tribe REST; render_mode corrected javascript to wordpress);
soundstreams, music-gallery, cic-toronto, canadian-club, royal-inst-philosophy,
fox-theatre, mcmichael (Tribe REST by WordPress fingerprint).
NOT-NEEDED: jhi, uoft-philosophy, uoft-history, uoft-english, utm-historical, cms-medieval.
REPLACEMENT-NEEDED: art-bar (Instagram-only).

## Promotion rule

A probable feed that yields events on a harvest run gets promoted to verified in
sources.json by the roster maintainer. A probable feed that 404s twice gets removed
and the source falls back to HTML permanently. The harvest's source_yields notes
carry the evidence either way.

## Remaining unwired javascript sources (~45)

Museums, theatres, ticketing platforms (TIFF, AGO, ROM, Hot Docs, Munk, OCAD,
massey-rth, tso, to-live, koerner-hall, suburb theatres, et al.) stayed HTML-only this
pass. Two routes, in order of preference once Monday's instrumented run lands:
(1) zero-yield repair pass researches endpoints only for sources that actually
returned nothing; (2) per-venue checks against the cheat sheet above, especially
?format=json and ICS export links on event detail pages.
