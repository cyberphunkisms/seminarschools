'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Parse the historical Methodologylist SEED plus intentional post-baseline
 * addenda. The July 2026 Snakelogic examples remain outside the frozen SEED
 * count while every current mirror and discovery surface receives them.
 */

function parseDeclaredArray(html, declaration, required = true) {
  const declarationIndex = html.indexOf(declaration);
  if (declarationIndex === -1) {
    if (required) throw new Error('No ' + declaration + ' declaration');
    return [];
  }

  const arrayStart = html.indexOf('[', declarationIndex);
  if (arrayStart === -1) throw new Error('No array after ' + declaration);

  let depth = 0;
  let inTemplate = false;
  let stringQuote = null;
  let escape = false;
  let arrayEnd = -1;

  for (let index = arrayStart; index < html.length; index += 1) {
    const character = html[index];
    if (escape) {
      escape = false;
      continue;
    }
    if (character === '\\') {
      escape = true;
      continue;
    }
    if (stringQuote) {
      if (character === stringQuote) stringQuote = null;
      continue;
    }
    if (inTemplate) {
      if (character === '`') inTemplate = false;
      continue;
    }
    if (character === '`') {
      inTemplate = true;
      continue;
    }
    if (character === "'" || character === '"') {
      stringQuote = character;
      continue;
    }
    if (character === '[') depth += 1;
    if (character === ']') {
      depth -= 1;
      if (depth === 0) {
        arrayEnd = index;
        break;
      }
    }
  }

  if (arrayEnd === -1) throw new Error('Unbalanced array after ' + declaration);
  // Repository-owned JavaScript data, matching the established mirror parser.
  // eslint-disable-next-line no-eval
  return eval(html.slice(arrayStart, arrayEnd + 1));
}

function parseSnakelogicExampleAddendum(html) {
  const startMarker = '/* SNAKELOGIC_EXAMPLE_ADDENDUM_START';
  const endMarker = 'SNAKELOGIC_EXAMPLE_ADDENDUM_END */';
  const start = html.indexOf(startMarker);
  if (start === -1) return [];
  const end = html.indexOf(endMarker, start + startMarker.length);
  if (end === -1) throw new Error('Unclosed Snakelogic example addendum');
  const literal = html.slice(start + startMarker.length, end).trim();
  // Repository-owned JavaScript data stored beside its historical SEED slot.
  // eslint-disable-next-line no-eval
  return eval('[' + literal + ']');
}

function parseMythologyIntegrationAddendum() {
  const addendumPath = path.resolve(
    __dirname,
    '../../polymyth/methodologylist/mythology-integration-addendum.js'
  );
  if (!fs.existsSync(addendumPath)) return [];
  const source = fs.readFileSync(addendumPath, 'utf8');
  return parseDeclaredArray(
    source,
    'const MYTHOLOGY_INTEGRATION_ADDENDUM'
  );
}

function parseRhetoricTaxonomyAddendum() {
  const addendumPath = path.resolve(
    __dirname,
    '../../polymyth/methodologylist/rhetoric-taxonomy-addendum.js'
  );
  if (!fs.existsSync(addendumPath)) {
    throw new Error('Missing rhetoric taxonomy addendum: ' + addendumPath);
  }
  const source = fs.readFileSync(addendumPath, 'utf8');
  return parseDeclaredArray(
    source,
    'const RHETORIC_TAXONOMY_ADDENDUM'
  );
}

function entryKey(entry) {
  return entry.id || [entry.s || '', entry.t || ''].join('\u0000');
}

function parseSeedWithAddenda(html) {
  const combined = [
    ...parseDeclaredArray(html, 'const SEED'),
    ...parseSnakelogicExampleAddendum(html),
    ...parseMythologyIntegrationAddendum(),
    ...parseRhetoricTaxonomyAddendum(),
  ];
  const seen = new Set();
  return combined.filter((entry) => {
    const key = entryKey(entry);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

module.exports = {
  parseDeclaredArray,
  parseMythologyIntegrationAddendum,
  parseRhetoricTaxonomyAddendum,
  parseSeedWithAddenda,
  parseSnakelogicExampleAddendum,
};
