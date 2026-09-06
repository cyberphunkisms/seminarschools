'use strict';

const STOPWORDS = new Set([
  'a', 'about', 'after', 'again', 'against', 'all', 'also', 'am', 'an', 'and',
  'any', 'are', 'as', 'at', 'be', 'because', 'been', 'before', 'being', 'between',
  'both', 'but', 'by', 'can', 'could', 'did', 'do', 'does', 'doing', 'each',
  'for', 'from', 'further', 'had', 'has', 'have', 'having', 'he', 'her', 'here',
  'hers', 'herself', 'him', 'himself', 'his', 'how', 'i', 'if', 'in', 'into',
  'is', 'it', 'its', 'itself', 'me', 'more', 'most', 'my', 'myself', 'no',
  'nor', 'not', 'of', 'on', 'once', 'only', 'or', 'other', 'our', 'ours',
  'ourselves', 'out', 'over', 'own', 'same', 'she', 'should', 'so', 'some',
  'such', 'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves',
  'then', 'there', 'these', 'they', 'this', 'those', 'through', 'to', 'too',
  'under', 'until', 'up', 'very', 'was', 'we', 'were', 'what', 'when', 'where',
  'which', 'while', 'who', 'whom', 'why', 'will', 'with', 'would', 'you',
  'your', 'yours', 'yourself', 'yourselves',
]);

const DETECTOR_CODES = Object.freeze({
  LEXICAL_REPETITION: 'W24_LEXICAL_REPETITION',
  EMPTY_METHOD_LABEL: 'W29_EMPTY_METHOD_LABEL',
  VAGUE_METANOUN: 'W29_VAGUE_METANOUN',
  APPOSITIVE_CANDIDATE: 'W40_APPOSITIVE_CANDIDATE',
  STACCATO_CLUSTER: 'W42_STACCATO_CLUSTER',
  METRONOMIC_RHYTHM: 'W47_METRONOMIC_RHYTHM',
  PUNCT_COLON: 'W51_PUNCT_COLON',
  PUNCT_SEMICOLON: 'W52_PUNCT_SEMICOLON',
  PUNCT_EM_DASH: 'W53_PUNCT_EM_DASH',
  PUNCT_EN_DASH: 'W53_PUNCT_EN_DASH',
  PUNCT_DASH_ATTACH: 'W53_PUNCT_DASH_ATTACH',
  PUNCT_NUMERIC_RANGE: 'W53_PUNCT_NUMERIC_RANGE',
  CONTRAST_NOT_BUT: 'W55_CONTRAST_NOT_BUT',
  CONTRAST_ESCALATION: 'W56_CONTRAST_ESCALATION',
  CONTRAST_X_NOT_Y: 'W56_CONTRAST_X_NOT_Y',
  CONTRAST_LESS_THAN: 'W56_CONTRAST_LESS_THAN',
  CONTRAST_FAR_FROM: 'W56_CONTRAST_FAR_FROM',
  CONTRAST_POINT_REVEAL: 'W56_CONTRAST_POINT_REVEAL',
  CONTRAST_PARALLEL_REVEAL: 'W56_CONTRAST_PARALLEL_REVEAL',
  MIC_DROP_FRAGMENT: 'W61_MIC_DROP_FRAGMENT',
  META_ANNOUNCEMENT: 'W65_META_ANNOUNCEMENT',
  PROCESS_NARRATION: 'W67_PROCESS_NARRATION',
  TOPIC_CONTINUITY: 'W33_TOPIC_CONTINUITY',
  SOURCE_GROUNDING: 'W11_SOURCE_GROUNDING',
  REVISION_LOCALITY: 'W05_REVISION_LOCALITY',
  APPLICATION_SPECIFICITY: 'W77_APPLICATION_SPECIFICITY',
  CLAUSE_NOVELTY: 'W18_CLAUSE_NOVELTY',
  TAUTOLOGICAL_CONSEQUENCE: 'W21_TAUTOLOGICAL_CONSEQUENCE',
  DISTINCTIVENESS: 'W26_DISTINCTIVENESS',
  STUDENT_INTERIORITY: 'W13_STUDENT_INTERIORITY',
  INVENTED_BRIDGE: 'W37_INVENTED_BRIDGE',
  OBVIOUSNESS: 'W32_OBVIOUSNESS',
  PLAN_SCHEMA: 'W01_PLAN_SCHEMA',
});

const RULE_FAMILIES = Object.freeze([
  'protected_spans',
  'lexical_repetition',
  'punctuation',
  'contrast_forms',
  'vague_metanouns',
  'meta_framing',
  'rhythm',
  'appositive_candidates',
  'topic_continuity',
  'source_grounding',
  'revision_locality',
  'application_specificity',
  'clause_novelty',
  'distinctiveness',
  'student_interiority',
  'invented_bridges',
  'obviousness',
]);

const RULE_ID_BY_CODE = Object.freeze({
  [DETECTOR_CODES.LEXICAL_REPETITION]: 'W24',
  [DETECTOR_CODES.EMPTY_METHOD_LABEL]: 'W29',
  [DETECTOR_CODES.VAGUE_METANOUN]: 'W29',
  [DETECTOR_CODES.APPOSITIVE_CANDIDATE]: 'W40',
  [DETECTOR_CODES.STACCATO_CLUSTER]: 'W42',
  [DETECTOR_CODES.METRONOMIC_RHYTHM]: 'W47',
  [DETECTOR_CODES.PUNCT_COLON]: 'W51',
  [DETECTOR_CODES.PUNCT_SEMICOLON]: 'W52',
  [DETECTOR_CODES.PUNCT_EM_DASH]: 'W53',
  [DETECTOR_CODES.PUNCT_EN_DASH]: 'W53',
  [DETECTOR_CODES.PUNCT_DASH_ATTACH]: 'W53',
  [DETECTOR_CODES.PUNCT_NUMERIC_RANGE]: 'W53',
  [DETECTOR_CODES.CONTRAST_NOT_BUT]: 'W55',
  [DETECTOR_CODES.CONTRAST_ESCALATION]: 'W56',
  [DETECTOR_CODES.CONTRAST_X_NOT_Y]: 'W56',
  [DETECTOR_CODES.CONTRAST_LESS_THAN]: 'W56',
  [DETECTOR_CODES.CONTRAST_FAR_FROM]: 'W56',
  [DETECTOR_CODES.CONTRAST_POINT_REVEAL]: 'W56',
  [DETECTOR_CODES.CONTRAST_PARALLEL_REVEAL]: 'W56',
  [DETECTOR_CODES.MIC_DROP_FRAGMENT]: 'W61',
  [DETECTOR_CODES.META_ANNOUNCEMENT]: 'W65',
  [DETECTOR_CODES.PROCESS_NARRATION]: 'W67',
  [DETECTOR_CODES.TOPIC_CONTINUITY]: 'W33',
  [DETECTOR_CODES.SOURCE_GROUNDING]: 'W11',
  [DETECTOR_CODES.REVISION_LOCALITY]: 'W05',
  [DETECTOR_CODES.APPLICATION_SPECIFICITY]: 'W77',
  [DETECTOR_CODES.CLAUSE_NOVELTY]: 'W18',
  [DETECTOR_CODES.TAUTOLOGICAL_CONSEQUENCE]: 'W21',
  [DETECTOR_CODES.DISTINCTIVENESS]: 'W26',
  [DETECTOR_CODES.STUDENT_INTERIORITY]: 'W13',
  [DETECTOR_CODES.INVENTED_BRIDGE]: 'W37',
  [DETECTOR_CODES.OBVIOUSNESS]: 'W32',
  [DETECTOR_CODES.PLAN_SCHEMA]: 'W01',
});

const SENTENCE_SEGMENTER = new Intl.Segmenter('en', {granularity: 'sentence'});
const WORD_SEGMENTER = new Intl.Segmenter('en', {granularity: 'word'});

function findOccurrences(text, match) {
  const occurrences = [];
  let cursor = 0;
  while (cursor <= text.length - match.length) {
    const index = text.indexOf(match, cursor);
    if (index < 0) break;
    occurrences.push(index);
    cursor = index + Math.max(match.length, 1);
  }
  return occurrences;
}

function normalizeProtectedSpans(text, protectedSpans = []) {
  if (!Array.isArray(protectedSpans)) throw new TypeError('protectedSpans must be an array');
  const resolved = protectedSpans.map((raw, index) => {
    if (!raw || typeof raw !== 'object') throw new TypeError(`protected span ${index} must be an object`);
    let start = raw.start;
    let end = raw.end;
    if (!Number.isInteger(start) || !Number.isInteger(end)) {
      const match = String(raw.match || '');
      if (!match) throw new TypeError(`protected span ${index} needs start and end or a nonempty match`);
      const occurrences = findOccurrences(text, match);
      if (!occurrences.length) throw new RangeError(`protected span ${index} match was not found`);
      if (raw.occurrence === undefined && occurrences.length !== 1) {
        throw new RangeError(`protected span ${index} match is ambiguous`);
      }
      const occurrence = raw.occurrence === undefined ? 1 : raw.occurrence;
      if (!Number.isInteger(occurrence) || occurrence < 1 || occurrence > occurrences.length) {
        throw new RangeError(`protected span ${index} occurrence is out of range`);
      }
      start = occurrences[occurrence - 1];
      end = start + match.length;
    }
    if (start < 0 || end <= start || end > text.length) {
      throw new RangeError(`protected span ${index} has invalid half-open bounds`);
    }
    if (raw.match && text.slice(start, end) !== raw.match) {
      throw new RangeError(`protected span ${index} does not match the selected text`);
    }
    return Object.freeze({
      start,
      end,
      kind: String(raw.kind || 'verbatim'),
      sourceId: raw.sourceId === undefined ? null : String(raw.sourceId),
    });
  }).sort((left, right) => left.start - right.start || left.end - right.end);

  for (let index = 1; index < resolved.length; index += 1) {
    if (resolved[index].start < resolved[index - 1].end) {
      throw new RangeError('protected spans must not overlap');
    }
  }
  return resolved;
}

function overlapsProtected(start, end, protectedSpans) {
  return protectedSpans.some(span => start < span.end && end > span.start);
}

function maskProtected(text, protectedSpans) {
  const characters = text.split('');
  for (const span of protectedSpans) {
    for (let index = span.start; index < span.end; index += 1) {
      if (characters[index] !== '\n' && characters[index] !== '\r') characters[index] = ' ';
    }
  }
  return characters.join('');
}

function segmentSentences(text) {
  const sentences = [...SENTENCE_SEGMENTER.segment(text)].map((part, sentenceIndex) => ({
    sentenceIndex,
    start: part.index,
    end: part.index + part.segment.length,
    text: part.segment,
  }));
  if (!sentences.length && text.length) {
    return [{sentenceIndex: 0, start: 0, end: text.length, text}];
  }
  return sentences;
}

function sentenceIndexAt(sentences, position) {
  const found = sentences.find(sentence => position >= sentence.start && position < sentence.end);
  if (found) return found.sentenceIndex;
  return sentences.length ? sentences.at(-1).sentenceIndex : 0;
}

function makeIssue(text, sentences, code, start, end, suggestion, sentenceIndex) {
  const safeStart = Math.max(0, Math.min(text.length, Number.isInteger(start) ? start : 0));
  const safeEnd = Math.max(safeStart, Math.min(text.length, Number.isInteger(end) ? end : safeStart));
  return {
    ruleId: RULE_ID_BY_CODE[code] || 'W01',
    code,
    start: safeStart,
    end: safeEnd,
    sentenceIndex: Number.isInteger(sentenceIndex)
      ? sentenceIndex
      : sentenceIndexAt(sentences, safeStart),
    span: text.slice(safeStart, safeEnd),
    suggestion: String(suggestion || 'Review this span against the current writing owner.'),
  };
}

function wordsInSentence(sentence, protectedSpans) {
  const words = [];
  for (const part of WORD_SEGMENTER.segment(sentence.text)) {
    if (!part.isWordLike) continue;
    const start = sentence.start + part.index;
    const end = start + part.segment.length;
    if (overlapsProtected(start, end, protectedSpans)) continue;
    words.push({text: part.segment, start, end});
  }
  return words;
}

function contentLemma(word) {
  let normalized = word.normalize('NFKC').toLocaleLowerCase('en').replace(/[’']/g, '');
  if (normalized.length > 4 && normalized.endsWith('ies')) normalized = `${normalized.slice(0, -3)}y`;
  else if (
    normalized.length > 4
    && normalized.endsWith('s')
    && !normalized.endsWith('ss')
    && !normalized.endsWith('us')
    && !normalized.endsWith('is')
  ) normalized = normalized.slice(0, -1);
  return normalized;
}

function collectRegexIssues({
  text,
  masked,
  sentences,
  regex,
  code,
  suggestion,
  issues,
  occupied = [],
}) {
  regex.lastIndex = 0;
  let match;
  while ((match = regex.exec(masked)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (!occupied.some(span => start < span.end && end > span.start)) {
      issues.push(makeIssue(text, sentences, code, start, end, suggestion));
      occupied.push({start, end});
    }
    if (!match[0].length) regex.lastIndex += 1;
  }
  return occupied;
}

function lintPunctuation(text, masked, sentences, issues) {
  const punctuation = {
    ':': [DETECTOR_CODES.PUNCT_COLON, 'Rewrite the authored sentence without a colon.'],
    ';': [DETECTOR_CODES.PUNCT_SEMICOLON, 'Rewrite the authored sentence without a semicolon.'],
    '\u2014': [DETECTOR_CODES.PUNCT_EM_DASH, 'Rewrite the authored sentence without an em dash.'],
    '\u2013': [DETECTOR_CODES.PUNCT_EN_DASH, 'Rewrite the authored sentence without an en dash.'],
  };
  for (let index = 0; index < masked.length; index += 1) {
    const entry = punctuation[masked[index]];
    if (!entry) continue;
    issues.push(makeIssue(text, sentences, entry[0], index, index + 1, entry[1]));
  }
  for (let index = 0; index < masked.length; index += 1) {
    if (masked[index] !== '-') continue;
    const before = index > 0 ? masked[index - 1] : '';
    const after = index + 1 < masked.length ? masked[index + 1] : '';
    if (/\d/.test(before) && /\d/.test(after)) {
      issues.push(makeIssue(
        text,
        sentences,
        DETECTOR_CODES.PUNCT_NUMERIC_RANGE,
        index,
        index + 1,
        'Write an authored numeric range with words or protect the exact source span that requires this form.',
      ));
    } else if (/\s/.test(before) || /\s/.test(after)) {
      issues.push(makeIssue(
        text,
        sentences,
        DETECTOR_CODES.PUNCT_DASH_ATTACH,
        index,
        index + 1,
        'Rewrite the attached clause without a dash. Keep lexical hyphens only where they belong inside a word.',
      ));
    }
  }
}

function lintLexicalRepetition(text, sentences, protectedSpans, allowedRepeatedLemmas, issues) {
  const allowed = new Set([...allowedRepeatedLemmas].map(contentLemma));
  for (const sentence of sentences) {
    const byLemma = new Map();
    for (const word of wordsInSentence(sentence, protectedSpans)) {
      const lemma = contentLemma(word.text);
      if (lemma.length < 4 || STOPWORDS.has(lemma) || allowed.has(lemma)) continue;
      if (!byLemma.has(lemma)) byLemma.set(lemma, []);
      byLemma.get(lemma).push(word);
    }
    for (const [lemma, occurrences] of byLemma) {
      if (occurrences.length < 2) continue;
      issues.push(makeIssue(
        text,
        sentences,
        DETECTOR_CODES.LEXICAL_REPETITION,
        occurrences[0].start,
        occurrences.at(-1).end,
        `Remove or restructure the repeated content lemma “${lemma}”. Preserve both uses only when the precise term is necessary.`,
        sentence.sentenceIndex,
      ));
    }
  }
}

function lintContrastForms(text, masked, sentences, issues) {
  const occupied = [];
  collectRegexIssues({
    text,
    masked,
    sentences,
    regex: /\bnot\s+(?:only|merely|just|simply)\b[^.!?\n]{1,120}\bbut(?:\s+also)?\b/giu,
    code: DETECTOR_CODES.CONTRAST_ESCALATION,
    suggestion: 'State the substantive relation directly without staged contrast or escalation.',
    issues,
    occupied,
  });
  collectRegexIssues({
    text,
    masked,
    sentences,
    regex: /\bnot\b[^.!?\n]{1,100}\bbut\b/giu,
    code: DETECTOR_CODES.CONTRAST_NOT_BUT,
    suggestion: 'State the affirmative claim directly instead of using a not X but Y reveal.',
    issues,
    occupied,
  });
  collectRegexIssues({
    text,
    masked,
    sentences,
    regex: /,\s*not\s+[\p{L}\p{N}][^,.!?\n]{0,60}/giu,
    code: DETECTOR_CODES.CONTRAST_X_NOT_Y,
    suggestion: 'Remove the compressed X not Y contrast and state the intended claim directly.',
    issues,
    occupied,
  });
  collectRegexIssues({
    text,
    masked,
    sentences,
    regex: /\bless\b[^.!?\n]{1,80}\bthan\b/giu,
    code: DETECTOR_CODES.CONTRAST_LESS_THAN,
    suggestion: 'Name the actual emphasis without a less X than Y construction.',
    issues,
    occupied,
  });
  collectRegexIssues({
    text,
    masked,
    sentences,
    regex: /\bfar\s+from\b[^.!?\n]{1,100}/giu,
    code: DETECTOR_CODES.CONTRAST_FAR_FROM,
    suggestion: 'Replace the staged reversal with the affirmative claim.',
    issues,
    occupied,
  });
  collectRegexIssues({
    text,
    masked,
    sentences,
    regex: /\bis\s+not\s+the\s+point\b[^.!?\n]{0,80}\b(?:the\s+point\s+is|it\s+is)\b/giu,
    code: DETECTOR_CODES.CONTRAST_POINT_REVEAL,
    suggestion: 'State the point once without announcing and reversing a decoy claim.',
    issues,
    occupied,
  });

  for (let index = 0; index < sentences.length - 1; index += 1) {
    const first = masked.slice(sentences[index].start, sentences[index].end).trim();
    const second = masked.slice(sentences[index + 1].start, sentences[index + 1].end).trim();
    const opening = first.match(/\b(it|this|that)\s+(is|was|are|were)\s+not\b/i);
    if (!opening) continue;
    const reveal = new RegExp(`^${opening[1]}\\s+${opening[2]}\\b`, 'i');
    if (!reveal.test(second)) continue;
    issues.push(makeIssue(
      text,
      sentences,
      DETECTOR_CODES.CONTRAST_PARALLEL_REVEAL,
      sentences[index].start + first.search(/\b(?:it|this|that)\b/i),
      sentences[index + 1].end,
      'Combine the substantive relation without a two-sentence reveal.',
      sentences[index].sentenceIndex,
    ));
  }
}

function lintMethodAndMeta(text, masked, sentences, issues) {
  collectRegexIssues({
    text,
    masked,
    sentences,
    regex: /\b(?:a|an)\s+(?:method|approach|process|strategy|framework|technique|practice)\b|\bstructured\s+annotation\b/giu,
    code: DETECTOR_CODES.EMPTY_METHOD_LABEL,
    suggestion: 'Replace the empty method label with the concrete action, material, sequence, or decision.',
    issues,
  });
  collectRegexIssues({
    text,
    masked,
    sentences,
    regex: /\b(?:this|that|these|those)\s+(?:method|approach|process|strategy|framework|comparison|work|experience)\b/giu,
    code: DETECTOR_CODES.VAGUE_METANOUN,
    suggestion: 'Name the actor and action instead of referring backward through a vague metanoun.',
    issues,
  });
  collectRegexIssues({
    text,
    masked,
    sentences,
    regex: /\b(?:the\s+real\s+question|the\s+deeper\s+point|what\s+you(?:'|’)re\s+really\s+asking|to\s+be\s+clear|it\s+is\s+(?:important|worth)\s+noting)\b/giu,
    code: DETECTOR_CODES.META_ANNOUNCEMENT,
    suggestion: 'Remove the meta-announcement and begin with the requested substance.',
    issues,
  });
  collectRegexIssues({
    text,
    masked,
    sentences,
    regex: /\b(?:i\s+will\s+(?:first|now|begin\s+by|explain|outline|discuss)|before\s+answering|in\s+this\s+(?:response|answer)|let\s+me\s+(?:begin|explain|outline|walk|show)|my\s+methodology)\b/giu,
    code: DETECTOR_CODES.PROCESS_NARRATION,
    suggestion: 'Remove process narration and perform the requested act directly.',
    issues,
  });
}

function lintAppositives(text, masked, sentences, issues) {
  const occupied = [];
  collectRegexIssues({
    text,
    masked,
    sentences,
    regex: /,\s*(?:a|an|the|who|which)\s+[^,.!?\n]{1,80},/giu,
    code: DETECTOR_CODES.APPOSITIVE_CANDIDATE,
    suggestion: 'Review this comma-delimited phrase and integrate its necessary content directly or remove it.',
    issues,
    occupied,
  });
  collectRegexIssues({
    text,
    masked,
    sentences,
    regex: /,\s*[A-Z][\p{L}'’.]*(?:\s+[A-Z][\p{L}'’.]*){0,3}\s*,/gu,
    code: DETECTOR_CODES.APPOSITIVE_CANDIDATE,
    suggestion: 'Review this name appositive and keep it only when it advances the sentence.',
    issues,
    occupied,
  });
}

function lintRhythm(text, masked, sentences, protectedSpans, issues) {
  const metrics = sentences.map(sentence => {
    const words = wordsInSentence(sentence, protectedSpans);
    const authored = masked.slice(sentence.start, sentence.end).trim();
    return {sentence, words: words.length, authored};
  });

  for (const metric of metrics) {
    if (/^(?:that matters|this matters|the stakes are clear|full stop|period)\.?$/i.test(metric.authored)) {
      const localStart = masked.slice(metric.sentence.start, metric.sentence.end).search(/\S/);
      issues.push(makeIssue(
        text,
        sentences,
        DETECTOR_CODES.MIC_DROP_FRAGMENT,
        metric.sentence.start + Math.max(0, localStart),
        metric.sentence.end,
        'Delete the mic-drop fragment or replace it with substantive evidence.',
        metric.sentence.sentenceIndex,
      ));
    }
  }

  for (let start = 0; start <= metrics.length - 3; start += 1) {
    const run = metrics.slice(start, start + 3);
    if (!run.every(metric => metric.words >= 1 && metric.words <= 7)) continue;
    issues.push(makeIssue(
      text,
      sentences,
      DETECTOR_CODES.STACCATO_CLUSTER,
      run[0].sentence.start,
      run.at(-1).sentence.end,
      'Combine or develop the short declaratives so sentence length follows the thought.',
      run[0].sentence.sentenceIndex,
    ));
    start += 2;
  }

  for (let start = 0; start <= metrics.length - 4; start += 1) {
    const run = metrics.slice(start, start + 4);
    const counts = run.map(metric => metric.words);
    const minimum = Math.min(...counts);
    const maximum = Math.max(...counts);
    if (minimum < 8 || maximum > 18 || maximum - minimum > 2) continue;
    issues.push(makeIssue(
      text,
      sentences,
      DETECTOR_CODES.METRONOMIC_RHYTHM,
      run[0].sentence.start,
      run.at(-1).sentence.end,
      'Review the uniform sentence pattern and vary the rhythm only where the thought requires it.',
      run[0].sentence.sentenceIndex,
    ));
    start += 3;
  }
}

function sortAndDedupeIssues(issues) {
  const unique = new Map();
  for (const issue of issues) {
    const key = `${issue.code}\u0000${issue.start}\u0000${issue.end}`;
    if (!unique.has(key)) unique.set(key, issue);
  }
  return [...unique.values()].sort((left, right) => (
    left.start - right.start
    || left.end - right.end
    || left.code.localeCompare(right.code)
  ));
}

function lintText(text, {protectedSpans = [], allowedRepeatedLemmas = []} = {}) {
  if (typeof text !== 'string') throw new TypeError('lintText expects a string');
  if (!Array.isArray(allowedRepeatedLemmas)) throw new TypeError('allowedRepeatedLemmas must be an array');
  const normalizedSpans = normalizeProtectedSpans(text, protectedSpans);
  const masked = maskProtected(text, normalizedSpans);
  const sentences = segmentSentences(text);
  const issues = [];
  lintPunctuation(text, masked, sentences, issues);
  lintLexicalRepetition(text, sentences, normalizedSpans, allowedRepeatedLemmas, issues);
  lintContrastForms(text, masked, sentences, issues);
  lintMethodAndMeta(text, masked, sentences, issues);
  lintAppositives(text, masked, sentences, issues);
  lintRhythm(text, masked, sentences, normalizedSpans, issues);
  return sortAndDedupeIssues(issues);
}

function issueForSentence(text, sentences, code, sentenceIndex, suggestion) {
  const sentence = sentences[sentenceIndex] || sentences[0] || {start: 0, end: text.length, sentenceIndex: 0};
  return makeIssue(text, sentences, code, sentence.start, sentence.end, suggestion, sentence.sentenceIndex);
}

function validateSemanticPlan(text, plan) {
  if (typeof text !== 'string') throw new TypeError('validateSemanticPlan expects a string');
  const sentences = segmentSentences(text);
  const issues = [];
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
    return [issueForSentence(
      text,
      sentences,
      DETECTOR_CODES.PLAN_SCHEMA,
      0,
      'Supply the explicit source, claim, paragraph, revision, and application plan required by this writing task.',
    )];
  }

  const sources = Array.isArray(plan.sources) ? plan.sources : [];
  const claims = Array.isArray(plan.claims) ? plan.claims : [];
  const paragraphs = Array.isArray(plan.paragraphs) ? plan.paragraphs : [];
  const transitions = Array.isArray(plan.transitions) ? plan.transitions : [];
  const relations = Array.isArray(plan.relations) ? plan.relations : [];
  const sourcesById = new Map();
  const evidenceToSource = new Map();
  for (const source of sources) {
    if (!source || !source.id || sourcesById.has(source.id)) {
      issues.push(issueForSentence(text, sentences, DETECTOR_CODES.PLAN_SCHEMA, 0, 'Give every plan source one unique id.'));
      continue;
    }
    sourcesById.set(source.id, source);
    for (const evidenceId of Array.isArray(source.evidenceIds) ? source.evidenceIds : []) {
      if (!evidenceId || evidenceToSource.has(evidenceId)) {
        issues.push(issueForSentence(text, sentences, DETECTOR_CODES.PLAN_SCHEMA, 0, 'Give every evidence record one unique id.'));
        continue;
      }
      evidenceToSource.set(evidenceId, source.id);
    }
  }

  function evidenceGrounded(sourceIds, evidenceIds) {
    if (!Array.isArray(sourceIds) || !sourceIds.length || !Array.isArray(evidenceIds) || !evidenceIds.length) return false;
    const sourceSet = new Set(sourceIds);
    return evidenceIds.every(evidenceId => sourceSet.has(evidenceToSource.get(evidenceId)));
  }

  const relationsById = new Map();
  for (const relation of relations) {
    if (!relation || !relation.id || relationsById.has(relation.id)) {
      issues.push(issueForSentence(text, sentences, DETECTOR_CODES.PLAN_SCHEMA, 0, 'Give every real relation one unique id.'));
      continue;
    }
    relationsById.set(relation.id, {
      ...relation,
      grounded: evidenceGrounded(relation.sourceIds, relation.evidenceIds),
    });
  }

  const claimsById = new Map();
  const claimsBySentence = new Map();
  for (const claim of claims) {
    if (!claim || !claim.id || claimsById.has(claim.id) || !Number.isInteger(claim.sentenceIndex)) {
      issues.push(issueForSentence(text, sentences, DETECTOR_CODES.PLAN_SCHEMA, 0, 'Give every claim one unique id and a valid sentenceIndex.'));
      continue;
    }
    claimsById.set(claim.id, claim);
    if (!claimsBySentence.has(claim.sentenceIndex)) claimsBySentence.set(claim.sentenceIndex, []);
    claimsBySentence.get(claim.sentenceIndex).push(claim);
    if (claim.sentenceIndex < 0 || claim.sentenceIndex >= sentences.length) {
      issues.push(issueForSentence(text, sentences, DETECTOR_CODES.PLAN_SCHEMA, 0, `Claim ${claim.id} points outside the draft.`));
    }
  }

  const groundingTypes = new Set(['first_person', 'candidate_fact', 'employer_fact', 'factual', 'quotation', 'source_title']);
  const candidateSourceKinds = new Set(['user', 'cv', 'user_supplied', 'prior_application', 'verified_record']);
  const employerSourceKinds = new Set(['job_post', 'school_source', 'verified_public']);
  for (const claim of claimsById.values()) {
    if (!groundingTypes.has(claim.type)) continue;
    const sourceIds = Array.isArray(claim.sourceIds) ? claim.sourceIds : [];
    const validSources = sourceIds.map(id => sourcesById.get(id)).filter(Boolean);
    let grounded = sourceIds.length > 0 && validSources.length === sourceIds.length;
    if (claim.evidenceIds !== undefined) {
      grounded = grounded && evidenceGrounded(sourceIds, claim.evidenceIds);
    }
    if (claim.type === 'first_person' || claim.type === 'candidate_fact') {
      grounded = grounded && validSources.every(source => candidateSourceKinds.has(source.kind));
    }
    if (claim.type === 'employer_fact') {
      grounded = grounded && validSources.every(source => employerSourceKinds.has(source.kind));
    }
    if (!grounded) {
      issues.push(issueForSentence(
        text,
        sentences,
        DETECTOR_CODES.SOURCE_GROUNDING,
        claim.sentenceIndex,
        `Ground claim ${claim.id} in an allowed exact source before drafting it.`,
      ));
    }
  }

  const paragraphForSentence = new Map();
  for (let paragraphIndex = 0; paragraphIndex < paragraphs.length; paragraphIndex += 1) {
    const sentenceIndexes = Array.isArray(paragraphs[paragraphIndex].sentenceIndexes)
      ? paragraphs[paragraphIndex].sentenceIndexes
      : [];
    for (const sentenceIndex of sentenceIndexes) paragraphForSentence.set(sentenceIndex, paragraphIndex);
    for (let offset = 0; offset < sentenceIndexes.length - 1; offset += 1) {
      const from = sentenceIndexes[offset];
      const to = sentenceIndexes[offset + 1];
      const fromTopics = new Set(
        (claimsBySentence.get(from) || []).flatMap(claim => Array.isArray(claim.topics) ? claim.topics : []),
      );
      const toTopics = new Set(
        (claimsBySentence.get(to) || []).flatMap(claim => Array.isArray(claim.topics) ? claim.topics : []),
      );
      const sharedTopic = [...fromTopics].some(topic => toTopics.has(topic));
      const fromRelations = new Set(
        (claimsBySentence.get(from) || []).flatMap(claim => Array.isArray(claim.relationIds) ? claim.relationIds : []),
      );
      const toRelations = new Set(
        (claimsBySentence.get(to) || []).flatMap(claim => Array.isArray(claim.relationIds) ? claim.relationIds : []),
      );
      const sharedGroundedRelation = [...fromRelations]
        .some(relationId => toRelations.has(relationId) && relationsById.get(relationId)?.grounded);
      if (sharedGroundedRelation) continue;
      const transition = transitions.find(candidate => candidate && candidate.from === from && candidate.to === to);
      const allowedRelations = new Set(['sequence', 'cause', 'contrast', 'condition', 'evidence']);
      const groundedTransition = transition
        && allowedRelations.has(transition.relation)
        && relationsById.get(transition.relationId)?.grounded;
      if (!groundedTransition) {
        issues.push(issueForSentence(
          text,
          sentences,
          sharedTopic ? DETECTOR_CODES.INVENTED_BRIDGE : DETECTOR_CODES.TOPIC_CONTINUITY,
          to,
          sharedTopic
            ? 'A shared topic label does not establish a real relation. Supply grounded relation evidence or separate the claims.'
            : 'Separate these topics or supply the exact source-supported relation that joins them.',
        ));
      }
    }
  }

  if (plan.enforceClauseNovelty === true) {
    for (const [sentenceIndex, sentenceClaims] of claimsBySentence) {
      const ordered = [...sentenceClaims].sort((left, right) => (
        (Number.isInteger(left.clauseIndex) ? left.clauseIndex : 0)
        - (Number.isInteger(right.clauseIndex) ? right.clauseIndex : 0)
      ));
      const priorUnits = new Set();
      for (const claim of ordered) {
        const informationUnits = Array.isArray(claim.informationUnits) ? claim.informationUnits : [];
        const relationUnits = Array.isArray(claim.relationUnits) ? claim.relationUnits : [];
        if (!informationUnits.length && !relationUnits.length) {
          issues.push(issueForSentence(
            text,
            sentences,
            DETECTOR_CODES.CLAUSE_NOVELTY,
            sentenceIndex,
            `Clause claim ${claim.id} adds no recorded information or relation.`,
          ));
          continue;
        }
        if (
          priorUnits.size
          && informationUnits.length
          && informationUnits.every(unit => priorUnits.has(unit))
          && !relationUnits.length
        ) {
          issues.push(issueForSentence(
            text,
            sentences,
            DETECTOR_CODES.TAUTOLOGICAL_CONSEQUENCE,
            sentenceIndex,
            `Clause claim ${claim.id} repeats information already supplied by the sentence.`,
          ));
        }
        for (const unit of informationUnits) priorUnits.add(unit);
      }
    }
  }

  if (plan.enforceDistinctiveness === true) {
    for (const claim of claimsById.values()) {
      if (!['candidate_fact', 'first_person'].includes(claim.type)) continue;
      const specific = Array.isArray(claim.specificityUnits) && claim.specificityUnits.length > 0;
      const supported = evidenceGrounded(claim.sourceIds, claim.evidenceIds);
      if (!specific || !supported) {
        issues.push(issueForSentence(
          text,
          sentences,
          DETECTOR_CODES.DISTINCTIVENESS,
          claim.sentenceIndex,
          `Replace generic claim ${claim.id} with a verified particular action, constraint, material, or result.`,
        ));
      }
    }
  }

  for (const claim of claimsById.values()) {
    if (claim.type !== 'student_interiority') continue;
    const sourceIds = Array.isArray(claim.sourceIds) ? claim.sourceIds : [];
    const directSources = sourceIds.map(id => sourcesById.get(id)).filter(Boolean);
    const direct = directSources.length === sourceIds.length
      && directSources.length > 0
      && directSources.every(source => source.kind === 'direct_student_statement')
      && evidenceGrounded(sourceIds, claim.evidenceIds);
    if (!direct) {
      issues.push(issueForSentence(
        text,
        sentences,
        DETECTOR_CODES.STUDENT_INTERIORITY,
        claim.sentenceIndex,
        `Describe observable student conduct or ground claim ${claim.id} in a direct attributed student statement.`,
      ));
    }
  }

  const visibleInformation = new Set(
    Array.isArray(plan.visibleInformationUnits) ? plan.visibleInformationUnits : [],
  );
  if (visibleInformation.size) {
    for (const claim of claimsById.values()) {
      const informationUnits = Array.isArray(claim.informationUnits) ? claim.informationUnits : [];
      if (informationUnits.length && informationUnits.every(unit => visibleInformation.has(unit))) {
        issues.push(issueForSentence(
          text,
          sentences,
          DETECTOR_CODES.OBVIOUSNESS,
          claim.sentenceIndex,
          `Remove claim ${claim.id} because the application or visible context already supplies it.`,
        ));
      }
    }
  }

  if (plan.revision !== undefined) {
    const revision = plan.revision || {};
    const baseline = Array.isArray(revision.baselineSentences) ? revision.baselineSentences : [];
    const editable = new Set(Array.isArray(revision.editableSentenceIndexes) ? revision.editableSentenceIndexes : []);
    const current = sentences.map(sentence => sentence.text.trim()).filter(Boolean);
    if (!baseline.length || baseline.length !== current.length) {
      issues.push(issueForSentence(
        text,
        sentences,
        DETECTOR_CODES.REVISION_LOCALITY,
        0,
        'Preserve the baseline sentence structure unless the authorized revision range explicitly permits a structural change.',
      ));
    } else {
      for (let index = 0; index < baseline.length; index += 1) {
        if (!editable.has(index) && baseline[index] !== current[index]) {
          issues.push(issueForSentence(
            text,
            sentences,
            DETECTOR_CODES.REVISION_LOCALITY,
            index,
            'Restore this unchanged sentence or expand the authorized revision range before drafting.',
          ));
        }
      }
    }
  }

  if (plan.application !== undefined) {
    const application = plan.application || {};
    const fitLinks = Array.isArray(application.fitLinks) ? application.fitLinks : [];
    const minimum = Number.isInteger(application.minimumFitLinks) ? application.minimumFitLinks : 1;
    let validLinks = 0;
    for (const link of fitLinks) {
      const requirement = link && claimsById.get(link.requirementClaimId);
      const candidate = link && claimsById.get(link.candidateClaimId);
      if (!requirement || requirement.type !== 'employer_fact') continue;
      if (!candidate || !['candidate_fact', 'first_person'].includes(candidate.type)) continue;
      if (!link.relation || typeof link.relation !== 'string') continue;
      const requirementParagraph = paragraphForSentence.get(requirement.sentenceIndex);
      const candidateParagraph = paragraphForSentence.get(candidate.sentenceIndex);
      if (requirementParagraph === undefined || requirementParagraph !== candidateParagraph) continue;
      validLinks += 1;
    }
    if (validLinks < minimum) {
      issues.push(issueForSentence(
        text,
        sentences,
        DETECTOR_CODES.APPLICATION_SPECIFICITY,
        0,
        'Connect a verified posting requirement to verified candidate evidence in the same paragraph.',
      ));
    }
  }

  return sortAndDedupeIssues(issues);
}

function analyzeWriting(text, {protectedSpans = [], allowedRepeatedLemmas = [], semanticPlan} = {}) {
  const mechanical = lintText(text, {protectedSpans, allowedRepeatedLemmas});
  const semantic = semanticPlan === undefined ? [] : validateSemanticPlan(text, semanticPlan);
  return sortAndDedupeIssues([...mechanical, ...semantic]);
}

module.exports = {
  DETECTOR_CODES,
  RULE_FAMILIES,
  analyzeWriting,
  lintText,
  normalizeProtectedSpans,
  segmentSentences,
  validateSemanticPlan,
};
