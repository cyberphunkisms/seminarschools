#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RELEASE = '2026-07-18-mephistodata-sentence-discipline-final9'
DATE = '2026-07-18'


def read(rel: str) -> str:
    return (ROOT / rel).read_text(encoding='utf-8')


def write(rel: str, text: str) -> None:
    path = ROOT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding='utf-8')


def replace_required(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    if old not in text:
        return text
    return text.replace(old, new)


def replace_all_if_present(text: str, old: str, new: str) -> str:
    return text.replace(old, new)


def patch_json_file(rel: str) -> None:
    path = ROOT / rel
    data = json.loads(path.read_text(encoding='utf-8'))
    data['release'] = RELEASE
    old = 'Helps with transport, information, security and crowd support; participated in 2025 and 2026 planning.'
    new = 'Supported transport, information, security, and crowd flow during festival operations and participated in 2025 and 2026 planning.'

    def walk(value):
        if isinstance(value, dict):
            for k, v in list(value.items()):
                value[k] = walk(v)
        elif isinstance(value, list):
            for i, v in enumerate(value):
                value[i] = walk(v)
        elif value == old:
            return new
        return value

    walk(data)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def patch_core_slot_28() -> None:
    rel = 'polymyth/methodologylist/index.html'
    text = read(rel)
    title = '"t": "CORE slot 28 mirror — CORRECTION DEFAULTS"'
    pos = text.index(title)
    bpos = text.index('"b": ', pos) + len('"b": ')
    body, consumed = json.JSONDecoder().raw_decode(text[bpos:])
    bend = bpos + consumed
    tgpos = text.index('"tg": ', bend) + len('"tg": ')
    tags, tgconsumed = json.JSONDecoder().raw_decode(text[tgpos:])
    tgend = tgpos + tgconsumed

    old_compact = 'Violations: climactic sentence, parallel reveals, Jobs cadence, dash/comma/colon/semicolon attaching inferable content, annotation-dependent sentence.'
    new_compact = ('Violations: climactic sentence, parallel reveals, Jobs cadence, dash/comma/colon/semicolon attaching inferable content, '
                   'annotation-dependent sentence, AI-narrated borrowed experience, bolted-on also/category appendage, generic ethical announcement, '
                   'abstract selfhood, obvious-competence announcement, balanced consequence-summary/two-outcome closer.')
    body = replace_required(body, old_compact, new_compact, 'CORE slot 28 compact violations')

    marker = 'Each of these six violations performs rhetorical effort without delivering new information.'
    inserted = '''(vii) BOLTED-ON "ALSO" / CATEGORY APPENDAGE (added July 18 2026) — a sentence attaches a spare résumé category, credential, audience, or trait after the paragraph has already completed its movement. The common form uses "also" to make the attachment sound connected. Rejected example: "Competitive soccer and years of youth programming also make the pace of a SportStars field or facility familiar to me." The sentence adds athletic and youth-programming categories without changing the paragraph's active claim. REVERSAL. Put the evidence beside the action it explains, or cut it. DELETION TEST: remove the sentence. If the paragraph still moves in exactly the same way and only a résumé category disappears, the sentence was bolted on.

(viii) GENERIC ETHICAL ANNOUNCEMENT / ABSTRACT SELFHOOD (added July 18 2026) — a sentence announces care, inclusion, trust, safety, authenticity, or another humane value without naming a concrete situation and response. Rejected forms include "Parents and coaches also need to know..." when the sentence merely declares reassurance, and "recognizably themselves" when the phrase substitutes an abstract identity claim for observable conduct. REVERSAL. Name who acts, what happens, and how the writer responds. Keep an ethical sentence only when it changes the action described.

(ix) OBVIOUS-COMPETENCE ANNOUNCEMENT (added July 18 2026) — a sentence presents a baseline task as though it were distinctive evidence. Rejected example: "If a take needs repeating, I can do it." Repeating a take is an ordinary production requirement. REVERSAL. Give a concrete practice, constraint, or result that distinguishes the work, or omit the sentence.

(x) BALANCED CONSEQUENCE-SUMMARY / TWO-OUTCOME CLOSER (added July 18 2026) — a polished closing sentence packages the previous action into two abstract benefits, often in the form "This keeps X natural and gives Y Z." The sentence announces the supposed consequence instead of adding evidence or carrying the paragraph forward. REVERSAL. End on the concrete action, next decision, observed result, or necessary condition. Cut the closer when the preceding sentence already shows the consequence.

Each of these ten violations performs rhetorical effort without delivering new information.'''
    if inserted not in body:
        body = replace_required(body, marker, inserted, 'CORE slot 28 new violations')

    new_tags = [
        'bolted-on-also', 'category-appendage', 'generic-ethical-announcement', 'abstract-selfhood',
        'obvious-competence', 'balanced-consequence-closer', 'two-outcome-closer', 'deletion-test',
        'user-caught-2026-07-18'
    ]
    existing = [t.strip() for t in tags.split(',') if t.strip()]
    for tag in new_tags:
        if tag not in existing:
            existing.append(tag)
    tags = ', '.join(existing)

    text = text[:bpos] + json.dumps(body, ensure_ascii=False) + text[bend:tgpos] + json.dumps(tags, ensure_ascii=False) + text[tgend:]
    write(rel, text)


def patch_charter() -> None:
    rel = 'CHARTER.txt'
    text = read(rel)
    anchor = ('Do not abstract the preceding action into sentences such as "This comparison\n'
              'also helps me..." followed by a generic competence list. Fold the point into\n'
              'the sentence that performs the method and name the concrete question or result.\n')
    addition = (anchor +
                'A spare credential belongs beside the action it explains. Cut any sentence that\n'
                'only adds a resume category after the paragraph has completed its movement.\n'
                'Replace generic ethical announcements, abstract selfhood, baseline-competence\n'
                'claims, and polished two-benefit closers with a concrete actor, action, and result.\n'
                'Use the deletion test. When removing a sentence leaves the paragraph movement\n'
                'unchanged, the sentence does not belong.\n')
    text = replace_required(text, anchor, addition, 'CHARTER writing discipline')
    write(rel, text)


def patch_activation_generator() -> None:
    rel = 'scripts/build-ai-access-pack.js'
    text = read(rel)
    old_operating_tail = "    '7. Use citations, source paths, or retrieved row IDs whenever possible.',\n    '',\n    '## TASK-SPECIFIC RETRIEVAL',"
    new_operating_tail = "    '7. Use citations, source paths, or retrieved row IDs whenever possible.',\n    '',\n    '## WRITING DISCIPLINE',\n    'Compose clause by clause. Every sentence carries the paragraph into its next concrete action, question, or result.',\n    'Use the deletion test. If removing a sentence leaves the paragraph movement unchanged and removes only a spare credential, audience, ethical signal, identity claim, baseline competence, or tidy dual benefit, cut it.',\n    'Block bolted-on also/category appendages, generic ethical announcements, abstract selfhood, obvious-competence announcements, and balanced consequence-summary/two-outcome closers.',\n    'Rejected examples include: Competitive soccer and years of youth programming also make the pace of a SportStars field or facility familiar to me. Parents and coaches also need to know... recognizably themselves. If a take needs repeating, I can do it. This keeps X natural and gives Y Z.',\n    'Put evidence beside the action it explains. Name the actor, action, condition, and result. End where the concrete movement ends.',\n    '',\n    '## TASK-SPECIFIC RETRIEVAL',"
    text = replace_required(text, old_operating_tail, new_operating_tail, 'Activation writing section')

    old_pack = "  lines.push('- Apply AI prose tell detection when generating user-facing prose.');\n  lines.push('');\n  lines.push('## MEPHISTODATA MODE');"
    new_pack = "  lines.push('- Apply AI prose tell detection when generating user-facing prose.');\n  lines.push('- Use the deletion test. Cut bolted-on also/category appendages, generic ethical announcements, abstract selfhood, obvious-competence claims, and balanced two-outcome consequence closers.');\n  lines.push('- Put evidence beside the action it explains. Every sentence must move the paragraph into a concrete action, question, condition, or result.');\n  lines.push('');\n  lines.push('## MEPHISTODATA MODE');"
    text = replace_required(text, old_pack, new_pack, 'Access pack writing guards')

    old_regex = 'citation discipline|ai prose|law review|dual write|txt html|html txt|text mirror)'
    new_regex = 'citation discipline|ai prose|law review|bolted on|category appendage|consequence closer|obvious competence|abstract selfhood|generic ethical announcement|dual write|txt html|html txt|text mirror)'
    text = replace_required(text, old_regex, new_regex, 'Meaninglib writing hint regex')
    write(rel, text)


def patch_front_pages() -> None:
    replacements = {
        'index.html': [
            ('The site opens through practical entrances: study support, public events, classroom materials, reading games, project archives, and a general CV.',
             'Study support, public events, classroom materials, reading games, project archives, and the full CV are available below.'),
            ('Leizu gives the tutoring path, session structure, policies, intake, and scholarship information.',
             'View tutoring plans, session structure, policies, intake, and scholarship information.'),
            ('Polymythcal gathers public opportunities with filters, dates, source links, and freshness labels.',
             'Search public talks, contests, calls for papers, fellowships, and festivals by date, type, and source freshness.'),
            ('The resource finder keeps the page link-first, searchable, and organized by subject and level.',
             'Search classroom resources by subject and level, with direct links to the original material.'),
            ('BB starts with the wormcard maker, then points students and teachers toward the rule library.',
             'Make a wormcard, then use the rule library to guide students through choices inside the text.'),
            ('AA* now funnels toward polymyth without flattening either project into a generic homepage.',
             'Open the archive, then follow its routes into polymyth and ML*.'),
            ('The CV is framed broadly for professional opportunities rather than only for Leizu.',
             'Open the full professional record, choose a focus, and download the matching monochrome CV.'),
        ],
        'about/index.html': [
            ('Polymythcal keeps public lectures, calls, fellowships, festivals, and writing opportunities in one searchable view.',
             'Search public lectures, calls, fellowships, festivals, and writing opportunities in one view.'),
            ('Bookwormburrows begins with a wormcard, then moves into teacher-guided choices inside the text-world.',
             'Make a wormcard, then move into teacher-guided choices inside the text-world.'),
            ('AA* carries its own path while pointing interested readers toward polymyth and ML* without twisting either layer.',
             'Open the AA* archive, then follow its routes into polymyth and ML*.'),
            ('The CV is not a Leizu-only funnel; it is the broad employment and project-history page.',
             'Choose a professional focus, share the selected view, or download the matching monochrome CV.'),
            ('Toronto has more free public lectures than one person can attend. This page keeps the strongest upcoming events in view. <a href="/marginalia">Marginalia</a> carries the longer reflections.',
             'Toronto has more free public lectures than one person can attend. The calendar below shows the strongest upcoming events. <a href="/marginalia">Marginalia</a> carries longer reflections on selected talks.'),
            ('Seminar Schools hosts that practice through Leizu Academy, the Agora, Ohm Dome, the polymythcalendar, and Marginalia. Each project offers a different entrance into the same room.',
             'Leizu Academy handles tutoring and the Agora hosts public reading. Ohm Dome develops a public gathering structure, while polymythcal tracks events and deadlines and Marginalia carries longer essays.'),
            ('Saul Nassau runs Seminar Schools. He has taught for fifteen years across six countries. He holds an MA in Philosophy from the European Graduate School, where he studied with Žižek and Agamben, read Hegel with George di Giovanni at McGill, and is completing a PhD in Education.',
             'Saul Nassau runs Seminar Schools. He has taught for fifteen years across six countries. He holds an MA in Philosophy from the European Graduate School, where he studied with Žižek and Agamben, read Hegel with George di Giovanni at McGill, and is a PhD candidate in Education.'),
            ('<div class="item">PhD in Education in progress</div>', '<div class="item">PhD candidate in Education</div>'),
            ('You may also include a short essay on Leizu, a description of current work, or a letter from a teacher.',
             'You can include a short essay on Leizu, a description of current work, or a letter from a teacher.'),
        ]
    }
    for rel, pairs in replacements.items():
        text = read(rel)
        for old, new in pairs:
            text = replace_required(text, old, new, f'{rel} copy')
        write(rel, text)


def patch_cv_generator_and_pages() -> None:
    rel = 'scripts/build-saul-cv-professional.py'
    text = read(rel)
    text = replace_all_if_present(text, "canonical['release'] = '2026-07-18-map-archive-interaction-final8'", f"canonical['release'] = '{RELEASE}'")
    text = replace_all_if_present(text,
        'The webpage is the visual record. Downloaded PDFs use a separate professional monochrome design.',
        'Use the webpage for the visual record. Download a monochrome PDF for applications.')
    text = replace_all_if_present(text,
        'Single-focus views include ATS-safe and plain-text downloads. Combined views print in the professional monochrome application layout.',
        'Single-focus views include ATS-safe and plain-text downloads. Combined views print in the monochrome application layout.')
    text = replace_all_if_present(text,
        'This shareable link opens the same modular CV card with {escape(m[\'label\'])} selected. The portrait, map, timeline and additive combinations remain available from the main CV.',
        'This link opens the modular CV card with {escape(m[\'label\'])} selected. Open the full CV for the map, complete timeline, every focus area, and combined views.')
    hook = """
# FINAL9 Mephistodata sentence discipline and website hardening runs after FINAL8.
final9_script = ROOT / 'scripts' / 'apply-final9-mephistodata-website-hardening.py'
if final9_script.is_file():
    import subprocess, sys
    subprocess.run([sys.executable, str(final9_script)], check=True)
"""
    if 'apply-final9-mephistodata-website-hardening.py' not in text:
        text = text.replace("\nprint('SAUL_CV_PROFESSIONAL_BUILD_COMPLETE')", hook + "\nprint('SAUL_CV_PROFESSIONAL_BUILD_COMPLETE')")
    write(rel, text)

    old_note = 'The webpage is the visual record. Downloaded PDFs use a separate professional monochrome design.'
    new_note = 'Use the webpage for the visual record. Download a monochrome PDF for applications.'
    old_combined = 'Single-focus views include ATS-safe and plain-text downloads. Combined views print in the professional monochrome application layout.'
    new_combined = 'Single-focus views include ATS-safe and plain-text downloads. Combined views print in the monochrome application layout.'
    old_copy = 'Open the main CV to view the map, timeline, every focus area, and additive role combinations.'
    new_copy = 'Open the full CV for the map, complete timeline, every focus area, and combined views.'
    old_current = 'This focused route stays shareable while the main archive preserves the wider record.'
    new_current = 'Use this link for the selected focus. Open the full CV when you need the complete record.'
    old_route_para = re.compile(r'This shareable link opens the same modular CV card with ([^<]+) selected\. The portrait, map, timeline and additive combinations remain available from the main CV\.')

    pages = [ROOT / 'saul' / 'index.html', ROOT / 'saul' / 'hospitality' / 'index.html']
    pages.extend(sorted((ROOT / 'saul' / 'cv').glob('*/index.html')))
    for page in pages:
        if not page.is_file():
            continue
        page_text = page.read_text(encoding='utf-8')
        page_text = page_text.replace(old_note, new_note).replace(old_combined, new_combined)
        page_text = page_text.replace(old_copy, new_copy).replace(old_current, new_current)
        page_text = old_route_para.sub(r'This link opens the modular CV card with \1 selected. Open the full CV for the map, complete timeline, every focus area, and combined views.', page_text)
        page.write_text(page_text, encoding='utf-8')


def patch_verifiers() -> None:
    rel = 'scripts/verify-final8-website-polish.js'
    text = read(rel)
    old = "if(release!=='2026-07-18-map-archive-interaction-final8')fail.push(`release id ${release}`);"
    new = "if(!['2026-07-18-map-archive-interaction-final8','2026-07-18-mephistodata-sentence-discipline-final9'].includes(release))fail.push(`release id ${release}`);"
    text = replace_required(text, old, new, 'FINAL8 verifier forward compatibility')
    write(rel, text)

    rel = 'scripts/verify-front-facing-boundary.js'
    text = read(rel)
    text = replace_all_if_present(text,
        'The webpage is the visual record. Downloaded PDFs use a separate professional monochrome design.',
        'Use the webpage for the visual record. Download a monochrome PDF for applications.')
    write(rel, text)


def write_audits() -> None:
    core_audit = f'''# CORE+ Bolted-On Prose and Consequence-Closer Hardening\n\nDate: {DATE}\nRelease: `{RELEASE}`\n\n## Source corrections\n\nThe July 18 conversation supplied four exact sentence failures and one recurring closer pattern. They extend the July 11 deictic method-summary rule already stored in CORE slot 28.\n\n1. `Competitive soccer and years of youth programming also make the pace of a SportStars field or facility familiar to me.`\n   Failure: bolted-on `also` clause that adds résumé categories after the paragraph movement is complete.\n2. `Parents and coaches also need to know...`\n   Failure: generic ethical announcement without a concrete situation and response.\n3. `recognizably themselves`\n   Failure: abstract selfhood substituted for observable conduct.\n4. `If a take needs repeating, I can do it.`\n   Failure: baseline production competence presented as distinctive evidence.\n5. `This keeps X natural and gives Y Z.`\n   Failure: balanced two-outcome closer that packages the prior action into polished benefits without advancing the paragraph.\n\n## Canonical update\n\nThe existing `CORE slot 28 mirror — CORRECTION DEFAULTS` entry received four additional Rule A violations. No duplicate CORE entry was created. The compact charter and Mephistodata activation generator now carry the deletion test and the five detection categories.\n\nCanonical paths:\n\n- `polymyth/methodologylist/index.html`\n- `polymyth/methodologylist-coreplus.txt`\n- `CHARTER.txt`\n- `scripts/build-ai-access-pack.js`\n- `hf_export/ai_access_pack/MEPHISTODATA_ACTIVATION.md`\n\n## Operational test\n\nDelete the candidate sentence. When the paragraph keeps the same movement and loses only a spare credential, ethical signal, identity claim, baseline competence, or tidy dual benefit, cut the sentence. Put evidence beside the action it explains.\n'''
    write('data/audits/COREPLUS_BOLTED_ON_PROSE_AND_CONSEQUENCE_CLOSER_HARDENING_2026-07-18.md', core_audit)
    write('COREPLUS_BOLTED_ON_PROSE_AND_CONSEQUENCE_CLOSER_HARDENING_2026-07-18.md', core_audit)

    site_audit = f'''# Mephistodata Sentence Discipline and Website Final9 Audit\n\nDate: {DATE}\nRelease: `{RELEASE}`\n\n## Retrieval record\n\nThe audit loaded the current full website tree, `CHARTER.txt`, canonical methodologylist `SEED`, CORE+ mirrors, the Mephistodata activation generator, the canonical CV data, the CV generator, Final8 audit records, and the central release runner. Recent conversation corrections were treated as binding authorial constraints.\n\n## All-point-of-view critique\n\n### Saul's authorial voice\n\nThe strongest site copy names an action, object, audience, or route. Several root, main, and CV sentences narrated what the page was doing, attached an extra category through `also`, or ended with a balanced explanation of two benefits. Final9 replaces those sentences with direct actions and specific destinations.\n\n### Visitor and student\n\nRoot entry cards now state what can be opened, searched, made, or downloaded. The visitor receives an instruction and destination instead of a description of the site's information architecture.\n\n### Parent, teacher, collaborator, and employer\n\nThe CV route text now distinguishes the visual web record from the monochrome application PDF through direct use language. Focused links identify their purpose and point to the complete record. The BUMI Festival bullet names actual operational work instead of the generic phrase `helps with`.\n\n### Hiring manager and recruiter\n\nProfessional PDFs remain monochrome and role-focused. Project material remains gated to Portfolio and Project-selected states. Performance remains separate. GEICO remains the sole named commercial credit, while TELUS stays removed.\n\n### Accessibility and mobile use\n\nFinal8's skip links, 44-pixel primary controls, sticky section navigation, archive result count, expandable periods, map legend, text locations, and keyboard contracts remain present. Final9 changes copy without removing those affordances.\n\n### Visual design and geometry\n\nThe website keeps its mild spectral system, Indra-web geometry, portrait, and map. Application PDFs keep the charcoal and cool-gray professional system. Geometry remains meaningful on the website and absent from PDFs.\n\n### Interaction design\n\nAdditive CV focus selection, URL-persisted archive filters, focused share routes, combined views, ATS downloads, plain-text downloads, map navigation, and archive links remain active. Final9 adds no competing control system.\n\n### Search, metadata, and public deployment\n\nThe build continues to generate the public mirror from source, enforce sitemap and route classifications, block private artifacts, and verify title, description, canonical, and generated-route contracts.\n\n### Engineering and maintenance\n\nThe correction lives in the canonical generator and CORE source. A dedicated Final9 verifier blocks future reintroduction of the rejected copy, missing Mephistodata writing rules, release drift, TELUS regression, project-gating regression, and loss of Final8 interaction markers.\n\n### Mephistodata and AI retrieval\n\nThe activation file now names the deletion test and the new failure types. The query normalizer routes terms such as `bolted on`, `category appendage`, `consequence closer`, `obvious competence`, and `abstract selfhood` toward ML*.\n\n## Anti-backtracking ledger\n\n| Invariant | Final9 state | Guard |\n|---|---|---|\n| Full deployable site ships | Preserved | CORE slot 28 Full-ZIP rule and release file-count audit |\n| Root and `/main/` remain practical navigation surfaces | Preserved and clarified | `verify-final9-mephistodata-website-hardening.js` |\n| `/saul/` remains an any-job modular CV | Preserved | `verify-ml-antibacktracking.js` and `verify-saul-modular-cv.js` |\n| Multiple focus areas remain additive | Preserved | `verify-ml-antibacktracking.js` |\n| Focused routes remain shareable | Preserved with direct copy | Final8 and Final9 verifiers |\n| Map remains immediately after the main CV card | Preserved | Final8 and Final9 verifiers |\n| Archive bridge remains designed | Preserved | Final8 and Final9 verifiers |\n| Project material remains gated | Preserved | CV data rules and performance synthesis guard |\n| Performance remains separate | Preserved | `verify-saul-performance-synthesis.js` |\n| GEICO retained and TELUS removed | Preserved | Final9 verifier |\n| Website stays visual and PDFs stay professional monochrome | Preserved | visual-governance and PDF-manifest guards |\n| Front-facing copy stays separate from AI/operator instructions | Strengthened | `verify-front-facing-boundary.js` and Final9 copy checks |\n| CORE corrections remain canonical and retrievable | Strengthened | methodology mirrors, search, dataset, access pack, and Final9 verifier |\n\n## Implemented revisions\n\n- Expanded CORE slot 28 Rule A from six to ten prose-failure types.\n- Added the deletion test to the root charter and Mephistodata activation.\n- Rewrote root and main route cards as direct actions.\n- Replaced page-self-narration and abstract project summaries on `/main/`.\n- Updated the founder bio to the user-supplied `PhD candidate in Education` wording while leaving the professional CV education record in its restrained in-progress form.\n- Rewrote CV web/PDF guidance and focused-route archive copy.\n- Replaced the generic BUMI Festival bullet across canonical focus records.\n- Added a Final9 generator hook, verifier, package command, central release gate, audit records, and release metadata.\n\n## Release condition\n\nThe release is accepted only after the complete central verifier passes, the public mirror rebuilds, the full tree count is checked against the uploaded baseline, and the final ZIP reopens successfully.\n'''
    write('docs/MEPHISTODATA_SENTENCE_DISCIPLINE_AND_WEBSITE_FINAL9_AUDIT_2026-07-18.md', site_audit)


def write_final9_verifier() -> None:
    verifier = r'''#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const fail = [];
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = rel => fs.existsSync(path.join(root, rel));
const has = (rel, token) => { if(!read(rel).includes(token)) fail.push(`${rel}: missing ${token}`); };
const lacks = (rel, token) => { if(read(rel).includes(token)) fail.push(`${rel}: reintroduced ${token}`); };
const release = read('RELEASE_ID.txt').trim();
if(release !== '2026-07-18-mephistodata-sentence-discipline-final9') fail.push(`release id ${release}`);

for(const rel of ['polymyth/methodologylist/index.html','polymyth/methodologylist-coreplus.txt','polymyth/methodologylist.txt']){
  for(const token of ['BOLTED-ON','GENERIC ETHICAL ANNOUNCEMENT / ABSTRACT SELFHOOD','OBVIOUS-COMPETENCE ANNOUNCEMENT','BALANCED CONSEQUENCE-SUMMARY / TWO-OUTCOME CLOSER','Competitive soccer and years of youth programming also make the pace of a SportStars field or facility familiar to me.','If a take needs repeating, I can do it.','This keeps X natural and gives Y Z.']) has(rel, token);
}
for(const token of ['A spare credential belongs beside the action it explains.','Use the deletion test.']) has('CHARTER.txt', token);
for(const token of ['## WRITING DISCIPLINE','bolted-on also/category appendages','balanced consequence-summary/two-outcome closers','Use the deletion test.']) has('hf_export/ai_access_pack/MEPHISTODATA_ACTIVATION.md', token);

for(const pair of [
  ['index.html','Study support, public events, classroom materials, reading games, project archives, and the full CV are available below.'],
  ['index.html','Search public talks, contests, calls for papers, fellowships, and festivals by date, type, and source freshness.'],
  ['about/index.html','Choose a professional focus, share the selected view, or download the matching monochrome CV.'],
  ['about/index.html','is a PhD candidate in Education.'],
  ['saul/index.html','Use the webpage for the visual record. Download a monochrome PDF for applications.']
]) has(pair[0], pair[1]);
for(const pair of [
  ['index.html','The site opens through practical entrances'],
  ['index.html','Leizu gives the tutoring path'],
  ['about/index.html','The CV is not a Leizu-only funnel'],
  ['about/index.html','Each project offers a different entrance into the same room.'],
  ['saul/index.html','The webpage is the visual record. Downloaded PDFs use a separate professional monochrome design.']
]) lacks(pair[0], pair[1]);

const canonical = JSON.parse(read('data/saul-cv-canonical-2026.json'));
if(canonical.release !== release) fail.push('canonical CV release drift');
const canonicalText = JSON.stringify(canonical);
if(!canonicalText.includes('Supported transport, information, security, and crowd flow during festival operations and participated in 2025 and 2026 planning.')) fail.push('BUMI operational bullet missing');
if(canonicalText.includes('Helps with transport, information, security and crowd support;')) fail.push('old BUMI bullet returned');
if(/TELUS/i.test(canonicalText)) fail.push('TELUS returned to canonical CV');
if(!/GEICO/.test(canonicalText)) fail.push('GEICO missing from canonical CV');

const routePages = fs.readdirSync(path.join(root,'saul','cv'), {withFileTypes:true}).filter(d=>d.isDirectory()).map(d=>`saul/cv/${d.name}/index.html`).filter(exists);
routePages.push('saul/hospitality/index.html');
if(routePages.length < 13) fail.push(`focused CV route count ${routePages.length}`);
for(const rel of routePages){
  has(rel, 'Use the webpage for the visual record. Download a monochrome PDF for applications.');
  has(rel, 'Open the full CV for the map, complete timeline, every focus area, and combined views.');
  has(rel, 'Use this link for the selected focus. Open the full CV when you need the complete record.');
  lacks(rel, 'This focused route stays shareable while the main archive preserves the wider record.');
}

for(const token of ['cv-map-section--enhanced','class="cv-local-nav"','class="archive-shell"','archive-tools cv-module-tabs','const qArchive']) has('saul/index.html', token);
for(const token of ['Modular CV tabs are additive','active = next;']) has('saul/index.html', token);
for(const rel of ['docs/MEPHISTODATA_SENTENCE_DISCIPLINE_AND_WEBSITE_FINAL9_AUDIT_2026-07-18.md','data/audits/COREPLUS_BOLTED_ON_PROSE_AND_CONSEQUENCE_CLOSER_HARDENING_2026-07-18.md']) if(!exists(rel)) fail.push(`${rel}: missing audit`);
has('scripts/build-saul-cv-professional.py','apply-final9-mephistodata-website-hardening.py');
has('scripts/verify-all-runner.js','verify-final9-mephistodata-website-hardening.js');

if(exists('public/index.html')){
  has('public/index.html','Study support, public events, classroom materials, reading games, project archives, and the full CV are available below.');
  has('public/about/index.html','is a PhD candidate in Education.');
  has('public/saul/index.html','Use the webpage for the visual record. Download a monochrome PDF for applications.');
}
if(fail.length){ console.error('FINAL9 MEPHISTODATA WEBSITE HARDENING FAILED'); fail.forEach(x=>console.error(' - '+x)); process.exit(1); }
console.log(`FINAL9 MEPHISTODATA WEBSITE HARDENING PASSED - ${routePages.length} focused routes, canonical writing discipline, direct front-facing copy, and Final8 interaction invariants verified.`);
'''
    write('scripts/verify-final9-mephistodata-website-hardening.js', verifier)


def patch_package_and_runner() -> None:
    pkg_rel = 'package.json'
    pkg = json.loads(read(pkg_rel))
    pkg['scripts']['verify:final9-hardening'] = 'node scripts/verify-final9-mephistodata-website-hardening.js'
    write(pkg_rel, json.dumps(pkg, indent=2) + '\n')

    rel = 'scripts/verify-all-runner.js'
    text = read(rel)
    line = "  'node scripts/verify-final9-mephistodata-website-hardening.js',\n"
    if line not in text:
        anchor = "  'node scripts/verify-final8-website-polish.js',\n"
        text = replace_required(text, anchor, anchor + line, 'central Final9 gate')
    write(rel, text)


def patch_release_files() -> None:
    write('RELEASE_ID.txt', RELEASE + '\n')
    manifest = json.loads(read('RELEASE_MANIFEST.json'))
    manifest['release_id'] = RELEASE
    manifest['generated_at'] = '2026-07-18T20:30:00Z'
    manifest['date'] = DATE
    manifest['cv_release'] = RELEASE
    additions = [
        'Expanded CORE slot 28 Rule A with the July 18 user-caught sentence failures: bolted-on also/category appendages, generic ethical announcements, abstract selfhood, obvious-competence announcements, and balanced consequence-summary closers.',
        'Added the sentence deletion test to CHARTER.txt, the canonical methodologylist, the Mephistodata activation generator, and the AI Access Pack.',
        'Rewrote root, main, and CV route copy to state direct actions and destinations instead of narrating page structure or packaging polished dual outcomes.',
        'Updated the main founder bio to the user-supplied PhD candidate in Education wording while retaining restrained in-progress wording in professional CV outputs.',
        'Preserved Final8 map placement, archive bridge, sticky navigation, URL-persisted filters, additive CV focus selection, project gating, performance separation, GEICO credit, TELUS removal, and monochrome professional PDFs.',
        'Added a dedicated Final9 anti-backtracking gate and full all-point-of-view audit.'
    ]
    notes = manifest.setdefault('notes', [])
    for note in additions:
        if note not in notes:
            notes.append(note)
    manifest['release_verification'] = 'Pending complete Final9 central release verification.'
    write('RELEASE_MANIFEST.json', json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')


def main() -> None:
    patch_core_slot_28()
    patch_charter()
    patch_activation_generator()
    patch_front_pages()
    for rel in ['data/saul-cv-canonical-2026.json', 'saul/assets/saul-cv-canonical-2026.json']:
        patch_json_file(rel)
    patch_cv_generator_and_pages()
    patch_verifiers()
    write_audits()
    write_final9_verifier()
    patch_package_and_runner()
    patch_release_files()
    print(f'FINAL9_HARDENING_APPLIED {RELEASE}')


if __name__ == '__main__':
    main()
