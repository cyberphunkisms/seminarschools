# polymythcalendar youth writing competitions update — 2026-06-28

## Change summary

- Added or refreshed 17 Canadian-eligible youth writing competition entries for grades 1-12 pathways.
- Added 11 new calendar records and updated 6 existing contest records, avoiding duplicate title/date pairs.
- Refreshed `polymythseminars/events.json`, `data/polymyth-seminar-events.json`, the inline fallback in `polymythseminars/index.html`, static event pages, sitemap, RSS feed, and source roster.
- Preserved the public name `polymythcalendar` and canonical route `/polymythseminars/`.

## Entries now represented

- 2026-07-15 — The Aristotle Contest — Canadian high-school students at or below grade 12; homeschoolers eligible — https://philosophy.utoronto.ca/the-aristotle-a-high-school-philosophy-essay-contest/
- 2026-09-30 — Hamilton Public Library Power of the Pen — Ages 12-18; Hamilton Public Library eligibility applies — https://teens.hpl.ca/articles/power-pen-creative-writing-contest
- 2026-11-01 — Royal Canadian Legion Literary Contest — Junior grades 4-6; intermediate grades 7-9; senior grades 10-12 — https://www.remembrancecontests.ca/
- 2026-11-19 — OSSTF Student Achievement Awards — Ontario public secondary students; grades 9-12 categories — https://www.osstf.on.ca/studentachievementawards
- 2026-12-19 — French for the Future National Essay Contest — Grades 10-12; Secondary IV-V or CEGEP in Quebec; legal residents of Canada — https://french-future.org/programs/essay-contest/
- 2027-02-13 — OECTA Young Authors Awards — JK-Grade 12; Ontario Catholic-school structure — https://www.catholicteachers.ca/For-Your-Benefit/Awards/Young-Authors-Awards
- 2027-02-20 — Meaning of Home Student Contest — Grades 4-6; Canadian residents in Canada — https://www.meaningofhome.ca/
- 2027-02-28 — Ottawa Public Library Awesome Authors Youth Writing Contest — Ages 9-18; Ottawa Public Library eligibility applies — https://collections.biblioottawalibrary.ca/en/awesome-authors-youth-writing-contest-2026
- 2027-03-13 — Canadian Nuclear Society Essay Contest — Grades 9-12; Quebec Secondary III-V — https://www.cns-snc.ca/news/canadian-nuclear-society-2026-essay-contest/
- 2027-03-31 — Kids Write 4 Kids — Grades 4-8; Canadian residents enrolled full-time in school or homeschool — https://kidswrite4kids.ripplefoundation.ca/
- 2027-03-31 — YABS Young Writers Award — Grades 4-9; Alberta students and homeschoolers — https://www.yabs.ab.ca/ywa/
- 2027-04-01 — Vancouver Writers Fest Youth Writing Contest — Grades 5-7 and 8-12; BC school or homeschool students — https://writersfest.bc.ca/youth/youth-writing-contest
- 2027-04-30 — Jessamy Stursberg Poetry Prize for Canadian Youth — Junior grades 7-9; senior grades 10-12; Canadian citizens or permanent residents — https://poets.ca/offerings/awards/
- 2027-04-30 — Queen's Commonwealth Writing Competition — 18 and under; Commonwealth nationals or residents, including Canadians — https://www.royalcwsociety.org/writing-competition/qcwc2026
- 2027-05-31 — CNIB Braille Creative Writing Contest — K-Grade 12; students who are blind, Deafblind, or have low vision — https://www.cnib.ca/en/about-contest
- 2027-06-08 — Fraser Institute Student Essay Contest — High-school students; Canadian students abroad and international students in Canada eligible — https://www.fraserinstitute.org/education-programs/student-essay-contest
- 2027-06-10 — Diverse Minds Manitoba — Manitoba high-school students, grades 9-12 — https://bnaibrith.ca/diverseminds/

## Source roster additions

- `meaning-home` — Meaning of Home Student Contest — https://www.meaningofhome.ca/page/rules-and-regulations
- `kids-write-4-kids` — Kids Write 4 Kids — https://kidswrite4kids.ripplefoundation.ca/kids-write-4-kids-contest-rules/
- `legion-remembrance-contests` — Royal Canadian Legion National Youth Remembrance Contests — https://www.remembrancecontests.ca/
- `yabs-young-writers-award` — YABS Young Writers Award — https://www.yabs.ab.ca/ywa/
- `oecta-young-authors` — OECTA Young Authors Awards — https://www.catholicteachers.ca/For-Your-Benefit/Awards/Young-Authors-Awards
- `cnib-braille-writing` — CNIB Braille Creative Writing Contest — https://www.cnib.ca/en/about-contest
- `vancouver-writers-fest-youth` — Vancouver Writers Fest Youth Writing Contest — https://writersfest.bc.ca/youth/youth-writing-contest
- `jessamy-stursberg-poetry` — Jessamy Stursberg Poetry Prize for Canadian Youth — https://poets.ca/offerings/awards/
- `queens-commonwealth-writing` — Queen's Commonwealth Writing Competition — https://www.royalcwsociety.org/writing-competition/qcwc2026
- `french-for-future-essay` — French for the Future National Essay Contest — https://french-future.org/programs/essay-contest/
- `aristotle-contest-utoronto` — The Aristotle Contest — https://philosophy.utoronto.ca/the-aristotle-a-high-school-philosophy-essay-contest/
- `fraser-student-essay` — Fraser Institute Student Essay Contest — https://www.fraserinstitute.org/education-programs/student-essay-contest
- `cns-essay-contest` — Canadian Nuclear Society Essay Contest — https://www.cns-snc.ca/news/canadian-nuclear-society-2026-essay-contest/
- `diverse-minds-manitoba` — Diverse Minds Manitoba — https://bnaibrith.ca/diverseminds/
- `osstf-student-achievement` — OSSTF Student Achievement Awards — https://www.osstf.on.ca/studentachievementawards
- `opl-awesome-authors` — Ottawa Public Library Awesome Authors Youth Writing Contest — https://collections.biblioottawalibrary.ca/en/awesome-authors-youth-writing-contest-2026
- `hpl-power-of-the-pen` — Hamilton Public Library Power of the Pen — https://teens.hpl.ca/articles/power-pen-creative-writing-contest

## Calendar audit after update

- Total calendar records: 470
- Manual records: 206
- Contest records: 43
- Source roster records: 331
- Youth writing competition source records: 17
- Duplicate normalized title plus start-date pairs: 0
- Records missing source URLs: 0
- Records with missing date fields: 0
- Parent festival seasons: 30
- Linked individual productions: 56

## Verification commands run

```text
node scripts/sync-calendar-data.js
node scripts/build-search-pages.js
node scripts/regen-polymythseminars-feed.js
node scripts/build-search-pages.js --check
node scripts/verify-calendar-data-parity.js
node scripts/verify-polymythcalendar-name.js
node scripts/verify-calendar-aliases.js
node scripts/verify-festival-parent-taxonomy.js
node scripts/verify-site-integrity.js
```

## Verification results

```text
SEARCH SURFACE CHECK — 753 resource pages, 158 indexable event pages, 15 methodology sections, 979 sitemap URLs.
CALENDAR DATA PARITY OK — 470 mirrored entries.
polymythcalendar naming gate passed (352 public files scanned).
PASS — polymyth calendar aliases redirect directly to the canonical calendar.
FESTIVAL PARENT TAXONOMY OK — 30 parent seasons and 56 linked productions.
SITE INTEGRITY GUARD PASS — public routes, local links, assets, forms, anchors, and scripts are internally consistent.
```

## Editorial note

Several contests have official 2026 pages whose deadlines have already passed as of 2026-06-28. Those entries are placed into the next practical annual cycle and explicitly marked “projected” or “placeholder” inside the calendar description so users are directed to confirm dates on the official source before relying on them. The existing search-surface builder keeps contest records out of Event schema indexing, which avoids publishing projected contest dates as structured event facts.
