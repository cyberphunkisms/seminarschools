from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
BB = ROOT / 'bb/index.html'
WHY = ROOT / 'bb/why/index.html'
BBT = ROOT / 'bb/bbt/index.html'
SITEMAP = ROOT / 'sitemap.xml'
NETLIFY = ROOT / 'netlify.toml'
LLMS = ROOT / 'llms.txt'
BB_HTML = ROOT / 'polymyth/bookwormburrows/index.html'
CL = ROOT / 'BB_CL_2026-07-10.md'


def replace_once(text, old, new, label):
    if old not in text:
        raise RuntimeError(f'missing {label}')
    return text.replace(old, new, 1)

# ------------------------------------------------------------------
# BB landing: voluntary-first, clearer audience, BBT upcoming, cleanup
# ------------------------------------------------------------------
html = BB.read_text(encoding='utf-8')
html = replace_once(html,
    '<title>bookwormburrows | Reading Game for Students and Teachers</title>',
    '<title>bookwormburrows | AI-Assisted Reading and Seminar Game</title>', 'bb title')
html = replace_once(html,
    '<meta name="description" content="bookwormburrows is a teacher-led academic reading game where texts become worlds, wormcards become character sheets, assignments become quests, and student work changes what can happen next.">',
    '<meta name="description" content="bookwormburrows is an AI-assisted reading and seminar game where texts become worlds, wormcards become characters, study becomes adventure, and player work changes what can happen next.">', 'bb description')
html = replace_once(html,
    '<meta property="og:title" content="bookwormburrows · three easy paths in">',
    '<meta property="og:title" content="bookwormburrows · enter a text-world">', 'bb og title')
html = replace_once(html,
    '<meta property="og:description" content="Make a wormcard, give it to the Dimensional Master, or read the school explanation. Student-friendly wording first, teacher notes preserved.">',
    '<meta property="og:description" content="Make a wormcard, enter a text-world, run a seminar adventure, explore the research, and preview the upcoming BBT therapy branch.">', 'bb og description')
html = html.replace('--txt:#e8e2d4;--dim:#8a8275;--fnt:#5a5448;', '--txt:#e8e2d4;--dim:#8a8275;--fnt:#837c70;')
html = html.replace('  --teal:#7b9ea8;--teal2:#a4c2cb;\n', '  --teal:#7b9ea8;--teal2:#a4c2cb;--violet:#b89ad4;--violet2:#d6bce9;\n')
# Remove dead bookmark-notice CSS and JS.
html = re.sub(r'/\* DISMISSABLE OLD-BOOKMARK NOTICE \*/.*?/\* HEADER WITH HEXAGONAL THRESHOLDS MOTIF \*/', '/* HEADER WITH HEXAGONAL THRESHOLDS MOTIF */', html, flags=re.S)
html = re.sub(r'\n<script>\n\(function\(\)\{\n  var KEY=.*?</script>\n', '\n', html, flags=re.S)
html = html.replace('/* TWO-CARD GRID */', '/* ENTRY-PATH GRID */')
html = html.replace('.card.future{opacity:.78}\n.card.future:hover{transform:none}', '.card.future{border-color:rgba(184,154,212,.38);background:linear-gradient(145deg,rgba(184,154,212,.08),var(--bg1) 54%)}\n.card.future:hover{border-color:var(--violet);transform:translateY(-2px)}')
html = html.replace('.session .audience{color:#8fae67}\n', '.session .audience{color:#8fae67}\n.future .audience{color:var(--violet)}\n')
html = html.replace('.session .arrow{color:#8fae67}\n', '.session .arrow{color:#8fae67}\n.future .arrow{color:var(--violet)}\n')
# Add setting block styles after how-play.
needle = '.how-play li strong{color:var(--txt);font-weight:500}\n'
insert = needle + '.where-play{border:1px solid var(--brd);border-left:4px solid var(--teal);padding:18px 22px;margin:16px 0 0;background:rgba(123,158,168,.045)}\n.where-play h2{font-size:22px;font-weight:500;margin-bottom:6px}\n.where-play p{color:var(--dim);font-size:16px;line-height:1.55}\n.status-pill{display:inline-block;font-family:\'JetBrains Mono\',monospace;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:var(--violet2);border:1px solid rgba(184,154,212,.45);padding:4px 8px;margin-bottom:14px}\n'
html = replace_once(html, needle, insert, 'bb styles insert')
html = html.replace('aria-label="Three rainbow doorways into bookwormburrows"', 'aria-label="Rainbow threshold into bookwormburrows"')
html = replace_once(html,
    '<p class="lede">BB is an AI-assisted academic reading game where the teacher and AI form the Dimensional Master, texts become worlds, wormcards become character sheets, assignments become quests, and student work changes what the world remembers.</p>',
    '<p class="lede">BB is an AI-assisted reading and seminar game where a human Dimensional Master and AI work together, texts become worlds, wormcards become characters, study becomes adventure, and player work changes what the world remembers.</p>', 'bb lede')
html = html.replace('while the teacher mediates the table and protects the source.', 'while the human Dimensional Master mediates the table and protects the source.')
html = html.replace('A letter, journal, debate, research note, paragraph, map, scene, or reflection gives the character something to gain, repair, unlock, or risk.', 'A letter, journal, debate, research note, paragraph, map, scene, or reflection gives the character something to gain, repair, unlock, discover, or risk.')
html = html.replace('The table leaves with written work, quests completed, scars, discoveries, open problems, and stronger reasons to keep studying.', 'The group leaves with written work, quests completed, scars, discoveries, open problems, and stronger reasons to keep studying.')
where_block = '''\n<section class="where-play" aria-labelledby="bb-where-title">\n  <h2 id="bb-where-title">Made first for voluntary seminar play</h2>\n  <p>BB is built for reading groups, clubs, tutoring, families, adult seminars, independent learners, and other groups that choose to enter together. Schools can use the same world logic: required work becomes quests, roles, discoveries, and consequences inside the game.</p>\n</section>\n'''
html = replace_once(html, '</section>\n\n<main>', '</section>' + where_block + '\n<main>', 'where block')
html = html.replace('<div class="audience">For students &amp; players</div>', '<div class="audience">For players</div>')
html = html.replace('Bring it into the game when you read.', 'Bring it into the game when your group opens a text-world.')
html = html.replace('aria-label="Open the BookwormBurrows teacher manual workflow"', 'aria-label="Open the BookwormBurrows Dimensional Master workflow"')
html = html.replace('<div class="audience">For the teacher manual</div>', '<div class="audience">For Dimensional Masters</div>')
html = html.replace('The teacher and AI work together as the Dimensional Master,', 'The human guide and AI work together as the Dimensional Master,')
html = html.replace('aria-label="Open the bookwormburrows teacher rule library"', 'aria-label="Open the bookwormburrows Dimensional Master rule library"')
html = html.replace('<div class="audience">For teachers &amp; DMs</div>', '<div class="audience">For DMs, teachers &amp; seminar leaders</div>')
html = html.replace('<h2>Teacher rule library.</h2>', '<h2>Dimensional Master rule library.</h2>')
html = html.replace('school-credit notes', 'learning-credit notes')
html = html.replace('<div class="audience">For parents &amp; schools</div>', '<div class="audience">For players, families &amp; learning groups</div>')
html = html.replace('A clear explanation for parents and schools. It shows how tabletop role-playing can turn reading, writing, research, discussion, and assignments into motivated academic play, with the research essay kept below for adults who want the full case.', 'A clear explanation of how role-playing can turn reading, writing, research, discussion, and assignments into motivated intellectual play, with the full education research essay kept below.')
bbt_card = '''\n\n  <a class="card future wide" href="/bb/bbt/" aria-label="Preview the upcoming BookwormBurrows Therapy research branch">\n    <div class="audience">Upcoming research branch</div>\n    <div class="status-pill">Research assembled · system unbuilt</div>\n    <h2>BBT · BookwormBurrows Therapy.</h2>\n    <p class="blurb">BBT is the planned therapy branch of BB. It will synthesize therapeutic tabletop role-playing, bibliotherapy, psychodrama, transformative role-play, bleed and dual-consciousness research, affective modifiers, and the human-plus-AI Dimensional Master. The research foundation exists. The therapeutic system, practitioner architecture, testing, and evidence remain to be built.</p>\n    <div class="cta">\n      <span class="url">seminarschools.com/bb/bbt/</span>\n      <span class="arrow" aria-hidden="true">→</span>\n    </div>\n  </a>\n'''
html = replace_once(html, '\n</main>', bbt_card + '\n</main>', 'bbt card')
html = html.replace('<a href="/campaigns/">Campaigns</a>', '<a href="/campaigns/">Campaigns</a> &nbsp; <a href="/bb/bbt/">BBT</a>')
BB.write_text(html, encoding='utf-8')

# ------------------------------------------------------------------
# Why page: keep classroom essay, clarify voluntary-first context
# ------------------------------------------------------------------
why = WHY.read_text(encoding='utf-8')
why = why.replace('--txt:#e8e2d4;--dim:#8a8275;--fnt:#5a5448;', '--txt:#e8e2d4;--dim:#8a8275;--fnt:#837c70;')
why = replace_once(why,
    '<p class="subtitle">A student-friendly explanation first, with the full research essay kept for adults and teachers.</p>',
    '<p class="subtitle">A player-friendly explanation first. BB is designed primarily for voluntary seminar play; the full essay studies classroom use as one important application.</p>', 'why subtitle')
why = replace_once(why,
    '<h2>Student version</h2>', '<h2>Player version</h2>', 'why player heading')
why = why.replace('The teacher or DM helps the table stay fair, safe, and connected to the source.', 'The human Dimensional Master and AI keep the world coherent, responsive, and connected to the source.')
why = why.replace('The goal is simple: read more carefully, write with purpose, listen to other people, and discover how a text changes when you step inside it together.', 'The goal is simple: read more carefully, write with purpose, listen to other people, and discover how a text changes when you step inside it together. In schools, required work enters through the same story logic as quests, roles, discoveries, and consequences.')
why = why.replace('<details class="teacher-essay"><summary>Full research essay for adults and teachers</summary>', '<details class="teacher-essay"><summary>Full education research essay</summary>')
WHY.write_text(why, encoding='utf-8')

# ------------------------------------------------------------------
# BBT public research synthesis page
# ------------------------------------------------------------------
BBT.parent.mkdir(parents=True, exist_ok=True)
bbt_html = r'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>BBT · BookwormBurrows Therapy | Upcoming Research Branch</title>
<meta name="description" content="BBT is the upcoming therapy branch of bookwormburrows, synthesizing therapeutic TTRPG research, bibliotherapy, psychodrama, transformative role-play, affective modifiers, and human-guided AI storytelling.">
<meta name="robots" content="index,follow">
<link rel="canonical" href="https://seminarschools.com/bb/bbt/">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/manifest.json">
<meta property="og:title" content="BBT · BookwormBurrows Therapy · upcoming">
<meta property="og:description" content="The research synthesis behind the planned therapy branch of bookwormburrows. Research assembled; playable and clinical system still to be built.">
<meta property="og:type" content="article">
<meta property="og:url" content="https://seminarschools.com/bb/bbt/">
<meta property="og:image" content="https://seminarschools.com/og-image.png">
<meta name="twitter:card" content="summary">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400&amp;family=JetBrains+Mono:wght@400;500&amp;display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#0a0908;--bg1:#131210;--bg2:#1b181d;--brd:#302a32;--brd2:#4a3d50;--txt:#e8e2d4;--dim:#a29a8d;--fnt:#8b8376;--violet:#b89ad4;--violet2:#d9c5e9;--teal:#88aeb8;--gold:#c4a878;--fire:#d97515}
body{background:var(--bg);color:var(--txt);font-family:'EB Garamond',Georgia,serif;font-size:18px;line-height:1.68;min-height:100vh;background-image:radial-gradient(ellipse 70% 50% at 10% 0%,rgba(184,154,212,.08),transparent 62%),radial-gradient(ellipse 70% 55% at 100% 100%,rgba(136,174,184,.055),transparent 62%);background-attachment:fixed}
.wrap{max-width:920px;margin:0 auto;padding:34px 24px 100px}
a{color:var(--violet2);text-decoration:none;border-bottom:1px dotted rgba(217,197,233,.45)}a:hover{color:#fff;border-bottom-style:solid}
.back{display:inline-block;font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.8px;text-transform:uppercase;color:var(--dim);margin-bottom:34px}
.hero{border-bottom:1px solid var(--brd);padding:18px 0 44px;margin-bottom:34px;text-align:center}
.badge{display:inline-block;font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:1.6px;text-transform:uppercase;color:var(--violet2);border:1px solid rgba(184,154,212,.5);padding:6px 10px;margin-bottom:18px;background:rgba(184,154,212,.05)}
h1{font-size:46px;font-weight:500;line-height:1.08;letter-spacing:-.7px;margin-bottom:14px}h1 span{color:var(--violet)}
.lede{max-width:700px;margin:0 auto;color:var(--dim);font-size:20px;font-style:italic;line-height:1.5}
.status{background:linear-gradient(145deg,rgba(184,154,212,.1),rgba(19,18,16,.82));border:1px solid rgba(184,154,212,.45);border-left:5px solid var(--violet);padding:22px 24px;margin:0 0 34px}
.status strong{color:var(--violet2);font-weight:500}.status p{margin:0;color:var(--dim)}
section{margin:44px 0}h2{font-size:30px;font-weight:500;line-height:1.2;margin-bottom:16px}h3{font-size:22px;font-weight:500;margin:24px 0 8px;color:var(--violet2)}
p{margin-bottom:16px}.plain{color:var(--dim)}
.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-top:20px}.panel{background:var(--bg1);border:1px solid var(--brd);padding:20px}.panel h3{margin:0 0 8px;font-size:20px}.panel p{color:var(--dim);font-size:16px;line-height:1.55;margin:0}
.veins{counter-reset:vein;display:grid;gap:14px}.vein{counter-increment:vein;background:rgba(255,255,255,.018);border:1px solid var(--brd);padding:20px 22px 20px 60px;position:relative}.vein:before{content:counter(vein);position:absolute;left:20px;top:18px;font-family:'JetBrains Mono',monospace;color:var(--violet);font-size:13px;border:1px solid var(--brd2);width:26px;height:26px;border-radius:50%;display:grid;place-items:center}.vein h3{margin:0 0 6px;font-size:21px}.vein p{margin:0;color:var(--dim);font-size:16px;line-height:1.58}
.example{background:rgba(136,174,184,.055);border:1px solid rgba(136,174,184,.35);border-left:5px solid var(--teal);padding:24px}.example p:last-child{margin-bottom:0}.scene{font-style:italic;color:var(--txt)}
.compare{display:grid;grid-template-columns:1fr 1fr;gap:18px}.compare article{background:var(--bg1);border:1px solid var(--brd);padding:22px}.compare h3{margin-top:0}.compare ul,.build-list{margin:10px 0 0 1.2rem;color:var(--dim)}.compare li,.build-list li{margin:7px 0;padding-left:4px}
.evidence{border:1px solid rgba(196,168,120,.4);border-left:5px solid var(--gold);padding:24px;background:rgba(196,168,120,.045)}
.references{border-top:1px solid var(--brd);padding-top:30px}.references h2{font-family:'JetBrains Mono',monospace;font-size:12px;text-transform:uppercase;letter-spacing:2px;color:var(--gold)}.ref{font-size:15px;color:var(--dim);line-height:1.58;padding-left:28px;text-indent:-28px;margin-bottom:12px}.ref em{color:var(--txt)}.ref a{word-break:break-all;color:var(--teal)}
footer{border-top:1px solid var(--brd);margin-top:56px;padding-top:22px;font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.8px;text-transform:uppercase;color:var(--fnt);display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap}
@media(max-width:720px){.wrap{padding:26px 16px 70px}h1{font-size:35px}.lede{font-size:18px}.grid,.compare{grid-template-columns:1fr}.vein{padding-left:54px}.status,.example{padding:20px}}
@media print{body{background:#fff;color:#111}.back,.ss-fz,footer{display:none!important}.wrap{max-width:none;padding:1rem}.panel,.vein,.status,.example,.evidence,.compare article{background:#fff;border-color:#aaa}.plain,.panel p,.vein p,.ref,.compare ul,.build-list{color:#333}a{color:#111}}
</style>
<link rel="stylesheet" href="/mobile-slim.css?v=cl93" media="screen and (max-width:640px)">
<link rel="stylesheet" href="/css/alive.css?v=cl93">
<link rel="stylesheet" href="/css/theme.css?v=cl93">
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"ResearchProject","name":"BBT · BookwormBurrows Therapy","url":"https://seminarschools.com/bb/bbt/","description":"Upcoming research branch synthesizing therapeutic tabletop role-playing, bibliotherapy, psychodrama, transformative role-play, affective modifiers, and human-guided AI storytelling.","status":"https://schema.org/ResearchProject","parentOrganization":{"@type":"Organization","name":"Seminar Schools","url":"https://seminarschools.com/"}}
</script>
</head>
<body data-route-type="game-research" data-geometry="indra-web" data-indra-intensity="0.075">
<style id="ss-fz-style">.ss-fz{position:fixed;top:.9rem;right:3.3rem;z-index:1000;display:inline-flex;gap:.25rem;align-items:center}.ss-fz button{width:30px;height:30px;padding:0;border:1px solid currentColor;border-radius:50%;background:transparent;color:inherit;opacity:.75;font:600 12px/1 system-ui,sans-serif;cursor:pointer}.ss-fz button:focus-visible{outline:2px solid currentColor;outline-offset:2px}@media print{.ss-fz{display:none!important}}</style><div class="ss-fz" aria-label="Adjust text size"><button type="button" data-fz="down" title="Decrease text size">A-</button><button type="button" data-fz="up" title="Increase text size">A+</button><button type="button" data-fz="reset" class="reset" title="Reset text size" style="display:none">↺</button></div>
<div class="wrap">
<a class="back" href="/bb/">← bookwormburrows</a>
<header class="hero">
<div class="badge">Upcoming · research and design phase</div>
<h1><span>BBT</span> · BookwormBurrows Therapy</h1>
<p class="lede">A future therapy branch of BB where literature, role-play, affective dynamics, and human-guided AI storytelling could become one coherent therapeutic medium.</p>
</header>
<div class="status" role="note" aria-label="Current BBT status">
<p><strong>Research assembled. System unbuilt.</strong> BBT has not been released, tested, or offered as therapy. This page explains the synthesis already developed and the work required before BBT can become a real therapeutic practice.</p>
</div>
<section>
<h2>The central idea</h2>
<p>BBT is planned as a genuine therapy branch rather than ordinary BB decorated with therapeutic language. It would keep the living text-world, wormcards, Rainbow Magic, Narrative Priority, emotional modifiers, quests, and continuing campaign memory. A qualified human practitioner would add therapeutic purpose, attunement, reflection, and professional judgment. The AI would prepare scenes, track continuity, compare relevant factors, and offer narrative possibilities under human control.</p>
<p class="plain">The story remains the player-facing world. Therapeutic aims, records, scope, and professional responsibilities remain backstage with the practitioner. The game becomes a vehicle through which therapy may occur; the AI never becomes the therapist.</p>
</section>
<section>
<h2>What BBT inherits from BB</h2>
<div class="grid">
<article class="panel"><h3>Wormcards</h3><p>A continuing character carries strengths, conflicts, relationships, symbols, memories, injuries, objects, and transformations from one dimension to another.</p></article>
<article class="panel"><h3>Text-worlds</h3><p>Stories, poems, films, myths, images, histories, and other media become playable environments whose exegesis and internal logic shape what can happen.</p></article>
<article class="panel"><h3>Narrative Priority</h3><p>Actions resolve through meaning, context, character, evidence, relationship, environment, affect, and consequence rather than dice or a universal numerical psychology.</p></article>
<article class="panel"><h3>Affective modifiers</h3><p>Anxiety, pride, grief, curiosity, anger, trust, shame, exhaustion, hope, fear, complexes, and archetypal forces may help, hinder, redirect, or transform action.</p></article>
<article class="panel"><h3>Human plus AI DM</h3><p>The AI performs background preparation and continuity work. The human practitioner mediates every table-facing result and can refine or override the AI.</p></article>
<article class="panel"><h3>Continuing memory</h3><p>CC* preserves the whole consequential session so later scenes can inherit prior choices, relationships, symbols, discoveries, and unfinished tensions.</p></article>
</div>
</section>
<section>
<h2>The research synthesis</h2>
<div class="veins">
<article class="vein"><h3>Therapeutically applied tabletop role-playing</h3><p>Reviews, practitioner methods, case reports, pilots, and qualitative studies repeatedly point toward candidate mechanisms including agency, social connection, collaborative problem-solving, creative expression, identity exploration, perspective-taking, rehearsal, routine, and meaningful group participation. BBT treats these as research-guided possibilities to test rather than guaranteed outcomes.</p></article>
<article class="vein"><h3>Bibliotherapy</h3><p>Reading can provide distance, language, comparison, recognition, and new narrative possibilities. BBT extends bibliotherapy by allowing players to enter the text, act around its events, speak with its figures, carry discoveries between worlds, and return to the source through reflection.</p></article>
<article class="vein"><h3>Psychodrama and drama therapy</h3><p>Role, scene, enactment, witness, spontaneity, doubling, perspective change, audience, and reflection supply a lineage for using performed situations as material for thought and change. BBT would translate these principles into a continuing literary campaign rather than copy a single existing method.</p></article>
<article class="vein"><h3>Bleed and dual consciousness</h3><p>Role-playing research studies the movement of feelings, traits, meanings, and identities between player and character. BBT needs both immersion and distinction: the player can experience a character deeply while still recognizing the character, player, practitioner, and world as different positions.</p></article>
<article class="vein"><h3>Transformative, freeform, and diceless design</h3><p>BBT inherits BB’s diceless engine so that change follows the actual story, relationship, emotional state, symbolic structure, and therapeutic context. Narrative freedom increases the need for precise human judgment, clear continuity, and transparent reasons for consequential outcomes.</p></article>
<article class="vein"><h3>Attuned human facilitation</h3><p>The captured practitioner literature emphasizes spontaneity, playfulness, attunement, restraint, and knowledge. BBT would combine these with careful listening, group process, therapeutic goals, and professional scope. AI expands preparation and responsiveness while remaining subordinate to the human relationship.</p></article>
</div>
</section>
<section>
<h2>Emotions and personality can act like magic</h2>
<p>BBT’s most distinctive direction is to treat affective and personality dynamics as living forces inside the world. They are contextual modifiers rather than fixed labels.</p>
<div class="example">
<p class="scene">Walter’s anxiety rises as the council turns toward him. His hands shake, so the seal slips from his grip and his first sentence breaks. The same anxiety makes him notice every doubtful face in the room. He changes his speech, names the objection before anyone else can, and wins the attention of the one councillor who had planned to interrupt him.</p>
<p>The anxiety creates difficulty and perception at the same time. Pride might strengthen a speech and make apology harder. Grief might weaken concentration and deepen recognition. Anger might provide force and narrow judgment. Curiosity might expose danger and open knowledge. These dynamics emerge from the character, current situation, player authorship, and story. They never become automatic diagnoses of the person playing.</p>
</div>
</section>
<section>
<h2>What a future BBT session could feel like</h2>
<p>A player brings a wormcard into a story chosen for its therapeutic and literary possibilities. The AI creates the world-specific form of the character. The practitioner refines the translation and opens a scene whose relationships, symbols, pressures, and choices connect to the session’s purpose.</p>
<p>The player may investigate, speak, hide, fight, negotiate, create, remember, refuse, leave, return, or take another role. The world responds through exact narrative consequences. Reflection can happen inside the fiction through an NPC, dream, letter, trial, ritual, or return to rainbowworld, and outside the fiction through practitioner-led discussion. The campaign remembers what occurred and allows later sessions to return to unfinished material from a new angle.</p>
</section>
<section>
<h2>BB and BBT remain different</h2>
<div class="compare">
<article><h3>BB</h3><ul><li>Voluntary reading and seminar game</li><li>Educational, literary, social, and creative purposes</li><li>Teacher, tutor, seminar leader, family, or other human DM</li><li>Assignments and study become quests</li><li>Campaign records serve learning and continuity</li></ul></article>
<article><h3>BBT</h3><ul><li>Future therapeutic practice using the BB engine</li><li>Explicit therapeutic purpose and formulation</li><li>Qualified human practitioner controlling the AI</li><li>Scenes and quests designed around therapeutic aims</li><li>Separate private practice records and player-facing campaign memory</li></ul></article>
</div>
</section>
<section class="evidence">
<h2>The evidence ceiling</h2>
<p>The captured research base supports serious design work and careful pilot testing. It does not support claims that BBT is clinically proven. A 2024 scoping review included 51 papers and found that most were exploratory; quantitative and mixed-method studies formed a minority. The broader shelf remains heavy in reviews, qualitative studies, small pilots, case reports, dissertations, practitioner literature, and studies concentrated around Dungeons &amp; Dragons and neurodivergent groups.</p>
<p>BBT therefore begins as a research and design project. Every public claim must match its evidence grade. New controlled research, system-specific studies, cultural research, and direct evaluation of BB’s diceless literary engine would be required before stronger claims.</p>
</section>
<section>
<h2>What must be built before BBT exists</h2>
<ul class="build-list">
<li>A complete therapeutic game manual derived from BB rather than a loose collection of ideas.</li>
<li>Defined practitioner qualifications, scope, therapeutic goals, and referral boundaries.</li>
<li>A human-controlled AI workflow that keeps clinical judgment and the therapeutic relationship with the practitioner.</li>
<li>A private practitioner record separated from the player-facing CC* campaign memory.</li>
<li>Narrative departure, role-shifting, return, debriefing, and bleed-processing procedures.</li>
<li>Affective-modifier validation across neurodiversity, culture, age, language, privacy, trauma, and different therapeutic approaches.</li>
<li>Worked examples, practitioner training, pilot protocols, outcome measures, adverse-event review, and independent evaluation.</li>
<li>Clear evidence labels distinguishing theory, qualitative findings, pilots, clinical cases, practitioner knowledge, and tested effects.</li>
</ul>
<p class="plain">These requirements belong to the backstage practice architecture. The player-facing experience can remain a living story rather than a wall of administrative language.</p>
</section>
<section>
<h2>Current state</h2>
<p>The research shelf, theoretical synthesis, and relationship to BB now exist. BBT’s actual rules, practitioner architecture, campaigns, record system, testing programme, and release standard remain future work.</p>
<p><a href="/polymyth/bookwormburrows-bbt-therapy-bibliography-2026-07-09.md">Open the full BBT research bibliography and evidence notes</a></p>
</section>
<section class="references">
<h2>Selected research anchors</h2>
<p class="ref">Yuliawati, L., Wardhani, P. A. P., &amp; Ng, J. H. (2024). A scoping review of tabletop role-playing game as psychological intervention: Potential benefits and future directions. <em>Psychology Research and Behavior Management, 17</em>, 2885–2903. <a href="https://doi.org/10.2147/PRBM.S466664">https://doi.org/10.2147/PRBM.S466664</a></p>
<p class="ref">Arenas, D. L., Viduani, A., &amp; Araujo, R. B. (2022). Therapeutic use of role-playing game in mental health: A scoping review. <em>Simulation &amp; Gaming, 53</em>(3), 285–311. <a href="https://doi.org/10.1177/10468781211073720">https://doi.org/10.1177/10468781211073720</a></p>
<p class="ref">Henrich, S., &amp; Worthington, R. (2021). Let your clients fight dragons: A rapid evidence assessment regarding the therapeutic utility of Dungeons &amp; Dragons. <em>Journal of Creativity in Mental Health</em>. <a href="https://doi.org/10.1080/15401383.2021.1987367">https://doi.org/10.1080/15401383.2021.1987367</a></p>
<p class="ref">Kilmer, E. D., Davis, A. D., Kilmer, J. N., &amp; Johns, A. R. (2023). <em>Therapeutically Applied Role-Playing Games: The Game to Grow Method</em>. Routledge.</p>
<p class="ref">Connell, M. A. (2023). <em>Tabletop Role-Playing Therapy: A Guide for the Clinician Game Master</em>. W. W. Norton.</p>
<p class="ref">Bowman, S. L. (2010). <em>The Functions of Role-Playing Games: How Participants Create Community, Solve Problems and Explore Identity</em>. McFarland.</p>
<p class="ref">Bowman, S. L., Diakolambrianou, E., &amp; Brind, S. (Eds.). (2024). <em>Transformative Role-Playing Game Design</em>. Uppsala University Press.</p>
<p class="ref">Walsh, O., &amp; Linehan, C. (2024). Roll for insight: Understanding how the experience of playing Dungeons &amp; Dragons impacts the mental health of an average player. <em>International Journal of Role-Playing, 15</em>, 36–60. <a href="https://doi.org/10.33063/ijrp.vi15.321">https://doi.org/10.33063/ijrp.vi15.321</a></p>
<p class="ref">Merrick, A., Li, W. W., &amp; Miller, D. J. (2024). A study on the efficacy of the tabletop roleplaying game Dungeons &amp; Dragons for improving mental health and self-concepts in a community sample. <em>Games for Health Journal, 13</em>(2), 128–133. <a href="https://doi.org/10.1089/g4h.2023.0158">https://doi.org/10.1089/g4h.2023.0158</a></p>
<p class="ref">Abbott, M. S., Stauss, K. A., &amp; Burnett, A. F. (2022). Table-top role-playing games as a therapeutic intervention with adults to increase social connectedness. <em>Social Work with Groups, 45</em>(1), 16–31. <a href="https://doi.org/10.1080/01609513.2021.1932014">https://doi.org/10.1080/01609513.2021.1932014</a></p>
<p class="ref">Blackmon, W. D. (1994). Dungeons and Dragons: The use of a fantasy game in the psychotherapeutic treatment of a young adult. <em>American Journal of Psychotherapy, 48</em>(4), 624–632. <a href="https://doi.org/10.1176/appi.psychotherapy.1994.48.4.624">https://doi.org/10.1176/appi.psychotherapy.1994.48.4.624</a></p>
<p class="ref">Hugaas, K. H. (2024). Bleed and identity: A conceptual model of bleed and how bleed-out from role-playing games can affect a player’s sense of self. <em>International Journal of Role-Playing, 15</em>.</p>
<p class="ref">Diakolambrianou, E., &amp; Bowman, S. L. (2023). Dual consciousness: What psychology and counseling theories can teach and learn regarding identity and the role-playing game experience. <em>Journal of Roleplaying Studies and STEAM, 2</em>(1).</p>
<p class="ref">Daniau, S. (2016). The transformative potential of role-playing games: From play skills to human skills. <em>Simulation &amp; Gaming, 47</em>(4), 423–444. <a href="https://doi.org/10.1177/1046878116650765">https://doi.org/10.1177/1046878116650765</a></p>
<p class="ref">Monroy-Fraustro, D., et al. (2021). Bibliotherapy as a non-pharmaceutical intervention to enhance mental health in response to the COVID-19 pandemic: A mixed-methods systematic review and bioethical meta-analysis. <em>Frontiers in Public Health, 9</em>, 629872. <a href="https://doi.org/10.3389/fpubh.2021.629872">https://doi.org/10.3389/fpubh.2021.629872</a></p>
<p class="ref">Moreno, J. L. (1946). <em>Psychodrama, Volume 1</em>. Beacon House.</p>
</section>
<footer><span>seminarschools.com · BBT research branch</span><span><a href="/bb/">BB</a> · <a href="/bb/why/">Why BB</a> · <a href="/polymyth/bookwormburrows/">Rule library</a></span></footer>
</div>
<script defer src="/js/theme.js?v=cl93"></script>
<script defer src="/js/mandala.js?v=cl93"></script>
<script defer src="/js/indra.js?v=cl93"></script>
<script defer src="/js/footer.js?v=cl93"></script>
<script defer src="/js/autolink.js?v=cl93"></script>
<script defer src="/js/site-keyboard-enhancements.js"></script>
</body>
</html>
'''
BBT.write_text(bbt_html, encoding='utf-8')

# ------------------------------------------------------------------
# Canonical BB* research-synthesis entry
# ------------------------------------------------------------------
seed = BB_HTML.read_text(encoding='utf-8')
if "id:'bbt-008'" not in seed:
    marker = "  {id:'bbt-000'"
    idx = seed.find(marker)
    if idx < 0:
        raise RuntimeError('bbt-000 insertion marker missing')
    entry = r'''  {id:'bbt-008',bb_links:['bbt-000','bbt-001','bbt-002','bbt-003','bbt-004','bbt-005','bbt-006','bbt-007','char-008','dm-117','dm-119'],s:'bbt',r:'both',t:'BBT public synthesis and current status: research assembled, therapeutic system unbuilt',b:`CURRENT SYNTHESIS 2026-07-10. BBT is the planned therapy branch of BookwormBurrows. It has not been built, tested, released, or offered as therapy. The current research substrate brings together therapeutically applied tabletop role-playing, bibliotherapy, psychodrama and drama therapy, transformative and freeform role-play, bleed, dual consciousness, identity, group process, agency, social connection, affective modifiers, and BB's human-plus-AI Dimensional Master. BBT would inherit wormcards, text-worlds, Rainbow Magic, Narrative Priority, contextual emotional and personality modifiers, and complete CC* continuity. A qualified human practitioner would hold therapeutic purpose, attunement, reflection, scope, and professional judgment. AI would support preparation, scene generation, continuity, comparison, and narration under human control; AI is never the therapist. PLAYER-FACING SYNTHESIS. The story remains the living surface. Anxiety, pride, grief, anger, trust, curiosity, exhaustion, hope, fear, complexes, archetypal forces, and other established dynamics may help, hinder, redirect, or transform action without becoming automatic diagnoses of the player. PRACTICE DIFFERENCE. BB is a voluntary educational, literary, social, and creative game. BBT would be an actual therapeutic practice using the BB engine, with qualified facilitation, explicit therapeutic purpose, private practitioner records separated from player-facing campaign memory, narrative departure and re-entry, debriefing and bleed work, scope and referral boundaries, evidence labels, training, pilots, and evaluation. EVIDENCE CEILING. The captured research justifies cautious design and testing. It remains young and heavily composed of reviews, qualitative studies, small pilots, case reports, dissertations, and practitioner literature. BBT must not be described as clinically proven or available until the system and evidence exist. PUBLIC ROUTE. The full accessible synthesis lives at /bb/bbt/.`,x:'Public synthesis created from bbt-000 through bbt-007 and the July 2026 BB mechanics and voluntary-first rulings. The detailed source shelf remains polymyth/bookwormburrows-bbt-therapy-bibliography-2026-07-09.md.',tg:'bbt, upcoming, therapy-branch, research-synthesis, therapeutic-ttrpg, bibliotherapy, psychodrama, drama-therapy, bleed, dual-consciousness, affective-modifiers, human-ai-dm, evidence-ceiling, unbuilt, public-route, 2026-07-10'},
'''
    seed = seed[:idx] + entry + seed[idx:]
    BB_HTML.write_text(seed, encoding='utf-8')

# ------------------------------------------------------------------
# Route discovery
# ------------------------------------------------------------------
sitemap = SITEMAP.read_text(encoding='utf-8')
if 'https://seminarschools.com/bb/bbt/' not in sitemap:
    line = '  <url><loc>https://seminarschools.com/bb/bbt/</loc><lastmod>2026-07-10</lastmod></url>\n'
    anchor = '  <url><loc>https://seminarschools.com/bb/why/</loc>'
    pos = sitemap.find(anchor)
    sitemap = sitemap[:pos] + line + sitemap[pos:] if pos >= 0 else sitemap.replace('</urlset>', line + '</urlset>')
    SITEMAP.write_text(sitemap, encoding='utf-8')

netlify = NETLIFY.read_text(encoding='utf-8')
if 'from = "/bb/bbt"' not in netlify:
    block = '\n[[redirects]]\n  from = "/bb/bbt"\n  to = "/bb/bbt/"\n  status = 301\n  force = true\n'
    anchor = '[[redirects]]\n  from = "/bb/why"'
    pos = netlify.find(anchor)
    netlify = netlify[:pos] + block + '\n' + netlify[pos:] if pos >= 0 else netlify + block
    NETLIFY.write_text(netlify, encoding='utf-8')

llms = LLMS.read_text(encoding='utf-8')
if 'https://seminarschools.com/bb/bbt/' not in llms:
    anchor = '- [Why tabletop role-playing belongs in education](https://seminarschools.com/bb/why/): research-grounded pedagogical case.\n'
    addition = anchor + '- [BBT · BookwormBurrows Therapy](https://seminarschools.com/bb/bbt/): upcoming therapy-branch research synthesis; research assembled, system unbuilt.\n'
    llms = replace_once(llms, anchor, addition, 'llms bbt')
    LLMS.write_text(llms, encoding='utf-8')

# ------------------------------------------------------------------
# Update CL wording to voluntary-first architecture and BBT status
# ------------------------------------------------------------------
cl = CL.read_text(encoding='utf-8')
cl = cl.replace('- [OPEN] Classroom consent, safety, and minor-supervision reconciliation: replace attendance-as-consent, reconcile parent or guardian presence with teacher-led classroom play, and define advance framing, alternative participation, rainbow-note, narrative-exit, privacy, withdrawal, and teacher responsibility.\n',
'''- [OPEN] Voluntary-first narrative transmutation: propagate BB's primary voluntary-seminar identity and translate compulsory-setting demands into world logic, including narrative departure, role shifting, rainbowworld return, later re-entry, private communication, and alternate in-game participation while keeping institutional records backstage.\n- [OPEN] Player-facing anti-gorgonification audit: remove visible participation management, assessment bureaucracy, curriculum bureaucracy, supervision bureaucracy, and administrative classification from the player surface; preserve their necessary backstage functions through the teacher, AI, CC*, and mc*.\n- [OPEN] Separate BBT practice architecture: build the qualified-practitioner, therapeutic-goal, private-record, debriefing, bleed-processing, scope, referral, training, pilot, evidence-label, and evaluation layer required for a real therapy branch. The public research synthesis now exists at `/bb/bbt/`; the therapeutic system remains unbuilt.\n''')
if '[CLOSED] BBT public research synthesis' not in cl:
    cl = cl.replace('## Remaining CL\n', '## Remaining CL\n\n- [CLOSED] BBT public research synthesis and status page: `/bb/bbt/` now explains the complete research synthesis, its relationship to BB, the affective-modifier direction, the evidence ceiling, and the build requirements while clearly marking BBT as upcoming and unbuilt.\n')
CL.write_text(cl, encoding='utf-8')

print('Applied BB voluntary-first and BBT upcoming final patch.')
