#!/usr/bin/env python3
"""Generate Audit 45's dedicated localized route trees.

Owned interface copy is localized.  Organizer-authored Polymythcal text is
preserved byte-for-byte and receives an explicit language boundary.  English
is the versioned source of truth for Leizu and Saul; every localized route
records its source hash and review state.
"""
from __future__ import annotations

from pathlib import Path
from urllib.parse import quote, unquote
import hashlib
import html as htmllib
import json
import os
import re
import shutil
import sys
import time
import datetime
from zoneinfo import ZoneInfo
from geometry_asset_version import geometry_asset_version, geometry_body_attributes

ROOT = Path(__file__).resolve().parents[1]
SITE = "https://seminarschools.com"
AUDIT_VERSION = "20260725-audit45"
AUDIT43_VERSION = "20260725-audit43"
GEOMETRY_ASSET_VERSION = geometry_asset_version(ROOT)
POLYMYTHCAL_ASSET_VERSION = str(
    json.loads((ROOT / "RELEASE_MANIFEST.json").read_text(encoding="utf-8")).get(
        "polymythcal_asset_version"
    )
    or ""
)
if not re.fullmatch(r"[0-9]{8}-[a-z0-9-]+", POLYMYTHCAL_ASSET_VERSION):
    raise SystemExit("RELEASE_MANIFEST.json has no valid polymythcal_asset_version")
TYPE_ZOOM_SOURCE = (ROOT / "scripts" / "apply-sitewide-type-zoom-link.js").read_text(encoding="utf-8")
TYPE_ZOOM_MATCH = re.search(r"const BUILD = ['\"]([^'\"]+)['\"]", TYPE_ZOOM_SOURCE)
TYPE_ZOOM_VERSION = TYPE_ZOOM_MATCH.group(1) if TYPE_ZOOM_MATCH else ""
if not re.fullmatch(r"[0-9]{8}-[a-z0-9-]+", TYPE_ZOOM_VERSION):
    raise SystemExit("apply-sitewide-type-zoom-link.js has no valid BUILD version")
# Release workspaces may reconcile the extracted 2034-stamped source tree
# between subprocesses. Generated Audit 45 outputs use a later deterministic
# floor so their verified content remains authoritative through packaging.
FUTURE_OUTPUT_MTIME = 2_051_222_400.0  # 2035-01-01T00:00:00Z
LEIZU_LOCALES = {
    "fr": ("fr", "ltr"),
    "zh-hant": ("zh-Hant", "ltr"),
    "zh-hans": ("zh-Hans", "ltr"),
    "fa": ("fa", "rtl"),
}
SAUL_LOCALES = LEIZU_LOCALES
SAUL_PERSON_ID = f"{SITE}/saul/#saul-karim-nassau"
FOCUSED = (
    "writingclub", "writingkids", "writingjuniors", "writingteens",
    "writinggrads", "university", "philosophy", "humanities", "cfps",
    "lectures", "fellowships",
)


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and path.read_text(encoding="utf-8") == content:
        return
    if not path.exists() or path.read_text(encoding="utf-8") != content:
        prior_mtime = path.stat().st_mtime if path.exists() else None
        path.write_text(content, encoding="utf-8")
        # Artifact workspaces may reconcile an extracted file at process
        # boundaries using its future release-stamp mtime. Preserve that mtime
        # after regeneration so correct localized output cannot be replaced by
        # the older stamped copy before public parity runs.
        regenerated_mtime = FUTURE_OUTPUT_MTIME
        if prior_mtime is not None and prior_mtime > time.time() + 60:
            regenerated_mtime = max(regenerated_mtime, prior_mtime + 2)
        os.utime(path, (regenerated_mtime, regenerated_mtime))


def meta_escape(value: object) -> str:
    return htmllib.escape(str(value or ""), quote=True)


def replace_or_add_meta(text: str, name: str, value: str, *, prop: bool = False) -> str:
    attr = "property" if prop else "name"
    pattern = re.compile(
        rf'<meta\b(?=[^>]*\b{attr}=["\']{re.escape(name)}["\'])[^>]*>',
        re.I,
    )
    tag = f'<meta {attr}="{name}" content="{meta_escape(value)}">'
    return pattern.sub(tag, text, count=1) if pattern.search(text) else text.replace("</head>", tag + "\n</head>", 1)


def replace_canonical(text: str, url: str) -> str:
    tag = f'<link rel="canonical" href="{meta_escape(url)}">'
    pattern = re.compile(r'<link\b(?=[^>]*\brel=["\']canonical["\'])[^>]*>', re.I)
    return pattern.sub(tag, text, count=1) if pattern.search(text) else text.replace("</head>", tag + "\n</head>", 1)


def replace_title(text: str, title: str) -> str:
    return re.sub(r"<title>[\s\S]*?</title>", f"<title>{htmllib.escape(title)}</title>", text, count=1, flags=re.I)


def localize_saul_profile_schema(text: str, url: str, name: str, language: str) -> str:
    """Give each Saul locale its own ProfilePage while preserving one Person."""
    pattern = re.compile(
        r'(<script\b(?=[^>]*\btype=["\']application/ld\+json["\'])[^>]*>)'
        r'(?P<payload>[\s\S]*?)'
        r'(</script>)',
        re.I,
    )
    replaced = False

    def replacement(match: re.Match[str]) -> str:
        nonlocal replaced
        try:
            schema = json.loads(match.group("payload"))
        except json.JSONDecodeError:
            return match.group(0)
        schema_types = schema.get("@type") if isinstance(schema, dict) else None
        if not (
            schema_types == "ProfilePage"
            or isinstance(schema_types, list) and "ProfilePage" in schema_types
        ):
            return match.group(0)
        main_entity = schema.get("mainEntity")
        if not isinstance(main_entity, dict):
            raise RuntimeError("Saul ProfilePage JSON-LD has no object mainEntity")
        schema.update(
            {
                "@id": f"{url}#profile",
                "url": url,
                "name": name,
                "inLanguage": language,
            }
        )
        main_entity["@id"] = SAUL_PERSON_ID
        replaced = True
        payload = json.dumps(schema, ensure_ascii=False, separators=(",", ":")).replace(
            "</", "<\\/"
        )
        return match.group(1) + payload + match.group(3)

    localized = pattern.sub(replacement, text)
    if not replaced:
        raise RuntimeError("Could not find Saul ProfilePage JSON-LD to localize")
    return localized


def replace_hreflang_block(text: str, links: list[tuple[str, str]]) -> str:
    text = re.sub(
        r'<link\b(?=[^>]*\brel=["\']alternate["\'])(?=[^>]*\bhreflang=)[^>]*>\s*',
        "",
        text,
        flags=re.I,
    )
    block = "\n".join(
        f'<link rel="alternate" hreflang="{lang}" href="{meta_escape(url)}">'
        for lang, url in links
    )
    stylesheet = re.search(
        r'<link\b(?=[^>]*\brel=["\'][^"\']*\bstylesheet\b[^"\']*["\'])[^>]*>',
        text,
        re.I,
    )
    if stylesheet:
        return text[:stylesheet.start()] + block + "\n" + text[stylesheet.start():]
    return text.replace("</head>", block + "\n</head>", 1)


def add_governance_meta(text: str, source_path: str, source_sha: str, status: str) -> str:
    tags = (
        f'<meta name="translation-source" content="{meta_escape(source_path)}">\n'
        f'<meta name="translation-source-sha256" content="{source_sha}">\n'
        f'<meta name="translation-status" content="{status}">\n'
        f'<meta name="translation-policy" content="english-source-of-truth; no-silent-organizer-translation">'
    )
    text = re.sub(r'<meta name="translation-(?:source|source-sha256|status|policy)"[^>]*>\s*', "", text)
    stylesheet = re.search(
        r'<link\b(?=[^>]*\brel=["\'][^"\']*\bstylesheet\b[^"\']*["\'])[^>]*>',
        text,
        re.I,
    )
    if stylesheet:
        return text[:stylesheet.start()] + tags + "\n" + text[stylesheet.start():]
    return text.replace("</head>", tags + "\n</head>", 1)


def place_style_before_shared_layers(text: str, style_id: str) -> str:
    """Keep route-specific CSS ahead of the frozen shared cascade layers."""
    style_match = re.search(
        rf'<style\b(?=[^>]*\bid=["\']{re.escape(style_id)}["\'])[^>]*>[\s\S]*?</style>',
        text,
        re.I,
    )
    if not style_match:
        return text
    style = style_match.group(0).strip()
    text = text[:style_match.start()].rstrip() + "\n" + text[style_match.end():].lstrip()
    shared = re.search(
        r'<link\b[^>]*href=["\'][^"\']*/css/(?:audit43-approved|calm-ux)\.css[^"\']*["\'][^>]*>',
        text,
        re.I,
    )
    if not shared:
        return text.replace("</head>", style + "\n</head>", 1)
    prefix = text[:shared.start()].rstrip()
    return prefix + "\n" + style + "\n" + text[shared.start():]


def leizu_links(route_suffix: str = "") -> list[tuple[str, str]]:
    suffix = route_suffix.strip("/")
    suffix = f"{suffix}/" if suffix else ""
    return [
        ("en", f"{SITE}/leizu/{suffix}"),
        ("fr", f"{SITE}/leizu/fr/{suffix}"),
        ("zh-Hant", f"{SITE}/leizu/zh-hant/{suffix}"),
        ("zh-Hans", f"{SITE}/leizu/zh-hans/{suffix}"),
        ("fa", f"{SITE}/leizu/fa/{suffix}"),
        ("x-default", f"{SITE}/leizu/{suffix}"),
    ]


def set_tag_attribute(tag: str, name: str, value: str) -> str:
    escaped = meta_escape(value)
    pattern = re.compile(rf'\s{name}=["\'][^"\']*["\']', re.I)
    if pattern.search(tag):
        return pattern.sub(f' {name}="{escaped}"', tag, count=1)
    return tag[:-1] + f' {name}="{escaped}">'


def replace_keyed_element(text: str, key: str, value: str) -> str:
    pattern = re.compile(
        r'(<(?P<tag>[a-z][a-z0-9:-]*)\b(?=[^>]*\bdata-i18n=["\']'
        + re.escape(key)
        + r'["\'])[^>]*>)(?P<body>[\s\S]*?)(</(?P=tag)>)',
        re.I,
    )

    def replacement(match: re.Match[str]) -> str:
        raw = str(value) if "data-i18n-html" in match.group(1) else htmllib.escape(str(value), quote=False)
        return match.group(1) + raw + match.group(4)

    return pattern.sub(replacement, text, count=1)


def localize_leizu_navigation(text: str, segment: str) -> str:
    def replacement(match: re.Match[str]) -> str:
        attribute, quote_mark, suffix = match.groups()
        if suffix.startswith(("fr/", "zh-hant/", "zh-hans/", "fa/")):
            return match.group(0)
        # Shared release assets stay at their canonical URL. Only page
        # navigation and form actions belong under the localized route tree.
        path_only = suffix.split("?", 1)[0].split("#", 1)[0]
        if path_only.startswith("assets/") or re.search(r"(?:^|/)[^/]+\.[a-z0-9]{2,8}$", path_only, re.I):
            return match.group(0)
        return f"{attribute}={quote_mark}/leizu/{segment}/{suffix}"

    text = re.sub(
        r'\b(href|action)=(["\'])/leizu/([^"\']*)',
        replacement,
        text,
        flags=re.I,
    )
    text = re.sub(
        r'\bhref=(["\'])/saul/\1',
        lambda match: f'href={match.group(1)}/saul/{segment}/{match.group(1)}',
        text,
        flags=re.I,
    )
    return text


def statically_localize_leizu_home(text: str, segment: str) -> str:
    source = ROOT / "data" / "leizu-i18n-audit45.json"
    if not source.exists():
        raise RuntimeError("Run scripts/build-leizu-i18n-source.js before localized routes.")
    payload = json.loads(source.read_text(encoding="utf-8"))
    key = {"fr": "fr", "zh-hant": "zh", "zh-hans": "zhs", "fa": "fa"}[segment]
    dictionary = payload["locales"][key]
    text = re.sub(
        r"<html\b[^>]*>",
        lambda match: set_tag_attribute(match.group(0), "data-lang", key),
        text,
        count=1,
        flags=re.I,
    )
    for translation_key, value in dictionary.items():
        text = replace_keyed_element(text, translation_key, str(value))
        for attribute, source_attribute in (
            ("aria-label", "data-i18n-aria"),
            ("title", "data-i18n-title"),
        ):
            pattern = re.compile(
                rf'(<[a-z][^>]*\b{source_attribute}=["\']{re.escape(translation_key)}["\'][^>]*?)'
                rf'\s{attribute}=["\'][^"\']*["\']([^>]*>)',
                re.I,
            )
            text = pattern.sub(
                lambda match: match.group(1) + f' {attribute}="{meta_escape(value)}"' + match.group(2),
                text,
                count=1,
            )
    return text


def statically_localize_polymythcal_shell(text: str, english_url: str) -> str:
    source = ROOT / "data" / "polymythcal-static-i18n-audit45.json"
    if not source.exists():
        raise RuntimeError("Run scripts/build-polymythcal-i18n-source.js before localized routes.")
    dictionary = json.loads(source.read_text(encoding="utf-8"))["strings"]
    for source_text, translated in sorted(dictionary.items(), key=lambda item: len(item[0]), reverse=True):
        pattern = re.compile(
            r"(?<=>)(?P<lead>\s*)" + re.escape(source_text) + r"(?P<trail>\s*)(?=<)",
            re.I if source_text.isascii() else 0,
        )
        text = pattern.sub(
            lambda match: match.group("lead") + htmllib.escape(str(translated), quote=False) + match.group("trail"),
            text,
        )
        for attribute in ("aria-label", "data-label"):
            text = re.sub(
                rf'({attribute}=["\']){re.escape(source_text)}(["\'])',
                lambda match: match.group(1) + meta_escape(translated) + match.group(2),
                text,
                flags=re.I,
            )
    text = re.sub(
        r'(<input\b[^>]*\bid=["\'](?:pmSearch|pmdSearch)["\'][^>]*\bplaceholder=["\'])[^"\']*(["\'])',
        r"\g<1>Rechercher événements, lieux ou thèmes\g<2>",
        text,
        count=1,
        flags=re.I,
    )
    text = text.replace(
        "Use exact words, quoted phrases, forward prefixes of at least five characters, or a field such as title:, person:, organizer:, place:, topic:, or format:. Similar spellings appear only as suggestions you choose. Press / to focus search.",
        "Utilisez des mots exacts, des expressions entre guillemets, des préfixes progressifs d’au moins cinq caractères ou un champ comme titre:, personne:, organisme:, lieu:, sujet: ou forme:. Les graphies proches ne paraissent que comme suggestions à choisir. Appuyez sur / pour atteindre la recherche.",
    )
    language_pattern = re.compile(
        r'(<a\b[^>]*\bid=["\']pmLanguageLink["\'][^>]*>)[\s\S]*?(</a>)',
        re.I,
    )

    def language_replacement(match: re.Match[str]) -> str:
        opening = set_tag_attribute(match.group(1), "href", english_url)
        opening = set_tag_attribute(opening, "hreflang", "en-CA")
        return opening + "English" + match.group(2)

    text = language_pattern.sub(language_replacement, text, count=1)
    # A French shell must remain French through every calendar utility flow.
    # Organizer-authored event text remains verbatim on the generated wrapper.
    text = re.sub(
        r'(\bhref=["\'])/polymythseminars/(?!fr/)(events/|submit/|correct/|subscribe/)',
        r"\1/polymythseminars/fr/\2",
        text,
        flags=re.I,
    )
    text = re.sub(
        r'(\bhref=["\'])/polymythseminars/(["\'])',
        r"\1/polymythseminars/fr/\2",
        text,
        flags=re.I,
    )
    # Restore the language switch after the broad navigation rewrite.
    return language_pattern.sub(language_replacement, text, count=1)


LEIZU_HOME_META = {
    "fr": (
        "Leizu Academy · tutorat privé en ligne et à Toronto",
        "Tutorat privé en lecture, rédaction, recherche, OSSD et IB, en ligne et à Toronto.",
    ),
    "zh-hant": (
        "嫘祖學院 · 多倫多及線上私人輔導",
        "多倫多及線上私人輔導：閱讀、寫作、研究、OSSD 與 IB。",
    ),
    "zh-hans": (
        "嫘祖学院 · 多伦多及线上私人辅导",
        "多伦多及线上私人辅导：阅读、写作、研究、OSSD 与 IB。",
    ),
    "fa": (
        "آکادمی لیزو · تدریس خصوصی آنلاین و در تورنتو",
        "تدریس خصوصی خواندن، نوشتن، پژوهش، OSSD و IB به‌صورت آنلاین و در تورنتو.",
    ),
}


LEIZU_SUMMARIES = {
    "intake": {
        "fr": ("Commencer avec Leizu", "Décrivez le cours, la difficulté ou l’objectif de l’élève. Le formulaire ci-dessous conserve le parcours et le forfait choisis. Saul lit chaque demande et répond habituellement dans un délai d’un jour."),
        "zh-hant": ("開始 Leizu 學習", "請說明學生的課程、困難或目標。下列表格會保留已選的學習路徑與方案。Saul 親自閱讀每份申請，通常在一天內回覆。"),
        "zh-hans": ("开始 Leizu 学习", "请说明学生的课程、困难或目标。下列表格会保留已选的学习路径与方案。Saul 亲自阅读每份申请，通常在一天内回复。"),
        "fa": ("شروع با لیزو", "درس، دشواری یا هدف دانش‌آموز را توضیح دهید. فرم زیر مسیر و طرح انتخابی را نگه می‌دارد. Saul هر درخواست را شخصاً می‌خواند و معمولاً ظرف یک روز پاسخ می‌دهد."),
    },
    "booking-success": {
        "fr": ("Paiement reçu", "Le paiement Stripe est vérifié avant l’ouverture du calendrier. Après confirmation, choisissez l’heure de la séance; un courriel final confirmera la réservation."),
        "zh-hant": ("已收到付款", "開啟預約日曆前，系統會先驗證 Stripe 付款。確認後請選擇上課時間；最終確認會以電郵寄出。"),
        "zh-hans": ("已收到付款", "开启预约日历前，系统会先验证 Stripe 付款。确认后请选择上课时间；最终确认会以电子邮件寄出。"),
        "fa": ("پرداخت دریافت شد", "پیش از بازشدن تقویم، پرداخت Stripe بررسی می‌شود. پس از تأیید، زمان جلسه را انتخاب کنید؛ تأیید نهایی با ایمیل می‌رسد."),
    },
    "policies": {
        "fr": ("Politiques actuelles de Leizu", "Annulation gratuite jusqu’à 24 h; une annulation tardive sans pénalité par trimestre; Forest Year peut annuler en tout temps. Retard: grâce de 15 min. Trois absences en un mois entraînent une probation. Les cours sont en ligne par défaut; Toronto en personne coûte 5 $ de plus et le papier 5 $ de plus. Les forfaits sont payés d’avance; remboursement des séances inutilisées dans les 14 jours. L’admissibilité au séminaire exige normalement 20 à 40 séances et une préparation observable. Les plaintes écrites reçoivent une réponse sous 14 jours. Le Code des droits de la personne de l’Ontario et les lois applicables demeurent en vigueur."),
        "zh-hant": ("Leizu 現行政策", "24 小時前可免費取消；每學期一次臨時取消免罰；Forest Year 可隨時取消。遲到寬限 15 分鐘。一個月三次缺席會進入學業觀察期。課程預設線上；多倫多面授每節加 5 元，紙本材料再加 5 元。方案預付；開始後 14 天內可退未使用課節。研討班通常需 20 至 40 節私人課及可觀察的準備程度。書面投訴在 14 天內回覆。安大略人權法規及適用法律仍然有效。"),
        "zh-hans": ("Leizu 现行政策", "24 小时前可免费取消；每学期一次临时取消免罚；Forest Year 可随时取消。迟到宽限 15 分钟。一个月三次缺席会进入学业观察期。课程默认线上；多伦多面授每节加 5 元，纸本材料再加 5 元。方案预付；开始后 14 天内可退未使用课节。研讨班通常需 20 至 40 节私人课及可观察的准备程度。书面投诉在 14 天内回复。安大略人权法规及适用法律仍然有效。"),
        "fa": ("سیاست‌های جاری لیزو", "لغو تا ۲۴ ساعت پیش رایگان است؛ هر ترم یک لغو دیرهنگام بدون جریمه و برای Forest Year لغو در هر زمان ممکن است. مهلت تأخیر ۱۵ دقیقه است. سه غیبت در یک ماه به دورهٔ نظارت آموزشی می‌انجامد. کلاس‌ها پیش‌فرض آنلاین‌اند؛ حضوری تورنتو ۵ دلار و مواد کاغذی ۵ دلار اضافه دارد. بسته‌ها پیش‌پرداخت‌اند و جلسات استفاده‌نشده تا ۱۴ روز قابل بازپرداخت‌اند. ورود به سمینار معمولاً ۲۰ تا ۴۰ جلسهٔ خصوصی و آمادگی قابل مشاهده می‌خواهد. به شکایت کتبی ظرف ۱۴ روز پاسخ داده می‌شود. قانون حقوق بشر انتاریو و قوانین لازم‌الاجرا پابرجاست."),
    },
    "scholarship": {
        "fr": ("Bourses Leizu", "Une aide complète ou partielle pour les élèves sérieux dont les frais réguliers sont hors de portée. Envoyez une lettre de 200 à 500 mots sur l’élève, sa situation, son projet d’étude et l’usage de cette possibilité. Aucuns frais; réponse sous sept jours. La promesse de soutenir un futur boursier n’est jamais une dette."),
        "zh-hant": ("Leizu 獎學金", "為無法負擔一般學費但願意認真學習的學生提供全額或部分減免。請提交 200 至 500 字信件，說明學生、財務情況、學習目標及機會用途。免申請費，七天內回覆；未來回饋的承諾絕不是債務。"),
        "zh-hans": ("Leizu 奖学金", "为无法负担一般学费但愿意认真学习的学生提供全额或部分减免。请提交 200 至 500 字信件，说明学生、财务情况、学习目标及机会用途。免申请费，七天内回复；未来回馈的承诺绝不是债务。"),
        "fa": ("بورسیه‌های لیزو", "معافیت کامل یا جزئی برای دانش‌آموزان جدی که شهریهٔ معمول برایشان دسترس‌پذیر نیست. نامه‌ای ۲۰۰ تا ۵۰۰ کلمه‌ای دربارهٔ دانش‌آموز، وضعیت مالی، هدف تحصیل و استفاده از فرصت بفرستید. هزینه‌ای ندارد و ظرف هفت روز پاسخ داده می‌شود؛ تعهد حمایت آینده هرگز بدهی نیست."),
    },
    "donate": {
        "fr": ("Fonds Mulberry", "Les dons financent directement les places des boursiers: 75 $ pour une séance, 480 $ pour quatre séances, 900 $ pour un mois et environ 10 800 $ pour une année Forest. Environ 95 % vont aux frais de scolarité et 5 % au traitement et aux outils de base. Aucun reçu fiscal n’est émis actuellement."),
        "zh-hant": ("桑樹基金", "捐款直接資助獎學生名額：75 元一節、480 元四節、900 元一個月，約 10,800 元資助完整 Forest Year。約 95% 用於教學，5% 用於付款處理與基本工具。目前不提供抵稅收據。"),
        "zh-hans": ("桑树基金", "捐款直接资助奖学生名额：75 元一节、480 元四节、900 元一个月，约 10,800 元资助完整 Forest Year。约 95% 用于教学，5% 用于付款处理与基本工具。目前不提供抵税收据。"),
        "fa": ("صندوق توت", "کمک‌ها مستقیماً جای دانش‌پژوه را تأمین می‌کنند: ۷۵ دلار یک جلسه، ۴۸۰ دلار چهار جلسه، ۹۰۰ دلار یک ماه و حدود ۱۰٬۸۰۰ دلار یک سال Forest. حدود ۹۵٪ صرف آموزش و ۵٪ صرف پردازش و ابزارهای پایه می‌شود. فعلاً رسید مالیاتی صادر نمی‌شود."),
    },
    "teach": {
        "fr": ("Enseigner à Leizu", "Les enseignants fixent leurs disponibilités et leur tarif dans une fourchette recommandée et reçoivent 80 % du tarif. Paiement hebdomadaire par Stripe Connect ou Interac. Leizu recherche notamment les mathématiques OSSD/IB, les sciences IB, le français, les langues et l’informatique. Envoyez votre expérience, votre matière, votre méthode et un CV ou portfolio."),
        "zh-hant": ("在 Leizu 任教", "教師在建議範圍內設定時間與收費，獲得課費的 80%，每週透過 Stripe Connect 或 Interac 支付。目前尤其招募 OSSD／IB 數學、IB 科學、法語、其他語言與電腦科學教師。請寄送經驗、科目、教學方法及履歷或作品集。"),
        "zh-hans": ("在 Leizu 任教", "教师在建议范围内设置时间与收费，获得课费的 80%，每周通过 Stripe Connect 或 Interac 支付。目前尤其招募 OSSD／IB 数学、IB 科学、法语、其他语言与计算机科学教师。请寄送经验、科目、教学方法及履历或作品集。"),
        "fa": ("تدریس در لیزو", "معلمان زمان و نرخ خود را در بازهٔ پیشنهادی تعیین می‌کنند و ۸۰٪ نرخ جلسه را می‌گیرند؛ پرداخت هفتگی با Stripe Connect یا Interac است. لیزو به‌ویژه برای ریاضی OSSD/IB، علوم IB، فرانسه، زبان‌ها و علوم رایانه معلم می‌خواهد. تجربه، درس، روش و رزومه یا نمونه‌کار را بفرستید."),
    },
    "toronto-tutoring": {
        "fr": ("Tutorat à Toronto et en ligne", "Soutien OSSD et IB en lecture, rédaction, recherche, théorie de la connaissance, dissertation prolongée, histoire, sciences humaines et admissions. Les séances privées durent 90 minutes. Le bloc de départ comprend quatre séances à 120 $ CA chacune; les prix et politiques sont visibles avant paiement."),
        "zh-hant": ("多倫多及線上輔導", "提供 OSSD 與 IB 閱讀、寫作、研究、知識論、延伸論文、歷史、人文及大學申請支援。私人課每節 90 分鐘。Starter Block 為四節，每節 120 加元；付款前可查看完整價格與政策。"),
        "zh-hans": ("多伦多及线上辅导", "提供 OSSD 与 IB 阅读、写作、研究、知识论、延伸论文、历史、人文及大学申请支持。私人课每节 90 分钟。Starter Block 为四节，每节 120 加元；付款前可查看完整价格与政策。"),
        "fa": ("تدریس در تورنتو و آنلاین", "پشتیبانی OSSD و IB در خواندن، نوشتن، پژوهش، نظریهٔ دانش، مقالهٔ بلند، تاریخ، علوم انسانی و پذیرش دانشگاه. جلسات خصوصی ۹۰ دقیقه‌اند. Starter Block چهار جلسه، هر جلسه ۱۲۰ دلار کانادا است؛ قیمت و سیاست‌ها پیش از پرداخت دیده می‌شوند."),
    },
    "cloud": {
        "fr": ("Vue de progression Leizu", "Une visualisation facultative de la croissance des compétences. Elle ne remplace ni l’évaluation de l’élève ni le plan écrit."),
        "zh-hant": ("Leizu 成長視圖", "選用的能力成長視覺化；不取代學生評估或書面學習計畫。"),
        "zh-hans": ("Leizu 成长视图", "选用的能力成长可视化；不取代学生评估或书面学习计划。"),
        "fa": ("نمای رشد لیزو", "نمایش اختیاری رشد مهارت‌ها؛ جای ارزیابی دانش‌آموز یا برنامهٔ مکتوب را نمی‌گیرد."),
    },
    "flyer": {
        "fr": ("Leizu Academy", "Tutorat à Toronto et en ligne pour l’IB et l’OSSD."),
        "zh-hant": ("嫘祖學院", "多倫多及線上 IB、OSSD 輔導。"),
        "zh-hans": ("嫘祖学院", "多伦多及线上 IB、OSSD 辅导。"),
        "fa": ("آکادمی لیزو", "تدریس IB و OSSD در تورنتو و آنلاین."),
    },
}


LEIZU_LABELS = {
    "Skip to main content": {
        "fr": "Aller au contenu principal", "zh-hant": "跳到主要內容",
        "zh-hans": "跳到主要内容", "fa": "رفتن به محتوای اصلی",
    },
    "Subjects": {"fr": "Matières", "zh-hant": "科目", "zh-hans": "科目", "fa": "درس‌ها"},
    "Plans": {"fr": "Forfaits", "zh-hant": "方案", "zh-hans": "方案", "fa": "طرح‌ها"},
    "Scholars": {"fr": "Bourses", "zh-hant": "獎學金", "zh-hans": "奖学金", "fa": "بورسیه‌ها"},
    "Your name": {"fr": "Votre nom", "zh-hant": "您的姓名", "zh-hans": "您的姓名", "fa": "نام شما"},
    "Your email": {"fr": "Votre courriel", "zh-hant": "您的電郵", "zh-hans": "您的电子邮件", "fa": "ایمیل شما"},
    "Student's age or grade": {"fr": "Âge ou année scolaire de l’élève", "zh-hant": "學生年齡或年級", "zh-hans": "学生年龄或年级", "fa": "سن یا پایهٔ دانش‌آموز"},
    "What brings you here?": {"fr": "Qu’est-ce qui vous amène?", "zh-hant": "您想從哪裡開始？", "zh-hans": "您想从哪里开始？", "fa": "برای چه کاری آمده‌اید؟"},
    "Choose one": {"fr": "Choisir", "zh-hant": "請選擇", "zh-hans": "请选择", "fa": "یکی را انتخاب کنید"},
    "Student's name": {"fr": "Nom de l’élève", "zh-hant": "學生姓名", "zh-hans": "学生姓名", "fa": "نام دانش‌آموز"},
    "Which curriculum?": {"fr": "Quel programme?", "zh-hant": "哪個課程體系？", "zh-hans": "哪个课程体系？", "fa": "کدام برنامهٔ درسی؟"},
    "Other": {"fr": "Autre", "zh-hant": "其他", "zh-hans": "其他", "fa": "دیگر"},
    "Not sure": {"fr": "Je ne sais pas", "zh-hant": "不確定", "zh-hans": "不确定", "fa": "مطمئن نیستم"},
    "What else would you like help with?": {"fr": "Quel autre soutien cherchez-vous?", "zh-hant": "還希望獲得哪些協助？", "zh-hans": "还希望获得哪些帮助？", "fa": "برای چه چیز دیگری کمک می‌خواهید؟"},
    "Where is the student now?": {"fr": "Où en est l’élève?", "zh-hant": "學生目前的情況如何？", "zh-hans": "学生目前的情况如何？", "fa": "دانش‌آموز اکنون کجای مسیر است؟"},
    "What would a good year look like?": {"fr": "À quoi ressemblerait une bonne année?", "zh-hant": "理想的一年會是怎樣？", "zh-hans": "理想的一年会是怎样？", "fa": "یک سال خوب چه شکلی خواهد بود؟"},
    "When would you like to begin?": {"fr": "Quand souhaitez-vous commencer?", "zh-hant": "希望何時開始？", "zh-hans": "希望何时开始？", "fa": "چه زمانی می‌خواهید شروع کنید؟"},
    "This week": {"fr": "Cette semaine", "zh-hant": "本週", "zh-hans": "本周", "fa": "این هفته"},
    "This term": {"fr": "Ce trimestre", "zh-hant": "本學期", "zh-hans": "本学期", "fa": "این ترم"},
    "Next term": {"fr": "Le trimestre prochain", "zh-hant": "下學期", "zh-hans": "下学期", "fa": "ترم آینده"},
    "Just exploring": {"fr": "Je me renseigne", "zh-hant": "先了解", "zh-hans": "先了解", "fa": "فعلاً در حال بررسی"},
    "Online or in person?": {"fr": "En ligne ou en personne?", "zh-hant": "線上或面授？", "zh-hans": "线上或面授？", "fa": "آنلاین یا حضوری؟"},
    "Online": {"fr": "En ligne", "zh-hant": "線上", "zh-hans": "线上", "fa": "آنلاین"},
    "In person": {"fr": "En personne", "zh-hant": "面授", "zh-hans": "面授", "fa": "حضوری"},
    "Either": {"fr": "Les deux", "zh-hant": "皆可", "zh-hans": "皆可", "fa": "هرکدام"},
    "Anything else?": {"fr": "Autre chose?", "zh-hant": "其他補充？", "zh-hans": "其他补充？", "fa": "نکتهٔ دیگری؟"},
    "Portfolio (optional)": {"fr": "Portfolio (facultatif)", "zh-hant": "作品集（選填）", "zh-hans": "作品集（选填）", "fa": "نمونه‌کار (اختیاری)"},
    "Send": {"fr": "Envoyer", "zh-hant": "提交", "zh-hans": "提交", "fa": "ارسال"},
    "Back to Leizu": {"fr": "Retour à Leizu", "zh-hant": "返回嫘祖", "zh-hans": "返回嫘祖", "fa": "بازگشت به لیزو"},
    "Back to curriculum": {"fr": "Retour au programme", "zh-hant": "返回課程", "zh-hans": "返回课程", "fa": "بازگشت به برنامهٔ درسی"},
    "Contact": {"fr": "Contact", "zh-hant": "聯絡", "zh-hans": "联系", "fa": "تماس"},
    "Questions": {"fr": "Questions", "zh-hant": "問題", "zh-hans": "问题", "fa": "پرسش‌ها"},
    "Apply": {"fr": "Faire une demande", "zh-hant": "申請", "zh-hans": "申请", "fa": "درخواست"},
    "Funding": {"fr": "Financement", "zh-hant": "資助", "zh-hans": "资助", "fa": "تأمین مالی"},
    "Transparency": {"fr": "Transparence", "zh-hant": "透明度", "zh-hans": "透明度", "fa": "شفافیت"},
    "Other ways to help": {"fr": "Autres façons d’aider", "zh-hant": "其他協助方式", "zh-hans": "其他帮助方式", "fa": "راه‌های دیگر کمک"},
    "Print": {"fr": "Imprimer", "zh-hant": "列印", "zh-hans": "打印", "fa": "چاپ"},
}


def clone_leizu_home(governance: list[dict]) -> list[str]:
    source = ROOT / "leizu" / "index.html"
    base = source.read_text(encoding="utf-8")
    # Correct the English source page's alternate architecture too.
    english = replace_hreflang_block(base, leizu_links())
    english = replace_canonical(english, f"{SITE}/leizu/")
    write(source, english)
    source_sha = sha(source)
    urls = [f"{SITE}/leizu/"]
    for segment, (tag, direction) in LEIZU_LOCALES.items():
        title, description = LEIZU_HOME_META[segment]
        text = english
        text = re.sub(
            r"<html\b[^>]*>",
            f'<html lang="{tag}" dir="{direction}" data-leizu-localized="complete" class="leizu-lang-pending">',
            text,
            count=1,
            flags=re.I,
        )
        url = f"{SITE}/leizu/{segment}/"
        text = replace_title(text, title)
        text = replace_or_add_meta(text, "description", description)
        text = replace_or_add_meta(text, "og:title", title, prop=True)
        text = replace_or_add_meta(text, "og:description", description, prop=True)
        text = replace_or_add_meta(text, "og:url", url, prop=True)
        text = replace_or_add_meta(text, "og:locale", tag.replace("-", "_"), prop=True)
        text = replace_canonical(text, url)
        text = replace_hreflang_block(text, leizu_links())
        text = add_governance_meta(text, "leizu/index.html", source_sha, "complete-owned-copy")
        if "/css/audit45-localization.css" not in text:
            text = text.replace(
                "</head>",
                f'<link rel="stylesheet" href="/css/audit45-localization.css?v={AUDIT_VERSION}">\n</head>',
                1,
            )
        text = statically_localize_leizu_home(text, segment)
        text = text.replace(
            "</head>",
            "<style>html.leizu-lang-pending body{visibility:hidden}</style>"
            "<noscript><style>html.leizu-lang-pending body{visibility:visible}</style></noscript>\n</head>",
            1,
        )
        out = ROOT / "leizu" / segment / "index.html"
        write(out, text)
        urls.append(url)
        governance.append({"route": f"/leizu/{segment}/", "locale": tag, "source": "leizu/index.html", "source_sha256": source_sha, "status": "complete-owned-copy"})
    return urls


def clone_leizu_funnel(governance: list[dict]) -> list[str]:
    urls: list[str] = []
    for route, route_copy in LEIZU_SUMMARIES.items():
        source = ROOT / "leizu" / route / "index.html"
        if not source.exists():
            continue
        base_text = source.read_text(encoding="utf-8")
        base_text = replace_hreflang_block(base_text, leizu_links(route))
        base_text = replace_canonical(base_text, f"{SITE}/leizu/{route}/")
        if "language-state.js" not in base_text:
            base_text = base_text.replace("</body>", f'<script defer src="/leizu/language-state.js?v={AUDIT_VERSION}"></script></body>', 1)
        else:
            base_text = re.sub(r'/leizu/language-state\.js\?v=[^"\']+', f"/leizu/language-state.js?v={AUDIT_VERSION}", base_text)
        write(source, base_text)
        source_sha = sha(source)
        for segment, (tag, direction) in LEIZU_LOCALES.items():
            localized = re.sub(
                r"<html\b[^>]*>",
                f'<html lang="{tag}" dir="{direction}" data-leizu-localized="localized-summary">',
                base_text,
                count=1,
                flags=re.I,
            )
            title_text, summary = route_copy[segment]
            localized_title = f"{title_text} · Leizu Academy"
            localized = replace_title(localized, localized_title)
            localized = replace_or_add_meta(localized, "description", summary)
            localized = replace_or_add_meta(localized, "og:title", localized_title, prop=True)
            localized = replace_or_add_meta(localized, "og:description", summary, prop=True)
            suffix = f"{route}/"
            localized_url = f"{SITE}/leizu/{segment}/{suffix}"
            # These routes contain a localized summary followed by the full
            # English source page. Keep that distinction explicit for readers
            # and search engines until each page is fully translated.
            status = "localized-summary-english-detail"
            localized = replace_hreflang_block(localized, leizu_links(route))
            localized = replace_canonical(localized, localized_url)
            localized = add_governance_meta(
                localized, f"leizu/{route}/index.html", source_sha, status
            )
            localized = localize_leizu_navigation(localized, segment)
            localized = replace_or_add_meta(localized, "og:locale", tag.replace("-", "_"), prop=True)
            localization_style = (
                f'<link rel="stylesheet" href="/css/audit45-localization.css?v={AUDIT_VERSION}" '
                'data-audit45-localization="true">'
            )
            localized = re.sub(
                r'<link\b[^>]*href=["\']/css/audit45-localization\.css[^"\']*["\'][^>]*>\s*',
                "",
                localized,
                flags=re.I,
            )
            localized = re.sub(
                r'(<link\b[^>]*href=["\'][^"\']*/css/audit43-approved\.css[^"\']*["\'][^>]*>)',
                lambda match: localization_style + "\n" + match.group(1),
                localized,
                count=1,
                flags=re.I,
            )
            style = (
                "<style>"
                ".audit45-localized-summary{max-width:72rem;margin:1rem auto 1.4rem;padding:1rem 1.15rem;"
                "border:1px solid currentColor;border-radius:.65rem;background:color-mix(in srgb,Canvas 94%,currentColor 6%);"
                "font:500 clamp(.94rem,1.4vw,1.08rem)/1.65 system-ui,sans-serif}"
                ".audit45-localized-summary h1{font-size:clamp(1.45rem,4vw,2.35rem);margin:0 0 .55rem}"
                ".audit45-review{font-size:.82rem;opacity:.8;margin-top:.75rem}"
                "html[dir=rtl] .audit45-localized-summary{text-align:right}"
                "</style>"
            )
            localized = localized.replace("</head>", style + "</head>", 1)
            if route == "cloud" and "application/ld+json" not in localized.partition("</head>")[0]:
                schema = {
                    "@context": "https://schema.org",
                    "@type": "WebPage",
                    "@id": f"{localized_url}#webpage",
                    "url": localized_url,
                    "name": localized_title,
                    "description": summary,
                    "inLanguage": tag,
                    "isPartOf": {"@id": f"{SITE}/#website"},
                }
                schema_block = (
                    "<!-- Audit49 generic WebPage schema -->\n"
                    '<script type="application/ld+json">'
                    + json.dumps(schema, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
                    + "</script>\n"
                )
                localized = localized.replace("</head>", schema_block + "</head>", 1)
            review_text = {
                "fr": "Résumé en français; les renseignements complets ci-dessous sont en anglais.",
                "zh-hant": "以上為繁體中文摘要；下方完整內容為英文。",
                "zh-hans": "以上为简体中文摘要；下方完整内容为英文。",
                "fa": "خلاصه به فارسی است؛ جزئیات کامل در ادامه به انگلیسی آمده است.",
            }[segment]
            english_link_text = {
                "fr": "Ouvrir la page anglaise",
                "zh-hant": "開啟英文頁面",
                "zh-hans": "打开英文页面",
                "fa": "باز کردن صفحهٔ انگلیسی",
            }[segment]
            summary_html = (
                f'<section class="audit45-localized-summary" lang="{tag}" dir="{direction}" '
                'aria-labelledby="audit45-localized-title">'
                f'<h1 id="audit45-localized-title">{htmllib.escape(title_text)}</h1>'
                f'<p>{htmllib.escape(summary)}</p>'
                + f'<p class="audit45-review">{htmllib.escape(review_text)} '
                f'<a href="/leizu/{route}/" hreflang="en">{htmllib.escape(english_link_text)} →</a></p>'
                + "</section>"
            )
            localized = re.sub(
                r"<body\b[^>]*>",
                lambda match: set_tag_attribute(
                    set_tag_attribute(match.group(0), "lang", "en"), "dir", "ltr"
                ),
                localized,
                count=1,
                flags=re.I,
            )
            # The localized reference summary is the page title. Demote the
            # inherited English source heading so high-stakes bilingual routes
            # keep one clear H1 instead of exposing two competing page titles.
            localized = re.sub(
                r'<h1(\b[^>]*)>([\s\S]*?)</h1>',
                r'<h2\1>\2</h2>',
                localized,
                count=1,
                flags=re.I,
            )
            if route == "cloud":
                localized = localized.replace(' id="header" role="main"', ' id="header"', 1)
                localized = re.sub(
                    r'(<a\b(?=[^>]*\bclass=["\'][^"\']*\bskip-link\b)[^>]*\bhref=["\'])#[^"\']+(["\'])',
                    r'\1#main-content\2',
                    localized,
                    count=1,
                    flags=re.I,
                )
                localized = re.sub(
                    r'(<a\b(?=[^>]*\bclass=["\'][^"\']*\bskip-link\b)[^>]*>[\s\S]*?</a>)',
                    rf'\1\n<main id="main-content" lang="en" dir="ltr">{summary_html}',
                    localized,
                    count=1,
                    flags=re.I,
                )
                localized = localized.replace(
                    '<script>\n// ==================== EMBEDDED DATA',
                    '</main>\n<script>\n// ==================== EMBEDDED DATA',
                    1,
                )
            else:
                localized = re.sub(
                    r'<main\b([^>]*)>',
                    rf'<main lang="en" dir="ltr"\1>{summary_html}',
                    localized,
                    count=1,
                    flags=re.I,
                )
            labels = {key: values[segment] for key, values in LEIZU_LABELS.items() if segment in values}
            for old, new in labels.items():
                label_pattern = re.compile(
                    r'(<(?P<tag>label|button|a|option|span|h[1-6]|summary|p)\b[^>]*>)'
                    r'(?P<lead>\s*)' + re.escape(old) + r'(?P<trail>\s*)'
                    r'(</(?P=tag)>)',
                    re.I,
                )

                def label_replacement(match: re.Match[str], translated: str = new) -> str:
                    opening = set_tag_attribute(match.group(1), "lang", tag)
                    opening = set_tag_attribute(opening, "dir", direction)
                    return (
                        opening + match.group("lead")
                        + htmllib.escape(translated, quote=False)
                        + match.group("trail") + match.group(5)
                    )

                localized = label_pattern.sub(label_replacement, localized)
            localized = re.sub(
                r"(<form\b[^>]*>)",
                rf'\1<input type="hidden" name="preferred_language" value="{tag}">',
                localized,
                flags=re.I,
            )
            localized = replace_or_add_meta(localized, "robots", "noindex,follow")
            localized = replace_or_add_meta(localized, "og:url", localized_url, prop=True)
            out = ROOT / "leizu" / segment / route / "index.html"
            write(out, localized)
            governance.append({"route": f"/leizu/{segment}/{route}/", "locale": tag, "source": f"leizu/{route}/index.html", "source_sha256": source_sha, "status": status})
    return urls


PM_LABELS = {
    "en": {
        "skip": "Skip to event", "all": "← All listings", "language": "Français",
        "confirmed": "Confirmed", "pending": "Some details pending", "past": "Past event",
        "archive": "This page remains as an archive. Check the source for a current edition.",
        "date": "Date", "deadline": "Deadline", "place": "Place", "status": "Status", "about": "About this listing",
        "pending_details": "Details still pending",
        "previous": "Previous date", "related": "Related listings", "checked": "Last checked",
        "event_page": "Open official event page", "series_page": "Open official series page",
        "schedule_page": "Open official schedule", "registration_page": "Open registration page",
        "event_source_page": "Open event source page", "series_source_page": "Open series source page", "source_schedule_page": "Open source schedule",
        "application_page": "Open application page", "submission_page": "Open submission page",
        "tickets_page": "Open ticket page", "review_page": "Open review page", "results_page": "Open results page",
        "calendar": "Add to calendar", "correct": "Correct this listing",
        "continue": "Listing actions",
        "source_language": "Original listing language",
        "place_pending": "Location details still pending",
    },
    "fr": {
        "skip": "Aller à la fiche", "all": "← Toutes les fiches", "language": "English",
        "confirmed": "Confirmé", "pending": "Certains détails à confirmer", "past": "Événement passé",
        "archive": "Cette page demeure dans les archives. Consultez la source pour une édition actuelle.",
        "date": "Date", "deadline": "Échéance", "place": "Lieu", "status": "Statut", "about": "À propos de cette fiche",
        "pending_details": "Détails à confirmer",
        "previous": "Date précédente", "related": "Fiches connexes", "checked": "Dernière vérification",
        "event_page": "Ouvrir la page officielle de l’événement", "series_page": "Ouvrir la page officielle de la série",
        "schedule_page": "Ouvrir l’horaire officiel", "registration_page": "Ouvrir la page d’inscription",
        "event_source_page": "Ouvrir la page source de l’événement", "series_source_page": "Ouvrir la page source de la série", "source_schedule_page": "Ouvrir l’horaire source",
        "application_page": "Ouvrir la page de candidature", "submission_page": "Ouvrir la page de soumission",
        "tickets_page": "Ouvrir la billetterie", "review_page": "Ouvrir la page d’évaluation", "results_page": "Ouvrir la page des résultats",
        "calendar": "Ajouter au calendrier", "correct": "Corriger cette fiche",
        "continue": "Actions de la fiche",
        "source_language": "Langue de la fiche originale",
        "place_pending": "Lieu exact à confirmer",
    },
}


def event_source_languages(event: dict) -> list[str]:
    values = event.get("source_languages")
    if isinstance(values, list) and values:
        return [str(value) for value in values]
    value = str(event.get("source_language") or "und")
    return [] if value in {"und", "mul"} else [value]


PM_SOURCE_LANGUAGE_NAMES = {
    "en": {
        "en": "English", "en-CA": "English", "fr": "French",
        "fr-CA": "French", "zh": "Chinese", "zh-Hans": "Simplified Chinese",
        "zh-Hant": "Traditional Chinese", "fa": "Farsi",
    },
    "fr": {
        "en": "anglais", "en-CA": "anglais", "fr": "français",
        "fr-CA": "français", "zh": "chinois", "zh-Hans": "chinois simplifié",
        "zh-Hant": "chinois traditionnel", "fa": "persan",
    },
}

PM_QUALIFICATION_COPY = {
    "en": {
        "time-unconfirmed": "The exact time has not yet been confirmed.",
        "location-unconfirmed": "The exact location has not yet been confirmed.",
        "official-source-unconfirmed": "An official or institutional source has not yet been confirmed.",
        "current-edition-unconfirmed": "A current edition has not yet been confirmed.",
    },
    "fr": {
        "time-unconfirmed": "L’heure exacte n’est pas encore confirmée.",
        "location-unconfirmed": "Le lieu exact n’est pas encore confirmé.",
        "official-source-unconfirmed": "Aucune source officielle ou institutionnelle n’est encore confirmée.",
        "current-edition-unconfirmed": "Aucune édition actuelle n’est encore confirmée.",
    },
}


def event_language_label(code: str, lang: str) -> str:
    names = PM_SOURCE_LANGUAGE_NAMES[lang]
    return names.get(
        code,
        "Language noted in the original listing"
        if lang == "en" else "Langue indiquée dans la fiche originale",
    )


def event_qualification_copy(reason: object, lang: str) -> str:
    key = str(reason or "").strip()
    return PM_QUALIFICATION_COPY[lang].get(
        key,
        "Some listing details still need confirmation."
        if lang == "en" else "Certains détails de la fiche restent à confirmer.",
    )


EVENT_CONTEXT_FIELDS = (
    ("Entry family", "Famille de fiche", "entry_family"),
    ("Calendar systems", "Systèmes calendaires", "calendar_systems"),
    ("Traditions", "Traditions", "traditions"),
    ("Ritual associations", "Associations rituelles", "ritual_associations"),
    ("Social functions", "Fonctions sociales", "social_functions"),
    ("Social context", "Contexte social", "socio_note"),
    ("Viewing notes", "Conseils d’observation", ("astronomy_visibility", "observer_notes")),
    ("Presence categories", "Catégories de présence", "presence_categories"),
    ("Participants and presence", "Participants et présence", ("presence_claims", "participant_presence")),
    ("Presence mode", "Mode de présence", "presence_mode"),
    ("Interaction format", "Format de l’échange", "interaction_format"),
    ("Academic event formats", "Formats intellectuels et universitaires", ("academic_event_forms", "public_intellectual_academic_formats")),
    ("Academic disciplines", "Disciplines universitaires", "academic_disciplines"),
    ("Arts formats", "Formats artistiques", "arts_event_forms"),
    ("Arts disciplines", "Disciplines artistiques", "arts_disciplines"),
    ("Arts occurrence role", "Rôle dans le programme artistique", "arts_occurrence_role"),
    ("Participation formats", "Formats participatifs", "participatory_formats"),
    ("Participation mode", "Mode de participation", "participation_mode"),
    ("Participation roles", "Rôles des participants", "participation_roles"),
    ("Facilitation", "Animation", "facilitation_status"),
    ("Skill level", "Niveau", "skill_level"),
    ("Drop-in status", "Accès libre ou inscription", "drop_in_status"),
    ("Participation evidence", "Preuve de participation", "participation_evidence"),
    ("Civic, legal, and labour formats", "Formats civiques, juridiques et syndicaux", "civic_legal_labour_formats"),
    ("Civic domain", "Domaine civique", "civic_domain"),
    ("Authority level", "Niveau d’autorité", "authority_level"),
    ("Public role", "Rôle du public", "public_role"),
    ("Participation route", "Voie de participation", "participation_route"),
    ("Public input", "Participation du public", "public_input_status"),
    ("Legal access", "Accès juridique", "legal_access_status"),
    ("Collective action", "Action collective", "collective_action_type"),
    ("Election stage", "Étape électorale", "election_stage"),
    ("Access restrictions", "Restrictions d’accès", "access_restrictions"),
    ("Webcast status", "État de la webdiffusion", "webcast_status"),
    ("Publication restriction", "Restriction de publication", "publication_restriction"),
    ("Alternate dates", "Dates alternatives", "alternate_dates"),
    ("Civic evidence", "Preuve civique", "civic_evidence"),
    ("Community, charity, heritage, and place formats", "Formats communautaires, caritatifs, patrimoniaux et territoriaux", "community_heritage_formats"),
    ("Community participation roles", "Rôles de participation communautaire", "community_participation_roles"),
    ("Contribution routes", "Voies de contribution", "contribution_routes"),
    ("Beneficiary or cause", "Bénéficiaire ou cause", "beneficiary_or_cause"),
    ("Relation to place", "Relation au lieu", "place_relation"),
    ("Community evidence", "Preuve communautaire", "community_evidence"),
    ("Community or heritage scope", "Portée communautaire ou patrimoniale", "community_heritage_scope"),
    ("Community public access", "Accès public communautaire", "community_public_access_status"),
    ("Community registration required", "Inscription communautaire requise", "community_registration_required"),
    ("Community participation mode", "Mode de participation communautaire", "community_participation_mode"),
    ("Community date evidence", "Preuve de date communautaire", "community_date_evidence"),
    ("Community access evidence", "Preuve d’accès communautaire", "community_access_evidence"),
    ("Community participation evidence", "Preuve de participation communautaire", "community_participation_evidence"),
    ("Community beneficiary evidence", "Preuve du bénéficiaire communautaire", "community_beneficiary_evidence"),
    ("Community place evidence", "Preuve du lien au lieu", "community_place_evidence"),
    ("Community heritage evidence", "Preuve patrimoniale communautaire", "community_heritage_evidence"),
    ("Live and digital formats", "Formats en direct et numériques", "live_digital_formats"),
    ("Platforms", "Plateformes", "platform_names"),
    ("Live status", "État de diffusion en direct", "synchronous_status"),
    ("Audience interaction", "Interaction avec le public", "audience_interaction_routes"),
    ("Recording availability", "Disponibilité de l’enregistrement", "recording_availability"),
    ("Digital evidence", "Preuve numérique", "digital_evidence"),
    ("Online location", "Lieu en ligne", "online_location"),
    ("Platform detail", "Détail de la plateforme", "platform"),
    ("Platform notes", "Notes sur la plateforme", "platform_notes"),
    ("Liveness detail", "Détail du direct", "liveness_status"),
    ("Synchronicity detail", "Détail de la synchronicité", "synchronicity"),
    ("Audience interaction detail", "Détail de l’interaction avec le public", "audience_interaction"),
    ("Interaction status", "État de l’interaction", "interaction_status"),
    ("Interaction evidence", "Preuve de l’interaction", "interaction_evidence"),
    ("Digital access status", "État de l’accès numérique", "access_status"),
    ("Digital access route", "Voie d’accès numérique", "access_route"),
    ("Replay or archive status", "État de la reprise ou de l’archive", "replay_archive_status"),
    ("Recording evidence", "Preuve de l’enregistrement", "recording_evidence"),
    ("Creator participation status", "État de la participation du créateur", "creator_participation_status"),
    ("Creator participation evidence", "Preuve de la participation du créateur", "creator_participation_evidence"),
    ("Digital occurrence evidence", "Preuve de l’occurrence numérique", "occurrence_evidence"),
    ("Replay source detail", "Détail de la source de reprise", "replay_source_field"),
    ("Course and program formats", "Formats de cours et de programmes", "course_program_formats"),
    ("Program stage", "Étape du programme", "program_stage"),
    ("Source program stage", "Étape du programme selon la source", "program_stage_source_value"),
    ("Schedule model", "Modèle d’horaire", "schedule_model"),
    ("Schedule detail", "Détail de l’horaire", "program_schedule_detail"),
    ("Program start", "Début du programme", "program_start_date"),
    ("Program end", "Fin du programme", "program_end_date"),
    ("Eligibility and audience", "Admissibilité et public visé", "eligibility_audience"),
    ("Registration or application route", "Voie d’inscription ou de candidature", "registration_application_route"),
    ("Session count", "Nombre de séances", "session_count"),
    ("Program evidence", "Preuve du programme", "program_evidence"),
    ("Public access", "Accès public", "public_access_status"),
    ("Audience", "Public visé", "audience_scope"),
    ("Registration required", "Inscription requise", "registration_required"),
    ("Institutional restriction", "Restriction institutionnelle", "institutional_restriction"),
    ("Participant identity", "Identité des participants", "participant_identity_status"),
    ("Talkback status", "État de la discussion", "talkback_status"),
    ("Director attendance", "Présence de la mise en scène", "director_attendance_status"),
    ("Date discrepancy", "Divergence de dates", "date_conflict"),
    ("Source inconsistency", "Incohérence de la source", "source_inconsistency"),
)


def event_context_value(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, dict):
        pieces = []
        for key in ("person", "collective", "role", "category", "status", "mode", "scope", "min", "max"):
            item = value.get(key)
            if item not in (None, "", "not-applicable", "unknown", "production-credit"):
                pieces.append(str(item).replace("-", " "))
        return " — ".join(pieces) if pieces else json.dumps(value, ensure_ascii=False, sort_keys=True)
    if isinstance(value, list):
        return "; ".join(filter(None, (event_context_value(item) for item in value)))
    text = str(value).strip()
    return "" if text.casefold() in {"unknown", "not-applicable"} else text


def event_context_html(event: dict, lang: str) -> str:
    rows = []
    label_index = 1 if lang == "fr" else 0
    for label_en, label_fr, field in EVENT_CONTEXT_FIELDS:
        fields = field if isinstance(field, tuple) else (field,)
        value = next(
            (event.get(name) for name in fields if event.get(name) not in (None, "", [], {})),
            None,
        )
        text = event_context_value(value)
        if text:
            label = (label_en, label_fr)[label_index]
            rows.append(f"<div><dt>{htmllib.escape(label)}</dt><dd>{htmllib.escape(text)}</dd></div>")
    if not rows:
        return ""
    heading = "Contexte et preuves" if lang == "fr" else "Context and evidence"
    return (
        f'<section class="pm-event-context"><h2>{heading}</h2>'
        f'<dl class="pm-event-facts">{"".join(rows)}</dl></section>'
    )


def parse_polymythcal_iso(value: object, timezone_name: str = "America/Toronto") -> datetime.date | datetime.datetime | None:
    """Parse a canonical instant without losing its declared source zone."""
    if not value:
        return None
    text = str(value).strip()
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", text):
        return datetime.date.fromisoformat(text)
    try:
        moment = datetime.datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None
    if moment.tzinfo is None:
        try:
            moment = moment.replace(tzinfo=ZoneInfo(timezone_name or "America/Toronto"))
        except Exception:
            moment = moment.replace(tzinfo=ZoneInfo("America/Toronto"))
    return moment


def polymythcal_temporal_zone(event: dict, public_record: dict) -> ZoneInfo:
    timezone_name = str(
        (public_record.get("temporal") or {}).get("timezone")
        or event.get("timezone")
        or "America/Toronto"
    )
    try:
        return ZoneInfo(timezone_name)
    except Exception:
        return ZoneInfo("America/Toronto")


def projected_polymythcal_datetime(
    event: dict,
    public_record: dict,
    key: str = "date",
) -> datetime.datetime | None:
    parsed = parse_polymythcal_iso(
        event.get(key), str(event.get("timezone") or "America/Toronto")
    )
    if not isinstance(parsed, datetime.datetime):
        return None
    return parsed.astimezone(polymythcal_temporal_zone(event, public_record))


def public_polymythcal_temporal_value(
    event: dict,
    public_record: dict,
    key: str = "date",
) -> str:
    temporal_type = str((public_record.get("temporal") or {}).get("type") or "")
    if (
        temporal_type in {"global-instant", "local-date-time", "deadline", "date-range"}
        and event.get("time_precision") == "exact"
    ):
        moment = projected_polymythcal_datetime(event, public_record, key)
        return moment.isoformat(timespec="minutes") if moment else ""
    return str(public_record.get(key) or "")


def polymythcal_temporal_presentation(
    event: dict,
    public_record: dict,
    *,
    is_watchlist: bool = False,
) -> tuple[str, str, str]:
    """Match the canonical Audit 13 public projection on every localized route."""
    if is_watchlist:
        return (
            "Date awaiting confirmation · Date à confirmer",
            "",
            "Date pending",
        )
    temporal_type = str((public_record.get("temporal") or {}).get("type") or "")
    if event.get("time_precision") == "exact" and event.get("end_date"):
        start_moment = projected_polymythcal_datetime(event, public_record)
        end_moment = projected_polymythcal_datetime(event, public_record, "end_date")
        if start_moment:
            start_label = start_moment.strftime("%Y-%m-%d %H:%M %Z")
            end_label = end_moment.strftime("%Y-%m-%d %H:%M %Z") if end_moment else ""
            label = f"{start_label} – {end_label}" if end_label else start_label
            return (
                label,
                start_moment.isoformat(timespec="minutes"),
                start_moment.strftime("%Y-%m-%d"),
            )
    if (
        temporal_type in {"global-instant", "local-date-time", "deadline"}
        and event.get("time_precision") == "exact"
    ):
        moment = projected_polymythcal_datetime(event, public_record)
        if moment:
            return (
                moment.strftime("%Y-%m-%d %H:%M %Z"),
                moment.isoformat(timespec="minutes"),
                moment.strftime("%Y-%m-%d"),
            )
    start = str(public_record.get("date") or "")[:10]
    end = str(public_record.get("end_date") or "")[:10]
    if temporal_type == "date-range" and end and end != start:
        return (f"{start} – {end}", start, start)
    if temporal_type == "estimated":
        return (f"{start} (estimated · date estimée)", start, start)
    return (start, start, start)


def event_page(
    event: dict,
    public_record: dict,
    lang: str,
    related: list[dict],
    robots: str,
    source_sha: str,
    *,
    is_watchlist: bool = False,
) -> str:
    labels = PM_LABELS[lang]
    event_id = str(event.get("id") or event.get("identity_key"))
    encoded = quote(event_id, safe="")
    french = lang == "fr"
    relative_path = f"polymythseminars/{'fr/' if french else ''}events/{event_id}/index.html"
    geometry_attrs = geometry_body_attributes(
        ROOT, relative_path, "calendar-event", register="quiet"
    )
    translation_status = (
        "localized-interface-source-verbatim"
        if french
        else "canonical-interface-source-verbatim"
    )
    canonical_path = f"/polymythseminars/{'fr/' if french else ''}events/{encoded}/"
    alternate_path = f"/polymythseminars/{'' if french else 'fr/'}events/{encoded}/"
    canonical = SITE + canonical_path
    alternate = SITE + alternate_path
    title_source = str(event.get("title") or "Untitled listing")
    description_source = str(event.get("description") or event.get("raw_excerpt") or "")
    source_languages = event_source_languages(event)
    source_lang = (
        source_languages[0]
        if len(source_languages) == 1
        else "mul" if len(source_languages) > 1 else "und"
    )
    content_language = str(public_record.get("content_language") or source_lang or "und")
    source_label = ", ".join(event_language_label(code, lang) for code in source_languages)
    confirmation = str(event.get("confirmation_status") or "unconfirmed")
    status = labels["confirmed"] if confirmation == "confirmed" else labels["pending"]
    # Use the fail-closed public projection for both chronology and watchlist
    # routes. Canonical UTC instants are rendered in the declared public zone;
    # editorial watchlist marker dates never leak into event semantics.
    date_display, date_machine, date_token = polymythcal_temporal_presentation(
        event, public_record, is_watchlist=is_watchlist
    )
    end_machine = (
        "" if is_watchlist
        else public_polymythcal_temporal_value(event, public_record, "end_date")
    )
    date_label = labels["deadline"] if str(event.get("record_kind") or "") == "opportunity" else labels["date"]
    venue = str(event.get("venue") or "").strip()
    if not venue or venue.casefold().startswith("location unconfirmed"):
        venue = labels["place_pending"]
    city = str(event.get("city") or "")
    city = "" if city.strip().casefold() in {"", "unknown", "not yet determined"} else city.strip()
    destination_url = str(event.get("destination_url") or "")
    if str(event.get("destination_status") or "") == "unavailable-specific-page":
        destination_url = ""
    if destination_url and not destination_url.startswith("https://"):
        raise RuntimeError(f"Unsafe Polymythcal destination for {event_id}: {destination_url!r}")
    destination_kind = str(event.get("destination_kind") or "detail")
    destination_scope = str(event.get("destination_scope") or "event")
    destination_source = str(event.get("destination_status") or "").startswith("source-")
    if destination_kind == "schedule" and destination_source:
        destination_label = labels["source_schedule_page"]
    else:
        destination_label = labels.get(f"{destination_kind}_page") or (
            labels["series_source_page"] if destination_source and destination_scope == "series"
            else labels["event_source_page"] if destination_source
            else labels["series_page"] if destination_scope == "series"
            else labels["event_page"]
        )
    ended = not is_watchlist and bool(re.search(r"pm-event-archive", (ROOT / "polymythseminars" / "events" / event_id / "index.html").read_text(encoding="utf-8", errors="ignore")))
    qualification_items = [
        event_qualification_copy(value, lang)
        for value in event.get("qualification_reasons") or []
    ]
    qualification_tokens = " ".join(sorted(
        str(value) for value in event.get("qualification_reasons") or [] if str(value)
    ))
    qualification_items = list(dict.fromkeys(qualification_items))
    qualification_html = "".join(
        f"<li>{htmllib.escape(item)}</li>" for item in qualification_items
    )
    context_html = event_context_html(event, lang)
    checked = str(event.get("last_checked_at") or "").strip()[:10]
    previous_dates = [str(value) for value in event.get("previous_dates") or [] if str(value)]
    related_html = ""
    if related:
        rows = "".join(
            f'<li><a href="/polymythseminars/{"fr/" if french else ""}events/{quote(str(item.get("id")), safe="")}/" lang="{meta_escape((event_source_languages(item) or ["und"])[0])}">{htmllib.escape(str(item.get("title") or "Untitled listing"))}</a> <span>{htmllib.escape(str(item.get("date") or "")[:10])}</span></li>'
            for item in related
        )
        related_html = f'<nav class="pm-event-related" aria-labelledby="pm-related-title"><h2 id="pm-related-title">{labels["related"]}</h2><ul>{rows}</ul></nav>'
    location_schema = {"@type": "Place", "name": venue}
    if city:
        location_schema["address"] = city
    schema = {
        "@context": "https://schema.org", "@type": "Event", "name": title_source,
        "startDate": date_machine, "endDate": end_machine or None,
        "description": description_source or title_source, "url": canonical,
        "sameAs": destination_url or None, "inLanguage": content_language,
        "location": location_schema,
    }
    schema = {key: value for key, value in schema.items() if value not in (None, "")}
    effective_robots = "noindex,follow" if is_watchlist else robots
    schema_markup = (
        f'<script type="application/ld+json">{json.dumps(schema, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")}</script>'
        if not is_watchlist and effective_robots.startswith("index") and str(event.get("record_kind") or "") != "opportunity" else ""
    )
    title_label = (
        f"{title_source} · {date_token} · Polymythcal"
        if date_token else f"{title_source} · Polymythcal"
    )
    meta_description = (
        ("Fiche Polymythcal en français. " if french else "Polymythcal event listing. ")
        + f"{title_source}. {date_display}."
        + (f" {city}." if city else "")
    )[:160]
    return f'''<!doctype html>
<html lang="{'fr-CA' if french else 'en-CA'}">
<head>
<meta charset="utf-8"><script src="/js/theme-init.js?v=20260723-steady"></script>
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="ss-build" content="{POLYMYTHCAL_ASSET_VERSION}">
<meta name="translation-source" content="polymythseminars/events.json">
<meta name="translation-source-sha256" content="{source_sha}">
<meta name="translation-status" content="{translation_status}">
<title>{htmllib.escape(title_label)}</title>
<meta name="description" content="{meta_escape(meta_description)}">
<meta name="robots" content="{effective_robots}">
<meta property="og:type" content="website"><meta property="og:site_name" content="Seminar Schools">
<meta property="og:title" content="{meta_escape(title_label)}">
<meta property="og:description" content="{meta_escape(meta_description)}">
<meta property="og:url" content="{canonical}"><meta property="og:locale" content="{'fr_CA' if french else 'en_CA'}">
<link rel="canonical" href="{canonical}">
<link rel="alternate" hreflang="en-CA" href="{SITE}/polymythseminars/events/{encoded}/">
<link rel="alternate" hreflang="fr-CA" href="{SITE}/polymythseminars/fr/events/{encoded}/">
<link rel="alternate" hreflang="x-default" href="{SITE}/polymythseminars/events/{encoded}/">
<link rel="stylesheet" href="/css/theme.css?v={POLYMYTHCAL_ASSET_VERSION}">
<link rel="stylesheet" href="/css/alive.css?v={GEOMETRY_ASSET_VERSION}"><link rel="stylesheet" href="/css/polymythcal-features.css?v={POLYMYTHCAL_ASSET_VERSION}">
<link rel="stylesheet" href="/css/site-wide-type-zoom.css?v={TYPE_ZOOM_VERSION}" data-site-wide-type-zoom="{TYPE_ZOOM_VERSION}">
<link rel="stylesheet" href="/css/audit45-localization.css?v={AUDIT_VERSION}" data-audit45-localization="true">
<link rel="stylesheet" href="/css/audit43-approved.css?v={AUDIT43_VERSION}">
<link rel="stylesheet" href="/css/calm-ux.css?v=20260723-steady">
{schema_markup}
</head>
<body {geometry_attrs} data-event-id="{meta_escape(event_id)}" data-confirmation-status="{meta_escape(confirmation)}" data-lifecycle-status="{meta_escape(event.get('lifecycle_status') or 'active')}" data-publication-surface="{'watchlist' if is_watchlist else 'chronology'}">
<a class="skip-link" href="#main-content">{labels["skip"]}</a>
<main id="main-content" class="pm-event-page">
<nav class="pm-event-nav" aria-label="{'Navigation de la fiche' if french else 'Event navigation'}"><a href="/polymythseminars/{'fr/' if french else ''}">{labels["all"]}</a><a href="/polymythcommons/">Polymyth Commons</a><a href="{alternate_path}" hreflang="{'en-CA' if french else 'fr-CA'}">{labels["language"]}</a></nav>
<article class="pm-event-detail">
<header class="pm-event-hero"><p class="pm-event-kicker">Polymythcal</p><div class="truth-row"><span class="truth-chip {meta_escape(confirmation)}">{status}</span></div>
<h1 lang="{meta_escape(content_language)}">{htmllib.escape(title_source)}</h1></header>
{f'<div class="callout pm-event-archive" data-event-archive-note="true"><strong>{labels["past"]}.</strong> {labels["archive"]}</div>' if ended else ''}
<dl class="pm-event-facts"><div><dt>{date_label}</dt><dd>{htmllib.escape(date_display) if is_watchlist else f'<time datetime="{meta_escape(date_machine)}">{htmllib.escape(date_display)}</time>'}</dd></div>
<div><dt>{labels["place"]}</dt><dd><strong lang="{meta_escape(source_lang)}" data-source-language="{meta_escape(source_label)}">{htmllib.escape(venue)}</strong>{f'<span>{htmllib.escape(city)}</span>' if city else ''}</dd></div>
<div><dt>{labels["status"]}</dt><dd>{status}</dd></div>
{f'<div><dt>{labels["source_language"]}</dt><dd>{htmllib.escape(source_label)}</dd></div>' if source_languages else ''}</dl>
<section class="pm-event-primary-path" aria-label="{labels["continue"]}"><p>{labels["continue"]}</p>
<div class="pm-event-actions">{f'<a class="pm-event-action primary" href="{meta_escape(destination_url)}" rel="noopener noreferrer">{destination_label} ↗</a>' if destination_url else ''}
{'' if is_watchlist else f'<a class="pm-event-action" type="text/calendar" href="/polymythseminars/ics/{meta_escape(event_id)}.ics">{labels["calendar"]}</a>'}
<a class="pm-event-action" href="/polymythseminars/{'fr/' if french else ''}correct/?event={meta_escape(canonical)}">{labels["correct"]}</a></div></section>
{f'<section class="pm-event-description"><h2>{labels["about"]}</h2><p lang="{meta_escape(content_language)}">{htmllib.escape(description_source)}</p></section>' if description_source else ''}
{context_html}
{f'<details class="pm-event-pending" data-qualification-reasons="{meta_escape(qualification_tokens)}"><summary>{labels["pending_details"]}</summary><ul>{qualification_html}</ul></details>' if qualification_html else ''}
{f'<p class="pm-event-previous"><strong>{labels["previous"]}:</strong> {htmllib.escape(" · ".join(previous_dates))}</p>' if previous_dates else ''}
{related_html}
<footer class="pm-event-footer">{f'<p class="pm-event-checked"><strong>{labels["checked"]}:</strong> {htmllib.escape(checked)}</p>' if checked else ''}</footer>
</article></main>
<script src="/js/theme.js" defer></script><script src="/js/polymythcal-features.js?v={POLYMYTHCAL_ASSET_VERSION}" defer></script>
<script src="/js/site-keyboard-enhancements.js?v={POLYMYTHCAL_ASSET_VERSION}" defer></script><script src="/js/mandala.js?v={GEOMETRY_ASSET_VERSION}" defer></script>
<script src="/js/indra.js?v={GEOMETRY_ASSET_VERSION}" defer></script>
</body></html>
'''


def french_event_alias_page(alias_id: str, target_id: str, source_sha: str) -> str:
    """Preserve an old localized event URL without publishing duplicate content."""
    target_path = f"/polymythseminars/fr/events/{quote(target_id, safe='')}/"
    canonical = SITE + target_path
    return f'''<!doctype html>
<html lang="fr-CA">
<head>
<meta charset="utf-8"><script src="/js/theme-init.js?v=20260723-steady"></script><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="ss-build" content="{POLYMYTHCAL_ASSET_VERSION}">
<meta name="translation-source" content="polymythseminars/events.json">
<meta name="translation-source-sha256" content="{source_sha}">
<meta name="translation-status" content="legacy-alias">
<meta name="robots" content="noindex,follow">
<meta http-equiv="refresh" content="0;url={meta_escape(target_path)}">
<title>Fiche déplacée · Polymythcal</title>
<link rel="canonical" href="{meta_escape(canonical)}">
<link rel="stylesheet" href="/css/alive.css?v={GEOMETRY_ASSET_VERSION}">
<link rel="stylesheet" href="/css/site-wide-type-zoom.css?v={TYPE_ZOOM_VERSION}" data-site-wide-type-zoom="{TYPE_ZOOM_VERSION}">
<link rel="stylesheet" href="/css/audit43-approved.css?v={AUDIT43_VERSION}">
<link rel="stylesheet" href="/css/calm-ux.css?v=20260723-steady">
</head>
<body data-route-type="calendar-event-alias" data-geometry="indra-web" data-indra-intensity="0.100" data-geometry-role="return" data-front-facing="general-audience" data-legacy-event-id="{meta_escape(alias_id)}">
<main id="main-content" class="pm-event-page"><h1>Fiche déplacée</h1>
<p>Cette ancienne adresse mène maintenant à la fiche stable.</p>
<p><a href="{meta_escape(target_path)}">Ouvrir la fiche stable</a></p></main>
<script>location.replace({json.dumps(target_path, ensure_ascii=False)})</script>
<script src="/js/mandala.js?v={GEOMETRY_ASSET_VERSION}" defer></script><script src="/js/indra.js?v={GEOMETRY_ASSET_VERSION}" defer></script>
</body></html>
'''


PM_FORM_COPY = {
    "submit": {
        "en": ("Submit an event", "Submit public events, exhibitions, festivals, civic actions, or opportunities with an official source.",
               [("Event title", "event_title", "text", True), ("Official source URL", "official_source_url", "url", True), ("Start date and time", "start_datetime", "datetime-local", True), ("End date and time", "end_datetime", "datetime-local", False), ("Venue and full location", "venue_location", "text", True), ("City", "city", "text", True), ("Primary language", "language", "text", False), ("Public details and accessibility information", "details", "textarea", False), ("Contact email for verification", "contact_email", "email", True)], "Send for review"),
        "fr": ("Proposer un événement", "Proposez un événement public, une exposition, un festival, une action civique ou une possibilité avec une source officielle.",
               [("Titre", "event_title", "text", True), ("Adresse de la source officielle", "official_source_url", "url", True), ("Date et heure de début", "start_datetime", "datetime-local", True), ("Date et heure de fin", "end_datetime", "datetime-local", False), ("Lieu et adresse complète", "venue_location", "text", True), ("Ville", "city", "text", True), ("Langue principale", "language", "text", False), ("Détails publics et renseignements sur l’accessibilité", "details", "textarea", False), ("Courriel de vérification", "contact_email", "email", True)], "Envoyer pour examen"),
    },
    "correct": {
        "en": ("Correct a listing", "Report a cancellation, changed date, missing listing, incorrect detail, or official-source update.",
               [("Polymythcal listing URL", "listing_url", "url", True), ("Correction type", "correction_type", "text", True), ("Correct information", "correct_information", "textarea", True), ("Official evidence URL", "official_evidence_url", "url", True), ("Contact email", "contact_email", "email", True)], "Send correction"),
        "fr": ("Corriger une fiche", "Signalez une annulation, une nouvelle date, une fiche disparue, une erreur ou une source officielle mise à jour.",
               [("Adresse de la fiche Polymythcal", "listing_url", "url", True), ("Type de correction", "correction_type", "text", True), ("Renseignements exacts", "correct_information", "textarea", True), ("Adresse de la preuve officielle", "official_evidence_url", "url", True), ("Courriel", "contact_email", "email", True)], "Envoyer la correction"),
    },
}


def polymyth_form(kind: str, lang: str, source_sha: str = "") -> str:
    title, lead, fields, submit = PM_FORM_COPY[kind][lang]
    french = lang == "fr"
    path = f"/polymythseminars/{'fr/' if french else ''}{kind}/"
    relative_path = f"polymythseminars/{'fr/' if french else ''}{kind}/index.html"
    geometry_attrs = geometry_body_attributes(
        ROOT, relative_path, "calendar-form", register="quiet"
    )
    other = f"/polymythseminars/{'' if french else 'fr/'}{kind}/"
    form_name = "polymythcal-event-submission" if kind == "submit" else "polymythcal-correction"
    rows = []
    for label, name, field_type, required in fields:
        required_attr = " required" if required else ""
        control = f'<textarea id="{name}" name="{name}" maxlength="4000"{required_attr}></textarea>' if field_type == "textarea" else f'<input id="{name}" name="{name}" type="{field_type}"{required_attr}>'
        rows.append(f'<div class="pm-field"><label for="{name}">{label}{" *" if required else ""}</label>{control}</div>')
    governance_meta = (
        f'<meta name="translation-source" content="polymythseminars/{kind}/index.html">'
        f'<meta name="translation-source-sha256" content="{source_sha}">'
        '<meta name="translation-status" content="complete-owned-copy">'
        if french else ""
    )
    return f'''<!doctype html><html lang="{'fr-CA' if french else 'en-CA'}"><head>
<meta charset="utf-8"><script src="/js/theme-init.js?v=20260723-steady"></script><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,follow">{governance_meta}
<title>{title} · Polymythcal</title><meta name="description" content="{meta_escape(lead)}"><meta property="og:title" content="{meta_escape(title)} · Polymythcal"><meta property="og:description" content="{meta_escape(lead)}"><meta property="og:url" content="{SITE}{path}"><meta property="og:locale" content="{'fr_CA' if french else 'en_CA'}">
<link rel="canonical" href="{SITE}{path}"><link rel="alternate" hreflang="en-CA" href="{SITE}/polymythseminars/{kind}/"><link rel="alternate" hreflang="fr-CA" href="{SITE}/polymythseminars/fr/{kind}/"><link rel="alternate" hreflang="x-default" href="{SITE}/polymythseminars/{kind}/">
<link rel="stylesheet" href="/css/theme.css?v={POLYMYTHCAL_ASSET_VERSION}"><link rel="stylesheet" href="/css/alive.css?v={GEOMETRY_ASSET_VERSION}"><link rel="stylesheet" href="/css/polymythcal-features.css?v={POLYMYTHCAL_ASSET_VERSION}"><link rel="stylesheet" href="/css/site-wide-type-zoom.css?v={TYPE_ZOOM_VERSION}" data-site-wide-type-zoom="{TYPE_ZOOM_VERSION}"><link rel="stylesheet" href="/css/audit43-approved.css?v={AUDIT43_VERSION}">
<link rel="stylesheet" href="/css/calm-ux.css?v=20260723-steady">
</head><body {geometry_attrs}><a class="skip-link" href="#main-content">{"Aller au formulaire" if french else "Skip to form"}</a>
<main id="main-content" class="pm-form-shell"><nav class="pm-event-nav"><a href="/polymythseminars/{'fr/' if french else ''}">← Polymythcal</a><a href="{other}">{"English" if french else "Français"}</a></nav>
<h1>{title}</h1><p>{lead}</p><form name="{form_name}" method="POST" action="/polymythseminars/{'fr/' if french else ''}thanks/" data-netlify="true" netlify-honeypot="website">
<input type="hidden" name="form-name" value="{form_name}"><input type="hidden" name="interface_language" value="{'fr-CA' if french else 'en-CA'}"><p hidden><label>Leave empty <input name="website" autocomplete="off"></label></p>
{''.join(rows)}<label><input type="checkbox" name="accuracy_confirmation" value="yes" required> {"Je confirme que ces renseignements sont exacts et peuvent être publiés." if french else "I confirm that this information is accurate and publicly shareable."}</label>
<button type="submit">{submit}</button></form></main><script src="/js/theme.js" defer></script><script src="/js/polymythcal-features.js?v={POLYMYTHCAL_ASSET_VERSION}" defer></script><script src="/js/site-keyboard-enhancements.js?v={POLYMYTHCAL_ASSET_VERSION}" defer></script><script src="/js/mandala.js?v={GEOMETRY_ASSET_VERSION}" defer></script>
<script src="/js/indra.js?v={GEOMETRY_ASSET_VERSION}" defer></script>
<script src="/js/footer.js?v=20260805-predeploy-audit" defer></script></body></html>'''


def polymyth_thanks(lang: str) -> str:
    french = lang == "fr"
    path = f"/polymythseminars/{'fr/' if french else ''}thanks/"
    relative_path = f"polymythseminars/{'fr/' if french else ''}thanks/index.html"
    geometry_attrs = geometry_body_attributes(
        ROOT, relative_path, "calendar-form", register="quiet"
    )
    title = "Merci : renseignements reçus" if french else "Thank you: details received"
    lead = (
        "Les renseignements ont été reçus. Ils seront vérifiés auprès de la source officielle avant toute publication."
        if french else
        "The details were received. They will be checked against the official source before publication."
    )
    return f'''<!doctype html><html lang="{'fr-CA' if french else 'en-CA'}"><head>
<meta charset="utf-8"><script src="/js/theme-init.js?v=20260723-steady"></script><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,follow"><title>{title} · Polymythcal</title><meta name="description" content="{meta_escape(lead)}"><meta property="og:title" content="{meta_escape(title)} · Polymythcal"><meta property="og:description" content="{meta_escape(lead)}"><meta property="og:url" content="{SITE}{path}"><meta property="og:locale" content="{'fr_CA' if french else 'en_CA'}">
<link rel="canonical" href="{SITE}{path}"><link rel="alternate" hreflang="en-CA" href="{SITE}/polymythseminars/thanks/"><link rel="alternate" hreflang="fr-CA" href="{SITE}/polymythseminars/fr/thanks/"><link rel="alternate" hreflang="x-default" href="{SITE}/polymythseminars/thanks/">
<link rel="stylesheet" href="/css/theme.css?v={POLYMYTHCAL_ASSET_VERSION}"><link rel="stylesheet" href="/css/alive.css?v={GEOMETRY_ASSET_VERSION}"><link rel="stylesheet" href="/css/polymythcal-features.css?v={POLYMYTHCAL_ASSET_VERSION}"><link rel="stylesheet" href="/css/site-wide-type-zoom.css?v={TYPE_ZOOM_VERSION}" data-site-wide-type-zoom="{TYPE_ZOOM_VERSION}"><link rel="stylesheet" href="/css/audit43-approved.css?v={AUDIT43_VERSION}">
<link rel="stylesheet" href="/css/calm-ux.css?v=20260723-steady">
</head><body {geometry_attrs}><main id="main-content" class="pm-form-shell"><p class="pm-event-kicker">Polymythcal</p><h1>{title}</h1><p>{lead}</p><p><a class="pm-event-action primary" href="/polymythseminars/{'fr/' if french else ''}">{"Retour au calendrier" if french else "Return to the calendar"}</a></p></main><script src="/js/theme.js" defer></script><script src="/js/site-keyboard-enhancements.js?v={POLYMYTHCAL_ASSET_VERSION}" defer></script><script src="/js/mandala.js?v={GEOMETRY_ASSET_VERSION}" defer></script><script src="/js/indra.js?v={GEOMETRY_ASSET_VERSION}" defer></script><script src="/js/footer.js?v=20260805-predeploy-audit" defer></script></body></html>'''


def subscriptions_page(lang: str, feeds: dict, source_sha: str) -> str:
    french = lang == "fr"
    rows = "".join(
        f'<li class="pm-feed-row"><span>{htmllib.escape(str(feed.get("label_fr") if french else feed.get("label_en") or feed.get("label") or ""))} ({feed.get("count", 0)})</span><span><a href="{meta_escape(feed.get("rss"))}">RSS</a> · <a type="text/calendar" href="{meta_escape(feed.get("ics"))}">ICS</a></span></li>'
        for feed in feeds.get("feeds", [])
    )
    path = f"/polymythseminars/{'fr/' if french else ''}subscribe/"
    relative_path = f"polymythseminars/{'fr/' if french else ''}subscribe/index.html"
    geometry_attrs = geometry_body_attributes(
        ROOT, relative_path, "calendar-form", register="quiet"
    )
    title = "Abonnements Polymythcal" if french else "Polymythcal subscriptions"
    lead = (
        "Ces fils RSS et calendriers ICS contiennent les mêmes fiches que Polymythcal."
        if french else
        "These RSS feeds and ICS calendars contain the same listings shown in Polymythcal."
    )
    page_url = f"{SITE}{path}"
    schema = {
        "@context": "https://schema.org",
        "@type": "WebPage",
        "@id": f"{page_url}#webpage",
        "url": page_url,
        "name": title,
        "description": lead,
        "inLanguage": "fr-CA" if french else "en-CA",
        "isPartOf": {"@id": f"{SITE}/#website"},
    }
    schema_block = (
        '<script type="application/ld+json">'
        + json.dumps(schema, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
        + "</script>"
    )
    return f'''<!doctype html><html lang="{'fr-CA' if french else 'en-CA'}"><head><meta charset="utf-8"><script src="/js/theme-init.js?v=20260723-steady"></script><meta name="viewport" content="width=device-width,initial-scale=1"><title>{title}</title><meta name="description" content="{meta_escape(lead)}"><meta name="robots" content="index,follow"><meta name="translation-source" content="polymythseminars/feeds/index.json"><meta name="translation-source-sha256" content="{source_sha}"><meta name="translation-status" content="complete-owned-copy"><meta property="og:title" content="{meta_escape(title)}"><meta property="og:description" content="{meta_escape(lead)}"><meta property="og:url" content="{SITE}{path}"><meta property="og:locale" content="{'fr_CA' if french else 'en_CA'}"><link rel="canonical" href="{SITE}{path}"><link rel="alternate" hreflang="en-CA" href="{SITE}/polymythseminars/subscribe/"><link rel="alternate" hreflang="fr-CA" href="{SITE}/polymythseminars/fr/subscribe/"><link rel="alternate" hreflang="x-default" href="{SITE}/polymythseminars/subscribe/"><link rel="stylesheet" href="/css/theme.css?v={POLYMYTHCAL_ASSET_VERSION}"><link rel="stylesheet" href="/css/alive.css?v={GEOMETRY_ASSET_VERSION}"><link rel="stylesheet" href="/css/polymythcal-features.css?v={POLYMYTHCAL_ASSET_VERSION}"><link rel="stylesheet" href="/css/site-wide-type-zoom.css?v={TYPE_ZOOM_VERSION}" data-site-wide-type-zoom="{TYPE_ZOOM_VERSION}"><link rel="stylesheet" href="/css/audit43-approved.css?v={AUDIT43_VERSION}">
<link rel="stylesheet" href="/css/calm-ux.css?v=20260723-steady">{schema_block}</head><body {geometry_attrs}><main class="pm-form-shell" id="main-content"><nav class="pm-event-nav"><a href="/polymythseminars/{'fr/' if french else ''}">← Polymythcal</a><a href="/polymythseminars/{'' if french else 'fr/'}subscribe/">{"English" if french else "Français"}</a></nav><h1>{title}</h1><p>{lead}</p><ul class="pm-feed-list">{rows}</ul></main><script src="/js/polymythcal-features.js?v={POLYMYTHCAL_ASSET_VERSION}" defer></script><script src="/js/site-keyboard-enhancements.js?v={POLYMYTHCAL_ASSET_VERSION}" defer></script><script src="/js/mandala.js?v={GEOMETRY_ASSET_VERSION}" defer></script><script src="/js/indra.js?v={GEOMETRY_ASSET_VERSION}" defer></script><script src="/js/footer.js?v=20260805-predeploy-audit" defer></script></body></html>'''


def build_polymythcal(governance: list[dict]) -> list[str]:
    event_path = ROOT / "polymythseminars" / "events.json"
    payload = json.loads(event_path.read_text(encoding="utf-8"))
    events = payload["events"]
    event_source_sha = sha(event_path)
    publication_surfaces = json.loads(
        (ROOT / "data" / "polymythcal-publication-surfaces.json").read_text(encoding="utf-8")
    )
    browse_payload = json.loads(
        (ROOT / "polymythseminars" / "browse.json").read_text(encoding="utf-8")
    )
    watchlist_payload = json.loads(
        (ROOT / "polymythseminars" / "watchlist.json").read_text(encoding="utf-8")
    )
    public_records = list(browse_payload.get("events") or []) + list(
        watchlist_payload.get("items") or []
    )
    public_by_id = {
        str(item.get("id")): item
        for item in public_records
        if str(item.get("id") or "")
    }
    chronology_ids = {str(value) for value in publication_surfaces.get("chronology_ids") or []}
    watchlist_ids = {str(value) for value in publication_surfaces.get("watchlist_ids") or []}
    canonical_ids = {
        str(event.get("id") or event.get("identity_key"))
        for event in events
    }
    if chronology_ids & watchlist_ids or chronology_ids | watchlist_ids != canonical_ids:
        raise SystemExit("Polymythcal publication surfaces do not exactly partition canonical event IDs")
    if set(public_by_id) != canonical_ids or len(public_by_id) != len(public_records):
        raise SystemExit("Polymythcal public projections do not exactly cover canonical event IDs")
    alias_targets: dict[str, str] = {}
    for event in events:
        event_id = str(event.get("id") or event.get("identity_key"))
        for value in event.get("legacy_ids") or []:
            alias_id = str(value or "")
            if not re.fullmatch(r"[A-Za-z0-9._~-]+", alias_id):
                raise SystemExit(f"Unsafe French legacy event route id: {alias_id!r}")
            if not alias_id or alias_id == event_id:
                continue
            if alias_id in canonical_ids:
                raise SystemExit(f"French legacy event route collides with canonical id: {alias_id}")
            prior = alias_targets.get(alias_id)
            if prior and prior != event_id:
                raise SystemExit(
                    f"French legacy event route {alias_id!r} maps to both {prior!r} and {event_id!r}"
                )
            alias_targets[alias_id] = event_id
    french_event_root = ROOT / "polymythseminars" / "fr" / "events"
    french_event_root.mkdir(parents=True, exist_ok=True)
    valid_event_directories = canonical_ids | set(alias_targets)
    for child in french_event_root.iterdir():
        if child.is_dir() and child.name not in valid_event_directories:
            shutil.rmtree(child)
    build_date_override = str(os.environ.get("SITE_BUILD_DATE") or "").strip()
    if build_date_override:
        try:
            related_today = datetime.date.fromisoformat(build_date_override)
        except ValueError as exc:
            raise SystemExit(f"SITE_BUILD_DATE is not a real calendar date: {exc}")
    else:
        related_today = datetime.datetime.now(ZoneInfo("America/Toronto")).date()
    related_placeholders = {
        "", "unknown", "location unconfirmed",
        "location unconfirmed · lieu non confirmé", "lieu non confirmé",
    }

    def related_day(item: dict, field: str = "date") -> datetime.date | None:
        value = str(item.get(field) or "")[:10]
        try:
            return datetime.date.fromisoformat(value)
        except ValueError:
            return None

    def related_for(event: dict) -> list[dict]:
        event_id = str(event.get("id") or event.get("identity_key"))
        event_type = str(event.get("type") or "").strip().casefold()
        event_city = str(event.get("city") or "").strip().casefold()
        event_day = related_day(event)
        ranked = []
        for item in events:
            item_id = str(item.get("id") or item.get("identity_key"))
            if item_id == event_id or item_id in watchlist_ids or item.get("lifecycle_status") in {"cancelled", "missing-on-source", "archived"}:
                continue
            item_end = related_day(item, "end_date") or related_day(item)
            if item_end is None or item_end < related_today:
                continue
            item_type = str(item.get("type") or "").strip().casefold()
            item_city = str(item.get("city") or "").strip().casefold()
            same_type = bool(event_type and item_type == event_type)
            same_city = bool(event_city and event_city not in related_placeholders and item_city == event_city)
            if not same_type and not same_city:
                continue
            item_day = related_day(item)
            distance = abs((item_day - event_day).days) if item_day and event_day else 99_999
            score = int(same_type) * 5 + int(same_city) * 4
            ranked.append((
                -score, distance, str(item.get("title") or "").casefold(), item_id, item,
            ))
        return [row[-1] for row in sorted(ranked)[:3]]
    sitemap_urls: list[str] = []
    for event in events:
        event_id = str(event.get("id") or event.get("identity_key"))
        is_watchlist = event_id in watchlist_ids
        existing = ROOT / "polymythseminars" / "events" / event_id / "index.html"
        old = existing.read_text(encoding="utf-8", errors="ignore")
        robots_match = re.search(r'<meta\s+name="robots"\s+content="([^"]+)"', old, re.I)
        robots = robots_match.group(1) if robots_match else "noindex,follow"
        related = [] if is_watchlist else related_for(event)
        public_record = public_by_id[event_id]
        write(existing, event_page(event, public_record, "en", related, robots, event_source_sha, is_watchlist=is_watchlist))
        fr_path = ROOT / "polymythseminars" / "fr" / "events" / event_id / "index.html"
        write(fr_path, event_page(event, public_record, "fr", related, robots, event_source_sha, is_watchlist=is_watchlist))
        if not is_watchlist and robots.startswith("index"):
            sitemap_urls.append(f"{SITE}/polymythseminars/fr/events/{quote(event_id, safe='')}/")
    for alias_id, target_id in sorted(alias_targets.items()):
        write(
            french_event_root / alias_id / "index.html",
            french_event_alias_page(alias_id, target_id, event_source_sha),
        )
    governance.append({
        "route_pattern": "/polymythseminars/fr/events/{event_id}/",
        "locale": "fr-CA",
        "source": "polymythseminars/events.json",
        "source_sha256": event_source_sha,
        "status": "localized-interface-source-verbatim",
        "count": len(events),
        "legacy_alias_count": len(alias_targets),
    })

    # Main and focused interactive shells.
    main_source = ROOT / "polymythseminars" / "index.html"
    shells = [("polymythseminars", main_source)]
    for slug in FOCUSED:
        source = ROOT / slug / "index.html"
        if source.exists():
            shells.append((slug, source))
    for slug, source in shells:
        source_text = source.read_text(encoding="utf-8")
        source_sha = sha(source)
        english_url = f"{SITE}/{'polymythseminars' if slug == 'polymythseminars' else slug}/"
        french_url = f"{SITE}/polymythseminars/fr/" if slug == "polymythseminars" else f"{SITE}/{slug}/fr/"
        source_text = replace_hreflang_block(source_text, [("en-CA", english_url), ("fr-CA", french_url), ("x-default", english_url)])
        source_text = replace_canonical(source_text, english_url)
        source_text = re.sub(
            r'(<a\b[^>]*\bid=["\']pmLanguageLink["\'][^>]*\bhref=["\'])[^"\']*(["\'])',
            rf"\g<1>{french_url}\g<2>",
            source_text,
            count=1,
            flags=re.I,
        )
        localized = re.sub(r"<html\b[^>]*>", '<html lang="fr-CA">', source_text, count=1, flags=re.I)
        localized_title = "Calendrier Polymythcal" if slug == "polymythseminars" else f"{slug} · calendrier Polymythcal"
        localized = replace_title(localized, localized_title)
        localized = replace_or_add_meta(localized, "og:url", french_url, prop=True)
        localized = replace_or_add_meta(localized, "og:locale", "fr_CA", prop=True)
        localized = replace_canonical(localized, french_url)
        localized = replace_hreflang_block(localized, [("en-CA", english_url), ("fr-CA", french_url), ("x-default", english_url)])
        localized = statically_localize_polymythcal_shell(localized, english_url)
        if slug == "polymythseminars":
            localized = re.sub(
                r'(href=["\'])/polymythseminars/(research|monitoring)/',
                r'\1/polymythseminars/fr/\2/',
                localized,
                flags=re.I,
            )
        localized_heading_match = re.search(
            r"<h1\b[^>]*>([\s\S]*?)</h1>", localized, flags=re.I
        )
        localized_heading = re.sub(
            r"<[^>]+>", "", localized_heading_match.group(1)
        ).strip() if localized_heading_match else "Polymythcal"
        localized_description = (
            f"Calendrier public en français pour {localized_heading}. "
            "Événements et possibilités de Toronto à Montréal."
        )
        localized = replace_or_add_meta(localized, "description", localized_description)
        localized = replace_or_add_meta(localized, "og:title", localized_title, prop=True)
        localized = replace_or_add_meta(localized, "og:description", localized_description, prop=True)
        localized = re.sub(
            r'("url"\s*:\s*)"[^"]*"',
            lambda match: match.group(1) + json.dumps(french_url, ensure_ascii=False),
            localized,
            count=1,
        )
        localized = re.sub(
            r'("@id"\s*:\s*)"[^"]*#webpage"',
            lambda match: match.group(1) + json.dumps(f"{french_url}#webpage", ensure_ascii=False),
            localized,
            count=1,
        )
        localized = re.sub(
            r'("description"\s*:\s*)"[^"]*"',
            lambda match: match.group(1) + json.dumps(localized_description, ensure_ascii=False),
            localized,
            count=1,
        )
        localized = re.sub(
            r'"inLanguage"\s*:\s*(?:\[[^\]]*\]|"[^"]*")',
            '"inLanguage": "fr-CA"',
            localized,
            count=1,
        )
        localized = add_governance_meta(localized, str(source.relative_to(ROOT)), source_sha, "complete-owned-interface")
        out = ROOT / ("polymythseminars/fr/index.html" if slug == "polymythseminars" else f"{slug}/fr/index.html")
        write(out, localized)
        sitemap_urls.append(french_url)
        governance.append({"route": french_url.removeprefix(SITE), "locale": "fr-CA", "source": str(source.relative_to(ROOT)), "source_sha256": source_sha, "status": "complete-owned-interface"})

    for kind in ("submit", "correct"):
        source = ROOT / "polymythseminars" / kind / "index.html"
        write(source, polymyth_form(kind, "en"))
        source_sha = sha(source)
        write(ROOT / "polymythseminars" / "fr" / kind / "index.html", polymyth_form(kind, "fr", source_sha))
        governance.append({"route": f"/polymythseminars/fr/{kind}/", "locale": "fr-CA", "source": f"polymythseminars/{kind}/index.html", "source_sha256": source_sha, "status": "complete-owned-copy"})
    write(ROOT / "polymythseminars" / "thanks" / "index.html", polymyth_thanks("en"))
    write(ROOT / "polymythseminars" / "fr" / "thanks" / "index.html", polymyth_thanks("fr"))
    feed_index = ROOT / "polymythseminars" / "feeds" / "index.json"
    feeds = json.loads(feed_index.read_text(encoding="utf-8"))
    feed_sha = sha(feed_index)
    write(ROOT / "polymythseminars" / "subscribe" / "index.html", subscriptions_page("en", feeds, feed_sha))
    write(ROOT / "polymythseminars" / "fr" / "subscribe" / "index.html", subscriptions_page("fr", feeds, feed_sha))
    sitemap_urls.append(f"{SITE}/polymythseminars/fr/subscribe/")
    governance.append({"route": "/polymythseminars/fr/subscribe/", "locale": "fr-CA", "source": "polymythseminars/feeds/index.json", "source_sha256": feed_sha, "status": "complete-owned-copy"})
    return sitemap_urls


SAUL_META = {
    "fr": ("Archives professionnelles de Saul Karim Nassau", "Parcours professionnel, études, projets et service communautaire en français."),
    "zh-hant": ("Saul Karim Nassau 專業經歷檔案", "繁體中文職業經歷、教育、專案與社區服務檔案。"),
    "zh-hans": ("Saul Karim Nassau 专业经历档案", "简体中文职业经历、教育、项目与社区服务档案。"),
    "fa": ("بایگانی حرفه‌ای Saul Karim Nassau", "سابقهٔ حرفه‌ای، تحصیل، پروژه‌ها و خدمات اجتماعی به فارسی."),
}
SAUL_HERO = {
    "fr": ("Archives de carrière", "Cette page présente l’archive complète en français. Le CV de candidature et ses PDF demeurent explicitement en anglais."),
    "zh-hant": ("職業經歷檔案", "本頁以繁體中文呈現完整經歷檔案。求職履歷及 PDF 明確保留英文。"),
    "zh-hans": ("职业经历档案", "本页以简体中文呈现完整经历档案。求职履历及 PDF 明确保留英文。"),
    "fa": ("بایگانی سوابق حرفه‌ای", "این صفحه بایگانی کامل را به فارسی نشان می‌دهد. رزومهٔ درخواست شغل و فایل‌های PDF صریحاً انگلیسی باقی می‌مانند."),
}
SAUL_HERO_LINK = {
    "fr": "Ouvrir le CV de candidature en anglais →",
    "zh-hant": "開啟英文求職履歷 →",
    "zh-hans": "打开英文求职履历 →",
    "fa": "باز کردن رزومهٔ درخواست شغل به انگلیسی ←",
}
SAUL_NAV = {
    "fr": ("Sections du parcours", "Carte", "Parcours complet"),
    "zh-hant": ("履歷章節", "地圖", "完整經歷"),
    "zh-hans": ("履历章节", "地图", "完整经历"),
    "fa": ("بخش‌های سوابق", "نقشه", "سابقهٔ کامل"),
}
SAUL_ARCHIVE_NAV = {
    "fr": {
        "label": "Sections des archives professionnelles",
        "map": "Carte",
        "history": "Parcours complet",
        "english_cv": "Ouvrir le CV de candidature en anglais →",
    },
    "zh-hant": {
        "label": "專業經歷檔案章節",
        "map": "地圖",
        "history": "完整經歷",
        "english_cv": "開啟英文求職履歷 →",
    },
    "zh-hans": {
        "label": "职业经历档案章节",
        "map": "地图",
        "history": "完整经历",
        "english_cv": "打开英文求职简历 →",
    },
    "fa": {
        "label": "بخش‌های بایگانی حرفه‌ای",
        "map": "نقشه",
        "history": "سابقهٔ کامل",
        "english_cv": "باز کردن رزومهٔ انگلیسی →",
    },
}


def build_saul(governance: list[dict]) -> list[str]:
    source = ROOT / "saul" / "index.html"
    text = source.read_text(encoding="utf-8")
    links = [
        ("en", f"{SITE}/saul/"), ("fr", f"{SITE}/saul/fr/"),
        ("zh-Hant", f"{SITE}/saul/zh-hant/"), ("zh-Hans", f"{SITE}/saul/zh-hans/"),
        ("fa", f"{SITE}/saul/fa/"), ("x-default", f"{SITE}/saul/"),
    ]
    text = replace_hreflang_block(text, links)
    text = replace_canonical(text, f"{SITE}/saul/")
    if "audit45-saul-archive-hero" not in text:
        css = '''<style id="audit45-saul-localization">
.audit45-saul-archive-hero{display:none;max-width:940px;margin:1rem auto 2rem;padding:1rem 1.2rem;border:1px solid currentColor;border-radius:18px}
.audit45-saul-archive-hero h1{margin:.15rem 0 .55rem;font-size:clamp(1.8rem,5vw,3.25rem)}
html[data-saul-archive-language="fr"] .audit45-saul-archive-hero[data-locale="fr"],
html[data-saul-archive-language="zh"] .audit45-saul-archive-hero[data-locale="zh"],
html[data-saul-archive-language="zhs"] .audit45-saul-archive-hero[data-locale="zhs"],
html[data-saul-archive-language="fa"] .audit45-saul-archive-hero[data-locale="fa"]{display:block}
html[data-saul-archive-language]:not([data-saul-archive-language="en"]) :is(.cv-spectrum,.cv-ultimate){display:none!important}
html[data-saul-archive-language="fa"] .audit45-saul-archive-hero{text-align:right}
</style>'''
        text = text.replace("</head>", css + "</head>", 1)
        heroes = []
        internal = {"fr": "fr", "zh-hant": "zh", "zh-hans": "zhs", "fa": "fa"}
        for segment, (tag, direction) in SAUL_LOCALES.items():
            title, lead = SAUL_HERO[segment]
            heroes.append(
                f'<section class="audit45-saul-archive-hero" data-locale="{internal[segment]}" lang="{tag}" dir="{direction}">'
                f'<p>Saul Karim Nassau</p><h2>{title}</h2><p>{lead}</p>'
                f'<p><a href="/saul/" hreflang="en">{SAUL_HERO_LINK[segment]}</a></p></section>'
            )
        marker = '<section class="cv-ultimate"' if '<section class="cv-ultimate"' in text else '<section class="cv-spectrum"'
        text = text.replace(marker, "".join(heroes) + marker, 1)
    text = place_style_before_shared_layers(text, "audit45-saul-localization")
    # The English source keeps one document H1. Localized archive headings are
    # promoted only inside their own generated route.
    text = re.sub(
        r'(<section\b[^>]*\baudit45-saul-archive-hero\b[^>]*>[\s\S]*?)<h1>([\s\S]*?)</h1>',
        r"\1<h2>\2</h2>",
        text,
        flags=re.I,
    )
    internal = {"fr": "fr", "zh-hant": "zh", "zh-hans": "zhs", "fa": "fa"}
    for segment, selected_locale in internal.items():
        text = re.sub(
            rf'(<section\b[^>]*\baudit45-saul-archive-hero\b[^>]*\bdata-locale=["\']{re.escape(selected_locale)}["\'][^>]*>[\s\S]*?<p><a\b[^>]*href=["\']/saul/["\'][^>]*>)[\s\S]*?(</a></p></section>)',
            rf'\1{SAUL_HERO_LINK[segment]}\2',
            text,
            count=1,
            flags=re.I,
        )
    text = re.sub(r'(<a\b[^>]*href=["\']/saul/["\'])\s+lang=["\']en["\']', r'\1 hreflang="en"', text)
    write(source, text)
    source_sha = sha(source)
    urls = []
    internal = {"fr": "fr", "zh-hant": "zh", "zh-hans": "zhs", "fa": "fa"}
    for segment, (tag, direction) in SAUL_LOCALES.items():
        title, description = SAUL_META[segment]
        url = f"{SITE}/saul/{segment}/"
        localized = re.sub(
            r"<html\b[^>]*>",
            f'<html lang="{tag}" dir="{direction}" data-saul-archive-language="{internal[segment]}">',
            text,
            count=1,
            flags=re.I,
        )
        localized = replace_title(localized, title)
        localized = replace_or_add_meta(localized, "description", description)
        localized = replace_or_add_meta(localized, "og:title", title, prop=True)
        localized = replace_or_add_meta(localized, "og:description", description, prop=True)
        localized = replace_or_add_meta(localized, "twitter:title", title)
        localized = replace_or_add_meta(localized, "twitter:description", description)
        localized = replace_or_add_meta(localized, "og:url", url, prop=True)
        localized = replace_or_add_meta(localized, "og:locale", tag.replace("-", "_"), prop=True)
        localized = replace_canonical(localized, url)
        localized = replace_hreflang_block(localized, links)
        localized = localize_saul_profile_schema(localized, url, title, tag)
        localized = add_governance_meta(localized, "saul/index.html", source_sha, "localized-career-archive")
        nav_label, map_label, history_label = SAUL_NAV[segment]
        localized_nav = (
            f'<nav aria-label="{nav_label}" class="cv-local-nav" data-cv-local-nav="">'
            f'<a href="#places">{map_label}</a>'
            f'<a href="#careerArchive">{history_label}</a></nav>'
        )
        localized = re.sub(
            r'<nav\b[^>]*\bclass=["\'][^"\']*\bcv-local-nav\b[^"\']*["\'][^>]*>[\s\S]*?</nav>',
            localized_nav,
            localized,
            count=1,
            flags=re.I,
        )
        selected_locale = internal[segment]
        archive_nav = SAUL_ARCHIVE_NAV[segment]
        localized_nav = (
            f'<nav aria-label="{meta_escape(archive_nav["label"])}" class="cv-local-nav" '
            'data-cv-local-nav="">'
            f'<a href="#places">{htmllib.escape(archive_nav["map"])}</a>'
            f'<a href="#careerArchive">{htmllib.escape(archive_nav["history"])}</a>'
            '</nav>'
        )
        localized = re.sub(
            r'<nav\b(?=[^>]*\bclass=["\'][^"\']*\bcv-local-nav\b)[^>]*>[\s\S]*?</nav>',
            localized_nav,
            localized,
            count=1,
            flags=re.I,
        )
        localized = re.sub(
            rf'(<section\b[^>]*\bdata-locale=["\']{re.escape(selected_locale)}["\'][^>]*>[\s\S]*?'
            r'<a\b(?=[^>]*\bhref=["\']/saul/["\'])[^>]*>)[\s\S]*?(</a>)',
            lambda match: (
                match.group(1)
                + htmllib.escape(archive_nav["english_cv"])
                + match.group(2)
            ),
            localized,
            count=1,
            flags=re.I,
        )
        localized = re.sub(
            r'<a\b(?=[^>]*\bclass=["\'][^"\']*\bcv-return-focus\b)[^>]*>[\s\S]*?</a>',
            "",
            localized,
            flags=re.I,
        )
        localized = re.sub(
            rf'(<section\b[^>]*\baudit45-saul-archive-hero\b[^>]*\bdata-locale=["\']{re.escape(selected_locale)}["\'][^>]*>[\s\S]*?)<h2>([\s\S]*?)</h2>',
            r"\1<h1>\2</h1>",
            localized,
            count=1,
            flags=re.I,
        )
        localized = re.sub(
            r'(<h1\b[^>]*\bdata-cv-name\b[^>]*>)([\s\S]*?)(</h1>)',
            r"<h2 data-cv-name>\2</h2>",
            localized,
            count=1,
            flags=re.I,
        )
        localized = re.sub(
            r'(<h1\b[^>]*\bid=["\']cvUltimateName["\'][^>]*>)([\s\S]*?)(</h1>)',
            r'<h2 id="cvUltimateName">\2</h2>',
            localized,
            count=1,
            flags=re.I,
        )
        localized = re.sub(
            r'(\b(?:href|src)=["\'])\./assets/',
            r"\1/saul/assets/",
            localized,
            flags=re.I,
        )
        write(ROOT / "saul" / segment / "index.html", localized)
        urls.append(url)
        governance.append({"route": f"/saul/{segment}/", "locale": tag, "source": "saul/index.html", "source_sha256": source_sha, "status": "localized-career-archive"})
    return urls


def finish_bb(governance: list[dict]) -> None:
    source = ROOT / "bb" / "why" / "index.html"
    localized = ROOT / "bb" / "why" / "zh" / "index.html"
    text = localized.read_text(encoding="utf-8")
    text = re.sub(
        r'(<(?:p|li)\b(?=[^>]*\bclass=["\'][^"\']*\bref\b)[^>]*)(>)',
        lambda match: set_tag_attribute(match.group(1) + match.group(2), "lang", "en"),
        text,
        flags=re.I,
    )
    text = re.sub(
        r'<meta\b(?=[^>]*\bname=["\']translation-(?:source|source-sha256|status|policy)["\'])[^>]*>\s*',
        "",
        text,
        flags=re.I,
    )
    governance_meta = (
        '<meta name="translation-source" content="bb/why/index.html">'
        f'<meta name="translation-source-sha256" content="{sha(source)}">'
        '<meta name="translation-status" content="complete-owned-copy">'
    )
    text = text.replace("</head>", governance_meta + "</head>", 1)
    write(localized, text)
    governance.append({"route": "/bb/why/zh/", "locale": "zh-Hans", "source": "bb/why/index.html", "source_sha256": sha(source), "status": "complete-owned-copy"})


def update_sitemap(urls: list[str]) -> None:
    path = ROOT / "sitemap.xml"
    text = path.read_text(encoding="utf-8")
    # The canonical search-surface builder discovers localized routes once
    # they exist. Remove the prior managed block, then add only URLs that the
    # canonical sitemap does not already own. This keeps first-run migration
    # complete and every later build duplicate-free.
    text = re.sub(r"\s*<!-- AUDIT45_LOCALIZED_START -->[\s\S]*?<!-- AUDIT45_LOCALIZED_END -->\s*", "\n", text)
    # Summary-only Leizu locale routes are useful language wayfinding pages,
    # but they are not full translations. Remove any copies added by an
    # earlier search/sitemap build while they remain noindex.
    partial_leizu = re.compile(
        r"\s*<url>\s*<loc>https://seminarschools\.com/leizu/(?:fr|fa|zh-hans|zh-hant)/"
        r"(?:booking-success|cloud|donate|flyer|intake|policies|scholarship|teach|toronto-tutoring)/"
        r"</loc>[\s\S]*?</url>\s*",
        re.I,
    )
    text = partial_leizu.sub("\n", text)
    # Localized route generation must not restore an event URL that the
    # canonical event builder has classified as noindex. Some artifact
    # workspaces can reconcile a future-stamped sitemap between subprocesses,
    # so enforce the page's current robots policy again at this final writer.
    event_entry = re.compile(
        r"\s*<url>\s*<loc>(https://seminarschools\.com/polymythseminars/(?:fr/)?events/[^<]+/)</loc>"
        r"[\s\S]*?</url>\s*",
        re.I,
    )

    def retain_indexable_event(match: re.Match[str]) -> str:
        url = htmllib.unescape(match.group(1))
        route = unquote(url.removeprefix(SITE).lstrip("/"))
        page = ROOT / route / "index.html"
        if not page.exists():
            return ""
        source = page.read_text(encoding="utf-8", errors="ignore")
        robots_match = re.search(
            r'<meta\s+name="robots"\s+content="([^"]+)"', source, re.I
        )
        robots = robots_match.group(1).casefold() if robots_match else "noindex,follow"
        return "" if "noindex" in robots else match.group(0)

    text = event_entry.sub(retain_indexable_event, text)
    text = re.sub(r"(?m)^[ \t]+$", "", text)
    text = re.sub(r"\n{2,}", "\n", text)
    text = re.sub(r"(?m)^<url>", "  <url>", text)
    # This is the final sitemap writer. Reconcile the managed event URLs from
    # the generated pages' actual robots policy in both languages so an
    # earlier working-horizon index cannot silently omit a confirmed,
    # indexable canonical page (or leave an English/French mismatch).
    indexable_event_urls: list[str] = []
    for relative, url_prefix in (
        (Path("polymythseminars/events"), "/polymythseminars/events/"),
        (Path("polymythseminars/fr/events"), "/polymythseminars/fr/events/"),
    ):
        base = ROOT / relative
        if not base.exists():
            continue
        for page in sorted(base.glob("*/index.html")):
            source = page.read_text(encoding="utf-8", errors="ignore")
            robots_match = re.search(
                r'<meta\s+name="robots"\s+content="([^"]+)"', source, re.I
            )
            robots = robots_match.group(1).casefold() if robots_match else "noindex,follow"
            if "noindex" not in robots:
                indexable_event_urls.append(
                    f"{SITE}{url_prefix}{quote(page.parent.name, safe='')}/"
                )
    unique = sorted(set([*urls, *indexable_event_urls]))
    existing = set(re.findall(r"<loc>([^<]+)</loc>", text))
    missing = [url for url in unique if htmllib.escape(url) not in existing and url not in existing]
    block = "\n<!-- AUDIT45_LOCALIZED_START -->\n" + "\n".join(
        f"  <url><loc>{htmllib.escape(url)}</loc></url>" for url in missing
    ) + "\n<!-- AUDIT45_LOCALIZED_END -->\n"
    text = text.replace("</urlset>", block + "</urlset>")
    write(path, text)


def main() -> None:
    governance: list[dict] = []
    if "--polymythcal-only" in sys.argv[1:]:
        unexpected = [value for value in sys.argv[1:] if value != "--polymythcal-only"]
        if unexpected:
            raise SystemExit(f"Unknown arguments: {' '.join(unexpected)}")
        sitemap_urls = build_polymythcal(governance)
        print(
            "AUDIT 45 POLYMYTHCAL ROUTES BUILT — "
            f"{len(governance)} governed route record, {len(set(sitemap_urls))} sitemap URLs"
        )
        return
    sitemap_urls: list[str] = []
    sitemap_urls.extend(clone_leizu_home(governance))
    sitemap_urls.extend(clone_leizu_funnel(governance))
    sitemap_urls.extend(build_polymythcal(governance))
    sitemap_urls.extend(build_saul(governance))
    finish_bb(governance)
    update_sitemap(sitemap_urls)
    event_payload = json.loads(
        (ROOT / "polymythseminars" / "events.json").read_text(encoding="utf-8")
    )
    event_count = len(event_payload["events"])
    french_alias_count = sum(
        len(event.get("legacy_ids") or [])
        for event in event_payload["events"]
    )
    payload = {
        "schema": "seminar-schools-translation-governance-v1",
        "release": "audit45",
        "english_source_of_truth": True,
        "organizer_text_policy": "preserve verbatim; mark source language; never silently translate",
        "high_stakes_policy": "localized summaries remain visibly distinct from complete English detail and noindex until fully translated",
        "routes": governance,
        "counts": {
            "leizu_locales": 4,
            "polymythcal_interface_locales": 2,
            "polymythcal_event_routes_per_locale": event_count,
            "polymythcal_french_legacy_alias_routes": french_alias_count,
            "saul_archive_locales": 4,
            "teacher_resources": 645,
        },
    }
    write(ROOT / "data" / "audit45-translation-governance.json", json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
    print(f"AUDIT 45 LOCALIZED ROUTES BUILT — {len(governance)} governed route records, {len(set(sitemap_urls))} sitemap URLs")


if __name__ == "__main__":
    main()
