(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MethodologyState = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const RECORD_VERSION = 2;
  const ENTRY_FIELDS = Object.freeze(["s", "r", "t", "b", "x", "tg", "img"]);
  const DEFAULT_PREFIXES = Object.freeze({
    delta: "ml:entry-delta:",
    tombstone: "ml:entry-deleted:",
    legacy: "entries:"
  });

  function stableId(prefix, value) {
    let hash = 2166136261;
    const text = String(value || "");
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return prefix + (hash >>> 0).toString(36);
  }

  function seedEntry(source, slug) {
    const id = source.s + "-" + slug(source.t);
    return {
      id,
      s: source.s,
      r: source.r || "both",
      t: source.t,
      b: source.b,
      x: source.x || "",
      tg: source.tg || "",
      img: source.img || ""
    };
  }

  function seedEntries(seed, slug) {
    return seed.map((source) => seedEntry(source, slug));
  }

  function normalizeEntry(entry) {
    const normalized = { id: String(entry.id || "") };
    for (const field of ENTRY_FIELDS) {
      if (field === "r") normalized[field] = entry[field] || "both";
      else normalized[field] = entry[field] || "";
    }
    if (Number.isFinite(entry.created)) normalized.created = entry.created;
    if (Number.isFinite(entry.updated)) normalized.updated = entry.updated;
    return normalized;
  }

  function deltaForEntry(base, entry) {
    const normalized = normalizeEntry(entry);
    if (!base) {
      return {
        version: RECORD_VERSION,
        kind: "created",
        id: normalized.id,
        entry: normalized
      };
    }
    const changes = {};
    for (const field of ENTRY_FIELDS) {
      if (normalized[field] !== base[field]) changes[field] = normalized[field];
    }
    if (!Object.keys(changes).length) return null;
    return {
      version: RECORD_VERSION,
      kind: "edit",
      id: normalized.id,
      changes,
      updated: Number.isFinite(entry.updated) ? entry.updated : Date.now()
    };
  }

  function normalizeDelta(value, keyId) {
    if (!value || typeof value !== "object") return null;
    if (value.kind === "created" && value.entry) {
      const entry = normalizeEntry(value.entry);
      entry.id = entry.id || value.id || keyId;
      return { version: RECORD_VERSION, kind: "created", id: entry.id, entry };
    }
    if (value.kind === "edit" && value.changes) {
      const id = String(value.id || keyId || "");
      if (!id) return null;
      const changes = {};
      for (const field of ENTRY_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(value.changes, field)) {
          changes[field] = field === "r" ? (value.changes[field] || "both") : (value.changes[field] || "");
        }
      }
      return {
        version: RECORD_VERSION,
        kind: "edit",
        id,
        changes,
        updated: Number.isFinite(value.updated) ? value.updated : undefined
      };
    }
    // Tolerate a full record accidentally written under the delta prefix.
    if (value.id && value.t && value.b && value.s) {
      return { version: RECORD_VERSION, kind: "created", id: value.id, entry: normalizeEntry(value) };
    }
    return null;
  }

  function applyDeltas(seedRecords, deltas, tombstones) {
    const records = new Map(seedRecords.map((entry) => [entry.id, { ...entry }]));
    for (const rawDelta of deltas) {
      const delta = normalizeDelta(rawDelta, rawDelta && rawDelta.id);
      if (!delta) continue;
      if (delta.kind === "created") {
        records.set(delta.id, { ...delta.entry });
        continue;
      }
      const current = records.get(delta.id);
      if (!current) continue;
      records.set(delta.id, {
        ...current,
        ...delta.changes,
        ...(Number.isFinite(delta.updated) ? { updated: delta.updated } : {})
      });
    }
    for (const id of tombstones) records.delete(id);
    return Array.from(records.values());
  }

  function migrationPlan(seedRecords, legacyRecords, existingDeltaIds, existingTombstones) {
    const seedMap = new Map(seedRecords.map((entry) => [entry.id, entry]));
    const legacyMap = new Map();
    for (const raw of legacyRecords) {
      if (!raw || typeof raw !== "object") continue;
      const id = String(raw.id || "");
      if (id) legacyMap.set(id, normalizeEntry(raw));
    }

    const legacySeedIds = new Set(Array.from(legacyMap.keys()).filter((id) => seedMap.has(id)));
    const fullThreshold = Math.max(1, Math.ceil(seedMap.size * 0.95));
    const legacyLooksFull = legacySeedIds.size >= fullThreshold;
    const deltas = [];
    const tombstones = [];

    for (const [id, record] of legacyMap) {
      if (existingDeltaIds.has(id) || existingTombstones.has(id)) continue;
      const delta = deltaForEntry(seedMap.get(id), record);
      if (delta) deltas.push(delta);
    }

    // The old format stored every seed record. A near-complete legacy corpus
    // therefore gives us a safe deletion signal. A partial/quota-truncated
    // corpus does not, so missing records in that case are never tombstoned.
    if (legacyLooksFull) {
      for (const id of seedMap.keys()) {
        if (
          !legacyMap.has(id) &&
          !existingDeltaIds.has(id) &&
          !existingTombstones.has(id)
        ) tombstones.push(id);
      }
    }

    return { deltas, tombstones, legacyLooksFull };
  }

  async function readPrefix(storage, prefix) {
    const values = [];
    const keys = [];
    try {
      const result = await storage.list(prefix);
      for (const key of (result && Array.isArray(result.keys) ? result.keys : [])) {
        keys.push(key);
        try {
          const stored = await storage.get(key);
          if (!stored || typeof stored.value !== "string") continue;
          values.push({ key, value: JSON.parse(stored.value) });
        } catch (error) {
          // One corrupt record must not hide the embedded corpus.
        }
      }
    } catch (error) {
      return { keys: [], values: [] };
    }
    return { keys, values };
  }

  async function safeSet(storage, key, value) {
    try {
      const result = await storage.set(key, value);
      return result !== null && result !== false && (!result || result.ok !== false);
    } catch (error) {
      return false;
    }
  }

  async function safeDelete(storage, key) {
    try {
      const result = await storage.delete(key);
      return result !== null && result !== false && (!result || result.ok !== false);
    } catch (error) {
      return false;
    }
  }

  async function loadState(options) {
    const storage = options.storage;
    const prefixes = { ...DEFAULT_PREFIXES, ...(options.prefixes || {}) };
    const embedded = seedEntries(options.seed, options.slug);
    const baseMap = new Map(embedded.map((entry) => [entry.id, entry]));
    const [storedDeltas, storedTombstones, legacy] = await Promise.all([
      readPrefix(storage, prefixes.delta),
      readPrefix(storage, prefixes.tombstone),
      readPrefix(storage, prefixes.legacy)
    ]);

    const deltas = [];
    for (const item of storedDeltas.values) {
      const delta = normalizeDelta(item.value, item.key.slice(prefixes.delta.length));
      if (delta) deltas.push(delta);
    }
    const existingDeltaIds = new Set(deltas.map((delta) => delta.id));
    const tombstones = new Set(
      storedTombstones.keys.map((key) => key.slice(prefixes.tombstone.length)).filter(Boolean)
    );

    const legacyRecords = legacy.values.map((item) => {
      const record = item.value;
      if (record && !record.id) record.id = item.key.slice(prefixes.legacy.length);
      return record;
    });
    const plan = migrationPlan(embedded, legacyRecords, existingDeltaIds, tombstones);
    let migrationPersisted = true;
    let writeCount = 0;

    for (const delta of plan.deltas) {
      const ok = await safeSet(storage, prefixes.delta + delta.id, JSON.stringify(delta));
      writeCount += 1;
      migrationPersisted = migrationPersisted && ok;
    }
    for (const id of plan.tombstones) {
      const ok = await safeSet(storage, prefixes.tombstone + id, JSON.stringify({
        version: RECORD_VERSION,
        id,
        deleted: true
      }));
      writeCount += 1;
      migrationPersisted = migrationPersisted && ok;
    }

    // Do not erase the recoverable legacy copy unless every required delta and
    // tombstone was accepted. Quota errors leave legacy state available.
    if (legacy.keys.length && migrationPersisted) {
      for (const key of legacy.keys) {
        migrationPersisted = (await safeDelete(storage, key)) && migrationPersisted;
      }
    }

    const currentDeltas = [...plan.deltas, ...deltas];
    const currentTombstones = new Set([...plan.tombstones, ...tombstones]);
    return {
      entries: applyDeltas(embedded, currentDeltas, currentTombstones),
      baseMap,
      prefixes,
      migrationPersisted,
      writeCount,
      legacyLooksFull: plan.legacyLooksFull
    };
  }

  async function persistEntry(storage, prefixes, baseMap, entry) {
    const delta = deltaForEntry(baseMap.get(entry.id), entry);
    let saved;
    if (!delta) {
      saved = await safeDelete(storage, prefixes.delta + entry.id);
    } else {
      saved = await safeSet(storage, prefixes.delta + entry.id, JSON.stringify(delta));
    }
    if (!saved) return false;
    // An import can intentionally restore a previously deleted stable ID.
    await safeDelete(storage, prefixes.tombstone + entry.id);
    return true;
  }

  async function persistDeletion(storage, prefixes, baseMap, id) {
    if (!baseMap.has(id)) {
      return safeDelete(storage, prefixes.delta + id);
    }
    const saved = await safeSet(storage, prefixes.tombstone + id, JSON.stringify({
      version: RECORD_VERSION,
      id,
      deleted: true
    }));
    if (!saved) return false;
    await safeDelete(storage, prefixes.delta + id);
    return true;
  }

  function fixedHistorySeed(items) {
    const seen = new Set();
    const fixed = [];
    for (const item of items) {
      const note = typeof item === "string" ? item : item && item.note;
      if (!note || seen.has(note)) continue;
      seen.add(note);
      fixed.push(Object.freeze({
        id: stableId("history-", note),
        ts: "historical",
        note
      }));
    }
    return Object.freeze(fixed);
  }

  function mergeHistory(fixedSeed, storedItems) {
    const fixedNotes = new Set(fixedSeed.map((item) => item.note));
    const seenUserNotes = new Set();
    const user = [];
    for (const item of Array.isArray(storedItems) ? storedItems : []) {
      if (!item || typeof item.note !== "string" || fixedNotes.has(item.note)) continue;
      if (seenUserNotes.has(item.note)) continue;
      seenUserNotes.add(item.note);
      user.push({
        ...item,
        id: item.id || stableId("user-history-", (item.ts || "") + "\n" + item.note),
        ts: item.ts || "undated"
      });
    }
    return { fixed: fixedSeed, user, merged: [...fixedSeed, ...user] };
  }

  return Object.freeze({
    RECORD_VERSION,
    ENTRY_FIELDS,
    DEFAULT_PREFIXES,
    stableId,
    seedEntry,
    seedEntries,
    deltaForEntry,
    applyDeltas,
    migrationPlan,
    safeSet,
    safeDelete,
    loadState,
    persistEntry,
    persistDeletion,
    fixedHistorySeed,
    mergeHistory
  });
});
