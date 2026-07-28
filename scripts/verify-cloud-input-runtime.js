#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const errors = [];

const SOURCE_ROUTES = [
  'aa/cloud/index.html',
  'leizu/cloud/index.html',
  'leizu/fa/cloud/index.html',
  'leizu/fr/cloud/index.html',
  'leizu/zh-hans/cloud/index.html',
  'leizu/zh-hant/cloud/index.html',
];
const ROUTES = [
  ...SOURCE_ROUTES,
  ...SOURCE_ROUTES.map(route => `public/${route}`),
];

function fail(route, message) {
  errors.push(`${route}: ${message}`);
}

function read(route) {
  const file = path.join(ROOT, route);
  if (!fs.existsSync(file)) {
    fail(route, 'missing cloud page');
    return '';
  }
  return fs.readFileSync(file, 'utf8');
}

function matchingBrace(text, openingIndex) {
  let depth = 0;
  let state = 'code';
  let escaped = false;

  for (let index = openingIndex; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (state === 'line-comment') {
      if (char === '\n') state = 'code';
      continue;
    }
    if (state === 'block-comment') {
      if (char === '*' && next === '/') {
        state = 'code';
        index += 1;
      }
      continue;
    }
    if (state === 'single-quote' || state === 'double-quote' || state === 'template') {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (
        (state === 'single-quote' && char === "'")
        || (state === 'double-quote' && char === '"')
        || (state === 'template' && char === '`')
      ) {
        state = 'code';
      }
      continue;
    }

    if (char === '/' && next === '/') {
      state = 'line-comment';
      index += 1;
      continue;
    }
    if (char === '/' && next === '*') {
      state = 'block-comment';
      index += 1;
      continue;
    }
    if (char === "'") {
      state = 'single-quote';
      continue;
    }
    if (char === '"') {
      state = 'double-quote';
      continue;
    }
    if (char === '`') {
      state = 'template';
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function functionBody(text, name) {
  const patterns = [
    new RegExp(`\\bfunction\\s+${name}\\s*\\([^)]*\\)\\s*\\{`, 'g'),
    new RegExp(`\\b(?:const|let|var)\\s+${name}\\s*=\\s*(?:async\\s*)?(?:\\([^)]*\\)|[A-Za-z_$][\\w$]*)\\s*=>\\s*\\{`, 'g'),
  ];
  const matches = [];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const openingIndex = match.index + match[0].lastIndexOf('{');
      const closingIndex = matchingBrace(text, openingIndex);
      if (closingIndex >= 0) matches.push(text.slice(openingIndex + 1, closingIndex));
    }
  }
  return matches;
}

function listenerBodies(text, target, eventName) {
  const pattern = new RegExp(
    `\\b${target}\\.addEventListener\\(\\s*(['"])${eventName}\\1\\s*,\\s*`,
    'g',
  );
  const bodies = [];

  for (const match of text.matchAll(pattern)) {
    const callbackStart = match.index + match[0].length;
    const callbackTail = text.slice(callbackStart, callbackStart + 300);
    const arrowIndex = callbackTail.indexOf('=>');

    if (arrowIndex >= 0) {
      const openingOffset = callbackTail.indexOf('{', arrowIndex + 2);
      if (openingOffset < 0) continue;
      const openingIndex = callbackStart + openingOffset;
      const closingIndex = matchingBrace(text, openingIndex);
      if (closingIndex >= 0) bodies.push(text.slice(openingIndex + 1, closingIndex));
      continue;
    }

    const namedCallback = callbackTail.match(/^([A-Za-z_$][\w$]*)/);
    if (namedCallback) bodies.push(...functionBody(text, namedCallback[1]));
  }
  return bodies;
}

function requireSingleFunction(route, text, name) {
  const bodies = functionBody(text, name);
  if (bodies.length !== 1) {
    fail(route, `expected one ${name}() definition, found ${bodies.length}`);
    return '';
  }
  return bodies[0];
}

function requireSingleListener(route, text, target, eventName) {
  const bodies = listenerBodies(text, target, eventName);
  if (bodies.length !== 1) {
    fail(route, `expected one ${target} ${eventName} listener, found ${bodies.length}`);
    return '';
  }
  return bodies[0];
}

function inspect(route) {
  const html = read(route);
  if (!html) return;

  const canvasRule = html.match(/#canvas\s*\{[^}]*\}/s);
  if (!canvasRule || !/\btouch-action\s*:\s*none\s*;?/i.test(canvasRule[0])) {
    fail(route, '#canvas must declare touch-action: none');
  }

  for (const declaration of [
    /\blet\s+canvasRectCache\s*=\s*null\s*;/,
    /\blet\s+inputFrame\s*=\s*0\s*;/,
    /\blet\s+pendingMousePoint\s*=\s*null\s*;/,
    /\blet\s+transformPending\s*=\s*false\s*;/,
  ]) {
    if (!declaration.test(html)) fail(route, `missing runtime declaration ${declaration.source}`);
  }

  const invalidateBody = requireSingleFunction(route, html, 'invalidateCanvasRect');
  if (!/\bcanvasRectCache\s*=\s*null\s*;/.test(invalidateBody)) {
    fail(route, 'invalidateCanvasRect() must clear canvasRectCache');
  }

  const getRectBody = requireSingleFunction(route, html, 'getCanvasRect');
  if (!/\bcanvasRectCache\s*=\s*canvas\.getBoundingClientRect\(\)\s*;/.test(getRectBody)) {
    fail(route, 'getCanvasRect() must populate canvasRectCache from one layout read');
  }
  if (!/\breturn\s+canvasRectCache\s*;/.test(getRectBody)) {
    fail(route, 'getCanvasRect() must return canvasRectCache');
  }
  const layoutReads = html.match(/\bcanvas\.getBoundingClientRect\(\)/g) || [];
  if (layoutReads.length !== 1) {
    fail(route, `expected one cached canvas layout read, found ${layoutReads.length}`);
  }

  const inputBody = requireSingleFunction(route, html, 'scheduleInputFrame');
  const inputRafAssignments = html.match(
    /\binputFrame\s*=\s*(?:window\.)?requestAnimationFrame\s*\(/g,
  ) || [];
  if (inputRafAssignments.length !== 1) {
    fail(route, `expected one inputFrame requestAnimationFrame assignment, found ${inputRafAssignments.length}`);
  }
  if (!/\binputFrame\s*=\s*(?:window\.)?requestAnimationFrame\s*\(/.test(inputBody)) {
    fail(route, 'scheduleInputFrame() must own the input requestAnimationFrame');
  }
  if (!/\bif\s*\(\s*inputFrame\s*\)\s*return\s*;/.test(inputBody)) {
    fail(route, 'scheduleInputFrame() must coalesce work behind an inputFrame guard');
  }
  if (!/\bpendingMousePoint\b/.test(inputBody) || !/\bgetCanvasRect\s*\(/.test(inputBody)) {
    fail(route, 'scheduleInputFrame() must flush pending pointer coordinates through getCanvasRect()');
  }
  if (
    !/\btransformPending\b/.test(inputBody)
    || !/\bapplyTransform\s*\(/.test(inputBody)
  ) {
    fail(route, 'scheduleInputFrame() must flush the pending transform');
  }

  const transformBody = requireSingleFunction(route, html, 'scheduleTransform');
  if (
    !/\btransformPending\s*=\s*true\s*;/.test(transformBody)
    || !/\bscheduleInputFrame\s*\(\s*\)\s*;/.test(transformBody)
  ) {
    fail(route, 'scheduleTransform() must delegate transform work to scheduleInputFrame()');
  }
  if (/\brequestAnimationFrame\s*\(/.test(transformBody)) {
    fail(route, 'scheduleTransform() must not create a second input RAF path');
  }

  const applyBodies = functionBody(html, 'applyTransform');
  if (applyBodies.length !== 1 || !/\bgetCanvasRect\s*\(/.test(applyBodies[0] || '')) {
    fail(route, 'applyTransform() must use the cached getCanvasRect() dimensions');
  }

  const canvasMoveBody = requireSingleListener(route, html, 'canvas', 'mousemove');
  if (
    !/\bpendingMousePoint\s*=/.test(canvasMoveBody)
    || !/\bscheduleInputFrame\s*\(\s*\)\s*;/.test(canvasMoveBody)
  ) {
    fail(route, 'canvas mousemove must queue pointer coordinates through scheduleInputFrame()');
  }

  const windowMoveBody = requireSingleListener(route, html, 'window', 'mousemove');
  if (!/\bscheduleTransform\s*\(\s*\)\s*;/.test(windowMoveBody)) {
    fail(route, 'window mousemove drag must queue its transform through scheduleTransform()');
  }

  const wheelBody = requireSingleListener(route, html, 'canvas', 'wheel');
  if (
    !/\bgetCanvasRect\s*\(\s*\)/.test(wheelBody)
    || !/\bscheduleTransform\s*\(\s*\)\s*;/.test(wheelBody)
  ) {
    fail(route, 'wheel input must use getCanvasRect() and scheduleTransform()');
  }

  const touchMoveBody = requireSingleListener(route, html, 'canvas', 'touchmove');
  if (!/\bscheduleTransform\s*\(\s*\)\s*;/.test(touchMoveBody)) {
    fail(route, 'touchmove must queue its transform through scheduleTransform()');
  }

  for (const [label, body] of [
    ['canvas mousemove', canvasMoveBody],
    ['window mousemove', windowMoveBody],
    ['wheel', wheelBody],
    ['touchmove', touchMoveBody],
  ]) {
    if (/\bapplyTransform\s*\(/.test(body)) {
      fail(route, `${label} performs a direct applyTransform()`);
    }
    if (/\bcanvas\.getBoundingClientRect\s*\(/.test(body)) {
      fail(route, `${label} performs an uncached canvas layout read`);
    }
  }

  const resizeBody = requireSingleListener(route, html, 'window', 'resize');
  if (!/\binvalidateCanvasRect\s*\(\s*\)\s*;/.test(resizeBody)) {
    fail(route, 'resize must invalidate the cached canvas rect');
  }

  const pagehideBodies = listenerBodies(html, 'window', 'pagehide');
  if (!pagehideBodies.length) fail(route, 'missing window pagehide cleanup listener');
  const pagehideBody = pagehideBodies.join('\n');
  if (!/\bcancelAnimationFrame\s*\(\s*inputFrame\s*\)\s*;/.test(pagehideBody)) {
    fail(route, 'pagehide must cancel a pending inputFrame');
  }
  for (const reset of [
    /\binputFrame\s*=\s*0\s*;/,
    /\bpendingMousePoint\s*=\s*null\s*;/,
    /\btransformPending\s*=\s*false\s*;/,
    /\binvalidateCanvasRect\s*\(\s*\)\s*;/,
  ]) {
    if (!reset.test(pagehideBody)) fail(route, `pagehide missing input-state reset ${reset.source}`);
  }
}

ROUTES.forEach(inspect);

if (errors.length) {
  console.error('CLOUD INPUT RUNTIME CHECK FAILED');
  errors.forEach(error => console.error(` - ${error}`));
  process.exit(1);
}

console.log(
  `CLOUD INPUT RUNTIME CHECK PASSED — ${ROUTES.length} source/generated AA and Leizu cloud controllers share one RAF-coalesced input path, cached canvas geometry, touch-safe interaction, and pagehide cleanup.`,
);
