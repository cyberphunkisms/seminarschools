# Linkability Overhaul Report — 2026-07-09

## Ruling

Meaninglib* and sibling star files now use a generated clickable-lexicon layer over the raw source layer.

Raw `.txt` and source-note layers remain book-source material and are not mutated with inline links. Generated HTML surfaces and the concordance carry clickability.

## What changed

1. Added `scripts/build-meaninglib-linkability-registry.js`.
2. Expanded `polymyth/concordance/vocabulary.json` from 88 curated terms to 762 approved/stable registry terms.
3. Rebuilt `polymyth/concordance/concordance-index.json` across `ml*`, `bb*`, `cc*`, and `mc*`.
4. Hardened `js/autolink.js` to link generated HTML body text, lists, blockquotes, and headings while skipping navigation, buttons, inputs, code, and `data-no-autolink` zones.
5. Added ML* doctrine entry: `Linkability overhaul: generated clickable lexicon over raw star-file source`.
6. Added `scripts/verify-linkability-overhaul.js`.
7. Rebuilt Meaninglib dataset, Meaninglib search, AI Access Pack, and public deploy.
8. Updated page-size budget for the intentional ML* doctrine growth.
9. Kept the raw five-book/source-note layer intact.

## Linkability stats

- Vocabulary registry terms: 762
- Concordance terms with references: 755
- Cross-star references: 15,902
- Star files indexed: methodologylist*, bookwormburrows*, campaigncodex*, modulecanon*

## Important linked clusters

- Always Already
- TABOO
- Equifinality / 殊途同歸性
- Collective Synchronicity
- Waking Life
- Devil's Dictionary
- Persona
- Malefactor
- Sabachtan Gnostic
- Gorgonification / Degorgonification
- Ironmanning
- Parseltongue / parceltongue
- BookwormBurrows
- BBT
- Rainbowmagic
- Surface Translation Firewall
- Verbatim Preservation Gate
- Raw Note Layer
- Five Books

## Verification

```text
LINKABILITY OVERHAUL VERIFY PASSED — 762 vocabulary terms, 755 concordance terms, 15902 references.
VERIFY ALL FAST PASSED — 79/79 checks in 25.8s.
```

## Post-overhaul spirit audit correction

A follow-up audit found that the standalone linkability verifier existed and passed, but was not yet wired into the full release runner. This has been corrected: `verify:linkability-overhaul` now exists in `package.json`, and `node scripts/verify-linkability-overhaul.js` is now included in `scripts/verify-all-runner.js` as a release blocker.
