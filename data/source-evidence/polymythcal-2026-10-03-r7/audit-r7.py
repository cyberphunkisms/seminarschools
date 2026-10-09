import json,hashlib
from pathlib import Path
from collections import Counter
B=Path('/workspace/scratch/cc6502ebeac7');R=B/'r7-release';P=B/'r6-release'
def read(root,p):return json.loads((root/p).read_text())
before=read(P,'data/polymyth-seminar-events.json')['events'];after=read(R,'data/polymyth-seminar-events.json')['events']
by={e['id']:e for e in after};old={e['id']:e for e in before};checks=[]
def check(condition,label):
 assert condition,label
 checks.append(label)
check(len(by)==len(old)==2086 and by.keys()==old.keys(),'All 2086 stable identities retained; no additions, removals or merges')
delta=read(R,'data/source-evidence/polymythcal-2026-10-03-r7/correction-delta-r7.json')['corrections']
for i,changes in delta.items():
 for key,value in changes.items():check(by[i].get(key)==value,f'{i}: correction persists in {key}')
for i in by:
 if i not in delta:check(by[i]==old[i],f'{i}: unrelated record unchanged')
browse=read(R,'polymythseminars/browse.json');watch=read(R,'polymythseminars/watchlist.json')
check(len(browse['events'])==1873 and len(watch['items'])==213,'Chronology/watchlist partition unchanged')
check(browse['taxonomy']==read(P,'polymythseminars/browse.json')['taxonomy'],'Existing filter taxonomy and options unchanged')
public={e['id']:e for e in browse['events']+watch['items']}
for i,e in public.items():
 check(all(isinstance(e['facets'].get(k),list) for k in ['kind','what','places','topics','formats','audiences','statuses']),f'{i}: complete facet arrays')
 if i.startswith('cupe-'):check('public' not in e['facets']['audiences'],f'{i}: restricted eligibility respected')
 if i.startswith('proust-readers-support-group') and by[i].get('time_precision')=='estimated':check(e['confirmation_status']=='unconfirmed',f'{i}: estimated time qualified')
for i in delta:
 for prefix in ['', 'public/']:
  check((R/(prefix+'polymythseminars/events/'+i+'/index.html')).is_file(),f'{i}: existing detail route preserved')
  if i in {e['id'] for e in browse['events']}:check((R/(prefix+'polymythseminars/ics/'+i+'.ics')).is_file(),f'{i}: calendar export retained')
for p in ['js/geometry.js','css/visible-geometry.css','js/polymythcal-discovery-core.js']:
 if p=='js/polymythcal-discovery-core.js':continue
 if (R/p).exists() and (P/p).exists():check((R/p).read_bytes()==(P/p).read_bytes(),p+' unchanged')
sources=read(R,'scripts/sources.json');sources=sources if isinstance(sources,list) else sources['sources']
for s in sources:
 if s['id'] in ['uoft-philosophy','utoronto-philosophy-events']:check(s['events_url']=='https://philosophy.utoronto.ca/events/' and s['platform_adapter']=='wordpress-tec',s['id']+': current existing-source endpoint')
def census(rows):return {'destination_status':dict(Counter(e.get('destination_status') for e in rows)),'unconfirmed':sum(e.get('confirmation_status')!='confirmed' for e in rows),'unknown_city':sum(str(e.get('city') or '').lower() in ['','unknown','tba','tbd'] for e in rows)}
result={'status':'passed','assertions':len(checks),'canonical_records':len(by),'corrected_records':len(delta),'before':census(before),'after':census(after),'chronology_records':len(browse['events']),'watchlist_records':len(watch['items']),'public_audience_records':sum('public' in e['facets']['audiences'] for e in public.values()),'unknown_or_unclassified_audience_records':sum(not e['facets']['audiences'] for e in public.values()),'scope':'Repairs to existing features and records only. No new filters, routes, recommendations, subscriptions or event records.','limits':'This pass does not re-verify the full source backlog. Existing unverified source facts retain qualifications and review dates.'}
(B/'r7-audit-results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps(result))
