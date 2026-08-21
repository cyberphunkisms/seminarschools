#!/usr/bin/env python3
"""Reconstruct Polymythcal Set 10 from the verified Set 9 archive.

The previously claimed Set 10 archive was not retained. This deterministic pass
classifies and links the existing arts/performance/exhibition/festival corpus
without inventing source verification or replacing established identities.
"""
from __future__ import annotations
from pathlib import Path
import collections, json, re

ROOT = Path(__file__).resolve().parents[1]
MANUAL = ROOT / "data" / "manual-events.json"
CONSOLIDATED = ROOT / "data" / "polymyth-seminar-events.json"
RESEARCH_FILE = ROOT / "data" / "polymythcal-research-set-10-arts-reconstruction-2026-08-14.json"
RESEARCH_DIR = ROOT / "data" / "research" / "polymythcal-set10-arts-reconstruction-2026-08-14"
SRC = "manual-polymythcal-arts-set10-reconstruction-2026-08-14"
SET = "10-Arts-Performance-Exhibitions-and-Festivals"
CHECKED = "2026-08-14T22:00:00-04:00"
META = "polymythcal_arts_set10_reconstruction_2026_08_14"
CL = [f"CL-WEB-{n}" for n in range(252, 260)]
BASELINE_SET9_ARTS_RECORDS = 401
BASELINE_IDS_BACKFILLED = 67
DUPLICATE_MAP = {
    ("caribana official launch 2026", "2026-06-13"): "edb124435d99",
    ("the let down reflex at the fofa gallery", "2026-07-21"): "fdc0f440490c",
    ("toronto caribbean carnival 2026 caribana 59th year", "2026-07-30"): "275a3d6c2cb5",
    ("caribana grand parade", "2026-08-01"): "119d86af47de",
    ("nuit blanche toronto 2026 20th anniversary tomorrow s memories", "2026-10-03"): "3018f2437e1f",
}

EXPLICIT_TYPES = {
    "performance", "exhibition", "festival", "festival-of-form", "cultural-reproduction",
    "site-specific-art", "artist-talk", "screening", "celebration"
}

def norm(value):
    return re.sub(r"[^a-z0-9]+", " ", str(value or "").lower()).strip()

def day(value):
    return str(value or "")[:10]

def is_candidate(event):
    etype = norm(event.get("type")).replace(" ", "-")
    if etype in EXPLICIT_TYPES:
        return True
    if event.get("record_kind") in {"exhibition", "festival"}:
        return True
    fields = [event.get("subjects"), event.get("topics"), event.get("tags"), event.get("entry_family")]
    blob = norm(" ".join(map(str, fields)))
    return bool(re.search(r"\b(arts?|theatre|theater|dance|music|opera|film arts?|visual arts?|public art|performance|exhibition|festival)\b", blob)) and event.get("record_kind") != "opportunity"

def classify(event):
    blob = norm(" ".join(map(str, [
        event.get("title"), event.get("type"), event.get("description"), event.get("venue"),
        event.get("subjects"), event.get("topics"), event.get("tags"), event.get("entry_family"),
        event.get("interaction_format"), event.get("presence_categories")
    ])))
    forms=[]; disciplines=[]
    def add_form(value):
        if value not in forms: forms.append(value)
    def add_disc(value):
        if value not in disciplines: disciplines.append(value)
    if re.search(r"\b(theatre|theater|play|dramaturg|stage production|fringe)\b", blob):
        add_form("theatre-performance"); add_disc("theatre")
    if re.search(r"\b(dance|dancing|ballet|choreograph|salsa|lindy|country dance)\b", blob):
        add_form("dance-performance"); add_disc("dance")
    if re.search(r"\b(opera|orchestra|symphon|philharmonic|messiah)\b", blob):
        add_form("opera-orchestral"); add_disc("opera-orchestral-music")
    if re.search(r"\b(music|concert|jazz|choir|song|singer|band|sound|piano|guitar)\b", blob):
        add_form("music-performance"); add_disc("music")
    if event.get("type") == "exhibition" or re.search(r"\b(exhibition|gallery|museum|installation|retrospective)\b", blob):
        add_form("exhibition"); add_disc("visual-arts")
    if event.get("type") in {"festival", "festival-of-form", "cultural-reproduction"} or event.get("record_kind") == "festival" or re.search(r"\bfestival\b", blob):
        add_form("festival"); add_disc("multidisciplinary-cultural-festival")
    if event.get("type") == "site-specific-art" or re.search(r"\b(public art|site specific|nuit blanche|art in the park|outdoor art)\b", blob):
        add_form("public-art-site-specific"); add_disc("public-art")
    if event.get("type") == "artist-talk" or re.search(r"\b(artist talk|curator talk|art crawl|gallery talk)\b", blob):
        add_form("artist-curator-program"); add_disc("visual-arts")
    if event.get("type") == "screening" or re.search(r"\b(screening|film festival|cinema|documentary|premiere)\b", blob):
        add_form("screening-film-festival"); add_disc("film-media-arts")
    if event.get("talkback_status") == "confirmed" or event.get("talkback_confirmed") is True or re.search(r"\b(talkback|post show|post performance|q a|discussion with artists)\b", blob):
        add_form("talkback-discussion")
    if not forms:
        add_form("multidisciplinary-performance"); add_disc("multidisciplinary-arts")
    if not disciplines:
        add_disc("multidisciplinary-arts")
    return forms, disciplines

def main():
    manual_doc=json.loads(MANUAL.read_text(encoding="utf-8")); events=manual_doc["events"]
    consolidated_doc=json.loads(CONSOLIDATED.read_text(encoding="utf-8")); consolidated=consolidated_doc.get("events", consolidated_doc)
    public_by_key=collections.defaultdict(list)
    for event in consolidated:
        public_by_key[(norm(event.get("title")), day(event.get("date")))].append(event)
    enriched=[]; ids_backfilled=0; unresolved_no_id=[]; duplicate_records=[]
    form_counts=collections.Counter(); discipline_counts=collections.Counter(); role_counts=collections.Counter()
    previous_meta = manual_doc.get(META) or {}
    for event in events:
        if not is_candidate(event):
            continue
        if not event.get("id"):
            matches=public_by_key.get((norm(event.get("title")), day(event.get("date"))), [])
            if len(matches)==1 and matches[0].get("id"):
                event["id"]=matches[0]["id"]
                if matches[0].get("identity_key") and not event.get("identity_key"):
                    event["identity_key"]=matches[0]["identity_key"]
                ids_backfilled += 1
            else:
                unresolved_no_id.append({"title":event.get("title"),"date":event.get("date"),"matches":len(matches)})
        forms, disciplines=classify(event)
        event["arts_event_forms"] = list(dict.fromkeys([*(event.get("arts_event_forms") or []), *forms]))
        event["arts_disciplines"] = list(dict.fromkeys([*(event.get("arts_disciplines") or []), *disciplines]))
        if event.get("series_role") in {"parent","child"}:
            role=event["series_role"]
        elif event.get("end_date") and day(event.get("end_date")) != day(event.get("date")):
            role="run"
        else:
            role="single-occurrence"
        event["arts_occurrence_role"] = role
        event["arts_access_status"] = event.get("public_access_status") or ("public-or-ticketed" if event.get("confirmation_status") == "confirmed" else "access-unconfirmed")
        event["research_set_cross_tags"] = list(dict.fromkeys([*(event.get("research_set_cross_tags") or []), SET]))
        duplicate_of = DUPLICATE_MAP.get((norm(event.get("title")), day(event.get("date"))))
        batches = [value for value in (event.get("_upsert_batches") or []) if value != SRC]
        if duplicate_of:
            event["set10_duplicate_of"] = duplicate_of
            duplicate_records.append({"title":event.get("title"),"date":event.get("date"),"duplicate_of":duplicate_of})
        else:
            batches.append(SRC)
            event.pop("set10_duplicate_of", None)
        event["_upsert_batches"] = list(dict.fromkeys(batches))
        event["set10_classified_at"] = CHECKED
        for value in forms: form_counts[value]+=1
        for value in disciplines: discipline_counts[value]+=1
        role_counts[role]+=1
        enriched.append({
            "id":event.get("id"),"title":event.get("title"),"date":event.get("date"),
            "source_url":event.get("source_url"),"forms":event["arts_event_forms"],
            "disciplines":event["arts_disciplines"],"occurrence_role":role,
            "classification_basis":"existing canonical record; Set 10 structural normalization",
        })
    events.sort(key=lambda e:(str(e.get("date","")),str(e.get("title","")),str(e.get("id",""))))
    manual_doc["count"]=len(events)
    manual_doc["last_event_research_import"]="2026-08-14"
    set11_cross=sum(1 for event in events if is_candidate(event) and event.get("research_set")=="11-Participatory-Cultural-Events")
    set11_existing_cross_tags=sum(1 for event in events if is_candidate(event) and event.get("research_set")!="11-Participatory-Cultural-Events" and "11-Participatory-Cultural-Events" in (event.get("research_set_cross_tags") or []))
    set12_cross=sum(1 for event in events if is_candidate(event) and event.get("research_set")=="12-Civic-Political-Legal-Labour-Events")
    manual_doc[META]={
        "source":SRC,"research_set":SET,"records_enriched":len(enriched),
        "baseline_set9_arts_records":BASELINE_SET9_ARTS_RECORDS,
        "post_set9_arts_records_cross_classified":max(0,len(enriched)-BASELINE_SET9_ARTS_RECORDS),
        "set11_arts_records_cross_classified":set11_cross,
        "set11_existing_records_cross_tagged":set11_existing_cross_tags,
        "set12_arts_records_cross_classified":set12_cross,
        "upsert_eligible_records":len(enriched)-len(duplicate_records),
        "canonical_duplicate_records_not_upserted":len(duplicate_records),
        "stable_public_ids_backfilled":max(BASELINE_IDS_BACKFILLED,int(previous_meta.get("stable_public_ids_backfilled") or 0),ids_backfilled),"unresolved_legacy_records_without_ids":len(unresolved_no_id),
        "forms":dict(sorted(form_counts.items())),"disciplines":dict(sorted(discipline_counts.items())),
        "occurrence_roles":dict(sorted(role_counts.items())),"change_list_components":CL,
        "reconstruction_note":"Rebuilt from the verified Set 9 archive because the previously claimed Set 10 output was not present. No new source-verification claim is made for legacy records.",
    }
    MANUAL.write_text(json.dumps(manual_doc,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    ledger={
        "schema":"polymythcal-arts-set10-reconstruction-ledger-v1","generated_at":CHECKED,
        "source_batch":SRC,"research_set":SET,"record_count":len(enriched),
        "baseline_set9_arts_records":BASELINE_SET9_ARTS_RECORDS,
        "post_set9_arts_records_cross_classified":max(0,len(enriched)-BASELINE_SET9_ARTS_RECORDS),
        "set11_arts_records_cross_classified":set11_cross,
        "set11_existing_records_cross_tagged":set11_existing_cross_tags,
        "set12_arts_records_cross_classified":set12_cross,
        "stable_public_ids_backfilled":max(BASELINE_IDS_BACKFILLED,int(previous_meta.get("stable_public_ids_backfilled") or 0),ids_backfilled),"unresolved_no_id":unresolved_no_id,
        "canonical_duplicates_not_upserted":duplicate_records,
        "records":enriched,"notes":[
            "This is a reconstruction from the verified Set 9 release, not a claim that a missing Set 10 archive was recovered.",
            "Existing record identities, source URLs, first-seen dates, attendance evidence, and accepted content are preserved.",
            "Arts format, discipline, access, and occurrence role are independent fields.",
            "Production credit remains distinct from occurrence-level attendance evidence.",
        ]
    }
    RESEARCH_DIR.mkdir(parents=True,exist_ok=True)
    RESEARCH_FILE.write_text(json.dumps(ledger,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    (RESEARCH_DIR/"research-ledger.json").write_text(json.dumps(ledger,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(manual_doc[META],indent=2))

if __name__=="__main__": main()
