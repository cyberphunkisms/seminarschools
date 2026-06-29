# Polymythcalendar philosophy, humanities, CFP, and fellowship update audit

Date: 2026-06-29

## What changed

This pass expands Polymythcal from a mostly regional public-events calendar into a university-level philosophy and humanities opportunity surface while preserving the existing youth-writing shortcut work.

Added permanent one-slash routes:

```text
www.seminarschools.com/university/
www.seminarschools.com/philosophy/
www.seminarschools.com/humanities/
www.seminarschools.com/cfps/
www.seminarschools.com/lectures/
www.seminarschools.com/fellowships/
```

Added visible Polymythcal tab row:

```text
University | University+ | Philosophy | Humanities | CFPs | Lectures | Fellowships
```

The existing writing row remains:

```text
Writing | Club | Kids | Juniors | Teens | Grads
```

## Data additions

```text
Added source-roster entries: 55
Added manual research-backed calendar entries: 42
  Princeton UCHV dated lecture/colloquium events: 15
  Projected CFP/fellowship/deadline watch cards: 27
Total calendar entries after update: 512
Total source-roster entries after update: 386
Global-academic sources after update: 55
Events carrying academic_bands: 42
```

## Current shortcut counts

```text
university: 130
philosophy: 46
humanities: 96
cfps: 87
lectures: 36
fellowships: 40
```

## Source roster expansion

The new `scope: global-academic` source class covers university philosophy and humanities lectures, humanities centers, philosophy societies, recurring conference CFPs, and fellowship/deadline sources.

Representative additions include:

```text
princeton-uchv
harvard-safra-ethics
harvard-mahindra-humanities
stanford-humanities-center
yale-whitney-humanities
berkeley-townsend-center
uchicago-humanities-events
cambridge-crassh
oxford-torch
oxford-philosophy
institute-philosophy-london
sas-events-london
lse-events
college-de-france-agenda
iwm-vienna-events
warburg-events
new-school-nssr-events
ias-events
tanner-lectures
apa-meeting-submissions
cpa-congress
spep
philosophy-of-science-association
european-society-analytic-philosophy
european-society-aesthetics
bsph
bsap
sap-uk
bset
nassp
society-classical-studies
archaeological-institute-america
leeds-imc
kalamazoo-medieval-congress
renaissance-society-america
college-art-association
icma-medieval-art
asor-annual-meeting
sharp
digital-humanities-adho
hastac-opportunities
chci-annual-meeting
acls-competitions
radcliffe-fellowship
national-humanities-center-fellowships
ias-fellowships
warburg-fellowships
iwm-fellowships
dumbarton-oaks-fellowships
american-academy-rome-prize
getty-scholar-grants
huntington-fellowships
folger-fellowships
nias-fellowships
casbs-fellowships
```

## Scraper prompt update

`scripts/seminars-prompt.md` now explicitly treats `scope: global-academic` sources as in-scope outside Toronto/Southern Ontario/Kingston/Montréal for:

```text
philosophy
humanities
public lectures
colloquia
seminars
calls for papers
fellowships
residencies
funding opportunities
research-network deadlines
```

The prompt keeps the anti-fabrication rule: exact live events require exact source dates; undated programs stay zero-yield for the scraper and only appear as manual projected watch cards when clearly marked.

## Technical additions

```text
scripts/build-academic-shortcuts.js
scripts/verify-academic-shortcuts.js
```

`npm run verify:all` now checks the academic shortcuts immediately after the writing shortcut checks.

`upsert-manual-calendar-events.js` now preserves optional richer fields such as:

```text
writing_bands
academic_bands
subjects
genres
eligibility_region
opportunity_kind
application_url
registration_url
submission_url
rules_url
deadline_confidence
source_notes
```

## Verification

```text
CALENDAR DATA PARITY OK — 512 mirrored entries.
ACADEMIC SHORTCUT CHECK PASSED — 55 global-academic sources; counts {"university": 130, "philosophy": 46, "humanities": 96, "cfps": 87, "lectures": 36, "fellowships": 40}.
WRITING SHORTCUT CHECK PASSED — 39 current youth writing competitions; counts {"writingclub":39,"writingkids":13,"writingjuniors":20,"writingteens":36,"writinggrads":36}.
npm run verify:all PASS.
```

## Important editorial note

The fellowship and CFP records marked `projected` are source-watch cards. They are useful reminders for university planning, and each description tells the reader to confirm the active deadline on the official site before acting. The Princeton UCHV lecture/colloquium records are dated from the live UCHV events listing.
