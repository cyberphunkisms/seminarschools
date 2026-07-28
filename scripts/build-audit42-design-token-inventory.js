#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT = path.join(ROOT, 'data', 'audit42-design-token-inventory.json');
const CHECK = process.argv.includes('--check');
const CONTEXT_SAMPLE_CAP = 12;

const REPRESENTATIVE_PAGES = [
  ['home', 'index.html'],
  ['polymythcal', 'polymythseminars/index.html'],
  ['teacher-resources', 'teacherresources/index.html'],
  ['bb', 'polymyth/bookwormburrows/index.html'],
  ['bookwormcard', 'bookwormcard/index.html'],
  ['thank-you-mam', 'campaigns/thank-you-mam/index.html'],
  ['thank-you-mam-pregame', 'campaigns/thank-you-mam/pregame/index.html'],
];

const TYPOGRAPHY_PROPERTIES = new Set([
  'font',
  'font-family',
  'font-feature-settings',
  'font-kerning',
  'font-optical-sizing',
  'font-size',
  'font-stretch',
  'font-style',
  'font-variation-settings',
  'font-weight',
  'letter-spacing',
  'line-height',
  'text-transform',
]);

const SPACING_PROPERTIES = new Set([
  'margin',
  'margin-block',
  'margin-block-end',
  'margin-block-start',
  'margin-bottom',
  'margin-inline',
  'margin-inline-end',
  'margin-inline-start',
  'margin-left',
  'margin-right',
  'margin-top',
  'padding',
  'padding-block',
  'padding-block-end',
  'padding-block-start',
  'padding-bottom',
  'padding-inline',
  'padding-inline-end',
  'padding-inline-start',
  'padding-left',
  'padding-right',
  'padding-top',
  'gap',
  'column-gap',
  'row-gap',
  'inset',
  'inset-block',
  'inset-block-end',
  'inset-block-start',
  'inset-inline',
  'inset-inline-end',
  'inset-inline-start',
  'top',
  'right',
  'bottom',
  'left',
]);

const CSS_COLOR_NAMES = new Set(`
  aliceblue antiquewhite aqua aquamarine azure beige bisque black
  blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse
  chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan
  darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta
  darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen
  darkslateblue darkslategray darkslategrey darkturquoise darkviolet
  deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite
  forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green
  greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender
  lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan
  lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon
  lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue
  lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue
  mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen
  mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin
  navajowhite navy oldlace olive olivedrab orange orangered orchid
  palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff
  peru pink plum powderblue purple rebeccapurple red rosybrown royalblue
  saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue
  slateblue slategray slategrey snow springgreen steelblue tan teal thistle
  tomato transparent turquoise violet wheat white whitesmoke yellow
  yellowgreen currentcolor canvas canvastext linktext visitedtext activetext
  buttonface buttontext buttonborder field fieldtext highlight highlighttext
  selecteditem selecteditemtext mark marktext graytext accentcolor
  accentcolortext
`.trim().split(/\s+/));

function relative(file) {
  return path.relative(ROOT, file).replace(/\\/g, '/');
}

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function stripCommentsPreservingLines(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, comment => (
    comment.replace(/[^\n]/g, ' ')
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

function selectorAt(source, index) {
  const opening = source.lastIndexOf('{', index);
  if (opening < 0) return '(declaration context unavailable)';
  const previousOpening = source.lastIndexOf('{', opening - 1);
  const previousClosing = source.lastIndexOf('}', opening - 1);
  const boundary = Math.max(previousOpening, previousClosing);
  const selector = normalizeWhitespace(source.slice(boundary + 1, opening));
  if (!selector) return '(anonymous block)';
  return selector;
}

function pageComponentSelector(tagName, attributes, ordinal) {
  const id = attributes.match(/\bid\s*=\s*["']([^"']+)["']/i)?.[1] || '';
  const className = attributes.match(/\bclass\s*=\s*["']([^"']+)["']/i)?.[1] || '';
  const classes = className.trim().split(/\s+/).filter(Boolean).slice(0, 4);
  return [
    tagName.toLowerCase(),
    id ? `#${id}` : '',
    ...classes.map(value => `.${value}`),
    `[inline-style-${ordinal}]`,
  ].join('');
}

function sharedSources() {
  const cssDirectory = path.join(ROOT, 'css');
  const files = fs.readdirSync(cssDirectory)
    .filter(name => name.endsWith('.css'))
    .sort()
    .map(name => path.join(cssDirectory, name));
  const legacyShared = path.join(ROOT, 'mobile-slim.css');
  if (fs.existsSync(legacyShared)) files.push(legacyShared);
  return files.map(file => ({
    id: relative(file),
    path: relative(file),
    family: 'shared',
    kind: 'shared_css',
    block: null,
    content: fs.readFileSync(file, 'utf8'),
  }));
}

function representativeSources() {
  const sources = [];
  const coverage = [];
  for (const [family, pagePath] of REPRESENTATIVE_PAGES) {
    const absolute = path.join(ROOT, pagePath);
    const html = fs.readFileSync(absolute, 'utf8');
    let styleBlockCount = 0;
    for (const match of html.matchAll(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi)) {
      styleBlockCount += 1;
      const id = match[1].match(/\bid=["']([^"']+)["']/i)?.[1]
        || `style-${styleBlockCount}`;
      sources.push({
        id: `${pagePath}#${id}`,
        path: pagePath,
        family,
        kind: 'representative_style_block',
        block: id,
        content: match[2],
      });
    }

    const attributeRules = [];
    let styleAttributeCount = 0;
    const tagPattern = /<([a-z][\w:-]*)([^>]*?)\bstyle\s*=\s*(["'])([\s\S]*?)\3([^>]*)>/gi;
    for (const match of html.matchAll(tagPattern)) {
      styleAttributeCount += 1;
      const attributes = `${match[2]} ${match[5]}`;
      const selector = pageComponentSelector(
        match[1],
        attributes,
        styleAttributeCount,
      );
      attributeRules.push(`${selector}{${match[4]};}`);
    }
    if (attributeRules.length) {
      sources.push({
        id: `${pagePath}#style-attributes`,
        path: pagePath,
        family,
        kind: 'representative_style_attributes',
        block: 'style-attributes',
        content: `${attributeRules.join('\n')}\n`,
      });
    }
    coverage.push({
      family,
      path: pagePath,
      style_blocks: styleBlockCount,
      style_attributes: styleAttributeCount,
    });
  }
  return { sources, coverage };
}

function declarationRows(sourceRow) {
  const source = stripCommentsPreservingLines(sourceRow.content);
  const starts = lineStarts(source);
  const rows = [];
  const pattern = /(?:^|[;{])\s*(--[-\w]+|[-\w]+)\s*:\s*([^;{}]+?)(?=\s*(?:;|}))/gm;
  for (const match of source.matchAll(pattern)) {
    const property = match[1].toLowerCase();
    const propertyOffset = match[0].indexOf(match[1]);
    const index = match.index + Math.max(0, propertyOffset);
    rows.push({
      source: sourceRow.id,
      path: sourceRow.path,
      family: sourceRow.family,
      kind: sourceRow.kind,
      selector: selectorAt(source, index),
      line: lineAt(starts, index),
      property,
      value: normalizeWhitespace(match[2]),
      custom_property: property.startsWith('--'),
    });
  }
  return rows;
}

function colorBearing(property) {
  return property.startsWith('--')
    || /(?:^|-)color$/.test(property)
    || /^(?:background|border|outline|box-shadow|text-shadow|fill|stroke|caret-color|accent-color)/.test(property);
}

function colorLiterals(value) {
  const literals = [];
  const occupied = [];
  const patterns = [
    /#[0-9a-f]{3,4}\b|#[0-9a-f]{6}\b|#[0-9a-f]{8}\b/gi,
    /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\([^()]*\)/gi,
  ];
  for (const pattern of patterns) {
    for (const match of value.matchAll(pattern)) {
      literals.push(normalizeWhitespace(match[0].toLowerCase()));
      occupied.push([match.index, match.index + match[0].length]);
    }
  }
  const wordPattern = /\b[a-z]+\b/gi;
  for (const match of value.matchAll(wordPattern)) {
    const keyword = match[0].toLowerCase();
    if (!CSS_COLOR_NAMES.has(keyword)) continue;
    if (occupied.some(([start, end]) => match.index >= start && match.index < end)) {
      continue;
    }
    literals.push(keyword);
  }
  return literals;
}

function contextFor(row) {
  return {
    source: row.source,
    selector: row.selector,
    line: row.line,
    property: row.property,
    declaration_value: row.value,
  };
}

function aggregateOccurrences(rows, category) {
  const aggregates = new Map();
  for (const occurrence of rows) {
    const key = category === 'colors'
      ? occurrence.literal
      : `${occurrence.property}\u0000${occurrence.value}`;
    if (!aggregates.has(key)) {
      aggregates.set(key, {
        property: category === 'colors' ? null : occurrence.property,
        value: category === 'colors' ? occurrence.literal : occurrence.value,
        occurrences: 0,
        contexts: [],
        sources: new Set(),
        components: new Set(),
      });
    }
    const entry = aggregates.get(key);
    entry.occurrences += 1;
    entry.sources.add(occurrence.source);
    entry.components.add(`${occurrence.source}::${occurrence.selector}`);
    if (entry.contexts.length < CONTEXT_SAMPLE_CAP) {
      entry.contexts.push(contextFor(occurrence));
    }
  }
  return [...aggregates.values()]
    .map(entry => ({
      ...(entry.property ? { property: entry.property } : {}),
      value: entry.value,
      occurrences: entry.occurrences,
      one_off: entry.occurrences === 1,
      source_count: entry.sources.size,
      component_count: entry.components.size,
      sources: [...entry.sources].sort(),
      sample_contexts: entry.contexts,
      context_sample_cap: CONTEXT_SAMPLE_CAP,
    }))
    .sort((a, b) => (
      b.occurrences - a.occurrences
      || `${a.property || ''}:${a.value}`.localeCompare(`${b.property || ''}:${b.value}`)
    ));
}

function build() {
  const shared = sharedSources();
  const representative = representativeSources();
  const sources = [...shared, ...representative.sources];
  const declarations = sources.flatMap(declarationRows);
  const release = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'RELEASE_MANIFEST.json'),
    'utf8',
  ));
  const fingerprint = crypto.createHash('sha256');
  for (const source of sources) {
    fingerprint.update(source.id);
    fingerprint.update('\0');
    fingerprint.update(source.content);
    fingerprint.update('\0');
  }

  const definitions = new Map();
  const references = new Map();
  const raw = {
    colors: [],
    typography: [],
    spacing: [],
    radii: [],
    z_index: [],
  };
  const components = new Map();
  const sourceMetrics = new Map();

  function tokenMapEntry(map, name) {
    if (!map.has(name)) map.set(name, []);
    return map.get(name);
  }

  function metricEntry(map, key, seed) {
    if (!map.has(key)) {
      map.set(key, {
        ...seed,
        declarations: 0,
        custom_property_definitions: 0,
        var_references: 0,
        direct_raw_colors: 0,
        direct_raw_typography: 0,
        direct_raw_spacing: 0,
        direct_raw_radii: 0,
        direct_raw_z_index: 0,
      });
    }
    return map.get(key);
  }

  for (const row of declarations) {
    const sourceMetric = metricEntry(sourceMetrics, row.source, {
      source: row.source,
      path: row.path,
      family: row.family,
      kind: row.kind,
    });
    const componentMetric = metricEntry(
      components,
      `${row.source}::${row.selector}`,
      {
        source: row.source,
        path: row.path,
        family: row.family,
        kind: row.kind,
        selector: row.selector,
      },
    );
    sourceMetric.declarations += 1;
    componentMetric.declarations += 1;

    if (row.custom_property) {
      const definition = contextFor(row);
      tokenMapEntry(definitions, row.property).push(definition);
      sourceMetric.custom_property_definitions += 1;
      componentMetric.custom_property_definitions += 1;
    }

    for (const match of row.value.matchAll(/var\(\s*(--[-\w]+)/gi)) {
      const tail = row.value.slice(match.index + match[0].length);
      const closing = tail.indexOf(')');
      const beforeClosing = closing >= 0 ? tail.slice(0, closing) : tail;
      tokenMapEntry(references, match[1].toLowerCase()).push({
        ...contextFor(row),
        has_fallback: beforeClosing.includes(','),
      });
      sourceMetric.var_references += 1;
      componentMetric.var_references += 1;
    }

    if (colorBearing(row.property)) {
      for (const literal of colorLiterals(row.value)) {
        if (!row.custom_property) {
          raw.colors.push({ ...row, literal });
          sourceMetric.direct_raw_colors += 1;
          componentMetric.direct_raw_colors += 1;
        }
      }
    }

    const isDirectRaw = !row.custom_property && !/\bvar\(/i.test(row.value);
    if (isDirectRaw && TYPOGRAPHY_PROPERTIES.has(row.property)) {
      raw.typography.push(row);
      sourceMetric.direct_raw_typography += 1;
      componentMetric.direct_raw_typography += 1;
    }
    if (isDirectRaw && SPACING_PROPERTIES.has(row.property)) {
      raw.spacing.push(row);
      sourceMetric.direct_raw_spacing += 1;
      componentMetric.direct_raw_spacing += 1;
    }
    if (isDirectRaw && /(?:^|-)border-radius$/.test(row.property)) {
      raw.radii.push(row);
      sourceMetric.direct_raw_radii += 1;
      componentMetric.direct_raw_radii += 1;
    }
    if (isDirectRaw && row.property === 'z-index') {
      raw.z_index.push(row);
      sourceMetric.direct_raw_z_index += 1;
      componentMetric.direct_raw_z_index += 1;
    }
  }

  const tokenNames = [...new Set([
    ...definitions.keys(),
    ...references.keys(),
  ])].sort();
  const tokens = tokenNames.map(name => {
    const definitionRows = definitions.get(name) || [];
    const referenceRows = references.get(name) || [];
    const values = [...new Set(definitionRows.map(row => row.declaration_value))].sort();
    return {
      name,
      definition_count: definitionRows.length,
      reference_count: referenceRows.length,
      fallback_reference_count: referenceRows.filter(row => row.has_fallback).length,
      distinct_definition_values: values,
      multiple_definition_values: values.length > 1,
      definitions: definitionRows,
      reference_sample: referenceRows.slice(0, CONTEXT_SAMPLE_CAP),
      reference_sample_cap: CONTEXT_SAMPLE_CAP,
    };
  });

  function addScore(row) {
    return {
      ...row,
      raw_value_score: row.direct_raw_colors
        + row.direct_raw_typography
        + row.direct_raw_spacing
        + row.direct_raw_radii
        + row.direct_raw_z_index,
    };
  }

  const componentRows = [...components.values()]
    .map(addScore)
    .sort((a, b) => (
      b.raw_value_score - a.raw_value_score
      || b.declarations - a.declarations
      || `${a.source}::${a.selector}`.localeCompare(`${b.source}::${b.selector}`)
    ));
  const sourceRows = [...sourceMetrics.values()]
    .map(addScore)
    .sort((a, b) => (
      b.raw_value_score - a.raw_value_score
      || b.declarations - a.declarations
      || a.source.localeCompare(b.source)
    ));
  const isolated = Object.fromEntries(
    Object.entries(raw).map(([category, rows]) => [
      category,
      aggregateOccurrences(rows, category),
    ]),
  );

  const rawOccurrenceTotals = Object.fromEntries(
    Object.entries(raw).map(([category, rows]) => [category, rows.length]),
  );
  const rawDistinctTotals = Object.fromEntries(
    Object.entries(isolated).map(([category, rows]) => [category, rows.length]),
  );
  const rawOneOffTotals = Object.fromEntries(
    Object.entries(isolated).map(([category, rows]) => [
      category,
      rows.filter(row => row.one_off).length,
    ]),
  );
  const unresolvedTokens = tokens
    .filter(token => token.reference_count > 0 && token.definition_count === 0)
    .map(token => token.name);
  const multiValuedTokens = tokens
    .filter(token => token.multiple_definition_values)
    .map(token => token.name);

  return {
    schema: 'seminar-schools-audit42-design-token-inventory-v1',
    release_id: release.release_id,
    generated_at: release.generated_at,
    source_fingerprint_sha256: fingerprint.digest('hex'),
    scope: {
      shared_css: shared.map(source => source.path),
      representative_pages: representative.coverage,
      source_units: sources.length,
      extraction: [
        'Authored custom-property definitions and var() references are inventoried lexically.',
        'All style blocks and style attributes in the seven representative source pages are included, even when a page has no inline style block.',
        'Direct raw values mean non-custom-property declarations that do not use var(); raw color literals in ordinary declarations are counted even when another token appears in the same value.',
        'Selectors are component-level authored contexts; cascade resolution and browser-computed styles are outside this static inventory.',
      ],
    },
    totals: {
      declarations: declarations.length,
      component_contexts: componentRows.length,
      custom_property_names: tokens.filter(token => token.definition_count > 0).length,
      custom_property_definitions: [...definitions.values()]
        .reduce((sum, rows) => sum + rows.length, 0),
      var_reference_names: tokens.filter(token => token.reference_count > 0).length,
      var_references: [...references.values()]
        .reduce((sum, rows) => sum + rows.length, 0),
      unresolved_var_reference_names: unresolvedTokens.length,
      multi_valued_custom_property_names: multiValuedTokens.length,
      direct_raw_occurrences: rawOccurrenceTotals,
      distinct_direct_raw_values: rawDistinctTotals,
      one_off_direct_raw_values: rawOneOffTotals,
    },
    tokens,
    unresolved_var_references: unresolvedTokens,
    multi_valued_custom_properties: multiValuedTokens,
    isolated_raw_values: isolated,
    components: componentRows,
    sources: sourceRows,
    hotspots: {
      ranking_note: 'Raw-value score is the sum of direct raw color, typography, spacing, radius, and z-index occurrences. It is a maintenance target, not a quality verdict.',
      multi_value_note: 'A multi-valued custom property may be an intentional theme or component override; this inventory flags review surface without calling it a defect.',
      top_components_by_direct_raw_values: componentRows.slice(0, 40),
      top_sources_by_direct_raw_values: sourceRows.slice(0, 20),
      one_off_value_counts: rawOneOffTotals,
      unresolved_var_references: unresolvedTokens,
      multi_valued_custom_properties: multiValuedTokens,
    },
    limitations: [
      'This dependency-free lexical audit does not execute JavaScript, expand the cascade, resolve media queries, or judge whether an intentional project-local value should become shared.',
      'CSS shorthands remain at their authored declaration value instead of being expanded into computed longhands.',
      `Occurrence totals are exact for the declared scope; per-value context samples are capped at ${CONTEXT_SAMPLE_CAP} while source and component counts remain exact.`,
    ],
  };
}

const inventory = build();
const serialized = `${JSON.stringify(inventory, null, 2)}\n`;
if (CHECK) {
  let current = '';
  try {
    current = fs.readFileSync(OUTPUT, 'utf8');
  } catch (_) {
    // The failure below gives the canonical regeneration command.
  }
  if (current !== serialized) {
    console.error(
      'AUDIT 42 DESIGN TOKEN INVENTORY FAILED — run '
        + 'node scripts/build-audit42-design-token-inventory.js and review '
        + 'the changed token and hotspot inventory.',
    );
    process.exit(1);
  }
  console.log(
    `AUDIT 42 DESIGN TOKEN INVENTORY PASSED — ${inventory.totals.declarations} `
      + `declarations, ${inventory.totals.custom_property_names} tokens, `
      + `${inventory.totals.component_contexts} component contexts.`,
  );
} else {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, serialized);
  console.log(
    `AUDIT 42 DESIGN TOKEN INVENTORY WRITTEN — ${inventory.totals.declarations} `
      + `declarations, ${inventory.totals.custom_property_names} tokens, `
      + `${inventory.totals.component_contexts} component contexts.`,
  );
}
