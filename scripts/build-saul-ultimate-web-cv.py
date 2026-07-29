#!/usr/bin/env python3
"""Build the verified one-source application CV surface for /saul/."""

from __future__ import annotations

import html
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data" / "saul-ultimate-school-cv-2026.json"
DATA = json.loads(DATA_PATH.read_text(encoding="utf-8"))


def total_experiences() -> int:
    return sum(len(section["records"]) for section in DATA["experience_sections"])


def esc(value: str) -> str:
    return html.escape(str(value), quote=True)


def inline_list(values: list[str]) -> str:
    return " <span aria-hidden=\"true\">|</span> ".join(
        f"<span>{esc(value)}</span>" for value in values
    )


def experience_section(section: dict) -> str:
    rows = []
    for record in section["records"]:
        accessible = (
            f"{record['role']}; {record['description']}; "
            f"{record['organization']}; {record['dates']}."
        )
        rows.append(
            f"""<article class="cv-ultimate__row" data-experience-id="{esc(record['id'])}" data-experience-row="{esc(section['id'])}" data-focus="{esc(' '.join(record['focus']))}">
<span class="cv-ultimate__sr-only">{esc(accessible)}</span>
<div aria-hidden="true" class="cv-ultimate__row-copy"><strong>{esc(record['role'])}</strong><span class="cv-ultimate__pipe">|</span><span class="cv-ultimate__description">{esc(record['description'])}</span><span class="cv-ultimate__pipe">|</span><em>{esc(record['organization'])}</em></div>
<time aria-hidden="true">{esc(record['dates'])}</time>
</article>"""
        )
    return f"""<section class="cv-ultimate__experience-section" data-experience-section="{esc(section['id'])}" aria-labelledby="{esc(section['id'])}-heading">
<div class="cv-ultimate__section-heading"><h2 id="{esc(section['id'])}-heading">{esc(section['title'])}</h2><span data-section-count="{len(section['records'])}">{len(section['records'])} experiences</span></div>
<div class="cv-ultimate__rows">
{''.join(rows)}
</div>
</section>"""


def course_list() -> str:
    ontario = "".join(
        f"<li><strong>{esc(code)}</strong><span>{esc(title)}</span></li>"
        for code, title in DATA["courses"]["ontario"]
    )
    international = "".join(
        f"<li>{esc(item)}</li>" for item in DATA["courses"]["international"]
    )
    return f"""<section class="cv-ultimate__courses" id="courses" aria-labelledby="courseScopeHeading">
<div class="cv-ultimate__section-heading"><h2 id="courseScopeHeading">Courses &amp; Programs Taught</h2></div>
<div class="cv-ultimate__course-grid">
<div><h3>Ontario &amp; Canadian Curriculum</h3><ul class="cv-ultimate__coded-courses">{ontario}</ul></div>
<div><h3>International &amp; Language Programs</h3><ul class="cv-ultimate__programs">{international}</ul></div>
</div>
</section>"""


def download_controls(compact: bool = False) -> str:
    contact = DATA["contact"]
    downloads = DATA["downloads"]
    compact_class = " cv-downloads--compact" if compact else ""
    return f"""<div class="cv-downloads{compact_class}" aria-label="Verified one-page CV downloads">
<div class="cv-downloads__heading"><span>Finished one-page application CV</span><strong>Choose the email shown in the file</strong></div>
<div class="cv-downloads__edition"><span>ProtonMail · {esc(contact['public_email'])}</span><a class="cv-downloads__primary" href="{esc(downloads['proton_pdf'])}">PDF</a><a href="{esc(downloads['proton_docx'])}">Word</a></div>
<div class="cv-downloads__edition"><span>Gmail · {esc(contact['alternate_email'])}</span><a class="cv-downloads__primary" href="{esc(downloads['gmail_pdf'])}">PDF</a><a href="{esc(downloads['gmail_docx'])}">Word</a></div>
<div class="cv-downloads__edition"><span>Complete record · every application &amp; historical entry</span><a class="cv-downloads__primary" href="/saul/downloads/saul-karim-nassau-complete-career-archive-cv.pdf">EVERYTHING PDF</a><a href="/saul/downloads/saul-karim-nassau-all-cv-outputs.zip">All CV files</a></div>
</div>"""


def focus_controls() -> str:
    modules = DATA["focus_modules"]
    application_modules = [
        module
        for module in modules
        if not module.get("archive_only") and not module.get("default_view")
    ]
    portfolio = next(module for module in modules if module.get("archive_only"))
    controls = [
        '<button aria-pressed="true" class="cv-focus__all" data-focus-reset type="button">General / Complete CV</button>'
    ]
    for module in application_modules:
        controls.append(
            f"""<label class="cv-focus__option" style="--focus-color:{esc(module['color'])}">
<input data-focus-input type="checkbox" value="{esc(module['id'])}"/><span>{esc(module['short_label'])}</span>
</label>"""
        )
    controls.append(
        f"""<a class="cv-focus__portfolio" href="/saul/?archive=portfolio#careerArchive" style="--focus-color:{esc(portfolio['color'])}">{esc(portfolio['short_label'])}<span>Archive</span></a>"""
    )
    public_modules = [
        {
            "id": module["id"],
            "short_label": module["short_label"],
            "summary": module["summary"],
            "skills": module["skills"],
            "pdf": (
                f"/saul/downloads/saul-karim-nassau-{module['id']}-cv.pdf"
            ),
        }
        for module in modules
        if not module.get("archive_only")
    ]
    module_json = (
        json.dumps(public_modules, ensure_ascii=False, separators=(",", ":"))
        .replace("</", "<\\/")
    )
    return f"""<section class="cv-focus" aria-labelledby="cvFocusHeading" data-cv-focus>
<div class="cv-focus__heading"><div><span>Role-focused views</span><h2 id="cvFocusHeading">Build a focused CV</h2></div><p data-focus-summary>Complete application CV with every verified experience row visible.</p></div>
<fieldset class="cv-focus__controls" aria-controls="experienceLedger"><legend class="cv-ultimate__sr-only">Application CV focus areas</legend>{''.join(controls)}</fieldset>
<div class="cv-focus__status"><p data-cv-share-status="" aria-atomic="true" aria-live="polite" class="cv-spectrum__status">Showing <strong data-visible-count>{total_experiences()}</strong> of <strong>{total_experiences()}</strong> experiences</p><a data-focus-pdf href="/saul/downloads/saul-karim-nassau-general-cv.pdf">Download complete modular PDF</a><button data-focus-print hidden type="button">Print / save combined view</button><button data-copy-focus type="button">Copy focused-view link</button></div>
<script id="cvFocusData" type="application/json">{module_json}</script>
</section>"""


def build_cv_html() -> str:
    contact = DATA["contact"]
    experiences = "".join(experience_section(section) for section in DATA["experience_sections"])
    skills = "".join(
        f'<li data-core-skill="{esc(skill)}">{esc(skill)}</li>'
        for skill in DATA["core_skills"]
    )
    details = [
        ("Education", DATA["education"]),
        ("Credentials", DATA["credentials"]),
        ("Professional Learning", DATA["professional_learning"]),
        ("Methods & Tools", DATA["methods_tools"]),
        ("Languages", DATA["languages"]),
    ]
    detail_html = "".join(
        f"<div><dt>{esc(label)}</dt><dd>{inline_list(values)}</dd></div>"
        for label, values in details
    )
    return f"""<section class="cv-ultimate" data-cv-ultimate="true" id="cvOverview" aria-labelledby="cvUltimateName">
<div aria-hidden="true" class="cv-ultimate__spectrum"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
<header class="cv-ultimate__hero">
<figure class="cv-ultimate__portrait">
<img alt="Portrait of Saul Karim Nassau" height="640" loading="eager" src="/img/saul.jpg" width="640"/>
</figure>
<div class="cv-ultimate__identity">
<span class="cv-ultimate__kicker">Curriculum vitae</span>
<h1 id="cvUltimateName">{esc(contact['name'])}</h1>
<p class="cv-ultimate__role">{esc(contact['role'])}</p>
<div class="cv-ultimate__contact">
<span>{esc(contact['location'])}</span>
<a href="tel:+14167710382">{esc(contact['phone'])}</a>
<a href="mailto:{esc(contact['public_email'])}">{esc(contact['public_email'])}</a>
<a href="{esc(contact['site_url'])}">{esc(contact['site_label'])}</a>
<a href="{esc(contact['reviews_url'])}">{esc(contact['reviews_label'])}</a>
</div>
<p class="cv-ultimate__profile">{esc(DATA['profile'])}</p>
<ul class="cv-ultimate__facts" aria-label="Career summary">
<li><strong>12+</strong><span>Years</span></li>
<li><strong>15</strong><span>Curricula &amp; Programs</span></li>
<li><strong>2,000+</strong><span>Students</span></li>
<li><strong>Ontario &amp; BC</strong><span>Inspections</span></li>
</ul>
{download_controls(compact=True)}
</div>
</header>
<a class="cv-ultimate__curriculum-band" href="#courses"><span>Curriculum scope</span><strong>OSSD · IB · AP · A Level · ESL · IELTS · STEM · Humanities · University Preparation</strong><span>See every course ↓</span></a>
{focus_controls()}
<div class="cv-ultimate__layout">
<aside class="cv-ultimate__skills" aria-labelledby="coreSkillsHeading">
<h2 id="coreSkillsHeading">Key Skills</h2>
<ul>{skills}</ul>
<a class="cv-ultimate__archive-link" href="#careerArchive">Historical career &amp; project archive</a>
</aside>
<div class="cv-ultimate__experience" data-total-experiences="{total_experiences()}" id="experienceLedger">
{experiences}
</div>
</div>
<section class="cv-ultimate__closing" aria-labelledby="educationLearningHeading">
<div class="cv-ultimate__section-heading"><h2 id="educationLearningHeading">Education, Professional Learning &amp; Languages</h2></div>
<dl>{detail_html}</dl>
</section>
{course_list()}
{download_controls()}
<footer class="cv-ultimate__footer">
<a href="{esc(contact['reviews_url'])}">Reviews {esc(contact['reviews_label'])}</a>
<span aria-hidden="true">|</span>
<span>References available on request</span>
</footer>
</section>"""


def update_metadata(source: str) -> str:
    contact = DATA["contact"]
    title = "Saul Karim M Hosaini Nassau, MA - Educator and Community Organizer"
    description = (
        "Modular application CV for Saul Karim M Hosaini Nassau, MA, with complete "
        "teaching, research, community, volunteer, hospitality, operations, performance, "
        "education, credentials, courses and language experience."
    )
    source = re.sub(r"<title>.*?</title>", f"<title>{esc(title)}</title>", source, count=1)
    source = re.sub(
        r'<meta content="[^"]*" name="description"/>',
        f'<meta content="{esc(description)}" name="description"/>',
        source,
        count=1,
    )
    source = re.sub(
        r'<meta content="[^"]*" property="og:title">',
        f'<meta content="{esc(title)}" property="og:title">',
        source,
        count=1,
    )
    source = re.sub(
        r'<meta content="[^"]*" property="og:description">',
        f'<meta content="{esc(description)}" property="og:description">',
        source,
        count=1,
    )
    source = re.sub(
        r'<meta content="[^"]*" name="twitter:title"/>',
        f'<meta content="{esc(title)}" name="twitter:title"/>',
        source,
        count=1,
    )
    source = re.sub(
        r'<meta content="[^"]*" name="twitter:description"/>',
        f'<meta content="{esc(description)}" name="twitter:description"/>',
        source,
        count=1,
    )
    schema = {
        "@context": "https://schema.org",
        "@type": "ProfilePage",
        "name": title,
        "url": contact["site_url"],
        "mainEntity": {
            "@type": "Person",
            "name": contact["name"],
            "email": contact["public_email"],
            "telephone": contact["phone"],
            "jobTitle": "Educator and Community Organizer",
            "address": {
                "@type": "PostalAddress",
                "addressLocality": "Toronto",
                "addressRegion": "Ontario",
                "addressCountry": "CA",
            },
        },
    }
    source = re.sub(
        r'<script type="application/ld\+json">.*?</script>',
        "",
        source,
        flags=re.S,
    )
    structured_data = (
        '<script type="application/ld+json">'
        + json.dumps(schema, ensure_ascii=False, separators=(",", ":"))
        + "</script>"
    )
    source = source.replace("</head>", structured_data + "\n</head>", 1)
    return source


def update_archive_consistency(source: str) -> str:
    """Keep the adjacent career archive aligned with the verified application CV."""
    replacements = {
        (
            "I have taught in six countries across fifteen curricula and worked with "
            "more than a thousand students through OSSD, IB, AP, A-level, ESL, and "
            "adult education. The framework adapts. The architecture stays the same."
        ): (
            "I have 12+ years of international teaching experience across 15 curricula "
            "&amp; programs and have supported 2,000+ students from early childhood "
            "through adult education, including OSSD, IB, AP, A Level, ESL, STEM, "
            "humanities &amp; university preparation."
        ),
        (
            "我曾在六個國家、橫跨十五種課綱中任教，並透過 OSSD、IB、AP、A-Level、ESL "
            "與成人教育與一千多名學生共同工作。框架隨情境調整，結構始終一致。"
        ): (
            "我擁有十二年以上的國際教學經驗，涵蓋十五種課程與教育項目，並曾支援二千多名從幼兒教育到"
            "成人教育的學生，包括 OSSD、IB、AP、A-Level、ESL、STEM、人文學科與大學準備。"
        ),
        (
            "我曾在六个国家、横跨十五种课纲中任教，并通过 OSSD、IB、AP、A-Level、ESL "
            "与成人教育与一千多名学生共同工作。框架随情境调整，结构始终一致。"
        ): (
            "我拥有十二年以上的国际教学经验，涵盖十五种课程与教育项目，并曾支持二千多名从幼儿教育到"
            "成人教育的学生，包括 OSSD、IB、AP、A-Level、ESL、STEM、人文学科与大学准备。"
        ),
        (
            "من در شش کشور و در پانزده برنامهٔ درسی تدریس کرده‌ام و با بیش از هزار دانش‌آموز "
            "در OSSD، IB، AP، A-Level، ESL و آموزش بزرگسالان کار کرده‌ام. چارچوب تطبیق می‌یابد. "
            "معماری ثابت می‌ماند."
        ): (
            "بیش از دوازده سال تجربهٔ تدریس بین‌المللی در پانزده برنامهٔ درسی و آموزشی دارم و از "
            "بیش از دو هزار دانش‌آموز، از آموزش دوران کودکی تا آموزش بزرگسالان، در OSSD، IB، AP، "
            "A-Level، ESL، STEM، علوم انسانی و آمادگی دانشگاه پشتیبانی کرده‌ام."
        ),
        (
            "J'ai enseigné dans six pays à travers quinze curricula et travaillé avec plus de "
            "mille étudiants dans le cadre de OSSD, IB, AP, A-Level, ESL et éducation des "
            "adultes. Le cadre s'adapte. L'architecture reste la même."
        ): (
            "Je possède plus de douze ans d’expérience internationale en enseignement dans "
            "quinze programmes d’études et de formation, auprès de plus de deux mille élèves, "
            "de la petite enfance à l’éducation des adultes, notamment en OSSD, IB, AP, "
            "A-Level, ESL, STIM, sciences humaines et préparation universitaire."
        ),
        "Word and PowerPoint reports, summaries, workshops, and presentations": (
            "Word reports, whiteboard-led seminars, workshops, and presentations"
        ),
        "Excel, Word, and PowerPoint": "Excel, Word, and whiteboard-led inquiry",
        'en: "English · Basic French, Farsi, and Mandarin"': (
            'en: "English · Farsi (advanced) · French & Mandarin (basic)"'
        ),
        'zh: "英語 · 基礎法語、波斯語及普通話"': (
            'zh: "英語 · 波斯語（進階）· 法語及普通話（基礎）"'
        ),
        'zhs: "英语 · 基础法语、波斯语及普通话"': (
            'zhs: "英语 · 波斯语（高级）· 法语及普通话（基础）"'
        ),
        'fa: "انگلیسی · فرانسه، فارسی و ماندارین در سطح پایه"': (
            'fa: "انگلیسی · فارسی (پیشرفته) · فرانسوی و ماندارین (پایه)"'
        ),
        'fr: "Anglais · Français, farsi et mandarin de niveau élémentaire"': (
            'fr: "Anglais · Farsi (avancé) · Français et mandarin (élémentaires)"'
        ),
        '"Teacher, Intelligent International"': (
            '"Occasional Teacher, Intelligent International"'
        ),
        '"教師，Intelligent International"': '"兼任教師，Intelligent International"',
        '"教师，Intelligent International"': '"兼任教师，Intelligent International"',
        '"معلم، Intelligent International"': '"معلم موردی، Intelligent International"',
        '"Enseignant, Intelligent International"': (
            '"Enseignant occasionnel, Intelligent International"'
        ),
        '"Instructor, RoboThink Toronto, Markham"': (
            '"Occasional Instructor, RoboThink Toronto, Markham"'
        ),
        '"講師，RoboThink, 萬錦"': '"兼任講師，RoboThink, 萬錦"',
        '"讲师，RoboThink, 万锦"': '"兼任讲师，RoboThink, 万锦"',
        '"مدرس، RoboThink, مارکهام"': '"مدرس موردی، RoboThink, مارکهام"',
        '"Instructeur, RoboThink, Markham"': (
            '"Formateur occasionnel, RoboThink, Markham"'
        ),
        '"Instructor, Happy Learning Education Center"': (
            '"Occasional Instructor, Happy Learning Education Center"'
        ),
        '"講師，Happy Learning"': '"兼任講師，Happy Learning"',
        '"讲师，Happy Learning"': '"兼任讲师，Happy Learning"',
        '"مدرس، Happy Learning"': '"مدرس موردی، Happy Learning"',
        '"Instructeur, Happy Learning"': '"Formateur occasionnel, Happy Learning"',
        '"Elementary, up to Grade 4"': '"Early Childhood STEM"',
        '"小學，至四年級"': '"幼兒 STEM"',
        '"小学，至四年级"': '"幼儿 STEM"',
        '"ابتدایی تا پایه چهارم"': '"STEM دوران کودکی"',
        '"ابتدایی تا پایهٔ چهارم"': '"STEM دوران کودکی"',
        '"تا کلاس چهارم"': '"STEM دوران کودکی"',
        '"Jusqu\'en 4e année"': '"STIM – petite enfance"',
        (
            "Teaching robotics and STEM to elementary students up to Grade 4. Lessons use "
            "demonstrations, guided practice, observation, and adaptive support to help "
            "students build foundational technical skills."
        ): (
            "Teaching robotics and STEM in early childhood settings through demonstrations, "
            "guided practice, observation, and adaptive support that build foundational "
            "technical skills."
        ),
        (
            "教授四年級以下小學生機器人與 STEM。課程運用示範、引導練習、觀察及因應學生需要的支援，"
            "協助建立基礎技術能力。"
        ): (
            "在幼兒教育環境中教授機器人與 STEM，運用示範、引導練習、觀察及因應需要的支援，"
            "協助建立基礎技術能力。"
        ),
        (
            "教授四年级以下小学生机器人与 STEM。课程运用示范、引导练习、观察及适应学生需要的支持，"
            "协助建立基础技术能力。"
        ): (
            "在幼儿教育环境中教授机器人与 STEM，运用示范、引导练习、观察及适应需要的支持，"
            "协助建立基础技术能力。"
        ),
        (
            "آموزش رباتیک و STEM به دانش‌آموزان ابتدایی تا پایهٔ چهارم. درس‌ها با نمایش، تمرین "
            "هدایت‌شده، مشاهده و حمایت سازگارشونده به ساخت مهارت‌های فنی پایه کمک می‌کنند."
        ): (
            "آموزش رباتیک و STEM در محیط‌های آموزش دوران کودکی با استفاده از نمایش، تمرین "
            "هدایت‌شده، مشاهده و حمایت سازگار برای ساخت مهارت‌های فنی پایه."
        ),
        (
            "Enseignement de la robotique et des STIM aux élèves du primaire jusqu’en 4e année. "
            "Les leçons utilisent des démonstrations, la pratique guidée, l’observation et un "
            "soutien adapté afin de développer les compétences techniques de base."
        ): (
            "Enseignement de la robotique et des STIM en petite enfance au moyen de "
            "démonstrations, de pratique guidée, d’observation et d’un soutien adapté afin de "
            "développer les compétences techniques de base."
        ),
        (
            "Volunteer support for a Toronto-area festival sustained through shared "
            "participation, cultural programming, and community work."
        ): (
            "Supported transport, information, security, and crowd flow during festival "
            "operations and participated in 2025 and 2026 planning."
        ),
        (
            "支援多倫多地區一個由共同參與、文化節目與社區工作維繫的節慶。"
        ): (
            "在節慶營運中支援交通、資訊、安全與人流管理，並參與 2025 與 2026 年的規劃。"
        ),
        (
            "支持多伦多地区一个由共同参与、文化节目与社区工作维系的节庆。"
        ): (
            "在节庆运营中支持交通、信息、安全与人流管理，并参与 2025 与 2026 年的规划。"
        ),
        (
            "پشتیبانی داوطلبانه از جشنواره‌ای در منطقهٔ تورنتو که با مشارکت مشترک، برنامه‌های "
            "فرهنگی و کار اجتماعی شکل می‌گیرد."
        ): (
            "در عملیات جشنواره از حمل‌ونقل، اطلاع‌رسانی، امنیت و هدایت جمعیت پشتیبانی کردم و "
            "در برنامه‌ریزی سال‌های ۲۰۲۵ و ۲۰۲۶ مشارکت داشتم."
        ),
        (
            "Soutien bénévole à un festival de la région de Toronto fondé sur la participation, "
            "la programmation culturelle et le travail communautaire."
        ): (
            "Soutien au transport, à l’information, à la sécurité et à la circulation des "
            "foules pendant les opérations du festival, avec participation à la planification "
            "de 2025 et 2026."
        ),
        '"Jun 2025–Feb 2026"': '"Jun 2025–May 2026"',
        '<a href="#careerArchive">Timeline</a>': (
            '<a href="#careerArchive">Historical Archive</a>'
        ),
        "Open the complete career archive": (
            "Open historical archive — separate from application CV"
        ),
        ">Work record<": ">Historical Career &amp; Project Archive<",
        "Complete record by date or by practice.": (
            "Separate from the application CV above; includes personal projects, "
            "early education, short courses &amp; other historical records."
        ),
        'aria-label="CV focus filters"': (
            'aria-label="Historical archive filters"'
        ),
        "Current focus: full record.": "Historical archive: full record.",
        'moduleHelper: "Choose one or more areas before downloading."': (
            'moduleHelper: "Filter the complete historical record. The application CV and '
            'its fixed downloads remain unchanged."'
        ),
        (
            "teaching: { title: 'Teaching and education.', lede: 'Thousands of learners across "
            "classroom, tutoring, curriculum, assessment, scaffolding, teacher development, "
            "and multilingual education.' }"
        ): (
            "teaching: { title: 'Teaching and education.', lede: '12+ years of international "
            "teaching across 15 curricula & programs, supporting 2,000+ learners from early "
            "childhood through adult education.' }"
        ),
        'archiveTitle: "Work record"': (
            'archiveTitle: "Historical Career & Project Archive"'
        ),
        'archiveText: "Complete record by date or by practice."': (
            'archiveText: "Separate from the application CV above; includes personal '
            'projects, early education, short courses & other historical records."'
        ),
        '"2026–Present",\n    [\n      "volunteer",\n      "community",\n      "performance"\n    ],\n    {\n      "en": "Volunteer, BUMI Festival"': (
            '"2025–Present",\n    [\n      "volunteer",\n      "community",\n'
            '      "performance"\n    ],\n    {\n      "en": "Volunteer, BUMI Festival"'
        ),
    }
    for old, new in replacements.items():
        source = source.replace(old, new)
    if '"Fundraiser & Volunteer Coordinator, Greenpeace"' not in source:
        greenpeace = next(
            record
            for section in DATA["experience_sections"]
            for record in section["records"]
            if record["organization"] == "Greenpeace"
        )
        archive = greenpeace["archive"]
        row = [
            archive["section_weight"],
            greenpeace["dates"],
            archive["categories"],
            {"en": archive["title"]},
            {"en": archive["note"]},
            None,
            {"en": archive["description"]},
        ]
        entry = json.dumps(row, ensure_ascii=False, indent=2)
        anchor = (
            '  [\n'
            '    1,\n'
            '    "2006",\n'
            '    [\n'
            '      "performance",\n'
            '      "community",\n'
            '      "volunteer"\n'
            '    ],\n'
            '    {\n'
            '      "en": "On-Camera Interviewer, Street Kids International Volunteer Commercial"'
        )
        if anchor not in source:
            raise RuntimeError("Could not place Greenpeace in historical archive")
        source = source.replace(anchor, "  " + entry + ",\n" + anchor, 1)
    source = source.replace(
        '"Separate from the application CV above; includes personal projects, '
        'early education, short courses &amp; other historical records."',
        '"Separate from the application CV above; includes personal projects, '
        'early education, short courses & other historical records."',
    )
    return source


def update_page(path: Path) -> None:
    source = path.read_text(encoding="utf-8")
    start = source.find('<section class="cv-spectrum"')
    if start < 0:
        start = source.find('<section class="cv-ultimate"')
    end = source.find('<section aria-labelledby="cvMapTitle"', start)
    if start < 0 or end < 0:
        raise RuntimeError(f"CV section markers not found in {path}")
    source = source[:start] + build_cv_html() + source[end:]
    source = re.sub(
        r'\./assets/(?:saul-cv-spectrum-2026|saul-ultimate-cv-2026)\.css\?[^"]*',
        "./assets/saul-ultimate-cv-2026.css?v=20260727-modular",
        source,
        count=1,
    )
    source = re.sub(
        r'<script defer="True" src="(?:\./|/saul/)assets/saul-cv-spectrum-2026\.js\?[^"]*"></script>',
        "",
        source,
        count=1,
    )
    source = re.sub(
        r'<script defer src="/saul/assets/saul-ultimate-cv-modules-2026\.js\?[^"]*"></script>',
        "",
        source,
    )
    source = source.replace(
        'data-saul-modular-cv="true"',
        'data-saul-ultimate-cv="true"',
        1,
    )
    for retired_doctoral_sentence in (
        " Ongoing PhD work in education research extends the same practice into pedagogy.",
        "我目前進行中的教育學博士研究將同樣的實踐延伸至教學法。",
        "我目前进行中的教育学博士研究将同样的实践延伸至教学法。",
        " کار جاری دکترای من در پژوهش آموزشی همین شیوه را به آموزش‌شناسی گسترش می‌دهد.",
        " Le travail doctoral en cours en recherche éducative étend la même pratique à la pédagogie.",
    ):
        source = source.replace(retired_doctoral_sentence, "")
    source = source.replace(
        'html[data-saul-archive-language]:not([data-saul-archive-language="en"]) .cv-spectrum{display:none!important}',
        'html[data-saul-archive-language]:not([data-saul-archive-language="en"]) :is(.cv-spectrum,.cv-ultimate){display:none!important}',
    )
    source = update_archive_consistency(source)
    source = update_metadata(source)
    source = source.replace(
        "</body>",
        '<script defer src="/saul/assets/saul-ultimate-cv-modules-2026.js?v=20260727-modular"></script>\n</body>',
        1,
    )
    path.write_text(source, encoding="utf-8")


def clean_legacy_canonical() -> None:
    path = ROOT / "data" / "saul-cv-canonical-2026.json"
    canonical = {
        "release": DATA["release"],
        "contact": DATA["contact"],
        "education": DATA["education"],
        "rules": {
            "ultimate_application_cv": True,
            "application_experience_rows": total_experiences(),
            "application_sections": [
                len(section["records"]) for section in DATA["experience_sections"]
            ],
            "application_projects_excluded": True,
            "application_phd_excluded": True,
            "application_downloads_have_email_only_variants": True,
            "focus_modules_reference_application_rows": True,
            "focus_views_have_distinct_pdf_downloads": True,
            "one_edit_rebuilds_every_output": True,
        },
        "focus_modules": DATA["focus_modules"],
        "ultimate_application_cv": DATA,
    }
    payload = json.dumps(canonical, ensure_ascii=False, indent=2) + "\n"
    path.write_text(payload, encoding="utf-8")
    (ROOT / "saul" / "assets" / "saul-cv-canonical-2026.json").write_text(
        payload, encoding="utf-8"
    )
    (ROOT / "saul" / "assets" / "saul-ultimate-school-cv-2026.json").write_text(
        json.dumps(DATA, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def canonical_text_export() -> str:
    contact = DATA["contact"]
    lines = [
        contact["name"],
        contact["role"],
        (
            f"{contact['location']} | {contact['phone']} | "
            f"{contact['public_email']} | {contact['site_label']} | "
            f"{contact['reviews_label']}"
        ),
        "",
        "PROFILE",
        DATA["profile"],
        "",
    ]
    for section in DATA["experience_sections"]:
        lines.extend([section["title"].upper(), ""])
        for record in section["records"]:
            lines.append(
                f"{record['role']} | {record['description']} | "
                f"{record['organization']} | {record['dates']}"
            )
        lines.append("")
    lines.extend(["CORE SKILLS", " | ".join(DATA["core_skills"]), ""])
    for label, values in [
        ("EDUCATION", DATA["education"]),
        ("CREDENTIALS", DATA["credentials"]),
        ("PROFESSIONAL LEARNING", DATA["professional_learning"]),
        ("METHODS & TOOLS", DATA["methods_tools"]),
        ("LANGUAGES", DATA["languages"]),
    ]:
        lines.extend([label, " | ".join(values), ""])
    lines.extend(["ONTARIO & CANADIAN COURSES", ""])
    lines.extend(f"{code} — {title}" for code, title in DATA["courses"]["ontario"])
    lines.extend(
        [
            "",
            "INTERNATIONAL & LANGUAGE PROGRAMS",
            "",
            *DATA["courses"]["international"],
            "",
            "References available on request.",
        ]
    )
    return "\n".join(lines) + "\n"


def synchronize_legacy_downloads() -> None:
    """Keep stable top-level URLs without overwriting distinct modular PDFs."""
    downloads = ROOT / "saul" / "downloads"
    proton_pdf = downloads / "saul-karim-nassau-ultimate-school-cv-2026-protonmail.pdf"
    proton_docx = downloads / "saul-karim-nassau-ultimate-school-cv-2026-protonmail.docx"
    gmail_pdf = downloads / "saul-karim-nassau-ultimate-school-cv-2026-gmail.pdf"
    gmail_docx = downloads / "saul-karim-nassau-ultimate-school-cv-2026-gmail.docx"
    for path in [proton_pdf, proton_docx, gmail_pdf, gmail_docx]:
        if not path.exists():
            raise RuntimeError(f"Required verified download is missing: {path}")

    shutil.copyfile(proton_pdf, ROOT / "saul" / "cv.pdf")
    shutil.copyfile(proton_docx, ROOT / "saul" / "cv.docx")


def write_active_download_manifest() -> None:
    """Replace the retired focused-PDF ledger with the four locked downloads."""
    downloads = ROOT / "saul" / "downloads"
    specs = [
        (
            "protonmail",
            "pdf",
            DATA["contact"]["public_email"],
            downloads / "saul-karim-nassau-ultimate-school-cv-2026-protonmail.pdf",
        ),
        (
            "protonmail",
            "docx",
            DATA["contact"]["public_email"],
            downloads / "saul-karim-nassau-ultimate-school-cv-2026-protonmail.docx",
        ),
        (
            "gmail",
            "pdf",
            DATA["contact"]["alternate_email"],
            downloads / "saul-karim-nassau-ultimate-school-cv-2026-gmail.pdf",
        ),
        (
            "gmail",
            "docx",
            DATA["contact"]["alternate_email"],
            downloads / "saul-karim-nassau-ultimate-school-cv-2026-gmail.docx",
        ),
    ]
    outputs = []
    for edition, file_format, email, path in specs:
        payload = path.read_bytes()
        outputs.append(
            {
                "edition": edition,
                "format": file_format,
                "email": email,
                "path": path.relative_to(ROOT).as_posix(),
                "url": "/" + path.relative_to(ROOT).as_posix(),
                "pages": 1,
                "bytes": len(payload),
                "sha256": hashlib.sha256(payload).hexdigest(),
            }
        )
    manifest = {
        "release": DATA["release"],
        "status": "active",
        "scope": "Four fixed application downloads from one 36-row canonical CV.",
        "policy": {
            "focus_views_change_web_presentation_only": True,
            "focused_pdf_generation_retired": True,
            "gmail_and_protonmail_differ_only_by_email": True,
        },
        "outputs": outputs,
    }
    (ROOT / "data" / "saul-cv-pdf-manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def retire_focused_routes() -> None:
    route_destinations = {
        ROOT / "saul" / "cv" / "general" / "index.html": "/saul/#experienceLedger",
        ROOT / "saul" / "cv" / "hospitality" / "index.html": "/saul/?focus=hospitality#experienceLedger",
        ROOT / "saul" / "cv" / "research" / "index.html": "/saul/?focus=research#experienceLedger",
        ROOT / "saul" / "cv" / "teaching" / "index.html": "/saul/?focus=teaching#experienceLedger",
        ROOT / "saul" / "cv" / "programs" / "index.html": "/saul/?focus=programs#experienceLedger",
        ROOT / "saul" / "cv" / "customer-education" / "index.html": "/saul/?focus=customer-education#experienceLedger",
        ROOT / "saul" / "cv" / "arts-culture" / "index.html": "/saul/?focus=arts-culture#experienceLedger",
        ROOT / "saul" / "cv" / "performance" / "index.html": "/saul/?focus=performance#experienceLedger",
        ROOT / "saul" / "cv" / "community" / "index.html": "/saul/?focus=community#experienceLedger",
        ROOT / "saul" / "cv" / "volunteer-events" / "index.html": "/saul/?focus=volunteer-events#experienceLedger",
        ROOT / "saul" / "cv" / "education" / "index.html": "/saul/?focus=education#experienceLedger",
        ROOT / "saul" / "cv" / "portfolio" / "index.html": "/saul/?archive=portfolio#careerArchive",
        ROOT / "saul" / "hospitality" / "index.html": "/saul/?focus=hospitality#experienceLedger",
        ROOT / "saul" / "kitchen" / "index.html": "/saul/?focus=hospitality#experienceLedger",
        ROOT / "saul" / "performance" / "index.html": "/saul/?focus=performance#experienceLedger",
        ROOT / "saul" / "portfolio" / "index.html": "/saul/?archive=portfolio#careerArchive",
        ROOT / "saul" / "teaching" / "education" / "index.html": "/saul/?focus=teaching,education#experienceLedger",
        ROOT / "saul" / "kitchen" / "community" / "index.html": "/saul/?focus=hospitality,community#experienceLedger",
    }
    redirect_template = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta content="width=device-width,initial-scale=1" name="viewport">
<meta content="0; url={destination}" http-equiv="refresh">
<meta content="noindex,follow" name="robots">
<link href="https://seminarschools.com{destination}" rel="canonical">
<script src="/js/theme-init.js"></script>
<link rel="stylesheet" href="/css/alive.css">
<link rel="stylesheet" href="/css/site-wide-type-zoom.css?v=20260725-audit45" data-site-wide-type-zoom="20260725-audit45">
<link rel="stylesheet" href="/css/audit43-approved.css?v=20260725-audit43">
<link rel="stylesheet" href="/css/calm-ux.css?v=20260723-steady">
<title>Saul Karim Nassau — Focused CV</title>
</head>
<body data-geometry="indra-web" data-indra-intensity="0.075" data-page-weight="light" data-route-type="cv-redirect">
<main>
<h1>Focused CV</h1>
<p data-cv-share-status="" aria-atomic="true" aria-live="polite" class="cv-spectrum__status">Opening the requested <a href="{destination}">modular CV view</a>.</p>
</main>
<script defer src="/js/mandala.js"></script>
<script defer src="/js/indra.js"></script>
</body>
</html>
"""
    for path, destination in route_destinations.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            redirect_template.format(destination=esc(destination)),
            encoding="utf-8",
        )


def update_redirects() -> None:
    path = ROOT / "_redirects"
    source = path.read_text(encoding="utf-8")
    source = re.sub(
        r"(?ms)^# Saul modular application-CV routes\n.*?(?=^/saul/\*)",
        "",
        source,
    )
    source = re.sub(
        r"(?m)^/saul/cv/\*.*\n/saul/cv.*\n/saul/hospitality/\*.*\n/saul/hospitality.*\n",
        "",
        source,
    )
    rules = """# Saul modular application-CV routes
/saul/cv/general/  /saul/#experienceLedger  301
/saul/cv/hospitality/  /saul/?focus=hospitality#experienceLedger  301
/saul/hospitality/  /saul/?focus=hospitality#experienceLedger  301
/saul/kitchen/  /saul/?focus=hospitality#experienceLedger  301
/saul/culinary/  /saul/?focus=hospitality#experienceLedger  301
/saul/food/  /saul/?focus=hospitality#experienceLedger  301
/saul/restaurant/  /saul/?focus=hospitality#experienceLedger  301
/saul/cv/research/  /saul/?focus=research#experienceLedger  301
/saul/cv/teaching/  /saul/?focus=teaching#experienceLedger  301
/saul/cv/programs/  /saul/?focus=programs#experienceLedger  301
/saul/cv/customer-education/  /saul/?focus=customer-education#experienceLedger  301
/saul/cv/arts-culture/  /saul/?focus=arts-culture#experienceLedger  301
/saul/cv/performance/  /saul/?focus=performance#experienceLedger  301
/saul/performance/  /saul/?focus=performance#experienceLedger  301
/saul/theatre/  /saul/?focus=performance#experienceLedger  301
/saul/theater/  /saul/?focus=performance#experienceLedger  301
/saul/screenarts/  /saul/?focus=performance#experienceLedger  301
/saul/cv/community/  /saul/?focus=community#experienceLedger  301
/saul/cv/volunteer-events/  /saul/?focus=volunteer-events#experienceLedger  301
/saul/cv/education/  /saul/?focus=education#experienceLedger  301
/saul/teaching/education/  /saul/?focus=teaching,education#experienceLedger  301
/saul/kitchen/community/  /saul/?focus=hospitality,community#experienceLedger  301
/saul/cv/portfolio/  /saul/?archive=portfolio#careerArchive  301
/saul/portfolio/  /saul/?archive=portfolio#careerArchive  301
/saul/projects/  /saul/?archive=portfolio#careerArchive  301
/saul/seminarschools/  /saul/?archive=portfolio#careerArchive  301
"""
    wildcard = "/saul/*       /saul/index.html  200"
    source = source.replace(wildcard, rules + wildcard, 1)
    path.write_text(source, encoding="utf-8")


def main() -> None:
    # Netlify publishes the committed, already-verified DOCX/PDF download set.
    # Rebuilding those binary documents requires python-docx, pypdf, ReportLab,
    # LibreOffice, and project fonts that are intentionally outside the static
    # site build image. The verifier immediately following this script still
    # rejects missing or altered committed outputs.
    reuse_generated_documents = (
        "--reuse-generated-documents" in sys.argv
        or os.environ.get("npm_lifecycle_event", "").strip() == "build"
        or os.environ.get("NETLIFY", "").strip().lower() in {"1", "true", "yes"}
    )
    if not reuse_generated_documents:
        subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "build-saul-cv-outputs.py")],
            check=True,
        )
    else:
        print("Static-site build: reusing committed, verified Saul CV document outputs.")
    clean_legacy_canonical()
    synchronize_legacy_downloads()
    retire_focused_routes()
    update_redirects()
    update_page(ROOT / "saul" / "index.html")
    subprocess.run(
        ["node", str(ROOT / "scripts" / "export-saul-cv-records.js")],
        check=True,
    )
    print("Built the ultimate /saul application CV from one verified data source.")


if __name__ == "__main__":
    main()
