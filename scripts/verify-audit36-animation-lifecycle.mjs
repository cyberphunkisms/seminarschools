#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import vm from 'node:vm';

const root = process.cwd();
const rainPath = path.join(root, 'js', 'bookworm-rain.js');
const rain = fs.readFileSync(rainPath, 'utf8');
const worm = fs.readFileSync(path.join(root, 'bookwormcard', 'index.html'), 'utf8');
const success = fs.readFileSync(path.join(root, 'bookwormcard', 'success', 'index.html'), 'utf8');
const tamagotchi = fs.readFileSync(path.join(root, 'bookwormcard', 'tamagotchi.js'), 'utf8');
const failures = [];

function requireToken(source, token, message) {
  if (!source.includes(token)) failures.push(message);
}

for (const [name, html, color, fade] of [
  ['creator', worm, '#ff3ee0', 'rgba(8,7,13,0.06)'],
  ['success', success, '#33ff66', 'rgba(10,14,10,0.06)']
]) {
  requireToken(html, 'src="/js/bookworm-rain.js?v=20260724-rain-lifecycle"', `${name} page must use the shared rain lifecycle`);
  requireToken(html, `data-rain-color="${color}"`, `${name} page must preserve its rain colour`);
  requireToken(html, `data-rain-fade="${fade}"`, `${name} page must preserve its rain fade`);
  if (/setInterval\s*\(\s*draw\s*,\s*80\s*\)/.test(html)) failures.push(`${name} page retained the perpetual rain interval`);
}

for (const [token, message] of [
  ['requestAnimationFrame(tick)', 'rain must use display-synchronised frames'],
  ["document.addEventListener('visibilitychange', sync)", 'rain must pause and resume with page visibility'],
  ["window.addEventListener('pagehide', stop)", 'rain must stop when the page leaves'],
  ["matchMedia('(prefers-reduced-motion: reduce)')", 'rain must honor operating-system reduced motion'],
  ["attributeFilter: ['data-motion']", 'rain must react to the site calm-motion control'],
  ['Math.min(window.devicePixelRatio || 1, 2)', 'rain must cap high-density canvas work'],
  ['timestamp - previousDraw >= 80', 'rain must retain the low frame-rate budget']
]) requireToken(rain, token, message);

if (/\bsetInterval\s*\(/.test(rain)) failures.push('shared rain lifecycle must not use a perpetual interval');
if (/\bsetInterval\s*\(/.test(tamagotchi)) failures.push('Tamagotchi idle checking must not use a perpetual interval');
requireToken(tamagotchi, 'function scheduleIdleCheck()', 'Tamagotchi needs a self-scheduling idle check');
requireToken(tamagotchi, "document.addEventListener('visibilitychange', syncIdleLifecycle)", 'Tamagotchi must pause idle work while hidden');
requireToken(tamagotchi, "matchMedia('(prefers-reduced-motion: reduce)')", 'Tamagotchi must honor reduced motion');

try {
  new Function(rain);
  new Function(tamagotchi);
} catch (error) {
  failures.push(`animation source does not compile: ${error.message}`);
}

try {
  const documentListeners = new Map();
  const frames = new Map();
  let nextFrame = 1;
  let draws = 0;
  const ctx = {
    setTransform() {},
    fillRect() {},
    fillText() { draws += 1; },
    set fillStyle(value) {},
    set font(value) {}
  };
  const canvas = {
    dataset: { rainColor: '#ff3ee0', rainFade: 'rgba(8,7,13,0.06)' },
    getContext: () => ctx,
    width: 0,
    height: 0
  };
  const documentElement = { dataset: { motion: '' } };
  const document = {
    hidden: false,
    documentElement,
    getElementById: id => id === 'rain-canvas' ? canvas : null,
    addEventListener: (type, handler) => documentListeners.set(type, handler)
  };
  const media = { matches: false, addEventListener() {} };
  const window = {
    innerWidth: 320,
    innerHeight: 480,
    devicePixelRatio: 3,
    matchMedia: () => media,
    addEventListener() {},
    requestAnimationFrame(callback) {
      const id = nextFrame++;
      frames.set(id, callback);
      return id;
    },
    cancelAnimationFrame(id) { frames.delete(id); }
  };
  class MutationObserver { observe() {} }
  vm.runInNewContext(rain, { document, window, MutationObserver, Math });
  if (frames.size !== 1) throw new Error(`expected one initial animation frame, found ${frames.size}`);

  document.hidden = true;
  documentListeners.get('visibilitychange')();
  if (frames.size !== 0) throw new Error('hidden page retained a scheduled animation frame');

  document.hidden = false;
  documentElement.dataset.motion = 'calm';
  documentListeners.get('visibilitychange')();
  if (frames.size !== 0) throw new Error('calm-motion mode scheduled an animation frame');

  documentElement.dataset.motion = '';
  documentListeners.get('visibilitychange')();
  const [frameId, callback] = frames.entries().next().value;
  frames.delete(frameId);
  callback(100);
  if (draws === 0 || frames.size !== 1) throw new Error('active animation did not draw and schedule its next frame');
} catch (error) {
  failures.push(`rain lifecycle behavior failed: ${error.message}`);
}

if (failures.length) {
  console.error('AUDIT36 ANIMATION LIFECYCLE FAILED');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('AUDIT36 ANIMATION LIFECYCLE PASSED — shared rain and Tamagotchi idle work pause for hidden/calm/reduced-motion states.');
