'use strict';
const fs = require('fs');
const path = require('path');
const {spawnSync} = require('child_process');
const crypto = require('crypto');

function ensureLock(root, script) {
  const python = path.join(root, 'scripts/run-python.js');
  const inherited = process.env.SS_RELEASE_BUILD_LOCK_TOKEN || process.env.SS_RELEASE_BUILD_LOCK_ROOT;
  const args = inherited
    ? [python, path.join(root, 'scripts/assert-build-lock.py')]
    : [python, path.join(root, 'scripts/run-with-build-lock.py'), '--', process.execPath, script, ...process.argv.slice(2)];
  const result = spawnSync(process.execPath, args, {cwd:root, env:process.env, stdio:'inherit'});
  if (!inherited || result.status !== 0) process.exit(result.status ?? 1);
}

function writeJsonAtomic(file, value) {
  const temporary = path.join(path.dirname(file), `.${path.basename(file)}.part-${process.pid}`);
  const priorMtime = fs.existsSync(file) ? fs.statSync(file).mtimeMs : 0;
  let descriptor;
  try {
    descriptor = fs.openSync(temporary, 'wx', 0o600);
    fs.writeFileSync(descriptor, JSON.stringify(value, null, 2) + '\n');
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    if (priorMtime > Date.now() + 60000) {
      const stamp = (priorMtime + 2000) / 1000;
      fs.utimesSync(temporary, stamp, stamp);
    }
    fs.renameSync(temporary, file);
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    try { fs.unlinkSync(temporary); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}

function recordManualObservation(manual, incoming) {
  // A new crawl cannot silently overwrite curated facts or disappear behind
  // manual precedence. Retain the contradictory observation for source review.
  const fields = ['date', 'end_date', 'venue', 'source_url', 'lifecycle_status'];
  const changes = {};
  for (const field of fields) {
    const value = incoming[field];
    if (value !== undefined && value !== null && value !== '' && value !== manual[field]) {
      changes[field] = {reviewed: manual[field] ?? null, observed: value};
    }
  }
  const checkedAt = incoming.last_checked_at || incoming.scraped_at || null;
  if (!Object.keys(changes).length) {
    if (checkedAt && Date.parse(checkedAt) > (Date.parse(manual.last_source_observed_at || '') || 0)) {
      manual.last_source_observed_at = checkedAt;
    }
    return;
  }
  const observation = {
    source_id: incoming.source_id || null,
    source_url: incoming.source_url || null,
    checked_at: checkedAt,
    changes,
    excerpt: incoming.raw_excerpt || null,
    status: 'pending-source-review',
  };
  const key = crypto.createHash('sha256').update(JSON.stringify(observation)).digest('hex');
  const observations = Array.isArray(manual.source_observations) ? manual.source_observations : [];
  if (!observations.some(row => row.key === key)) observations.push({key, ...observation});
  manual.source_observations = observations;
}

module.exports = {ensureLock, writeJsonAtomic, recordManualObservation};
