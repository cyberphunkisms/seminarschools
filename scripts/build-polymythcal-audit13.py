#!/usr/bin/env python3
"""Build stable Polymythcal detail pages and event-specific ICS files."""
from pathlib import Path
import datetime,html,json,re,hashlib,shutil,urllib.parse
ROOT=Path(__file__).resolve().parents[1]
payload=json.loads((ROOT/'polymythseminars/events.json').read_text(encoding='utf-8'))
events=payload['events']; out=ROOT/'polymythseminars/events'; out.mkdir(parents=True,exist_ok=True)
icsdir=ROOT/'polymythseminars/ics'; icsdir.mkdir(parents=True,exist_ok=True)
def legacy_slug(value):
 text=html.unescape(str(value or 'event')).lower().replace('&',' and ')
 text=re.sub(r'[^a-z0-9]+','-',text).strip('-')[:76]
 return text or 'event'
def legacy_alias(sid):
 return f'{legacy_slug(sid)}-{hashlib.sha1(str(sid).encode()).hexdigest()[:8]}'
valid_ids={str(e.get('id') or e.get('identity_key')) for e in events}
valid_aliases={legacy_alias(x) for x in valid_ids}
for child in out.iterdir():
 if child.is_dir() and child.name not in valid_ids and child.name not in valid_aliases:
  shutil.rmtree(child)
for old_ics in icsdir.glob('*.ics'):
 if old_ics.stem not in valid_ids: old_ics.unlink()
labels={'time-unconfirmed':'Time unconfirmed · Heure non confirmée','date-unconfirmed':'Date unconfirmed · Date non confirmée','location-unconfirmed':'Location unconfirmed · Lieu non confirmé','current-edition-unconfirmed':'Current edition unconfirmed · Édition actuelle non confirmée','public-access-unconfirmed':'Public access unconfirmed · Accès public non confirmé','registration-unconfirmed':'Registration unconfirmed · Inscription non confirmée','participant-attendance-unconfirmed':'Participant attendance unconfirmed · Présence non confirmée','official-source-unconfirmed':'Official detail page unconfirmed · Source officielle non confirmée','aggregator-only':'Aggregator source only · Source agrégée seulement','private-status-unconfirmed':'Public/private status unconfirmed · Statut public ou privé non confirmé'}
lifecycle_labels={'active':'Active','missing-on-source':'Missing on source · Absent de la source','postponed':'Postponed · Reporté','rescheduled':'Rescheduled · Reprogrammé','cancelled':'Cancelled · Annulé','sold-out':'Sold out · Complet','registration-closed':'Registration closed · Inscriptions fermées','superseded':'Superseded · Remplacé','archived':'Archived · Archivé'}
def ics_escape(s): return str(s or '').replace('\\','\\\\').replace(';','\\;').replace(',','\\,').replace('\n','\\n')
def ics_dt(value, precision):
 if not value:return None
 if precision!='exact': return ('DATE',str(value)[:10].replace('-',''))
 return ('DATE-TIME',re.sub(r'[-:]','',str(value)[:19]))
def format_when(e):
 value=str(e.get('date') or '')
 if e.get('time_precision')!='exact':return value[:10]
 return value.replace('T',' ')[:16]
def event_status_ics(e):
 if e.get('lifecycle_status')=='cancelled':return 'CANCELLED'
 return 'TENTATIVE' if e.get('confirmation_status')=='unconfirmed' else 'CONFIRMED'
def json_script(obj): return json.dumps(obj,ensure_ascii=False).replace('</','<\\/')
for e in events:
 sid=str(e.get('id') or e.get('identity_key')); folder=out/sid; folder.mkdir(parents=True,exist_ok=True)
 title=html.escape(str(e.get('title') or '')); source=html.escape(str(e.get('source_url') or ''),quote=True)
 reasons=' · '.join(labels.get(x,str(x).replace('-',' ').title()) for x in e.get('qualification_reasons',[]))
 confirmation=str(e.get('confirmation_status') or 'unconfirmed'); lifecycle=str(e.get('lifecycle_status') or 'active')
 venue=str(e.get('venue') or 'Location unconfirmed · Lieu non confirmé'); city=str(e.get('city') or 'Unknown')
 desc=str(e.get('description') or e.get('raw_excerpt') or '')
 robots='index,follow' if confirmation=='confirmed' and e.get('date_precision')=='exact' and city not in ('Unknown','') and lifecycle not in {'cancelled','missing-on-source'} else 'noindex,follow'
 canonical=f'https://seminarschools.com/polymythseminars/events/{sid}/'
 schema={'@context':'https://schema.org','@type':'Event','name':e.get('title'),'startDate':e.get('date'),'endDate':e.get('end_date'),'eventStatus':{'cancelled':'https://schema.org/EventCancelled','postponed':'https://schema.org/EventPostponed','rescheduled':'https://schema.org/EventRescheduled'}.get(lifecycle,'https://schema.org/EventScheduled'),'location':{'@type':'Place','name':venue,'address':city},'url':canonical,'sameAs':e.get('source_url'),'inLanguage':e.get('source_language') or 'en'}
 page=f'''<!doctype html><html lang="en-CA"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{title} · Polymythcal</title><meta property="og:title" content="{title} · Polymythcal"><meta name="description" content="Polymythcal listing for {title}."><meta property="og:description" content="Polymythcal listing for {title}."><meta name="robots" content="{robots}"><link rel="canonical" href="{canonical}"><link rel="alternate" hreflang="en-ca" href="{canonical}"><link rel="alternate" hreflang="fr-ca" href="{canonical}?lang=fr"><link rel="alternate" hreflang="x-default" href="{canonical}"><link rel="stylesheet" href="/css/theme.css"><link rel="stylesheet" href="/css/alive.css"><link rel="stylesheet" href="/css/polymythcal-features.css?v=20260720-audit14"><link rel="stylesheet" href="/css/site-wide-type-zoom.css?v=20260710-reviews-zoom-font-a"><script type="application/ld+json">{json_script(schema)}</script></head><body data-route-type="calendar-event" data-geometry="indra-web" data-indra-intensity="0.08" data-event-id="{html.escape(sid,quote=True)}"><a class="skip-link" href="#main-content">Skip to main content · Aller au contenu</a><main id="main-content" class="pm-form-shell"><p><a href="/polymythseminars/">← Polymythcal</a></p><article><div class="truth-row"><span class="truth-chip {confirmation}">{'Confirmed · Confirmé' if confirmation=='confirmed' else 'Unconfirmed · Non confirmé'}</span>{f'<span class="pm-lifecycle {html.escape(lifecycle)}" data-en-label="{html.escape(lifecycle_labels.get(lifecycle,lifecycle))}">{html.escape(lifecycle_labels.get(lifecycle,lifecycle))}</span>' if lifecycle!='active' else ''}</div><h1>{title}</h1><p><strong>{html.escape(format_when(e))}</strong> · {html.escape(city)} · {html.escape(venue)}</p>{f'<p><strong>Qualification · Précision:</strong> {html.escape(reasons)}</p>' if reasons else ''}{f'<p>{html.escape(desc)}</p>' if desc else ''}<p><strong>Last checked · Dernière vérification:</strong> {html.escape(str(e.get('last_checked_at') or 'Unknown'))[:10]}</p>{f'<p><strong>Previous date · Date précédente:</strong> {html.escape(" · ".join(e.get("previous_dates") or []))}</p>' if e.get('previous_dates') else ''}<div class="pm-event-actions"><a href="{source}" rel="noopener noreferrer">Official source · Source officielle ↗</a><a href="/polymythseminars/ics/{html.escape(sid,quote=True)}.ics">Add to calendar · Ajouter au calendrier</a><a href="/polymythseminars/correct/?event={html.escape(canonical,quote=True)}">Correct this listing · Corriger cette fiche</a></div></article></main><script src="/js/theme.js" defer></script><script src="/js/polymythcal-features.js?v=20260720-audit14" defer></script><script defer src="/js/site-keyboard-enhancements.js"></script><script defer src="/js/mandala.js?v=cl91"></script><script defer src="/js/indra.js?v=cl91"></script></body></html>'''
 (folder/'index.html').write_text(page,encoding='utf-8')
 start=ics_dt(e.get('date'),e.get('time_precision')); lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Seminar Schools//Polymythcal//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT','UID:'+str(e.get('identity_key') or sid)+'@seminarschools.com','DTSTAMP:'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')]
 if start: lines.append(('DTSTART;VALUE=DATE:' if start[0]=='DATE' else 'DTSTART:')+start[1])
 end=ics_dt(e.get('end_date'),e.get('time_precision'))
 if end: lines.append(('DTEND;VALUE=DATE:' if end[0]=='DATE' else 'DTEND:')+end[1])
 lines += ['SUMMARY:'+ics_escape(e.get('title')),'LOCATION:'+ics_escape(venue),'DESCRIPTION:'+ics_escape(desc[:800]),'URL:'+canonical,'STATUS:'+event_status_ics(e),'END:VEVENT','END:VCALENDAR','']
 (icsdir/(sid+'.ics')).write_text('\r\n'.join(lines),encoding='utf-8')
# Preserve the former slug-hash URLs as lightweight aliases to canonical stable IDs.
for e in events:
 sid=str(e.get('id') or e.get('identity_key')); alias_id=legacy_alias(sid)
 if alias_id==sid: continue
 target=f'/polymythseminars/events/{urllib.parse.quote(sid)}/'
 alias_folder=out/alias_id; alias_folder.mkdir(parents=True,exist_ok=True)
 alias_page=f'<!doctype html><html lang="en-CA"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,follow"><meta http-equiv="refresh" content="0;url={html.escape(target,quote=True)}"><link rel="canonical" href="https://seminarschools.com{html.escape(target,quote=True)}"><title>Event moved · Fiche déplacée</title></head><body><p><a href="{html.escape(target,quote=True)}">Open the stable event page · Ouvrir la fiche stable</a></p><script>location.replace({json.dumps(target)})</script></body></html>'
 (alias_folder/'index.html').write_text(alias_page,encoding='utf-8')
alias=ROOT/'polymythcal'; alias.mkdir(exist_ok=True)
(alias/'index.html').write_text('<!doctype html><html lang="en-CA"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,follow"><meta http-equiv="refresh" content="0;url=/polymythseminars/"><link rel="canonical" href="https://seminarschools.com/polymythseminars/"><title>Polymythcal</title></head><body><p><a href="/polymythseminars/">Open Polymythcal</a></p><script>location.replace("/polymythseminars/")</script></body></html>',encoding='utf-8')
print(f'Built {len(events)} stable bilingual event pages and ICS files')
