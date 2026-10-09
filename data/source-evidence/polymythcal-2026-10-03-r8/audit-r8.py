import json,zipfile,hashlib
from pathlib import Path
from collections import Counter
B=Path('/workspace/scratch/cc6502ebeac7');R=B/'r8-release';Z=B/'polymythcal-website-fixed-2026-10-02.zip'
checks=0
def check(ok,msg):
 global checks
 checks+=1
 assert ok,msg
with zipfile.ZipFile(Z) as z:
 before=json.loads(z.read('data/polymyth-seminar-events.json'))['events']
 after=json.loads((R/'data/polymyth-seminar-events.json').read_text())['events']
 a={e['id']:e for e in before};b={e['id']:e for e in after}
 check(len(before)==len(after)==2086,'canonical population retained')
 check(set(a)==set(b),'all stable IDs retained')
 for id in a:check(a[id]==b[id],'canonical record changed '+id)
 for name in ['polymythseminars/browse.json','polymythseminars/watchlist.json','polymythseminars/research.json']:
  old=json.loads(z.read(name));new=json.loads((R/name).read_text())
  for key in ['taxonomy','axes','facets','families']:
   if key in old:check(old[key]==new[key],name+' '+key+' changed')
  for key in ['events','leads','items','records']:
   if key in old:
    check(old[key]==new[key],name+' '+key+' changed')
  print(name,list(new),len(new.get('events',new.get('items',[]))))
 for name in ['data/polymythcal-sources.json','data/polymythcal-reviewed-corrections-2026-10-03.json']:
  if name in z.namelist():check(z.read(name)==(R/name).read_bytes(),name+' altered')
 for name in ['CHARTER.txt','polymyth/methodologylist/index.html','polymyth/methodologylist/mephistodata-rule-hardening-addendum.js']:
  check(z.read(name)==(R/name).read_bytes(),name+' altered')
 receipt=json.loads(z.read('POLYMYTHCAL_WEBSITE_CHANGE_RECEIPT_2026-10-02.json'))
 check(receipt['revision']==7,'known predecessor')
result={'status':'passed','assertions':checks,'revision':8,'canonical_records':len(after),'canonical_records_changed':0,'stable_ids_retained':len(a),'destination_status':dict(Counter(x.get('destination_status','unspecified') for x in after)),'confirmation_status':dict(Counter(x.get('confirmation_status','unspecified') for x in after)),'scope':'Existing search, presentation and saved-state repairs only. No event facts or taxonomy changes.','limits':['No fresh source-by-source verification of the 2086 listings.','Browser behaviour and performance measured in headless Chromium only.']}
(B/'r8-audit-results.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
