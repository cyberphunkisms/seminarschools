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
    sourceHtml.includes("<strong>Recorded</strong>") &&
    sourceHtml.includes("source-grounded summaries") &&
    sourceHtml.includes("<h2>Related by book type</h2>") &&
    (sourceHtml.match(/class="signal (?:on|off)"/g) || []).length === 6
  );
});
expect(
  generatedPages.length === 346,
  "all 346 stable project pages must render with sharing, keyboard, zoom, and accessible record-signal contracts",
);

const directoryHtml = read("polymythlib/index.html");
expect(directoryHtml.includes("Research mode"), "directory needs Research Mode");
expect(directoryHtml.includes("Supporting Ecosystem"), "directory needs ecosystem scope");
expect(directoryHtml.includes("Concepts and Comparisons"), "directory needs comparison scope");
expect(directoryHtml.includes("All Book Records"), "directory needs all-records scope");
expect(directoryHtml.includes("Table view"), "directory needs optional table view");

const methodHtml = read("polymythlib/method/index.html");
expect(methodHtml.includes("Three layers remain distinct"), "method must separate evidence layers");
expect(methodHtml.includes("Status is several questions"), "method must separate status dimensions");
expect(methodHtml.includes("Relationships first, graph later"), "method must state graph sequencing");
expect(
  methodHtml.includes("field-specific features and evidence coverage"),
  "method must describe the field-specific quality approach",
);
expect(
  methodHtml.includes("target model") &&
    methodHtml.includes("Target node classes") &&
    methodHtml.includes("do not yet claim a sourced relationship"),
  "method must distinguish current implementation from the target relationship model",
);
expect(methodHtml.includes("www.w3.org/TR/prov-o"), "method must cite PROV-O");
expect(methodHtml.includes("www.w3.org/TR/skos-reference"), "method must cite SKOS");
expect(methodHtml.includes("www.w3.org/TR/vocab-dcat-3"), "method must cite DCAT");

const home = read("index.html");
expect(
  home.includes('class="path-card" href="/polymythcommons/"') &&
    home.includes("id:'commons', label:'Polymyth Commons', href:'/polymythcommons/'"),
  "home must link Polymyth Commons in both the visible path card and the project map",
);
expect(home.includes("id:'commons'"), "home map must include Polymyth Commons");
expect(
  home.includes("Polymyth Commons, Polymythcal, Tutoring"),
  "home title must name Polymyth Commons",
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
  backboneScript.includes("/polymythlib/data/backbone-index.json"),
  "book explorer must use its compact browser index",
);
expect(
  !directoryScript.includes('fetch("/polymythlib/data/polymyth-data.json")') &&
    !backboneScript.includes('fetch("/polymythlib/data/polymyth-data.json")'),
  "interactive browsers must reserve the complete JSON for downloads and reuse",
);

const contribution = read("polymythlib/contribute/index.html");
expect(
  contribution.includes("<option>Add a preservation route</option>"),
  "contribution composer must include the preservation route shown in its task list",
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
