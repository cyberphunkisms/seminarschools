#!/usr/bin/env python3
"""Audit 45 translation, routing, parity, and anti-backtracking gate.

This verifier intentionally uses only Python's standard library so the same
gate runs in Netlify's ordinary build environment.
"""
from __future__ import annotations

from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote
import hashlib
import html
import json
import os
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
INVENTORY_CONTRACT = json.loads(
    (ROOT / 'data' / 'polymythcal-inventory-contract.json').read_text(encoding='utf-8')
)
MINIMUM_EVENT_COUNT = int(INVENTORY_CONTRACT['minimum_canonical_events'])
MINIMUM_SOURCE_COUNT = int(INVENTORY_CONTRACT['minimum_sources'])
MINIMUM_EVENT_TYPES = int(INVENTORY_CONTRACT['minimum_event_types'])
REPORT = ROOT / "scripts" / "reports" / "audit45-translation-static.json"
SITE = "https://seminarschools.com"
LOCALES = {
    "fr": ("fr", "ltr"),
    "zh-hant": ("zh-Hant", "ltr"),
    "zh-hans": ("zh-Hans", "ltr"),
    "fa": ("fa", "rtl"),
}
LEIZU_ROUTES = (
    "intake", "booking-success", "policies", "scholarship", "donate",
    "teach", "toronto-tutoring", "cloud", "flyer",
)
FOCUSED = (
    "writingclub", "writingkids", "writingjuniors", "writingteens",
    "writinggrads", "university", "philosophy", "humanities", "cfps",
    "lectures", "fellowships",
)
FRENCH_LEGACY_ALIAS_COUNT = 28

failures: list[str] = []
assertions = 0


def check(condition: bool, message: str) -> None:
    global assertions
    assertions += 1
    if not condition:
        failures.append(message)


def text(relative: str | Path) -> str:
    return (ROOT / relative).read_text(encoding="utf-8")


def json_file(relative: str | Path) -> object:
    return json.loads(text(relative))


def sha(relative: str | Path) -> str:
    return hashlib.sha256((ROOT / relative).read_bytes()).hexdigest()


def html_attr(source: str, element_pattern: str, attribute: str) -> str:
    match = re.search(rf"<{element_pattern}\b([^>]*)>", source, re.I)
    if not match:
        return ""
    attr = re.search(rf'\b{re.escape(attribute)}=["\']([^"\']*)["\']', match.group(1), re.I)
    return html.unescape(attr.group(1)) if attr else ""


def meta(source: str, name: str, prop: bool = False) -> str:
    attr = "property" if prop else "name"
    match = re.search(
        rf'<meta\b(?=[^>]*\b{attr}=["\']{re.escape(name)}["\'])(?=[^>]*\bcontent=["\']([^"\']*)["\'])[^>]*>',
        source,
        re.I,
    )
    return html.unescape(match.group(1)) if match else ""


def canonical(source: str) -> str:
    match = re.search(
        r'<link\b(?=[^>]*\brel=["\']canonical["\'])(?=[^>]*\bhref=["\']([^"\']+)["\'])[^>]*>',
        source,
        re.I,
    )
    return html.unescape(match.group(1)) if match else ""


def strip_markup(value: str) -> str:
    return " ".join(html.unescape(re.sub(r"<[^>]+>", "", value)).split())


def heading(source: str, level: int = 1) -> tuple[str, str]:
    match = re.search(rf"<h{level}\b([^>]*)>([\s\S]*?)</h{level}>", source, re.I)
    if not match:
        return "", ""
    lang_match = re.search(r'\blang=["\']([^"\']+)["\']', match.group(1), re.I)
    return strip_markup(match.group(2)), (lang_match.group(1) if lang_match else "")


def exact_weekly_workflow(relative: str, expected: str) -> None:
    source = text(relative)
    crons = re.findall(r'\bcron:\s*["\']([^"\']+)["\']', source)
    check(crons == [expected], f"{relative}: cadence changed from exactly {expected}")
    fields = crons[0].split() if crons else []
    check(len(fields) == 5 and fields[2] == "*" and fields[3] == "*" and fields[4] != "*",
          f"{relative}: schedule is not exactly once weekly")


# Data floors and the user-approved cost boundary.
events_document = json_file("polymythseminars/events.json")
events = events_document["events"]
sources = json_file("scripts/sources.json")["sources"]
teacher_document = json_file("teacherresources/resources-data.json")
teacher_entries = [
    entry
    for group in teacher_document["groups"]
    for category in group.get("categories", [])
    for entry in category.get("entries", [])
]
check(
    len(events) >= MINIMUM_EVENT_COUNT,
    f"Polymythcal event inventory fell below its verified floor: {len(events)}/{MINIMUM_EVENT_COUNT}",
)
check(
    len({event["id"] for event in events}) == len(events),
    "Polymythcal IDs are not unique",
)
check(len({event["type"] for event in events}) >= MINIMUM_EVENT_TYPES, f"Polymythcal type inventory fell below {MINIMUM_EVENT_TYPES}")
check(len(sources) >= MINIMUM_SOURCE_COUNT, f"Polymythcal source inventory fell below {MINIMUM_SOURCE_COUNT}: {len(sources)}")
check(len(teacher_entries) == 645, f"Teacher Resources count changed: {len(teacher_entries)}/645")
check(len(teacher_document["groups"]) == 7, "Teacher Resources group count changed from 7")
check(sum(len(group.get("categories", [])) for group in teacher_document["groups"]) == 25,
      "Teacher Resources collection count changed from 25")
methodology_index = text("polymyth/methodologylist/index.html")
methodology_archives = sorted((ROOT / "polymyth" / "methodologylist").glob("*/index.html"))
methodology_entry_count = sum(
    archive.read_text(encoding="utf-8").count('class="resource-row"')
    for archive in methodology_archives
)
methodology_display_match = re.search(
    r'id=["\']total["\']>\s*([\d,]+)\s*<',
    methodology_index,
    re.I,
)
methodology_display_count = (
    int(methodology_display_match.group(1).replace(",", ""))
    if methodology_display_match
    else 0
)
check(methodology_entry_count >= 1141,
      f"Methodology entries fell below the Audit 45 historical floor: {methodology_entry_count}/1,141")
check(methodology_display_count == methodology_entry_count,
      f"Methodology displayed/archive counts diverge: {methodology_display_count}/{methodology_entry_count}")
check(
    f"This HTML file renders its {methodology_entry_count:,} entries via JavaScript from an"
    in methodology_index,
    "Methodology static notice does not expose the live archive count",
)
exact_weekly_workflow(".github/workflows/scrape-polymythcal-protests.yml", "18 8 * * 3")
exact_weekly_workflow(".github/workflows/scrape-seminars.yml", "47 8 * * 1")
exact_weekly_workflow(".github/workflows/scrape-festivals.yml", "42 9 * * 2")
exact_weekly_workflow(".github/workflows/audit-external-links.yml", "17 10 * * 0")

# First-class source-language model.
event_languages = Counter(event.get("source_language") for event in events)
for event in events:
    check(event.get("source_language") in {"und", "mul"} or bool(event.get("source_languages")),
          f"{event['id']}: missing source language contract")
    check(isinstance(event.get("source_languages"), list),
          f"{event['id']}: source_languages is not an array")
    if event.get("source_language") == "und":
        check(event.get("source_language_review") == "required",
              f"{event['id']}: unknown source language lost recheck requirement")
check(
    sum(event_languages.values()) == len(events),
    "Source-language totals do not cover every event",
)
check(all(entry.get("source_languages") for entry in teacher_entries),
      "Teacher Resources has a resource without source_languages")
teacher_language_counts = Counter(entry.get("language") for entry in teacher_entries)
check(teacher_language_counts["fr-CA"] + teacher_language_counts["mul"] == 26,
      "Known French/FSL resource inventory changed from 26")

# Translation governance records and live source hashes.
governance = json_file("data/audit45-translation-governance.json")
records = governance["routes"]
check(governance.get("english_source_of_truth") is True, "English source-of-truth policy is missing")
check("never silently translate" in governance.get("organizer_text_policy", ""),
      "Organizer text preservation policy is missing")
check(len(records) == 61, f"Translation governance route records changed: {len(records)}/61")
for record in records:
    relative = record.get("source")
    check(bool(relative) and (ROOT / relative).is_file(),
          f"{record.get('route', record.get('route_pattern'))}: translation source missing")
    if relative and (ROOT / relative).is_file():
        check(sha(relative) == record.get("source_sha256"),
              f"{record.get('route', record.get('route_pattern'))}: stale source hash")

# Dedicated Leizu routes, honest bilingual fallback, metadata, and RTL.
home_markers = {
    "fr": "Cours particuliers, en ligne et à Toronto",
    "zh-hant": "私人家教，線上及多倫多面授",
    "zh-hans": "私人辅导，线上及多伦多面授",
    "fa": "آموزش خصوصی، آنلاین و در تورنتو",
}
summary_language_markers = {
    "fr": "anglais",
    "zh-hant": "英文",
    "zh-hans": "英文",
    "fa": "انگلیسی",
}
leizu_sitemap = text("sitemap.xml")
for segment, (tag, direction) in LOCALES.items():
    source = text(f"leizu/{segment}/index.html")
    check(html_attr(source, "html", "lang") == tag, f"Leizu {segment}: wrong root language")
    check(html_attr(source, "html", "dir") == direction, f"Leizu {segment}: wrong direction")
    check(canonical(source) == f"{SITE}/leizu/{segment}/", f"Leizu {segment}: wrong canonical")
    check(home_markers[segment] in source, f"Leizu {segment}: homepage is not statically localized")
    check(len(re.findall(r'<link\b[^>]*\bhreflang=', source, re.I)) == 6,
          f"Leizu {segment}: incomplete hreflang set")
    check("?lang=" not in "\n".join(re.findall(r'<link\b[^>]*\bhreflang=[^>]+>', source, re.I)),
          f"Leizu {segment}: query-string alternate remains")
    check("audit45-localization.css" in source, f"Leizu {segment}: resilient font fallbacks missing")
    for route in LEIZU_ROUTES:
        relative = f"leizu/{segment}/{route}/index.html"
        check((ROOT / relative).is_file(), f"{relative}: localized funnel route missing")
        route_source = text(relative)
        check(html_attr(route_source, "html", "lang") == tag, f"{relative}: wrong root language")
        check(html_attr(route_source, "html", "dir") == direction, f"{relative}: wrong root direction")
        check(canonical(route_source) == f"{SITE}/leizu/{segment}/{route}/",
              f"{relative}: wrong canonical")
        check('class="audit45-localized-summary"' in route_source,
              f"{relative}: localized summary missing")
        main_match = re.search(r'<main\b([^>]*)>([\s\S]*?)</main>', route_source, re.I)
        check(main_match is not None, f"{relative}: primary main landmark missing")
        if main_match:
            check('class="audit45-localized-summary"' in main_match.group(2),
                  f"{relative}: localized summary sits outside the primary main landmark")
            main_id_match = re.search(r'\bid=["\']([^"\']+)["\']', main_match.group(1), re.I)
            skip_match = re.search(
                r'<a\b(?=[^>]*\bclass=["\'][^"\']*\bskip-link\b)(?=[^>]*\bhref=["\']#([^"\']+)["\'])[^>]*>',
                route_source,
                re.I,
            )
            check(
                bool(main_id_match and skip_match and main_id_match.group(1) == skip_match.group(1)),
                f"{relative}: localized skip link does not target the primary main landmark",
            )
        check(len(re.findall(r'<h1\b', route_source, re.I)) == 1,
              f"{relative}: localized route does not expose exactly one page H1")
        check(re.search(r'<body\b[^>]*\blang=["\']en["\'][^>]*\bdir=["\']ltr["\']', route_source, re.I) is not None,
              f"{relative}: English source fallback lacks a language boundary")
        if re.search(r"<form\b", route_source, re.I):
            check(f'name="preferred_language" value="{tag}"' in route_source,
                  f"{relative}: form language state is not preserved")
        unlocalized_targets = re.findall(
            r'<(?:a|form)\b(?=[^>]*\b(?:href|action)=["\']/leizu/(?!fr/|zh-hant/|zh-hans/|fa/))[^>]*>',
            route_source,
            re.I,
        )
        check(
            all(re.search(r'\bhreflang=["\']en["\']', target, re.I) for target in unlocalized_targets),
            f"{relative}: navigation language state is not preserved",
        )
        status = meta(route_source, "translation-status")
        check(status == "localized-summary-english-detail",
              f"{relative}: summary-plus-English-detail status missing")
        check(meta(route_source, "robots") == "noindex,follow",
              f"{relative}: partial translation became indexable")
        summary_match = re.search(
            r'<section\b(?=[^>]*\bclass=["\'][^"\']*\baudit45-localized-summary\b)[^>]*>([\s\S]*?)</section>',
            route_source,
            re.I,
        )
        check(
            bool(summary_match and 'class="audit45-review"' in summary_match.group(1)),
            f"{relative}: honest language boundary note is missing",
        )
        check(
            bool(summary_match and summary_language_markers[segment] in strip_markup(summary_match.group(1))),
            f"{relative}: language boundary does not name the English detail",
        )
        check(
            bool(
                summary_match
                and re.search(
                    rf'<a\b(?=[^>]*\bhref=["\']/leizu/{re.escape(route)}/["\'])(?=[^>]*\bhreflang=["\']en["\'])[^>]*>',
                    summary_match.group(1),
                    re.I,
                )
            ),
            f"{relative}: immediate link to the complete English page is missing",
        )
        check(
            f"{SITE}/leizu/{segment}/{route}/" not in leizu_sitemap,
            f"{relative}: partial translation appears in the sitemap",
        )

# Polymythcal route tree and byte-faithful organizer content.
french_event_root = ROOT / "polymythseminars" / "fr" / "events"
canonical_event_ids = {str(event["id"]) for event in events}
legacy_alias_targets: dict[str, str] = {}
for event in events:
    for alias_id in event.get("legacy_ids") or []:
        alias_id = str(alias_id)
        check(alias_id not in canonical_event_ids,
              f"{alias_id}: French legacy alias collides with a canonical event ID")
        check(
            alias_id not in legacy_alias_targets
            or legacy_alias_targets[alias_id] == str(event["id"]),
            f"{alias_id}: French legacy alias has multiple canonical targets",
        )
        legacy_alias_targets[alias_id] = str(event["id"])
check(
    len(legacy_alias_targets) == FRENCH_LEGACY_ALIAS_COUNT,
    f"French legacy event alias count changed: {len(legacy_alias_targets)}/{FRENCH_LEGACY_ALIAS_COUNT}",
)
french_event_directories = {
    path.name for path in french_event_root.iterdir() if path.is_dir()
}
check(
    french_event_directories == canonical_event_ids | set(legacy_alias_targets),
    "French event route tree differs from the canonical inventory plus explicit legacy aliases",
)
for alias_id, target_id in legacy_alias_targets.items():
    relative = f"polymythseminars/fr/events/{alias_id}/index.html"
    check((ROOT / relative).is_file(), f"{relative}: French legacy alias route missing")
    if not (ROOT / relative).is_file():
        continue
    page = text(relative)
    alias_url = f"{SITE}/polymythseminars/fr/events/{quote(alias_id, safe='')}/"
    target_url = f"{SITE}/polymythseminars/fr/events/{quote(target_id, safe='')}/"
    check(meta(page, "robots") == "noindex,follow",
          f"{relative}: French legacy alias is indexable")
    check(meta(page, "translation-status") == "legacy-alias",
          f"{relative}: French legacy alias status missing")
    check(canonical(page) == target_url,
          f"{relative}: French legacy alias canonical target is wrong")
    check(alias_url not in text("sitemap.xml"),
          f"{relative}: French legacy alias appears in the sitemap")
for event in events:
    event_id = str(event["id"])
    encoded = quote(event_id, safe="")
    expected_part_lang = (
        event["source_languages"][0]
        if len(event.get("source_languages") or []) == 1
        else "und"
    )
    for locale, prefix, root_lang in (
        ("en", "", "en-CA"),
        ("fr", "fr/", "fr-CA"),
    ):
        relative = f"polymythseminars/{prefix}events/{event_id}/index.html"
        check((ROOT / relative).is_file(), f"{relative}: event route missing")
        page = text(relative)
        check(html_attr(page, "html", "lang") == root_lang, f"{relative}: wrong page language")
        check(canonical(page) == f"{SITE}/polymythseminars/{prefix}events/{encoded}/",
              f"{relative}: wrong canonical")
        title, title_lang = heading(page)
        check(title == " ".join(str(event.get("title") or "Untitled listing").split()),
              f"{relative}: organizer title was altered")
        check(title_lang == expected_part_lang, f"{relative}: organizer title language boundary is wrong")
        check(meta(page, "translation-source-sha256") == sha("polymythseminars/events.json"),
              f"{relative}: event source hash is stale")
        check("?lang=" not in "\n".join(re.findall(r'<link\b[^>]*\bhreflang=[^>]+>', page, re.I)),
              f"{relative}: false query-string alternate remains")
        if locale == "fr":
            check(
                "Toutes les fiches" in page
                and (not event.get("description") or "À propos de cette fiche" in page),
                  f"{relative}: French interface is incomplete")
            check("All listings ·" not in page and "About this listing" not in page,
                  f"{relative}: bilingual anti-yap regression")

for slug in ("polymythseminars", *FOCUSED):
    relative = "polymythseminars/fr/index.html" if slug == "polymythseminars" else f"{slug}/fr/index.html"
    source = text(relative)
    check(html_attr(source, "html", "lang") == "fr-CA", f"{relative}: wrong root language")
    check(meta(source, "og:locale", prop=True) == "fr_CA", f"{relative}: French social metadata missing")
    check("English" in source and "?lang=fr" not in canonical(source),
          f"{relative}: dedicated language route contract regressed")
    check(
        any(
            marker in source
            for marker in (
                "Points de départ populaires",
                "Calendriers ciblés",
                "Autres calendriers ciblés",
                "Commencer par un but, un intérêt ou un lieu",
            )
        ),
        f"{relative}: shell is not statically localized",
    )
for route in ("submit", "correct", "thanks", "subscribe"):
    source = text(f"polymythseminars/fr/{route}/index.html")
    check(html_attr(source, "html", "lang") == "fr-CA", f"French {route}: wrong root language")
    check(canonical(source) == f"{SITE}/polymythseminars/fr/{route}/",
          f"French {route}: wrong canonical")
check('action="/polymythseminars/fr/thanks/"' in text("polymythseminars/fr/submit/index.html"),
      "French submission form loses language at confirmation")
check('action="/polymythseminars/fr/thanks/"' in text("polymythseminars/fr/correct/index.html"),
      "French correction form loses language at confirmation")

revamp = text("js/polymythcal-revamp.js")
features = text("js/polymythcal-features.js")
check(revamp.count('const LANGUAGE_KEY = "polymythcal.lang.v1"') == 1,
      "Polymythcal has more than one language-state contract")
for marker in (
    "/polymythseminars/fr/", "Filter listings", "Calendar tools",
    "12 collections for writing, academic, celestial, and ritual interests",
    "Focused Polymythcal view", "Other focused calendars",
):
    check(marker in revamp, f"Polymythcal localization runtime lost {marker}")
check("languagePath" in features and "localizeNavigation" in features,
      "Polymythcal utility navigation no longer preserves dedicated language routes")

# Saul route and factual-parity repair contracts.
saul = text("saul/index.html")
check("margin-left:50%" not in text("saul/assets/saul-cv-spectrum-2026.css"),
      "Saul CV centering still displaces RTL content")
check("translateX(-50%)" not in text("saul/assets/saul-cv-spectrum-2026.css"),
      "Saul CV still uses direction-sensitive centering")
check("SAUL_AUDIT45_ARCHIVE_COPY" in saul and "localizeArchiveDate" in saul,
      "Saul missing-record/date parity repair is absent")
for marker in (
    "The Agora", "Ohm Dome", "Polymyth Research Archive", "Polymythcal", "Florilegium",
    "AODA Training", "BUMI Festival", "Claude Watson",
):
    check(marker in saul, f"Saul translation repair lost {marker}")
for segment, (tag, direction) in LOCALES.items():
    source = text(f"saul/{segment}/index.html")
    check(html_attr(source, "html", "lang") == tag, f"Saul {segment}: wrong root language")
    check(html_attr(source, "html", "dir") == direction, f"Saul {segment}: wrong direction")
    check(html_attr(source, "html", "data-saul-archive-language") in {"fr", "zh", "zhs", "fa"},
          f"Saul {segment}: no prepaint archive language")
    check(canonical(source) == f"{SITE}/saul/{segment}/", f"Saul {segment}: wrong canonical")
    check(len(re.findall(r'<link\b[^>]*\bhreflang=', source, re.I)) == 6,
          f"Saul {segment}: incomplete hreflang set")
    check(meta(source, "twitter:title") == meta(source, "og:title", prop=True),
          f"Saul {segment}: Twitter title is not localized")
    check(meta(source, "twitter:description") == meta(source, "og:description", prop=True),
          f"Saul {segment}: Twitter description is not localized")

# Teacher Resources remains English while source language is usable and semantic.
teacher_index = text("teacherresources/index.html")
check('id="language-chips"' in teacher_index and "Source language" in teacher_index,
      "Teacher Resources source-language filter surface is missing")
check(len(re.findall(r'\bdata-l=["\'][^"\']+["\']', teacher_index)) == 645,
      "Teacher Resources SSR entries do not all expose source language")
finder = text("teacherresources/finder.js")
for marker in ("LANGUAGES", "tr-filters-v4", "params.set('language'", "state.languages"):
    check(marker in finder, f"Teacher Resources language filtering lost {marker}")
detail_pages = []
for page in (ROOT / "teacherresources").rglob("index.html"):
    source = page.read_text(encoding="utf-8")
    if '"@type":"LearningResource"' in source:
        detail_pages.append((page, source))
check(len(detail_pages) == 645, f"Teacher Resources detail route count changed: {len(detail_pages)}/645")
for page, source in detail_pages:
    check('"inLanguage":[' in source, f"{page.relative_to(ROOT)}: LearningResource.inLanguage missing")
    check("<dt>Source language</dt>" in source, f"{page.relative_to(ROOT)}: visible source language missing")
    check(re.search(r"<h1\b[^>]*\blang=", source, re.I) is not None,
          f"{page.relative_to(ROOT)}: source title language boundary missing")

# BB cleanup, footer localization, and resilient language fonts.
bb = text("bb/why/zh/index.html")
check(html_attr(bb, "html", "lang") == "zh-Hans", "BB Chinese essay lost zh-Hans")
check("跳到主要内容" in bb and "参考文献" in bb, "BB Chinese chrome is incomplete")
check(len(re.findall(r'<p\b(?=[^>]*\bclass=["\'][^"\']*\bref\b)[^>]*\blang=["\']en["\']', bb, re.I)) == 23,
      "BB English references do not all have language boundaries")
check('class="lang-switch"' in bb and 'lang="en"' in bb,
      "BB English-version boundary is missing")
footer = text("js/footer.js")
for marker in (
    "20260725-audit45-footer", r"Ressources p\u00e9dagogiques",
    r"\u6559\u5e08\u8d44\u6e90", r"\u0645\u0646\u0627\u0628\u0639 \u0645\u0639\u0644\u0645\u0627\u0646",
):
    check(marker in footer, f"Localized shared footer lost {marker}")
font_css = text("css/audit45-localization.css")
for marker in ("Songti SC", "SimSun", "Noto Naskh Arabic", "Tahoma"):
    check(marker in font_css, f"Localized system-font fallback lost {marker}")

# Deployment/build permanence and sitemap discoverability.
builder = text("scripts/build-audit45-localized-routes.py")
check("lxml" not in builder and "BeautifulSoup" not in builder,
      "Audit 45 builder regained an undeclared deployment dependency")
sitemap = text("sitemap.xml")
check("AUDIT45_LOCALIZED_START" in sitemap, "Localized sitemap block is missing")
check("?lang=fr" not in sitemap, "Sitemap contains query-string language alternates")
check(f"{SITE}/leizu/fr/" in sitemap and f"{SITE}/polymythseminars/fr/" in sitemap,
      "Dedicated localized route trees are absent from the sitemap")

report = {
    "schema": "seminar-schools-audit45-translation-static-v1",
    "release": "audit45",
    "assertions": assertions,
    "passed": assertions - len(failures),
    "failed": len(failures),
    "metrics": {
        "events": len(events),
        "event_types": len({event["type"] for event in events}),
        "sources": len(sources),
        "french_event_routes": len(canonical_event_ids),
        "french_event_legacy_alias_routes": len(legacy_alias_targets),
        "leizu_localized_routes": 40,
        "saul_localized_routes": 4,
        "teacher_resources": len(teacher_entries),
        "teacher_language_counts": dict(teacher_language_counts),
        "methodology_entries": methodology_entry_count,
        "governed_route_records": len(records),
        "event_source_language_counts": {
            str(key): value for key, value in event_languages.items()
        },
        "scrape_cadence": "exactly once weekly",
    },
    "failures": failures,
}
REPORT.parent.mkdir(parents=True, exist_ok=True)
rendered_report = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
if not REPORT.exists() or REPORT.read_text(encoding="utf-8") != rendered_report:
    REPORT.write_text(rendered_report, encoding="utf-8")
if os.environ.get("SS_REPORT_OUTPUT_MTIME"):
    try:
        report_moment = datetime.fromisoformat(
            os.environ["SS_REPORT_OUTPUT_MTIME"].replace("Z", "+00:00")
        )
        if report_moment.tzinfo is None:
            report_moment = report_moment.replace(tzinfo=timezone.utc)
        report_mtime = report_moment.timestamp()
        os.utime(REPORT, (report_mtime, report_mtime))
    except ValueError as error:
        raise SystemExit("SS_REPORT_OUTPUT_MTIME must be a valid timestamp") from error
if failures:
    print(f"AUDIT 45 TRANSLATION GATE FAILED — {len(failures)}/{assertions} assertions failed.", file=sys.stderr)
    for failure in failures[:80]:
        print(f" - {failure}", file=sys.stderr)
    if len(failures) > 80:
        print(f" - …and {len(failures) - 80} more", file=sys.stderr)
    raise SystemExit(1)
print(
    "AUDIT 45 TRANSLATION GATE PASSED — "
    f"{assertions}/{assertions} assertions; {len(events)} events; 40 Leizu routes; "
    f"{len(canonical_event_ids)} French event routes plus "
    f"{len(legacy_alias_targets)} aliases; 645 Teacher Resources; weekly cadence preserved."
)
