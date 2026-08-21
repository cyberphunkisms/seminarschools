#!/usr/bin/env node
'use strict';

/* Strict execution gate for the canonical all-page Indra background.
   This deliberately rejects the former shallow/structure-dependent field. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const {
  GEOMETRY_VERSION,
  applyGeometryToHtml,
  geometryKeyFor,
  registerFor,
  seedFor,
} = require('./apply-visible-geometry');

const ROOT = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const contracts = JSON.parse(read('data/geometry-route-contracts.json'));
const mandalaSource = read('js/mandala.js');
const indraSource = read('js/indra.js');
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

function normalizeIds(markup) {
  return String(markup)
    .replace(/[a-zA-Z0-9_-]+-jewel-(?:core|prism)/g, 'canonical-jewel')
    .replace(/\s+/g, ' ');
}

function semanticGeometryDigest(markup) {
  const rows = [];
  const attr = (source, name) => {
    const match = source.match(new RegExp(`\\b${name}="([^"]*)"`));
    return match ? match[1] : '';
  };
  for (const match of String(markup).matchAll(/<(circle|path)\b([^>]*)>/g)) {
    const attributes = match[2];
    let fill = attr(attributes, 'fill');
    if (/^url\(#[^)]*prism\)$/i.test(fill)) fill = 'PRISM';
    else if (/^url\(#[^)]*core\)$/i.test(fill)) fill = 'CORE';
    if (match[1] === 'circle') rows.push([
      'c', attr(attributes, 'cx'), attr(attributes, 'cy'), attr(attributes, 'r'),
      attr(attributes, 'stroke-width'), attr(attributes, 'opacity'), fill,
    ].join('|'));
    else rows.push([
      'p', attr(attributes, 'd'), attr(attributes, 'stroke-width'),
      attr(attributes, 'opacity'), fill,
    ].join('|'));
  }
  return crypto.createHash('sha256').update(rows.sort().join('\n'), 'utf8').digest('hex');
}

const mandalaWindow = {};
vm.runInNewContext(mandalaSource, { window: mandalaWindow, console, Math, Object });
const mandala = mandalaWindow.PolymythMandala;
check(mandala && typeof mandala.buildCanonical === 'function', 'mandala: buildCanonical export missing');
check(mandala && mandala.canonicalId === contracts.canonical_web.id, 'mandala: canonical ID disagrees with route contract');

let canonicalA = '';
let canonicalB = '';
if (mandala && typeof mandala.buildCanonical === 'function') {
  canonicalA = mandala.buildCanonical({ idPrefix: 'proof-a' });
  canonicalB = mandala.buildCanonical({ idPrefix: 'proof-b' });
  const gaskets = new Set([...canonicalA.matchAll(/data-gasket="(\d+)"/g)].map(match => match[1]));
  const shapes = (canonicalA.match(/<(?:circle|path|line|polygon|polyline|rect)\b/g) || []).length;
  const bytes = Buffer.byteLength(canonicalA);
  const options = mandala.canonicalOptions;
  check(gaskets.size === contracts.canonical_web.gaskets && ['0', '1', '2'].every(value => gaskets.has(value)), 'mandala: canonical web is not the full three-gasket field');
  check(/geo-flower(?:\s|"|-)/.test(canonicalA), 'mandala: tangency flowers missing');
  check(/geo-jewel-core/.test(canonicalA), 'mandala: Indra jewel cores missing');
  check(/geo-jewel-prism/.test(canonicalA), 'mandala: prismatic jewel rings missing');
  check(/geo-jewel-highlight/.test(canonicalA), 'mandala: jewel highlights missing');
  check(shapes > 1000 && shapes <= contracts.canonical_web.max_shapes_per_camera, `mandala: canonical shape budget failed (${shapes})`);
  check(bytes > 100000 && bytes <= contracts.canonical_web.max_markup_bytes_per_camera, `mandala: canonical markup budget failed (${bytes})`);
  check(normalizeIds(canonicalA) === normalizeIds(canonicalB), 'mandala: changing the SVG ID prefix changes canonical geometry');
  check(options && options.maxDepth === contracts.canonical_web.max_depth && options.minRadius === contracts.canonical_web.min_radius, 'mandala: recursion depth/radius drifted from old /main/');
  if (options && Array.isArray(options.gaskets)) {
    const rotations = options.gaskets.map(row => row.rot / Math.PI);
    const scales = options.gaskets.map(row => row.scale);
    const opacities = options.gaskets.map(row => row.op);
    for (let index = 0; index < 3; index += 1) {
      check(Math.abs(rotations[index] - contracts.canonical_web.gasket_rotations_pi[index]) < 1e-12, `mandala: gasket ${index} rotation drifted`);
      check(Math.abs(scales[index] - contracts.canonical_web.gasket_scales[index]) < 1e-12, `mandala: gasket ${index} scale drifted`);
      check(Math.abs(opacities[index] - contracts.canonical_web.gasket_opacities[index]) < 1e-12, `mandala: gasket ${index} opacity drifted`);
    }
  } else check(false, 'mandala: canonical gasket options missing');
  for (const [label, pattern, expected] of [
    ['gasket circles', /class="[^"]*geo-gasket-circle/g, contracts.canonical_web.gasket_circles],
    ['flower paths', /class="[^"]*geo-flower"/g, contracts.canonical_web.flower_paths],
    ['flower centers', /geo-flower-center/g, contracts.canonical_web.flower_centers],
    ['jewel prisms', /geo-jewel-prism/g, contracts.canonical_web.jewel_prisms],
    ['jewel cores', /geo-jewel-core/g, contracts.canonical_web.jewel_cores],
    ['jewel highlights', /geo-jewel-highlight/g, contracts.canonical_web.jewel_highlights],
    ['circle elements', /<circle\b/g, contracts.canonical_web.circle_elements],
    ['path elements', /<path\b/g, contracts.canonical_web.path_elements],
  ]) check((canonicalA.match(pattern) || []).length === expected, `mandala: exact old ${label} count drifted`);
  const normalizedDigest = crypto.createHash('sha256').update(normalizeIds(canonicalA)).digest('hex');
  check(normalizedDigest === contracts.canonical_web.normalized_sha256, 'mandala: normalized old /main/ geometry digest drifted');
  check(semanticGeometryDigest(canonicalA) === contracts.canonical_web.semantic_sha256, 'mandala: old /main/ semantic geometry digest drifted');
}

function makeStyle() {
  const values = Object.create(null);
  return {
    transform: '',
    setProperty(name, value) { values[name] = String(value); },
    getPropertyValue(name) { return values[name] || ''; }
  };
}

function makeNode(tag, byId) {
  const attributes = Object.create(null);
  const children = [];
  let innerHTML = '';
  let id = '';
  return {
    tagName: String(tag || 'div').toUpperCase(),
    className: '',
    children,
    style: makeStyle(),
    get id() { return id; },
    set id(value) { id = String(value); byId[id] = this; },
    get innerHTML() { return innerHTML; },
    set innerHTML(value) { innerHTML = String(value); },
    setAttribute(name, value) {
      attributes[name] = String(value);
      if (name === 'id') this.id = value;
      if (name === 'class') this.className = String(value);
    },
    getAttribute(name) { return Object.prototype.hasOwnProperty.call(attributes, name) ? attributes[name] : null; },
    removeAttribute(name) { delete attributes[name]; },
    appendChild(child) { children.push(child); if (child.id) byId[child.id] = child; return child; },
    querySelectorAll(selector) {
      if (selector === '.indra-camera') return children.filter(child => /(?:^|\s)indra-camera(?:\s|$)/.test(child.className));
      return [];
    }
  };
}

function execute(options = {}) {
  const byId = Object.create(null);
  const windowHandlers = Object.create(null);
  const documentHandlers = Object.create(null);
  const frameQueue = [];
  let nextFrame = 1;
  const root = makeNode('html', byId);
  root.scrollHeight = 4000;
  root.scrollTop = 0;
  const body = makeNode('body', byId);
  body.setAttribute('data-route-type', options.routeType || 'project');
  body.setAttribute('data-geometry', 'indra-web');
  body.setAttribute('data-geometry-key', options.key || options.pathname || '/proof/');
  body.setAttribute('data-geometry-register', options.register || 'standard');
  body.setAttribute('data-geometry-profile', options.profile || 'single');
  body.setAttribute('data-indra-intensity', options.intensity || '0.120');
  body.setAttribute('data-geometry-role', options.roles || 'relation movement');
  const document = {
    documentElement: root,
    body,
    hidden: false,
    createElement: tag => makeNode(tag, byId),
    getElementById: id => byId[id] || null,
    addEventListener(type, handler) { (documentHandlers[type] ||= []).push(handler); }
  };
  const window = {
    document,
    window: null,
    PolymythMandala: mandala,
    location: { pathname: options.pathname || '/proof/', search: options.search || '', hash: options.hash || '' },
    innerHeight: 800,
    innerWidth: 1200,
    scrollY: 0,
    matchMedia: query => ({ matches: !!options.reduced && /prefers-reduced-motion/.test(query) }),
    requestAnimationFrame(handler) { const id = nextFrame++; frameQueue.push({ id, handler }); return id; },
    cancelAnimationFrame(id) { const item = frameQueue.find(frame => frame.id === id); if (item) item.cancelled = true; },
    setTimeout() { return 1; },
    clearTimeout() {},
    addEventListener(type, handler) { (windowHandlers[type] ||= []).push(handler); }
  };
  window.window = window;
  function flushFrames() {
    while (frameQueue.length) {
      const frame = frameQueue.shift();
      if (!frame.cancelled) frame.handler(16.67);
    }
  }
  const context = vm.createContext({
    window, document, console, Math, Number, Object, String, RegExp, Array,
    TextEncoder, decodeURI, encodeURIComponent, unescape
  });
  let error = null;
  try { vm.runInContext(indraSource, context); flushFrames(); } catch (caught) { error = caught; }
  function fire(type) {
    for (const handler of windowHandlers[type] || []) handler({ type });
    flushFrames();
  }
  function signatures() {
    const layer = byId.indraLayer;
    return layer ? layer.children
      .filter(child => /(?:^|\s)indra-camera(?:\s|$)/.test(child.className))
      .map(child => child.style.transform) : [];
  }
  return {
    error,
    body,
    root,
    layer: byId.indraLayer || null,
    api: window.PolymythIndra || null,
    signatures,
    scrollHandlerCount: (windowHandlers.scroll || []).length,
    scrollTo(y) { window.scrollY = y; root.scrollTop = y; fire('scroll'); }
  };
}

function inspectExecution(options) {
  const run = execute(options);
  check(!run.error, `${options.pathname}: runtime threw ${run.error && run.error.message}`);
  check(run.layer, `${options.pathname}: #indraLayer missing`);
  if (!run.layer) return run;
  const expectedCameras = contracts.profiles[options.profile || 'single'].cameras;
  const cameraNodes = run.layer.children.filter(child => /(?:^|\s)indra-camera(?:\s|$)/.test(child.className));
  check(cameraNodes.length === expectedCameras, `${options.pathname}: expected ${expectedCameras} camera surfaces, found ${cameraNodes.length}`);
  check(run.layer.getAttribute('data-geometry-canonical-id') === contracts.canonical_web.id, `${options.pathname}: wrong canonical ID`);
  check(run.layer.getAttribute('data-geometry-fallback') === null, `${options.pathname}: fallback geometry mounted`);
  check(Number(run.layer.getAttribute('data-geometry-shapes')) <= contracts.canonical_web.max_shapes_per_camera, `${options.pathname}: shared-symbol DOM shape budget exceeded`);
  check(run.layer.children.filter(child => child.className === 'indra-definition-bank').length === 1, `${options.pathname}: canonical definition bank must exist exactly once`);
  const coverageNodes = run.layer.children.filter(child => child.className === 'indra-coverage');
  check(coverageNodes.length === contracts.coverage.surfaces, `${options.pathname}: expected one seed-independent canonical coverage surface`);
  check(coverageNodes.every(node => node.getAttribute('data-geometry-coverage') === 'canonical-static-wide' && node.getAttribute('data-geometry-instance') === 'canonical-use'), `${options.pathname}: coverage surface does not reuse the canonical symbol`);
  check(cameraNodes.every(camera => camera.getAttribute('data-geometry-instance') === 'canonical-use'), `${options.pathname}: camera duplicates canonical shape DOM instead of using the shared symbol`);
  check(new Set(cameraNodes.map(camera => camera.getAttribute('data-geometry-canonical-hash'))).size === 1, `${options.pathname}: cameras disagree on canonical hash`);
  return run;
}

const quiet = inspectExecution({ pathname: '/teacherresources/', key: '/teacherresources/', register: 'quiet', profile: 'single', intensity: '0.115' });
const standard = inspectExecution({ pathname: '/proof/', key: '/proof/', register: 'standard', profile: 'single', intensity: '0.135' });
const expressive = inspectExecution({ pathname: '/polymyth/', key: '/polymyth/', register: 'expressive', profile: 'single', intensity: '0.160' });
const about = inspectExecution({ pathname: '/about/', key: '/about/', routeType: 'map', register: 'quiet', profile: 'about-dual', intensity: '0.115' });
const cv = inspectExecution({ pathname: '/saul/', key: '/saul/', routeType: 'cv', register: 'quiet', profile: 'cv-quiet', intensity: '0.115' });

for (const run of [quiet, standard, expressive, about, cv]) {
  if (!run.layer) continue;
  const before = run.signatures();
  run.scrollTo(1600);
  const middle = run.signatures();
  run.scrollTo(3200);
  const after = run.signatures();
  check(before.every((value, index) => value !== middle[index] && middle[index] !== after[index]), `${run.body.getAttribute('data-geometry-key')}: camera lacks three distinct scroll views`);
  check(run.scrollHandlerCount === 1, `${run.body.getAttribute('data-geometry-key')}: expected one shared scroll listener, found ${run.scrollHandlerCount}`);
}

const sameKeyDifferentContentContract = inspectExecution({ pathname: '/proof/', key: '/proof/', register: 'standard', profile: 'single', roles: 'return synthesis', intensity: '0.135' });
if (standard.layer && sameKeyDifferentContentContract.layer) {
  check(standard.layer.getAttribute('data-geometry-canonical-hash') === sameKeyDifferentContentContract.layer.getAttribute('data-geometry-canonical-hash'), 'engine: route roles alter canonical geometry');
  check(standard.layer.getAttribute('data-geometry-camera-signature') === sameKeyDifferentContentContract.layer.getAttribute('data-geometry-camera-signature'), 'engine: content/role changes alter a stable route camera');
}
standard.scrollTo(0);
const samePathWithQuery = inspectExecution({ pathname: '/proof/', key: '/proof/', register: 'standard', profile: 'single', search: '?format=indigenous&curriculum=alberta%2Cbc', hash: '#results', intensity: '0.135' });
if (standard.layer && samePathWithQuery.layer) {
  check(standard.layer.getAttribute('data-geometry-camera-signature') === samePathWithQuery.layer.getAttribute('data-geometry-camera-signature'), 'engine: query/hash changes a stable pathname camera');
  check(JSON.stringify(standard.signatures()) === JSON.stringify(samePathWithQuery.signatures()), 'engine: query/hash changes actual camera transforms');
}
const differentRoute = inspectExecution({ pathname: '/proof-two/', key: '/proof-two/', register: 'standard', profile: 'single', intensity: '0.135' });
if (standard.layer && differentRoute.layer) {
  check(standard.layer.getAttribute('data-geometry-canonical-hash') === differentRoute.layer.getAttribute('data-geometry-canonical-hash'), 'engine: routes do not share one canonical web');
  check(standard.layer.getAttribute('data-geometry-camera-signature') !== differentRoute.layer.getAttribute('data-geometry-camera-signature'), 'engine: distinct routes receive the same camera signature');
}

const reduced = inspectExecution({ pathname: '/teacherresources/', key: '/teacherresources/', register: 'quiet', profile: 'single', reduced: true, intensity: '0.115' });
if (reduced.layer) {
  const before = reduced.signatures();
  reduced.scrollTo(3200);
  check(JSON.stringify(before) === JSON.stringify(reduced.signatures()), 'reduced motion: canonical camera moves after scroll');
  check(reduced.scrollHandlerCount === 0, 'reduced motion: scroll listener remains bound');
  check(reduced.layer.getAttribute('data-geometry-motion') === 'static-reduced', 'reduced motion: static runtime marker missing');
}

/* Future/generated page proof: one pass installs one exact contract, a second
   pass is byte-idempotent, and an unclassified page fails closed. */
const syntheticRoute = 'teacherresources/generated-proof/index.html';
const synthetic = '<!doctype html><html><head><title>Generated proof</title><style>#indraLayer { opacity: 0.01 !important; } .proof{color:inherit}</style></head><body data-route-type="resource-catalog"><main class="proof">Proof</main></body></html>';
let generated = '';
try { generated = applyGeometryToHtml(synthetic, syntheticRoute); }
catch (error) { check(false, `finalizer: classified synthetic page failed (${error.message})`); }
if (generated) {
  const generatedBody = (generated.match(/<body\b[^>]*>/i) || [''])[0];
  for (const asset of ['/css/alive.css', '/js/mandala.js', '/js/indra.js']) {
    check((generated.match(new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length === 1, `finalizer: ${asset} not injected exactly once`);
    check(generated.includes(`${asset}?v=${GEOMETRY_VERSION}`), `finalizer: ${asset} lacks content token`);
  }
  for (const [name, value] of [
    ['data-geometry', 'indra-web'],
    ['data-geometry-key', geometryKeyFor(syntheticRoute)],
    ['data-geometry-seed', seedFor(syntheticRoute)],
    ['data-geometry-register', registerFor(syntheticRoute)],
    ['data-geometry-profile', 'single'],
  ]) check(generatedBody.includes(`${name}="${value}"`), `finalizer: synthetic page lacks ${name}=${value}`);
  check(!/#indraLayer\s*\{[^{}]*opacity\s*:/i.test(generated), 'finalizer: legacy page-local layer opacity survived');
  check(generated.includes('.proof{color:inherit}'), 'finalizer: unrelated inline CSS changed while repairing opacity');
  check(applyGeometryToHtml(generated, syntheticRoute) === generated, 'finalizer: second pass is not byte-idempotent');
}
let unknownFailed = false;
try { applyGeometryToHtml('<!doctype html><html><head></head><body><main>Unknown</main></body></html>', 'future/unclassified/index.html'); }
catch (_) { unknownFailed = true; }
check(unknownFailed, 'finalizer: unclassified future route did not fail closed');

/* Enumerate every current source route against the runtime camera algorithm.
   The monotonic travel component must meet the configured floor for every
   seed, and actual top/middle/bottom transforms must remain route-distinct. */
function sourceHtmlRoutes(dir, base = dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['.git', 'node_modules', '.netlify', 'public', 'fixtures', '.public-build-staging', '.public-build-previous'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) sourceHtmlRoutes(full, base, out);
    else if (entry.isFile() && entry.name.endsWith('.html') && entry.name !== 'google20234ae70106ee9d.html') out.push(path.relative(base, full).replace(/\\/g, '/'));
  }
  return out;
}
if (standard.api && typeof standard.api.cameraForSeed === 'function') {
  const signatures = new Map();
  for (const route of sourceHtmlRoutes(ROOT)) {
    const key = geometryKeyFor(route);
    const register = registerFor(route);
    const seed = seedFor(route);
    const points = [0, 0.5, 1].map(progress => standard.api.cameraForSeed(key, seed, register, progress, false));
    const displacement = Math.hypot(points[2].x - points[0].x, points[2].y - points[0].y);
    check(displacement + 0.001 >= contracts.registers[register].minimum_scroll_displacement, `${key}: ${register} camera travel ${displacement.toFixed(2)}px falls below contract`);
    const signature = points.map(point => [point.x, point.y, point.zoom, point.rotation].map(value => Number(value).toFixed(4)).join(',')).join('|');
    if (signatures.has(signature)) check(false, `${key}: actual camera duplicates ${signatures.get(signature)}`);
    else signatures.set(signature, key);
  }
}

check(!/pageStructureFacts|structure\.links|structure\.headings/.test(indraSource), 'engine: DOM structure still changes geometry/camera identity');
check(!/flowers\s*:\s*false/.test(indraSource), 'engine: universal runtime still suppresses flowers');
check(/normalized-path-scroll/.test(indraSource), 'engine: normalized-path scroll marker missing');
check(/SCROLL_PAINT_FALLBACK_MS\s*=\s*48/.test(indraSource), 'engine: bounded scroll-paint fallback missing');
check(!/pointer(?:move|down|up|enter|leave)/i.test(indraSource), 'engine: background reacts to pointer input');

if (canonicalA) {
  const digest = crypto.createHash('sha256').update(normalizeIds(canonicalA)).digest('hex');
  console.log(`canonical ${contracts.canonical_web.id}: sha256 ${digest}, ${Buffer.byteLength(canonicalA)} bytes`);
}

if (failures.length) {
  console.error('GEOMETRY CHECK FAILED');
  failures.forEach(failure => console.error(` - ${failure}`));
  process.exit(1);
}
console.log('GEOMETRY CHECK PASSED — the full three-gasket/flower/prismatic-jewel web is canonical and shared; route-stable cameras move only with scroll; About uses two <use> cameras over one shape tree; professional/reduced-motion contracts remain strict.');
