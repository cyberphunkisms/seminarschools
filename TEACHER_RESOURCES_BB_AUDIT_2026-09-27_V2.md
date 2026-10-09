# Teacher Resources and BB follow-up audit — September 27, 2026

The audit used the saved version 1 of `seminar-schools-teacher-resources-bb-complete-2026-09-27.zip`, SHA-256 `7be2545f0c3bfaf01f68c2b64b930ecfbaac5770f63f85a0afecfca09f14e169`. CRC and all 21,384 payload hashes passed.

## Audit result

The earlier update was incomplete. The successor repairs the confirmed omissions below and retains the full predecessor, including editable masters. No website deployment was performed.

| Confirmed omission | Evidence before correction | Correction |
| --- | --- | --- |
| IELTS disappears under PDF filtering | `?q=IELTS&file=PDF` returned zero work cards despite the recorded downloadable PDF | PDF and webpage are overlapping file facets; old composite-format URLs remain accepted |
| Common combined searches and joined-title misspellings fail | `telltale heart pdf`, `Poe PDF`, `telltale haert` and `telltlae heart` returned no results | Search combines title variants, author and recorded file format; approximate matching also recognizes joined title words while preserving exact-title priority and excluding inherited collection descriptions |
| Module contents links do not reveal their contents | Clicking a contents link and reloading its fragment left the target details closed | Links open the target record and move keyboard focus to its summary; shared fragment URLs and printing all records work |
| New module omitted from sitemap | No module URL in `sitemap.xml` | Both full and scoped search builds register the route |
| New module omitted from normal generation | No canonical build call to the module generator | The canonical search builder now generates and checks the module page from its JSON owner |
| Module page incorrectly treated as an exempt star index | All-page visible-geometry gate rejected the new child route | The generator applies the existing public-page geometry contract and includes a visible colophon; exact star-index exemptions remain unchanged |
| Build checks reject the new IELTS record | Translation checks still required 645 resource entries, language attributes and detail pages | Updated the three exact-count checks to the verified 646-record inventory |
| Opening README points to an older release | Its first current-successor notice still named September 11 | Added current audit/version instructions and retained every historical notice |

## Original requirements checked

| Requirement | Result and evidence |
| --- | --- |
| Correct file telling people how to play | `polymyth/bookwormburrows.txt`, canonical BB startup `dm-115`, compiled rules and public how-to-play all retain the MC reusable-module / CC individual-playthrough distinction |
| Pretend game with three participants | Current startup guidance distinguishes three fictional player characters from source NPCs and saved student records; the preserved Oscar record remains in CC |
| Thank You, Ma’am reusable material has a reachable home | MC index links the 185-record readable dossier and structured JSON; contents navigation, fragments, sitemap and rebuild are now tested |
| Image claims use the correct evidence | Instructions distinguish embedded images, links, stored assets and citations; the unavailable Harlem attachment was not recreated or inserted |
| IELTS belongs in Teacher Resources | One indexed IELTS record, detail route, existing guide/PDF and masters retained; root homepage contains no IELTS feature |
| Tell-Tale Heart is findable | Joined, spaced and punctuated title forms, Texts and Practice categories, author and PDF combinations tested |
| Search ranking and edition grouping | Exact-title and author tests pass; unrelated collection descriptions do not produce Poe results; source versions remain accessible |
| Results, filters and recovery | Ranked results appear below controls, pagination works, Enter focuses results, filter-only reset retains query, and detail return preserves search state |
| Metadata remains honest | Missing grade/curriculum values require explicit inclusion under those filters and display uncertainty; source contents and answer-key availability are not invented |
| Accessibility and resilience | Keyboard, 320–1280 px layouts, reduced motion, print, no-JavaScript catalog, URL state and browser-history scenarios tested |
| Preserve content and private masters | All 645 original resources plus IELTS retained; BB/MC/CC preservation checks pass; all predecessor payload paths and 25 editable-master files are required by packaging |

## Verification and limits

The original browser scenarios, 373 state/layout assertions, independent follow-up regressions, BB checks, static search generation, source/public parity and public/private boundary are rerun for this successor. The final package receipt records archive counts, hashes and recovery validation.

- All 16 independent follow-up regressions pass. The original 26 browser scenarios pass, and the existing state/layout suite passes 373 assertions. Desktop and phone render samples were inspected.
- BB startup, kid-friendly presentation, mechanics, final-readiness and semantic-preservation checks pass. No BB, MC or CC data was changed in this follow-up.
- Static shared-geometry checks pass on 7,551 source and 7,551 public pages. Public parity covers 9,877 allowlisted files; the private-boundary check scans 9,878 public files.
- The focused Teacher Resources/module build is checked for an immediate rebuild with zero changed durable files. Its receipt is `scripts/reports/teacher-bb-audit-20260927-scoped-rebuild.json`.
- The full `npm run build` completes in an isolated copy after the 645/646 assertions are corrected. The build comparison reports 5,591 durable paths changed from the delivered snapshot. This establishes snapshot divergence; a second consecutive canonical build was not run in that audit, so repeat-build instability was not established. The broad regenerated output was not copied over unrelated archived material. The failure log is included.
- The full geometry browser gate still fails on natural fullscreen motion and palette interpolation in existing Leizu cloud and sitemap-graph views. Its output reports no failure on the selected Teacher Resources, BB, campaign and module routes. The failure log is included; no whole-site browser pass is claimed.
- A standalone translation check on the preserved snapshot still reports a missing localized-sitemap block. The full build creates that block and passes the translation stage. The current standalone report retains this failure explicitly.

These wider failures remain open. This is a corrected full archive with disclosed audit residue, not a fully certified deployment release.

External resource contents, licensing, reading levels, timings, answer keys and live availability were not reviewed source by source. The historical module records retain their original source status. These are evidence limits rather than newly verified claims. The archive does not claim deployment to the live website.
