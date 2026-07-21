#!/usr/bin/env python3
"""Reconcile Polymythcal cancellations, disappearances, recurrence, and rescheduling."""
from __future__ import annotations
import argparse, hashlib, json, re
from collections import Counter
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from dateutil.rrule import rrulestr

ROOT=Path(__file__).resolve().parents[1]
DEFAULT_CURRENT=ROOT/'polymythseminars/events.json'
DEFAULT_STATE=ROOT/'data/polymythcal-lifecycle-state.json'
DEFAULT_LOG=ROOT/'data/polymythcal-lifecycle-log.json'
DEFAULT_SCRAPE_LOG=ROOT/'data/scrape-log.json'
CANCEL_RE=re.compile(r'\b(cancelled|canceled|annul(?:é|e|ée|és|ees)?|annulation)\b',re.I)
POSTPONE_RE=re.compile(r'\b(postponed|report(?:é|e|ée|és|ees)?|remis(?:e)?|différé(?:e)?)\b',re.I)
RESCHED_RE=re.compile(r'\b(rescheduled|reprogrammé(?:e)?|nouvelle date|date modifiée|date changed?)\b',re.I)

def now(): return datetime.now(timezone.utc).isoformat(timespec='seconds')
def norm(s): return re.sub(r'[^a-z0-9]+','',str(s or '').lower())
def source_key(e): return str(e.get('source_id') or e.get('source_url') or '')
def identity(e):
    if e.get('identity_key'): return str(e['identity_key'])
    basis='|'.join([norm(e.get('title'))[:160],norm(source_key(e))[:120],norm(e.get('organizer'))[:80]])
    return hashlib.sha256(basis.encode()).hexdigest()[:20]
def series_identity(e): return str(e.get('series_id') or identity(e))

def title_source_key(e):
    return f'{norm(e.get("title"))}|{norm(source_key(e))}'

def same_moment(a, b):
    if str(a or '') == str(b or ''):
        return True
    try:
        da=datetime.fromisoformat(str(a).replace('Z','+00:00'))
        db=datetime.fromisoformat(str(b).replace('Z','+00:00'))
        return da == db
    except Exception:
        return False
def successful_sources(path:Path):
    if not path.exists(): return set()
    try: data=json.loads(path.read_text(encoding='utf-8'))
    except Exception: return set()
    return {str(x.get('id')) for x in data.get('sources',[]) if x.get('status')=='ok'}

def expand_recurrence(records):
    out=[]
    for e in records:
        rule=e.get('rrule') or e.get('recurrence_rule')
        if not rule:
            out.append(e); continue
        try:
            start=datetime.fromisoformat(str(e['date']).replace('Z','+00:00'))
            dates=list(rrulestr(rule,dtstart=start))[:366]
        except Exception:
            e.setdefault('lifecycle_notes',[]).append('recurrence-parse-failed')
            out.append(e); continue
        duration=None
        if e.get('end_date'):
            try: duration=datetime.fromisoformat(str(e['end_date']).replace('Z','+00:00'))-start
            except Exception: pass
        sid=series_identity(e)
        for i,dt in enumerate(dates):
            inst=deepcopy(e); inst['series_id']=sid; inst['recurrence_index']=i
            inst['recurrence_source']='rrule'; inst['date']=dt.isoformat(timespec='minutes')
            if duration: inst['end_date']=(dt+duration).isoformat(timespec='minutes')
            inst['identity_key']=hashlib.sha256(f'{sid}|{inst["date"]}'.encode()).hexdigest()[:20]
            inst['id']=f"{e.get('id') or sid}-{dt.strftime('%Y%m%dT%H%M')}"
            out.append(inst)
    return out

def text_status(e):
    text=' '.join(str(e.get(k) or '') for k in ('title','description','raw_excerpt','status','lifecycle_note'))
    if CANCEL_RE.search(text): return 'cancelled'
    if POSTPONE_RE.search(text): return 'postponed'
    if RESCHED_RE.search(text): return 'rescheduled'
    return None

def reconcile(current, previous, ok_sources, missing_threshold=2):
    current=expand_recurrence(current)
    prev_by_identity={identity(e):e for e in previous}
    previous_title_source_counts=Counter(title_source_key(e) for e in previous)
    current_title_source_counts=Counter(title_source_key(e) for e in current)
    prev_by_title_source={title_source_key(e):e for e in previous if previous_title_source_counts[title_source_key(e)] == 1}
    seen=set(); changes=[]; result=[]
    for raw in current:
        e=deepcopy(raw); ident=identity(e); e['identity_key']=ident; seen.add(ident)
        ts_key=title_source_key(e)
        prior=prev_by_identity.get(ident)
        if prior is None and current_title_source_counts[ts_key] == 1:
            prior=prev_by_title_source.get(ts_key)
        explicit=text_status(e)
        if explicit:
            if e.get('lifecycle_status')!=explicit: changes.append({'identity_key':ident,'change':explicit,'title':e.get('title')})
            e['lifecycle_status']=explicit
        elif prior and not same_moment(prior.get('date'),e.get('date')):
            old_dates=list(prior.get('previous_dates') or [])
            if prior.get('date') and prior.get('date') not in old_dates: old_dates.append(prior['date'])
            e['previous_dates']=old_dates[-12:]; e['lifecycle_status']='rescheduled'
            e['rescheduled_at']=now(); e['id']=prior.get('id') or e.get('id')
            changes.append({'identity_key':ident,'change':'rescheduled','from':prior.get('date'),'to':e.get('date'),'title':e.get('title')})
        elif prior and prior.get('lifecycle_status')=='missing-on-source':
            e['lifecycle_status']='active'; e['reappeared_at']=now(); e['missing_count']=0
            changes.append({'identity_key':ident,'change':'reappeared','title':e.get('title')})
        else:
            e.setdefault('lifecycle_status','active'); e['missing_count']=0
        if prior:
            e.setdefault('first_seen_at',prior.get('first_seen_at') or now())
        else: e.setdefault('first_seen_at',now())
        e['last_checked_at']=e.get('last_checked_at') or now()
        result.append(e)
    for prior in previous:
        ident=identity(prior)
        if ident in seen: continue
        sid=source_key(prior)
        if sid not in ok_sources: continue
        if prior.get('lifecycle_status') in {'cancelled','archived','superseded'}: continue
        missing=deepcopy(prior); missing['missing_count']=int(prior.get('missing_count') or 0)+1
        missing['last_checked_at']=now()
        if missing['missing_count']>=missing_threshold:
            missing['lifecycle_status']='missing-on-source'; missing.setdefault('missing_since',now())
            changes.append({'identity_key':ident,'change':'missing-on-source','title':missing.get('title'),'source_id':sid})
        result.append(missing)
    result.sort(key=lambda e:(str(e.get('date') or ''),str(e.get('title') or '')))
    return result,changes

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--current',type=Path,default=DEFAULT_CURRENT); ap.add_argument('--state',type=Path,default=DEFAULT_STATE); ap.add_argument('--log',type=Path,default=DEFAULT_LOG); ap.add_argument('--scrape-log',type=Path,default=DEFAULT_SCRAPE_LOG); ap.add_argument('--missing-threshold',type=int,default=2); ap.add_argument('--dry-run',action='store_true'); args=ap.parse_args()
    payload=json.loads(args.current.read_text(encoding='utf-8')); current=payload.get('events',[])
    previous=[]
    if args.state.exists(): previous=json.loads(args.state.read_text(encoding='utf-8')).get('events',[])
    reconciled,changes=reconcile(current,previous,successful_sources(args.scrape_log),args.missing_threshold)
    report={'generated_at':now(),'previous_count':len(previous),'input_count':len(current),'output_count':len(reconciled),'changes':changes}
    print(json.dumps(report,ensure_ascii=False,indent=2))
    if args.dry_run:return
    payload['events']=reconciled; payload['count']=payload['_total_events']=len(reconciled); payload['_lifecycle_reconciled_at']=now()
    args.current.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    args.state.parent.mkdir(parents=True,exist_ok=True); args.state.write_text(json.dumps({'generated_at':now(),'events':reconciled},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    args.log.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    mirror=ROOT/'data/polymyth-seminar-events.json'
    if args.current.resolve()==DEFAULT_CURRENT.resolve(): mirror.write_text(args.current.read_text(encoding='utf-8'),encoding='utf-8')
if __name__=='__main__': main()
