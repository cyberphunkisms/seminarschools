#!/usr/bin/env python3
# Merge the June 9 2026 event-corpus harvest into polymythseminars/events.json.
# Confirmed, dated, forward events only. Dedup combined set by year-stripped title
# OR (same start-date AND title-token-Jaccard >= 0.5). Existing wins on tie; survivor
# backfills missing source_url/end_date/speaker/description from cluster-mates.
import json, re, os, tempfile, datetime

SRC = 'polymythseminars/events.json'

def off(y, m):
    # nominal Toronto offset; EDT Apr-Oct, EST Nov-Mar (date-only midnights, so the hour is cosmetic)
    return '-04:00' if 4 <= m <= 10 else '-05:00'

def E(title, start, end, venue, etype, src, speaker=None, desc='', sec=None):
    ys, ms, ds = map(int, start.split('-'))
    date = f"{start}T00:00:00{off(ys, ms)}"
    end_date = None
    if end:
        ye, me, de = map(int, end.split('-'))
        end_date = f"{end}T00:00:00{off(ye, me)}"
    return {
        'date': date, 'end_date': end_date, 'title': title,
        'speaker_or_director': speaker, 'venue': venue, 'type': etype,
        'source_url': src, 'source_id': 'corpus-2026-06-09',
        'description': desc, 'secondary_types': sec or [],
        'parent_id': None, 'is_parent_festival': False, 'age_band': None,
    }

NEW = [
    # ---- A1 academic ----
    E("Toronto\u2013Rome Programme in Manuscript Studies","2026-06-01","2026-07-10","Pontifical Institute of Mediaeval Studies, Toronto","workshop","https://pims.ca/article/diploma-programme-in-manuscript-studies/","Prof. M. Mich\u00e8le Mulchahey","Latin Palaeography and Codicology; with Prof. Alixe Bovey (Courtauld)."),
    # ---- A4 civic ----
    E("ROM Identification Clinic","2026-09-15",None,"Royal Ontario Museum","gathering","https://www.rom.on.ca/whats-on",None,"Bring an object for ROM experts to identify; free with RSVP."),
    E("ROM Identification Clinic","2026-11-17",None,"Royal Ontario Museum","gathering","https://www.rom.on.ca/whats-on",None,"Free with RSVP."),
    E("ROM Identification Clinic","2027-02-16",None,"Royal Ontario Museum","gathering","https://www.rom.on.ca/whats-on",None,"Free with RSVP."),
    E("AGO Annual General Meeting","2026-06-24",None,"Art Gallery of Ontario","gathering","https://ago.ca/about",None,""),
    # ---- A6 CFP (date = submission deadline) ----
    E("CFP: International Association for Philosophy of Time (Eastern APA 2027)","2026-07-03",None,"Submission deadline (conference: Boston, Jan 13\u201316 2027)","cfp","https://www.philtimesociety.com/calls-for-papers/",None,"Abstract deadline for the IAPT session at the 2027 Eastern APA."),
    E("CFP: Athens Institute 22nd International Conference on Philosophy","2026-10-27",None,"Submission deadline (conference: Athens, May 24\u201329 2027)","cfp","https://www.atiner.gr/philosophy",None,"Abstract submission deadline."),
    # ---- A8 film ----
    E("51st Toronto International Film Festival (TIFF 2026)","2026-09-10","2026-09-20","TIFF Lightbox and downtown Toronto venues","screening","https://www.tiff.net/about-the-festival",None,"Full public schedule released Aug 11; new TIFF: The Market at the Metro Toronto Convention Centre."),
    # ---- B1 Mirvish ----
    E("Hell's Kitchen","2026-09-23","2026-10-25","CAA Ed Mirvish Theatre","performance","https://www.mirvish.com/whats-on/upcoming-shows",None,"Mirvish 2026/27 season."),
    E("The Karate Kid \u2013 The Musical","2026-09-29","2026-11-01","Princess of Wales Theatre","performance","https://www.mirvish.com/whats-on/upcoming-shows",None,"Mirvish 2026/27 season."),
    E("Ron James: The View From Here","2026-10-15","2026-10-17","CAA Theatre","performance","https://www.mirvish.com/whats-on/upcoming-shows",None,""),
    E("13 Going on 30: The Musical","2026-11-24","2027-01-03","CAA Ed Mirvish Theatre","performance","https://www.mirvish.com/whats-on/upcoming-shows",None,"Mirvish 2026/27 season."),
    # ---- B1 COC ----
    E("La Traviata (Verdi)","2026-09-18","2026-10-17","Four Seasons Centre for the Performing Arts","performance","https://www.coc.ca/tickets/2627-season",None,"Canadian Opera Company 2026/27 season."),
    E("Cos\u00ec fan tutte (Mozart)","2026-10-03","2026-10-18","Four Seasons Centre for the Performing Arts","performance","https://www.coc.ca/tickets/2627-season",None,"Canadian Opera Company 2026/27 season."),
    E("COC Centre Stage: Ensemble Studio Competition & Gala","2026-10-22",None,"Four Seasons Centre for the Performing Arts","performance","https://www.coc.ca/tickets/2627-season",None,""),
    E("The Turn of the Screw (Britten)","2027-01-23","2027-02-17","Four Seasons Centre for the Performing Arts","performance","https://www.coc.ca/tickets/2627-season",None,"Canadian Opera Company 2026/27 season."),
    E("Ariadne auf Naxos (R. Strauss)","2027-02-04","2027-02-20","Four Seasons Centre for the Performing Arts","performance","https://www.coc.ca/tickets/2627-season",None,"Canadian Opera Company 2026/27 season."),
    E("Empire of Wild (world premiere)","2027-05-01","2027-05-21","Four Seasons Centre for the Performing Arts","performance","https://www.coc.ca/tickets/2627-season",None,"COC world premiere."),
    E("The Elixir of Love (Donizetti)","2027-05-08","2027-05-29","Four Seasons Centre for the Performing Arts","performance","https://www.coc.ca/tickets/2627-season",None,"Canadian Opera Company 2026/27 season."),
    # ---- B1 National Ballet ----
    E("Romeo and Juliet (Cranko / Prokofiev)","2026-10-31","2026-11-08","Four Seasons Centre for the Performing Arts","performance","https://national.ballet.ca/performances/202627-season/",None,"Opens the National Ballet's 75th-anniversary season; free Share the Magic matinee on opening day."),
    E("Emergence & Silent Screen","2026-11-13","2026-11-20","Four Seasons Centre for the Performing Arts","performance","https://national.ballet.ca/performances/202627-season/",None,"Pite; Le\u00f3n/Lightfoot."),
    E("The Nutcracker (Kudelka)","2026-12-05","2026-12-31","Four Seasons Centre for the Performing Arts","performance","https://national.ballet.ca/performances/202627-season/",None,"National Ballet of Canada."),
    # ---- B1 TSO ----
    E("Yuja Wang Plays Prokofiev","2026-09-24","2026-09-27","Roy Thomson Hall","performance","https://www.tso.ca/concerts-and-events/202627-subscriptions/explore-the-202627-season",None,"Toronto Symphony Orchestra 2026/27."),
    E("Petrushka & Passions of Spain","2026-10-01","2026-10-03","Roy Thomson Hall","performance","https://www.tso.ca/concerts-and-events/202627-subscriptions/explore-the-202627-season",None,"TSO."),
    E("Beethoven's Fifth (Angela Hewitt)","2026-10-08","2026-10-10","Roy Thomson Hall","performance","https://www.tso.ca/concerts-and-events/202627-subscriptions/explore-the-202627-season",None,"TSO."),
    E("The Nightmare Before Christmas in Concert","2026-10-17","2026-10-18","Roy Thomson Hall","performance","https://www.tso.ca/concerts-and-events/202627-subscriptions/explore-the-202627-season",None,"TSO film-in-concert."),
    E("TSO Young People's Concert","2026-11-01",None,"Roy Thomson Hall","performance","https://www.tso.ca/concerts-and-events/202627-subscriptions/explore-the-202627-season",None,""),
    E("Elf in Concert","2026-12-03","2026-12-06","Roy Thomson Hall","performance","https://www.tso.ca/concerts-and-events/202627-subscriptions/explore-the-202627-season",None,"TSO film-in-concert."),
    E("Handel's Messiah (Toronto Mendelssohn Choir)","2026-12-15","2026-12-20","Roy Thomson Hall","performance","https://www.tso.ca/concerts-and-events/202627-subscriptions/explore-the-202627-season",None,"TSO with the Toronto Mendelssohn Choir."),
    # ---- B1 Soulpepper ----
    E("The Secret Chord: A Leonard Cohen Experience","2026-07-08","2026-08-09","Young Centre for the Performing Arts","performance","https://www.soulpepper.ca/performances",None,"Soulpepper 2026/27."),
    E("Spring Awakening","2026-09-10","2026-10-04","Young Centre for the Performing Arts","performance","https://www.soulpepper.ca/performances",None,"Soulpepper 2026/27."),
    E("Soulpepper Fringe Encore Series","2026-09-26","2026-10-11","Young Centre for the Performing Arts","performance","https://www.soulpepper.ca/performances",None,""),
    E("De Profundis: Oscar Wilde in Jail","2026-11-03","2026-11-29","Young Centre for the Performing Arts","performance","https://www.soulpepper.ca/performances",None,"Soulpepper 2026/27."),
    E("Parfumerie","2026-11-18","2026-12-20","Young Centre for the Performing Arts","performance","https://www.soulpepper.ca/performances",None,"Soulpepper 2026/27."),
    E("All's Well","2026-11-24","2026-12-27","Young Centre for the Performing Arts","performance","https://www.soulpepper.ca/performances",None,"Soulpepper 2026/27."),
    E("The Thrill of Hope: A Holiday Concert","2026-12-15","2027-01-03","Young Centre for the Performing Arts","performance","https://www.soulpepper.ca/performances",None,"Soulpepper holiday concert."),
    # ---- B1 Canadian Stage ----
    E("Twelfth Night (Dream in High Park)","2026-07-12","2026-09-06","High Park Amphitheatre","performance","https://www.canadianstage.com/shows-events/26.27-season",None,"Canadian Stage Dream in High Park."),
    E("Wine in the Wilderness (Childress)","2026-09-19","2026-10-04","Canadian Stage (Berkeley Street Theatre)","performance","https://www.canadianstage.com/shows-events/26.27-season",None,"Canadian Stage 2026/27."),
    E("Goodnight Desdemona (Good Morning Juliet)","2026-11-06","2026-11-22","Canadian Stage (Bluma Appel Theatre)","performance","https://www.canadianstage.com/shows-events/26.27-season",None,"Ann-Marie MacDonald; Canadian Stage 2026/27."),
    E("Rogers v. Rogers (Healey)","2026-11-08","2026-12-06","Crow's Theatre","performance","https://www.canadianstage.com/shows-events/26.27-season",None,"Canadian Stage / Crow's Theatre co-production."),
    E("Cinderella (holiday panto)","2026-12-05","2027-01-03","Winter Garden Theatre","performance","https://www.canadianstage.com/shows-events/26.27-season",None,"Canadian Stage holiday pantomime."),
    # ---- B1 Aga Khan performing ----
    E("Duende International Flamenco Festival: Flamenco and the World","2026-11-19","2026-11-22","Aga Khan Museum","performance","https://agakhanmuseum.org/whats-on/",None,""),
    # ---- B2 heritage ----
    E("Toronto Caribbean Carnival (Caribana) \u2014 Grand Parade","2026-08-01",None,"Exhibition Place / Lake Shore Blvd, Toronto","cultural-reproduction","https://torontocarnival.ca/events/",None,"Grand Parade; festival season runs June 13\u2013Aug 2. Official source torontocarnival.ca (not the caribanatoronto.com reseller)."),
    E("Nuit Blanche Toronto 2026","2026-10-03","2026-10-04","City-wide, Toronto","festival","https://www.toronto.ca/explore-enjoy/festivals-events/nuitblanche/",None,"20th anniversary, 'Tomorrow's Memories'; 7 p.m. Oct 3 to 7 a.m. Oct 4; free; produced by the City of Toronto."),
    # ---- B3 AGO ----
    E("The Impressionist Revolution: Monet to Matisse","2026-07-07","2026-10-18","Art Gallery of Ontario","exhibition","https://ago.ca/exhibitions",None,"Members preview June 24; public July 7. 50 works organized by the Dallas Museum of Art; Canadian debut."),
    E("Diego Marcon","2026-06-05","2026-10-04","Art Gallery of Ontario","exhibition","https://ago.ca/exhibitions",None,""),
    E("In Plain Sight: Historic Picture Frames","2026-10-17",None,"Art Gallery of Ontario","exhibition","https://ago.ca/exhibitions",None,""),
    E("AGO Art Bash","2026-09-24",None,"Art Gallery of Ontario","celebration","https://ago.ca/exhibitions",None,"8 p.m.\u20131 a.m. fundraiser."),
    # ---- B3 ROM ----
    E("Bees: A Story of Survival","2026-05-16","2026-10-18","Royal Ontario Museum","exhibition","https://www.rom.on.ca/whats-on/exhibitions",None,""),
    E("Wildlife Photographer of the Year","2026-11-21","2027-04-04","Royal Ontario Museum","exhibition","https://www.rom.on.ca/whats-on/exhibitions",None,""),
    E("Raptors","2026-12-19","2027-09-06","Royal Ontario Museum","exhibition","https://www.rom.on.ca/whats-on/exhibitions",None,""),
    # ---- B3 Aga Khan ----
    E("Hayv Kahraman: Nabog","2026-03-10","2027-02-28","Aga Khan Museum","exhibition","https://agakhanmuseum.org/whats-on/",None,""),
    # ---- GTA suburbs ----
    E("Mississauga Latin Festival","2026-08-07","2026-08-09","Celebration Square, Mississauga","cultural-reproduction","https://www.mississaugalatinfestival.com/en/",None,""),
    E("Mississauga ItalFest","2026-08-21","2026-08-22","Mississauga","cultural-reproduction","https://www.visitmississauga.ca/summer-festivals-2026/",None,""),
    E("MuslimFest (Mississauga)","2026-08-29","2026-08-31","Mississauga","cultural-reproduction","https://www.visitmississauga.ca/summer-festivals-2026/",None,""),
    E("Philippine Festival Mississauga","2026-09-11","2026-09-13","Mississauga","cultural-reproduction","https://www.visitmississauga.ca/summer-festivals-2026/",None,""),
]

# ---------- dedup helpers ----------
STOP = {'the','a','an','of','and','&','in','on','at','to','for','with','de','la','le'}
def norm_tokens(t):
    t = t.lower()
    t = re.sub(r'\b(19|20)\d{2}\b', ' ', t)      # strip standalone years
    t = re.sub(r'[^a-z0-9 ]', ' ', t)
    return [w for w in t.split() if w and w not in STOP]
def ystrip_key(t):
    return ' '.join(norm_tokens(t))
def jaccard(a, b):
    sa, sb = set(a), set(b)
    if not sa or not sb: return 0.0
    return len(sa & sb) / len(sa | sb)
def datepart(e):
    return (e.get('date') or '')[:10]
def fieldscore(e):
    return sum(1 for k in ('speaker_or_director','venue','source_url','description','end_date') if e.get(k))

def slug(title, start):
    s = re.sub(r'[^a-z0-9]+', '-', title.lower()).strip('-')[:60].strip('-')
    return f"{s}-{start}"

# ---------- load ----------
doc = json.load(open(SRC, encoding='utf-8'))
existing = doc['events']
for i, e in enumerate(existing):
    e['_origin'] = 'existing'; e['_order'] = i
for j, e in enumerate(NEW):
    e['_origin'] = 'new'; e['_order'] = 100000 + j

combined = existing + NEW
n = len(combined)
keys = [ystrip_key(e['title']) for e in combined]
toks = [norm_tokens(e['title']) for e in combined]
dts = [datepart(e) for e in combined]
ends = [ (e.get('end_date') or e.get('date') or '')[:10] for e in combined ]
def overlap(i, k):
    si, ei = dts[i], ends[i]; sk, ek = dts[k], ends[k]
    if not si or not sk: return False
    return si <= ek and sk <= ei

# union-find clustering
parent = list(range(n))
def find(x):
    while parent[x] != x:
        parent[x] = parent[parent[x]]; x = parent[x]
    return x
def union(a, b):
    ra, rb = find(a), find(b)
    if ra != rb: parent[rb] = ra

for i in range(n):
    for k in range(i+1, n):
        same = False
        if keys[i] and keys[i] == keys[k] and (dts[i] == dts[k] or overlap(i, k)):
            same = True
        elif dts[i] and dts[i] == dts[k] and jaccard(toks[i], toks[k]) >= 0.5 and len(set(toks[i]) & set(toks[k])) >= 3:
            same = True
        if same:
            union(i, k)

clusters = {}
for i in range(n):
    clusters.setdefault(find(i), []).append(i)

survivors = []
drops = []   # (dropped_title, dropped_origin, kept_title)
for members in clusters.values():
    if len(members) == 1:
        survivors.append(combined[members[0]]); continue
    # pick survivor: max fieldscore, then existing over new, then earliest order
    def rank(i):
        e = combined[i]
        return (fieldscore(e), 1 if e['_origin'] == 'existing' else 0, -e['_order'])
    members_sorted = sorted(members, key=rank, reverse=True)
    keep_i = members_sorted[0]
    keep = combined[keep_i]
    # backfill missing fields from mates
    for mi in members_sorted[1:]:
        m = combined[mi]
        for f in ('speaker_or_director','venue','source_url','description','end_date','age_band'):
            if not keep.get(f) and m.get(f):
                keep[f] = m[f]
        drops.append((m['title'], m['origin'] if 'origin' in m else m['_origin'], keep['title']))
    survivors.append(keep)

# assign ids to new survivors lacking one; ensure unique
used_ids = set(e.get('id') for e in survivors if e.get('id'))
for e in survivors:
    if not e.get('id'):
        base = slug(e['title'], datepart(e)); cand = base; c = 2
        while cand in used_ids:
            cand = f"{base}-{c}"; c += 1
        e['id'] = cand; used_ids.add(cand)

# strip temp fields, sort by date
for e in survivors:
    e.pop('_origin', None); e.pop('_order', None)
survivors.sort(key=lambda e: e.get('date') or '')

# ---------- validation ----------
problems = []
VALID_TYPES = {'lecture','talk','book-talk','scholar-talk','artist-talk','conference','symposium','colloquium','forum','workshop','webinar','meeting','retreat','reading','book-launch','residency','festival','festival-of-form','cultural-reproduction','exhibition','site-specific-art','performance','screening','cfp','contest','defence','gathering','memorial','celebration','networking','panel','protest','demonstration','march','rally','picket','vigil','sit-in','walkout'}
for e in survivors:
    if not e.get('source_url'): problems.append(('no source_url', e['title']))
    if e.get('type') not in VALID_TYPES: problems.append(('bad type:'+str(e.get('type')), e['title']))
    try:
        datetime.datetime.fromisoformat(e['date'])
    except Exception:
        problems.append(('bad date', e['title']))

doc['events'] = survivors
doc['count'] = len(survivors)
doc['_total_events'] = len(survivors)
doc['_generated_at'] = datetime.datetime.now().isoformat()

# atomic write
fd, tmp = tempfile.mkstemp(dir='.', suffix='.json')
with os.fdopen(fd, 'w', encoding='utf-8') as f:
    json.dump(doc, f, ensure_ascii=False, indent=1)
os.replace(tmp, SRC)

# ---------- report ----------
print('=== MERGE REPORT ===')
print('existing:', len(existing), ' candidates:', len(NEW), ' -> survivors:', len(survivors))
print('clusters with drops:', len(drops))
print('\n-- dropped as duplicate (kept -> dropped) --')
for dt, origin, kept in sorted(drops, key=lambda x: x[2]):
    print(f"   [{origin}] '{dt[:55]}'  ==dup-of==>  '{kept[:55]}'")
print('\n-- validation problems --')
print('   none' if not problems else '')
for p in problems: print('  ', p)
from collections import Counter
tally = Counter(e['type'] for e in survivors)
print('\n-- type tally --')
for t, c in sorted(tally.items(), key=lambda x: -x[1]): print(f"   {t}: {c}")
print('\n-- forward distribution (start-month, from corpus source only) --')
newcount = sum(1 for e in survivors if e.get('source_id') == 'corpus-2026-06-09')
print('   events tagged corpus-2026-06-09 now live:', newcount)
