# BB Kid-Friendly Rewrite Audit

Source archive:
- seminarschools-site-interactivity-stability-overhaul(1).zip

Goal:
- Keep the BB game content intact.
- Make the default visible writing much easier for students and younger readers.
- Preserve the original teacher/archive language for advanced use and future editing.

Changed files:
- bb/index.html
- bb/why/index.html
- bb/why/zh/index.html
- polymyth/bookwormburrows/index.html
- polymyth/bookwormburrows.txt
- scripts/regen-bookwormburrows-txt.js
- scripts/verify-bb-kid-friendly.js
- package.json
- bookwormcard/index.html
- bookwormcard/about/index.html
- bookwormcard/glossary/index.html
- bookwormcard/print/index.html

Main changes:
1. /polymyth/bookwormburrows/
   - Added a default student-friendly reader layer.
   - Kept all 216 SEED entries.
   - Each entry now opens with a simple title and short student-facing explanation.
   - Full original teacher/archive note remains inside a collapsible details block.
   - Search now covers both the simple layer and the original archive text.
   - LocalStorage key changed to bb:entries:kid-friendly-v1 so older saved browser data does not hide the new seed copy.

2. /polymyth/bookwormburrows.txt
   - Regenerated from the canonical SEED array.
   - Each entry now includes:
     - STUDENT TITLE
     - ORIGINAL TITLE
     - STUDENT-FRIENDLY VERSION
     - ORIGINAL TEACHER / ARCHIVE VERSION
   - Original notes are preserved after the student version.

3. /bb/
   - Rewrote the landing page so the three paths are understandable:
     - Make your wormcard.
     - Run the game.
     - Read why it helps learning.

4. /bb/why/ and /bb/why/zh/
   - Added a student-friendly explanation at the top.
   - Moved the long research essay into a collapsible teacher/adult section.
   - Preserved references and the research essay.

5. /bookwormcard/
   - Simplified the static intro copy, about page, glossary explanation, and print-card language.
   - Replaced confusing phrases like "smashed-up character" with "mixed-together character."
   - Kept the Bookwormcard gate structure, ESL help, text controls, and privacy note.

Verification:
- node scripts/verify-bb-kid-friendly.js
- node scripts/verify-bb-why.js
- node scripts/verify-bookwormcard-gate.js
- npm run verify:all

Result:
- Full verify:all passed.
