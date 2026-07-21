# Polymythcal Audit13 implementation report

## Completed

- Canonical event schema v2 with separate confirmation, qualification, precision, lifecycle, source quality, structured geography, record kind, and freshness fields.
- 513 retained records.
- 295 uncertain records remain visible with exact qualification reasons.
- The Palestinian Football Exhibit moved from the hidden watchlist into the canonical chronology as unconfirmed.
- Stable internal page and event-specific ICS file generated for every record.
- Structured Toronto–Kingston–Gananoque–Brockville–Cornwall–Montréal corridor fields and filters.
- Nineteen official corridor sources added, with bilingual Montréal metadata.
- Legacy source IDs registered instead of discarded.
- Seminar and festival shard rotation changed from week/weekday repetition to three-day run slots.
- One calendar-wide workflow lock added.
- Claude Code version pinned.
- Agent shell access removed.
- Semantic validation added and made part of scheduled verification.
- Successful harvests create a review pull request rather than disappearing with the temporary runner.
- Public cards show Confirmed or Unconfirmed, exact qualification, stable internal link, and official source link.
- Mobile nested event scrolling removed.
- Mobile text-size controls moved into document flow and enlarged to 44-pixel targets.
- Search now includes structured city, corridor, record kind, confirmation, source quality, and qualification fields.
- `/polymythcal/` compatibility alias added while `/polymythseminars/` remains canonical.
- Audit12 mobile-web protections remain intact.

## Verification

- Canonical semantic validation passed.
- Audit13 dedicated gate passed 13/13.
- Calendar mirror parity passed for 513 records.
- Harvest-pipeline gate passed.
- Audit12 anti-backtracking gate passed.
- The larger 89-check release runner passed its first 28 displayed checks, including deploy, data hygiene, calendar parity, harvest, search, CSP, interactivity, name, zoom, shortcuts, and Audit12-related contracts. The runner did not terminate inside the available command window, so this report does not claim 89/89 completion.

## Remaining focused work

- Real live scraping of the newly registered corridor sources.
- Platform-specific adapters and fixtures for municipal, university, library, festival, French-language, and civic-action sources.
- Full lifecycle reconciliation for cancellation, disappearance, rescheduling, and recurrence.
- URL-backed filters, typo-tolerant bilingual search, account-free saving, public corrections, and focused RSS feeds.
- Holistic translation pass.
- Full manual WCAG 2.2 AA audit with screen readers and high-contrast testing.
