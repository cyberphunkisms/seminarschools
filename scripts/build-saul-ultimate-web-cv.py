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
    return f"""<div class="cv-downloads{compact_class}" aria-label="CV downloads">
<div class="cv-downloads__heading"><span>CV downloads</span><strong>Professional &amp; full-history formats</strong></div>
<div class="cv-downloads__edition"><span>Professional CV</span><a aria-label="Professional CV in PDF format" class="cv-downloads__primary" href="{esc(downloads['proton_pdf'])}">PDF</a><a aria-label="Professional CV in Word format" href="{esc(downloads['proton_docx'])}">Word</a></div>
<div class="cv-downloads__edition"><span>Full career history</span><a aria-label="Full career history in PDF format" href="/saul/downloads/saul-karim-nassau-complete-career-archive-cv.pdf">PDF</a></div>
</div>"""


def evidence_highlights() -> str:
    rows = []
    for index, highlight in enumerate(DATA.get("public_highlights", []), start=1):
        rows.append(
            f"""<li class="cv-evidence__item" data-evidence-id="{esc(highlight['id'])}" data-focus="{esc(' '.join(highlight['focus']))}">
<span aria-hidden="true" class="cv-evidence__number">{index:02d}</span>
<div><h3>{esc(highlight['title'])}</h3><p>{esc(highlight['body'])}</p></div>
</li>"""
        )
    return f"""<section class="cv-evidence" id="evidenceHighlights" aria-labelledby="evidenceHighlightsHeading">
<div class="cv-evidence__heading"><div><span>Selected evidence</span><h2 id="evidenceHighlightsHeading">How the work was done</h2></div><p>Specific examples across education, volunteer management, programs, events, research, accessibility, arts &amp; service operations.</p></div>
<ol class="cv-evidence__list">{''.join(rows)}</ol>
</section>"""


def focus_controls() -> str:
    modules = DATA["focus_modules"]
    application_modules = [
        module
        for module in modules
        if not module.get("archive_only") and not module.get("default_view")
    ]
    portfolio = next(module for module in modules if module.get("archive_only"))
    controls = [
        '<button aria-pressed="true" class="cv-focus__all" data-focus-reset type="button">All experience</button>'
    ]
    for module in application_modules:
        controls.append(
            f"""<label class="cv-focus__option" style="--focus-color:{esc(module['color'])}">
<input data-focus-input type="checkbox" value="{esc(module['id'])}"/><span>{esc(module['short_label'])}</span>
</label>"""
        )
    controls.append(
        f"""<a class="cv-focus__portfolio" href="/saul/?archive=portfolio#careerArchive" style="--focus-color:{esc(portfolio['color'])}">{esc(portfolio['short_label'])}<span>Full history</span></a>"""
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
<div class="cv-focus__heading"><div><span>Experience by field</span><h2 id="cvFocusHeading">Explore relevant experience</h2></div><p data-focus-summary>Select one or more fields to narrow the evidence, skills &amp; work history below.</p></div>
<fieldset class="cv-focus__controls" aria-controls="experienceLedger"><legend class="cv-ultimate__sr-only">Experience fields</legend>{''.join(controls)}</fieldset>
<div class="cv-focus__status"><p data-cv-share-status="" aria-atomic="true" aria-live="polite" class="cv-spectrum__status">Showing <strong data-visible-count>{total_experiences()}</strong> of <strong>{total_experiences()}</strong> experiences</p><a data-focus-pdf href="/saul/downloads/saul-karim-nassau-general-cv.pdf">Download general CV</a><button data-focus-print hidden type="button">Print selected view</button><button data-copy-focus type="button">Copy link to this view</button></div>
<script id="cvFocusData" type="application/json">{module_json}</script>
</section>"""


def build_cv_html() -> str:
    contact = DATA["contact"]
    experiences = "".join(experience_section(section) for section in DATA["experience_sections"])
    skills = "".join(
        f'<li data-core-skill="{esc(skill)}">{esc(skill)}</li>'
        for skill in DATA.get("web_core_skills", DATA["core_skills"])
    )
    details = [
        ("Education", DATA["education"]),
        ("Credentials", DATA.get("web_credentials", DATA["credentials"])),
        ("Professional Learning", DATA["professional_learning"]),
        ("Methods & Tools", DATA.get("web_methods_tools", DATA["methods_tools"])),
        ("Languages", DATA.get("web_languages", DATA["languages"])),
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
<p class="cv-ultimate__profile">{esc(DATA.get('web_profile', DATA['profile']))}</p>
<ul class="cv-ultimate__facts" aria-label="Career summary">
{''.join(f"<li><strong>{esc(fact['value'])}</strong><span>{esc(fact['label'])}</span></li>" for fact in DATA.get('impact_facts', []))}
</ul>
{download_controls(compact=True)}
</div>
</header>
<a class="cv-ultimate__curriculum-band" href="#courses"><span>Curriculum scope</span><strong>OSSD · IB · AP · A Level · ESL · IELTS · STEM · Humanities · University Preparation</strong><span>See every course ↓</span></a>
{focus_controls()}
{evidence_highlights()}
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
<footer class="cv-ultimate__footer">
<a href="{esc(contact['reviews_url'])}">Reviews {esc(contact['reviews_label'])}</a>
<span aria-hidden="true">|</span>
<span>References available on request</span>
</footer>
</section>"""


def update_metadata(source: str) -> str:
    contact = DATA["contact"]
    title = "Saul Karim Nassau | Educator, Program Coordinator & Community Organizer"
    description = (
        "Toronto educator, program coordinator & community organizer with 12+ years of "
        "international teaching experience, 2,000+ learners supported, and extensive "
        "volunteer, event, research & public-information work."
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
        "@id": contact["site_url"] + "#profile",
        "name": title,
        "url": contact["site_url"],
        "inLanguage": "en",
        "mainEntity": {
            "@type": "Person",
            "@id": contact["site_url"] + "#saul-karim-nassau",
            "name": "Saul Karim M Hosaini Nassau",
            "honorificSuffix": "MA",
            "email": contact["public_email"],
            "telephone": contact["phone"],
            "jobTitle": "Educator, Program Coordinator and Community Organizer",
            "address": {
                "@type": "PostalAddress",
                "addressLocality": "Toronto",
                "addressRegion": "Ontario",
                "addressCountry": "CA",
            },
        },
    }
    # Own the complete JSON-LD insertion boundary, including whitespace.
    # Removing only the tag left one newline behind on every generator pass.
    source = re.sub(
        r'\s*<script type="application/ld\+json">.*?</script>\s*(?=</head>)',
        "\n",
        source,
        count=1,
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
        'en: "English · Farsi (advanced) · French & Mandarin (basic)"': (
            'en: "English · Farsi (advanced speaking and reading; slower written communication) · French & Mandarin (basic)"'
        ),
        'zh: "英語 · 波斯語（進階）· 法語及普通話（基礎）"': (
            'zh: "英語 · 波斯語（口說及閱讀進階；書寫較慢）· 法語及普通話（基礎）"'
        ),
        'zhs: "英语 · 波斯语（高级）· 法语及普通话（基础）"': (
            'zhs: "英语 · 波斯语（口语及阅读高级；书写较慢）· 法语及普通话（基础）"'
        ),
        'fa: "انگلیسی · فارسی (پیشرفته) · فرانسوی و ماندارین (پایه)"': (
            'fa: "انگلیسی · فارسی (گفتار و خواندن پیشرفته؛ نوشتن آهسته‌تر) · فرانسوی و ماندارین (پایه)"'
        ),
        'fr: "Anglais · Farsi (avancé) · Français et mandarin (élémentaires)"': (
            'fr: "Anglais · Farsi (expression orale et lecture avancées; écriture plus lente) · Français et mandarin (élémentaires)"'
        ),
        "Google Forms, questionnaire design, and thematic response review": (
            "Google Forms, questionnaires, feedback review, and program improvement"
        ),
        "Excel formulas, tables, charts, budgeting, and descriptive analysis": (
            "Excel budgeting, formulas, tables, charts, volunteer and program tracking, and descriptive analysis"
        ),
        "Word reports, whiteboard-led seminars, workshops, and presentations": (
            "Word, PowerPoint, and Outlook for reports, workshops, presentations, and participant communication"
        ),
        "Source verification, accessibility, link integrity, and data-quality review": (
            "Source verification, accessibility, link and navigation testing, HTML, CSS, and digital publishing"
        ),
        '"en": "polymyth / AA*"': '"en": "Polymyth Research Archive"',
        '"polymyth / AA*": {': '"Polymyth Research Archive": {',
        'title:{zh:"polymyth／AA* 研究框架",zhs:"polymyth／AA* 研究框架",fa:"چارچوب پژوهشی polymyth / AA*",fr:"Cadre de recherche polymyth / AA*"}': (
            'title:{zh:"Polymyth 研究檔案",zhs:"Polymyth 研究档案",fa:"بایگانی پژوهشی Polymyth",fr:"Archive de recherche Polymyth"}'
        ),
        (
            "Research and writing framework used to organize concepts, citations, project records, "
            "and methodological rules across the website. The archive distinguishes user-authored "
            "source material from public-facing summaries."
        ): (
            "Research archive organizing concepts, citations, project records, and methodological "
            "documentation across the website."
        ),
        'desc:{zh:"用於整理全站概念、引文、專案紀錄與方法規則的研究及寫作框架。檔案把使用者撰寫的原始材料與公開摘要清楚分開。",zhs:"用于整理全站概念、引文、项目记录与方法规则的研究及写作框架。档案把用户撰写的原始材料与公开摘要清楚分开。",fa:"چارچوب پژوهش و نگارش برای سازمان‌دهی مفاهیم، ارجاعات، سوابق پروژه و قواعد روش‌شناختی سایت. بایگانی مواد اصلی کاربر را از خلاصه‌های عمومی جدا می‌کند.",fr:"Cadre de recherche et d’écriture qui organise les concepts, citations, dossiers de projet et règles méthodologiques du site. L’archive distingue les sources rédigées par l’utilisateur des résumés publics."}': (
            'desc:{zh:"整理全站概念、引文、專案紀錄與方法文件的研究檔案。",zhs:"整理全站概念、引文、项目记录与方法文件的研究档案。",fa:"بایگانی پژوهشی برای سازمان‌دهی مفاهیم، ارجاعات، سوابق پروژه و اسناد روش‌شناختی سایت.",fr:"Archive de recherche organisant les concepts, citations, dossiers de projet et documents méthodologiques du site."}'
        ),
        '"en": "Community Development Manager, Campus Crops Farmers Market"': (
            '"en": "Community Development Manager, Campus Crops at McGill"'
        ),
        '"en": "Budgeting, volunteer coordination, partner relationships"': (
            '"en": "Approximately 20 core volunteers; full-cycle coordination; associated farmers\' market; budgeting"'
        ),
        '"zh": "志工協調、預算、夥伴網絡"': (
            '"zh": "約二十名核心志願者；全流程協調；相關農夫市集；預算"'
        ),
        '"zhs": "志愿者协调、预算、伙伴网络"': (
            '"zhs": "约二十名核心志愿者；全流程协调；相关农夫市集；预算"'
        ),
        '"fa": "هماهنگی، بودجه، شبکه"': (
            '"fa": "حدود بیست داوطلب اصلی؛ هماهنگی کامل؛ بازار کشاورزان وابسته؛ بودجه"'
        ),
        '"fr": "Coordination, budgétisation, réseau"': (
            '"fr": "Environ vingt bénévoles principaux; cycle complet; marché fermier associé; budget"'
        ),
        (
            "Paid community development role with a student-run urban agriculture initiative at "
            "McGill. Redesigned budgeting and expense tracking in Excel, coordinated volunteers, "
            "supported community programming, and developed partner relationships."
        ): (
            "Paid community development role with Campus Crops at McGill. Personally managed "
            "recruitment, interviewing, orientation, role placement, ongoing support, evaluation, "
            "and records for approximately 20 core volunteers, plus additional recruitment and "
            "coordination for the associated farmers' market. Managed budgets, partner relationships, "
            "public programs, and on-site operations, and rebuilt expense tracking in Excel."
        ),
        '"zh": "麥基爾大學學生自主都市農業計畫。"': (
            '"zh": "在麥基爾大學 Campus Crops 的受薪社區發展職務。親自管理約二十名核心志願者的招募、面試、導入、職務安排、持續支援、評估與紀錄，並另行負責相關農夫市集的招募與協調。管理預算、夥伴關係、公共項目與現場營運，並以 Excel 重建支出追蹤。"'
        ),
        '"zhs": "麦吉尔大学学生自主都市农业计划。"': (
            '"zhs": "在麦吉尔大学 Campus Crops 的受薪社区发展职务。亲自管理约二十名核心志愿者的招募、面试、导入、职务安排、持续支持、评估与记录，并另行负责相关农夫市集的招募与协调。管理预算、伙伴关系、公共项目与现场运营，并以 Excel 重建支出追踪。"'
        ),
        '"fa": "طرح کشاورزی شهری دانشجویی در مک‌گیل."': (
            '"fa": "نقش حرفه‌ای توسعهٔ اجتماعی در Campus Crops دانشگاه McGill. جذب، مصاحبه، معارفه، جایابی، پشتیبانی مستمر، ارزیابی و سوابق حدود بیست داوطلب اصلی را شخصاً مدیریت کردم و جذب و هماهنگی بیشتری برای بازار کشاورزان وابسته انجام دادم. بودجه، روابط با شرکا، برنامه‌های عمومی و عملیات محل را اداره و پیگیری هزینه‌ها را در Excel بازسازی کردم."'
        ),
        '"fr": "Initiative d\'agriculture urbaine étudiante à McGill."': (
            '"fr": "Poste rémunéré de développement communautaire à Campus Crops, McGill. J\'ai géré personnellement le recrutement, les entrevues, l\'orientation, l\'affectation, le soutien continu, l\'évaluation et les dossiers d\'environ vingt bénévoles principaux, ainsi qu\'un recrutement et une coordination supplémentaires pour le marché fermier associé. J\'ai géré les budgets, les partenaires, les programmes publics et les opérations sur place, et reconstruit le suivi des dépenses dans Excel."'
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
        '"en": "Bronze Cross Swimming Certificate"': (
            '"en": "Bronze Cross & First Aid Training (Historical)"'
        ),
        '"zh": "銅十字游泳證書"': '"zh": "銅十字與急救訓練（歷史）"',
        '"zhs": "铜十字游泳证书"': '"zhs": "铜十字与急救训练（历史）"',
        '"fa": "گواهینامه شنای برنز کراس"': (
            '"fa": "آموزش تاریخی برنز کراس و کمک‌های اولیه"'
        ),
        '"fr": "Certificat Croix de bronze"': (
            '"fr": "Formation historique Croix de bronze et premiers soins"'
        ),
        '"Bronze Cross Swimming Certificate": {': (
            '"Bronze Cross & First Aid Training (Historical)": {'
        ),
        '"Completed at age 16"': '"c. 2006 (not current)"',
        '"en": "Lifesaving and water safety"': (
            '"en": "Historical lifesaving and water-safety training; not current"'
        ),
        (
            "Completed Bronze Cross and First Aid at age 16, developing lifesaving "
            "and water-safety skills."
        ): (
            "Completed Bronze Cross and associated First Aid training c. 2006; "
            "this training is not current."
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
    archive_letters = DATA.get("archive_letters")
    if archive_letters:
        letters_payload = json.dumps(archive_letters, ensure_ascii=False, indent=2)
        pattern = r"const LETTERS = \{.*?\n\};\n(?=// ={10,}\n// URL ROUTING)"
        if not re.search(pattern, source, flags=re.S):
            raise RuntimeError("Could not replace front-facing CV archive letters")
        source = re.sub(
            pattern,
            "const LETTERS = " + letters_payload + ";\n",
            source,
            count=1,
            flags=re.S,
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
    # Own this complete insertion boundary as well. The generator runs twice
    # in the canonical build, so leaving its old newline caused repeat growth.
    source = re.sub(
        r'\s*<script\b(?=[^>]*\bsrc=["\']/saul/assets/saul-ultimate-cv-modules-2026\.js\?[^"\']*["\'])[^>]*></script>\s*(?=</body>)',
        "\n",
        source,
        count=1,
        flags=re.S,
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
        '<nav aria-label="CV sections" class="cv-local-nav" data-cv-local-nav=""><a aria-current="location" href="#cvOverview">CV</a><a href="#places">Map</a><a href="#careerArchive">Historical Archive</a><a href="#eduHead">Education</a><a href="#methodsHead">Methods</a></nav>',
        '<nav aria-label="CV sections" class="cv-local-nav" data-cv-local-nav=""><a aria-current="location" href="#cvOverview">CV</a><a href="#evidenceHighlights">Evidence</a><a href="#experienceLedger">Experience</a><a href="#educationLearningHeading">Education</a><a href="#places">Map</a><a href="#careerArchive">Full history</a></nav>',
    )
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
<script src="/js/theme-init.js?v=20260723-steady"></script>
<link rel="stylesheet" href="/css/alive.css?v=20260806-front-facing-geometry">
<link rel="stylesheet" href="/css/site-wide-type-zoom.css?v=20260725-audit45" data-site-wide-type-zoom="20260725-audit45">
<link rel="stylesheet" href="/css/audit43-approved.css?v=20260725-audit43">
<link rel="stylesheet" href="/css/calm-ux.css?v=20260723-steady">
<title>Saul Karim Nassau — Relevant Experience</title>
</head>
<body data-geometry="indra-web" data-indra-intensity="0.075" data-page-weight="light" data-route-type="cv-redirect" data-geometry-role="return">
<main>
<h1>Saul Nassau — Relevant Experience</h1>
<p data-cv-share-status="" aria-atomic="true" aria-live="polite" class="cv-spectrum__status">Opening the <a href="{destination}">selected experience view</a>.</p>
</main>
<script defer src="/js/mandala.js?v=20260806-front-facing-geometry"></script>
<script defer src="/js/indra.js?v=20260806-front-facing-geometry"></script>
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
