#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const state = require("../js/methodology-state.js");

const root = path.resolve(__dirname, "..");
const pagePath = path.join(root, "polymyth/methodologylist/index.html");
const page = fs.readFileSync(pagePath, "utf8");

class MemoryStorage {
  constructor(initial = {}, options = {}) {
    this.values = new Map(Object.entries(initial));
    this.failSet = Boolean(options.failSet);
    this.setCalls = [];
    this.deleteCalls = [];
  }
  async list(prefix) {
    return { keys: Array.from(this.values.keys()).filter((key) => key.startsWith(prefix)) };
  }
  async get(key) {
    return this.values.has(key) ? { value: this.values.get(key) } : null;
  }
  async set(key, value) {
    this.setCalls.push({ key, value });
    if (this.failSet) return null;
    this.values.set(key, value);
    return { ok: true };
  }
  async delete(key) {
    this.deleteCalls.push(key);
    this.values.delete(key);
    return { ok: true };
  }
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function makeSeed(count = 20) {
  return Array.from({ length: count }, (_, index) => ({
    s: index % 2 ? "analysis" : "methodology",
    r: "both",
    t: "Stable seed title " + String(index + 1).padStart(2, "0"),
    b: "Embedded body " + index,
    x: "",
    tg: "seed"
  }));
}

function parseSeedArray(html) {
  const seedIndex = html.indexOf("const SEED");
  const start = html.indexOf("[", seedIndex);
  let depth = 0;
  let quote = null;
  let template = false;
  let escaped = false;
  for (let index = start; index < html.length; index += 1) {
    const character = html[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (character === quote) quote = null;
      continue;
    }
    if (template) {
      if (character === "`") template = false;
      continue;
    }
    if (character === "`") {
      template = true;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      continue;
    }
    if (character === "[") depth += 1;
    if (character === "]" && --depth === 0) {
      return vm.runInNewContext(html.slice(start, index + 1));
    }
  }
  throw new Error("Could not parse methodology SEED.");
}

function legacyObject(seedRecord, changes = {}) {
  return JSON.stringify({
    ...seedRecord,
    ...changes,
    created: 1710000000000,
    updated: 1710000000000
  });
}

async function run() {
  assert.match(page, /\/js\/methodology-state\.js\?v=cl91/);
  assert.match(page, /const KP = 'ml:entry-delta:';/);
  assert.match(page, /const TK = 'ml:entry-deleted:';/);
  assert.match(page, /MLState\.loadState\(/);
  assert.match(page, /MLState\.persistEntry\(/);
  assert.match(page, /MLState\.persistDeletion\(/);
  assert.doesNotMatch(page, /window\.storage\.set\(KP\+id,JSON\.stringify\(entry\)\)/);
  const inlineScript = page.match(
    /<script>\n(\/\/ ={20,}[\s\S]*?)<\/script>\n<script src="\/js\/mandala\.js/
  );
  assert.ok(inlineScript, "main methodology script should be extractable");
  new vm.Script(inlineScript[1], { filename: "polymyth/methodologylist/index.html:inline" });

  // Run the real linkify function with a global changelog sentinel. Repeated
  // rendering calls must not append to it.
  const linkifySource = page.match(/function linkify\(escapedText\)\{[\s\S]*?\n\}\n\nfunction renderTags/);
  assert.ok(linkifySource, "linkify function should be extractable");
  assert.doesNotMatch(linkifySource[0], /changelog/);
  const context = {
    changelog: [{ id: "sentinel" }],
    _entryTitleIndex: null
  };
  vm.runInNewContext(linkifySource[0].replace(/\n\nfunction renderTags$/, ""), context);
  for (let index = 0; index < 100; index += 1) context.linkify("See [12] for details.");
  assert.equal(context.changelog.length, 1, "linkify must not mutate the live changelog");

  const seed = makeSeed();
  const embedded = state.seedEntries(seed, slug);

  // Fresh boot: embedded corpus renders with no localStorage writes.
  const freshStorage = new MemoryStorage();
  const fresh = await state.loadState({ seed, slug, storage: freshStorage });
  assert.equal(fresh.entries.length, seed.length);
  assert.equal(fresh.writeCount, 0);
  assert.equal(freshStorage.setCalls.length, 0, "fresh boot must write zero seed records");
  const realSeed = parseSeedArray(page);
  assert.equal(realSeed.length, 1139, "canonical embedded corpus count must not backtrack");
  const realFreshStorage = new MemoryStorage();
  const realFresh = await state.loadState({ seed: realSeed, slug, storage: realFreshStorage });
  assert.equal(realFresh.entries.length, 1139);
  assert.equal(realFreshStorage.setCalls.length, 0);

  // One edit produces one compact delta key, not a full corpus copy.
  const edited = { ...fresh.entries[0], t: "User-edited title", updated: 1720000000000 };
  assert.equal(
    await state.persistEntry(freshStorage, fresh.prefixes, fresh.baseMap, edited),
    true
  );
  const deltaKeys = Array.from(freshStorage.values.keys()).filter((key) => key.startsWith(fresh.prefixes.delta));
  assert.equal(deltaKeys.length, 1, "one edited seed record should create one delta");
  const storedDelta = JSON.parse(freshStorage.values.get(deltaKeys[0]));
  assert.deepEqual(storedDelta.changes, { t: "User-edited title" });
  assert.equal(Object.prototype.hasOwnProperty.call(storedDelta, "entry"), false);

  const editedReload = await state.loadState({ seed, slug, storage: freshStorage });
  assert.equal(editedReload.entries.find((entry) => entry.id === edited.id).t, "User-edited title");
  assert.equal(freshStorage.setCalls.length, 1, "reload must not rewrite the delta");
  assert.equal(
    await state.persistEntry(freshStorage, fresh.prefixes, fresh.baseMap, fresh.entries[0]),
    true
  );
  assert.equal(
    Array.from(freshStorage.values.keys()).filter((key) => key.startsWith(fresh.prefixes.delta)).length,
    0,
    "reverting to the embedded record should remove its delta"
  );

  // Legacy migration: retain an edited seed, infer one deletion only from a
  // near-complete old corpus, and retain a user-created record.
  const legacyInitial = {};
  for (let index = 0; index < embedded.length - 1; index += 1) {
    const record = embedded[index];
    const changes = index === 2 ? { b: "Preserved legacy edit" } : {};
    legacyInitial["entries:" + record.id] = legacyObject(record, changes);
  }
  const custom = {
    id: "analysis-user-created",
    s: "analysis",
    r: "human",
    t: "User-created record",
    b: "Keep this record",
    x: "",
    tg: "user",
    img: ""
  };
  legacyInitial["entries:" + custom.id] = JSON.stringify(custom);
  const migrationStorage = new MemoryStorage(legacyInitial);
  const migrated = await state.loadState({ seed, slug, storage: migrationStorage });
  assert.equal(migrated.legacyLooksFull, true);
  assert.equal(migrated.migrationPersisted, true);
  assert.equal(migrated.entries.length, seed.length);
  assert.equal(
    migrated.entries.find((entry) => entry.id === embedded[2].id).b,
    "Preserved legacy edit"
  );
  assert.ok(migrated.entries.some((entry) => entry.id === custom.id));
  assert.ok(!migrated.entries.some((entry) => entry.id === embedded.at(-1).id));
  assert.equal(
    Array.from(migrationStorage.values.keys()).some((key) => key.startsWith("entries:")),
    false,
    "legacy full records should be removed only after successful migration"
  );

  const migratedReload = await state.loadState({ seed, slug, storage: migrationStorage });
  assert.equal(migratedReload.entries.length, migrated.entries.length);
  assert.equal(
    migratedReload.entries.find((entry) => entry.id === embedded[2].id).b,
    "Preserved legacy edit"
  );
  assert.ok(!migratedReload.entries.some((entry) => entry.id === embedded.at(-1).id));

  // A partial old corpus can be a quota artifact, so missing records must not
  // be mistaken for user deletions.
  const partialLegacy = {};
  for (const record of embedded.slice(0, 10)) {
    partialLegacy["entries:" + record.id] = legacyObject(record);
  }
  const partialState = await state.loadState({
    seed,
    slug,
    storage: new MemoryStorage(partialLegacy)
  });
  assert.equal(partialState.legacyLooksFull, false);
  assert.equal(partialState.entries.length, seed.length);

  // Quota failure: keep the recoverable legacy copy and still render its
  // in-memory edits alongside the embedded corpus.
  const quotaStorage = new MemoryStorage(legacyInitial, { failSet: true });
  const quotaState = await state.loadState({ seed, slug, storage: quotaStorage });
  assert.equal(quotaState.migrationPersisted, false);
  assert.equal(
    quotaState.entries.find((entry) => entry.id === embedded[2].id).b,
    "Preserved legacy edit"
  );
  assert.ok(
    Array.from(quotaStorage.values.keys()).some((key) => key.startsWith("entries:")),
    "failed migration must retain legacy records"
  );
  const blockedFresh = await state.loadState({
    seed,
    slug,
    storage: new MemoryStorage({}, { failSet: true })
  });
  assert.equal(blockedFresh.entries.length, seed.length, "blocked storage must not hide embedded entries");

  // Fixed history has stable IDs and does not multiply across simulated
  // renders/reloads. User notes survive and are deduplicated once.
  const fixed = state.fixedHistorySeed([
    { note: "Fixed release note A", ts: new Date().toISOString() },
    { note: "Fixed release note B", ts: new Date().toISOString() },
    { note: "Fixed release note A", ts: new Date().toISOString() }
  ]);
  assert.equal(fixed.length, 2);
  assert.ok(Object.isFrozen(fixed));
  assert.ok(fixed.every(Object.isFrozen));
  const legacyHistory = [
    ...fixed.map((item) => ({ note: item.note, ts: "old-load-1" })),
    ...fixed.map((item) => ({ note: item.note, ts: "old-load-2" })),
    { note: "My user note", ts: "2026-07-24T10:00:00Z" },
    { note: "My user note", ts: "2026-07-24T10:00:00Z" }
  ];
  const historyOnce = state.mergeHistory(fixed, legacyHistory);
  const historyTwice = state.mergeHistory(fixed, historyOnce.merged);
  const historyThird = state.mergeHistory(fixed, historyTwice.merged);
  assert.equal(historyOnce.merged.length, 3);
  assert.equal(historyTwice.merged.length, 3);
  assert.equal(historyThird.merged.length, 3);
  assert.equal(historyThird.user.length, 1);
  assert.equal(historyThird.user[0].note, "My user note");
  assert.deepEqual(
    historyOnce.fixed.map((item) => item.id),
    historyThird.fixed.map((item) => item.id)
  );

  console.log(
    "AUDIT38 METHODOLOGY STATE OK — pure linkify, immutable history, delta-only persistence, deletion migration, and quota fallback verified."
  );
}

run().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
