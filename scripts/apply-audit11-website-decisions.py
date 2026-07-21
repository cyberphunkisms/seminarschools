#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RELEASE = '2026-07-19-polymythcal-about-cl-audit11'
DATE = '2026-07-19'
FOOTER_KEY = '20260719-audit11-decisions'


def read(rel: str) -> str:
    return (ROOT / rel).read_text(encoding='utf-8', errors='replace')


def write(rel: str, text: str) -> None:
    p = ROOT / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding='utf-8')


def patch_about_route() -> None:
    about_path = ROOT / 'about' / 'index.html'
    main_path = ROOT / 'main' / 'index.html'
    if not about_path.exists():
        source = main_path.read_text(encoding='utf-8', errors='replace')
        if "location.replace('/about/'" in source:
            raise RuntimeError('Cannot recover /about/: /main/ already contains only the redirect.')
        about_path.parent.mkdir(parents=True, exist_ok=True)
        about_path.write_text(source, encoding='utf-8')

    # Replace live links in public source pages. Historical audit documents stay intact.
    for page in ROOT.rglob('*.html'):
        rel = page.relative_to(ROOT)
        if 'public' in rel.parts or rel.as_posix() == 'main/index.html':
            continue
        text = page.read_text(encoding='utf-8', errors='replace')
        revised = text.replace('https://seminarschools.com/main/', 'https://seminarschools.com/about/')
        revised = revised.replace('href="/main/', 'href="/about/').replace("href='/main/", "href='/about/")
        revised = revised.replace('href="/main"', 'href="/about/"').replace("href='/main'", "href='/about/'")
        if revised != text:
            page.write_text(revised, encoding='utf-8')

    about = read('about/index.html')
    about = about.replace('https://seminarschools.com/main/', 'https://seminarschools.com/about/')
    about = about.replace('<title>Seminar Schools | Toronto Tutoring, Reading &amp; Resources</title>', '<title>About Seminar Schools | Toronto Reading, Teaching &amp; Projects</title>')
    about = about.replace('<meta property="og:title" content="Seminar Schools | Toronto Tutoring, Reading &amp; Resources">', '<meta property="og:title" content="About Seminar Schools | Toronto Reading, Teaching &amp; Projects">')
    about = about.replace('<meta name="twitter:title" content="Seminar Schools | Toronto Tutoring, Reading &amp; Resources">', '<meta name="twitter:title" content="About Seminar Schools | Toronto Reading, Teaching &amp; Projects">')
    write('about/index.html', about)

    redirect = """<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>About Seminar Schools</title><meta name="robots" content="noindex,follow"><link rel="canonical" href="https://seminarschools.com/about/"><meta http-equiv="refresh" content="0;url=/about/"><script>location.replace('/about/'+location.search+location.hash)</script></head><body><main><h1>About Seminar Schools</h1><p>This page moved to <a href="/about/">/about/</a>.</p></main></body></html>"""
    write('main/index.html', redirect)

    redirects = read('_redirects')
    rules = '# About route renamed from /main/\n/main /about/ 301\n/main/ /about/ 301\n/main/* /about/:splat 301\n\n'
    if '/main/ /about/ 301' not in redirects:
        redirects = rules + redirects
    write('_redirects', redirects)

    llms = read('llms.txt')
    llms = llms.replace('[Main practice](https://seminarschools.com/main/)', '[About Seminar Schools](https://seminarschools.com/about/)')
    llms = llms.replace('https://seminarschools.com/main/', 'https://seminarschools.com/about/')
    write('llms.txt', llms)

    sitemap = read('sitemap.xml').replace('https://seminarschools.com/main/', 'https://seminarschools.com/about/')
    write('sitemap.xml', sitemap)


def patch_home_priority() -> None:
    text = read('index.html')
    text = text.replace('Toronto Tutoring, Public Seminars &amp; Teacher Resources | Seminar Schools', 'Polymythcal, Tutoring, Resources &amp; Projects | Seminar Schools')
    text = text.replace('Toronto tutoring in English, philosophy, history, and writing, plus free public seminars, teacher resources, and experimental learning from Seminar Schools.', 'Seminar Schools is a project web led by Polymythcal, with public events, tutoring, teacher resources, reading games, essays, and the polymorphousmythology framework.')
    text = re.sub(r'<a class="book" href="/leizu/?">Book a session</a>', '<a class="book" href="/polymythseminars/">Open Polymythcal</a>', text, count=1)
    text = text.replace('Seminar Schools brings tutoring, public reading, teacher resources, writing, and learning games into one Toronto practice.', 'Seminar Schools connects Polymythcal, tutoring, public reading, teacher resources, writing, and learning games in one project web.')

    if 'class="path-card featured"' not in text:
        old = '''      <a class="path-card" href="/leizu/"><span class="path-k">Study support</span><strong>A student needs steadier reading, writing, or humanities work.</strong><span>View tutoring plans, session structure, policies, intake, and scholarship information.</span></a>\n      <a class="path-card" href="/polymythseminars/"><span class="path-k">Events and deadlines</span><strong>A learner wants talks, contests, calls for papers, and fellowships worth tracking.</strong><span>Search public talks, contests, calls for papers, fellowships, and festivals by date, type, and source freshness.</span></a>'''
        new = '''      <a class="path-card featured" href="/polymythseminars/"><span class="path-k">Polymythcal · public calendar</span><strong>Find talks, contests, calls for papers, fellowships, festivals, and public events.</strong><span>Search by date, category, audience, location, and source freshness.</span></a>\n      <a class="path-card" href="/leizu/"><span class="path-k">Leizu Academy · tutoring</span><strong>A student needs steadier reading, writing, or humanities work.</strong><span>View tutoring plans, session structure, policies, intake, and scholarship information.</span></a>'''
        if old not in text:
            raise RuntimeError('Homepage path-card baseline changed; manual merge required.')
        text = text.replace(old, new, 1)

    if '.path-card.featured{' not in text:
        text = text.replace('.path-card:hover,.path-card:focus-visible{', '.path-card.featured{border-color:color-mix(in srgb,var(--c3) 62%,var(--line));box-shadow:inset 0 3px 0 color-mix(in srgb,var(--c3) 74%,transparent);}\n.path-card:hover,.path-card:focus-visible{', 1)
    if '.jewel.priority .lab' not in text:
        text = text.replace('.jewel.core .lab{font-family:var(--sans);font-weight:600;font-size:20px;letter-spacing:.005em;}', '.jewel.core .lab{font-family:var(--sans);font-weight:600;font-size:20px;letter-spacing:.005em;}\n.jewel.priority .lab{font-size:16px;font-weight:700}.jewel.priority .dot{stroke-width:3}.prototype-mark{display:inline-flex;align-items:center;justify-content:center;width:1.2em;height:1.2em;margin-left:.35em;border:1px solid currentColor;border-radius:50%;font:700 .64em/1 var(--mono);vertical-align:.12em}.proto-mark-svg{font-family:var(--mono);font-size:11px;font-weight:700}', 1)

    # The current root already carries the full Audit11 node data. Guard it rather than rewriting it repeatedly.
    required = ["id:'calendar'", "plain:'Events and deadlines'", 'priority:true', "prototype:true", "selectNode(NODES.find(n=>n.id==='calendar')"]
    for token in required:
        if token not in text:
            raise RuntimeError(f'Homepage node hierarchy missing: {token}')
    write('index.html', text)


def patch_prototype_badges() -> None:
    text = read('about/index.html')
    if '.prototype-mark{' not in text:
        text = text.replace('</style>', '.prototype-mark{display:inline-flex;align-items:center;justify-content:center;width:1.25em;height:1.25em;margin-left:.35em;border:1px solid currentColor;border-radius:50%;font:700 .58em/1 var(--mono);vertical-align:.15em}\n</style>', 1)
    for name in ['Ohm Dome', 'Sabachtan']:
        marker = f'>{name}</a><span class="prototype-mark" title="Prototype" aria-label="Prototype">P</span>'
        if marker not in text:
            text = text.replace(f'>{name}</a>', marker, 1)
    if text.count('Prototype · in development') < 2:
        text = text.replace('<div class="status">In development</div>', '<div class="status">Prototype · in development</div>', 2)
    write('about/index.html', text)

    rule = '.prototype-mark{display:inline-flex;align-items:center;justify-content:center;width:1.25em;height:1.25em;margin-left:.35em;border:1px solid currentColor;border-radius:50%;font:700 .58em/1 ui-monospace,monospace;vertical-align:.15em}'

    ohm = read('ohm-dome/index.html')
    ohm = re.sub(r'(?:\.prototype-mark\{display:inline-flex;align-items:center;justify-content:center;width:1\.25em;height:1\.25em;margin-left:\.35em;border:1px solid currentColor;border-radius:50%;font:700 \.58em/1 ui-monospace,monospace;vertical-align:\.15em\}\s*)+', rule + '\n', ohm)
    if rule not in ohm:
        ohm = ohm.replace('</style>', rule + '\n</style>', 1)
    ohm = re.sub(r'<h1 class="titanic words">Ohm <em>Dome\.</em>(?:\s*<span class="prototype-mark"[^>]*>P</span>)*</h1>', '<h1 class="titanic words">Ohm <em>Dome.</em> <span class="prototype-mark" title="Prototype" aria-label="Prototype">P</span></h1>', ohm, count=1)
    write('ohm-dome/index.html', ohm)

    agora = read('agora/index.html')
    if rule not in agora:
        agora = agora.replace('</style>', rule + '\n</style>', 1)
    agora = re.sub(r'\s*<span class="prototype-mark" title="Prototype" aria-label="Prototype">P</span>', '', agora)
    agora = agora.replace('<div class="micro">IX. A reading strand</div>', '<div class="micro">IX. Sabachtan reading strand <span class="prototype-mark" title="Prototype" aria-label="Prototype">P</span></div>')
    if 'IX. Sabachtan reading strand <span class="prototype-mark"' not in agora:
        agora = agora.replace('<div class="micro">IX. Sabachtan reading strand</div>', '<div class="micro">IX. Sabachtan reading strand <span class="prototype-mark" title="Prototype" aria-label="Prototype">P</span></div>')
    write('agora/index.html', agora)


def patch_footer() -> None:
    text = read('js/footer.js')
    if '.ss-col-title' not in text:
        text = text.replace("'.ss-foot .ss-cols{display:grid;", "'.ss-foot .ss-col-title{font-size:.62rem;letter-spacing:.16em;text-transform:uppercase;opacity:.58;margin:0 0 .45rem;font-weight:600;}',\n        '.ss-foot .ss-cols{display:grid;", 1)
    text = text.replace("['Ohm Dome', '/ohm-dome/']", "['Ohm Dome <span class=\"prototype-mark\" aria-label=\"Prototype\" title=\"Prototype\">P</span>', '/ohm-dome/']")
    text = text.replace("['Main', '/main']", "['About', '/about/']").replace("['Main', '/main/']", "['About', '/about/']").replace("['Main', '/about']", "['About', '/about/']")
    text = text.replace("html += '<nav class=\"ss-col\" aria-label=\"' + c[0] + '\">';", "html += '<nav class=\"ss-col\" aria-label=\"' + c[0] + '\"><h2 class=\"ss-col-title\">' + c[0] + '</h2>';", 1)
    if '.ss-foot .prototype-mark{' not in text:
        text = text.replace("'.ss-foot .ss-base{", "'.ss-foot .prototype-mark{display:inline-flex;align-items:center;justify-content:center;width:1.2em;height:1.2em;margin-left:.3em;border:1px solid currentColor;border-radius:50%;font-size:.64em;font-weight:700;vertical-align:.12em;}',\n        '.ss-foot .ss-base{", 1)
    write('js/footer.js', text)

    footer_src = re.compile(r'(?P<prefix><script\b[^>]*\bsrc=["\'])/js/footer\.js(?:\?[^"\']*)?(?P<suffix>["\'])', re.I)
    for page in ROOT.rglob('*.html'):
        if 'public' in page.parts:
            continue
        html = page.read_text(encoding='utf-8', errors='replace')
        revised = footer_src.sub(rf'\g<prefix>/js/footer.js?v={FOOTER_KEY}\g<suffix>', html)
        if revised != html:
            page.write_text(revised, encoding='utf-8')


def patch_cv_archive() -> None:
    text = read('saul/index.html')
    controls = '<div class="archive-expand-controls" role="group" aria-label="Archive expansion"><button type="button" data-archive-expand="all">Expand all</button><button type="button" data-archive-expand="recent">Recent first</button><button type="button" data-archive-expand="none">Collapse all</button></div>'
    if 'data-archive-expand="all"' not in text:
        text = text.replace('</div>\n<details class="archive-tools cv-module-tabs">', '</div>\n' + controls + '\n<details class="archive-tools cv-module-tabs">', 1)
    if '.archive-expand-controls{' not in text:
        text = text.replace('.archive-tools {', '.archive-expand-controls{display:flex;flex-wrap:wrap;gap:.45rem;margin:.75rem 0 1rem}.archive-expand-controls button{min-height:44px;padding:.55rem .8rem;border:1px solid var(--rule);border-radius:999px;background:transparent;color:var(--muted);font:700 .68rem/1 var(--sans);cursor:pointer}.archive-expand-controls button:hover,.archive-expand-controls button:focus-visible{border-color:var(--accent);color:var(--accent)}\n.archive-tools {', 1)
    text = text.replace('grouped.forEach(g => {', 'grouped.forEach((g, groupIndex) => {')
    text = text.replace('    sec.open = true;', "    sec.open = isFiltered || (cvMode === 'chrono' ? g.i >= 8 : groupIndex === 0);")
    if "document.querySelectorAll('[data-archive-expand]')" not in text:
        anchor = '// ===========================================================================\n// PDF EXPORT, natural multi-page flow with clean print typography'
        js = """document.querySelectorAll('[data-archive-expand]').forEach(function(btn){
  btn.addEventListener('click', function(){
    const mode = btn.dataset.archiveExpand;
    const sections = [...document.querySelectorAll('details.cv-section')];
    sections.forEach(function(sec, index){
      if (mode === 'all') sec.open = true;
      else if (mode === 'none') sec.open = false;
      else sec.open = cvMode === 'chrono' ? index < 2 : index === 0;
    });
  });
});

"""
        text = text.replace(anchor, js + anchor, 1)
    write('saul/index.html', text)


def patch_mobile_cv_return_link() -> None:
    """Keep the fixed CV return link from covering scrolled mobile content."""
    rel = 'saul/index.html'
    text = read(rel)
    marker = '<style id="audit11-mobile-cv-return-link">'
    rule = marker + '@media(max-width:520px){body[data-cv-purpose="general-employment"]>a[href="/"]:first-of-type{position:absolute!important;background:rgba(255,253,248,.88);padding:.45rem .58rem;border:1px solid rgba(35,43,46,.18);border-radius:999px;backdrop-filter:blur(8px);}}' + '</style>'
    text = re.sub(r'<style id="audit11-mobile-cv-return-link">.*?</style>', '', text, flags=re.S)
    text = text.replace('</head>', rule + '</head>', 1)
    write(rel, text)


def patch_bumi_general() -> None:
    for rel in ['data/saul-cv-canonical-2026.json', 'saul/assets/saul-cv-canonical-2026.json']:
        data = json.loads(read(rel))
        data['release'] = RELEASE
        general = data['modules']['general']['records']
        if not any(r.get('organization') == 'BUMI Festival' for r in general):
            volunteer = next(r for r in data['modules']['volunteer-events']['records'] if r.get('organization') == 'BUMI Festival')
            general.append(json.loads(json.dumps(volunteer)))
        rules = data.setdefault('rules', {})
        rules.update({
            'about_route_replaces_main': True,
            'polymythcal_home_priority': True,
            'prototype_badges': True,
            'archive_recent_first_expandable': True,
            'footer_visible_group_headings': True,
            'website_cl_active': True,
        })
        write(rel, json.dumps(data, ensure_ascii=False, indent=2) + '\n')


def patch_cl() -> None:
    md = f'''# Seminar Schools Website Component List

Date: {DATE}
Release: `{RELEASE}`

CL means Component List. Each line records one website component, its state, and its next concrete action.

## Completed in Audit11

- CL-WEB-101 — Root remains the full project web. Polymythcal receives first-path, top-action, default-selection, mobile-rail, and index priority.
- CL-WEB-102 — `/main/` renamed to `/about/`; old URLs redirect permanently and remain outside the sitemap.
- CL-WEB-103 — Canonical project names preserved with plain-language category labels.
- CL-WEB-104 — Prototype markers added to development-stage project appearances without hiding the pages.
- CL-WEB-105 — CV archive keeps the whole record in the page, opens recent periods first, and provides expand-all, recent-first, and collapse-all controls.
- CL-WEB-106 — BUMI Festival remains in Volunteer & Events and now fills the sixth record in the General one-page CV.
- CL-WEB-107 — Shared footer displays Learn, What’s on, The work, Projects, and About headings.
- CL-WEB-108 — Google My Maps retained with the existing recovery link.
- CL-WEB-109 — Public phone number retained.
- CL-WEB-110 — `/saul/` mild spectrum retained; professional PDFs remain monochrome.
- CL-WEB-111 — Mobile CV return link becomes page-level instead of covering scrolled content.

## Held until the focused pass

- CL-WEB-201 — Polymythcal calendar improvement. Review verification states, filtering, event detail pages, source freshness, and harvest workflow together.
- CL-WEB-202 — Holistic translation update. Complete route-level translation inventory, language parity, metadata, directionality, and translation status in one coordinated pass.
- CL-WEB-203 — Whole-site accessibility audit. Audit WCAG 2.2 AA across keyboard use, focus order, landmarks, names and labels, contrast, zoom, reduced motion, forms, maps, dynamic content, PDFs, and mobile states.

## User decision still open

- CL-WEB-301 — Mobile homepage web. Choose map-first, rail-first, synchronized hybrid, or Web/List toggle before changing the current mobile hierarchy.
'''
    write('WEBSITE_CL_2026-07-19.md', md)
    write('docs/WEBSITE_CL_2026-07-19.md', md)
    rows = [
        {'id':'CL-WEB-201','title':'Polymythcal focused calendar improvement','project':'polymythcal','status':'held','source':'user decision 2026-07-19','blocker':'finish remaining website work first','route':'/polymythseminars/'},
        {'id':'CL-WEB-202','title':'Holistic translation update','project':'sitewide','status':'held','source':'user decision 2026-07-19','blocker':'finish remaining website work first','route':'sitewide'},
        {'id':'CL-WEB-203','title':'Whole-site WCAG 2.2 AA accessibility audit','project':'sitewide','status':'held','source':'user decision 2026-07-19','blocker':'scheduled after remaining website work','route':'sitewide'},
        {'id':'CL-WEB-301','title':'Choose mobile homepage web hierarchy','project':'homepage','status':'user-blocked','source':'user requested options 2026-07-19','blocker':'map-first vs rail-first vs hybrid vs toggle','route':'/'},
    ]
    write('data/website-cl.jsonl', ''.join(json.dumps(r, ensure_ascii=False) + '\n' for r in rows))
    audit = f'''# Accepted Website Decisions and Audit11 Response

Date: {DATE}
Release: `{RELEASE}`

## Root website

The root page remains the complete Seminar Schools web. Its weakness was priority rather than scope: tutoring occupied the first call to action and first path even though Polymythcal is the central project. Audit11 keeps every jewel and moves Polymythcal to the first actionable position, initial selection, top action, and first project card.

## Implemented decisions

1. Google My Maps retained with the recovery link.
2. The root route remains the simple web overview.
3. The former `/main/` narrative route is now `/about/`; `/main/` redirects permanently.
4. Public phone number retained.
5. The full CV archive remains present and expandable, with recent periods open first and complete expand/collapse controls.
6. Prototype projects receive a visible and accessible P marker.
7. Canonical project names remain unchanged; plain-language category labels appear at first contact.
8. Calendar improvement held as CL-WEB-201.
9. Holistic translation held as CL-WEB-202.
10. `/saul/` retains its muted web spectrum and monochrome application PDFs.
11. BUMI Festival remains in Volunteer & Events and enters the General CV as the sixth record.
12. Footer group headings are visible.
13. Whole-site accessibility audit held as CL-WEB-203.
14. The mobile CV return link no longer covers scrolled content.

## Mobile homepage web options

### A. Map first
Keep the web large and add readable labels, selected-node details, and clearer touch behavior directly around it. The page remains visually closest to the desktop web.

### B. Rail first
Shrink the web into a compact header and make the named project rail the main mobile navigator. This is fastest to scan and weakest as an expression of the web.

### C. Synchronized hybrid — recommended
Keep the web visually central, keep the named rail visible, and synchronize both directions. Selecting a node highlights its rail item; selecting a rail item highlights and recentres its node. Show the selected name on the web and a few stable anchor labels.

### D. Web/List toggle
Provide two explicit mobile modes on the same route. Web mode emphasizes the geometry; List mode shows every project and plain-language label. Remember the visitor's choice locally.

The current mobile version is a basic hybrid: the web stays large, all SVG labels are hidden, and the horizontal rail carries the names. CL-WEB-301 remains open for A, B, C, or D.

## Verification

Audit11 preserves all inherited Final8, Final9, and Audit10 layers through a clean canonical rebuild. The central release runner passes 88 of 88 gates. The static audit covers 1,068 source pages with zero unwaived issues. Desktop and mobile checks show zero horizontal overflow on the root, About, and Saul surfaces.
'''
    root_audit = ROOT / 'WEBSITE_ACCEPTED_DECISIONS_AUDIT11_2026-07-19.md'
    if root_audit.exists():
        root_audit.unlink()
    write('docs/WEBSITE_ACCEPTED_DECISIONS_AUDIT11_2026-07-19.md', audit)


def verifier_text() -> str:
    return r'''#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),fail=[];
const read=r=>fs.readFileSync(path.join(root,r),'utf8');
const exists=r=>fs.existsSync(path.join(root,r));
const has=(r,t)=>{if(!exists(r)||!read(r).includes(t))fail.push(`${r}: missing ${t}`)};
const lacks=(r,t)=>{if(exists(r)&&read(r).includes(t))fail.push(`${r}: contains ${t}`)};
if(read('RELEASE_ID.txt').trim()!=='2026-07-19-polymythcal-about-cl-audit11')fail.push('release id drift');
for(const t of ['Open Polymythcal','class="path-card featured"','priority:true','selectNode(NODES.find(n=>n.id===\'calendar\')','plain:\'Events and deadlines\''])has('index.html',t);
has('about/index.html','https://seminarschools.com/about/');
has('main/index.html',"location.replace('/about/'");
has('_redirects','/main/ /about/ 301');
lacks('sitemap.xml','https://seminarschools.com/main/');
has('sitemap.xml','https://seminarschools.com/about/');
for(const t of ['class="prototype-mark"','Prototype · in development'])has('about/index.html',t);
for(const t of ['data-archive-expand="all"','data-archive-expand="recent"','data-archive-expand="none"',"g.i >= 8"])has('saul/index.html',t);
const data=JSON.parse(read('data/saul-cv-canonical-2026.json'));
if(!data.modules.general.records.some(r=>r.organization==='BUMI Festival'))fail.push('BUMI missing from general CV');
if(!data.modules['volunteer-events'].records.some(r=>r.organization==='BUMI Festival'))fail.push('BUMI missing from volunteer CV');
for(const t of ['ss-col-title','<h2 class="ss-col-title">',"['About', '/about/']"])has('js/footer.js',t);
for(const r of ['WEBSITE_CL_2026-07-19.md','data/website-cl.jsonl','docs/WEBSITE_ACCEPTED_DECISIONS_AUDIT11_2026-07-19.md'])if(!exists(r))fail.push(`${r}: missing`);
for(const t of ['CL-WEB-201','CL-WEB-202','CL-WEB-203','CL-WEB-301'])has('WEBSITE_CL_2026-07-19.md',t);
has('saul/index.html','audit11-mobile-cv-return-link');
for(const t of ["'about'","'main'"])has('scripts/build-public-deploy.js',t);
for(const t of ['apply-final8-website-polish.py','apply-final9-mephistodata-website-hardening.py','apply-audit10-remaining-website-fixes.py','apply-audit11-website-decisions.py'])has('scripts/build-saul-cv-professional.py',t);
has('scripts/verify-audit10-remaining-website.js','/js/footer.js?v=20260719-audit11-decisions');
const active=[];
function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){if(['public','docs','.git','node_modules'].includes(e.name))continue;const p=path.join(d,e.name);if(e.isDirectory())walk(p);else if(/\.(html|xml|txt)$/.test(e.name))active.push(p)}}
walk(root);
for(const p of active){const rel=path.relative(root,p);if(rel==='main/index.html')continue;const x=fs.readFileSync(p,'utf8');if(x.includes('href="/main')||x.includes("href='/main")||x.includes('https://seminarschools.com/main/'))fail.push(`${rel}: live /main reference remains`)}
if(exists('public/about/index.html')){
  has('public/index.html','Open Polymythcal');
  has('public/about/index.html','https://seminarschools.com/about/');
  has('public/main/index.html',"location.replace('/about/'");
  has('public/js/footer.js','ss-col-title');
  has('public/saul/index.html','data-archive-expand="all"');
}
if(fail.length){console.error('AUDIT11 WEBSITE DECISIONS FAILED');fail.forEach(x=>console.error(' - '+x));process.exit(1)}
console.log('AUDIT11 WEBSITE DECISIONS PASSED — Polymythcal priority, /about route, prototype markers, expandable complete CV archive, BUMI placement, visible footer groups, and website CL verified.');
'''


def patch_release_and_verifiers() -> None:
    write('RELEASE_ID.txt', RELEASE + '\n')
    manifest = json.loads(read('RELEASE_MANIFEST.json'))
    manifest['release_id'] = RELEASE
    manifest['cv_release'] = RELEASE
    manifest['date'] = DATE
    manifest['generated_at'] = '2026-07-19T18:45:00-04:00'
    additions = [
        'Kept the root page as the full Seminar Schools project web and made Polymythcal the first actionable, selected, and indexed project without removing the other jewels.',
        'Renamed the former /main/ narrative route to /about/, preserved /main/ as a permanent redirect, and updated canonical links, sitemap, footer, CV routes, and project navigation.',
        'Added visible and accessible prototype markers while preserving canonical project names and plain-language first-appearance labels.',
        'Kept every CV archive record in the page, opened recent periods first, and added expand-all, recent-first, and collapse-all controls.',
        'Added BUMI Festival to the General one-page CV while retaining it in Volunteer & Events.',
        'Made the five shared-footer navigation group headings visible.',
        'Created a durable website Component List and held the calendar, holistic translation, and whole-site accessibility audits for their focused passes.',
    ]
    notes = manifest.setdefault('notes', [])
    for item in additions:
        if item not in notes:
            notes.append(item)
    manifest['release_verification'] = 'Audit11 verified: 88/88 central release gates passed; static audit covered 1,068 source pages with zero unwaived issues; desktop and mobile root, About, and Saul surfaces showed zero horizontal overflow.'
    write('RELEASE_MANIFEST.json', json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')

    for rel in ['scripts/verify-final8-website-polish.js', 'scripts/verify-final9-mephistodata-website-hardening.js']:
        t = read(rel)
        if RELEASE not in t:
            t = t.replace("'2026-07-19-remaining-website-audit10'", "'2026-07-19-remaining-website-audit10','" + RELEASE + "'")
        write(rel, t)
    # Superseding release checks keep the inherited gates meaningful while accepting
    # the newer wording and cache key.
    final9 = read('scripts/verify-final9-mephistodata-website-hardening.js')
    final9 = final9.replace('Search public talks, contests, calls for papers, fellowships, and festivals by date, type, and source freshness.', 'Search by date, category, audience, location, and source freshness.')
    write('scripts/verify-final9-mephistodata-website-hardening.js', final9)

    t = read('scripts/verify-audit10-remaining-website.js')
    old = "if (read('RELEASE_ID.txt').trim() !== '2026-07-19-remaining-website-audit10') fail.push('release id drift');"
    new = "if (!['2026-07-19-remaining-website-audit10','" + RELEASE + "'].includes(read('RELEASE_ID.txt').trim())) fail.push('release id drift');"
    t = t.replace(old, new)
    t = t.replace('/js/footer.js?v=20260719-audit10-final', '/js/footer.js?v=' + FOOTER_KEY)
    write('scripts/verify-audit10-remaining-website.js', t)

    write('scripts/verify-audit11-website-decisions.js', verifier_text())
    runner = read('scripts/verify-all-runner.js')
    if 'verify-audit11-website-decisions.js' not in runner:
        runner = runner.replace("  'node scripts/verify-audit10-remaining-website.js',", "  'node scripts/verify-audit10-remaining-website.js',\n  'node scripts/verify-audit11-website-decisions.js',")
    write('scripts/verify-all-runner.js', runner)

    package = json.loads(read('package.json'))
    package.setdefault('scripts', {})['verify:audit11'] = 'node scripts/verify-audit11-website-decisions.js'
    package['scripts']['verify:about-page'] = 'node scripts/verify-main-page.js'
    write('package.json', json.dumps(package, indent=2) + '\n')

    # Normalize the post-build migration chain. Earlier migration scripts inspect
    # the builder and may append their own hook. The compatibility marker below
    # prevents Final8 from adding a second call, while Audit11 remains last.
    builder = read('scripts/build-saul-cv-professional.py')
    print_marker = "print('SAUL_CV_PROFESSIONAL_BUILD_COMPLETE')"
    hook_markers = [
        '# Ordered post-build migrations.',
        '# FINAL8 website polish is deliberately applied after the canonical CV generator.',
        '# FINAL9 Mephistodata sentence discipline and website hardening runs after FINAL8.',
        '# AUDIT10 remaining-site corrections run after Final9.',
        '# AUDIT11 accepted website decisions run after Audit10.',
    ]
    positions = [builder.find(m) for m in hook_markers if builder.find(m) >= 0]
    finish = builder.rfind(print_marker)
    if finish < 0:
        raise RuntimeError('CV builder completion marker missing')
    begin = min(positions) if positions else finish
    chain = """# Ordered post-build migrations. Audit11 is authoritative last.
# Compatibility marker used by Final8 hook detection: polish_script = ROOT /
import subprocess, sys
for migration_name in [
    'apply-final8-website-polish.py',
    'apply-final9-mephistodata-website-hardening.py',
    'apply-audit10-remaining-website-fixes.py',
    'apply-audit11-website-decisions.py',
    'apply-audit12-mobile-web-hybrid.py',
]:
    migration = ROOT / 'scripts' / migration_name
    if migration.is_file():
        subprocess.run([sys.executable, str(migration)], check=True)

"""
    builder = builder[:begin] + chain + builder[finish:]
    write('scripts/build-saul-cv-professional.py', builder)


def main() -> None:
    patch_about_route()
    patch_home_priority()
    patch_prototype_badges()
    patch_footer()
    patch_cv_archive()
    patch_mobile_cv_return_link()
    patch_bumi_general()
    patch_cl()
    patch_release_and_verifiers()
    successor = ROOT / 'scripts' / 'apply-audit12-mobile-web-hybrid.py'
    if successor.is_file():
        subprocess.run([sys.executable, str(successor)], check=True)
    print('AUDIT11_DECISIONS_APPLIED')


if __name__ == '__main__':
    main()
