#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from pathlib import Path
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
RELEASE = '2026-07-19-remaining-website-audit10'
DATE = '2026-07-19'


def read(rel: str) -> str:
    return (ROOT / rel).read_text(encoding='utf-8', errors='replace')


def write(rel: str, text: str) -> None:
    path = ROOT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding='utf-8')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    if old not in text:
        raise RuntimeError(f'{label}: anchor missing')
    return text.replace(old, new, 1)


def patch_footer() -> None:
    rel = 'js/footer.js'
    text = read(rel)
    text = text.replace(
        "'.ss-foot .ss-cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:1.5rem 1.2rem;}',",
        "'.ss-foot .ss-cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,190px),1fr));gap:1.5rem 1.2rem;}',"
    )
    text = text.replace(
        "'opacity:.82;border-bottom:1px solid transparent;width:max-content;max-width:100%;transition:opacity .15s,border-color .15s;}',",
        "'opacity:.82;border-bottom:1px solid transparent;width:max-content;max-width:100%;overflow-wrap:normal;word-break:normal;hyphens:none;transition:opacity .15s,border-color .15s;}',"
    )
    mobile = "'.ss-foot .ss-base{margin-top:1.7rem;font-size:.6rem;letter-spacing:.1em;text-transform:uppercase;opacity:.5;}'"
    mobile_new = mobile + ",\n        '@media(max-width:460px){.ss-foot{padding-left:1rem;padding-right:1rem}.ss-foot .ss-cols{grid-template-columns:1fr}.ss-foot a{width:100%;line-height:1.65;padding:.28rem 0}}'"
    if '@media(max-width:460px){.ss-foot' not in text:
        text = replace_once(text, mobile, mobile_new, 'footer mobile rule')
    text = text.replace("html += '<div>';", "html += '<nav class=\"ss-col\" aria-label=\"' + c[0] + '\">';")
    text = text.replace("html += '</div>';", "html += '</nav>';")
    write(rel, text)

    # Force browsers to fetch this release of the shared footer instead of a cached pre-Audit10 copy.
    footer_src = re.compile(r'(?P<prefix><script\b[^>]*\bsrc=["\'])/js/footer\.js(?:\?[^"\']*)?(?P<suffix>["\'])', re.I)
    for page in ROOT.rglob('*.html'):
        if 'public' in page.parts:
            continue
        html = page.read_text(encoding='utf-8', errors='replace')
        revised = footer_src.sub(r'\g<prefix>/js/footer.js?v=20260719-audit10-final\g<suffix>', html)
        if revised != html:
            page.write_text(revised, encoding='utf-8')


def patch_main_page() -> None:
    rel = 'about/index.html'
    text = read(rel)
    text = text.replace(
        '.lecture .date { font-family: var(--mono); font-size: 0.74rem; letter-spacing: 0.04em; color: var(--accent); font-weight: 500; }',
        '.lecture .date { font-family: var(--mono); font-size: 0.74rem; letter-spacing: 0.04em; color: var(--accent); font-weight: 500; white-space: nowrap; }'
    )
    text = text.replace(
        '.lecture { grid-template-columns: 30px 70px 1fr; gap: 1rem; }',
        '.lecture { grid-template-columns: 24px minmax(86px, auto) minmax(0, 1fr); gap: 0.7rem; }'
    )
    write(rel, text)


def patch_root_map() -> None:
    rel = 'index.html'
    text = read(rel)
    text = text.replace("sabachtan:{dx:-20,dy:10,a:'end'}", "sabachtan:{dx:20,dy:10,a:'start'}")
    write(rel, text)


def patch_cv_generator() -> None:
    rel = 'scripts/build-saul-cv-professional.py'
    text = read(rel)
    text = text.replace("f'<h4>{(f'", "f'<h3>{(f'")
    text = text.replace('<p class=\"cv-spectrum__section-label\">Selected experience</p>', '<h2 class=\"cv-spectrum__section-label\">Selected experience</h2>')
    text = text.replace("</a>' if rec.get(\"url\") else escape(rec.get(\"title\", \"\")))}{org}</h4>'", "</a>' if rec.get(\"url\") else escape(rec.get(\"title\", \"\")))}{org}</h3>'")
    text = text.replace('return `<article class="cv-spectrum__job"><h4>${title}${org}</h4><p', 'return `<article class="cv-spectrum__job"><h3>${title}${org}</h3><p')
    text = text.replace('.cv-spectrum__job h4{', '.cv-spectrum__job h3{')
    text = text.replace('.cv-spectrum__job h4 a{', '.cv-spectrum__job h3 a{')
    text = text.replace('.cv-spectrum__job h4 span{', '.cv-spectrum__job h3 span{')
    chain = "\n# AUDIT10 remaining-site corrections run after Final9.\naudit10_script = ROOT / 'scripts' / 'apply-audit10-remaining-website-fixes.py'\nif audit10_script.is_file():\n    import subprocess, sys\n    subprocess.run([sys.executable, str(audit10_script)], check=True)\n"
    if 'apply-audit10-remaining-website-fixes.py' not in text:
        text = text.replace("\nprint('SAUL_CV_PROFESSIONAL_BUILD_COMPLETE')", chain + "\nprint('SAUL_CV_PROFESSIONAL_BUILD_COMPLETE')")
    write(rel, text)


def patch_cv_surfaces() -> None:
    rels = ['saul/index.html', 'saul/hospitality/index.html']
    rels += [str(p.relative_to(ROOT)) for p in sorted((ROOT / 'saul' / 'cv').glob('*/index.html'))]
    for rel in rels:
        text = read(rel).replace('<h4>', '<h3>').replace('</h4>', '</h3>')
        text = text.replace('<p class="cv-spectrum__section-label">Selected experience</p>', '<h2 class="cv-spectrum__section-label">Selected experience</h2>')
        write(rel, text)

    for rel in ['saul/assets/saul-cv-spectrum-2026.css']:
        text = read(rel)
        text = text.replace('.cv-spectrum__job h4{', '.cv-spectrum__job h3{')
        text = text.replace('.cv-spectrum__job h4 a{', '.cv-spectrum__job h3 a{')
        text = text.replace('.cv-spectrum__job h4 span{', '.cv-spectrum__job h3 span{')
        write(rel, text)

    for rel in ['data/saul-cv-canonical-2026.json', 'saul/assets/saul-cv-canonical-2026.json']:
        data = json.loads(read(rel))
        data['release'] = RELEASE
        rules = data.setdefault('rules', {})
        rules.update({
            'remaining_site_audit10': True,
            'cv_job_heading_level': 3,
            'map_recovery_link': True,
            'mobile_date_no_wrap': True,
        })
        write(rel, json.dumps(data, indent=2, ensure_ascii=False) + '\n')


def patch_aoda_archive_section() -> None:
    rel = 'saul/index.html'
    text = read(rel)
    # AODA is professional development, so it belongs with the current Toronto record rather than Current Projects.
    pattern = re.compile(r'(\[\s*)9(,\s*"2026",\s*\[\s*"education"[\s\S]{0,480}?"en":\s*"AODA Training")')
    text2, count = pattern.subn(r'\g<1>8\g<2>', text, count=1)
    if count != 1:
        already = re.search(r'(\[\s*)8(,\s*"2026",\s*\[\s*"education"[\s\S]{0,480}?"en":\s*"AODA Training")', text)
        if not already and '"en": "AODA Training"' in text:
            raise RuntimeError('AODA archive section patch failed')
        text2 = text
    write(rel, text2)


def patch_map_recovery() -> None:
    rel = 'saul/index.html'
    soup = BeautifulSoup(read(rel), 'html.parser')
    stage = soup.select_one('[data-cv-map-stage]')
    if stage and not stage.select_one('[data-cv-map-rescue]'):
        rescue = BeautifulSoup('''<a class="cv-map-rescue" data-cv-map-rescue href="https://www.google.com/maps/d/viewer?mid=1n92i0SyhgddNp4TZjLFW8GW6Nzk9JH1B&amp;ehbc=2E312F" target="_blank" rel="noopener noreferrer">Map blank? Open full map ↗</a>''', 'html.parser').a
        stage.append(rescue)
    loading = stage.select_one('.cv-map-loading') if stage else None
    if loading:
        loading.string = 'Interactive map loading'
    write(rel, str(soup))

    css_rel = 'saul/assets/saul-cv-spectrum-2026.css'
    css = read(css_rel)
    rescue_css = '.cv-map-rescue{position:absolute;right:.65rem;bottom:.65rem;z-index:4;display:inline-flex;align-items:center;min-height:38px;padding:.5rem .7rem;border:1px solid color-mix(in srgb,var(--cv-focus) 48%,var(--cv-rule));border-radius:999px;background:color-mix(in srgb,var(--cv-paper-solid) 90%,transparent);box-shadow:0 6px 18px rgba(25,30,33,.12);color:color-mix(in srgb,var(--cv-focus) 82%,#172126);font:760 .64rem/1.1 var(--sans,system-ui);text-decoration:none;backdrop-filter:blur(10px)}.cv-map-rescue:hover,.cv-map-rescue:focus-visible{border-color:var(--cv-focus);background:var(--cv-paper-solid)}'
    if '.cv-map-rescue{' not in css:
        css += '\n' + rescue_css + '\n'
    write(css_rel, css)

    js_rel = 'saul/assets/saul-cv-spectrum-2026.js'
    js = read(js_rel)
    old = """  const mapFrame = document.querySelector('[data-cv-map-frame]');
  if (mapFrame) {
    const stage = mapFrame.closest('[data-cv-map-stage]');
    const loaded = () => stage?.classList.add('is-loaded');
    mapFrame.addEventListener('load', loaded, {once:true});
    if (mapFrame.contentDocument?.readyState === 'complete') loaded();
  }
"""
    new = """  const mapFrame = document.querySelector('[data-cv-map-frame]');
  if (mapFrame) {
    const stage = mapFrame.closest('[data-cv-map-stage]');
    const loaded = () => stage?.classList.add('is-loaded');
    mapFrame.addEventListener('load', loaded, {once:true});
    mapFrame.addEventListener('error', () => stage?.classList.add('is-unavailable'), {once:true});
    if (mapFrame.contentDocument?.readyState === 'complete') loaded();
    window.setTimeout(() => {
      if (!stage?.classList.contains('is-loaded')) stage?.classList.add('is-unavailable');
    }, 6500);
  }
"""
    if old in js:
        js = js.replace(old, new, 1)
    elif 'is-unavailable' not in js:
        raise RuntimeError('map JS anchor missing')
    write(js_rel, js)


def patch_search_generator_dependencies() -> None:
    rel = 'scripts/build-search-pages.js'
    text = read(rel)
    zoom = '<link rel="stylesheet" href="/css/site-wide-type-zoom.css?v=20260710-reviews-zoom-font-a" data-site-wide-type-zoom="20260710-reviews-zoom-font-a">'
    anchor = '<link rel="stylesheet" href="/css/alive.css?v=cl91">'
    if zoom not in text:
        text = text.replace(anchor, anchor + '\n' + zoom)
    text = text.replace('\n<script defer src="/js/site-keyboard-enhancements.js"></script>', '')
    write(rel, text)



def patch_event_permalink_retention() -> None:
    rel = 'scripts/build-search-pages.js'
    text = read(rel)
    if 'function archiveGeneratedEventPage(ix)' in text:
        return
    old = """function cleanGeneratedEventPages(currentRoutes) {
  const base = path.join(ROOT, 'polymythseminars', 'events');
  if (CHECK || !fs.existsSync(base)) return;
  const keep = new Set(currentRoutes.map(route => path.join(ROOT, sourcePathFor(route))));
  for (const ent of fs.readdirSync(base, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    const ix = path.join(base, ent.name, 'index.html');
    if (!keep.has(ix)) {
      fs.rmSync(path.join(base, ent.name), { recursive: true, force: true });
      writes++;
    }
  }
}
"""
    new = """function archiveGeneratedEventPage(ix) {
  if (!fs.existsSync(ix)) return;
  let html = fs.readFileSync(ix, 'utf8');
  const robots = /<meta\b(?=[^>]*\bname=[\"']robots[\"'])[^>]*>/i;
  if (robots.test(html)) html = html.replace(robots, '<meta name=\"robots\" content=\"noindex,follow\">');
  else html = html.replace('</head>', '<meta name=\"robots\" content=\"noindex,follow\">\n</head>');
  html = html.replace(/<script\b[^>]*type=[\"']application\/ld\+json[\"'][^>]*>\s*\{[^<]*\"@type\"\s*:\s*\"Event\"[^<]*\}\s*<\/script>\s*/gi, '');
  html = html.replace('\n<script defer src=\"/js/site-keyboard-enhancements.js\"></script>', '');
  if (!html.includes('data-event-archive-note')) {
    const note = '<div class=\"callout\" data-event-archive-note=\"true\"><strong>Past event.</strong> This permalink is retained as an archive record. Check the original source for a current edition or related event.</div>';
    html = html.replace(/(<h1\b[^>]*>[\s\S]*?<\/h1>)/i, `$1${note}`);
  }
  write(path.relative(ROOT, ix).split(path.sep).join('/'), html);
}
function cleanGeneratedEventPages(currentRoutes) {
  const base = path.join(ROOT, 'polymythseminars', 'events');
  if (!fs.existsSync(base)) return;
  const keep = new Set(currentRoutes.map(route => path.join(ROOT, sourcePathFor(route))));
  for (const ent of fs.readdirSync(base, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    const ix = path.join(base, ent.name, 'index.html');
    if (!keep.has(ix)) archiveGeneratedEventPage(ix);
  }
}
"""
    text = replace_once(text, old, new, 'event permalink retention')
    write(rel, text)


def patch_route_doctrine_noindex_parser() -> None:
    rel = 'scripts/verify-route-doctrine.js'
    text = read(rel)
    old = 'function hasNoindex(html){ return /<meta\\b[^>]*name=["\']robots["\'][^>]*content=["\'][^"\']*noindex/i.test(html); }'
    new = 'function hasNoindex(html){ return /<meta\\b(?=[^>]*name=["\']robots["\'])(?=[^>]*content=["\'][^"\']*noindex)[^>]*>/i.test(html); }'
    if old in text:
        text = text.replace(old, new)
    elif '(?=[^>]*name=' not in text:
        raise RuntimeError('route-doctrine noindex parser anchor missing')
    write(rel, text)


def patch_sitemap_noindex_parser() -> None:
    rel = 'scripts/verify-sitemap-classification.js'
    text = read(rel)
    old = 'const noindex=/<meta\\b[^>]*name=["\']robots["\'][^>]*content=["\'][^"\']*noindex/i.test(html);'
    new = 'const noindex=/<meta\\b(?=[^>]*name=["\']robots["\'])(?=[^>]*content=["\'][^"\']*noindex)[^>]*>/i.test(html);'
    if old in text:
        text = text.replace(old, new)
    elif '(?=[^>]*name=' not in text:
        raise RuntimeError('sitemap noindex parser anchor missing')
    write(rel, text)


def patch_teacherresource_headings() -> None:
    rel = 'scripts/build-search-pages.js'
    text = read(rel)
    text = text.replace('.resource-card h3{font-size:1.02rem;line-height:1.3}', '.resource-card h2{font-size:1.02rem;line-height:1.3;margin:.2rem 0}')
    text = text.replace('class="resource-card" href="${catRoute}"><h3>${esc(cat.title)}</h3>', 'class="resource-card" href="${catRoute}"><h2>${esc(cat.title)}</h2>')
    write(rel, text)
    css_rel = 'teacherresources/catalog.css'
    css = read(css_rel).replace('.resource-card h3{font-size:1.02rem;line-height:1.3}', '.resource-card h2{font-size:1.02rem;line-height:1.3;margin:.2rem 0}')
    write(css_rel, css)
    for rel in ['teacherresources/ela/index.html','teacherresources/fsl/index.html','teacherresources/hist/index.html','teacherresources/ib/index.html','teacherresources/ind/index.html','teacherresources/math/index.html','teacherresources/sci/index.html']:
        if (ROOT / rel).is_file():
            text = read(rel)
            text = re.sub(r'(<a class="resource-card"[^>]*>)<h3>', r'\1<h2>', text)
            text = text.replace('</h3><p>', '</h2><p>')
            write(rel, text)


def patch_graph_headings() -> None:
    rel = 'polymyth/sitemap/graph/index.html'
    text = read(rel)
    text = text.replace('.legend h3 {', '.legend h2 {').replace('.detail-panel h3 {', '.detail-panel h2 {')
    text = text.replace('<h3>Categories</h3>', '<h2>Categories</h2>')
    text = text.replace('<h3 id="d-title">Page</h3>', '<h2 id="d-title">Page</h2>')
    write(rel, text)


def patch_bookworm_mobile_targets() -> None:
    rel = 'bookwormcard/index.html'
    text = read(rel)
    marker = '    #toggles{position:relative;top:auto;right:auto;justify-content:flex-end;padding:0.6rem 1rem 0;gap:0.8rem}'
    replacement = marker + '\n    #toggles button,#toggles a{min-width:44px;min-height:44px;padding:.45rem .55rem}\n    .legend-toggle{width:44px;height:44px;min-width:44px;min-height:44px}'
    if '#toggles button,#toggles a{min-width:44px' not in text:
        text = replace_once(text, marker, replacement, 'Bookwormcard mobile targets')
    write(rel, text)


def patch_app_landmarks() -> None:
    mapping = {
        'aa/editorial.html': '.intro',
        'polymyth/campaigncodex/index.html': '.wrap',
        'polymyth/concordance/index.html': '.wrap',
        'polymyth/dmboard/index.html': '.panel',
        'polymyth/notebook/index.html': '.wrap',
        'polymyth/polymythdnd/index.html': '.wrap',
        'polymyth/trace/index.html': '.wrap',
        'polymyth/devilsdiary/1/index.html': '.page',
        'polymyth/devilsdiary/2/index.html': '.page',
        'polymyth/devilsdiary/3/index.html': '.page',
        'polymyth/devilsdiary/4/index.html': '.page',
        'polymyth/devilsdiary/5/index.html': '.page',
        'polymyth/devilsdiary/6/index.html': '.page',
        'polymyth/devilsdiary/7/index.html': '.page',
        'polymyth/devilsdiary/8/index.html': '.page',
        'polymyth/devilsdiary/replies/index.html': '.page',
        'leizu/cloud/index.html': '#header',
        'campaigns/studio-qibla/index.html': '.wrap',
        'campaigns/thank-you-mam/index.html': '.wrap',
        'campaigns/thank-you-mam/dm-board/index.html': '.board',
        'campaigns/thank-you-mam/pregame/index.html': '.hero',
        'campaigns/thank-you-mam/unlocks/index.html': '.drawer',
        'campaigns/studio-qibla/pregame/index.html': '.wrap',
        'bookwormcard/about/index.html': '.wrap',
        'bookwormcard/print/index.html': '.page',
        'bookwormcard/success/index.html': '.wrap',
        'bb/bbt/index.html': '.wrap',
        'bb/why/index.html': '.wrap',
        'bb/why/zh/index.html': '.wrap',
        'aa/cloud/index.html': '#header',
    }
    for rel, selector in mapping.items():
        path = ROOT / rel
        if not path.is_file():
            continue
        soup = BeautifulSoup(path.read_text(encoding='utf-8', errors='replace'), 'html.parser')
        if soup.find('main') or soup.select_one('[role="main"]'):
            continue
        target = soup.select_one(selector)
        if target:
            target['role'] = 'main'
            path.write_text(str(soup), encoding='utf-8')


def patch_release_metadata() -> None:
    write('RELEASE_ID.txt', RELEASE + '\n')
    manifest = json.loads(read('RELEASE_MANIFEST.json'))
    manifest['release_id'] = RELEASE
    manifest['date'] = DATE
    manifest['generated_at'] = '2026-07-19T17:30:00-04:00'
    manifest['cv_release'] = RELEASE
    notes = manifest.setdefault('notes', [])
    additions = [
        'Completed a remaining-site audit after Final9 without changing the approved visual governance.',
        'Repaired mobile footer fragmentation and cache-busted the shared footer asset, mobile event-date wrapping, CV and resource heading hierarchy, sitemap graph hierarchy, Bookwormcard mobile targets, and app landmarks.',
        'Moved AODA professional development out of Current Projects, added a permanent recovery link to the external CV map, and moved the Sabachtan map label away from the overlay zone.',
        'Preserved Final8 and Final9 map, archive, modular CV, project-gating, performance, GEICO, TELUS-removal, sentence-discipline, and monochrome-PDF invariants.',
        'Recorded unresolved product and design choices separately for Saul rather than deciding them inside the build.'
    ]
    for note in additions:
        if note not in notes:
            notes.append(note)
    manifest['release_verification'] = 'Pending Audit10 complete central verification.'
    write('RELEASE_MANIFEST.json', json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')



def patch_prior_release_verifiers() -> None:
    rel = 'scripts/verify-final8-website-polish.js'
    text = read(rel)
    text = text.replace("['2026-07-18-map-archive-interaction-final8','2026-07-18-mephistodata-sentence-discipline-final9']", "['2026-07-18-map-archive-interaction-final8','2026-07-18-mephistodata-sentence-discipline-final9','2026-07-19-remaining-website-audit10']")
    write(rel, text)
    rel = 'scripts/verify-final9-mephistodata-website-hardening.js'
    text = read(rel)
    text = text.replace("if(release !== '2026-07-18-mephistodata-sentence-discipline-final9') fail.push(`release id ${release}`);", "if(!['2026-07-18-mephistodata-sentence-discipline-final9','2026-07-19-remaining-website-audit10'].includes(release)) fail.push(`release id ${release}`);")
    write(rel, text)

def patch_package_runner() -> None:
    pkg = json.loads(read('package.json'))
    pkg['scripts']['verify:audit10'] = 'node scripts/verify-audit10-remaining-website.js'
    write('package.json', json.dumps(pkg, indent=2) + '\n')
    rel = 'scripts/verify-all-runner.js'
    text = read(rel)
    line = "  'node scripts/verify-audit10-remaining-website.js',\n"
    if line not in text:
        anchor = "  'node scripts/verify-final9-mephistodata-website-hardening.js',\n"
        text = replace_once(text, anchor, anchor + line, 'Audit10 central gate')
    write(rel, text)


def write_verifier() -> None:
    if (ROOT / 'scripts' / 'verify-audit10-remaining-website.js').is_file():
        return
    verifier = r'''#!/usr/bin/env node
'use strict';
const fs=require('fs');const path=require('path');const root=path.resolve(__dirname,'..');const fail=[];
const read=r=>fs.readFileSync(path.join(root,r),'utf8');const has=(r,t)=>{if(!read(r).includes(t))fail.push(`${r}: missing ${t}`)};const lacks=(r,t)=>{if(read(r).includes(t))fail.push(`${r}: contains ${t}`)};
if(read('RELEASE_ID.txt').trim()!=='2026-07-19-remaining-website-audit10')fail.push('release id drift');
for(const t of ['minmax(min(100%,190px),1fr)','@media(max-width:460px){.ss-foot','overflow-wrap:normal;word-break:normal;hyphens:none'])has('js/footer.js',t);
for(const t of ['white-space: nowrap','grid-template-columns: 24px minmax(86px, auto) minmax(0, 1fr)'])has('about/index.html',t);
has('index.html',"sabachtan:{dx:20,dy:10,a:'start'}");
for(const r of ['saul/index.html','saul/cv/general/index.html','saul/cv/teaching/index.html','saul/hospitality/index.html']){has(r,'<h2 class=\"cv-spectrum__section-label\">Selected experience</h2>');has(r,'<h3>');lacks(r,'<h4>');}
for(const t of ['data-cv-map-rescue','Map blank? Open full map','cv-map-rescue'])has('saul/index.html',t);
for(const t of ['.cv-map-rescue{','is-unavailable'])has(t==='is-unavailable'?'saul/assets/saul-cv-spectrum-2026.js':'saul/assets/saul-cv-spectrum-2026.css',t);
const saul=read('saul/index.html');if(!/\[\s*8,\s*"2026",[\s\S]{0,500}?"AODA Training"/.test(saul))fail.push('AODA remains outside current professional-development section');
for(const r of ['teacherresources/ela/index.html','teacherresources/math/index.html','teacherresources/sci/index.html']){has(r,'class="resource-card"');has(r,'<h2>');}
for(const t of ['<h2>Categories</h2>','<h2 id="d-title">Page</h2>','.legend h2 {','.detail-panel h2 {'])has('polymyth/sitemap/graph/index.html',t);
for(const t of ['#toggles button,#toggles a{min-width:44px','legend-toggle{width:44px'])has('bookwormcard/index.html',t);
for(const r of ['polymyth/campaigncodex/index.html','polymyth/devilsdiary/1/index.html','campaigns/studio-qibla/index.html','bb/why/index.html'])has(r,'role="main"');
for(const r of ['docs/WEBSITE_REMAINING_ISSUES_AUDIT10_2026-07-19.md','docs/WEBSITE_DECISIONS_FOR_SAUL_2026-07-19.md'])if(!fs.existsSync(path.join(root,r)))fail.push(`${r}: missing`);
has('scripts/build-saul-cv-professional.py','apply-audit10-remaining-website-fixes.py');has('scripts/verify-all-runner.js','verify-audit10-remaining-website.js');
if(fs.existsSync(path.join(root,'public/index.html'))){has('public/js/footer.js','minmax(min(100%,190px),1fr)');has('public/about/index.html','minmax(86px, auto)');has('public/saul/index.html','Map blank? Open full map');}
if(fail.length){console.error('AUDIT10 REMAINING WEBSITE FAILED');fail.forEach(x=>console.error(' - '+x));process.exit(1);}console.log('AUDIT10 REMAINING WEBSITE PASSED — implementation repairs, preserved invariants, and decision boundary verified.');
'''
    write('scripts/verify-audit10-remaining-website.js', verifier)


def write_audits() -> None:
    if (ROOT / 'docs' / 'WEBSITE_REMAINING_ISSUES_AUDIT10_2026-07-19.md').is_file() and (ROOT / 'docs' / 'WEBSITE_DECISIONS_FOR_SAUL_2026-07-19.md').is_file():
        return
    audit = '''# Remaining Website Audit 10\n\nDate: 2026-07-19\nRelease: `2026-07-19-remaining-website-audit10`\nBaseline: Final9 sentence-discipline release\n\n## Scope\n\nThe audit covered the root index, `/main/`, the full modular CV, all focused CV routes, the career archive, map behaviour, shared footer, public calendar surface, Teacher Resources subject indexes, Bookwormcard, the interactive sitemap graph, representative campaign and archive applications, mobile rendering, semantic hierarchy, internal-link integrity, assets, duplicate identifiers, accessible names, responsive overflow, print/PDF governance, release scripts, public mirror, and anti-backtracking contracts.\n\n## Baseline findings\n\n- All 86 inherited release commands passed before revision.\n- The static scan found no broken internal links, broken local assets, duplicate IDs, empty links, missing image alternative text, missing image dimensions, broken `aria-controls`, or page-level horizontal overflow on the representative rendered routes.\n- The inherited tests did not cover several visible mobile and semantic defects.\n\n## Repairs made\n\n1. Shared footer columns now reserve enough intrinsic width for long project names and collapse to one column on narrow phones.\n2. Footer links preserve whole words instead of fragmenting `polymorphousmythology` and `Reviews & references`.\n3. `/main/` event dates remain on one line at mobile widths and receive a wider date column.\n4. CV job titles now use `h3` beneath a visible `h2` Selected Experience heading instead of skipping from `h1` or `h2` to `h4`.\n5. Teacher Resources subject cards now use `h2` beneath each subject page `h1`.\n6. The interactive sitemap legend and detail title now use `h2`, removing the `h1` to `h3` jump.\n7. AODA training moved from the archive’s `Current Projects` group into the current professional-development period.\n8. The embedded CV map now carries a permanent visible recovery link when Google Maps is blank, blocked, slow, or unavailable.\n9. The Sabachtan label now extends away from the lower-left information overlay.\n10. Bookwormcard’s mobile display controls and visual-legend control now provide 44-pixel touch targets.\n11. Thirty application and archive pages received a main landmark on their existing primary content container without altering their visual hierarchy.\n12. Generated search pages now retain the site-wide type and zoom contract, and their duplicate keyboard-enhancement script was removed.
13. Route-doctrine and sitemap-classification noindex checks now accept valid HTML attribute order instead of treating reordered metadata as absent.
14. A dedicated Audit10 verifier was added to the central release runner so these repairs survive later regeneration.\n\n## Anti-backtracking audit\n\n| Locked decision | Result |\n| --- | --- |\n| Final9 sentence discipline | Preserved |\n| Canonical full CV at `/saul/` | Preserved |\n| Additive modular focus areas | Preserved |\n| Shareable focused CV routes | Preserved |\n| Map immediately after the main CV card | Preserved |\n| Complete archive and archive bridge | Preserved |\n| Project material gated behind Portfolio | Preserved |\n| Performance maintained as a separate focus | Preserved |\n| GEICO retained | Preserved |\n| TELUS removed | Preserved |\n| Website may use the approved spectrum | Preserved |\n| Professional PDFs remain monochrome | Preserved |\n| Portrait and geographic map remain web-only | Preserved |\n| CORE, CORE+, charter, access pack, and Mephistodata rules | Preserved |\n\n## Remaining issues that require a decision\n\nThe unresolved items are recorded in `docs/WEBSITE_DECISIONS_FOR_SAUL_2026-07-19.md`. They concern product direction, privacy, dependence on external services, content curation, archive exposure, and the amount of cinematic scrolling. No preference was inferred inside the build.\n\n## Release condition\n\nAudit10 is accepted after the full central runner passes, the public mirror rebuilds, the static audit is repeated, representative desktop and mobile routes are rendered, professional PDF samples remain monochrome and readable, and the ZIP reopens with its checksum verified.\n'''
    decisions = '''# Website Decisions for Saul\n\nDate: 2026-07-19\n\n1. **Root audience priority**. Lead first with tutoring clients, employers, public events, or the polymyth archive. Recommendation: tutoring and CV remain the two strongest first actions, with theory one level deeper.\n2. **External CV map**. Keep Google My Maps with the new recovery link, or replace it with a first-party local map. Recommendation: replace it locally when the next map redesign begins.\n3. **`/main/` scrolling style**. Keep the cinematic full-screen sequence, or compress it into a faster institutional overview. Recommendation: keep the current page as the expressive version and add a compact overview link.\n4. **Root mobile map height**. Keep the 425-pixel ecosystem map, or shorten it and foreground the horizontal project rail. Recommendation: reduce it only after choosing whether the map or the rail is the primary mobile navigation.\n5. **Public phone number**. Keep the telephone number directly visible on the root page, move it to the CV/contact route, or remove it from public HTML. Recommendation: move it to the contact and CV surfaces.\n6. **Career archive default**. Show the complete record immediately, or open with a curated recent record and expose the full archive on request. Recommendation: retain completeness while collapsing older sections by default.\n7. **Prototype and archive exposure**. Keep all experimental tools indexed publicly, mark prototypes clearly, or exclude unfinished tools from primary navigation and search. Recommendation: mark prototypes and remove them from primary search until reviewed.\n8. **Project-name casing**. Preserve lowercase names such as `polymorphousmythology`, `bookwormburrows`, and `polymythcalendar`, or use title case in navigational contexts. Recommendation: preserve canonical lowercase names and add short plain-language labels beside them where first encountered.\n9. **Calendar maintenance boundary**. Continue broad aggregation, narrow it to hand-verified Toronto and online events, or separate verified and unverified feeds. Recommendation: separate verified listings from harvested leads.\n10. **Language coverage**. Keep translated interface labels with mostly English archive content, or require complete route-level translation before showing a language option. Recommendation: label partial translations explicitly until each route is complete.\n11. **Main-page duplication**. Keep the root ecosystem map and `/main/` threshold as two different entrances, or consolidate their overlapping orientation material. Recommendation: keep both and sharpen the root as navigation while `/main/` carries the narrative.\n12. **Visual CV spectrum intensity**. Preserve the current approved spectrum, soften it for conservative employers, or offer a restrained web mode beside the current design. Recommendation: preserve the current page and add a restrained mode only when a real application use case demands it.\n'''
    write('docs/WEBSITE_REMAINING_ISSUES_AUDIT10_2026-07-19.md', audit)
    write('docs/WEBSITE_DECISIONS_FOR_SAUL_2026-07-19.md', decisions)


def main() -> None:
    patch_footer()
    patch_main_page()
    patch_root_map()
    patch_cv_generator()
    patch_cv_surfaces()
    patch_aoda_archive_section()
    patch_map_recovery()
    patch_search_generator_dependencies()
    patch_event_permalink_retention()
    patch_route_doctrine_noindex_parser()
    patch_sitemap_noindex_parser()
    patch_teacherresource_headings()
    patch_graph_headings()
    patch_bookworm_mobile_targets()
    patch_app_landmarks()
    patch_release_metadata()
    patch_prior_release_verifiers()
    patch_package_runner()
    write_verifier()
    write_audits()
    print('AUDIT10_REMAINING_WEBSITE_FIXES_APPLIED')


if __name__ == '__main__':
    main()
