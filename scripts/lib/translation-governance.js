'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function writePreservingBuildTime(file, content) {
  const previousMtime = fs.existsSync(file) ? fs.statSync(file).mtimeMs : 0;
  fs.writeFileSync(file, content, 'utf8');
  if (previousMtime > Date.now() + 60_000) {
    const nextMtime = previousMtime + 2_000;
    fs.utimesSync(file, nextMtime / 1000, nextMtime / 1000);
  }
}

/**
 * Keep Audit 45's source-of-truth hashes aligned with pages owned by late
 * generators. Route builders call this only after their final English source
 * files have been written, so subsequent verification describes the actual
 * release rather than an earlier intermediate build state.
 */
function refreshTranslationGovernance(root, routes, { check = false } = {}) {
  const governancePath = path.join(root, 'data', 'audit45-translation-governance.json');
  if (!fs.existsSync(governancePath)) return 0;

  const requested = new Set(routes);
  const governance = JSON.parse(fs.readFileSync(governancePath, 'utf8'));
  const matched = new Set();
  let changed = 0;

  for (const record of governance.routes || []) {
    if (!requested.has(record.route)) continue;
    matched.add(record.route);
    const sourcePath = path.join(root, record.source || '');
    if (!record.source || !fs.existsSync(sourcePath)) {
      throw new Error(`translation-governance source missing for ${record.route}`);
    }
    const sourceHash = sha256(sourcePath);
    if (record.source_sha256 === sourceHash) continue;
    if (check) throw new Error(`stale translation-governance source hash: ${record.route}`);
    record.source_sha256 = sourceHash;
    changed += 1;
  }

  const missing = [...requested].filter(route => !matched.has(route));
  if (missing.length) {
    throw new Error(`translation-governance routes missing: ${missing.join(', ')}`);
  }

  if (changed) {
    writePreservingBuildTime(governancePath, `${JSON.stringify(governance, null, 2)}\n`);
  }
  return changed;
}

/**
 * Geometry and other presentation-only normalizers can rewrite an English
 * source page without changing any translatable copy. Refresh only governance
 * records whose source file was actually rewritten by that normalizer. This
 * must never be called for arbitrary content edits: their stale hashes are the
 * signal that localized copy needs to be rebuilt and reviewed.
 */
function refreshTranslationGovernanceForSources(root, sources, { check = false } = {}) {
  const governancePath = path.join(root, 'data', 'audit45-translation-governance.json');
  if (!fs.existsSync(governancePath)) return 0;

  const requested = new Set([...sources].map(source => String(source).replace(/\\/g, '/')));
  if (!requested.size) return 0;
  const governance = JSON.parse(fs.readFileSync(governancePath, 'utf8'));
  let changed = 0;

  for (const record of governance.routes || []) {
    const source = String(record.source || '').replace(/\\/g, '/');
    if (!source || !requested.has(source)) continue;
    const sourcePath = path.join(root, source);
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`translation-governance source missing for ${record.route}`);
    }
    const sourceHash = sha256(sourcePath);
    if (record.source_sha256 === sourceHash) continue;
    if (check) throw new Error(`stale translation-governance source hash: ${record.route}`);
    record.source_sha256 = sourceHash;
    changed += 1;
  }

  if (changed) {
    writePreservingBuildTime(governancePath, `${JSON.stringify(governance, null, 2)}\n`);
  }
  return changed;
}

module.exports = { refreshTranslationGovernance, refreshTranslationGovernanceForSources };
