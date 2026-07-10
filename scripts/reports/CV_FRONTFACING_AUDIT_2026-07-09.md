# CV front-facing audit

Date: 2026-07-09
Scope: one-page modular CV output and site PDF builder

## Verdict

Core Signals was removed from the CV output. It is expressive, but it reads as internal theory language rather than a normal hiring-reader heading. The front-facing replacement is Key Skills.

## Why Key Skills

Key Skills is plain, scannable, and normal for a broad employment CV. It tells the hiring reader exactly what the sidebar contains. Core Competencies would also be conventional, but it sounds more corporate and less flexible across teaching, community, hospitality, volunteer, performance, and portfolio outputs. Skill Highlights would be acceptable, but it is softer than Key Skills.

## What changed

- saul/index.html print/export sidebar now says Key Skills.
- scripts/build-cv-pdf.js now emits Key Skills.
- scripts/verify-saul-modular-cv.js now blocks Core Signals from returning and requires Key Skills.
- saul/cv.pdf was rebuilt as one page.
- Saul_Karim_Nassau_CV_onepage_revamp_2026-07-09.pdf was rebuilt as one page.
- cv-modular-onepage-samples-2026-07-09.zip was rebuilt from the updated label.

## Front-facing audit

### Hiring reader view

The CV now reads as a professional one-page folio rather than a framework artifact. The strongest visual features remain the large name, one-page discipline, strong left timeline, profile band, and skill sidebar. Key Skills removes the one phrase that sounded like internal theory language.

### ATS and conventional reader view

The page remains mostly text-first. The label Key Skills is more compatible with hiring expectations than Core Signals. The right sidebar still avoids graphics-heavy icons and decorative labels that could confuse parsing.

### Design view

The old CV reference had a stronger one-page identity and hierarchy than the earlier modular PDF. The revamp keeps that density while using a cleaner editorial grid. Key Skills supports the visual rhythm because it is shorter and clearer than Core Signals.

### Modularity view

The sidebar still changes based on selected tabs. The label stays stable while the contents shift. Stable heading plus modular content is better than changing the heading for every output.

## Remaining CV design notes

- The design is now stronger than the original modular output, but the sidebar still carries many certifications in the general CV. This is useful for breadth and less useful for extreme elegance.
- The timeline is dense by necessity. One-page discipline is preserved.
- The next polish round should compare two variants: current editorial folio versus a more dramatic old-CV-inspired centered layout.

## Verification

- PDF page count: 1
- PDF text contains: Key Skills
- PDF text does not contain: Core Signals
- Rendered page inspected after rebuild
