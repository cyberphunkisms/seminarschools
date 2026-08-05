#!/usr/bin/env node
'use strict';

/**
 * User-directed ML* correction, 2026-08-04.
 *
 * Keep the Mearsheimer test's power-reproduction condition, but remove the
 * material-only narrowing that let a phrase classifier drift into a general
 * importance or attention-allocation rule. Independent authored surfaces are
 * corrected here; generated ML*, dataset, search, and public mirrors are
 * rebuilt by the normal project generators.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FILES = [
  'polymyth/methodologylist/index.html',
  'polymyth/modulecanon/index.html',
  'polymyth/devilsdiary/3/index.html',
  'polymyth/devilsdiary/6/index.html',
  'polymyth/devilsdiary/7/index.html',
];

const BANNED = [
  /material[- ](?:power|dominance|reproduction)/gi,
  /power(?:\\u2019|\\'|['’])s material dominance/gi,
  /some power(?:\\u2019|\\'|['’])s material dominance/gi,
  /power(?:\\u2019|\\'|['’])s material reproduction/gi,
  /material dominance arrangements/gi,
  /reproduction of material dominance/gi,
  /power(?:\\u2019|\\'|['’])s-material-dominance/gi,
  /power-formation(?:\\u2019|\\'|['’])s material dominance/gi,
  /military-industrial material dominance/gi,
  /geopolitical alliance(?:\\u2019|\\'|['’])s material dominance/gi,
];

function replaceRequired(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (!count && source.includes(after)) return {source, count: 0};
  if (!count) throw new Error(`Missing expected text for ${label}`);
  return {source: source.split(before).join(after), count};
}

function replaceOptional(source, before, after) {
  const count = source.split(before).length - 1;
  return {source: count ? source.split(before).join(after) : source, count};
}

const replacements = [
  ['some power’s material dominance', 'a specific power-formation'],
  ["some power's material dominance", 'a specific power-formation'],
  ["some power\\'s material dominance", 'a specific power-formation'],
  ["some power\\\\'s material dominance", 'a specific power-formation'],
  ['power\\u2019s material dominance', 'a specific power-formation'],
  ["power\\'s material dominance", 'a specific power-formation'],
  ["power\\\\'s material dominance", 'a specific power-formation'],
  ['power’s material dominance', 'a specific power-formation'],
  ["power's material dominance", 'a specific power-formation'],
  ['power’s material reproduction', 'a specific power-formation’s reproduction'],
  ["power's material reproduction", "a specific power-formation's reproduction"],
  ["power\\'s material reproduction", "a specific power-formation's reproduction"],
  ["service-to-power's-material-dominance", 'service-to-a-specific-power-formation'],
  ["power-formation's material dominance", 'power-formation'],
  ['power-formation’s material dominance', 'power-formation'],
  ['military-industrial material dominance', 'the military-industrial power-formation'],
  ["a specific geopolitical alliance's material dominance", 'a specific geopolitical alliance as a power-formation'],
  ['reproduction of material dominance', 'reproduction of a specific power-formation'],
];

let totalChanges = 0;
for (const relative of FILES) {
  const target = path.join(ROOT, relative);
  let source = fs.readFileSync(target, 'utf8');
  const before = source;

  for (const [oldText, newText] of replacements) {
    const result = replaceOptional(source, oldText, newText);
    source = result.source;
    totalChanges += result.count;
  }

  source = source.replace(
    'the phrase’s circulation reinforces the material dominance arrangements it lives inside; its repetition is functional for those arrangements.',
    'the phrase’s circulation helps reproduce the specific power-formation it lives inside; its repetition is functional for that formation.',
  );

  if (relative === 'polymyth/methodologylist/index.html') {
    let result = replaceRequired(
      source,
      'Cross-references expanded.",\n  "x": "Hivemindidiom (gorgonification section, what this test identifies);',
      'Cross-references expanded.\\n\\nSCOPE GUARD. This is a phrase-classification test, not a master importance measure and not a rule for deciding which gorgonifications deserve attention. Material effects may be traced inside a particular gorgonification spiral as one possible substrate, output, or reinforcement; they are neither required nor sufficient for classification. Attention triage belongs to sequential engagement and the Sabachtan killswitch: first test whether a position follows its own logic; if no internal logic is available, external engagement cannot begin and the position may be let go.\\n\\nCORRECTION PROVENANCE. August 4 2026. User-directed scope correction. Condition A remains a power-reproduction test but no longer turns one material expression into the universal form of power. The two-condition test remains intact. The classifier/attention boundary and internal-logic routing are explicit so the narrower wording cannot regain jurisdiction through a mirror or paraphrase.",\n  "x": "Hivemindidiom (gorgonification section, what this test identifies);',
      'Mearsheimer scope guard insertion',
    );
    source = result.source;
    totalChanges += result.count;

    result = replaceRequired(
      source,
      '"tg": "core, scanner, test, two-condition, hivemindidiom-identification, mearsheimer, overhauled-2026-05-20, dual-audience-schema"',
      '"tg": "core, scanner, test, two-condition, hivemindidiom-identification, mearsheimer, overhauled-2026-05-20, corrected-2026-08-04, anti-material-reduction, classifier-scope-guard, dual-audience-schema"',
      'Mearsheimer correction tags',
    );
    source = result.source;
    totalChanges += result.count;

    result = replaceRequired(
      source,
      'Verbatim mirror of core* memory slot 4 preserved in ml* CORE+ so any AI loading ml* without access to the originating AI\'s memory can read the complete CORE state from ml* alone.',
      'Current corrected mirror of core* slot 4 preserved in ml* CORE+ so any AI loading ml* can read the complete current rule from ml* alone. When an older memory mirror conflicts, this ML* entry wins.',
      'CORE slot 4 authority correction',
    );
    source = result.source;
    totalChanges += result.count;

    result = replaceRequired(
      source,
      'Both required. Single-condition formulations superseded.\\n\\nThis entry is the automatic sync mirror. Updates to core* slot 4 should trigger updates to this entry per * FILES sync rule.',
      'Both required. Single-condition formulations superseded.\\n\\nCURRENT SCOPE OVERRIDE (August 4 2026, user-directed). Condition (a) concerns reproduction of a specific power-formation. Material effects may appear inside a case’s gorgonification spiral but are never the required or exclusive power criterion. Slot 4 classifies phrases only; it does not rank what deserves attention. Attention triage routes to sequential engagement and the Sabachtan internal-logic killswitch. This wording supersedes older material-only mirrors.\\n\\nThis entry is the automatic sync mirror. Updates to core* slot 4 should trigger updates to this entry per * FILES sync rule and must not restore the superseded narrowing.',
      'CORE slot 4 scope override',
    );
    source = result.source;
    totalChanges += result.count;

    result = replaceRequired(
      source,
      '"tg": "core-plus, mirror, core-slot-4, overhauled-2026-05-20, dual-audience-schema"',
      '"tg": "core-plus, mirror, core-slot-4, overhauled-2026-05-20, corrected-2026-08-04, classifier-scope-guard, internal-logic-routing, dual-audience-schema"',
      'CORE slot 4 correction tags',
    );
    source = result.source;
    totalChanges += result.count;
  }

  for (const pattern of BANNED) {
    pattern.lastIndex = 0;
    const match = pattern.exec(source);
    if (match) {
      throw new Error(`${relative} still contains banned active wording: ${match[0]}`);
    }
  }

  if (source !== before) {
    fs.writeFileSync(target, source, 'utf8');
    console.log(`updated ${relative}`);
  } else {
    console.log(`unchanged ${relative}`);
  }
}

const correctedSource = fs.readFileSync(
  path.join(ROOT, 'polymyth/methodologylist/index.html'),
  'utf8',
);
if (totalChanges < 20 && !correctedSource.includes('CORRECTION PROVENANCE. August 4 2026. User-directed scope correction.')) {
  throw new Error(`Expected at least 20 replacements, got ${totalChanges}`);
}

console.log(`ML* POWER SCOPE CORRECTION APPLIED — ${totalChanges} replacements`);
