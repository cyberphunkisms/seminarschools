#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..", "..");
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
  } catch (_) {
    failures.push(`${relative} is not valid JSON`);
    return {};
  }
}

function expect(condition, message) {
  if (!condition) failures.push(message);
}

function runVerifier(relative) {
  const result = spawnSync(process.execPath, [path.join(ROOT, relative)], {
    cwd: ROOT,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    failures.push(`${relative} failed: ${String(result.stderr || result.stdout).trim()}`);
  }
}

const teacher = json("teacherresources/resources-data.json");
const teacherGroups = teacher.groups || [];
const teacherCollections = teacherGroups.flatMap((group) => group.categories || []);
const teacherEntries = teacherCollections.flatMap((collection) => collection.entries || []);
expect(teacherGroups.length === 7, "Teacher Resources must expose 7 teaching areas");
expect(teacherCollections.length === 25, "Teacher Resources must expose 25 collections");
expect(teacherEntries.length === 645, `Teacher Resources changed: ${teacherEntries.length}/645`);
expect(
  new Set(teacherEntries.map((entry) => entry.id)).size === 645 &&
    teacherEntries.every((entry) => /^TR-\d{4}$/.test(entry.id || "")),
  "Teacher Resources stable IDs are incomplete",
);
expect(
  new Set(teacherEntries.map((entry) => entry.route_key)).size === 645,
  "Teacher Resources stable route keys are incomplete",
);
const pigeon = teacherEntries.find((entry) => entry.id === "TR-0645");
expect(
  pigeon?.route_key === "9f3fceea" &&
    pigeon?.url === "/teacherresources/files/Pigeon_Monologues_Modular_Color_and_BW.pdf",
  "Pigeon monologue resource identity drifted",
);
expect(
  fs.existsSync(path.join(ROOT, "teacherresources", "files", "Pigeon_Monologues_Modular_Color_and_BW.pdf")),
  "Pigeon monologue PDF is missing",
);

const teacherIndex = read("teacherresources/index.html");
expect(
  (teacherIndex.match(/\bdata-l="[^"]+"/g) || []).length === 645,
  "Teacher Resources SSR catalog must expose 645 source-language values",
);
expect(
  (teacherIndex.match(/class="entry-source-cta"/g) || []).length === 645 &&
    (teacherIndex.match(/class="entry-detail"/g) || []).length === 645,
  "Teacher Resources must expose source and detail actions for all 645 records",
);
expect(
  (read("teacherresources/feed.xml").match(/<item>/g) || []).length === 645,
  "Teacher Resources feed must contain all 645 records",
);

const inventory = json("data/polymythcal-inventory-contract.json");
const calendar = json("polymythseminars/events.json");
const events = calendar.events || [];
expect(
  events.length >= Number(inventory.minimum_canonical_events || 2088),
  "Polymythcal fell below its current canonical event floor",
);
expect(new Set(events.map((event) => event.id)).size === events.length,
  "Polymythcal canonical IDs are not unique");
expect(
  new Set(events.map((event) => event.type)).size >= Number(inventory.minimum_event_types || 64),
  "Polymythcal fell below its current event-type floor",
);

for (const relative of [
  "index.html",
  "about/index.html",
  "teacherresources/index.html",
  "polymythseminars/index.html",
  "polymythseminars/fr/index.html",
  "polymyth/sitemap/index.html",
  "llms.txt",
]) {
  expect(read(relative).includes("polymythcommons/"), `${relative} must link to Commons`);
}

runVerifier("scripts/verify-polymyth-commons.js");
runVerifier("scripts/verify-teacherresources-finder.js");

if (failures.length) {
  console.error("CURRENT AUDIT 53 SHARED DISCOVERY CHECK FAILED");
  failures.forEach((failure) => console.error(` - ${failure}`));
  process.exit(1);
}

console.log(
  `CURRENT AUDIT 53 SHARED DISCOVERY CHECK PASSED — ${teacherEntries.length} Teacher Resources, ` +
    `${events.length} Polymythcal records, stable Commons discovery, and preserved Audit 53 base evidence.`,
);
