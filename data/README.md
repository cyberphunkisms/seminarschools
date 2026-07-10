# Seminar Schools data folder

Canonical calendar master: `data/polymyth-seminar-events.json`.

Public calendar copy: `polymythseminars/events.json`. It must remain byte-identical to the canonical master before release.

Legacy empty file `data/seminars.json` was retired on 2026-07-09 because it held zero events and confused inspections. The retired copy lives in `data/history/retired-empty-seminars-json-2026-07-09.json`.

`scrape-log.json` is now a current summary of the canonical/public event pair unless a live scraper run replaces it with a same-day scrape report.

Run `node scripts/verify-data-hygiene.js` before shipping.
