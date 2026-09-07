// ============================================================================
// INDRA — the original Polymyth Mandala field on every non-star public route.
//
// The SVG is identical everywhere: three phi-scaled Apollonian gaskets,
// flowers grown from tangencies, and prismatic Indra jewels. Two independent
// cameras revisit the old rainbow field from opposite regions. A normalized
// path selects stable views into that same web; scroll moves both cameras and
// carries their line colour through the original spectrum. Nothing here
// changes layout or runs an idle animation loop.
// ============================================================================
(function () {
  'use strict';

  var root = document.documentElement;
  var body = document.body;
  if (!body
      || body.getAttribute('data-geometry') !== 'indra-web'
      || body.hasAttribute('data-shared-geometry-exempt')
      || body.getAttribute('data-star-file-page') === 'true'
      || document.getElementById('indraLayer')) return;

  var reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var canonicalId = window.PolymythMandala && window.PolymythMandala.canonicalId || 'polymyth-mandala-main-v32';
  var MAX_SHAPES_PER_CAMERA = 1400;
  var MAX_MARKUP_BYTES_PER_CAMERA = 265000;

  /* The subdued spectrum is the original /main/ geometry palette. It belongs
     to the background field alone; foreground page colours and the homepage
     project constellation remain independently owned. */
  var RAINBOW_HEX = Object.freeze([
    '#8a4a32', '#c47a2e', '#a09030', '#3d8a5a',
    '#4070a8', '#6850a0', '#9050a0', '#a84858'
  ]);
  var RAINBOW_PALETTE = Object.freeze(RAINBOW_HEX.map(function (hex) {
    return Object.freeze([
      parseInt(hex.slice(1, 3), 16),
      parseInt(hex.slice(3, 5), 16),
      parseInt(hex.slice(5, 7), 16)
    ]);
  }));
  var MIN_OPACITY = 0.020;
  var MAX_OPACITY = 0.200;

  var CAMERA_PRIMARY = [
    { x: 120, y: 30, zoom: 7 },
    { x: 40, y: -30, zoom: 5 },
    { x: 10, y: -130, zoom: 10 },
    { x: 0, y: 50, zoom: 12 },
    { x: -110, y: 50, zoom: 8 },
    { x: -60, y: 120, zoom: 11 },
    { x: 20, y: -10, zoom: 6 },
    { x: 70, y: -100, zoom: 9 }
  ];
  var CAMERA_SECONDARY = [
    { x: -100, y: 40, zoom: 6 },
    { x: 0, y: 50, zoom: 8 },
    { x: 80, y: 100, zoom: 8 },
    { x: -120, y: -80, zoom: 7 },
    { x: 40, y: -110, zoom: 9 },
    { x: 100, y: -30, zoom: 8 },
    { x: -80, y: 100, zoom: 9 },
    { x: -40, y: 20, zoom: 7 }
  ];

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function smoothstep(value) {
    var t = clamp(value, 0, 1);
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  function normalizePath(value) {
    var path = String(value || '/').split(/[?#]/, 1)[0] || '/';
    try { path = decodeURI(path); } catch (_) {}
    path = ('/' + path.replace(/^\/+/, '')).replace(/\/{2,}/g, '/');
    path = path.replace(/\/index\.html$/i, '/');
    if (path !== '/' && !/\.[a-z0-9]+$/i.test(path) && !/\/$/.test(path)) path += '/';
    return path;
  }

  function seedOf(value) {
    var hash = 2166136261;
    for (var index = 0; index < value.length; index++) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash >>> 0;
  }

  function seedPair(value, explicit) {
    var clean = String(explicit || '').replace(/[^a-fA-F0-9]/g, '');
    var first = clean.length >= 8 ? parseInt(clean.slice(0, 8), 16) >>> 0 : seedOf(value);
    var second = clean.length >= 16 ? parseInt(clean.slice(8, 16), 16) >>> 0 : seedOf(value + '|opposite');
    return { first: first, second: second };
  }

  function routeRegister(path) {
    if (/^\/polymyth\/coherence(?:\/|$)/.test(path)) return 'quiet';
    if (/^\/(?:polymyth|bb|bookwormcard|campaigns|aa|ohm-dome|agora|florilegium)(?:\/|$)/.test(path) || path === '/') return 'expressive';
    if (/^\/(?:about|leizu|saul|teacherresources|polymythseminars|seminars|writingclub|writingkids|writingjuniors|writingteens|writinggrads|university|philosophy|humanities|cfps|lectures|fellowships|marginalia|reviews)(?:\/|$)/.test(path)) return 'quiet';
    return 'standard';
  }

  function routeProfile() {
    return 'dual-field';
  }

  function rainbowColor(progress) {
    var scaled = clamp(progress, 0, 1) * (RAINBOW_PALETTE.length - 1);
    var index = Math.min(RAINBOW_PALETTE.length - 2, Math.floor(scaled));
    var local = scaled - index;
    var start = RAINBOW_PALETTE[index];
    var end = RAINBOW_PALETTE[index + 1];
    return 'rgb(' + [0, 1, 2].map(function (channel) {
      return Math.round(start[channel] + (end[channel] - start[channel]) * local);
    }).join(',') + ')';
  }

  function byteLength(value) {
    return typeof TextEncoder === 'function'
      ? new TextEncoder().encode(String(value)).length
      : unescape(encodeURIComponent(String(value))).length;
  }

  function countShapes(markup) {
    var matches = String(markup).match(/<(?:circle|path|line|polygon|polyline|rect)\b/g);
    return matches ? matches.length : 0;
  }

  function canonicalHash(markup) {
    var normalized = String(markup)
      .replace(/indra-(?:primary|secondary)-jewel-(?:core|prism)/g, 'indra-camera-jewel')
      .replace(/\s+/g, ' ');
    return ('00000000' + seedOf(normalized).toString(16)).slice(-8);
  }

  function fallbackSvg() {
    return '<svg viewBox="-400 -400 800 800" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">' +
      '<g class="geo-stroke" fill="none" stroke="currentColor" stroke-width="1">' +
      '<circle cx="0" cy="0" r="300"/><circle cx="-150" cy="0" r="150"/>' +
      '<circle cx="150" cy="0" r="150"/><circle cx="0" cy="-173" r="127"/>' +
      '<circle cx="0" cy="173" r="127"/><circle cx="0" cy="0" r="82"/>' +
      '</g></svg>';
  }

  var routeType = String(body.getAttribute('data-route-type') || 'unclassified');
  var geometryKey = normalizePath(body.getAttribute('data-geometry-key') || window.location.pathname || '/');
  var seeds = seedPair(geometryKey, body.getAttribute('data-geometry-seed'));
  var register = String(body.getAttribute('data-geometry-register') || routeRegister(geometryKey));
  if (!/^(?:quiet|standard|expressive)$/.test(register)) register = routeRegister(geometryKey);
  var profile = String(body.getAttribute('data-geometry-profile') || routeProfile(geometryKey, routeType));
  if (profile !== 'dual-field') profile = 'dual-field';
  // Presets change the journey through the shared drawing, never its shapes.
  var motionPreset = String(body.getAttribute('data-geometry-motion-preset') || 'flow');
  if (!/^(?:flow|reading|study|overview|recurrence)$/.test(motionPreset)) motionPreset = 'flow';
  var viewportWidth = window.innerWidth;
  var viewportHeight = window.innerHeight;
  var coarsePointer = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  var compactViewport = coarsePointer || viewportWidth < 640;
  var requestedOpacity = parseFloat(body.getAttribute('data-indra-intensity'));
  var registerOpacity = register === 'expressive' ? 0.200 : register === 'quiet' ? 0.115 : 0.135;
  var requestedFadeSource = String(body.getAttribute('data-indra-fade-source') || '');
  var pageCssOpacity = NaN;
  if (typeof window.getComputedStyle === 'function') {
    pageCssOpacity = parseFloat(window.getComputedStyle(body).getPropertyValue('--indra-opacity'));
  }
  function validOpacity(value) {
    return Number.isFinite(value) && value >= MIN_OPACITY && value <= MAX_OPACITY;
  }
  var pageRequested = validOpacity(requestedOpacity)
    && (requestedFadeSource === 'page' || Math.abs(requestedOpacity - registerOpacity) > 0.001);
  var opacity = validOpacity(pageCssOpacity)
    ? pageCssOpacity
    : pageRequested ? requestedOpacity : registerOpacity;
  var fadeSource = validOpacity(pageCssOpacity) || pageRequested ? 'page' : 'route-register';

  body.setAttribute('data-geometry-key', geometryKey);
  body.setAttribute('data-geometry-register', register);
  body.setAttribute('data-geometry-profile', profile);
  body.setAttribute('data-indra-intensity', opacity.toFixed(3));
  body.setAttribute('data-indra-fade-source', fadeSource);
  body.setAttribute('data-geometry-engine', 'canonical-scroll-camera');

  var layer = document.createElement('div');
  layer.id = 'indraLayer';
  layer.className = 'indra-field';
  layer.setAttribute('aria-hidden', 'true');
  layer.setAttribute('role', 'presentation');
  layer.setAttribute('data-geometry-engine', 'canonical-scroll-camera');
  layer.setAttribute('data-geometry-kind', 'shared-background-web');
  layer.setAttribute('data-geometry-source', 'polymyth-mandala-main-v32');
  layer.setAttribute('data-geometry-input', 'normalized-path-scroll');
  layer.setAttribute('data-geometry-proof', 'eligible-page-scroll');
  layer.setAttribute('data-geometry-register', register);
  layer.setAttribute('data-geometry-profile', profile);
  layer.setAttribute('data-geometry-motion-preset', motionPreset);
  layer.setAttribute('data-geometry-key', geometryKey);
  layer.setAttribute('data-geometry-canonical-id', canonicalId);
  layer.setAttribute('data-geometry-palette', RAINBOW_HEX.join(','));
  layer.setAttribute('data-geometry-fade-source', fadeSource);
  layer.setAttribute('data-geometry-motion-source', reduced ? 'reduced-motion' : 'window-scroll');
  layer.style.pointerEvents = 'none';
  layer.style.setProperty('--indra-opacity-resolved', opacity.toFixed(3));

  var cameras = [];
  var fallbackReason = '';
  var canonicalMarkup;
  if (window.PolymythMandala && typeof window.PolymythMandala.buildCanonical === 'function') {
    canonicalMarkup = window.PolymythMandala.buildCanonical({ idPrefix: 'indra-shared' });
  } else {
    canonicalMarkup = fallbackSvg();
    fallbackReason = 'canonical-mandala-unavailable';
  }
  var canonicalShapes = countShapes(canonicalMarkup);
  var canonicalBytes = byteLength(canonicalMarkup);
  var canonicalMarkupHash = canonicalHash(canonicalMarkup);
  var canonicalOpen = canonicalMarkup.indexOf('>');
  var canonicalClose = canonicalMarkup.lastIndexOf('</svg>');
  var canonicalContents = canonicalOpen >= 0 && canonicalClose > canonicalOpen
    ? canonicalMarkup.slice(canonicalOpen + 1, canonicalClose)
    : canonicalMarkup;
  var definitionBank = document.createElement('div');
  definitionBank.className = 'indra-definition-bank';
  definitionBank.setAttribute('aria-hidden', 'true');
  definitionBank.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" width="0" height="0">' +
    '<defs><symbol id="indra-canonical-symbol" viewBox="-380 -380 760 760">' + canonicalContents + '</symbol></defs></svg>';
  layer.appendChild(definitionBank);

  function mountCamera(name, secondary) {
    var camera = document.createElement('div');
    camera.className = 'indra-camera indra-camera--' + name;
    camera.setAttribute('data-geometry-camera', name);
    camera.setAttribute('data-geometry-canonical-id', canonicalId);
    camera.setAttribute('data-geometry-instance', 'canonical-use');
    camera.innerHTML = '<svg class="polymyth-mandala polymyth-mandala-instance" data-canonical-web="' + canonicalId + '" ' +
      'viewBox="-380 -380 760 760" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">' +
      '<use href="#indra-canonical-symbol" x="-380" y="-380" width="760" height="760"></use></svg>';
    camera.setAttribute('data-geometry-shapes', String(canonicalShapes));
    camera.setAttribute('data-geometry-markup-bytes', String(canonicalBytes));
    camera.setAttribute('data-geometry-canonical-hash', canonicalMarkupHash);
    camera.setAttribute('data-geometry-gaskets', ['0', '1', '2'].filter(function (value) {
      return canonicalMarkup.indexOf('data-gasket="' + value + '"') >= 0;
    }).join(','));
    camera.setAttribute('data-geometry-flowers', String((canonicalMarkup.match(/geo-flower(?:\s|"|-)/g) || []).length));
    camera.setAttribute('data-geometry-jewels', String((canonicalMarkup.match(/geo-jewel-core/g) || []).length));
    camera.setAttribute('data-geometry-prisms', String((canonicalMarkup.match(/geo-jewel-prism/g) || []).length));
    if (canonicalShapes > MAX_SHAPES_PER_CAMERA || canonicalBytes > MAX_MARKUP_BYTES_PER_CAMERA) {
      camera.setAttribute('data-geometry-budget', 'exceeded');
    } else {
      camera.setAttribute('data-geometry-budget', 'within');
    }
    if (secondary) camera.style.setProperty('--indra-camera-opacity', '0.58');
    layer.appendChild(camera);
    cameras.push({ element: camera, secondary: secondary });
  }

  mountCamera('primary', false);
  mountCamera('secondary', true);

  function frameViewport() {
    // Freeze the camera rectangle during phone browser-bar/keyboard changes.
    // The enclosing field still clips to the actual viewport.
    var overscan = Math.max(viewportWidth, viewportHeight) * (viewportWidth <= 760 ? 0.24 : 0.18);
    cameras.forEach(function (camera) {
      camera.element.style.inset = 'auto';
      camera.element.style.left = camera.element.style.top = -overscan + 'px';
      var contentWidth = Math.min(viewportWidth, numeric(root.clientWidth) || viewportWidth);
      camera.element.style.width = (contentWidth + 2 * overscan) + 'px';
      camera.element.style.height = (viewportHeight + 2 * overscan) + 'px';
    });
  }
  frameViewport();

  layer.setAttribute('data-geometry-canonical-hash', canonicalMarkupHash);
  layer.setAttribute('data-geometry-shapes', String(canonicalShapes));
  layer.setAttribute('data-geometry-markup-bytes', String(canonicalBytes));
  layer.setAttribute('data-geometry-cameras', String(cameras.length));
  layer.setAttribute('data-geometry-field', 'fine-line-rainbow-dual');
  layer.setAttribute('data-geometry-coverage-surfaces', '0');
  layer.setAttribute('data-geometry-camera-signature', [geometryKey, register, profile, seeds.first.toString(16), seeds.second.toString(16)].join(':'));
  if (fallbackReason) layer.setAttribute('data-geometry-fallback', fallbackReason);
  body.appendChild(layer);

  function cameraPointFor(bank, seed, detailSeed, registerName, secondary, progress) {
    var offset = seed % bank.length;
    var direction = ((seed >>> 7) & 1) ? 1 : -1;
    var segments = 5;
    var scaled = clamp(progress, 0, 1) * segments;
    var segment = Math.min(segments - 1, Math.floor(scaled));
    var local = smoothstep(scaled - segment);
    function point(step) {
      var index = (offset + direction * step) % bank.length;
      if (index < 0) index += bank.length;
      return bank[index];
    }
    var current = point(segment);
    var next = point(segment + 1);
    var registerZoom = registerName === 'expressive' ? 1 : registerName === 'quiet' ? 0.74 : 0.86;
    /* A phone viewport needs a wider camera window than a desktop viewport.
       This is a viewport-wide optical correction, never a route exception:
       all routes keep the same bank, seed, direction, and full canonical web. */
    var viewportZoom = viewportWidth < 640 ? 0.40 : viewportWidth < 900 ? 0.50 : 0.45;
    var zoom = (current.zoom + (next.zoom - current.zoom) * local) * registerZoom * viewportZoom;
    var x = current.x + (next.x - current.x) * local;
    var y = current.y + (next.y - current.y) * local;
    var centered = progress - 0.5;
    var travel = registerName === 'expressive' ? 200 : registerName === 'quiet' ? 90 : 135;
    var rotationTravel = secondary ? -3.4 : 4.2;
    var baseRotation = (seed / 4294967296) * 360 - 180;
    var rotation = baseRotation + centered * rotationTravel;
    var angle = rotation * Math.PI / 180;
    var scaledX = x * zoom;
    var scaledY = y * zoom;
    var rotatedX = scaledX * Math.cos(angle) - scaledY * Math.sin(angle);
    var rotatedY = scaledX * Math.sin(angle) + scaledY * Math.cos(angle);
    var first = point(0);
    var last = point(segments);
    var firstAngle = (baseRotation - 0.5 * rotationTravel) * Math.PI / 180;
    var lastAngle = (baseRotation + 0.5 * rotationTravel) * Math.PI / 180;
    var firstZoom = first.zoom * registerZoom * viewportZoom;
    var lastZoom = last.zoom * registerZoom * viewportZoom;
    var firstBaseY = -(first.x * firstZoom * Math.sin(firstAngle) + first.y * firstZoom * Math.cos(firstAngle));
    var lastBaseY = -(last.x * lastZoom * Math.sin(lastAngle) + last.y * lastZoom * Math.cos(lastAngle));
    var flowSign = lastBaseY - firstBaseY < 0 ? -1 : 1;
    var routeOffsetX = ((detailSeed & 65535) / 65535 - 0.5) * 48;
    var routeOffsetY = (((detailSeed >>> 16) & 65535) / 65535 - 0.5) * 48;
    return {
      x: -rotatedX + routeOffsetX + centered * travel * (secondary ? -0.18 : 0.22),
      y: -rotatedY + routeOffsetY + centered * travel * flowSign,
      zoom: zoom,
      rotation: rotation,
      travel: travel
    };
  }

  function cameraPoint(which, progress) {
    var secondary = which > 0;
    var journey = progress;
    if (motionPreset === 'recurrence' && secondary) {
      journey = clamp(progress + 0.075 * Math.sin(progress * Math.PI * 6) * Math.sin(progress * Math.PI), 0, 1);
    } else if (motionPreset === 'reading') {
      journey = progress * 0.7 + smoothstep(progress) * 0.3;
    }
    var state = cameraPointFor(
      secondary ? CAMERA_SECONDARY : CAMERA_PRIMARY,
      secondary ? seeds.second : seeds.first,
      secondary ? seeds.first : seeds.second,
      register,
      secondary,
      journey
    );
    if (motionPreset === 'overview') state.zoom *= 0.94;
    return state;
  }

  var lastColor = '';
  var lastTransforms = [];
  var selectionAmount = 0;
  var selectionTarget = 0;
  function paintAt(progress, colorProgress) {
    // Colour follows input; interpolating the camera must not repaint all SVG
    // lines on every catch-up frame. Identical RGB steps are written once.
    var color = rainbowColor(colorProgress === undefined ? progress : colorProgress);
    if (color !== lastColor) {
      layer.style.setProperty('--indra-color', color);
      lastColor = color;
    }
    for (var index = 0; index < cameras.length; index++) {
      var state = cameraPoint(index, progress);
      if (motionPreset === 'overview') state.zoom *= 1 + selectionAmount * 0.06;
      var transform = 'translate3d(' + state.x.toFixed(2) + 'px,' + state.y.toFixed(2) + 'px,0) rotate(' +
        state.rotation.toFixed(3) + 'deg) scale(' + state.zoom.toFixed(4) + ')';
      if (transform !== lastTransforms[index]) {
        cameras[index].element.style.transform = transform;
        lastTransforms[index] = transform;
      }
    }
    layer.setAttribute('data-geometry-progress', progress.toFixed(4));
  }

  /* Most routes scroll the document, but several real projects deliberately
     keep the document fixed and scroll a panel or pan/zoom a full-screen
     working surface. Treat the input the visitor actually moves as the camera
     driver. This remains event-driven: no observer sweep and no idle loop. */
  var activeScrollElement = null;
  var virtualProgress = 0.32;
  var motionSource = 'window-scroll';
  var panPointerId = null;
  var panLastX = 0;
  var panLastY = 0;
  var sectionStops = [];

  function measureSections() {
    sectionStops = [];
    if (motionPreset !== 'study' || !document.querySelectorAll) return;
    var range = Math.max(0, Math.max(numeric(root.scrollHeight), numeric(body.scrollHeight)) - viewportHeight);
    if (range < 1) return;
    var nodes = document.querySelectorAll('main h2, main section[id], article h2');
    for (var i = 0; i < nodes.length && i < 80; i++) {
      var top = nodes[i].getBoundingClientRect().top + numeric(window.scrollY);
      var stop = clamp(top / range, 0, 1);
      if (stop > 0.02 && stop < 0.98) sectionStops.push(stop);
    }
    sectionStops.sort(function (a, b) { return a - b; });
    sectionStops = sectionStops.filter(function (value, index, all) { return !index || value - all[index - 1] > 0.015; });
    sectionStops.unshift(0);
    sectionStops.push(1);
  }

  function sectionProgress(progress) {
    if (sectionStops.length < 3) return progress;
    var index = 0;
    while (index < sectionStops.length - 2 && progress > sectionStops[index + 1]) index++;
    var local = (progress - sectionStops[index]) / (sectionStops[index + 1] - sectionStops[index]);
    var section = (index + smoothstep(local)) / (sectionStops.length - 1);
    return clamp(progress * 0.8 + section * 0.2, 0, 1);
  }

  function numeric(value) {
    var number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function elementScrollProgress(element) {
    if (!element || element === document || element === root || element === body) return null;
    var verticalRange = Math.max(0, numeric(element.scrollHeight) - numeric(element.clientHeight));
    if (verticalRange > 1) return clamp(numeric(element.scrollTop) / verticalRange, 0, 1);
    var horizontalRange = Math.max(0, numeric(element.scrollWidth) - numeric(element.clientWidth));
    if (horizontalRange > 1) return clamp(numeric(element.scrollLeft) / horizontalRange, 0, 1);
    return null;
  }

  function documentScrollProgress() {
    var scrollTop = numeric(window.scrollY || root.scrollTop || body.scrollTop);
    var documentHeight = Math.max(numeric(root.scrollHeight), numeric(body.scrollHeight));
    if (documentHeight - numeric(window.innerHeight) <= 1) return 0.32;
    if (scrollTop >= documentHeight - numeric(window.innerHeight) - 1) return 1;
    var range = Math.max(0, documentHeight - viewportHeight);
    return range > 1 ? sectionProgress(clamp(scrollTop / range, 0, 1)) : 0.32;
  }

  function readProgress() {
    if (motionSource === 'element-scroll') {
      var elementProgress = elementScrollProgress(activeScrollElement);
      if (elementProgress !== null) return elementProgress;
      activeScrollElement = null;
      setMotionSource('window-scroll');
    }
    if (motionSource === 'wheel' || motionSource === 'pan') return virtualProgress;
    return documentScrollProgress();
  }

  function setMotionSource(source) {
    if (source === motionSource) return;
    motionSource = source;
    layer.setAttribute('data-geometry-motion-source', source);
  }

  function parentElement(node) {
    return node && (node.parentElement || node.parentNode) || null;
  }

  function computedValue(element, property, camelName) {
    if (!element || typeof window.getComputedStyle !== 'function') return '';
    var style;
    try { style = window.getComputedStyle(element); } catch (_) { return ''; }
    return String((style && style[camelName]) || (style && style.getPropertyValue && style.getPropertyValue(property)) || '');
  }

  function scrollableAncestor(start) {
    var element = start;
    while (element && element !== body && element !== root && element !== document) {
      var verticalRange = Math.max(0, numeric(element.scrollHeight) - numeric(element.clientHeight));
      var horizontalRange = Math.max(0, numeric(element.scrollWidth) - numeric(element.clientWidth));
      var overflowY = computedValue(element, 'overflow-y', 'overflowY');
      var overflowX = computedValue(element, 'overflow-x', 'overflowX');
      if ((verticalRange > 1 && /^(?:auto|scroll|overlay)$/.test(overflowY))
          || (horizontalRange > 1 && /^(?:auto|scroll|overlay)$/.test(overflowX))) return element;
      element = parentElement(element);
    }
    return null;
  }

  function panSurface(start) {
    var element = start;
    while (element && element !== body && element !== root && element !== document) {
      var touchAction = computedValue(element, 'touch-action', 'touchAction');
      var cursor = computedValue(element, 'cursor', 'cursor');
      if (touchAction === 'none' || /^(?:grab|grabbing)$/.test(cursor)) return element;
      element = parentElement(element);
    }
    return null;
  }

  var raf = 0;
  var paintFallbackTimer = 0;
  var SCROLL_PAINT_FALLBACK_MS = 48;
  var lastProgress = -1;
  var targetProgress = -1;
  var lastFrameTime = 0;
  var settlingSince = 0;
  var inputDirty = true;
  var MOTION_SETTLE_MS = 360;
  var MOTION_RESPONSE_MS = 65;
  function clock() {
    return window.performance && typeof window.performance.now === 'function' ? window.performance.now() : Date.now();
  }
  function paint(timestamp) {
    if (paintFallbackTimer) {
      window.clearTimeout(paintFallbackTimer);
      paintFallbackTimer = 0;
    }
    raf = 0;
    if (document.hidden) return;
    var now = Number.isFinite(timestamp) ? timestamp : clock();
    if (inputDirty || targetProgress < 0) {
      var nextTarget = readProgress();
      if (Math.abs(nextTarget - targetProgress) > 0.000001) settlingSince = now;
      targetProgress = nextTarget;
      inputDirty = false;
    }
    var elapsed = lastFrameTime ? Math.max(0, now - lastFrameTime) : 16.667;
    lastFrameTime = now;
    var progress = lastProgress < 0 ? targetProgress
      : lastProgress + (targetProgress - lastProgress) * (1 - Math.exp(-elapsed / MOTION_RESPONSE_MS));
    var priorSelection = selectionAmount;
    selectionAmount += (selectionTarget - selectionAmount) * (1 - Math.exp(-elapsed / MOTION_RESPONSE_MS));
    var settled = (Math.abs(targetProgress - progress) < 0.00002 && Math.abs(selectionTarget - selectionAmount) < 0.00002)
      || now - settlingSince >= MOTION_SETTLE_MS;
    if (settled) progress = targetProgress;
    if (settled) selectionAmount = selectionTarget;
    if (lastProgress === progress && priorSelection === selectionAmount) {
      if (!settled) schedule(false);
      return;
    }
    lastProgress = progress;
    paintAt(progress, targetProgress);
    if (!settled) schedule(false);
  }

  function schedule(markDirty) {
    if (markDirty !== false) inputDirty = true;
    if (document.hidden) return;
    if (raf || paintFallbackTimer) return;
    if (markDirty !== false || !lastFrameTime) lastFrameTime = clock();
    raf = window.requestAnimationFrame(paint);
    paintFallbackTimer = window.setTimeout(function () {
      if (raf) window.cancelAnimationFrame(raf);
      raf = 0;
      paintFallbackTimer = 0;
      paint(clock());
    }, SCROLL_PAINT_FALLBACK_MS);
  }

  function onWindowScroll() {
    activeScrollElement = null;
    setMotionSource('window-scroll');
    schedule();
  }

  function onElementScroll(event) {
    var target = event && event.target;
    if (!target || target === document || target === root || target === body) {
      onWindowScroll();
      return;
    }
    if (elementScrollProgress(target) === null) return;
    activeScrollElement = target;
    setMotionSource('element-scroll');
    schedule();
  }

  function advanceVirtual(delta, source) {
    if (!Number.isFinite(delta) || Math.abs(delta) < 0.00001) return;
    if (motionSource !== 'wheel' && motionSource !== 'pan') virtualProgress = readProgress();
    virtualProgress = clamp(virtualProgress + delta, 0, 1);
    activeScrollElement = null;
    setMotionSource(source);
    schedule();
  }

  function onWheel(event) {
    if (scrollableAncestor(event && event.target)) return;
    var documentHeight = Math.max(numeric(root.scrollHeight), numeric(body.scrollHeight));
    // Eligibility follows the actual native scroll range, even while the
    // optical camera viewport is intentionally held stable.
    var documentRange = Math.max(0, documentHeight - numeric(window.innerHeight));
    if (documentRange > 1) return;
    var deltaY = numeric(event && event.deltaY);
    var deltaX = numeric(event && event.deltaX);
    var delta = Math.abs(deltaY) >= Math.abs(deltaX) ? deltaY : deltaX;
    advanceVirtual(delta / Math.max(1200, viewportHeight * 4), 'wheel');
  }

  function onPointerDown(event) {
    if (!event || event.isPrimary === false || scrollableAncestor(event.target) || !panSurface(event.target)) return;
    panPointerId = event.pointerId === undefined ? 0 : event.pointerId;
    panLastX = numeric(event.clientX);
    panLastY = numeric(event.clientY);
    if (motionSource !== 'wheel' && motionSource !== 'pan') virtualProgress = readProgress();
  }

  function onPointerMove(event) {
    var pointerId = event && event.pointerId === undefined ? 0 : event && event.pointerId;
    if (panPointerId === null || !event || pointerId !== panPointerId) return;
    var nextX = numeric(event.clientX);
    var nextY = numeric(event.clientY);
    var deltaX = nextX - panLastX;
    var deltaY = nextY - panLastY;
    panLastX = nextX;
    panLastY = nextY;
    var delta = Math.abs(deltaY) >= Math.abs(deltaX) ? deltaY : deltaX;
    advanceVirtual(delta / Math.max(1200, viewportHeight * 3), 'pan');
  }

  function onPointerEnd(event) {
    var pointerId = event && event.pointerId === undefined ? 0 : event && event.pointerId;
    if (panPointerId !== null && pointerId === panPointerId) panPointerId = null;
  }

  measureSections();
  function cancelMotion() {
    if (raf) window.cancelAnimationFrame(raf);
    if (paintFallbackTimer) window.clearTimeout(paintFallbackTimer);
    raf = paintFallbackTimer = 0;
    lastFrameTime = 0;
    panPointerId = null;
  }
  function onContentInteraction() {
    measureSections();
    if (motionPreset === 'overview' && document.querySelector) {
      var selected = document.querySelector('.project-list-item button[aria-pressed="true"], [data-quick][aria-pressed="true"]');
      var next = selected ? 1 : 0;
      if (next !== selectionTarget) {
        selectionTarget = next;
        settlingSince = clock();
      }
    }
    schedule();
  }
  function onViewportResize() {
    var widthChanged = window.innerWidth !== viewportWidth;
    if (!widthChanged && compactViewport) {
      var nativeRange = Math.max(numeric(root.scrollHeight), numeric(body.scrollHeight)) - numeric(window.innerHeight);
      if (!reduced && nativeRange > 1 && numeric(window.scrollY) >= nativeRange - 1) schedule();
      return;
    }
    viewportWidth = window.innerWidth;
    viewportHeight = window.innerHeight;
    compactViewport = coarsePointer || viewportWidth < 640;
    frameViewport();
    measureSections();
    lastTransforms = [];
    if (reduced) paintAt(0);
    else { lastProgress = -1; schedule(); }
  }
  window.addEventListener('resize', onViewportResize, { passive: true });
  if (reduced) {
    /* Path start is already checked for composed visibility on every surface.
       Route seeds still select a distinct bank/direction/rotation; only motion
       progress is fixed so reduced-motion users get a proven rich still. */
    var stillProgress = 0;
    paintAt(stillProgress);
    layer.setAttribute('data-geometry-motion', 'static-reduced');
    layer.setAttribute('data-geometry-motion-source', 'reduced-motion');
  } else {
    paint();
    layer.setAttribute('data-geometry-motion', 'scroll-responsive');
    window.addEventListener('scroll', onWindowScroll, { passive: true });
    document.addEventListener('scroll', onElementScroll, { passive: true, capture: true });
    document.addEventListener('wheel', onWheel, { passive: true, capture: true });
    document.addEventListener('pointerdown', onPointerDown, { passive: true, capture: true });
    document.addEventListener('pointermove', onPointerMove, { passive: true, capture: true });
    document.addEventListener('pointerup', onPointerEnd, { passive: true, capture: true });
    document.addEventListener('pointercancel', onPointerEnd, { passive: true, capture: true });
    window.addEventListener('load', function () { measureSections(); schedule(); }, { once: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { measureSections(); schedule(); });
    document.addEventListener('toggle', onContentInteraction, { passive: true, capture: true });
    document.addEventListener('change', onContentInteraction, { passive: true });
    if (motionPreset === 'overview') document.addEventListener('click', onContentInteraction, { passive: true });
    window.addEventListener('pagehide', cancelMotion);
    window.addEventListener('pageshow', schedule, { passive: true });
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) schedule();
      else cancelMotion();
    });
  }

  root.setAttribute('data-geometry-ready', 'true');
  window.PolymythIndra = Object.freeze({
    canonicalId: canonicalId,
    palette: RAINBOW_HEX,
    normalizePath: normalizePath,
    seedOf: seedOf,
    cameraAt: function (progress, secondary) { return cameraPoint(secondary ? 1 : 0, progress); },
    rainbowAt: rainbowColor,
    cameraForKey: function (key, registerName, progress, secondary) {
      var normalized = normalizePath(key);
      var pair = seedPair(normalized, '');
      var isSecondary = !!secondary;
      return cameraPointFor(
        isSecondary ? CAMERA_SECONDARY : CAMERA_PRIMARY,
        isSecondary ? pair.second : pair.first,
        isSecondary ? pair.first : pair.second,
        /^(?:quiet|standard|expressive)$/.test(registerName) ? registerName : routeRegister(normalized),
        isSecondary,
        progress
      );
    },
    cameraForSeed: function (key, explicitSeed, registerName, progress, secondary) {
      var normalized = normalizePath(key);
      var pair = seedPair(normalized, explicitSeed);
      var isSecondary = !!secondary;
      return cameraPointFor(
        isSecondary ? CAMERA_SECONDARY : CAMERA_PRIMARY,
        isSecondary ? pair.second : pair.first,
        isSecondary ? pair.first : pair.second,
        /^(?:quiet|standard|expressive)$/.test(registerName) ? registerName : routeRegister(normalized),
        isSecondary,
        progress
      );
    }
  });
})();
