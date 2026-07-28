#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const RELEASE_ID = "2026-07-28-site-audit52-polymyth-commons-greenpeace-merge-final";
const GENERATED_AT = "2026-07-28T11:20:00-04:00";
const manifestPath = path.join(ROOT, "RELEASE_MANIFEST.json");
const releaseIdPath = path.join(ROOT, "RELEASE_ID.txt");

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const notes = [
  "Audit 52 integrates Polymyth Commons into the newest Greenpeace/CV complete site base while preserving every supplied Greenpeace and Saul CV artifact byte-for-byte.",
  "The Seminar Schools front page now presents Polymyth Commons as both a visible start-here card and a project-map destination; the mobile project rail inherits the same route.",
  "Commons pathways are also present on About, Teacher Resources, English and French Polymythcal, the human sitemap, the XML sitemap, and llms.txt.",
  "Polymythlib Generation 0 contains 346 stable project records, 393 book mentions, 437 printed links, 252 hosts, six transparent collections, the book backbone, method and governance pages, contribution routes, and downloadable source data.",
  "Current evidence, book-era evidence, and Polymyth curation remain separate. Record pages report field-specific evidence states and avoid universal project-quality scoring.",
  "Compact directory and backbone indexes reduce the initial directory and research-browser data transfers while the complete JSON, CSV, workbook, manifest, and changelog remain available for research and preservation.",
  "Audit 52 adds keyboard, zoom, semantic-control, live-region, input-label, canonical, social-sharing, cache, route-parity, and public-build checks across the Commons surfaces.",
  "The static release retains the newest site's 644 Teacher Resources, 25 Teacher collections, 833 canonical Polymythcal events, localized routes, and complete Greenpeace/CV deliverables.",
  "Native assistive technology, physical-device observation, and a live review of every historical external link remain defined external follow-up evidence."
];

manifest.release_id = RELEASE_ID;
manifest.generated_at = GENERATED_AT;
manifest.release_type = "Audit 52 Polymyth Commons full-perspective critique, smoothness hardening, and newest Greenpeace/CV base integration";
manifest.notes = [
  ...notes,
  ...(Array.isArray(manifest.notes)
    ? manifest.notes.filter((note) => !notes.includes(note))
    : [])
];

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
fs.writeFileSync(releaseIdPath, `${RELEASE_ID}\n`);

console.log(`AUDIT 52 RELEASE STAMP APPLIED — ${RELEASE_ID}`);
