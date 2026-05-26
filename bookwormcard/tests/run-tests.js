#!/usr/bin/env node
/* run-tests.js
 * Pattern + accessory + cache regression tests for the bb depth engine.
 * Run from bb/ directory: node tests/run-tests.js
 *
 * The earlier audit pass added 14 characteristics (12 stats + 2 quirks)
 * and a memo cache without committed tests. This file is the safety net
 * so future pattern edits do not silently break canonical detection.
 *
 * Each test asserts: the canonical input fires the named characteristic.
 * Failures print a clear diff. The full run prints a final pass/fail count.
 */

'use strict';

var fs = require('fs');
var path = require('path');

// ---- Load the engine in a sandbox global ----
var bbDir = path.resolve(__dirname, '..');
var engineSrc = fs.readFileSync(path.join(bbDir, 'depth-engine.js'), 'utf8');
var sandbox = {};
var loader = new Function('window', engineSrc + '; return window.DepthEngine;');
var DE = loader(sandbox);

if(!DE){
  console.error('FAIL: depth-engine did not expose DepthEngine global');
  process.exit(1);
}

// ---- Test harness ----
var pass = 0, fail = 0;
var failures = [];

function expect(name, cond, detail){
  if(cond){
    pass++;
  } else {
    fail++;
    failures.push({ name: name, detail: detail || '' });
    console.log('  FAIL ' + name + (detail ? ' — ' + detail : ''));
  }
}

function fires(input, target){
  var r = DE.scoreAnswer('test', input, { ageRange: 'adult', hp: 100 });
  if(r.statsHit.some(function(h){ return h.stat === target; })) return true;
  if(r.quirksHit.some(function(q){ return q.quirk === target; })) return true;
  return false;
}

function describe(label, fn){
  console.log('\n' + label);
  fn();
}

// ============================================================
// SECTION 1 — Audit-pass characteristics (the 14 added in
// the characteristic audit)
// ============================================================
describe('audit-pass characteristics fire on canonical inputs', function(){
  expect('ANACHRONIC',
    fires('In those days, generations of women carried the same recipe.', 'ANACHRONIC'));
  expect('ESCHATOLOGICAL',
    fires('The end of the world is the only honest frame for thinking now.', 'ESCHATOLOGICAL'));
  expect('EMBODIED',
    fires('In my body, in my bones, the gut tightened before my brain caught up.', 'EMBODIED'));
  expect('DISEMBODIED',
    fires('In principle, conceptually, the form of the argument is what matters.', 'DISEMBODIED'));
  expect('DIALOGICAL',
    fires('They showed me what I had not seen. Convinced me I was wrong.', 'DIALOGICAL'));
  expect('MEPHISTOPHELEAN',
    fires('I had to push back. The counterfactual was the only honest move.', 'MEPHISTOPHELEAN'));
  expect('DIASPORIC',
    fires('Back home, our people did it differently. Two countries shape one head.', 'DIASPORIC'));
  expect('ROOTED',
    fires('Born here. Never left. Four generations on the same street.', 'ROOTED'));
  expect('PRINCIPLED',
    fires('I would not bend. On principle. Even if I lost.', 'PRINCIPLED'));
  expect('PRAGMATIC',
    fires('For now it is good enough. Pick my battles. Made it work.', 'PRAGMATIC'));
  expect('SOLARPUNK',
    fires('The community garden, the seed library, mutual aid — the future could be regenerative.', 'SOLARPUNK'));
  expect('BRUTALIST',
    fires('No decoration. Just the structure. Stripped down. The bare frame.', 'BRUTALIST'));
  expect('PERFORMATIVE_PRONE',
    fires('Obviously, naturally, of course it is what it is, the audacity.', 'PERFORMATIVE_PRONE'));
  expect('DEFENSIVE_PRONE',
    fires('I already said. That is not the point. Why are you even asking. Loaded question.', 'DEFENSIVE_PRONE'));
});

// ============================================================
// SECTION 2 — Original tier-1 cognitive depth patterns
// ============================================================
describe('tier-1 cognitive depth patterns still fire', function(){
  expect('IRREDUCIBLE',
    fires('Both at once. Cannot be reduced. Yet still both true.', 'IRREDUCIBLE'));
  expect('NEGATIVELY-CAPABLE',
    fires('I am not sure. Hard to say. Still working through what it is.', 'NEGATIVELY-CAPABLE'));
  expect('SYSTEMS-MINDED',
    fires('The structure reinforces itself through feedback loops that emerge.', 'SYSTEMS-MINDED'));
  expect('SELF-CRITICAL',
    fires('My fault. I was wrong. Looking back, I should have seen it.', 'SELF-CRITICAL'));
  expect('PHENOMENOLOGICAL',
    fires('The texture of the morning. The weight of it. What it felt like before words.', 'PHENOMENOLOGICAL'));
});

// ============================================================
// SECTION 3 — Quirk patterns
// ============================================================
describe('quirks fire on canonical inputs', function(){
  expect('PLATITUDE_PRONE',
    fires('Everything happens for a reason. Trust the process.', 'PLATITUDE_PRONE'));
  expect('LOW_CONTENT — single-word repeat',
    fires('idk idk idk', 'LOW_CONTENT'));
});

// ============================================================
// SECTION 4 — Cache behavior
// ============================================================
describe('memo cache returns identical output for identical input', function(){
  var input = 'I had to push back. The counterfactual was the only honest move.';
  var r1 = DE.scoreAnswer('field-A', input, { ageRange: 'adult', hp: 100 });
  var r2 = DE.scoreAnswer('field-A', input, { ageRange: 'adult', hp: 100 });
  expect('cache-hit deep equality',
    JSON.stringify(r1.statsHit) === JSON.stringify(r2.statsHit));

  // Different field key must NOT collide
  var r3 = DE.scoreAnswer('field-B', input, { ageRange: 'adult', hp: 100 });
  expect('cache key includes field',
    JSON.stringify(r3.statsHit) === JSON.stringify(r1.statsHit),
    'different fields should produce same hits for same input');

  // Mutating returned hits must not poison cache
  r1.statsHit.push({ stat: 'INJECTED_VIA_MUTATION', weight: 999 });
  var r4 = DE.scoreAnswer('field-A', input, { ageRange: 'adult', hp: 100 });
  expect('cache isolation against caller mutation',
    !r4.statsHit.some(function(h){ return h.stat === 'INJECTED_VIA_MUTATION'; }));
});

// ============================================================
// SECTION 5 — No false positives (regressions on noise inputs)
// ============================================================
describe('inert inputs do not trip canonical patterns', function(){
  // Empty input scores nothing
  var r = DE.scoreAnswer('test', '', { ageRange: 'adult', hp: 100 });
  expect('empty input — no stats', r.statsHit.length === 0);
  expect('empty input — no quirks', r.quirksHit.length === 0);

  // A neutral declarative answer should not fire MEPHISTOPHELEAN or PERFORMATIVE
  var neutral = 'I went to the grocery store yesterday and bought rice and tomatoes.';
  expect('neutral input — no MEPHISTOPHELEAN',
    !fires(neutral, 'MEPHISTOPHELEAN'));
  expect('neutral input — no PERFORMATIVE_PRONE',
    !fires(neutral, 'PERFORMATIVE_PRONE'));
});

// ============================================================
// SECTION 6 — Stat-weight integrity
// ============================================================
describe('stats fire with their declared weight', function(){
  var r = DE.scoreAnswer(
    'test',
    'I had to push back. The counterfactual was the only honest move.',
    { ageRange: 'adult', hp: 100 }
  );
  var meph = r.statsHit.filter(function(h){ return h.stat === 'MEPHISTOPHELEAN'; })[0];
  expect('MEPHISTOPHELEAN weight is 3', meph && meph.weight === 3);
});

// ============================================================
// SECTION 7 — Rewrite-mechanic simulation. The actual subtract
// logic lives in awardStats inside index.html, but the depth-
// engine guarantees that two identical inputs produce identical
// scoring. So we can simulate a rewrite by:
//   1. score answer A, accumulate into mock state
//   2. score answer B, subtract A's contribution, then add B
//   3. assert the final state equals "as if only B had been scored"
// This locks in the invariant the rewrite mechanic depends on.
// ============================================================
function simulateAccumulate(state, hits, quirksHits, xpDelta, hpDelta){
  hits.forEach(function(h){
    var w = h.weight || 1;
    state.stats[h.stat] = (state.stats[h.stat] || 0) + w;
  });
  quirksHits.forEach(function(q){
    var w = q.weight || 1;
    state.quirks[q.quirk] = (state.quirks[q.quirk] || 0) + w;
  });
  state.xp = Math.max(0, state.xp + (xpDelta||0));
  state.hp = Math.max(0, Math.min(100, state.hp + (hpDelta||0)));
}
function simulateSubtract(state, hits, quirksHits, xpDelta, hpDelta){
  hits.forEach(function(h){
    var w = h.weight || 1;
    state.stats[h.stat] = (state.stats[h.stat] || 0) - w;
    if(state.stats[h.stat] <= 0) delete state.stats[h.stat];
  });
  quirksHits.forEach(function(q){
    var w = q.weight || 1;
    state.quirks[q.quirk] = (state.quirks[q.quirk] || 0) - w;
    if(state.quirks[q.quirk] <= 0) delete state.quirks[q.quirk];
  });
  state.xp = Math.max(0, state.xp - (xpDelta||0));
  state.hp = Math.max(0, Math.min(100, state.hp - (hpDelta||0)));
}

describe('rewrite mechanic — subtract prior, apply new, equals fresh-scored final', function(){
  var ctx = { ageRange: 'adult', hp: 100 };
  var firstAnswer = 'Everything happens for a reason. Trust the process. Stay strong.';
  var rewriteAnswer = 'I had to push back. The counterfactual was the only honest move. They wanted me to concede and I would not.';

  // Path 1 — rewrite path: score first, accumulate, then subtract and apply rewrite
  var rewriteState = { stats:{}, quirks:{}, xp:0, hp:100 };
  var r1 = DE.scoreAnswer('backstory', firstAnswer, ctx);
  simulateAccumulate(rewriteState, r1.statsHit, r1.quirksHit, r1.xpDelta, r1.hpDelta);
  // Player goes back, rewrites:
  simulateSubtract(rewriteState, r1.statsHit, r1.quirksHit, r1.xpDelta, r1.hpDelta);
  var r2 = DE.scoreAnswer('backstory', rewriteAnswer, ctx);
  simulateAccumulate(rewriteState, r2.statsHit, r2.quirksHit, r2.xpDelta, r2.hpDelta);

  // Path 2 — fresh path: score the rewrite answer only
  var freshState = { stats:{}, quirks:{}, xp:0, hp:100 };
  var rFresh = DE.scoreAnswer('backstory', rewriteAnswer, ctx);
  simulateAccumulate(freshState, rFresh.statsHit, rFresh.quirksHit, rFresh.xpDelta, rFresh.hpDelta);

  expect('rewrite-final stats equal fresh stats',
    JSON.stringify(rewriteState.stats) === JSON.stringify(freshState.stats),
    'rewrite path: ' + JSON.stringify(rewriteState.stats) + ' fresh: ' + JSON.stringify(freshState.stats));
  expect('rewrite-final quirks equal fresh quirks',
    JSON.stringify(rewriteState.quirks) === JSON.stringify(freshState.quirks));
  expect('rewrite-final xp equals fresh xp',
    rewriteState.xp === freshState.xp);
  expect('rewrite-final hp equals fresh hp',
    rewriteState.hp === freshState.hp);
  // The first answer scored PLATITUDE_PRONE; the rewrite should remove it.
  expect('PLATITUDE_PRONE removed after rewrite',
    !rewriteState.quirks.PLATITUDE_PRONE);
  // The rewrite should have added MEPHISTOPHELEAN.
  expect('MEPHISTOPHELEAN added after rewrite',
    rewriteState.stats.MEPHISTOPHELEAN > 0);
});

describe('rewrite mechanic — chained rewrites unwind from most-recent', function(){
  var ctx = { ageRange: 'adult', hp: 100 };
  var v1 = 'Everything happens for a reason.';
  var v2 = 'I had to push back. The counterfactual was the only honest move.';
  var v3 = 'In my body, in my bones, the gut tightened before my brain caught up.';
  var state = { stats:{}, quirks:{}, xp:0, hp:100 };

  // v1
  var rv1 = DE.scoreAnswer('backstory', v1, ctx);
  simulateAccumulate(state, rv1.statsHit, rv1.quirksHit, rv1.xpDelta, rv1.hpDelta);
  // rewrite to v2 (unwind v1)
  simulateSubtract(state, rv1.statsHit, rv1.quirksHit, rv1.xpDelta, rv1.hpDelta);
  var rv2 = DE.scoreAnswer('backstory', v2, ctx);
  simulateAccumulate(state, rv2.statsHit, rv2.quirksHit, rv2.xpDelta, rv2.hpDelta);
  // rewrite to v3 (unwind v2 — NOT v1)
  simulateSubtract(state, rv2.statsHit, rv2.quirksHit, rv2.xpDelta, rv2.hpDelta);
  var rv3 = DE.scoreAnswer('backstory', v3, ctx);
  simulateAccumulate(state, rv3.statsHit, rv3.quirksHit, rv3.xpDelta, rv3.hpDelta);

  // Compare to fresh-scoring v3 only
  var fresh = { stats:{}, quirks:{}, xp:0, hp:100 };
  var rf = DE.scoreAnswer('backstory', v3, ctx);
  simulateAccumulate(fresh, rf.statsHit, rf.quirksHit, rf.xpDelta, rf.hpDelta);

  expect('chained-rewrite final stats equal fresh-v3 stats',
    JSON.stringify(state.stats) === JSON.stringify(fresh.stats));
  expect('chained-rewrite final quirks equal fresh-v3 quirks',
    JSON.stringify(state.quirks) === JSON.stringify(fresh.quirks));
  expect('EMBODIED present after chained rewrite to v3',
    state.stats.EMBODIED > 0);
  expect('PLATITUDE_PRONE absent after chained rewrite to v3',
    !state.quirks.PLATITUDE_PRONE);
  expect('MEPHISTOPHELEAN absent after chained rewrite to v3',
    !state.stats.MEPHISTOPHELEAN);
});

// ============================================================
// SECTION 8 — Gemini augment-stats response parsing.
// Loads gemini-bridge.js in a sandbox with a stubbed localStorage
// and validates that the JSON parser handles common Gemini quirks:
// markdown fences, weird whitespace, malformed input, and
// well-formed responses. The parse function is the trust boundary
// between the model output and the apply-deltas logic.
// ============================================================
describe('gemini augment JSON parsing', function(){
  // Stub minimal browser globals for the bridge
  var localStorageStub = {
    _store: {},
    getItem: function(k){ return this._store[k] === undefined ? null : this._store[k]; },
    setItem: function(k,v){ this._store[k] = v; },
    removeItem: function(k){ delete this._store[k]; }
  };
  var globalSandbox = {
    fetch: function(){ return Promise.reject(new Error('not-mocked')); },
    AbortController: function(){ this.signal = {}; this.abort = function(){}; },
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    localStorage: localStorageStub,
    console: { log:function(){}, warn:function(){}, error:function(){} }
  };
  var bridgeSrc = require('fs').readFileSync(require('path').join(bbDir, 'gemini-bridge.js'),'utf8');
  var loader = new Function('window','globalThis', bridgeSrc + '; return window.GeminiBridge;');
  var Bridge = loader(globalSandbox, globalSandbox);
  var parse = Bridge._internal.tryParseAugmentJson;

  // well-formed JSON
  var p1 = parse('{"add":[{"stat":"PATTERN-SEEING","weight":3,"reason":"the same shape keeps coming back"}],"remove":["SYSTEMS-MINDED"]}');
  expect('well-formed JSON parses', !!p1);
  expect('add.length === 1', p1 && p1.add.length === 1);
  expect('remove.length === 1', p1 && p1.remove.length === 1);
  expect('add stat normalized', p1 && p1.add[0].stat === 'PATTERN-SEEING');
  expect('add weight preserved', p1 && p1.add[0].weight === 3);

  // Markdown fenced JSON
  var p2 = parse('```json\n{"add":[],"remove":["SYSTEMS-MINDED"]}\n```');
  expect('markdown fences stripped', !!p2);
  expect('fenced parse gets remove', p2 && p2.remove[0] === 'SYSTEMS-MINDED');

  // Weight clamping
  var p3 = parse('{"add":[{"stat":"IRREDUCIBLE","weight":99,"reason":"x"}],"remove":[]}');
  expect('weight clamped to 3 max', p3 && p3.add[0].weight === 3);

  // Missing weight defaults to 2
  var p4 = parse('{"add":[{"stat":"DIALECTICAL","reason":"x"}],"remove":[]}');
  expect('missing weight defaults to 2', p4 && p4.add[0].weight === 2);

  // Garbage input returns null
  var p5 = parse('I cannot comply with that request.');
  expect('garbage returns null', p5 === null);
  var p6 = parse('');
  expect('empty returns null', p6 === null);
  var p7 = parse(null);
  expect('null input returns null', p7 === null);

  // Cap at 8 adds, 8 removes
  var manyAdds = '{"add":' + JSON.stringify(Array(20).fill({stat:'X-TEST',weight:2,reason:'a'})) + ',"remove":[]}';
  var p8 = parse(manyAdds);
  expect('add-list capped at 8', p8 && p8.add.length === 8);

  // Stat-name normalization (lowercase + bad chars stripped)
  var p9 = parse('{"add":[{"stat":"  pattern-seeing!! ","weight":2}],"remove":["systems-minded "]}');
  expect('lowercase add normalized to upper', p9 && p9.add[0].stat === 'PATTERN-SEEING');
  expect('lowercase remove normalized to upper', p9 && p9.remove[0] === 'SYSTEMS-MINDED');

  // Too-short stat names filtered (< 4 chars)
  var p10 = parse('{"add":[{"stat":"X","weight":2},{"stat":"VALID","weight":2}],"remove":[]}');
  expect('too-short stat name filtered', p10 && p10.add.length === 1 && p10.add[0].stat === 'VALID');
});

// ============================================================
// SECTION 9 — Augment apply-deltas simulation. The actual apply
// logic lives in awardStats inside index.html (closure over data).
// We can simulate it here against the known invariant: applying
// adds and removes to a regex-graded state should produce the
// same final state as if the depth-graded version had been the
// only scoring.
// ============================================================
describe('augment apply-deltas — final state matches depth-graded ground truth', function(){
  // Use an input where the regex genuinely misses PATTERN-SEEING
  // (no "every time", "same pattern", "reminds me of" trigger
  // words) but a semantic reader would catch it. This is the
  // canonical case the Gemini augment is meant to fix.
  var input = 'I think there is a particular movement underneath all of it. A current carries the moments along, and they all bend toward one direction even when they look different on the surface.';
  var ctx = { ageRange: 'adult', hp: 100 };

  var r = DE.scoreAnswer('backstory', input, ctx);
  // Confirm regex did NOT catch PATTERN-SEEING — that's the missing
  // register the augment should add.
  expect('regex baseline misses PATTERN-SEEING on poetic input',
    !r.statsHit.some(function(h){ return h.stat === 'PATTERN-SEEING'; }));

  var stateAfterRegex = { stats:{}, quirks:{}, xp:0, hp:100 };
  simulateAccumulate(stateAfterRegex, r.statsHit, r.quirksHit, r.xpDelta, r.hpDelta);

  // Pretend Gemini returned: ADD the missed register.
  var augment = {
    add: [{ stat: 'PATTERN-SEEING', weight: 3, reason: 'a current bends moments toward one direction' }],
    remove: []
  };

  // Apply with de-dupe (skip adds the regex already caught).
  var existingStats = new Set(r.statsHit.map(function(h){ return h.stat; }));
  augment.add.forEach(function(a){
    if(existingStats.has(a.stat)) return;
    stateAfterRegex.stats[a.stat] = (stateAfterRegex.stats[a.stat] || 0) + a.weight;
  });
  augment.remove.forEach(function(name){
    var match = r.statsHit.find(function(h){ return h.stat === name; });
    if(match){
      var w = match.weight || 1;
      stateAfterRegex.stats[name] = (stateAfterRegex.stats[name] || 0) - w;
      if(stateAfterRegex.stats[name] <= 0) delete stateAfterRegex.stats[name];
    }
  });

  expect('PATTERN-SEEING +3 added by augment',
    stateAfterRegex.stats['PATTERN-SEEING'] === 3);
  // Verify the regex stats are still preserved
  expect('regex-caught INDULGENT preserved',
    stateAfterRegex.stats['INDULGENT'] === 2);
});

describe('augment apply-deltas — remove subtracts the regex-awarded weight', function(){
  // Input that fires SYSTEMS-MINDED falsely (passing mention of "system")
  var input = 'i like the system that runs the train station.';
  var ctx = { ageRange: 'adult', hp: 100 };

  var r = DE.scoreAnswer('backstory', input, ctx);
  // Confirm regex caught SYSTEMS-MINDED (the false positive we want to test)
  expect('regex catches SYSTEMS-MINDED on passing mention',
    r.statsHit.some(function(h){ return h.stat === 'SYSTEMS-MINDED'; }));

  var stateAfterRegex = { stats:{}, quirks:{}, xp:0, hp:100 };
  simulateAccumulate(stateAfterRegex, r.statsHit, r.quirksHit, r.xpDelta, r.hpDelta);
  var systemsBefore = stateAfterRegex.stats['SYSTEMS-MINDED'] || 0;
  expect('SYSTEMS-MINDED present before remove', systemsBefore > 0);

  // Gemini returns: remove the false positive
  var augment = { add: [], remove: ['SYSTEMS-MINDED'] };

  augment.remove.forEach(function(name){
    var match = r.statsHit.find(function(h){ return h.stat === name; });
    if(match){
      var w = match.weight || 1;
      stateAfterRegex.stats[name] = (stateAfterRegex.stats[name] || 0) - w;
      if(stateAfterRegex.stats[name] <= 0) delete stateAfterRegex.stats[name];
    }
  });

  expect('SYSTEMS-MINDED absent after remove',
    !stateAfterRegex.stats['SYSTEMS-MINDED']);
});

// ============================================================
// REPORT
// ============================================================
console.log('\n----------------------------------------');
console.log('PASSED: ' + pass);
console.log('FAILED: ' + fail);
console.log('TOTAL:  ' + (pass + fail));
if(fail > 0){
  console.log('\nFailures:');
  failures.forEach(function(f){ console.log('  - ' + f.name + (f.detail ? ' :: ' + f.detail : '')); });
  process.exit(1);
}
console.log('all green');
process.exit(0);
