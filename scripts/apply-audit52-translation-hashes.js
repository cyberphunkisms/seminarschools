#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const governancePath = path.join(ROOT, "data", "audit45-translation-governance.json");
const targets = [
  {
    source: "polymythseminars/index.html",
    routes: ["polymythseminars/fr/index.html"]
  },
  {
    source: "saul/index.html",
    routes: [
      "saul/fr/index.html",
      "saul/zh-hant/index.html",
      "saul/zh-hans/index.html",
      "saul/fa/index.html"
    ]
  }
];

function sha256(relative) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(path.join(ROOT, relative)))
    .digest("hex");
}

const governance = JSON.parse(fs.readFileSync(governancePath, "utf8"));
let recordsUpdated = 0;
let pagesUpdated = 0;

for (const target of targets) {
  const sourceSha = sha256(target.source);
  for (const record of governance.routes) {
    if (record.source === target.source) {
      record.source_sha256 = sourceSha;
      recordsUpdated += 1;
    }
  }
  for (const relative of target.routes) {
    const pagePath = path.join(ROOT, relative);
    const original = fs.readFileSync(pagePath, "utf8");
    const updated = original.replace(
      /(<meta\s+name=["']translation-source-sha256["']\s+content=["'])[^"']*(["']\s*\/?>)/i,
      `$1${sourceSha}$2`
    );
    if (updated === original) {
      throw new Error(`Translation source hash metadata missing: ${relative}`);
    }
    fs.writeFileSync(pagePath, updated);
    pagesUpdated += 1;
  }
}

fs.writeFileSync(governancePath, `${JSON.stringify(governance, null, 2)}\n`);
console.log(
  `AUDIT 52 TRANSLATION HASHES UPDATED — ${recordsUpdated} governance records and ${pagesUpdated} localized pages.`
);
