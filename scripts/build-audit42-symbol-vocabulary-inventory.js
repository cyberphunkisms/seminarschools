#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT = path.join(ROOT, 'data', 'audit42-symbol-vocabulary-inventory.json');
const CHECK = process.argv.includes('--check');
const SYMBOL_PATTERN = /[\u2190-\u21ff\u2300-\u23ff\u25a0-\u25ff\u2600-\u26ff\u2700-\u27bf\u2b00-\u2bff×−·§]/gu;

const HTML_SURFACES = [
  ['home', 'index.html'],
  ['about', 'about/index.html'],
  ['bb', 'bb/index.html'],
  ['polymyth', 'polymyth/index.html'],
  ['leizu', 'leizu/index.html'],
  ['teacher-resources', 'teacherresources/index.html'],
  ['polymythcal', 'polymythseminars/index.html'],
  ['bookwormcard', 'bookwormcard/index.html'],
];

const RUNTIME_SOURCES = [
  ['shared-runtime', 'js/site.js'],
  ['shared-runtime', 'js/theme.js'],
  ['polymythcal-runtime', 'js/polymythcal-features.js'],
  ['polymythcal-runtime', 'js/polymythcal-revamp.js'],
];

const CSS_SOURCES = [
  ['shared-project-css', 'css/main.css'],
  ['polymythcal-css', 'css/polymythcal-revamp.css'],
];

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta',
  'param', 'source', 'track', 'wbr',
]);

function relative(file) {
  return path.relative(ROOT, file).replace(/\\/g, '/');
}

function decodeEntities(value) {
  const named = {
    darr: '↓',
    hellip: '…',
    larr: '←',
    mdash: '—',
    middot: '·',
    minus: '−',
    ndash: '–',
    rarr: '→',
    times: '×',
    uarr: '↑',
  };
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, decimal) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&([a-z]+);/gi, (match, name) => (
      Object.prototype.hasOwnProperty.call(named, name.toLowerCase())
        ? named[name.toLowerCase()]
        : match
    ));
}

function lineStarts(source) {
  const starts = [0];
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === '\n') starts.push(index + 1);
  }
  return starts;
}

function lineAt(starts, index) {
  let low = 0;
  let high = starts.length;
  while (low + 1 < high) {
    const middle = Math.floor((low + high) / 2);
    if (starts[middle] <= index) low = middle;
    else high = middle;
  }
  return low + 1;
}

function attributes(source) {
  const result = {};
  const pattern = /([:\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  for (const match of source.matchAll(pattern)) {
    result[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? '');
  }
  return result;
}

function elementContext(element) {
  if (!element) return '(document text)';
  const id = element.attrs.id ? `#${element.attrs.id}` : '';
  const classes = (element.attrs.class || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4)
    .map(value => `.${value}`)
    .join('');
  return `${element.name}${id}${classes}`;
}

function vocabularyFamily(symbol) {
  if (symbol === 'inline-svg') return 'drawn_vector_graphic';
  if (['☀', '☾'].includes(symbol)) return 'celestial_theme_glyph';
  if (['←', '→', '↑', '↓', '↗', '↵', '↻', '⟲'].includes(symbol)) return 'directional_arrow';
  if (['×', '✕'].includes(symbol)) return 'close_or_remove_mark';
  if (['+', '−', 'A+', 'A-'].includes(symbol)) return 'expand_or_typography_mark';
  if (['·', '§'].includes(symbol)) return 'typographic_separator_or_marker';
  if (['✓', '⚠'].includes(symbol)) return 'status_mark';
  if (symbol === '⎙') return 'print_mark';
  return 'project_specific_emblem';
}

function addOccurrence(rows, occurrence) {
  rows.push({
    ...occurrence,
    vocabulary_family: vocabularyFamily(occurrence.symbol),
    review_flag: [
      'symbol_only_control_without_static_name',
      'unlabeled_graphic_review',
    ].includes(occurrence.accessibility),
  });
}

function nearest(stack, predicate) {
  for (let index = stack.length - 1; index >= 0; index -= 1) {
    if (predicate(stack[index])) return stack[index];
  }
  return null;
}

function classifyTextSymbol(stack, symbol, normalizedText) {
  const hidden = nearest(stack, element => element.attrs['aria-hidden'] === 'true');
  if (hidden) {
    return { accessibility: 'decorative_hidden', accessible_name: null };
  }
  const interactive = nearest(
    stack,
    element => ['a', 'button', 'summary'].includes(element.name)
      || Boolean(element.attrs.role && /button|link/.test(element.attrs.role)),
  );
  if (interactive?.attrs['aria-label']) {
    return {
      accessibility: 'named_control',
      accessible_name: interactive.attrs['aria-label'],
    };
  }
  if (interactive?.attrs.title) {
    return {
      accessibility: 'title_named_control',
      accessible_name: interactive.attrs.title,
    };
  }
  if (nearest(stack, element => element.name === 'kbd')) {
    return {
      accessibility: 'keycap_instruction',
      accessible_name: normalizedText,
    };
  }
  if (interactive) {
    const symbolOnly = normalizedText === symbol || ['A+', 'A-', '?', '+', '−'].includes(normalizedText);
    return {
      accessibility: symbolOnly
        ? 'symbol_only_control_without_static_name'
        : 'visible_text_within_control',
      accessible_name: symbolOnly ? null : normalizedText,
    };
  }
  if (symbol === '·') {
    return { accessibility: 'visible_typographic_separator', accessible_name: null };
  }
  return { accessibility: 'visible_content_symbol', accessible_name: normalizedText };
}

function scanHtml(surface, filePath) {
  const source = fs.readFileSync(path.join(ROOT, filePath), 'utf8');
  const starts = lineStarts(source);
  const rows = [];
  const stack = [];
  const tokenPattern = /<!--[\s\S]*?-->|<![^>]*>|<\/?[a-z][^>]*>|[^<]+/gi;

  for (const match of source.matchAll(tokenPattern)) {
    const token = match[0];
    if (token.startsWith('<!--') || token.startsWith('<!')) continue;
    if (token.startsWith('</')) {
      const name = token.match(/^<\/\s*([a-z][\w:-]*)/i)?.[1].toLowerCase();
      if (!name) continue;
      for (let index = stack.length - 1; index >= 0; index -= 1) {
        const candidate = stack.pop();
        if (candidate.name === name) break;
      }
      continue;
    }
    if (token.startsWith('<')) {
      const parsed = token.match(/^<\s*([a-z][\w:-]*)([\s\S]*?)\/?\s*>$/i);
      if (!parsed) continue;
      const name = parsed[1].toLowerCase();
      const element = { name, attrs: attributes(parsed[2]) };
      if (!VOID_ELEMENTS.has(name) && !/\/\s*>$/.test(token)) stack.push(element);
      continue;
    }

    if (nearest(stack, element => ['script', 'style', 'template', 'noscript', 'svg'].includes(element.name))) {
      continue;
    }
    const decoded = decodeEntities(token);
    const normalized = decoded.replace(/\s+/g, ' ').trim();
    if (!normalized) continue;
    const symbols = decoded.match(SYMBOL_PATTERN) || [];
    const parent = stack[stack.length - 1] || null;
    for (const symbol of symbols) {
      addOccurrence(rows, {
        surface,
        source: filePath,
        origin: 'html_text',
        line: lineAt(starts, match.index),
        component: elementContext(
          nearest(stack, element => ['a', 'button', 'summary', 'kbd'].includes(element.name)) || parent,
        ),
        symbol,
        ...classifyTextSymbol(stack, symbol, normalized),
      });
    }
    if (['A+', 'A-', '?', '+', '-'].includes(normalized)) {
      const normalizedSymbol = normalized === '-' ? 'A-' : normalized;
      addOccurrence(rows, {
        surface,
        source: filePath,
        origin: 'html_text',
        line: lineAt(starts, match.index),
        component: elementContext(
          nearest(stack, element => ['a', 'button', 'summary', 'kbd'].includes(element.name)) || parent,
        ),
        symbol: normalizedSymbol,
        ...classifyTextSymbol(stack, normalizedSymbol, normalized),
      });
    }
  }

  // SVG may be authored directly or assembled in a same-file runtime string.
  for (const match of source.matchAll(/<svg\b([^>]*)>([\s\S]*?)<\/svg>/gi)) {
    const attrs = attributes(match[1]);
    const title = decodeEntities(
      match[2].match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g, ' ') || '',
    ).replace(/\s+/g, ' ').trim();
    let accessibility = 'unlabeled_graphic_review';
    let accessibleName = null;
    if (attrs['aria-hidden'] === 'true') {
      accessibility = 'decorative_hidden';
    } else if (attrs['aria-label']) {
      accessibility = 'named_graphic';
      accessibleName = attrs['aria-label'];
    } else if (title) {
      accessibility = 'titled_graphic';
      accessibleName = title;
    } else if (attrs['aria-describedby']) {
      accessibility = 'described_graphic';
      accessibleName = `aria-describedby:${attrs['aria-describedby']}`;
    }
    addOccurrence(rows, {
      surface,
      source: filePath,
      origin: 'inline_svg',
      line: lineAt(starts, match.index),
      component: elementContext({ name: 'svg', attrs }),
      symbol: 'inline-svg',
      accessibility,
      accessible_name: accessibleName,
    });
  }

  // CSS-generated cues are not part of the accessibility tree. They remain in
  // the visual vocabulary inventory because they explain the mixed icon set.
  for (const block of source.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    rows.push(...scanCss(
      surface,
      filePath,
      block[1],
      matchIndex(source, block.index, block[0], block[1]),
      starts,
    ));
  }

  // Inline scripts can author dynamic controls that do not exist as static DOM
  // nodes. Record their glyph vocabulary without pretending dynamic names are
  // proven beyond what appears in the same source line.
  for (const block of source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    const bodyOffset = matchIndex(source, block.index, block[0], block[1]);
    rows.push(...scanRuntime(surface, filePath, block[1], bodyOffset, starts));
  }
  return { source, rows };
}

function matchIndex(source, outerIndex, outer, inner) {
  const local = outer.indexOf(inner);
  return local < 0 ? outerIndex : outerIndex + local;
}

function selectorBefore(source, index) {
  const opening = source.lastIndexOf('{', index);
  if (opening < 0) return '(generated-content selector unavailable)';
  const boundary = Math.max(
    source.lastIndexOf('}', opening - 1),
    source.lastIndexOf('{', opening - 1),
  );
  return source.slice(boundary + 1, opening).replace(/\s+/g, ' ').trim()
    || '(anonymous generated-content rule)';
}

function scanCss(surface, filePath, source, absoluteOffset = 0, externalStarts = null) {
  const rows = [];
  const starts = externalStarts || lineStarts(source);
  const pattern = /\bcontent\s*:\s*(["'])(.*?)\1/g;
  for (const match of source.matchAll(pattern)) {
    const value = decodeEntities(match[2]);
    const symbols = value.match(SYMBOL_PATTERN) || [];
    if (['+', '-'].includes(value.trim())) symbols.push(value.trim() === '-' ? '−' : '+');
    for (const symbol of symbols) {
      addOccurrence(rows, {
        surface,
        source: filePath,
        origin: 'css_generated_content',
        line: externalStarts
          ? lineAt(starts, absoluteOffset + match.index)
          : lineAt(starts, match.index),
        component: selectorBefore(source, match.index),
        symbol,
        accessibility: ['+', '−', '✓'].includes(symbol)
          ? 'css_generated_state_cue_not_in_accessibility_tree'
          : 'css_generated_decoration_not_in_accessibility_tree',
        accessible_name: null,
      });
    }
  }
  return rows;
}

function scanRuntime(surface, filePath, source, absoluteOffset = 0, externalStarts = null) {
  const rows = [];
  const starts = externalStarts || lineStarts(source);
  for (const segment of jsStringSegments(source)) {
    for (const match of segment.content.matchAll(SYMBOL_PATTERN)) {
      const sourceIndex = segment.start + match.index;
      const lineStart = source.lastIndexOf('\n', sourceIndex) + 1;
      const lineEndCandidate = source.indexOf('\n', sourceIndex);
      const lineEnd = lineEndCandidate < 0 ? source.length : lineEndCandidate;
      const snippet = source.slice(lineStart, lineEnd).replace(/\s+/g, ' ').trim();
      let accessibility = 'dynamic_visible_symbol_context';
      let accessibleName = null;
      if (/aria-hidden\s*=\s*["']true["']/i.test(snippet)) {
        accessibility = 'decorative_hidden';
      } else {
        const name = snippet.match(/aria-label\s*=\s*["']([^"']+)["']/i)?.[1] || '';
        if (name) {
          accessibility = 'named_dynamic_control';
          accessibleName = decodeEntities(name);
        } else if (match[0] === '·') {
          accessibility = 'visible_typographic_separator';
        }
      }
      addOccurrence(rows, {
        surface,
        source: filePath,
        origin: 'runtime_string_or_copy',
        line: externalStarts
          ? lineAt(starts, absoluteOffset + sourceIndex)
          : lineAt(starts, sourceIndex),
        component: snippet.slice(0, 220),
        symbol: match[0],
        accessibility,
        accessible_name: accessibleName,
      });
    }
  }
  return rows;
}

function jsStringSegments(source) {
  const segments = [];
  let index = 0;
  while (index < source.length) {
    if (source[index] === '/' && source[index + 1] === '/') {
      index += 2;
      while (index < source.length && source[index] !== '\n') index += 1;
      continue;
    }
    if (source[index] === '/' && source[index + 1] === '*') {
      index += 2;
      while (
        index < source.length
        && !(source[index] === '*' && source[index + 1] === '/')
      ) index += 1;
      index += 2;
      continue;
    }
    if (!['"', "'", '`'].includes(source[index])) {
      index += 1;
      continue;
    }
    const quote = source[index];
    const start = index + 1;
    index += 1;
    let content = '';
    while (index < source.length) {
      const character = source[index];
      if (character === '\\') {
        content += character;
        if (index + 1 < source.length) {
          content += source[index + 1];
          index += 2;
        } else {
          index += 1;
        }
        continue;
      }
      if (character === quote) break;
      content += character;
      index += 1;
    }
    segments.push({ content, start });
    if (index < source.length) index += 1;
  }
  return segments;
}

function groupRows(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = JSON.stringify([
      row.surface,
      row.source,
      row.origin,
      row.component,
      row.symbol,
      row.vocabulary_family,
      row.accessibility,
      row.accessible_name,
      row.review_flag,
    ]);
    if (!groups.has(key)) {
      groups.set(key, {
        ...row,
        occurrences: 0,
        lines: [],
      });
      delete groups.get(key).line;
    }
    const group = groups.get(key);
    group.occurrences += 1;
    if (!group.lines.includes(row.line)) group.lines.push(row.line);
  }
  return [...groups.values()]
    .map(row => ({ ...row, lines: row.lines.sort((a, b) => a - b) }))
    .sort((a, b) => (
      a.surface.localeCompare(b.surface)
      || a.source.localeCompare(b.source)
      || a.lines[0] - b.lines[0]
      || a.symbol.localeCompare(b.symbol)
    ));
}

function sourceFingerprint(files, release) {
  const hash = crypto.createHash('sha256');
  hash.update(`release_id\0${release.release_id}\0`);
  hash.update(`release_generated_at\0${release.generated_at}\0`);
  for (const file of files) {
    hash.update(`${relative(file)}\0`);
    hash.update(fs.readFileSync(file));
    hash.update('\0');
  }
  return hash.digest('hex');
}

function build() {
  const release = JSON.parse(fs.readFileSync(path.join(ROOT, 'RELEASE_MANIFEST.json'), 'utf8'));
  const rows = [];
  const files = [];

  for (const [surface, filePath] of HTML_SURFACES) {
    const result = scanHtml(surface, filePath);
    files.push(path.join(ROOT, filePath));
    rows.push(...result.rows);
  }
  for (const [surface, filePath] of RUNTIME_SOURCES) {
    const absolute = path.join(ROOT, filePath);
    const source = fs.readFileSync(absolute, 'utf8');
    files.push(absolute);
    rows.push(...scanRuntime(surface, filePath, source));
  }
  for (const [surface, filePath] of CSS_SOURCES) {
    const absolute = path.join(ROOT, filePath);
    const source = fs.readFileSync(absolute, 'utf8');
    files.push(absolute);
    rows.push(...scanCss(surface, filePath, source));
  }

  const inventory = groupRows(rows);
  const distinct = [...new Set(inventory.map(row => row.symbol))].sort();
  const occurrenceCount = inventory.reduce((sum, row) => sum + row.occurrences, 0);
  const reviewItems = inventory.filter(row => row.review_flag);
  const accessibilityCounts = {};
  for (const row of inventory) {
    accessibilityCounts[row.accessibility] = (
      accessibilityCounts[row.accessibility] || 0
    ) + row.occurrences;
  }

  return {
    schema: 'seminar-schools-audit42-symbol-vocabulary-inventory-v1',
    release_id: release.release_id,
    release_generated_at: release.generated_at,
    source_fingerprint_sha256: sourceFingerprint([...new Set(files)].sort(), release),
    scope: {
      representative_html_surfaces: HTML_SURFACES.map(([surface, file]) => ({ surface, file })),
      shared_and_dynamic_runtime_sources: RUNTIME_SOURCES.map(([surface, file]) => ({ surface, file })),
      generated_content_css_sources: CSS_SOURCES.map(([surface, file]) => ({ surface, file })),
      source_files_fingerprinted: new Set(files).size,
      limitation: 'Static source can prove authored labels, aria-hidden state, titles, and described-by relationships. Runtime-computed names and native screen-reader pronunciation remain external checks.',
    },
    summary: {
      inventory_records: inventory.length,
      authored_occurrences: occurrenceCount,
      distinct_symbols_or_graphics: distinct.length,
      review_items: reviewItems.length,
      accessibility_classification_occurrences: Object.fromEntries(
        Object.entries(accessibilityCounts).sort(([a], [b]) => a.localeCompare(b)),
      ),
    },
    vocabulary_disposition: {
      classification: 'mixed_project_specific_vocabulary_preserved',
      unified_icon_family_claimed: false,
      rationale: 'Arrows, celestial theme glyphs, typographic marks, CSS emblems, and project-specific vector graphics belong to different established project voices. This audit inventories and names them; forcing one icon family would be a direction-level redesign.',
      maintenance_rule: 'New symbol-only controls must have an authored accessible name; decorative glyphs should be hidden from assistive technology when they add no spoken meaning.',
    },
    distinct_symbols_or_graphics: distinct,
    inventory,
  };
}

const document = build();
const serialized = `${JSON.stringify(document, null, 2)}\n`;

if (CHECK) {
  let current = '';
  try {
    current = fs.readFileSync(OUTPUT, 'utf8');
  } catch (_) {
    // The mismatch message below covers a missing artifact.
  }
  if (current !== serialized) {
    console.error(
      'AUDIT 42 SYMBOL VOCABULARY INVENTORY FAILED — run '
        + 'node scripts/build-audit42-symbol-vocabulary-inventory.js.',
    );
    process.exit(1);
  }
  if (document.summary.review_items) {
    console.error(
      `AUDIT 42 SYMBOL VOCABULARY INVENTORY FAILED — ${document.summary.review_items} `
        + 'statically unlabeled symbol controls or graphics require maintenance.',
    );
    process.exit(1);
  }
  console.log(
    `AUDIT 42 SYMBOL VOCABULARY INVENTORY PASSED — ${document.summary.inventory_records} `
      + `records, ${document.summary.authored_occurrences} occurrences, `
      + `${document.summary.distinct_symbols_or_graphics} symbol/graphic forms, no unlabeled controls.`,
  );
} else {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, serialized);
  console.log(
    `AUDIT 42 SYMBOL VOCABULARY INVENTORY WRITTEN — ${document.summary.inventory_records} `
      + `records and ${document.summary.authored_occurrences} authored occurrences.`,
  );
}
