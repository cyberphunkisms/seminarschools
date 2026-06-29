#!/usr/bin/env python3
"""Add verified Canadian-eligible grades 1-12 writing contests to polymythcalendar."""
import json
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
EVENTS = ROOT / 'polymythseminars' / 'events.json'
SOURCES = ROOT / 'scripts' / 'sources.json'
STAMP = '2026-06-28T16:55:00-04:00'
SOURCE_ID = 'youth-writing-competitions-2026-06-28'

# Dates after 2026-06-28 are used so the calendar remains practically useful.
# When an official 2026 deadline has passed, the next annual cycle is explicitly
# marked as projected in the description and kept noindex by the existing builder.
CONTESTS = [
    {
        'id': 'meaning-of-home-student-contest-2027',
        'title': 'Meaning of Home Student Contest',
        'date': '2027-02-20T23:59:00-05:00',
        'organizer': 'Habitat for Humanity Canada',
        'venue': 'Canada-wide online, grades 4 to 6',
        'age_band': 'Grades 4-6; Canadian residents in Canada',
        'source_url': 'https://www.meaningofhome.ca/',
        'description': 'Deadline projected from the latest verified January to February cycle. Students in grades 4 to 6 submit a 50 to 300 word composition, essay, or poem on what home means to them. Free, English or French, with Habitat for Humanity Canada grants tied to winning entries. Confirm the next cycle on the official site.'
    },
    {
        'id': 'kids-write-4-kids-2027',
        'title': 'Kids Write 4 Kids',
        'date': '2027-03-31T23:59:00-04:00',
        'organizer': 'Ripple Foundation',
        'venue': 'Canada-wide online, grades 4 to 8',
        'age_band': 'Grades 4-8; Canadian residents enrolled full-time in school or homeschool',
        'source_url': 'https://kidswrite4kids.ripplefoundation.ca/',
        'description': 'Annual deadline projected from the official October 1 to March 31 cycle. Canadian students in grades 4 to 8 submit original fact, fiction, prose, or poetry up to 5,000 words. Free. Winners become published authors and donate book-sale proceeds to a Canadian charity. Confirm the next cycle on the official site.'
    },
    {
        'id': 'royal-canadian-legion-literary-contest-2026',
        'title': 'Royal Canadian Legion Literary Contest',
        'date': '2026-11-01T23:59:00-04:00',
        'organizer': 'The Royal Canadian Legion and Legion National Foundation',
        'venue': 'Canada-wide via local Legion branches, grades 4 to 12',
        'age_band': 'Junior grades 4-6; intermediate grades 7-9; senior grades 10-12',
        'source_url': 'https://www.remembrancecontests.ca/',
        'description': 'Local branch deadlines vary, so this placeholder marks the annual Remembrance contest window. Students submit an original essay or poem on Remembrance in English, French, or bilingual format. Junior essays are up to 350 words, intermediate up to 500 words, senior up to 800 words, and poems are up to 32 lines. Confirm the local branch deadline.'
    },
    {
        'id': 'yabs-young-writers-award-2027',
        'title': 'YABS Young Writers Award',
        'date': '2027-03-31T23:59:00-04:00',
        'organizer': 'Young Alberta Book Society',
        'venue': 'Alberta province-wide, grades 4 to 9',
        'age_band': 'Grades 4-9; Alberta students and homeschoolers',
        'source_url': 'https://www.yabs.ab.ca/ywa/',
        'description': 'Annual deadline projected from the official December 1 to March 31 window. Alberta students in grades 4 to 9 submit an original short story up to 2,500 words. Free. Winners receive books, certificates, and an online writing workshop with a published author. Confirm the next cycle on the official site.'
    },
    {
        'id': 'oecta-young-authors-awards-2027',
        'title': 'OECTA Young Authors Awards',
        'date': '2027-02-13T23:59:00-05:00',
        'organizer': 'Ontario English Catholic Teachers\' Association',
        'venue': 'Ontario Catholic-school pathway, JK to grade 12',
        'age_band': 'JK-Grade 12; Ontario Catholic-school structure',
        'source_url': 'https://www.catholicteachers.ca/For-Your-Benefit/Awards/Young-Authors-Awards',
        'description': 'School-level deadline projected from the latest verified February cycle. Students enter short story, poem, nonfiction, and, from grades 5 to 12, play categories. English and French tracks. Provincial entries receive certificates and winners are published in an annual anthology. Confirm school, unit, and provincial dates with OECTA.'
    },
    {
        'id': 'cnib-braille-creative-writing-contest-2027',
        'title': 'CNIB Braille Creative Writing Contest',
        'date': '2027-05-31T23:59:00-04:00',
        'organizer': 'CNIB',
        'venue': 'Canada-wide, K to grade 12, braille submissions',
        'age_band': 'K-Grade 12; students who are blind, Deafblind, or have low vision',
        'source_url': 'https://www.cnib.ca/en/about-contest',
        'description': 'Deadline projected from the official March 1 to May 31 annual window. Students submit a braille short story, essay, or poem in English or French on any topic, up to 4,000 words. Free. Cash prizes are awarded in category groups. Confirm the next cycle on the official site.'
    },
    {
        'id': 'vancouver-writers-fest-youth-writing-contest-2027',
        'title': 'Vancouver Writers Fest Youth Writing Contest',
        'date': '2027-04-01T00:00:00-04:00',
        'organizer': 'Vancouver Writers Fest',
        'venue': 'British Columbia province-wide, grades 5 to 12',
        'age_band': 'Grades 5-7 and 8-12; BC school or homeschool students',
        'source_url': 'https://writersfest.bc.ca/youth/youth-writing-contest',
        'description': 'Opening date placeholder for the next spring cycle. BC students submit previously unpublished short stories or personal essays. Elementary submissions are up to 1,000 words and high-school submissions up to 1,500 words. Winners receive cash prizes, certificates, and newsletter publication. Confirm the spring 2027 opening date on the official site.'
    },
    {
        'id': 'jessamy-stursberg-poetry-prize-youth-2027',
        'title': 'Jessamy Stursberg Poetry Prize for Canadian Youth',
        'date': '2027-04-30T23:59:00-04:00',
        'organizer': 'League of Canadian Poets',
        'venue': 'Canada-wide poetry prize, grades 7 to 12',
        'age_band': 'Junior grades 7-9; senior grades 10-12; Canadian citizens or permanent residents',
        'source_url': 'https://poets.ca/offerings/awards/',
        'description': 'Deadline approximate. Submissions open annually in September. Canadian youth poets submit one poem of up to one page. Cash prizes are awarded in junior and senior categories. Confirm the active deadline on the League of Canadian Poets site.'
    },
    {
        'id': 'queen-s-commonwealth-writing-competition-2027',
        'title': "Queen's Commonwealth Writing Competition",
        'date': '2027-04-30T23:59:00-04:00',
        'organizer': 'Royal Commonwealth Society',
        'venue': 'International Commonwealth contest, Canadians eligible, 18 and under',
        'age_band': '18 and under; Commonwealth nationals or residents, including Canadians',
        'source_url': 'https://www.royalcwsociety.org/writing-competition/qcwc2026',
        'description': 'Deadline projected from the annual April 30 cycle. Entrants write one piece of up to 1,000 words responding to an official prompt, with forms including poem, letter, article, story, essay, or short script. Free. Certificates are issued and regional winners may be invited to London. Confirm the next cycle on the official site.'
    },
    {
        'id': 'french-for-the-future-national-essay-contest-2026',
        'title': 'French for the Future National Essay Contest',
        'date': '2026-12-19T23:59:00-05:00',
        'organizer': 'French for the Future',
        'venue': 'Canada-wide French essay scholarship contest, grades 10 to 12',
        'age_band': 'Grades 10-12; Secondary IV-V or CEGEP in Quebec; legal residents of Canada',
        'source_url': 'https://french-future.org/programs/essay-contest/',
        'description': 'Deadline projected from the latest verified October to December cycle. Students write a 750 word essay in French in French-as-a-first-language or French-as-a-second-language categories. Free. Scholarship prizes support postsecondary study in French. Confirm the active cycle on the official site.'
    },
    {
        'id': 'aristotle-contest-high-school-philosophy-2026',
        'title': 'The Aristotle Contest',
        'date': '2026-07-15T23:59:00-04:00',
        'organizer': 'Department of Philosophy, University of Toronto, with the Ontario Philosophy Teachers\' Association',
        'venue': 'Canada-wide high-school philosophy essay contest',
        'age_band': 'Canadian high-school students at or below grade 12; homeschoolers eligible',
        'source_url': 'https://philosophy.utoronto.ca/the-aristotle-a-high-school-philosophy-essay-contest/',
        'description': 'Verified 2026 deadline. Canadian high-school students submit one philosophy essay of up to 1,200 words on one of the official questions. English and French submissions are welcome. Cash prizes are awarded for first, second, and third place, with honourable mentions.'
    },
    {
        'id': 'fraser-institute-student-essay-contest-2027',
        'title': 'Fraser Institute Student Essay Contest',
        'date': '2027-06-08T23:59:00-04:00',
        'organizer': 'Fraser Institute',
        'venue': 'Canada-wide and Canadian students abroad, high school division',
        'age_band': 'High-school students; Canadian students abroad and international students in Canada eligible',
        'source_url': 'https://www.fraserinstitute.org/education-programs/student-essay-contest',
        'description': 'Deadline projected from the latest verified June cycle. High-school students submit a 1,000 to 1,500 word essay with references on public policy and economics. Cash prizes are awarded in the high-school division. Confirm the 2027 contest opening and deadline on the official site.'
    },
    {
        'id': 'canadian-nuclear-society-essay-contest-2027',
        'title': 'Canadian Nuclear Society Essay Contest',
        'date': '2027-03-13T23:59:00-04:00',
        'organizer': 'Canadian Nuclear Society',
        'venue': 'Canada-wide STEM communication essay contest, grades 9 to 12',
        'age_band': 'Grades 9-12; Quebec Secondary III-V',
        'source_url': 'https://www.cns-snc.ca/news/canadian-nuclear-society-2026-essay-contest/',
        'description': 'Deadline projected from the latest verified March cycle. Canadian students in grades 9 to 12, or Quebec Secondary III to V, submit an original essay of 1,000 words or less in English or French. Cash prizes are awarded. Confirm the next cycle on the official site.'
    },
    {
        'id': 'diverse-minds-manitoba-2027',
        'title': 'Diverse Minds Manitoba',
        'date': '2027-06-10T23:59:00-04:00',
        'organizer': "B'nai Brith Canada",
        'venue': 'Manitoba high-school illustrated children\'s book contest',
        'age_band': 'Manitoba high-school students, grades 9-12',
        'source_url': 'https://bnaibrith.ca/diverseminds/',
        'description': 'Deadline projected from the latest verified June cycle. Manitoba high-school students write and illustrate an original children\'s book for a K to grade 5 audience on diversity and inclusion. Students may work individually or in pairs. Winners receive cash prizes, and the first-place book is published and distributed to libraries. Confirm the next cycle on the official site.'
    },
    {
        'id': 'osstf-student-achievement-awards-2026',
        'title': 'OSSTF Student Achievement Awards',
        'date': '2026-11-19T23:59:00-05:00',
        'organizer': 'Ontario Secondary School Teachers\' Federation',
        'venue': 'Ontario public secondary schools, grades 9 to 12',
        'age_band': 'Ontario public secondary students; grades 9-12 categories',
        'source_url': 'https://www.osstf.on.ca/studentachievementawards',
        'description': 'School-to-district deadline projected from the latest verified November cycle. Ontario public secondary students submit writing, visual art, or digital media on an annual theme. Writing is capped at 750 words, and French and non-credit categories are included. Provincial winners receive cash awards. Confirm the active school and district dates.'
    },
    {
        'id': 'ottawa-public-library-awesome-authors-youth-writing-contest-2027',
        'title': 'Ottawa Public Library Awesome Authors Youth Writing Contest',
        'date': '2027-02-28T23:59:00-05:00',
        'organizer': 'Ottawa Public Library',
        'venue': 'Ottawa regional contest, ages 9 to 18',
        'age_band': 'Ages 9-18; Ottawa Public Library eligibility applies',
        'source_url': 'https://collections.biblioottawalibrary.ca/en/awesome-authors-youth-writing-contest-2026',
        'description': 'Deadline projected from the latest verified February cycle. Ottawa-area youth submit short stories, poems, or comics, with English and French opportunities. Free. This is a regional library contest, so Ottawa eligibility applies. Confirm the next cycle on the Ottawa Public Library site.'
    },
    {
        'id': 'hamilton-public-library-power-of-the-pen-2026',
        'title': 'Hamilton Public Library Power of the Pen',
        'date': '2026-09-30T23:59:00-04:00',
        'organizer': 'Hamilton Public Library',
        'venue': 'Hamilton regional contest, ages 12 to 18',
        'age_band': 'Ages 12-18; Hamilton Public Library eligibility applies',
        'source_url': 'https://teens.hpl.ca/articles/power-pen-creative-writing-contest',
        'description': 'Deadline projected from the annual September window. Hamilton-area youth submit original poetry or short stories in English. Free. This is a regional library contest, so Hamilton eligibility applies. Confirm the active deadline on the Hamilton Public Library teen site.'
    }
]

# Official source roster additions for future scraper/reference maintenance.
SOURCE_ENTRIES = [
    ('meaning-home', 'Meaning of Home Student Contest', 'https://www.meaningofhome.ca/', 'https://www.meaningofhome.ca/page/rules-and-regulations'),
    ('kids-write-4-kids', 'Kids Write 4 Kids', 'https://kidswrite4kids.ripplefoundation.ca/', 'https://kidswrite4kids.ripplefoundation.ca/kids-write-4-kids-contest-rules/'),
    ('legion-remembrance-contests', 'Royal Canadian Legion National Youth Remembrance Contests', 'https://www.remembrancecontests.ca/', 'https://www.remembrancecontests.ca/'),
    ('yabs-young-writers-award', 'YABS Young Writers Award', 'https://www.yabs.ab.ca/ywa/', 'https://www.yabs.ab.ca/ywa/'),
    ('oecta-young-authors', 'OECTA Young Authors Awards', 'https://www.catholicteachers.ca/For-Your-Benefit/Awards/Young-Authors-Awards', 'https://www.catholicteachers.ca/For-Your-Benefit/Awards/Young-Authors-Awards'),
    ('cnib-braille-writing', 'CNIB Braille Creative Writing Contest', 'https://www.cnib.ca/en/about-contest', 'https://www.cnib.ca/en/about-contest'),
    ('vancouver-writers-fest-youth', 'Vancouver Writers Fest Youth Writing Contest', 'https://writersfest.bc.ca/youth/youth-writing-contest', 'https://writersfest.bc.ca/youth/youth-writing-contest'),
    ('jessamy-stursberg-poetry', 'Jessamy Stursberg Poetry Prize for Canadian Youth', 'https://poets.ca/offerings/awards/', 'https://poets.ca/offerings/awards/'),
    ('queens-commonwealth-writing', "Queen's Commonwealth Writing Competition", 'https://www.royalcwsociety.org/writing-competition/qcwc2026', 'https://www.royalcwsociety.org/writing-competition/qcwc2026'),
    ('french-for-future-essay', 'French for the Future National Essay Contest', 'https://french-future.org/programs/essay-contest/', 'https://french-future.org/programs/essay-contest/'),
    ('aristotle-contest-utoronto', 'The Aristotle Contest', 'https://philosophy.utoronto.ca/the-aristotle-a-high-school-philosophy-essay-contest/', 'https://philosophy.utoronto.ca/the-aristotle-a-high-school-philosophy-essay-contest/'),
    ('fraser-student-essay', 'Fraser Institute Student Essay Contest', 'https://www.fraserinstitute.org/education-programs/student-essay-contest', 'https://www.fraserinstitute.org/education-programs/student-essay-contest'),
    ('cns-essay-contest', 'Canadian Nuclear Society Essay Contest', 'https://www.cns-snc.ca/news/canadian-nuclear-society-2026-essay-contest/', 'https://www.cns-snc.ca/news/canadian-nuclear-society-2026-essay-contest/'),
    ('diverse-minds-manitoba', 'Diverse Minds Manitoba', 'https://bnaibrith.ca/diverseminds/', 'https://bnaibrith.ca/diverseminds/'),
    ('osstf-student-achievement', 'OSSTF Student Achievement Awards', 'https://www.osstf.on.ca/studentachievementawards', 'https://www.osstf.on.ca/studentachievementawards'),
    ('opl-awesome-authors', 'Ottawa Public Library Awesome Authors Youth Writing Contest', 'https://collections.biblioottawalibrary.ca/en/awesome-authors-youth-writing-contest-2026', 'https://collections.biblioottawalibrary.ca/en/awesome-authors-youth-writing-contest-2026'),
    ('hpl-power-of-the-pen', 'Hamilton Public Library Power of the Pen', 'https://teens.hpl.ca/articles/power-pen-creative-writing-contest', 'https://teens.hpl.ca/articles/power-pen-creative-writing-contest'),
]

def as_event(c):
    return {
        'date': c['date'],
        'title': c['title'],
        'speaker_or_director': c['organizer'],
        'venue': c['venue'],
        'type': 'contest',
        'source_url': c['source_url'],
        'source_id': SOURCE_ID,
        'description': c['description'],
        'secondary_types': ['writing competition', 'student writing', 'grades 1-12 pathway'],
        'parent_id': None,
        'is_parent_festival': False,
        'end_date': None,
        'age_band': c['age_band'],
        'id': c['id'],
        'attendance_confirmed': True,
        'confidence': 90 if 'projected' not in c['description'].lower() and 'placeholder' not in c['description'].lower() else 82,
        'four_condition_test': {
            'time_place': True,
            'prepared_offering': True,
            'substantive_engagement': True,
            'intellectual_stake': True
        },
        'raw_excerpt': 'Added from deep research review of Canadian-eligible youth writing contests for grades 1-12.',
        'scraped_at': STAMP,
        'review_status': 'manual',
        'marginalia_url': None,
        '_src': 'manual-deep-research'
    }

# Upsert events by id, preserving unrelated entries.
data = json.loads(EVENTS.read_text(encoding='utf-8'))
existing = data.get('events') or []
by_id = {e.get('id'): e for e in existing if e.get('id')}
inserted = []
updated = []
for c in CONTESTS:
    ev = as_event(c)
    if ev['id'] in by_id:
        by_id[ev['id']].update(ev)
        updated.append(ev['id'])
    else:
        existing.append(ev)
        by_id[ev['id']] = ev
        inserted.append(ev['id'])

# Stable sort by date, then title, while preserving all records.
existing.sort(key=lambda e: (str(e.get('date') or ''), str(e.get('title') or '').lower(), str(e.get('id') or '')))
data['events'] = existing
data['_generated_at'] = data.get('_generated_at') or '2026-06-27T00:00:00+00:00'
data['_total_events'] = len(existing)
data['count'] = len(existing)
EVENTS.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

# Add source roster entries without disturbing existing sources.
if SOURCES.exists():
    sources_data = json.loads(SOURCES.read_text(encoding='utf-8'))
    sources = sources_data.setdefault('sources', [])
    ids = {s.get('id') for s in sources}
    for sid, name, base, events_url in SOURCE_ENTRIES:
        if sid not in ids:
            sources.append({
                'id': sid,
                'name': name,
                'tier_priority': 3,
                'default_type': 'contest',
                'base_url': base,
                'events_url': events_url,
                'render_mode': 'static',
                'feed_status': 'manual-deep-research',
                'notes': 'Youth writing competition source added from 2026-06-28 deep research for Canadian-eligible grades 1-12 pathways.'
            })
    sources_data['$updated'] = '2026-06-28'
    sources_data['sources'] = sources
    SOURCES.write_text(json.dumps(sources_data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

print(json.dumps({'inserted': inserted, 'updated': updated, 'total_events': len(existing)}, indent=2))
