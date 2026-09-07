#!/usr/bin/env node
'use strict';

/* Strict execution gate for the canonical all-included-page Indra background.
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
const {
  geometryExemptionForRelativeHtmlPath,
} = require('./lib/geometry-asset-version');

const ROOT = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const contracts = JSON.parse(read('data/geometry-route-contracts.json'));
const mandalaSource = read('js/mandala.js');
const indraSource = read('js/indra.js');
const exemptionAttribute = contracts.coverage.exemption_attribute;
const starExemption = contracts.coverage.star_page_exemption_value;
const controlExemption = contracts.coverage.control_page_exemption_value;
const opacityProperty = contracts.presentation.page_owned_opacity_property;
const resolvedOpacityProperty = '--indra-opacity-resolved';
const opacityMinimum = Number(contracts.presentation.opacity_bounds.minimum);
const opacityMaximum = Number(contracts.presentation.opacity_bounds.maximum);
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
check(!!exemptionAttribute, 'contract: shared geometry exemption attribute missing');
check(!!opacityProperty && Number.isFinite(opacityMinimum) && Number.isFinite(opacityMaximum)
  && opacityMinimum > 0 && opacityMaximum >= opacityMinimum, 'contract: page-owned opacity bounds are invalid');

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
  const lineShapes = [...canonicalA.matchAll(/<(?:circle|path)\b[^>]*class="geo-stroke\b[^>]*>/g)].map(match => match[0]);
  check(lineShapes.length === contracts.canonical_web.gasket_circles + contracts.canonical_web.flower_paths,
    'mandala: canonical line count is incomplete');
  check(lineShapes.every(shape => /\bstroke="currentColor"/.test(shape)
    && /\bvector-effect="non-scaling-stroke"/.test(shape)),
    'mandala: line paint must survive SVG use instances without ancestor CSS');
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
    nodeType: 1,
    className: '',
    children,
    parentNode: null,
    parentElement: null,
    scrollTop: 0,
    scrollLeft: 0,
    scrollHeight: 0,
    scrollWidth: 0,
    clientHeight: 0,
    clientWidth: 0,
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
    hasAttribute(name) { return Object.prototype.hasOwnProperty.call(attributes, name); },
    removeAttribute(name) { delete attributes[name]; },
    appendChild(child) {
      children.push(child);
      child.parentNode = this;
      child.parentElement = this;
      if (child.id) byId[child.id] = child;
      return child;
    },
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
  root.scrollHeight = options.rootScrollHeight === undefined ? 4000 : Number(options.rootScrollHeight);
  root.clientHeight = 800;
  root.scrollWidth = 1200;
  root.clientWidth = 1200;
  root.scrollTop = 0;
  if (options.pageOpacity !== undefined) root.style.setProperty(opacityProperty, String(options.pageOpacity));
  const body = makeNode('body', byId);
  root.appendChild(body);
  body.setAttribute('data-route-type', options.routeType || 'project');
  if (!options.noGeometry) {
    body.setAttribute('data-geometry', 'indra-web');
    body.setAttribute('data-geometry-key', options.key || options.pathname || '/proof/');
    body.setAttribute('data-geometry-register', options.register || 'standard');
    body.setAttribute('data-geometry-profile', options.profile || 'dual-field');
    body.setAttribute('data-indra-intensity', options.intensity || '0.120');
    body.setAttribute('data-geometry-role', options.roles || 'relation movement');
  }
  if (options.exemption) body.setAttribute(exemptionAttribute, options.exemption);
  if (options.pageOwnedGeo) {
    const pageGeo = makeNode('div', byId);
    pageGeo.id = 'geo';
    body.appendChild(pageGeo);
  }
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
  function getComputedStyle(node) {
    return {
      getPropertyValue(name) {
        const own = node && node.style && node.style.getPropertyValue(name);
        return own || root.style.getPropertyValue(name) || '';
      }
    };
  }
  window.getComputedStyle = getComputedStyle;
  window.window = window;
  function flushFrames() {
    while (frameQueue.length) {
      const frame = frameQueue.shift();
      if (!frame.cancelled) frame.handler(16.67);
    }
  }
  const context = vm.createContext({
    window, document, console, Math, Number, Object, String, RegExp, Array,
    TextEncoder, decodeURI, encodeURIComponent, unescape, getComputedStyle
  });
  let error = null;
  try { vm.runInContext(indraSource, context); flushFrames(); } catch (caught) { error = caught; }
  function fireWindow(type, event = {}) {
    for (const handler of windowHandlers[type] || []) handler({ type, target: window, ...event });
    flushFrames();
  }
  function fireDocument(type, event = {}) {
    for (const handler of documentHandlers[type] || []) handler({ type, target: document, ...event });
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
    pageOwnedGeo: byId.geo || null,
    api: window.PolymythIndra || null,
    signatures,
    get windowScrollY() { return window.scrollY; },
    scrollHandlerCount: (windowHandlers.scroll || []).length,
    documentScrollHandlerCount: (documentHandlers.scroll || []).length,
    wheelHandlerCount: (documentHandlers.wheel || []).length,
    pointerHandlerCount: ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']
      .reduce((total, type) => total + (documentHandlers[type] || []).length, 0),
    makeElement(settings = {}) {
      const node = makeNode(settings.tag || 'div', byId);
      node.scrollHeight = Number(settings.scrollHeight || 0);
      node.clientHeight = Number(settings.clientHeight || 0);
      node.scrollWidth = Number(settings.scrollWidth || 0);
      node.clientWidth = Number(settings.clientWidth || 0);
      if (settings.overflowY) node.style.setProperty('overflow-y', settings.overflowY);
      if (settings.overflowX) node.style.setProperty('overflow-x', settings.overflowX);
      if (settings.touchAction) node.style.setProperty('touch-action', settings.touchAction);
      if (settings.cursor) node.style.setProperty('cursor', settings.cursor);
      body.appendChild(node);
      return node;
    },
    scrollTo(y) { window.scrollY = y; root.scrollTop = y; fireWindow('scroll'); },
    scrollElement(element, y, x = 0) {
      element.scrollTop = y;
      element.scrollLeft = x;
      fireDocument('scroll', { target: element });
    },
    wheel(element, deltaY, deltaX = 0) {
      fireDocument('wheel', { target: element, deltaY, deltaX });
    },
    pointer(element, type, values = {}) {
      fireDocument(type, {
        target: element,
        pointerId: values.pointerId === undefined ? 1 : values.pointerId,
        isPrimary: values.isPrimary === undefined ? true : values.isPrimary,
        clientX: Number(values.clientX || 0),
        clientY: Number(values.clientY || 0),
      });
    }
  };
}

function inspectExecution(options) {
  const run = execute(options);
  check(!run.error, `${options.pathname}: runtime threw ${run.error && run.error.message}`);
  check(run.layer, `${options.pathname}: #indraLayer missing`);
  if (!run.layer) return run;
  const expectedCameras = contracts.profiles[options.profile || 'dual-field'].cameras;
  const cameraNodes = run.layer.children.filter(child => /(?:^|\s)indra-camera(?:\s|$)/.test(child.className));
  check(cameraNodes.length === expectedCameras, `${options.pathname}: expected ${expectedCameras} camera surfaces, found ${cameraNodes.length}`);
  check(Number(run.layer.getAttribute('data-geometry-cameras')) === expectedCameras, `${options.pathname}: runtime camera count marker drifted`);
  check(run.layer.getAttribute('data-geometry-canonical-id') === contracts.canonical_web.id, `${options.pathname}: wrong canonical ID`);
  check(run.layer.getAttribute('data-geometry-fallback') === null, `${options.pathname}: fallback geometry mounted`);
  check(Number(run.layer.getAttribute('data-geometry-shapes')) <= contracts.canonical_web.max_shapes_per_camera, `${options.pathname}: shared-symbol DOM shape budget exceeded`);
  check(run.layer.children.filter(child => child.className === 'indra-definition-bank').length === 1, `${options.pathname}: canonical definition bank must exist exactly once`);
  const coverageNodes = run.layer.children.filter(child => child.className === 'indra-coverage');
  check(coverageNodes.length === contracts.presentation.static_coverage_surfaces, `${options.pathname}: rejected static coverage surface returned`);
  check(run.layer.getAttribute('data-geometry-field') === contracts.presentation.field, `${options.pathname}: restored fine-line rainbow field marker missing`);
  check(run.layer.getAttribute('data-geometry-palette') === contracts.presentation.rainbow_palette.join(','), `${options.pathname}: runtime palette marker differs from the canonical spectrum`);
  check(cameraNodes.every(camera => camera.getAttribute('data-geometry-instance') === 'canonical-use'), `${options.pathname}: camera duplicates canonical shape DOM instead of using the shared symbol`);
  check(new Set(cameraNodes.map(camera => camera.getAttribute('data-geometry-canonical-hash'))).size === 1, `${options.pathname}: cameras disagree on canonical hash`);
  const resolvedOpacity = Number(run.layer.style.getPropertyValue(resolvedOpacityProperty));
  check(Number.isFinite(resolvedOpacity) && resolvedOpacity >= opacityMinimum && resolvedOpacity <= opacityMaximum,
    `${options.pathname}: resolved page fade ${resolvedOpacity} falls outside ${opacityMinimum.toFixed(3)}–${opacityMaximum.toFixed(3)}`);
  check(Math.abs(Number(run.body.getAttribute('data-indra-intensity')) - resolvedOpacity) < 0.0001,
    `${options.pathname}: body and runtime layer disagree on resolved fade`);
  check(run.layer.getAttribute('data-geometry-fade-source') === run.body.getAttribute('data-indra-fade-source'),
    `${options.pathname}: body and runtime layer disagree on fade ownership`);
  return run;
}

const quiet = inspectExecution({ pathname: '/teacherresources/', key: '/teacherresources/', register: 'quiet', profile: 'dual-field', intensity: '0.115' });
const standard = inspectExecution({ pathname: '/proof/', key: '/proof/', register: 'standard', profile: 'dual-field', intensity: '0.135' });
const expressive = inspectExecution({ pathname: '/polymyth/', key: '/polymyth/', register: 'expressive', profile: 'dual-field', intensity: '0.200' });
const about = inspectExecution({ pathname: '/about/', key: '/about/', routeType: 'map', register: 'quiet', profile: 'dual-field', intensity: '0.115' });
const cv = inspectExecution({ pathname: '/saul/', key: '/saul/', routeType: 'cv', register: 'quiet', profile: 'dual-field', intensity: '0.115' });
const pageOwnedFade = inspectExecution({ pathname: '/', key: '/', routeType: 'home', register: 'expressive', profile: 'dual-field', intensity: '0.200', pageOpacity: '0.055' });
if (pageOwnedFade.layer) {
  check(pageOwnedFade.layer.style.getPropertyValue(resolvedOpacityProperty) === '0.055', 'page fade: bounded authored opacity was not preserved');
  check(pageOwnedFade.body.getAttribute('data-indra-intensity') === '0.055', 'page fade: body does not expose the resolved authored opacity');
}
const fallbackFade = inspectExecution({ pathname: '/teacherresources/', key: '/teacherresources/', register: 'quiet', profile: 'dual-field', intensity: '0.115', pageOpacity: '0.001' });
if (fallbackFade.layer) {
  check(fallbackFade.layer.style.getPropertyValue(resolvedOpacityProperty) === '0.115', 'page fade: out-of-bounds authored opacity did not fall back to the route register');
  check(fallbackFade.body.getAttribute('data-indra-intensity') === '0.115', 'page fade: fallback opacity marker is incorrect');
}

function rgbForHex(hex) {
  const value = String(hex).replace(/^#/, '');
  return `rgb(${[0, 2, 4].map(index => parseInt(value.slice(index, index + 2), 16)).join(',')})`;
}
const paletteProofRuns = [quiet, standard, expressive, about, cv, pageOwnedFade, fallbackFade];
for (let index = 0; index < contracts.presentation.rainbow_palette.length; index += 1) {
  const progress = index / (contracts.presentation.rainbow_palette.length - 1);
  const expected = rgbForHex(contracts.presentation.rainbow_palette[index]);
  for (const run of paletteProofRuns) {
    if (run.api) check(run.api.rainbowAt(progress) === expected, `${run.body.getAttribute('data-geometry-key')}: canonical palette stop ${index} drifted`);
  }
}

for (const run of paletteProofRuns) {
  if (!run.layer) continue;
  const before = run.signatures();
  run.scrollTo(1600);
  const middle = run.signatures();
  run.scrollTo(3200);
  const after = run.signatures();
  check(before.every((value, index) => value !== middle[index] && middle[index] !== after[index]), `${run.body.getAttribute('data-geometry-key')}: camera lacks three distinct scroll views`);
  check(run.scrollHandlerCount === 1, `${run.body.getAttribute('data-geometry-key')}: expected one shared scroll listener, found ${run.scrollHandlerCount}`);
  check(run.documentScrollHandlerCount === 1, `${run.body.getAttribute('data-geometry-key')}: expected one captured element-scroll listener, found ${run.documentScrollHandlerCount}`);
  check(run.wheelHandlerCount === 1, `${run.body.getAttribute('data-geometry-key')}: expected one fixed-surface wheel listener, found ${run.wheelHandlerCount}`);
  check(run.pointerHandlerCount === 4, `${run.body.getAttribute('data-geometry-key')}: expected the bounded press/drag listener set, found ${run.pointerHandlerCount}`);
}

/* Real input-owner proof. A fixed document with a scrolling panel must use
   that panel's own range; a full-screen pan/zoom surface must respond to wheel
   and pressed drag without inventing document scroll. */
const nested = inspectExecution({
  pathname: '/campaigns/thank-you-mam/dm-board/', key: '/campaigns/thank-you-mam/dm-board/',
  routeType: 'campaign-tool', register: 'expressive', profile: 'dual-field',
  intensity: '0.200', rootScrollHeight: 800,
});
if (nested.layer) {
  const panel = nested.makeElement({ scrollHeight: 3200, clientHeight: 800, overflowY: 'auto' });
  const transforms = [];
  for (const [scrollTop, expectedProgress] of [[0, 0], [1200, 0.5], [2400, 1]]) {
    nested.scrollElement(panel, scrollTop);
    transforms.push(nested.signatures());
    check(nested.root.scrollTop === 0 && nested.windowScrollY === 0, 'nested scroll: fabricated document movement occurred');
    check(nested.layer.getAttribute('data-geometry-motion-source') === 'element-scroll', 'nested scroll: runtime did not identify the real element owner');
    check(nested.layer.getAttribute('data-geometry-progress') === expectedProgress.toFixed(4), `nested scroll: expected progress ${expectedProgress.toFixed(4)}`);
    check(nested.layer.style.getPropertyValue('--indra-color') === nested.api.rainbowAt(expectedProgress), `nested scroll: palette did not follow element progress ${expectedProgress.toFixed(4)}`);
  }
  for (let camera = 0; camera < 2; camera += 1) {
    check(new Set(transforms.map(row => row[camera])).size === 3, `nested scroll: camera ${camera} lacks three panel-owned views`);
  }
}

const fullscreenWheel = inspectExecution({
  pathname: '/leizu/cloud/', key: '/leizu/cloud/', routeType: 'map',
  register: 'quiet', profile: 'dual-field', intensity: '0.115', rootScrollHeight: 800,
});
if (fullscreenWheel.layer) {
  const canvas = fullscreenWheel.makeElement({ clientHeight: 800, clientWidth: 1200, touchAction: 'none', cursor: 'grab' });
  const before = fullscreenWheel.signatures();
  const beforeProgress = Number(fullscreenWheel.layer.getAttribute('data-geometry-progress'));
  fullscreenWheel.wheel(canvas, 640);
  const forward = fullscreenWheel.signatures();
  const forwardProgress = Number(fullscreenWheel.layer.getAttribute('data-geometry-progress'));
  check(fullscreenWheel.root.scrollTop === 0 && fullscreenWheel.windowScrollY === 0, 'wheel fallback: document scroll changed');
  check(fullscreenWheel.layer.getAttribute('data-geometry-motion-source') === 'wheel', 'wheel fallback: runtime did not expose wheel ownership');
  check(forwardProgress > beforeProgress, 'wheel fallback: positive wheel input did not advance progress');
  check(before.every((value, camera) => value !== forward[camera]), 'wheel fallback: both cameras did not move');
  const stable = fullscreenWheel.signatures();
  check(JSON.stringify(stable) === JSON.stringify(forward), 'wheel fallback: cameras moved without a new input');
  fullscreenWheel.wheel(canvas, -320);
  check(Number(fullscreenWheel.layer.getAttribute('data-geometry-progress')) < forwardProgress, 'wheel fallback: reverse wheel input did not reverse progress');
}

const fullscreenPan = inspectExecution({
  pathname: '/polymyth/sitemap/graph/', key: '/polymyth/sitemap/graph/', routeType: 'map',
  register: 'standard', profile: 'dual-field', intensity: '0.135', rootScrollHeight: 800,
});
if (fullscreenPan.layer) {
  const graph = fullscreenPan.makeElement({ clientHeight: 800, clientWidth: 1200, cursor: 'grab' });
  const before = fullscreenPan.signatures();
  fullscreenPan.pointer(graph, 'pointermove', { clientX: 200, clientY: 200 });
  check(JSON.stringify(before) === JSON.stringify(fullscreenPan.signatures()), 'pan fallback: ambient pointer movement moved the geometry');
  fullscreenPan.pointer(graph, 'pointerdown', { clientX: 200, clientY: 200 });
  fullscreenPan.pointer(graph, 'pointermove', { clientX: 200, clientY: 560 });
  check(fullscreenPan.layer.getAttribute('data-geometry-motion-source') === 'pan', 'pan fallback: pressed drag did not become the motion owner');
  check(before.every((value, camera) => value !== fullscreenPan.signatures()[camera]), 'pan fallback: pressed drag did not move both cameras');
  fullscreenPan.pointer(graph, 'pointerup', { clientX: 200, clientY: 560 });
}

const sameKeyDifferentContentContract = inspectExecution({ pathname: '/proof/', key: '/proof/', register: 'standard', profile: 'dual-field', roles: 'return synthesis', intensity: '0.135' });
if (standard.layer && sameKeyDifferentContentContract.layer) {
  check(standard.layer.getAttribute('data-geometry-canonical-hash') === sameKeyDifferentContentContract.layer.getAttribute('data-geometry-canonical-hash'), 'engine: route roles alter canonical geometry');
  check(standard.layer.getAttribute('data-geometry-camera-signature') === sameKeyDifferentContentContract.layer.getAttribute('data-geometry-camera-signature'), 'engine: content/role changes alter a stable route camera');
}
standard.scrollTo(0);
const samePathWithQuery = inspectExecution({ pathname: '/proof/', key: '/proof/', register: 'standard', profile: 'dual-field', search: '?format=indigenous&curriculum=alberta%2Cbc', hash: '#results', intensity: '0.135' });
if (standard.layer && samePathWithQuery.layer) {
  check(standard.layer.getAttribute('data-geometry-camera-signature') === samePathWithQuery.layer.getAttribute('data-geometry-camera-signature'), 'engine: query/hash changes a stable pathname camera');
  check(JSON.stringify(standard.signatures()) === JSON.stringify(samePathWithQuery.signatures()), 'engine: query/hash changes actual camera transforms');
}
const differentRoute = inspectExecution({ pathname: '/proof-two/', key: '/proof-two/', register: 'standard', profile: 'dual-field', intensity: '0.135' });
if (standard.layer && differentRoute.layer) {
  check(standard.layer.getAttribute('data-geometry-canonical-hash') === differentRoute.layer.getAttribute('data-geometry-canonical-hash'), 'engine: routes do not share one canonical web');
  check(standard.layer.getAttribute('data-geometry-camera-signature') !== differentRoute.layer.getAttribute('data-geometry-camera-signature'), 'engine: distinct routes receive the same camera signature');
}

const reduced = inspectExecution({ pathname: '/teacherresources/', key: '/teacherresources/', register: 'quiet', profile: 'dual-field', reduced: true, intensity: '0.115' });
if (reduced.layer) {
  const before = reduced.signatures();
  reduced.scrollTo(3200);
  check(JSON.stringify(before) === JSON.stringify(reduced.signatures()), 'reduced motion: canonical camera moves after scroll');
  check(reduced.scrollHandlerCount === 0, 'reduced motion: scroll listener remains bound');
  check(reduced.documentScrollHandlerCount === 0 && reduced.wheelHandlerCount === 0 && reduced.pointerHandlerCount === 0, 'reduced motion: alternate motion listeners remain bound');
  check(reduced.layer.getAttribute('data-geometry-motion') === 'static-reduced', 'reduced motion: static runtime marker missing');
  check(reduced.layer.getAttribute('data-geometry-motion-source') === 'reduced-motion', 'reduced motion: input-owner marker is not static');
}

const reducedFixed = inspectExecution({ pathname: '/leizu/cloud/', key: '/leizu/cloud/', routeType: 'map', register: 'quiet', profile: 'dual-field', reduced: true, intensity: '0.115', rootScrollHeight: 800 });
if (reducedFixed.layer) {
  const surface = reducedFixed.makeElement({ scrollHeight: 3200, clientHeight: 800, overflowY: 'auto', touchAction: 'none', cursor: 'grab' });
  const before = reducedFixed.signatures();
  reducedFixed.scrollElement(surface, 1600);
  reducedFixed.wheel(surface, 640);
  reducedFixed.pointer(surface, 'pointerdown', { clientX: 0, clientY: 0 });
  reducedFixed.pointer(surface, 'pointermove', { clientX: 0, clientY: 400 });
  check(JSON.stringify(before) === JSON.stringify(reducedFixed.signatures()), 'reduced motion: nested scroll/wheel/pan moved the canonical still');
}

const missingContractRuntime = execute({ pathname: '/unmarked/', noGeometry: true });
check(!missingContractRuntime.error, `unmarked runtime guard threw ${missingContractRuntime.error && missingContractRuntime.error.message}`);
check(!missingContractRuntime.layer, 'runtime mounted #indraLayer without data-geometry="indra-web"');

const starRuntime = execute({ pathname: '/polymyth/coherence/', key: '/polymyth/coherence/', exemption: starExemption });
check(!starRuntime.error, `star runtime guard threw ${starRuntime.error && starRuntime.error.message}`);
check(!starRuntime.layer, 'star-file marker allowed #indraLayer to mount');
const controlRuntime = execute({ pathname: '/dashboard/', key: '/dashboard/', exemption: controlExemption, pageOwnedGeo: true });
check(!controlRuntime.error, `internal-control runtime guard threw ${controlRuntime.error && controlRuntime.error.message}`);
check(!controlRuntime.layer, 'internal-control marker allowed #indraLayer to mount');
check(!!controlRuntime.pageOwnedGeo, 'internal-control guard removed the dashboard page-owned #geo motif');

/* Future/generated page proof: one pass installs one exact contract, a second
   pass is byte-idempotent, and an unclassified page fails closed. */
const syntheticRoute = 'teacherresources/generated-proof/index.html';
const synthetic = '<!doctype html><html><head><title>Generated proof</title><style>:root{--indra-opacity:0.026}#indraLayer { opacity: 0.050 !important; } .proof{color:inherit}</style></head><body data-route-type="resource-catalog"><main class="proof">Proof</main></body></html>';
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
    ['data-geometry-profile', 'dual-field'],
  ]) check(generatedBody.includes(`${name}="${value}"`), `finalizer: synthetic page lacks ${name}=${value}`);
  check(!/#indraLayer\s*\{[^{}]*(?<![-\w])opacity\s*:/i.test(generated), 'finalizer: legacy direct layer opacity survived');
  check(generated.includes(':root{--indra-opacity:0.026}'), 'finalizer: bounded page-owned fade was not preserved');
  check(generated.includes('.proof{color:inherit}'), 'finalizer: unrelated inline CSS changed while repairing opacity');
  check(applyGeometryToHtml(generated, syntheticRoute) === generated, 'finalizer: second pass is not byte-idempotent');
}
const starRoute = 'polymyth/coherence/index.html';
const starSynthetic = '<!doctype html><html><head><link rel="stylesheet" href="/css/alive.css?v=stale"></head><body data-route-type="project" data-geometry="indra-web" data-indra-intensity="0.200" data-geometry-key="/wrong/"><main>Star</main><script src="/js/mandala.js?v=stale" defer></script><script src="/js/indra.js?v=stale" defer></script></body></html>';
let starGenerated = '';
try { starGenerated = applyGeometryToHtml(starSynthetic, starRoute); }
catch (error) { check(false, `finalizer: canonical star page failed (${error.message})`); }
if (starGenerated) {
  const starBody = (starGenerated.match(/<body\b[^>]*>/i) || [''])[0];
  check(starBody.includes(`${exemptionAttribute}="${starExemption}"`), 'finalizer: star-file exemption marker missing');
  check(!/\bdata-(?:geometry(?:-[\w-]+)?|indra-(?:intensity|fade-source))\s*=/.test(starBody), 'finalizer: star page retained geometry body attributes');
  check(!/\/js\/(?:mandala|indra)\.js/.test(starGenerated), 'finalizer: star page retained geometry runtime assets');
  check(applyGeometryToHtml(starGenerated, starRoute) === starGenerated, 'finalizer: star-page second pass is not byte-idempotent');
}
const controlRoute = 'dashboard/index.html';
const controlSynthetic = '<!doctype html><html><head><link rel="stylesheet" href="/css/alive.css?v=stale"></head><body data-route-type="tool" data-geometry="indra-web" data-indra-intensity="0.135"><div id="geo">Owned dashboard motif</div><script src="/js/mandala.js?v=stale" defer></script><script src="/js/indra.js?v=stale" defer></script></body></html>';
let controlGenerated = '';
try { controlGenerated = applyGeometryToHtml(controlSynthetic, controlRoute); }
catch (error) { check(false, `finalizer: internal control page failed (${error.message})`); }
if (controlGenerated) {
  const controlBody = (controlGenerated.match(/<body\b[^>]*>/i) || [''])[0];
  check(controlBody.includes(`${exemptionAttribute}="${controlExemption}"`), 'finalizer: internal-control exemption marker missing');
  check(!/\bdata-(?:geometry(?:-[\w-]+)?|indra-(?:intensity|fade-source))\s*=/.test(controlBody), 'finalizer: internal control retained shared geometry body attributes');
  check(!/\/js\/(?:mandala|indra)\.js/.test(controlGenerated), 'finalizer: internal control retained shared geometry runtime assets');
  check(/\bid="geo"/.test(controlGenerated), 'finalizer: dashboard page-owned #geo motif was removed');
  check(applyGeometryToHtml(controlGenerated, controlRoute) === controlGenerated, 'finalizer: internal-control second pass is not byte-idempotent');
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
    else if (entry.isFile() && entry.name.endsWith('.html') && entry.name !== 'google20234ae70106ee9d.html') {
      const relative = path.relative(base, full).replace(/\\/g, '/');
      if (!geometryExemptionForRelativeHtmlPath(contracts, relative)) out.push(relative);
    }
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
check(!/indra-coverage|canonical-static-wide|feMorphology/.test(indraSource), 'engine: rejected static square/bubble coverage returned');
check(/mountCamera\('primary', false\);[\s\S]{0,100}mountCamera\('secondary', true\);/.test(indraSource), 'engine: every included page must mount both original field cameras');
check(indraSource.includes(exemptionAttribute), 'engine: shared geometry-exemption no-mount guard missing');
check(/getAttribute\(['"]data-geometry['"]\)\s*!==\s*['"]indra-web['"]/.test(indraSource), 'engine: missing-data-geometry no-mount guard missing');
check(indraSource.includes(opacityProperty), 'engine: page-owned opacity property missing');
check(/normalized-path-scroll/.test(indraSource), 'engine: normalized-path scroll marker missing');
check(/SCROLL_PAINT_FALLBACK_MS\s*=\s*48/.test(indraSource), 'engine: bounded scroll-paint fallback missing');
check(/document\.addEventListener\('scroll', onElementScroll, \{ passive: true, capture: true \}\)/.test(indraSource), 'engine: captured real-element scroll owner is missing');
check(/document\.addEventListener\('wheel', onWheel, \{ passive: true, capture: true \}\)/.test(indraSource), 'engine: fixed-surface wheel fallback is missing');
check(/panPointerId === null/.test(indraSource) && /panSurface\(event\.target\)/.test(indraSource), 'engine: pan fallback is not gated by a pressed pan surface');

if (canonicalA) {
  const digest = crypto.createHash('sha256').update(normalizeIds(canonicalA)).digest('hex');
  console.log(`canonical ${contracts.canonical_web.id}: sha256 ${digest}, ${Buffer.byteLength(canonicalA)} bytes`);
}

if (failures.length) {
  console.error('GEOMETRY CHECK FAILED');
  failures.forEach(failure => console.error(` - ${failure}`));
  process.exit(1);
}
console.log('GEOMETRY CHECK PASSED — the full three-gasket/flower/prismatic-jewel web, exact spectrum, two cameras, and bounded page-fit fading are canonical on every included page; star files and the source-only dashboard control remain free of shared geometry, and reduced motion remains visible and static.');
