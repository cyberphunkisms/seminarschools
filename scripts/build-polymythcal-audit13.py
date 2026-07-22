#!/usr/bin/env python3
"""Build stable Polymythcal detail pages, legacy aliases, and standards-correct ICS files."""
from __future__ import annotations
from pathlib import Path
from zoneinfo import ZoneInfo
import datetime, hashlib, html, json, re, shutil, urllib.parse
ROOT=Path(__file__).resolve().parents[1]
payload=json.loads((ROOT/'polymythseminars/events.json').read_text(encoding='utf-8'))
events=payload.get('events',[])
release=json.loads((ROOT/'RELEASE_MANIFEST.json').read_text(encoding='utf-8'))
out=ROOT/'polymythseminars/events'; out.mkdir(parents=True,exist_ok=True)
icsdir=ROOT/'polymythseminars/ics'; icsdir.mkdir(parents=True,exist_ok=True)
DEFAULT_TZ='America/Toronto'
TODAY=datetime.datetime.now(ZoneInfo(DEFAULT_TZ)).date()
PLACEHOLDERS={'','unknown','location unconfirmed','location unconfirmed · lieu non confirmé','lieu non confirmé'}
def legacy_slug(value):
 text=html.unescape(str(value or 'event')).lower().replace('&',' and ')
 return re.sub(r'[^a-z0-9]+','-',text).strip('-')[:76] or 'event'
def legacy_alias(sid): return f'{legacy_slug(sid)}-{hashlib.sha1(str(sid).encode()).hexdigest()[:8]}'
def write_if_changed(path:Path,text:str):
 old=path.read_text(encoding='utf-8') if path.exists() else None
 if old!=text: path.write_text(text,encoding='utf-8')
def clean_dirs(valid_ids,valid_aliases):
 for child in out.iterdir():
  if child.is_dir() and child.name not in valid_ids and child.name not in valid_aliases: shutil.rmtree(child)
 for old in icsdir.glob('*.ics'):
  if old.stem not in valid_ids: old.unlink()
labels={'time-unconfirmed':'Time unconfirmed · Heure non confirmée','date-unconfirmed':'Date unconfirmed · Date non confirmée','location-unconfirmed':'Location unconfirmed · Lieu non confirmé','current-edition-unconfirmed':'Current edition unconfirmed · Édition actuelle non confirmée','public-access-unconfirmed':'Public access unconfirmed · Accès public non confirmé','registration-unconfirmed':'Registration unconfirmed · Inscription non confirmée','participant-attendance-unconfirmed':'Participant attendance unconfirmed · Présence non confirmée','official-source-unconfirmed':'Official detail page unconfirmed · Source officielle non confirmée','aggregator-only':'Aggregator source only · Source agrégée seulement','private-status-unconfirmed':'Public/private status unconfirmed · Statut public ou privé non confirmé'}
lifecycle_labels={'active':'Active','missing-on-source':'Missing on source · Absent de la source','postponed':'Postponed · Reporté','rescheduled':'Rescheduled · Reprogrammé','cancelled':'Cancelled · Annulé','sold-out':'Sold out · Complet','registration-closed':'Registration closed · Inscriptions fermées','superseded':'Superseded · Remplacé','archived':'Archived · Archivé'}
def json_script(obj): return json.dumps(obj,ensure_ascii=False,separators=(',',':')).replace('</','<\\/')
def ics_escape(value): return str(value or '').replace('\\','\\\\').replace(';','\\;').replace(',','\\,').replace('\r\n','\\n').replace('\n','\\n')
def parse_iso(value,tz_name=DEFAULT_TZ):
 if not value:return None
 text=str(value).strip()
 if re.fullmatch(r'\d{4}-\d{2}-\d{2}',text): return datetime.date.fromisoformat(text)
 try:
  dt=datetime.datetime.fromisoformat(text.replace('Z','+00:00'))
 except ValueError:return None
 if dt.tzinfo is None:
  try:dt=dt.replace(tzinfo=ZoneInfo(tz_name or DEFAULT_TZ))
  except Exception:dt=dt.replace(tzinfo=ZoneInfo(DEFAULT_TZ))
 return dt
def ics_start(value,precision,tz_name):
 parsed=parse_iso(value,tz_name)
 if parsed is None:return None
 if precision!='exact' or isinstance(parsed,datetime.date) and not isinstance(parsed,datetime.datetime):
  day=parsed.date() if isinstance(parsed,datetime.datetime) else parsed
  return f'DTSTART;VALUE=DATE:{day:%Y%m%d}'
 return f'DTSTART:{parsed.astimezone(datetime.timezone.utc):%Y%m%dT%H%M%SZ}'
def ics_end(value,precision,tz_name):
 parsed=parse_iso(value,tz_name)
 if parsed is None:return None
 if precision!='exact' or isinstance(parsed,datetime.date) and not isinstance(parsed,datetime.datetime):
  day=parsed.date() if isinstance(parsed,datetime.datetime) else parsed
  return f'DTEND;VALUE=DATE:{day+datetime.timedelta(days=1):%Y%m%d}'
 return f'DTEND:{parsed.astimezone(datetime.timezone.utc):%Y%m%dT%H%M%SZ}'
def deterministic_stamp(event):
 for value in (event.get('last_checked_at'),event.get('scraped_at'),payload.get('_generated_at'),release.get('generated_at')):
  parsed=parse_iso(value,'UTC')
  if isinstance(parsed,datetime.datetime): return parsed.astimezone(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
 return '20260722T183000Z'
def fold_ics(line):
 parts=[]; current=''
 for char in line:
  candidate=current+char
  if len(candidate.encode('utf-8'))>73 and current:
   parts.append(current); current=' '+char
  else: current=candidate
 parts.append(current)
 return '\r\n'.join(parts)
def format_when(e):
 value=str(e.get('date') or '')
 return value[:10] if e.get('time_precision')!='exact' else value.replace('T',' ')[:16]
def status_ics(e):
 return 'CANCELLED' if e.get('lifecycle_status')=='cancelled' else ('TENTATIVE' if e.get('confirmation_status')!='confirmed' else 'CONFIRMED')
def valid_location(e):
 venue=str(e.get('venue') or '').strip(); city=str(e.get('city') or '').strip()
 return venue.lower() not in PLACEHOLDERS and city.lower() not in PLACEHOLDERS
valid_ids={str(e.get('id') or e.get('identity_key')) for e in events}
valid_aliases={legacy_alias(x) for x in valid_ids}
clean_dirs(valid_ids,valid_aliases)
for e in events:
 sid=str(e.get('id') or e.get('identity_key')); folder=out/sid; folder.mkdir(parents=True,exist_ok=True)
 title_text=str(e.get('title') or 'Untitled listing'); title=html.escape(title_text)
 source_text=str(e.get('source_url') or ''); source=html.escape(source_text,quote=True)
 reasons=' · '.join(labels.get(x,str(x).replace('-',' ').title()) for x in e.get('qualification_reasons',[]))
 confirmation=str(e.get('confirmation_status') or 'unconfirmed'); lifecycle=str(e.get('lifecycle_status') or 'active')
 end_value=parse_iso(e.get('end_date') or e.get('date'),e.get('timezone') or DEFAULT_TZ)
 end_day=end_value.date() if isinstance(end_value,datetime.datetime) else end_value
 past=bool(end_day and end_day<TODAY)
 city=str(e.get('city') or 'Unknown'); venue=str(e.get('venue') or 'Location unconfirmed · Lieu non confirmé')
 desc=str(e.get('description') or e.get('raw_excerpt') or '')
 robots='index,follow' if confirmation=='confirmed' and e.get('date_precision')=='exact' and valid_location(e) and lifecycle not in {'cancelled','missing-on-source','archived'} and not past else 'noindex,follow'
 canonical=f'https://seminarschools.com/polymythseminars/events/{urllib.parse.quote(sid)}/'
 schema={'@context':'https://schema.org','@type':'Event','name':title_text,'startDate':e.get('date'),'eventStatus':{'cancelled':'https://schema.org/EventCancelled','postponed':'https://schema.org/EventPostponed','rescheduled':'https://schema.org/EventRescheduled'}.get(lifecycle,'https://schema.org/EventScheduled'),'url':canonical,'sameAs':source_text or None,'inLanguage':e.get('source_language') or 'en'}
 if e.get('end_date'):schema['endDate']=e.get('end_date')
 if valid_location(e):schema['location']={'@type':'Place','name':venue,'address':city}
 schema={k:v for k,v in schema.items() if v is not None}
 if past:schema=None
 source_label='Official or institutional source · Source officielle ou institutionnelle' if str(e.get('source_quality') or '').lower() in {'official','official-or-institutional','institutional'} else 'Source listing · Fiche source'
 page=f'''<!doctype html><html lang="en-CA"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="ss-build" content="20260722-audit21"><title>{title} · Polymythcal</title><meta property="og:title" content="{title} · Polymythcal"><meta name="description" content="Polymythcal listing for {title}."><meta property="og:description" content="Polymythcal listing for {title}."><meta name="robots" content="{robots}"><link rel="canonical" href="{canonical}"><link rel="alternate" hreflang="en-ca" href="{canonical}"><link rel="alternate" hreflang="fr-ca" href="{canonical}?lang=fr"><link rel="alternate" hreflang="x-default" href="{canonical}"><link rel="stylesheet" href="/css/theme.css"><link rel="stylesheet" href="/css/alive.css"><link rel="stylesheet" href="/css/polymythcal-features.css?v=20260722-audit21"><link rel="stylesheet" href="/css/site-wide-type-zoom.css?v=20260710-reviews-zoom-font-a" data-site-wide-type-zoom="20260710-reviews-zoom-font-a">{f'<script type="application/ld+json">{json_script(schema)}</script>' if schema else ''}</head><body data-route-type="calendar-event" data-geometry="indra-web" data-indra-intensity="0.08" data-event-id="{html.escape(sid,quote=True)}"><a class="skip-link" href="#main-content">Skip to main content · Aller au contenu</a><main id="main-content" class="pm-form-shell"><p><a href="/polymythseminars/">← Polymythcal</a></p><article><div class="truth-row"><span class="truth-chip {confirmation}">{'Confirmed · Confirmé' if confirmation=='confirmed' else 'Unconfirmed · Non confirmé'}</span>{f'<span class="pm-lifecycle {html.escape(lifecycle)}" data-en-label="{html.escape(lifecycle_labels.get(lifecycle,lifecycle))}">{html.escape(lifecycle_labels.get(lifecycle,lifecycle))}</span>' if lifecycle!='active' else ''}</div><h1>{title}</h1>{'<div class="callout" data-event-archive-note="true"><strong>Past event · Événement passé.</strong> This permalink is retained as an archive record. Check the source for a current edition.</div>' if past else ''}<p><strong>{html.escape(format_when(e))}</strong> · {html.escape(city)} · {html.escape(venue)}</p>{f'<p><strong>Qualification · Précision:</strong> {html.escape(reasons)}</p>' if reasons else ''}{f'<p>{html.escape(desc)}</p>' if desc else ''}<p><strong>Last checked · Dernière vérification:</strong> {html.escape(str(e.get('last_checked_at') or 'Unknown'))[:10]}</p>{f'<p><strong>Previous date · Date précédente:</strong> {html.escape(" · ".join(e.get("previous_dates") or []))}</p>' if e.get('previous_dates') else ''}<div class="pm-event-actions">{f'<a href="{source}" rel="noopener noreferrer">{source_label} ↗</a>' if source_text else ''}<a href="/polymythseminars/ics/{html.escape(sid,quote=True)}.ics">Add to calendar · Ajouter au calendrier</a><a href="/polymythseminars/correct/?event={html.escape(canonical,quote=True)}">Correct this listing · Corriger cette fiche</a></div></article></main><script src="/js/theme.js" defer></script><script src="/js/polymythcal-features.js?v=20260722-audit21" defer></script><script defer src="/js/site-keyboard-enhancements.js"></script><script defer src="/js/mandala.js?v=cl91"></script><script defer src="/js/indra.js?v=cl91"></script></body></html>'''
 write_if_changed(folder/'index.html',page)
 lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Seminar Schools//Polymythcal//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT',f'UID:{ics_escape(e.get("identity_key") or sid)}@seminarschools.com',f'DTSTAMP:{deterministic_stamp(e)}']
 start=ics_start(e.get('date'),e.get('time_precision'),e.get('timezone') or DEFAULT_TZ)
 if start:lines.append(start)
 end=ics_end(e.get('end_date'),e.get('time_precision'),e.get('timezone') or DEFAULT_TZ)
 if end:lines.append(end)
 lines+=['SUMMARY:'+ics_escape(title_text),'LOCATION:'+ics_escape(venue),'DESCRIPTION:'+ics_escape(desc[:800]),'URL:'+canonical,'STATUS:'+status_ics(e),'END:VEVENT','END:VCALENDAR','']
 write_if_changed(icsdir/(sid+'.ics'),'\r\n'.join(fold_ics(line) for line in lines))
for e in events:
 sid=str(e.get('id') or e.get('identity_key')); alias_id=legacy_alias(sid)
 if alias_id==sid:continue
 target=f'/polymythseminars/events/{urllib.parse.quote(sid)}/'; alias_folder=out/alias_id; alias_folder.mkdir(parents=True,exist_ok=True)
 alias_page=f'<!doctype html><html lang="en-CA"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,follow"><meta http-equiv="refresh" content="0;url={html.escape(target,quote=True)}"><link rel="canonical" href="https://seminarschools.com{html.escape(target,quote=True)}"><title>Event moved · Fiche déplacée</title><link rel="stylesheet" href="/css/site-wide-type-zoom.css?v=20260710-reviews-zoom-font-a" data-site-wide-type-zoom="20260710-reviews-zoom-font-a">\n</head><body><p><a href="{html.escape(target,quote=True)}">Open the stable event page · Ouvrir la fiche stable</a></p><script>location.replace({json.dumps(target)})</script></body></html>'
 write_if_changed(alias_folder/'index.html',alias_page)
alias=ROOT/'polymythcal';alias.mkdir(exist_ok=True)
write_if_changed(alias/'index.html','<!doctype html><html lang="en-CA"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,follow"><meta http-equiv="refresh" content="0;url=/polymythseminars/"><link rel="canonical" href="https://seminarschools.com/polymythseminars/"><title>Polymythcal</title><link rel="stylesheet" href="/css/site-wide-type-zoom.css?v=20260710-reviews-zoom-font-a" data-site-wide-type-zoom="20260710-reviews-zoom-font-a">\n</head><body><p><a href="/polymythseminars/">Open Polymythcal</a></p><script>location.replace("/polymythseminars/")</script></body></html>')
print(f'Built {len(events)} stable bilingual event pages and standards-correct ICS files')
