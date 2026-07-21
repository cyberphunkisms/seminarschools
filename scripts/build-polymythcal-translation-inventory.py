#!/usr/bin/env python3
"""Record the maintained English/French coverage of Polymythcal public surfaces."""
from __future__ import annotations
import json,re
from datetime import datetime,timezone
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

def read(rel): return (ROOT/rel).read_text(encoding='utf-8')
def surface(name,rel,requirements):
 text=read(rel); missing=[token for token in requirements if token not in text]
 return {'surface':name,'path':'/'+rel.replace('index.html',''),'status':'complete' if not missing else 'incomplete','required_markers':len(requirements),'missing_markers':missing}

def main():
 js=read('js/polymythcal-features.js'); main=read('polymythseminars/index.html')
 fr_map_match=re.search(r'var FR=\{(.*?)\};\nfunction tr',js,re.S)
 main_map_match=re.search(r'const PM_FR = \{(.*?)\};\nfunction pmT',main,re.S)
 feeds=json.loads(read('polymythseminars/feeds/index.json'))['feeds']
 event_pages=[]
 events=json.loads(read('polymythseminars/events.json'))['events']
 for e in events:
  p=ROOT/'polymythseminars/events'/str(e.get('id') or e.get('identity_key'))/'index.html'
  if p.exists(): event_pages.append(p.read_text(encoding='utf-8'))
 surfaces=[
  surface('Main calendar','polymythseminars/index.html',['PM_LANG','PM_FR','fr-CA','hreflang="fr-ca"','polymythcal-features.js']),
  surface('Event submission','polymythseminars/submit/index.html',['Proposer un événement','lang="fr"','hreflang="fr-ca"','data-netlify="true"']),
  surface('Listing correction','polymythseminars/correct/index.html',['Corriger une fiche','lang="fr"','hreflang="fr-ca"','data-netlify="true"']),
  surface('Submission confirmation','polymythseminars/thanks/index.html',['Envoi reçu','lang="fr"']),
  surface('Subscription index','polymythseminars/subscribe/index.html',['Abonnements','lang="fr"','hreflang="fr-ca"']),
 ]
 result={
  'generated_at':datetime.now(timezone.utc).isoformat(timespec='seconds'),
  'languages':['en-CA','fr-CA'],
  'interface_dictionary_entries':len(re.findall(r"'[^']+'\s*:",fr_map_match.group(1))) if fr_map_match else 0,
  'calendar_renderer_dictionary_entries':len(re.findall(r"'[^']+'\s*:",main_map_match.group(1))) if main_map_match else 0,
  'surfaces':surfaces,
  'canonical_event_pages':len(event_pages),
  'canonical_event_pages_with_bilingual_actions':sum('Ajouter au calendrier' in x and 'Corriger cette fiche' in x and 'Dernière vérification' in x for x in event_pages),
  'focused_feeds':len(feeds),
  'focused_feeds_with_english_and_french_labels':sum(bool(x.get('label_en') and x.get('label_fr')) for x in feeds),
  'content_policy':'Organizer titles, descriptions, proper names, and source-language material remain in their source language. Navigation, filters, states, qualifications, actions, forms, feed labels, and calendar instructions are maintained in English and French.',
 }
 result['complete']=all(x['status']=='complete' for x in surfaces) and result['canonical_event_pages']==result['canonical_event_pages_with_bilingual_actions'] and result['focused_feeds']==result['focused_feeds_with_english_and_french_labels']
 out=ROOT/'data/polymythcal-translation-inventory.json';out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print(json.dumps({'complete':result['complete'],'surfaces':len(surfaces),'events':result['canonical_event_pages'],'feeds':result['focused_feeds']},ensure_ascii=False))
 raise SystemExit(0 if result['complete'] else 1)
if __name__=='__main__':main()
