#!/usr/bin/env node
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "saul", "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "saul", "assets", "saul-ultimate-cv-2026.css"), "utf8");
const moduleJs = fs.readFileSync(
  path.join(root, "saul", "assets", "saul-ultimate-cv-modules-2026.js"),
  "utf8"
);
const data = JSON.parse(
  fs.readFileSync(path.join(root, "data", "saul-ultimate-school-cv-2026.json"), "utf8")
);
const canonical = JSON.parse(
  fs.readFileSync(path.join(root, "data", "saul-cv-canonical-2026.json"), "utf8")
);
const packageData = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8")
);
const downloadManifest = JSON.parse(
  fs.readFileSync(path.join(root, "data", "saul-cv-pdf-manifest.json"), "utf8")
);
const historicalData = JSON.parse(
  fs.readFileSync(path.join(root, "data", "saul-cv-records.json"), "utf8")
);
const redirects = fs.readFileSync(path.join(root, "_redirects"), "utf8");
const failures = [];

const need = (condition, message) => {
  if (!condition) failures.push(message);
};
const escapeHTML = value =>
  String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);
const digest = file =>
  crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

const start = html.indexOf('<section class="cv-ultimate"');
const end = html.indexOf('<section aria-labelledby="cvMapTitle"', start);
need(start >= 0 && end > start, "ultimate CV section markers are missing");
const cv = start >= 0 && end > start ? html.slice(start, end) : "";
const plain = cv
  .replace(/<[^>]+>/g, " ")
  .replace(/&amp;/g, "&")
  .replace(/&nbsp;/g, " ")
  .replace(/&#39;/g, "'")
  .replace(/&quot;/g, '"')
  .replace(/\s+/g, " ");

need(
  packageData.scripts?.["build:saul-cv"] ===
    "node scripts/run-python.js scripts/build-saul-ultimate-web-cv.py && node scripts/verify-saul-ultimate-web-cv.js && node scripts/run-python.js scripts/verify-saul-cv-release.py",
  "build:saul-cv can invoke a retired CV generator"
);
need(
  downloadManifest.status === "active" &&
    downloadManifest.application_outputs?.length === 4 &&
    downloadManifest.modular_outputs?.length === 36 &&
    downloadManifest.policy?.role_focused_pdfs_are_distinct_outputs === true,
  "download manifest does not describe the editable application, modular and EVERYTHING outputs"
);

const expectedCounts = [16, 13, 8];
const expectedTotal = expectedCounts.reduce((sum, value) => sum + value, 0);
need(
  data.experience_sections.length === 3,
  "ultimate data must have exactly three experience sections"
);
need(
  JSON.stringify(data.experience_sections.map(section => section.records.length)) ===
    JSON.stringify(expectedCounts),
  "experience section counts must be 16 / 13 / 8"
);
need(
  (cv.match(/data-experience-row=/g) || []).length === expectedTotal,
  "rendered application CV must contain exactly 37 rows"
);
need(
  (cv.match(/data-experience-id=/g) || []).length === expectedTotal,
  "rendered application CV must contain exactly 37 stable record IDs"
);
need(
  (cv.match(/data-experience-section=/g) || []).length === 3,
  "rendered application CV must contain exactly three experience sections"
);

for (const section of data.experience_sections) {
  for (const record of section.records) {
    for (const field of ["role", "description", "organization", "dates"]) {
      need(
        cv.includes(escapeHTML(record[field])),
        `rendered CV is missing ${field}: ${record[field]}`
      );
    }
  }
}

const records = data.experience_sections.flatMap(section => section.records);
const recordIds = records.map(record => record.id);
const applicationModules = data.focus_modules.filter(
  module => !module.archive_only && !module.default_view
);
const applicationModuleIds = new Set(applicationModules.map(module => module.id));
need(new Set(recordIds).size === expectedTotal, "application record IDs must be unique");
need(applicationModuleIds.size === 10, "application must expose ten additive focus modules");
for (const record of records) {
  need(Array.isArray(record.focus) && record.focus.length > 0, `${record.id} has no focus metadata`);
  for (const focus of record.focus || []) {
    need(
      focus === "general" || applicationModuleIds.has(focus),
      `${record.id} has an unknown focus: ${focus}`
    );
  }
}
const portfolio = data.focus_modules.find(module => module.id === "portfolio");
need(
  portfolio?.archive_only === true,
  "Portfolio must remain an archive-only module"
);
need(
  !records.some(record => record.focus.includes("portfolio")),
  "Portfolio/project records entered the application ledger"
);
need(
  records.some(
    record =>
      record.role === "Fundraiser & Volunteer Coordinator" &&
      record.organization === "Greenpeace" &&
      record.dates === "2006–2010"
  ),
  "the verified Greenpeace experience is missing from the canonical application ledger"
);

for (const required of [
  "12+ years",
  "15 curricula & programs",
  "2,000+ students",
  "successful instructional inspections in Ontario & British Columbia",
  "La Plante & Other Mile End Venues",
  "Fundraiser & Volunteer Coordinator",
  "Greenpeace",
  "2006–2010",
  "Somalian Protracted Civil Conflict",
  "Research Group on Constitutional Studies",
  "Professor Catherine Malabou",
  "Jun 2025–May 2026",
  "seminarschools.com/saul",
  "seminarschools.com/reviews",
]) {
  need(plain.includes(required), `rendered CV is missing required text: ${required}`);
}

for (const forbidden of [
  /\bph\.?d\.?\b/i,
  /\bleizu\b/i,
  /independent refugee support/i,
  /\btelus\b/i,
  /\b1,000\+/i,
  /saulnassau\.com/i,
]) {
  need(!forbidden.test(plain), `rendered CV contains forbidden text: ${forbidden}`);
}

for (const retiredDoctoralClaim of [
  "博士研究",
  "دکترای",
  "travail doctoral",
]) {
  need(
    !html.toLocaleLowerCase().includes(retiredDoctoralClaim.toLocaleLowerCase()),
    `career archive contains a retired doctoral claim: ${retiredDoctoralClaim}`
  );
}
need(
  !/\bph\.?d\.?\b|doctoral|博士|دکترا/i.test(html),
  "the /saul page contains a retired doctoral or PhD claim"
);

need(
  cv.includes(`mailto:${data.contact.public_email}`),
  "public contact email target is missing"
);
need(
  cv.includes(data.contact.alternate_email),
  "alternate Gmail edition is not identified"
);
need(
  !html.includes("saul-cv-spectrum-2026.js"),
  "obsolete spectrum runtime is still loaded on /saul/"
);
need(
  html.includes("saul-ultimate-cv-2026.css?v=20260727-modular"),
  "ultimate CV stylesheet is not loaded"
);
need(
  html.includes("saul-ultimate-cv-modules-2026.js?v=20260727-modular"),
  "modular focus runtime is not loaded"
);
need(
  (html.match(/<script type="application\/ld\+json">/g) || []).length === 1,
  "the page must contain exactly one JSON-LD block"
);
need(
  !canonical.education.some(value => /phd/i.test(value)),
  "legacy canonical education still contains PhD"
);
need(
  canonical.rules.ultimate_application_cv === true,
  "legacy canonical does not point to the ultimate application CV"
);
need(
  Array.isArray(canonical.focus_modules) && canonical.focus_modules.length === 12,
  "public canonical CV data is missing the twelve declared focus paths"
);
for (const required of [
  "I have 12+ years of international teaching experience across 15 curricula &amp; programs",
  "Word reports, whiteboard-led seminars, workshops, and presentations",
  "English · Farsi (advanced) · French & Mandarin (basic)",
  "英語 · 波斯語（進階）· 法語及普通話（基礎）",
  "英语 · 波斯语（高级）· 法语及普通话（基础）",
  "انگلیسی · فارسی (پیشرفته) · فرانسوی و ماندارین (پایه)",
  "Anglais · Farsi (avancé) · Français et mandarin (élémentaires)",
  "Key Skills",
  "Smart Serve (Historical)",
  "Ontario Security Guard Licence (Historical)",
  "MA Philosophy, Art &amp; Critical Thought, European Graduate School (2019)",
  "BA Political Science, Economics &amp; Philosophy, McGill University (2014)",
  '"Occasional Teacher, Intelligent International"',
  '"Occasional Instructor, RoboThink Toronto, Markham"',
  '"Occasional Instructor, Happy Learning Education Center"',
  '"兼任教師，Intelligent International"',
  '"兼任教师，Intelligent International"',
  '"معلم موردی، Intelligent International"',
  '"Enseignant occasionnel, Intelligent International"',
  '"兼任講師，RoboThink, 萬錦"',
  '"兼任讲师，RoboThink, 万锦"',
  '"مدرس موردی، RoboThink, مارکهام"',
  '"Formateur occasionnel, RoboThink, Markham"',
  '"兼任講師，Happy Learning"',
  '"兼任讲师，Happy Learning"',
  '"مدرس موردی، Happy Learning"',
  '"Formateur occasionnel, Happy Learning"',
  '"Early Childhood STEM"',
  '"幼兒 STEM"',
  '"幼儿 STEM"',
  '"STEM دوران کودکی"',
  '"STIM – petite enfance"',
  '"Jun 2025–May 2026"',
]) {
  need(html.includes(required), `career archive is missing the corrected value: ${required}`);
}
for (const forbidden of [
  "more than a thousand students",
  "一千多名",
  "بیش از هزار دانش‌آموز",
  "plus de mille étudiants",
  "I have taught in six countries across fifteen curricula",
  "我曾在六個國家、橫跨十五種課綱中任教",
  "我曾在六个国家、横跨十五种课纲中任教",
  "من در شش کشور و در پانزده برنامهٔ درسی تدریس کرده‌ام",
  "J'ai enseigné dans six pays à travers quinze curricula",
  "Word and PowerPoint reports",
  "English · Basic French, Farsi, and Mandarin",
  "up to Grade 4",
  "四年級",
  "四年级",
  "پایهٔ چهارم",
  "4e année",
  'moduleHelper: "Choose one or more areas before downloading."',
  "Thousands of learners",
  "Core Skills",
  '"Jun 2025–Feb 2026"',
]) {
  need(!html.includes(forbidden), `career archive still contains stale text: ${forbidden}`);
}
const archiveDataStart = html.indexOf("const D = [");
const archiveDataEnd = html.indexOf("\n];", archiveDataStart);
const archiveDataSource =
  archiveDataStart >= 0 && archiveDataEnd > archiveDataStart
    ? html.slice(archiveDataStart, archiveDataEnd)
    : "";
need(
  historicalData.records?.length === 65 &&
    historicalData.records.some(record => /Greenpeace/.test(record.title || "")),
  "historical career and project archive must retain all 65 dated records"
);
need(
  html.includes('id="places"') && html.includes('id="careerArchive"'),
  "website-only map or historical archive is missing"
);
need(
  /\/saul\/cv\/teaching\/\s+\/saul\/\?focus=teaching#experienceLedger\s+301/.test(redirects),
  "teaching focus route is not connected to the modular CV"
);
need(
  /\/saul\/cv\/portfolio\/\s+\/saul\/\?archive=portfolio#careerArchive\s+301/.test(redirects),
  "Portfolio route is not isolated in the historical archive"
);

for (const pattern of [
  /\.cv-ultimate__rows\s*\{[\s\S]*?gap:\s*0;[\s\S]*?margin-top:\s*\.5pt;/,
  /\.cv-ultimate__row\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s*max-content;[\s\S]*?margin:\s*0;[\s\S]*?padding:\s*0;/,
  /\.cv-ultimate__row time\s*\{[\s\S]*?text-align:\s*right;[\s\S]*?white-space:\s*nowrap;/,
  /@media print[\s\S]*?\.cv-ultimate__row-copy,[\s\S]*?font-size:\s*11pt;/,
  /@media print[\s\S]*?\.cv-ultimate__description\s*\{[\s\S]*?font-size:\s*10pt;/,
]) {
  need(pattern.test(css), `stylesheet invariant is missing: ${pattern}`);
}
need(
  (css.match(/\.5pt/g) || []).length === 2,
  "0.5pt spacing must appear only below experience-section headings on screen and in print"
);
need(
  /\.cv-ultimate__portrait img\s*\{[^}]*aspect-ratio:\s*1\s*\/\s*1;[^}]*border-radius:\s*50%;[^}]*object-fit:\s*cover;[^}]*object-position:\s*50%\s+38%;/.test(css),
  "portrait is not using the locked true-circle treatment"
);
need(
  !/\.cv-ultimate__portrait img\s*\{[^}]*aspect-ratio:\s*4\s*\/\s*5/.test(css),
  "portrait reverted to the rounded-rectangle crop"
);
need(
  !/\.slice\(\s*0\s*,\s*[57]\s*\)/.test(moduleJs),
  "focus runtime contains a legacy five- or seven-row cap"
);
for (const required of [
  "history.pushState",
  "popstate",
  "dataset.filteredOut",
  'url.searchParams.set("focus"',
  'navigator.clipboard.writeText(location.href)',
  '"Key Skills for This Focus"',
  '"Key Skills"',
  "data-focus-pdf",
  "focusPrint",
  "window.print()",
]) {
  need(moduleJs.includes(required), `focus runtime is missing: ${required}`);
}
need(
  !moduleJs.includes('"Core Skills"') &&
    !moduleJs.includes('"Skills for this focus"'),
  "focus runtime can restore a retired skills heading"
);

const downloads = {
  protonPdf: path.join(root, "saul", "downloads", "saul-karim-nassau-ultimate-school-cv-2026-protonmail.pdf"),
  protonDocx: path.join(root, "saul", "downloads", "saul-karim-nassau-ultimate-school-cv-2026-protonmail.docx"),
  gmailPdf: path.join(root, "saul", "downloads", "saul-karim-nassau-ultimate-school-cv-2026-gmail.pdf"),
  gmailDocx: path.join(root, "saul", "downloads", "saul-karim-nassau-ultimate-school-cv-2026-gmail.docx"),
  aliasPdf: path.join(root, "saul", "cv.pdf"),
  generalPdf: path.join(root, "saul", "downloads", "saul-karim-nassau-general-cv.pdf"),
};
for (const [label, file] of Object.entries(downloads)) {
  need(fs.existsSync(file) && fs.statSync(file).size > 0, `${label} is missing or empty`);
}
for (const output of [
  ...(downloadManifest.application_outputs || []),
  ...(downloadManifest.modular_outputs || []),
  downloadManifest.everything_output,
].filter(Boolean)) {
  const file = path.join(root, output.path || "");
  need(fs.existsSync(file), `manifest output is missing: ${output.path}`);
  if (fs.existsSync(file)) {
    need(digest(file) === output.sha256, `manifest hash drifted: ${output.path}`);
    need(fs.statSync(file).size === output.bytes, `manifest byte count drifted: ${output.path}`);
  }
}
if (fs.existsSync(downloads.protonPdf) && fs.existsSync(downloads.aliasPdf)) {
  need(digest(downloads.protonPdf) === digest(downloads.aliasPdf), "/saul/cv.pdf is not the canonical ProtonMail PDF");
}
if (fs.existsSync(downloads.protonPdf) && fs.existsSync(downloads.generalPdf)) {
  need(
    digest(downloads.protonPdf) !== digest(downloads.generalPdf),
    "general modular PDF was overwritten by the ProtonMail application PDF"
  );
}

const downloadsDir = path.join(root, "saul", "downloads");
for (const filename of fs.readdirSync(downloadsDir)) {
  const file = path.join(downloadsDir, filename);
  if (
    /saul-karim-nassau-.*-cv.*\.pdf$/i.test(filename) &&
    !filename.includes("ultimate-school-cv-2026")
  ) {
    need(
      digest(file) !== digest(downloads.protonPdf),
      `distinct modular/EVERYTHING PDF was overwritten by the ProtonMail file: ${filename}`
    );
  }
  if (/saul-karim-nassau-.*-cv\.txt$/i.test(filename)) {
    const text = fs.readFileSync(file, "utf8");
    for (const required of [
      "seminarschools.com/saul",
      "seminarschools.com/reviews",
    ]) {
      need(text.includes(required), `${filename} is missing ${required}`);
    }
    need(
      !/\bph\.?d\.?\b|\bleizu\b|independent refugee support|saulnassau\.com/i.test(text),
      `${filename} contains retired application-CV content`
    );
  }
}

const focusedRoutes = fs
  .readdirSync(path.join(root, "saul", "cv"), { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => path.join(root, "saul", "cv", entry.name, "index.html"))
  .concat([
    path.join(root, "saul", "hospitality", "index.html"),
    path.join(root, "saul", "kitchen", "index.html"),
    path.join(root, "saul", "performance", "index.html"),
    path.join(root, "saul", "portfolio", "index.html"),
    path.join(root, "saul", "teaching", "education", "index.html"),
    path.join(root, "saul", "kitchen", "community", "index.html"),
  ]);
need(focusedRoutes.length === 18, "expected 18 focused CV route entry points");
for (const file of focusedRoutes) {
  const route = fs.readFileSync(file, "utf8");
  need(
    /content="0; url=\/saul\/(?:\?(?:focus|archive)=[^"]+)?#(?:experienceLedger|careerArchive)"/.test(route),
    `${path.relative(root, file)} does not redirect to a modular CV or archive view`
  );
  need(
    !/data-cv-spectrum|\bph\.?d\.?\b|\bleizu\b|independent refugee support/i.test(route),
    `${path.relative(root, file)} still contains retired CV content`
  );
}

if (failures.length) {
  console.error("SAUL ULTIMATE WEB CV CHECK FAILED");
  failures.forEach(failure => console.error(` - ${failure}`));
  process.exit(1);
}

console.log(
  "SAUL ULTIMATE WEB CV CHECK PASSED — 37 rows, 16/13/8 sections, Greenpeace and La Plante retained, right-aligned dates, zero row gaps, distinct modular/EVERYTHING PDFs and one-source editable outputs."
);
