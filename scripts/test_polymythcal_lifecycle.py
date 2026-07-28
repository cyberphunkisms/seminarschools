#!/usr/bin/env python3
import json,sys,tempfile,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]; sys.path.insert(0,str(ROOT/'scripts'))
from reconcile_polymythcal_lifecycle import collapse_shadow_duplicates,reconcile,successful_sources
class LifecycleTests(unittest.TestCase):
 def test_reschedule_preserves_id_and_history(self):
  prev=[{'id':'old','identity_key':'abc','title':'Talk','date':'2026-08-01T18:00:00-04:00','source_id':'u','lifecycle_status':'active'}]
  cur=[{'id':'new','identity_key':'abc','title':'Talk','date':'2026-08-03T18:00:00-04:00','source_id':'u'}]
  out,ch=reconcile(cur,prev,{'u'}); self.assertEqual(out[0]['id'],'old'); self.assertEqual(out[0]['lifecycle_status'],'rescheduled'); self.assertIn('2026-08-01T18:00:00-04:00',out[0]['previous_dates'])
 def test_disappearance_requires_successful_source_and_threshold(self):
  prev=[{'id':'a','identity_key':'a','title':'A','date':'2026-08-01','source_id':'s','lifecycle_status':'active','missing_count':1}]
  out,ch=reconcile([],prev,{'s'},2); self.assertEqual(out[0]['lifecycle_status'],'missing-on-source')
  out2,ch2=reconcile([],prev,set(),2); self.assertEqual(out2,[])
 def test_cancelled_words(self):
  cur=[{'id':'a','identity_key':'a','title':'A','date':'2026-08-01','source_id':'s','description':'Event cancelled'}]
  out,ch=reconcile(cur,[],{'s'}); self.assertEqual(out[0]['lifecycle_status'],'cancelled')
 def test_rrule_expansion(self):
  cur=[{'id':'r','identity_key':'r','title':'Weekly','date':'2026-08-01T10:00:00-04:00','source_id':'s','rrule':'FREQ=WEEKLY;COUNT=3'}]
  out,ch=reconcile(cur,[],{'s'}); self.assertEqual(len(out),3); self.assertEqual(out[2]['recurrence_index'],2)
 def test_repeated_title_source_occurrences_keep_unique_ids(self):
  prev=[{'id':'old','identity_key':'old-key','title':'Clinic','date':'2027-02-16T00:00-05:00','source_id':'museum','lifecycle_status':'active'}]
  cur=[
   {'id':'july','identity_key':'july-key','title':'Clinic','date':'2026-09-15T00:00-04:00','source_id':'museum'},
   {'id':'nov','identity_key':'nov-key','title':'Clinic','date':'2026-11-17T00:00-05:00','source_id':'museum'},
   prev[0].copy(),
  ]
  out,ch=reconcile(cur,prev,{'museum'}); self.assertEqual(len({e['id'] for e in out}),3); self.assertFalse(any(c.get('change')=='rescheduled' for c in ch))
 def test_equivalent_iso_precision_is_not_reschedule(self):
  prev=[{'id':'old','identity_key':'same','title':'Talk','date':'2026-08-01T18:00:00-04:00','source_id':'u','lifecycle_status':'active'}]
  cur=[{'id':'old','identity_key':'same','title':'Talk','date':'2026-08-01T18:00-04:00','source_id':'u'}]
  out,ch=reconcile(cur,prev,{'u'}); self.assertEqual(out[0]['lifecycle_status'],'active'); self.assertEqual(ch,[])
 def test_overlapping_generic_calendar_shadow_collapses_to_specific_record(self):
  cur=[
   {'id':'specific','title':'The Let Down Reflex','date':'2026-07-10T00:00-04:00','end_date':'2026-08-21T23:59-04:00','city':'Montréal','venue':'FOFA Gallery','source_url':'https://example.org/events/let-down-reflex','confidence':100},
   {'id':'shadow','title':'The Let Down Reflex','date':'2026-07-21T00:00-04:00','end_date':'2026-08-21T00:00-04:00','city':'Montréal','venue':'Location unconfirmed','source_url':'https://example.org/events.html','confidence':86},
  ]
  out,ch=reconcile(cur,[],set()); self.assertEqual(len(out),1); self.assertEqual(out[0]['id'],'specific'); self.assertIn('shadow',out[0]['legacy_ids'])
  self.assertEqual(len([c for c in ch if c.get('change')=='collapsed-shadow']),1)
  self.assertEqual(ch[0]['shadow_id'],'shadow')
 def test_distinct_specific_sessions_are_preserved(self):
  cur=[
   {'id':'a','title':'Clinic','date':'2026-09-15T10:00-04:00','end_date':'2026-09-15T12:00-04:00','city':'Toronto','venue':'Room A','source_url':'https://example.org/events/a'},
   {'id':'b','title':'Clinic','date':'2026-09-15T11:00-04:00','end_date':'2026-09-15T13:00-04:00','city':'Toronto','venue':'Room B','source_url':'https://example.org/events/b'},
  ]
  out,ch=reconcile(cur,[],set()); self.assertEqual(len(out),2)
 def test_collapsed_previous_shadow_is_not_readded(self):
  specific={'id':'specific','identity_key':'specific-key','legacy_ids':['shadow','shadow-key'],'title':'Talk','date':'2026-08-01','city':'Toronto','venue':'Hall','source_id':'s','source_url':'https://example.org/events/talk','lifecycle_status':'active','missing_count':0}
  shadow={'id':'shadow','identity_key':'shadow-key','title':'Talk','date':'2026-08-01','city':'Toronto','venue':'TBD','source_id':'s','source_url':'https://example.org/events','lifecycle_status':'active','missing_count':0}
  out,ch=reconcile([specific], [specific,shadow], {'s'}, stamp='2026-07-23T00:00:00+00:00')
  self.assertEqual([event['id'] for event in out],['specific'])
  self.assertFalse(any(event.get('missing_count') for event in out))
 def test_known_legacy_id_suppresses_reintroduced_shadow_without_city(self):
  cur=[
   {'id':'specific','identity_key':'specific-key','legacy_ids':['shadow'],'title':'Talk','date':'2026-08-01','city':'Toronto','venue':'Hall','source_url':'https://example.org/events/talk'},
   {'id':'shadow','title':'Talk','date':'2026-08-01','city':'','venue':'TBD','source_url':'https://example.org/events'},
  ]
  out,ch=reconcile(cur,[],set())
  self.assertEqual(len(out),1); self.assertEqual(out[0]['id'],'specific')
  self.assertEqual(ch[0]['reason'],'known-legacy-id')
 def test_chained_collapse_preserves_every_legacy_identifier(self):
  records=[
   {'id':'a','identity_key':'a-key','legacy_ids':['old-a'],'title':'Talk','date':'2026-08-01','city':'Toronto','venue':'TBD','source_url':'https://example.org/events'},
   {'id':'b','identity_key':'b-key','legacy_ids':['old-b'],'title':'Talk','date':'2026-08-01','city':'Toronto','venue':'TBD','source_url':'https://example.org/calendar'},
   {'id':'c','identity_key':'c-key','legacy_ids':['old-c'],'title':'Talk','date':'2026-08-01','city':'Toronto','venue':'Hall','source_url':'https://example.org/events/talk'},
  ]
  out,changes=collapse_shadow_duplicates(records,include_changes=True)
  self.assertEqual(len(out),1); self.assertEqual(len(changes),2)
  self.assertTrue({'old-a','a','a-key','old-b','b','b-key','old-c'}.issubset(set(out[0]['legacy_ids'])))
 def test_mixed_date_only_and_offset_interval_is_safe(self):
  records=[
   {'id':'date-only','title':'Talk','date':'2026-08-01','city':'Toronto','venue':'TBD','source_url':'https://example.org/events'},
   {'id':'offset','title':'Talk','date':'2026-08-01T00:00:00-04:00','city':'Toronto','venue':'Hall','source_url':'https://example.org/events/talk'},
  ]
  out=collapse_shadow_duplicates(records)
  self.assertEqual(len(out),1); self.assertEqual(out[0]['id'],'offset')
 def test_blank_cities_never_trigger_heuristic_collapse(self):
  records=[
   {'id':'a','title':'Talk','date':'2026-08-01','city':'','venue':'TBD','source_url':'https://example.org/events'},
   {'id':'b','title':'Talk','date':'2026-08-01','city':'','venue':'Hall','source_url':'https://example.org/events/talk'},
  ]
  self.assertEqual(len(collapse_shadow_duplicates(records)),2)
 def test_successful_sources_reads_real_source_yield_log_shape(self):
  with tempfile.TemporaryDirectory() as folder:
   path=Path(folder)/'scrape-log.json'
   path.write_text(json.dumps({'source_yields':[{'source_id':'ok-source','status':'crawled','events':[]},{'source_id':'failed-source','status':'failed'}]}),encoding='utf-8')
   self.assertEqual(successful_sources(path),{'ok-source'})
 def test_current_missing_record_does_not_reactivate_itself(self):
  prev=[{'id':'a','identity_key':'a','title':'A','date':'2026-08-01','source_id':'s','lifecycle_status':'missing-on-source','missing_count':2}]
  cur=[{'id':'a','identity_key':'a','title':'A','date':'2026-08-01','source_id':'s','lifecycle_status':'missing-on-source','source_observation_status':'missing'}]
  out,ch=reconcile(cur,prev,{'s'},stamp='2026-07-23T00:00:00+00:00',missing_threshold=2)
  self.assertEqual(out[0]['lifecycle_status'],'missing-on-source'); self.assertGreaterEqual(out[0]['missing_count'],2)
  self.assertFalse(any(item.get('change')=='reappeared' for item in ch))
if __name__=='__main__': unittest.main()
