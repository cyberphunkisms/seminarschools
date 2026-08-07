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
    "'": "&#x27;",
  })[char]);
const digest = file =>
  crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const normalize = value => String(value || "").replace(/\s+/g, " ").trim();
const stripMarkup = value => normalize(
  String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
);
const parseEmbeddedJson = (name, endMarker) => {
  const marker = `const ${name} = `;
  const start = html.indexOf(marker);
  const end = start >= 0 ? html.indexOf(endMarker, start + marker.length) : -1;
  need(start >= 0 && end > start, `rendered archive assignment is missing: ${name}`);
  if (start < 0 || end <= start) return null;
  const source = html
    .slice(start + marker.length, end)
    .trim()
    .replace(/;\s*$/, "");
  try {
    return JSON.parse(source);
  } catch (error) {
    failures.push(`rendered archive assignment is invalid JSON: ${name} (${error.message})`);
    return null;
  }
};

const start = html.indexOf('<section class="cv-ultimate"');
const end = html.indexOf('<section aria-labelledby="cvMapTitle"', start);
need(start >= 0 && end > start, "ultimate CV section markers are missing");
const cv = start >= 0 && end > start ? html.slice(start, end) : "";
const plain = stripMarkup(cv);

const archiveLetters = parseEmbeddedJson(
  "LETTERS",
  "// ===========================================================================\n// URL ROUTING"
);
const archiveRecords = parseEmbeddedJson("D", "// Audit 45:");

const buildCommand = packageData.scripts?.["build:saul-cv"] || "";
need(
  buildCommand.includes("scripts/build-saul-ultimate-web-cv.py") &&
    buildCommand.includes("scripts/verify-saul-ultimate-web-cv.js") &&
    buildCommand.includes("scripts/verify-saul-cv-release.py") &&
    !buildCommand.includes("build-saul-cv-professional.py"),
  "build:saul-cv is not wired through the current builder and release checks"
);
need(
  downloadManifest.status === "active" &&
    downloadManifest.application_outputs?.length === 4 &&
    downloadManifest.modular_outputs?.length === 36 &&
    downloadManifest.everything_output?.path?.endsWith(
      "saul-karim-nassau-complete-career-archive-cv.pdf"
    ) &&
    downloadManifest.policy?.role_focused_pdfs_are_distinct_outputs === true,
  "download manifest does not describe the application, role-focused and full-history outputs"
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

const campusCrops = records.find(record =>
  /Campus Crops/i.test(record.organization || "")
);
need(
  campusCrops?.role === "Community Development Manager",
  "Campus Crops must retain the verified formal title Community Development Manager"
);
need(
  campusCrops?.focus?.includes("volunteer-events"),
  "Campus Crops is missing from the Volunteer & Events focus"
);
need(
  /(?:~|approximately\s*)20\s+(?:core\s+)?volunteers/i.test(
    `${campusCrops?.description || ""} ${data.public_highlights?.find(item => item.id === "H02")?.body || ""}`
  ),
  "Campus Crops no longer identifies the approximately 20 core volunteers"
);

const highlights = data.public_highlights || [];
need(highlights.length >= 9, "the public CV must retain its selected evidence highlights");
need(
  new Set(highlights.map(item => item.id)).size === highlights.length,
  "public evidence highlight IDs must be unique"
);
need(
  (cv.match(/data-evidence-id=/g) || []).length === highlights.length,
  "the rendered evidence-highlight count does not match the canonical source"
);
for (const highlight of highlights) {
  need(
    Array.isArray(highlight.focus) && highlight.focus.includes("general"),
    `${highlight.id} is missing general-view focus metadata`
  );
  need(
    cv.includes(escapeHTML(highlight.title)) && cv.includes(escapeHTML(highlight.body)),
    `${highlight.id} is not rendered from the canonical evidence source`
  );
}

const highlightById = new Map(highlights.map(item => [item.id, item]));
const highlightText = id => normalize(
  `${highlightById.get(id)?.title || ""} ${highlightById.get(id)?.body || ""}`
);
for (const [id, checks] of Object.entries({
  H01: [
    /student governments/i,
    /substantial initial (?:time|work)/i,
    /run them independently/i,
    /Model UN/i,
    /environmental/i,
    /yearbook/i,
    /reviewed, approved (?:&|and) signed.*volunteer-hour/i,
  ],
  H02: [
    /Campus Crops/i,
    /recruited, interviewed, oriented, placed, supported (?:&|and) evaluated/i,
    /20 core volunteers/i,
    /maintained their records/i,
    /farmers['’] market/i,
    /additional recruitment (?:&|and) coordination/i,
  ],
  H03: [/curricula/i, /evaluation|feedback/i, /participant certificates/i],
  H04: [/McMUN/i, /1,600 delegates/i, /BUMI Festival/i, /crowd flow/i],
  H05: [/refugee-support initiative/i, /\$8,000/i, /six countries/i],
})) {
  const text = highlightText(id);
  need(Boolean(text), `required public evidence highlight is missing: ${id}`);
  for (const pattern of checks) {
    need(pattern.test(text), `${id} is missing verified evidence: ${pattern}`);
  }
}

const applicationRecordText = normalize(JSON.stringify(records));
need(
  !/refugee[- ]support|refugee initiative/i.test(applicationRecordText),
  "the public refugee-support highlight entered the formal application rows"
);

for (const [label, pattern] of [
  ["visitor-facing role breadth", /Educator\s*\|\s*Program Coordinator\s*\|\s*Community Organizer/i],
  ["12+ years in education", /12\+\s+years/i],
  ["2,000+ learners", /2,000\+\s+learners/i],
  ["15 curricula and programs", /15\s+curricula\s*(?:&|and)\s*programs/i],
  ["approximately 20 core volunteers", /~20\s+core volunteers/i],
  ["Greenpeace role", /Fundraiser\s*(?:&|and)\s*Volunteer Coordinator.*Greenpeace/i],
  ["MA co-supervisors", /Vesna Madzoski\s*(?:&|and)\s*Catherine Malabou/i],
  ["Michael Brecher research", /Michael Brecher/i],
  ["current public CV URL", /seminarschools\.com\/saul/i],
  ["reviews URL", /seminarschools\.com\/reviews/i],
]) {
  need(pattern.test(plain), `rendered CV is missing ${label}`);
}

for (const forbidden of [
  /\bph\.?d\.?\b/i,
  /\bleizu\b/i,
  /\btelus\b/i,
  /\b1,000\+/i,
  /saulnassau\.com/i,
  /Bronze Cross\s*&\s*First Aid/i,
]) {
  need(!forbidden.test(plain), `rendered application CV contains retired text: ${forbidden}`);
}
need(
  !/\bph\.?d\.?\b|doctoral|博士|دکترا/i.test(html),
  "the /saul page contains a retired doctoral or PhD claim"
);

const webCredentials = data.web_credentials || data.credentials || [];
const bronzeCredential = webCredentials.find(value => /Bronze Cross/i.test(value)) || "";
need(
  /Bronze Cross/i.test(bronzeCredential) &&
    /First Aid/i.test(bronzeCredential) &&
    /2006/i.test(bronzeCredential) &&
    /Not Current|Historical/i.test(bronzeCredential),
  "Bronze Cross must be presented as c. 2006 First Aid training that is not current"
);
need(
  plain.includes(bronzeCredential),
  "the rendered application CV is missing the historical Bronze Cross wording"
);

const webLanguages = data.web_languages || data.languages || [];
const webLanguageText = normalize(webLanguages.join(" | "));
for (const [label, pattern] of [
  ["advanced Farsi speaking", /Farsi:?.*Advanced.*Speaking/i],
  ["advanced Farsi reading", /Farsi:?.*Advanced.*Reading/i],
  ["slower Farsi writing", /Farsi:?.*(?:Functional.*Slower|Slower).*Writing/i],
  ["basic French", /French:\s*Basic/i],
  ["basic Mandarin", /Mandarin:\s*Basic/i],
]) {
  need(pattern.test(webLanguageText), `canonical web languages omit ${label}`);
}
for (const value of webLanguages) {
  need(plain.includes(value), `rendered CV is missing detailed language text: ${value}`);
}

const mailtoTargets = [...cv.matchAll(/href="mailto:([^"]+)"/g)].map(match => match[1]);
need(mailtoTargets.length === 1, "the public CV must expose one direct email contact");
need(
  !data.contact.alternate_email || !cv.includes(data.contact.alternate_email),
  "the private alternate-email edition is exposed on the public CV"
);
need(
  (cv.match(/class="cv-downloads(?:\s|"|--)/g) || []).length === 1 &&
    !cv.includes("cv-ultimate__downloads"),
  "the public CV must have one simplified download block"
);
for (const [label, pattern] of [
  ["professional PDF", /aria-label="Professional CV in PDF format"[^>]+href="[^"]+\.pdf"/],
  ["professional Word file", /aria-label="Professional CV in Word format"[^>]+href="[^"]+\.docx"/],
  ["full-history PDF", /aria-label="Full career history in PDF format"[^>]+href="[^"]+\.pdf"/],
]) {
  need(pattern.test(cv), `simplified downloads are missing the ${label}`);
}
for (const retiredDownloadCopy of [
  /Choose a contact edition/i,
  /Gmail edition/i,
  /ProtonMail edition/i,
  /EVERYTHING CV/i,
]) {
  need(!retiredDownloadCopy.test(plain), `public downloads contain retired copy: ${retiredDownloadCopy}`);
}

need(
  !html.includes("saul-cv-spectrum-2026.js"),
  "obsolete spectrum runtime is still loaded on /saul/"
);
need(
  /href="\.\/assets\/saul-ultimate-cv-2026\.css(?:\?[^" ]*)?"/.test(html),
  "ultimate CV stylesheet is not loaded"
);
need(
  /src="(?:\.\/|\/saul\/)assets\/saul-ultimate-cv-modules-2026\.js(?:\?[^" ]*)?"/.test(html),
  "modular focus runtime is not loaded"
);

const jsonLdBlocks = [...html.matchAll(
  /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g
)];
need(jsonLdBlocks.length === 1, "the page must contain exactly one JSON-LD block");
if (jsonLdBlocks.length === 1) {
  try {
    const structuredProfile = JSON.parse(jsonLdBlocks[0][1]);
    need(structuredProfile["@type"] === "ProfilePage", "JSON-LD must describe a ProfilePage");
    need(
      structuredProfile.url === "https://seminarschools.com/saul/" &&
        structuredProfile.inLanguage === "en",
      "JSON-LD has the wrong canonical English profile URL or language"
    );
    need(
      /Educator/i.test(structuredProfile.mainEntity?.jobTitle || "") &&
        /Program Coordinator/i.test(structuredProfile.mainEntity?.jobTitle || "") &&
        /Community Organizer/i.test(structuredProfile.mainEntity?.jobTitle || ""),
      "JSON-LD does not reflect the public role breadth"
    );
  } catch (error) {
    failures.push(`the JSON-LD profile is invalid JSON: ${error.message}`);
  }
}

need(
  !(canonical.education || []).some(value => /phd/i.test(value)),
  "legacy canonical education still contains PhD"
);
need(
  canonical.rules?.ultimate_application_cv === true,
  "legacy canonical does not point to the ultimate application CV"
);
need(
  Array.isArray(canonical.focus_modules) && canonical.focus_modules.length === 12,
  "public canonical CV data is missing the twelve declared focus paths"
);

need(
  archiveLetters &&
    JSON.stringify(archiveLetters) === JSON.stringify(data.archive_letters),
  "the JavaScript-rendered archive introductions drifted from the canonical source"
);
const archiveVisitorParts = [];
for (const [category, letter] of Object.entries(archiveLetters || {})) {
  const title = normalize(letter?.title?.en);
  const bodyHtml = letter?.body?.en || "";
  const body = stripMarkup(bodyHtml);
  const paragraphs = (bodyHtml.match(/<p\b/gi) || []).length;
  const sentences = (body.match(/[.!?](?:\s|$)/g) || []).length;
  need(Boolean(title) && Boolean(body), `archive introduction is incomplete: ${category}`);
  need(
    body.length <= 900 && paragraphs <= 3 && sentences <= 8,
    `archive introduction is too long for a public visitor: ${category}`
  );
  archiveVisitorParts.push(title, body);
}

need(
  Array.isArray(archiveRecords) && archiveRecords.length === 65,
  "the JavaScript-rendered historical archive must retain all 65 records"
);
for (const record of archiveRecords || []) {
  const title = normalize(record?.[3]?.en);
  const note = normalize(record?.[4]?.en);
  const description = normalize(record?.[6]?.en);
  need(description.length <= 600, `archive description is too long for a public visitor: ${title}`);
  archiveVisitorParts.push(title, note, description);
}
const archiveVisitorText = normalize(archiveVisitorParts.join(" "));
for (const internalOrYappy of [
  /my ideal classroom has three teachers/i,
  /the work nobody sees/i,
  /user-authored source material/i,
  /public-facing summar(?:y|ies)/i,
  /source of truth/i,
  /\bfront-facing\b/i,
  /\bcanonical (?:copy|data|record|source)\b/i,
  /\bas an AI\b|\bAI assistant\b/i,
  /\bPolymyth\s*\/\s*AA\*/i,
]) {
  need(
    !internalOrYappy.test(archiveVisitorText),
    `JavaScript-rendered archive exposes internal or over-written copy: ${internalOrYappy}`
  );
}
need(
  (archiveRecords || []).some(record => record?.[3]?.en === "Polymyth Research Archive"),
  "the rendered archive is missing the public Polymyth Research Archive name"
);
const archiveBronze = (archiveRecords || []).find(record =>
  /Bronze Cross/i.test(record?.[3]?.en || "")
);
need(
  archiveBronze &&
    /2006/i.test(`${archiveBronze[1]} ${archiveBronze?.[6]?.en || ""}`) &&
    /not current/i.test(`${archiveBronze[1]} ${archiveBronze?.[4]?.en || ""} ${archiveBronze?.[6]?.en || ""}`),
  "the historical archive must describe Bronze Cross and First Aid as c. 2006 training that is not current"
);
need(
  (archiveRecords || []).some(record =>
    /Independent Refugee Support Initiative/i.test(record?.[3]?.en || "")
  ),
  "the authorized refugee-support initiative is missing from the public historical archive"
);
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
  /@media \(max-width:\s*680px\)[\s\S]*?\.cv-ultimate__hero\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/,
  /@media \(max-width:\s*680px\)[\s\S]*?\.cv-ultimate__facts\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/,
  /@media \(max-width:\s*680px\)[\s\S]*?\.cv-downloads__edition\s*\{[^}]*flex:\s*1\s+1\s+15rem;/,
]) {
  need(pattern.test(css), `stylesheet invariant is missing: ${pattern}`);
}
const printCss = css.slice(css.indexOf("@media print"));
need(
  css.indexOf("@media print") >= 0 && !/data-filtered-out/.test(printCss),
  "print CSS overrides the selected-view filtering"
);
need(
  /\[data-filtered-out="true"\][^\{]*\{\s*display:\s*none;/.test(css),
  "screen and print views do not share a persistent filtered-out rule"
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
  "SAUL ULTIMATE WEB CV CHECK PASSED — 37 application rows, nine evidence highlights, 65 historical records, verified front-facing copy, persistent focus filtering, simplified downloads and distinct complete-career outputs."
);
