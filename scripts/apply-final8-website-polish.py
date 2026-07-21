#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from pathlib import Path
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
RELEASE = '2026-07-18-map-archive-interaction-final8'
ASSET_VERSION = '20260718-map-archive-final8'
MARKER = 'FINAL8_MAP_ARCHIVE_INTERACTION_POLISH'


def read(rel: str) -> str:
    return (ROOT / rel).read_text(encoding='utf-8', errors='replace')


def write(rel: str, text: str) -> None:
    path = ROOT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding='utf-8')


def soup_fragment(html: str):
    return BeautifulSoup(html, 'html.parser')


def patch_canonical() -> None:
    for rel in ['data/saul-cv-canonical-2026.json', 'saul/assets/saul-cv-canonical-2026.json']:
        path = ROOT / rel
        data = json.loads(path.read_text(encoding='utf-8'))
        data['release'] = RELEASE
        rules = data.setdefault('rules', {})
        rules.update({
            'map_on_main_cv': True,
            'focused_route_archive_bridge': True,
            'print_copy_inert_until_print': True,
            'archive_state_in_url': True,
            'minimum_primary_touch_target_css_px': 44,
            'geometry_structures_relationships': True,
            'sitewide_skip_links_extended': True,
        })
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')


def patch_card(section) -> None:
    if not section:
        return
    section['id'] = 'cvOverview'

    share = section.select_one('[data-cv-copy]')
    if share and not section.select_one('[data-cv-share-status]'):
        status = BeautifulSoup('<span class="cv-spectrum__status" data-cv-share-status aria-live="polite" aria-atomic="true"></span>', 'html.parser').span
        share.insert_after(status)

    print_jobs = section.select_one('[data-cv-print-jobs]')
    if print_jobs:
        template = BeautifulSoup('<template data-cv-print-template></template>', 'html.parser').template
        inner = ''.join(str(x) for x in print_jobs.contents)
        template.append(BeautifulSoup(inner, 'html.parser'))
        print_jobs.replace_with(template)
    elif not section.select_one('[data-cv-print-template]'):
        template = BeautifulSoup('<template data-cv-print-template></template>', 'html.parser').template
        jobs = section.select_one('[data-cv-jobs]')
        if jobs:
            template.append(BeautifulSoup(''.join(str(x) for x in jobs.contents), 'html.parser'))
            jobs.insert_after(template)

    tune_body = section.select_one('.cv-spectrum__tune-body')
    if tune_body and not tune_body.select_one('[data-cv-selection-count]'):
        counter = BeautifulSoup('<p class="cv-spectrum__selection-count" data-cv-selection-count aria-live="polite">Choose focus areas to combine.</p>', 'html.parser').p
        fieldset = tune_body.find('fieldset')
        if fieldset:
            fieldset.insert_before(counter)
        else:
            tune_body.append(counter)


def patch_cards_in_file(rel: str) -> None:
    path = ROOT / rel
    soup = BeautifulSoup(path.read_text(encoding='utf-8', errors='replace'), 'html.parser')
    patch_card(soup.select_one('[data-cv-spectrum]'))
    path.write_text(str(soup), encoding='utf-8')


FINAL8_CSS = r'''

/* FINAL8_MAP_ARCHIVE_INTERACTION_POLISH
   Geometry now structures the movement from focused CV to map to complete archive.
   Application PDFs remain professional monochrome through the existing print rules. */
:root{--cv-focus:#665A78}
.cv-spectrum{scroll-margin-top:5.5rem}
.cv-spectrum__focus-heading{position:relative}
.cv-spectrum__focus-heading button,.cv-spectrum__lens,.cv-spectrum__actions>a,.cv-spectrum__actions summary,.cv-spectrum__actions button,.cv-spectrum__tune>summary,.cv-spectrum__blend-chip{min-height:44px}
.cv-spectrum__focus-heading button{min-width:44px;padding:.65rem .25rem}
.cv-spectrum__lens{transition:transform .18s ease,background-color .18s ease,border-color .18s ease,box-shadow .18s ease}
.cv-spectrum__lens:hover{transform:translateY(-1px)}
.cv-spectrum__lens[aria-current="page"]>span{transform:scale(1.18);box-shadow:0 0 0 5px color-mix(in srgb,var(--lens) 14%,transparent)}
.cv-spectrum__job-meta{font-size:.7rem}.cv-spectrum__job ul{font-size:.82rem}.cv-spectrum__credentials{font-size:.79rem}
.cv-spectrum__status{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap}
.cv-spectrum__focus-heading.is-copied::after{content:"Link copied";position:absolute;right:0;bottom:-1.45rem;padding:.28rem .5rem;border-radius:999px;background:var(--cv-paper-solid);border:1px solid var(--cv-rule);color:var(--focus-ink);font:750 .62rem/1 var(--sans,system-ui);letter-spacing:.04em;box-shadow:0 5px 14px rgba(0,0,0,.08)}
.cv-spectrum__selection-count{margin:.15rem 0 .8rem;color:var(--focus-ink);font:750 .7rem/1.45 var(--sans,system-ui)}
.cv-spectrum__print-jobs{display:none}

.cv-local-nav{position:sticky;top:.72rem;z-index:90;display:flex;align-items:center;gap:.35rem;width:min(1100px,calc(100vw - 2rem));margin:0 auto 1rem;padding:.35rem;border:1px solid var(--cv-rule);border-radius:999px;background:color-mix(in srgb,var(--cv-paper-solid) 88%,transparent);box-shadow:0 10px 26px rgba(25,30,33,.08);backdrop-filter:blur(14px);overflow-x:auto;scrollbar-width:none}
.cv-local-nav::-webkit-scrollbar{display:none}.cv-local-nav a{position:relative;display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:.55rem .82rem;border-radius:999px;color:var(--cv-muted);font:750 .67rem/1 var(--sans,system-ui);letter-spacing:.055em;text-decoration:none;white-space:nowrap}.cv-local-nav a:hover,.cv-local-nav a[aria-current="location"]{background:color-mix(in srgb,var(--cv-focus) 9%,white);color:color-mix(in srgb,var(--cv-focus) 82%,#182126)}.cv-local-nav a[aria-current="location"]::after{content:"";position:absolute;left:28%;right:28%;bottom:.32rem;height:2px;border-radius:2px;background:var(--cv-focus)}

.cv-route-bridge{--bridge-focus:var(--focus,var(--cv-focus));position:relative;isolation:isolate;width:min(1100px,calc(100vw - 2rem));margin:0 auto 4rem;padding:clamp(1.35rem,3.4vw,2.5rem);overflow:hidden;border:1px solid color-mix(in srgb,var(--bridge-focus) 28%,var(--cv-rule));border-radius:30px;background:linear-gradient(135deg,rgba(255,255,255,.78),color-mix(in srgb,var(--bridge-focus) 5%,rgba(250,246,239,.72)));box-shadow:0 20px 52px rgba(30,34,37,.09);color:var(--cv-ink)}
.cv-route-bridge::before{content:"";position:absolute;inset:0;z-index:-2;background:linear-gradient(90deg,var(--bridge-focus),transparent 42%) top left/100% 4px no-repeat}
.cv-route-bridge__geometry{position:absolute;inset:-35% -4% -48% 48%;z-index:-1;opacity:.16;color:var(--bridge-focus);pointer-events:none}.cv-route-bridge__geometry svg{width:100%;height:100%;overflow:visible}.cv-route-bridge__geometry circle,.cv-route-bridge__geometry path{fill:none;stroke:currentColor;vector-effect:non-scaling-stroke}.cv-route-bridge__geometry circle{stroke-width:1}.cv-route-bridge__geometry path{stroke-width:1.4;stroke-dasharray:4 7}
.cv-route-bridge__grid{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(230px,.55fr);gap:clamp(1.2rem,4vw,3rem);align-items:end}.cv-route-bridge__eyebrow,.cv-map-companion__eyebrow{display:block;margin-bottom:.55rem;color:color-mix(in srgb,var(--bridge-focus,var(--cv-focus)) 80%,#172126);font:800 .66rem/1 var(--sans,system-ui);letter-spacing:.13em;text-transform:uppercase}.cv-route-bridge h2{max-width:17ch;margin:0;font:500 clamp(2rem,4.4vw,3.65rem)/.98 var(--serif,Georgia,serif);letter-spacing:-.035em}.cv-route-bridge__copy{max-width:63ch;margin:.85rem 0 1.15rem;color:var(--cv-muted);font-size:clamp(.9rem,1.15vw,1rem);line-height:1.68}.cv-route-bridge__actions{display:flex;flex-wrap:wrap;gap:.6rem}.cv-route-bridge__actions a{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:.72rem 1rem;border:1px solid color-mix(in srgb,var(--bridge-focus) 70%,#172126);border-radius:999px;color:color-mix(in srgb,var(--bridge-focus) 82%,#172126);font:780 .72rem/1.1 var(--sans,system-ui);text-decoration:none}.cv-route-bridge__actions a:first-child{background:color-mix(in srgb,var(--bridge-focus) 82%,#172126);color:#fff}.cv-route-bridge__current{padding:1rem 1.05rem;border-left:1px solid color-mix(in srgb,var(--bridge-focus) 34%,var(--cv-rule));background:rgba(255,255,255,.3)}.cv-route-bridge__current span{display:block;color:var(--cv-muted);font:750 .62rem/1 var(--sans,system-ui);letter-spacing:.1em;text-transform:uppercase}.cv-route-bridge__current strong{display:block;margin:.38rem 0 .42rem;font:600 1.15rem/1.25 var(--serif,Georgia,serif)}.cv-route-bridge__current p{margin:0;color:var(--cv-muted);font:.72rem/1.5 var(--sans,system-ui)}

.cv-map-section.cv-map-section--enhanced{position:relative;scroll-margin-top:5.5rem;max-width:1100px;margin:0 auto;padding:clamp(2.4rem,6vw,5rem) 0;isolation:isolate}.cv-map-section--enhanced::before{content:"";position:absolute;z-index:-2;inset:12% -18% -4%;background:radial-gradient(circle at 22% 34%,color-mix(in srgb,var(--cv-focus) 10%,transparent),transparent 35%),radial-gradient(circle at 80% 70%,color-mix(in srgb,var(--cv-teal) 8%,transparent),transparent 34%);pointer-events:none}.cv-map-orbit{position:absolute;z-index:-1;inset:0;pointer-events:none;opacity:.17;color:var(--cv-focus)}.cv-map-orbit::before,.cv-map-orbit::after{content:"";position:absolute;border:1px solid currentColor;border-radius:50%}.cv-map-orbit::before{width:clamp(250px,44vw,520px);aspect-ratio:1;right:-9%;top:2%}.cv-map-orbit::after{width:clamp(110px,18vw,220px);aspect-ratio:1;right:12%;top:28%;box-shadow:0 0 0 32px color-mix(in srgb,currentColor 5%,transparent),0 0 0 82px color-mix(in srgb,currentColor 3%,transparent)}
.cv-map-shell{padding:clamp(1.2rem,3.3vw,2.35rem);border:1px solid color-mix(in srgb,var(--cv-focus) 25%,var(--cv-rule));border-radius:30px;background:linear-gradient(145deg,rgba(255,255,255,.73),rgba(250,246,239,.58));box-shadow:0 24px 64px rgba(30,34,37,.09);backdrop-filter:blur(12px)}.cv-map-section--enhanced .section-intro{display:grid;grid-template-columns:minmax(0,.9fr) minmax(260px,.7fr);gap:1.5rem;align-items:end;margin-bottom:1.25rem}.cv-map-section--enhanced .section-intro h2{margin:.3rem 0 0;font-size:clamp(2rem,4.2vw,3.65rem);line-height:.98;letter-spacing:-.035em}.cv-map-section--enhanced .section-intro>p{max-width:46ch;margin:0;color:var(--cv-muted);line-height:1.65}.cv-map-grid{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(245px,.55fr);gap:1rem;align-items:stretch}.cv-map-stage{position:relative;min-height:440px;border:1px solid var(--cv-rule);border-radius:23px;overflow:hidden;background:linear-gradient(135deg,color-mix(in srgb,var(--cv-focus) 7%,#f8f5ef),#f4f1eb)}.cv-map-loading{position:absolute;inset:0;display:grid;place-items:center;margin:0;color:var(--cv-muted);font:750 .69rem/1.4 var(--sans,system-ui);letter-spacing:.08em;text-transform:uppercase}.cv-map-stage.is-loaded .cv-map-loading{opacity:0;visibility:hidden}.cv-map-embed{height:100%;min-height:440px;margin:0;border:0;border-radius:inherit;overflow:hidden}.cv-map-embed iframe{display:block;width:100%;height:100%;min-height:440px;border:0;filter:saturate(.82) contrast(.97);opacity:0;transition:opacity .24s ease}.cv-map-stage.is-loaded iframe{opacity:1}.cv-map-companion{display:flex;flex-direction:column;padding:1.1rem;border:1px solid var(--cv-rule);border-radius:23px;background:rgba(255,255,255,.4)}.cv-map-companion h3{margin:.1rem 0 .55rem;font:600 1.35rem/1.15 var(--serif,Georgia,serif)}.cv-map-companion>p{margin:0 0 .9rem;color:var(--cv-muted);font:.78rem/1.55 var(--sans,system-ui)}.cv-map-threads{list-style:none;margin:0;padding:0;display:grid;gap:.4rem}.cv-map-threads a{display:grid;grid-template-columns:10px 1fr auto;gap:.55rem;align-items:center;min-height:44px;padding:.55rem .6rem;border:1px solid transparent;border-radius:12px;color:var(--cv-ink);font:700 .72rem/1.25 var(--sans,system-ui);text-decoration:none}.cv-map-threads a::before{content:"";width:8px;height:8px;border-radius:50%;background:var(--thread,var(--cv-focus));box-shadow:0 0 0 4px color-mix(in srgb,var(--thread,var(--cv-focus)) 10%,transparent)}.cv-map-threads a::after{content:"→";color:var(--thread,var(--cv-focus))}.cv-map-threads a:hover{background:color-mix(in srgb,var(--thread,var(--cv-focus)) 7%,white);border-color:color-mix(in srgb,var(--thread,var(--cv-focus)) 28%,transparent)}.cv-map-companion__actions{margin-top:auto;padding-top:1rem;display:grid;gap:.55rem}.cv-map-companion__actions>a,.cv-map-companion details>summary{display:flex;align-items:center;justify-content:center;min-height:44px;padding:.65rem .8rem;border:1px solid color-mix(in srgb,var(--cv-focus) 55%,var(--cv-rule));border-radius:999px;color:color-mix(in srgb,var(--cv-focus) 82%,#172126);font:780 .7rem/1.2 var(--sans,system-ui);text-align:center;text-decoration:none;cursor:pointer;list-style:none}.cv-map-companion details>summary::-webkit-details-marker{display:none}.cv-map-location-list{margin:.65rem 0 0;padding-left:1.1rem;color:var(--cv-muted);font:.7rem/1.55 var(--sans,system-ui)}

.archive-shell{scroll-margin-top:5.5rem}.archive-count{margin:.45rem 0 0;color:color-mix(in srgb,var(--cv-focus) 78%,#172126);font:780 .7rem/1.4 var(--sans,system-ui);letter-spacing:.045em}.archive-shell .view-switcher button,.archive-shell .filter-nav button,.archive-shell .archive-tools>summary{min-height:44px}.archive-shell details.cv-section{border:0}.archive-shell details.cv-section>summary.section-head{position:relative;display:flex;align-items:center;justify-content:space-between;gap:1rem;min-height:44px;cursor:pointer;list-style:none}.archive-shell details.cv-section>summary.section-head::-webkit-details-marker{display:none}.archive-shell details.cv-section>summary.section-head::after{content:"−";display:grid;place-items:center;width:28px;height:28px;border:1px solid var(--rule,var(--cv-rule));border-radius:50%;font:700 .8rem/1 var(--sans,system-ui)}.archive-shell details.cv-section:not([open])>summary.section-head::after{content:"+"}.archive-shell details.cv-section:not([open])>summary.section-head{margin-bottom:.25rem}.cv-return-focus{display:inline-flex;align-items:center;justify-content:center;min-height:44px;margin:2.2rem 0 0;padding:.7rem 1rem;border:1px solid color-mix(in srgb,var(--cv-focus) 52%,var(--cv-rule));border-radius:999px;color:color-mix(in srgb,var(--cv-focus) 82%,#172126);font:780 .7rem/1 var(--sans,system-ui);text-decoration:none}

.page>.cv-local-nav,.page>.cv-route-bridge,.page>.cv-map-section--enhanced{width:min(1100px,calc(100vw - 2rem));max-width:none;margin-left:50%;transform:translateX(-50%)}
.section-count{margin-left:auto;padding:.18rem .5rem;border:1px solid color-mix(in srgb,var(--cv-focus) 24%,var(--cv-rule));border-radius:999px;color:var(--cv-muted);font:750 .62rem/1 var(--sans,system-ui)}
:root[data-theme="dark"] .cv-local-nav,:root.dark .cv-local-nav,:root[data-theme="dark"] .cv-route-bridge,:root.dark .cv-route-bridge,:root[data-theme="dark"] .cv-map-shell,:root.dark .cv-map-shell{background:color-mix(in srgb,var(--bg-soft,#191713) 90%,transparent);color:var(--fg,#f1ece5)}
:root[data-theme="dark"] .cv-map-companion,:root.dark .cv-map-companion{background:rgba(255,255,255,.035)}

@media(max-width:820px){.cv-route-bridge__grid,.cv-map-grid,.cv-map-section--enhanced .section-intro{grid-template-columns:minmax(0,1fr)}.cv-route-bridge__current{border-left:0;border-top:1px solid color-mix(in srgb,var(--bridge-focus) 34%,var(--cv-rule))}.cv-map-stage,.cv-map-embed,.cv-map-embed iframe{min-height:390px}.cv-map-companion__actions{margin-top:1rem}.cv-local-nav{top:.55rem}}
@media(max-width:560px){.page>.cv-local-nav,.page>.cv-route-bridge,.page>.cv-map-section--enhanced{width:calc(100vw - 1rem);margin-left:50%;transform:translateX(-50%)}.cv-local-nav{width:calc(100vw - 1rem);margin-bottom:.75rem}.cv-local-nav a{padding:.52rem .72rem}.cv-spectrum__focus-heading{align-items:center}.cv-spectrum__focus-heading button{max-width:11rem;text-align:right}.cv-route-bridge{width:calc(100vw - 1rem);border-radius:22px}.cv-route-bridge__actions{display:grid}.cv-route-bridge__actions a{width:100%}.cv-map-section.cv-map-section--enhanced{padding:2.2rem .5rem}.cv-map-shell{padding:.8rem;border-radius:22px}.cv-map-stage,.cv-map-embed,.cv-map-embed iframe{min-height:330px}.cv-map-companion{border-radius:18px}.cv-map-orbit{display:none}}
@media(prefers-reduced-motion:reduce){.cv-spectrum__lens,.cv-map-embed iframe{transition:none}.cv-spectrum__lens:hover{transform:none}}
@media print{.cv-local-nav,.cv-route-bridge,.cv-map-section--enhanced,.cv-return-focus{display:none!important}.cv-spectrum__experience>[data-cv-jobs]{display:none!important}.cv-spectrum__print-jobs{display:block!important}.archive-shell details.cv-section{display:block!important}.archive-shell details.cv-section>*{display:block!important}}
'''


FINAL8_JS = r'''(() => {
  'use strict';
  const root = document.querySelector('[data-cv-spectrum]');
  if (!root) return;
  const dataUrl = '/saul/assets/saul-cv-canonical-2026.json';
  let data = null;
  let selected = [];
  let printJobs = null;
  const unique = values => [...new Set(values.filter(Boolean))];
  const escapeHTML = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
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
  const comboKey = values => [...values].sort().join('+');
  const COMBINATION_PROFILES = {
    'performance+teaching': 'Educator and performer combining classroom facilitation, improvisation, presentation, audience awareness, and youth engagement.',
    'programs+teaching': 'Educator and program coordinator combining curriculum, facilitation, events, stakeholder communication, and practical delivery.',
    'programs+research': 'Research and program professional combining evaluation, reporting, coordination, budgeting, partnerships, and public communication.',
    'arts-culture+performance': 'Arts and performance professional with stage, screen, cultural research, public presentation, and festival experience.',
    'community+programs': 'Community and program professional combining partnerships, fundraising, volunteer coordination, events, and public service.',
    'hospitality+programs': 'Hospitality and program professional combining high-volume service, team support, events, scheduling, and practical coordination.',
    'customer-education+teaching': 'Education and learner-support professional combining teaching, onboarding, workshops, clear guidance, and responsive communication.',
    'education+research': 'Education researcher combining mixed-method inquiry, curriculum assessment, source synthesis, reporting, and teaching practice.',
    'portfolio+research': 'Independent project and research professional combining source verification, public information, editorial systems, and digital delivery.',
    'portfolio+teaching': 'Educator and independent project builder creating teaching resources, public learning formats, curriculum tools, and accessible digital materials.',
    'community+volunteer-events': 'Community and volunteer coordinator with fundraising, logistics, accessibility support, public events, and cross-cultural service experience.'
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
    const exact = COMBINATION_PROFILES[comboKey(values)];
    const list = chosen.map(x => x.label.toLowerCase());
    const joined = list.length > 2 ? `${list.slice(0,-1).join(', ')}, and ${list.at(-1)}` : list.join(' and ');
    const profile = exact || `Professional working across ${joined}, with strengths in ${skills.slice(0,3).map(x => x.toLowerCase()).join(', ')}.`;
    return { label, short: label, color: chosen[0].color, profile, skills, credentials, records: sortRecords(records), downloads: chosen[0].downloads, combined: true };
  };
  const jobHTML = r => {
    const title = r.url ? `<a href="${escapeHTML(r.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(r.title)}</a>` : escapeHTML(r.title);
    const org = r.organization ? ` <span>- ${escapeHTML(r.organization)}</span>` : '';
    const meta = [r.location, r.dates].filter(Boolean).map(escapeHTML).join(' · ');
    const bullets = (r.bullets || []).slice(0, 2).map(x => `<li>${escapeHTML(x)}</li>`).join('');
    return `<article class="cv-spectrum__job"><h4>${title}${org}</h4><p class="cv-spectrum__job-meta">${meta}</p><ul>${bullets}</ul></article>`;
  };
  const preparePrintJobs = () => {
    if (printJobs?.isConnected) return printJobs;
    const template = root.querySelector('[data-cv-print-template]');
    const screen = root.querySelector('[data-cv-jobs]');
    if (!template || !screen) return null;
    printJobs = document.createElement('div');
    printJobs.className = 'cv-spectrum__print-jobs';
    printJobs.dataset.cvPrintJobs = '';
    printJobs.setAttribute('aria-hidden', 'true');
    printJobs.innerHTML = template.innerHTML;
    screen.insertAdjacentElement('afterend', printJobs);
    return printJobs;
  };
  const clearPrintJobs = () => { if (printJobs?.isConnected) printJobs.remove(); printJobs = null; };
  const render = () => {
    const module = combineModules(selected);
    root.style.setProperty('--focus', module.color || '#665A78');
    document.documentElement.style.setProperty('--cv-focus', module.color || '#665A78');
    root.querySelectorAll('[data-cv-role],[data-cv-current]').forEach(el => el.textContent = module.label);
    root.querySelector('[data-cv-profile]').textContent = module.profile;
    root.querySelector('[data-cv-name]').firstChild.nodeValue = data.contact.name;
    root.querySelector('[data-cv-post]').textContent = selected.includes('education') ? ', MA' : '';
    root.querySelector('[data-cv-skills]').innerHTML = (module.skills || []).slice(0, 10).map(x => `<li>${escapeHTML(x)}</li>`).join('');
    const creds = unique([...(module.credentials || []), ...data.languages]);
    if (selected.includes('education')) creds.unshift(...data.education);
    root.querySelector('[data-cv-credentials]').textContent = unique(creds).slice(0, 9).join(' · ');
    root.querySelector('[data-cv-jobs]').innerHTML = sortRecords(module.records).slice(0, 5).map(jobHTML).join('');
    const template = root.querySelector('[data-cv-print-template]');
    if (template) template.innerHTML = sortRecords(module.records).slice(0, 7).map(jobHTML).join('');
    clearPrintJobs();
    root.querySelectorAll('[data-focus-slug]').forEach(el => {
      const on = selected.length === 1 ? el.dataset.focusSlug === selected[0] : (!selected.length && el.dataset.focusSlug === 'general');
      if (on) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current');
    });
    root.querySelectorAll('[data-cv-blend]').forEach(box => box.checked = selected.includes(box.value));
    const count = root.querySelector('[data-cv-selection-count]');
    if (count) count.textContent = selected.length === 0 ? 'Choose focus areas to combine.' : selected.length === 1 ? '1 area selected. Choose one more area for a combined view.' : `${selected.length} areas selected. Combined view ready.`;
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
      designed.href = routeFor(selected); designed.textContent = 'Save combined view as PDF';
      designed.onclick = event => { event.preventDefault(); preparePrintJobs(); requestAnimationFrame(() => window.print()); };
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
  root.querySelectorAll('[data-cv-blend]').forEach(box => box.addEventListener('change', () => setSelected([...root.querySelectorAll('[data-cv-blend]:checked')].map(x => x.value))));
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
    const status = root.querySelector('[data-cv-share-status]');
    if (status) status.textContent = copied ? 'Link copied.' : 'Copy the address from the browser bar.';
    const heading = button.closest('.cv-spectrum__focus-heading');
    if (copied && heading) { heading.classList.add('is-copied'); setTimeout(() => heading.classList.remove('is-copied'), 1600); }
  });
  root.querySelector('[data-cv-print]')?.addEventListener('click', () => { preparePrintJobs(); requestAnimationFrame(() => window.print()); });
  addEventListener('beforeprint', preparePrintJobs);
  addEventListener('afterprint', clearPrintJobs);
  addEventListener('popstate', () => { selected = pathFocus(); render(); });

  const mapFrame = document.querySelector('[data-cv-map-frame]');
  if (mapFrame) {
    const stage = mapFrame.closest('[data-cv-map-stage]');
    const loaded = () => stage?.classList.add('is-loaded');
    mapFrame.addEventListener('load', loaded, {once:true});
    if (mapFrame.contentDocument?.readyState === 'complete') loaded();
  }
  const localNav = document.querySelector('[data-cv-local-nav]');
  if (localNav && 'IntersectionObserver' in window) {
    const links = [...localNav.querySelectorAll('a[href^="#"]')];
    const sections = links.map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);
    const byId = new Map(links.map(a => [a.getAttribute('href').slice(1), a]));
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(e => e.isIntersecting).sort((a,b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      links.forEach(a => a.removeAttribute('aria-current'));
      byId.get(visible.target.id)?.setAttribute('aria-current', 'location');
    }, {rootMargin:'-18% 0px -68% 0px', threshold:[0,.1,.4]});
    sections.forEach(section => observer.observe(section));
  }
  fetch(dataUrl, {credentials:'same-origin'}).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).then(d => { data = d; selected = pathFocus(); render(); }).catch(err => console.error('CV data failed to load', err));
})();
'''


def patch_shared_assets() -> None:
    css_path = ROOT / 'saul/assets/saul-cv-spectrum-2026.css'
    css = css_path.read_text(encoding='utf-8')
    if MARKER in css:
        css = css.split('/* FINAL8_MAP_ARCHIVE_INTERACTION_POLISH', 1)[0].rstrip() + '\n'
    css_path.write_text(css + FINAL8_CSS, encoding='utf-8')
    write('saul/assets/saul-cv-spectrum-2026.js', FINAL8_JS)


def route_bridge_html(label: str, slug: str, color: str) -> str:
    return f'''<section class="cv-route-bridge" aria-labelledby="routeArchiveTitle" style="--bridge-focus:{color}">
      <div class="cv-route-bridge__geometry" aria-hidden="true"><svg viewBox="0 0 620 430" role="presentation"><circle cx="380" cy="215" r="172"/><circle cx="380" cy="215" r="104"/><circle cx="380" cy="215" r="38"/><circle cx="252" cy="112" r="31"/><circle cx="492" cy="118" r="31"/><circle cx="506" cy="310" r="31"/><path d="M34 333 C168 333 190 102 326 153 S485 366 604 225"/></svg></div>
      <div class="cv-route-bridge__grid">
        <div><span class="cv-route-bridge__eyebrow">Complete career archive</span><h2 id="routeArchiveTitle">Explore the full work record</h2><p class="cv-route-bridge__copy">Open the main CV to view the map, timeline, every focus area, and additive role combinations.</p><div class="cv-route-bridge__actions"><a href="/saul/?focus={slug}#careerArchive">Open full CV</a><a href="/saul/?focus={slug}#places">View places behind the work</a></div></div>
        <aside class="cv-route-bridge__current" aria-label="Current focused view"><span>Current view</span><strong>{label}</strong><p>This focused route stays shareable while the main archive preserves the wider record.</p></aside>
      </div>
    </section>'''


def patch_focused_routes() -> None:
    data = json.loads(read('data/saul-cv-canonical-2026.json'))
    routes = [(slug, f'saul/cv/{slug}/index.html') for slug in data['modules']]
    routes.append(('hospitality', 'saul/hospitality/index.html'))
    for slug, rel in routes:
        path = ROOT / rel
        soup = BeautifulSoup(path.read_text(encoding='utf-8', errors='replace'), 'html.parser')
        patch_card(soup.select_one('[data-cv-spectrum]'))
        old = soup.select_one('.cv-map-section, .cv-route-bridge')
        frag = BeautifulSoup(route_bridge_html(data['modules'][slug]['label'], slug, data['modules'][slug]['color']), 'html.parser')
        if old:
            old.replace_with(frag)
        else:
            main = soup.find('main')
            if main:
                main.append(frag)
        for tag in soup.find_all(['link','script']):
            attr = 'href' if tag.name == 'link' else 'src'
            value = tag.get(attr, '')
            if 'saul-cv-spectrum-2026.' in value:
                tag[attr] = re.sub(r'\?v=[^"\']+', f'?v={ASSET_VERSION}', value)
        path.write_text(str(soup), encoding='utf-8')


def enhanced_map_html(iframe) -> str:
    src = iframe.get('src', 'https://www.google.com/maps/d/embed?mid=1n92i0SyhgddNp4TZjLFW8GW6Nzk9JH1B&ehbc=2E312F')
    viewer = src.replace('/embed?', '/viewer?')
    return f'''<section aria-labelledby="cvMapTitle" class="cv-map-section cv-map-section--enhanced" id="places">
      <div class="cv-map-orbit" aria-hidden="true"></div>
      <div class="cv-map-shell">
        <div class="section-intro"><div><span class="archive-eyebrow" data-profile="mapEyebrow">Work, study, and travel</span><h2 data-profile="mapTitle" id="cvMapTitle">Places behind the work</h2></div><p data-profile="mapText">Locations connected to paid work, teaching, community programs, service, study, travel, and independent projects.</p></div>
        <div class="cv-map-grid">
          <div class="cv-map-stage" data-cv-map-stage><p class="cv-map-loading" role="status">Interactive map loading</p><div class="cv-map-embed"><iframe data-cv-map-frame height="480" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="{src}" title="Saul Karim Nassau work, study, service, and travel map" width="640"></iframe></div><noscript><p><a href="{viewer}" target="_blank" rel="noopener noreferrer">Open the full map</a></p></noscript></div>
          <aside class="cv-map-companion" aria-label="Map legend and connected archive views"><span class="cv-map-companion__eyebrow">Location threads</span><h3>Follow the work across places</h3><p>Use the map for geography, then open the connected archive view for the work behind each thread.</p>
            <ul class="cv-map-threads">
              <li><a style="--thread:var(--cv-sky)" href="/saul/?archive=teaching,education#careerArchive">Teaching and study</a></li>
              <li><a style="--thread:var(--cv-green)" href="/saul/?archive=community,volunteer#careerArchive">Community and service</a></li>
              <li><a style="--thread:var(--cv-gold)" href="/saul/?archive=kitchen#careerArchive">Hospitality</a></li>
              <li><a style="--thread:var(--cv-violet)" href="/saul/?archive=performance#careerArchive">Stage and screen</a></li>
              <li><a style="--thread:var(--cv-coral)" href="/saul/?archive=portfolio#careerArchive">Independent projects</a></li>
            </ul>
            <div class="cv-map-companion__actions"><a href="{viewer}" target="_blank" rel="noopener noreferrer">Open full interactive map ↗</a><details><summary>Text location list</summary><ul class="cv-map-location-list"><li>Toronto and Markham</li><li>Montreal and Vancouver</li><li>China and Switzerland</li><li>Serbia and Croatia</li><li>Florence, Egypt, Copenhagen, and the Azores</li></ul></details></div>
          </aside>
        </div>
      </div>
    </section>'''


def replace_js_function(raw: str, name: str, replacement: str, next_marker: str) -> str:
    start = raw.find(f'function {name}(')
    if start < 0:
        raise RuntimeError(f'Cannot find function {name}')
    end = raw.find(next_marker, start)
    if end < 0:
        raise RuntimeError(f'Cannot find marker after {name}: {next_marker}')
    return raw[:start] + replacement.rstrip() + '\n\n' + raw[end:]


def patch_main_saul() -> None:
    rel = 'saul/index.html'
    path = ROOT / rel
    raw = path.read_text(encoding='utf-8', errors='replace')
    soup = BeautifulSoup(raw, 'html.parser')
    main = soup.find('main')
    card = soup.select_one('[data-cv-spectrum]')
    patch_card(card)

    old_nav = soup.select_one('[data-cv-local-nav]')
    if old_nav:
        old_nav.decompose()
    local = BeautifulSoup('''<nav class="cv-local-nav" data-cv-local-nav aria-label="CV sections"><a href="#cvOverview" aria-current="location">CV</a><a href="#places">Map</a><a href="#careerArchive">Timeline</a><a href="#eduHead">Education</a><a href="#methodsHead">Methods</a></nav>''', 'html.parser')
    if card:
        card.insert_before(local)

    old_map = soup.select_one('.cv-map-section')
    if old_map:
        iframe = old_map.find('iframe')
        old_map.replace_with(BeautifulSoup(enhanced_map_html(iframe), 'html.parser'))

    archive_heading = soup.select_one('#careerArchive .archive-heading')
    if archive_heading and not soup.select_one('#archiveCount'):
        count = soup.new_tag('p')
        count['class'] = ['archive-count']
        count['id'] = 'archiveCount'
        count['aria-live'] = 'polite'
        count['aria-atomic'] = 'true'
        count.string = 'Loading archive count.'
        archive_heading.append(count)

    footer = soup.select_one('#careerArchive .cv-footer')
    if footer and not soup.select_one('.cv-return-focus'):
        ret = soup.new_tag('a', href='#cvOverview')
        ret['class'] = ['cv-return-focus']
        ret.string = 'Return to current CV focus ↑'
        footer.insert_before(ret)

    for tag in soup.find_all(['link','script']):
        attr = 'href' if tag.name == 'link' else 'src'
        value = tag.get(attr, '')
        if 'saul-cv-spectrum-2026.' in value:
            tag[attr] = re.sub(r'\?v=[^"\']+', f'?v={ASSET_VERSION}', value)
    raw = str(soup)

    parse_route = r'''function parseRoute() {
  const out = [];
  const seen = new Set();
  const add = (s) => {
    if (!s) return;
    const k = normalizeCatSlug(s);
    if (k && k in CATS && !seen.has(k)) { seen.add(k); out.push(k); }
  };
  const search = new URLSearchParams(window.location.search);
  const qArchive = search.get('archive') || search.get('cat');
  if (qArchive) qArchive.split(',').forEach(add);
  if (!qArchive) {
    const path = window.location.pathname;
    const pathMatch = path.match(/^\/(saul|cv)(?:\/(.*))?$/i);
    if (pathMatch && pathMatch[2]) pathMatch[2].split('/').forEach(add);
  }
  const h = window.location.hash.slice(1);
  const pageAnchors = new Set(['cvOverview','places','cvMapTitle','careerArchive','archiveTitle','eduHead','methodsHead','page','main-content']);
  if (h && !pageAnchors.has(h)) h.split(/[+,]/).forEach(add);
  return out;
}'''
    raw = replace_js_function(raw, 'parseRoute', parse_route, '// Language from URL:')

    sync = r'''function syncUrlToFilter() {
  const cats = [...active].sort();
  const url = new URL(window.location.href);
  url.pathname = '/saul/';
  url.searchParams.delete('cat');
  if (cats.length) url.searchParams.set('archive', cats.map(catSlug).join(','));
  else url.searchParams.delete('archive');
  if (lang && lang !== 'en') url.searchParams.set('lang', lang);
  else url.searchParams.delete('lang');
  if (cvMode === 'theme') url.searchParams.set('mode', 'theme');
  else url.searchParams.delete('mode');
  const target = url.pathname + (url.search ? url.search : '') + (url.hash ? url.hash : '');
  if (window.location.pathname + window.location.search + window.location.hash !== target) {
    try { window.history.replaceState({ cats, lang, mode: cvMode }, '', target); } catch (e) {}
  }
}'''
    raw = replace_js_function(raw, 'syncUrlToFilter', sync, '// ===========================================================================\n// METHODS')

    # Archive sections become native expandable groups while remaining open by default.
    old = '''    const sec = document.createElement("section");
    sec.className = "cv-section";
    const head = document.createElement("div");
    head.className = "section-head";
    head.textContent = label;
    sec.appendChild(head);'''
    new = '''    const sec = document.createElement("details");
    sec.className = "cv-section";
    sec.open = true;
    const head = document.createElement("summary");
    head.className = "section-head";
    head.innerHTML = `<span>${label}</span><span class="section-count">${g.items.length}</span>`;
    sec.appendChild(head);'''
    if old in raw:
        raw = raw.replace(old, new, 1)
    elif 'document.createElement("details")' not in raw or 'section-count' not in raw:
        raise RuntimeError('Archive section construction marker missing')

    # Count only groups that remain visible after section-label overrides.
    raw = re.sub(r'\n  const archiveCount = document\.getElementById\("archiveCount"\);[\s\S]*?\n  // Render one letter', '\n  // Render one letter', raw, count=1)
    if 'let renderedArchiveCount = 0;' not in raw:
        raw = raw.replace('  grouped.forEach(g => {', '  let renderedArchiveCount = 0;\n  grouped.forEach(g => {', 1)
    if 'renderedArchiveCount += g.items.length;' not in raw:
        raw = raw.replace('    if (label === null) return; // section explicitly hidden for this filter', '    if (label === null) return; // section explicitly hidden for this filter\n    renderedArchiveCount += g.items.length;', 1)
    count_after = '''  const archiveCount = document.getElementById("archiveCount");
  if (archiveCount) {
    const focus = active.size ? " across the selected archive filters" : " in the professional archive";
    archiveCount.textContent = `${renderedArchiveCount} record${renderedArchiveCount === 1 ? "" : "s"}${focus}.`;
  }

'''
    if count_after.strip() not in raw:
        raw = raw.replace('  // Single DOM swap at the end, replace all entries in one reflow', count_after + '  // Single DOM swap at the end, replace all entries in one reflow', 1)

    # Initial routing recognizes archive= and normalizes it.
    raw = raw.replace("const routedMode = new URLSearchParams(window.location.search).get('mode');", "const routedMode = new URLSearchParams(window.location.search).get('mode');")

    # Force closed archive details open for print and restore afterwards.
    old_print = 'window.addEventListener("beforeprint", applyOnePageFitScale);\nwindow.addEventListener("afterprint", clearOnePageFitScale);'
    new_print = '''let _archivePrintOpenState = [];
window.addEventListener("beforeprint", function(){
  applyOnePageFitScale();
  _archivePrintOpenState = [...document.querySelectorAll("details.cv-section")].map(d => [d, d.open]);
  _archivePrintOpenState.forEach(([d]) => { d.open = true; });
});
window.addEventListener("afterprint", function(){
  clearOnePageFitScale();
  _archivePrintOpenState.forEach(([d, open]) => { d.open = open; });
  _archivePrintOpenState = [];
});'''
    raw = raw.replace(old_print, new_print, 1)

    path.write_text(raw, encoding='utf-8')


def patch_main_home() -> None:
    path = ROOT / 'about/index.html'
    raw = path.read_text(encoding='utf-8', errors='replace')
    # Keep the deliberate Fraunces / Newsreader system and remove the later competing bundle.
    raw = re.sub(r'<link rel="preconnect" href="https://fonts\.googleapis\.com"><link rel="preconnect" href="https://fonts\.gstatic\.com" crossorigin><link href="https://fonts\.googleapis\.com/css2\?family=Cormorant\+Garamond:[^>]+>', '', raw, count=1)
    raw = raw.replace('.ss-fz button{width:30px;height:30px;', '.ss-fz button{width:44px;height:44px;')
    raw = raw.replace('top:4.4rem;right:1rem;', 'top:4.15rem;right:.8rem;')
    raw = re.sub(r'/css/main-writing-readability-2026\.css\?v=[^"\']+', f'/css/main-writing-readability-2026.css?v={ASSET_VERSION}', raw)
    path.write_text(raw, encoding='utf-8')


def add_accessibility_css() -> None:
    path = ROOT / 'css/site-wide-type-zoom.css'
    raw = path.read_text(encoding='utf-8')
    marker = 'FINAL8_ACCESSIBILITY_POLISH'
    if marker in raw:
        raw = raw.split('/* FINAL8_ACCESSIBILITY_POLISH', 1)[0].rstrip() + '\n'
    raw += r'''

/* FINAL8_ACCESSIBILITY_POLISH */
.visually-hidden,.sr-only{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}
.skip-link{position:fixed;z-index:99999;top:.75rem;left:-9999px;padding:.72rem .9rem;border:2px solid currentColor;border-radius:9px;background:var(--bg-soft,#fff);color:var(--fg,#111);font:750 .78rem/1 system-ui,sans-serif;text-decoration:none;box-shadow:0 8px 24px rgba(0,0,0,.16)}
.skip-link:focus{left:.75rem}
:where(button,[role="button"],input[type="button"],input[type="submit"],input[type="reset"]){min-height:44px}
'''
    path.write_text(raw, encoding='utf-8')


def add_skip_link_to(path: Path) -> bool:
    raw = path.read_text(encoding='utf-8', errors='replace')
    def visible_html(text: str) -> str:
        return re.sub(r'<(?:script|style)\b[\s\S]*?</(?:script|style)>', lambda m: ' ' * len(m.group(0)), text, flags=re.I)
    visible = visible_html(raw)
    existing = re.search(r'<a\b[^>]*class=["\'][^"\']*\bskip-link\b[^>]*href=["\']#([^"\']+)["\'][^>]*>[\s\S]*?</a>', visible, re.I)
    if existing:
        target = existing.group(1)
        if re.search(rf'\bid=["\']{re.escape(target)}["\']', visible, re.I):
            return False
        raw = raw[:existing.start()] + raw[existing.end():]
        visible = visible_html(raw)
    target_id = None
    for pattern in [
        r'<main\b[^>]*\bid=["\']([^"\']+)["\']',
        r'<article\b[^>]*\bid=["\']([^"\']+)["\']',
        r'<[^>]+\bid=["\'](app|page|main-content)["\']',
        r'<[^>]+\bclass=["\'][^"\']*\b(?:page|wrap|shell|container)\b[^"\']*["\'][^>]*\bid=["\']([^"\']+)["\']',
    ]:
        match = re.search(pattern, visible, re.I)
        if match:
            target_id = match.group(match.lastindex or 1)
            break
    if not target_id:
        for pattern in [
            r'<(main|article)\b(?![^>]*\bid=)([^>]*)>',
            r'<(div|section)\b(?=[^>]*\bclass=["\'][^"\']*\b(?:page|wrap|shell|container)\b)(?![^>]*\bid=)([^>]*)>',
        ]:
            match = re.search(pattern, visible, re.I)
            if match:
                target_id = 'main-content'
                replacement = f'<{match.group(1)} id="{target_id}"{match.group(2)}>'
                raw = raw[:match.start()] + replacement + raw[match.end():]
                visible = visible_html(raw)
                break
    if not target_id:
        body = re.search(r'<body\b(?![^>]*\bid=)([^>]*)>', visible, re.I)
        if body:
            target_id = 'main-content'
            replacement = f'<body id="{target_id}"{body.group(1)}>'
            raw = raw[:body.start()] + replacement + raw[body.end():]
            visible = visible_html(raw)
    if not target_id:
        return False
    body = re.search(r'<body\b[^>]*>', visible, re.I)
    if not body:
        return False
    link = f'\n<a class="skip-link" href="#{target_id}">Skip to main content</a>'
    raw = raw[:body.end()] + link + raw[body.end():]
    path.write_text(raw, encoding='utf-8')
    return True

def patch_accessibility_and_links() -> None:
    # Base Polymythcal feeds the generated academic and writing shortcut routes.
    add_skip_link_to(ROOT / 'polymythseminars/index.html')

    rels = [
        '404.html','index.html','aa/editorial.html','aitr/index.html','bb/index.html','bookwormcard/index.html','campaigns/index.html',
        'polymyth/index.html','polymythseminars/index.html','reviews/index.html','sitemap/index.html',
        'teacherresources/pedagogical-case/index.html','polymyth/campaigncodex/index.html','polymyth/concordance/index.html','polymyth/devilsdiary/index.html','polymyth/dmboard/index.html','polymyth/modulecanon/index.html','polymyth/notebook/index.html','polymyth/polymythdnd/index.html','polymyth/trace/index.html',
        *[f'polymyth/devilsdiary/{i}/index.html' for i in range(1,9)],'polymyth/devilsdiary/replies/index.html','polymyth/devils-notebook/the-boy-and-the-earworm/index.html','polymyth/archive/pre-meaninglib/index.html','marginalia/example-review/index.html',
        'leizu/booking-success/index.html','leizu/toronto-tutoring/index.html','leizu/cloud/index.html','leizu/donate/index.html','leizu/flyer/index.html','leizu/intake/index.html','leizu/policies/index.html','leizu/scholarship/index.html','leizu/teach/index.html',
        'campaigns/studio-qibla/index.html','campaigns/thank-you-mam/index.html','campaigns/thank-you-mam/dm-board/index.html','campaigns/thank-you-mam/pregame/index.html','campaigns/thank-you-mam/unlocks/index.html','campaigns/studio-qibla/pregame/index.html',
        'bookwormcard/about/index.html','bookwormcard/glossary/index.html','bookwormcard/pdf/index.html','bookwormcard/print/index.html','bookwormcard/success/index.html','bb/bbt/index.html','bb/why/index.html','bb/why/zh/index.html','aa/cloud/index.html','aa/views/index.html','dashboard/index.html'
    ]
    for rel in rels:
        path = ROOT / rel
        if path.exists():
            add_skip_link_to(path)

    # Bookwormcard file picker is a real button; textareas receive direct accessible names.
    path = ROOT / 'bookwormcard/index.html'
    raw = path.read_text(encoding='utf-8', errors='replace')
    raw = re.sub(r'<a\b(?=[^>]*\bid=["\']resume-from-file["\'])[^>]*>([\s\S]*?)</a>', r'<button id="resume-from-file" class="linklike-button" type="button">\1</button>', raw, count=1, flags=re.I)
    def label_textarea(match):
        tag = match.group(0)
        if re.search(r'aria-label(?:ledby)?=', tag, re.I):
            return tag
        key_match = re.search(r'(?:name|id)=["\']([^"\']+)["\']', tag, re.I)
        key = (key_match.group(1) if key_match else 'wormcard response').replace('-', ' ').replace('_', ' ').strip().title()
        return tag[:-1] + f' aria-label="{key}">'
    raw = re.sub(r'<textarea\b[^>]*>', label_textarea, raw, flags=re.I)
    if 'id="final8-linklike-button"' not in raw:
        raw = raw.replace('</head>', '<style id="final8-linklike-button">.linklike-button{appearance:none;border:0;background:none;color:inherit;font:inherit;padding:0;text-decoration:underline;text-underline-offset:.18em;cursor:pointer}</style>\n</head>', 1)
    path.write_text(raw, encoding='utf-8')

    # Sitemap graph uses buttons for in-place actions and a valid fallback route for Open page.
    path = ROOT / 'polymyth/sitemap/graph/index.html'
    raw = path.read_text(encoding='utf-8', errors='replace')
    raw = raw.replace('<a id="d-visit" href="#" target="_blank" rel="noopener noreferrer">Open page &rarr;</a>', '<a id="d-visit" href="/polymyth/sitemap/" target="_blank" rel="noopener noreferrer">Open page &rarr;</a>')
    raw = raw.replace('<a id="d-focus" href="#" class="secondary">Focus this node</a>', '<button id="d-focus" type="button" class="secondary">Focus this node</button>')
    raw = raw.replace("focus.onclick = (e) => {\n        e.preventDefault();", "focus.onclick = () => {")
    raw = raw.replace("outIds.forEach(id => { html += `<a href=\"#\" data-id=\"${id}\">${id}</a>`; });", "outIds.forEach(id => { html += `<button type=\"button\" data-id=\"${id}\">${id}</button>`; });")
    raw = raw.replace("incIds.forEach(id => { html += `<a href=\"#\" data-id=\"${id}\">${id}</a>`; });", "incIds.forEach(id => { html += `<button type=\"button\" data-id=\"${id}\">${id}</button>`; });")
    raw = raw.replace("conn.querySelectorAll('a[data-id]').forEach(a => {\n        a.onclick = (e) => {\n          e.preventDefault();", "conn.querySelectorAll('button[data-id]').forEach(a => {\n        a.onclick = () => {")
    raw = raw.replace('</style>', '.actions button,.connections button{font:inherit;color:inherit;background:transparent;border:1px solid currentColor;cursor:pointer}.connections button{display:block;width:100%;text-align:left;padding:.35rem .45rem;margin:.15rem 0;border-color:transparent}.connections button:hover{border-color:currentColor}\n</style>', 1)
    path.write_text(raw, encoding='utf-8')

    # Booking fallback always carries a useful contact route until Stripe supplies the calendar URL.
    path = ROOT / 'leizu/booking-success/index.html'
    raw = path.read_text(encoding='utf-8', errors='replace')
    raw = re.sub(r'(<a\b(?=[^>]*\bid=["\']manual-link["\'])[^>]*\bhref=)["\']#["\']', r'\1"mailto:saulnassau@protonmail.com?subject=Leizu%20booking%20help"', raw, count=1, flags=re.I)
    path.write_text(raw, encoding='utf-8')

    # Intake choices are native buttons. The payment action has a safe pricing fallback before activation.
    path = ROOT / 'leizu/intake/index.html'
    raw = path.read_text(encoding='utf-8', errors='replace')
    raw = re.sub(r'<a\b(?=[^>]*\bclass=["\'][^"\']*\btier-pick\b)(?=[^>]*\bdata-payment-key=["\']([^"\']+)["\'])[^>]*>([\s\S]*?)</a>', r'<button class="tier-pick" data-payment-key="\1" type="button">\2</button>', raw, flags=re.I)
    raw = re.sub(r'(<a\b(?=[^>]*\bid=["\']stripe-link["\'])[^>]*\bhref=)["\']#["\']', r'\1"/leizu/#pricing"', raw, count=1, flags=re.I)
    raw = raw.replace('text-decoration:none;padding:0.6rem 1.2rem;border-radius:3px;', 'text-decoration:none;padding:0.6rem 1.2rem;border:0;border-radius:3px;cursor:pointer;')
    path.write_text(raw, encoding='utf-8')

    # Dashboard filter label and internal-only privacy report removal.
    path = ROOT / 'dashboard/index.html'
    raw = path.read_text(encoding='utf-8', errors='replace')
    if not re.search(r'<label\b[^>]*\bfor=["\']starFilter["\']', raw, re.I):
        raw = re.sub(r'(<select\b(?=[^>]*\bid=["\']starFilter["\'])[^>]*>)', r'<label class="visually-hidden" for="starFilter">Filter by star file</label>\1', raw, count=1, flags=re.I)
    raw = re.sub(r'<li\b[^>]*>[\s\S]*?<a\b[^>]*href=["\']\.\./hf_export/reports/privacy_scan_report\.md["\'][^>]*>[\s\S]*?</a>[\s\S]*?</li>', '', raw, count=1, flags=re.I)
    path.write_text(raw, encoding='utf-8')

    # Embedded flyer images receive explicit dimensions to prevent layout shift.
    path = ROOT / 'leizu/flyer/index.html'
    raw = path.read_text(encoding='utf-8', errors='replace')
    def size_img(match):
        tag = match.group(0)
        if not re.search(r'\bwidth=', tag, re.I):
            tag = tag[:-1] + ' width="441">'
        if not re.search(r'\bheight=', tag, re.I):
            tag = tag[:-1] + ' height="441">'
        return tag
    raw = re.sub(r'<img\b[^>]*>', size_img, raw, flags=re.I)
    path.write_text(raw, encoding='utf-8')

    # The printable Bookwormcard portrait is a fixed square PNG.
    path = ROOT / 'bookwormcard/print/index.html'
    raw = path.read_text(encoding='utf-8', errors='replace')
    def size_print_img(match):
        tag = match.group(0)
        if not re.search(r'\bwidth=', tag, re.I):
            tag = tag[:-1] + ' width="405">'
        if not re.search(r'\bheight=', tag, re.I):
            tag = tag[:-1] + ' height="405">'
        return tag
    raw = re.sub(r'<img\b[^>]*>', size_print_img, raw, flags=re.I)
    path.write_text(raw, encoding='utf-8')


def normalize_canonical_links() -> None:
    canonical_re = re.compile(r'<link\b(?=[^>]*\brel=["\']canonical["\'])(?=[^>]*\bhref=["\']([^"\']+)["\'])[^>]*>', re.I)
    named_meta_re = re.compile(r'<meta\b(?=[^>]*\bname=["\']([^"\']+)["\'])(?=[^>]*\bcontent=["\']([^"\']*)["\'])[^>]*>', re.I)
    paths = [ROOT / 'saul/index.html', ROOT / 'saul/hospitality/index.html']
    paths.extend((ROOT / 'saul/cv').glob('*/index.html'))
    for path in paths:
        if not path.exists():
            continue
        raw = path.read_text(encoding='utf-8', errors='replace')
        updated = canonical_re.sub(lambda m: f'<link rel="canonical" href="{m.group(1)}">', raw)
        updated = named_meta_re.sub(lambda m: f'<meta name="{m.group(1)}" content="{m.group(2)}">', updated)
        if updated != raw:
            path.write_text(updated, encoding='utf-8')

def patch_verifiers() -> None:
    write('scripts/verify-saul-page.js', r'''#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const h=fs.readFileSync(path.join(root,'saul','index.html'),'utf8');
const errors=[];
['data-cv-purpose="general-employment"','data-saul-modular-cv="true"','data-cv-spectrum','cv-spectrum__rainbow','src="/img/saul.jpg"','cv-map-section--enhanced','data-cv-local-nav','data-cv-print-template','id="archiveCount"','id="careerArchive"','data-cv-designed','data-cv-ats','data-cv-text','data-cv-print','data-cv-copy','Combine focus areas','Other application formats','saul-cv-spectrum-2026.js'].forEach(t=>{if(!h.includes(t))errors.push('missing '+t)});
if(h.includes('data-cv-print-jobs'))errors.push('static print-job duplicate returned');
if(h.includes('class="cv-v3"')||h.includes('saul-cv-v3.js'))errors.push('download-first v3 wrapper returned');
if((h.match(/<h1\b/g)||[]).length!==1)errors.push('expected one H1');
if(!/data-cv-designed[\s\S]{0,180}>Download professional PDF</.test(h))errors.push('professional PDF is not the visible primary action');
if(errors.length){console.error('Saul page guard failed');errors.forEach(e=>console.error(' - '+e));process.exit(1)}
console.log('Saul page guard passed - modular card, map companion, local navigation, professional downloads and inert print copy are preserved.');
''')
    write('scripts/verify-saul-visual-governance.js', r'''#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),fail=[];
const h=fs.readFileSync(path.join(root,'saul','index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'saul','assets','saul-cv-spectrum-2026.css'),'utf8');
const js=fs.readFileSync(path.join(root,'saul','assets','saul-cv-spectrum-2026.js'),'utf8');
const data=JSON.parse(fs.readFileSync(path.join(root,'data','saul-cv-canonical-2026.json'),'utf8'));
const need=(hay,t,msg)=>{if(!hay.includes(t))fail.push(msg||`missing ${t}`)};
['data-cv-spectrum','cv-spectrum__rainbow','cv-spectrum__portrait','data-cv-designed','Other application formats','Combine focus areas','cv-map-section--enhanced','data-cv-local-nav','data-cv-print-template','id="careerArchive"','data-geometry="indra-web"'].forEach(t=>need(h,t));
['--cv-gold','--cv-sky','--cv-green','--cv-teal','--cv-indigo','--cv-violet','--cv-rose','--cv-coral','FINAL8_MAP_ARCHIVE_INTERACTION_POLISH','cv-route-bridge','cv-map-grid','@media print'].forEach(t=>need(css,t));
['routeFor','combineModules','preparePrintJobs','COMBINATION_PROFILES','data-cv-post','/saul/assets/saul-cv-canonical-2026.json'].forEach(t=>need(js,t));
if(h.includes('data-cv-print-jobs'))fail.push('print duplicate must remain inert until print');
if(h.includes('class="cv-v3"')||h.includes('saul-cv-v3.js'))fail.push('download-first v3 wrapper returned');
if((h.match(/<h1\b/g)||[]).length!==1)fail.push('main CV page must have exactly one H1');
if(!data.rules.website_mild_spectrum||!data.rules.pdf_professional_monochrome||data.rules.pdf_rainbow!==false)fail.push('visual/PDF separation rules missing');
for(const slug of Object.keys(data.modules)){const p=path.join(root,'saul','cv',slug,'index.html');if(!fs.existsSync(p)){fail.push(`missing route ${slug}`);continue}const x=fs.readFileSync(p,'utf8');['data-cv-spectrum','cv-spectrum__rainbow',`data-default-focus="${slug}"`,'data-geometry="indra-web"','cv-route-bridge','data-cv-print-template'].forEach(t=>{if(!x.includes(t))fail.push(`${slug} missing ${t}`)});if(x.includes('Same visual system'))fail.push(`${slug} retained obsolete continuation copy`);if(x.includes('data-cv-print-jobs'))fail.push(`${slug} retained static print duplicate`)}
if(fail.length){console.error('SAUL VISUAL GOVERNANCE FAILED');fail.forEach(x=>console.error(' - '+x));process.exit(1)}
console.log('SAUL VISUAL GOVERNANCE PASSED - spectrum remains web-only; routes share one modular card; map, geometry, archive bridge and inert print flow are preserved.');
''')
    write('scripts/verify-final8-website-polish.js', r'''#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),fail=[];
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const need=(hay,t,msg)=>{if(!hay.includes(t))fail.push(msg||`missing ${t}`)};
const release=read('RELEASE_ID.txt').trim();
if(release!=='2026-07-18-map-archive-interaction-final8')fail.push(`release id ${release}`);
const main=read('saul/index.html'),css=read('saul/assets/saul-cv-spectrum-2026.css'),js=read('saul/assets/saul-cv-spectrum-2026.js'),home=read('about/index.html');
['cv-map-section--enhanced','data-cv-map-frame','cv-map-threads','Text location list','data-cv-local-nav','id="archiveCount"','archive=','document.createElement("details")','renderedArchiveCount','data-cv-print-template'].forEach(t=>need(main,t,`main Saul missing ${t}`));
['FINAL8_MAP_ARCHIVE_INTERACTION_POLISH','cv-route-bridge','cv-map-grid','min-height:44px','.page>.cv-local-nav','.section-count'].forEach(t=>need(css,t,`shared CSS missing ${t}`));
['preparePrintJobs','clearPrintJobs','COMBINATION_PROFILES','data-cv-selection-count','data-cv-share-status'].forEach(t=>need(js,t,`shared JS missing ${t}`));
if((home.match(/fonts\.googleapis\.com\/css2/g)||[]).length!==1)fail.push('main homepage must load exactly one Google Fonts css2 bundle');
need(home,'.ss-fz button{width:44px;height:44px;','main homepage type-size controls are below 44px');
const data=JSON.parse(read('data/saul-cv-canonical-2026.json'));
for(const slug of Object.keys(data.modules)){const x=read(`saul/cv/${slug}/index.html`);['cv-route-bridge','Explore the full work record','View places behind the work','data-cv-print-template'].forEach(t=>need(x,t,`${slug} missing ${t}`));if(x.includes('Same visual system'))fail.push(`${slug} retains old bottom block`)}
const hospitality=read('saul/hospitality/index.html');need(hospitality,'cv-route-bridge','hospitality missing archive bridge');
// Inspect literal markup only; href="#" inside JavaScript template strings is an in-app control implementation, not a static anchor.
function walk(dir,out=[]){for(const ent of fs.readdirSync(dir,{withFileTypes:true})){if(ent.name==='public'||ent.name==='.git'||ent.name==='node_modules')continue;const p=path.join(dir,ent.name);if(ent.isDirectory())walk(p,out);else if(ent.name.endsWith('.html'))out.push(p)}return out}
for(const p of walk(root)){let x=fs.readFileSync(p,'utf8').replace(/<script\b[\s\S]*?<\/script>/gi,'').replace(/<style\b[\s\S]*?<\/style>/gi,'');if(/<a\b[^>]*href\s*=\s*["']#["']/i.test(x))fail.push(`static placeholder link ${path.relative(root,p)}`)}
const card=read('bookwormcard/index.html');if(/<a\b[^>]*id=["']resume-from-file/.test(card))fail.push('bookwormcard resume action remains an anchor');
const textareas=(card.match(/<textarea\b[^>]*>/gi)||[]);if(textareas.some(t=>!/(aria-label|aria-labelledby)=/i.test(t)))fail.push('bookwormcard has unlabelled textarea');
const dash=read('dashboard/index.html');if(!/label[^>]+for=["']starFilter/.test(dash))fail.push('dashboard filter label missing');if(dash.includes('privacy_scan_report.md'))fail.push('broken dashboard privacy report link returned');
const booking=read('leizu/booking-success/index.html');if(/id=["']manual-link["'][^>]*href=["']#|href=["']#["'][^>]*id=["']manual-link/.test(booking))fail.push('booking fallback remains a placeholder');
const intake=read('leizu/intake/index.html');if(/<a\b[^>]*class=["'][^"']*tier-pick/.test(intake))fail.push('intake choices remain anchor controls');if(/id=["']stripe-link["'][^>]*href=["']#|href=["']#["'][^>]*id=["']stripe-link/.test(intake))fail.push('Stripe fallback remains a placeholder');
const requiredSkip=['404.html','index.html','bookwormcard/index.html','leizu/intake/index.html','leizu/toronto-tutoring/index.html','dashboard/index.html','polymythseminars/index.html','cfps/index.html','lectures/index.html','fellowships/index.html','humanities/index.html'];for(const rel of requiredSkip){if(fs.existsSync(path.join(root,rel))&&!read(rel).includes('class="skip-link"'))fail.push(`${rel} missing skip link`)}
for(const term of ['TELUS','Telus']){if(main.includes(term)||JSON.stringify(data).includes(term))fail.push(`${term} returned to Saul CV`)}
need(JSON.stringify(data),'GEICO','GEICO credit missing');
if(fail.length){console.error('FINAL8 WEBSITE POLISH FAILED');fail.forEach(x=>console.error(' - '+x));process.exit(1)}
console.log('FINAL8 WEBSITE POLISH PASSED - map, archive bridge, interaction, accessibility and release-state contracts hold.');
''')
    package_path = ROOT / 'package.json'
    package = json.loads(package_path.read_text(encoding='utf-8'))
    package.setdefault('scripts', {})['verify:final8-polish'] = 'node scripts/verify-final8-website-polish.js'
    package_path.write_text(json.dumps(package, indent=2) + '\n', encoding='utf-8')
    runner = ROOT / 'scripts/verify-all-runner.js'
    raw = runner.read_text(encoding='utf-8')
    check = "  'node scripts/verify-final8-website-polish.js',\n"
    if check not in raw:
        raw = raw.replace("  'node scripts/verify-saul-performance-synthesis.js',\n", "  'node scripts/verify-saul-performance-synthesis.js',\n" + check)
    runner.write_text(raw, encoding='utf-8')


def patch_generator_hook() -> None:
    path = ROOT / 'scripts/build-saul-cv-professional.py'
    raw = path.read_text(encoding='utf-8')
    raw = raw.replace("canonical['release'] = '2026-07-18-performance-cv-synthesis-final7'", f"canonical['release'] = '{RELEASE}'")
    hook = "\n# FINAL8 website polish is deliberately applied after the canonical CV generator.\npolish_script = ROOT / 'scripts' / 'apply-final8-website-polish.py'\nif polish_script.is_file():\n    import subprocess, sys\n    subprocess.run([sys.executable, str(polish_script)], check=True)\n"
    if 'polish_script = ROOT /' not in raw:
        raw = raw.replace("print('SAUL_CV_PROFESSIONAL_BUILD_COMPLETE')", hook + "\nprint('SAUL_CV_PROFESSIONAL_BUILD_COMPLETE')")
    path.write_text(raw, encoding='utf-8')


def update_release_files() -> None:
    write('RELEASE_ID.txt', RELEASE + '\n')
    manifest_path = ROOT / 'RELEASE_MANIFEST.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8')) if manifest_path.exists() else {}
    manifest['release_id'] = RELEASE
    manifest['date'] = '2026-07-18'
    notes = manifest.setdefault('notes', [])
    new_notes = [
        'Focused CV routes now end with a designed geometric archive bridge instead of browser-default continuation copy.',
        'The main Saul CV keeps the map immediately after the modular card and adds an accessible legend, text locations, archive links, and full-map action.',
        'Duplicate print experience is stored in an inert template and enters the document only for printing.',
        'The main CV adds a sticky section navigator, URL-persisted archive filters, result counts, expandable archive periods, and 44px primary controls.',
        'Homepage font requests are consolidated to one deliberate type system.',
        'Previously identified placeholder links, unlabelled controls, the broken dashboard report link, and missing skip links are repaired.',
    ]
    for note in new_notes:
        if note not in notes:
            notes.append(note)
    manifest['cv_release'] = RELEASE
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')


def main() -> None:
    patch_canonical()
    patch_shared_assets()
    patch_main_saul()
    patch_focused_routes()
    patch_main_home()
    add_accessibility_css()
    patch_accessibility_and_links()
    normalize_canonical_links()
    patch_verifiers()
    patch_generator_hook()
    update_release_files()
    print('FINAL8_WEBSITE_POLISH_APPLIED')


if __name__ == '__main__':
    main()
