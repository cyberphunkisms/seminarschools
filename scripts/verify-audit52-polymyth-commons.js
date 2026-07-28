#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const ROOT = path.resolve(__dirname, "..");
const RELEASE_ID = "2026-07-28-site-audit52-polymyth-commons-greenpeace-merge-final";

function read(relative) {
  return fs.readFileSync(path.join(ROOT, relative), "utf8");
}

function requireFile(relative) {
  if (!fs.statSync(path.join(ROOT, relative)).isFile()) {
    throw new Error(`Missing required Audit 52 file: ${relative}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const relative of [
  "WEBSITE_AUDIT52_POLYMYTH_COMMONS_FULL_POV_REPORT_2026-07-28.md",
  "WEBSITE_AUDIT52_POLYMYTH_COMMONS_VERIFICATION_2026-07-28.json",
  "scripts/reports/audit52-greenpeace-base-preservation.json",
  "polymythlib/data/directory-index.json",
  "polymythlib/data/backbone-index.json",
  "public/polymythlib/data/directory-index.json",
  "public/polymythlib/data/backbone-index.json"
]) requireFile(relative);

assert(read("RELEASE_ID.txt").trim() === RELEASE_ID, "Audit 52 release ID mismatch.");
const release = JSON.parse(read("RELEASE_MANIFEST.json"));
assert(release.release_id === RELEASE_ID, "Audit 52 manifest release ID mismatch.");
assert(
  release.notes.some((note) => note.includes("front page") && note.includes("Polymyth Commons")),
  "Release notes must record front-page Commons integration."
);

const verification = JSON.parse(
  read("WEBSITE_AUDIT52_POLYMYTH_COMMONS_VERIFICATION_2026-07-28.json")
);
assert(verification.status === "passed", "Audit 52 verification status must be passed.");
assert(verification.counts.unique_named_records === 346, "Expected 346 Commons records.");
assert(verification.preservation.cv_greenpeace_files_modified === 0, "CV preservation must be exact.");

const home = read("index.html");
assert(
  home.includes('href="/polymythcommons/"') &&
    home.includes("id:'commons'") &&
    home.includes("href:'/polymythcommons/'"),
  "Home must expose Commons through the visible path card and shared desktop/mobile project data."
);
for (const route of [
  "about/index.html",
  "teacherresources/index.html",
  "polymythseminars/index.html",
  "polymythseminars/fr/index.html",
  "polymyth/sitemap/index.html"
]) {
  assert(read(route).includes("/polymythcommons/"), `${route} must link to Polymyth Commons.`);
}

for (const relative of [
  "polymythlib/data/directory-index.json",
  "polymythlib/data/backbone-index.json"
]) {
  const payload = fs.readFileSync(path.join(ROOT, relative));
  const gzipBytes = zlib.gzipSync(payload, { level: 9 }).length;
  const ceiling = relative.includes("directory") ? 40000 : 120000;
  assert(gzipBytes < ceiling, `${relative} exceeds its gzip transfer ceiling.`);
}

assert(
  fs.readdirSync(path.join(ROOT, "polymythlib", "projects"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory()).length === 346,
  "Expected 346 stable project directories."
);

console.log(
  "AUDIT 52 POLYMYTH COMMONS RELEASE PASSED — front-page and vertical links, " +
  "346 stable records, compact data indexes, release evidence, and preserved Greenpeace/CV artifacts."
);
