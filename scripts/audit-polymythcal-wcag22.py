#!/usr/bin/env python3
"""Browser-assisted WCAG 2.2 AA audit for Polymythcal's public surfaces.

Chromium is loaded from local files with scripts/styles inlined because this
execution environment applies an enterprise URL block policy to headless Chrome.
The rendered DOM, keyboard model, media emulation, JS features, and Chrome
accessibility tree remain testable. Native VoiceOver and NVDA runs require their
respective operating systems and are tracked separately in the companion protocol.
"""
from __future__ import annotations
import asyncio, html, json, mimetypes, re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from playwright.async_api import async_playwright

ROOT=Path(__file__).resolve().parents[1]
OUT_JSON=ROOT/'data/polymythcal-wcag22-browser-audit.json'
OUT_MD=ROOT/'POLYMYTHCAL_WCAG22_AA_AUDIT_2026-07-20.md'
CHROMIUM='/usr/bin/chromium'

FEED_INDEX=json.loads((ROOT/'polymythseminars/feeds/index.json').read_text(encoding='utf-8'))
_PAGE_CACHE={}

def _trim_calendar_for_audit(text:str)->str:
    """Keep representative corridor records while avoiding a one-megabyte DOM fixture.

    Production files remain untouched. The browser audit exercises the same renderer,
    filters, local storage, translation, and accessibility code against a compact
    deterministic slice containing Montréal and non-Montréal records.
    """
    match=re.search(r'(<script id="events-fallback" type="application/json">)([\s\S]*?)(</script>)',text)
    if match:
        payload=json.loads(match.group(2))
        all_events=list(payload.get('events') or [])
        montreal=[e for e in all_events if 'montr' in ' '.join(str(e.get(k,'')) for k in ('city','venue','title','description')).lower()]
        others=[e for e in all_events if e not in montreal]
        selected=(montreal[:16]+others[:16])
        payload['events']=selected
        payload['count']=len(selected)
        payload['_total_events']=len(selected)
        compact=json.dumps(payload,ensure_ascii=False,separators=(',',':')).replace('</',r'<\/')
        text=text[:match.start()]+match.group(1)+compact+match.group(3)+text[match.end():]
    text=re.sub(r'<!-- SS_STATIC_EVENTS_START -->[\s\S]*?<!-- SS_STATIC_EVENTS_END -->','<!-- SS_STATIC_EVENTS_START --><div class="ssr-event-list" data-ssr-events="true"></div><!-- SS_STATIC_EVENTS_END -->',text,count=1)
    return text

def inline_page(rel:str)->str:
    if rel in _PAGE_CACHE: return _PAGE_CACHE[rel]
    text=(ROOT/rel).read_text(encoding='utf-8')
    if rel=='polymythseminars/index.html':
        text=_trim_calendar_for_audit(text)
    def css_repl(m:re.Match)->str:
        href=m.group(1).split('?')[0]
        p=ROOT/href.lstrip('/')
        if not p.exists(): return ''
        css=p.read_text(encoding='utf-8')
        css=re.sub(r'@import\s+url\([^;]+;','',css)
        css=re.sub(r'url\((?!["\']?data:)[^)]+\)','none',css)
        return f'<style data-local-src="{html.escape(href)}">{css}</style>'
    text=re.sub(r'<link[^>]+rel=["\']stylesheet["\'][^>]+href=["\']([^"\']+)["\'][^>]*>',css_repl,text,flags=re.I)
    def js_repl(m:re.Match)->str:
        src=m.group(1).split('?')[0]
        if src != '/js/polymythcal-features.js': return ''
        p=ROOT/src.lstrip('/')
        if not p.exists(): return ''
        js=p.read_text(encoding='utf-8').replace('</script>','<\\/script>')
        return f'<script data-local-src="{html.escape(src)}">\n{js}\n</script>'
    text=re.sub(r'<script[^>]+src=["\']([^"\']+)["\'][^>]*>\s*</script>',js_repl,text,flags=re.I)
    # Remove resource hints, icons, and manifests that would attempt blocked navigation.
    text=re.sub(r'<link\b(?![^>]*rel=["\'](?:canonical|alternate)["\'])[^>]*>',lambda m:m.group(0) if 'stylesheet' in m.group(0).lower() else '',text,flags=re.I)
    bootstrap='''<script>
window.__pmStorageData=window.__pmStorageData||{};
Object.defineProperty(window,'localStorage',{configurable:true,value:{
 getItem:function(k){return Object.prototype.hasOwnProperty.call(window.__pmStorageData,k)?window.__pmStorageData[k]:null},
 setItem:function(k,v){window.__pmStorageData[k]=String(v)},removeItem:function(k){delete window.__pmStorageData[k]},
 clear:function(){window.__pmStorageData={}},key:function(i){return Object.keys(window.__pmStorageData)[i]||null},
 get length(){return Object.keys(window.__pmStorageData).length}
}});
window.fetch=function(u){var k=new URL(String(u),'https://local.invalid').pathname,d=null,el=null;
 if(k==='/polymythseminars/events.json'||k==='/data/polymyth-seminar-events.json'){el=document.getElementById('events-fallback');if(el)try{d=JSON.parse(el.textContent)}catch(e){}}
 else if(k==='/polymythseminars/watchlist.json'){el=document.getElementById('watchlist-fallback');if(el)try{d=JSON.parse(el.textContent)}catch(e){}}
 else if(k==='/polymythseminars/feeds/index.json')d=__FEED_INDEX__;
 return Promise.resolve({ok:!!d,status:d?200:404,json:function(){return Promise.resolve(d)},text:function(){return Promise.resolve(d?JSON.stringify(d):'')}})};
</script>'''.replace('__FEED_INDEX__',json.dumps(FEED_INDEX,ensure_ascii=False).replace('</','<\\/'))
    result=text.replace('<head>','<head>'+bootstrap,1)
    _PAGE_CACHE[rel]=result
    return result

def issue(name:str,passed:bool,details:Any,criterion:str,scope:str='automated')->dict:
    return {'name':name,'passed':bool(passed),'details':details,'criterion':criterion,'scope':scope}

async def set_page(page, rel:str, query:str=''):
    await page.goto('about:blank')
    if query:
        await page.evaluate("q=>history.replaceState(null,'','about:blank'+q)",query)
    await page.set_content(inline_page(rel),wait_until='load',timeout=120000)
    await page.wait_for_timeout(900)

async def dom_audit(page,label:str):
    return await page.evaluate("""label=>{
 const ids=[...document.querySelectorAll('[id]')].map(x=>x.id);const dup=[...new Set(ids.filter((x,i)=>ids.indexOf(x)!==i))];
 const missingLabels=[...document.querySelectorAll('input:not([type=hidden]),select,textarea')].filter(x=>{
   if(x.labels&&x.labels.length)return false; if(x.getAttribute('aria-label')||x.getAttribute('aria-labelledby'))return false; return true;
 }).map(x=>x.id||x.name||x.outerHTML.slice(0,80));
 const unnamedButtons=[...document.querySelectorAll('button')].filter(x=>!((x.textContent||'').trim()||x.getAttribute('aria-label')||x.getAttribute('aria-labelledby'))).length;
 const unnamedLinks=[...document.querySelectorAll('a[href]')].filter(x=>!((x.textContent||'').trim()||x.getAttribute('aria-label')||x.querySelector('img[alt]'))).length;
 const hs=[...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(x=>+x.tagName[1]);const jumps=[];for(let i=1;i<hs.length;i++)if(hs[i]-hs[i-1]>1)jumps.push([hs[i-1],hs[i]]);
 const skip=document.querySelector('a.skip-link');const target=skip&&document.querySelector(skip.getAttribute('href'));
 return {label,duplicateIds:dup,missingLabels,unnamedButtons,unnamedLinks,headingJumps:jumps,mainCount:document.querySelectorAll('main').length,h1Count:document.querySelectorAll('h1').length,skipTargetValid:!!target,lang:document.documentElement.lang};
 }""",label)

async def reflow(page,rel,label,query=''):
    await page.set_viewport_size({'width':320,'height':900})
    await set_page(page,rel,query)
    await page.wait_for_timeout(500)
    dims=await page.evaluate("({scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,bodyScrollWidth:document.body.scrollWidth})")
    return issue(f'{label} reflows at 320 CSS px',dims['scrollWidth']<=dims['clientWidth']+2,dims,'1.4.10')

async def run():
    results=[]; console_errors=[]
    async with async_playwright() as pw:
        browser=await pw.chromium.launch(executable_path=CHROMIUM,headless=True,args=['--no-sandbox'])
        context=await browser.new_context(viewport={'width':1280,'height':900})
        page=await context.new_page()
        page.on('pageerror',lambda e:console_errors.append('pageerror: '+str(e)))
        page.on('console',lambda m:console_errors.append('console: '+m.text) if m.type=='error' else None)

        # One main-calendar render supports URL, search, keyboard, local storage,
        # reflow, reduced motion, forced colours, and accessibility-tree checks.
        print('AUDIT stage main load',flush=True)
        await set_page(page,'polymythseminars/index.html','?q=montral&focus=montreal&lang=fr')
        print('AUDIT stage main loaded',flush=True)
        await page.wait_for_selector('#pmTools',timeout=30000)
        dom=await dom_audit(page,'calendar')
        visible=await page.locator('#eventsContainer article.event').count()
        results += [
          issue('Calendar has unique IDs',not dom['duplicateIds'],dom['duplicateIds'],'4.1.1'),
          issue('Calendar controls have programmatic labels',not dom['missingLabels'],dom['missingLabels'],'1.3.1, 3.3.2, 4.1.2'),
          issue('Calendar interactive elements have accessible names',dom['unnamedButtons']==0 and dom['unnamedLinks']==0,{'buttons':dom['unnamedButtons'],'links':dom['unnamedLinks']},'2.4.4, 4.1.2'),
          issue('Calendar has a valid skip link and main landmark',dom['skipTargetValid'] and dom['mainCount']==1,dom,'2.4.1'),
          issue('French URL state restores interface language',dom['lang']=='fr-CA' and await page.input_value('#calendarSearch')=='montral',{'lang':dom['lang'],'query':await page.input_value('#calendarSearch')},'3.1.1, 3.1.2'),
          issue('Typo-tolerant bilingual search returns Montréal results',visible>0,{'visibleEvents':visible,'countLine':await page.locator('#countLine').inner_text()},'3.2.2'),
          issue('URL-backed focus restores Montréal',await page.get_attribute('#quickFocusNav [data-focus="montreal"]','aria-pressed')=='true',await page.get_attribute('#quickFocusNav [data-focus="montreal"]','aria-pressed'),'3.2.3'),
        ]
        await page.keyboard.press('Tab')
        focused=await page.evaluate("({tag:document.activeElement.tagName,cls:document.activeElement.className,outline:getComputedStyle(document.activeElement).outlineStyle,width:getComputedStyle(document.activeElement).outlineWidth})")
        results.append(issue('First keyboard focus reaches visible skip link',focused['tag']=='A' and 'skip-link' in focused['cls'] and focused['outline']!='none',focused,'2.1.1, 2.4.1, 2.4.7, 2.4.11'))
        await page.keyboard.press('/')
        results.append(issue('Slash shortcut focuses search',await page.evaluate("document.activeElement===document.querySelector('#calendarSearch')"),await page.evaluate("document.activeElement&&document.activeElement.id"),'2.1.1'))
        first_save=page.locator('.save-event').first; await first_save.click()
        saved=await page.evaluate("JSON.parse(localStorage.getItem('polymythcal.savedEvents.v1')||'[]')")
        results.append(issue('Saved events persist in device-local storage',len(saved)==1 and await first_save.get_attribute('aria-pressed')=='true',saved,'4.1.2'))
        await page.locator('#pmTools button[data-pm-label="Save search"]').click()
        searches=await page.evaluate("JSON.parse(localStorage.getItem('polymythcal.savedSearches.v1')||'[]')")
        results.append(issue('Saved searches persist URL state locally',len(searches)==1 and 'q=montral' in searches[0].get('query',''),searches,'3.2.3'))

        print('AUDIT stage main interactions done',flush=True)
        await page.set_viewport_size({'width':320,'height':900}); await page.wait_for_timeout(300)
        dims=await page.evaluate("({scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,bodyScrollWidth:document.body.scrollWidth})")
        results.append(issue('Calendar reflows at 320 CSS px',dims['scrollWidth']<=dims['clientWidth']+2,dims,'1.4.10'))
        await page.set_viewport_size({'width':1280,'height':900})
        await page.emulate_media(reduced_motion='reduce'); await page.wait_for_timeout(100)
        motion=await page.evaluate("""()=>{const e=document.querySelector('.event')||document.body,c=getComputedStyle(e);return {animationDuration:c.animationDuration,transitionDuration:c.transitionDuration,scrollBehavior:getComputedStyle(document.documentElement).scrollBehavior}}""")
        results.append(issue('Reduced-motion preference suppresses transitions and smooth scrolling',motion['transitionDuration'] in ('0s','0.001s') and motion['scrollBehavior']!='smooth',motion,'user-requested reduced-motion check'))
        await page.emulate_media(reduced_motion='no-preference',forced_colors='active'); await page.wait_for_timeout(100)
        await page.locator('#pmTools button').first.focus(); await page.keyboard.press('Tab')
        forced=await page.evaluate("""()=>{const e=document.activeElement,c=getComputedStyle(e),t=getComputedStyle(document.querySelector('#pmTools'));return {focusedTag:e.tagName,focusedText:(e.textContent||'').trim(),focusOutline:c.outlineStyle,focusWidth:c.outlineWidth,toolsBorder:t.borderTopStyle,forcedAdjust:t.forcedColorAdjust}}""")
        results.append(issue('Forced-colour mode preserves focus and tool boundaries',forced['focusOutline']!='none' and forced['toolsBorder']!='none',forced,'1.4.11, 2.4.7'))
        print('AUDIT stage media done',flush=True)
        session=await context.new_cdp_session(page); ax=await session.send('Accessibility.getFullAXTree')
        interactive={'button','link','textbox','combobox','checkbox','searchbox'}; unnamed=[]
        for n in ax.get('nodes',[]):
            role=(n.get('role') or {}).get('value'); name=(n.get('name') or {}).get('value','')
            if role in interactive and not str(name).strip() and not n.get('ignored'): unnamed.append({'role':role,'nodeId':n.get('nodeId')})
        results.append(issue('Chrome accessibility tree names all exposed controls',not unnamed,unnamed[:20],'4.1.2','screen-reader proxy'))
        await page.emulate_media(forced_colors='none')

        # Each secondary surface is rendered once at 320px for DOM and reflow.
        print('AUDIT stage main interactions done',flush=True)
        print('AUDIT stage ax done',flush=True)
        await page.set_viewport_size({'width':320,'height':900})
        print('AUDIT stage submit load',flush=True)
        await set_page(page,'polymythseminars/submit/index.html')
        d=await dom_audit(page,'submission form'); dims=await page.evaluate("({scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth})")
        results += [
          issue('Submission form fields have labels',not d['missingLabels'],d['missingLabels'],'1.3.1, 3.3.2'),
          issue('Submission form has one main landmark and heading',d['mainCount']==1 and d['h1Count']==1,d,'1.3.1, 2.4.6'),
          issue('Submission form reflows at 320 CSS px',dims['scrollWidth']<=dims['clientWidth']+2,dims,'1.4.10'),
        ]
        full_event='https://seminarschools.com/polymythseminars/events/clarkson-laureateships-high-table-2026-01-30/'
        print('AUDIT stage correct load',flush=True)
        await set_page(page,'polymythseminars/correct/index.html','?event='+full_event)
        d=await dom_audit(page,'correction form'); dims=await page.evaluate("({scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth})")
        results += [
          issue('Correction form fields have labels',not d['missingLabels'],d['missingLabels'],'1.3.1, 3.3.2'),
          issue('Correction form has one main landmark and heading',d['mainCount']==1 and d['h1Count']==1,d,'1.3.1, 2.4.6'),
          issue('Correction form pre-fills the selected stable listing',await page.input_value('#listing-url')==full_event,await page.input_value('#listing-url'),'3.3.2'),
          issue('Correction form reflows at 320 CSS px',dims['scrollWidth']<=dims['clientWidth']+2,dims,'1.4.10'),
        ]
        event_rel='polymythseminars/events/clarkson-laureateships-high-table-2026-01-30/index.html'
        print('AUDIT stage event load',flush=True)
        await set_page(page,event_rel,'?lang=fr')
        d=await dom_audit(page,'event detail'); dims=await page.evaluate("({scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth})")
        results += [
          issue('Stable event detail has correction, source, and calendar actions',await page.locator('.pm-event-actions a').count()==3,await page.locator('.pm-event-actions a').all_inner_texts(),'2.4.4'),
          issue('Stable event detail receives a local save control',await page.locator('.save-event').count()==1,await page.locator('.save-event').count(),'4.1.2'),
          issue('Event detail language follows the French preference',d['lang']=='fr-CA',d['lang'],'3.1.1'),
          issue('Event detail reflows at 320 CSS px',dims['scrollWidth']<=dims['clientWidth']+2,dims,'1.4.10'),
        ]
        print('AUDIT stage complete',flush=True)
        await browser.close()

    native=[
      {'technology':'VoiceOver on macOS','executed':False,'reason':'Native macOS and VoiceOver are unavailable in the Linux build container. The exact manual script and expected announcements are included.'},
      {'technology':'NVDA on Windows','executed':False,'reason':'Native Windows and NVDA are unavailable in the Linux build container. The exact manual script and expected announcements are included.'},
    ]
    passed=sum(1 for r in results if r['passed']); failed=[r for r in results if not r['passed']]
    report={'generated_at':datetime.now(timezone.utc).isoformat(timespec='seconds'),'standard':'WCAG 2.2 AA','browser':'Chromium 144 headless with local assets inlined','automated_checks':results,'passed':passed,'failed':len(failed),'console_errors':console_errors,'native_assistive_technology':native,'native_protocol':'docs/POLYMYTHCAL_SCREEN_READER_TEST_PROTOCOL.md'}
    OUT_JSON.parent.mkdir(parents=True,exist_ok=True); OUT_JSON.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    lines=['# Polymythcal WCAG 2.2 AA audit','',f'- Browser-assisted checks passed: **{passed}/{len(results)}**',f'- Browser-assisted checks failed: **{len(failed)}**','- Native VoiceOver status: **manual protocol prepared; native run requires macOS**','- Native NVDA status: **manual protocol prepared; native run requires Windows**','', '## Browser-assisted results','']
    for r in results: lines.append(f"- {'PASS' if r['passed'] else 'FAIL'} · {r['name']} · {r['criterion']} · `{json.dumps(r['details'],ensure_ascii=False)[:500]}`")
    lines += ['', '## Native assistive-technology boundary','', 'The Chromium accessibility tree, keyboard flow, labels, names, state, reflow, forced-colour mode, and reduced-motion mode were exercised in this environment. VoiceOver speech output and rotor behaviour require macOS. NVDA speech output and browse-mode behaviour require Windows. The companion protocol records the exact paths, keystrokes, expected announcements, and evidence fields for both native runs.', '', '## Console errors','']
    lines += [f'- {x}' for x in console_errors] or ['- None after local asset inlining.']
    OUT_MD.write_text('\n'.join(lines)+'\n',encoding='utf-8')
    print(json.dumps({'passed':passed,'failed':len(failed),'failures':[x['name'] for x in failed],'json':str(OUT_JSON.relative_to(ROOT)),'markdown':str(OUT_MD.relative_to(ROOT))},indent=2))
    return 1 if failed else 0

if __name__=='__main__':
    raise SystemExit(asyncio.run(run()))
