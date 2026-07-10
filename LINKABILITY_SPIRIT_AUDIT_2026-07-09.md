# Linkability Spirit Audit — 2026-07-09

## Ruling

The last linkability version followed the conceptual spirit of the instruction: generated HTML surfaces gained a clickable lexicon layer, raw star-file / five-book source notes were protected, and the concordance maps important terms across `methodologylist*`, `bookwormburrows*`, `campaigncodex*`, and `modulecanon*`.

One release-hardening issue remained: `scripts/verify-linkability-overhaul.js` existed and passed, but it was not wired into `scripts/verify-all-runner.js` or exposed as an npm script. That meant the linkability check was present but not yet a universal release blocker.

## Correction made in this audit

1. Added `verify:linkability-overhaul` to `package.json`.
2. Added `node scripts/verify-linkability-overhaul.js` to `scripts/verify-all-runner.js`.
3. Confirmed the standalone linkability verifier passes.
4. Confirmed the full release runner now includes the linkability verifier.

## Spirit checks

- Raw book-source layer remains intact.
- Generated clickability lives in HTML and concordance surfaces.
- Important clusters remain in the vocabulary registry, including Equifinality, Collective Synchronicity, Waking Life, Devil's Dictionary, Persona, Malefactor, TABOO, Always Already, Sabachtan Gnostic, Gorgonification, Degorgonification, Ironmanning, Parseltongue, BookwormBurrows, BBT, Rainbowmagic, Surface Translation Firewall, Raw Note Layer, and Five Books.
- Hivemindidioms is covered under the canonical `hivemindidiom` node with plural and snake aliases.
- The concordance remains a backlink surface, not a raw-note mutation.

## Current verification

Standalone linkability check:

```text
LINKABILITY OVERHAUL VERIFY PASSED — 762 vocabulary terms, 755 concordance terms, 15902 references.
```

Full release runner now includes the linkability check as a blocker.

## Remaining issue

No conceptual or implementation blocker remains from the linkability request.
