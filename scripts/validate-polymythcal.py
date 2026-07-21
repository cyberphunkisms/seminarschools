#!/usr/bin/env python3
import json,re,sys,urllib.parse
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/'polymythseminars/events.json'
SRC=ROOT/'scripts/sources.json'
d=json.loads(DATA.read_text(encoding='utf-8')); events=d.get('events',[])
s=json.loads(SRC.read_text(encoding='utf-8')); sources=s if isinstance(s,list) else s.get('sources',[])
source_ids={x.get('id') for x in sources}
errors=[]; ids=set(); identities=set()
required=['id','identity_key','record_kind','date','date_precision','time_precision','title','source_url','source_quality','confirmation_status','qualification_reasons','lifecycle_status','last_checked_at','city','corridor_zone','timezone','type']
for i,e in enumerate(events):
  label=f"event[{i}] {e.get('title','(untitled)')!r}"
  for k in required:
    if k not in e or e[k] in (None,''): errors.append(f'{label}: missing {k}')
  if e.get('id') in ids: errors.append(f'{label}: duplicate id {e.get("id")}')
  ids.add(e.get('id'))
  if e.get('identity_key') in identities: errors.append(f'{label}: duplicate identity_key {e.get("identity_key")}')
  identities.add(e.get('identity_key'))
  if not re.match(r'^https?://',e.get('source_url','')): errors.append(f'{label}: invalid source_url')
  if e.get('source_id') and e.get('source_id') not in source_ids: errors.append(f'{label}: unknown source_id {e.get("source_id")}')
  q=e.get('qualification_reasons') or []
  if e.get('confirmation_status')=='unconfirmed' and not q: errors.append(f'{label}: unconfirmed without reason')
  if e.get('confirmation_status')=='confirmed' and q: errors.append(f'{label}: confirmed with qualification reasons')
  if e.get('time_precision')=='unknown' and 'time-unconfirmed' not in q: errors.append(f'{label}: unknown time without time-unconfirmed')
  if e.get('end_date') and e.get('date') and e['end_date'] < e['date']: errors.append(f'{label}: end before start')
if d.get('count')!=len(events) or d.get('_total_events')!=len(events): errors.append('metadata count mismatch')
if errors:
 print('\n'.join(errors[:200]),file=sys.stderr); print(f'FAILED: {len(errors)} semantic errors',file=sys.stderr); sys.exit(1)
print(f'PASS: {len(events)} canonical records; {sum(e.get("confirmation_status")=="unconfirmed" for e in events)} qualified unconfirmed; {len(source_ids)} registered sources')
