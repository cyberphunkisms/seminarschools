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

function parsePolymythCoherenceRoutingAddendum() {
  const addendumPath = path.resolve(
    __dirname,
    '../../polymyth/methodologylist/polymyth-coherence-routing-addendum.js'
  );
  if (!fs.existsSync(addendumPath)) {
    throw new Error('Missing Polymyth Coherence routing addendum: ' + addendumPath);
  }
  const source = fs.readFileSync(addendumPath, 'utf8');
  return parseDeclaredArray(
    source,
    'const POLYMYTH_COHERENCE_ROUTING_ADDENDUM'
  );
}

function parseMephistodataRuleHardeningAddendum() {
  const addendumPath = path.resolve(
    __dirname,
    '../../polymyth/methodologylist/mephistodata-rule-hardening-addendum.js'
  );
  if (!fs.existsSync(addendumPath)) {
    throw new Error('Missing Mephistodata rule-hardening addendum: ' + addendumPath);
  }
  const source = fs.readFileSync(addendumPath, 'utf8');
  return parseDeclaredArray(source, 'const MEPHISTODATA_RULE_HARDENING_ADDENDUM');
}

function parseSeedWithAddenda(html) {
  const combined = [
    ...parseDeclaredArray(html, 'const SEED'),
    ...parseSnakelogicExampleAddendum(html),
    ...parseMythologyIntegrationAddendum(),
    ...parseRhetoricTaxonomyAddendum(),
    ...parsePolymythCoherenceRoutingAddendum(),
    ...parseMephistodataRuleHardeningAddendum(),
  ];
  const seenIds = new Map();
  const seenSemanticOwners = new Map();
  for (const [index, entry] of combined.entries()) {
    const section = String(entry.s || '').trim();
    const title = String(entry.t || '').trim();
    const semanticKey = [section, title].join('\u0000');
    if (seenSemanticOwners.has(semanticKey)) {
      const first = seenSemanticOwners.get(semanticKey);
      throw new Error(
        `Duplicate Methodologylist semantic owner at ${index}: ${section || '<missing section>'} / ${title || '<missing title>'}; first seen at ${first}`,
      );
    }
    seenSemanticOwners.set(semanticKey, index);
    if (entry.id) {
      if (seenIds.has(entry.id)) {
        throw new Error(`Duplicate Methodologylist id ${entry.id} at ${index}; first seen at ${seenIds.get(entry.id)}`);
      }
      seenIds.set(entry.id, index);
    }
  }
  return combined;
}

module.exports = {
  parseDeclaredArray,
  parseMephistodataRuleHardeningAddendum,
  parseMythologyIntegrationAddendum,
  parsePolymythCoherenceRoutingAddendum,
  parseRhetoricTaxonomyAddendum,
  parseSeedWithAddenda,
  parseSnakelogicExampleAddendum,
};
