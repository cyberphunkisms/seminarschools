#!/usr/bin/env node
"use strict";

const fs = require("fs");
const crypto = require("crypto");
const path = require("path");
const vm = require("vm");
const zlib = require("zlib");

const root = path.resolve(__dirname, "..");
const failures = [];

function read(relative) {
  const file = path.join(root, relative);
  if (!fs.existsSync(file)) {
    failures.push(`missing ${relative}`);
    return "";
  }
  return fs.readFileSync(file, "utf8");
}

function expect(condition, message) {
  if (!condition) failures.push(message);
}

function escapeAttribute(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, (character) =>
    ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[character],
  );
}

function countLines(relative) {
  const text = read(relative).trim();
  return text ? text.split(/\r?\n/).length : 0;
}

const data = JSON.parse(read("polymythlib/data/polymyth-data.json") || "{}");
const manifest = JSON.parse(
  read("polymythlib/data/data-manifest.json") || "{}",
);
const manifestFiles = (manifest.files || []).map((entry) =>
  typeof entry === "string" ? entry : entry.path,
);

expect(data.release === "2026-07-28.g0.3", "release ID drifted");
expect(data.schemaVersion === "1.0.0", "schema version drifted");
expect(data.projects?.length === 346, "project count must be 346");
expect(data.mentions?.length === 393, "book mention count must be 393");
expect(data.bookLinks?.length === 437, "book link count must be 437");
expect(data.linkOccurrences?.length === 484, "link occurrence count must be 484");
expect(data.commonsForms?.length === 43, "commons-form count must be 43");
expect(data.projectTypes?.length === 79, "project-type count must be 79");
expect(data.relationships?.length === 50, "relationship count must be 50");
expect(data.currentStatuses?.length === 20, "current-status seed count must be 20");
expect(data.collections?.length === 8, "collection count must be 8");
expect(
  data.mentions?.every((mention) => /^PC-\d{4}$/.test(mention.projectId)),
  "every mention must carry its stable project join",
);
expect(
  data.currentStatuses?.every((status) => /^PC-\d{4}$/.test(status.projectId)),
  "every current-status seed must carry its stable project join",
);
const embeddedMentionJoins = new Map(
  (data.projects || []).flatMap((project) =>
    (project.mentions || []).map((mention) => [mention.id, project.id]),
  ),
);
expect(
  data.mentions?.every(
    (mention) => embeddedMentionJoins.get(mention.id) === mention.projectId,
  ),
  "top-level and project-embedded mention joins must agree",
);
expect(data.counts?.coreCandidates === 128, "core candidate count must be 128");
expect(data.counts?.linkHosts === 252, "link host count must be 252");
expect(data.counts?.embeddedPdfHyperlinks === 0, "embedded PDF link count must remain zero");
expect(
  data.projects?.every(
    (project) =>
      project.id &&
      project.canonicalName &&
      project.scope &&
      Array.isArray(project.mentions),
  ),
  "every project must have an ID, name, scope, and mention array",
);
expect(
  new Set(data.projects?.map((project) => project.id)).size === 346,
  "project IDs must remain unique",
);
expect(
  manifestFiles.includes("CHANGELOG.md"),
  "data manifest must list the changelog",
);
expect(
  manifestFiles.includes("directory-index.json") &&
    manifestFiles.includes("backbone-index.json") &&
    manifestFiles.includes("collections.json"),
  "data manifest must list both compact browser indexes",
);
expect(
  manifest.schema?.version === "1.0.0" &&
    manifest.schema?.documentation ===
      "https://seminarschools.com/polymythlib/method/#record-model" &&
    manifest.rights?.metadata &&
    manifest.rights?.source,
  "data manifest must publish portable schema and rights context",
);
for (const entry of manifest.files || []) {
  if (!entry || typeof entry === "string") continue;
  const relative = `polymythlib/data/${entry.path}`;
  const contents = read(relative);
  const digest = crypto.createHash("sha256").update(contents).digest("hex");
  expect(digest === entry.sha256, `${relative} manifest digest drifted`);
}
expect(countLines("polymythlib/data/projects.csv") === 347, "projects CSV row count drifted");
expect(countLines("polymythlib/data/book-links.csv") === 438, "book-links CSV row count drifted");
expect(
  !read("polymythlib/data/projects.csv").includes("[object Object]"),
  "projects CSV must serialize nested values without object coercion",
);

const directoryIndex = JSON.parse(
  read("polymythlib/data/directory-index.json") || "{}",
);
const backboneIndex = JSON.parse(
  read("polymythlib/data/backbone-index.json") || "{}",
);
expect(
  directoryIndex.projects?.length === 346,
  "compact directory index must contain 346 records",
);
expect(
  backboneIndex.projects?.length === 346 &&
    backboneIndex.bookLinks?.length === 437,
  "compact backbone index must contain every named record and printed link",
);
expect(
  zlib.gzipSync(read("polymythlib/data/directory-index.json")).length < 40_000,
  "directory browser index must remain below 40 KB gzip",
);
expect(
  directoryIndex.collections?.length === 8,
  "compact directory index must carry versioned collection definitions",
);
for (const [id, anchor] of [
  ["library", "PC-0083"],
  ["open-access", "PC-0263"],
  ["preservation", "PC-0179"],
  ["community", "PC-0254"],
  ["infrastructure", "PC-0227"],
]) {
  const collection = directoryIndex.collections?.find((entry) => entry.id === id);
  expect(collection?.members.includes(anchor), `${id} collection lost anchor ${anchor}`);
}
expect(
  zlib.gzipSync(read("polymythlib/data/backbone-index.json")).length < 120_000,
  "backbone browser index must remain below 120 KB gzip",
);

const requiredPages = [
  "polymythcommons/index.html",
  "polymythlib/index.html",
  "polymythlib/collections/index.html",
  "polymythlib/book-backbone/index.html",
  "polymythlib/method/index.html",
  "polymythlib/contribute/index.html",
  "public/polymythcommons/index.html",
  "public/polymythlib/index.html",
  "public/polymythlib/data/polymyth-data.json",
];
requiredPages.forEach((file) => read(file));

const generatedPages = data.projects.filter((project) => {
  const source = `polymythlib/projects/${project.id}/index.html`;
  const deployed = `public/polymythlib/projects/${project.id}/index.html`;
  const sourceHtml = read(source);
  read(deployed);
  return (
    sourceHtml.includes(
      `seminarschools.com/polymythlib/projects/${project.id}/`,
    ) &&
    sourceHtml.includes('class="entity-hero"') &&
    sourceHtml.includes("/css/alive.css") &&
    sourceHtml.includes("/js/site-keyboard-enhancements.js") &&
    sourceHtml.includes('property="og:title"') &&
    sourceHtml.includes("<strong>Included</strong>") &&
    sourceHtml.includes("<h2>About this project</h2>") &&
    sourceHtml.includes("<h2>Current status</h2>") &&
    sourceHtml.includes("<h2>What this record includes</h2>") &&
    sourceHtml.includes("<h2>Book source</h2>") &&
    sourceHtml.includes("<h2>Sources and links</h2>") &&
    sourceHtml.includes("<h2>Related records</h2>") &&
    sourceHtml.includes("<h2>Included / Still needed</h2>") &&
    sourceHtml.includes("<h2>Updates</h2>") &&
    (sourceHtml.match(/class="signal (?:on|off)"/g) || []).length === 6
  );
});
expect(
  generatedPages.length === 346,
  "all 346 stable project pages must render with sharing, keyboard, zoom, and reader-facing record contracts",
);

const sourceDestinationProjects = (data.projects || []).filter(
  (project) =>
    (project.verified && project.currentCanonicalUrl) ||
    (project.bookPrintedUrls || []).find(Boolean),
);
expect(
  sourceDestinationProjects.length === 120,
  "exactly 120 Commons records must have a direct project/source destination",
);
for (const project of sourceDestinationProjects) {
  const rawDestination = project.verified && project.currentCanonicalUrl
    ? project.currentCanonicalUrl
    : project.bookPrintedUrls.find(Boolean);
  const destination = /^https?:\/\//i.test(rawDestination)
    ? rawDestination
    : `https://${String(rawDestination).replace(/^\/+/, "")}`;
  const html = read(`polymythlib/projects/${project.id}/index.html`);
  expect(
    html.includes(
      `<a class="button primary" href="${escapeAttribute(destination)}" target="_blank" rel="noopener noreferrer">`,
    ),
    `${project.id} must expose its project/source destination as the primary action`,
  );
}

const retiredRecordLabels = [
  "At a glance",
  "Directory scope",
  "Candidate tier",
  "Role in the book",
  "Book portrayal",
  "Current verification",
  "Current evidence state",
  "Commons anatomy",
  "Record signals",
  "Record history",
  "Sources and pointers",
  "Related by book type",
  "Book evidence only · current review pending",
  "Generation-0 source",
  "Record signals",
  "Named in the book backbone",
];
for (const project of data.projects || []) {
  const html = read(`polymythlib/projects/${project.id}/index.html`);
  for (const label of retiredRecordLabels) {
    expect(!html.includes(label), `${project.id} still exposes retired label: ${label}`);
  }
  expect(
    !/(?:STATUS_UNRESOLVED|BOOK_ONLY_HISTORICAL|ACTIVE_AT_NEW_URL|ARCHIVED_READ_ONLY|MEDIUM_HIGH)/.test(
      html,
    ),
    `${project.id} exposes a raw status or confidence code`,
  );
  expect(
    !/>\s*Book evidence\s*</.test(html),
    `${project.id} still exposes Book evidence as a visitor label`,
  );
  expect(
    !/>\s*(?:Core candidate|Example candidate|Support node|Context \/ analogy|Commons Projects|Supporting Ecosystem|Concepts and Comparisons)\s*</.test(
      html,
    ),
    `${project.id} exposes a raw tier or scope label`,
  );
}

const directoryHtml = read("polymythlib/index.html");
expect(directoryHtml.includes("More book filters"), "directory needs optional book filters");
expect(
  directoryHtml.includes("Supporting organizations and systems"),
  "directory needs a reader-facing supporting-project scope",
);
expect(
  directoryHtml.includes("Examples and comparisons"),
  "directory needs a reader-facing comparison scope",
);
expect(directoryHtml.includes("All records · 346"), "directory needs all-records scope");
expect(directoryHtml.includes("Table view"), "directory needs optional table view");
expect(
  directoryHtml.includes("Current status not yet reviewed") &&
    directoryHtml.includes(">Main directory record</option>"),
  "directory filters must use reader-facing status and directory labels",
);

const methodHtml = read("polymythlib/method/index.html");
expect(
  methodHtml.includes("Book history, present-day checks, and directory choices stay separate"),
  "method must explain what stays separate",
);
expect(
  methodHtml.includes("What each page shows") &&
    !methodHtml.includes("Record signals"),
  "method navigation must use a plain reader label",
);
expect(
  methodHtml.includes("Why “current status” needs more than one answer"),
  "method must explain status dimensions",
);
expect(methodHtml.includes("Connections need sources"), "method must explain sourced connections");
expect(
  methodHtml.includes("Included” and “Still needed” describe only what is documented"),
  "method must explain record signals without internal terminology",
);
expect(
  methodHtml.includes("Kinds of records the directory may include") &&
    methodHtml.includes("do not claim that two projects worked together"),
  "method must distinguish browsing suggestions from sourced connections",
);
expect(methodHtml.includes("www.w3.org/TR/prov-o"), "method must cite PROV-O");
expect(methodHtml.includes("www.w3.org/TR/skos-reference"), "method must cite SKOS");
expect(methodHtml.includes("www.w3.org/TR/vocab-dcat-3"), "method must cite DCAT");

const sourceBookHtml = read("polymythlib/book-backbone/index.html");
expect(
  sourceBookHtml.includes("<h1>Source book index.</h1>") &&
    sourceBookHtml.includes("Projects named in the book · 346") &&
    !sourceBookHtml.includes("Complete generation 0"),
  "source book index must explain itself in reader-facing language",
);

const collectionsHtml = read("polymythlib/collections/index.html");
expect(
  collectionsHtml.includes("Choose a path into the directory") &&
    collectionsHtml.includes("Each topic explains what it includes") &&
    !collectionsHtml.includes("Transparent inclusion, plural usefulness"),
  "topic page must explain its groupings in reader-facing language",
);

const contributeHtml = read("polymythlib/contribute/index.html");
expect(
  contributeHtml.includes("Help keep the directory useful") &&
    contributeHtml.includes("What happens to a suggested change") &&
    !contributeHtml.includes("Project representative submission"),
  "contribution page must explain the update process in reader-facing language",
);

const home = read("index.html");
expect(
  home.includes('<a href="/polymythcommons/">Polymyth Commons</a>') &&
    /id:'commons',[^\n]*label:'Polymyth Commons',[^\n]*href:'\/polymythcommons\/'/.test(home),
  "home must link Polymyth Commons in both the visible path card and the project map",
);
expect(home.includes("id:'commons'"), "home map must include Polymyth Commons");
expect(
  home.includes("<title>Seminar Schools | Education, Research &amp; Public Programs</title>"),
  "home title must describe the public site",
);
expect(
  read("teacherresources/index.html").includes("Polymyth Commons"),
  "Teacher Resources must show its Commons context",
);
expect(
  read("polymythseminars/index.html").includes("Polymyth Commons"),
  "Polymythcal must show its Commons context",
);
expect(
  read("polymythseminars/fr/index.html").includes("Polymyth Commons"),
  "French Polymythcal must preserve its Commons route",
);
expect(
  read("about/index.html").includes('href="/polymythcommons/"') &&
    read("about/index.html").includes("Seven public projects"),
  "About must include Polymyth Commons in its practical paths and public-project inventory",
);
expect(
  read("polymyth/sitemap/index.html").includes(
    'href="/polymythcommons/" class="name-link"',
  ) &&
    read("polymyth/sitemap/index.html").includes(
      'href="/polymythlib/book-backbone/"',
    ),
  "human site map must link the Commons landing and core Polymythlib routes",
);

const sitemap = read("sitemap.xml");
expect(
  (sitemap.match(/seminarschools\.com\/polymythlib\/projects\//g) || []).length ===
    346,
  "sitemap must contain 346 stable project URLs",
);
expect(
  sitemap.includes("seminarschools.com/polymythcommons/"),
  "sitemap must include Commons landing page",
);

const collections = read("polymythlib/collections/index.html");
for (const [label, count] of [
  ["Find a place to search", 67],
  ["Scholarly communication", 85],
  ["Long memory", 53],
  ["Public knowledge", 36],
  ["What makes sharing possible", 71],
]) {
  expect(
    collections.includes(`${label} · ${count} matches`),
    `collection count drifted for ${label}`,
  );
}

const directoryScript = read("js/polymythlib.js");
const backboneScript = read("js/polymyth-backbone.js");
const commonsCss = read("css/polymyth-commons.css");
expect(
  /\.primary-nav a\s*\{[^}]*flex:\s*0 0 auto;[^}]*white-space:\s*nowrap;/s.test(
    commonsCss,
  ),
  "Polymyth Commons navigation labels must not collapse into vertical words on mobile",
);
expect(
  directoryScript.includes("/polymythlib/data/directory-index.json"),
  "directory must use its compact browser index",
);
expect(
  directoryScript.includes("data.collections") &&
    directoryScript.includes('params.set("sort"') &&
    directoryScript.includes('params.set("view"') &&
    !directoryScript.includes("quickMatchers"),
  "directory must use versioned collections and preserve sort and view in shared URLs",
);
expect(
  directoryScript.includes("Current status not yet reviewed") &&
    directoryScript.includes("displayScope(project.scope)") &&
    directoryScript.includes("displayTier(state.tier)"),
  "directory browser must map raw data values to reader-facing labels",
);
expect(
  directoryScript.includes("Named in the 2007 book.") &&
    !directoryScript.includes("Named in the book backbone.") &&
    !directoryScript.includes("Use the Book Backbone downloads"),
  "directory browser fallbacks must use reader-facing source-book language",
);
expect(
  directoryScript.includes("Open website listed in the book ↗") &&
    directoryScript.includes("Research details") &&
    directoryScript.includes('target="_blank" rel="noopener noreferrer"') &&
    directoryScript.includes('class="source-title"'),
  "directory results must lead with safe one-click project/source links and keep research details secondary",
);
expect(
  /grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(100%,\s*23rem\),\s*1fr\)\)/.test(commonsCss) &&
    /\.vertical-card h3\s*\{[^}]*overflow-wrap:\s*normal;[^}]*word-break:\s*normal;[^}]*hyphens:\s*none;/s.test(commonsCss),
  "Commons project cards must collapse before ordinary titles split inside words",
);
expect(
  backboneScript.includes("/polymythlib/data/backbone-index.json"),
  "book explorer must use its compact browser index",
);
expect(
  backboneScript.includes("Current status not yet reviewed") &&
    backboneScript.includes("tierLabels[project.candidateTier]"),
  "source book browser must map raw tier and status values before display",
);
expect(
  !directoryScript.includes('fetch("/polymythlib/data/polymyth-data.json")') &&
    !backboneScript.includes('fetch("/polymythlib/data/polymyth-data.json")'),
  "interactive browsers must reserve the complete JSON for downloads and reuse",
);

const contribution = read("polymythlib/contribute/index.html");
expect(
  contribution.includes("<option>Add an archive or preservation link</option>"),
  "contribution composer must include the archive option shown in its task list",
);
expect(
  read("polymythlib/projects/PC-0014/index.html").includes(
    "Open surviving documentation",
  ) &&
    !read("polymythlib/projects/PC-0014/index.html").includes(
      "Visit current home",
    ),
  "historical documentation must not be labeled as a current project home",
);
expect(
  fs.existsSync(path.join(root, "scripts/build-polymyth-data.mjs")) &&
    fs.existsSync(
      path.join(
        root,
        "data/polymyth-commons-book-backbone.xlsx.inspect.ndjson",
      ),
    ),
  "the Commons data generator and its deterministic inspected input must ship together",
);

for (const page of requiredPages.filter((file) => file.endsWith(".html"))) {
  const html = read(page);
  expect(
    html.indexOf('<meta charset="utf-8">') <
      html.indexOf("<script"),
    `${page} must declare its encoding before executable scripts`,
  );
}

for (const script of [
  "js/polymythlib.js",
  "js/polymyth-backbone.js",
  "js/polymyth-contribute.js",
]) {
  const source = read(script);
  try {
    new vm.Script(source, { filename: script });
  } catch (error) {
    failures.push(`${script} syntax error: ${error.message}`);
  }
}

if (failures.length) {
  console.error("POLYMYTH COMMONS VERIFICATION FAILED");
  failures.forEach((failure) => console.error(` - ${failure}`));
  process.exit(1);
}

console.log(
  "POLYMYTH COMMONS VERIFICATION PASSED — 346 records, 437 printed links, 346 stable pages, complete data releases, native site integration, and deploy parity.",
);
