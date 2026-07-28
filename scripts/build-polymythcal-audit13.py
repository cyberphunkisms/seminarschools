#!/usr/bin/env python3
"""Build stable Polymythcal detail pages, legacy aliases, and standards-correct ICS files."""
from __future__ import annotations
from pathlib import Path
from zoneinfo import ZoneInfo
import datetime, hashlib, html, json, os, re, shutil, sys, urllib.parse
ROOT=Path(__file__).resolve().parents[1]
payload=json.loads((ROOT/'polymythseminars/events.json').read_text(encoding='utf-8'))
events=payload.get('events',[])
release=json.loads((ROOT/'RELEASE_MANIFEST.json').read_text(encoding='utf-8'))
ASSET_VERSION=str(release.get('polymythcal_asset_version') or '')
if not re.fullmatch(r'[0-9]{8}-[a-z0-9-]+',ASSET_VERSION): raise SystemExit('RELEASE_MANIFEST.json has no valid polymythcal_asset_version')
AUDIT43_VERSION='20260725-audit43'
STEADY_VERSION='20260723-steady'
EVENT_GEOMETRY_INTENSITY='0.105'
CHECK='--check' in sys.argv
OUTPUT_MTIME_TEXT=str(os.environ.get('SS_BUILD_OUTPUT_MTIME') or '').strip()
OUTPUT_MTIME=None
if OUTPUT_MTIME_TEXT:
 try:OUTPUT_MTIME=datetime.datetime.fromisoformat(OUTPUT_MTIME_TEXT.replace('Z','+00:00')).timestamp()
 except ValueError as exc:raise SystemExit(f'SS_BUILD_OUTPUT_MTIME is invalid: {exc}')
check_errors=[]
out=ROOT/'polymythseminars/events'; out.mkdir(parents=True,exist_ok=True)
icsdir=ROOT/'polymythseminars/ics'; icsdir.mkdir(parents=True,exist_ok=True)
DEFAULT_TZ='America/Toronto'
def release_build_day(value):
 text=str(value or '').strip().replace('Z','+00:00')
 try: moment=datetime.datetime.fromisoformat(text)
 except ValueError as exc: raise SystemExit(f'RELEASE_MANIFEST.json generated_at is invalid: {exc}')
 if moment.tzinfo is None: moment=moment.replace(tzinfo=ZoneInfo(DEFAULT_TZ))
 return moment.astimezone(ZoneInfo(DEFAULT_TZ)).date()
def resolve_site_build_day():
 override=str(os.environ.get('SITE_BUILD_DATE') or '').strip()
 if override:
  if not re.fullmatch(r'\d{4}-\d{2}-\d{2}',override): raise SystemExit('SITE_BUILD_DATE must use YYYY-MM-DD')
  try:return datetime.date.fromisoformat(override)
  except ValueError as exc:raise SystemExit(f'SITE_BUILD_DATE is not a real calendar date: {exc}')
 return datetime.datetime.now(ZoneInfo(DEFAULT_TZ)).date()
TODAY=resolve_site_build_day()
PLACEHOLDERS={'','unknown','location unconfirmed','location unconfirmed · lieu non confirmé','lieu non confirmé'}
def legacy_slug(value):
 text=html.unescape(str(value or 'event')).lower().replace('&',' and ')
 return re.sub(r'[^a-z0-9]+','-',text).strip('-')[:76] or 'event'
def legacy_alias(sid): return f'{legacy_slug(sid)}-{hashlib.sha1(str(sid).encode()).hexdigest()[:8]}'
def comparable_html(value):
 # The site-wide stylesheet postprocessor owns this cache token after the
 # event-detail generator runs. Normalize only that downstream-owned value so
 # --check continues to detect route/content drift without reporting a false
 # stale page after the canonical production pipeline completes.
 value=re.sub(r'(/css/site-wide-type-zoom\.css\?v=)[^"\']+',r'\1__SITE_WIDE_VERSION__',value,flags=re.I)
 value=re.sub(r'(data-site-wide-type-zoom=["\'])[^"\']+',r'\1__SITE_WIDE_VERSION__',value,flags=re.I)
 value=re.sub(r'<link\b[^>]*href=["\']/css/audit45-localization\.css[^"\']*["\'][^>]*>\s*','',value,flags=re.I)
 value=re.sub(r'<link\b[^>]*href=["\']/css/audit43-approved\.css[^"\']*["\'][^>]*>\s*','',value,flags=re.I)
 value=re.sub(r'<link\b(?=[^>]*rel=["\']alternate["\'])(?=[^>]*hreflang=)[^>]*>\s*','',value,flags=re.I)
 value=re.sub(r'<meta\b(?=[^>]*name=["\']translation-(?:source|source-sha256|status|policy)["\'])[^>]*>\s*','',value,flags=re.I)
 value=re.sub(r'(<h1)\s+lang=["\'][^"\']*["\']',r'\1',value,count=1,flags=re.I)
 return re.sub(r'\s+',' ',value).strip()
def write_if_changed(path:Path,text:str):
 old=path.read_bytes().decode('utf-8') if path.exists() else None
 if old!=text:
  if path.suffix.lower()=='.html' and old is not None and comparable_html(old)==comparable_html(text):return
  if CHECK and path.suffix.lower()=='.html':
   check_errors.append(f'stale generated file: {path.relative_to(ROOT)}')
  elif CHECK: check_errors.append(f'stale generated file: {path.relative_to(ROOT)}')
  else:
   prior_mtime=path.stat().st_mtime if path.exists() else None
   path.write_bytes(text.encode('utf-8'))
   if OUTPUT_MTIME is not None or (prior_mtime is not None and prior_mtime>datetime.datetime.now().timestamp()+60):
    regenerated_mtime=max(OUTPUT_MTIME or 0, (prior_mtime+2) if prior_mtime is not None else 0)
    os.utime(path,(regenerated_mtime,regenerated_mtime))
def clean_dirs(valid_ids,valid_aliases,valid_ics_aliases=None):
 if valid_ics_aliases is None:
  valid_ics_aliases={
   str(value)
   for event in events
   for value in (event.get('legacy_ids') or [])
   if str(value) and str(value)!=str(event.get('id') or event.get('identity_key'))
  }
 for child in out.iterdir():
  if child.is_dir() and child.name not in valid_ids and child.name not in valid_aliases:
   if CHECK: check_errors.append(f'stale generated directory: {child.relative_to(ROOT)}')
   else: shutil.rmtree(child)
 for old in icsdir.glob('*.ics'):
  if old.stem not in valid_ids and old.stem not in valid_ics_aliases:
   if CHECK: check_errors.append(f'stale generated file: {old.relative_to(ROOT)}')
   else: old.unlink()
labels={'time-unconfirmed':'Time unconfirmed · Heure non confirmée','date-unconfirmed':'Date unconfirmed · Date non confirmée','location-unconfirmed':'Location unconfirmed · Lieu non confirmé','current-edition-unconfirmed':'Current edition unconfirmed · Édition actuelle non confirmée','public-access-unconfirmed':'Public access unconfirmed · Accès public non confirmé','registration-unconfirmed':'Registration unconfirmed · Inscription non confirmée','participant-attendance-unconfirmed':'Participant attendance unconfirmed · Présence non confirmée','official-source-unconfirmed':'Official detail page unconfirmed · Source officielle non confirmée','aggregator-only':'Aggregator source only · Source agrégée seulement','private-status-unconfirmed':'Public/private status unconfirmed · Statut public ou privé non confirmé'}
lifecycle_labels={'active':'Active','missing-on-source':'Missing on source · Absent de la source','postponed':'Postponed · Reporté','rescheduled':'Rescheduled · Reprogrammé','cancelled':'Cancelled · Annulé','sold-out':'Sold out · Complet','registration-closed':'Registration closed · Inscriptions fermées','superseded':'Superseded · Remplacé','archived':'Archived · Archivé'}
def json_script(obj): return json.dumps(obj,ensure_ascii=False,separators=(',',':')).replace('</','<\\/')
def ics_escape(value): return str(value or '').replace('\\','\\\\').replace(';','\\;').replace(',','\\,').replace('\r\n','\\n').replace('\n','\\n').replace('\r','\\n')
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
def event_end_day(e):
 parsed=parse_iso(e.get('end_date') or e.get('date'),e.get('timezone') or DEFAULT_TZ)
 return parsed.date() if isinstance(parsed,datetime.datetime) else parsed
def clean_meta(value,limit=160):
 text=re.sub(r'\s+',' ',str(value or '')).strip()
 if len(text)<=limit:return text
 clip=text[:limit-1]
 boundary=max(clip.rfind('. '),clip.rfind('; '),clip.rfind(', '))
 if boundary>=80:clip=clip[:boundary]
 return clip.rstrip(' ,;:.')+'…'
def event_meta_description(e,title_text,venue,city):
 date_label=str(e.get('date') or '')[:10] or 'Date to be confirmed'
 location=', '.join(value for value in (venue,city) if value and value.lower() not in PLACEHOLDERS)
 facts=date_label+(f' at {location}' if location else '')+'.'
 detail=str(e.get('description') or e.get('raw_excerpt') or '').strip()
 return clean_meta(f'{title_text}. {facts} {detail}',160)
def related_events(event):
 sid=str(event.get('id') or event.get('identity_key'))
 event_type=str(event.get('type') or '').strip().lower()
 event_city=str(event.get('city') or '').strip().lower()
 event_day=parse_iso(event.get('date'),event.get('timezone') or DEFAULT_TZ)
 event_day=event_day.date() if isinstance(event_day,datetime.datetime) else event_day
 ranked=[]
 for candidate in events:
  candidate_id=str(candidate.get('id') or candidate.get('identity_key'))
  if candidate_id==sid or candidate.get('lifecycle_status') in {'cancelled','missing-on-source','archived'}:continue
  candidate_end=event_end_day(candidate)
  if not candidate_end or candidate_end<TODAY:continue
  candidate_type=str(candidate.get('type') or '').strip().lower()
  candidate_city=str(candidate.get('city') or '').strip().lower()
  same_type=bool(event_type and candidate_type==event_type)
  same_city=bool(event_city and event_city not in PLACEHOLDERS and candidate_city==event_city)
  if not same_type and not same_city:continue
  candidate_day=parse_iso(candidate.get('date'),candidate.get('timezone') or DEFAULT_TZ)
  candidate_day=candidate_day.date() if isinstance(candidate_day,datetime.datetime) else candidate_day
  distance=abs((candidate_day-event_day).days) if candidate_day and event_day else 99999
  score=int(same_type)*5+int(same_city)*4
  ranked.append((-score,distance,str(candidate.get('title') or '').casefold(),candidate_id,candidate))
 return [item[-1] for item in sorted(ranked)[:3]]
valid_ids={str(e.get('id') or e.get('identity_key')) for e in events}
alias_targets={}
def register_alias(alias_id,target_id):
 alias_id=str(alias_id or ''); target_id=str(target_id or '')
 if not re.fullmatch(r'[A-Za-z0-9._~-]+',alias_id): raise SystemExit(f'Unsafe legacy event route id: {alias_id!r}')
 if alias_id==target_id:return
 if alias_id in valid_ids: raise SystemExit(f'Legacy event route {alias_id!r} collides with a canonical event id')
 prior=alias_targets.get(alias_id)
 if prior and prior!=target_id: raise SystemExit(f'Legacy event route {alias_id!r} maps to both {prior!r} and {target_id!r}')
 alias_targets[alias_id]=target_id
for e in events:
 sid=str(e.get('id') or e.get('identity_key'))
 register_alias(legacy_alias(sid),sid)
 for value in e.get('legacy_ids') or []:
  legacy_id=str(value)
  register_alias(legacy_id,sid)
  register_alias(legacy_alias(legacy_id),sid)
clean_dirs(valid_ids,set(alias_targets))
title_date_counts={}
canonical_ics={}
for e in events:
 title_date_key=(str(e.get('title') or 'Untitled listing'),str(e.get('date') or '')[:10])
 title_date_counts[title_date_key]=title_date_counts.get(title_date_key,0)+1
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
 indexable=confirmation=='confirmed' and e.get('date_precision')=='exact' and valid_location(e) and lifecycle not in {'cancelled','missing-on-source','archived'} and not past
 robots='index,follow' if indexable else 'noindex,follow'
 canonical=f'https://seminarschools.com/polymythseminars/events/{urllib.parse.quote(sid)}/'
 schema={'@context':'https://schema.org','@type':'Event','name':title_text,'startDate':e.get('date'),'description':event_meta_description(e,title_text,venue,city),'eventStatus':{'postponed':'https://schema.org/EventPostponed','rescheduled':'https://schema.org/EventRescheduled'}.get(lifecycle,'https://schema.org/EventScheduled'),'url':canonical,'sameAs':source_text or None,'inLanguage':e.get('source_language') or 'en'} if indexable else None
 if schema and e.get('end_date'):schema['endDate']=e.get('end_date')
 if schema:schema['location']={'@type':'Place','name':venue,'address':city}
 if schema:schema={k:v for k,v in schema.items() if v is not None}
 source_label='Official or institutional source · Source officielle ou institutionnelle' if str(e.get('source_quality') or '').lower() in {'official','official-or-institutional','institutional'} else 'Source listing · Fiche source'
 status_text='Confirmed · Confirmé' if confirmation=='confirmed' else 'Some details pending · Certains détails à confirmer'
 when_text=html.escape(format_when(e))
 date_value=html.escape(str(e.get('date') or '')[:32],quote=True)
 date_token=str(e.get('date') or '')[:10] or 'Date pending'
 page_title_parts=[title_text,date_token]
 if title_date_counts.get((title_text,date_token),0)>1 and city.lower() not in PLACEHOLDERS:page_title_parts.append(city)
 page_title_text=' · '.join(page_title_parts)+' · Polymythcal'
 page_title=html.escape(page_title_text,quote=True)
 meta_description=html.escape(event_meta_description(e,title_text,venue,city),quote=True)
 related_items=[]
 for related in related_events(e):
  related_id=str(related.get('id') or related.get('identity_key'))
  related_title=html.escape(str(related.get('title') or 'Untitled listing'))
  related_date=html.escape(str(related.get('date') or '')[:10])
  related_city_value=str(related.get('city') or '')
  related_city=html.escape(related_city_value) if related_city_value.lower() not in PLACEHOLDERS else ''
  related_meta=' · '.join(value for value in (related_date,related_city) if value)
  related_items.append(f'<li><a href="/polymythseminars/events/{urllib.parse.quote(related_id)}/">{related_title}</a>{f" <span>{related_meta}</span>" if related_meta else ""}</li>')
 related_html=f'<nav class="pm-event-related" aria-labelledby="pm-related-title"><h2 id="pm-related-title">Related listings · Fiches connexes</h2><ul>{"".join(related_items)}</ul></nav>' if related_items else ''
 schema_markup=f'<script type="application/ld+json">{json_script(schema)}</script>\n' if schema else ''
 page=f'''<!doctype html>
<html lang="en-CA">
<head>
<script src="/js/theme-init.js?v={STEADY_VERSION}"></script>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="ss-build" content="{ASSET_VERSION}">
<title>{page_title}</title>
<meta property="og:title" content="{page_title}">
<meta name="description" content="{meta_description}">
<meta property="og:description" content="{meta_description}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Seminar Schools">
<meta property="og:url" content="{canonical}">
<meta name="robots" content="{robots}">
<link rel="canonical" href="{canonical}">
<link rel="alternate" hreflang="en-ca" href="{canonical}">
<link rel="alternate" hreflang="fr-ca" href="{canonical}?lang=fr">
<link rel="alternate" hreflang="x-default" href="{canonical}">
<link rel="stylesheet" href="/css/theme.css?v={ASSET_VERSION}">
<link rel="stylesheet" href="/css/alive.css">
<link rel="stylesheet" href="/css/polymythcal-features.css?v={ASSET_VERSION}">
<link rel="stylesheet" href="/css/site-wide-type-zoom.css?v={ASSET_VERSION}" data-site-wide-type-zoom="{ASSET_VERSION}">
{schema_markup}<link rel="stylesheet" href="/css/audit43-approved.css?v={AUDIT43_VERSION}">
<link rel="stylesheet" href="/css/calm-ux.css?v={STEADY_VERSION}">
</head>
<body data-route-type="calendar-event" data-geometry="indra-web" data-indra-intensity="{EVENT_GEOMETRY_INTENSITY}" data-event-id="{html.escape(sid,quote=True)}">
<a class="skip-link" href="#main-content">Skip to event · Aller à la fiche</a>
<main id="main-content" class="pm-event-page">
<nav class="pm-event-nav" aria-label="Event navigation · Navigation de la fiche"><a href="/polymythseminars/">← All listings · Toutes les fiches</a><a href="?lang=fr" hreflang="fr-CA">Français</a></nav>
<article class="pm-event-detail">
<header class="pm-event-hero">
<p class="pm-event-kicker">Polymythcal</p>
<div class="truth-row"><span class="truth-chip {confirmation}">{status_text}</span>{f'<span class="pm-lifecycle {html.escape(lifecycle)}" data-en-label="{html.escape(lifecycle_labels.get(lifecycle,lifecycle))}">{html.escape(lifecycle_labels.get(lifecycle,lifecycle))}</span>' if lifecycle!='active' else ''}</div>
<h1>{title}</h1>
</header>
{'<div class="callout pm-event-archive" data-event-archive-note="true"><strong>Past event · Événement passé.</strong> This page remains as an archive. Check the source for a current edition.</div>' if past else ''}
<dl class="pm-event-facts">
<div><dt>Date · Date</dt><dd><time datetime="{date_value}">{when_text}</time></dd></div>
<div><dt>Place · Lieu</dt><dd><strong>{html.escape(venue)}</strong><span>{html.escape(city)}</span></dd></div>
<div><dt>Status · Statut</dt><dd>{status_text}</dd></div>
</dl>
{f'<section class="pm-event-description"><h2>About this listing · À propos</h2><p>{html.escape(desc)}</p></section>' if desc else ''}
{f'<details class="pm-event-pending"><summary>Details still pending · Détails à confirmer</summary><p><strong>Qualification · Précision:</strong> {html.escape(reasons)}</p></details>' if reasons else ''}
{f'<p class="pm-event-previous"><strong>Previous date · Date précédente:</strong> {html.escape(" · ".join(e.get("previous_dates") or []))}</p>' if e.get('previous_dates') else ''}
{related_html}
<footer class="pm-event-footer">
<p class="pm-event-checked"><strong>Last checked · Dernière vérification:</strong> {html.escape(str(e.get('last_checked_at') or 'Unknown'))[:10]}</p>
<div class="pm-event-actions">{f'<a class="pm-event-action primary" href="{source}" rel="noopener noreferrer">{source_label} ↗</a>' if source_text else ''}<a class="pm-event-action" type="text/calendar" href="/polymythseminars/ics/{html.escape(sid,quote=True)}.ics">Add to calendar · Ajouter au calendrier</a><a class="pm-event-action" href="/polymythseminars/correct/?event={html.escape(canonical,quote=True)}">Correct this listing · Corriger cette fiche</a></div>
</footer>
</article>
</main>
<script src="/js/theme.js" defer></script>
<script src="/js/polymythcal-features.js?v={ASSET_VERSION}" defer></script>
<script src="/js/site-keyboard-enhancements.js?v={ASSET_VERSION}" defer></script>
<script src="/js/mandala.js?v=cl91" defer></script>
<script src="/js/indra.js?v=cl91" defer></script>
</body>
</html>'''

 write_if_changed(folder/'index.html',page)
 lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Seminar Schools//Polymythcal//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT',f'UID:{ics_escape(e.get("identity_key") or sid)}@seminarschools.com',f'DTSTAMP:{deterministic_stamp(e)}']
 start=ics_start(e.get('date'),e.get('time_precision'),e.get('timezone') or DEFAULT_TZ)
 if start:lines.append(start)
 end=ics_end(e.get('end_date'),e.get('time_precision'),e.get('timezone') or DEFAULT_TZ)
 if end:lines.append(end)
 lines+=['SUMMARY:'+ics_escape(title_text),'LOCATION:'+ics_escape(venue),'DESCRIPTION:'+ics_escape(desc[:800]),'URL:'+canonical,'STATUS:'+status_ics(e),'END:VEVENT','END:VCALENDAR','']
 ics_text='\r\n'.join(fold_ics(line) for line in lines)
 canonical_ics[sid]=ics_text
 write_if_changed(icsdir/(sid+'.ics'),ics_text)
for e in events:
 sid=str(e.get('id') or e.get('identity_key'))
 for legacy_id in e.get('legacy_ids') or []:
  legacy_id=str(legacy_id)
  if legacy_id and legacy_id!=sid:
   write_if_changed(icsdir/(legacy_id+'.ics'),canonical_ics[sid])
for alias_id,sid in sorted(alias_targets.items()):
 target=f'/polymythseminars/events/{urllib.parse.quote(sid)}/'; alias_folder=out/alias_id; alias_folder.mkdir(parents=True,exist_ok=True)
 alias_page=f'<!doctype html><html lang="en-CA"><head>\n<script src="/js/theme-init.js?v={STEADY_VERSION}"></script><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,follow"><meta http-equiv="refresh" content="0;url={html.escape(target,quote=True)}"><link rel="canonical" href="https://seminarschools.com{html.escape(target,quote=True)}"><title>Event moved · Fiche déplacée</title><link rel="stylesheet" href="/css/site-wide-type-zoom.css?v={ASSET_VERSION}" data-site-wide-type-zoom="{ASSET_VERSION}"><link rel="stylesheet" href="/css/alive.css?v={STEADY_VERSION}">\n<link rel="stylesheet" href="/css/audit43-approved.css?v={AUDIT43_VERSION}">\n<link rel="stylesheet" href="/css/calm-ux.css?v={STEADY_VERSION}">\n</head><body data-route-type="calendar-event-alias" data-legacy-event-id="{html.escape(alias_id,quote=True)}" data-geometry="indra-web" data-indra-intensity="{EVENT_GEOMETRY_INTENSITY}"><main><h1>Event moved · Fiche déplacée</h1><p><a href="{html.escape(target,quote=True)}">Open the stable event page · Ouvrir la fiche stable</a></p></main><script>location.replace({json.dumps(target)})</script><script src="/js/mandala.js?v={STEADY_VERSION}" defer></script>\n<script src="/js/indra.js?v={STEADY_VERSION}" defer></script>\n</body></html>'
 write_if_changed(alias_folder/'index.html',alias_page)
alias=ROOT/'polymythcal';alias.mkdir(exist_ok=True)
write_if_changed(alias/'index.html',f'<!doctype html><html lang="en-CA"><head>\n<script src="/js/theme-init.js?v={STEADY_VERSION}"></script><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,follow"><meta http-equiv="refresh" content="0;url=/polymythseminars/"><link rel="canonical" href="https://seminarschools.com/polymythseminars/"><title>Polymythcal</title><link rel="stylesheet" href="/css/site-wide-type-zoom.css?v={ASSET_VERSION}" data-site-wide-type-zoom="{ASSET_VERSION}"><link rel="stylesheet" href="/css/alive.css?v={STEADY_VERSION}">\n<link rel="stylesheet" href="/css/audit43-approved.css?v={AUDIT43_VERSION}">\n<link rel="stylesheet" href="/css/calm-ux.css?v={STEADY_VERSION}">\n</head><body data-geometry="indra-web" data-indra-intensity="0.070"><main><h1>Polymythcal</h1><p><a href="/polymythseminars/">Open Polymythcal</a></p></main><script>location.replace("/polymythseminars/")</script><script src="/js/mandala.js?v={STEADY_VERSION}" defer></script>\n<script src="/js/indra.js?v={STEADY_VERSION}" defer></script>\n</body></html>')
if check_errors:
 print('POLYMYTHCAL DETAIL CHECK FAILED')
 for error in check_errors[:120]:print(' - '+error)
 if len(check_errors)>120:print(f' - … {len(check_errors)-120} more')
 raise SystemExit(1)
verb='Checked' if CHECK else 'Built'
print(f'{verb} {len(events)} stable bilingual event pages, {len(alias_targets)} legacy aliases, and standards-correct ICS files')
