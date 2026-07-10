from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
BB_HTML=ROOT/'polymyth/bookwormburrows/index.html'
SITEMAP=ROOT/'sitemap.xml'
NETLIFY=ROOT/'netlify.toml'
LLMS=ROOT/'llms.txt'
CL=ROOT/'BB_CL_2026-07-10.md'

seed=BB_HTML.read_text(encoding='utf-8')
if "id:'bbt-008'" not in seed and 'id:`bbt-008`' not in seed:
    marker='  {id:`bbt-000`'
    idx=seed.find(marker)
    if idx<0: raise RuntimeError('bbt-000 marker missing')
    entry="""  {id:'bbt-008',bb_links:['bbt-000','bbt-001','bbt-002','bbt-003','bbt-004','bbt-005','bbt-006','bbt-007','char-008','dm-117','dm-119'],s:'bbt',r:'both',t:'BBT public synthesis and current status: research assembled, therapeutic system unbuilt',b:`CURRENT SYNTHESIS 2026-07-10. BBT is the planned therapy branch of BookwormBurrows. It has not been built, tested, released, or offered as therapy. The current research substrate brings together therapeutically applied tabletop role-playing, bibliotherapy, psychodrama and drama therapy, transformative and freeform role-play, bleed, dual consciousness, identity, group process, agency, social connection, affective modifiers, and BB's human-plus-AI Dimensional Master. BBT would inherit wormcards, text-worlds, Rainbow Magic, Narrative Priority, contextual emotional and personality modifiers, and complete CC* continuity. A qualified human practitioner would hold therapeutic purpose, attunement, reflection, scope, and professional judgment. AI would support preparation, scene generation, continuity, comparison, and narration under human control; AI is never the therapist. PLAYER-FACING SYNTHESIS. The story remains the living surface. Anxiety, pride, grief, anger, trust, curiosity, exhaustion, hope, fear, complexes, archetypal forces, and other established dynamics may help, hinder, redirect, or transform action without becoming automatic diagnoses of the player. PRACTICE DIFFERENCE. BB is a voluntary educational, literary, social, and creative game. BBT would be an actual therapeutic practice using the BB engine, with qualified facilitation, explicit therapeutic purpose, private practitioner records separated from player-facing campaign memory, narrative departure and re-entry, debriefing and bleed work, scope and referral boundaries, evidence labels, training, pilots, and evaluation. EVIDENCE CEILING. The captured research justifies cautious design and testing. It remains young and heavily composed of reviews, qualitative studies, small pilots, case reports, dissertations, and practitioner literature. BBT must not be described as clinically proven or available until the system and evidence exist. PUBLIC ROUTE. The full accessible synthesis lives at /bb/bbt/.`,x:'Public synthesis created from bbt-000 through bbt-007 and the July 2026 BB mechanics and voluntary-first rulings. The detailed source shelf remains polymyth/bookwormburrows-bbt-therapy-bibliography-2026-07-09.md.',tg:'bbt, upcoming, therapy-branch, research-synthesis, therapeutic-ttrpg, bibliotherapy, psychodrama, drama-therapy, bleed, dual-consciousness, affective-modifiers, human-ai-dm, evidence-ceiling, unbuilt, public-route, 2026-07-10'},
"""
    seed=seed[:idx]+entry+seed[idx:]
    BB_HTML.write_text(seed,encoding='utf-8')

sitemap=SITEMAP.read_text(encoding='utf-8')
if 'https://seminarschools.com/bb/bbt/' not in sitemap:
    line='  <url><loc>https://seminarschools.com/bb/bbt/</loc><lastmod>2026-07-10</lastmod></url>\n'
    anchor='  <url><loc>https://seminarschools.com/bb/why/</loc>'
    pos=sitemap.find(anchor)
    sitemap=sitemap[:pos]+line+sitemap[pos:] if pos>=0 else sitemap.replace('</urlset>',line+'</urlset>')
    SITEMAP.write_text(sitemap,encoding='utf-8')

netlify=NETLIFY.read_text(encoding='utf-8')
if 'from = "/bb/bbt"' not in netlify:
    block='\n[[redirects]]\n  from = "/bb/bbt"\n  to = "/bb/bbt/"\n  status = 301\n  force = true\n'
    anchor='[[redirects]]\n  from = "/bb/why"'
    pos=netlify.find(anchor)
    netlify=netlify[:pos]+block+'\n'+netlify[pos:] if pos>=0 else netlify+block
    NETLIFY.write_text(netlify,encoding='utf-8')

llms=LLMS.read_text(encoding='utf-8')
if 'https://seminarschools.com/bb/bbt/' not in llms:
    anchor='- [Why tabletop role-playing belongs in education](https://seminarschools.com/bb/why/): research-grounded pedagogical case.\n'
    if anchor not in llms: raise RuntimeError('llms anchor missing')
    llms=llms.replace(anchor,anchor+'- [BBT · BookwormBurrows Therapy](https://seminarschools.com/bb/bbt/): upcoming therapy-branch research synthesis; research assembled, system unbuilt.\n',1)
    LLMS.write_text(llms,encoding='utf-8')

cl=CL.read_text(encoding='utf-8')
old='- [OPEN] Classroom consent, safety, and minor-supervision reconciliation: replace attendance-as-consent, reconcile parent or guardian presence with teacher-led classroom play, and define advance framing, alternative participation, rainbow-note, narrative-exit, privacy, withdrawal, and teacher responsibility.\n'
new='''- [OPEN] Voluntary-first narrative transmutation: propagate BB's primary voluntary-seminar identity and translate compulsory-setting demands into world logic, including narrative departure, role shifting, rainbowworld return, later re-entry, private communication, and alternate in-game participation while keeping institutional records backstage.\n- [OPEN] Player-facing anti-gorgonification audit: remove visible participation management, assessment bureaucracy, curriculum bureaucracy, supervision bureaucracy, and administrative classification from the player surface; preserve their necessary backstage functions through the teacher, AI, CC*, and mc*.\n- [OPEN] Separate BBT practice architecture: build the qualified-practitioner, therapeutic-goal, private-record, debriefing, bleed-processing, scope, referral, training, pilot, evidence-label, and evaluation layer required for a real therapy branch. The public research synthesis now exists at `/bb/bbt/`; the therapeutic system remains unbuilt.\n'''
if old in cl: cl=cl.replace(old,new,1)
if '[CLOSED] BBT public research synthesis' not in cl:
    cl=cl.replace('## Remaining CL\n','## Remaining CL\n\n- [CLOSED] BBT public research synthesis and status page: `/bb/bbt/` now explains the complete research synthesis, its relationship to BB, the affective-modifier direction, the evidence ceiling, and the build requirements while clearly marking BBT as upcoming and unbuilt.\n',1)
CL.write_text(cl,encoding='utf-8')
print('Finished canonical BBT propagation.')
