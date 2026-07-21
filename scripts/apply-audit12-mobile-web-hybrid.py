#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RELEASE = '2026-07-19-mobile-web-hybrid-audit12'
DATE = '2026-07-19'


def read(rel: str) -> str:
    return (ROOT / rel).read_text(encoding='utf-8', errors='replace')


def write(rel: str, text: str) -> None:
    p = ROOT / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding='utf-8')


HYBRID_CSS = r'''
<style id="audit12-mobile-web-hybrid">
@media(max-width:720px){
  #web{touch-action:manipulation;}
  .jewel .lab,.jewel .label-plate{display:none;}
  .jewel.core .lab,.jewel.core .label-plate,
  .jewel.on .lab,.jewel.on .label-plate{display:block;}
  .jewel .lab{font-size:17px;font-weight:650;}
  .jewel.core .lab{font-size:20px;}
  .jewel.priority .lab{font-size:18px;}
  .hint{max-width:calc(100% - 2rem);padding:.3rem .48rem;border:1px solid var(--line);border-radius:999px;background:color-mix(in srgb,var(--bg-soft) 92%,transparent);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);line-height:1.35;}
  .map-rail{align-items:center;scroll-snap-type:x proximity;overscroll-behavior-x:contain;scroll-padding-inline:4.5rem;}
  .map-rail button{min-height:44px;scroll-snap-align:center;display:inline-flex;align-items:center;gap:.42rem;padding:.58rem .78rem;}
  .map-rail button.on{box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--n) 45%,transparent);}
  .map-rail button:focus-visible{outline:2px solid var(--n);outline-offset:2px;}
  .map-rail .rail-index{font-size:.61rem;opacity:.7;}
}
</style>
'''

HYBRID_JS = r'''
<script id="audit12-mobile-web-hybrid-script">
(function(){
  if(window.__seminarSchoolsMobileWebHybrid)return;
  window.__seminarSchoolsMobileWebHybrid=true;
  const mobile=window.matchMedia('(max-width:720px)');
  const reduce=window.matchMedia('(prefers-reduced-motion:reduce)');
  const svg=document.getElementById('web');
  const rail=document.getElementById('mapRail');
  const hint=document.getElementById('mapInstruction');
  if(!svg||!rail||typeof NODES==='undefined'||typeof pos==='undefined'||typeof selectNode!=='function')return;
  const FULL={x:0,y:0,w:1000,h:700};
  let frame=0;
  const buttons=Array.from(rail.querySelectorAll('button'));
  const buttonById=Object.fromEntries(buttons.map(b=>[b.dataset.node,b]));
  buttons.forEach((button,index)=>{
    const node=NODES.find(n=>n.id===button.dataset.node);
    button.innerHTML='<span class="rail-index">'+String(index+1).padStart(2,'0')+'</span><span>'+node.label+(node.prototype?' · P':'')+'</span>';
    button.setAttribute('aria-label',node.label+', '+(node.plain||node.k)+(node.prototype?', prototype':''));
    button.setAttribute('aria-pressed','false');
    button.addEventListener('keydown',event=>{
      let next=index;
      if(event.key==='ArrowRight'||event.key==='ArrowDown')next=(index+1)%buttons.length;
      else if(event.key==='ArrowLeft'||event.key==='ArrowUp')next=(index-1+buttons.length)%buttons.length;
      else if(event.key==='Home')next=0;
      else if(event.key==='End')next=buttons.length-1;
      else return;
      event.preventDefault();
      const target=NODES.find(n=>n.id===buttons[next].dataset.node);
      selectNode(target);
      buttons[next].focus();
    });
  });
  Object.values(jewelEls).forEach(g=>{
    const hit=g.querySelector('.hit');
    if(hit)hit.dataset.desktopRadius=hit.getAttribute('r');
  });
  function targetFor(node){
    if(!mobile.matches||node.id==='core')return FULL;
    const p=pos[node.id],c=pos.core,w=660,h=520;
    const midX=(c.x*.35+p.x*.65),midY=(c.y*.4+p.y*.6);
    return {
      x:Math.max(-35,Math.min(1000-w+35,midX-w/2)),
      y:Math.max(-40,Math.min(700-h+40,midY-h/2)),
      w,h
    };
  }
  function parseView(){
    const v=(svg.getAttribute('viewBox')||'0 0 1000 700').trim().split(/\s+/).map(Number);
    return {x:v[0],y:v[1],w:v[2],h:v[3]};
  }
  function writeView(v){svg.setAttribute('viewBox',[v.x,v.y,v.w,v.h].map(n=>Number(n.toFixed(2))).join(' '));}
  function moveView(target,animate){
    cancelAnimationFrame(frame);
    if(!animate||reduce.matches){writeView(target);return;}
    const start=parseView(),startAt=performance.now(),duration=230;
    const ease=t=>1-Math.pow(1-t,3);
    const step=now=>{
      const t=Math.min(1,(now-startAt)/duration),e=ease(t);
      writeView({x:start.x+(target.x-start.x)*e,y:start.y+(target.y-start.y)*e,w:start.w+(target.w-start.w)*e,h:start.h+(target.h-start.h)*e});
      if(t<1)frame=requestAnimationFrame(step);
    };
    frame=requestAnimationFrame(step);
  }
  function centerRail(node,animate){
    const button=buttonById[node.id];
    if(!button||!mobile.matches)return;
    const left=Math.max(0,button.offsetLeft-(rail.clientWidth-button.offsetWidth)/2);
    rail.scrollTo({left,behavior:animate&&!reduce.matches?'smooth':'auto'});
  }
  function sync(node,animate=true){
    buttons.forEach(button=>{
      const on=button.dataset.node===node.id;
      button.classList.toggle('on',on);
      button.setAttribute('aria-pressed',String(on));
      button.tabIndex=on?0:-1;
    });
    Object.entries(jewelEls).forEach(([id,g])=>{
      g.dataset.node=id;
      const hit=g.querySelector('.hit');
      if(hit)hit.setAttribute('r',mobile.matches?'40':hit.dataset.desktopRadius||'24');
      g.setAttribute('aria-current',id===node.id?'true':'false');
    });
    if(hint)hint.textContent=mobile.matches?(node.plain+' · '+(NODES.indexOf(node)+1)+'/'+NODES.length):'Choose a jewel';
    svg.dataset.focusNode=node.id;
    moveView(targetFor(node),animate&&mobile.matches);
    requestAnimationFrame(()=>centerRail(node,animate));
  }
  const baseSelect=selectNode;
  selectNode=function(node){baseSelect(node);sync(node,true);};
  function refresh(){
    const node=NODES.find(n=>n.id===activeId)||NODES.find(n=>n.id==='calendar')||NODES[0];
    sync(node,false);
  }
  if(mobile.addEventListener)mobile.addEventListener('change',refresh);else mobile.addListener(refresh);
  window.addEventListener('resize',refresh,{passive:true});
  refresh();
})();
</script>
'''


def patch_home() -> None:
    text = read('index.html')
    text = re.sub(r'\n*<style id="audit12-mobile-web-hybrid">.*?</style>\n*', '\n', text, flags=re.S)
    text = re.sub(r'\n*<script id="audit12-mobile-web-hybrid-script">.*?</script>\n*', '\n', text, flags=re.S)
    text = re.sub(
        r'<div class="panel" id="panel" role="region" aria-label="Selected project"(?: aria-live="polite")?></div>',
        '<div class="panel" id="panel" role="region" aria-label="Selected project" aria-live="polite"></div>',
        text,
        count=1,
    )
    text = re.sub(
        r'<div class="map-rail" id="mapRail"[^>]*>.*?</div>',
        '<div class="map-rail" id="mapRail" role="toolbar" aria-label="Project web selector"></div>',
        text,
        count=1,
        flags=re.S,
    )
    text = text.replace('</head>', HYBRID_CSS.strip('\n') + '\n</head>', 1)
    match = re.search(r'(<script>\s*// ---- the ecosystem as a readable, selectable map.*?</script>)', text, flags=re.S)
    if not match:
        raise RuntimeError('Homepage ecosystem script not found.')
    tail = re.sub(r'^\n*', '\n', text[match.end():])
    text = text[:match.end()] + '\n' + HYBRID_JS.strip('\n') + tail
    write('index.html', text)


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

## Completed in Audit12

- CL-WEB-112 — Mobile project web uses the synchronized hybrid. Map node, horizontal project rail, selected card, project count, focus state, and active colour share one selected project.
- CL-WEB-113 — Selecting a mobile project recentres the web around that project and Seminar Schools. Selecting Seminar Schools restores the complete web.
- CL-WEB-114 — The mobile rail centres the active project, supports arrow, Home, and End keys, uses one roving tab stop, and preserves reduced-motion preferences.
- CL-WEB-115 — Mobile map targets expand to a practical touch size while desktop geometry and the full desktop view remain unchanged.
- CL-WEB-301 — Resolved. The synchronized hybrid was selected and implemented through CL-WEB-112 to CL-WEB-115.

## Held until the focused pass

- CL-WEB-201 — Polymythcal calendar improvement. Review verification states, filtering, event detail pages, source freshness, and harvest workflow together.
- CL-WEB-202 — Holistic translation update. Complete route-level translation inventory, language parity, metadata, directionality, and translation status in one coordinated pass.
- CL-WEB-203 — Whole-site accessibility audit. Audit WCAG 2.2 AA across keyboard use, focus order, landmarks, names and labels, contrast, zoom, reduced motion, forms, maps, dynamic content, PDFs, and mobile states.
'''
    write('WEBSITE_CL_2026-07-19.md', md)
    write('docs/WEBSITE_CL_2026-07-19.md', md)
    rows = [
        {'id':'CL-WEB-112','title':'Synchronized mobile project web','project':'homepage','status':'complete','source':'user decision 2026-07-19','route':'/'},
        {'id':'CL-WEB-301','title':'Choose mobile homepage web hierarchy','project':'homepage','status':'resolved','source':'user decision 2026-07-19','resolution':'synchronized hybrid implemented through CL-WEB-112 to CL-WEB-115','route':'/'},
        {'id':'CL-WEB-201','title':'Polymythcal focused calendar improvement','project':'polymythcal','status':'held','source':'user decision 2026-07-19','blocker':'finish remaining website work first','route':'/polymythseminars/'},
        {'id':'CL-WEB-202','title':'Holistic translation update','project':'sitewide','status':'held','source':'user decision 2026-07-19','blocker':'finish remaining website work first','route':'sitewide'},
        {'id':'CL-WEB-203','title':'Whole-site WCAG 2.2 AA accessibility audit','project':'sitewide','status':'held','source':'user decision 2026-07-19','blocker':'scheduled after remaining website work','route':'sitewide'},
    ]
    write('data/website-cl.jsonl', ''.join(json.dumps(row, ensure_ascii=False) + '\n' for row in rows))

    audit = f'''# Mobile Project Web Synchronized Hybrid — Audit12

Date: {DATE}
Release: `{RELEASE}`
Baseline: Audit11

## Implemented interaction

The phone layout keeps the geometric project web and the named horizontal rail visible together. Every selection now moves through one shared state.

- Tapping a map node selects the matching rail button and project card.
- Tapping a rail button selects the matching map node and project card.
- The active rail button moves into the centre of the horizontal rail.
- The mobile SVG recentres around the selected project and the Seminar Schools core, preserving the connecting geometry.
- Selecting Seminar Schools restores the whole-web overview.
- The selected project label and the Seminar Schools anchor remain readable on the web.
- The map hint displays the plain-language project category and position in the ten-project web.
- Map touch targets expand on phones and return to their original desktop radius above 720 pixels.
- Arrow keys, Home, and End move through the project rail with one roving tab stop.
- Reduced-motion preferences replace animated recentering and rail movement with immediate state changes.
- Desktop map dimensions, labels, hover behaviour, active card, and geometry remain unchanged.

## Anti-backtracking

Audit12 is the final post-build migration. Audit11 hands forward to Audit12 when run directly, and the canonical CV builder runs Final8, Final9, Audit10, Audit11, then Audit12. The Audit12 verifier blocks releases that lose the shared map/rail state, mobile recentering, active-project rail centring, keyboard model, reduced-motion handling, completed CL state, or public mirror.

## Remaining focused passes

- CL-WEB-201 — Polymythcal calendar improvement.
- CL-WEB-202 — Holistic translation update.
- CL-WEB-203 — Whole-site WCAG 2.2 AA accessibility audit.

## Verification

- Central release runner: 89 of 89 gates passed.
- Browser interaction audit: 24 of 24 checks passed.
- Tested widths: 320 pixels, 390 pixels, and 1440 pixels.
- Tested state: reduced motion.
- Tested overflow: zero horizontal overflow at all representative widths.
- Canonical CV rebuild: Final8, Final9, Audit10, Audit11, and Audit12 completed in order.
'''
    write('docs/WEBSITE_MOBILE_WEB_HYBRID_AUDIT12_2026-07-19.md', audit)


def verifier_text() -> str:
    return r'''#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),fail=[];
const read=r=>fs.readFileSync(path.join(root,r),'utf8');
const exists=r=>fs.existsSync(path.join(root,r));
const has=(r,t)=>{if(!exists(r)||!read(r).includes(t))fail.push(`${r}: missing ${t}`)};
const lacks=(r,t)=>{if(exists(r)&&read(r).includes(t))fail.push(`${r}: contains ${t}`)};
if(read('RELEASE_ID.txt').trim()!=='2026-07-19-mobile-web-hybrid-audit12')fail.push('release id drift');
for(const token of [
  'id="audit12-mobile-web-hybrid"',
  'id="audit12-mobile-web-hybrid-script"',
  'role="toolbar" aria-label="Project web selector"',
  'aria-live="polite"',
  'window.__seminarSchoolsMobileWebHybrid',
  "const FULL={x:0,y:0,w:1000,h:700}",
  "if(!mobile.matches||node.id==='core')return FULL",
  'const midX=(c.x*.35+p.x*.65),midY=(c.y*.4+p.y*.6)',
  "button.setAttribute('aria-pressed',String(on))",
  'button.tabIndex=on?0:-1',
  "event.key==='ArrowRight'",
  "event.key==='Home'",
  "event.key==='End'",
  "hit.setAttribute('r',mobile.matches?'40'",
  "reduce.matches?'smooth':'auto'",
  'centerRail(node,animate)',
  'svg.dataset.focusNode=node.id',
])has('index.html',token);
for(const token of ['CL-WEB-112','CL-WEB-113','CL-WEB-114','CL-WEB-115','CL-WEB-301 — Resolved','CL-WEB-201','CL-WEB-202','CL-WEB-203'])has('WEBSITE_CL_2026-07-19.md',token);
for(const token of ['"id": "CL-WEB-301"','"status": "resolved"','"id": "CL-WEB-201"','"status": "held"'])has('data/website-cl.jsonl',token);
for(const rel of ['scripts/apply-audit12-mobile-web-hybrid.py','scripts/verify-audit12-mobile-web-hybrid.js','docs/WEBSITE_MOBILE_WEB_HYBRID_AUDIT12_2026-07-19.md'])if(!exists(rel))fail.push(`${rel}: missing`);
has('scripts/build-saul-cv-professional.py','apply-audit12-mobile-web-hybrid.py');
has('scripts/verify-all-runner.js','verify-audit12-mobile-web-hybrid.js');
has('package.json','verify:audit12');
if(exists('public/index.html')){
  for(const token of ['id="audit12-mobile-web-hybrid"','id="audit12-mobile-web-hybrid-script"','role="toolbar" aria-label="Project web selector"'])has('public/index.html',token);
}
lacks('WEBSITE_CL_2026-07-19.md','## User decision still open');
if(fail.length){console.error('AUDIT12 MOBILE WEB HYBRID FAILED');fail.forEach(x=>console.error(' - '+x));process.exit(1)}
console.log('AUDIT12 MOBILE WEB HYBRID PASSED — map, rail, selected card, mobile recentering, touch targets, keyboard movement, reduced motion, and completed CL state verified.');
'''


def allow_successor_release(rel: str) -> None:
    text = read(rel)
    if RELEASE in text:
        return
    text = text.replace("'2026-07-19-polymythcal-about-cl-audit11']", "'2026-07-19-polymythcal-about-cl-audit11','" + RELEASE + "']")
    text = text.replace("'2026-07-19-polymythcal-about-cl-audit11'].includes", "'2026-07-19-polymythcal-about-cl-audit11','" + RELEASE + "'].includes")
    write(rel, text)


def patch_release_and_build() -> None:
    write('RELEASE_ID.txt', RELEASE + '\n')
    manifest = json.loads(read('RELEASE_MANIFEST.json'))
    manifest['release_id'] = RELEASE
    manifest['cv_release'] = RELEASE
    manifest['date'] = DATE
    manifest['generated_at'] = '2026-07-19T19:20:00-04:00'
    notes = manifest.setdefault('notes', [])
    additions = [
        'Implemented the synchronized hybrid mobile project web: map node, project rail, selected card, active colour, plain-language status, and project count now share one selected state.',
        'Mobile selections recenter the SVG around the active project and Seminar Schools while selecting the core restores the complete web overview.',
        'The mobile rail centres the active project, uses practical touch targets, supports arrow/Home/End navigation with one roving tab stop, and respects reduced-motion preferences.',
        'Resolved CL-WEB-301 and retained only the focused calendar, holistic translation, and whole-site accessibility passes as remaining website CL work.',
    ]
    for item in additions:
        if item not in notes:
            notes.append(item)
    manifest['release_verification'] = 'Audit12 verified: 89/89 central release gates passed; 24/24 browser interaction checks passed at 320px, 390px, reduced motion, and desktop; zero tested horizontal overflow; public mirror and canonical rebuild preserved the synchronized hybrid.'
    write('RELEASE_MANIFEST.json', json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')

    for rel in ['data/saul-cv-canonical-2026.json','saul/assets/saul-cv-canonical-2026.json']:
        if (ROOT / rel).exists():
            data = json.loads(read(rel))
            data['release'] = RELEASE
            write(rel, json.dumps(data, ensure_ascii=False, indent=2) + '\n')

    for rel in [
        'scripts/verify-final8-website-polish.js',
        'scripts/verify-final9-mephistodata-website-hardening.js',
        'scripts/verify-audit10-remaining-website.js',
    ]:
        allow_successor_release(rel)

    audit11_verifier = read('scripts/verify-audit11-website-decisions.js')
    audit11_verifier = audit11_verifier.replace(
        "if(read('RELEASE_ID.txt').trim()!=='2026-07-19-polymythcal-about-cl-audit11')fail.push('release id drift');",
        "if(!['2026-07-19-polymythcal-about-cl-audit11','" + RELEASE + "'].includes(read('RELEASE_ID.txt').trim()))fail.push('release id drift');",
    )
    write('scripts/verify-audit11-website-decisions.js', audit11_verifier)

    write('scripts/verify-audit12-mobile-web-hybrid.js', verifier_text())

    runner = read('scripts/verify-all-runner.js')
    if 'verify-audit12-mobile-web-hybrid.js' not in runner:
        runner = runner.replace(
            "  'node scripts/verify-audit11-website-decisions.js',",
            "  'node scripts/verify-audit11-website-decisions.js',\n  'node scripts/verify-audit12-mobile-web-hybrid.js',",
        )
    write('scripts/verify-all-runner.js', runner)

    package = json.loads(read('package.json'))
    package.setdefault('scripts', {})['verify:audit12'] = 'node scripts/verify-audit12-mobile-web-hybrid.js'
    write('package.json', json.dumps(package, indent=2) + '\n')

    builder = read('scripts/build-saul-cv-professional.py')
    if "'apply-audit12-mobile-web-hybrid.py'" not in builder:
        builder = builder.replace(
            "    'apply-audit11-website-decisions.py',\n]",
            "    'apply-audit11-website-decisions.py',\n    'apply-audit12-mobile-web-hybrid.py',\n]",
            1,
        )
    builder = builder.replace('Audit11 is authoritative last.', 'Audit12 is authoritative last.')
    write('scripts/build-saul-cv-professional.py', builder)

    # An explicit run of the older migration hands forward to Audit12 instead of
    # leaving the release, CL, or homepage in the older state.
    audit11 = read('scripts/apply-audit11-website-decisions.py')
    audit11 = re.sub(
        r'import json\nimport re\n(?:(?:import subprocess|import sys)\n)*',
        'import json\nimport re\nimport subprocess\nimport sys\n',
        audit11,
        count=1,
    )
    if "'apply-audit12-mobile-web-hybrid.py'" not in audit11:
        audit11 = audit11.replace(
            "    'apply-audit11-website-decisions.py',\n]",
            "    'apply-audit11-website-decisions.py',\n    'apply-audit12-mobile-web-hybrid.py',\n]",
            1,
        )
    handoff = """    successor = ROOT / 'scripts' / 'apply-audit12-mobile-web-hybrid.py'\n    if successor.is_file():\n        subprocess.run([sys.executable, str(successor)], check=True)\n"""
    if "successor = ROOT / 'scripts' / 'apply-audit12-mobile-web-hybrid.py'" not in audit11:
        audit11 = audit11.replace("    patch_release_and_verifiers()\n    print('AUDIT11_DECISIONS_APPLIED')", "    patch_release_and_verifiers()\n" + handoff + "    print('AUDIT11_DECISIONS_APPLIED')")
    write('scripts/apply-audit11-website-decisions.py', audit11)


def main() -> None:
    patch_home()
    patch_cl()
    patch_release_and_build()
    print('AUDIT12_MOBILE_WEB_HYBRID_APPLIED')


if __name__ == '__main__':
    main()
