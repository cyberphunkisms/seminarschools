#!/usr/bin/env python3
"""Verify maintained English/French coverage of current Polymythcal public surfaces."""
from __future__ import annotations
import json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def read(rel):return (ROOT/rel).read_text(encoding='utf-8')
def surface(name,rel,requirements):
 text=read(rel);missing=[token for token in requirements if token not in text]
 return {'surface':name,'path':'/'+rel.replace('index.html',''),'status':'complete' if not missing else 'incomplete','required_markers':len(requirements),'missing_markers':missing}
def main():
 app=read('js/polymythcal-revamp.js');release=json.loads(read('RELEASE_MANIFEST.json'));feeds=json.loads(read('polymythseminars/feeds/index.json'))['feeds'];events=json.loads(read('polymythseminars/events.json'))['events']
 event_pages=[]
 for event in events:
  p=ROOT/'polymythseminars/events'/str(event.get('id') or event.get('identity_key'))/'index.html'
  if p.exists():event_pages.append(p.read_text(encoding='utf-8'))
 surfaces=[
  surface('Main calendar','polymythseminars/index.html',['fr-CA','hreflang="fr-ca"','polymythcal-revamp.js','id="pmLanguageLink"','id="pmEventList"']),
  surface('Event submission','polymythseminars/submit/index.html',['Proposer un événement','lang="fr"','hreflang="fr-ca"','data-netlify="true"']),
  surface('Listing correction','polymythseminars/correct/index.html',['Corriger une fiche','lang="fr"','hreflang="fr-ca"','data-netlify="true"']),
  surface('Submission confirmation','polymythseminars/thanks/index.html',['Envoi reçu','lang="fr"']),
  surface('Subscription index','polymythseminars/subscribe/index.html',['Abonnements','lang="fr"','hreflang="fr-ca"'])]
 for slug in ['writingclub','writingkids','writingjuniors','writingteens','writinggrads','university','philosophy','humanities','cfps','lectures','fellowships']:
  surfaces.append(surface(f'Dedicated route: {slug}',f'{slug}/index.html',[f'data-pm-route="{slug}"','polymythcal-revamp.js','hreflang="fr-ca"','id="pmLanguageLink"']))
 translation_block=re.search(r'const translations = \{([\s\S]*?)\n  \};\n\n  const staticFrench',app)
 static_block=re.search(r'const staticFrench = \{([\s\S]*?)\n  \};',app)
 result={
  'generated_at':release.get('generated_at'),
  'languages':['en-CA','fr-CA'],
  'runtime_translation_markers':len(re.findall(r'\bfr\s*:\s*\{',translation_block.group(1))) if translation_block else 0,
  'static_french_dictionary_entries':len(re.findall(r'^\s*"[^"]+"\s*:',static_block.group(1),re.M)) if static_block else 0,
  'surfaces':surfaces,
  'canonical_event_pages':len(event_pages),
  'canonical_event_pages_with_bilingual_actions':sum('Ajouter au calendrier' in x and 'Corriger cette fiche' in x and 'Dernière vérification' in x for x in event_pages),
  'focused_feeds':len(feeds),
  'focused_feeds_with_english_and_french_labels':sum(bool(x.get('label_en') and x.get('label_fr')) for x in feeds),
  'content_policy':'Organizer titles, descriptions, proper names, and source-language material remain in their source language. Navigation, filters, states, qualifications, actions, forms, dedicated-route guidance, feed labels, and calendar instructions are maintained in English and French.'}
 result['complete']=all(x['status']=='complete' for x in surfaces) and result['static_french_dictionary_entries']>=100 and result['canonical_event_pages']==result['canonical_event_pages_with_bilingual_actions'] and result['focused_feeds']==result['focused_feeds_with_english_and_french_labels']
 (ROOT/'data/polymythcal-translation-inventory.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print(json.dumps({'complete':result['complete'],'surfaces':len(surfaces),'events':result['canonical_event_pages'],'feeds':result['focused_feeds'],'dictionary':result['static_french_dictionary_entries']},ensure_ascii=False))
 raise SystemExit(0 if result['complete'] else 1)
if __name__=='__main__':main()
