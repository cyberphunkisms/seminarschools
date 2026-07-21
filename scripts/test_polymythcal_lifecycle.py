#!/usr/bin/env python3
import sys,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]; sys.path.insert(0,str(ROOT/'scripts'))
from reconcile_polymythcal_lifecycle import reconcile
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
if __name__=='__main__': unittest.main()
