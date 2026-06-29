#!/usr/bin/env node
/**
 * audit-bidirectional.js
 *
 * Standalone bidirectional-integrity auditor for the polymyth file ecosystem.
 *
 * Files audited (default): polymyth/modulecanon/index.html (mc), campaigncodex.html (cc),
 *                          bookwormburrows.html (bb).
 *
 * What it checks:
 *   1. SEED-array parse integrity for each file (brace-balanced state machine)
 *   2. Duplicate IDs within each file
 *   3. Cross-file bidirectional integrity across 6 directional pairs:
 *        mc -> cc, cc -> mc, bb -> cc, cc -> bb, mc -> bb, bb -> mc
 *      For each entry e in file A with link to id t in file B, file B[t] must
 *      contain a reciprocal link back to e.
 *   4. Intra-file bidirectional integrity: same-file references (cc -> cc, mc -> mc, bb -> bb)
 *      must be reciprocal in the same _links field.
 *   5. Dangling cross-references: a *_links entry pointing at a missing id is flagged.
 *
 * Exit codes:
 *   0  AUDIT PASS (all checks clean)
 *   1  AUDIT FAIL (one or more violations)
 *   2  Tool error (parse failure, file not found, etc.)
 *
 * Modes:
 *   --quiet     Suppress per-error output; print summary line only.
 *   --verbose   Print summary plus per-error detail (default).
 *   --json      Emit JSON report on stdout (suppresses other output).
 *   --strict    Treat duplicate-IDs and dangling-refs as errors (default: warn-only).
 *   --files <a,b,c>   Override default file list (comma-separated paths;
 *                     order interpreted as mc,cc,bb if 3 paths given).
 *   --top N     Print top N most-cross-referenced entries per file.
 *
 * Usage:
 *   node scripts/audit-bidirectional.js
 *   node scripts/audit-bidirectional.js --strict --top 5
 *   node scripts/audit-bidirectional.js --json > audit.json
 *
 * Architecture principle (bidirectional integrity):
 *   The polymyth ecosystem uses *_links fields (mc_links, cc_links, bb_links)
 *   to express cross-references between entries. Bidirectionality is canonical:
 *   if entry A in file F1 has F2_links containing id X, then entry X in file F2
 *   must have F1_links containing A's id. This applies cross-file (3 file pairs,
 *   6 directional pairs) AND intra-file (same field name, same file).
 *
 *   The bidirectional principle is enforced by the polymyth schema convention:
 *   "keep especially when content references; only surface bidirectional in CL
 *   as necessary." This auditor catches violations of that principle.
 *
 * Implementation note: SEED arrays are JavaScript array literals embedded in
 * HTML <script> blocks. The parser uses brace-counting with string-and-template-
 * literal awareness so that JSON-style {} embedded inside string fields do not
 * confuse the depth counter. The eval-based extraction is safe because we only
 * eval the SEED-array slice we ourselves matched, not arbitrary HTML.
 *
 * Author: Saul Nassau / Rainbowsol polymyth project
 * Origin: 2026-05-10, T3.5 audit-script formalization, replacing inline Node -e
 *         invocations across CL phases.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ------------------------------------------------------------------
// Argument parsing
// ------------------------------------------------------------------
const argv = process.argv.slice(2);
let mode = { quiet: false, verbose: true, json: false, strict: false, top: 0 };
let fileOverride = null;

for (let i = 0; i < argv.length; i++) {
  const arg = argv[i];
  if (arg === '--quiet') { mode.quiet = true; mode.verbose = false; }
  else if (arg === '--verbose') { mode.verbose = true; mode.quiet = false; }
  else if (arg === '--json') { mode.json = true; mode.verbose = false; mode.quiet = true; }
  else if (arg === '--strict') { mode.strict = true; }
  else if (arg === '--top') { mode.top = parseInt(argv[++i], 10) || 0; }
  else if (arg === '--files') { fileOverride = argv[++i].split(','); }
  else if (arg === '--help' || arg === '-h') {
    console.log(fs.readFileSync(__filename, 'utf-8').split('\n').slice(0, 50).join('\n'));
    process.exit(0);
  } else {
    console.error('Unknown argument:', arg);
    console.error('Usage: node audit-bidirectional.js [--quiet|--verbose|--json] [--strict] [--top N] [--files mc,cc,bb]');
    process.exit(2);
  }
}

// ------------------------------------------------------------------
// File discovery
// ------------------------------------------------------------------
// Resolve relative to script location plus working-directory walking
const scriptDir = path.dirname(__filename);
const projectRoot = path.dirname(scriptDir);
const cwd = process.cwd();

function resolveFile(relativeOrAbsolute) {
  if (path.isAbsolute(relativeOrAbsolute) && fs.existsSync(relativeOrAbsolute)) {
    return relativeOrAbsolute;
  }
  // Try cwd, then projectRoot
  const tryCwd = path.resolve(cwd, relativeOrAbsolute);
  if (fs.existsSync(tryCwd)) return tryCwd;
  const tryRoot = path.resolve(projectRoot, relativeOrAbsolute);
  if (fs.existsSync(tryRoot)) return tryRoot;
  return null;
}

const DEFAULT_FILES = {
  mc: 'polymyth/modulecanon/index.html',
  cc: 'polymyth/campaigncodex/index.html',
  bb: 'polymyth/bookwormburrows/index.html',
};

const FILES = {};
if (fileOverride) {
  if (fileOverride.length !== 3) {
    console.error('--files requires 3 comma-separated paths in order mc,cc,bb');
    process.exit(2);
  }
  ['mc', 'cc', 'bb'].forEach((k, i) => { FILES[k] = fileOverride[i]; });
} else {
  Object.assign(FILES, DEFAULT_FILES);
}

// Resolve each
for (const k of Object.keys(FILES)) {
  const resolved = resolveFile(FILES[k]);
  if (!resolved) {
    console.error('File not found for ' + k + ': ' + FILES[k]);
    console.error('Searched: ' + cwd + ', ' + projectRoot);
    process.exit(2);
  }
  FILES[k] = resolved;
}

// ------------------------------------------------------------------
// SEED-array parser (brace-balanced state machine, string-aware)
// ------------------------------------------------------------------
function parseSeedArray(filePath) {
  const html = fs.readFileSync(filePath, 'utf-8');
  const seedIdx = html.indexOf('const SEED');
  if (seedIdx === -1) throw new Error('No const SEED declaration in ' + filePath);
  const arrStart = html.indexOf('[', seedIdx);
  if (arrStart === -1) throw new Error('No [ after const SEED in ' + filePath);

  let depth = 0;
  let inTpl = false;
  let strQuote = null;
  let escape = false;
  let arrEnd = -1;

  for (let i = arrStart; i < html.length; i++) {
    const c = html[i];
    if (escape) { escape = false; continue; }
    if (c === '\\') { escape = true; continue; }
    if (strQuote) {
      if (c === strQuote) strQuote = null;
      continue;
    }
    if (inTpl) {
      if (c === '`') inTpl = false;
      continue;
    }
    if (c === '`') { inTpl = true; continue; }
    if (c === "'" || c === '"') { strQuote = c; continue; }
    if (c === '[') depth++;
    else if (c === ']') {
      depth--;
      if (depth === 0) { arrEnd = i; break; }
    }
  }

  if (arrEnd === -1) throw new Error('Unbalanced SEED array in ' + filePath);

  const slice = html.slice(arrStart, arrEnd + 1);
  // Safe: we eval only the SEED-array slice we extracted ourselves
  return eval(slice);
}

// ------------------------------------------------------------------
// Audit logic
// ------------------------------------------------------------------
function audit() {
  const arrs = {};
  const maps = {};
  const errors = [];
  const warnings = [];
  const info = [];

  // Parse all three files
  for (const key of Object.keys(FILES)) {
    try {
      arrs[key] = parseSeedArray(FILES[key]);
      maps[key] = Object.fromEntries(arrs[key].map(e => [e.id, e]));
      info.push({ kind: 'parse', file: key, count: arrs[key].length });
    } catch (err) {
      errors.push({ kind: 'parse-fail', file: key, message: err.message });
      return { errors, warnings, info, fatal: true };
    }
  }

  // 1. Duplicate-ID detection (per file)
  for (const key of Object.keys(arrs)) {
    const ids = arrs[key].map(e => e.id);
    const seen = new Set();
    const dups = new Set();
    for (const id of ids) {
      if (seen.has(id)) dups.add(id);
      seen.add(id);
    }
    if (dups.size > 0) {
      const item = { kind: 'duplicate-ids', file: key, dups: [...dups] };
      if (mode.strict) errors.push(item); else warnings.push(item);
    }
  }

  // 2. Cross-file bidirectional integrity
  const crossPairs = [
    ['mc', 'cc'], ['cc', 'mc'],
    ['bb', 'cc'], ['cc', 'bb'],
    ['mc', 'bb'], ['bb', 'mc']
  ];

  for (const [a, b] of crossPairs) {
    const lf = b + '_links';   // links-field on source pointing at target
    const rf = a + '_links';   // expected reciprocal field on target

    for (const e of arrs[a]) {
      const links = e[lf];
      if (!links || links.length === 0) continue;
      for (const tid of links) {
        const tg = maps[b][tid];
        if (!tg) {
          const item = { kind: 'dangling-cross', from: a, fromId: e.id, to: b, toId: tid };
          if (mode.strict) errors.push(item); else warnings.push(item);
          continue;
        }
        if (!tg[rf] || !tg[rf].includes(e.id)) {
          // ONE-DIRECTIONAL-BY-DESIGN EXEMPTION (added 2026-05-15 T59).
          // Same rules as intra-file plus citation-target exemption: citations (cit-*)
          // are pure-data entries referenced by many places; back-referencing every
          // citer would create high maintenance burden without integrity benefit.
          const sourceExempt = /(?:^|-)pen-/.test(e.id) || /-(overlay|bibliography)$/.test(e.id);
          const targetExempt = /^cit-/.test(tid) || /^e\d+$/.test(tid) || /-(fitmap|overview|inventory|index)$/.test(tid) || /^cc-eng\d[a-z]?$/.test(tid) || /^cc-nbe\d[a-z]?$/.test(tid);
          if (sourceExempt || targetExempt) {
            warnings.push({ kind: 'cross-one-directional-exempt', from: a, fromId: e.id, to: b, toId: tid, reason: sourceExempt ? 'pen-or-hub-source' : 'citation-target' });
          } else {
            errors.push({ kind: 'cross-no-reciprocal', from: a, fromId: e.id, to: b, toId: tid, expectedField: rf });
          }
        }
      }
    }
  }

  // 3. Intra-file bidirectional integrity
  for (const key of Object.keys(arrs)) {
    const lf = key + '_links';
    for (const e of arrs[key]) {
      const links = e[lf];
      if (!links || links.length === 0) continue;
      for (const tid of links) {
        // Target must be in same file (intra-file) — if it is in a different file, that is a cross-file ref
        // and is handled by the cross-pair logic above. Same-key field semantically means "same file".
        const tg = maps[key][tid];
        if (!tg) {
          // Could be cross-file ref incorrectly placed; flag dangling
          const item = { kind: 'dangling-intra', file: key, fromId: e.id, toId: tid };
          if (mode.strict) errors.push(item); else warnings.push(item);
          continue;
        }
        if (!tg[lf] || !tg[lf].includes(e.id)) {
          // ONE-DIRECTIONAL-BY-DESIGN EXEMPTION (added 2026-05-15 T59).
          // pen-* entries are pending items that describe outbound intent toward implementation targets.
          // The targets are not waiting on the pending item. Pen entries should hold forward references
          // without requiring targets to back-reference. Exempt source IDs matching /(?:^|-)pen-/.
          // Overlay/bibliography hubs are umbrella entries listing parts; parts do not back-reference
          // the umbrella. Exempt source IDs ending in '-overlay' or '-bibliography'.
          // T60 extension: target-exempt for curriculum umbrellas (e\d+) and index entries (-fitmap, -overview, -inventory, -index).
          const exempt = /(?:^|-)pen-/.test(e.id) || /-(overlay|bibliography)$/.test(e.id)
                         || /^e\d+$/.test(tid) || /-(fitmap|overview|inventory|index)$/.test(tid);
          if (exempt) {
            warnings.push({ kind: 'intra-one-directional-exempt', file: key, fromId: e.id, toId: tid, reason: 'pen-or-hub-source' });
          } else {
            errors.push({ kind: 'intra-no-reciprocal', file: key, fromId: e.id, toId: tid, expectedField: lf });
          }
        }
      }
    }
  }

  return { errors, warnings, info, arrs, maps, fatal: false };
}

// ------------------------------------------------------------------
// Output
// ------------------------------------------------------------------
function emit(result) {
  if (result.fatal) {
    if (mode.json) {
      console.log(JSON.stringify({ status: 'FATAL', errors: result.errors }, null, 2));
    } else {
      for (const e of result.errors) {
        console.error('FATAL ' + e.kind + ' [' + e.file + ']: ' + e.message);
      }
    }
    process.exit(2);
  }

  const totalErrors = result.errors.length;
  const totalWarnings = result.warnings.length;

  if (mode.json) {
    const totals = {};
    for (const key of Object.keys(result.arrs)) totals[key] = result.arrs[key].length;
    const topByFile = {};
    if (mode.top > 0) {
      for (const key of Object.keys(result.arrs)) {
        const lf = key + '_links';
        const sorted = result.arrs[key]
          .map(e => ({ id: e.id, count: (e[lf] || []).length }))
          .sort((a, b) => b.count - a.count)
          .slice(0, mode.top);
        topByFile[key] = sorted;
      }
    }
    console.log(JSON.stringify({
      status: totalErrors === 0 ? 'PASS' : 'FAIL',
      totals,
      errors: result.errors,
      warnings: result.warnings,
      top: topByFile
    }, null, 2));
    process.exit(totalErrors === 0 ? 0 : 1);
  }

  // Verbose / quiet output
  if (mode.verbose) {
    for (const e of result.errors) {
      switch (e.kind) {
        case 'cross-no-reciprocal':
          console.log('X-ERR ' + e.from + '[' + e.fromId + '] -> ' + e.to + '[' + e.toId + '] (missing ' + e.expectedField + ' on target)');
          break;
        case 'intra-no-reciprocal':
          console.log('I-ERR ' + e.file + '[' + e.fromId + '] -> [' + e.toId + '] (missing ' + e.expectedField + ' on target)');
          break;
        default:
          console.log(e.kind + ' ' + JSON.stringify(e));
      }
    }
    for (const w of result.warnings) {
      switch (w.kind) {
        case 'duplicate-ids':
          console.log('WARN duplicate-ids in ' + w.file + ': ' + w.dups.join(', '));
          break;
        case 'dangling-cross':
          console.log('WARN dangling ' + w.from + '[' + w.fromId + '] -> ' + w.to + '[' + w.toId + '] (target missing)');
          break;
        case 'dangling-intra':
          console.log('WARN dangling ' + w.file + '[' + w.fromId + '] -> [' + w.toId + '] (target missing)');
          break;
        default:
          console.log('WARN ' + JSON.stringify(w));
      }
    }
  }

  // Summary line (always shown unless --json)
  const totals = Object.keys(result.arrs).map(k => k + '=' + result.arrs[k].length).join(', ');
  const grandTotal = Object.values(result.arrs).reduce((s, a) => s + a.length, 0);
  console.log('');
  console.log('TOTALS: ' + totals + ' (' + grandTotal + ' entries)');
  console.log('Errors: ' + totalErrors + ' | Warnings: ' + totalWarnings);
  console.log(totalErrors === 0 ? 'AUDIT PASS' : 'AUDIT FAIL');

  // Top-N most-cross-referenced if requested
  if (mode.top > 0) {
    console.log('');
    console.log('Top ' + mode.top + ' most-cross-referenced entries by file:');
    for (const key of Object.keys(result.arrs)) {
      const lf = key + '_links';
      const sorted = result.arrs[key]
        .map(e => ({ id: e.id, count: (e[lf] || []).length }))
        .filter(x => x.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, mode.top);
      console.log('  ' + key + ':');
      for (const e of sorted) console.log('    ' + e.id.padEnd(45) + e.count);
    }
  }

  process.exit(totalErrors === 0 ? 0 : 1);
}

// ------------------------------------------------------------------
// Main
// ------------------------------------------------------------------
emit(audit());
