#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import vm from 'node:vm';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const aa = fs.readFileSync(path.join(root, 'aa', 'cloud', 'index.html'), 'utf8');
const saulJs = fs.readFileSync(path.join(root, 'saul', 'assets', 'saul-cv-spectrum-2026.js'), 'utf8');
const saulCss = fs.readFileSync(path.join(root, 'saul', 'assets', 'saul-cv-spectrum-2026.css'), 'utf8');
const failures = [];

function need(source, token, message) {
  if (!source.includes(token)) failures.push(message);
}

for (const [token, message] of [
  ["window.matchMedia('(max-width: 600px)')", 'AA mobile mode must use the same inclusive 600px media query as CSS'],
  ["window.matchMedia('(prefers-reduced-motion: reduce)')", 'AA simulation must honor reduced motion'],
  ["document.documentElement.dataset.motion !== 'calm'", 'AA simulation must honor the site calm-motion contract'],
  ['SIM_MAX_ACTIVE_MS = 8000', 'AA simulation needs a hard active-time ceiling'],
  ['window.cancelAnimationFrame(simFrameId)', 'AA simulation must cancel its retained frame'],
  ['if (!simRunning || simFrameId || !simulationAllowed()) return;', 'AA simulation must reject parallel frame schedules'],
  ["document.addEventListener('visibilitychange', syncSimulationLifecycle)", 'AA simulation must respond to visibility'],
  ["window.addEventListener('pagehide', () => stopSimulation(false))", 'AA simulation must stop on page exit'],
  ["window.addEventListener('orientationchange', syncCloudEnvironment", 'AA mobile mode must resync on orientation'],
  ["listenForMediaChange(mobileOutlinerQuery, syncCloudEnvironment)", 'AA mobile mode must react to breakpoint crossings'],
  ["container.dataset.built = 'true'", 'AA mobile outline must be idempotent'],
  ['overflow-y: auto;', 'AA mobile outline must restore vertical scrolling'],
  ['min-height: 44px;', 'AA mobile outline summaries must retain touch-size targets']
]) need(aa, token, message);

if (/if\s*\(\s*window\.innerWidth\s*>=\s*600\s*\)\s*return/.test(aa)) {
  failures.push('AA retained the old 600px JS/CSS boundary mismatch');
}
if (/\n\s*requestAnimationFrame\(simLoop\);/.test(aa)) {
  failures.push('AA retained an untracked perpetual simulation schedule');
}

need(saulJs, 'class="cv-spectrum__job"><h3>', 'Saul hydrated jobs must preserve the static h3 hierarchy');
if (saulJs.includes('class="cv-spectrum__job"><h4>')) failures.push('Saul hydration still demotes job headings to h4');
need(saulJs, "stage?.classList.remove('is-unavailable')", 'Saul map load must clear a prior unavailable state');
need(saulJs, "stage?.classList.add('is-unavailable')", 'Saul map error must expose an unavailable state');
need(saulJs, 'Interactive map unavailable. Use the open-map link.', 'Saul map failure must provide visible status copy');
need(saulCss, '.cv-map-stage.is-unavailable .cv-map-loading', 'Saul unavailable state must have a visible CSS consumer');
const mapLifecycle = saulJs.match(/const mapFrame = document\.querySelector\('\[data-cv-map-frame\]'\);([\s\S]*?)const localNav =/);
if (!mapLifecycle) {
  failures.push('Saul map lifecycle block is missing');
} else if (/\bsetTimeout\s*\(/.test(mapLifecycle[1])) {
  failures.push('Saul map lifecycle retained the false unavailable timeout for lazy frames');
}

const inlineScripts = [...aa.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
  .map(match => match[1])
  .filter(source => source.trim());
for (const [index, source] of inlineScripts.entries()) {
  try {
    new Function(source);
  } catch (error) {
    failures.push(`AA inline script ${index + 1} does not compile: ${error.message}`);
  }
}
try {
  new Function(saulJs);
} catch (error) {
  failures.push(`Saul hydration script does not compile: ${error.message}`);
}

// Exercise the isolated AA scheduler with browser-like frame/media stubs. This
// verifies cancellation and de-duplication behavior, not just source tokens.
try {
  const lifecycleMatch = aa.match(/let mouseWorldX = 0, mouseWorldY = 0;([\s\S]*?)(?=\nfunction simTick\(\)\{)/);
  const loopMatch = aa.match(/function simLoop\(timestamp\)\{([\s\S]*?)(?=\n\}\n\n\/\/ ==================== AUTOFIT)/);
  if (!lifecycleMatch || !loopMatch) throw new Error('could not isolate lifecycle functions');

  let nextFrame = 1;
  const frames = new Map();
  const reduced = { matches: false };
  const mobile = { matches: false };
  let now = 100;
  const context = {
    document: { hidden: false, documentElement: { dataset: { motion: '' } } },
    performance: { now: () => now },
    window: {
      innerWidth: 900,
      matchMedia(query) {
        return query.includes('reduced-motion') ? reduced : mobile;
      },
      requestAnimationFrame(callback) {
        const id = nextFrame++;
        frames.set(id, callback);
        return id;
      },
      cancelAnimationFrame(id) { frames.delete(id); }
    },
    simLoop() {}
  };
  vm.createContext(context);
  vm.runInContext('let mouseWorldX = 0, mouseWorldY = 0;' + lifecycleMatch[1], context);

  vm.runInContext('simPending = true; simRunning = true; simStartedAt = performance.now(); scheduleSimulationFrame();', context);
  if (frames.size !== 1) throw new Error(`expected one active frame, found ${frames.size}`);
  vm.runInContext('scheduleSimulationFrame(); syncSimulationLifecycle();', context);
  if (frames.size !== 1) throw new Error('parallel lifecycle calls scheduled duplicate frames');

  context.document.hidden = true;
  vm.runInContext('syncSimulationLifecycle();', context);
  if (frames.size !== 0) throw new Error('hidden lifecycle retained a frame');

  context.document.hidden = false;
  context.document.documentElement.dataset.motion = 'calm';
  vm.runInContext('syncSimulationLifecycle();', context);
  if (frames.size !== 0) throw new Error('calm lifecycle scheduled a frame');

  context.document.documentElement.dataset.motion = '';
  reduced.matches = true;
  vm.runInContext('syncSimulationLifecycle();', context);
  if (frames.size !== 0) throw new Error('reduced-motion lifecycle scheduled a frame');

  reduced.matches = false;
  mobile.matches = true;
  vm.runInContext('syncSimulationLifecycle();', context);
  if (frames.size !== 0) throw new Error('mobile-outliner lifecycle scheduled a cloud frame');

  mobile.matches = false;
  now = 200;
  vm.runInContext('syncSimulationLifecycle();', context);
  if (frames.size !== 1) throw new Error('eligible pending lifecycle did not resume exactly once');
  frames.clear();

  vm.runInContext(
    'function simTick(){ simEnergy = 0; }\n' +
    'function eggT(){ return 1; }\n' +
    `function simLoop(timestamp){${loopMatch[1]}\n}`,
    context
  );
  vm.runInContext('simFrameId = 0; simPending = true; simRunning = true; simStartedAt = 0; simLoop(SIM_MAX_ACTIVE_MS + 1);', context);
  if (vm.runInContext('simPending', context) !== false || frames.size !== 0) {
    throw new Error('hard time ceiling did not fully stop the simulation');
  }
} catch (error) {
  failures.push(`AA lifecycle behavior failed: ${error.message}`);
}

if (failures.length) {
  console.error('AA + SAUL RUNTIME SMOOTHNESS FAILED');
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('AA + SAUL RUNTIME SMOOTHNESS PASSED — bounded single-frame lifecycle, responsive mobile outline, and stable Saul hydration/map states verified.');
