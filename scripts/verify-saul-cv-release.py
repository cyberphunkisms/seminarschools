#!/usr/bin/env python3
"""Verify the generated Saul CV release at the document and PDF level."""

from __future__ import annotations

import hashlib
import json
import re
import shutil
import subprocess
import tempfile
import zipfile
from pathlib import Path

from docx import Document
from docx.oxml.ns import qn
from PIL import Image, ImageChops
from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data" / "saul-ultimate-school-cv-2026.json"
HISTORICAL_PATH = ROOT / "data" / "saul-cv-records.json"
MANIFEST_PATH = ROOT / "data" / "saul-cv-pdf-manifest.json"
DOWNLOADS = ROOT / "saul" / "downloads"

PROTON_DOCX = DOWNLOADS / "saul-karim-nassau-ultimate-school-cv-2026-protonmail.docx"
GMAIL_DOCX = DOWNLOADS / "saul-karim-nassau-ultimate-school-cv-2026-gmail.docx"
PROTON_PDF = PROTON_DOCX.with_suffix(".pdf")
GMAIL_PDF = GMAIL_DOCX.with_suffix(".pdf")
EVERYTHING_PDF = DOWNLOADS / "saul-karim-nassau-complete-career-archive-cv.pdf"

NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}


def fail(message: str) -> None:
    raise AssertionError(message)


def need(condition: bool, message: str) -> None:
    if not condition:
        fail(message)


def normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", value.replace("\x00", "")).strip()


def pdf_text(path: Path) -> str:
    return "\n".join(page.extract_text() or "" for page in PdfReader(str(path)).pages)


def pdf_pages(path: Path) -> int:
    return len(PdfReader(str(path)).pages)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def xml_attr(element, local_name: str) -> str | None:
    return element.get(qn(f"w:{local_name}")) if element is not None else None


def paragraph_spacing(paragraph) -> tuple[str | None, str | None, str | None, str | None]:
    spacing = paragraph._p.find("./w:pPr/w:spacing", NS)
    return (
        xml_attr(spacing, "before"),
        xml_attr(spacing, "after"),
        xml_attr(spacing, "line"),
        xml_attr(spacing, "lineRule"),
    )


def run_size(run) -> str | None:
    size = run._element.find("./w:rPr/w:sz", NS)
    return xml_attr(size, "val")


def verify_application_docx(path: Path, data: dict, expected_email: str) -> None:
    document = Document(path)
    paragraphs = document.paragraphs
    expected_sections = data["experience_sections"]
    closing_title = "EDUCATION, PROFESSIONAL LEARNING & LANGUAGES"
    headings = [section["title"].upper() for section in expected_sections] + [closing_title]

    whole_text = "\n".join(paragraph.text for paragraph in paragraphs)
    need(expected_email in whole_text, f"{path.name} is missing its expected email")
    other_email = (
        data["contact"]["alternate_email"]
        if expected_email == data["contact"]["public_email"]
        else data["contact"]["public_email"]
    )
    need(other_email not in whole_text, f"{path.name} contains both email editions")
    for required in (
        data["contact"]["site_label"],
        data["contact"]["reviews_label"],
        "Fundraiser & Volunteer Coordinator",
        "Greenpeace",
        "La Plante & Other Mile End Venues",
        "Farsi: Advanced Speaking & Reading; Functional, Slower Writing",
        "French: Basic",
        "Mandarin: Basic",
        "Bronze Cross & First Aid Training, 2006 (Not Current)",
    ):
        need(required in whole_text, f"{path.name} is missing {required}")
    need("Farsi Advanced" not in whole_text, f"{path.name} contains imprecise Farsi wording")

    heading_indexes = []
    for heading in headings:
        matches = [index for index, paragraph in enumerate(paragraphs) if paragraph.text == heading]
        need(len(matches) == 1, f"{path.name} must contain one {heading} heading")
        heading_indexes.append(matches[0])

    exact_half_point_spacers = []
    for heading_index in heading_indexes:
        spacer = paragraphs[heading_index + 1]
        need(not spacer.text.strip(), f"{path.name} has content in a heading spacer")
        need(
            paragraph_spacing(spacer) == ("0", "0", "10", "exact"),
            f"{path.name} has a non-0.5-point heading spacer",
        )
        exact_half_point_spacers.append(spacer)

    all_half_point_spacers = [
        paragraph
        for paragraph in paragraphs
        if paragraph_spacing(paragraph) == ("0", "0", "10", "exact")
    ]
    need(
        len(all_half_point_spacers) == 4
        and all(paragraph in exact_half_point_spacers for paragraph in all_half_point_spacers),
        f"{path.name} must contain exactly four 0.5-point spacers below headings only",
    )

    verified_rows = []
    for section_index, section in enumerate(expected_sections):
        heading_index = heading_indexes[section_index]
        next_heading_index = heading_indexes[section_index + 1]
        section_paragraphs = paragraphs[heading_index + 2 : next_heading_index]
        need(
            len(section_paragraphs) == len(section["records"]),
            f"{path.name} has an unexpected blank or extra row in {section['title']}",
        )

        for paragraph, record in zip(section_paragraphs, section["records"], strict=True):
            expected = (
                f"{record['role']} | {record['description']} | "
                f"{record['organization']}\t{record['dates']}"
            )
            need(paragraph.text == expected, f"{path.name} row drifted: {record['id']}")
            need(
                paragraph_spacing(paragraph)[:2] == ("0", "0"),
                f"{path.name} has spacing between experience rows: {record['id']}",
            )
            need(
                paragraph_spacing(paragraph)[2:] == ("250", "exact"),
                f"{path.name} has inconsistent experience leading: {record['id']}",
            )
            tabs = paragraph._p.findall("./w:pPr/w:tabs/w:tab", NS)
            need(
                len(tabs) == 1
                and xml_attr(tabs[0], "val") == "right"
                and xml_attr(tabs[0], "pos") == "10829",
                f"{path.name} date is not on the locked right tab: {record['id']}",
            )
            need(
                not paragraph._p.findall(".//w:br", NS),
                f"{path.name} experience row contains a forced line break: {record['id']}",
            )

            role_runs = [run for run in paragraph.runs if run.text == record["role"]]
            description_runs = [
                run for run in paragraph.runs if run.text == record["description"]
            ]
            date_runs = [run for run in paragraph.runs if run.text == record["dates"]]
            need(
                len(role_runs) == 1
                and run_size(role_runs[0]) == "22"
                and role_runs[0].bold is True,
                f"{path.name} role is not 11-point bold: {record['id']}",
            )
            need(
                len(description_runs) == 1 and run_size(description_runs[0]) == "20",
                f"{path.name} description is not 10 point: {record['id']}",
            )
            need(
                len(date_runs) == 1 and run_size(date_runs[0]) == "22",
                f"{path.name} date is not 11 point: {record['id']}",
            )
            verified_rows.append(record["id"])

    expected_ids = [
        record["id"]
        for section in expected_sections
        for record in section["records"]
    ]
    need(verified_rows == expected_ids, f"{path.name} does not preserve all 37 rows in order")


def normalized_docx_members(path: Path, emails: tuple[str, str]) -> dict[str, bytes]:
    with zipfile.ZipFile(path) as archive:
        normalized = {}
        for name in archive.namelist():
            payload = archive.read(name)
            for email in emails:
                payload = payload.replace(email.encode("utf-8"), b"__EMAIL__")
            normalized[name] = payload
        return normalized


def verify_email_only_docx_pair(data: dict) -> None:
    emails = (data["contact"]["public_email"], data["contact"]["alternate_email"])
    proton = normalized_docx_members(PROTON_DOCX, emails)
    gmail = normalized_docx_members(GMAIL_DOCX, emails)
    need(proton.keys() == gmail.keys(), "Gmail and ProtonMail DOCX packages differ in members")
    differences = [name for name in proton if proton[name] != gmail[name]]
    need(
        not differences,
        "Gmail and ProtonMail DOCX packages differ outside the normalized email: "
        + ", ".join(differences),
    )


def verify_email_only_pdf_pair(data: dict) -> None:
    need(pdf_pages(PROTON_PDF) == 1, "ProtonMail application PDF is not one page")
    need(pdf_pages(GMAIL_PDF) == 1, "Gmail application PDF is not one page")
    proton_text = pdf_text(PROTON_PDF)
    gmail_text = pdf_text(GMAIL_PDF)
    for email in (data["contact"]["public_email"], data["contact"]["alternate_email"]):
        proton_text = proton_text.replace(email, "__EMAIL__")
        gmail_text = gmail_text.replace(email, "__EMAIL__")
    need(
        normalize_text(proton_text) == normalize_text(gmail_text),
        "Gmail and ProtonMail PDF text differs outside the email",
    )

    renderer = shutil.which("pdftoppm")
    need(renderer is not None, "pdftoppm is required for the email-only visual check")
    with tempfile.TemporaryDirectory(prefix="saul-cv-release-") as temporary:
        temp = Path(temporary)
        for source, stem in ((PROTON_PDF, "proton"), (GMAIL_PDF, "gmail")):
            subprocess.run(
                [
                    renderer,
                    "-f",
                    "1",
                    "-singlefile",
                    "-r",
                    "150",
                    "-png",
                    str(source),
                    str(temp / stem),
                ],
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
        proton_image = Image.open(temp / "proton.png").convert("RGB")
        gmail_image = Image.open(temp / "gmail.png").convert("RGB")
        need(proton_image.size == gmail_image.size, "application PDF page sizes differ")
        bbox = ImageChops.difference(proton_image, gmail_image).getbbox()
        need(bbox is not None, "Gmail and ProtonMail PDF renders are unexpectedly identical")
        _, top, _, bottom = bbox
        need(
            top < 250 and bottom < 250 and bottom - top < 80,
            f"application PDF renders differ outside the contact email line: {bbox}",
        )


def verify_modular_and_everything(data: dict, historical: dict, manifest: dict) -> None:
    modular = manifest["modular_outputs"]
    need(len(modular) == 36, "manifest must contain 36 modular outputs")
    pdf_outputs = [output for output in modular if output["type"] in {"designed", "ats"}]
    need(len(pdf_outputs) == 24, "manifest must contain 24 modular PDFs")
    hashes = []
    expected_greenpeace = {
        "general",
        "community",
        "programs",
        "volunteer-events",
        # The archive-only portfolio export deliberately falls back to the complete
        # application ledger when it has no application rows of its own.
        "portfolio",
    }
    for output in pdf_outputs:
        path = ROOT / output["path"]
        need(path.exists(), f"missing modular output: {output['path']}")
        need(pdf_pages(path) == 1, f"modular PDF is not one page: {output['path']}")
        need(sha256(path) == output["sha256"], f"modular hash drifted: {output['path']}")
        hashes.append(output["sha256"])
        output_text = normalize_text(pdf_text(path))
        contains_greenpeace = "Greenpeace" in output_text
        need(
            contains_greenpeace == (output["focus"] in expected_greenpeace),
            f"Greenpeace focus membership drifted: {output['path']}",
        )
        for heading in ("QUALIFICATIONS", "EDUCATION", "CREDENTIALS", "LANGUAGES"):
            need(heading in output_text, f"focused PDF is missing {heading}: {output['path']}")
        focus_records = [
            record
            for section in data["experience_sections"]
            for record in section["records"]
            if output["focus"] in {"general", "portfolio"}
            or output["focus"] in record.get("focus", [])
        ]
        for record in focus_records:
            if record.get("web_detail"):
                need(
                    normalize_text(record["web_detail"]) in output_text,
                    f"focused PDF detached or omitted {record['id']} detail: {output['path']}",
                )
        if output["focus"] in {
            "teaching",
            "programs",
            "customer-education",
            "community",
            "volunteer-events",
        }:
            teaching_intro = data["experience_sections"][0].get("web_intro", "")
            need(
                normalize_text(teaching_intro) in output_text,
                f"focused PDF is missing the integrated teaching summary: {output['path']}",
            )
    need(len(set(hashes)) == len(hashes), "two modular PDFs are hidden aliases")
    need(
        all(value != sha256(PROTON_PDF) for value in hashes),
        "a modular PDF is an alias of the ProtonMail application PDF",
    )

    everything_text = normalize_text(pdf_text(EVERYTHING_PDF))
    need(pdf_pages(EVERYTHING_PDF) == 5, "EVERYTHING PDF must be five filled pages")
    need(
        "APPLICATION EXPERIENCE · 37 RECORDS" in everything_text,
        "EVERYTHING PDF does not declare all 37 application records",
    )
    for section in data["experience_sections"]:
        if section.get("web_intro"):
            need(
                normalize_text(section["web_intro"]) in everything_text,
                f"EVERYTHING PDF is missing {section['id']} summary",
            )
        for record in section["records"]:
            for required in (
                record["role"],
                record["description"],
                record["organization"],
                record["dates"],
            ):
                need(required in everything_text, f"EVERYTHING PDF is missing {record['id']}: {required}")
            if record.get("web_detail"):
                need(
                    normalize_text(record["web_detail"]) in everything_text,
                    f"EVERYTHING PDF is missing {record['id']} detail",
                )
    need(
        len(historical.get("records", [])) == 65,
        "historical archive must contain all 65 records",
    )
    for record in historical["records"]:
        # The compact archive font is Latin; compare the preserved Latin title
        # when an older record also carries a parenthetical Chinese name.
        expected_title = re.sub(r"[\u3400-\u9fff]+", "", record["title"])
        need(
            normalize_text(expected_title) in everything_text,
            f"EVERYTHING PDF is missing historical record: {record['title']}",
        )


def verify_website(data: dict) -> None:
    html = (ROOT / "saul" / "index.html").read_text(encoding="utf-8")
    need(
        len(re.findall(r'data-experience-row="[^"]+"', html)) == 37,
        "website must show 37 application rows",
    )
    need(html.count("Greenpeace") >= 2, "website must include Greenpeace in both ledgers")
    for required in (
        "Fundraiser &amp; Volunteer Coordinator",
        "2006–2010",
        "saul-karim-nassau-ultimate-school-cv-2026-protonmail.pdf",
        "saul-karim-nassau-ultimate-school-cv-2026-protonmail.docx",
        "saul-karim-nassau-complete-career-archive-cv.pdf",
    ):
        need(required in html, f"website is missing {required}")
    need(
        "saul-karim-nassau-general-cv.pdf" not in html,
        "the public website exposes the owner/index general CV",
    )
    need(
        "saul-karim-nassau-all-cv-outputs.zip" not in html,
        "the public website exposes the owner-facing CV output archive",
    )


def main() -> None:
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    historical = json.loads(HISTORICAL_PATH.read_text(encoding="utf-8"))
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    need(
        [len(section["records"]) for section in data["experience_sections"]] == [16, 13, 8],
        "canonical application ledger must contain 16 / 13 / 8 rows",
    )
    verify_application_docx(PROTON_DOCX, data, data["contact"]["public_email"])
    verify_application_docx(GMAIL_DOCX, data, data["contact"]["alternate_email"])
    verify_email_only_docx_pair(data)
    verify_email_only_pdf_pair(data)
    verify_modular_and_everything(data, historical, manifest)
    verify_website(data)
    print(
        "SAUL CV RELEASE CHECK PASSED — 37 application experiences, 65 historical "
        "records, exact 11/10-point hierarchy, four heading-only 0.5-point spacers, "
        "zero experience-row gaps, right-tabbed dates, email-only application variants, "
        "and distinct role-focused and complete-career outputs."
    )


if __name__ == "__main__":
    main()
