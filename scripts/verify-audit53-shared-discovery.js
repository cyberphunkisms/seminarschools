#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const RELEASE_ID =
  "2026-07-28-site-audit53-shared-discovery-teacherresources-polymythcal-commons-final";
const failures = [];

function read(relative) {
  const file = path.join(ROOT, relative);
  if (!fs.existsSync(file)) {
    failures.push(`missing ${relative}`);
    return "";
  }
  return fs.readFileSync(file, "utf8");
}

function json(relative) {
  const source = read(relative);
  if (!source) return {};
  try {
    return JSON.parse(source);
  } catch (error) {
    failures.push(`${relative} is not valid JSON`);
    return {};
  }
}

function expect(condition, message) {
  if (!condition) failures.push(message);
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

[
  "WEBSITE_AUDIT53_SHARED_DISCOVERY_FULL_POV_REPORT_2026-07-28.md",
  "WEBSITE_AUDIT53_SHARED_DISCOVERY_VERIFICATION_2026-07-28.json",
  "scripts/reports/audit52-package-baseline.json",
  "scripts/verify-audit53-base-preservation.py",
  "scripts/build-polymyth-data.mjs",
  "data/polymyth-commons-book-backbone.xlsx.inspect.ndjson",
  "polymythlib/data/collections.json",
  "teacherresources/feed.xml",
  "polymythseminars/events.json",
].forEach((relative) => read(relative));

expect(read("RELEASE_ID.txt").trim() === RELEASE_ID, "Audit 53 release ID mismatch");
const release = json("RELEASE_MANIFEST.json");
expect(release.release_id === RELEASE_ID, "Audit 53 manifest release ID mismatch");
expect(
  release.notes?.some(
    (note) => note.includes("Seminar Schools home") && note.includes("Polymyth Commons"),
  ),
  "release notes must record Seminar Schools home integration",
);
expect(
  release.notes?.some((note) => note.includes("No security audit")),
  "release notes must state the security audit boundary",
);

const verification = json(
  "WEBSITE_AUDIT53_SHARED_DISCOVERY_VERIFICATION_2026-07-28.json",
);
expect(verification.status === "passed", "Audit 53 verification must be passed");
expect(
  verification.external_evidence?.security_audit_performed === false,
  "verification must preserve the security audit boundary",
);

const teacher = json("teacherresources/resources-data.json");
const teacherGroups = teacher.groups || [];
const teacherCollections = teacherGroups.flatMap((group) => group.categories || []);
const teacherEntries = teacherCollections.flatMap((collection) => collection.entries || []);
expect(teacherGroups.length === 7, "Teacher Resources must retain 7 teaching areas");
expect(teacherCollections.length === 25, "Teacher Resources must retain 25 collections");
expect(teacherEntries.length === 644, "Teacher Resources must retain 644 records");
expect(
  new Set(teacherEntries.map((entry) => entry.id)).size === 644 &&
    teacherEntries.every((entry) => /^TR-\d{4}$/.test(entry.id || "")),
  "Teacher Resources stable IDs are incomplete",
);
expect(
  new Set(teacherEntries.map((entry) => entry.route_key)).size === 644,
  "Teacher Resources stable route keys are incomplete",
);
expect(
  teacherCollections.every((collection) => String(collection.blurb || "").length >= 35),
  "every Teacher Resources collection needs a meaningful description",
);
const teacherIndex = read("teacherresources/index.html");
expect(
  (teacherIndex.match(/\bdata-l="[^"]+"/g) || []).length === 644,
  "Teacher Resources SSR catalog must expose 644 source-language values",
);
expect(
  teacherIndex.includes("Start with a teaching task") &&
    teacherIndex.includes("Search and combine filters") &&
    teacherIndex.includes("All 25 collections"),
  "Teacher Resources discovery hierarchy is incomplete",
);
expect(
  Buffer.byteLength(teacherIndex, "utf8") < 450000,
  "Teacher Resources source page exceeds its raw HTML budget",
);
expect(
  (read("teacherresources/feed.xml").match(/<item>/g) || []).length === 644,
  "Teacher Resources feed must contain all 644 records",
);

const calendar = json("polymythseminars/events.json");
const events = calendar.events || [];
expect(events.length === 833, "Polymythcal must retain 833 canonical records");
expect(
  new Set(events.map((event) => event.id)).size === 833,
  "Polymythcal canonical IDs must remain unique",
);
expect(
  new Set(events.map((event) => event.type)).size === 32,
  "Polymythcal must retain its 32 event types",
);
for (const [relative, markers] of [
  [
    "polymythseminars/index.html",
    ["What do you want to do?", "Plan this week", "Meet an application deadline", "/polymythcommons/"],
  ],
  [
    "polymythseminars/fr/index.html",
    ["Que voulez-vous faire", "Planifier cette semaine", "Respecter une date limite", "/polymythcommons/"],
  ],
]) {
  const source = read(relative);
  markers.forEach((marker) =>
    expect(source.includes(marker), `${relative} lost ${marker}`),
  );
}
const calendarApp = read("js/polymythcal-revamp.js");
expect(
  calendarApp.includes('const SAVED_KEY = "polymythcal.savedEvents.v2"') &&
    calendarApp.includes('const SEARCHES_KEY = "polymythcal.savedSearches.v2"'),
  "Polymythcal versioned saved-state contract is incomplete",
);

const commons = json("polymythlib/data/polymyth-data.json");
expect(commons.release === "2026-07-28.g0.3", "Commons data release drifted");
expect(commons.projects?.length === 346, "Commons must retain 346 stable records");
expect(commons.mentions?.length === 393, "Commons must retain 393 book mentions");
expect(commons.bookLinks?.length === 437, "Commons must retain 437 printed links");
expect(commons.collections?.length === 8, "Commons must publish 8 collections");
expect(
  commons.mentions?.every((mention) => /^PC-\d{4}$/.test(mention.projectId)),
  "every Commons mention must join to a stable project ID",
);
expect(
  commons.currentStatuses?.every((status) => /^PC-\d{4}$/.test(status.projectId)),
  "every Commons status seed must join to a stable project ID",
);
expect(
  commons.mentions?.find((mention) => mention.id === "UKC-11-016")?.projectId ===
    "PC-0040",
  "California Digital Library canonical join regressed",
);
expect(
  commons.mentions?.find((mention) => mention.id === "UKC-09-013")?.projectId ===
    "PC-0050",
  "CIRCLE canonical join regressed",
);
const manifest = json("polymythlib/data/data-manifest.json");
expect(
  manifest.schema?.documentation ===
    "https://seminarschools.com/polymythlib/method/#record-model",
  "Commons schema documentation link is not portable",
);
for (const entry of manifest.files || []) {
  if (!entry.path || !entry.sha256) continue;
  const file = path.join(ROOT, "polymythlib", "data", entry.path);
  expect(fs.existsSync(file), `Commons manifest target missing ${entry.path}`);
  if (fs.existsSync(file)) {
    expect(
      sha256(fs.readFileSync(file)) === entry.sha256,
      `Commons manifest digest mismatch ${entry.path}`,
    );
  }
}

const home = read("index.html");
expect(
  home.includes('href="/polymythcommons/"') &&
    home.includes("id:'commons'") &&
    home.includes("href:'/polymythcommons/'"),
  "Seminar Schools home must expose Commons in visible and shared navigation data",
);
for (const relative of [
  "about/index.html",
  "teacherresources/index.html",
  "polymythseminars/index.html",
  "polymythseminars/fr/index.html",
  "polymyth/sitemap/index.html",
  "llms.txt",
]) {
  expect(read(relative).includes("polymythcommons/"), `${relative} must link to Commons`);
}

if (failures.length) {
  console.error("AUDIT 53 SHARED DISCOVERY RELEASE FAILED");
  failures.forEach((failure) => console.error(` - ${failure}`));
  process.exit(1);
}

console.log(
  "AUDIT 53 SHARED DISCOVERY RELEASE PASSED — 644 Teacher Resources, " +
    "833 Polymythcal records, 346 Commons records, stable joins, portable evidence, " +
    "front-page routes, and explicit external-evidence boundaries.",
);
