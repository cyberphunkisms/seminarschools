#!/usr/bin/env python3
"""Generate focused bilingual RSS and calendar-subscription feeds from canonical Polymythcal data."""
from __future__ import annotations
import html,json,re
from datetime import datetime,timezone
from pathlib import Path
from email.utils import format_datetime
ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/'polymythseminars/events.json'; OUT=ROOT/'polymythseminars/feeds'
BASE='https://seminarschools.com/polymythseminars/'

def text(e): return ' '.join(str(e.get(k) or '') for k in ('title','type','description','raw_excerpt','venue','city','corridor_zone','record_kind','source_language')).lower()
def cats(e): return {str(e.get('type') or ''),*map(str,e.get('secondary_types') or [])}
FOCUSES={
 'all':('All listings','Toutes les fiches',lambda e:True),
 'confirmed':('Confirmed listings','Fiches confirmées',lambda e:e.get('confirmation_status')=='confirmed'),
 'unconfirmed':('Unconfirmed listings','Fiches non confirmées',lambda e:e.get('confirmation_status')=='unconfirmed'),
 'learning':('Learning, lectures, workshops, and readings','Apprentissage, conférences, ateliers et lectures',lambda e:bool(cats(e)&{'lecture','talk','conference','symposium','workshop','reading','book-talk','cfp','contest'}) or re.search(r'lecture|seminar|workshop|reading|university|library|student',text(e))),
 'arts':('Arts, festivals, exhibitions, performances, and screenings','Arts, festivals, expositions, spectacles et projections',lambda e:bool(cats(e)&{'festival','exhibition','performance','screening','reading'}) or re.search(r'art|film|cinema|music|theatre|festival|exhibition|gallery',text(e))),
 'civic':('Civic action and community listings','Actions civiques et fiches communautaires',lambda e:e.get('record_kind')=='civic-action' or bool(cats(e)&{'protest','community','demonstration','rally','march','vigil'}) or re.search(r'civic|protest|rally|march|solidarity|community action',text(e))),
 'deadlines':('Calls for papers, contests, fellowships, and deadlines','Appels, concours, bourses et échéances',lambda e:bool(cats(e)&{'cfp','contest'}) or re.search(r'deadline|call for papers|submission|fellowship|grant|application',text(e))),
 'toronto':('Toronto listings','Fiches de Toronto',lambda e:e.get('corridor_zone')=='toronto' or str(e.get('city','')).lower()=='toronto'),
 'corridor':('Kingston to Montréal corridor','Corridor de Kingston à Montréal',lambda e:e.get('corridor_zone') in {'kingston','gananoque-thousand-islands','brockville-leeds-grenville','cornwall-sdg','montreal'}),
 'montreal':('Montréal listings','Fiches de Montréal',lambda e:e.get('corridor_zone')=='montreal' or 'montréal' in str(e.get('city','')).lower()),
 'fr':('French-language listings','Fiches de langue française',lambda e:str(e.get('source_language') or '').lower().startswith('fr') or re.search(r'\b(montréal|conférence|atelier|exposition|bibliothèque)\b',text(e))),
}

def esc_ics(s): return str(s or '').replace('\\','\\\\').replace(';','\\;').replace(',','\\,').replace('\n','\\n')
def fold(line):
 b=line.encode('utf-8'); chunks=[]
 while len(b)>75:
  cut=75
  while cut>0 and (b[cut]&0xC0)==0x80: cut-=1
  chunks.append(b[:cut].decode('utf-8')); b=b[cut:]
 chunks.append(b.decode('utf-8'))
 return '\r\n '.join(chunks)
def ics_dt(value,precision):
 if not value:return None
 if precision!='exact': return ('DATE',str(value)[:10].replace('-',''))
 dt=re.sub(r'[-:]','',str(value)[:19]); return ('DATE-TIME',dt)
def item_url(e): return BASE+'events/'+str(e.get('id') or e.get('identity_key'))+'/'

def build_ics(name,label_en,label_fr,events):
 lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Seminar Schools//Polymythcal//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:'+esc_ics('Polymythcal — '+label_en+' · '+label_fr),'X-WR-TIMEZONE:America/Toronto']
 for e in events:
  start=ics_dt(e.get('date'),e.get('time_precision')); end=ics_dt(e.get('end_date'),e.get('time_precision'))
  if not start:continue
  lines+=['BEGIN:VEVENT','UID:'+str(e.get('identity_key') or e.get('id'))+'@seminarschools.com','DTSTAMP:'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')]
  lines.append(('DTSTART;VALUE=DATE:' if start[0]=='DATE' else 'DTSTART:')+start[1])
  if end: lines.append(('DTEND;VALUE=DATE:' if end[0]=='DATE' else 'DTEND:')+end[1])
  lines += ['SUMMARY:'+esc_ics(e.get('title')),'LOCATION:'+esc_ics(e.get('venue')),'DESCRIPTION:'+esc_ics((e.get('description') or e.get('raw_excerpt') or '')[:500]),'URL:'+item_url(e),'STATUS:'+('CANCELLED' if e.get('lifecycle_status')=='cancelled' else ('TENTATIVE' if e.get('confirmation_status')=='unconfirmed' else 'CONFIRMED')),'END:VEVENT']
 lines.append('END:VCALENDAR')
 return '\r\n'.join(fold(x) for x in lines)+'\r\n'
def build_rss(name,label_en,label_fr,events):
 now=format_datetime(datetime.now(timezone.utc)); items=[]
 for e in events:
  try: pub=format_datetime(datetime.fromisoformat(str(e.get('date')).replace('Z','+00:00')))
  except Exception: pub=now
  desc=' · '.join(filter(None,[str(e.get('venue') or ''),str(e.get('city') or ''),str(e.get('confirmation_status') or ''),str(e.get('lifecycle_status') or '')]))
  items.append(f'<item><title>{html.escape(str(e.get("title") or ""))}</title><link>{html.escape(item_url(e))}</link><guid isPermaLink="false">{html.escape(str(e.get("identity_key") or e.get("id")))}</guid><pubDate>{pub}</pubDate><description>{html.escape(desc)}</description><category>{html.escape(str(e.get("type") or "Other"))}</category></item>')
 self_url=BASE+('feed.xml' if name=='all' else f'feeds/{name}.xml')
 title=f'Polymythcal — {label_en} · {label_fr}'
 description=f'{label_en} · {label_fr} — Polymythcal.'
 return '<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>'+f'<title>{html.escape(title)}</title><link>{BASE}</link><atom:link href="{self_url}" rel="self" type="application/rss+xml"/><description>{html.escape(description)}</description><language>en-CA</language><lastBuildDate>{now}</lastBuildDate>'+''.join(items)+'</channel></rss>\n'

def build_subscribe_page(manifest):
 rows=[]
 for f in manifest:
  rows.append(f'<li class="pm-feed-row"><span><span lang="en">{html.escape(f["label_en"])}</span> · <span lang="fr">{html.escape(f["label_fr"])}</span> ({f["count"]})</span><span><a href="{html.escape(f["rss"],quote=True)}">RSS</a> · <a href="{html.escape(f["ics"],quote=True)}">ICS</a></span></li>')
 page='''<!doctype html><html lang="en-CA"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Polymythcal subscriptions · Abonnements Polymythcal</title><meta name="description" content="Focused Polymythcal RSS and calendar subscriptions for confirmed, regional, civic, arts, learning, deadline, English, and French listings."><meta name="robots" content="index,follow"><link rel="canonical" href="https://seminarschools.com/polymythseminars/subscribe/"><link rel="alternate" hreflang="en-ca" href="https://seminarschools.com/polymythseminars/subscribe/"><link rel="alternate" hreflang="fr-ca" href="https://seminarschools.com/polymythseminars/subscribe/?lang=fr"><link rel="alternate" hreflang="x-default" href="https://seminarschools.com/polymythseminars/subscribe/"><link rel="stylesheet" href="/css/theme.css"><link rel="stylesheet" href="/css/alive.css"><link rel="stylesheet" href="/css/polymythcal-features.css?v=20260720-audit14"><link rel="stylesheet" href="/css/site-wide-type-zoom.css?v=20260710-reviews-zoom-font-a"></head><body data-route-type="calendar-form" data-geometry="indra-web" data-indra-intensity="0.055"><a class="skip-link" href="#main-content">Skip to subscriptions · Aller aux abonnements</a><main class="pm-form-shell" id="main-content"><p><a href="/polymythseminars/">← Polymythcal</a></p><h1>Subscriptions · <span lang="fr">Abonnements</span></h1><p>RSS works in feed readers. ICS works in calendar apps. · <span lang="fr">RSS fonctionne dans les lecteurs de fils. ICS fonctionne dans les applications de calendrier.</span></p><ul class="pm-feed-list">'''+''.join(rows)+'''</ul></main><script src="/js/theme.js" defer></script><script src="/js/polymythcal-features.js?v=20260720-audit14" defer></script><script defer src="/js/site-keyboard-enhancements.js"></script><script defer src="/js/mandala.js?v=cl91"></script><script defer src="/js/indra.js?v=cl91"></script></body></html>'''
 subdir=ROOT/'polymythseminars/subscribe';subdir.mkdir(parents=True,exist_ok=True);(subdir/'index.html').write_text(page,encoding='utf-8')

def main():
 payload=json.loads(DATA.read_text(encoding='utf-8')); events=sorted(payload.get('events',[]),key=lambda e:str(e.get('date') or ''))
 OUT.mkdir(parents=True,exist_ok=True); manifest=[]
 for name,(label_en,label_fr,pred) in FOCUSES.items():
  subset=[e for e in events if pred(e)]
  rss=build_rss(name,label_en,label_fr,subset); ics=build_ics(name,label_en,label_fr,subset)
  rss_path=(ROOT/'polymythseminars/feed.xml') if name=='all' else OUT/f'{name}.xml'
  ics_path=OUT/f'{name}.ics'; rss_path.write_text(rss,encoding='utf-8'); ics_path.write_text(ics,encoding='utf-8')
  manifest.append({'id':name,'label':label_en,'label_en':label_en,'label_fr':label_fr,'count':len(subset),'rss':'/polymythseminars/feed.xml' if name=='all' else f'/polymythseminars/feeds/{name}.xml','ics':f'/polymythseminars/feeds/{name}.ics'})
 (OUT/'index.json').write_text(json.dumps({'generated_at':datetime.now(timezone.utc).isoformat(),'feeds':manifest},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 build_subscribe_page(manifest)
 print('Built',len(manifest),'focused bilingual RSS/ICS pairs and subscription index')
if __name__=='__main__':main()
