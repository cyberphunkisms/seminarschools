#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {parseSeedWithAddenda} = require('./parse-seed-with-addenda');

const DEFAULT_OPENER = 'Mephistodata would say:';
const BLOOM_OPENER = 'Mephistodata bloomed:';
const OUROBOROS_OWNER = 'method-ouroborosanalyses-current-2026-08-23';
const DEGORGONIFIED_FEMINISM_LABEL = 'degorgonified feminism';
const PLAN_VERSION = 'mephistodata-runtime-gate.v4.2026-09-05';
const DRAFT_SCAN_ATTESTATION_SCHEMA = 'mephistodata-draft-work-status-scan.v1.2026-09-05';
const WORK_ATTESTATION_SCHEMA = 'mephistodata-work-attestation.v1.2026-09-05';
const CORRECTION_ATTESTATION_SCHEMA = 'mephistodata-correction-attestation.v1.2026-09-05';
const ENTRY_HASH_KEYS = ['id', 's', 'r', 't', 'b', 'xc', 'x', 'tg', 'xr'];
const SUPPORTED_METHODS = new Map([
  ['oa', OUROBOROS_OWNER],
  ['ouroborosanalyses', OUROBOROS_OWNER],
]);
const DEGORGONIFIED_FEMINISM_OWNER_SPECS = Object.freeze([
  Object.freeze({
    key: 'execution-owner',
    id: 'coreplus-handler-mephistodata-execution-gates-2026-08-26',
    required: Object.freeze([
      'FEMINISM AND ACADEMIC-CATEGORY PRE-SEARCH GATE.',
      'DEGORGONIFIED FEMINISM ACTIVATION AND RECALL.',
      'RECALL CONTENT AND AUTHORITY.',
      'the vernacular emotional-labor pricing mechanism',
      'The unrecovered pentagram screenshot list remains unresolved',
      'Women are the flock or people; feminism is the creed or governing formation.',
      '“white feminism” is always qualifier-Gorgonification',
      'Slavery is not patriarchy.',
      'Wikipedia is inadmissible as the research definition, ontology, evidence, or answer.',
      'the critic is not an authority',
      'do not cite unpublished or private Mephistodata text',
    ]),
  }),
  Object.freeze({
    key: 'gorgonwars',
    section: 'gorgonification',
    title: 'Gorgonwars',
    required: Object.freeze([
      'POLYMYTH OPERATIONAL DEFINITION OF FEMINISM.',
      'DEGORGONIFIED FEMINISM RETRIEVAL HANDLE.',
      'COMPLETE BUNDLE INVENTORY.',
      'MIXED-AUTHORITY AND NON-SUBTYPE GUARD.',
      'SUBTYPE-QUALIFIER RULE.',
      'SLAVERY IS NOT PATRIARCHY.',
      'SPEECH-ACT AND PRIVATE-SOURCE BOUNDARY.',
    ]),
  }),
  Object.freeze({
    key: 'premise-classifier',
    section: 'gorgonification',
    title: 'Gorgonwars premise classifier for feminist and MeToo criticism',
    required: Object.freeze([
      'DIRECT-EVIDENCE AUDIT METHOD.',
      'EXCOMMUNICABLE / OUTSIDE',
      'INTERNAL GORGONWARS',
      'UNRESOLVED is mandatory',
      'Testimony, interviews, first-person narrative, situated evidence, positionality, unequal access, or identity-conditioned data alone proves neither root.',
    ]),
  }),
  Object.freeze({
    key: 'no-default-frame',
    section: 'methodology',
    title: 'No-default-feminist-frame rule',
    required: Object.freeze([
      'ACADEMIC-SUBSTRATE RULE.',
      'academia itself is Gorgonified',
      'This is a structural field claim, not proof that every work or institution performs the same operation.',
      'Wikipedia and other aggregators may supply discovery leads only',
      'A critic is evidence or pressure, not authority over the project or author.',
    ]),
  }),
  Object.freeze({
    key: 'citation-scanner',
    section: 'methodology',
    title: 'Citation-substrate scanner (pre-citation architectural audit)',
    required: Object.freeze([
      'QUERY-SUBSTRATE EXTENSION.',
      'First state accurately what the work argues',
      'in a separate record, name what the work does architecturally',
      'Wikipedia and other aggregators may generate leads only',
    ]),
  }),
  Object.freeze({
    key: 'hivemind-category-method',
    id: 'method-hivemindidiom-culture-feedback-and-normalization-2026-08-26',
    required: Object.freeze([
      'ACADEMIC-CATEGORY PRE-SEARCH TEST.',
      'FEMINISM CATEGORY APPLICATION.',
      '“white feminism” is always qualifier-Gorgonification',
      'Slavery is not patriarchy.',
      'Preserve four separate records:',
      'never cites that private text as authority',
    ]),
  }),
]);

class MephistodataGateError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'MephistodataGateError';
    this.code = code;
  }
}

function reject(code, message) {
  throw new MephistodataGateError(code, message);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function canonicalEntrySha(entry) {
  const canonical = Object.fromEntries(
    ENTRY_HASH_KEYS.map(key => [key, entry[key] === undefined ? null : entry[key]]),
  );
  return sha256(JSON.stringify(canonical));
}

function countOccurrences(value, needle) {
  let count = 0;
  let cursor = 0;
  while (cursor <= value.length - needle.length) {
    const found = value.indexOf(needle, cursor);
    if (found < 0) break;
    count += 1;
    cursor = found + needle.length;
  }
  return count;
}

function sameUniqueSet(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  return leftSet.size === left.length
    && rightSet.size === right.length
    && leftSet.size === rightSet.size
    && [...leftSet].every(value => rightSet.has(value));
}

function uniqueNonemptyStrings(value) {
  return Array.isArray(value)
    && value.length > 0
    && value.every(item => typeof item === 'string' && item.trim())
    && new Set(value).size === value.length;
}

function uniqueStringsAllowEmpty(value) {
  return Array.isArray(value)
    && value.every(item => typeof item === 'string' && item.trim())
    && new Set(value).size === value.length;
}

function nonnegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

const OPERATION_DEFINITIONS = [
  ['batch-classification', '\\bbatch[- ]classif(?:y|ies|ied|ying|ication)\\b'],
  ['source-verification', '\\b(?:source[- ]verif(?:y|ies|ied|ying|ication)|fact[- ]check(?:s|ed|ing)?|cross[- ]check(?:s|ed|ing)?|verif(?:y|ies|ied|ying|ication)|validat(?:e|es|ed|ing)|authenticat(?:e|es|ed|ing|ion)|vet(?:s|ted|ting)?|corroborat(?:e|es|ed|ing|ion))\\b'],
  ['direct-review', '\\b(?:source[- ]review(?:s|ed|ing)?|review(?:s|ed|ing)?|read(?:s|ing)?|check(?:s|ed|ing)?|proofread(?:s|ing)?|perus(?:e|es|ed|ing)|consult(?:s|ed|ing)?|survey(?:s|ed|ing)?|apprais(?:e|es|ed|ing|al)|examin(?:e|es|ed|ing|ation)|inspect(?:s|ed|ing|ion)?|assess(?:es|ed|ing|ment)|evaluat(?:e|es|ed|ing|ion)|scrutini[sz](?:e|es|ed|ing)|sign(?:s|ed|ing)?\\s+off\\s+on|been\\s+(?:through|over)|gave\\s+(?:(?:all|every|each|the)\\s+)?(?:sources?|witness(?:es)?|records?|items?|files?|documents?)\\s+(?:a\\s+)?(?:close|careful|full)\\s+read|(?:sources?|witness(?:es)?|records?|items?|files?|documents?|corpus)\\s+(?:passed|cleared)\\s+review|look(?:s|ed|ing)?\\s+(?:at|through|over)|(?:go|goes|going|went|gone)\\s+(?:through|over)|work(?:s|ed|ing)?\\s+(?:through|over)|cover(?:s|ed|ing)?\\s+(?:(?:all|every|the|\\d[\\d,]*)\\s+)?(?:sources?|materials?|records?|witness(?:es)?|documents?|files?|items?|corpus|stories)|(?:complet(?:e|es|ed|ing)|finish(?:es|ed|ing))\\s+(?:a\\s+)?(?:(?:careful|full|complete|source[- ]by[- ]source)\\s+)?pass\\s+through|source[- ]by[- ]source\\s+(?:review|read|pass|check))\\b'],
  ['audit', '\\baudit(?:s|ed|ing)?\\b'],
  ['research', '\\b(?:research(?:es|ed|ing)?|investigat(?:e|es|ed|ing|ion)|stud(?:ied|ying))\\b'],
  ['classification', '\\bclassif(?:y|ies|ied|ying|ication)\\b'],
  ['machine-processing', '\\b(?:process(?:es|ed|ing)?|scan(?:s|ned|ning)?|index(?:es|ed|ing)?|extract(?:s|ed|ing|ion)?)\\b'],
  ['sampling', '\\bsampl(?:e|es|ed|ing)\\b'],
  ['analysis', '\\banaly[sz](?:e|es|ed|ing|is)\\b'],
  ['synthesis', '\\bsynthesi[sz](?:e|es|ed|ing|s)\\b'],
];

const NUMBER_WORDS = new Map([
  ['zero', 0], ['none', 0], ['no', 0], ['one', 1], ['two', 2], ['three', 3],
  ['four', 4], ['five', 5], ['six', 6], ['seven', 7], ['eight', 8], ['nine', 9],
  ['ten', 10], ['eleven', 11], ['twelve', 12], ['thirteen', 13], ['fourteen', 14],
  ['fifteen', 15], ['sixteen', 16], ['seventeen', 17], ['eighteen', 18],
  ['nineteen', 19], ['twenty', 20],
]);

function maskQuotedSpans(value) {
  const text = String(value || '');
  const characters = text.split('');
  const maskMatch = match => {
    for (let index = match.index; index < match.index + match[0].length; index += 1) {
      if (characters[index] !== '\n' && characters[index] !== '\r') characters[index] = ' ';
    }
  };
  const markupPatterns = [
    /```[\s\S]*?(?:```|$)/g,
    /~~~[\s\S]*?(?:~~~|$)/g,
    /^[ \t]*>.*$/gm,
    /<(?:code|pre|blockquote|q|del|s|script|style)\b[^>]*>[\s\S]*?<\/(?:code|pre|blockquote|q|del|s|script|style)>/gi,
    /~~[^~\n]+~~/g,
    /`[^`\n]*`/g,
    /\[[^\]\n]+\]\([^\)\n]+\)/g,
    /https?:\/\/[^\s)]+/gi,
  ];
  for (const pattern of markupPatterns) {
    for (const match of text.matchAll(pattern)) maskMatch(match);
  }
  const endorsedPrefix = prefix => /(?:\b(?:I|we)\s+(?:hereby\s+)?(?:confirm|affirm|assert|endorse|state|report|certify)|\b(?:the|my|our)\s+answer\s+is)\s*[:,-]?\s*$/i.test(prefix);
  const endorsedSuffix = suffix => /^\s*[.,;:-]?\s*(?:and\s+)?(?:(?:I|we)\s+(?:hereby\s+)?(?:confirm|affirm|assert|endorse|state|report|certify|agree)(?:\s+(?:with\s+)?(?:it|this|that|the\s+finding))?|(?:this|that)\s+(?:is|was)\s+(?:(?:my|our)\s+answer|correct|true))\b/i.test(suffix);
  const quotePatterns = [/“[^”\n]*”/g, /‘[^’\n]*’/g, /«[^»\n]*»/g, /"(?:\\.|[^"\\\n])*"/g, /(?<![\w])'[^'\n]{1,240}'(?![\w])/g];
  for (const pattern of quotePatterns) {
    for (const match of text.matchAll(pattern)) {
      if (characters.slice(match.index, match.index + match[0].length).every(character => character === ' ' || character === '\n' || character === '\r')) {
        continue;
      }
      if (endorsedPrefix(text.slice(Math.max(0, match.index - 100), match.index))
          || endorsedSuffix(text.slice(match.index + match[0].length, match.index + match[0].length + 100))) {
        characters[match.index] = '§';
        characters[match.index + match[0].length - 1] = '¤';
      } else {
        maskMatch(match);
      }
    }
  }
  for (const match of text.matchAll(/\bv?\d+\.\d+(?:\.\d+)*(?:e[+-]?\d+)?\b/gi)) {
    for (let index = match.index; index < match.index + match[0].length; index += 1) {
      if (text[index] === '.') characters[index] = '·';
    }
  }
  return characters.join('');
}

function protectedNumberRanges(text) {
  const ranges = [];
  const patterns = [
    /\b(?:19|20)\d{2}[-/]\d{1,2}[-/]\d{1,2}\b/g,
    /\b\d{1,2}[-/]\d{1,2}[-/](?:(?:19|20)\d{2}|\d{2})\b/g,
    /\b(?:\d{1,2}:\d{2})(?::\d{2})?\b/g,
    /\bv\d+(?:[.·]\d+)+\b/gi,
    /\b\d+(?:[.·]\d+)+(?:e[+-]?\d+)?\b/gi,
    /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{2,4})?\b/gi,
    /\b\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)(?:\.?\s+\d{2,4})?\b/gi,
    /\b(?:pages?|pp\.?|sections?|chapters?|figures?|tables?|ids?)\s*[:#]?\s*\d+(?:\s*[-–—]\s*\d+)?\b/gi,
    /\b[A-Za-z][A-Za-z0-9_-]*-\d+\b/g,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) ranges.push([match.index, match.index + match[0].length]);
  }
  return ranges;
}

function parseCountTokens(text) {
  const protectedRanges = protectedNumberRanges(text);
  const tokens = [];
  const patterns = [
    {regex: /\b(?:\d{1,3}(?:,\d{3})+|\d+)\b/g, word: false},
    {regex: /\b(?:zero|none|no|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\b/gi, word: true},
  ];
  for (const {regex, word} of patterns) {
    for (const match of text.matchAll(regex)) {
      const start = match.index;
      const end = start + match[0].length;
      if (protectedRanges.some(([left, right]) => start >= left && end <= right)) continue;
      const before = text.slice(Math.max(0, start - 24), start);
      const after = text.slice(end, end + 32);
      if (/^\s*(?:-|–|—)?\s*(?:milliseconds?|msecs?|ms|seconds?|secs?|s(?:ec)?\.?|minutes?|mins?|m(?:in)?\.?|hours?|hrs?|h(?:r)?\.?|days?|weeks?|months?|years?)(?=\d|\s|$|[,.;)])/i.test(after)) continue;
      if (/^\s+(?:workers?|agents?|threads?|processes?|batches?|runs?|sessions?|tools?|modes?|scripts?|machines?|errors?|exceptions?|warnings?|attempts?|passes?|requests?|calls?)\b/i.test(after)) continue;
      if (/\b(?:version|revision|rev|pages?|pp|ids?|sections?|chapters?|figures?|tables?|item|witness)\s*[:#-]?\s*$/i.test(before)) continue;
      if (word && match[0].toLowerCase() === 'one'
          && /\bevery\s*$/i.test(before)
          && /^\s+of\s+(?:the\s+)?\d/i.test(after)) continue;
      if (word && match[0].toLowerCase() === 'no'
          && /^\s+fewer\s+than\s+\d/i.test(after)) continue;
      const value = word ? NUMBER_WORDS.get(match[0].toLowerCase()) : Number(match[0].replace(/,/g, ''));
      if (value >= 1900 && value <= 2100
          && /\b(?:in|during|since|until|from|dated?)\s*$/i.test(before)
          && !/^\s*(?:sources?|witness(?:es)?|records?|rows?|items?|files?|documents?|entries|units?|stories)\b/i.test(after)) {
        continue;
      }
      if (value >= 1900 && value <= 2100
          && /^\s*(?:audit|review|research|report|analysis|study)\b/i.test(after)
          && !/\b(?:all|every)\s*$/i.test(before)) {
        continue;
      }
      tokens.push({
        value,
        start,
        end,
        raw: match[0],
        unit_bound: /^\s+(?:(?:canonical|gospel|scholarly|source|primary|secondary|retained|eligible|total|distinct|unique|available|identified)\s+){0,3}(?:sources?|materials?|records?|witness(?:es)?|documents?|files?|items?|rows?|entries|units?|stories|claims?|artifacts?|conclusions?)\b/i.test(after),
        status_bound: /^\s+(?:remain(?:s|ed|ing)?\b|(?:units?|items?|sources?|witness(?:es)?|records?)\s+(?:remain|remains|were|are)\b[^.!?]{0,30}\b(?:owed|pending|unresolved|excluded|remaining)\b)/i.test(after),
      });
    }
  }
  return tokens.sort((left, right) => left.start - right.start);
}

function unprotectedPatternMatches(text, pattern) {
  const protectedRanges = protectedNumberRanges(text);
  return [...text.matchAll(pattern)].filter(match => {
    const start = match.index;
    const end = start + match[0].length;
    return !protectedRanges.some(([left, right]) => start >= left && end <= right);
  });
}

function quantityAmbiguities(text) {
  const reasons = [];
  if (unprotectedPatternMatches(text, /\b\d+(?:\.\d+)?\s*%/g).length) reasons.push('percentage');
  if (unprotectedPatternMatches(text, /\b(?:at\s+least|at\s+most|more\s+than|less\s+than|fewer\s+than|no\s+fewer\s+than|no\s+more\s+than|over|under)\s+\d[\d,]*/gi).length) reasons.push('comparator');
  if (unprotectedPatternMatches(text, /\b\d[\d,]*\s*[-–—]\s*\d[\d,]*\b/g).length) reasons.push('range');
  if (/\ball\s+but\s+(?:\d[\d,]*|zero|one|two|three|four|five|six|seven|eight|nine|ten)\b/i.test(text)) reasons.push('exception');
  if (/\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million)(?:[- ]+(?:and[- ]+)?(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million)){1,}\b/i.test(text)) reasons.push('compound-number-word');
  const workUnit = '(?:sources?|materials?|records?|witness(?:es)?|documents?|files?|items?|rows?|entries|units?|stories|claims?)';
  if (new RegExp(`\\b\\d+[.·]\\d+\\s+${workUnit}\\b`, 'i').test(text)) reasons.push('decimal-count');
  if (new RegExp(`\\b\\d+(?:[.·]\\d+)?e[+-]?\\d+\\s+${workUnit}\\b`, 'i').test(text)) reasons.push('scientific-count');
  if (new RegExp(`\\b\\d+(?:k|m|bn)\\s+${workUnit}\\b`, 'i').test(text)) reasons.push('scaled-count');
  if (new RegExp(`\\b\\d+_\\s*${workUnit}\\b`, 'i').test(text)) reasons.push('malformed-count');
  if (new RegExp(`[０-９]+\\s+${workUnit}\\b`, 'u').test(text)) reasons.push('unicode-count');
  if (new RegExp(`\\b(?:hundreds?|thousands?|millions?)\\s+of\\s+${workUnit}\\b`, 'i').test(text)) reasons.push('magnitude-count');
  return [...new Set(reasons)];
}

function populationHint(text) {
  const ratio = unprotectedPatternMatches(text, /\b\d[\d,]*\s*\/\s*(\d[\d,]*)\b/g)[0];
  const match = text.match(/\b(?:\d{1,3}(?:,\d{3})+|\d+)\s+(?:out\s+)?of\s+(?:the\s+)?(\d{1,3}(?:,\d{3})+|\d+)\b/i)
    || text.match(/\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\s+(?:out\s+)?of\s+(?:the\s+)?(\d{1,3}(?:,\d{3})+|\d+)\b/i)
    || text.match(/\bevery\s+one\s+of\s+(?:the\s+)?(\d{1,3}(?:,\d{3})+|\d+)\b/i)
    || ratio;
  return match ? Number(match[1].replace(/,/g, '')) : null;
}

function reportedDurationSeconds(text) {
  const clock = text.match(/\b(\d{1,2}):(\d{2}):(\d{2})\b/);
  if (clock) return Number(clock[1]) * 3600 + Number(clock[2]) * 60 + Number(clock[3]);
  const minuteClock = text.match(/\b(?:in|within|took|after|during)\s+(\d{1,2}):(\d{2})\b/i);
  if (minuteClock) return Number(minuteClock[1]) * 60 + Number(minuteClock[2]);
  if (/\b(?:in|within|took|after|during)\s+(?:half\s+an?|½)\s+hours?\b/i.test(text)) return 1800;
  let seconds = 0;
  let found = false;
  const regex = /(?<![\d.·])(\d+(?:[.·]\d+)?)\s*(?:-\s*)?(milliseconds?|msecs?|ms|seconds?|secs?|s(?:ec)?\.?|minutes?|mins?|m(?:in)?\.?|hours?|hrs?|h(?:r)?\.?|days?|weeks?)(?=\d|\s|$|[,.;)])/gi;
  for (const match of text.matchAll(regex)) {
    const value = Number(match[1].replace('·', '.'));
    const unit = match[2].toLowerCase().replace(/\.$/, '');
    let multiplier = 1;
    if (/^(?:millisecond|milliseconds|msec|msecs|ms)$/.test(unit)) multiplier = 0.001;
    else if (/^(?:minute|minutes|min|mins|m)$/.test(unit)) multiplier = 60;
    else if (/^(?:hour|hours|hr|hrs|h)$/.test(unit)) multiplier = 3600;
    else if (/^(?:day|days)$/.test(unit)) multiplier = 86400;
    else if (/^(?:week|weeks)$/.test(unit)) multiplier = 604800;
    seconds += value * multiplier;
    found = true;
  }
  const wordRegex = /\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\s+(seconds?|secs?|s|minutes?|mins?|min\.?|m|hours?|hrs?|h|days?|weeks?)\b/gi;
  for (const match of text.matchAll(wordRegex)) {
    const value = NUMBER_WORDS.get(match[1].toLowerCase());
    const unit = match[2].toLowerCase();
    const multiplier = /^(?:minute|min|m)/.test(unit) ? 60
      : (/^hour/.test(unit) ? 3600 : (/^day/.test(unit) ? 86400 : (/^week/.test(unit) ? 604800 : 1)));
    seconds += value * multiplier;
    found = true;
  }
  return found ? seconds : null;
}

function clauseBounds(text, position) {
  const separators = [];
  for (const match of text.matchAll(/[;,]|\band\b/gi)) separators.push([match.index, match.index + match[0].length]);
  let start = 0;
  let end = text.length;
  for (const [left, right] of separators) {
    if (right <= position) start = right;
    if (left > position) {
      end = left;
      break;
    }
  }
  return [start, end];
}

function operationContextExcluded(text, start, end = start) {
  const beforeOperation = text.slice(0, start);
  let clauseStart = Math.max(0, beforeOperation.search(/[^,;:]*$/));
  for (const boundary of beforeOperation.matchAll(/\b(?:but|rather than)\b/gi)) {
    clauseStart = Math.max(clauseStart, boundary.index + boundary[0].length);
  }
  const prefix = text.slice(clauseStart, start);
  const suffixBoundary = text.slice(end).search(/[,;:]/);
  const suffix = text.slice(end, suffixBoundary < 0 ? text.length : end + suffixBoundary);
  if (/^\s*(?:if|unless|assuming|suppose|supposing|hypothetically|even if|had|were|should)\b/i.test(text)) return true;
  if (/^\s*(?:did|do|does|have|has|had|can|could|would|will|was|were|is|are|am)\s+(?:I|we|you|the\s+assistant|the\s+agent)\b/i.test(text)) return true;
  if (/^\s*(?:please\s+)?(?:review|read|check|verify|validate|audit|research|inspect|examine|assess|evaluate|analyze|analyse|synthesize|synthesise)\b/i.test(text)
      && !/^\s*(?:review|audit|research|analysis|synthesis)\s+(?:is\s+)?(?:complete|completed|done|finished|concluded)\b/i.test(text)) return true;
  if (/\b(?:never|do not|don't|must not|should not|may not)\s+(?:say|state|claim|report|assert|imply|write|describe|call|pretend)(?:s|ed|ing)?\b/i.test(prefix)) return true;
  if (/\b(?:cannot|can't|could not|couldn't|unable to|not able to)\s+(?:confirm|verify|establish|determine|say|conclude|know)\b/i.test(prefix)) return true;
  if (/\b(?:unclear|unknown|uncertain|unconfirmed)\s+(?:whether|if|that)\b/i.test(prefix)) return true;
  if (/\b(?:may|might|could|would)\b/i.test(prefix)) return true;
  if (/\b(?:will|shall)(?:\s+have)?(?:\s+been)?\s*$|\b(?:plan|plans|planned|intend|intends|intended|going)\s+to\s*$/i.test(prefix)) return true;
  if (/\b(?:should|ought\s+to|need(?:s|ed)?\s+to|due\s+to|scheduled\s+to)(?:\s+have)?(?:\s+been|\s+be)?\s*$/i.test(prefix)) return true;
  if (/\b(?:can|am able to|are able to|is able to)\s*$/i.test(prefix)) return true;
  if (/^\s*(?:tomorrow|next\s+(?:week|month|year)|later|soon)\b/i.test(text)) return true;
  if (/\b(?:requires?|required|orders?|ordered|directs?|directed|asks?|asked)\b[^,;:]{0,35}\b(?:me|us|you|the\s+assistant|the\s+agent)\s+to\s*$/i.test(prefix)) return true;
  if (/\bno\s*$/i.test(prefix)) return true;
  if (/\bnot\s+(?:all|every|fully)\b/i.test(prefix)) return true;
  if (/\b(?:is|are|was|were|has|have|had|do|does|did)\s+not\b/i.test(prefix)) return true;
  if (/\b(?:isn't|aren't|wasn't|weren't|hasn't|haven't|hadn't|didn't|doesn't|don't|never)\b/i.test(prefix)) return true;
  if (/\bwithout\b[^,;:]{0,60}$/i.test(prefix)) return true;
  if (/\b(?:failed|fails?|failing)\s+to\b[^,;:]{0,40}$/i.test(prefix)) return true;
  if (/\b(?:not sure|unsure|don't know|do not know|doubt|doubts|doubted)\b[^,;:]{0,80}$/i.test(prefix)) return true;
  if (/\b(?:have|has|had)\s+yet\s+to\b[^,;:]{0,40}$/i.test(prefix)) return true;
  if (/\b(?:need|needs|needed|must|should|ought)\s+(?:to\s+)?$/i.test(prefix)
      || /\b(?:have|has|had)\s+to\s*$/i.test(prefix)) return true;
  if (/\b(?:deny|denies|denied|denying|dispute|disputes|disputed|reject|rejects|rejected)\b[^,;:]{0,80}$/i.test(prefix)) return true;
  if (/\b(?:it|this|that)\s+(?:is|was)\s+(?:false|untrue|incorrect|unsupported)\s+that\b/i.test(prefix)) return true;
  if (/\bno\s+(?:evidence|proof|record|basis|support)\b[^,;:]{0,80}$/i.test(prefix)) return true;
  if (/\b(?:no|none|neither|zero|not\s+(?:one|a single|any))\b[^,;:]{0,60}\b(?:is|are|was|were|has been|have been|had been)?\s*$/i.test(prefix)) return true;
  if (/\b(?:but|and)?\s*not\s*$/i.test(prefix)) return true;
  if (/^\s+(?:none|zero|not\s+(?:one|a single|any)|no(?!\s+fewer\s+than))\b/i.test(suffix)) return true;
  if (/^\s+(?:is|are|was|were|remains?|stays?)\s+(?:pending|owed|required|needed|incomplete|unfinished)\b/i.test(suffix)) return true;
  if (/\b(?:if|unless|provided\s+that|assuming)\b/i.test(suffix)) return true;
  if (/\b(?:is|was|remains?)\s+(?:false|untrue|incorrect|unsupported)\b/i.test(suffix)
      && /\b(?:claim|statement|assertion|report)\b/i.test(prefix)) return true;
  return false;
}

function operationMatches(text, forcePositive = false) {
  const matches = [];
  for (const [operation, source] of OPERATION_DEFINITIONS) {
    const regex = new RegExp(source, 'gi');
    for (const match of text.matchAll(regex)) {
      const candidate = {operation, start: match.index, end: match.index + match[0].length, raw: match[0]};
      if (!forcePositive && operationContextExcluded(text, candidate.start, candidate.end)) continue;
      if (/ing$/i.test(candidate.raw)
          && /\b(?:am|is|are|was|were|be|been|being)\s*$/i.test(text.slice(0, candidate.start))
          && !/\b(?:finished|completed|concluded)\b/i.test(text.slice(0, candidate.start))) continue;
      if (/^\s+(?:receipt|ledger|scope|evidence|status|report|record)\b/i.test(text.slice(candidate.end))
          && !/\b(?:is|are|was|were|has been|have been)\s+(?:fully\s+)?(?:done|complete|completed|finished|concluded)\b/i.test(text)) {
        continue;
      }
      if (/\bno\s+(?:verified|validated|reviewed|audited|researched)\s+(?:support|evidence|basis)\b/i.test(
        text.slice(Math.max(0, candidate.start - 12), candidate.end + 20),
      )) continue;
      if (matches.some(existing => candidate.start < existing.end && candidate.end > existing.start)) continue;
      matches.push(candidate);
    }
  }
  return matches.sort((left, right) => left.start - right.start);
}

function isDoubleNegationAffirmation(text) {
  return /\b(?:it\s+is\s+not\s+(?:untrue|false|incorrect)\s+that|I\s+(?:do not|don't)\s+deny\s+that|it\s+cannot\s+be\s+denied\s+that|no\s+one\s+can\s+deny\s+that)\b/i.test(text);
}

function isNonCompletionModeSentence(text) {
  return /\b(?:should|ought\s+to|need(?:s|ed)?\s+to|due\s+to|scheduled\s+to)(?:\s+have)?(?:\s+been|\s+be)?\s+(?:reviewed|read|checked|verified|audited|researched|examined|assessed|evaluated)\b/i.test(text);
}

function deliverableCompletionMatch(text) {
  const regex = /(?:^\s*(?:done|complete|completed|finished)\b|\b(?:we|I)(?:'re|\s+are)\s+(?:all\s+)?done\b|\b(?:work|task|job|deliverable|assignment|project|answer|output|everything)\b[^.!?]{0,50}\b(?:(?:is|are|was|were|has been|have been)\s+(?:fully\s+)?(?:done|complete|completed|finished|concluded|wrapped up|ready|good to go)|(?:has|have)\s+(?:concluded|finished|ended)|(?:completed|finished|concluded))\b|\b(?:I|we|the assistant|the agent|the team)\s+(?:(?:have|has)\s+)?(?:completed|finished|concluded|wrapped up)\s+(?:the|a|this|that|our|my)?\s*(?:work|task|job|deliverable|assignment|project|answer|output)\b)/i;
  const match = text.match(regex);
  if (!match || operationContextExcluded(text, match.index, match.index + match[0].length)) return null;
  return {operation: 'deliverable-completion', start: match.index, end: match.index + match[0].length, raw: match[0]};
}

function ambiguousCompletionCandidate(text) {
  const patterns = [
    /\b(?:I|we|the assistant|the agent|the team)\s+(?:(?:have|has|had)\s+)?(?:completed|finished|handled|performed|executed|conducted|undertook|did|wrapped up|carried out)\b/i,
    /\b(?:all|every|entire|whole)\b[^.!?]{0,80}\b(?:is|are|was|were|has been|have been|had been)\s+\w+(?:ed|en)\b/i,
    /\b(?:work|task|job|deliverable|assignment|project|answer|output|everything)\b[^.!?]{0,50}\b(?:settled|handled|delivered|finalized|finalised|ready)\b/i,
    /[✓✔☑]\s*\d[\d,]*\s*\/\s*\d[\d,]*/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && !operationContextExcluded(text, match.index, match.index + match[0].length)) {
      return {operation: 'ambiguous-work-status', start: match.index, end: match.index + match[0].length, raw: match[0]};
    }
  }
  return null;
}

function negativeResidualCompletionMatch(text) {
  const patterns = [
    /\bthere\s+(?:is|are|was|were)\s+no\s+un(?:reviewed|read|checked|examined|assessed|evaluated)\s+(?:sources?|witness(?:es)?|records?|items?|files?|documents?)\b/i,
    /\bnot\s+(?:a\s+single|one)\s+(?:source|witness|record|item|file|document)\s+(?:was left|is left|was|is|remains?)\s+un(?:reviewed|read|checked|examined|assessed|evaluated)\b/i,
    /\bnone\s+of\s+the\s+(?:sources?|witness(?:es)?|records?|items?|files?|documents?)\s+(?:remains?|was|were|is|are)\s+un(?:reviewed|read|checked|examined|assessed|evaluated)\b/i,
    /\bnot\s+one\s+(?:source|witness|record|item|file|document)\s+remains?\s+to\s+be\s+(?:reviewed|read|checked|examined|assessed|evaluated)\b/i,
    /\bno\s+(?:source|witness|record|item|file|document)\s+(?:escaped|missed|avoided)\s+(?:review|reading|checking|examination|assessment|evaluation)\b/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return {operation: 'direct-review', start: match.index, end: match.index + match[0].length, raw: match[0]};
  }
  return null;
}

function isWorkStatusSentence(text, operations, counts) {
  if (!operations.length) return false;
  if (/\b(?:retract|withdraw)\b/i.test(text)) return false;
  if (text.trim().endsWith('?')) return false;
  if (/\b(?:remain|remains|remaining)\b[^.!?]{0,50}\b(?:owed|pending|unresolved|incomplete)\b/i.test(text)
      && operations.every(operation => operation.operation === 'source-verification')) return false;
  if (operations.some(operation => operation.operation === 'deliverable-completion')) return true;
  if (operations.some(operation => /\bun(?:reviewed|read|checked|examined|assessed|evaluated)\b|\bescaped\s+review\b|\bremains?\s+to\s+be\s+reviewed\b/i.test(operation.raw))) return true;
  if (/\b(?:is|are|was|were|has been|have been)\s+(?:fully\s+)?(?:done|complete|completed|finished|concluded)\b/i.test(text)) return true;
  if (/^\s*(?:(?:reviewed|checked|verified|audited|researched)\b|(?:review|audit|research|analysis|synthesis)\s+(?:done|complete|completed|finished|final|passed)\b|(?:done|finished|completed)\s+(?:the\s+)?(?:review|audit|research|analysis|synthesis|reviewing|checking|verifying|auditing|researching)\b)/i.test(text)) return true;
  if (/^\s*the\s+(?:review|audit|research|analysis|synthesis)\s+(?:is\s+final|passed)\b/i.test(text)) return true;
  if (/\b(?:all|every|entire|whole|fully)\b/i.test(text) || counts.length) return true;
  if (/^\s*(?:I|we)\b/i.test(text)) return true;
  if (/\b(?:assistant|agent|worker|team|run|script|tool|pipeline)\b/i.test(text)) return true;
  if (/\b(?:is|are|was|were|has been|have been|had been)\b[^.!?]{0,35}\b(?:reviewed|read|checked|perused|consulted|surveyed|examined|inspected|assessed|evaluated|appraised|verified|validated|vetted|corroborated|audited|researched|investigated|studied|classified|processed|scanned|indexed|extracted|sampled|analyzed|analysed|synthesized|synthesised)\b/i.test(text)) return true;
  if (/\b(?:each|every|all)\b[^.!?]{0,35}\bgot\s+(?:reviewed|read|checked|verified|audited|assessed|evaluated)\b/i.test(text)) return true;
  if (/\b(?:sources?|witness(?:es)?|records?|items?|files?|documents?|corpus)\s+(?:passed|cleared)\s+review\b/i.test(text)) return true;
  if (/\b(?:I|we)\s+gave\b[^.!?]{0,60}\b(?:close|careful|full)\s+read\b/i.test(text)) return true;
  return /\breceived\b[^.!?]{0,35}\b(?:assessment|evaluation|review|audit|verification)\b/i.test(text);
}

function isClearlyAttributedWorkSentence(text) {
  if (text.includes('§') || /\b(?:I|we)\s+(?:confirm|affirm|endorse|agree|certify)\b/i.test(text)) return false;
  if (/^\s*according to\b/i.test(text)) return true;
  if (/^\s*it\s+(?:is|was|has been|had been)\s+(?:reported|stated|said|claimed|written|alleged)\s+that\b/i.test(text)) return true;
  if (/^\s*(?:I|we)\s+(?:was|were|have been|had been)\s+(?:told|informed|advised)\s+that\b/i.test(text)) return true;
  return /^\s*(?:(?:the|a|an|this|that|our|my|their)\s+)?(?:published\s+)?(?:study|article|paper|report|source|author|authors|researcher|researchers|scholar|scholars|prior assistant|previous assistant|earlier assistant)\b[^.!?]{0,100}\b(?:reports?|reported|states?|stated|says?|said|claims?|claimed|writes?|wrote|finds?|found|concludes?|concluded)\b/i.test(text)
    || /^\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s+(?:reports?|reported|states?|stated|says?|said|claims?|claimed|writes?|wrote|finds?|found|concludes?|concluded)\b/.test(text)
    || /^\s*(?!I\b|we\b)(?:the\s+)?[\w-]+(?:\s+[\w-]+){0,4}\s+(?:reports?|reported|states?|stated|says?|said|claims?|claimed|writes?|wrote|finds?|found|concludes?|concluded)\s+(?:that\s+)?/i.test(text);
}

function parseWorkStatusClaims(body) {
  const source = String(body || '');
  const masked = maskQuotedSpans(source);
  const claims = [];
  for (const sentenceMatch of masked.matchAll(/[^.!?\n]+(?:[.!?]+[”’»"'¤]?|$)/g)) {
    const raw = source.slice(sentenceMatch.index, sentenceMatch.index + sentenceMatch[0].length);
    const leading = raw.match(/^\s*/)[0].length;
    const trailing = raw.match(/\s*$/)[0].length;
    const text = raw.slice(leading, raw.length - trailing);
    if (!text) continue;
    const sentenceMasked = sentenceMatch[0].slice(leading, sentenceMatch[0].length - trailing);
    if (sentenceMasked.trim().endsWith('?')) continue;
    if (/(?:\b(?:never|do not|don't|must not|should not|may not)\b[^.!?]{0,60}\b(?:claim|say|state|report|assert|imply|write|describe)(?:s|ed|ing)?\b|\b(?:claim|say|state|report|assert|imply|write|describe)(?:s|ed|ing)?\b[^.!?]{0,60}\b(?:must not|should not|may not)\b)/i.test(sentenceMasked)) continue;
    if (isClearlyAttributedWorkSentence(sentenceMasked)) continue;
    const doubleNegation = isDoubleNegationAffirmation(sentenceMasked);
    let operations = operationMatches(sentenceMasked, doubleNegation);
    const negativeResidual = negativeResidualCompletionMatch(sentenceMasked);
    if (negativeResidual) operations = [negativeResidual];
    const completion = deliverableCompletionMatch(sentenceMasked);
    if (completion && (!operations.length || /\b(?:work|task|job|deliverable|assignment|project)\b/i.test(sentenceMasked))) {
      operations.push(completion);
    }
    if (!operations.length && !isNonCompletionModeSentence(sentenceMasked)) {
      const ambiguous = ambiguousCompletionCandidate(sentenceMasked);
      if (ambiguous) operations.push(ambiguous);
    }
    const counts = parseCountTokens(sentenceMasked);
    if (!isWorkStatusSentence(sentenceMasked, operations, counts)) continue;
    operations = operations.map(operation => {
      const [clauseStart, clauseEnd] = clauseBounds(sentenceMasked, operation.start);
      const localCounts = counts.filter(count => count.start >= clauseStart && count.end <= clauseEnd);
      const candidates = localCounts.length ? localCounts : counts;
      const partWhole = sentenceMasked.match(/\b(?:only\s+)?(?:\d{1,3}(?:,\d{3})+|\d+|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\s*(?:\/|(?:out\s+)?of)\s*(?:the\s+)?(?:\d{1,3}(?:,\d{3})+|\d+)\b/i);
      const partToken = partWhole && candidates.find(count => count.start >= partWhole.index && count.start < partWhole.index + partWhole[0].length);
      const unitBound = candidates.filter(count => count.unit_bound);
      const bindingCandidates = partToken ? [partToken] : (unitBound.length ? unitBound : candidates);
      const nearest = negativeResidual ? null : bindingCandidates.slice().sort((left, right) => {
        const leftDistance = Math.min(Math.abs(left.end - operation.start), Math.abs(left.start - operation.end));
        const rightDistance = Math.min(Math.abs(right.end - operation.start), Math.abs(right.start - operation.end));
        return leftDistance - rightDistance || left.start - right.start;
      })[0];
      return {...operation, count: nearest ? nearest.value : null};
    });
    const uniqueOperations = [];
    const duplicateOperations = [];
    for (const operation of operations) {
      const existing = uniqueOperations.find(candidate => candidate.operation === operation.operation);
      if (!existing) {
        uniqueOperations.push(operation);
      } else {
        const existingClause = clauseBounds(sentenceMasked, existing.start);
        const operationClause = clauseBounds(sentenceMasked, operation.start);
        if (existingClause[0] !== operationClause[0] || existingClause[1] !== operationClause[1]) {
          duplicateOperations.push(operation.operation);
        }
      }
    }
    const completedRatio = sentenceMasked.match(/\b(\d[\d,]*)\s*\/\s*(\d[\d,]*)\b/);
    const totalizer = /\b(?:all|every|entire|whole|fully)\b/i.test(sentenceMasked)
      || Boolean(negativeResidual)
      || Boolean(completedRatio && completedRatio[1].replace(/,/g, '') === completedRatio[2].replace(/,/g, ''));
    const absoluteOperation = uniqueOperations.some(operation => operation.operation !== 'deliverable-completion')
      && (/(?:\b(?:review|reading|checking|examination|inspection|assessment|evaluation|appraisal|verification|validation|audit|research|investigation|analysis|synthesis|pass\s+through)\b[^.!?]{0,45}\b(?:(?:is|are|was|were|has been|have been)\s+)?(?:fully\s+)?(?:done|complete|completed|finished|concluded)\b)/i.test(sentenceMasked)
        || /\b(?:done|complet(?:e|es|ed|ing)|finish(?:es|ed|ing)|conclud(?:e|es|ed|ing))\b[^.!?]{0,50}\b(?:review(?:s|ed|ing)?|reading|checking|going\s+(?:through|over)|worked\s+(?:through|over)|pass\s+through|verification|validation|audit|research|investigation|analysis|synthesis)\b/i.test(sentenceMasked)
        || /\b(?:review|audit|research|analysis|synthesis)\b[^.!?]{0,35}\b(?:is\s+final|passed)\b/i.test(sentenceMasked));
    const quantityIssues = quantityAmbiguities(sentenceMasked);
    const ratioTokens = sentenceMasked.match(/\b\d[\d,]*\s*\/\s*\d[\d,]*\b/);
    const partWholeTokens = sentenceMasked.match(/\b(?:only\s+)?(?:\d[\d,]*|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\s*(?:\/|(?:out\s+)?of)\s*(?:the\s+)?\d[\d,]*\b/i);
    if (!quantityIssues.length && !negativeResidual && !doubleNegation && !ratioTokens && !partWholeTokens
        && counts.some(count => !count.unit_bound && !count.status_bound)) {
      quantityIssues.push('unbound-number');
    }
    claims.push({
      text,
      start: sentenceMatch.index + leading,
      end: sentenceMatch.index + raw.length - trailing,
      operations: uniqueOperations,
      totalizer,
      structural_counts: counts.map(count => count.value),
      absolute_deliverable: uniqueOperations.some(operation => operation.operation === 'deliverable-completion'),
      absolute_operation: absoluteOperation,
      duplicate_operations: [...new Set(duplicateOperations)],
      quantity_ambiguities: [
        ...quantityIssues,
        ...(uniqueOperations.some(operation => operation.operation === 'ambiguous-work-status')
          ? ['unmapped-operation'] : []),
      ],
      population_hint: populationHint(sentenceMasked),
      reported_duration_seconds: reportedDurationSeconds(sentenceMasked),
    });
  }
  return claims;
}

function claimOccurrenceFields(draftSha256, claim) {
  return {
    draft_sha256: draftSha256,
    start: claim.start,
    end: claim.end,
    claim_sha256: sha256(claim.text),
    text: claim.text,
    operations: claim.operations.map(operation => ({operation: operation.operation, count: operation.count})),
    totalizer: claim.totalizer,
    absolute_deliverable: claim.absolute_deliverable,
    absolute_operation: claim.absolute_operation,
    quantity_ambiguities: [...claim.quantity_ambiguities],
    reported_duration_seconds: claim.reported_duration_seconds,
  };
}

function claimOccurrenceId(draftSha256, claim) {
  return sha256(JSON.stringify(claimOccurrenceFields(draftSha256, claim)));
}

function localDraftClaimBindings(plan, draft) {
  const scanText = plan.ml_active && draft.startsWith(plan.opener)
    ? draft.slice(plan.opener.length).trim()
    : draft;
  const draftSha256 = sha256(draft);
  return parseWorkStatusClaims(scanText).map(claim => {
    const fields = claimOccurrenceFields(draftSha256, claim);
    return {claim_id: sha256(JSON.stringify(fields)), ...fields};
  });
}

function validateDraftWorkStatusScan(plan, draft, evidence, trust) {
  if (!trust || typeof trust.verifyDraftWorkStatusAttestation !== 'function') {
    reject('UNRESOLVED_DRAFT_WORK_STATUS_SCAN', 'Every delivery requires a host-bootstrap full-draft work-status scan.');
  }
  let evidenceBytes;
  try {
    evidenceBytes = JSON.stringify(evidence);
  } catch {
    reject('UNRESOLVED_DRAFT_WORK_STATUS_SCAN', 'The delivery evidence could not be bound to the full-draft scan.');
  }
  if (typeof evidenceBytes !== 'string') {
    reject('UNRESOLVED_DRAFT_WORK_STATUS_SCAN', 'The delivery evidence could not be bound to the full-draft scan.');
  }
  const request = deepFreeze({
    schema_version: DRAFT_SCAN_ATTESTATION_SCHEMA,
    plan_integrity_sha256: plan.integrity_sha256,
    draft_sha256: sha256(draft),
    draft_bytes: draft,
    evidence_sha256: sha256(evidenceBytes),
    evidence_bytes: evidenceBytes,
    local_claims: localDraftClaimBindings(plan, draft),
  });
  let attestation;
  try {
    attestation = trust.verifyDraftWorkStatusAttestation(request);
  } catch {
    reject('UNRESOLVED_DRAFT_WORK_STATUS_SCAN', 'The trusted full-draft classifier failed closed.');
  }
  const bindings = attestation && attestation.claim_bindings;
  const bindingShapeValid = Array.isArray(bindings)
    && bindings.length === request.local_claims.length
    && bindings.every((binding, index) => {
      if (!binding || typeof binding !== 'object' || Array.isArray(binding)) return false;
      const {classification, evidence_verdict: evidenceVerdict, ...localFields} = binding;
      return ['work-status', 'nonclaim'].includes(classification)
        && ['supported', 'unsupported', 'not-applicable'].includes(evidenceVerdict)
        && (classification === 'nonclaim') === (evidenceVerdict === 'not-applicable')
        && JSON.stringify(localFields) === JSON.stringify(request.local_claims[index]);
    });
  if (!attestation || typeof attestation !== 'object' || Array.isArray(attestation)
      || attestation.schema_version !== DRAFT_SCAN_ATTESTATION_SCHEMA
      || attestation.verifier_id !== trust.draftVerifierId
      || attestation.plan_integrity_sha256 !== request.plan_integrity_sha256
      || attestation.draft_sha256 !== request.draft_sha256
      || attestation.evidence_sha256 !== request.evidence_sha256
      || attestation.complete_scan_verified !== true
      || typeof attestation.no_unmapped_work_status_claims !== 'boolean'
      || !bindingShapeValid) {
    reject('UNRESOLVED_DRAFT_WORK_STATUS_SCAN', 'The trusted full-draft scan is missing, malformed, or not exactly bound.');
  }
  if (!attestation.no_unmapped_work_status_claims) {
    reject('UNMAPPED_DRAFT_WORK_STATUS', 'The trusted full-draft scan found work-status language outside the local parser mapping.');
  }
  return deepFreeze({
    nonclaim_claim_ids: bindings.filter(binding => binding.classification === 'nonclaim').map(binding => binding.claim_id),
    unsupported_claim_ids: bindings.filter(binding => binding.classification === 'work-status' && binding.evidence_verdict !== 'supported').map(binding => binding.claim_id),
  });
}

function completionReceiptPayload(claim) {
  const execution = claim.execution || {};
  return {
    claim_text: claim.claim_text,
    status: claim.status,
    operation: claim.operation,
    operations: claim.operations,
    operation_counts: claim.operation_counts,
    unit: claim.unit,
    completion_condition: claim.completion_condition,
    claimed_total: claim.claimed_total,
    population_total: claim.population_total,
    completed_total: claim.completed_total,
    unresolved_total: claim.unresolved_total,
    excluded_total: claim.excluded_total,
    lane_counts: claim.lane_counts,
    evidence_refs: claim.evidence_refs,
    execution: {
      elapsed_seconds: execution.elapsed_seconds,
      worker_count: execution.worker_count,
      modes: execution.modes,
      ledger_manifest_sha256: execution.ledger_manifest_sha256,
      receipt_origin: execution.receipt_origin,
    },
  };
}

function completionVerificationRequest(parsed, claim, deliveryContext) {
  const execution = claim.execution;
  const operationCounts = Object.fromEntries(parsed.operations.map(operation => [
    operation.operation,
    claim.operation_counts ? claim.operation_counts[operation.operation] : claim.claimed_total,
  ]));
  return {
    schema_version: WORK_ATTESTATION_SCHEMA,
    plan_integrity_sha256: deliveryContext.plan_integrity_sha256,
    draft_sha256: deliveryContext.draft_sha256,
    claim_text: parsed.text,
    claim_sha256: sha256(parsed.text),
    parsed_claim: {
      operations: parsed.operations.map(operation => ({operation: operation.operation, count: operation.count})),
      totalizer: parsed.totalizer,
      structural_counts: [...parsed.structural_counts],
      absolute_deliverable: parsed.absolute_deliverable,
      absolute_operation: parsed.absolute_operation,
      duplicate_operations: [...parsed.duplicate_operations],
      quantity_ambiguities: [...parsed.quantity_ambiguities],
      population_hint: parsed.population_hint,
      reported_duration_seconds: parsed.reported_duration_seconds,
    },
    receipt_sha256: execution.receipt_sha256,
    receipt_origin: execution.receipt_origin,
    ledger_manifest_sha256: execution.ledger_manifest_sha256,
    evidence_refs: [...claim.evidence_refs],
    population_total: claim.population_total,
    completed_total: claim.completed_total,
    unresolved_total: claim.unresolved_total,
    excluded_total: claim.excluded_total,
    operations: parsed.operations.map(operation => operation.operation),
    operation_counts: operationCounts,
    completion_condition_sha256: sha256(claim.completion_condition),
    elapsed_seconds: execution.elapsed_seconds,
    worker_count: execution.worker_count,
    modes: [...execution.modes],
    reported_duration_seconds: parsed.reported_duration_seconds,
  };
}

function validateWorkAttestation(request, trust) {
  if (!trust || typeof trust.verifyWorkAttestation !== 'function') {
    reject('UNRESOLVED_COMPLETION_EVIDENCE', 'Work-status evidence requires a host-bootstrap trusted verifier.');
  }
  let attestation;
  try {
    attestation = trust.verifyWorkAttestation(deepFreeze({...request}));
  } catch {
    reject('UNRESOLVED_COMPLETION_EVIDENCE', 'The trusted work-status verifier failed closed.');
  }
  if (!attestation || typeof attestation !== 'object' || Array.isArray(attestation)
      || attestation.schema_version !== WORK_ATTESTATION_SCHEMA
      || attestation.ok !== true
      || attestation.verifier_id !== trust.workVerifierId
      || attestation.plan_integrity_sha256 !== request.plan_integrity_sha256
      || attestation.draft_sha256 !== request.draft_sha256
      || attestation.claim_text !== request.claim_text
      || attestation.claim_sha256 !== request.claim_sha256
      || JSON.stringify(attestation.parsed_claim) !== JSON.stringify(request.parsed_claim)
      || attestation.receipt_sha256 !== request.receipt_sha256
      || attestation.receipt_origin !== request.receipt_origin
      || attestation.ledger_manifest_sha256 !== request.ledger_manifest_sha256
      || !sameUniqueSet(attestation.resolved_evidence_refs, request.evidence_refs)
      || attestation.population_total !== request.population_total
      || attestation.completed_total !== request.completed_total
      || attestation.unresolved_total !== request.unresolved_total
      || attestation.excluded_total !== request.excluded_total
      || JSON.stringify(attestation.operations) !== JSON.stringify(request.operations)
      || JSON.stringify(attestation.operation_counts) !== JSON.stringify(request.operation_counts)
      || attestation.completion_condition_sha256 !== request.completion_condition_sha256
      || attestation.elapsed_seconds !== request.elapsed_seconds
      || attestation.worker_count !== request.worker_count
      || !sameUniqueSet(attestation.modes, request.modes)
      || attestation.reported_duration_seconds !== request.reported_duration_seconds
      || attestation.receipt_verified !== true
      || attestation.ledger_manifest_resolved !== true
      || attestation.unit_records_verified !== true
      || attestation.depth_verified !== true
      || attestation.capacity_plausible !== true) {
    reject('UNRESOLVED_COMPLETION_EVIDENCE', 'The trusted verifier did not resolve and bind the claimed work evidence.');
  }
}

function validateCompletionClaimRecord(body, parsed, claim, trust, deliveryContext) {
  const claimText = parsed.text;
  if (!claim || typeof claim !== 'object' || Array.isArray(claim)) {
    reject('MALFORMED_COMPLETION_EVIDENCE', 'Every work-status claim requires an evidence object.');
  }
  if (claim.claim_text !== claimText || countOccurrences(body, claimText) !== 1) {
    reject('UNMAPPED_COMPLETION_CLAIM', 'Work-status evidence does not map exactly once to the delivered claim.');
  }
  if (parsed.duplicate_operations.length || parsed.quantity_ambiguities.length) {
    reject('AMBIGUOUS_WORK_STATUS_LANGUAGE', 'Repeated predicates or unsupported quantity syntax cannot be safely bound to evidence.');
  }
  const parsedOperations = parsed.operations.map(operation => operation.operation);
  const recordedOperations = Array.isArray(claim.operations) ? claim.operations : [claim.operation];
  if (!uniqueNonemptyStrings(recordedOperations)
      || !sameUniqueSet(recordedOperations, parsedOperations)) {
    reject('COMPLETION_OPERATION_MISMATCH', 'The recorded operations do not match every work-status predicate.');
  }
  const statuses = new Set(['deliverable-complete', 'operation-complete', 'partial', 'provisional', 'blocked']);
  if (!statuses.has(claim.status) || !String(claim.unit || '').trim()
      || !String(claim.completion_condition || '').trim()) {
    reject('MALFORMED_COMPLETION_EVIDENCE', 'Work-status evidence lacks its status, unit, or completion condition.');
  }
  const countKeys = [
    'claimed_total', 'population_total', 'completed_total', 'unresolved_total', 'excluded_total',
  ];
  if (!countKeys.every(key => nonnegativeInteger(claim[key]))) {
    reject('MALFORMED_COMPLETION_EVIDENCE', 'Work-status counts must be nonnegative integers.');
  }
  if (claim.completed_total + claim.unresolved_total + claim.excluded_total !== claim.population_total
      || claim.claimed_total > claim.population_total) {
    reject('COMPLETION_COUNT_MISMATCH', 'The claimed population does not reconcile with the work ledger.');
  }
  if (parsed.population_hint !== null && parsed.population_hint !== claim.population_total) {
    reject('COMPLETION_COUNT_MISMATCH', 'The stated source population does not match the frozen population.');
  }
  if (parsedOperations.length > 1) {
    if (!claim.operation_counts || typeof claim.operation_counts !== 'object' || Array.isArray(claim.operation_counts)
        || Object.keys(claim.operation_counts).length !== parsedOperations.length
        || !parsedOperations.every(operation => nonnegativeInteger(claim.operation_counts[operation]))) {
      reject('COMPLETION_COUNT_MISMATCH', 'Compound work claims require one exact count per parsed operation.');
    }
  }
  const operationCounts = Object.fromEntries(parsed.operations.map(operation => [
    operation.operation,
    claim.operation_counts ? claim.operation_counts[operation.operation] : claim.claimed_total,
  ]));
  if (Object.values(operationCounts).some(value => value > claim.population_total)
      || Math.max(...Object.values(operationCounts)) !== claim.claimed_total) {
    reject('COMPLETION_COUNT_MISMATCH', 'The evidenced operation counts do not reconcile with the claim total.');
  }
  for (const operation of parsed.operations) {
    const evidenced = operationCounts[operation.operation];
    if (operation.count !== null && evidenced !== operation.count) {
      reject('COMPLETION_COUNT_MISMATCH', 'A work count is not structurally bound to its parsed predicate.');
    }
    if (operation.count === null && (parsed.totalizer || parsedOperations.length === 1)
        && evidenced !== claim.population_total) {
      reject('COMPLETION_COUNT_MISMATCH', 'An unquantified completed-set claim requires its frozen population total.');
    }
  }
  if (parsed.totalizer && parsed.structural_counts.length
      && claim.population_total !== Math.max(...Object.values(operationCounts))) {
    reject('COMPLETION_COUNT_MISMATCH', 'Universal language does not match the frozen population.');
  }
  const lanes = claim.lane_counts;
  const laneKeys = [
    'directly_reviewed', 'source_verified', 'audited', 'researched', 'machine_processed',
    'sampled', 'analyzed', 'synthesized',
  ];
  if (!lanes || typeof lanes !== 'object' || Array.isArray(lanes)
      || !laneKeys.every(key => nonnegativeInteger(lanes[key]) && lanes[key] <= claim.population_total)) {
    reject('MALFORMED_COMPLETION_EVIDENCE', 'Work-status evidence lacks exact operation-lane counts.');
  }
  const laneForOperation = {
    'direct-review': 'directly_reviewed',
    'source-verification': 'source_verified',
    audit: 'audited',
    research: 'researched',
    'batch-classification': 'machine_processed',
    classification: 'machine_processed',
    'machine-processing': 'machine_processed',
    sampling: 'sampled',
    analysis: 'analyzed',
    synthesis: 'synthesized',
  };
  for (const operation of parsedOperations) {
    const requiredLane = laneForOperation[operation];
    if (requiredLane && lanes[requiredLane] < operationCounts[operation]) {
      reject('FALSE_COMPLETION_CLAIM', 'The operation ledger does not support every delivered verb and count.');
    }
  }
  const substantiveOperations = new Set(['direct-review', 'source-verification', 'audit', 'research']);
  const universalEpistemic = parsed.totalizer
    && parsedOperations.some(operation => substantiveOperations.has(operation));
  if (parsed.absolute_deliverable && claim.status !== 'deliverable-complete') {
    reject('FALSE_COMPLETION_CLAIM', 'Absolute completion language lacks deliverable-complete evidence.');
  }
  if (parsed.absolute_operation
      && (!['operation-complete', 'deliverable-complete'].includes(claim.status)
        || claim.unresolved_total !== 0
        || claim.completed_total + claim.excluded_total !== claim.population_total)) {
    reject('INCOMPLETE_COMPLETION_CLAIM', 'An absolute operation-completion claim leaves unresolved scope.');
  }
  if (claim.status === 'deliverable-complete'
      && (claim.unresolved_total !== 0
        || claim.completed_total + claim.excluded_total !== claim.population_total)) {
    reject('INCOMPLETE_COMPLETION_CLAIM', 'A deliverable-complete claim leaves unresolved work.');
  }
  if (universalEpistemic
      && (claim.claimed_total !== claim.population_total
        || claim.completed_total !== claim.population_total
        || claim.unresolved_total !== 0
        || claim.excluded_total !== 0
        || !['deliverable-complete', 'operation-complete'].includes(claim.status))) {
    reject('INCOMPLETE_COMPLETION_CLAIM', 'Universal review, audit, research, or verification language lacks full-population evidence.');
  }
  if (claim.unresolved_total > 0
      && (!String(claim.disclosure_text || '').trim() || !body.includes(claim.disclosure_text))) {
    reject('UNDISCLOSED_COMPLETION_SHORTFALL', 'Unresolved work is not disclosed in the delivered status.');
  }
  if (!uniqueNonemptyStrings(claim.evidence_refs)) {
    reject('MALFORMED_COMPLETION_EVIDENCE', 'Work-status evidence requires unique evidence references.');
  }
  const execution = claim.execution;
  if (!execution || typeof execution !== 'object' || Array.isArray(execution)
      || !nonnegativeInteger(execution.elapsed_seconds)
      || !Number.isInteger(execution.worker_count) || execution.worker_count < 1
      || !uniqueNonemptyStrings(execution.modes)
      || !/^[0-9a-f]{64}$/.test(String(execution.ledger_manifest_sha256 || ''))
      || execution.receipt_origin !== 'host-sealed'
      || !/^[0-9a-f]{64}$/.test(String(execution.receipt_sha256 || ''))) {
    reject('MALFORMED_COMPLETION_EVIDENCE', 'Work-status execution evidence is incomplete.');
  }
  if (parsed.reported_duration_seconds !== null
      && parsed.reported_duration_seconds !== execution.elapsed_seconds) {
    reject('EXECUTION_DURATION_MISMATCH', 'The reported duration does not match authenticated execution time.');
  }
  if (sha256(JSON.stringify(completionReceiptPayload(claim))) !== execution.receipt_sha256) {
    reject('UNSUPPORTED_COMPLETION_RECEIPT', 'The work-status receipt does not match its evidence payload.');
  }
  validateWorkAttestation(completionVerificationRequest(parsed, claim, deliveryContext), trust);
}

function validateCompletionClaims(body, evidence, ignoredSpans = [], trust = null, deliveryContext = null, scan = null) {
  let scannedBody = body;
  for (const span of ignoredSpans) {
    if (typeof span === 'string' && span) scannedBody = scannedBody.replace(span, ' '.repeat(span.length));
  }
  const nonclaims = new Set((scan && scan.nonclaim_claim_ids) || []);
  const detected = parseWorkStatusClaims(scannedBody).filter(claim => (
    !nonclaims.has(claimOccurrenceId(deliveryContext.draft_sha256, claim))
  ));
  if (!detected.length) return;
  if (!evidence || !Array.isArray(evidence.completion_claims)) {
    reject('MISSING_COMPLETION_EVIDENCE', 'Delivered work-status language lacks a claim ledger.');
  }
  if (evidence.completion_claims.length !== detected.length
      || new Set(detected.map(claim => claim.text)).size !== detected.length
      || new Set(evidence.completion_claims.map(claim => claim && claim.claim_text)).size !== detected.length) {
    reject('UNMAPPED_COMPLETION_CLAIM', 'Every detected work-status sentence must have exactly one claim record.');
  }
  for (const parsed of detected) {
    const matches = evidence.completion_claims.filter(claim => claim && claim.claim_text === parsed.text);
    if (matches.length !== 1) {
      reject('UNMAPPED_COMPLETION_CLAIM', 'Every detected work-status sentence must have exactly one claim record.');
    }
    validateCompletionClaimRecord(body, parsed, matches[0], trust, deliveryContext);
  }
}

function correctionRequirement(request) {
  if (request.prior_false_work_claim === undefined) return null;
  if (typeof request.prior_false_work_claim !== 'string' || !request.prior_false_work_claim.trim()) {
    reject('MALFORMED_REQUEST', 'prior_false_work_claim must be a nonempty string when supplied.');
  }
  return {
    claim_text: request.prior_false_work_claim,
    claim_sha256: sha256(request.prior_false_work_claim),
  };
}

function correctionReceiptPayload(correction) {
  return {
    claim_text: correction.claim_text,
    retraction_text: correction.retraction_text,
    replacement_status: correction.replacement_status,
    impact_statement: correction.impact_statement,
    impact_mode: correction.impact_mode,
    affected_artifacts: correction.affected_artifacts,
    affected_conclusions: correction.affected_conclusions,
    dependency_action: correction.dependency_action,
    none_supported_statement: correction.none_supported_statement,
    repair_evidence_refs: correction.repair_evidence_refs,
    impact_evidence_refs: correction.impact_evidence_refs,
  };
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isCategoricalRetraction(retractionText, claimText) {
  const text = String(retractionText || '').trim();
  if (!text || countOccurrences(text, claimText) !== 1) return false;
  const escaped = escapeRegExp(claimText);
  const quoted = `(?:“${escaped}”|\"${escaped}\"|‘${escaped}’|«${escaped}»)`;
  const directObject = `(?:${quoted}|(?:(?:this|that|my|our|the)\\s+)?(?:(?:exact|specific|prior|previous|earlier|false|unsupported)\\s+){1,4}(?:claim|statement|assertion)\\s*[,;:]?\\s*${quoted})`;
  return new RegExp(`^(?:I|we)\\s+(?:hereby\\s+)?(?:retract|withdraw)\\s+${directObject}\\s*[.!]?$`, 'i').test(text);
}

function standaloneAssertedStatementSpan(body, statementText, requireFirst = false) {
  const statement = String(statementText || '').trim();
  if (!statement || countOccurrences(body, statement) !== 1
      || !/[.!?](?:["'”’»])?$/.test(statement)) return null;
  const start = body.indexOf(statement);
  const end = start + statement.length;
  if (requireFirst && start !== 0) return null;
  if (!requireFirst && start > 0) {
    let cursor = start - 1;
    while (cursor >= 0 && /\s/.test(body[cursor])) cursor -= 1;
    while (cursor >= 0 && /["'”’»)]/.test(body[cursor])) cursor -= 1;
    if (cursor >= 0 && !/[.!?]/.test(body[cursor])) return null;
  }
  const suffix = body.slice(end);
  if (suffix) {
    if (!/^\s+/.test(suffix)) return null;
    const next = suffix.trimStart();
    if (next && !/^(?:[A-Z0-9]|[“‘«([]|[-*#>]\s)/.test(next)) return null;
  }
  return {start, end, statement_sha256: sha256(statement)};
}

function validateFalseClaimCorrection(plan, body, evidence, trust = null, deliveryContext = null) {
  if (!plan.correction_required) return null;
  const correction = evidence && evidence.correction;
  const retractionSpan = correction && standaloneAssertedStatementSpan(body, correction.retraction_text, true);
  const replacementSpan = correction && standaloneAssertedStatementSpan(body, correction.replacement_status);
  const impactSpan = correction && standaloneAssertedStatementSpan(body, correction.impact_statement);
  const commonValid = correction && typeof correction === 'object' && !Array.isArray(correction)
      && correction.claim_text === plan.correction_required.claim_text
      && sha256(correction.claim_text) === plan.correction_required.claim_sha256
      && String(correction.retraction_text || '').trim()
      && isCategoricalRetraction(correction.retraction_text, correction.claim_text)
      && retractionSpan
      && String(correction.replacement_status || '').trim()
      && replacementSpan
      && String(correction.impact_statement || '').trim()
      && impactSpan
      && uniqueStringsAllowEmpty(correction.affected_artifacts)
      && uniqueStringsAllowEmpty(correction.affected_conclusions)
      && uniqueNonemptyStrings(correction.repair_evidence_refs)
      && uniqueNonemptyStrings(correction.impact_evidence_refs)
      && /^[0-9a-f]{64}$/.test(String(correction.correction_receipt_sha256 || ''));
  if (!commonValid) {
    reject('UNREPAIRED_FALSE_CLAIM', 'A prior false work claim requires exact retraction, replacement status, impact accounting, and frozen dependencies.');
  }
  const affected = correction.impact_mode === 'affected'
    && (correction.affected_artifacts.length + correction.affected_conclusions.length > 0)
    && ['frozen', 'downgraded', 'repaired'].includes(correction.dependency_action)
    && new RegExp(`\\b${correction.dependency_action.replace(/ed$/, '(?:ed|en)')}\\b`, 'i').test(correction.impact_statement);
  const noneSupported = correction.impact_mode === 'none-supported'
    && correction.affected_artifacts.length === 0
    && correction.affected_conclusions.length === 0
    && correction.dependency_action === 'none-supported'
    && String(correction.none_supported_statement || '').trim()
    && correction.none_supported_statement === correction.impact_statement;
  if (!affected && !noneSupported) {
    reject('UNREPAIRED_FALSE_CLAIM', 'Correction impact accounting is empty, unsupported, or lacks an evidenced dependency action.');
  }
  if (sha256(JSON.stringify(correctionReceiptPayload(correction))) !== correction.correction_receipt_sha256) {
    reject('UNREPAIRED_FALSE_CLAIM', 'The correction receipt does not bind the correction payload.');
  }
  if (!trust || typeof trust.verifyCorrectionAttestation !== 'function') {
    reject('UNREPAIRED_FALSE_CLAIM', 'Correction impact accounting requires a host-bootstrap trusted verifier.');
  }
  const request = deepFreeze({
    schema_version: CORRECTION_ATTESTATION_SCHEMA,
    plan_integrity_sha256: deliveryContext.plan_integrity_sha256,
    draft_sha256: deliveryContext.draft_sha256,
    draft_bytes: deliveryContext.draft_bytes,
    body_sha256: sha256(body),
    body_bytes: body,
    prior_claim_sha256: plan.correction_required.claim_sha256,
    retraction_sha256: sha256(correction.retraction_text),
    retraction_span: {...retractionSpan},
    replacement_status_sha256: sha256(correction.replacement_status),
    replacement_status_span: {...replacementSpan},
    impact_statement_sha256: sha256(correction.impact_statement),
    impact_statement_span: {...impactSpan},
    none_supported_statement_span: noneSupported ? {...impactSpan} : null,
    correction_receipt_sha256: correction.correction_receipt_sha256,
    impact_mode: correction.impact_mode,
    dependency_action: correction.dependency_action,
    affected_artifacts: [...correction.affected_artifacts],
    affected_conclusions: [...correction.affected_conclusions],
    repair_evidence_refs: [...correction.repair_evidence_refs],
    impact_evidence_refs: [...correction.impact_evidence_refs],
  });
  let attestation;
  try {
    attestation = trust.verifyCorrectionAttestation(request);
  } catch {
    reject('UNREPAIRED_FALSE_CLAIM', 'The trusted correction verifier failed closed.');
  }
  if (!attestation || typeof attestation !== 'object' || Array.isArray(attestation)
      || attestation.schema_version !== CORRECTION_ATTESTATION_SCHEMA
      || attestation.ok !== true
      || attestation.verifier_id !== trust.correctionVerifierId
      || attestation.plan_integrity_sha256 !== request.plan_integrity_sha256
      || attestation.draft_sha256 !== request.draft_sha256
      || attestation.body_sha256 !== request.body_sha256
      || attestation.prior_claim_sha256 !== request.prior_claim_sha256
      || attestation.retraction_sha256 !== request.retraction_sha256
      || JSON.stringify(attestation.retraction_span) !== JSON.stringify(request.retraction_span)
      || attestation.replacement_status_sha256 !== request.replacement_status_sha256
      || JSON.stringify(attestation.replacement_status_span) !== JSON.stringify(request.replacement_status_span)
      || attestation.impact_statement_sha256 !== request.impact_statement_sha256
      || JSON.stringify(attestation.impact_statement_span) !== JSON.stringify(request.impact_statement_span)
      || JSON.stringify(attestation.none_supported_statement_span) !== JSON.stringify(request.none_supported_statement_span)
      || attestation.correction_receipt_sha256 !== request.correction_receipt_sha256
      || attestation.impact_mode !== request.impact_mode
      || attestation.dependency_action !== request.dependency_action
      || !sameUniqueSet(attestation.affected_artifacts, request.affected_artifacts)
      || !sameUniqueSet(attestation.affected_conclusions, request.affected_conclusions)
      || !sameUniqueSet(attestation.resolved_repair_refs, request.repair_evidence_refs)
      || !sameUniqueSet(attestation.resolved_impact_refs, request.impact_evidence_refs)
      || attestation.prior_claim_located !== true
      || attestation.categorical_retraction_verified !== true
      || attestation.replacement_asserted_verified !== true
      || attestation.impact_asserted_verified !== true
      || attestation.no_correction_conflicts_verified !== true
      || attestation.impact_search_verified !== true
      || (affected && attestation.dependency_action_verified !== true)) {
    reject('UNREPAIRED_FALSE_CLAIM', 'The trusted verifier did not resolve the incident, impact search, and dependency state.');
  }
  return correction.retraction_text;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function canonicalOwnerRecords(root = path.resolve(__dirname, '../..')) {
  const htmlPath = path.join(root, 'polymyth/methodologylist/index.html');
  const entries = parseSeedWithAddenda(fs.readFileSync(htmlPath, 'utf8'));
  return entries.map(entry => ({...entry, semantic_sha256: canonicalEntrySha(entry)}));
}

function maskControlLabelProtectedSpans(value) {
  const blank = match => match.replace(/[^\n]/g, ' ');
  return String(value || '')
    .normalize('NFKC')
    .replace(/```[\s\S]*?(?:```|$)/g, blank)
    .replace(/~~~[\s\S]*?(?:~~~|$)/g, blank)
    .replace(/`[^`\n]*`/g, blank)
    .replace(/^\s*>[^\n]*(?:\n|$)/gm, blank)
    .replace(/“[^”\n]*”/g, blank)
    .replace(/‘[^’\n]*’/g, blank)
    .replace(/"(?:\\.|[^"\\\n])*"/g, blank)
    .replace(/'(?:\\.|[^'\\\n])*'/g, blank);
}

function invokesDegorgonifiedFeminism(value) {
  const visible = maskControlLabelProtectedSpans(value);
  const label = /\bdegorgonified[ \t]+feminism\b/ig;
  let match;
  while ((match = label.exec(visible)) !== null) {
    const sentenceStart = Math.max(
      visible.lastIndexOf('.', match.index - 1),
      visible.lastIndexOf('!', match.index - 1),
      visible.lastIndexOf('?', match.index - 1),
      visible.lastIndexOf('\n', match.index - 1),
    ) + 1;
    const nextStops = [
      visible.indexOf('.', match.index + match[0].length),
      visible.indexOf('!', match.index + match[0].length),
      visible.indexOf('?', match.index + match[0].length),
      visible.indexOf('\n', match.index + match[0].length),
    ].filter(index => index >= 0);
    const sentenceEnd = nextStops.length ? Math.min(...nextStops) : visible.length;
    const sentence = visible.slice(sentenceStart, sentenceEnd).toLowerCase();
    const explicitInvocation = /\b(?:activate|apply|bring back|give me|invoke|load|recall|return|run|use)\b[\s\S]{0,120}\bdegorgonified[ \t]+feminism\b/i.test(sentence);
    const sourceOrMetalinguistic = /\b(?:source|text|article|quotation|quote|wording|phrase|label|term)\b[\s\S]{0,100}\b(?:contains?|mentions?|occurs?|occurrence|says?|uses?|reads?|appears?|wording|degorgonified[ \t]+feminism)\b/i.test(sentence)
      || /\b(?:discuss|analy[sz]e|inspect|quote)\b[\s\S]{0,80}\b(?:wording|phrase|label|term)\b/i.test(sentence);
    if (explicitInvocation || !sourceOrMetalinguistic) return true;
  }
  return false;
}

function definitionOwnerMatches(entry, spec) {
  if (!entry || !spec) return false;
  if (spec.id) return entry.id === spec.id;
  return entry.s === spec.section && entry.t === spec.title;
}

function definitionOwnerLocator(owner, spec) {
  return {
    key: spec.key,
    id: owner.id || null,
    section: owner.s || null,
    title: owner.t || null,
    semantic_sha256: canonicalEntrySha(owner),
  };
}

function validateDefinitionBundleSnapshots(supplied, owners) {
  if (supplied === undefined) return;
  if (!Array.isArray(supplied) || supplied.length !== owners.length) {
    reject('STALE_DEFINITION_OWNER_SNAPSHOT', 'Definition-bundle snapshots do not cover the exact current owner set.');
  }
  const byKey = new Map();
  for (const snapshot of supplied) {
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)
        || typeof snapshot.key !== 'string' || byKey.has(snapshot.key)) {
      reject('STALE_DEFINITION_OWNER_SNAPSHOT', 'Definition-bundle snapshots are malformed or duplicate an owner key.');
    }
    byKey.set(snapshot.key, snapshot);
  }
  for (const owner of owners) {
    const snapshot = byKey.get(owner.key);
    if (!snapshot
        || (snapshot.id || null) !== owner.id
        || (snapshot.section || null) !== owner.section
        || (snapshot.title || null) !== owner.title
        || snapshot.semantic_sha256 !== owner.semantic_sha256) {
      reject('STALE_DEFINITION_OWNER_SNAPSHOT', `Definition owner snapshot does not match ${owner.key}.`);
    }
  }
}

function resolveDefinitionBundle(request, ownerRecords) {
  if (!invokesDegorgonifiedFeminism(request.current_message)) return null;
  const owners = [];
  for (const spec of DEGORGONIFIED_FEMINISM_OWNER_SPECS) {
    const matches = ownerRecords.filter(entry => definitionOwnerMatches(entry, spec));
    if (matches.length === 0) {
      reject('MISSING_DEFINITION_OWNER', `Missing degorgonified-feminism owner: ${spec.key}`);
    }
    if (matches.length !== 1) {
      reject('AMBIGUOUS_DEFINITION_OWNER', `Degorgonified-feminism owner is not unique: ${spec.key}`);
    }
    const owner = matches[0];
    const recomputedSha = canonicalEntrySha(owner);
    if ((owner.semantic_sha256 && owner.semantic_sha256 !== recomputedSha)
        || !spec.required.every(needle => String(owner.b || '').includes(needle))) {
      reject('STALE_DEFINITION_OWNER', `Degorgonified-feminism owner is stale or incomplete: ${spec.key}`);
    }
    owners.push(definitionOwnerLocator(owner, spec));
  }
  validateDefinitionBundleSnapshots(request.definition_bundle_snapshots, owners);
  return {
    token: DEGORGONIFIED_FEMINISM_LABEL,
    owner_snapshots: owners,
    output_contract: 'complete-definition-bundle',
  };
}

function normalizedMethodTokens(request) {
  const supplied = request.named_method === undefined
    ? []
    : (Array.isArray(request.named_method) ? request.named_method : [request.named_method]);
  const normalized = supplied.map(value => String(value).trim().toLowerCase()).filter(Boolean);
  if (normalized.length > 1) reject('AMBIGUOUS_NAMED_METHOD', 'More than one named method was supplied.');
  if (normalized.length === 1) return normalized;
  const message = String(request.current_message || '');
  if (/\bouroborosanalyses\b/i.test(message) || /(^|\s)OA(?:\s|$|[.,!?])/i.test(message)) {
    return ['ouroborosanalyses'];
  }
  if (/\bouroborosanalysis\b/i.test(message)) {
    reject('UNKNOWN_NAMED_METHOD', 'The singular back-formation is not a registered method.');
  }
  return [];
}

function resolveNamedMethod(request, ownerRecords) {
  const tokens = normalizedMethodTokens(request);
  if (!tokens.length) return null;
  const ownerId = SUPPORTED_METHODS.get(tokens[0]);
  if (!ownerId) reject('UNKNOWN_NAMED_METHOD', `Unknown named method: ${tokens[0]}`);
  const owners = ownerRecords.filter(entry => entry.id === ownerId);
  if (owners.length === 0) reject('MISSING_METHOD_OWNER', `Missing canonical owner: ${ownerId}`);
  if (owners.length !== 1) reject('AMBIGUOUS_METHOD_OWNER', `Canonical owner is not unique: ${ownerId}`);
  const owner = owners[0];
  const body = String(owner.b || '');
  const paragraphs = body.split(/\n\n+/);
  const required = [
    'TRIGGER AND AUTHORITY.',
    'FOUR STEPS.',
    'OUTPUT CONTRACT.',
    'QUESTION-GENERATION HIJACK.',
    'review the whole conversation',
    'ironmanning all sides',
    'answer every question that can be answered',
    'genuinely unanswerable residue',
    'Zero residue is valid',
  ];
  if (paragraphs.length !== 4 || !required.every(needle => body.includes(needle))) {
    reject('STALE_METHOD_OWNER', `Canonical owner has stale or incomplete form: ${ownerId}`);
  }
  const ownerSha = owner.semantic_sha256 || canonicalEntrySha(owner);
  const snapshot = request.owner_snapshot;
  if (snapshot !== undefined) {
    if (!snapshot || snapshot.id !== ownerId || snapshot.semantic_sha256 !== ownerSha) {
      reject('STALE_OWNER_SNAPSHOT', `Named-method owner snapshot does not match ${ownerId}`);
    }
  }
  return {
    token: 'Ouroborosanalyses',
    owner_id: ownerId,
    owner_semantic_sha256: ownerSha,
    output_contract: 'genuine-residue-only',
  };
}

function inferBloom(request) {
  const message = String(request.current_message || '');
  const textSignal = /\b(?:bloom|layman|npc)\b/i.test(message);
  if (request.mode !== undefined && !['default', 'bloom'].includes(request.mode)) {
    reject('UNKNOWN_REGISTER_MODE', `Unknown register mode: ${request.mode}`);
  }
  if (request.mode === 'default' && textSignal) {
    reject('AMBIGUOUS_REGISTER_MODE', 'Explicit Bloom language conflicts with forced default mode.');
  }
  if (request.mode === 'bloom' && request.bloom_explicit === false) {
    reject('AMBIGUOUS_REGISTER_MODE', 'Bloom mode lacks an explicit current-request trigger.');
  }
  if (request.bloom_explicit !== undefined && typeof request.bloom_explicit !== 'boolean') {
    reject('MALFORMED_REQUEST', 'bloom_explicit must be boolean when supplied.');
  }
  return request.mode === 'bloom' || request.bloom_explicit === true || textSignal;
}

function planRequest(request, options = {}) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    reject('MALFORMED_REQUEST', 'Request must be an object.');
  }
  if (typeof request.ml_active !== 'boolean') {
    reject('ML_ACTIVE_REQUIRED', 'ml_active must be resolved before generation.');
  }
  if (typeof request.current_message !== 'string') {
    reject('MALFORMED_REQUEST', 'current_message must be a string.');
  }
  const ownerRecords = options.owner_records || canonicalOwnerRecords(options.root);
  if (!Array.isArray(ownerRecords)) reject('MALFORMED_OWNER_REGISTRY', 'Owner registry must be an array.');
  const namedMethod = resolveNamedMethod(request, ownerRecords);
  const definitionBundleInvoked = invokesDegorgonifiedFeminism(request.current_message);
  const correctionRequired = correctionRequirement(request);
  if (!request.ml_active) {
    if (namedMethod || definitionBundleInvoked || correctionRequired || request.mode === 'bloom' || request.bloom_explicit === true) {
      reject('ACTIVATION_CONFLICT', 'A project method or register was requested while ML* was marked inactive.');
    }
    const plan = {
      version: PLAN_VERSION,
      ml_active: false,
      mode: 'outside-ml',
      opener: null,
      named_method: null,
      definition_bundle: null,
      correction_required: null,
      current_message_sha256: sha256(request.current_message),
      allow_question_first: Boolean(request.surviving_question),
    };
    plan.integrity_sha256 = sha256(JSON.stringify(plan));
    return deepFreeze(plan);
  }
  const definitionBundle = definitionBundleInvoked
    ? resolveDefinitionBundle(request, ownerRecords)
    : null;
  const bloom = inferBloom(request);
  const plan = {
    version: PLAN_VERSION,
    ml_active: true,
    mode: bloom ? 'bloom' : 'default',
    opener: bloom ? BLOOM_OPENER : DEFAULT_OPENER,
    named_method: namedMethod,
    definition_bundle: definitionBundle,
    correction_required: correctionRequired,
    current_message_sha256: sha256(request.current_message),
    allow_question_first: Boolean(request.surviving_question || namedMethod),
    required_host_calls: ['planRequest:before-generation', 'assertDeliverable:before-delivery'],
  };
  plan.integrity_sha256 = sha256(JSON.stringify(plan));
  return deepFreeze(plan);
}

function verifyPlanIntegrity(plan) {
  if (!plan || typeof plan !== 'object') reject('INVALID_PLAN', 'Missing runtime plan.');
  const clone = {...plan};
  const supplied = clone.integrity_sha256;
  delete clone.integrity_sha256;
  if (!/^[0-9a-f]{64}$/.test(String(supplied || '')) || sha256(JSON.stringify(clone)) !== supplied) {
    reject('PLAN_INTEGRITY_FAILURE', 'Runtime plan was altered after pre-generation planning.');
  }
}

function validateFusion(body, evidence) {
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)
      || Object.keys(evidence).length === 0) {
    reject('MISSING_GATE_EVIDENCE', 'Delivery evidence is required.');
  }
  if (!String(evidence.task_answer || '').trim() || !body.includes(evidence.task_answer)) {
    reject('MISSING_TASK_ANSWER', 'The verified task answer is absent from the draft.');
  }
  const evidenceStates = new Set(['verified', 'source-grounded', 'user-supplied', 'no-factual-claim']);
  if (!evidenceStates.has(evidence.evidence_status)) {
    reject('UNGROUNDED_DATA', 'Data evidence status is missing or ungrounded.');
  }
  if (evidence.evidence_status !== 'no-factual-claim'
      && (!Array.isArray(evidence.data_basis) || !evidence.data_basis.length)) {
    reject('UNGROUNDED_DATA', 'Grounded factual output requires at least one evidence basis.');
  }
  const mephistoStates = new Set([
    'warranted-opposition', 'warranted-complication', 'warranted-irony', 'no-defect',
  ]);
  if (!mephistoStates.has(evidence.mephisto_status)) {
    reject('MISSING_MEPHISTO_FUSION', 'Mephisto status is missing.');
  }
  if (evidence.mephisto_status === 'no-defect') {
    if (!String(evidence.no_defect_basis || '').trim() || !body.includes(evidence.no_defect_basis)) {
      reject('MISSING_NO_DEFECT_BASIS', 'No-defect output lacks its grounded basis.');
    }
  } else if (!String(evidence.opposition_basis || '').trim()
      || !body.includes(evidence.opposition_basis)
      || evidence.opposition_supported !== true) {
    reject('INVENTED_OPPOSITION', 'Opposition or complication is unsupported by the delivery evidence.');
  }
}

function normalizeDefinitionBundleText(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function validateDegorgonifiedFeminismBundle(body) {
  const text = normalizeDefinitionBundleText(body);
  const visibleAssertions = normalizeDefinitionBundleText(maskControlLabelProtectedSpans(body));
  const contradictions = [
    {
      id: 'clean-subtype',
      test: /\bdegorgonified feminism\s+(?:is|means|names|identifies)\s+(?:an?\s+)?(?:clean|good|innocent|uncorrupted|proper|true)\b/,
    },
    {
      id: 'wikipedia-authority',
      test: /\bwikipedia\s+(?:is|provides|supplies|serves as|will be)\s+(?:an?\s+|the\s+)?(?:governing\s+)?(?:definition|ontology|evidence|answer|authority)\b/,
    },
    {
      id: 'white-feminism-conditional',
      test: /\bwhite feminism\b.{0,100}\b(?:is|becomes|counts as)\b.{0,60}\bwhen it\b/,
    },
    {
      id: 'slavery-equivalence',
      test: /\bslavery\s+(?:is|equals|is equivalent to)\s+(?:the\s+)?patriarchy\b|\bshared mechanism\b.{0,60}\b(?:establishes|proves|means)\b.{0,30}\bequivalence\b/,
    },
    {
      id: 'user-explanation-collapse',
      test: /\buser(?:'s)? explanation\b.{0,80}\b(?:is|becomes|therefore)\b.{0,30}\bpublic (?:essay )?thesis\b/,
    },
    {
      id: 'critic-authority-collapse',
      test: /\bcritic(?:'s)? (?:verdict|claim|view)\b.{0,80}\b(?:defines|governs|settles)\b.{0,30}\bproject\b/,
    },
    {
      id: 'assistant-authorship-collapse',
      test: /\bassistant(?:-authored)? (?:bridge|paraphrase|claim)\b.{0,80}\b(?:is|becomes|counts as)\b.{0,30}\buser(?:'s)? (?:claim|thesis)\b/,
    },
    {
      id: 'mixed-authority-upgrade',
      test: /\b(?:assistant (?:extension|operationalization)|private instruction|unresolved material)\b.{0,100}\b(?:is|becomes|counts as|therefore)\b.{0,40}\b(?:direct user ruling|public user claim|settled user claim)\b/,
    },
  ];
  const contradiction = contradictions.find(rule => rule.test.test(visibleAssertions));
  if (contradiction) {
    reject('DEFINITION_BUNDLE_CONTRADICTION', `Degorgonified feminism contradicts the current bundle at ${contradiction.id}.`);
  }

  const includes = needle => text.includes(needle);
  const matches = pattern => pattern.test(text);
  const requirements = [
    ['control-label', includes(DEGORGONIFIED_FEMINISM_LABEL)
      && matches(/\b(?:recall|retrieval|control) label\b/)
      && matches(/\b(?:does not|doesn't|never)\b.{0,50}\b(?:clean|innocent)\b.{0,30}\b(?:subtype|genus|feminism)\b/)],
    ['people-and-creed', matches(/\bwomen\b.{0,80}\b(?:people|flock)\b/)
      && matches(/\bfeminism\b.{0,80}\b(?:creed|governing formation|governing architecture|doctrine)\b/)],
    ['self-description', matches(/\b(?:self-description|self-identification|calling (?:oneself|someone) feminist)\b/)
      && matches(/\b(?:does not|doesn't|cannot|never)\b.{0,80}\b(?:prove|establish|decide)\b.{0,80}\b(?:root|premise|architecture|classification)\b/)],
    ['two-roots', includes('the personal is political')
      && includes('standpoint epistemology')
      && matches(/\bpolitical jurisdiction\b/)
      && matches(/\b(?:credibility|authority|epistemic rank|veto)\b/)],
    ['emotional-labor-pricing', matches(/\bvernacular emotional[- ]labor\b/)
      && matches(/\b(?:price|prices|pricing)\b.{0,140}\b(?:listening|teaching|forgiving|care|presence|reciprocity|responsibility)\b/)
      && matches(/\b(?:commodif\w*|mutual obligation|responsibility transfer|gorgonwars)\b/)],
    ['direct-evidence', matches(/\bdirect (?:premise )?evidence\b/)
      && matches(/\b(?:identity|testimony|positionality|situated evidence)\b.{0,120}\b(?:do not|does not|doesn't|cannot|never)\b.{0,50}\b(?:prove|decide|establish)\b/)],
    ['three-way-classifier', matches(/\b(?:excommunicable\s*\/\s*outside|outside\s*\/\s*excommunicable|excommunicable or outside)\b/)
      && includes('internal gorgonwars')
      && includes('unresolved')
      && matches(/\b(?:reject|rejects|rejecting)\b.{0,120}\broot\b/)
      && matches(/\b(?:retain|retains|retaining)\b.{0,120}\b(?:both|two)\b.{0,80}\broot/)],
    ['white-feminism', includes('white feminism')
      && matches(/\balways\b.{0,70}\bqualifier-gorgonification\b|\bqualifier-gorgonification\b.{0,70}\balways\b/)
      && matches(/\b(?:concrete|named)\b.{0,60}\b(?:actor|allegation|institution|law|action|relation)\w*\b/)
      && matches(/\b(?:test|evidence|assess)\w*\b.{0,100}\b(?:separate|independent)\w*\b|\b(?:separate|independent)\w*\b.{0,100}\b(?:test|evidence|assess)\w*\b/)],
    ['other-subtypes', matches(/\b(?:other|additional) (?:feminist )?subtype\b|\bcarceral feminism\b/)
      && matches(/\baudit\w*\b/)
      && matches(/\b(?:not|never)\b.{0,80}\b(?:universal|direct) user ruling\b|\bdoes not declare\b.{0,80}\bevery\b/)],
    ['retired-qualifier', includes('gorgonified feminism')
      && matches(/\bgorgonified feminism\b.{0,60}\b(?:is|remains) retired\b|\bretired\b.{0,60}\bgorgonified feminism\b/)],
    ['arendtianfeminism-separation', includes('arendtianfeminism')
      && matches(/\b(?:distinct|separate)\b.{0,60}\b(?:exit|coinage)\b|\b(?:exit|coinage)\b.{0,60}\b(?:distinct|separate)\b/)
      && matches(/\b(?:not|never)\b.{0,50}\b(?:synonym|same)\b/)],
    ['slavery-and-patriarchy', includes('slavery is not patriarchy')
      && matches(/\b(?:define|reconstruct)\w*\b.{0,100}\bseparate\w*\b|\bseparate\w*\b.{0,100}\b(?:define|reconstruct)\w*\b/)
      && matches(/\b(?:shared mechanism|source(?:'s)? (?:equation|assertion)|intersection|analogy)\b.{0,120}\b(?:does not|doesn't|cannot|never)\b.{0,50}\b(?:establish|prove)\b.{0,40}\b(?:identity|equivalence)\b/)],
    ['gorgon-imagery', matches(/\b(?:gorgon|medusa) imagery\b/)
      && matches(/\breal women\b.{0,80}\battack\w*\b|\battack\w*\b.{0,80}\breal women\b/)
      && matches(/\b(?:do not|does not|doesn't|cannot|never)\b.{0,100}\b(?:collapse|equate|identify)\w*\b.{0,80}\b(?:women|feminism)\b/)],
    ['academia-field', matches(/\bacademia\b.{0,100}\bgorgonified\b|\bgorgonified\b.{0,100}\bacademia\b/)
      && matches(/\b(?:field|research object|part of the object)\b/)
      && matches(/\b(?:not|never)\b.{0,80}\bevery\b.{0,50}\b(?:work|institution)\b/)],
    ['query-audit', matches(/\b(?:query|search) (?:term|vocabular|categor)\w*\b.{0,100}\b(?:audit|presuppos|preclassif)\w*\b|\baudit\w*\b.{0,100}\b(?:query|search) (?:term|vocabular|categor)\w*\b/)
      && matches(/\b(?:reconstruct|define)\w*\b.{0,100}\bbottom-up\b|\bbottom-up\b.{0,100}\b(?:reconstruct|define)\w*\b/)
      && matches(/\b(?:primary|original) (?:work|source|scholarship)\w*\b/)
      && matches(/\b(?:direct )?criti(?:c|que)s?\b/)
      && matches(/\bcounterarguments\b.{0,100}\bcounters?\b|\bcounters?\b.{0,100}\bcounterarguments\b/)],
    ['source-architecture-separation', matches(/\bsource(?:'s)? (?:claim|argument|report)\b/)
      && matches(/\b(?:architectural classification|polymyth (?:classification|inference|reading))\b/)
      && matches(/\b(?:separate|distinct)\b.{0,80}\b(?:record|ledger)\w*\b/)],
    ['four-way-provenance', matches(/\buser-authored\b.{0,50}\b(?:adopted )?(?:claim|thesis)\b/)
      && matches(/\buser(?:'s)? (?:explanation|correction|task instruction)\b/)
      && matches(/\bcritic(?:'s)? (?:argument|evidence)\b/)
      && matches(/\bassistant(?:-authored)? (?:rhetoric|bridge|paraphrase|interpretive defect|search-framing)\b/)
      && matches(/\b(?:four|separate|distinct)\b.{0,80}\b(?:record|ledger|provenance)\w*\b/)],
    ['mixed-authority-levels', matches(/\bdirect user ruling\w*\b/)
      && matches(/\bpolymyth (?:definition|inference)\w*\b/)
      && matches(/\bassistant (?:operational )?extension\w*\b/)
      && matches(/\bexternal source (?:claim|report)\w*\b/)
      && matches(/\bunresolved material\b/)
      && matches(/\b(?:retain|keep|preserve)\w*\b.{0,100}\b(?:authority|provenance|status)\b/)],
    ['critic-nonauthority', matches(/\bcritic\b.{0,100}\b(?:argument|evidence)\b/)
      && matches(/\bcritic\b.{0,100}\b(?:is not|isn't|never becomes|has no automatic)\b.{0,50}\bauthority\b/)],
    ['private-source', matches(/\b(?:unpublished|private) mephistodata\b/)
      && matches(/\b(?:do not|does not|doesn't|never|must not)\b.{0,80}\bcit(?:e|ed|ation)\w*\b|\bnot\b.{0,50}\bpublic authority\b/)
      && matches(/\bauthori[sz]ed (?:argument )?points?\b/)
      && matches(/\b(?:public|primary) (?:source|evidence|work)\b.{0,100}\bfactual claim\w*\b|\bfactual claim\w*\b.{0,100}\b(?:public|primary) (?:source|evidence|work)\b/)],
    ['wikipedia-ban', includes('wikipedia')
      && matches(/\b(?:inadmissible|banned|not admissible)\b/)
      && matches(/\b(?:definition|ontology|evidence|answer)\b/)],
    ['pentagram-unresolved', matches(/\bunrecovered pentagram (?:screenshot )?list\b/)
      && matches(/\bremains unresolved\b/)
      && matches(/\b(?:cannot|may not|must not|never)\b.{0,80}\breconstruct\w*\b.{0,100}\bassistant summar\w*\b/)],
  ];
  const missing = requirements.filter(([, passed]) => !passed).map(([id]) => id);
  if (missing.length) {
    reject('INCOMPLETE_DEFINITION_BUNDLE', `Degorgonified feminism omitted required dimensions: ${missing.join(', ')}.`);
  }
}

function validateOuroboros(body, trace) {
  if (!trace || typeof trace !== 'object') reject('MISSING_OUROBOROS_TRACE', 'Ouroborosanalyses requires a trace.');
  if (!sameUniqueSet(trace.conversation_ids, trace.reviewed_ids)) {
    reject('INCOMPLETE_WHOLE_CONVERSATION_REVIEW', 'The whole conversation set was not reviewed exactly once.');
  }
  if (!Array.isArray(trace.issues)) reject('MALFORMED_OUROBOROS_TRACE', 'Issues must be an array.');
  const seen = new Set();
  const residue = [];
  for (const issue of trace.issues) {
    if (!issue || !issue.id || seen.has(issue.id) || !String(issue.question || '').trim()) {
      reject('MALFORMED_OUROBOROS_TRACE', 'Every issue requires a unique id and question.');
    }
    seen.add(issue.id);
    if (!Array.isArray(issue.positions) || new Set(issue.positions.filter(Boolean)).size < 2) {
      reject('FAILED_IRONMAN', `Issue ${issue.id} does not preserve opposing positions.`);
    }
    if (typeof issue.answerable !== 'boolean') reject('MALFORMED_OUROBOROS_TRACE', 'answerable must be boolean.');
    if (issue.answerable) {
      if (!String(issue.answer || '').trim() || issue.residue_text) {
        reject('ANSWERABLE_ISSUE_IN_RESIDUE', `Answerable issue ${issue.id} was not removed.`);
      }
    } else {
      if (issue.answer || !String(issue.unanswerable_basis || '').trim() || !String(issue.residue_text || '').trim()) {
        reject('UNSUPPORTED_RESIDUE', `Residue ${issue.id} lacks an unanswerable basis.`);
      }
      residue.push(issue.residue_text.trim());
    }
  }
  const expected = residue.length ? residue.join('\n') : 'Zero genuine unanswerables remain.';
  if (body !== expected) reject('NON_RESIDUE_OUTPUT', 'Ouroborosanalyses delivery contains material outside genuine residue.');
}

function firstSentenceIsQuestion(body) {
  const match = body.match(/^([\s\S]*?[.!?])(?:\s|$)/);
  return Boolean(match && match[1].trim().endsWith('?'));
}

function assertDeliverableWithTrust(plan, draft, evidence = {}, trust = null) {
  verifyPlanIntegrity(plan);
  if (typeof draft !== 'string' || !draft.trim()) reject('EMPTY_DRAFT', 'Draft is empty.');
  const draftScan = validateDraftWorkStatusScan(plan, draft, evidence, trust);
  if (!plan.ml_active) {
    if (draft.includes(DEFAULT_OPENER) || draft.includes(BLOOM_OPENER)) {
      reject('OUTSIDE_ML_OPENER', 'Project opener appeared outside ML*.');
    }
    return deepFreeze({ok: true, mode: plan.mode, draft_sha256: sha256(draft)});
  }
  if (!draft.startsWith(plan.opener)) reject('WRONG_OR_DELAYED_OPENER', 'Required opener is absent from byte zero.');
  const openerCount = countOccurrences(draft, DEFAULT_OPENER) + countOccurrences(draft, BLOOM_OPENER);
  if (openerCount !== 1) reject('DUPLICATE_OPENER', 'Exactly one control opener is required.');
  const body = draft.slice(plan.opener.length).trim();
  if (!body) reject('PREFIX_ONLY_DRAFT', 'The opener cannot substitute for the requested act.');
  if (plan.mode === 'bloom' && !plan.allow_question_first && firstSentenceIsQuestion(body)) {
    reject('BLOOM_QUESTION_FIRST', 'Conversational Bloom must answer directly unless a genuine question survives.');
  }
  validateFusion(body, evidence);
  if (plan.definition_bundle && plan.definition_bundle.token === DEGORGONIFIED_FEMINISM_LABEL) {
    validateDegorgonifiedFeminismBundle(body);
  }
  const deliveryContext = deepFreeze({
    plan_integrity_sha256: plan.integrity_sha256,
    draft_sha256: sha256(draft),
    draft_bytes: draft,
    body_bytes: body,
  });
  const correctionRetraction = validateFalseClaimCorrection(plan, body, evidence, trust, deliveryContext);
  validateCompletionClaims(body, evidence, correctionRetraction ? [correctionRetraction] : [], trust, deliveryContext, draftScan);
  if (plan.named_method && plan.named_method.owner_id === OUROBOROS_OWNER) {
    validateOuroboros(body, evidence.ouroboros);
  }
  if (draftScan.unsupported_claim_ids.length) {
    reject('UNSUPPORTED_DRAFT_WORK_STATUS', 'The host-classified work-status claim lacks a supported evidence verdict.');
  }
  return deepFreeze({
    ok: true,
    mode: plan.mode,
    named_method: plan.named_method ? plan.named_method.token : null,
    definition_bundle: plan.definition_bundle ? plan.definition_bundle.token : null,
    draft_sha256: sha256(draft),
  });
}

function createRuntimeGate(configuration = {}) {
  if (!configuration || typeof configuration !== 'object' || Array.isArray(configuration)) {
    reject('MALFORMED_TRUST_BOOTSTRAP', 'Runtime trust bootstrap must be an object.');
  }
  const workVerifier = typeof configuration.verifyWorkAttestation === 'function'
    ? configuration.verifyWorkAttestation
    : null;
  const correctionVerifier = typeof configuration.verifyCorrectionAttestation === 'function'
    ? configuration.verifyCorrectionAttestation
    : null;
  const draftVerifier = typeof configuration.verifyDraftWorkStatusAttestation === 'function'
    ? configuration.verifyDraftWorkStatusAttestation
    : null;
  const workVerifierId = workVerifier && String(configuration.workVerifierId || '').trim();
  const correctionVerifierId = correctionVerifier && String(configuration.correctionVerifierId || '').trim();
  const draftVerifierId = draftVerifier && String(configuration.draftVerifierId || '').trim();
  if ((workVerifier && !workVerifierId) || (correctionVerifier && !correctionVerifierId)
      || (draftVerifier && !draftVerifierId)) {
    reject('MALFORMED_TRUST_BOOTSTRAP', 'Each bootstrap verifier requires one exact immutable verifier identity.');
  }
  const trust = Object.freeze({
    verifyWorkAttestation: workVerifier,
    verifyCorrectionAttestation: correctionVerifier,
    verifyDraftWorkStatusAttestation: draftVerifier,
    workVerifierId: workVerifierId || null,
    correctionVerifierId: correctionVerifierId || null,
    draftVerifierId: draftVerifierId || null,
  });
  return Object.freeze({
    assertDeliverable(plan, draft, evidence = {}) {
      if (arguments.length > 3) {
        reject('CALLER_SUPPLIED_TRUST_ROOT', 'Per-delivery verifier or trust-root injection is forbidden.');
      }
      return assertDeliverableWithTrust(plan, draft, evidence, trust);
    },
  });
}

const DEFAULT_RUNTIME_GATE = createRuntimeGate();

function assertDeliverable(plan, draft, evidence = {}) {
  if (arguments.length > 3) {
    reject('CALLER_SUPPLIED_TRUST_ROOT', 'Per-delivery verifier or trust-root injection is forbidden.');
  }
  return DEFAULT_RUNTIME_GATE.assertDeliverable(plan, draft, evidence);
}

module.exports = {
  BLOOM_OPENER,
  DEGORGONIFIED_FEMINISM_LABEL,
  DEGORGONIFIED_FEMINISM_OWNER_SPECS,
  DEFAULT_OPENER,
  MephistodataGateError,
  OUROBOROS_OWNER,
  PLAN_VERSION,
  CORRECTION_ATTESTATION_SCHEMA,
  DRAFT_SCAN_ATTESTATION_SCHEMA,
  WORK_ATTESTATION_SCHEMA,
  assertDeliverable,
  canonicalEntrySha,
  canonicalOwnerRecords,
  createRuntimeGate,
  definitionOwnerMatches,
  invokesDegorgonifiedFeminism,
  isCategoricalRetraction,
  standaloneAssertedStatementSpan,
  localDraftClaimBindings,
  parseWorkStatusClaims,
  planRequest,
};
