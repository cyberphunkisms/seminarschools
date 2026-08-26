#!/usr/bin/env python3
"""Build stable Polymythcal detail pages, legacy aliases, and standards-correct ICS files."""
from __future__ import annotations
from pathlib import Path
from zoneinfo import ZoneInfo
import datetime, hashlib, html, json, os, re, shutil, sys, urllib.parse
from geometry_asset_version import geometry_asset_version, geometry_body_attributes
ROOT=Path(__file__).resolve().parents[1]
payload=json.loads((ROOT/'polymythseminars/events.json').read_text(encoding='utf-8'))
events=payload.get('events',[])
browse_payload=json.loads((ROOT/'polymythseminars/browse.json').read_text(encoding='utf-8'))
watchlist_payload=json.loads((ROOT/'polymythseminars/watchlist.json').read_text(encoding='utf-8'))
chronology_public={str(event['id']):event for event in browse_payload.get('events',[])}
watchlist_public={str(event['id']):event for event in watchlist_payload.get('items',[])}
public_by_id={**chronology_public,**watchlist_public}
canonical_ids={str(event.get('id') or event.get('identity_key')) for event in events}
if set(public_by_id)!=canonical_ids or set(chronology_public)&set(watchlist_public):
 raise SystemExit('Polymythcal detail build requires a complete, disjoint chronology/watchlist projection')
chronology_events=[event for event in events if str(event.get('id') or event.get('identity_key')) in chronology_public]
release=json.loads((ROOT/'RELEASE_MANIFEST.json').read_text(encoding='utf-8'))
ASSET_VERSION=str(release.get('polymythcal_asset_version') or '')
if not re.fullmatch(r'[0-9]{8}-[a-z0-9-]+',ASSET_VERSION): raise SystemExit('RELEASE_MANIFEST.json has no valid polymythcal_asset_version')
AUDIT43_VERSION='20260725-audit43'
STEADY_VERSION='20260723-steady'
type_zoom_source=(ROOT/'scripts'/'apply-sitewide-type-zoom-link.js').read_text(encoding='utf-8')
type_zoom_match=re.search(r"const BUILD = '([^']+)'",type_zoom_source)
TYPE_ZOOM_VERSION=type_zoom_match.group(1) if type_zoom_match else ''
if not re.fullmatch(r'[0-9]{8}-[a-z0-9-]+',TYPE_ZOOM_VERSION):raise SystemExit('site-wide type/zoom build identifier is invalid')
GEOMETRY_VERSION=geometry_asset_version(ROOT)
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
def tag_attribute(tag,name):
 match=re.search(rf'\b{re.escape(name)}\s*=\s*(["\'])(.*?)\1',tag,flags=re.I|re.S)
 return html.unescape(match.group(2)).strip() if match else ''
def calendar_event_signature(value):
 body=re.search(r'<body\b[^>]*>',value,flags=re.I)
 if not body or tag_attribute(body.group(0),'data-route-type')!='calendar-event':return None
 def first_tag(name,predicate=lambda _tag:True):
  for found in re.finditer(rf'<{name}\b[^>]*>',value,flags=re.I):
   if predicate(found.group(0)):return found.group(0)
  return ''
 def visible(tag_name):
  found=re.search(rf'<{tag_name}\b[^>]*>([\s\S]*?)</{tag_name}\s*>',value,flags=re.I)
  if not found:return ''
  return re.sub(r'\s+',' ',html.unescape(re.sub(r'<[^>]+>',' ',found.group(1)))).strip()
 def visible_fragment(fragment):
  return re.sub(r'\s+',' ',html.unescape(re.sub(r'<[^>]+>',' ',fragment or ''))).strip()
 def class_tag(name,class_name,source=value):
  return first_tag(name,lambda tag:class_name in tag_attribute(tag,'class').split()) if source is value else next((found.group(0) for found in re.finditer(rf'<{name}\b[^>]*>',source,flags=re.I) if class_name in tag_attribute(found.group(0),'class').split()),'')
 def class_state(tag,owner):
  return sorted(token for token in tag_attribute(tag,'class').split() if token!=owner)
 def normalized_place(text,kind):
  normalized=visible_fragment(text)
  pending={
   'venue':{'','location unconfirmed','location unconfirmed · lieu non confirmé','location details still pending','lieu exact à confirmer','lieu non confirmé'},
   'city':{'','unknown','not yet determined'},
  }
  return '__pending__' if normalized.casefold() in pending[kind] else normalized
 def section_fragment(class_name,tag_name='section'):
  found=re.search(rf'<{tag_name}\b(?=[^>]*\bclass=["\'][^"\']*\b{re.escape(class_name)}\b)[^>]*>([\s\S]*?)</{tag_name}\s*>',value,flags=re.I)
  return found.group(1) if found else ''
 canonical=first_tag('link',lambda tag:'canonical' in tag_attribute(tag,'rel').lower().split())
 robots=first_tag('meta',lambda tag:tag_attribute(tag,'name').lower()=='robots')
 official=first_tag('a',lambda tag:'pm-event-action' in tag_attribute(tag,'class').split() and 'primary' in tag_attribute(tag,'class').split())
 calendar=first_tag('a',lambda tag:tag_attribute(tag,'type').lower()=='text/calendar')
 alive=first_tag('link',lambda tag:bool(re.search(r'/css/alive\.css(?:\?|$)',tag_attribute(tag,'href'))))
 mandala=first_tag('script',lambda tag:bool(re.search(r'/js/mandala\.js(?:\?|$)',tag_attribute(tag,'src'))))
 indra=first_tag('script',lambda tag:bool(re.search(r'/js/indra\.js(?:\?|$)',tag_attribute(tag,'src'))))
 context=re.search(r'<section\b(?=[^>]*\bclass=["\'][^"\']*\bpm-event-context\b)[^>]*>([\s\S]*?)</section\s*>',value,flags=re.I)
 context_values=[]
 if context:
  for item in re.finditer(r'<dd\b[^>]*>([\s\S]*?)</dd\s*>',context.group(1),flags=re.I):
   context_values.append(visible_fragment(item.group(1)))
 facts=re.search(r'<dl\b(?=[^>]*\bclass=["\'][^"\']*\bpm-event-facts\b)[^>]*>([\s\S]*?)</dl\s*>',value,flags=re.I)
 fact_values=list(re.finditer(r'<dd\b[^>]*>([\s\S]*?)</dd\s*>',facts.group(1),flags=re.I)) if facts else []
 place_fragment=fact_values[1].group(1) if len(fact_values)>1 else ''
 venue_match=re.search(r'<strong\b[^>]*>([\s\S]*?)</strong\s*>',place_fragment,flags=re.I)
 city_match=re.search(r'<span\b[^>]*>([\s\S]*?)</span\s*>',place_fragment,flags=re.I)
 description_fragment=section_fragment('pm-event-description')
 description_match=re.search(r'<p\b[^>]*>([\s\S]*?)</p\s*>',description_fragment,flags=re.I)
 description_tag=re.search(r'<p\b[^>]*>',description_fragment,flags=re.I)
 heading=first_tag('h1')
 official_body=re.search(r'<a\b[^>]*\bclass=["\'][^"\']*\bpm-event-action\b[^"\']*\bprimary\b[^"\']*["\'][^>]*>([\s\S]*?)</a\s*>',value,flags=re.I)
 truth=class_tag('span','truth-chip')
 lifecycle=class_tag('span','pm-lifecycle')
 pending_tag=class_tag('details','pm-event-pending')
 pending_reasons=sorted(filter(None,tag_attribute(pending_tag,'data-qualification-reasons').split()))
 previous=class_tag('p','pm-event-previous')
 previous_body=re.search(r'<p\b[^>]*>([\s\S]*?)</p\s*>',value[value.find(previous):] if previous else '',flags=re.I)
 previous_values=visible_fragment(re.sub(r'<strong\b[^>]*>[\s\S]*?</strong\s*>','',previous_body.group(1),count=1,flags=re.I)) if previous_body else ''
 checked=class_tag('p','pm-event-checked')
 checked_body=re.search(r'<p\b[^>]*>([\s\S]*?)</p\s*>',value[value.find(checked):] if checked else '',flags=re.I)
 checked_value=visible_fragment(re.sub(r'<strong\b[^>]*>[\s\S]*?</strong\s*>','',checked_body.group(1),count=1,flags=re.I)) if checked_body else ''
 related_fragment=section_fragment('pm-event-related','nav')
 related=[]
 for link in re.finditer(r'<a\b[^>]*>([\s\S]*?)</a\s*>',related_fragment,flags=re.I):
  href=tag_attribute(link.group(0),'href')
  route=re.search(r'/polymythseminars/(?:fr/)?events/([^/?#]+)/?',href,flags=re.I)
  if route:related.append([urllib.parse.unquote(route.group(1)),visible_fragment(link.group(1))])
 signature={
  'event_id':tag_attribute(body.group(0),'data-event-id'),
  'canonical':tag_attribute(canonical,'href'),
  'title':visible('h1'),
  'date':visible('time'),
  'description':visible_fragment(description_match.group(1)) if description_match else '',
  'description_lang':tag_attribute(description_tag.group(0),'lang') if description_tag else '',
  'title_lang':tag_attribute(heading,'lang'),
  'venue':normalized_place(venue_match.group(1) if venue_match else '','venue'),
  'city':normalized_place(city_match.group(1) if city_match else '','city'),
  'confirmation_status':tag_attribute(body.group(0),'data-confirmation-status') or class_state(truth,'truth-chip'),
  'lifecycle_status':tag_attribute(body.group(0),'data-lifecycle-status') or class_state(lifecycle,'pm-lifecycle') or 'active',
  'robots':tag_attribute(robots,'content').lower(),
  'official_source':tag_attribute(official,'href'),
  'official_source_label':visible_fragment(official_body.group(1)) if official_body else '',
  'calendar_file':tag_attribute(calendar,'href'),
  'archived':bool(re.search(r'\bdata-event-archive-note\s*=\s*["\']true["\']',value,flags=re.I)),
  'qualification_reasons':pending_reasons,
  'previous_dates':previous_values,
  'last_checked':checked_value,
  'related':related,
  # Localized route generation owns translated labels, but every researched
  # value must remain a fixed point of the canonical event generator.
  'context_values':context_values,
  'geometry_role':tag_attribute(body.group(0),'data-geometry-role'),
  'publication_surface':tag_attribute(body.group(0),'data-publication-surface'),
  'geometry_assets':[
   tag_attribute(alive,'href'),tag_attribute(mandala,'src'),tag_attribute(indra,'src'),
  ],
 }
 return json.dumps(signature,ensure_ascii=False,sort_keys=True,separators=(',',':'))
def comparable_html(value):
 signature=calendar_event_signature(value)
 if signature is not None:return signature
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
 if path.suffix.lower()=='.html' and (
  'data-route-type="calendar-event-alias"' in text
  or path==ROOT/'polymythcal'/'index.html'
 ):
  # Alias fallbacks are normalized later by the canonical pipeline. Emit the
  # final cache key here too, so clean generation and immediate rebuilds are
  # the same fixed point even under an external generated-file reconciler.
  text=re.sub(
   r'(/css/site-wide-type-zoom\.css\?v=)[^"\']+',
   rf'\g<1>{TYPE_ZOOM_VERSION}',text,flags=re.I,
  )
  text=re.sub(
   r'(data-site-wide-type-zoom=["\'])[^"\']+',
   rf'\g<1>{TYPE_ZOOM_VERSION}',text,flags=re.I,
  )
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
def clean_dirs(valid_ids,valid_aliases,valid_ics_ids=None,valid_ics_aliases=None):
 if valid_ics_ids is None:valid_ics_ids=valid_ids
 if valid_ics_aliases is None:
  valid_ics_aliases={
   str(value)
   for event in chronology_events
   for value in (event.get('legacy_ids') or [])
   if str(value) and str(value)!=str(event.get('id') or event.get('identity_key'))
  }
 for child in out.iterdir():
  if child.is_dir() and child.name not in valid_ids and child.name not in valid_aliases:
   if CHECK: check_errors.append(f'stale generated directory: {child.relative_to(ROOT)}')
   else: shutil.rmtree(child)
 for old in icsdir.glob('*.ics'):
  if old.stem not in valid_ics_ids and old.stem not in valid_ics_aliases:
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
def temporal_zone(e,projected):
 zone_name=str((projected.get('temporal') or {}).get('timezone') or e.get('timezone') or DEFAULT_TZ)
 try:return ZoneInfo(zone_name)
 except Exception:return ZoneInfo(DEFAULT_TZ)
def projected_datetime(e,projected,key='date'):
 value=e.get(key)
 parsed=parse_iso(value,e.get('timezone') or DEFAULT_TZ)
 if not isinstance(parsed,datetime.datetime):return None
 return parsed.astimezone(temporal_zone(e,projected))
def public_temporal_value(e,projected,key='date'):
 temporal_type=str((projected.get('temporal') or {}).get('type') or '')
 if temporal_type in {'global-instant','local-date-time','deadline','date-range'} and e.get('time_precision')=='exact':
  moment=projected_datetime(e,projected,key)
  return moment.isoformat(timespec='minutes') if moment else ''
 return str(projected.get(key) or '')
def temporal_presentation(e,projected,is_watch=False):
 if is_watch:return ('Date awaiting confirmation · Date à confirmer','', 'Date pending')
 temporal_type=str((projected.get('temporal') or {}).get('type') or '')
 if e.get('time_precision')=='exact' and e.get('end_date'):
  start_moment=projected_datetime(e,projected)
  end_moment=projected_datetime(e,projected,'end_date')
  if start_moment:
   start_label=start_moment.strftime('%Y-%m-%d %H:%M %Z')
   end_label=end_moment.strftime('%Y-%m-%d %H:%M %Z') if end_moment else ''
   label=f'{start_label} – {end_label}' if end_label else start_label
   return (label,start_moment.isoformat(timespec='minutes'),start_moment.strftime('%Y-%m-%d'))
 if temporal_type in {'global-instant','local-date-time','deadline'} and e.get('time_precision')=='exact':
  moment=projected_datetime(e,projected)
  if moment:
   return (moment.strftime('%Y-%m-%d %H:%M %Z'),moment.isoformat(timespec='minutes'),moment.strftime('%Y-%m-%d'))
 start=str(projected.get('date') or '')[:10]
 end=str(projected.get('end_date') or '')[:10]
 if temporal_type=='date-range' and end and end!=start:
  return (f'{start} – {end}',start,start)
 if temporal_type=='estimated':
  return (f'{start} (estimated · date estimée)',start,start)
 return (start,start,start)
def format_when(e,projected,is_watch=False):return temporal_presentation(e,projected,is_watch)[0]
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
def event_meta_description(e,title_text,venue,city,projected,is_watch=False,public_desc=''):
 date_label=temporal_presentation(e,projected,is_watch)[0] or 'Date to be confirmed'
 location=', '.join(value for value in (venue,city) if value and value.lower() not in PLACEHOLDERS)
 facts=date_label+(f' at {location}' if location else '')+'.'
 detail=str(public_desc or '').strip()
 return clean_meta(f'{title_text}. {facts} {detail}',160)
def context_value(value):
 if value is None:return ''
 if isinstance(value,dict):
  pieces=[]
  for key in ('person','collective','role','category','status','mode','scope','min','max'):
   item=value.get(key)
   if item not in (None,'','not-applicable','unknown','production-credit'):
    pieces.append(str(item).replace('-',' '))
  return ' — '.join(pieces) if pieces else json.dumps(value,ensure_ascii=False,sort_keys=True)
 if isinstance(value,list):return '; '.join(filter(None,(context_value(item) for item in value)))
 text=str(value).strip()
 return '' if text.casefold() in {'unknown','not-applicable'} else text
CONTEXT_FIELDS=[
 ('Entry family','Famille de fiche','entry_family'),
 ('Calendar systems','Systèmes calendaires','calendar_systems'),
 ('Traditions','Traditions','traditions'),
 ('Ritual associations','Associations rituelles','ritual_associations'),
 ('Social functions','Fonctions sociales','social_functions'),
 ('Social context','Contexte social','socio_note'),
 ('Viewing notes','Conseils d’observation',('astronomy_visibility','observer_notes')),
 ('Presence categories','Catégories de présence','presence_categories'),
 ('Participants and presence','Participants et présence',('presence_claims','participant_presence')),
 ('Presence mode','Mode de présence','presence_mode'),
 ('Interaction format','Format de l’échange','interaction_format'),
 ('Academic event formats','Formats intellectuels et universitaires',('academic_event_forms','public_intellectual_academic_formats')),
 ('Academic disciplines','Disciplines universitaires','academic_disciplines'),
 ('Arts formats','Formats artistiques','arts_event_forms'),
 ('Arts disciplines','Disciplines artistiques','arts_disciplines'),
 ('Arts occurrence role','Rôle dans le programme artistique','arts_occurrence_role'),
 ('Participation formats','Formats participatifs','participatory_formats'),
 ('Participation mode','Mode de participation','participation_mode'),
 ('Participation roles','Rôles des participants','participation_roles'),
 ('Facilitation','Animation','facilitation_status'),
 ('Skill level','Niveau','skill_level'),
 ('Drop-in status','Accès libre ou inscription','drop_in_status'),
 ('Participation evidence','Preuve de participation','participation_evidence'),
 ('Civic, legal, and labour formats','Formats civiques, juridiques et syndicaux','civic_legal_labour_formats'),
 ('Civic domain','Domaine civique','civic_domain'),
 ('Authority level','Niveau d’autorité','authority_level'),
 ('Public role','Rôle du public','public_role'),
 ('Participation route','Voie de participation','participation_route'),
 ('Public input','Participation du public','public_input_status'),
 ('Legal access','Accès juridique','legal_access_status'),
 ('Collective action','Action collective','collective_action_type'),
 ('Election stage','Étape électorale','election_stage'),
 ('Access restrictions','Restrictions d’accès','access_restrictions'),
 ('Webcast status','État de la webdiffusion','webcast_status'),
 ('Publication restriction','Restriction de publication','publication_restriction'),
 ('Alternate dates','Dates alternatives','alternate_dates'),
 ('Civic evidence','Preuve civique','civic_evidence'),
 ('Community, charity, heritage, and place formats','Formats communautaires, caritatifs, patrimoniaux et territoriaux','community_heritage_formats'),
 ('Community participation roles','Rôles de participation communautaire','community_participation_roles'),
 ('Contribution routes','Voies de contribution','contribution_routes'),
 ('Beneficiary or cause','Bénéficiaire ou cause','beneficiary_or_cause'),
 ('Relation to place','Relation au lieu','place_relation'),
 ('Community evidence','Preuve communautaire','community_evidence'),
 ('Community or heritage scope','Portée communautaire ou patrimoniale','community_heritage_scope'),
 ('Community public access','Accès public communautaire','community_public_access_status'),
 ('Community registration required','Inscription communautaire requise','community_registration_required'),
 ('Community participation mode','Mode de participation communautaire','community_participation_mode'),
 ('Community date evidence','Preuve de date communautaire','community_date_evidence'),
 ('Community access evidence','Preuve d’accès communautaire','community_access_evidence'),
 ('Community participation evidence','Preuve de participation communautaire','community_participation_evidence'),
 ('Community beneficiary evidence','Preuve du bénéficiaire communautaire','community_beneficiary_evidence'),
 ('Community place evidence','Preuve du lien au lieu','community_place_evidence'),
 ('Community heritage evidence','Preuve patrimoniale communautaire','community_heritage_evidence'),
 ('Live and digital formats','Formats en direct et numériques','live_digital_formats'),
 ('Platforms','Plateformes','platform_names'),
 ('Live status','État de diffusion en direct','synchronous_status'),
 ('Audience interaction','Interaction avec le public','audience_interaction_routes'),
 ('Recording availability','Disponibilité de l’enregistrement','recording_availability'),
 ('Digital evidence','Preuve numérique','digital_evidence'),
 ('Online location','Lieu en ligne','online_location'),
 ('Platform detail','Détail de la plateforme','platform'),
 ('Platform notes','Notes sur la plateforme','platform_notes'),
 ('Liveness detail','Détail du direct','liveness_status'),
 ('Synchronicity detail','Détail de la synchronicité','synchronicity'),
 ('Audience interaction detail','Détail de l’interaction avec le public','audience_interaction'),
 ('Interaction status','État de l’interaction','interaction_status'),
 ('Interaction evidence','Preuve de l’interaction','interaction_evidence'),
 ('Digital access status','État de l’accès numérique','access_status'),
 ('Digital access route','Voie d’accès numérique','access_route'),
 ('Replay or archive status','État de la reprise ou de l’archive','replay_archive_status'),
 ('Recording evidence','Preuve de l’enregistrement','recording_evidence'),
 ('Creator participation status','État de la participation du créateur','creator_participation_status'),
 ('Creator participation evidence','Preuve de la participation du créateur','creator_participation_evidence'),
 ('Digital occurrence evidence','Preuve de l’occurrence numérique','occurrence_evidence'),
 ('Replay source detail','Détail de la source de reprise','replay_source_field'),
 ('Course and program formats','Formats de cours et de programmes','course_program_formats'),
 ('Program stage','Étape du programme','program_stage'),
 ('Source program stage','Étape du programme selon la source','program_stage_source_value'),
 ('Schedule model','Modèle d’horaire','schedule_model'),
 ('Schedule detail','Détail de l’horaire','program_schedule_detail'),
 ('Program start','Début du programme','program_start_date'),
 ('Program end','Fin du programme','program_end_date'),
 ('Eligibility and audience','Admissibilité et public visé','eligibility_audience'),
 ('Registration or application route','Voie d’inscription ou de candidature','registration_application_route'),
 ('Session count','Nombre de séances','session_count'),
 ('Program evidence','Preuve du programme','program_evidence'),
 ('Public access','Accès public','public_access_status'),
 ('Audience','Public visé','audience_scope'),
 ('Registration required','Inscription requise','registration_required'),
 ('Institutional restriction','Restriction institutionnelle','institutional_restriction'),
 ('Participant identity','Identité des participants','participant_identity_status'),
 ('Talkback status','État de la discussion','talkback_status'),
 ('Director attendance','Présence de la mise en scène','director_attendance_status'),
 ('Date discrepancy','Divergence de dates','date_conflict'),
 ('Source inconsistency','Incohérence de la source','source_inconsistency'),
]
def event_context_html(e):
 rows=[]
 for label_en,label_fr,field in CONTEXT_FIELDS:
  fields=field if isinstance(field,tuple) else (field,)
  value=next((e.get(name) for name in fields if e.get(name) not in (None,'',[],{})),None)
  text=context_value(value)
  if text:rows.append(f'<div><dt>{html.escape(label_en)} · {html.escape(label_fr)}</dt><dd>{html.escape(text)}</dd></div>')
 if not rows:return ''
 return '<section class="pm-event-context"><h2>Context and evidence · Contexte et preuves</h2><dl class="pm-event-facts">'+''.join(rows)+'</dl></section>'
def related_events(event):
 sid=str(event.get('id') or event.get('identity_key'))
 event_type=str(event.get('type') or '').strip().lower()
 event_city=str(event.get('city') or '').strip().lower()
 event_day=parse_iso(event.get('date'),event.get('timezone') or DEFAULT_TZ)
 event_day=event_day.date() if isinstance(event_day,datetime.datetime) else event_day
 ranked=[]
 for candidate in chronology_events:
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
clean_dirs(valid_ids,set(alias_targets),set(chronology_public))
title_date_counts={}
canonical_ics={}
for e in events:
 title_date_key=(str(e.get('title') or 'Untitled listing'),str(e.get('date') or '')[:10])
 title_date_counts[title_date_key]=title_date_counts.get(title_date_key,0)+1
for e in events:
 sid=str(e.get('id') or e.get('identity_key')); folder=out/sid; folder.mkdir(parents=True,exist_ok=True)
 public_record=public_by_id[sid]
 is_watch=sid in watchlist_public
 event_geometry_attrs=geometry_body_attributes(
  ROOT,f'polymythseminars/events/{sid}/index.html','calendar-event',register='quiet'
 )
 title_text=str(e.get('title') or 'Untitled listing'); title=html.escape(title_text)
 content_language=str(public_record.get('content_language') or '')
 content_lang_attr=f' lang="{html.escape(content_language,quote=True)}"' if content_language else ''
 public_actions=[action for action in (public_record.get('actions') or []) if action.get('kind')!='details']
 preferred_action=next((action for action in public_actions if action.get('kind')!='source'),None) or next(iter(public_actions),{})
 destination_text=str(preferred_action.get('url') or '')
 destination_kind=str(preferred_action.get('kind') or 'source')
 destination_scope=str(preferred_action.get('scope') or 'source')
 if destination_text and not destination_text.startswith('https://'):raise SystemExit(f'Unsafe external destination for {sid}: {destination_text!r}')
 destination=html.escape(destination_text,quote=True)
 reasons=' · '.join(labels.get(x,str(x).replace('-',' ').title()) for x in e.get('qualification_reasons',[]))
 qualification_tokens=' '.join(sorted(str(x) for x in e.get('qualification_reasons',[]) if str(x)))
 confirmation=str(e.get('confirmation_status') or 'unconfirmed'); lifecycle=str(e.get('lifecycle_status') or 'active')
 end_value=parse_iso(public_temporal_value(e,public_record,'end_date') or public_temporal_value(e,public_record),e.get('timezone') or DEFAULT_TZ)
 end_day=end_value.date() if isinstance(end_value,datetime.datetime) else end_value
 past=bool(not is_watch and end_day and end_day<TODAY)
 city=str(e.get('city') or 'Unknown'); venue=str(e.get('venue') or 'Location unconfirmed · Lieu non confirmé')
 desc=str(public_record.get('description') or '')
 context_html=''
 indexable=not is_watch and confirmation=='confirmed' and (e.get('date_precision')=='exact' or e.get('time_precision')=='exact') and e.get('record_kind')!='opportunity' and valid_location(e) and lifecycle not in {'cancelled','missing-on-source','archived'} and not past
 robots='index,follow' if indexable else 'noindex,follow'
 canonical=f'https://seminarschools.com/polymythseminars/events/{urllib.parse.quote(sid)}/'
 schema={'@context':'https://schema.org','@type':'Event','name':title_text,'startDate':public_temporal_value(e,public_record),'description':event_meta_description(e,title_text,venue,city,public_record,is_watch,desc),'eventStatus':{'postponed':'https://schema.org/EventPostponed','rescheduled':'https://schema.org/EventRescheduled'}.get(lifecycle,'https://schema.org/EventScheduled'),'url':canonical,'sameAs':destination_text or None,'inLanguage':content_language or 'en-CA'} if indexable else None
 if schema and public_record.get('end_date'):schema['endDate']=public_temporal_value(e,public_record,'end_date')
 if schema:schema['location']={'@type':'Place','name':venue,'address':city}
 if schema:schema={k:v for k,v in schema.items() if v is not None}
 destination_labels={
  'schedule':'Open official schedule · Ouvrir l’horaire officiel',
  'registration':'Open registration page · Ouvrir la page d’inscription',
  'application':'Open application page · Ouvrir la page de candidature',
  'submission':'Open submission page · Ouvrir la page de soumission',
  'rules':'Open rules · Ouvrir le règlement',
  'tickets':'Open ticket page · Ouvrir la billetterie',
  'stream':'Open stream · Ouvrir la diffusion',
  'review':'Open review page · Ouvrir la page d’évaluation',
 'results':'Open results page · Ouvrir la page des résultats',
 }
 destination_source=destination_kind=='source'
 if destination_kind=='schedule' and destination_source:destination_label='Open source schedule · Ouvrir l’horaire source'
 elif destination_kind in destination_labels:destination_label=destination_labels[destination_kind]
 elif destination_scope=='series' and destination_source:destination_label='Open series source page · Ouvrir la page source de la série'
 elif destination_scope=='series':destination_label='Open official series page · Ouvrir la page officielle de la série'
 elif destination_source:destination_label='Open source page · Ouvrir la page source'
 else:destination_label='Open official event page · Ouvrir la page officielle de l’événement'
 status_text='Confirmed · Confirmé' if confirmation=='confirmed' else 'Some details pending · Certains détails à confirmer'
 when_text,date_value_raw,date_token=temporal_presentation(e,public_record,is_watch)
 when_text=html.escape(when_text)
 date_value=html.escape(date_value_raw,quote=True)
 page_title_parts=[title_text,date_token]
 if title_date_counts.get((title_text,date_token),0)>1 and city.lower() not in PLACEHOLDERS:page_title_parts.append(city)
 page_title_text=' · '.join(page_title_parts)+' · Polymythcal'
 page_title=html.escape(page_title_text,quote=True)
 meta_description=html.escape(event_meta_description(e,title_text,venue,city,public_record,is_watch,desc),quote=True)
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
 date_fact_html=when_text if is_watch else f'<time datetime="{date_value}">{when_text}</time>'
 calendar_action='' if is_watch else f'<a class="pm-event-action" type="text/calendar" href="/polymythseminars/ics/{html.escape(sid,quote=True)}.ics">Add to calendar · Ajouter au calendrier</a>'
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
<link rel="stylesheet" href="/css/alive.css?v={GEOMETRY_VERSION}">
<link rel="stylesheet" href="/css/polymythcal-features.css?v={ASSET_VERSION}">
<link rel="stylesheet" href="/css/site-wide-type-zoom.css?v={ASSET_VERSION}" data-site-wide-type-zoom="{ASSET_VERSION}">
{schema_markup}<link rel="stylesheet" href="/css/audit43-approved.css?v={AUDIT43_VERSION}">
<link rel="stylesheet" href="/css/calm-ux.css?v={STEADY_VERSION}">
</head>
<body {event_geometry_attrs} data-event-id="{html.escape(sid,quote=True)}" data-publication-surface="{'watchlist' if is_watch else 'chronology'}" data-confirmation-status="{html.escape(confirmation,quote=True)}" data-lifecycle-status="{html.escape(lifecycle,quote=True)}">
<a class="skip-link" href="#main-content">Skip to event · Aller à la fiche</a>
<main id="main-content" class="pm-event-page">
<nav class="pm-event-nav" aria-label="Event navigation · Navigation de la fiche"><a href="/polymythseminars/">← All listings · Toutes les fiches</a><a href="?lang=fr" hreflang="fr-CA">Français</a></nav>
<article class="pm-event-detail">
<header class="pm-event-hero">
<p class="pm-event-kicker">Polymythcal</p>
<div class="truth-row"><span class="truth-chip {confirmation}">{status_text}</span>{f'<span class="pm-lifecycle {html.escape(lifecycle)}" data-en-label="{html.escape(lifecycle_labels.get(lifecycle,lifecycle))}">{html.escape(lifecycle_labels.get(lifecycle,lifecycle))}</span>' if lifecycle!='active' else ''}</div>
<h1{content_lang_attr}>{title}</h1>
</header>
{'<div class="callout pm-event-archive" data-event-archive-note="true"><strong>Past event · Événement passé.</strong> This page remains as an archive. Check the source for a current edition.</div>' if past else ''}
<dl class="pm-event-facts">
<div><dt>Date · Date</dt><dd>{date_fact_html}</dd></div>
<div><dt>Place · Lieu</dt><dd><strong>{html.escape(venue)}</strong><span>{html.escape(city)}</span></dd></div>
<div><dt>Status · Statut</dt><dd>{status_text}</dd></div>
</dl>
<section class="pm-event-primary-path" aria-label="Listing actions · Actions de la fiche"><p>Listing actions · Actions de la fiche</p>
<div class="pm-event-actions">{f'<a class="pm-event-action primary" href="{destination}" rel="noopener noreferrer">{destination_label} ↗</a>' if destination_text else ''}{calendar_action}<a class="pm-event-action" href="/polymythseminars/correct/?event={html.escape(canonical,quote=True)}">Correct this listing · Corriger cette fiche</a></div></section>
{f'<section class="pm-event-description"><h2>About this listing · À propos</h2><p{content_lang_attr}>{html.escape(desc)}</p></section>' if desc else ''}
{context_html}
{f'<details class="pm-event-pending" data-qualification-reasons="{html.escape(qualification_tokens,quote=True)}"><summary>Details still pending · Détails à confirmer</summary><p><strong>Qualification · Précision:</strong> {html.escape(reasons)}</p></details>' if reasons else ''}
{f'<p class="pm-event-previous"><strong>Previous date · Date précédente:</strong> {html.escape(" · ".join(e.get("previous_dates") or []))}</p>' if e.get('previous_dates') else ''}
{related_html}
<footer class="pm-event-footer">
<p class="pm-event-checked"><strong>Last checked · Dernière vérification:</strong> {html.escape(str(e.get('last_checked_at') or 'Unknown'))[:10]}</p>
</footer>
</article>
</main>
<script src="/js/theme.js" defer></script>
<script src="/js/polymythcal-features.js?v={ASSET_VERSION}" defer></script>
<script src="/js/site-keyboard-enhancements.js?v={ASSET_VERSION}" defer></script>
<script src="/js/mandala.js?v={GEOMETRY_VERSION}" defer></script>
<script src="/js/indra.js?v={GEOMETRY_VERSION}" defer></script>
</body>
</html>'''

 write_if_changed(folder/'index.html',page)
 if sid not in chronology_public:continue
 lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Seminar Schools//Polymythcal//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT',f'UID:{ics_escape(e.get("identity_key") or sid)}@seminarschools.com',f'DTSTAMP:{deterministic_stamp(e)}']
 if e.get('time_precision')=='exact':
  exact_start=parse_iso(e.get('date'),e.get('timezone') or DEFAULT_TZ)
  exact_end=parse_iso(e.get('end_date'),e.get('timezone') or DEFAULT_TZ)
  if isinstance(exact_start,datetime.datetime) and isinstance(exact_end,datetime.datetime) and exact_end<=exact_start:
   raise ValueError(f'{sid}: exact calendar end must be later than its start')
 start=ics_start(e.get('date'),e.get('time_precision'),e.get('timezone') or DEFAULT_TZ)
 if start:lines.append(start)
 end=ics_end(e.get('end_date'),e.get('time_precision'),e.get('timezone') or DEFAULT_TZ)
 if end:lines.append(end)
 lines+=['SUMMARY:'+ics_escape(title_text),'LOCATION:'+ics_escape(venue),'DESCRIPTION:'+ics_escape(desc[:800]),'URL:'+canonical,'STATUS:'+status_ics(e),'END:VEVENT','END:VCALENDAR','']
 ics_text='\r\n'.join(fold_ics(line) for line in lines)
 canonical_ics[sid]=ics_text
 write_if_changed(icsdir/(sid+'.ics'),ics_text)
for e in chronology_events:
 sid=str(e.get('id') or e.get('identity_key'))
 for legacy_id in e.get('legacy_ids') or []:
  legacy_id=str(legacy_id)
  if legacy_id and legacy_id!=sid:
   write_if_changed(icsdir/(legacy_id+'.ics'),canonical_ics[sid])
for alias_id,sid in sorted(alias_targets.items()):
 target=f'/polymythseminars/events/{urllib.parse.quote(sid)}/'; alias_folder=out/alias_id; alias_folder.mkdir(parents=True,exist_ok=True)
 alias_geometry_attrs=geometry_body_attributes(
  ROOT,f'polymythseminars/events/{alias_id}/index.html','calendar-event-alias',register='quiet'
 )
 alias_page=f'<!doctype html><html lang="en-CA"><head>\n<script src="/js/theme-init.js?v={STEADY_VERSION}"></script><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,follow"><meta http-equiv="refresh" content="0;url={html.escape(target,quote=True)}"><link rel="canonical" href="https://seminarschools.com{html.escape(target,quote=True)}"><title>Event moved · Fiche déplacée</title><link rel="stylesheet" href="/css/site-wide-type-zoom.css?v={ASSET_VERSION}" data-site-wide-type-zoom="{ASSET_VERSION}"><link rel="stylesheet" href="/css/alive.css?v={GEOMETRY_VERSION}">\n<link rel="stylesheet" href="/css/audit43-approved.css?v={AUDIT43_VERSION}">\n<link rel="stylesheet" href="/css/calm-ux.css?v={STEADY_VERSION}">\n</head><body {alias_geometry_attrs} data-legacy-event-id="{html.escape(alias_id,quote=True)}"><main><h1>Event moved · Fiche déplacée</h1><p><a href="{html.escape(target,quote=True)}">Open the stable event page · Ouvrir la fiche stable</a></p></main><script>location.replace({json.dumps(target)})</script><script src="/js/mandala.js?v={GEOMETRY_VERSION}" defer></script>\n<script src="/js/indra.js?v={GEOMETRY_VERSION}" defer></script>\n</body></html>'
 write_if_changed(alias_folder/'index.html',alias_page)
alias=ROOT/'polymythcal';alias.mkdir(exist_ok=True)
redirect_geometry_attrs=geometry_body_attributes(
 ROOT,'polymythcal/index.html','redirect',register='standard'
)
write_if_changed(alias/'index.html',f'<!doctype html><html lang="en-CA"><head>\n<script src="/js/theme-init.js?v={STEADY_VERSION}"></script><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,follow"><meta http-equiv="refresh" content="0;url=/polymythseminars/"><link rel="canonical" href="https://seminarschools.com/polymythseminars/"><title>Polymythcal</title><style>@media(max-width:400px){{h1{{font-size:clamp(1.5rem,10vw,2rem);overflow-wrap:normal;word-break:normal}}}}</style><link rel="stylesheet" href="/css/site-wide-type-zoom.css?v={ASSET_VERSION}" data-site-wide-type-zoom="{ASSET_VERSION}"><link rel="stylesheet" href="/css/alive.css?v={GEOMETRY_VERSION}">\n<link rel="stylesheet" href="/css/audit43-approved.css?v={AUDIT43_VERSION}">\n<link rel="stylesheet" href="/css/calm-ux.css?v={STEADY_VERSION}">\n</head><body {redirect_geometry_attrs}><main><h1>Polymythcal</h1><p>Public seminars, lectures, festivals, and community events now live on the Polymythcal calendar.</p><p><a href="/polymythseminars/">Open Polymythcal</a></p></main><script>location.replace("/polymythseminars/")</script><script src="/js/mandala.js?v={GEOMETRY_VERSION}" defer></script>\n<script src="/js/indra.js?v={GEOMETRY_VERSION}" defer></script>\n</body></html>')
if check_errors:
 print('POLYMYTHCAL DETAIL CHECK FAILED')
 for error in check_errors[:120]:print(' - '+error)
 if len(check_errors)>120:print(f' - … {len(check_errors)-120} more')
 raise SystemExit(1)
verb='Checked' if CHECK else 'Built'
print(f'{verb} {len(events)} stable bilingual event pages, {len(alias_targets)} legacy aliases, and standards-correct ICS files')
