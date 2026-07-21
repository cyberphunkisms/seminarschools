# Remaining Website Audit 10

Date: 2026-07-19
Release: `2026-07-19-remaining-website-audit10`
Baseline: Final9 sentence-discipline release

## Scope

The audit covered the root index, `/main/`, the full modular CV, all focused CV routes, the career archive, map behaviour, shared footer, public calendar surface, Teacher Resources subject indexes, Bookwormcard, the interactive sitemap graph, representative campaign and archive applications, mobile rendering, semantic hierarchy, internal-link integrity, assets, duplicate identifiers, accessible names, responsive overflow, print/PDF governance, release scripts, public mirror, and anti-backtracking contracts.

## Baseline findings

- All 86 inherited release commands passed before revision.
- The static scan found no broken internal links, broken local assets, duplicate IDs, empty links, missing image alternative text, missing image dimensions, broken `aria-controls`, or page-level horizontal overflow on the representative rendered routes.
- The inherited tests did not cover several visible mobile and semantic defects.

## Repairs made

1. Shared footer columns now reserve enough intrinsic width for long project names and collapse to one column on narrow phones.
2. Footer links preserve whole words instead of fragmenting `polymorphousmythology` and `Reviews & references`.
3. `/main/` event dates remain on one line at mobile widths and receive a wider date column.
4. CV job titles now use `h3` beneath a visible `h2` Selected Experience heading instead of skipping from `h1` or `h2` to `h4`.
5. Teacher Resources subject cards now use `h2` beneath each subject page `h1`.
6. The interactive sitemap legend and detail title now use `h2`, removing the `h1` to `h3` jump.
7. AODA training moved from the archive’s `Current Projects` group into the current professional-development period.
8. The embedded CV map now carries a permanent visible recovery link when Google Maps is blank, blocked, slow, or unavailable.
9. The Sabachtan label now extends away from the lower-left information overlay.
10. Bookwormcard’s mobile display controls and visual-legend control now provide 44-pixel touch targets.
11. Thirty application and archive pages received a main landmark on their existing primary content container without altering their visual hierarchy.
12. Generated search pages now retain the site-wide type and zoom contract, and their duplicate keyboard-enhancement script was removed.
13. Route-doctrine and sitemap-classification noindex checks now accept valid HTML attribute order instead of treating reordered metadata as absent.
14. A dedicated Audit10 verifier was added to the central release runner so these repairs survive later regeneration.
15. The SEO and Bookwormcard text gates now evaluate valid attribute order and visible characters rather than one serializer-specific HTML encoding.
16. Ten event permalinks that expired between Final9 and Audit10 were restored as `noindex` past-event archives, and the search builder now retires expired pages instead of deleting shared URLs.

## Anti-backtracking audit

| Locked decision | Result |
| --- | --- |
| Final9 sentence discipline | Preserved |
| Canonical full CV at `/saul/` | Preserved |
| Additive modular focus areas | Preserved |
| Shareable focused CV routes | Preserved |
| Map immediately after the main CV card | Preserved |
| Complete archive and archive bridge | Preserved |
| Project material gated behind Portfolio | Preserved |
| Performance maintained as a separate focus | Preserved |
| GEICO retained | Preserved |
| TELUS removed | Preserved |
| Website may use the approved spectrum | Preserved |
| Professional PDFs remain monochrome | Preserved |
| Portrait and geographic map remain web-only | Preserved |
| CORE, CORE+, charter, access pack, and Mephistodata rules | Preserved |
| Past event permalinks | Preserved as `noindex` archives |

## Remaining issues that require a decision

The unresolved items are recorded in `docs/WEBSITE_DECISIONS_FOR_SAUL_2026-07-19.md`. They concern product direction, privacy, dependence on external services, content curation, archive exposure, and the amount of cinematic scrolling. No preference was inferred inside the build.

## Verification results

- Central release runner: 87/87 commands passed.
- Public mirror: rebuilt from the final source tree.
- Static audit: 1,067 source HTML pages scanned with zero unwaived issues.
- Mobile browser check at 390 pixels: zero horizontal overflow on the repaired representative routes; footer links have zero intrinsic overflow; lecture dates remain one line; Bookwormcard controls meet 44 pixels; the CV map recovery action remains visible.
- PDF render check: General, Hospitality, and Performance professional PDFs render as one-page US Letter documents with restrained charcoal/cool-gray styling, readable text, and no clipping or overlap.
- The companion package-verification report and SHA-256 accompany the delivered ZIP.

