# Polymythcal clarity revamp

Date: 2026-07-21

## Core diagnosis

The previous calendar placed time, location, topic, audience, format, certainty, and content type in the same visual language. Several controls behaved as mutually exclusive even when users reasonably needed several choices. The word “Deadlines” mixed together calls for papers, contests, fellowships, grants, awards, and applications without explaining what the date represented. The same ideas appeared repeatedly across quick filters, category filters, audience shortcuts, feeds, and date controls. The page also embedded the full event corpus and hundreds of event cards directly into the HTML.

## New information model

1. **What are you looking for** separates events to attend from opportunities to apply for. Both may remain selected.
2. **When** uses a single date window because the date windows overlap.
3. **Where** allows several geographic areas at once.
4. **What interests you** allows several topics at once.
5. **What kind** keeps event types separate from application types.
6. **Audience, format, and listing status** remain available in one clearly labelled advanced section.
7. Filters inside one section use OR. Filters across sections use AND.
8. The vague Deadlines category has been removed. Opportunity cards and controls explain that their listed date is the application deadline.

## Entry points retained

The page keeps direct starting points for philosophy and ethics, humanities, talks and lectures, festivals, writing and literature, fellowships and grants, Toronto and the GTA, and the Kingston to Montréal corridor.

## Public tools retained

- Shareable URL backed filters
- Device local saved listings
- RSS and ICS subscription directory
- Public event submission form
- Listing correction form
- English and French interface
- Stable event pages
- Official source links
- List and calendar views

## Performance

The old main calendar HTML was 1,669,503 bytes. The revised main calendar HTML is 24,065 bytes. The canonical 839 record event file remains separate and loads on demand. The first list render is limited to 60 cards with a Show more control.

## Data preservation

- 839 canonical event records preserved
- 839 source event pages preserved
- 839 deploy mirror event pages preserved
- Existing RSS, ICS, submission, correction, and subscription routes preserved
- The application opportunity subscription is now labelled in plain language while retaining its existing feed URL

## Verification

The included `scripts/verify-polymythcal-revamp.py` and `POLYMYTHCAL_CLARITY_REVAMP_VERIFICATION_2026-07-21.json` record 28 passing checks covering:

- source and deploy parity
- JavaScript syntax
- removal of the old mutually exclusive system
- removal of the ambiguous Deadlines control
- multi-select content, place, and topic behaviour
- single date-window behaviour
- preservation of all 839 records and stable pages
- browser rendering
- list and calendar views
- device-local saved listings
- 320 pixel reflow
- script error monitoring
- French interface activation
