#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import re
import shutil
import zipfile
from collections import OrderedDict
from html import escape
from pathlib import Path

from bs4 import BeautifulSoup
from pypdf import PdfReader
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import KeepTogether, PageBreak, Paragraph, SimpleDocTemplate, Spacer


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument('--root', type=Path, default=None)
    return p.parse_args()


args = parse_args()
ROOT = args.root.resolve() if args.root else Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / 'data' / 'saul-cv-canonical-2026.json'
if not DATA_PATH.is_file():
    raise SystemExit(f'Missing canonical CV data: {DATA_PATH}')

canonical = json.loads(DATA_PATH.read_text(encoding='utf-8'))
contact = canonical['contact']
modules = OrderedDict(canonical['modules'])
training = canonical.get('training', [])
languages = canonical.get('languages', [])
education = canonical.get('education', [])

canonical['release'] = '2026-07-16-spirit-professional-interactivity-r4'
canonical['rules'].update({
    'visual_first': True,
    'same_modular_card_every_route': True,
    'website_mild_spectrum': True,
    'pdf_professional_monochrome': True,
    'pdf_rainbow': False,
    'pdf_geometry': False,
    'primary_download': 'professional one-page PDF for the selected focus',
    'combined_view_download': 'professional monochrome browser print from the selected web state',
    'ats_and_text_secondary': True,
})
for p in [DATA_PATH, ROOT / 'saul' / 'assets' / 'saul-cv-canonical-2026.json']:
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(canonical, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')

PRIMARY = ['general', 'hospitality', 'research', 'teaching', 'programs', 'arts-culture', 'portfolio', 'community']
SECONDARY = ['customer-education', 'performance', 'volunteer-events', 'education']


def normal_text(value: str) -> str:
    return str(value).replace('\u2014', '-').replace('\u2013', '-').replace('\u2212', '-').replace('\u00a0', ' ')


def record_recency_key(record: dict) -> tuple[int, int, int]:
    """Stable professional ordering: current work first, then most recent year."""
    dates = normal_text(record.get('dates', '')).lower()
    years = [int(y) for y in re.findall(r'(?<!\d)(?:19|20)\d{2}(?!\d)', dates)]
    return (1 if 'present' in dates else 0, max(years, default=0), min(years, default=0))


def ordered_records(module: dict) -> list[dict]:
    return sorted(module.get('records', []), key=record_recency_key, reverse=True)


def module_records_html(module: dict, count: int = 6) -> str:
    chunks = []
    for rec in ordered_records(module)[:count]:
        org = f' <span>- {escape(rec.get("organization", ""))}</span>' if rec.get('organization') else ''
        meta = ' · '.join(escape(str(x)) for x in [rec.get('location', ''), rec.get('dates', '')] if x)
        bullets = ''.join(f'<li>{escape(str(b))}</li>' for b in rec.get('bullets', [])[:2])
        chunks.append(
            f'<article class="cv-spectrum__job">'
            f'<h4>{escape(rec.get("title", ""))}{org}</h4>'
            f'<p class="cv-spectrum__job-meta">{meta}</p>'
            f'<ul>{bullets}</ul></article>'
        )
    return ''.join(chunks)


def focus_link(slug: str, selected: str) -> str:
    m = modules[slug]
    current = ' aria-current="page"' if slug == selected else ''
    return (
        f'<a class="cv-spectrum__lens" href="{escape(m["route"])}" data-focus-slug="{slug}" '
        f'style="--lens:{m["color"]}"{current}>'
        f'<span aria-hidden="true"></span><strong>{escape(m["short"])}</strong></a>'
    )


def blend_choices(selected: str) -> str:
    out = []
    for slug, m in modules.items():
        if slug == 'general':
            continue
        checked = ' checked' if slug == selected and selected != 'general' else ''
        out.append(
            f'<label class="cv-spectrum__blend-chip" style="--lens:{m["color"]}">'
            f'<input type="checkbox" data-cv-blend value="{slug}"{checked}>'
            f'<span>{escape(m["short"])}</span></label>'
        )
    return ''.join(out)


def card_html(selected: str = 'general', focused_route: bool = False) -> str:
    m = modules[selected]
    name = contact['name']
    credentials = ' · '.join(m.get('credentials', [])[:4] + languages)
    primary_links = ''.join(focus_link(slug, selected) for slug in PRIMARY)
    secondary_links = ''.join(focus_link(slug, selected) for slug in SECONDARY)
    return f'''
<section class="cv-spectrum" data-cv-spectrum data-default-focus="{selected}" data-focused-route="{'true' if focused_route else 'false'}" style="--focus:{m['color']}">
  <div class="cv-spectrum__rainbow" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
  <header class="cv-spectrum__hero">
    <figure class="cv-spectrum__portrait">
      <img src="/img/saul.jpg" width="640" height="640" loading="eager" alt="Portrait of Saul Karim Nassau">
      <figcaption>Toronto · education, research, community programs, hospitality, performance, and independent projects.</figcaption>
    </figure>
    <div class="cv-spectrum__identity">
      <span class="cv-kicker">Curriculum vitae</span>
      <h1 data-cv-name>{escape(name)}<span class="post" data-cv-post></span></h1>
      <p class="cv-spectrum__role" data-cv-role>{escape(m['label'])}</p>
      <p class="cv-lede" data-cv-profile>{escape(m['profile'])}</p>
      <div class="cv-spectrum__contact">
        <a href="tel:+14167710382">{escape(contact['phone'])}</a><span>{escape(contact['location'])}</span>
        <a href="mailto:{escape(contact['email'])}">{escape(contact['email'])}</a>
        <a href="/reviews/">Reviews &amp; references</a>
      </div>
    </div>
  </header>

  <nav class="cv-spectrum__focus" aria-label="Choose a CV focus">
    <div class="cv-spectrum__focus-heading">
      <div><span>Current focus</span><strong data-cv-current>{escape(m['label'])}</strong></div>
      <button type="button" data-cv-copy>Share this view</button>
    </div>
    <div class="cv-spectrum__focus-row">{primary_links}</div>
    <details class="cv-spectrum__more-paths"><summary>More focused views</summary><div>{secondary_links}</div></details>
  </nav>

  <div class="cv-spectrum__preview" aria-live="polite">
    <section class="cv-spectrum__experience">
      <div class="cv-spectrum__experience-head"><p class="cv-spectrum__section-label">Selected experience</p><a href="/saul/#careerArchive">Complete record ↓</a></div>
      <div data-cv-jobs>{module_records_html(m, 5)}</div>
      <div class="cv-spectrum__print-jobs" data-cv-print-jobs aria-hidden="true">{module_records_html(m, 7)}</div>
    </section>
    <aside class="cv-spectrum__skills">
      <p class="cv-spectrum__section-label">Key skills</p>
      <ul data-cv-skills>{''.join(f'<li>{escape(s)}</li>' for s in m['skills'][:10])}</ul>
      <p class="cv-spectrum__section-label">Training &amp; languages</p>
      <p class="cv-spectrum__credentials" data-cv-credentials>{escape(credentials)}</p>
    </aside>
  </div>

  <div class="cv-spectrum__actions">
    <a class="cv-spectrum__primary" data-cv-designed href="{m['downloads']['designed']}">Download professional PDF</a>
    <details class="cv-spectrum__formats"><summary>Other application formats</summary><div>
      <a data-cv-ats data-cv-single-format href="{m['downloads']['ats']}">ATS-safe PDF</a>
      <a data-cv-text data-cv-single-format href="{m['downloads']['text']}">Plain text</a>
      <button type="button" data-cv-print>Print this selected view</button>
      <p class="cv-spectrum__combined-note" data-cv-combined-note hidden>ATS-safe and plain-text downloads are available for single-focus views. This combined view prints exactly as shown.</p>
    </div></details>
  </div>

  <details class="cv-spectrum__tune">
    <summary>Combine focus areas</summary>
    <div class="cv-spectrum__tune-body">
      <p>Select two or more areas to build a combined visual view. The print action uses a professional monochrome layout.</p>
      <fieldset><legend>Focus areas</legend><div class="cv-spectrum__blend">{blend_choices(selected)}</div></fieldset>
    </div>
  </details>
  <p class="cv-spectrum__note">The webpage is the visual record. Downloaded PDFs use a separate professional monochrome design.</p>
</section>
'''


WEB_CSS = r'''
/* Saul visual CV - mild spectrum on web, professional monochrome in print - 2026-07-16 */
:root{
  --cv-paper:rgba(255,253,248,.72);--cv-paper-solid:#fbfaf6;--cv-ink:#182126;--cv-muted:#596166;--cv-rule:rgba(35,43,46,.18);
  --cv-gold:#946A1E;--cv-sky:#347CA5;--cv-green:#478568;--cv-teal:#3F817E;--cv-indigo:#5268A3;--cv-violet:#6D5AA0;--cv-rose:#9A607B;--cv-coral:#A45C51;
}
.cv-spectrum{--focus-ink:color-mix(in srgb,var(--focus) 80%,#172126);position:relative;z-index:4;max-width:1100px;margin:0 auto 2.75rem;border:1px solid var(--cv-rule);border-radius:30px;background:linear-gradient(145deg,rgba(255,255,255,.78),rgba(250,246,239,.58));box-shadow:0 24px 64px rgba(30,34,37,.10);overflow:hidden;backdrop-filter:blur(12px);color:var(--cv-ink)}

body:has(.cv-spectrum){margin:0;overflow-x:hidden}
.page>.cv-spectrum{width:min(1100px,calc(100vw - 2rem));max-width:none;margin-left:50%;transform:translateX(-50%)}
.cv-spectrum__site-link{position:fixed;top:.85rem;right:1rem;z-index:1400;padding:.48rem .68rem;border:1px solid var(--cv-rule);border-radius:999px;background:rgba(255,253,248,.82);backdrop-filter:blur(8px);color:var(--cv-ink);font:750 .64rem/1 var(--sans,system-ui);letter-spacing:.09em;text-transform:uppercase;text-decoration:none;box-shadow:0 6px 18px rgba(20,25,28,.08)}
body:has(.cv-spectrum)>.skip-link{position:fixed;top:.65rem;left:-9999px;z-index:1600;padding:.65rem .8rem;background:#fff;color:#111;border:2px solid #111;border-radius:8px;font:750 .75rem/1 var(--sans,system-ui)}
body:has(.cv-spectrum)>.skip-link:focus{left:1rem}
.cv-spectrum *{box-sizing:border-box}.cv-spectrum a{text-underline-offset:.18em}.cv-spectrum button,.cv-spectrum summary{font:inherit}.cv-spectrum :focus-visible{outline:3px solid color-mix(in srgb,var(--focus) 38%,transparent);outline-offset:3px}
.cv-spectrum__rainbow{display:grid;grid-template-columns:repeat(8,1fr);height:5px}.cv-spectrum__rainbow i:nth-child(1){background:var(--cv-gold)}.cv-spectrum__rainbow i:nth-child(2){background:var(--cv-sky)}.cv-spectrum__rainbow i:nth-child(3){background:var(--cv-green)}.cv-spectrum__rainbow i:nth-child(4){background:var(--cv-teal)}.cv-spectrum__rainbow i:nth-child(5){background:var(--cv-indigo)}.cv-spectrum__rainbow i:nth-child(6){background:var(--cv-violet)}.cv-spectrum__rainbow i:nth-child(7){background:var(--cv-rose)}.cv-spectrum__rainbow i:nth-child(8){background:var(--cv-coral)}
.cv-spectrum__hero{display:grid;grid-template-columns:minmax(175px,235px) minmax(0,1fr);gap:clamp(1.25rem,3.2vw,2.75rem);align-items:center;padding:clamp(1.25rem,3.6vw,2.8rem);margin:0;border:0;text-align:left}
.cv-spectrum__portrait{margin:0;position:relative}.cv-spectrum__portrait img{display:block;width:100%;aspect-ratio:1;object-fit:cover;border-radius:24px;filter:saturate(.88) contrast(1.02);box-shadow:0 14px 34px rgba(26,29,31,.15)}.cv-spectrum__portrait::after{content:"";position:absolute;inset:8px -8px -8px 8px;border:1px solid color-mix(in srgb,var(--focus) 46%,transparent);border-radius:24px;z-index:-1}.cv-spectrum__portrait figcaption{margin-top:.72rem;color:var(--cv-muted);font:500 .67rem/1.45 var(--sans,system-ui);letter-spacing:.025em}
.cv-spectrum__identity .cv-kicker{display:block;color:var(--focus-ink);font:750 .71rem/1 var(--sans,system-ui);letter-spacing:.13em;text-transform:uppercase;margin-bottom:.56rem}.cv-spectrum__identity h1{font-family:var(--serif,Georgia,serif);font-size:clamp(2.45rem,6vw,5.25rem);font-weight:500;letter-spacing:-.042em;line-height:.9;margin:0;max-width:13ch}.cv-spectrum__identity h1 .post{font:750 .22em/1 var(--sans,system-ui);letter-spacing:.11em;color:var(--focus-ink);white-space:nowrap;margin-left:.34em}.cv-spectrum__identity h1 .post:empty{display:none}.cv-spectrum__role{margin:.82rem 0 .35rem;color:var(--focus-ink);font:800 .77rem/1.2 var(--sans,system-ui);letter-spacing:.105em;text-transform:uppercase}.cv-spectrum__identity .cv-lede{max-width:72ch;margin:0;color:var(--cv-muted);font-size:clamp(.91rem,1.15vw,1rem);line-height:1.68}.cv-spectrum__contact{display:flex;flex-wrap:wrap;gap:.34rem 1rem;margin-top:1rem;font:650 .72rem/1.4 var(--sans,system-ui)}.cv-spectrum__contact a{color:inherit;text-decoration:none;border-bottom:1px solid color-mix(in srgb,var(--focus) 42%,transparent)}
.cv-spectrum__focus{padding:.95rem clamp(1.25rem,3.6vw,2.8rem) 1.05rem;border-top:1px solid var(--cv-rule);border-bottom:1px solid var(--cv-rule);background:rgba(255,255,255,.38)}.cv-spectrum__focus-heading{display:flex;align-items:end;justify-content:space-between;gap:1rem;margin-bottom:.72rem}.cv-spectrum__focus-heading span{display:block;color:var(--cv-muted);font:750 .63rem/1 var(--sans,system-ui);letter-spacing:.1em;text-transform:uppercase;margin-bottom:.28rem}.cv-spectrum__focus-heading strong{display:block;font:600 clamp(1rem,2vw,1.25rem)/1.2 var(--serif,Georgia,serif)}.cv-spectrum__focus-heading button{border:0;background:transparent;color:var(--focus-ink);cursor:pointer;font:750 .68rem/1.2 var(--sans,system-ui);text-decoration:underline;text-underline-offset:.2em;padding:.25rem}
.cv-spectrum__focus-row{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.45rem}.cv-spectrum__lens{position:relative;display:flex;align-items:center;gap:.5rem;min-height:42px;padding:.55rem .65rem;border:1px solid var(--cv-rule);border-radius:11px;background:rgba(255,255,255,.35);color:var(--cv-ink);text-decoration:none;min-width:0}.cv-spectrum__lens>span{width:.48rem;height:.48rem;border-radius:50%;background:var(--lens);box-shadow:0 0 0 4px color-mix(in srgb,var(--lens) 10%,transparent);flex:0 0 auto}.cv-spectrum__lens strong{font:650 .74rem/1.15 var(--sans,system-ui);overflow-wrap:anywhere}.cv-spectrum__lens:hover,.cv-spectrum__lens[aria-current="page"]{background:color-mix(in srgb,var(--lens) 8%,white);border-color:color-mix(in srgb,var(--lens) 50%,transparent)}.cv-spectrum__lens[aria-current="page"]{box-shadow:inset 0 -2px 0 var(--lens)}
.cv-spectrum__more-paths{margin-top:.6rem}.cv-spectrum__more-paths>summary{cursor:pointer;color:var(--cv-muted);font:700 .68rem/1.4 var(--sans,system-ui)}.cv-spectrum__more-paths>div{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.45rem;margin-top:.55rem}
.cv-spectrum__preview{display:grid;grid-template-columns:minmax(0,1.52fr) minmax(225px,.68fr);gap:clamp(1.25rem,3vw,2.4rem);padding:clamp(1.25rem,3.6vw,2.6rem)}.cv-spectrum__section-label{color:var(--focus-ink);font:800 .67rem/1 var(--sans,system-ui);letter-spacing:.12em;text-transform:uppercase;margin:0 0 .78rem}.cv-spectrum__experience-head{display:flex;justify-content:space-between;align-items:baseline;gap:1rem}.cv-spectrum__experience-head>a{color:var(--focus-ink);font:750 .67rem/1.2 var(--sans,system-ui);text-decoration:none}.cv-spectrum__job{position:relative;padding:.7rem 0 .78rem 1rem;border-top:1px solid var(--cv-rule)}.cv-spectrum__job:first-of-type{border-top:0;padding-top:0}.cv-spectrum__job::before{content:"";position:absolute;left:0;top:.9rem;width:3px;height:calc(100% - 1.5rem);border-radius:2px;background:color-mix(in srgb,var(--focus) 55%,transparent)}.cv-spectrum__job h4{margin:0;font:600 1rem/1.25 var(--serif,Georgia,serif)}.cv-spectrum__job h4 span{font-style:italic;font-weight:400;color:var(--cv-muted)}.cv-spectrum__job-meta{margin:.13rem 0 .28rem;color:var(--cv-muted);font:650 .66rem/1.35 var(--sans,system-ui);letter-spacing:.025em}.cv-spectrum__job ul{margin:0;padding-left:1rem;color:var(--cv-muted);font-size:.79rem;line-height:1.52}.cv-spectrum__job li+li{margin-top:.14rem}
.cv-spectrum__print-jobs{display:none}.cv-spectrum__skills{padding-left:1.25rem;border-left:1px solid var(--cv-rule)}.cv-spectrum__skills ul{list-style:none;margin:0 0 1.35rem;padding:0;display:grid;gap:.42rem}.cv-spectrum__skills li{position:relative;padding-left:.9rem;font-size:.83rem;line-height:1.35}.cv-spectrum__skills li::before{content:"";position:absolute;left:0;top:.46em;width:.4rem;height:.4rem;border-radius:50%;background:var(--focus)}.cv-spectrum__credentials{color:var(--cv-muted);font-size:.76rem;line-height:1.62;margin:0}
.cv-spectrum__actions{display:flex;flex-wrap:wrap;align-items:center;gap:.65rem;padding:1rem clamp(1.25rem,3.6vw,2.8rem);border-top:1px solid var(--cv-rule);background:rgba(255,255,255,.38)}.cv-spectrum__actions>a,.cv-spectrum__actions summary,.cv-spectrum__actions button{min-height:42px;display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--focus-ink);border-radius:999px;background:transparent;color:var(--focus-ink);font:780 .72rem/1.1 var(--sans,system-ui);padding:.68rem 1rem;text-decoration:none;cursor:pointer}.cv-spectrum__actions .cv-spectrum__primary{background:var(--focus-ink);color:#fff;box-shadow:0 6px 16px color-mix(in srgb,var(--focus) 20%,transparent)}.cv-spectrum__formats{position:relative}.cv-spectrum__formats summary{list-style:none}.cv-spectrum__formats summary::-webkit-details-marker{display:none}.cv-spectrum__formats>div{position:absolute;z-index:30;top:calc(100% + .5rem);left:0;min-width:220px;background:var(--cv-paper-solid);border:1px solid var(--cv-rule);border-radius:15px;padding:.5rem;box-shadow:0 14px 35px rgba(0,0,0,.12)}.cv-spectrum__formats>div a,.cv-spectrum__formats>div button{display:block;width:100%;border:0;background:transparent;color:var(--cv-ink);text-align:left;padding:.65rem .7rem;text-decoration:none;border-radius:9px;font:650 .74rem/1.3 var(--sans,system-ui)}.cv-spectrum__formats>div a:hover,.cv-spectrum__formats>div button:hover{background:color-mix(in srgb,var(--focus) 8%,white)}.cv-spectrum [hidden]{display:none!important}.cv-spectrum__combined-note{margin:.45rem .7rem .55rem;color:var(--cv-muted);font:600 .67rem/1.45 var(--sans,system-ui)}
.cv-spectrum__tune{margin:0 clamp(1.25rem,3.6vw,2.8rem);border-top:1px solid var(--cv-rule)}.cv-spectrum__tune>summary{cursor:pointer;padding:.9rem 0;color:var(--cv-muted);font:720 .7rem/1.4 var(--sans,system-ui)}.cv-spectrum__tune-body{display:grid;grid-template-columns:minmax(180px,.55fr) minmax(0,1.45fr);gap:1rem;padding:0 0 1.15rem}.cv-spectrum__tune-body>p{margin:0;color:var(--cv-muted);font-size:.76rem;line-height:1.55}.cv-spectrum__tune fieldset{border:1px solid var(--cv-rule);border-radius:13px;padding:.78rem}.cv-spectrum__tune legend{font:750 .68rem/1 var(--sans,system-ui);padding:0 .3rem}.cv-spectrum__blend{display:flex;flex-wrap:wrap;gap:.4rem}.cv-spectrum__blend-chip{display:inline-flex;align-items:center;gap:.32rem;border:1px solid var(--cv-rule);border-radius:999px;padding:.34rem .52rem;font:650 .66rem/1 var(--sans,system-ui);cursor:pointer}.cv-spectrum__blend-chip:has(input:checked){border-color:var(--lens);background:color-mix(in srgb,var(--lens) 9%,white)}.cv-spectrum__blend-chip input{accent-color:var(--lens)}.cv-spectrum__note{margin:0;padding:.85rem clamp(1.25rem,3.6vw,2.8rem) 1.1rem;color:var(--cv-muted);font:550 .67rem/1.45 var(--sans,system-ui)}
#careerArchive .actions{display:none!important}#careerArchive .module-helper{max-width:68ch}
@media(max-width:800px){.cv-spectrum{border-radius:22px}.cv-spectrum__hero{grid-template-columns:105px minmax(0,1fr);align-items:start}.cv-spectrum__portrait figcaption{display:none}.cv-spectrum__focus-row,.cv-spectrum__more-paths>div{grid-template-columns:repeat(2,minmax(0,1fr))}.cv-spectrum__preview{grid-template-columns:1fr}.cv-spectrum__skills{border-left:0;border-top:1px solid var(--cv-rule);padding:1.25rem 0 0}.cv-spectrum__tune-body{grid-template-columns:1fr}}
@media(max-width:520px){.cv-spectrum__site-link{top:.55rem;right:.55rem;font-size:.58rem}.page>.cv-spectrum{width:calc(100vw - 1rem)}.cv-spectrum__hero{grid-template-columns:1fr}.cv-spectrum__portrait{max-width:155px}.cv-spectrum__identity h1{font-size:clamp(2.55rem,15vw,4rem)}.cv-spectrum__focus-heading{align-items:start}.cv-spectrum__focus-row,.cv-spectrum__more-paths>div{grid-template-columns:1fr 1fr}.cv-spectrum__formats>div{left:auto;right:0}.cv-spectrum__actions{align-items:stretch}.cv-spectrum__actions>a,.cv-spectrum__actions details{width:100%}.cv-spectrum__actions summary{width:100%}}
@media(prefers-reduced-motion:reduce){.cv-spectrum *{scroll-behavior:auto!important;transition:none!important}}
@media print{
  @page{size:letter;margin:.38in}
  html,body{width:auto!important;min-width:0!important;margin:0!important;padding:0!important;overflow:visible!important;background:#fff!important;color:#111!important}
  body:has(.cv-spectrum)>*:not(main){display:none!important}
  main>*:not(.cv-spectrum){display:none!important}
  #indraLayer,.geo,.cv-spectrum__rainbow,.cv-spectrum__portrait,.cv-spectrum__focus,.cv-spectrum__actions,.cv-spectrum__tune,.cv-spectrum__note,.cv-map-section,#careerArchive,.langs,.fz-controls,.mode-toggle,.skip-link,body>a{display:none!important}
  .page{display:block!important;width:auto!important;max-width:none!important;padding:0!important;margin:0!important;overflow:visible!important}
  .page>.cv-spectrum,.cv-spectrum{display:block!important;position:static!important;width:100%!important;max-width:none!important;margin:0!important;margin-left:0!important;transform:none!important;overflow:visible!important;border:0!important;border-radius:0!important;background:#fff!important;box-shadow:none!important;backdrop-filter:none!important;color:#111!important}
  .cv-spectrum__hero{display:block!important;padding:0 0 .12in!important;border-bottom:2px solid #111!important}
  .cv-spectrum__identity .cv-kicker{color:#111!important}.cv-spectrum__identity h1{font-size:22pt!important;line-height:1!important;max-width:none!important;color:#111!important}.cv-spectrum__identity h1 .post{color:#111!important}.cv-spectrum__role{color:#111!important;font-size:8pt!important;margin:.06in 0!important}.cv-spectrum__identity .cv-lede{color:#222!important;font-size:8pt!important;line-height:1.35!important;max-width:none!important}.cv-spectrum__contact{font-size:7pt!important;margin-top:.06in!important}.cv-spectrum__contact a{border-bottom-color:#777!important}
  .cv-spectrum__preview{display:grid!important;grid-template-columns:1.45fr .62fr!important;gap:.18in!important;padding:.13in 0 0!important}.cv-spectrum__section-label{color:#111!important;font-size:7.2pt!important}.cv-spectrum__experience-head>a{display:none!important}[data-cv-jobs]{display:none!important}.cv-spectrum__print-jobs{display:block!important}.cv-spectrum__job{padding:.075in 0 .085in .10in!important;border-top:1px solid #bbb!important;break-inside:avoid}.cv-spectrum__job::before{background:#555!important}.cv-spectrum__job h4{font-size:8.5pt!important;line-height:1.22!important}.cv-spectrum__job-meta{font-size:6.8pt!important;color:#444!important}.cv-spectrum__job ul{font-size:7.25pt!important;line-height:1.34!important;color:#222!important}.cv-spectrum__skills{padding-left:.12in!important;border-left:1px solid #aaa!important;border-top:0!important}.cv-spectrum__skills li{font-size:7.25pt!important;line-height:1.3!important}.cv-spectrum__skills li::before{background:#555!important}.cv-spectrum__credentials{font-size:6.7pt!important;line-height:1.4!important;color:#333!important}.cv-spectrum a{color:#111!important;text-decoration:none!important}
}
'''

WEB_JS = r'''
(() => {
  'use strict';
  const root = document.querySelector('[data-cv-spectrum]');
  if (!root) return;
  const dataUrl = '/saul/assets/saul-cv-canonical-2026.json';
  let data = null;
  let selected = [];
  const unique = values => [...new Set(values.filter(Boolean))];
  const recordRecency = record => {
    const dates = String(record?.dates || '').toLowerCase();
    const years = [...dates.matchAll(/(?:19|20)\d{2}/g)].map(match => Number(match[0]));
    return [(dates.includes('present') ? 1 : 0), Math.max(0, ...years), Math.min(...years, 9999)];
  };
  const sortRecords = records => [...(records || [])].sort((a, b) => {
    const ak = recordRecency(a), bk = recordRecency(b);
    return (bk[0] - ak[0]) || (bk[1] - ak[1]) || (bk[2] - ak[2]);
  });
  const slugs = () => data ? Object.keys(data.modules) : [];
  const pathFocus = () => {
    if (!data) return [];
    const q = new URL(location.href).searchParams.get('focus');
    if (q) return unique(q.split(',')).filter(x => slugs().includes(x) && x !== 'general');
    const parts = location.pathname.split('/').filter(Boolean);
    if (parts[0] !== 'saul') return [];
    if (parts[1] === 'cv' && parts[2] && data.modules[parts[2]]) return parts[2] === 'general' ? [] : [parts[2]];
    if (parts[1] === 'hospitality') return ['hospitality'];
    return parts.slice(1).filter(x => data.modules[x] && x !== 'general');
  };
  const routeFor = values => {
    values = unique(values).filter(x => x !== 'general');
    if (!values.length) return '/saul/';
    if (values.length === 1) return data.modules[values[0]].route;
    return '/saul/?focus=' + encodeURIComponent(values.join(','));
  };
  const combineModules = values => {
    values = unique(values).filter(x => data.modules[x] && x !== 'general');
    if (!values.length) return data.modules.general;
    if (values.length === 1) return data.modules[values[0]];
    const chosen = values.map(x => data.modules[x]);
    const label = chosen.map(x => x.short).join(' + ');
    const skills = unique(chosen.flatMap(x => x.skills)).slice(0, 10);
    const credentials = unique(chosen.flatMap(x => x.credentials || [])).slice(0, 6);
    const seen = new Set();
    const records = [];
    sortRecords(chosen.flatMap(x => x.records)).forEach(r => {
      const k = [r.title, r.organization, r.dates].join('|');
      if (!seen.has(k)) { seen.add(k); records.push(r); }
    });
    return {
      label, short: label, color: chosen[0].color,
      profile: `Cross-functional professional combining ${chosen.map(x => x.label.toLowerCase()).join(', ')}. Brings clear communication, reliable delivery and practical experience across the selected areas.`,
      skills, credentials, records: sortRecords(records),
      downloads: chosen[0].downloads,
      combined: true,
    };
  };
  const jobHTML = r => {
    const org = r.organization ? ` <span>- ${escapeHTML(r.organization)}</span>` : '';
    const meta = [r.location, r.dates].filter(Boolean).map(escapeHTML).join(' · ');
    const bullets = (r.bullets || []).slice(0, 2).map(x => `<li>${escapeHTML(x)}</li>`).join('');
    return `<article class="cv-spectrum__job"><h4>${escapeHTML(r.title)}${org}</h4><p class="cv-spectrum__job-meta">${meta}</p><ul>${bullets}</ul></article>`;
  };
  const escapeHTML = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const render = () => {
    const module = combineModules(selected);
    root.style.setProperty('--focus', module.color || '#665A78');
    root.querySelectorAll('[data-cv-role],[data-cv-current]').forEach(el => el.textContent = module.label);
    root.querySelector('[data-cv-profile]').textContent = module.profile;
    root.querySelector('[data-cv-name]').firstChild.nodeValue = data.contact.name;
    root.querySelector('[data-cv-post]').textContent = selected.includes('education') ? ', MA' : '';
    root.querySelector('[data-cv-skills]').innerHTML = (module.skills || []).slice(0, 10).map(x => `<li>${escapeHTML(x)}</li>`).join('');
    const creds = unique([...(module.credentials || []), ...data.languages]);
    if (selected.includes('education')) creds.unshift(...data.education);
    root.querySelector('[data-cv-credentials]').textContent = unique(creds).slice(0, 9).join(' · ');
    root.querySelector('[data-cv-jobs]').innerHTML = sortRecords(module.records).slice(0, 5).map(jobHTML).join('');
    root.querySelector('[data-cv-print-jobs]').innerHTML = sortRecords(module.records).slice(0, 7).map(jobHTML).join('');
    root.querySelectorAll('[data-focus-slug]').forEach(el => {
      const on = selected.length === 1 ? el.dataset.focusSlug === selected[0] : (!selected.length && el.dataset.focusSlug === 'general');
      if (on) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current');
    });
    root.querySelectorAll('[data-cv-blend]').forEach(box => box.checked = selected.includes(box.value));
    const designed = root.querySelector('[data-cv-designed]');
    const ats = root.querySelector('[data-cv-ats]');
    const text = root.querySelector('[data-cv-text]');
    const singleFormats = [...root.querySelectorAll('[data-cv-single-format]')];
    const combinedNote = root.querySelector('[data-cv-combined-note]');
    const isCombined = selected.length > 1;
    singleFormats.forEach(el => { el.hidden = isCombined; });
    if (combinedNote) combinedNote.hidden = !isCombined;
    if (!isCombined) {
      const single = selected.length ? data.modules[selected[0]] : data.modules.general;
      designed.href = single.downloads.designed; designed.textContent = 'Download professional PDF';
      ats.href = single.downloads.ats; text.href = single.downloads.text;
      designed.onclick = null;
    } else {
      designed.href = '#'; designed.textContent = 'Save combined view as PDF';
      designed.onclick = event => { event.preventDefault(); window.print(); };
    }
    document.title = `Saul Karim Nassau - ${module.label} CV`;
  };
  const setSelected = (values, push = true) => {
    const next = unique(values).filter(x => data.modules[x] && x !== 'general');
    const nextUrl = routeFor(next);
    if (push && root.dataset.focusedRoute === 'true') { location.assign(nextUrl); return; }
    selected = next;
    render();
    if (push) history.pushState({focus:selected}, '', nextUrl);
  };
  // Focus choices are ordinary links. The same URL therefore renders the same
  // focused page whether it is opened directly, clicked, reloaded or shared.
  root.querySelectorAll('[data-cv-blend]').forEach(box => box.addEventListener('change', () => {
    setSelected([...root.querySelectorAll('[data-cv-blend]:checked')].map(x => x.value));
  }));
  root.querySelector('[data-cv-copy]')?.addEventListener('click', async event => {
    const button = event.currentTarget;
    let copied = false;
    try { await navigator.clipboard.writeText(location.href); copied = true; }
    catch {
      const field = document.createElement('textarea');
      field.value = location.href; field.setAttribute('readonly', '');
      field.style.position = 'fixed'; field.style.opacity = '0';
      document.body.append(field); field.select();
      try { copied = document.execCommand('copy'); } catch {}
      field.remove();
    }
    button.textContent = copied ? 'Link copied' : 'Copy the address bar';
    setTimeout(() => button.textContent = 'Share this view', 1600);
  });
  root.querySelector('[data-cv-print]')?.addEventListener('click', () => window.print());
  addEventListener('popstate', () => { selected = pathFocus(); render(); });
  fetch(dataUrl, {credentials:'same-origin'}).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).then(d => {
    data = d; selected = pathFocus(); render();
  }).catch(err => console.error('CV data failed to load', err));
})();
'''

# Write web assets.
asset_dir = ROOT / 'saul' / 'assets'
asset_dir.mkdir(parents=True, exist_ok=True)
(asset_dir / 'saul-cv-spectrum-2026.css').write_text(WEB_CSS, encoding='utf-8')
(asset_dir / 'saul-cv-spectrum-2026.js').write_text(WEB_JS, encoding='utf-8')


def patch_main_saul(path: Path):
    raw = path.read_text(encoding='utf-8', errors='replace')
    # Retire the obsolete burgundy print engine and its controls. The visual card
    # and professional static PDFs now govern exports.
    raw = re.sub(r'document\.getElementById\("saveBtn"\)\.addEventListener\("click", \(\) => \{.*?\n\}\);', '', raw, flags=re.S)
    raw = re.sub(r'document\.getElementById\("modeToggle"\)\.addEventListener\("click", \(\) => \{.*?\n\}\);', '', raw, flags=re.S)
    raw = re.sub(r'document\.getElementById\("shareBtn"\)\.addEventListener\("click", \(\) => \{.*?\n\}\);', '', raw, flags=re.S)
    raw = raw.replace('document.getElementById("saveBtn").textContent = t.save;', 'const saveBtnLabel = document.getElementById("saveBtn"); if (saveBtnLabel) saveBtnLabel.textContent = t.save;')
    raw = raw.replace('const mt = document.getElementById("modeToggle");\n  mt.textContent = (cvMode === "theme") ? "⇄ Thematic" : "⇄ Chronological";\n  mt.classList.toggle("on", cvMode === "theme");', 'const mt = document.getElementById("modeToggle");\n  if (mt) { mt.textContent = (cvMode === "theme") ? "⇄ Thematic" : "⇄ Chronological"; mt.classList.toggle("on", cvMode === "theme"); }')
    raw = raw.replace("document.getElementById('saveBtn').click();", "document.getElementById('saveBtn')?.click();")
    soup = BeautifulSoup(raw, 'html.parser')
    main = soup.find('main')
    if not main:
        raise RuntimeError(f'No main element in {path}')
    for obsolete in [soup.find(id='printCv'), soup.find('style', id='unifiedPrint')]:
        if obsolete:
            obsolete.decompose()
    for script_tag in list(soup.find_all('script')):
        ref = script_tag.get('src') or ''
        body = script_tag.string or script_tag.get_text() or ''
        if 'saul-cv-modular-2026.js' in ref or 'function buildPrintCv()' in body:
            script_tag.decompose()
    old_card = main.find('section', attrs={'data-cv-spectrum': True})
    if old_card:
        old_card.replace_with(BeautifulSoup(card_html('general', False), 'html.parser'))
    else:
        # Place after language controls when possible.
        langs = main.find('nav', class_='langs')
        fragment = BeautifulSoup(card_html('general', False), 'html.parser')
        if langs:
            langs.insert_after(fragment)
        else:
            main.insert(0, fragment)
    # Remove old V3 references and ensure current asset references are singular.
    for el in soup.find_all(['link', 'script']):
        ref = el.get('href') or el.get('src') or ''
        if 'saul-cv-v3' in ref:
            el.decompose()
    for el in list(soup.find_all('link', href=re.compile('saul-cv-spectrum-2026.css')))[1:]:
        el.decompose()
    if not soup.find('link', href=re.compile('saul-cv-spectrum-2026.css')):
        soup.head.append(soup.new_tag('link', rel='stylesheet', href='./assets/saul-cv-spectrum-2026.css?v=20260716-spirit-r4'))
    else:
        soup.find('link', href=re.compile('saul-cv-spectrum-2026.css'))['href'] = './assets/saul-cv-spectrum-2026.css?v=20260716-spirit-r4'
    for el in soup.find_all('script', src=re.compile('saul-cv-spectrum-2026.js')):
        el.decompose()
    script = soup.new_tag('script', src='./assets/saul-cv-spectrum-2026.js?v=20260716-spirit-r4', defer=True)
    soup.body.append(script)
    # Remove duplicate download/share controls from the complete archive.
    archive = soup.find(id='careerArchive')
    if archive:
        actions = archive.find(class_='actions')
        if actions:
            actions.decompose()
        summary = archive.find('summary')
        if summary:
            summary.string = 'Archive filters'
        helper = archive.find(class_='module-helper')
        if helper:
            helper.string = 'Filter the complete historical record. The visual CV above controls professional downloads and shareable role links.'
    if soup.title:
        soup.title.string = 'Saul Karim Nassau - Visual Modular CV and Career Archive'
    desc = soup.find('meta', attrs={'name': 'description'})
    if desc:
        desc['content'] = "Explore Saul Karim Nassau's visual modular CV, role-focused links, professional application PDFs, map and complete career archive."
    # One H1 belongs inside the card.
    h1s = soup.find_all('h1')
    for extra in h1s[1:]:
        extra.name = 'h2'
    path.write_text(str(soup), encoding='utf-8')


patch_main_saul(ROOT / 'saul' / 'index.html')


def focused_page(slug: str, alias: bool = False) -> str:
    m = modules[slug]
    canonical_url = f'https://seminarschools.com/saul/cv/{slug}/'
    page_url = 'https://seminarschools.com/saul/hospitality/' if alias else canonical_url
    robots = 'noindex,follow' if alias else 'index,follow,max-image-preview:large'
    title = f"Saul Karim Nassau - {m['label']} CV"
    description = f"A visual role-focused {m['label'].lower()} CV for Saul Karim Nassau, with professional, ATS-safe and plain-text application formats."
    schema = json.dumps({
        '@context': 'https://schema.org', '@type': 'ProfilePage', 'name': title, 'url': page_url,
        'mainEntity': {'@type': 'Person', 'name': 'Saul Karim Nassau', 'email': contact['email'],
                       'telephone': contact['phone'], 'address': {'@type': 'PostalAddress',
                       'addressLocality': 'Toronto', 'addressRegion': 'Ontario', 'addressCountry': 'CA'}}
    })
    return f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{escape(title)}</title><meta name="description" content="{escape(description)}"><meta name="robots" content="{robots}"><link rel="canonical" href="{canonical_url}"><link rel="icon" type="image/svg+xml" href="/favicon.svg"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><link rel="manifest" href="/manifest.json"><meta property="og:type" content="profile"><meta property="og:title" content="{escape(title)}"><meta property="og:description" content="{escape(description)}"><meta property="og:url" content="{page_url}"><meta property="og:image" content="https://seminarschools.com/img/saul.jpg"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="{escape(title)}"><meta name="twitter:description" content="{escape(description)}"><meta name="twitter:image" content="https://seminarschools.com/img/saul.jpg"><link rel="stylesheet" href="/css/theme.css?v=cl91"><link rel="stylesheet" href="/css/alive.css?v=cl91"><link rel="stylesheet" href="/css/site-wide-type-zoom.css?v=20260710-reviews-zoom-font-a" data-site-wide-type-zoom="20260710-reviews-zoom-font-a"><link rel="stylesheet" href="/saul/assets/saul-cv-spectrum-2026.css?v=20260716-spirit-r4"><script type="application/ld+json">{schema}</script></head><body data-geometry="indra-web" data-indra-intensity="0.085" data-route-type="cv" data-cv-purpose="general-employment"><a class="cv-spectrum__site-link" href="/main/">← Seminar Schools</a><a class="skip-link" href="#main-content">Skip to main content</a><main id="main-content" class="page">{card_html(slug, True)}<section class="cv-map-section" aria-labelledby="routeArchiveTitle"><div class="section-intro"><div><span class="archive-eyebrow">Same visual system</span><h2 id="routeArchiveTitle">Continue through the complete career archive</h2></div><p>This shareable link opens the same modular CV card with {escape(m['label'])} selected. The portrait, map, timeline and additive combinations remain available from the main CV.</p></div><p><a href="/saul/#careerArchive">Open the complete modular CV and work record →</a></p></section></main><script defer src="/js/mandala.js?v=cl91"></script><script defer src="/js/indra.js?v=cl91"></script><script defer src="/js/site-keyboard-enhancements.js"></script><script defer src="/saul/assets/saul-cv-spectrum-2026.js?v=20260716-spirit-r4"></script></body></html>'''


for slug in modules:
    p = ROOT / 'saul' / 'cv' / slug / 'index.html'
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(focused_page(slug), encoding='utf-8')
alias = ROOT / 'saul' / 'hospitality' / 'index.html'
alias.parent.mkdir(parents=True, exist_ok=True)
alias.write_text(focused_page('hospitality', True), encoding='utf-8')

# Main page writing layout: preserve palette and geometry, fix the word-column collapse.
MAIN_FIX = r'''
/* Main writing-list readability repair - stable project names, flexible descriptions - 2026-07-16 */
#writing .entry{grid-template-columns:50px minmax(18rem,.48fr) minmax(22rem,1fr)!important;align-items:start!important;column-gap:clamp(1rem,2.25vw,2.35rem)!important}
#writing .entry .title,#writing .entry .where{min-width:0!important}
#writing .entry .title{font-size:clamp(1.05rem,1.45vw,1.35rem)!important;line-height:1.24!important;overflow-wrap:normal!important;word-break:normal!important;hyphens:none!important}
#writing .entry .title a{display:inline!important;white-space:normal!important;overflow-wrap:normal!important;word-break:normal!important;hyphens:none!important}
#writing .entry .where{white-space:normal!important;overflow-wrap:anywhere!important;word-break:normal!important;line-height:1.62!important}
@media(max-width:1000px){#writing .entry{grid-template-columns:36px minmax(0,1fr)!important;row-gap:.28rem!important}#writing .entry .title{grid-column:2!important}#writing .entry .where{grid-column:2!important;margin-top:0!important}}
@media(max-width:560px){#writing .entry .title,#writing .entry .title a{overflow-wrap:anywhere!important;word-break:normal!important}}
'''
(ROOT / 'css' / 'main-writing-readability-2026.css').write_text(MAIN_FIX, encoding='utf-8')
main_page = ROOT / 'main' / 'index.html'
mt = main_page.read_text(encoding='utf-8')
mt = mt.replace('>polymorphousmythology</a>', '>polymorphous mythology</a>')
if 'main-writing-readability-2026.css' not in mt:
    mt = mt.replace('</head>', '<link rel="stylesheet" href="/css/main-writing-readability-2026.css?v=20260716-spirit-r4">\n</head>', 1)
else:
    mt = re.sub(r'/css/main-writing-readability-2026\.css\?v=[^"\']+', '/css/main-writing-readability-2026.css?v=20260716-spirit-r4', mt)
main_page.write_text(mt, encoding='utf-8')

# -----------------------------
# Professional monochrome PDFs
# -----------------------------
FONT_FILES = {
    'NotoSans': '/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf',
    'NotoSans-Bold': '/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf',
    'NotoSans-Italic': '/usr/share/fonts/truetype/noto/NotoSans-Italic.ttf',
    'NotoSerif': '/usr/share/fonts/truetype/noto/NotoSerif-Regular.ttf',
    'NotoSerif-Bold': '/usr/share/fonts/truetype/noto/NotoSerif-Bold.ttf',
    'NotoSerif-Italic': '/usr/share/fonts/truetype/noto/NotoSerif-Italic.ttf',
}
for name, fp in FONT_FILES.items():
    if Path(fp).exists():
        try:
            pdfmetrics.registerFont(TTFont(name, fp))
        except Exception:
            pass

PW, PH = letter
WHITE = HexColor('#FFFFFF')
INK = HexColor('#111820')
SLATE = HexColor('#263746')
MUTED = HexColor('#4D5963')
RULE = HexColor('#CBD1D6')
PALE = HexColor('#F2F4F5')


def split_lines(text, font, size, width):
    words = normal_text(text).split()
    lines, current = [], ''
    for word in words:
        test = word if not current else current + ' ' + word
        if pdfmetrics.stringWidth(test, font, size) <= width:
            current = test
        else:
            if current:
                lines.append(current)
            if pdfmetrics.stringWidth(word, font, size) > width:
                chunk = ''
                for ch in word:
                    t = chunk + ch
                    if pdfmetrics.stringWidth(t, font, size) <= width:
                        chunk = t
                    else:
                        if chunk:
                            lines.append(chunk)
                        chunk = ch
                current = chunk
            else:
                current = word
    if current:
        lines.append(current)
    return lines


def draw_wrapped(c, text, x, y, width, font='NotoSans', size=8, leading=None, color=INK, max_lines=None):
    leading = leading or size * 1.25
    lines = split_lines(text, font, size, width)
    if max_lines is not None and len(lines) > max_lines:
        lines = lines[:max_lines]
        last = lines[-1]
        while last and pdfmetrics.stringWidth(last + '...', font, size) > width:
            last = last[:-1]
        lines[-1] = last.rstrip(' ,;:') + '...'
    c.setFillColor(color)
    c.setFont(font, size)
    for line in lines:
        c.drawString(x, y, line)
        y -= leading
    return y, len(lines) * leading


def section_label(c, label, x, y, width):
    c.setFillColor(SLATE)
    c.setFont('NotoSans-Bold', 7.4)
    c.drawString(x, y, label.upper())
    c.setStrokeColor(RULE)
    c.setLineWidth(.55)
    c.line(x, y - 4, x + width, y - 4)
    return y - 15


def designed_pdf(slug, module, outpath, scale=1.0):
    """Editorial, monochrome, one-page human-facing CV.

    The website carries the spectrum and geometry. The PDF uses only black,
    charcoal and neutral grays so it reads as a conventional professional
    document in print, email and applicant-tracking workflows.
    """
    c = canvas.Canvas(str(outpath), pagesize=letter, pageCompression=1)
    c.setTitle(f"Saul Karim Nassau - {module['label']} CV")
    c.setAuthor('Saul Karim Nassau')
    c.setSubject(f"Professional role-focused {module['label']} curriculum vitae")
    c.setFillColor(WHITE)
    c.rect(0, 0, PW, PH, 0, 1)

    margin = 38
    page_right = PW - margin
    top = PH - 30
    footer_y = 35

    # Quiet editorial masthead.
    c.setFillColor(INK)
    c.rect(margin, top, PW - 2 * margin, 3.8, 0, 1)
    y = top - 28
    name = contact['name'] + (', MA' if slug == 'education' else '')
    c.setFillColor(INK)
    c.setFont('NotoSerif-Bold', 24.2 * scale)
    c.drawString(margin, y, name)
    c.setFillColor(SLATE)
    c.setFont('NotoSans-Bold', 8.9 * scale)
    c.drawString(margin, y - 19, normal_text(module['label']).upper())

    c.setFillColor(MUTED)
    c.setFont('NotoSans', 7.15 * scale)
    contact_lines = [contact['location'], contact['phone'], contact['email'], 'seminarschools.com/saul/']
    for i, line in enumerate(contact_lines):
        c.drawRightString(page_right, y - i * 10, normal_text(line))
    c.setStrokeColor(RULE)
    c.setLineWidth(.75)
    c.line(margin, y - 32, page_right, y - 32)

    # Professional summary band.
    profile_top = y - 47
    profile_h = 55
    c.setFillColor(PALE)
    c.roundRect(margin, profile_top - profile_h + 8, PW - 2 * margin, profile_h, 4, 0, 1)
    c.setFillColor(SLATE)
    c.setFont('NotoSans-Bold', 7.35 * scale)
    c.drawString(margin + 10, profile_top, 'PROFILE')
    profile_x = margin + 76
    draw_wrapped(
        c, module['profile'], profile_x, profile_top + 1,
        page_right - profile_x - 10, 'NotoSerif', 8.55 * scale,
        10.9 * scale, INK, max_lines=4,
    )

    body_top = profile_top - profile_h - 3
    left_x = margin
    side_w = 158
    gap = 20
    side_x = page_right - side_w
    left_w = side_x - gap - left_x
    body_bottom = 52

    # A neutral sidebar gives the page visual structure without colour or geometry.
    c.setFillColor(HexColor('#F3F4F5'))
    c.roundRect(side_x - 9, body_bottom - 4, side_w + 9, body_top - body_bottom + 15, 5, 0, 1)

    # Experience rail.
    ly = section_label(c, 'Selected experience', left_x, body_top, left_w)
    date_w = 70
    content_x = left_x + date_w + 10
    content_w = left_w - date_w - 10
    line_top = ly + 6
    records = ordered_records(module)[:7]

    title_size = 8.85 * scale
    title_lead = 10.6 * scale
    meta_size = 6.95 * scale
    meta_lead = 8.35 * scale
    bullet_size = 7.25 * scale
    bullet_lead = 8.75 * scale

    # Estimate natural height, then distribute modest extra space. This avoids
    # both the former crushed timeline and the recent half-empty composition.
    estimates = []
    for rec in records:
        title = rec.get('title', '') + (f" - {rec.get('organization', '')}" if rec.get('organization') else '')
        title_lines = min(2, len(split_lines(title, 'NotoSerif-Bold', title_size, content_w)))
        h = title_lines * title_lead
        if rec.get('location'):
            h += meta_lead
        for bullet in rec.get('bullets', [])[:2]:
            h += min(2, len(split_lines('- ' + normal_text(bullet), 'NotoSans', bullet_size, content_w))) * bullet_lead + 1.0 * scale
        h += 5.2 * scale
        estimates.append(h)
    available = max(1, ly - body_bottom - 5)
    natural = sum(estimates)
    extra_gap = min(12.5 * scale, max(0, (available - natural) / max(1, len(records))))

    for rec in records:
        c.setFillColor(MUTED)
        c.setFont('NotoSans', 6.85 * scale)
        dy = ly
        for line in split_lines(rec.get('dates', ''), 'NotoSans', 6.85 * scale, date_w - 5)[:2]:
            c.drawRightString(left_x + date_w - 2, dy, line)
            dy -= 8.25 * scale
        title = rec.get('title', '') + (f" - {rec.get('organization', '')}" if rec.get('organization') else '')
        ty, _ = draw_wrapped(c, title, content_x, ly, content_w, 'NotoSerif-Bold', title_size,
                             title_lead, INK, max_lines=2)
        meta = rec.get('location', '')
        if meta:
            c.setFillColor(MUTED)
            c.setFont('NotoSans-Italic', meta_size)
            c.drawString(content_x, ty + .5, normal_text(meta))
            ty -= meta_lead
        for bullet in rec.get('bullets', [])[:2]:
            by, _ = draw_wrapped(c, '- ' + normal_text(bullet), content_x, ty, content_w,
                                 'NotoSans', bullet_size, bullet_lead, MUTED, max_lines=2)
            ty = by - 1.0 * scale
        ly = ty - (5.2 * scale + extra_gap)

    c.setStrokeColor(RULE)
    c.setLineWidth(.8)
    c.line(content_x - 10, line_top, content_x - 10, max(body_bottom - 1, ly + 4))

    # Structured monochrome sidebar.
    side_inner_x = side_x + 2
    side_inner_w = side_w - 5
    ry = section_label(c, 'Key skills', side_inner_x, body_top, side_inner_w)
    for skill in module.get('skills', [])[:9]:
        sy, _ = draw_wrapped(c, normal_text(skill), side_inner_x + 7, ry, side_inner_w - 7,
                             'NotoSans', 7.2 * scale, 8.65 * scale, INK, max_lines=2)
        c.setStrokeColor(RULE)
        c.setLineWidth(.4)
        c.line(side_inner_x, sy - 2, side_inner_x + side_inner_w, sy - 2)
        ry = sy - 6

    ry -= 1
    ry = section_label(c, 'Credentials', side_inner_x, ry, side_inner_w)
    for item in module.get('credentials', [])[:5]:
        ry, _ = draw_wrapped(c, normal_text(item), side_inner_x, ry, side_inner_w,
                             'NotoSans', 6.75 * scale, 8.15 * scale, INK, max_lines=2)
        ry -= 3.5

    if slug == 'education':
        ry -= 1
        ry = section_label(c, 'Education', side_inner_x, ry, side_inner_w)
        for item in education:
            ry, _ = draw_wrapped(c, normal_text(item), side_inner_x, ry, side_inner_w,
                                 'NotoSerif', 6.65 * scale, 8.0 * scale, INK, max_lines=2)
            ry -= 3

    ry -= 1
    ry = section_label(c, 'Languages', side_inner_x, ry, side_inner_w)
    for item in languages:
        ry, _ = draw_wrapped(c, normal_text(item), side_inner_x, ry, side_inner_w,
                             'NotoSans', 6.95 * scale, 8.25 * scale, INK, max_lines=1)
        ry -= 1

    # Useful direct route, kept visually secondary.
    route_text = module.get('route', '/saul/')
    route_url = 'seminarschools.com' + route_text
    if ry > body_bottom + 34:
        ry -= 6
        ry = section_label(c, 'Focused web CV', side_inner_x, ry, side_inner_w)
        draw_wrapped(c, route_url, side_inner_x, ry, side_inner_w, 'NotoSans', 6.45 * scale,
                     7.7 * scale, MUTED, max_lines=2)

    c.setStrokeColor(INK)
    c.setLineWidth(.8)
    c.line(margin, footer_y, page_right, footer_y)
    c.setFillColor(MUTED)
    c.setFont('NotoSans', 6.25)
    c.drawCentredString(PW / 2, 23, 'REVIEWS AND REFERENCES  ·  SEMINARSCHOOLS.COM/REVIEWS')
    c.showPage()
    c.save()
    return min(ly, ry)


def ats_pdf(slug, module, outpath, scale=1.0):
    c = canvas.Canvas(str(outpath), pagesize=letter, pageCompression=1)
    c.setTitle(f"Saul Karim Nassau - {module['label']} CV - ATS")
    c.setAuthor('Saul Karim Nassau')
    margin = 42
    y = PH - 42
    name = contact['name'] + (', MA' if slug == 'education' else '')
    c.setFillColor(INK)
    c.setFont('NotoSans-Bold', 18 * scale)
    c.drawString(margin, y, name)
    c.setFont('NotoSans-Bold', 9 * scale)
    c.drawString(margin, y - 16, normal_text(module['label']))
    c.setFillColor(MUTED)
    c.setFont('NotoSans', 7.5 * scale)
    c.drawString(margin, y - 30, f"{contact['location']} | {contact['phone']} | {contact['email']} | seminarschools.com/saul/")
    y -= 48

    def heading(text):
        nonlocal y
        c.setFillColor(INK)
        c.setFont('NotoSans-Bold', 8.2 * scale)
        c.drawString(margin, y, text.upper())
        y -= 12 * scale

    heading('Profile')
    y, _ = draw_wrapped(c, module['profile'], margin, y, PW - 2 * margin, 'NotoSans', 7.45 * scale,
                        8.9 * scale, INK, max_lines=4)
    y -= 4
    heading('Key skills')
    y, _ = draw_wrapped(c, ' | '.join(module.get('skills', [])), margin, y, PW - 2 * margin,
                        'NotoSans', 7.15 * scale, 8.6 * scale, INK, max_lines=4)
    y -= 5
    heading('Selected experience')
    for rec in ordered_records(module)[:7]:
        title = rec.get('title', '') + (f" - {rec.get('organization', '')}" if rec.get('organization') else '')
        meta = ' | '.join(x for x in [rec.get('location', ''), rec.get('dates', '')] if x)
        c.setFillColor(INK)
        c.setFont('NotoSans-Bold', 7.3 * scale)
        y, _ = draw_wrapped(c, title, margin, y, PW - 2 * margin, 'NotoSans-Bold', 7.3 * scale,
                            8.7 * scale, INK, max_lines=2)
        if meta:
            c.setFillColor(MUTED)
            c.setFont('NotoSans', 6.7 * scale)
            c.drawString(margin, y, normal_text(meta))
            y -= 8 * scale
        for bullet in rec.get('bullets', [])[:2]:
            y, _ = draw_wrapped(c, '- ' + bullet, margin + 8, y, PW - 2 * margin - 8, 'NotoSans',
                                6.75 * scale, 8.0 * scale, INK, max_lines=2)
        y -= 3
    if slug == 'education':
        heading('Education')
        y, _ = draw_wrapped(c, ' | '.join(education), margin, y, PW - 2 * margin, 'NotoSans',
                            6.75 * scale, 8.0 * scale, INK, max_lines=5)
        y -= 4
    heading('Training and languages')
    y, _ = draw_wrapped(c, ' | '.join(module.get('credentials', [])[:4] + languages), margin, y,
                        PW - 2 * margin, 'NotoSans', 6.7 * scale, 8.0 * scale, INK, max_lines=5)
    c.showPage()
    c.save()
    return y


def text_output(slug, module):
    name = contact['name'] + (', MA' if slug == 'education' else '')
    lines = [name, module['label'].upper(), f"{contact['location']} | {contact['phone']} | {contact['email']}",
             contact['site'], '', 'PROFILE', module['profile'], '', 'KEY SKILLS']
    lines += [f'- {x}' for x in module.get('skills', [])]
    lines += ['', 'SELECTED EXPERIENCE']
    for rec in ordered_records(module):
        title = rec.get('title', '') + (f" - {rec.get('organization', '')}" if rec.get('organization') else '')
        meta = ' | '.join(x for x in [rec.get('location', ''), rec.get('dates', '')] if x)
        lines.append(f'{title} | {meta}' if meta else title)
        lines += [f'- {b}' for b in rec.get('bullets', [])]
        lines.append('')
    if slug == 'education':
        lines += ['EDUCATION'] + [f'- {x}' for x in education] + ['']
    lines += ['TRAINING AND CREDENTIALS'] + [f'- {x}' for x in module.get('credentials', [])]
    lines += ['', 'LANGUAGES'] + [f'- {x}' for x in languages]
    lines += ['', 'REVIEWS AND REFERENCES', contact['reviews']]
    return '\n'.join(normal_text(x) for x in lines).strip() + '\n'


downloads = ROOT / 'saul' / 'downloads'
downloads.mkdir(parents=True, exist_ok=True)
pdf_manifest = {'release': canonical['release'], 'design_system': 'professional-monochrome', 'outputs': []}
for slug, module in modules.items():
    designed = downloads / f'saul-karim-nassau-{slug}-cv.pdf'
    ats = downloads / f'saul-karim-nassau-{slug}-cv-ats.pdf'
    txt = downloads / f'saul-karim-nassau-{slug}-cv.txt'
    chosen = None
    for scale in (1.12, 1.09, 1.06, 1.03, 1.0, .98, .96, .94):
        bottom = designed_pdf(slug, module, designed, scale)
        if bottom > 43:
            chosen = scale
            break
    if chosen is None:
        chosen = .94
        designed_pdf(slug, module, designed, chosen)
    ats_scale = None
    for scale in (1.0, .98, .96, .94, .92):
        bottom = ats_pdf(slug, module, ats, scale)
        if bottom > 36:
            ats_scale = scale
            break
    if ats_scale is None:
        ats_scale = .92
        ats_pdf(slug, module, ats, ats_scale)
    txt.write_text(text_output(slug, module), encoding='utf-8')
    for typ, pth, scale in [('designed', designed, chosen), ('ats', ats, ats_scale)]:
        reader = PdfReader(str(pth))
        extracted = '\n'.join(page.extract_text() or '' for page in reader.pages)
        pdf_manifest['outputs'].append({
            'slug': slug, 'type': typ, 'path': str(pth.relative_to(ROOT)).replace('\\', '/'),
            'pages': len(reader.pages), 'extractable_characters': len(extracted),
            'sha256': hashlib.sha256(pth.read_bytes()).hexdigest(), 'scale': scale,
            'rainbow': False, 'geometry': False,
        })

# Stable legacy URLs point to the professional general PDF.
for target in [ROOT / 'saul' / 'cv.pdf', ROOT / 'Saul_Karim_Nassau_CV_onepage_final_2026-07-09.pdf',
               ROOT / 'Saul_Karim_Nassau_CV_onepage_revamp_2026-07-09.pdf']:
    shutil.copy2(downloads / 'saul-karim-nassau-general-cv.pdf', target)

# Complete archive PDF: professional monochrome multi-page document.
def archive_pdf(path: Path):
    styles = {
        'h1': ParagraphStyle('h1', fontName='NotoSerif-Bold', fontSize=22, leading=24, textColor=INK, spaceAfter=4),
        'h2': ParagraphStyle('h2', fontName='NotoSans-Bold', fontSize=10.5, leading=12.5, textColor=SLATE, spaceBefore=10, spaceAfter=5),
        'h3': ParagraphStyle('h3', fontName='NotoSerif-Bold', fontSize=8.7, leading=10.6, textColor=INK, spaceAfter=1),
        'body': ParagraphStyle('body', fontName='NotoSans', fontSize=7.5, leading=9.4, textColor=INK, spaceAfter=2),
        'meta': ParagraphStyle('meta', fontName='NotoSans', fontSize=6.7, leading=8, textColor=MUTED, spaceAfter=2),
        'bullet': ParagraphStyle('bullet', fontName='NotoSans', fontSize=7.1, leading=8.8, leftIndent=9, firstLineIndent=-6, textColor=INK, spaceAfter=1),
    }
    def on_page(c, doc):
        c.saveState()
        c.setFillColor(WHITE); c.rect(0, 0, PW, PH, 0, 1)
        c.setFillColor(INK); c.rect(36, PH - 25, PW - 72, 3, 0, 1)
        c.setStrokeColor(RULE); c.line(36, 29, PW - 36, 29)
        c.setFont('NotoSans', 6.3); c.setFillColor(MUTED); c.drawRightString(PW - 36, 18, str(doc.page))
        c.restoreState()
    doc = SimpleDocTemplate(str(path), pagesize=letter, rightMargin=38, leftMargin=38, topMargin=44, bottomMargin=38,
                            title='Saul Karim Nassau - Complete Career Archive', author='Saul Karim Nassau')
    story = [Paragraph('Saul Karim Nassau, MA', styles['h1']), Paragraph('Complete Career Archive', styles['h2']),
             Paragraph(f"{contact['location']} | {contact['phone']} | {contact['email']} | seminarschools.com/saul/", styles['meta']),
             Paragraph('Complete record of education, research, teaching, community development, hospitality, performance, volunteer work and independent projects. Role-focused one-page versions are available from the modular web CV.', styles['body']), Spacer(1, 8)]
    seen = set()
    for slug, module in modules.items():
        if slug in {'general', 'education'}:
            continue
        story.append(Paragraph(escape(normal_text(module['label'])), styles['h2']))
        for rec in ordered_records(module):
            key = (rec.get('title'), rec.get('organization'), rec.get('dates'))
            if key in seen:
                continue
            seen.add(key)
            title = rec.get('title', '') + (f" - {rec.get('organization', '')}" if rec.get('organization') else '')
            meta = ' | '.join(x for x in [rec.get('location', ''), rec.get('dates', '')] if x)
            block = [Paragraph(escape(normal_text(title)), styles['h3']), Paragraph(escape(normal_text(meta)), styles['meta'])]
            block += [Paragraph('- ' + escape(normal_text(b)), styles['bullet']) for b in rec.get('bullets', [])]
            story.append(KeepTogether(block)); story.append(Spacer(1, 3))
    story += [PageBreak(), Paragraph('Education', styles['h2'])]
    story += [Paragraph('- ' + escape(normal_text(x)), styles['bullet']) for x in education]
    story += [Paragraph('Training and credentials', styles['h2'])]
    story += [Paragraph('- ' + escape(normal_text(x)), styles['bullet']) for x in training]
    story += [Paragraph('Languages', styles['h2'])]
    story += [Paragraph('- ' + escape(normal_text(x)), styles['bullet']) for x in languages]
    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)


archive = downloads / 'saul-karim-nassau-complete-career-archive-cv.pdf'
archive_pdf(archive)
pdf_manifest['archive'] = {'path': str(archive.relative_to(ROOT)).replace('\\', '/'),
                           'pages': len(PdfReader(str(archive)).pages),
                           'sha256': hashlib.sha256(archive.read_bytes()).hexdigest(),
                           'design_system': 'professional-monochrome'}
(ROOT / 'data' / 'saul-cv-pdf-manifest.json').write_text(json.dumps(pdf_manifest, indent=2) + '\n', encoding='utf-8')

# Rebuild current-output archives.
all_zip = downloads / 'saul-karim-nassau-all-cv-outputs.zip'
with zipfile.ZipFile(all_zip, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for p in sorted(downloads.glob('saul-karim-nassau-*-cv*')):
        if p != all_zip:
            z.write(p, p.name)
for legacy_zip in [ROOT / 'cv-modular-onepage-samples-2026-07-09.zip', ROOT / 'cv-modular-onepage-samples-final-2026-07-09.zip']:
    with zipfile.ZipFile(legacy_zip, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for slug in modules:
            for suffix in ['cv.pdf', 'cv-ats.pdf', 'cv.txt']:
                p = downloads / f'saul-karim-nassau-{slug}-{suffix}'
                z.write(p, p.name)

# Governance, audit and verifier updates.
docs = ROOT / 'docs'; docs.mkdir(exist_ok=True)
(docs / 'SAUL_CV_VISUAL_GOVERNANCE_2026-07-16.md').write_text('''# Saul CV Visual Governance - 2026-07-16\n\n1. The webpage is the primary visual CV and uses the mild semantic spectrum.\n2. Every focused URL uses the same modular card and changes only the selected focus.\n3. Portrait, visible geometry, map and complete career archive remain part of the web experience.\n4. The page shows one primary professional-PDF action; ATS and text formats remain secondary.\n5. Additive combinations live inside one disclosure and remain shareable.\n6. The MA postnominal and academic material appear only when Education is selected.\n7. Downloaded PDFs use a separate professional monochrome design.\n8. PDFs contain no spectrum strip, role colour, decorative rainbow or geometry watermark.\n9. Structural, behavioural, palette or hierarchy changes require Saul's approval before implementation.\n10. Every new or regenerated webpage receives the shared visible-geometry contract.\n''', encoding='utf-8')

(docs / 'SAUL_CV_WEBSITE_AND_PDF_ALL_POV_AUDIT_2026-07-16.md').write_text('''# Saul CV Website and PDF - All-Perspective Critique and Revision\n\n## Website\n\n- Human reader: the previous overhaul repeated a focus dropdown, eight large cards, more-role links, download controls and tuning controls. The revised card uses one compact colour-coded focus rail, one live experience composition and one primary action.\n- Visual design: the site keeps its mild spectrum, portrait, translucent surface and geometry. Colour remains semantic on the website rather than becoming a decorative résumé treatment.\n- Recruiter: role, profile, selected experience and skills appear before download mechanics.\n- Applicant: every focused URL opens the same card with the correct view already selected.\n- Accessibility: native links, buttons, details and checkboxes preserve keyboard and screen-reader behaviour.\n- Mobile: the focus rail becomes a two-column compact grid and the preview becomes one column.\n- SEO: focused routes retain unique metadata, canonical URLs and ProfilePage/Person structured data.\n- Maintenance: all routes use one CSS file, one JavaScript file and one canonical data file.\n- Preservation: the map and complete archive remain in the ordinary main-page flow; duplicate archive download controls are removed.\n\n## PDFs\n\n- Hiring manager: the former rainbow/geometric PDF confused the website identity with an application document. The revised PDF uses one consistent professional monochrome template.\n- Visual hierarchy: name, role, contact, profile, experience, skills, credentials and languages have distinct levels without coloured boxes or decorative geometry.\n- Readability: the one-page role outputs use restrained density, a clear date rail and consistent typography.\n- ATS: all designed PDFs contain extractable text, and every focus retains a separate single-column ATS version and plain-text version.\n- Factuality: Montreal remains limited to the earlier Pizza Pizza crew role; the later Assistant Manager role remains Toronto; BUMI is corrected; Farsi is advanced; historical credentials remain labelled historical; latte art stays absent.\n- Academic scope: MA and education appear only in the Education output or an Education-selected web state.\n- Consistency: all 12 role focuses use the same professional template rather than role-specific colour styling.\n''', encoding='utf-8')

# Wrapper and portable generator.
(ROOT / 'scripts' / 'build-cv-pdf.js').write_text("""#!/usr/bin/env node\n'use strict';\nconst {spawnSync}=require('child_process');const path=require('path');\nconst r=spawnSync(process.env.PYTHON||'python3',[path.join(__dirname,'build-saul-cv-professional.py')],{stdio:'inherit'});\nprocess.exit(r.status===null?1:r.status);\n""", encoding='utf-8')

VERIFY_VISUAL = r'''#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');const root=path.resolve(__dirname,'..');const fail=[];
const h=fs.readFileSync(path.join(root,'saul','index.html'),'utf8');const css=fs.readFileSync(path.join(root,'saul','assets','saul-cv-spectrum-2026.css'),'utf8');const js=fs.readFileSync(path.join(root,'saul','assets','saul-cv-spectrum-2026.js'),'utf8');const data=JSON.parse(fs.readFileSync(path.join(root,'data','saul-cv-canonical-2026.json'),'utf8'));
const need=(hay,t,msg)=>{if(!hay.includes(t))fail.push(msg||`missing ${t}`)};
['data-cv-spectrum','cv-spectrum__rainbow','cv-spectrum__portrait','data-cv-designed','Other application formats','Combine focus areas','class="cv-map-section"','id="careerArchive"','data-geometry="indra-web"'].forEach(t=>need(h,t));
['--cv-gold','--cv-sky','--cv-green','--cv-teal','--cv-indigo','--cv-violet','--cv-rose','--cv-coral','@media print'].forEach(t=>need(css,t));
['routeFor','combineModules','data-cv-post','/saul/assets/saul-cv-canonical-2026.json'].forEach(t=>need(js,t));
if(h.includes('class="cv-v3"')||h.includes('saul-cv-v3.js'))fail.push('download-first v3 wrapper returned');
if((h.match(/<h1\b/g)||[]).length!==1)fail.push('main CV page must have exactly one H1');
if(!data.rules.website_mild_spectrum||!data.rules.pdf_professional_monochrome||data.rules.pdf_rainbow!==false)fail.push('visual/PDF separation rules missing');
for(const slug of Object.keys(data.modules)){const p=path.join(root,'saul','cv',slug,'index.html');if(!fs.existsSync(p)){fail.push(`missing route ${slug}`);continue}const x=fs.readFileSync(p,'utf8');['data-cv-spectrum','cv-spectrum__rainbow',`data-default-focus="${slug}"`,'data-geometry="indra-web"'].forEach(t=>{if(!x.includes(t))fail.push(`${slug} missing ${t}`)})}
if(fail.length){console.error('SAUL VISUAL GOVERNANCE FAILED');fail.forEach(x=>console.error(' - '+x));process.exit(1)}
console.log('SAUL VISUAL GOVERNANCE PASSED - mild spectrum remains web-only; all routes share one modular card; portrait, geometry, map and archive are preserved.');
'''
(ROOT / 'scripts' / 'verify-saul-visual-governance.js').write_text(VERIFY_VISUAL, encoding='utf-8')

VERIFY_PAGE = r'''#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');const root=path.resolve(__dirname,'..');const h=fs.readFileSync(path.join(root,'saul','index.html'),'utf8');const errors=[];
['data-cv-purpose="general-employment"','data-saul-modular-cv="true"','data-cv-spectrum','cv-spectrum__rainbow','src="/img/saul.jpg"','class="cv-map-section"','id="careerArchive"','data-cv-designed','data-cv-ats','data-cv-text','data-cv-print','data-cv-copy','Combine focus areas','Other application formats','saul-cv-spectrum-2026.js'].forEach(t=>{if(!h.includes(t))errors.push('missing '+t)});
if(h.includes('class="cv-v3"')||h.includes('saul-cv-v3.js'))errors.push('download-first v3 wrapper returned');if((h.match(/<h1\b/g)||[]).length!==1)errors.push('expected one H1');if(!/data-cv-designed[\s\S]{0,180}>Download professional PDF</.test(h))errors.push('professional PDF is not the visible primary action');
if(errors.length){console.error('Saul page guard failed');errors.forEach(e=>console.error(' - '+e));process.exit(1)}console.log('Saul page guard passed - one visual modular card, compact focus rail, professional download hierarchy, portrait, map and complete archive.');
'''
(ROOT / 'scripts' / 'verify-saul-page.js').write_text(VERIFY_PAGE, encoding='utf-8')

VERIFY_MOD = r'''#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');const root=path.resolve(__dirname,'..');const h=fs.readFileSync(path.join(root,'saul','index.html'),'utf8');const j=fs.readFileSync(path.join(root,'saul','assets','saul-cv-spectrum-2026.js'),'utf8');const d=JSON.parse(fs.readFileSync(path.join(root,'data','saul-cv-canonical-2026.json'),'utf8'));const f=[];
['data-cv-blend','Combine focus areas','routeFor','combineModules','history.pushState'].forEach(t=>{if(!(h+j).includes(t))f.push('missing '+t)});if(Object.keys(d.modules).length!==12)f.push('expected 12 focus modules');if(!d.rules.ma_only_with_education||d.rules.latte_art!==false)f.push('canonical rules drifted');
if(f.length){console.error('SAUL MODULAR CV CHECK FAILED');f.forEach(x=>console.error(' - '+x));process.exit(1)}console.log('SAUL MODULAR CV CHECK PASSED - compact focus selection, additive combinations, shareable routes and exact role-facing output.');
'''
(ROOT / 'scripts' / 'verify-saul-modular-cv.js').write_text(VERIFY_MOD, encoding='utf-8')

VERIFY_PRINT = r'''#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');const root=path.resolve(__dirname,'..');const m=JSON.parse(fs.readFileSync(path.join(root,'data','saul-cv-pdf-manifest.json'),'utf8'));const f=[];const css=fs.readFileSync(path.join(root,'saul','assets','saul-cv-spectrum-2026.css'),'utf8');
if(!css.includes('@media print'))f.push('missing print CSS');if(m.outputs.length!==24)f.push(`expected 24 role PDFs; found ${m.outputs.length}`);if(m.design_system!=='professional-monochrome')f.push('professional monochrome manifest missing');m.outputs.forEach(o=>{if(!fs.existsSync(path.join(root,o.path)))f.push('missing '+o.path);if(o.pages!==1)f.push(o.path+' is not one page');if(o.extractable_characters<700)f.push(o.path+' has weak text extraction');if(o.rainbow||o.geometry)f.push(o.path+' contains prohibited decorative design flags')});
if(f.length){console.error('SAUL PRINT/CV CHECK FAILED');f.forEach(x=>console.error(' - '+x));process.exit(1)}console.log('SAUL PRINT/CV CHECK PASSED - 12 professional monochrome and 12 ATS-safe one-page PDFs, extractable text and professional combined-view print CSS.');
'''
(ROOT / 'scripts' / 'verify-saul-print.js').write_text(VERIFY_PRINT, encoding='utf-8')

VERIFY_LAYOUT = r'''#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');const root=path.resolve(__dirname,'..');const m=JSON.parse(fs.readFileSync(path.join(root,'data','saul-cv-pdf-manifest.json'),'utf8'));const css=fs.readFileSync(path.join(root,'saul','assets','saul-cv-spectrum-2026.css'),'utf8');const f=[];
if(!css.includes('grid-template-columns:minmax(0,1.52fr) minmax(225px,.68fr)'))f.push('visual web preview grid missing');if(!css.includes('cv-spectrum__rainbow'))f.push('web spectrum missing');if(m.design_system!=='professional-monochrome')f.push('PDF design separation missing');for(const o of m.outputs){if(o.pages!==1)f.push(o.path+' exceeds one page')}
if(f.length){console.error('SAUL CV LAYOUT CHECK FAILED');f.forEach(x=>console.error(' - '+x));process.exit(1)}console.log('SAUL CV LAYOUT CHECK PASSED - visual spectrum website and separate professional monochrome one-page PDFs verified.');
'''
(ROOT / 'scripts' / 'verify-saul-cv-whitespace.js').write_text(VERIFY_LAYOUT, encoding='utf-8')

# Package script entry.
pkg_path = ROOT / 'package.json'
pkg = json.loads(pkg_path.read_text(encoding='utf-8'))
pkg['scripts']['build:saul-cv'] = 'node scripts/build-cv-pdf.js'
pkg['scripts']['verify:saul-visual'] = 'node scripts/verify-saul-visual-governance.js'
pkg_path.write_text(json.dumps(pkg, indent=2) + '\n', encoding='utf-8')

# Release report.
(ROOT / 'docs' / 'SAUL_CV_VISUAL_WEB_PROFESSIONAL_PDF_RELEASE_2026-07-16.md').write_text(f'''# Saul Visual Web / Professional PDF Release - 2026-07-16\n\n- Website: one mild-spectrum modular card shared by all 12 focused routes.\n- Website hierarchy: portrait and profile, compact focus rail, selected experience, skills, one professional-PDF action, secondary formats, optional combinations.\n- Main page: Writing titles receive a stable title column and descriptions receive the flexible column.\n- PDFs: 12 professional monochrome one-page PDFs, 12 ATS-safe one-page PDFs, 12 plain-text outputs and one complete archive PDF.\n- PDF spectrum/geometry: absent.\n- Education rule: MA and academic details appear only in the Education output or an Education-selected web state.\n- Current canonical release: `{canonical['release']}`.\n''', encoding='utf-8')

print('SAUL_CV_PROFESSIONAL_BUILD_COMPLETE')
